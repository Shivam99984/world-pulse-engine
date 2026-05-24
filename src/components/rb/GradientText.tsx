import { cn } from "@/lib/utils";

export function GradientText({
  children,
  className,
  colors = ["#1978E5", "#7C3AED", "#06B6D4", "#1978E5"],
}: {
  children: React.ReactNode;
  className?: string;
  colors?: string[];
}) {
  return (
    <span
      className={cn("rb-gradient-text", className)}
      style={{
        backgroundImage: `linear-gradient(90deg, ${colors.join(", ")})`,
      }}
    >
      {children}
    </span>
  );
}

export default GradientText;
