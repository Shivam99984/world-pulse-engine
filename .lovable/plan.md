## Combine Globe + Heatmap into one page

Merge the 3D world map (`/globe`) and the 2D risk heatmap (`/heatmap`) into a single page with a tab switcher, so users can flip between views without losing context.

### Changes

1. **`src/routes/heatmap.tsx`** — turn into the unified page:
   - Add a `Tabs` control at the top: **Heatmap (2D)** | **World Map (3D)**.
   - Tab 1 keeps the existing dot-matrix SVG map + top-risk side panel.
   - Tab 2 renders the lazy-loaded `react-globe.gl` view (moved in from `globe.tsx`), reusing `listImpactMarkers` data and click-to-event navigation.
   - Share the page header, live ticker, stats bar, and country list across both tabs.
   - Persist selected tab in URL via `?view=heatmap|globe` (search param) so it's linkable and survives reloads.

2. **`src/routes/globe.tsx`** — delete. Add a redirect via the route tree so old `/globe` links land on `/heatmap?view=globe`.

3. **`src/components/site-header.tsx`** — remove the separate "Globe" nav item (Heatmap now covers both).

### Notes

- Globe component stays lazy-loaded so the 3D bundle only ships when that tab is opened.
- No data-layer or server-function changes — both views already pull from existing functions (`listCountryRisk`, `listImpactMarkers`).
- No design system changes; reuses existing `Tabs`, `Silk`, `SplitText`, etc.
