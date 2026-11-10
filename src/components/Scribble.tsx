"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type Props = {
  children: React.ReactNode;
  /** a loose hand-drawn ring, a swoosh under the word, or a straight hairline rule */
  kind?: "circle" | "underline" | "line";
  className?: string;
};

// drawn in a 200×60 box, then stretched to fit the word
const PATHS = {
  circle:
    "M108 6C66 3 18 9 8 27c-9 17 30 28 86 28 56 0 101-9 100-27C193 10 150 3 96 5 61 6 33 11 22 17",
  underline: "M4 46c34-7 74-10 112-9 27 1 53 4 80 9",
  line: "M1 30H199",
};

/**
 * A hand-drawn ring or underline that draws itself around a word when it
 * scrolls into view. The stroke takes the word's colour.
 */
export default function Scribble({ children, kind = "circle", className = "" }: Props) {
  const pathRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    // the straight rule is a plain bar that grows from the left; the drawn shapes use a dash reveal
    const bar = lineRef.current;
    const path = pathRef.current;
    if (!root || (!bar && !path)) return;
    const hidden = bar ? { scaleX: 0 } : { strokeDasharray: 1, strokeDashoffset: 1 }; // pathLength=1 keeps the dash maths right
    const shown = bar ? { scaleX: 1 } : { strokeDashoffset: 0 };
    const target = bar ?? path;
    gsap.set(target, hidden);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(target, shown);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        gsap.to(target, { ...shown, duration: kind === "circle" ? 1.1 : 0.8, ease: "power2.inOut", delay: 0.25 });
        io.disconnect();
      },
      { rootMargin: "0px 0px -20% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, [kind]);

  if (kind === "line") {
    return (
      <span ref={rootRef} className={`relative inline-block ${className}`}>
        {children}
        <span ref={lineRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 -bottom-[0.02em] block h-[0.025em] min-h-px origin-left bg-current" />
      </span>
    );
  }

  return (
    <span ref={rootRef} className={`relative inline-block ${className}`}>
      {children}
      <svg
        aria-hidden="true"
        viewBox="0 0 200 60"
        preserveAspectRatio="none"
        className={`pointer-events-none absolute overflow-visible ${
          kind === "circle" ? "-inset-x-[14%] -inset-y-[22%] h-[144%] w-[128%]" : "-bottom-[18%] left-0 h-[40%] w-full"
        }`}
      >
        <path
          ref={pathRef}
          d={PATHS[kind]}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={kind === "circle" ? 2.5 : 4}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}
