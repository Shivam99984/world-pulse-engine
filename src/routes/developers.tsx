import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "Developers — GeoPulse AI" },
      {
        name: "description",
        content:
          "Build on the GeoPulse public API. Manage API keys and query global intelligence events programmatically.",
      },
    ],
  }),
  component: DevPage,
});

function DevPage() {
  const qc = useQueryClient();
  const list = useServerFn(listApiKeys);
  const create = useServerFn(createApiKey);
  const revoke = useServerFn(revokeApiKey);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setAuthed(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function getAuthHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Sign in required");
    return { Authorization: `Bearer ${token}` };
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => list({ headers: await getAuthHeaders() }),
    enabled: authed === true,
  });

  if (authed === false) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Key className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Sign in to manage API keys</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Developer access requires an authenticated GeoPulse account.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild><Link to="/login">Sign in</Link></Button>
          <Button asChild variant="outline"><Link to="/signup">Create account</Link></Button>
        </div>
      </div>
    );
  }

  async function onCreate() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const r = await create({ data: { name: name.trim() }, headers: await getAuthHeaders() });
      setJustCreated(r.key);
      setName("");
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created — copy it now, it won't be shown again");
    } catch (e) {
      toast.error("Sign in required", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onRevoke(id: string) {
    await revoke({ data: { id }, headers: await getAuthHeaders() });
    qc.invalidateQueries({ queryKey: ["api-keys"] });
    toast.success("Key revoked");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Developers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pipe GeoPulse intelligence into your own trading models, dashboards, or terminals.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Key className="h-4 w-4" /> API keys
        </h2>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="Key name (e.g. Trading bot)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button onClick={onCreate} disabled={busy || !name.trim()}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Create
          </Button>
        </div>

        {justCreated && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">
              Save this key now
            </div>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs">
                {justCreated}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(justCreated);
                  toast.success("Copied");
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              {(error as Error).message}
            </div>
          )}
          {!error && !isLoading && (data?.keys?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No keys yet. Create one to start calling the API.
            </div>
          )}
          {data?.keys?.map((k) => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
            >
              <div>
                <div className="text-sm font-semibold">{k.name}</div>
                <div className="text-xs text-muted-foreground">
                  {k.key_prefix}…  ·  created {new Date(k.created_at).toLocaleDateString()}
                  {k.last_used_at && ` · last used ${new Date(k.last_used_at).toLocaleString()}`}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => onRevoke(k.id)}>
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="text-lg font-semibold">Quickstart</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Authenticate with <code className="rounded bg-muted px-1 py-0.5">Authorization: Bearer YOUR_KEY</code>.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl border border-border bg-background p-4 text-xs leading-relaxed">
{`# Latest 20 events
curl -H "Authorization: Bearer gp_live_…" \\
  https://geopulse.lovable.app/api/public/v1/events?limit=20

# Filter by category
curl -H "Authorization: Bearer gp_live_…" \\
  "https://geopulse.lovable.app/api/public/v1/events?category=Economy&limit=50"`}
        </pre>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <div className="text-sm font-semibold">GET /api/public/v1/events</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Returns the latest intelligence events. Query params: <code>limit</code> (1-100), <code>category</code>.
            </div>
          </div>
          <div className="rounded-xl border border-border p-4">
            <div className="text-sm font-semibold">Rate limits</div>
            <div className="mt-1 text-xs text-muted-foreground">
              60 req/min on free tier, 600 req/min on Pro. Responses cached 30s edge-side.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
