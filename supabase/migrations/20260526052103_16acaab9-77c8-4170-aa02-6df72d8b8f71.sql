CREATE TABLE public.market_quotes (
  symbol text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  change_24h numeric NOT NULL DEFAULT 0,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.market_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_quotes_public_read ON public.market_quotes
  FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.market_quotes;
ALTER TABLE public.market_quotes REPLICA IDENTITY FULL;