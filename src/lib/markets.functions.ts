import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type HistPt = { t: number; v: number };

type Quote = {
  symbol: string;
  label: string;
  category: "crypto" | "fx" | "commodity" | "index";
  price: number;
  change_24h: number;
};

async function safeJson(url: string, init?: RequestInit): Promise<any | null> {
  try {
    const r = await fetch(url, {
      ...init,
      headers: { "User-Agent": "GeoPulseAI/1.0", Accept: "application/json", ...(init?.headers ?? {}) },
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function fetchCrypto(): Promise<Quote[]> {
  const data = await safeJson(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true",
  );
  if (!data) return [];
  const out: Quote[] = [];
  const map: Record<string, { sym: string; label: string }> = {
    bitcoin: { sym: "BTC", label: "Bitcoin" },
    ethereum: { sym: "ETH", label: "Ethereum" },
    solana: { sym: "SOL", label: "Solana" },
  };
  for (const [id, meta] of Object.entries(map)) {
    const row = data[id];
    if (!row) continue;
    out.push({
      symbol: meta.sym,
      label: meta.label,
      category: "crypto",
      price: Number(row.usd ?? 0),
      change_24h: Number(row.usd_24h_change ?? 0),
    });
  }
  return out;
}

async function fetchFx(): Promise<Quote[]> {
  // Frankfurter is ECB-backed, free, no key
  const data = await safeJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,JPY,GBP,CNY");
  const prev = await safeJson("https://api.frankfurter.dev/v1/2000-01-01..?base=USD&symbols=EUR,JPY,GBP,CNY"); // ignored
  void prev;
  if (!data?.rates) return [];
  // FX doesn't give 24h change from Frankfurter latest; fetch yesterday
  const y = await safeJson("https://api.frankfurter.dev/v1/2024-01-02?base=USD&symbols=EUR,JPY,GBP,CNY");
  void y;
  // Use Yahoo for FX change instead — better signal
  const yh = await safeJson(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=EURUSD=X,USDJPY=X,GBPUSD=X,USDCNY=X",
  );
  const yhMap: Record<string, number> = {};
  for (const q of yh?.quoteResponse?.result ?? []) {
    yhMap[q.symbol] = Number(q.regularMarketChangePercent ?? 0);
  }
  return [
    { symbol: "EURUSD", label: "EUR/USD", category: "fx", price: 1 / Number(data.rates.EUR), change_24h: yhMap["EURUSD=X"] ?? 0 },
    { symbol: "USDJPY", label: "USD/JPY", category: "fx", price: Number(data.rates.JPY), change_24h: yhMap["USDJPY=X"] ?? 0 },
    { symbol: "GBPUSD", label: "GBP/USD", category: "fx", price: 1 / Number(data.rates.GBP), change_24h: yhMap["GBPUSD=X"] ?? 0 },
    { symbol: "USDCNY", label: "USD/CNY", category: "fx", price: Number(data.rates.CNY), change_24h: yhMap["USDCNY=X"] ?? 0 },
  ];
}

async function fetchYahoo(): Promise<Quote[]> {
  const data = await safeJson(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=GC=F,CL=F,^GSPC,^NDX,^VIX",
  );
  const rows: any[] = data?.quoteResponse?.result ?? [];
  const map: Record<string, { sym: string; label: string; cat: Quote["category"] }> = {
    "GC=F": { sym: "GOLD", label: "Gold", cat: "commodity" },
    "CL=F": { sym: "OIL", label: "Crude Oil", cat: "commodity" },
    "^GSPC": { sym: "SPX", label: "S&P 500", cat: "index" },
    "^NDX": { sym: "NDX", label: "Nasdaq 100", cat: "index" },
    "^VIX": { sym: "VIX", label: "Volatility", cat: "index" },
  };
  const out: Quote[] = [];
  for (const q of rows) {
    const meta = map[q.symbol];
    if (!meta) continue;
    out.push({
      symbol: meta.sym,
      label: meta.label,
      category: meta.cat,
      price: Number(q.regularMarketPrice ?? 0),
      change_24h: Number(q.regularMarketChangePercent ?? 0),
    });
  }
  return out;
}

export const refreshMarkets = createServerFn({ method: "POST" }).handler(async () => {
  const [crypto, fx, yh] = await Promise.all([fetchCrypto(), fetchFx(), fetchYahoo()]);
  const quotes = [...crypto, ...fx, ...yh].filter((q) => q.price > 0);
  if (quotes.length === 0) return { updated: 0 };

  // load existing histories to append
  const { data: existing } = await supabaseAdmin
    .from("market_quotes")
    .select("symbol,history");
  const histMap = new Map<string, HistPt[]>();
  for (const r of existing ?? []) {
    histMap.set(r.symbol, Array.isArray(r.history) ? (r.history as HistPt[]) : []);
  }

  const now = Date.now();
  const rows = quotes.map((q) => {
    const prev = histMap.get(q.symbol) ?? [];
    const nextHist = [...prev, { t: now, v: q.price }].slice(-30);
    return {
      symbol: q.symbol,
      label: q.label,
      category: q.category,
      price: q.price,
      change_24h: q.change_24h,
      history: nextHist,
      updated_at: new Date(now).toISOString(),
    };
  });

  const { error } = await supabaseAdmin.from("market_quotes").upsert(rows, { onConflict: "symbol" });
  if (error) throw new Error(error.message);
  return { updated: rows.length };
});

export const listMarketQuotes = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("market_quotes")
    .select("*")
    .order("category", { ascending: true })
    .order("symbol", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  // If stale (>90s) or empty, refresh opportunistically
  const newest = rows.reduce((m, r) => Math.max(m, new Date(r.updated_at as string).getTime()), 0);
  const stale = rows.length === 0 || Date.now() - newest > 90_000;
  if (stale) {
    try {
      await refreshMarkets();
      const { data: fresh } = await supabaseAdmin
        .from("market_quotes")
        .select("*")
        .order("category", { ascending: true })
        .order("symbol", { ascending: true });
      return { quotes: fresh ?? [], refreshed: true };
    } catch {
      // fall through
    }
  }
  return { quotes: rows, refreshed: false };
});
