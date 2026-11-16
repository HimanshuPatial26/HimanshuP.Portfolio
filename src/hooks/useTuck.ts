"use client";

import { useEffect, type RefObject } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Tucks a pinned stage up under the section heading above it.
 *
 * A full-screen stage centres its content, so below a section heading it opens with an empty band:
 * the heading, a screen-centring's worth of nothing, then the content. This pulls the stage up by
 * that band (less `step`), so the content starts a short step below the heading. The band is empty,
 * so the heading's lower part simply sits over it; draw the heading above the stage, and it has
 * scrolled away before the pinned content reaches it.
 *
 * `outer` gets the negative top margin (never the element GSAP pins: wrap that one), `stage` is the
 * full-screen box, and its `[data-tuck]` children are the content whose top is measured. Pass a
 * changing `layout` when the stage swaps its content for another arrangement, to measure afresh.
 */
export function useTuck(outer: RefObject<HTMLElement | null>, stage: RefObject<HTMLElement | null>, layout: unknown = 0, step = 8) {
  useEffect(() => {
    const o = outer.current;
    const s = stage.current;
    if (!o || !s) return;
    let applied = 0;
    const measure = () => {
      const sr = s.getBoundingClientRect();
      // a stage that isn't laid out (hidden at this size) has nothing to tuck
      if (sr.height < 1) return set(0);
      let top = Infinity;
      s.querySelectorAll<HTMLElement>("[data-tuck]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.height > 0) top = Math.min(top, r.top);
      });
      if (!Number.isFinite(top)) return set(0);
      set(Math.max(0, Math.round(top - sr.top + step)));
    };
    const set = (px: number) => {
      if (Math.abs(px - applied) < 1) return;
      applied = px;
      o.style.marginTop = px ? `${-px}px` : "";
      // pinned scroll distances depend on where the stage starts
      ScrollTrigger.refresh();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(s);
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      o.style.marginTop = "";
    };
  }, [outer, stage, layout, step]);
}
