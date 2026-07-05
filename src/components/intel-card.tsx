import { motion } from "framer-motion";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bookmark,
  Clock,
  ExternalLink,
  Flame,
  Globe2,
  Link2,
  Newspaper,
  Share2,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { castVote, toggleSave } from "@/lib/events.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type IntelEvent = {
  id: string;
  headline: string;
  summary: string;
  category: string;
  sentiment: number;
  risk_score: number;
  confidence: number;
  countries: string[];
  industries: string[];
  sources: string[];
  source_urls?: string[];
  breaking: boolean;
  created_at: string;
};

function riskTone(score: number) {
  if (score >= 70) return { label: "High", color: "text-danger", dot: "bg-danger" };
  if (score >= 40) return { label: "Elevated", color: "text-warning", dot: "bg-warning" };
  return { label: "Low", color: "text-success", dot: "bg-success" };
}

function timeAgo(iso: string): { label: string; fresh: boolean } {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(diff / 1000));
  if (s < 60) return { label: `${s}s ago`, fresh: true };
  const m = Math.floor(s / 60);
  if (m < 60) return { label: `${m}m ago`, fresh: m < 5 };
  const h = Math.floor(m / 60);
  if (h < 24) return { label: `${h}h ago`, fresh: false };
  const d = Math.floor(h / 24);
  return { label: `${d}d ago`, fresh: false };
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}



async function requireAuth(router: ReturnType<typeof useRouter>) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    toast.message("Sign in required", { description: "Create an account to save and vote." });
    router.navigate({ to: "/login" });
    return false;
  }
  return true;
}

export function IntelCard({
  event,
  index = 0,
  initialSaved = false,
  initialVote = 0,
}: {
  event: IntelEvent;
  index?: number;
  initialSaved?: boolean;
  initialVote?: 1 | -1 | 0;
}) {
  const risk = riskTone(event.risk_score);
  const positive = event.sentiment >= 0;
  const router = useRouter();
  const save = useServerFn(toggleSave);
  const vote = useServerFn(castVote);
  const [saved, setSaved] = useState(initialSaved);
  const [voted, setVoted] = useState<1 | -1 | 0>(initialVote);
  const [pending, setPending] = useState(false);
  const now = useNow(30_000);
  const fresh = timeAgo(event.created_at);
  // Recompute label using `now` to trigger re-render
  void now;
  const shareUrl =
    typeof window !== "undefined" ? `${window.location.origin}/event/${event.id}` : `/event/${event.id}`;
  const shareText = event.headline;
  async function copyLink(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }
  function shareTo(e: React.MouseEvent, target: "x" | "linkedin") {
    e.preventDefault();
    e.stopPropagation();
    const u = encodeURIComponent(shareUrl);
    const t = encodeURIComponent(shareText);
    const href =
      target === "x"
        ? `https://twitter.com/intent/tweet?url=${u}&text=${t}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${u}`;
    window.open(href, "_blank", "noopener,noreferrer");
  }

  async function onSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    if (!(await requireAuth(router))) return;
    setPending(true);
    const next = !saved;
    setSaved(next);
    try {
      const r = await save({ data: { eventId: event.id } });
      setSaved(r.saved);
      toast.success(r.saved ? "Saved to your brief" : "Removed from saved");
    } catch (err) {
      setSaved(!next);
      toast.error("Couldn't update saved", { description: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  async function onVote(e: React.MouseEvent, value: 1 | -1) {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    if (!(await requireAuth(router))) return;
    setPending(true);
    const prev = voted;
    setVoted(value);
    try {
      await vote({ data: { eventId: event.id, value } });
    } catch (err) {
      setVoted(prev);
      toast.error("Vote failed", { description: (err as Error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.04, 0.4) }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {event.category}
          </span>
          {event.breaking && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
              <Flame className="h-3 w-3" /> Breaking
            </span>
          )}
        </div>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground",
              fresh.fresh && "border-success/40 text-success",
            )}
            title={new Date(event.created_at).toLocaleString()}
          >
            <Clock className={cn("h-3 w-3", fresh.fresh && "animate-pulse")} /> {fresh.label}
          </span>
          <span className={cn("flex items-center gap-1 text-xs font-medium", risk.color)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", risk.dot)} />
            Risk {event.risk_score}
          </span>
        </span>
      </div>

      <Link
        to="/event/$id"
        params={{ id: event.id }}
        className="mt-3 block text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary"
      >
        {event.headline}
      </Link>

      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
        {event.summary}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {event.countries.slice(0, 4).map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5"
          >
            <Globe2 className="h-3 w-3" /> {c}
          </span>
        ))}
        {event.industries.slice(0, 3).map((i) => (
          <span
            key={i}
            className="rounded-md px-1.5 py-0.5 font-medium text-primary"
            style={{ backgroundColor: "color-mix(in oklab, var(--color-primary) 8%, transparent)" }}
          >
            {i}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            {positive ? (
              <TrendingUp className="h-3.5 w-3.5 text-success" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-danger" />
            )}
            {(event.sentiment * 100).toFixed(0)}
          </span>
          <span className="inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {event.confidence}%
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => onVote(e, 1)}
            aria-label="Mark as accurate"
            className={cn(
              "rounded-md p-1.5 transition-colors hover:bg-secondary",
              voted === 1 && "text-success",
            )}
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => onVote(e, -1)}
            aria-label="Mark as inaccurate"
            className={cn(
              "rounded-md p-1.5 transition-colors hover:bg-secondary",
              voted === -1 && "text-danger",
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onSave}
            aria-label="Save"
            className="rounded-md p-1.5 transition-colors hover:bg-secondary"
          >
            <Bookmark
              className={cn("h-3.5 w-3.5", saved ? "fill-primary text-primary" : "")}
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Share"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="rounded-md p-1.5 transition-colors hover:bg-secondary"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={copyLink}>
                <Link2 className="mr-2 h-3.5 w-3.5" /> Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => shareTo(e, "x")}>
                <Share2 className="mr-2 h-3.5 w-3.5" /> Share on X
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => shareTo(e, "linkedin")}>
                <Share2 className="mr-2 h-3.5 w-3.5" /> Share on LinkedIn
              </DropdownMenuItem>
              {event.source_urls && event.source_urls[0] && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.open(event.source_urls![0], "_blank", "noopener,noreferrer");
                  }}
                >
                  <ArrowUpRight className="mr-2 h-3.5 w-3.5" /> Open original
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link
            to="/event/$id"
            params={{ id: event.id }}
            className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
          >
            Analyze <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

export function IntelCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-card p-5">
      <div className="flex gap-2">
        <div className="h-4 w-16 rounded-full bg-muted" />
        <div className="h-4 w-20 rounded-full bg-muted" />
      </div>
      <div className="mt-3 h-5 w-3/4 rounded bg-muted" />
      <div className="mt-2 h-4 w-full rounded bg-muted" />
      <div className="mt-2 h-4 w-5/6 rounded bg-muted" />
      <div className="mt-4 flex gap-1.5">
        <div className="h-4 w-12 rounded bg-muted" />
        <div className="h-4 w-12 rounded bg-muted" />
      </div>
    </div>
  );
}
