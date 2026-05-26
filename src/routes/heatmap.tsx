import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Activity, Radio } from "lucide-react";
import { listCountryRisk } from "@/lib/events.functions";
import { supabase } from "@/integrations/supabase/client";
import { SplitText } from "@/components/rb/SplitText";
import { ScrambleText } from "@/components/rb/ScrambleText";
import { Silk } from "@/components/rb/Silk";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/heatmap")({
  head: () => ({
    meta: [
      { title: "Global Risk Heatmap — GeoPulse AI" },
      {
        name: "description",
        content:
          "Real-time global heatmap of country risk levels driven by live AI event impact analysis.",
      },
    ],
  }),
  component: HeatmapPage,
});

function riskTier(score: number) {
  if (score >= 75) return { label: "Critical", color: "#dc2626", glow: "rgba(220,38,38,0.55)" };
  if (score >= 55) return { label: "High", color: "#f97316", glow: "rgba(249,115,22,0.5)" };
  if (score >= 35) return { label: "Elevated", color: "#f59e0b", glow: "rgba(245,158,11,0.45)" };
  if (score >= 15) return { label: "Guarded", color: "#22c55e", glow: "rgba(34,197,94,0.4)" };
  return { label: "Low", color: "#3b82f6", glow: "rgba(59,130,246,0.35)" };
}

// Mercator-ish projection in a 0..1 range, clamped to readable lats
function project(lat: number, lng: number) {
  const x = (lng + 180) / 360;
  const clamped = Math.max(Math.min(lat, 75), -60);
  const y = (90 - clamped) / 150;
  return { x, y };
}

function HeatmapPage() {
  const qc = useQueryClient();
  const fetchRisk = useServerFn(listCountryRisk);
  const { data } = useQuery({
    queryKey: ["country-risk"],
    queryFn: () => fetchRisk(),
    refetchInterval: 30_000,
  });
  const [pulseId, setPulseId] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("event_impacts-heatmap")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_impacts" },
        (payload) => {
          const row = payload.new as { country_code?: string };
          if (row?.country_code) setPulseId(row.country_code);
          qc.invalidateQueries({ queryKey: ["country-risk"] });
          setTimeout(() => setPulseId(null), 1800);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const countries = data?.countries ?? [];
  const top = countries.slice(0, 10);
  const total = data?.total_signals ?? 0;

  const stats = useMemo(() => {
    const critical = countries.filter((c) => c.max_risk >= 75).length;
    const high = countries.filter((c) => c.max_risk >= 55 && c.max_risk < 75).length;
    const avg = countries.length
      ? Math.round(countries.reduce((s, c) => s + c.risk, 0) / countries.length)
      : 0;
    return { critical, high, avg };
  }, [countries]);

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-50">
        <Silk />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            Live realtime stream
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            <SplitText text="Global Risk Heatmap" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Country risk levels recomputed live as AI analyzes each new event impact.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Critical" value={stats.critical} tone="text-red-500" />
          <Stat label="High" value={stats.high} tone="text-orange-500" />
          <Stat label="Avg Risk" value={stats.avg} tone="text-primary" />
        </div>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card/70 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 text-primary" /> {countries.length} countries · {total} signals
          </span>
          <Legend />
        </div>
        <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
          <div className="relative aspect-[2/1] w-full overflow-hidden bg-[radial-gradient(ellipse_at_center,hsl(var(--background))_0%,transparent_70%)]">
            <WorldMapSvg />
            {countries.map((c) => {
              const { x, y } = project(c.lat, c.lng);
              const tier = riskTier(c.max_risk);
              const size = 8 + (c.max_risk / 100) * 28;
              const pulse = pulseId === c.country_code;
              return (
                <div
                  key={c.country_code}
                  className="group absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                >
                  <span
                    className={cn("absolute inset-0 rounded-full", pulse && "animate-ping")}
                    style={{
                      width: size,
                      height: size,
                      transform: "translate(-50%, -50%)",
                      background: tier.glow,
                      left: "50%",
                      top: "50%",
                    }}
                  />
                  <span
                    className="block rounded-full ring-2 ring-background/80 transition-transform group-hover:scale-125"
                    style={{
                      width: size,
                      height: size,
                      background: tier.color,
                      boxShadow: `0 0 ${size}px ${tier.glow}`,
                    }}
                  />
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[11px] opacity-0 shadow-elegant transition-opacity group-hover:opacity-100">
                    <div className="font-semibold">{c.country_name}</div>
                    <div className="text-muted-foreground">
                      {tier.label} · risk {c.max_risk} · {c.events} signals
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="border-t border-border/60 lg:border-l lg:border-t-0">
            <div className="px-4 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Top risk countries
            </div>
            <div className="max-h-[480px] divide-y divide-border/50 overflow-y-auto">
              {top.map((c) => {
                const tier = riskTier(c.max_risk);
                return (
                  <Link
                    key={c.country_code}
                    to="/event/$id"
                    params={{ id: c.last_event_id }}
                    className="group block px-4 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: tier.color, boxShadow: `0 0 10px ${tier.glow}` }}
                        />
                        <div className="text-sm font-semibold">{c.country_name}</div>
                      </div>
                      <span className="font-mono text-xs text-muted-foreground">
                        <ScrambleText text={String(c.max_risk)} duration={600} />
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {c.last_narrative}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Activity className="h-3 w-3" /> {c.events} signals
                      </span>
                      <span style={{ color: tier.color }}>{tier.label}</span>
                    </div>
                  </Link>
                );
              })}
              {top.length === 0 && (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  No country impacts yet. Risk pulses will appear here in real time.
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/70 px-4 py-2 backdrop-blur">
      <div className={cn("font-mono text-xl font-bold", tone)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function Legend() {
  const tiers = [
    { c: "#3b82f6", l: "Low" },
    { c: "#22c55e", l: "Guarded" },
    { c: "#f59e0b", l: "Elevated" },
    { c: "#f97316", l: "High" },
    { c: "#dc2626", l: "Critical" },
  ];
  return (
    <div className="flex items-center gap-2">
      {tiers.map((t) => (
        <span key={t.l} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full" style={{ background: t.c }} />
          {t.l}
        </span>
      ))}
    </div>
  );
}

function isLand(lng: number, lat: number) {
  // North America
  if (lat > 30 && lat < 60 && lng > -130 && lng < -65) return true;
  if (lat > 15 && lat < 32 && lng > -115 && lng < -80) return true;
  if (lat > 8 && lat < 18 && lng > -92 && lng < -77) return true;
  // Alaska
  if (lat > 55 && lat < 71 && lng > -168 && lng < -140) return true;
  // Greenland
  if (lat > 60 && lat < 82 && lng > -55 && lng < -20) return true;
  // South America
  if (lat > -35 && lat < 10 && lng > -78 && lng < -35) return true;
  if (lat > -55 && lat < -35 && lng > -73 && lng < -58) return true;
  // Europe
  if (lat > 40 && lat < 60 && lng > -10 && lng < 30) return true;
  if (lat > 55 && lat < 71 && lng > 5 && lng < 60) return true;
  // UK / Ireland
  if (lat > 50 && lat < 59 && lng > -10 && lng < 2) return true;
  // Africa
  if (lat > -35 && lat < 15 && lng > -18 && lng < 42) return true;
  if (lat > 5 && lat < 32 && lng > -17 && lng < 35) return true;
  // Madagascar
  if (lat > -26 && lat < -12 && lng > 43 && lng < 51) return true;
  // Middle East / Arabia
  if (lat > 12 && lat < 32 && lng > 33 && lng < 55) return true;
  // Asia mainland
  if (lat > 10 && lat < 55 && lng > 55 && lng < 140) return true;
  if (lat > 40 && lat < 72 && lng > 30 && lng < 180) return true;
  // India
  if (lat > 8 && lat < 28 && lng > 70 && lng < 90) return true;
  // SE Asia / Indonesia
  if (lat > -10 && lat < 22 && lng > 95 && lng < 141) return true;
  // Japan
  if (lat > 30 && lat < 46 && lng > 130 && lng < 146) return true;
  // Philippines
  if (lat > 5 && lat < 19 && lng > 117 && lng < 127) return true;
  // Australia
  if (lat > -38 && lat < -12 && lng > 113 && lng < 154) return true;
  // New Zealand
  if (lat > -47 && lat < -34 && lng > 166 && lng < 179) return true;
  return false;
}

function WorldMapSvg() {
  const dots = useMemo(() => {
    const cols = 110;
    const rows = 55;
    const out: Array<{ cx: number; cy: number }> = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const lng = (i / cols) * 360 - 180;
        const lat = 90 - (j / rows) * 180;
        // bias the southern bound up so Antarctica band is excluded
        if (lat < -58) continue;
        if (isLand(lng, lat)) {
          out.push({
            cx: ((lng + 180) / 360) * 1000,
            cy: ((90 - lat) / 180) * 500,
          });
        }
      }
    }
    return out;
  }, []);

  return (
    <svg
      viewBox="0 0 1000 500"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <pattern id="heatmap-grid" width="50" height="50" patternUnits="userSpaceOnUse">
          <path d="M 50 0 L 0 0 0 50" fill="none" stroke="currentColor" strokeWidth="0.4" />
        </pattern>
      </defs>
      <rect width="1000" height="500" fill="url(#heatmap-grid)" className="text-border/50" />
      <line x1="0" y1="250" x2="1000" y2="250" stroke="currentColor" strokeWidth="0.4" className="text-border/70" strokeDasharray="4 6" />
      <line x1="500" y1="0" x2="500" y2="500" stroke="currentColor" strokeWidth="0.4" className="text-border/70" strokeDasharray="4 6" />
      <g className="text-foreground/40">
        {dots.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r="2" fill="currentColor" />
        ))}
      </g>
    </svg>
  );
}
