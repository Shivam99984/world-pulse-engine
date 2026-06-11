import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Lightweight, fire-and-forget filter telemetry. Insert-only RLS.
export const logFilterEvent = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      topics?: string[];
      countries?: string[];
      industries?: string[];
      query?: string;
      result_count?: number;
    }) => input,
  )
  .handler(async ({ data }) => {
    try {
      await supabaseAdmin.from("feed_filter_events").insert({
        topics: data.topics ?? [],
        countries: data.countries ?? [],
        industries: data.industries ?? [],
        query: (data.query ?? "").slice(0, 200) || null,
        result_count: data.result_count ?? null,
      });
    } catch {
      /* analytics is non-critical */
    }
    return { ok: true };
  });

// Aggregate saved-event counts grouped by event category.
// Powers the "AI · 12 saved" hint on topic chips.
export const topicSavedCounts = createServerFn({ method: "GET" }).handler(async () => {
  // Pull recent saved rows joined with their event category.
  const { data, error } = await supabaseAdmin
    .from("saved_events")
    .select("event_id, events!inner(category)")
    .limit(2000);
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const r of (data ?? []) as Array<{ events: { category: string } | null }>) {
    const cat = r.events?.category;
    if (!cat) continue;
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return { counts };
});
