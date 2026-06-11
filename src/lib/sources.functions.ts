import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FEEDS = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC Business" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC Tech" },
  { url: "https://moxie.foxnews.com/google-publisher/world.xml", source: "Fox World" },
  { url: "https://rss.dw.com/rdf/rss-en-world", source: "Deutsche Welle" },
  { url: "https://www.theguardian.com/world/rss", source: "The Guardian" },
];

function stripHtml(s: string) {
  return s
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/gi, " ")
    .trim();
}

function parseRss(xml: string, max = 8): { title: string; description: string; link: string }[] {
  const items: { title: string; description: string; link: string }[] = [];
  const re = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < max) {
    const block = m[1];
    const title = stripHtml(/<title>([\s\S]*?)<\/title>/i.exec(block)?.[1] ?? "");
    const desc = stripHtml(/<description>([\s\S]*?)<\/description>/i.exec(block)?.[1] ?? "");
    const link = stripHtml(/<link>([\s\S]*?)<\/link>/i.exec(block)?.[1] ?? "");
    if (title) items.push({ title, description: desc, link });
  }
  return items;
}

// GDELT 2.1 free DOC API: high-volume, structured global news with article URLs.
// https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/  — no key, generous limits.
async function fetchGdelt(): Promise<{ title: string; description: string; link: string; source: string }[]> {
  try {
    const u =
      "https://api.gdeltproject.org/api/v2/doc/doc?query=sourcelang:eng&mode=ArtList&format=json&maxrecords=25&sort=DateDesc";
    const r = await fetch(u, { headers: { "User-Agent": "GeoPulseAI/1.0" } });
    if (!r.ok) return [];
    const j = (await r.json()) as { articles?: Array<{ title?: string; url?: string; domain?: string; seendate?: string }> };
    return (j.articles ?? [])
      .filter((a) => a.title && a.url)
      .map((a) => ({
        title: stripHtml(a.title!).slice(0, 240),
        description: "",
        link: a.url!,
        source: a.domain ?? "GDELT",
      }));
  } catch {
    return [];
  }
}

const EnrichedSchema = z.object({
  events: z
    .array(
      z.object({
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
      }),
    )
    .min(1)
    .max(20),
});

export const ingestRealNews = createServerFn({ method: "POST" }).handler(async () => {
  const collected: { title: string; description: string; source: string }[] = [];
  await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const r = await fetch(f.url, { headers: { "User-Agent": "GeoPulseAI/1.0" } });
        if (!r.ok) return;
        const xml = await r.text();
        for (const it of parseRss(xml, 6)) {
          collected.push({ ...it, source: f.source });
        }
      } catch {
        // skip failing feed
      }
    }),
  );

  if (collected.length === 0) {
    throw new Error("No real-world headlines could be fetched right now.");
  }

  // Dedupe within batch (case-insensitive headline)
  const seen = new Set<string>();
  const unique = collected.filter((c) => {
    const k = c.title.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  // Dedupe against recent rows in the events table
  const { data: recent } = await supabaseAdmin
    .from("events")
    .select("headline")
    .order("created_at", { ascending: false })
    .limit(200);
  const existing = new Set(
    (recent ?? []).map((r) => (r.headline as string).toLowerCase().trim()),
  );
  const fresh = unique.filter((c) => !existing.has(c.title.toLowerCase().trim()));

  if (fresh.length === 0) {
    return { inserted: 0, fetched: collected.length, ai_enriched: false, deduped: true };
  }

  // Heuristic fallback (used when AI is unavailable)
  const NEG = ["war", "attack", "crash", "ban", "sanction", "killed", "dies", "strike", "loss", "decline", "risk", "crisis"];
  const POS = ["deal", "growth", "record", "win", "boost", "approve", "agreement", "rally", "gain"];
  const CAT_RULES: Array<[RegExp, string]> = [
    [/\b(ai|chatgpt|openai|model|llm)\b/i, "AI"],
    [/\b(bitcoin|crypto|ethereum|token)\b/i, "Crypto"],
    [/\b(stock|market|inflation|gdp|economy|bank)\b/i, "Economy"],
    [/\b(oil|gas|opec|gold|commodity)\b/i, "Commodities"],
    [/\b(climate|weather|emission|wildfire|flood)\b/i, "Climate"],
    [/\b(war|military|missile|nato|defense|army)\b/i, "Defense"],
    [/\b(election|president|government|parliament|minister)\b/i, "Politics"],
    [/\b(startup|funding|series [a-d]|vc)\b/i, "Startups"],
    [/\b(space|nasa|spacex|rocket|satellite)\b/i, "Space"],
    [/\b(tech|software|google|apple|microsoft|chip)\b/i, "Technology"],
  ];
  const scoreSentiment = (s: string) => {
    const t = s.toLowerCase();
    let v = 0;
    for (const w of NEG) if (t.includes(w)) v -= 0.2;
    for (const w of POS) if (t.includes(w)) v += 0.2;
    return Math.max(-1, Math.min(1, v));
  };
  const guessCategory = (s: string) => {
    for (const [re, cat] of CAT_RULES) if (re.test(s)) return cat;
    return "Politics";
  };
  type Row = {
    headline: string;
    summary: string;
    category: string;
    sentiment: number;
    risk_score: number;
    confidence: number;
    countries: string[];
    industries: string[];
    sources: string[];
    breaking: boolean;
  };
  const fallbackRows: Row[] = fresh.slice(0, 12).map((c) => {
    const text = `${c.title} ${c.description}`;
    const sentiment = scoreSentiment(text);
    return {
      headline: c.title,
      summary: c.description.slice(0, 400) || c.title,
      category: guessCategory(text),
      sentiment,
      risk_score: Math.round(50 + Math.abs(sentiment) * 30),
      confidence: 55,
      countries: [],
      industries: [],
      sources: [c.source],
      breaking: false,
    };
  });

  let rows: Row[] = [];
  const key = process.env.GROQ_API_KEY;
  if (key) {
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const headlinesText = fresh
        .slice(0, 24)
        .map((c, i) => `${i + 1}. [${c.source}] ${c.title}\n   ${c.description.slice(0, 280)}`)
        .join("\n");

      const { object: output } = await generateObject({
        model: gateway(DEFAULT_MODEL),
        schema: EnrichedSchema,
        system:
          "You are GeoPulse AI's enrichment engine. Return JSON. Categories must be one of: Economy, AI, Crypto, Politics, Defense, Space, Startups, Technology, Sports, Climate, Commodities, Energy, Healthcare, Trade. Use realistic country and industry names. Mark breaking only if clearly time-sensitive.",
        prompt: `Enrich these ${fresh.length} real headlines into structured GeoPulse events. Use the original outlet as the source. Preserve the original headline.\n\n${headlinesText}`,
      });

      rows = output.events.map((e) => ({
        headline: e.headline,
        summary: e.summary,
        category: e.category,
        sentiment: Math.max(-1, Math.min(1, e.sentiment)),
        risk_score: Math.round(Math.max(0, Math.min(100, e.risk_score))),
        confidence: Math.round(Math.max(0, Math.min(100, e.confidence))),
        countries: e.countries,
        industries: e.industries,
        sources: e.sources,
        breaking: e.breaking,
      }));
    } catch (err) {
      console.warn("AI enrichment unavailable, using raw RSS fallback:", (err as Error).message);
    }
  }

  const aiEnriched = rows.length > 0;
  if (!aiEnriched) rows = fallbackRows;
  if (rows.length === 0) throw new Error("No events to insert");

  const { data, error } = await supabaseAdmin.from("events").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return {
    inserted: data?.length ?? 0,
    fetched: collected.length,
    ai_enriched: aiEnriched,
    deduped: collected.length - fresh.length > 0,
  };
});
