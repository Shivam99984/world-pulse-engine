import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyApiKey } from "@/lib/api-keys.functions";

export const Route = createFileRoute("/api/public/v1/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const raw = auth.replace(/^Bearer\s+/i, "").trim();
        const key = await verifyApiKey(raw);
        if (!key) {
          return Response.json(
            { error: "Invalid or missing API key. Use Authorization: Bearer gp_live_…" },
            { status: 401 },
          );
        }

        const url = new URL(request.url);
        const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "20", 10) || 20, 100);
        const category = url.searchParams.get("category");

        let q = supabaseAdmin
          .from("events")
          .select(
            "id,headline,summary,category,sentiment,risk_score,confidence,countries,industries,sources,breaking,created_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (category) q = q.eq("category", category);

        const { data, error } = await q;
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        return Response.json(
          { data, count: data?.length ?? 0 },
          {
            headers: {
              "Cache-Control": "public, max-age=30",
              "Access-Control-Allow-Origin": "*",
            },
          },
        );
      },
    },
  },
});
