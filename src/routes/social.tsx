import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame, MessageCircle, Repeat2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [
      { title: "Social Intelligence — GeoPulse AI" },
      { name: "description", content: "Viral trends, sentiment spikes, and market-moving social posts." },
    ],
  }),
  component: SocialPage,
});

const TRENDS = [
  { tag: "#AIRegulation", posts: "248K", spike: "+312%", sentiment: -0.34 },
  { tag: "#OilShock", posts: "184K", spike: "+201%", sentiment: -0.58 },
  { tag: "#NvidiaEarnings", posts: "92K", spike: "+88%", sentiment: 0.41 },
  { tag: "#BTC", posts: "1.2M", spike: "+42%", sentiment: 0.12 },
  { tag: "#RedSeaShipping", posts: "67K", spike: "+154%", sentiment: -0.52 },
  { tag: "#ECBRates", posts: "31K", spike: "+27%", sentiment: -0.08 },
];

const POSTS = [
  {
    handle: "@globalmarkets",
    name: "Global Markets Desk",
    text: "Brent surges past $87 as tanker rerouting around the Cape adds 10 days to Asia–Europe routes. Airline fuel-cost models reset.",
    engagement: { likes: "12.4K", reposts: "3.1K", replies: "612" },
    sentiment: -0.5,
  },
  {
    handle: "@aiwatch",
    name: "AI Watch",
    text: "Hyperscaler capex guidance lifts AI chip names. Custom silicon roadmaps remain the swing factor for 2026 margins.",
    engagement: { likes: "8.2K", reposts: "1.7K", replies: "388" },
    sentiment: 0.45,
  },
  {
    handle: "@geopolitik",
    name: "GeoPolitik",
    text: "Sanctions package leak: dual-use chip export controls expanded; secondary enforcement against intermediary jurisdictions in scope.",
    engagement: { likes: "15.6K", reposts: "5.2K", replies: "1.1K" },
    sentiment: -0.35,
  },
];

export default function SocialPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Social Intelligence</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Viral trends, sentiment spikes, and the social posts moving markets.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Trending now</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TRENDS.map((t, i) => (
            <motion.div
              key={t.tag}
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
                <span>{t.posts} posts</span>
                <span className={t.sentiment >= 0 ? "text-success" : "text-danger"}>
                  Sentiment {(t.sentiment * 100).toFixed(0)}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Market-moving posts</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {POSTS.map((p, i) => (
            <motion.div
              key={p.handle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="rounded-xl border border-border bg-card p-5 shadow-soft"
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
                <span>❤ {p.engagement.likes}</span>
                <span>
                  <Repeat2 className="mr-0.5 inline h-3.5 w-3.5" />
                  {p.engagement.reposts}
                </span>
                <span>
                  <MessageCircle className="mr-0.5 inline h-3.5 w-3.5" />
                  {p.engagement.replies}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
