import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Flame, MessageCircle, Repeat2, TrendingUp, Loader2 } from "lucide-react";
import { fetchSocialPulse } from "@/lib/spider.functions";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social Intelligence — GeoPulse AI" },
      { name: "description", content: "Viral trends, sentiment spikes, and market-moving social posts." },
    ],
  }),
  component: SocialPage,
});

function SocialPage() {
  const fetchPulse = useServerFn(fetchSocialPulse);
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["social-pulse"],
    queryFn: () => fetchPulse(),
    staleTime: 60_000,
  });

  const trends = data?.trends ?? [];
  const posts = data?.posts ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Social Intelligence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live signals scraped from public social and news sources.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {isLoading || isRefetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {data?.error && (
        <div className="mt-4 rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          {data.error}
        </div>
      )}

      {isLoading && (
        <div className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Scraping live sources…
        </div>
      )}

      {isError && !isLoading && (
        <div className="mt-10 text-sm text-danger">Failed to load social pulse.</div>
      )}

      {!isLoading && trends.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Trending now</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trends.map((t, i) => (
              <motion.div
                key={t.tag + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="rounded-xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-primary">{t.tag}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                    <Flame className="h-3.5 w-3.5" /> {t.spike}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t.posts} mentions</span>
                  <span className={t.sentiment >= 0 ? "text-success" : "text-danger"}>
                    Sentiment {(t.sentiment * 100).toFixed(0)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {!isLoading && posts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Live posts</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {posts.map((p, i) => (
              <motion.a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                key={p.handle + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="block rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-xs font-semibold text-primary-foreground">
                    {p.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.handle}</div>
                  </div>
                  <span
                    className={`ml-auto text-xs font-medium ${
                      p.sentiment >= 0 ? "text-success" : "text-danger"
                    }`}
                  >
                    <TrendingUp className="mr-0.5 inline h-3.5 w-3.5" />
                    {(p.sentiment * 100).toFixed(0)}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed">{p.text}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <Repeat2 className="mr-0.5 inline h-3.5 w-3.5" /> live
                  </span>
                  <span>
                    <MessageCircle className="mr-0.5 inline h-3.5 w-3.5" /> scraped
                  </span>
                </div>
              </motion.a>
            ))}
          </div>
        </section>
      )}

      {!isLoading && posts.length === 0 && !isError && (
        <div className="mt-10 text-sm text-muted-foreground">
          No posts returned. Spider may be rate-limited — try Refresh in a moment.
        </div>
      )}
    </div>
  );
}
