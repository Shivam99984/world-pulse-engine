import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Layers, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clusterStorylines, listStorylines } from "@/lib/storylines.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/storylines")({
  head: () => ({
    meta: [
      { title: "Storylines — GeoPulse AI" },
      {
        name: "description",
        content: "AI-clustered narratives connecting related global intelligence events.",
      },
    ],
  }),
  component: StorylinesPage,
});

function StorylinesPage() {
  const qc = useQueryClient();
  const list = useServerFn(listStorylines);
  const cluster = useServerFn(clusterStorylines);
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["storylines"],
    queryFn: () => list(),
  });

  async function onCluster() {
    setRunning(true);
    toast.message("Clustering events…", { description: "AI is grouping related signals." });
    try {
      const r = await cluster();
      toast.success(`Built ${r.inserted} storylines`);
      await qc.invalidateQueries({ queryKey: ["storylines"] });
    } catch (e) {
      toast.error("Clustering failed", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  const storylines = data?.storylines ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-primary">
            <Layers className="mr-1 inline h-3.5 w-3.5" /> AI Storylines
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Connected narratives</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Related events clustered into evolving storylines, ranked by risk.
          </p>
        </div>
        <Button onClick={onCluster} disabled={running} className="shadow-glow">
          {running ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          Re-cluster events
        </Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-border bg-card p-5">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="mt-3 h-5 w-3/4 rounded bg-muted" />
              <div className="mt-2 h-4 w-full rounded bg-muted" />
            </div>
          ))}
        {!isLoading && storylines.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/50 p-12 text-center text-sm text-muted-foreground">
            No storylines yet. Tap <span className="font-medium">Re-cluster events</span> to build
            them from the live feed.
          </div>
        )}
        {storylines.map((s, i) => (
          <motion.div
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4) }}
          >
            <Link
              to="/storyline/$id"
              params={{ id: s.id }}
              className="group block h-full rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Storyline
                </span>
                <span className="text-xs text-muted-foreground">Risk {s.risk_score}</span>
              </div>
              <h2 className="mt-3 text-base font-semibold leading-snug group-hover:text-primary">
                {s.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                {s.thesis}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(s.tags as string[]).slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-xs text-primary">
                Open storyline <ArrowUpRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
