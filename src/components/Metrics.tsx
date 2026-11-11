"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import MetricVisual from "@/components/MetricVisual";
import Odometer from "@/components/Odometer";
import { metrics, type Metric } from "@/data/resume";

/** The number exactly as the 3D text spells it, e.g. "₹4M" or "+10–15%". */
const spelled = (m: Metric) => `${m.prefix ?? ""}${m.lead ?? ""}${m.value}${m.suffix ?? ""}`;

// growth-led results light the scene in silver, the others blue
const grades = ["growth", "ai", "growth", "ai"] as const;

type Lenis = { scrollTo: (t: HTMLElement | string | number, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;

/**
 * Impact, on one pinned screen: the heading and the four results sit on the left while the
 * glass 3D number for the active one stands on the right. Scrolling steps through the four;
 * so do hovering a row (after a short rest), clicking it and the arrow keys. The active row
 * opens to show what its number means (from the resume's own figures) and where its story is;
 * a rail beside the list tracks progress, and the glass number can be dragged round.
 * The numbers are also plain text in the list, so it reads fine without 3D.
 */
export default function Metrics() {
  const [active, setActive] = useState(0);
  const [usd, setUsd] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const railRef = useRef<HTMLSpanElement>(null);
  const hoverTimer = useRef(0);
  const firstCurrency = useRef(true);

  // which step is on screen
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.index))),
      { rootMargin: "-50% 0px -50% 0px" },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // the progress rail fills continuously with the scroll through the section
  useEffect(() => {
    let raf = 0;
    const paint = () => {
      raf = 0;
      const sec = sectionRef.current;
      const rail = railRef.current;
      if (!sec || !rail) return;
      const top = sec.getBoundingClientRect().top + window.scrollY;
      const run = Math.max(1, sec.offsetHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, (window.scrollY - top) / run));
      rail.style.transform = `scaleY(${p.toFixed(4)})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(paint);
    };
    paint();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // switching currency re-spells the glass number: the scene melts it and re-forms it
  useEffect(() => {
    if (firstCurrency.current) {
      firstCurrency.current = false;
      return;
    }
    window.dispatchEvent(new Event("scene:reshape"));
  }, [usd]);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // scroll so the step sits across the middle of the screen, never above the pinned screen's start
  const jump = (i: number) => {
    const el = stepRefs.current[i];
    const sec = sectionRef.current;
    if (!el || !sec) return;
    const y = Math.max(sec.getBoundingClientRect().top, el.getBoundingClientRect().top - window.innerHeight * 0.2) + window.scrollY;
    const l = lenis();
    if (l) l.scrollTo(y, { duration: 1.1 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  // hovering a row for a moment brings its number up (desktop pointers only)
  const preview = (i: number) => {
    window.clearTimeout(hoverTimer.current);
    if (i === active || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    hoverTimer.current = window.setTimeout(() => jump(i), 220);
  };
  const cancelPreview = () => window.clearTimeout(hoverTimer.current);

  const onKeys = (e: KeyboardEvent<HTMLOListElement>) => {
    const step = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    const next = Math.min(metrics.length - 1, Math.max(0, active + step));
    if (next === active) return;
    e.preventDefault();
    jump(next);
    rowRefs.current[next]?.focus({ preventScroll: true });
  };

  // drag on the right half to turn the glass number (the scene listens for "scene:spin")
  const drag = useRef<{ id: number; x: number } | null>(null);
  const spin = (detail: { dx?: number; end?: boolean }) => window.dispatchEvent(new CustomEvent("scene:spin", { detail }));
  const onDragDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = { id: e.pointerId, x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.id !== e.pointerId) return;
    spin({ dx: e.clientX - drag.current.x });
    drag.current.x = e.clientX;
  };
  const onDragEnd = () => {
    if (!drag.current) return;
    drag.current = null;
    spin({ end: true });
  };

  const goTo = (href: string) => (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (!href.startsWith("#")) return; // case studies: RouteTransition takes the link
    e.preventDefault();
    const l = lenis();
    if (l) l.scrollTo(href, { duration: 1.4 });
    else document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} id="impact" className="relative">
      {/* the pinned screen */}
      <div className="sticky top-0 z-[1] flex h-[100svh] items-end pb-[7svh] md:items-center md:pb-0">
        {/* the glass number's side: drag to turn it */}
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 z-10 hidden w-[52%] cursor-grab touch-none active:cursor-grabbing lg:block"
          onPointerDown={onDragDown}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        />
        <span aria-hidden="true" className="micro pointer-events-none absolute right-8 bottom-[9svh] hidden text-faint lg:block">
          Drag to turn
        </span>

        <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="max-w-[26rem]">
            <p className="font-mono text-xs tracking-widest text-faint uppercase">02 / Impact</p>
            <h2 className="mt-3 font-display text-[clamp(2.25rem,min(5vw,7svh),4rem)] leading-[1] font-semibold tracking-[-0.04em]">
              The numbers.
            </h2>
            <p className="mt-3 hidden text-sm leading-relaxed text-muted sm:block">
              Results from products I owned at Classplus. Hover one, use the arrow keys, or keep scrolling.
            </p>

            <div className="relative mt-[min(1.75rem,3svh)]">
              {/* progress through the four */}
              <span aria-hidden="true" className="absolute top-0 bottom-0 -left-5 hidden w-px bg-line md:block">
                {/* inline transform only: Tailwind's scale-y-0 sets `scale`, which would multiply it to zero */}
                <span ref={railRef} className="block h-full origin-top bg-text" style={{ transform: "scaleY(0)" }} />
              </span>

              <ol aria-label="Results" onKeyDown={onKeys}>
                {metrics.map((m, i) => {
                  const on = i === active;
                  const ai = grades[i] === "ai";
                  const showUsd = m.visual.kind === "currency" && usd;
                  const number = showUsd && m.visual.kind === "currency" ? m.visual.alt : spelled(m);
                  const note = showUsd && m.visual.kind === "currency" ? m.visual.altNote : m.note;
                  return (
                    <li key={m.label} className="relative border-t border-line">
                      <span
                        aria-hidden="true"
                        className={`absolute -top-px left-0 h-px transition-all duration-700 ${on ? `w-full ${ai ? "bg-ai" : "bg-growth"}` : "w-0"}`}
                      />
                      <button
                        ref={(el) => {
                          rowRefs.current[i] = el;
                        }}
                        type="button"
                        onClick={() => jump(i)}
                        onPointerEnter={() => preview(i)}
                        onPointerLeave={cancelPreview}
                        aria-current={on}
                        aria-expanded={on}
                        className="cursor-target group grid w-full grid-cols-[minmax(7.5rem,auto)_1fr] items-baseline gap-x-4 py-[min(0.9rem,1.6svh)] text-left"
                      >
                        <Odometer
                          key={number}
                          value={number}
                          className={`font-display text-[clamp(1.5rem,min(2.6vw,4svh),2.2rem)] font-bold tracking-tight tabular-nums transition-colors duration-500 ${
                            on ? (ai ? "text-ai" : "text-growth") : "text-muted group-hover:text-text"
                          }`}
                        />
                        <span className="min-w-0">
                          <span className={`block text-sm font-medium transition-colors duration-500 ${on ? "text-text" : "text-muted"}`}>{m.label}</span>
                          <span className={`block truncate font-mono text-[10px] tracking-widest uppercase transition-colors duration-500 ${on ? "text-muted" : "text-faint"}`}>
                            {note}
                          </span>
                        </span>
                      </button>

                      {/* what the number means, and where its story is */}
                      <div className="metric-detail" data-open={on}>
                        <div>
                          <div className="pt-1 pb-[min(1.1rem,2svh)]">
                            <MetricVisual metric={m} on={on} ai={ai} usd={usd} onCurrency={setUsd} />
                            <a
                              href={m.link.href}
                              onClick={goTo(m.link.href)}
                              tabIndex={on ? 0 : -1}
                              className="cursor-target mt-3 inline-flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-muted uppercase transition-colors hover:text-text"
                            >
                              {m.link.label}
                              <span aria-hidden="true">→</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* scroll steps under the pinned screen: each one tells the scene which number to spell */}
      <div className="-mt-[100svh]" aria-hidden="true">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            ref={(el) => {
              stepRefs.current[i] = el;
            }}
            data-index={i}
            data-shape={`text:${m.visual.kind === "currency" && usd ? m.visual.alt : spelled(m)}`}
            data-pose="number"
            data-stop="tight"
            data-grade={grades[i]}
            {...(i === 0 ? { "data-chapter": "Impact", "data-chapter-no": "02" } : {})}
            className="h-[70svh]"
          />
        ))}
        <div className="h-[30svh]" />
      </div>
    </section>
  );
}
