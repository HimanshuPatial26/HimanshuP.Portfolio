"use client";

import { useEffect, useRef, useState } from "react";
import { quietMedia } from "@/components/projects/LoopVideo";
import { EvalToggle, PlainToggle, ToneSwitch } from "@/components/projects/Interactives";
import type { BuiltProject, Chapter } from "@/data/projects";

type Lenis = { scrollTo: (t: HTMLElement, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

function ChapterBody({ c, n }: { c: Chapter; n: number }) {
  return (
    <>
      <p className="font-mono text-[11px] tracking-[0.16em] text-[var(--acc)] uppercase">
        {String(n).padStart(2, "0")} / {c.label}
      </p>
      <h2 className="mt-4 text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.02]">{c.title}</h2>
      {c.body.map((b) => (
        <p key={b} className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
          {b}
        </p>
      ))}
      {c.list && (
        <div className="mt-7 max-w-xl">
          {c.listTitle && <p className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">{c.listTitle}</p>}
          <dl className="mt-3 border-b border-line">
            {c.list.map((l, i) => (
              <div key={l.label} className="grid grid-cols-[2rem_8rem_1fr] items-baseline gap-2 border-t border-line py-3 text-[15px] max-sm:grid-cols-[2rem_1fr]">
                <span className="font-mono text-[11px] text-[var(--acc)]">{String(i + 1).padStart(2, "0")}</span>
                <dt className="font-medium">{l.label}</dt>
                <dd className="text-muted max-sm:col-start-2">{l.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {c.stats && (
        <div className="mt-8 flex flex-wrap gap-3">
          {c.stats.map((s) => (
            <div key={s.label} className="glass min-w-[9.5rem] rounded-2xl px-5 py-4">
              <p className="font-display text-[1.7rem] leading-none tracking-[-0.03em]">{s.value}</p>
              <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-faint uppercase">{s.label}</p>
            </div>
          ))}
        </div>
      )}
      {c.interactive === "eval" && <EvalToggle />}
      {c.interactive === "tones" && <ToneSwitch />}
      {c.interactive === "plain" && <PlainToggle />}
    </>
  );
}

/**
 * The story, chapter by chapter. The film stays pinned beside the words and scrolling moves it
 * through the stretch that matches each chapter (the scrub encodes have a keyframe every 6 frames,
 * so seeking is cheap). Less motion: the film rests on each chapter's finished frame instead.
 */
export default function ProjectChapters({ p }: { p: BuiltProject }) {
  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const chapterRefs = useRef<(HTMLElement | null)[]>([]);
  const scrubRef = useRef<HTMLVideoElement>(null);
  const logRef = useRef<HTMLVideoElement>(null);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const quiet = quietMedia();
    const vids = { scrub: scrubRef.current, log: logRef.current };
    const cur = { scrub: -1, log: -1 };
    const page = sectionRef.current?.closest<HTMLElement>(".project-page");
    let raf = 0;
    let running = false;
    let last = 0;
    let shown = -1;

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
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
      if (idx !== shown) {
        shown = idx;
        setActive(idx);
        if (page) page.dataset.activeChapter = p.chapters[idx].id;
      }
      fillRefs.current.forEach((f, i) => {
        if (f) f.style.transform = `scaleX(${i < idx ? 1 : i === idx ? prog.toFixed(4) : 0})`;
      });

      const c = p.chapters[idx];
      const v = vids[c.media];
      if (!v) return;
      // reach the chapter's finished frame about three quarters of the way through it, then hold
      // (a little short of the end so that frame is fully built)
      const end = c.at[1] - 0.05;
      const target = quiet ? end : c.at[0] + (end - c.at[0]) * Math.min(1, prog * 1.35);
      const k = 1 - Math.exp(-7 * dt);
      const t = cur[c.media] < 0 || quiet ? target : cur[c.media] + (target - cur[c.media]) * k;
      cur[c.media] = t;
      if (v.readyState >= 1 && !v.seeking && Math.abs(v.currentTime - t) > 1 / 50) {
        try {
          v.currentTime = t;
        } catch {}
      }
      if (timeRef.current) timeRef.current.textContent = `${fmt(t)} / ${fmt(v.duration || c.at[1])}`;
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          last = 0;
          Object.values(vids).forEach((v) => v && v.preload !== "auto" && (v.preload = "auto"));
          raf = requestAnimationFrame(step);
        } else if (!e.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
        }
      },
      { rootMargin: "60% 0px" },
    );
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      if (page) delete page.dataset.activeChapter;
    };
  }, [p]);

  const jump = (i: number) => {
    const el = chapterRefs.current[i];
    if (!el) return;
    const l = lenis();
    if (l) l.scrollTo(el, { offset: -window.innerHeight * 0.18, duration: 1.3 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  const media = p.chapters[active].media;
  const c = p.chapters[active];

  return (
    <section ref={sectionRef} aria-label={`${p.name}, chapter by chapter`} className="relative mx-auto max-w-7xl px-4 sm:px-6">
      <div className="md:grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
        {/* the film: pinned on the right (desktop) or along the top (phones) */}
        {/* phones: a solid band behind the film and timeline (the words scroll under it), fading out below */}
        <div className="sticky top-16 z-10 -mx-4 bg-bg px-4 pt-2 pb-3 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-10 after:bg-gradient-to-b after:from-bg after:to-transparent after:content-[''] sm:-mx-6 sm:px-6 md:order-last md:top-0 md:mx-0 md:flex md:h-[100svh] md:flex-col md:justify-center md:self-start md:bg-transparent md:px-0 md:pt-0 md:pb-0 md:after:hidden">
          <div
            className="relative aspect-video overflow-hidden rounded-2xl border border-white/12 bg-[#0b0b0b] md:rounded-[22px]"
            style={{ boxShadow: "0 30px 80px rgb(0 0 0 / .45), 0 0 90px rgb(var(--p-rgb) / .14)" }}
          >
            <video
              ref={scrubRef}
              src={p.video.scrub}
              poster={p.video.scrubPoster}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              tabIndex={-1}
              className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${media === "scrub" ? "opacity-100" : "opacity-0"}`}
            />
            {p.video.log && (
              <video
                ref={logRef}
                src={p.video.log}
                poster={p.video.logPoster}
                muted
                playsInline
                preload="metadata"
                aria-hidden="true"
                tabIndex={-1}
                className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${media === "log" ? "opacity-100" : "opacity-0"}`}
              />
            )}
            <span className="bg-black/50 backdrop-blur-md absolute top-3 left-3 rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-white/80 uppercase">
              <span className="text-[var(--p-acc)]">{String(active + 1).padStart(2, "0")}</span> · {c.label}
              {media === "log" ? " · builder's log" : ""}
            </span>
          </div>

          {/* chapter timeline: fills with the scroll; tap a chapter to jump */}
          <div className="mt-4 md:mt-5">
            <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${p.chapters.length}, minmax(0, 1fr))` }}>
              {p.chapters.map((ch, i) => (
                <li key={ch.id}>
                  <button type="button" onClick={() => jump(i)} aria-label={`Chapter ${i + 1}: ${ch.label}`} aria-current={i === active} className="cursor-target group block w-full py-1.5 text-left">
                    <span className="relative block h-[3px] overflow-hidden rounded-full bg-line">
                      <span
                        ref={(el) => {
                          fillRefs.current[i] = el;
                        }}
                        className="absolute inset-0 origin-left rounded-full bg-[var(--acc)]"
                        style={{ transform: "scaleX(0)" }}
                      />
                    </span>
                    <span
                      className={`mt-2 hidden truncate font-mono text-[10px] tracking-[0.14em] uppercase transition-colors md:block ${
                        i === active ? "text-text" : "text-faint group-hover:text-muted"
                      }`}
                    >
                      {ch.label}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] tracking-[0.14em] text-faint uppercase">
              <span className="md:hidden">
                {String(active + 1).padStart(2, "0")} · {c.label}
              </span>
              <span className="hidden md:inline">Scroll plays the film · tap a chapter to jump</span>
              <span ref={timeRef} className="tabular-nums">
                0:00
              </span>
            </div>
          </div>
        </div>

        {/* the words */}
        <div>
          {p.chapters.map((ch, i) => (
            <article
              key={ch.id}
              id={`ch-${ch.id}`}
              ref={(el) => {
                chapterRefs.current[i] = el;
              }}
              className={`flex min-h-[90svh] flex-col justify-center py-16 transition-opacity duration-700 md:min-h-[120svh] md:py-24 ${
                i === active ? "opacity-100" : "md:opacity-35"
              }`}
            >
              <ChapterBody c={ch} n={i + 1} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
