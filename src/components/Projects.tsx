"use client";

import { ViewTransition, useEffect, useRef, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import LoopVideo from "@/components/projects/LoopVideo";
import { FilmDialog } from "@/components/projects/ProjectHero";
import { BehrouzStage, FintechStage } from "@/components/projects/StageVisuals";
import { academicProjects, builtProjects, type AcademicProject, type BuiltProject } from "@/data/projects";

type Lenis = { scrollTo: (t: number, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** One project on the stage: built (film loop) or academic (drawn visual). */
type Act = {
  id: string;
  href: string;
  name: string;
  short: string;
  line: string;
  accent: { dark: string; rgb: string };
  group: "Built on my own" | "From my Master's";
  pills: string[];
  live: boolean;
  stat: { value: string; label: string };
  built?: BuiltProject;
  academic?: AcademicProject;
};

const STATS: Record<string, { value: string; label: string }> = {
  callevals: { value: "100%", label: "Next-step precision on the six-call eval" },
  "ai-med-pedia": { value: "2", label: "Models, with live web sources" },
  "fintech-adoption": { value: "96%", label: "Of adoption intention explained" },
  "behrouz-biryani": { value: "−0.78", label: "Quality gap on group orders" },
};

const ACTS: Act[] = [
  ...builtProjects.map<Act>((p) => ({
    id: p.slug,
    href: `/projects/${p.slug}`,
    name: p.name,
    short: p.name,
    line: p.tagline,
    accent: p.accent,
    group: "Built on my own",
    pills: [p.status, "AI product", p.year],
    live: p.status === "Live",
    stat: STATS[p.slug],
    built: p,
  })),
  ...academicProjects.map<Act>((p) => ({
    id: p.id,
    href: `/projects/${p.id}`,
    name: p.short,
    short: p.short,
    line: p.tagline,
    accent: p.accent,
    group: "From my Master's",
    pills: [p.kind, "Master's · SP Jain", p.period],
    live: false,
    stat: STATS[p.id],
    academic: p,
  })),
];

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 10" fill="none" stroke="currentColor" strokeWidth="1.3" className={className} aria-hidden="true">
      <path d="M1 5h23M20 1l4 4-4 4" />
    </svg>
  );
}

/** Which layout is showing: the pinned stage (desktop) or the stacked cards (phones); null until mounted. */
function useDesktop() {
  const [desktop, setDesktop] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setDesktop(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

/**
 * A built project's clip carries a shared view-transition name so it grows into the project page.
 * Only one element per name may be mounted, so only the layout on screen gets it.
 */
function Morph({ name, on, children }: { name: string; on: boolean; children: ReactNode }) {
  return on ? (
    <ViewTransition name={name} share="morph" default="none">
      {children}
    </ViewTransition>
  ) : (
    children
  );
}

/** The project's picture: its film loop, or the drawn visual for the Master's projects. */
function Visual({ a, active }: { a: Act; active: boolean }) {
  if (a.built) return <LoopVideo src={a.built.video.loop} webm={a.built.video.loopWebm} poster={a.built.video.loopPoster} active={active} className="absolute inset-0 size-full object-cover" />;
  if (a.id === "fintech-adoption") return <FintechStage active={active} />;
  return <BehrouzStage active={active} />;
}

function Pills({ a }: { a: Act }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {a.pills.map((t, i) => (
        <span
          key={t}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] uppercase ${
            i === 0 ? "border-[var(--acc)]/60 text-[var(--acc)]" : "border-line-strong text-muted"
          }`}
        >
          {i === 0 && a.live && (
            <span aria-hidden="true" className="flex gap-0.5">
              <span className="size-1.5 rounded-full bg-current" />
              <span className="size-1.5 rounded-full bg-current" />
            </span>
          )}
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * Projects (chapter 04), "the stage": the section pins and gives each project a screen of its own.
 * A giant outlined number, the project's name and line on the left; its film (or drawn visual) on a
 * tilting stage on the right; the room takes on the project's colour; the next project waits at the
 * edge; a rail tracks the four. Clicking the stage grows a built project's clip into its page.
 * Phones get the four as stacked cards.
 */
export default function Projects() {
  const desktop = useDesktop();
  const [active, setActive] = useState(0);
  const [film, setFilm] = useState<BuiltProject | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const pinRef = useRef<HTMLDivElement>(null);
  const fillRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // scroll → which project is on stage, and how far through it
  useEffect(() => {
    if (desktop !== true) return;
    let raf = 0;
    let shown = -1;
    const paint = () => {
      raf = 0;
      const el = pinRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const run = Math.max(1, el.offsetHeight - window.innerHeight);
      const p = clamp01(-r.top / run) * ACTS.length;
      const idx = Math.min(ACTS.length - 1, Math.floor(p));
      fillRefs.current.forEach((f, i) => {
        if (f) f.style.transform = `scaleX(${clamp01(p - i).toFixed(4)})`;
      });
      if (idx !== shown) {
        shown = idx;
        setActive(idx);
      }
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
  }, [desktop]);

  const jump = (i: number) => {
    const el = pinRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const run = el.offsetHeight - window.innerHeight;
    const y = top + ((i + 0.08) / ACTS.length) * run;
    const l = lenis();
    if (l) l.scrollTo(y, { duration: 1.2 });
    else window.scrollTo({ top: y, behavior: "smooth" });
  };

  const onTilt = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 });
  };

  const a = ACTS[active];
  const next = ACTS[(active + 1) % ACTS.length];

  return (
    <section id="projects" data-shape="none" data-chapter="Projects" data-chapter-no="04" className="relative">
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="04"
          eyebrow="Projects"
          title="Two built. Two studied."
          intro="Two AI products I built on my own, and two projects from my Master's at SP Jain. Keep scrolling: each one takes the stage."
        />
      </div>

      {/* ───────── desktop: the stage ───────── */}
      <div ref={pinRef} className="relative hidden md:block" style={{ height: `${ACTS.length * 92 + 8}svh` }}>
        <div className="sticky top-0 h-[100svh] overflow-hidden" style={{ "--acc": a.accent.dark } as CSSProperties}>
          {/* the room: one glow, its colour easing to each project's (a registered custom property) */}
          <div aria-hidden="true" className="stage-room pointer-events-none absolute inset-0" style={{ "--stage-glow": a.accent.dark } as CSSProperties} />

          <div className="relative mx-auto grid h-full max-w-7xl grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] items-center gap-10 px-6 pt-16 lg:gap-14">
            {/* left: the number, the name, the way in */}
            <div className="relative">
              <p className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">
                04 / Projects · {String(active + 1).padStart(2, "0")} of {String(ACTS.length).padStart(2, "0")} · {a.group}
              </p>
              <p
                key={`n${active}`}
                aria-hidden="true"
                className="stage-num mt-2 font-display text-[clamp(8rem,min(22vw,32svh),17rem)] leading-[0.8] tracking-[-0.07em] text-transparent"
                style={{ WebkitTextStroke: `1.5px rgb(${a.accent.rgb} / .6)` }}
              >
                {String(active + 1).padStart(2, "0")}
              </p>
              <div key={`t${active}`} className="mt-[min(1.6rem,3svh)]">
                <div className="stage-in">
                  <Pills a={a} />
                </div>
                <h3 className="stage-in mt-4 text-[clamp(2.6rem,min(5.4vw,9svh),5rem)] leading-[0.92] tracking-[-0.045em]" style={{ animationDelay: "70ms" }}>
                  {a.name}
                </h3>
                <p className="stage-in mt-3 max-w-md text-[15px] leading-relaxed text-muted" style={{ animationDelay: "140ms" }}>
                  {a.line}
                </p>
                <div className="stage-in mt-[min(1.5rem,3svh)] flex flex-wrap items-center gap-4" style={{ animationDelay: "210ms" }}>
                  <Link href={a.href} className="btn-arrow cursor-target">
                    Open project
                    <Arrow className="h-2.5 w-6" />
                  </Link>
                  {a.built ? (
                    <button
                      type="button"
                      onClick={() => setFilm(a.built!)}
                      className="cursor-target inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-text"
                    >
                      <span aria-hidden="true">▶</span> Play the film · {a.built.video.filmLength}
                    </button>
                  ) : (
                    <span className="flex items-baseline gap-2">
                      <span className="font-display text-xl tracking-[-0.03em] text-[var(--acc)]">{a.stat.value}</span>
                      <span className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">{a.stat.label}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* right: the stage */}
            <div className="relative">
              <div className="[perspective:1400px]" onPointerMove={onTilt} onPointerLeave={() => setTilt({ x: 0, y: 0 })}>
                <Link
                  href={a.href}
                  aria-label={`Open ${a.name}`}
                  className="cursor-target group/stage relative block aspect-[16/10] rounded-[24px] transition-transform duration-700 ease-out"
                  style={{ transform: `rotateY(${(-9 + tilt.x * 5).toFixed(2)}deg) rotateX(${(3 - tilt.y * 4).toFixed(2)}deg)` }}
                >
                  {ACTS.map((x, i) => {
                    const on = i === active;
                    const layer = (
                      <div
                        className={`absolute inset-0 overflow-hidden rounded-[24px] border border-white/15 bg-[#0b0b0b] transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.8,.2,1)] ${
                          on ? "translate-x-0 scale-100 opacity-100" : i < active ? "-translate-x-[10%] scale-95 opacity-0" : "translate-x-[10%] scale-95 opacity-0"
                        }`}
                        style={{ boxShadow: on ? `0 40px 80px rgb(0 0 0 / .55), 0 0 80px rgb(${x.accent.rgb} / .2)` : "none" }}
                      >
                        <Visual a={x} active={on} />
                      </div>
                    );
                    return x.built ? (
                      <Morph key={x.id} name={`film-${x.id}`} on={desktop === true}>
                        {layer}
                      </Morph>
                    ) : (
                      <div key={x.id}>{layer}</div>
                    );
                  })}
                  <span className="absolute right-4 bottom-4 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-medium text-black opacity-0 shadow-lg transition-opacity duration-300 group-hover/stage:opacity-100 group-focus-visible/stage:opacity-100">
                    Open project <Arrow className="h-2.5 w-5" />
                  </span>
                </Link>
              </div>

              {/* the four, and how far through we are */}
              <div className="mt-[min(2rem,4svh)] flex items-end gap-6">
                <ol className="grid flex-1 grid-cols-4 gap-2">
                  {ACTS.map((x, i) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => jump(i)} aria-label={`Show ${x.name}`} aria-current={i === active} className="cursor-target group block w-full text-left">
                        <span className="block font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">{i === 0 ? "Built" : i === 2 ? "Master's" : " "}</span>
                        <span className="relative mt-1.5 block h-[3px] overflow-hidden rounded-full bg-line">
                          {/* inline transform only: Tailwind's scale-x-0 sets `scale`, which would multiply it to zero */}
                          <span
                            ref={(el) => {
                              fillRefs.current[i] = el;
                            }}
                            className="absolute inset-0 origin-left rounded-full"
                            style={{ transform: "scaleX(0)", background: x.accent.dark }}
                          />
                        </span>
                        <span className={`mt-2 block truncate font-mono text-[10px] tracking-[0.14em] uppercase transition-colors ${i === active ? "text-text" : "text-faint group-hover:text-muted"}`}>
                          {x.short}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                {/* next, waiting in the wings */}
                <button type="button" onClick={() => jump((active + 1) % ACTS.length)} className="cursor-target group flex shrink-0 items-center gap-3 text-right" aria-label={`Next: ${next.name}`}>
                  <span>
                    <span className="block font-mono text-[9.5px] tracking-[0.14em] text-faint uppercase">{active === ACTS.length - 1 ? "Back to" : "Next"}</span>
                    <span className="block font-mono text-[10.5px] tracking-[0.14em] text-text uppercase">{next.short}</span>
                  </span>
                  <span className="relative block h-12 w-20 overflow-hidden rounded-lg border border-white/15 opacity-70 transition-opacity group-hover:opacity-100">
                    {ACTS.map((x) => (
                      <span key={x.id} className={`absolute inset-0 transition-opacity duration-500 ${x.id === next.id ? "opacity-100" : "opacity-0"}`}>
                        {x.built ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={x.built.video.loopPoster} alt="" className="size-full object-cover" />
                        ) : x.id === "behrouz-biryani" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src="/projects/behrouz-biryani/closed.jpg" alt="" className="size-full object-cover" />
                        ) : (
                          <span className="block size-full bg-[#070a14] bg-[radial-gradient(circle_at_70%_50%,rgb(122_162_255/.45),transparent_60%)]" />
                        )}
                      </span>
                    ))}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── phones: the four as stacked cards ───────── */}
      <div className="mx-auto grid max-w-7xl gap-5 px-4 pb-24 sm:px-6 md:hidden">
        {ACTS.map((x, i) => (
          <article key={x.id} className="glass overflow-hidden rounded-3xl" style={{ "--acc": x.accent.dark } as CSSProperties}>
            <Link href={x.href} className="cursor-target block" aria-label={`Open ${x.name}`}>
              {x.built ? (
                <Morph name={`film-${x.id}`} on={desktop === false}>
                  <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0b0b]">
                    <Visual a={x} active={desktop === false} />
                  </div>
                </Morph>
              ) : (
                <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0b0b]">
                  <Visual a={x} active={desktop === false} />
                </div>
              )}
            </Link>
            <div className="p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-3xl tracking-[-0.05em] text-transparent" style={{ WebkitTextStroke: `1px ${x.accent.dark}` }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">{x.group}</span>
              </div>
              <div className="mt-3">
                <Pills a={x} />
              </div>
              <h3 className="mt-4 text-[2rem] leading-[0.95] tracking-[-0.04em]">{x.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{x.line}</p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <Link href={x.href} className="btn-arrow cursor-target">
                  Open project
                  <Arrow className="h-2.5 w-6" />
                </Link>
                <span className="flex items-baseline gap-2">
                  <span className="font-display text-lg text-[var(--acc)]">{x.stat.value}</span>
                  <span className="max-w-[9rem] font-mono text-[9.5px] leading-snug tracking-[0.12em] text-faint uppercase">{x.stat.label}</span>
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>

      {film && <FilmDialog open onClose={() => setFilm(null)} p={film} />}
    </section>
  );
}
