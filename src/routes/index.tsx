import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Brain, Globe2, Radar, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobeBackdrop } from "@/components/globe-backdrop";
import { NewsTicker } from "@/components/news-ticker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GeoPulse AI — Understand how world events affect everything" },
      {
        name: "description",
        content:
          "AI-powered intelligence platform for real-time global news, economic forecasting, geopolitical analysis, and market impact prediction.",
      },
    ],
  }),
  component: Index,
});

const FLOATING = [
  { label: "Brent Crude", value: "$84.21", delta: "+1.8%", tone: "text-warning" },
  { label: "BTC Volatility", value: "62.4", delta: "+12.1%", tone: "text-danger" },
  { label: "Asia Equities", value: "+0.9%", delta: "AI chips lead", tone: "text-success" },
  { label: "Global Risk Index", value: "58", delta: "Elevated", tone: "text-warning" },
];

function Index() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 grid-bg" />
        <div className="absolute inset-0 -z-10 opacity-70">
          <GlobeBackdrop />
        </div>
        <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

        <div className="mx-auto max-w-7xl px-4 pb-24 pt-20 sm:px-6 lg:pt-28">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur"
            style={{ display: "flex", width: "fit-content" }}
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI-powered global intelligence — live
          </motion.div>

          <h1 className="mx-auto mt-6 max-w-4xl text-center text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Understand how <span className="gradient-text">world events</span> affect everything.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-relaxed text-muted-foreground">
            Real-time global news, AI-powered impact analysis, geopolitical monitoring, and market
            prediction — in a single intelligence terminal.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/feed">
                Explore intelligence <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/globe">View global heatmap</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/signup">Start monitoring</Link>
            </Button>
          </div>

          {/* Floating intelligence cards */}
          <div className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
            {FLOATING.map((c, i) => (
              <motion.div
                key={c.label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                className="glass animate-float rounded-xl border border-border p-4 shadow-soft"
                style={{ animationDelay: `${i * 0.4}s` }}
              >
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {c.label}
                </div>
                <div className="mt-1 text-xl font-semibold">{c.value}</div>
                <div className={`mt-0.5 text-xs ${c.tone}`}>{c.delta}</div>
              </motion.div>
            ))}
          </div>
        </div>

        <NewsTicker />
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            A command center for global signal.
          </h2>
          <p className="mt-3 text-muted-foreground">
            GeoPulse fuses news, social, markets, and AI reasoning into one explainable
            intelligence layer.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Radar,
              title: "Live intelligence feed",
              body: "Cross-source events clustered and ranked by impact, risk, and confidence.",
            },
            {
              icon: Brain,
              title: "AI impact engine",
              body: "See exactly which countries, industries, and markets each event touches — and why.",
            },
            {
              icon: Globe2,
              title: "Interactive world map",
              body: "3D globe with country pulses, trade-flow arcs, and real-time risk overlays.",
            },
            {
              icon: BarChart3,
              title: "Prediction timeline",
              body: "24h, 1-week, 1-month forecasts with confidence scoring across every event.",
            },
            {
              icon: Zap,
              title: "Social signal",
              body: "Viral trends and market-moving posts with sentiment and engagement analytics.",
            },
            {
              icon: Sparkles,
              title: "Personal dashboard",
              body: "Pick your topics. Get a personalized brief tuned to what matters to you.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="grid h-10 w-10 place-items-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary to-primary-glow p-10 text-primary-foreground shadow-elegant">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <h3 className="text-2xl font-semibold sm:text-3xl">Start monitoring the world.</h3>
          <p className="mt-2 max-w-xl text-sm opacity-90">
            Free to start. Personalize your intelligence dashboard in under a minute.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/signup">Create account</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent text-primary-foreground border-white/30 hover:bg-white/10">
              <Link to="/feed">Browse the feed</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
