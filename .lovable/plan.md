# GeoPulse AI — Step-by-Step Build Roadmap

We already shipped the foundation (Cloud + AI Gateway + schema, hero, feed, 3D globe, event detail, dashboard skeleton, social, auth). This plan picks up from there and sequences the remaining work into shippable phases. Each step is small enough to land in one build turn.

## Phase 1 — Finish the MVP loop (current phase)

1. **Wire interactions**: hook Save / Vote buttons in `IntelCard` to `toggleSave` / `castVote`, optimistic UI, toasts on auth-required.
2. **Event detail polish**: trigger `analyzeEvent` on first view, render impact list + per-country narratives + prediction timeline with Framer Motion stagger.
3. **Globe ↔ feed link**: clicking a globe marker opens a side `Sheet` with the event card and a "Open analysis" button.
4. **Seed data**: a one-click "Generate starter intel" admin button (rate-limited) so a fresh visitor never sees an empty feed.
5. **Loading/empty/error states**: shimmer skeletons everywhere, friendly empty states, toast on 429/402 from the AI gateway.
6. **SEO + footer**: per-route `head()` meta (already partly there), `public/llms.txt`, footer with nav + legal stubs.

## Phase 2 — Intelligence depth

7. **"Ask GeoPulse" chat**: streaming server route at `src/routes/api/chat.ts` using `streamText` + recent events as context; floating chat panel on every page.
8. **Personalized dashboard**: interest picker (chips from `TOPICS`), then a daily AI brief generated from the user's interests, plus risk alerts widget.
9. **Prediction tracking**: store prediction outcomes over time; show "AI accuracy" badge per event using `votes` + future verification.
10. **Multi-event clustering**: a server function that asks the model to cluster related events into a single "Storyline" (timeline view).

## Phase 3 — Live signal layer

11. **Social Intelligence v2**: AI-generated viral trend cards with sentiment spikes, influencer impact ("if X says Y, here's the reaction map"), hashtag heat.
12. **World heatmap upgrades**: country pulse rings, trade-flow arcs between impacted countries, country drill-down panel (risk / sentiment / top events).
13. **Scheduled refresh**: `/api/public/cron-refresh` route (signature-verified) that calls `generateEvents` every N minutes via pg_cron, so the feed feels alive without manual clicks.
14. **Realtime feed**: enable Supabase realtime on `events`; new cards slide in with a "Breaking" pulse.

## Phase 4 — Community & trust

15. **Reputation system**: separate `user_roles` + `reputation_points` tables, points for accurate votes, leaderboard.
16. **Expert notes**: comment thread per event with markdown + upvotes; flagged-as-expert badge.
17. **Fake-news reporting**: report flow, AI re-evaluates confidence, lowers risk score on consensus.

## Phase 5 — Real data + monetization

18. **Real source adapters**: pluggable adapters for NewsAPI / Reuters RSS / Reddit / X — same `events` schema, AI just enriches.
19. **Subscription tiers**: Stripe via the payments connector — Free / Pro (chat + alerts) / Terminal (API access).
20. **Public API**: `/api/public/v1/events` with API-key auth for Pro+ subscribers.

## Technical notes

- All AI calls stay server-side via `createServerFn` + `createLovableAiGatewayProvider` (`google/gemini-3-flash-preview`), structured output via `Output.object` + Zod.
- New tables (storylines, reputation, comments, reports) go through `supabase--migration` with RLS from day one — public read on intel data, per-user writes elsewhere, roles in a separate table.
- Streaming chat = server route (`/api/chat`), one-shot AI = `createServerFn`. Cron = `/api/public/*` with HMAC verification.
- Heavy components (`react-globe.gl`, chat) lazy-loaded; respect `prefers-reduced-motion`.
- No mock data after Phase 1 — everything is AI-generated and cached in DB to control cost.

## Out of scope (intentionally deferred)

- Native mobile apps, sound design, vector DB / RAG over historical news, model fine-tuning, on-prem deployment, multi-language UI.

## Suggested next step

Approve this plan and I'll start with **Phase 1, steps 1–3** (wire Save/Vote, polish event detail with `analyzeEvent`, and link the globe to the feed) in the first build turn.
