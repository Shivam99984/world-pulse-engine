import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

// Groq free tier: ~30 req/min, 14,400 req/day (no credit card required).
// https://console.groq.com — set GROQ_API_KEY as a project secret.
export const createGroqProvider = (apiKey: string) =>
  createOpenAICompatible({
    name: "groq",
    baseURL: "https://api.groq.com/openai/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

// Fast, capable free-tier model. Swap to "llama-3.1-8b-instant" for higher throughput.
export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Back-compat aliases (so existing imports keep working).
export const createLovableAiGatewayProvider = createGroqProvider;
