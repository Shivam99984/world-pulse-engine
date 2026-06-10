import { createFileRoute } from "@tanstack/react-router";

// SSE stream of newly inserted events. Polls the DB every few seconds and
// pushes any rows whose created_at is newer than the last cursor.
// Public, read-only — only returns columns already exposed by the feed.
export const Route = createFileRoute("/api/public/events-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = new URL(request.url);
        const sinceParam = url.searchParams.get("since");
        let cursor = sinceParam ? new Date(sinceParam) : new Date();
        if (Number.isNaN(cursor.getTime())) cursor = new Date();

        const encoder = new TextEncoder();
        const POLL_MS = 4000;
        const PING_MS = 25_000;

        const stream = new ReadableStream({
          async start(controller) {
            let closed = false;
            const send = (event: string, data: unknown) => {
              if (closed) return;
              try {
                controller.enqueue(
                  encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
                );
              } catch {
                closed = true;
              }
            };

            send("ready", { since: cursor.toISOString() });

            const pingId = setInterval(() => {
              if (closed) return;
              try {
                controller.enqueue(encoder.encode(`: ping\n\n`));
              } catch {
                closed = true;
              }
            }, PING_MS);

            const poll = async () => {
              if (closed) return;
              try {
                const { data, error } = await supabaseAdmin
                  .from("events")
                  .select(
                    "id, headline, summary, category, countries, industries, risk_score, confidence, sentiment, sources, breaking, created_at",
                  )
                  .gt("created_at", cursor.toISOString())
                  .order("created_at", { ascending: true })
                  .limit(50);
                if (!error && data && data.length > 0) {
                  for (const row of data) {
                    send("event", row);
                    const ts = new Date(row.created_at);
                    if (ts > cursor) cursor = ts;
                  }
                }
              } catch {
                /* swallow — keep stream alive */
              }
            };

            const pollId = setInterval(poll, POLL_MS);

            const cleanup = () => {
              if (closed) return;
              closed = true;
              clearInterval(pingId);
              clearInterval(pollId);
              try {
                controller.close();
              } catch {
                /* ignore */
              }
            };

            request.signal.addEventListener("abort", cleanup);
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
