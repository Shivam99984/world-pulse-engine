import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/globe")({
  beforeLoad: () => {
    throw redirect({ to: "/heatmap", search: { view: "globe" } });
  },
});
