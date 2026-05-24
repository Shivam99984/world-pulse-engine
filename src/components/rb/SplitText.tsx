import { motion } from "framer-motion";
import { useMemo } from "react";

type Props = {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: "h1" | "h2" | "h3" | "span" | "p";
};

/** Letter-by-letter entrance. */
export function SplitText({
  text,
  className,
  delay = 0,
  stagger = 0.035,
  as = "span",
}: Props) {
  const words = useMemo(() => text.split(" "), [text]);
  const MotionTag = motion[as] as typeof motion.span;
  return (
    <MotionTag
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
      aria-label={text}
    >
      {words.map((w, wi) => (
        <span
          key={wi}
          className="inline-block whitespace-nowrap"
          style={{ marginRight: "0.25em" }}
        >
          {Array.from(w).map((ch, ci) => (
            <motion.span
              key={ci}
              className="inline-block"
              variants={{
                hidden: { y: "0.6em", opacity: 0, rotateX: -45 },
                show: {
                  y: 0,
                  opacity: 1,
                  rotateX: 0,
                  transition: { duration: 0.6, ease: [0.2, 0.7, 0.2, 1] },
                },
              }}
              style={{ transformOrigin: "50% 100%" }}
            >
              {ch}
            </motion.span>
          ))}
        </span>
      ))}
    </MotionTag>
  );
}

export default SplitText;
