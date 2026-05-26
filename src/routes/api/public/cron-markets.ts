import { createFileRoute } from "@tanstack/react-router";
import { refreshMarkets } from "@/lib/markets.functions";

export const Route = createFileRoute("/api/public/cron-markets")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const r = await refreshMarkets();
          return Response.json({ ok: true, updated: r.updated });
        } catch (e) {
          return Response.json(
            { ok: false, error: (e as Error).message },
            { status: 500 },
          );
        }
      },
    },
  },
});
