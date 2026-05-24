import { useEffect } from "react";

/** Global click spark — paints radial particle bursts on every pointer click. */
export function ClickSpark({ color = "#7C3AED" }: { color?: string }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onClick = (e: PointerEvent) => {
      const n = 10;
      for (let i = 0; i < n; i++) {
        const el = document.createElement("span");
        const angle = (i / n) * Math.PI * 2;
        const dist = 28 + Math.random() * 14;
        el.style.cssText = `
          position:fixed;left:${e.clientX}px;top:${e.clientY}px;
          width:6px;height:6px;border-radius:9999px;background:${color};
          pointer-events:none;z-index:9999;
          transform:translate(-50%,-50%);will-change:transform,opacity;
          transition:transform 520ms cubic-bezier(.2,.7,.2,1),opacity 520ms ease-out;
          box-shadow:0 0 12px ${color};
        `;
        document.body.appendChild(el);
        requestAnimationFrame(() => {
          el.style.transform = `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.4)`;
          el.style.opacity = "0";
        });
        setTimeout(() => el.remove(), 600);
      }
    };
    window.addEventListener("pointerdown", onClick);
    return () => window.removeEventListener("pointerdown", onClick);
  }, [color]);

  return null;
}

export default ClickSpark;
