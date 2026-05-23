import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "./ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function getGateway() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return createLovableAiGatewayProvider(key);
}

const StorylineSchema = z.object({
  storylines: z
    .array(
      z.object({
        title: z.string(),
        thesis: z.string(),
        tags: z.array(z.string()).min(1).max(6),
        risk_score: z.number().min(0).max(100),
        event_indices: z.array(z.number().int()).min(2).max(10),
        rationales: z.array(z.string()).min(2).max(10),
      }),
    )
    .min(2)
    .max(6),
});

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
        `${i}. [${e.category}] ${e.headline} — ${e.summary} (${(e.countries as string[]).join(", ")})`,
    )
    .join("\n");

  const gateway = getGateway();
  const { output } = await generateText({
    model: gateway(DEFAULT_MODEL),
    output: Output.object({ schema: StorylineSchema }),
    system:
      "You are GeoPulse AI's Storyline Engine. Cluster related events into coherent narratives (a 'storyline'). Each storyline should have a sharp title, a 2-3 sentence thesis, and reference 2-10 of the provided event indices. Rationales array must align 1:1 with event_indices and explain why each event belongs.",
    prompt: `Cluster these recent events into 2-5 storylines.\n\nEVENTS:\n${numbered}`,
  });

  // Clear old storylines to avoid duplicates piling up
  await supabaseAdmin.from("storylines").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  let inserted = 0;
  for (const s of output.storylines) {
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
    const links = s.event_indices
      .map((idx, i) => {
        const e = events[idx];
        if (!e) return null;
        return {
          storyline_id: row.id,
          event_id: e.id,
          ordinal: i,
          rationale: s.rationales[i] ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
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
