import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getGateway() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY missing");
  return createLovableAiGatewayProvider(key);
}

const StorylineItemSchema = z.object({
  title: z.string().min(3),
  thesis: z.string().min(20),
  tags: z.array(z.string()).min(1).max(6),
  risk_score: z.number().min(0).max(100),
  event_indices: z.array(z.number().int()).min(2).max(10),
  rationales: z.array(z.string()).min(2).max(10),
});

type StorylineDraft = z.infer<typeof StorylineItemSchema>;

type ClusterEvent = {
  headline: string;
  summary: string | null;
  category: string | null;
  countries: unknown;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

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
    if (start === -1 || end <= start) throw new Error("No JSON object found");
    cleaned = cleaned.slice(start, end + 1);
  }

  return JSON.parse(cleaned);
}

function asStringArray(value: unknown, fallback: string[], max = 6) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, max);
  return items.length ? items : fallback;
}

function formatCountries(value: unknown) {
  return asStringArray(value, ["global"], 8).join(", ");
}

function normalizeIndices(value: unknown, eventCount: number) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item) && item >= 0 && item < eventCount),
    ),
  ).slice(0, 10);
}

function parseStorylineDrafts(raw: string, eventCount: number): StorylineDraft[] {
  try {
    const parsed = extractJSON(raw);
    const payload = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    const candidates = Array.isArray(parsed)
      ? parsed
      : Array.isArray(payload.storylines)
        ? payload.storylines
        : [];

    return candidates
      .map((candidate) => {
        const row = candidate && typeof candidate === "object" ? (candidate as Record<string, unknown>) : {};
        const event_indices = normalizeIndices(row.event_indices, eventCount);
        const rationales = asStringArray(
          row.rationales,
          event_indices.map(() => "Related through geography, sector exposure, or timing."),
          10,
        ).slice(0, event_indices.length);
        const draft = {
          title: String(row.title ?? "Emerging global signal cluster").trim().slice(0, 140),
          thesis: String(
            row.thesis ??
              "Recent events show connected geopolitical, economic, or security signals worth monitoring together.",
          )
            .trim()
            .slice(0, 700),
          tags: asStringArray(row.tags, ["global", "risk"], 6),
          risk_score: Math.round(clamp(Number(row.risk_score ?? 55), 0, 100)),
          event_indices,
          rationales: rationales.length >= 2 ? rationales : event_indices.map(() => "Related signal."),
        };
        const result = StorylineItemSchema.safeParse(draft);
        return result.success ? result.data : null;
      })
      .filter((item): item is StorylineDraft => item !== null)
      .slice(0, 6);
  } catch {
    return [];
  }
}

function fallbackStorylines(events: ClusterEvent[]): StorylineDraft[] {
  const midpoint = Math.max(2, Math.ceil(events.length / 2));
  const first = events.slice(0, Math.min(midpoint, 6)).map((_, index) => index);
  const secondStart = Math.max(0, midpoint - 1);
  const second = events.slice(secondStart, Math.min(events.length, secondStart + 6)).map((_, index) => index + secondStart);

  return [
    {
      title: "Front-line global risk signals",
      thesis:
        "Recent high-salience events share overlapping geopolitical and economic risk channels. The cluster should be monitored for rapid shifts in country exposure, sector pressure, and headline velocity.",
      tags: ["global", "risk", "policy"],
      risk_score: 62,
      event_indices: first.length >= 2 ? first : [0, 1],
      rationales: (first.length >= 2 ? first : [0, 1]).map(
        () => "Included because it is among the newest signals in the live feed.",
      ),
    },
    {
      title: "Secondary spillover watchlist",
      thesis:
        "A second set of live signals points to broader market, policy, and regional spillovers. These events may become more important if they begin reinforcing the front-line risk cluster.",
      tags: ["markets", "spillover", "watchlist"],
      risk_score: 48,
      event_indices: second.length >= 2 ? second : [1, 2],
      rationales: (second.length >= 2 ? second : [1, 2]).map(
        () => "Included because it may amplify or transmit related risk into adjacent regions or sectors.",
      ),
    },
  ];
}

export const listStorylines = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("storylines")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return { storylines: data ?? [] };
});

export const getStoryline = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { data: storyline } = await supabaseAdmin
      .from("storylines")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!storyline) return { storyline: null, events: [] };

    const { data: links } = await supabaseAdmin
      .from("storyline_events")
      .select("event_id,ordinal,rationale")
      .eq("storyline_id", data.id)
      .order("ordinal");

    const ids = (links ?? []).map((l) => l.event_id);
    const { data: events } = ids.length
      ? await supabaseAdmin.from("events").select("*").in("id", ids)
      : { data: [] as never[] };

    const eventsById = new Map((events ?? []).map((e) => [e.id, e]));
    const ordered = (links ?? [])
      .map((l) => ({ event: eventsById.get(l.event_id), rationale: l.rationale }))
      .filter((x) => x.event);
    return { storyline, events: ordered };
  });

export const clusterStorylines = createServerFn({ method: "POST" }).handler(async () => {
  const { data: events } = await supabaseAdmin
    .from("events")
    .select("id,headline,summary,category,countries")
    .order("created_at", { ascending: false })
    .limit(40);
  if (!events || events.length < 4) {
    throw new Error("Need at least 4 events to cluster. Generate some intel first.");
  }

  const numbered = events
    .map(
      (e, i) =>
        `${i}. [${e.category ?? "global"}] ${e.headline} — ${e.summary ?? "No summary available."} (${formatCountries(e.countries)})`,
    )
    .join("\n");

  const gateway = getGateway();
  let storylines: StorylineDraft[] = [];
  try {
    const { text } = await generateText({
      model: gateway(DEFAULT_MODEL),
      system:
        "You are GeoPulse AI's Storyline Engine. Respond ONLY with raw JSON (no markdown fences). The JSON must be an object with a storylines array. Each storyline needs title, thesis, tags, risk_score, event_indices, and rationales.",
      prompt: `Respond ONLY with raw JSON. Cluster these recent events into 2-5 storylines. Use zero-based event_indices from the list. Example shape: {"storylines":[{"title":"Policy shock cluster","thesis":"Two to three sentences connecting the signals.","tags":["policy","markets"],"risk_score":64,"event_indices":[0,2],"rationales":["Why event 0 belongs","Why event 2 belongs"]}]}\n\nEVENTS:\n${numbered}`,
    });
    storylines = parseStorylineDrafts(text, events.length);
  } catch (error) {
    console.warn("Storyline clustering AI failed, using fallback", error);
  }

  if (storylines.length < 2) {
    storylines = fallbackStorylines(events);
  }

  // Clear old storylines to avoid duplicates piling up
  await supabaseAdmin.from("storylines").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let inserted = 0;
  for (const s of storylines) {
    const { data: row } = await supabaseAdmin
      .from("storylines")
      .insert({
        title: s.title,
        thesis: s.thesis,
        tags: s.tags,
        risk_score: Math.round(s.risk_score),
      })
      .select("id")
      .single();
    if (!row) continue;
    type StorylineLink = {
      storyline_id: string;
      event_id: string;
      ordinal: number;
      rationale: string | null;
    };
    const links = s.event_indices
      .map((idx: number, i: number): StorylineLink | null => {
        const e = events[idx];
        if (!e) return null;
        return {
          storyline_id: row.id,
          event_id: e.id,
          ordinal: i,
          rationale: s.rationales[i] ?? null,
        };
      })
      .filter((x): x is StorylineLink => x !== null);
    if (links.length) await supabaseAdmin.from("storyline_events").insert(links);
    inserted++;
  }
  return { inserted };
});

export const getEventAccuracy = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { data: rows } = await supabaseAdmin
      .from("votes")
      .select("value")
      .eq("event_id", data.id);
    const total = rows?.length ?? 0;
    const up = (rows ?? []).filter((r) => r.value === 1).length;
    const accuracy = total > 0 ? Math.round((up / total) * 100) : null;
    return { accuracy, total };
  });
