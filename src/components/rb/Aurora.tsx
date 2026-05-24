import { useEffect, useRef } from "react";

type Props = {
  colors?: string[];
  speed?: number;
  blend?: number;
  className?: string;
};

/** Lightweight aurora: animated radial-gradient blobs on a canvas. SSR-safe. */
export function Aurora({
  colors = ["#1978E5", "#7C3AED", "#06B6D4"],
  speed = 1,
  blend = 0.6,
  className,
}: Props) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      w = parent.clientWidth;
      h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const blobs = colors.map((c, i) => ({
      c,
      x: Math.random(),
      y: Math.random(),
      r: 0.45 + Math.random() * 0.3,
      px: Math.random() * 1000,
      py: Math.random() * 1000,
      sp: (0.0003 + Math.random() * 0.0004) * speed,
      i,
    }));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of blobs) {
        const tt = reduce ? 0 : t * b.sp;
        const x = (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(tt + b.px))) * w;
        const y = (0.2 + 0.6 * (0.5 + 0.5 * Math.cos(tt * 1.3 + b.py))) * h;
        const radius = b.r * Math.max(w, h) * 0.7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
        g.addColorStop(0, hexA(b.c, blend));
        g.addColorStop(1, hexA(b.c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [colors, speed, blend]);

  return <canvas ref={ref} className={className} aria-hidden />;
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export default Aurora;
