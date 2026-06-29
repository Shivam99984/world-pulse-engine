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

// Yahoo's chart endpoint works without auth/cookies and returns
// regularMarketPrice + chartPreviousClose, letting us compute 24h change.
async function fetchYahooChart(yhSymbol: string): Promise<{ price: number; change: number } | null> {
  const data = await safeJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yhSymbol)}?interval=1d&range=5d`,
  );
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = Number(meta.regularMarketPrice ?? 0);
  const prev = Number(meta.chartPreviousClose ?? meta.previousClose ?? 0);
  if (!price || !prev) return null;
  return { price, change: ((price - prev) / prev) * 100 };
}

async function fetchFx(): Promise<Quote[]> {
  const pairs: { sym: string; label: string; yh: string }[] = [
    { sym: "EURUSD", label: "EUR/USD", yh: "EURUSD=X" },
    { sym: "USDJPY", label: "USD/JPY", yh: "USDJPY=X" },
    { sym: "GBPUSD", label: "GBP/USD", yh: "GBPUSD=X" },
    { sym: "USDCNY", label: "USD/CNY", yh: "USDCNY=X" },
  ];
  const results = await Promise.all(pairs.map((p) => fetchYahooChart(p.yh)));
  const out: Quote[] = [];
  pairs.forEach((p, i) => {
    const r = results[i];
    if (r) out.push({ symbol: p.sym, label: p.label, category: "fx", price: r.price, change_24h: r.change });
  });
  // Frankfurter fallback for any missing pair (ECB rates, no change available)
  if (out.length < pairs.length) {
    const fr = await safeJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,JPY,GBP,CNY");
    if (fr?.rates) {
      const have = new Set(out.map((q) => q.symbol));
      const fallback: Record<string, number> = {
        EURUSD: 1 / Number(fr.rates.EUR),
        USDJPY: Number(fr.rates.JPY),
        GBPUSD: 1 / Number(fr.rates.GBP),
        USDCNY: Number(fr.rates.CNY),
      };
      for (const p of pairs) {
        if (have.has(p.sym)) continue;
        const price = fallback[p.sym];
        if (price > 0) out.push({ symbol: p.sym, label: p.label, category: "fx", price, change_24h: 0 });
      }
    }
  }
  return out;
}

async function fetchYahoo(): Promise<Quote[]> {
  const map: { yh: string; sym: string; label: string; cat: Quote["category"] }[] = [
    { yh: "GC=F", sym: "GOLD", label: "Gold", cat: "commodity" },
    { yh: "CL=F", sym: "OIL", label: "Crude Oil", cat: "commodity" },
    { yh: "^GSPC", sym: "SPX", label: "S&P 500", cat: "index" },
    { yh: "^NDX", sym: "NDX", label: "Nasdaq 100", cat: "index" },
    { yh: "^VIX", sym: "VIX", label: "Volatility", cat: "index" },
  ];
  const results = await Promise.all(map.map((m) => fetchYahooChart(m.yh)));
  const out: Quote[] = [];
  map.forEach((m, i) => {
    const r = results[i];
    if (r) out.push({ symbol: m.sym, label: m.label, category: m.cat, price: r.price, change_24h: r.change });
  });
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
