import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, ShieldCheck, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { listComments, postComment, reportEvent } from "@/lib/community.functions";

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function EventComments({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listComments);
  const post = useServerFn(postComment);
  const report = useServerFn(reportEvent);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["comments", eventId],
    queryFn: () => list({ data: { eventId } }),
  });

  async function submit() {
    if (body.trim().length < 2) return;
    setBusy(true);
    try {
      await post({ data: { eventId, body: body.trim() } });
      setBody("");
      qc.invalidateQueries({ queryKey: ["comments", eventId] });
      toast.success("Comment posted");
    } catch (e) {
      toast.error("Sign in to comment", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function flag() {
    setReporting(true);
    try {
      await report({ data: { eventId, reason: "User flagged as inaccurate" } });
      toast.success("Reported. AI will re-evaluate confidence.");
    } catch (e) {
      toast.error("Sign in to report", { description: (e as Error).message });
    } finally {
      setReporting(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-4 w-4" /> Expert discussion
        </h2>
        <Button variant="ghost" size="sm" onClick={flag} disabled={reporting}>
          <Flag className="mr-1 h-3.5 w-3.5" /> Flag as inaccurate
        </Button>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-card p-4 shadow-soft">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add context, sources, or expert insight…"
          className="min-h-[80px] resize-none"
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={submit} disabled={busy || body.trim().length < 2}>
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Post
          </Button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {isLoading && (
          <div className="text-sm text-muted-foreground">Loading discussion…</div>
        )}
        {!isLoading && (data?.comments?.length ?? 0) === 0 && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Be the first to add expert context.
          </div>
        )}
        {data?.comments?.map((c) => (
          <div key={c.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{c.display_name}</span>
              {c.is_expert && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <ShieldCheck className="h-3 w-3" /> Expert
                </span>
              )}
              <span>·</span>
              <span>{timeAgo(c.created_at)}</span>
            </div>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
