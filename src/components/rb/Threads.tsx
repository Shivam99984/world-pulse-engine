import { useEffect, useRef } from "react";

/** Animated SVG-like sine threads on canvas. */
export function Threads({
  className,
  color = "rgba(25,120,229,0.35)",
  count = 5,
}: {
  className?: string;
  color?: string;
  count?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0,
      h = 0,
      raf = 0;
    const resize = () => {
      const p = c.parentElement;
      if (!p) return;
      w = p.clientWidth;
      h = p.clientHeight;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = w + "px";
      c.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (c.parentElement) ro.observe(c.parentElement);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = color;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        const phase = reduce ? 0 : t * 0.0006 + i;
        const amp = h * 0.12 + i * 6;
        const base = (h / (count + 1)) * (i + 1);
        for (let x = 0; x <= w; x += 6) {
          const y =
            base +
            Math.sin(x * 0.012 + phase) * amp * 0.5 +
            Math.cos(x * 0.004 + phase * 0.7) * amp * 0.3;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [color, count]);
  return <canvas ref={ref} className={className} aria-hidden />;
}

export default Threads;
