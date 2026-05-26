import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMarketQuotes } from "@/lib/markets.functions";
import { supabase } from "@/integrations/supabase/client";
import { Sparkline } from "./Sparkline";
import { cn } from "@/lib/utils";

interface Quote {
  symbol: string;
  label: string;
  category: string;
  price: number;
  change_24h: number;
  history: { t: number; v: number }[];
}

function formatPrice(symbol: string, p: number) {
  if (symbol === "BTC" || symbol === "ETH" || symbol === "SOL")
    return p >= 1000 ? `$${p.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `$${p.toFixed(2)}`;
  if (symbol === "USDJPY" || symbol === "USDCNY") return p.toFixed(2);
  if (symbol === "EURUSD" || symbol === "GBPUSD") return p.toFixed(4);
  if (symbol === "VIX") return p.toFixed(2);
  return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function LiveTicker({ className }: { className?: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listMarketQuotes);
  const { data } = useQuery({
    queryKey: ["market-quotes"],
    queryFn: () => list(),
    refetchInterval: 20_000,
    staleTime: 10_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("market_quotes-ticker")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "market_quotes" },
        () => qc.invalidateQueries({ queryKey: ["market-quotes"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const quotes = ((data?.quotes as unknown as Quote[]) ?? []).filter((q) => q.price > 0);
  if (quotes.length === 0) {
    return (
      <div className={cn("h-10 border-y border-border/60 bg-card/40 backdrop-blur", className)} aria-hidden />
    );
  }

  // Duplicate for seamless scroll
  const loop = [...quotes, ...quotes];

  return (
    <div
      className={cn(
        "relative overflow-hidden border-y border-border/60 bg-card/40 backdrop-blur",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-background to-transparent" />
      <div className="flex animate-marquee whitespace-nowrap py-2.5">
        {loop.map((q, i) => {
          const up = q.change_24h >= 0;
          const color = up ? "rgb(34,197,94)" : "rgb(239,68,68)";
          const pts = (q.history ?? []).map((h) => h.v);
          return (
            <div
              key={`${q.symbol}-${i}`}
              className="mx-5 inline-flex items-center gap-2.5 text-xs"
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {q.symbol}
              </span>
              <span className="font-mono font-semibold text-foreground">
                {formatPrice(q.symbol, q.price)}
              </span>
              <span
                className="font-mono text-[11px]"
                style={{ color }}
              >
                {up ? "▲" : "▼"} {Math.abs(q.change_24h).toFixed(2)}%
              </span>
              <Sparkline points={pts} width={56} height={16} color={color} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
