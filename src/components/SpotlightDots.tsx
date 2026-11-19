"use client";

import { useEffect, useRef } from "react";

/*
 * The site's background: a faint 22px dot grid (the same grid as the project pages) that lights up blue under the
 * pointer, like a torch. The lit dots live in a 480px window that follows the pointer (its mask never changes) while
 * the dots inside move the other way, so they stay on the grid: transform-only, nothing repaints as it moves.
 * Phones and tablets: the light drifts slowly on its own. Less motion: it follows the mouse without easing, and
 * doesn't drift on touch screens. It sits over the 3D scene and under the blue horizon, behind all content; pages
 * with their own background (the project pages) simply cover it.
 */
export default function SpotlightDots() {
  const winRef = useRef<HTMLDivElement>(null);
  const hotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const win = winRef.current, hot = hotRef.current;
    if (!win || !hot) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const R = 240; // half the window
    let tx = window.innerWidth * 0.6, ty = window.innerHeight * 0.4, x = tx, y = ty, raf = 0, shown = false;
    const t0 = performance.now();

    const place = () => {
      const ox = x - R, oy = y - R;
      win.style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0)`;
      hot.style.transform = `translate3d(${(-ox).toFixed(1)}px, ${(-oy).toFixed(1)}px, 0)`;
    };
    const show = (on: boolean) => {
      if (on === shown) return;
      shown = on;
      win.style.opacity = on ? "1" : "0";
    };
    const tick = (now: number) => {
      raf = 0;
      if (!fine) {
        // no pointer to follow: a slow drift across the screen
        const s = (now - t0) / 1000;
        tx = window.innerWidth * (0.5 + 0.3 * Math.sin(s * 0.3));
        ty = window.innerHeight * (0.45 + 0.22 * Math.sin(s * 0.43 + 1));
      }
      x += (tx - x) * 0.14;
      y += (ty - y) * 0.14;
      place();
      if (!document.hidden && (!fine || Math.abs(tx - x) + Math.abs(ty - y) > 0.3)) raf = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      tx = e.clientX;
      ty = e.clientY;
      if (!shown) {
        x = tx;
        y = ty;
      }
      show(true);
      if (reduce) {
        x = tx;
        y = ty;
        place();
      } else kick();
    };
    const onLeave = () => show(false);
    const onVis = () => {
      if (!document.hidden && !fine && !reduce) kick();
    };

    if (fine) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("mouseleave", onLeave);
    } else if (!reduce) {
      place();
      show(true);
      kick();
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div aria-hidden="true" className="spot-dots pointer-events-none fixed inset-0 -z-[4]">
      <div ref={winRef} className="spot-win">
        <div ref={hotRef} className="spot-hot" />
      </div>
    </div>
  );
}
