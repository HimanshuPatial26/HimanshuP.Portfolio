"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

type Lenis = { scrollTo: (t: HTMLElement, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Live scroll position inside the story, updated every frame without re-rendering React. */
export type StoryState = { index: number; progress: number };

/** `lead`: the opening chapter, which carries the page title (no kicker, starts near the top). */
export type StoryChapter = { id: string; label: string; content: ReactNode; lead?: boolean };

type Props = {
  chapters: StoryChapter[];
  /** the pinned visual; it reads `state.current` each frame (no re-render), `active` re-renders */
  renderVisual: (state: RefObject<StoryState>, active: number) => ReactNode;
  /** small print under the timeline, e.g. "Scroll to unbox" */
  hint?: string;
  label: string;
};

/**
 * A scroll story: words on the left, a visual pinned on the right (along the top on phones) that
 * follows which chapter is in view and how far through it the reader is. A chapter timeline sits
 * under the visual and jumps on click. The page gets data-active-chapter for chapter-led styling.
 */
export default function StickyStory({ chapters, renderVisual, hint, label }: Props) {
  const [active, setActive] = useState(0);
  const state = useRef<StoryState>({ index: 0, progress: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const page = sectionRef.current?.closest<HTMLElement>(".project-page");
    let raf = 0;
    let running = false;
    let shown = -1;
    const step = () => {
      raf = requestAnimationFrame(step);
      const mid = window.innerHeight * 0.5;
      let idx = 0;
      let prog = 0;
      chapterRefs.current.forEach((el, i) => {
        if (!el) return;
        const r = el.getBoundingClientRect();
        if (r.top <= mid) {
          idx = i;
          prog = clamp01((mid - r.top) / Math.max(1, r.height));
        }
      });
      state.current.index = idx;
      state.current.progress = prog;
      if (idx !== shown) {
        shown = idx;
        setActive(idx);
        if (page) page.dataset.activeChapter = chapters[idx].id;
      }
      fillRefs.current.forEach((f, i) => {
        if (f) f.style.transform = `scaleX(${i < idx ? 1 : i === idx ? prog.toFixed(4) : 0})`;
      });
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          raf = requestAnimationFrame(step);
        } else if (!e.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "40% 0px" },
    );
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      if (page) delete page.dataset.activeChapter;
    };
  }, [chapters]);

  const jump = (i: number) => {
    const el = chapterRefs.current[i];
    if (!el) return;
    const l = lenis();
    if (l) l.scrollTo(el, { offset: -window.innerHeight * 0.18, duration: 1.3 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section ref={sectionRef} aria-label={label} className="relative mx-auto max-w-7xl px-4 sm:px-6">
      <div className="md:grid md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] md:gap-14">
        {/* the visual: pinned on the right (desktop) or in a band along the top (phones) */}
        <div className="sticky top-16 z-10 -mx-4 bg-bg px-4 pt-2 pb-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-10 after:bg-gradient-to-b after:from-bg after:to-transparent after:content-[''] sm:-mx-6 sm:px-6 md:order-last md:top-0 md:mx-0 md:flex md:h-[100svh] md:flex-col md:justify-center md:self-start md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:after:hidden">
          {renderVisual(state, active)}

          <div className="mt-3 md:mt-5">
            <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${chapters.length}, minmax(0, 1fr))` }}>
              {chapters.map((ch, i) => (
                <li key={ch.id}>
                  <button type="button" onClick={() => jump(i)} aria-label={`Chapter ${i + 1}: ${ch.label}`} aria-current={i === active} className="cursor-target group block w-full py-1.5 text-left">
                    <span className="relative block h-[3px] overflow-hidden rounded-full bg-line">
                      {/* inline transform only: Tailwind's scale-x-0 sets `scale`, which would multiply it to zero */}
                      <span
                        ref={(el) => {
                          fillRefs.current[i] = el;
                        }}
                        className="absolute inset-0 origin-left rounded-full bg-[var(--acc)]"
                        style={{ transform: "scaleX(0)" }}
                      />
                    </span>
                    <span className={`mt-2 hidden truncate font-mono text-[10px] tracking-[0.14em] uppercase transition-colors md:block ${i === active ? "text-text" : "text-faint group-hover:text-muted"}`}>
                      {ch.label}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
              <span>
                {String(active + 1).padStart(2, "0")} · {chapters[active].label}
              </span>
              {hint && <span className="hidden md:inline">{hint}</span>}
            </div>
          </div>
        </div>

        {/* the words */}
        <div>
          {chapters.map((ch, i) => (
            <article
              key={ch.id}
              id={`ch-${ch.id}`}
              ref={(el) => {
                chapterRefs.current[i] = el;
              }}
              className={`flex flex-col transition-opacity duration-700 ${
                ch.lead ? "min-h-[80svh] justify-center pt-10 pb-16 md:min-h-[100svh] md:pt-28" : "min-h-[90svh] justify-center py-16 md:min-h-[115svh] md:py-24"
              } ${i === active ? "opacity-100" : "md:opacity-35"}`}
            >
              {!ch.lead && (
                <p className="font-mono text-[11px] tracking-[0.16em] text-[var(--acc)] uppercase">
                  {String(i + 1).padStart(2, "0")} / {ch.label}
                </p>
              )}
              {ch.content}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
