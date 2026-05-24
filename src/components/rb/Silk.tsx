import { cn } from "@/lib/utils";

/** Pure CSS silky gradient mesh with conic + radial layers. */
export function Silk({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("absolute inset-0 overflow-hidden rb-silk", className)}
    />
  );
}

export default Silk;
