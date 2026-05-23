import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider, DEFAULT_MODEL } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        // Pull recent events as live context
        const { data: events } = await supabaseAdmin
          .from("events")
          .select("headline,summary,category,countries,risk_score,sentiment")
          .order("created_at", { ascending: false })
          .limit(25);

        const context = (events ?? [])
          .map(
            (e, i) =>
              `${i + 1}. [${e.category}] ${e.headline} — ${e.summary} (countries: ${(e.countries as string[]).join(", ")}; risk ${e.risk_score}; sentiment ${e.sentiment})`,
          )
          .join("\n");

        const system = `You are GeoPulse AI, a real-time global intelligence analyst. Be precise, balanced, and quantitative. Use the live event context below when relevant. If a user asks about a topic absent from the context, say so plainly and reason from general knowledge. Use short paragraphs and bullet lists. Avoid fluff.\n\n=== LIVE EVENTS (last 25) ===\n${context || "(no events yet)"}\n=== END EVENTS ===`;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway(DEFAULT_MODEL),
          system,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
