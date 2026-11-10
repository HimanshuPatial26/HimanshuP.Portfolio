"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type Props = {
  text: string;
  /** element whose scroll position drives the focus (defaults to the paragraph) */
  trackRef?: React.RefObject<HTMLElement | null>;
  className?: string;
};

const CORNER = 12; // px

/**
 * A statement read one word at a time. Four corner brackets glide from word to
 * word as you scroll (or to the word under the mouse), resizing to fit it; the
 * framed word is sharp, words already read dim, and words ahead blur more the
 * further away they are. The corners on the side it's heading to move first.
 * Reduced motion: plain text.
 */
export default function FocusText({ text, trackRef, className = "" }: Props) {
  const boxRef = useRef<HTMLParagraphElement>(null);
  const cornerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const words = text.split(" ");

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const spans = Array.from(box.querySelectorAll<HTMLElement>("[data-w]"));
    const corners = cornerRefs.current.filter(Boolean) as HTMLSpanElement[];
    if (!spans.length || corners.length !== 4) return;
    const track = trackRef?.current ?? box;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    box.dataset.focus = "on";
    let shown = -1;
    let scrollIdx = 0;
    let hoverIdx = -1;

    const place = (i: number, instant = false) => {
      if (i === shown) return;
      const dir = shown < 0 ? 0 : Math.sign(i - shown);
      shown = i;
      const w = spans[i];
      const pad = parseFloat(getComputedStyle(box).fontSize) * 0.16;
      const x0 = w.offsetLeft - pad;
      const y0 = w.offsetTop - pad * 0.35;
      const x1 = w.offsetLeft + w.offsetWidth + pad - CORNER;
      const y1 = w.offsetTop + w.offsetHeight + pad * 0.35 - CORNER;
      const spots: [number, number][] = [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ];
      spots.forEach(([x, y], k) => {
        const right = k === 1 || k === 3;
        const leading = dir > 0 ? right : dir < 0 ? !right : true;
        gsap.to(corners[k], {
          x,
          y,
          autoAlpha: 1,
          duration: instant ? 0 : 0.55,
          delay: instant || leading ? 0 : 0.08,
          ease: "power3.out",
          overwrite: true,
        });
      });
      spans.forEach((s, j) => {
        const d = j - i;
        s.style.opacity = d === 0 ? "1" : d < 0 ? "0.5" : String(Math.max(0.2, 1 - d * 0.13));
        s.style.filter = d > 0 ? `blur(${Math.min(5, d * 0.9).toFixed(1)}px)` : "none";
      });
    };

    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(track);
    const tick = () => {
      if (!visible) return;
      const vh = window.innerHeight;
      const r = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (vh * 0.2 - r.top + vh * 0.35) / Math.max(1, r.height - vh * 0.45)));
      scrollIdx = Math.min(spans.length - 1, Math.floor(p * spans.length));
      place(hoverIdx >= 0 ? hoverIdx : scrollIdx);
    };
    gsap.ticker.add(tick);
    place(0, true);

    const onOver = (e: PointerEvent) => {
      const w = (e.target as HTMLElement).closest?.("[data-w]") as HTMLElement | null;
      if (w) hoverIdx = spans.indexOf(w);
    };
    const onOut = () => (hoverIdx = -1);
    const onResize = () => {
      const i = shown;
      shown = -1;
      place(i < 0 ? 0 : i, true);
    };
    if (fine) {
      box.addEventListener("pointerover", onOver);
      box.addEventListener("pointerleave", onOut);
    }
    window.addEventListener("resize", onResize);
    document.fonts?.ready.then(onResize);

    return () => {
      gsap.ticker.remove(tick);
      io.disconnect();
      box.removeEventListener("pointerover", onOver);
      box.removeEventListener("pointerleave", onOut);
      window.removeEventListener("resize", onResize);
      delete box.dataset.focus;
    };
  }, [trackRef]);

  return (
    <p ref={boxRef} className={`focus-text relative ${className}`}>
      {words.map((w, i) => (
        <span key={i}>
          <span data-w className="inline-block">
            {w}
          </span>{" "}
        </span>
      ))}
      {[0, 1, 2, 3].map((k) => (
        <span
          key={k}
          ref={(el) => {
            cornerRefs.current[k] = el;
          }}
          aria-hidden="true"
          className={`focus-corner focus-corner-${k} pointer-events-none invisible absolute top-0 left-0 opacity-0`}
          style={{ width: CORNER, height: CORNER }}
        />
      ))}
    </p>
  );
}
