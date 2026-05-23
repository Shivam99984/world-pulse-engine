import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, LogOut, Sparkles, AlertTriangle, TrendingUp, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { generateBrief, getMyInterests, listEvents, setMyInterests } from "@/lib/events.functions";
import { IntelCard, IntelCardSkeleton, type IntelEvent } from "@/components/intel-card";
import { TOPICS } from "@/lib/topics";
import { toast } from "sonner";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "My Dashboard — GeoPulse AI" },
      { name: "description", content: "Personalized AI intelligence dashboard." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchInterests = useServerFn(getMyInterests);
  const saveInterests = useServerFn(setMyInterests);
  const list = useServerFn(listEvents);
  const briefFn = useServerFn(generateBrief);

  const [authed, setAuthed] = useState<boolean | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [brief, setBrief] = useState<Awaited<ReturnType<typeof briefFn>> | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);


  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate({ to: "/login" });
      setAuthed(!!data.session);
    });
  }, [navigate]);

  const { data: my } = useQuery({
    queryKey: ["my-interests"],
    queryFn: () => fetchInterests(),
    enabled: authed === true,
  });

  useEffect(() => {
    if (my?.topics) setTopics(my.topics);
  }, [my]);

  const { data: feed, isLoading } = useQuery({
    queryKey: ["personal-feed", my?.topics],
    queryFn: () =>
      list({ data: { topics: my?.topics?.length ? my.topics : undefined, limit: 20 } }),
    enabled: authed === true,
  });

  async function persist(next: string[]) {
    setSaving(true);
    try {
      await saveInterests({ data: { topics: next } });
      await qc.invalidateQueries({ queryKey: ["my-interests"] });
      await qc.invalidateQueries({ queryKey: ["personal-feed"] });
    } catch (e) {
      toast.error("Couldn't save interests", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  if (authed === null) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const events = (feed?.events ?? []) as IntelEvent[];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-primary">
            <Sparkles className="mr-1 inline h-3.5 w-3.5" /> Personal intelligence
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick the topics you care about. Your feed tunes in real time.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-1 h-4 w-4" /> Sign out
        </Button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Interests</h2>
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {TOPICS.map((t) => {
            const on = topics.includes(t);
            return (
              <button
                key={t}
                onClick={() => {
                  const next = on ? topics.filter((x) => x !== t) : [...topics, t];
                  setTopics(next);
                  persist(next);
                }}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-gradient-to-br from-card to-card/50 p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-primary">
              <Sparkles className="mr-1 inline h-3.5 w-3.5" /> AI Daily Brief
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              {brief?.brief.headline ?? "Your personalized intelligence brief"}
            </h2>
          </div>
          <Button
            size="sm"
            variant={brief ? "outline" : "default"}
            disabled={briefLoading}
            onClick={async () => {
              setBriefLoading(true);
              try {
                const r = await briefFn();
                setBrief(r);
              } catch (e) {
                toast.error("Brief failed", { description: (e as Error).message });
              } finally {
                setBriefLoading(false);
              }
            }}
            className={cn(!brief && "shadow-glow")}
          >
            {briefLoading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : brief ? (
              <RefreshCw className="mr-1 h-4 w-4" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            {brief ? "Regenerate" : "Generate brief"}
          </Button>
        </div>

        {brief ? (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-3 text-sm leading-relaxed text-muted-foreground">
              {brief.brief.summary}
            </div>
            <BriefList
              icon={<AlertTriangle className="h-3.5 w-3.5 text-danger" />}
              title="Top risks"
              items={brief.brief.top_risks}
            />
            <BriefList
              icon={<TrendingUp className="h-3.5 w-3.5 text-success" />}
              title="Opportunities"
              items={brief.brief.opportunities}
            />
            <BriefList
              icon={<Eye className="h-3.5 w-3.5 text-primary" />}
              title="Watchlist"
              items={brief.brief.watchlist}
            />
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            Generate an AI brief tuned to your interests — risks, opportunities, and what to watch
            next.
          </p>
        )}
      </div>

      <h2 className="mt-10 text-lg font-semibold">Your feed</h2>

      <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <IntelCardSkeleton key={i} />)}
        {!isLoading && events.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card/50 p-10 text-center text-sm text-muted-foreground">
            No matching events yet. Try{" "}
            <Link to="/feed" className="text-primary hover:underline">
              generating fresh intel
            </Link>
            .
          </div>
        )}
        {events.map((e, i) => (
          <IntelCard key={e.id} event={e} index={i} />
        ))}
      </div>
    </div>
  );
}

function BriefList({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground">
        {icon} {title}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="leading-snug">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

