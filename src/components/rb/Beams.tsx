import { cn } from "@/lib/utils";

/** Pure-CSS diagonal light beams sweeping across a container. */
export function Beams({
  className,
  color = "rgba(25,120,229,0.18)",
  count = 6,
}: {
  className?: string;
  color?: string;
  count?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="rb-beam"
          style={
            {
              left: `${(i / count) * 100 - 10}%`,
              animationDelay: `${i * 0.7}s`,
              ["--beam-color" as string]: color,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export default Beams;
