"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// over these the head drop swells (something to click)
const CLICKABLE =
  "a, button, [role='button'], summary, label, select, .cursor-target, [data-cursor]";
// over these it stretches sideways (something to drag)
const DRAGGABLE = ".cursor-grab, [data-cursor='drag']";
// over these the system text cursor comes back
const TYPING = "input, textarea, [contenteditable='true']";

const DROPS = [22, 18, 15, 12, 10]; // px: the head, then a tapering tail
const BOX = 200; // px: the gooey layer is only this big and travels with the head (cheap filter)
const TAIL = 74; // px: the tail never strays further than this from the head

type Body = { x: number; y: number; vx: number; vy: number };

/**
 * The cursor: a few electric-blue drops that chase the pointer on springs and merge through an
 * SVG "goo" filter, like the liquid glass in the scene. The head swells over anything clickable,
 * stretches over things you can drag, and squishes on click. It runs only for a mouse or trackpad,
 * hands back the system cursor in text fields and open dialogs, stops its loop when it comes to
 * rest, and is off for people who prefer less motion.
 */
export default function LiquidCursor() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const dropRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setTimeout(() => setHost(document.body), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!host) return;
    const root = document.documentElement;
    const layer = layerRef.current;
    if (!layer) return;
    root.classList.add("liquid-cursor");

    const mouse = { x: -200, y: -200, seen: false, down: false };
    const bodies: Body[] = DROPS.map(() => ({
      x: -200,
      y: -200,
      vx: 0,
      vy: 0,
    }));
    let mode: "rest" | "click" | "drag" | "type" | "off" = "rest";
    let swell = 1; // eased head scale
    let raf = 0;
    let last = 0;

    const kick = () => {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      if (!mouse.seen) {
        mouse.seen = true;
        bodies.forEach((b) => ((b.x = mouse.x), (b.y = mouse.y)));
      }
      const t = e.target as Element | null;
      // a modal dialog sits in the top layer, above anything this can draw: use the system cursor there
      const dialogOpen = !!document.querySelector("dialog[open]");
      root.classList.toggle("liquid-cursor", !dialogOpen);
      mode = dialogOpen
        ? "off"
        : t?.closest(TYPING)
          ? "type"
          : t?.closest(DRAGGABLE)
            ? "drag"
            : t?.closest(CLICKABLE)
              ? "click"
              : "rest";
      // over something clickable the swollen drop turns into a tinted lens, so its label stays readable
      layer.style.opacity = mode === "click" ? "0.45" : "1";
      kick();
    };
    const onDown = () => {
      mouse.down = true;
      kick();
    };
    const onUp = () => {
      mouse.down = false;
      kick();
    };
    // the pointer left the window (relatedTarget is null only then), or the window lost focus
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget) return;
      layer.style.opacity = "0";
      mouse.seen = false;
    };

    const frame = (now: number) => {
      const dt = last ? Math.min(0.033, (now - last) / 1000) : 1 / 60;
      last = now;
      let moving = false;

      // springs: the head chases the pointer, each tail drop chases the drop before it
      bodies.forEach((b, i) => {
        const gx = i === 0 ? mouse.x : bodies[i - 1].x;
        const gy = i === 0 ? mouse.y : bodies[i - 1].y;
        const k = i === 0 ? 900 : 760 / (i + 0.6);
        const d = i === 0 ? 46 : 36 / Math.sqrt(i + 0.5);
        for (let n = 0; n < 2; n++) {
          const h = dt / 2;
          b.vx += (k * (gx - b.x) - d * b.vx) * h;
          b.vy += (k * (gy - b.y) - d * b.vy) * h;
          b.x += b.vx * h;
          b.y += b.vy * h;
        }
        if (i > 0) {
          // keep the tail inside the gooey layer
          const dx = b.x - bodies[0].x;
          const dy = b.y - bodies[0].y;
          const dist = Math.hypot(dx, dy);
          if (dist > TAIL) {
            b.x = bodies[0].x + (dx / dist) * TAIL;
            b.y = bodies[0].y + (dy / dist) * TAIL;
          }
        }
        if (
          Math.abs(b.vx) + Math.abs(b.vy) > 4 ||
          Math.abs(gx - b.x) + Math.abs(gy - b.y) > 0.3
        )
          moving = true;
      });

      const target = mode === "click" ? 2 : mode === "drag" ? 1.5 : 1;
      const next =
        swell +
        (target * (mouse.down ? 0.78 : 1) - swell) * (1 - Math.exp(-14 * dt));
      if (Math.abs(next - swell) > 0.001) moving = true;
      swell = next;

      const hx = bodies[0].x;
      const hy = bodies[0].y;
      layer.style.transform = `translate3d(${hx - BOX / 2}px, ${hy - BOX / 2}px, 0)`;
      layer.style.visibility =
        mode === "type" || mode === "off" ? "hidden" : "visible";
      bodies.forEach((b, i) => {
        const el = dropRefs.current[i];
        if (!el) return;
        const x = b.x - hx + BOX / 2;
        const y = b.y - hy + BOX / 2;
        if (i === 0) {
          // the head stretches along its motion, and sideways over something draggable
          const speed = Math.min(1, Math.hypot(b.vx, b.vy) / 2600);
          const ang = Math.atan2(b.vy, b.vx);
          const sx = (mode === "drag" ? 1.35 : 1) * (1 + speed * 0.7);
          const sy = (mode === "drag" ? 0.8 : 1) * (1 - speed * 0.3);
          el.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${mode === "drag" ? 0 : ang}rad) scale(${(sx * swell).toFixed(3)}, ${(sy * swell).toFixed(3)})`;
        } else {
          // the tail draws in while the head is swollen over a target
          const shrink = mode === "click" ? 0.55 : 1;
          el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${shrink})`;
        }
      });

      raf = moving ? requestAnimationFrame(frame) : 0;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("mouseout", onOut);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("liquid-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mouseout", onOut);
    };
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div aria-hidden="true" className="liquid-cursor-root">
      <svg width="0" height="0" className="absolute">
        <defs>
          <filter
            id="lc-goo"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="b" />
            <feColorMatrix
              in="b"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"
            />
          </filter>
        </defs>
      </svg>
      <div
        ref={layerRef}
        className="liquid-cursor-layer"
        style={{ width: BOX, height: BOX, opacity: 0 }}
      >
        {/* the goo filter sits inside the layer, so the layer's opacity fades the merged shape */}
        <div className="liquid-cursor-blob">
          {DROPS.map((size, i) => (
            <span
              key={size}
              ref={(el) => {
                dropRefs.current[i] = el;
              }}
              className="liquid-cursor-drop"
              style={{
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
              }}
            />
          ))}
        </div>
      </div>
    </div>,
    host,
  );
}
