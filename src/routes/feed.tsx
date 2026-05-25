import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RadioTower, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { IntelCard, IntelCardSkeleton, type IntelEvent } from "@/components/intel-card";
import { generateEvents, listEvents } from "@/lib/events.functions";
import { ingestRealNews } from "@/lib/sources.functions";
import { TOPICS } from "@/lib/topics";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { SplitText } from "@/components/rb/SplitText";

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
  const [query, setQuery] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [risk, setRisk] = useState<[number, number]>([0, 100]);
  const [confidence, setConfidence] = useState<[number, number]>([0, 100]);
  const list = useServerFn(listEvents);
  const generate = useServerFn(generateEvents);
  const ingest = useServerFn(ingestRealNews);
  const [generating, setGenerating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [pending, setPending] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["events", active],
    queryFn: () => list({ data: { topics: active.length ? active : undefined, limit: 40 } }),
  });

  const allEvents = (data?.events ?? []) as IntelEvent[];

  const { countryOptions, industryOptions } = useMemo(() => {
    const c = new Set<string>();
    const i = new Set<string>();
    for (const e of allEvents) {
      (e.countries ?? []).forEach((x) => c.add(x));
      (e.industries ?? []).forEach((x) => i.add(x));
    }
    return {
      countryOptions: Array.from(c).sort(),
      industryOptions: Array.from(i).sort(),
    };
  }, [allEvents]);

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allEvents.filter((e) => {
      if (e.risk_score < risk[0] || e.risk_score > risk[1]) return false;
      if (e.confidence < confidence[0] || e.confidence > confidence[1]) return false;
      if (countries.length && !(e.countries ?? []).some((c) => countries.includes(c))) return false;
      if (industries.length && !(e.industries ?? []).some((x) => industries.includes(x))) return false;
      if (q) {
        const hay = `${e.headline} ${e.summary} ${(e.countries ?? []).join(" ")} ${(e.industries ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allEvents, query, countries, industries, risk, confidence]);

  const activeFilterCount =
    countries.length +
    industries.length +
    (risk[0] !== 0 || risk[1] !== 100 ? 1 : 0) +
    (confidence[0] !== 0 || confidence[1] !== 100 ? 1 : 0);

  function clearFilters() {
    setQuery("");
    setCountries([]);
    setIndustries([]);
    setRisk([0, 100]);
    setConfidence([0, 100]);
  }

  useEffect(() => {
    const channel = supabase
      .channel("events-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events" },
        () => setPending((n) => n + 1),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadNew() {
    setPending(0);
    await qc.invalidateQueries({ queryKey: ["events"] });
  }

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

  async function onIngest() {
    setIngesting(true);
    toast.message("Pulling live world headlines…", {
      description: "Reuters · BBC · Al Jazeera · NPR, enriched by AI.",
    });
    try {
      const r = await ingest();
      toast.success(`Imported ${r.inserted} real-world events from ${r.fetched} headlines`);
      await qc.invalidateQueries({ queryKey: ["events"] });
    } catch (e) {
      toast.error("Failed to ingest real news", { description: (e as Error).message });
    } finally {
      setIngesting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <SplitText text="Live Intelligence Feed" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-clustered events across geopolitics, markets, technology, and social.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onIngest} disabled={ingesting} variant="outline">
            {ingesting ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RadioTower className="mr-1 h-4 w-4" />
            )}
            Ingest real news
          </Button>
          <Button onClick={onGenerate} disabled={generating} className="shadow-glow">
            {generating ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Generate fresh intel
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {pending > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onClick={loadNew}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary shadow-glow"
          >
            <RadioTower className="h-3.5 w-3.5 animate-pulse" />
            {pending} new {pending === 1 ? "event" : "events"} — tap to load
          </motion.button>
        )}
      </AnimatePresence>


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
