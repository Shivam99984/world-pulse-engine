import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const FALLBACK = [
  "AI chips lead Asia equities higher as Taiwan exports surge",
  "Brent crude steady near $84 as OPEC+ holds output cuts",
  "ECB signals patience on rate cuts amid sticky services inflation",
  "South Korea unveils $19B sovereign AI compute initiative",
  "Container shipping rates climb on Red Sea rerouting",
  "BTC volatility expands; perps funding flips positive",
  "EU pushes deeper sanctions framework on dual-use tech",
  "India monsoon rainfall 8% above long-period average",
];

export function NewsTicker({ items }: { items?: string[] }) {
  const list = items && items.length > 0 ? items : FALLBACK;
  const [paused, setPaused] = useState(false);
  // double the list so the marquee loops seamlessly
  const doubled = [...list, ...list];

  // pause on tab hidden to save battery
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div
      className="relative w-full overflow-hidden border-y border-border bg-card/60 backdrop-blur"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-background to-transparent" />
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="relative inline-flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
        </span>
        <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-danger">
          Live
        </span>
        <div
          className="flex min-w-0 flex-1 whitespace-nowrap animate-ticker"
          style={{ animationPlayState: paused ? "paused" : "running" }}
        >
          {doubled.map((t, i) => (
            <motion.span
              key={i}
              className="mx-6 text-sm text-muted-foreground"
              initial={false}
            >
              <span className="mr-2 text-primary">●</span>
              {t}
            </motion.span>
          ))}
        </div>
      </div>
    </div>
  );
}
