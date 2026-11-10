"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

type Body = { el: HTMLElement; x: number; y: number; r: number; vx: number; vy: number; vr: number };

/**
 * Sweep the mouse through the tags inside and they get knocked aside (harder
 * the faster you move), tilt, then spring back to their own spot. No gravity,
 * no pile-up: it always tidies itself back up. Mouse and trackpad only.
 * Tags are any descendants marked with data-tag.
 */
export default function MagneticField({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bodies: Body[] = Array.from(root.querySelectorAll<HTMLElement>("[data-tag]")).map((el) => ({
      el,
      x: 0,
      y: 0,
      r: 0,
      vx: 0,
      vy: 0,
      vr: 0,
    }));
    let last: { x: number; y: number; t: number } | null = null;
    let awake = false;

    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const speed = last ? Math.min(3, Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(8, now - last.t)) : 0;
      last = { x: e.clientX, y: e.clientY, t: now };
      const R = 90;
      for (const b of bodies) {
        const rect = b.el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = cx - e.clientX;
        const dy = cy - e.clientY;
        const d = Math.hypot(dx, dy);
        if (d > R || d < 1) continue;
        const push = (1 - d / R) * (0.6 + speed * 2.2) * 9;
        b.vx += (dx / d) * push;
        b.vy += (dy / d) * push;
        b.vr += (dx / d) * push * 0.9;
        awake = true;
      }
    };
    const onLeave = () => (last = null);

    const tick = () => {
      if (!awake) return;
      let energy = 0;
      for (const b of bodies) {
        // spring home with damping
        b.vx += -b.x * 0.09;
        b.vy += -b.y * 0.09;
        b.vr += -b.r * 0.08;
        b.vx *= 0.82;
        b.vy *= 0.82;
        b.vr *= 0.8;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        energy += Math.abs(b.x) + Math.abs(b.y) + Math.abs(b.r) + Math.abs(b.vx) + Math.abs(b.vy);
        b.el.style.transform = `translate3d(${b.x.toFixed(2)}px, ${b.y.toFixed(2)}px, 0) rotate(${b.r.toFixed(2)}deg)`;
      }
      if (energy < 0.05) awake = false;
    };

    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    gsap.ticker.add(tick);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
      gsap.ticker.remove(tick);
      bodies.forEach((b) => (b.el.style.transform = ""));
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
