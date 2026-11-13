"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type Props = {
  text: string;
  /** a tall pinned element whose scroll drives the sweep (defaults to the paragraph itself) */
  trackRef?: React.RefObject<HTMLElement | null>;
  className?: string;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * A statement lit by a band of light that travels down it at a slant as you scroll: text
 * above the band is lit, text below waits in shadow, and the band's edge glints blue. The
 * gradient lives in CSS (.sweep-text); this only moves its edge, --sweep. When the track is
 * pinned (taller than the screen) the sweep follows it and finishes as the pin lets go;
 * otherwise it follows the paragraph up the screen. Without script, or with reduced motion,
 * the text rests fully lit.
 */
export default function SweepText({ text, trackRef, className = "" }: Props) {
  const boxRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const track = trackRef?.current ?? box;

    const progress = () => {
      const vh = window.innerHeight;
      const t = track.getBoundingClientRect();
      if (t.height > vh * 1.5) return clamp01((vh * 0.25 - t.top) / (t.height - vh * 0.85));
      const b = box.getBoundingClientRect();
      return clamp01((vh * 0.85 - b.top) / (vh * 0.6));
    };

    let shown = "";
    const draw = () => {
      const edge = `${(-14 + progress() * 128).toFixed(1)}%`;
      if (edge === shown) return;
      shown = edge;
      box.style.setProperty("--sweep", edge);
    };

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "200px 0px" });
    io.observe(track);
    const tick = () => {
      if (visible) draw();
    };
    gsap.ticker.add(tick);
    draw();

    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
      box.style.removeProperty("--sweep");
    };
  }, [trackRef]);

  return (
    <p ref={boxRef} className={`sweep-text ${className}`}>
      {text}
    </p>
  );
}
