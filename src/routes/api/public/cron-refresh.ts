import { createFileRoute } from "@tanstack/react-router";
import { generateEvents } from "@/lib/events.functions";
import { ingestRealNews } from "@/lib/sources.functions";
import { refreshMarkets } from "@/lib/markets.functions";

export const Route = createFileRoute("/api/public/cron-refresh")({
  server: {
    handlers: {
      POST: async () => {
        const result: {
          ok: boolean;
          ingested?: number;
          generated?: number;
          markets?: number;
          errors: string[];
        } = { ok: true, errors: [] };

        // 1. Try real news first
        try {
          const r = await ingestRealNews();
          result.ingested = r.inserted;
        } catch (e) {
          result.errors.push(`ingest: ${(e as Error).message}`);
        }

        // 2. Fall back to synthetic if nothing came in
        if (!result.ingested || result.ingested === 0) {
          try {
            const r = await generateEvents();
            result.generated = r.inserted;
          } catch (e) {
            result.errors.push(`generate: ${(e as Error).message}`);
          }
        }

        // 3. Refresh live market quotes
        try {
          const r = await refreshMarkets();
          result.markets = r.updated;
        } catch (e) {
          result.errors.push(`markets: ${(e as Error).message}`);
        }

        return Response.json(result, { status: result.errors.length > 0 && !result.ingested && !result.generated ? 500 : 200 });
      },
    },
  },
});
