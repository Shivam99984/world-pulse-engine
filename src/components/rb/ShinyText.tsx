import { cn } from "@/lib/utils";

export function ShinyText({
  text,
  className,
  speed = 4,
}: {
  text: string;
  className?: string;
  speed?: number;
}) {
  return (
    <span
      className={cn("rb-shiny inline-block", className)}
      style={
        {
          // animation duration based on speed (seconds)
          ["--rb-shiny-duration" as string]: `${speed}s`,
        } as React.CSSProperties
      }
    >
      {text}
    </span>
  );
}

export default ShinyText;
