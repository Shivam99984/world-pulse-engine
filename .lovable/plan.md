# Add Live Data

Real signals + live UI across Feed, Heatmap, and Home.

## 1. Real news ingestion (no API key needed)

Use **GDELT 2.0 Doc API** (free, no key) as the primary news source. Tap GDELT's `doc` endpoint for the last 15 minutes of global English-language news, then feed the headlines/snippets into the existing AI pipeline to structure them into the `events` table — replacing the purely synthetic generator.

- New server fn `ingestRealEvents()` in `src/lib/ingest.functions.ts`:
  1. `fetch("https://api.gdeltproject.org/api/v2/doc/doc?...&format=json&maxrecords=30&timespan=15min")`
  2. Deduplicate by headline (case-insensitive) against the last 200 rows in `events`.
  3. Pass batches of ~10 fresh articles to the AI gateway (`google/gemini-3-flash-preview`) with a new prompt that **summarizes the real article** into our `EventSchema` (headline, summary, category, sentiment, risk_score, confidence, countries, industries, sources, breaking). Sources carry the actual outlet domains GDELT returns.
  4. Bulk insert into `events`.
- Update `/api/public/cron-refresh` to call `ingestRealEvents()` first; if 0 inserted, fall back to the existing `generateEvents()` so the feed never goes empty.
- Keep `generateEvents()` exported as a manual "demo refill" button on `/dashboard`.

## 2. Live market & economic data

New `market_quotes` table + server fn that polls free public APIs and writes a fresh snapshot every minute.

Migration:

```text
market_quotes
  symbol text PK     -- BTC, ETH, GOLD, OIL, EURUSD, USDJPY, GBPUSD, SPX, NDX
  label text         -- "Bitcoin", "Brent Crude", ...
  category text      -- crypto | fx | commodity | index
  price numeric
  change_24h numeric -- percentage
  history jsonb      -- last 30 points [{t, v}] for sparkline
  updated_at timestamptz
RLS: public_read = true; writes via supabaseAdmin only
realtime: ADD TABLE market_quotes TO publication supabase_realtime
```

Server fn `refreshMarkets()` in `src/lib/markets.functions.ts`:
- Crypto: `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true`
- FX: `https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,JPY,GBP,CNY` (free, no key, ECB-backed)
- Commodities + indices: `https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F,CL=F,^GSPC,^NDX` (free)
- For each symbol, append a `{t, v}` point to `history` (trim to 30), upsert row.

Server route `/api/public/cron-markets` (POST) calls `refreshMarkets()` so an external scheduler can hit it every 60s. The Feed/Heatmap/Home `LiveTicker` also calls `refreshMarkets()` opportunistically when stale (>60s) so the data feels live even without an external cron.

Read fn `listMarketQuotes()` returns the full table; consumed by TanStack Query with `refetchInterval: 15_000` and a Supabase realtime channel to invalidate immediately on updates.

## 3. Global live UI

Three reusable components in `src/components/live/`:

- `LiveTicker.tsx` — horizontal scrolling marquee at the top of Feed, Heatmap, and Home hero. Renders each market quote with symbol, price, 24h % (green/red), and a tiny 30-point inline SVG sparkline. Subscribes to the markets query.
- `LiveStatsBar.tsx` — compact row of counters: **events/min** (rolling 5-min average from `events.created_at`), **active countries** (distinct `country_code` in last hour from `event_impacts`), **avg risk** (mean of last 50 events' `risk_score`), **markets up/down** (count from quotes). Updates via TanStack Query (`refetchInterval: 10_000`) + `postgres_changes` subscriptions on `events` and `event_impacts`.
- `Sparkline.tsx` — pure SVG sparkline (props: `points: number[]`, `color`, `width`, `height`); no chart lib dependency.

New server fn `liveStats()` aggregates the three counters in one round-trip via `supabaseAdmin`.

Surface integration:
- **Home (`/`)**: `LiveTicker` directly under hero CTA + `LiveStatsBar` above feature grid.
- **Feed (`/feed`)**: `LiveTicker` above filters, `LiveStatsBar` between filters and event list.
- **Heatmap (`/heatmap`)**: `LiveStatsBar` replacing the current static stats row; `LiveTicker` above the map section.

## 4. Technical notes

- All fetches happen in server fns — no external API keys leak to the client.
- GDELT, Frankfurter, CoinGecko, Yahoo Finance all support CORS-free server fetches; no Node-only deps required (Worker-compatible).
- Existing `attachSupabaseAuth` middleware unaffected; new fns are public reads via `supabaseAdmin` (no auth needed for the ticker/stats).
- New realtime channel on `market_quotes` added to `supabase_realtime` publication.
- Failure isolation: each upstream source wrapped in try/catch so one bad provider doesn't blank the ticker.

## Files

Create:
- `src/lib/ingest.functions.ts`
- `src/lib/markets.functions.ts`
- `src/lib/live-stats.functions.ts`
- `src/routes/api/public/cron-markets.ts`
- `src/components/live/LiveTicker.tsx`
- `src/components/live/LiveStatsBar.tsx`
- `src/components/live/Sparkline.tsx`

Edit:
- `src/routes/api/public/cron-refresh.ts` — call `ingestRealEvents()` first
- `src/routes/index.tsx` — mount ticker + stats
- `src/routes/feed.tsx` — mount ticker + stats
- `src/routes/heatmap.tsx` — swap static stats for `LiveStatsBar`, add ticker

Migration:
- `market_quotes` table + RLS + realtime publication.
