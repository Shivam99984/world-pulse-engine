import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpRight, Layers, Loader2 } from "lucide-react";
import { getStoryline } from "@/lib/storylines.functions";

export const Route = createFileRoute("/storyline/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `Storyline ${params.id.slice(0, 8)} — GeoPulse AI` },
      { name: "description", content: "AI-clustered narrative of related global events." },
    ],
  }),
  component: StorylinePage,
});

function StorylinePage() {
  const { id } = Route.useParams();
  const fetchStoryline = useServerFn(getStoryline);
  const { data, isLoading } = useQuery({
    queryKey: ["storyline", id],
    queryFn: () => fetchStoryline({ data: { id } }),
  });

  if (isLoading) {
    return (
      <div className="mx-auto grid max-w-5xl place-items-center px-4 py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data?.storyline) throw notFound();
  const s = data.storyline;
  const events = data.events;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <Link
        to="/storylines"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All storylines
      </Link>

      <div className="mt-4 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <Layers className="h-3 w-3" /> Storyline
          </span>
          <span className="ml-auto text-xs text-muted-foreground">Risk {s.risk_score}</span>
        </div>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{s.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.thesis}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(s.tags as string[]).map((t) => (
            <span
              key={t}
              className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      <h2 className="mt-8 text-lg font-semibold">Timeline</h2>
      <ol className="relative mt-4 space-y-4 border-l border-border pl-6">
        {events.map((it, i) => {
          const e = it.event!;
          return (
            <li key={e.id} className="relative">
              <span className="absolute -left-[31px] top-2 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-glow">
                {i + 1}
              </span>
              <Link
                to="/event/$id"
                params={{ id: e.id }}
                className="group block rounded-xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {e.category}
                  </span>
                  <span className="text-xs text-muted-foreground">Risk {e.risk_score}</span>
                </div>
                <div className="mt-2 text-sm font-semibold group-hover:text-primary">
                  {e.headline}
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{e.summary}</p>
                {it.rationale && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Why it&apos;s in this storyline: {it.rationale}
                  </p>
                )}
                <div className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                  Open event <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
