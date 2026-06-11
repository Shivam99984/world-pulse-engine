
-- 1. Source URLs on events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS source_urls text[] NOT NULL DEFAULT '{}'::text[];

-- 2. GIN indexes to speed up array overlap and topic counts
CREATE INDEX IF NOT EXISTS events_countries_gin ON public.events USING gin (countries);
CREATE INDEX IF NOT EXISTS events_industries_gin ON public.events USING gin (industries);
CREATE INDEX IF NOT EXISTS events_category_idx ON public.events (category);

-- 3. Filter analytics
CREATE TABLE IF NOT EXISTS public.feed_filter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  topics text[] NOT NULL DEFAULT '{}'::text[],
  countries text[] NOT NULL DEFAULT '{}'::text[],
  industries text[] NOT NULL DEFAULT '{}'::text[],
  query text,
  result_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feed_filter_events TO anon, authenticated;
GRANT ALL ON public.feed_filter_events TO service_role;

ALTER TABLE public.feed_filter_events ENABLE ROW LEVEL SECURITY;

-- Anyone can log a filter event (insert-only). Reads are admin/service-role only.
CREATE POLICY "filter_events_insert_any" ON public.feed_filter_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS feed_filter_events_created_at_idx
  ON public.feed_filter_events (created_at DESC);
