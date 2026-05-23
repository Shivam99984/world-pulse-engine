import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, ShieldCheck, Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/community.functions";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Analyst Leaderboard — GeoPulse AI" },
      {
        name: "description",
        content:
          "Top community analysts ranked by reputation, accurate votes, and expert contributions.",
      },
    ],
  }),
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const fetchBoard = useServerFn(getLeaderboard);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchBoard(),
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-warning" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analyst Leaderboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reputation rewards accurate voting and verified expert insight.
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && (data?.leaders?.length ?? 0) === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No reputation yet — vote on events to start climbing.
          </div>
        )}
        {data?.leaders?.map((l, i) => (
          <div
            key={l.user_id}
            className="flex items-center justify-between border-b border-border px-5 py-4 last:border-0"
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${
                  i === 0
                    ? "bg-warning/15 text-warning"
                    : i < 3
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i === 0 ? <Crown className="h-4 w-4" /> : i + 1}
              </span>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {l.display_name}
                  {l.is_expert && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <ShieldCheck className="h-3 w-3" /> Expert
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Analyst</div>
              </div>
            </div>
            <div className="text-sm font-semibold tabular-nums">{l.points} pts</div>
          </div>
        ))}
      </div>
    </div>
  );
}
