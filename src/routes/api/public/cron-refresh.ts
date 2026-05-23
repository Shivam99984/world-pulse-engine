import { createFileRoute } from "@tanstack/react-router";
import { generateEvents } from "@/lib/events.functions";

export const Route = createFileRoute("/api/public/cron-refresh")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const r = await generateEvents();
          return Response.json({ ok: true, inserted: r.inserted });
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
