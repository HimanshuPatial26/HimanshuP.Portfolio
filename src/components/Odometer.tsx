"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * A number that rolls into place like an odometer when it scrolls into view
 * (left to right, each wheel a beat after the last) and rolls back to zero if
 * you scroll back above it. Anything that isn't a digit (₹, +, –, %, M) stays put.
 */
export default function Odometer({ value, className = "" }: { value: string; className?: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const chars = Array.from(value);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wheels = Array.from(root.querySelectorAll<HTMLElement>("[data-wheel]"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const to = (on: boolean, instant = false) =>
      wheels.forEach((w, i) => {
        const d = Number(w.dataset.wheel);
        gsap.to(w, {
          yPercent: on ? -(10 + d) * 5 : 0, // one full turn, then the digit
          duration: instant ? 0 : on ? 1.6 : 0.6,
          delay: instant || !on ? 0 : i * 0.09,
          ease: on ? "expo.out" : "power2.in",
          overwrite: true,
        });
      });
    if (reduce) {
      to(true, true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) to(true);
        else if (e.boundingClientRect.top > 0) to(false); // left through the bottom: reset
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  return (
    <span ref={rootRef} className={`inline-flex items-baseline ${className}`} aria-label={value} role="img">
      {chars.map((ch, i) =>
        /\d/.test(ch) ? (
          <span key={i} aria-hidden="true" className="relative inline-block h-[1.1em] overflow-hidden align-bottom leading-[1.1em]">
            <span data-wheel={ch} className="block">
              {Array.from({ length: 20 }, (_, k) => (
                <span key={k} className="block h-[1.1em] text-center">
                  {k % 10}
                </span>
              ))}
            </span>
          </span>
        ) : (
          <span key={i} aria-hidden="true" className="inline-block leading-[1.1em]">
            {ch}
          </span>
        ),
      )}
    </span>
  );
}
