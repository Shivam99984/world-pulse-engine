import { createServerFn } from "@tanstack/react-start";
import { generateText, generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  category: z.string(),
  sentiment: z.number().min(-1).max(1),
  risk_score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  countries: z.array(z.string()),
  industries: z.array(z.string()),
  sources: z.array(z.string()),
  breaking: z.boolean(),
});

const BatchSchema = z.object({ events: z.array(EventSchema).min(6).max(14) });

function getGateway() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");
  return createLovableAiGatewayProvider(key);
}

export const listEvents = createServerFn({ method: "GET" })
  .inputValidator(
    (input: {
      limit?: number;
      topics?: string[];
      query?: string;
      countries?: string[];
      industries?: string[];
      cursor?: string; // ISO created_at; return rows strictly older
    } | undefined) => input ?? {},
  )
  .handler(async ({ data }) => {
    const limit = Math.min(data.limit ?? 30, 100);
    let q = supabaseAdmin
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.cursor) q = q.lt("created_at", data.cursor);
    if (data.topics && data.topics.length > 0) q = q.in("category", data.topics);
    if (data.countries && data.countries.length > 0) q = q.overlaps("countries", data.countries);
    if (data.industries && data.industries.length > 0) q = q.overlaps("industries", data.industries);
    const term = (data.query ?? "").trim();
    if (term) {
      const esc = term.replace(/[,()]/g, " ").trim();
      q = q.or(`headline.ilike.%${esc}%,summary.ilike.%${esc}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const events = rows ?? [];
    const nextCursor =
      events.length === limit ? (events[events.length - 1].created_at as string) : null;
    return { events, nextCursor };
  });

// Distinct country/industry facets aggregated across recent events.
export const listEventFacets = createServerFn({ method: "GET" }).handler(async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("events")
    .select("countries,industries")
    .gte("created_at", since)
    .limit(1000);
  if (error) throw new Error(error.message);
  const countries = new Set<string>();
  const industries = new Set<string>();
  for (const r of data ?? []) {
    for (const c of (r.countries as string[]) ?? []) if (c) countries.add(c);
    for (const i of (r.industries as string[]) ?? []) if (i) industries.add(i);
  }
  return {
    countries: Array.from(countries).sort(),
    industries: Array.from(industries).sort(),
  };
});

// Hydrate the current user's saved + voted state for a set of event ids.
export const listMyInteractions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventIds: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.eventIds.length === 0) return { saved: [], votes: {} };
    const [{ data: saved }, { data: votes }] = await Promise.all([
      supabase.from("saved_events").select("event_id").in("event_id", data.eventIds),
      supabase.from("votes").select("event_id,value").in("event_id", data.eventIds),
    ]);
    const voteMap: Record<string, number> = {};
    for (const v of votes ?? []) voteMap[v.event_id as string] = v.value as number;
    return {
      saved: (saved ?? []).map((r) => r.event_id as string),
      votes: voteMap,
    };
  });

export const getEvent = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const [{ data: event }, { data: impacts }, { data: predictions }] = await Promise.all([
      supabaseAdmin.from("events").select("*").eq("id", data.id).maybeSingle(),
      supabaseAdmin.from("event_impacts").select("*").eq("event_id", data.id),
      supabaseAdmin
        .from("event_predictions")
        .select("*")
        .eq("event_id", data.id)
        .order("created_at", { ascending: true }),
    ]);
    return { event, impacts: impacts ?? [], predictions: predictions ?? [] };
  });

export const listImpactMarkers = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("event_impacts")
    .select("id,event_id,country_code,country_name,lat,lng,impact_score,narrative")
    .order("impact_score", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return { markers: data ?? [] };
});

export const listCountryRisk = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("event_impacts")
    .select("country_code,country_name,lat,lng,impact_score,event_id,narrative,created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);

  const byCountry = new Map<
    string,
    {
      country_code: string;
      country_name: string;
      lat: number;
      lng: number;
      risk: number;
      max_risk: number;
      events: number;
      last_event_id: string;
      last_narrative: string;
      last_at: string;
    }
  >();

  for (const r of data ?? []) {
    const key = r.country_code;
    const prev = byCountry.get(key);
    if (!prev) {
      byCountry.set(key, {
        country_code: r.country_code,
        country_name: r.country_name,
        lat: Number(r.lat),
        lng: Number(r.lng),
        risk: r.impact_score,
        max_risk: r.impact_score,
        events: 1,
        last_event_id: r.event_id,
        last_narrative: r.narrative,
        last_at: r.created_at,
      });
    } else {
      prev.events += 1;
      prev.risk = Math.round((prev.risk * (prev.events - 1) + r.impact_score) / prev.events);
      prev.max_risk = Math.max(prev.max_risk, r.impact_score);
    }
  }

  const countries = Array.from(byCountry.values()).sort((a, b) => b.max_risk - a.max_risk);
  return { countries, total_signals: data?.length ?? 0 };
});

export const generateEvents = createServerFn({ method: "POST" }).handler(async () => {
  const gateway = getGateway();
  const { object: output } = await generateObject({
    model: gateway(DEFAULT_MODEL),
    schema: BatchSchema,
    system:
      "You are GeoPulse AI, a real-time global intelligence engine. Return JSON. Generate diverse, plausible breaking events spanning geopolitics, markets, technology, energy, climate, defense, AI, and crypto. Be specific and grounded; avoid fictional country names. Sentiment is -1 (very negative) to 1 (very positive). Risk score 0-100. Confidence 0-100. Sources are realistic outlets (Reuters, Bloomberg, FT, Al Jazeera, Economic Times, Bloomberg, TechCrunch, X, Reddit).",
    prompt:
      "Return JSON. Generate 10 fresh global intelligence events for the next news cycle. Mix breaking and developing. Categories must be one of: Economy, AI, Crypto, Politics, Defense, Space, Startups, Technology, Sports, Climate, Commodities, Energy, Healthcare, Trade.",
  });

  const rows = output.events.map((e) => ({
    headline: e.headline,
    summary: e.summary,
    category: e.category,
    sentiment: e.sentiment,
    risk_score: Math.round(e.risk_score),
    confidence: Math.round(e.confidence),
    countries: e.countries,
    industries: e.industries,
    sources: e.sources,
    breaking: e.breaking,
  }));

  const { data, error } = await supabaseAdmin.from("events").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return { inserted: data?.length ?? 0 };
});

const ImpactSchema = z.object({
  countries: z
    .array(
      z.object({
        country_code: z.string().length(2),
        country_name: z.string(),
        lat: z.number(),
        lng: z.number(),
        impact_score: z.number().min(0).max(100),
        narrative: z.string(),
      }),
    )
    .min(3)
    .max(10),
  predictions: z
    .array(
      z.object({
        horizon: z.string(),
        prediction: z.string(),
        confidence: z.number().min(0).max(100),
      }),
    )
    .min(3)
    .max(6),
});

function extractJSON(raw: string): unknown {
  let cleaned = raw
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();

  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const objStart = cleaned.indexOf("{");
    const arrStart = cleaned.indexOf("[");
    const isArray = arrStart !== -1 && (objStart === -1 || arrStart < objStart);
    const start = isArray ? arrStart : objStart;
    const end = isArray ? cleaned.lastIndexOf("]") : cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) throw new Error("No valid JSON found in AI response");
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}

function fallbackImpact(event: { headline: string; category: string; countries: unknown; industries: unknown }) {
  const countries = Array.isArray(event.countries) && event.countries.length > 0 ? event.countries.map(String) : ["Global"];
  const primaryCountry = countries[0] || "Global";
  return {
    countries: [
      {
        country_code: "US",
        country_name: primaryCountry,
        lat: 38.9072,
        lng: -77.0369,
        impact_score: 62,
        narrative: `${event.headline} is likely to shape near-term policy, market positioning, and risk sentiment in ${primaryCountry}.`,
      },
      {
        country_code: "GB",
        country_name: "United Kingdom",
        lat: 51.5072,
        lng: -0.1276,
        impact_score: 48,
        narrative: `European desks may reassess exposure tied to ${event.category.toLowerCase()} and related cross-border flows.`,
      },
      {
        country_code: "JP",
        country_name: "Japan",
        lat: 35.6762,
        lng: 139.6503,
        impact_score: 41,
        narrative: "Asia-Pacific markets may price second-order effects as investors digest the latest signal.",
      },
    ],
    predictions: [
      { horizon: "24h", prediction: "News flow and market reaction remain elevated as official responses emerge.", confidence: 68 },
      { horizon: "1 week", prediction: "Related sectors may see repricing as analysts update exposure assumptions.", confidence: 61 },
      { horizon: "1 month", prediction: "Policy and corporate responses should clarify whether the impact is temporary or structural.", confidence: 54 },
    ],
  };
}

export const analyzeEvent = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { data: event } = await supabaseAdmin
      .from("events")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!event) throw new Error("Event not found");

    const { data: existing } = await supabaseAdmin
      .from("event_impacts")
      .select("id")
      .eq("event_id", data.id)
      .limit(1);
    if (existing && existing.length > 0) return { cached: true };

    let output: z.infer<typeof ImpactSchema>;
    try {
      const gateway = getGateway();
      const { text } = await generateText({
        model: gateway(DEFAULT_MODEL),
        system:
          'You are GeoPulse AI\'s Impact Engine. Respond ONLY with raw JSON (no markdown fences) of shape: {"countries":[{"country_code":"US","country_name":"United States","lat":38.9072,"lng":-77.0369,"impact_score":70,"narrative":"..."}],"predictions":[{"horizon":"24h","prediction":"...","confidence":70}]}. Given a global event, analyze cascading effects across countries, economies, and markets. Use realistic ISO-3166 alpha-2 country codes and accurate capital-city coordinates. Be specific and concrete.',
        prompt: `Analyze this event and return JSON:\nHEADLINE: ${event.headline}\nSUMMARY: ${event.summary}\nCATEGORY: ${event.category}\nCOUNTRIES: ${(event.countries as string[]).join(", ")}\nINDUSTRIES: ${(event.industries as string[]).join(", ")}\n\nReturn 5-8 affected countries with impact narratives, and 4-6 forward predictions across horizons (24h, 1 week, 1 month, 3 months).`,
      });

      const parsed = ImpactSchema.safeParse(extractJSON(text));
      output = parsed.success ? parsed.data : fallbackImpact(event);
    } catch (error) {
      console.warn("Event analysis AI unavailable, using heuristic fallback:", error);
      output = fallbackImpact(event);
    }

    await supabaseAdmin.from("event_impacts").insert(
      output.countries.map((c) => ({
        event_id: data.id,
        country_code: c.country_code,
        country_name: c.country_name,
        lat: c.lat,
        lng: c.lng,
        impact_score: Math.round(c.impact_score),
        narrative: c.narrative,
      })),
    );
    await supabaseAdmin.from("event_predictions").insert(
      output.predictions.map((p) => ({
        event_id: data.id,
        horizon: p.horizon,
        prediction: p.prediction,
        confidence: Math.round(p.confidence),
      })),
    );
    return { cached: false };
  });

// User actions (auth required)
export const toggleSave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("saved_events")
      .select("event_id")
      .eq("event_id", data.eventId)
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) {
      await supabase.from("saved_events").delete().eq("event_id", data.eventId).eq("user_id", userId);
      return { saved: false };
    }
    await supabase.from("saved_events").insert({ event_id: data.eventId, user_id: userId });
    return { saved: true };
  });

export const castVote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; value: 1 | -1 }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("votes")
      .upsert({ event_id: data.eventId, user_id: userId, value: data.value });
    return { ok: true };
  });

export const getMyInterests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data } = await supabase.from("user_interests").select("topic");
    return { topics: (data ?? []).map((r) => r.topic) };
  });

export const setMyInterests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { topics: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("user_interests").delete().eq("user_id", userId);
    if (data.topics.length > 0) {
      await supabase
        .from("user_interests")
        .insert(data.topics.map((t) => ({ user_id: userId, topic: t })));
    }
    return { ok: true };
  });

const BriefSchema = z.object({
  headline: z.string(),
  summary: z.string(),
  top_risks: z.array(z.string()).min(2).max(5),
  opportunities: z.array(z.string()).min(1).max(4),
  watchlist: z.array(z.string()).min(2).max(6),
});

export const generateBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: interests } = await supabase.from("user_interests").select("topic");
    const topics = (interests ?? []).map((r) => r.topic);

    let q = supabaseAdmin
      .from("events")
      .select("headline,summary,category,countries,risk_score,sentiment")
      .order("created_at", { ascending: false })
      .limit(20);
    if (topics.length > 0) q = q.in("category", topics);
    const { data: events } = await q;

    const ctx = (events ?? [])
      .map(
        (e, i) =>
          `${i + 1}. [${e.category}] ${e.headline} — ${e.summary} (countries: ${(e.countries as string[]).join(", ")}; risk ${e.risk_score})`,
      )
      .join("\n");

    const gateway = getGateway();
    const { object: output } = await generateObject({
      model: gateway(DEFAULT_MODEL),
      schema: BriefSchema,
      system:
        "You are GeoPulse AI, an executive intelligence briefer. Return JSON. Produce a sharp, specific daily brief tailored to the user's interests. Be quantitative, name countries and companies, avoid hedging.",
      prompt: `Return JSON. User interests: ${topics.length ? topics.join(", ") : "(all topics)"}\n\nRecent events:\n${ctx || "(none)"}\n\nWrite a personalized daily intelligence brief.`,
    });
    return { brief: output, generated_at: new Date().toISOString() };
  });

