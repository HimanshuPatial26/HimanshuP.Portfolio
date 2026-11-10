"use client";

import { useEffect, useRef } from "react";

type Props = {
  lines: { text: string; accent: "ai" | "growth" }[];
  /** play the entrance once the intro has finished */
  revealed: boolean;
  className?: string;
};

/**
 * The hero name. Each letter flips up into place on entry. Hover a line and
 * its letters roll over one after another to an outlined copy in the line's
 * accent colour (blue for the first name, orange for the surname); every few
 * seconds the whole name rolls once on its own, so phones see it too.
 */
export default function RollName({ lines, revealed, className = "" }: Props) {
  const rootRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !revealed) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let off = 0;
    const roll = () => {
      if (document.hidden || root.matches(":hover")) return;
      root.dataset.roll = "on";
      off = window.setTimeout(() => delete root.dataset.roll, 1500);
    };
    const first = window.setTimeout(roll, 3200);
    const every = window.setInterval(roll, 7000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.clearTimeout(off);
      delete root.dataset.roll;
    };
  }, [revealed]);

  return (
    <p ref={rootRef} className={`roll-name ${className}`} data-revealed={revealed || undefined}>
      {lines.map((line, li) => (
        <span key={line.text} className={`roll-line roll-${line.accent}`}>
          {Array.from(line.text).map((ch, i) => (
            <span key={i} className="roll-char" style={{ "--i": i, "--d": `${350 + li * 160 + i * 38}ms` } as React.CSSProperties}>
              <span className="roll-rise">
                <span className="roll-stack">
                  <span className="roll-face">{ch}</span>
                  <span className="roll-face roll-alt">{ch}</span>
                </span>
              </span>
            </span>
          ))}
        </span>
      ))}
    </p>
  );
}
