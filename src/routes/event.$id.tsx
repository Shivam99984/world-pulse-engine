import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Brain, Globe2, Loader2, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeEvent, getEvent } from "@/lib/events.functions";
import { getEventAccuracy } from "@/lib/storylines.functions";
import { toast } from "sonner";
import { EventComments } from "@/components/event-comments";

export const Route = createFileRoute("/event/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Intel ${params.id.slice(0, 8)} — GeoPulse AI` },
      { name: "description", content: "AI impact analysis for a global intelligence event." },
    ],
  }),
  component: EventPage,
});

function EventPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchEvent = useServerFn(getEvent);
  const analyze = useServerFn(analyzeEvent);
  const accuracyFn = useServerFn(getEventAccuracy);
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["event", id],
    queryFn: () => fetchEvent({ data: { id } }),
  });
  const { data: acc } = useQuery({
    queryKey: ["event-accuracy", id],
    queryFn: () => accuracyFn({ data: { id } }),
  });

  const impacts = data?.impacts ?? [];
  const predictions = data?.predictions ?? [];

  const autoFired = useRef(false);
  useEffect(() => {
    if (!autoFired.current && data?.event && impacts.length === 0 && !running) {
      autoFired.current = true;
      void onAnalyze();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl place-items-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.event) throw notFound();
  const event = data.event;

  async function onAnalyze() {
    setRunning(true);
    toast.message("Running impact analysis…", {
      description: "AI is mapping cascading effects across countries and markets.",
    });
    try {
      await analyze({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["event", id] });
      toast.success("Analysis ready");
    } catch (e) {
      toast.error("Analysis failed", { description: (e as Error).message });
    } finally {
      setRunning(false);
    }
  }

  const positive = Number(event.sentiment) >= 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        to="/feed"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {event.category}
          </span>
          {event.breaking && (
            <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
              Breaking
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            {acc && acc.total > 0 && acc.accuracy !== null && (
              <span
                className={
                  acc.accuracy >= 70
                    ? "rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success"
                    : acc.accuracy >= 40
                      ? "rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning"
                      : "rounded-full bg-danger/10 px-2 py-0.5 font-semibold text-danger"
                }
              >
                {acc.accuracy}% community accuracy · {acc.total} votes
              </span>
            )}
            <span>Risk {event.risk_score} · Confidence {event.confidence}%</span>
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{event.headline}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{event.summary}</p>

        <div className="mt-5 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
          {(event.countries as string[]).map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5">
              <Globe2 className="h-3 w-3" /> {c}
            </span>
          ))}
          {(event.industries as string[]).map((i) => (
            <span key={i} className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
              {i}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
          {positive ? (
            <span className="inline-flex items-center gap-1 text-success">
              <TrendingUp className="h-3.5 w-3.5" /> Sentiment {(Number(event.sentiment) * 100).toFixed(0)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-danger">
              <TrendingDown className="h-3.5 w-3.5" /> Sentiment {(Number(event.sentiment) * 100).toFixed(0)}
            </span>
          )}
          <span>Sources: {(event.sources as string[]).join(", ")}</span>
        </div>
      </div>

      {impacts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
          <Brain className="mx-auto h-6 w-6 text-primary" />
          <h2 className="mt-3 text-lg font-semibold">Run AI impact analysis</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Map cascading effects across countries, industries, and markets — plus forward predictions.
          </p>
          <Button onClick={onAnalyze} disabled={running} className="mt-5 shadow-glow">
            {running ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Analyze impact
          </Button>
        </div>
      ) : (
        <>
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Country impact</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {impacts.map((c) => (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">
                      {c.country_name} <span className="text-xs text-muted-foreground">({c.country_code})</span>
                    </div>
                    <span className="text-xs text-muted-foreground">Impact {c.impact_score}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">{c.narrative}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Prediction timeline</h2>
            <ol className="relative mt-3 space-y-3 border-l border-border pl-5">
              {predictions.map((p) => (
                <li key={p.id} className="relative">
                  <span className="absolute -left-[26px] top-1.5 grid h-3 w-3 place-items-center rounded-full bg-primary shadow-glow" />
                  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                        {p.horizon}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {p.confidence}% confidence
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm">{p.prediction}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <EventComments eventId={event.id} />
        </>
      )}
    </div>
  );
}
