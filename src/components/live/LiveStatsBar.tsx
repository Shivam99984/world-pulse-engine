import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, Globe2, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { liveStats } from "@/lib/live-stats.functions";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export function LiveStatsBar({ className }: { className?: string }) {
  const qc = useQueryClient();
  const fn = useServerFn(liveStats);
  const { data } = useQuery({
    queryKey: ["live-stats"],
    queryFn: () => fn(),
    refetchInterval: 12_000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("live-stats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () =>
        qc.invalidateQueries({ queryKey: ["live-stats"] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_impacts" },
        () => qc.invalidateQueries({ queryKey: ["live-stats"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const stats = data ?? { eventsPerMin: 0, activeCountries: 0, avgRisk: 0, marketsUp: 0, marketsDown: 0 };

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-2 rounded-xl border border-border bg-card/60 p-3 backdrop-blur sm:grid-cols-4",
        className,
      )}
    >
      <Stat
        icon={<Activity className="h-3.5 w-3.5" />}
        label="Events / min"
        value={stats.eventsPerMin.toFixed(1)}
        tone="text-primary"
        pulse
      />
      <Stat
        icon={<Globe2 className="h-3.5 w-3.5" />}
        label="Active countries"
        value={stats.activeCountries}
        tone="text-foreground"
      />
      <Stat
        icon={<ShieldAlert className="h-3.5 w-3.5" />}
        label="Avg risk"
        value={stats.avgRisk}
        tone={stats.avgRisk >= 60 ? "text-red-500" : stats.avgRisk >= 35 ? "text-orange-500" : "text-emerald-500"}
      />
      <Stat
        icon={
          stats.marketsUp >= stats.marketsDown ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )
        }
        label="Markets"
        value={
          <span>
            <span className="text-emerald-500">{stats.marketsUp}↑</span>{" "}
            <span className="text-red-500">{stats.marketsDown}↓</span>
          </span>
        }
        tone="text-foreground"
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: string;
  pulse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
      <div className={cn("grid h-8 w-8 place-items-center rounded-md bg-background/60", tone)}>
        {icon}
        {pulse && (
          <span className="ml-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={cn("font-mono text-sm font-semibold leading-tight", tone)}>{value}</div>
      </div>
    </div>
  );
}
