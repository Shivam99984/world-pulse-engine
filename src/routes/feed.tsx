import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pause, Play, RadioTower, Radio, RefreshCw, Search, SlidersHorizontal, Sparkles, Wifi, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { IntelCard, IntelCardSkeleton, type IntelEvent } from "@/components/intel-card";
import { generateEvents, listEventFacets, listEvents, listMyInteractions } from "@/lib/events.functions";
import { ingestRealNews } from "@/lib/sources.functions";
import { TOPICS } from "@/lib/topics";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import { SplitText } from "@/components/rb/SplitText";
import { LiveTicker } from "@/components/live/LiveTicker";
import { LiveStatsBar } from "@/components/live/LiveStatsBar";
import {
  getStoredTransport,
  setStoredTransport,
  useRealtimeEvents,
  type RealtimeTransport,
} from "@/hooks/use-realtime-events";

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
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [risk, setRisk] = useState<[number, number]>([0, 100]);
  const [confidence, setConfidence] = useState<[number, number]>([0, 100]);
  const list = useServerFn(listEvents);
  const facetsFn = useServerFn(listEventFacets);
  const interactionsFn = useServerFn(listMyInteractions);
  const generate = useServerFn(generateEvents);
  const ingest = useServerFn(ingestRealNews);
  const [generating, setGenerating] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [pending, setPending] = useState(0);
  const [transport, setTransport] = useState<RealtimeTransport>(() => getStoredTransport());
  function chooseTransport(t: RealtimeTransport) {
    setTransport(t);
    setStoredTransport(t);
  }
  const [autoIngest, setAutoIngest] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("geopulse.feed.autoIngest") === "1";
  });
  function toggleAutoIngest() {
    setAutoIngest((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("geopulse.feed.autoIngest", next ? "1" : "0");
      } catch { /* ignore */ }
      return next;
    });
  }

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  type EventsPage = { events: IntelEvent[]; nextCursor: string | null };
  const PAGE_SIZE = 30;
  const infiniteQuery = useInfiniteQuery<EventsPage>({
    queryKey: ["events", active, debouncedQuery, countries, industries],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      list({
        data: {
          topics: active.length ? active : undefined,
          query: debouncedQuery || undefined,
          countries: countries.length ? countries : undefined,
          industries: industries.length ? industries : undefined,
          limit: PAGE_SIZE,
          cursor: pageParam as string | undefined,
        },
      }) as Promise<EventsPage>,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = infiniteQuery;

  const allEvents = useMemo<IntelEvent[]>(() => {
    return (data?.pages ?? []).flatMap((p) => p.events);
  }, [data]);

  const { data: facets } = useQuery({
    queryKey: ["event-facets"],
    queryFn: () => facetsFn(),
    staleTime: 60_000,
  });
  const countryOptions = facets?.countries ?? [];
  const industryOptions = facets?.industries ?? [];

  // Hydrate saved + voted state for the visible cards (auth-gated; silently skips if signed out)
  const eventIds = useMemo(() => allEvents.map((e) => e.id), [allEvents]);
  const { data: interactions } = useQuery({
    queryKey: ["my-interactions", eventIds],
    queryFn: async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session || eventIds.length === 0) {
        return { saved: [] as string[], votes: {} as Record<string, number> };
      }
      return interactionsFn({ data: { eventIds } });
    },
    staleTime: 30_000,
  });
  const savedSet = useMemo(() => new Set(interactions?.saved ?? []), [interactions]);
  const voteMap = interactions?.votes ?? {};

  const events = useMemo(() => {
    return allEvents.filter((e) => {
      if (e.risk_score < risk[0] || e.risk_score > risk[1]) return false;
      if (e.confidence < confidence[0] || e.confidence > confidence[1]) return false;
      return true;
    });
  }, [allEvents, risk, confidence]);

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

  const { status: rtStatus, activeTransport } = useRealtimeEvents({
    transport,
    autoFallback: true,
    onInsert: (newEvent) => {
      let prepended = false;
      qc.setQueriesData<InfiniteData<EventsPage>>({ queryKey: ["events"] }, (old) => {
        if (!old || !old.pages?.length) return old;
        const exists = old.pages.some((p) => p.events.some((e) => e.id === newEvent.id));
        if (exists) return old;
        prepended = true;
        const [first, ...rest] = old.pages;
        return {
          ...old,
          pages: [{ ...first, events: [newEvent as IntelEvent, ...first.events] }, ...rest],
        };
      });
      if (prepended) {
        setPending((n) => n + 1);
        qc.invalidateQueries({ queryKey: ["event-facets"] });
      }
    },
    onUpdate: (updated) => {
      qc.setQueriesData<InfiniteData<EventsPage>>({ queryKey: ["events"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            events: p.events.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)),
          })),
        };
      });
    },
    onDelete: (removedId) => {
      qc.setQueriesData<InfiniteData<EventsPage>>({ queryKey: ["events"] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((p) => ({
            ...p,
            events: p.events.filter((e) => e.id !== removedId),
          })),
        };
      });
    },
  });

  // Notify the user when the chosen transport had to fall back to the other.
  useEffect(() => {
    if (activeTransport !== transport && rtStatus === "connected") {
      toast.message(`Live updates fell back to ${activeTransport.toUpperCase()}`, {
        description: `${transport.toUpperCase()} couldn't connect — using ${activeTransport.toUpperCase()} instead.`,
      });
    }
  }, [activeTransport, transport, rtStatus]);

  async function loadNew() {
    setPending(0);
    await qc.invalidateQueries({ queryKey: ["events"] });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
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

  // Silent background auto-ingest (every 5 min, defaults off; toggleable).
  // Spaced at 5min to respect free-tier rate limits and avoid duplicate alerts;
  // realtime channel still surfaces new rows the instant they land.
  const ingestingRef = useRef(false);
  useEffect(() => {
    ingestingRef.current = ingesting;
  }, [ingesting]);
  useEffect(() => {
    if (!autoIngest) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || ingestingRef.current || document.hidden) return;
      try {
        await ingest();
        qc.invalidateQueries({ queryKey: ["event-facets"] });
      } catch {
        /* silent — the manual button surfaces errors */
      }
    };
    // First tick after 60s so it doesn't pile onto initial load
    const first = setTimeout(tick, 60_000);
    const id = setInterval(tick, 5 * 60_000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(id);
    };
  }, [autoIngest, ingest, qc]);

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);



  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <LiveTicker className="mb-6 -mx-4 sm:-mx-6" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <SplitText text="Live Intelligence Feed" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-clustered events across geopolitics, markets, technology, and social.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TransportToggle
            transport={transport}
            active={activeTransport}
            status={rtStatus}
            onChange={chooseTransport}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAutoIngest}
            className="gap-1.5"
            title={autoIngest ? "Auto-ingest is on (every 5 min)" : "Auto-ingest is off"}
          >
            {autoIngest ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="text-xs">Auto {autoIngest ? "on" : "off"}</span>
          </Button>
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

      <LiveStatsBar className="mt-6" />

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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headlines, countries, industries…"
            className="pl-9"
          />
        </div>

        <MultiSelectPopover
          label="Countries"
          options={countryOptions}
          selected={countries}
          onChange={setCountries}
        />
        <MultiSelectPopover
          label="Industries"
          options={industryOptions}
          selected={industries}
          onChange={setIndustries}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Risk & confidence
              {(risk[0] !== 0 || risk[1] !== 100 || confidence[0] !== 0 || confidence[1] !== 100) && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-5" align="end">
            <RangeBlock label="Risk score" value={risk} onChange={(v) => setRisk(v as [number, number])} />
            <RangeBlock
              label="Prediction confidence"
              value={confidence}
              onChange={(v) => setConfidence(v as [number, number])}
            />
          </PopoverContent>
        </Popover>

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {(countries.length > 0 || industries.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {countries.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1">
              {c}
              <button onClick={() => setCountries((p) => p.filter((x) => x !== c))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {industries.map((i) => (
            <Badge key={i} variant="outline" className="gap-1">
              {i}
              <button onClick={() => setIndustries((p) => p.filter((x) => x !== i))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-muted-foreground">
        Showing {events.length} of {allEvents.length} events
      </div>


      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading &&
          Array.from({ length: 9 }).map((_, i) => <IntelCardSkeleton key={i} />)}
        {!isLoading && (generating || ingesting) &&
          Array.from({ length: 6 }).map((_, i) => <IntelCardSkeleton key={`opt-${i}`} />)}
        {!isLoading && events.length === 0 && (activeFilterCount > 0 || active.length > 0 || debouncedQuery) && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No events match these filters.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                clearFilters();
                setActive([]);
              }}
            >
              <X className="mr-1 h-3.5 w-3.5" /> Clear all filters
            </Button>
          </div>
        )}
        {!isLoading && events.length === 0 && activeFilterCount === 0 && active.length === 0 && !debouncedQuery && !(generating || ingesting) && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <RefreshCw className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              No intelligence yet. Tap <span className="font-medium">Generate fresh intel</span> or{" "}
              <span className="font-medium">Ingest real news</span> to populate the feed.
            </p>
          </div>
        )}
        {events.map((e, i) => (
          <IntelCard
            key={e.id}
            event={e}
            index={i}
            initialSaved={savedSet.has(e.id)}
            initialVote={(voteMap[e.id] as 1 | -1 | 0) ?? 0}
          />
        ))}
        {isFetchingNextPage &&
          Array.from({ length: 3 }).map((_, i) => <IntelCardSkeleton key={`np-${i}`} />)}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className="mt-6 flex justify-center py-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Load more
          </Button>
        </div>
      )}
      {!hasNextPage && events.length > 0 && (
        <div className="mt-6 text-center text-xs text-muted-foreground">
          You're all caught up.
        </div>
      )}
    </div>
  );
}

function MultiSelectPopover({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(q.toLowerCase())),
    [options, q],
  );
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          {label}
          {selected.length > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {selected.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="border-b border-border p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${label.toLowerCase()}…`}
            className="h-8"
          />
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</div>
          )}
          {filtered.map((opt) => {
            const on = selected.includes(opt);
            return (
              <button
                key={opt}
                onClick={() =>
                  onChange(on ? selected.filter((x) => x !== opt) : [...selected, opt])
                }
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  on && "bg-accent",
                )}
              >
                <span className="truncate">{opt}</span>
                {on && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function RangeBlock({
  label,
  value,
  onChange,
}: {
  label: string;
  value: [number, number];
  onChange: (next: number[]) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-muted-foreground">
          {value[0]} – {value[1]}
        </span>
      </div>
      <Slider value={value} onValueChange={onChange} min={0} max={100} step={1} />
    </div>
  );
}

function TransportToggle({
  transport,
  active,
  status,
  onChange,
}: {
  transport: RealtimeTransport;
  active: RealtimeTransport;
  status: "connecting" | "connected" | "error" | "idle";
  onChange: (t: RealtimeTransport) => void;
}) {
  const dotColor =
    status === "connected"
      ? "bg-emerald-500"
      : status === "connecting"
        ? "bg-amber-500 animate-pulse"
        : "bg-red-500";
  const fellBack = active !== transport;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
          {active === "websocket" ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <Radio className="h-3.5 w-3.5" />
          )}
          <span className="text-xs font-medium uppercase">{active}</span>
          {fellBack && (
            <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-semibold text-amber-500">
              fallback
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3" align="end">
        <div>
          <div className="text-sm font-semibold">Real-time transport</div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose how the feed streams new events. If the chosen transport fails, the other is
            used automatically.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onChange("websocket")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-md border p-2 text-left text-xs transition-colors hover:bg-accent",
              transport === "websocket" ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <span className="flex items-center gap-1 font-medium">
              <Wifi className="h-3.5 w-3.5" /> WebSocket
            </span>
            <span className="text-muted-foreground">Lowest latency, push-based.</span>
          </button>
          <button
            onClick={() => onChange("sse")}
            className={cn(
              "flex flex-col items-start gap-1 rounded-md border p-2 text-left text-xs transition-colors hover:bg-accent",
              transport === "sse" ? "border-primary bg-primary/5" : "border-border",
            )}
          >
            <span className="flex items-center gap-1 font-medium">
              <Radio className="h-3.5 w-3.5" /> SSE
            </span>
            <span className="text-muted-foreground">HTTP stream, proxy-friendly.</span>
          </button>
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Status</span>
          <span className="font-mono uppercase">{status}</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}


