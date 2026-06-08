
# /feed Page — Full Audit

A complete map of every API, AI call, data flow, and feature on the Live Intelligence Feed page, plus a working/not-working status and a prioritized improvement roadmap.

---

## 1. Page Composition (`src/routes/feed.tsx`)

Top-to-bottom layout:

1. **LiveTicker** — scrolling market marquee (crypto, FX, commodities, indices)
2. **Header** — "Live Intelligence Feed" + 2 action buttons
   - `Ingest real news` → calls `ingestRealNews` server fn
   - `Generate fresh intel` → calls `generateEvents` server fn
3. **LiveStatsBar** — 4 KPIs: events/min, active countries, avg risk, markets up/down
4. **"N new events" pill** — appears via Supabase Realtime when new rows hit `events`
5. **Topic chips** — All + `TOPICS` array (category filter)
6. **Filter row** — search input, Countries multi-select, Industries multi-select, Risk & Confidence range popover
7. **Active filter badges** + result counter
8. **Card grid** — `IntelCard` components (3 cols xl)

---

## 2. External APIs / AI / Tools Used

### AI provider
| Where | Tool | Model | Purpose |
|---|---|---|---|
| `generateEvents` (events.functions.ts) | Groq via `@ai-sdk/openai-compatible` + `generateObject` | `llama-3.3-70b-versatile` | Synthesize 6–14 fake-but-plausible global events into `EventSchema` |
| `ingestRealNews` (sources.functions.ts) | Groq + `generateText` (manual JSON parse) | `llama-3.3-70b-versatile` | Enrich real RSS headlines into structured events |
| `analyzeEvent` (event detail page) | Groq + `generateText` | same | Cascading impacts + predictions (used after navigating into a card) |

Key: `GROQ_API_KEY` (Supabase secret). Free tier ~30 req/min, 14.4k/day.

### Real-world data sources (no keys, free)
| API | File | Used by |
|---|---|---|
| BBC World/Business/Tech RSS, Al Jazeera RSS, Fox World RSS, Deutsche Welle RSS, The Guardian RSS | `sources.functions.ts` | `Ingest real news` button |
| CoinGecko `simple/price` (BTC, ETH, SOL + 24h change) | `markets.functions.ts` | LiveTicker |
| Frankfurter `v1/latest` (ECB FX: EUR, JPY, GBP, CNY) | `markets.functions.ts` | LiveTicker |
| Yahoo Finance `v7/finance/quote` (GC=F gold, CL=F oil, ^GSPC, ^NDX, ^VIX, FX % change) | `markets.functions.ts` | LiveTicker |

### Backend (Lovable Cloud / Supabase)
- Tables read: `events`, `event_impacts`, `market_quotes`
- Tables written: `events` (via `supabaseAdmin`), `saved_events`, `votes` (auth-scoped via `requireSupabaseAuth`)
- Realtime channels: `events-live` (new-event pill), `live-stats` (KPI invalidation), `market_quotes-ticker` (ticker invalidation)

### Internal server functions called from the page
- `listEvents` — load cards (TanStack Query, key `["events", active]`)
- `generateEvents` — Groq synthetic batch insert
- `ingestRealNews` — RSS fetch + Groq enrichment + insert
- `listMarketQuotes` (inside LiveTicker) — reads `market_quotes`, opportunistic refresh if >90s stale (calls `refreshMarkets` which hits CoinGecko + Frankfurter + Yahoo)
- `liveStats` (inside LiveStatsBar) — aggregates events/impacts/quotes counters
- `toggleSave`, `castVote` (per card)

---

## 3. Feature Status

| Feature | Status | Notes |
|---|---|---|
| Card list / pagination | ✅ Works | Limit 40, ordered DESC by `created_at` |
| Topic chip filter | ✅ Works | Server-side via `.in("category", topics)` |
| Search box | ✅ Works | Client-side over headline/summary/countries/industries |
| Countries / Industries multi-select | ⚠️ Partial | Options derived only from the 40 currently-loaded events — not the full DB universe |
| Risk + Confidence range | ✅ Works | Client-side filter |
| Active filter badges + clear | ✅ Works | |
| "N new events" realtime pill | ✅ Works | Supabase Realtime INSERT on `events` |
| Generate fresh intel (Groq) | ✅ Works | Switched to `generateObject` with `BatchSchema` — fixed the previous `AI_NoObjectGeneratedError` |
| Ingest real news (RSS → Groq) | ✅ Works | Has heuristic fallback if Groq fails; **but** uses `generateText` + manual JSON parsing instead of `generateObject` (brittle) |
| LiveTicker scrolling marquee | ✅ Works | 20s refetch + realtime + opportunistic refresh on stale |
| LiveStatsBar KPIs | ✅ Works | 12s refetch + realtime invalidation |
| Save / Vote buttons | ✅ Works | Auth-gated, optimistic, toasts on error |
| Navigate to event detail | ✅ Works | `Link to="/event/$id"` |
| SEO head meta | ✅ Present | Title + description set, no og:image |
| Mobile layout | ✅ Works | Grid collapses to 1/2/3 columns |

No P0 bugs detected in the current code.

---

## 4. Known Weaknesses / Risks

1. **Filter universe is too small** — Countries/Industries dropdowns reflect only the 40 visible events, hiding most options.
2. **Search is client-only** — typing doesn't search the rest of the DB; only the 40 fetched.
3. **`ingestRealNews` uses `generateText` + manual `JSON.parse`** — same fragility class that hit `generateEvents` before; should migrate to `generateObject` + `BatchSchema`.
4. **Yahoo Finance unofficial endpoint** — can return 401/empty without warning; ticker silently drops those quotes.
5. **No deduplication on RSS ingest** — same headline can be inserted on repeated clicks.
6. **No infinite scroll / pagination** — capped at 40, no "Load more".
7. **No "time since" / freshness indicator** on each card.
8. **No optimistic insert** when user clicks Generate — they wait for the round-trip, then cards animate in.
9. **Save/Vote initial state not hydrated** — every card starts as `saved=false`, `voted=0` even when the user already saved/voted previously.
10. **No empty-state CTA when filters return 0** vs. when the feed is truly empty (currently same UI).
11. **No analytics on which topics/categories users filter** — losing product signal.
12. **No share / copy-link per event** from the card.
13. **`og:image`** not set on the route head → poor link unfurls.
14. **Marquee animation** depends on a `animate-marquee` Tailwind class — verify it pauses on hover for accessibility.
15. **Cron** — `/api/public/cron-markets` and `/api/public/cron-refresh` exist but no scheduler is wired; freshness relies on opportunistic refresh in `listMarketQuotes`.

---

## 5. Proposed Improvements (prioritized)

### P1 — High impact, low effort
- **Move Countries/Industries filter to server**: add `distinct` aggregation server fn `listFilterFacets()` that returns the union across the full `events` table (last 7 days).
- **Server-side search**: pass `query` into `listEvents` and use Postgres `ilike` / FTS on `headline || summary`.
- **Dedupe RSS ingest**: hash `lower(headline)` against the last 200 rows before insert.
- **Migrate `ingestRealNews` to `generateObject`** with a Zod schema (same pattern that fixed `generateEvents`).
- **Hydrate save/vote state**: new `listMyInteractions(eventIds)` server fn, merge into card props.
- **Empty-state polish**: distinguish "no events yet" vs. "no events match filters → Clear filters".

### P2 — Bigger UX wins
- **Infinite scroll** via TanStack Query `useInfiniteQuery` with `created_at` cursor.
- **Freshness chip** on each card (`2m ago`, pulse if <60s).
- **Auto-ingest every 60s** in the background (silent) so the "N new events" pill keeps appearing without user clicks. Wire `/api/public/cron-refresh` to a scheduler or in-page interval.
- **Optimistic skeleton** while `generateEvents`/`ingestRealNews` are in flight — append 6–10 shimmer cards at the top.
- **Per-card share menu**: copy link, X/LinkedIn share, "open source" → original article URL (requires storing source URLs in `events`).
- **Marquee accessibility**: pause on hover/focus, `prefers-reduced-motion` honored.

### P3 — Strategic
- **Add a "Sources" column to `events`** storing real URLs from GDELT/RSS so cards can deep-link to the original article.
- **GDELT integration** (already in `.lovable/plan.md`) as a higher-volume, structured news source alongside the 7 RSS feeds.
- **Personalized ranking**: re-rank cards by overlap with `user_interests` once the user is signed in.
- **Saved-event indicator counts** on topic chips ("AI · 12 saved").
- **Server-side filter analytics**: log filter combinations to a `feed_filter_events` table for product insight.
- **Edge caching** on `listEvents` (Cloudflare `Cache-Control: s-maxage=15`) since the feed is publicly readable.
- **og:image generation** per route (or static hero) for share unfurls.

---

## 6. Quick Reference — Data Flow Diagram

```text
[User clicks Generate]      [User clicks Ingest]      [Auto, every 12–20s]
        |                          |                            |
        v                          v                            v
  generateEvents()          ingestRealNews()              listMarketQuotes()
  (Groq llama-3.3)          RSS x7 -> Groq enrich        CoinGecko+Frankfurter+Yahoo
        |                          |                            |
        +-------> INSERT events <--+                            v
                       |                              UPSERT market_quotes
                       v                                        |
        Supabase Realtime INSERT --> "N new events" pill        v
                       v                                  LiveTicker re-renders
                  listEvents()
                       |
                       v
                IntelCard grid
```

---

## 7. Suggested Next Action

If you'd like me to proceed, I'd pick the **P1 batch** in one pass:
1. Server-side facets for Country/Industry filters
2. Server-side search in `listEvents`
3. RSS dedupe + `generateObject` migration for `ingestRealNews`
4. Hydrate saved/voted state per card
5. Distinguish empty vs. filtered-empty states

Tell me which items to implement (or "do all P1") and I'll switch to build mode.
