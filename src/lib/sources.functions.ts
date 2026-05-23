import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FEEDS = [
  { url: "https://feeds.reuters.com/reuters/topNews", source: "Reuters" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { url: "https://feeds.npr.org/1004/rss.xml", source: "NPR World" },
];

const Enriched = z.object({
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

  const { output } = await generateText({
    model: gateway(DEFAULT_MODEL),
    output: Output.object({ schema: Enriched }),
    system:
      "You are GeoPulse AI's enrichment engine. Take raw real-world headlines and convert each into a structured intelligence event with sentiment, risk score, confidence, affected countries (ISO names), industries, and sources. Use the original outlet in sources. Categories must be one of: Economy, AI, Crypto, Politics, Defense, Space, Startups, Technology, Sports, Climate, Commodities, Energy, Healthcare, Trade.",
    prompt: `Enrich these ${collected.length} real headlines into structured GeoPulse events. Mark items as breaking only if clearly time-sensitive.\n\n${headlinesText}`,
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
  return { inserted: data?.length ?? 0, fetched: collected.length };
});
