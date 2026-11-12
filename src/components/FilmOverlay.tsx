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
 * - the title slice during that cut: the chapter's name rises as a full-screen card,
 *   then splits along a blue seam and the halves slide apart to show the new section;
 * - a vignette over the 3D scene, and faint animated grain over everything.
 * Reads the shared `film` state every frame; never re-renders.
 */
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function FilmOverlay() {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sliceTopRef = useRef<HTMLDivElement>(null);
  const sliceBottomRef = useRef<HTMLDivElement>(null);
  const seamRef = useRef<HTMLDivElement>(null);
  const grainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (grainRef.current) grainRef.current.style.backgroundImage = `url(${grainTile()})`;

    let bars = reduce ? 0 : film.forceBars;
    let lastBars = -1;
    let lastSlice = "";
    let label = "";
    let down = true; // scroll direction, held while the reader pauses
    const halves = [sliceTopRef.current, sliceBottomRef.current];
    const setLabel = (name: string, no: string) => {
      halves.forEach((half) => {
        const n = half?.querySelector<HTMLElement>("[data-slice-name]");
        const k = half?.querySelector<HTMLElement>("[data-slice-no]");
        if (n) n.textContent = name;
        if (k) k.textContent = no;
      });
    };
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

      // title slice, scrubbed with the shape change: the card rises over the old section,
      // a seam lights across it, then the halves part to show the new one. Scrolling up runs
      // it backwards with the name of the section above, the one being entered.
      if (Math.abs(film.velocity) > 0.02) down = film.velocity > 0;
      const name = down ? film.chapter : film.chapterFrom;
      const no = down ? film.chapterNo : film.chapterFromNo;
      if (name && name !== label) {
        label = name;
        setLabel(name, no);
      }
      const m = film.mix;
      const on = !reduce && !!name && m > 0.001 && m < 0.999;
      const rise = inOut(clamp01(m / 0.42));
      const split = inOut(clamp01((m - 0.52) / 0.48));
      const seam = clamp01((m - 0.44) / 0.1) * (1 - clamp01((m - 0.62) / 0.18));
      const css = on ? `${m.toFixed(4)}` : "off";
      if (css !== lastSlice) {
        lastSlice = css;
        const lift = (1 - rise) * 102;
        const [top, bottom] = halves;
        if (top) {
          top.style.visibility = on ? "visible" : "hidden";
          top.style.transform = `translate3d(${(-14 * split).toFixed(2)}vw, ${(lift - 58 * split).toFixed(2)}%, 0)`;
        }
        if (bottom) {
          bottom.style.visibility = on ? "visible" : "hidden";
          bottom.style.transform = `translate3d(${(14 * split).toFixed(2)}vw, ${(lift + 58 * split).toFixed(2)}%, 0)`;
        }
        if (seamRef.current) {
          seamRef.current.style.opacity = on ? seam.toFixed(3) : "0";
          seamRef.current.style.transform = `scaleX(${clamp01((m - 0.44) / 0.1).toFixed(3)})`;
        }
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

      {/* title slice: two clipped copies of one card, above the content and below the bars */}
      <div ref={sliceTopRef} aria-hidden="true" className="film-slice film-slice-top">
        <span data-slice-no className="film-slice-no" />
        <span data-slice-name className="film-slice-name" />
      </div>
      <div ref={sliceBottomRef} aria-hidden="true" className="film-slice film-slice-bottom">
        <span data-slice-no className="film-slice-no" />
        <span data-slice-name className="film-slice-name" />
      </div>
      <div ref={seamRef} aria-hidden="true" className="film-seam" />

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
