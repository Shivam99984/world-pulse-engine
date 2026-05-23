import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RadioTower, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { IntelCard, IntelCardSkeleton, type IntelEvent } from "@/components/intel-card";
import { generateEvents, listEvents } from "@/lib/events.functions";
import { TOPICS } from "@/lib/topics";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Live Intelligence Feed — GeoPulse AI" },
      {
        name: "description",
        content:
          "Real-time global intelligence feed with AI-powered impact analysis, sentiment, and risk scoring.",
      },
    ],
  }),
  component: FeedPage,
});

function FeedPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [active, setActive] = useState<string[]>([]);
  const list = useServerFn(listEvents);
  const generate = useServerFn(generateEvents);
  const [generating, setGenerating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["events", active],
    queryFn: () => list({ data: { topics: active.length ? active : undefined, limit: 40 } }),
  });

  const events = (data?.events ?? []) as IntelEvent[];

  async function onGenerate() {
    setGenerating(true);
    toast.message("Generating intelligence stream…", { description: "AI is composing live events." });
    try {
      const r = await generate();
      toast.success(`Added ${r.inserted} new events`);
      await qc.invalidateQueries({ queryKey: ["events"] });
      router.invalidate();
    } catch (e) {
      toast.error("Failed to generate events", { description: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Live Intelligence Feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-clustered events across geopolitics, markets, technology, and social.
          </p>
        </div>
        <Button onClick={onGenerate} disabled={generating} className="shadow-glow">
          {generating ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 h-4 w-4" />
          )}
          Generate fresh intel
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        <button
          onClick={() => setActive([])}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            active.length === 0
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          All
        </button>
        {TOPICS.map((t) => {
          const on = active.includes(t);
          return (
            <button
              key={t}
              onClick={() =>
                setActive((prev) => (on ? prev.filter((x) => x !== t) : [...prev, t]))
              }
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          Array.from({ length: 9 }).map((_, i) => <IntelCardSkeleton key={i} />)}
        {!isLoading && events.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <RefreshCw className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No intelligence yet. Tap <span className="font-medium">Generate fresh intel</span> to
              compose live events with AI.
            </p>
          </div>
        )}
        {events.map((e, i) => (
          <IntelCard key={e.id} event={e} index={i} />
        ))}
      </div>
    </div>
  );
}
