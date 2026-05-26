import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const liveStats = createServerFn({ method: "GET" }).handler(async () => {
  const since5m = new Date(Date.now() - 5 * 60_000).toISOString();
  const since1h = new Date(Date.now() - 60 * 60_000).toISOString();

  const [recentEvents, recentImpacts, riskSample, quotes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("id,created_at,risk_score", { count: "exact" })
      .gte("created_at", since5m),
    supabaseAdmin
      .from("event_impacts")
      .select("country_code,created_at")
      .gte("created_at", since1h),
    supabaseAdmin
      .from("events")
      .select("risk_score")
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin.from("market_quotes").select("change_24h"),
  ]);

  const eventsPerMin = Math.round(((recentEvents.data?.length ?? 0) / 5) * 10) / 10;
  const activeCountries = new Set((recentImpacts.data ?? []).map((r) => r.country_code)).size;
  const avgRisk =
    (riskSample.data ?? []).length > 0
      ? Math.round(
          (riskSample.data ?? []).reduce((s, r) => s + (r.risk_score ?? 0), 0) /
            (riskSample.data ?? []).length,
        )
      : 0;
  const marketsUp = (quotes.data ?? []).filter((q) => Number(q.change_24h) > 0).length;
  const marketsDown = (quotes.data ?? []).filter((q) => Number(q.change_24h) < 0).length;

  return { eventsPerMin, activeCountries, avgRisk, marketsUp, marketsDown };
});
