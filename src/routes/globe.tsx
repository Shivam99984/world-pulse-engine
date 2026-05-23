import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Suspense, lazy, useMemo } from "react";
import { listImpactMarkers } from "@/lib/events.functions";
import { Loader2 } from "lucide-react";

const Globe = lazy(() => import("react-globe.gl").then((m) => ({ default: m.default })));

export const Route = createFileRoute("/globe")({
  head: () => ({
    meta: [
      { title: "World Heatmap — GeoPulse AI" },
      {
        name: "description",
        content: "Interactive 3D world map of global intelligence events and country impact.",
      },
    ],
  }),
  component: GlobePage,
});

function GlobePage() {
  const fetchMarkers = useServerFn(listImpactMarkers);
  const { data } = useQuery({
    queryKey: ["impact-markers"],
    queryFn: () => fetchMarkers(),
  });

  const points = useMemo(
    () =>
      (data?.markers ?? []).map((m) => ({
        lat: Number(m.lat),
        lng: Number(m.lng),
        size: Math.max(0.2, m.impact_score / 100),
        color:
          m.impact_score >= 70
            ? "#dc2626"
            : m.impact_score >= 40
              ? "#f59e0b"
              : "#16a34a",
        label: `${m.country_name} — impact ${m.impact_score}`,
        eventId: m.event_id,
      })),
    [data],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Global Intelligence Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Country pulses show where active events have the strongest impact.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft" style={{ height: 600 }}>
        <Suspense
          fallback={
            <div className="grid h-full place-items-center text-muted-foreground">
              <div className="flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading globe…
              </div>
            </div>
          }
        >
          {typeof window !== "undefined" && (
            <Globe
              backgroundColor="rgba(0,0,0,0)"
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
              pointsData={points}
              pointAltitude={(d: object) => (d as { size: number }).size * 0.4}
              pointColor={(d: object) => (d as { color: string }).color}
              pointRadius={0.4}
              pointLabel={(d: object) => (d as { label: string }).label}
              atmosphereColor="#1978E5"
              atmosphereAltitude={0.18}
              width={undefined}
              height={600}
            />
          )}
        </Suspense>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.markers ?? []).slice(0, 12).map((m) => (
          <Link
            key={m.id}
            to="/event/$id"
            params={{ id: m.event_id }}
            className="rounded-xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elegant"
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{m.country_name}</div>
              <span className="text-xs text-muted-foreground">Impact {m.impact_score}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.narrative}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
