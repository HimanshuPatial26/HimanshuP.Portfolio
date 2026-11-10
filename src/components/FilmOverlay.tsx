"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { film } from "@/lib/film";

/** A tile of random grey specks for the film grain, generated once. */
function grainTile() {
  const size = 160;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return "";
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
}

/**
 * The film finish over the whole site:
 * - letterbox bars that close in for the opening, page changes and each cut
 *   between chapters (scrubbed with the shape change);
 * - a chapter title that sweeps across behind the content during that cut;
 * - a vignette over the 3D scene, and faint animated grain over everything.
 * Reads the shared `film` state every frame; never re-renders.
 */
export default function FilmOverlay() {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const noRef = useRef<HTMLSpanElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (grainRef.current) grainRef.current.style.backgroundImage = `url(${grainTile()})`;

    let bars = reduce ? 0 : film.forceBars;
    let lastBars = -1;
    let lastCard = "";
    let label = "";
    const tick = () => {
      // letterbox: held by the opening / page changes, or following a chapter cut
      const cut = film.chapter ? film.morph : 0;
      const target = reduce ? 0 : Math.max(film.forceBars, cut * 0.7);
      bars += (target - bars) * 0.14;
      if (Math.abs(bars - lastBars) > 0.001) {
        lastBars = bars;
        const s = `scaleY(${bars.toFixed(4)})`;
        if (topRef.current) topRef.current.style.transform = s;
        if (bottomRef.current) bottomRef.current.style.transform = s;
      }

      // chapter title sweeping right to left as the shape changes
      if (film.chapter !== label && film.chapter) {
        label = film.chapter;
        if (labelRef.current) labelRef.current.textContent = film.chapter;
        if (noRef.current) noRef.current.textContent = film.chapterNo;
      }
      const show = film.chapter && !reduce ? Math.pow(Math.sin(Math.PI * film.mix), 1.4) : 0;
      const css = `${show.toFixed(3)}|${film.mix.toFixed(3)}`;
      if (css !== lastCard && cardRef.current) {
        lastCard = css;
        cardRef.current.style.opacity = (show * 0.85).toFixed(3);
        cardRef.current.style.transform = `translate3d(${((0.5 - film.mix) * 50).toFixed(2)}vw,0,0)`;
      }
    };
    gsap.ticker.add(tick);

    // close the bars over page changes
    let t = 0;
    const onLeave = () => {
      window.clearTimeout(t);
      film.forceBars = 1;
    };
    const onEnter = () => {
      t = window.setTimeout(() => (film.forceBars = 0), 250);
    };
    window.addEventListener("route:leave", onLeave);
    window.addEventListener("route:enter", onEnter);

    return () => {
      gsap.ticker.remove(tick);
      window.clearTimeout(t);
      window.removeEventListener("route:leave", onLeave);
      window.removeEventListener("route:enter", onEnter);
    };
  }, []);

  return (
    <>
      {/* vignette and the electric-blue horizon: over the 3D scene, under the content */}
      <div aria-hidden="true" className="film-horizon page-horizon pointer-events-none fixed inset-0 -z-[4]" />
      <div aria-hidden="true" className="film-vignette pointer-events-none fixed inset-0 -z-[4]" />

      {/* chapter title: behind the content, in front of the scene */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-[3] flex items-center justify-center overflow-hidden">
        <div ref={cardRef} className="flex flex-col items-center opacity-0 will-change-transform">
          <span ref={noRef} className="mb-3 font-mono text-xs tracking-[0.4em] text-faint" />
          <span
            ref={labelRef}
            className="font-display text-[clamp(5rem,19vw,20rem)] leading-[0.85] tracking-[-0.04em] whitespace-nowrap text-transparent uppercase [-webkit-text-stroke:1.5px_var(--text)] [font-variation-settings:'wght'_850,'wdth'_125,'opsz'_144]"
          />
        </div>
      </div>

      {/* letterbox bars: above the content, below the header buttons */}
      <div
        ref={topRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[38] h-[6svh] origin-top bg-[var(--bars)] md:h-[9svh]"
        style={{ transform: "scaleY(1)" }}
      />
      <div
        ref={bottomRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[38] h-[6svh] origin-bottom bg-[var(--bars)] md:h-[9svh]"
        style={{ transform: "scaleY(1)" }}
      />

      {/* grain over everything */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[120] overflow-hidden">
        <div ref={grainRef} className="film-grain absolute -inset-[50%] opacity-[var(--grain)]" />
      </div>
    </>
  );
}
