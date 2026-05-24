# Awwwards-grade redesign with React Bits

Goal: make GeoPulse feel alive on first paint — a "what an amazing website" reaction within 2 seconds. Bold motion register, layered backdrops, scroll-triggered reveals, magnetic interactions. Locked palette/type (current blue/violet + Inter) stays — only motion + composition change.

## Setup

1. Register the React Bits registry in `components.json`:
   ```json
   "registries": { "@react-bits": "https://reactbits.dev/r/{name}.json" }
   ```
2. Install React Bits components via the shadcn CLI (one batch). Picks below.

## Components from React Bits

**Backgrounds (WebGL/canvas, layered behind hero & section bands)**
- `Aurora` — animated aurora ribbons for home hero backdrop (replaces current DotField as primary; DotField becomes secondary mid-page accent)
- `Silk` — silky gradient mesh for the Globe page backdrop
- `Beams` / `LightRays` — diagonal light shafts behind feed header
- `Threads` — animated thread mesh as footer band

**Text effects**
- `SplitText` — letter-by-letter entrance on every H1/H2 (home, feed, globe, dashboard, developers)
- `ShinyText` — for the "AI-powered global intelligence — live" eyebrow
- `GradientText` — replace current `.gradient-text` for the "world events" word with animated gradient
- `ScrambleText` — for the floating intel card values (Brent, BTC etc.) — looks like a Bloomberg terminal
- `RotatingText` — in hero subline, rotating through "markets", "geopolitics", "supply chains", "sentiment"

**Scroll & reveal**
- `ScrollFloat` / `ScrollReveal` — features grid items rise + fade on enter
- `AnimatedList` — for feed cards staggered entrance
- `TiltedCard` — for the 6 feature cards (3D tilt on hover)

**Interactive**
- `SplashCursor` — global custom cursor (fluid splash trail) mounted in `__root.tsx`
- `MagnetLines` / `Magnet` — magnetic CTA buttons (Explore intelligence, Create account)
- `ClickSpark` — click feedback globally
- `PixelTransition` — page transition wrapper between routes

## Page-by-page plan

### Global (`__root.tsx`)
- Mount `SplashCursor` (hidden on touch/`prefers-reduced-motion`)
- Mount `ClickSpark` overlay
- Wrap `<Outlet/>` in `PixelTransition` for route transitions
- Site header: add subtle `Threads` background strip, `ShinyText` logo wordmark

### Home (`/`)
- Replace hero backdrop stack: `Aurora` (full) + grid-bg + DotField at 30% opacity as foreground particles
- H1: `SplitText` entrance, "world events" → `GradientText` with animated sweep
- Eyebrow chip: `ShinyText`
- Subline: insert `RotatingText` ("…affect everything" → cycles markets/supply chains/sentiment/geopolitics)
- CTAs: wrap in `Magnet` (5px pull)
- Floating intel cards: values → `ScrambleText` on mount; cards use `TiltedCard`
- Features section: each card `TiltedCard` + `ScrollReveal` stagger
- Final CTA band: add `Beams` backdrop behind gradient

### Feed (`/feed`)
- Page header H1: `SplitText`
- Filter bar: `Magnet` chips
- Intel cards list: `AnimatedList` staggered fade-up on scroll
- Empty state: `ScrambleText` placeholder

### Globe (`/globe`)
- Backdrop: `Silk` behind the 3D globe (low opacity)
- Page H1: `SplitText`
- Stats sidebar: `ScrambleText` on numeric values
- `LightRays` behind page title bar

### Footer
- `Threads` animated background band

## Performance & a11y guards
- All WebGL backdrops lazy-loaded (`React.lazy` + Suspense fallback to current static backdrop)
- Every motion component checks `prefers-reduced-motion` and downgrades to static
- `SplashCursor` disabled on `pointer: coarse` (mobile)
- One WebGL canvas per route max (Aurora on home, Silk on globe — never both at once)

## Color tokens (locked, unchanged)
Current brand blue `oklch(0.583 0.166 256)` + violet glow stays. New animated gradients use:
- Aurora: `#1978E5 → #7C3AED → #06B6D4` (matches existing primary/glow)
- Beams/LightRays: primary at 25% opacity over background

## Technical notes
- React Bits drops files into `src/components/ui/` or `src/components/` via shadcn CLI
- TanStack Start: dynamic-import WebGL components with `{ ssr: false }` pattern (use `React.lazy` + Suspense — Three.js/canvas can't SSR on workerd)
- Keep DotField (already integrated) — repurposed as secondary layer, not removed
- No backend/data changes, no route additions, no auth changes

## Out of scope
- New pages or features
- Color/typography changes
- Removing existing functionality
