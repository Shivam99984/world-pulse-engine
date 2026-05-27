import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
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

function parseRss(xml: string, max = 8): { title: string; description: string }[] {
  const items: { title: string; description: string }[] = [];
  const re = /<item[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < max) {
    const block = m[1];
    const title = stripHtml(/<title>([\s\S]*?)<\/title>/i.exec(block)?.[1] ?? "");
    const desc = stripHtml(/<description>([\s\S]*?)<\/description>/i.exec(block)?.[1] ?? "");
    if (title) items.push({ title, description: desc });
  }
  return items;
}

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

  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const gateway = createLovableAiGatewayProvider(key);

  const headlinesText = collected
    .slice(0, 24)
    .map(
      (c, i) =>
        `${i + 1}. [${c.source}] ${c.title}\n   ${c.description.slice(0, 280)}`,
    )
    .join("\n");

  const { text } = await generateText({
    model: gateway(DEFAULT_MODEL),
    system:
      'You are GeoPulse AI\'s enrichment engine. Respond ONLY with raw JSON (no markdown fences) of shape: {"events":[{"headline":string,"summary":string,"category":string,"sentiment":number(-1..1),"risk_score":number(0..100),"confidence":number(0..100),"countries":string[],"industries":string[],"sources":string[],"breaking":boolean}]}. Categories must be one of: Economy, AI, Crypto, Politics, Defense, Space, Startups, Technology, Sports, Climate, Commodities, Energy, Healthcare, Trade.',
    prompt: `Enrich these ${collected.length} real headlines into GeoPulse JSON events. Use the original outlet in sources. Mark breaking only if clearly time-sensitive.\n\n${headlinesText}`,
  });

  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  const jsonStart = cleaned.indexOf("{");
  const jsonEnd = cleaned.lastIndexOf("}");
  const payload = jsonStart >= 0 ? cleaned.slice(jsonStart, jsonEnd + 1) : cleaned;

  let parsed: { events?: unknown[] };
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new Error("AI returned non-JSON output");
  }

  const Item = z.object({
    headline: z.string().min(1),
    summary: z.string().min(1),
    category: z.string().min(1),
    sentiment: z.coerce.number(),
    risk_score: z.coerce.number(),
    confidence: z.coerce.number(),
    countries: z.array(z.string()).default([]),
    industries: z.array(z.string()).default([]),
    sources: z.array(z.string()).default([]),
    breaking: z.coerce.boolean().default(false),
  });

  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
  const rows = (parsed.events ?? [])
    .map((raw) => {
      const r = Item.safeParse(raw);
      return r.success ? r.data : null;
    })
    .filter((e): e is z.infer<typeof Item> => e !== null)
    .map((e) => ({
      headline: e.headline,
      summary: e.summary,
      category: e.category,
      sentiment: clamp(e.sentiment, -1, 1),
      risk_score: Math.round(clamp(e.risk_score, 0, 100)),
      confidence: Math.round(clamp(e.confidence, 0, 100)),
      countries: e.countries,
      industries: e.industries,
      sources: e.sources,
      breaking: e.breaking,
    }));

  if (rows.length === 0) throw new Error("No valid events parsed");

  const { data, error } = await supabaseAdmin.from("events").insert(rows).select("id");
  if (error) throw new Error(error.message);
  return { inserted: data?.length ?? 0, fetched: collected.length };
});
