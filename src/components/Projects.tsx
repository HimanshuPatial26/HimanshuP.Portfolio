"use client";

import { ViewTransition, useEffect, useState, type CSSProperties, type ReactNode, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import LoopVideo from "@/components/projects/LoopVideo";
import { academicProjects, builtProjects, type AcademicProject, type BuiltProject } from "@/data/projects";

type Filter = "all" | "built" | "academic";

type Lenis = { scrollTo: (t: HTMLElement | string, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;

/** Which layout is showing: the desktop preview or the phone cards (null until mounted). */
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
 * The clip that grows into the project page carries a shared view-transition name. Only one
 * element per name may be mounted, so only the layout on screen (preview or phone card) gets it.
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

const pill = "rounded-full border px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] uppercase";

function Arrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 26 10" fill="none" stroke="currentColor" strokeWidth="1.3" className={className} aria-hidden="true">
      <path d="M1 5h23M20 1l4 4-4 4" />
    </svg>
  );
}

/** The academic projects have no film: a drawn figure stands in on the preview. */
function AcademicFigure({ p }: { p: AcademicProject }) {
  if (p.id === "fintech-adoption") {
    const r = 86;
    const c = 2 * Math.PI * r;
    return (
      <svg viewBox="0 0 400 250" className="absolute inset-0 size-full" aria-hidden="true">
        <circle cx="200" cy="125" r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth="3" />
        <circle
          cx="200"
          cy="125"
          r={r}
          fill="none"
          stroke="var(--ai)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * 0.96} ${c}`}
          transform="rotate(-90 200 125)"
          className="proj-ring"
          style={{ "--c": c } as CSSProperties}
        />
        <text x="200" y="134" textAnchor="middle" fill="#f4f4f4" fontSize="34" letterSpacing="-1.5" className="font-display">
          96%
        </text>
        <text x="200" y="156" textAnchor="middle" fill="#8a8a8a" fontSize="8" letterSpacing="1.4" className="font-mono">
          VARIANCE EXPLAINED
        </text>
        <text x="64" y="64" fill="#8a8a8a" fontSize="8.5" letterSpacing="1.4" className="font-mono">
          INDIA × DUBAI
        </text>
        <text x="336" y="196" textAnchor="end" fill="#8a8a8a" fontSize="8.5" letterSpacing="1.4" className="font-mono">
          N = 71 · PLS-SEM
        </text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 400 250" className="absolute inset-0 size-full" aria-hidden="true">
      {[
        { x: 150, label: "PESTLE", on: false },
        { x: 200, label: "CAGE", on: false },
        { x: 250, label: "FIVE FORCES", on: true },
      ].map((l) => (
        <g key={l.label}>
          <circle cx={l.x} cy="118" r="58" fill="none" stroke={l.on ? "var(--ai)" : "rgb(255 255 255 / .35)"} strokeWidth={l.on ? 1.6 : 1} />
          <text x={l.x} y="200" textAnchor="middle" fill={l.on ? "#f4f4f4" : "#8a8a8a"} fontSize="8.5" letterSpacing="1.4" className="font-mono">
            {l.label}
          </text>
        </g>
      ))}
      <text x="200" y="40" textAnchor="middle" fill="#8a8a8a" fontSize="8.5" letterSpacing="1.4" className="font-mono">
        THREE LENSES · ONE BRAND
      </text>
    </svg>
  );
}

/** Built project row: a link into its page. Desktop shows the loop in the preview; phones get it inline. */
function BuiltRow({ p, i, on, onFocus, phone }: { p: BuiltProject; i: number; on: boolean; onFocus: () => void; phone: boolean }) {
  return (
    <li className="relative border-t border-line" style={{ "--acc": p.accent.dark } as CSSProperties}>
      <span aria-hidden="true" className={`absolute -top-px left-0 h-px bg-[var(--acc)] transition-all duration-700 ${on ? "w-full" : "w-0"}`} />
      <Link
        href={`/projects/${p.slug}`}
        onPointerEnter={onFocus}
        onFocus={onFocus}
        className="cursor-target group grid gap-4 py-6 md:grid-cols-[2.75rem_1fr_auto] md:items-center md:gap-3 md:py-7"
      >
        {/* phones: the clip sits in the card */}
        <Morph name={`film-${p.slug}`} on={phone}>
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-line bg-[#0b0b0b] md:hidden">
            <LoopVideo src={p.video.loop} webm={p.video.loopWebm} poster={p.video.loopPoster} className="absolute inset-0 size-full object-cover" />
          </div>
        </Morph>
        <span className={`hidden font-mono text-xs transition-colors md:block ${on ? "text-[var(--acc)]" : "text-faint"}`}>{String(i + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span
            className={`block font-display text-[clamp(2rem,3.6vw,3rem)] leading-none transition-colors duration-500 ${on ? "text-text" : "text-muted group-hover:text-text"}`}
          >
            {p.name}
          </span>
          <span className={`mt-2 block text-sm transition-colors duration-500 ${on ? "text-muted" : "text-faint"}`}>{p.line}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {p.status === "Live" && (
            <span className={`${pill} inline-flex items-center gap-1.5 border-[var(--acc)]/60 text-[var(--acc)]`}>
              <span aria-hidden="true" className="flex gap-0.5">
                <span className="size-1.5 rounded-full bg-current" />
                <span className="size-1.5 rounded-full bg-current" />
              </span>
              Live
            </span>
          )}
          {p.tags
            .filter((t) => t !== "Live app")
            .map((t) => (
              <span key={t} className={`${pill} border-line-strong text-muted`}>
                {t}
              </span>
            ))}
          <Arrow className={`ml-2 hidden h-2.5 w-6 transition-transform duration-500 md:block ${on ? "translate-x-1 text-text" : "text-faint"}`} />
        </span>
      </Link>
    </li>
  );
}

function AcademicRow({ p, i, on, onFocus }: { p: AcademicProject; i: number; on: boolean; onFocus: () => void }) {
  const go = () => {
    const el = document.getElementById(p.id);
    if (!el) return;
    const l = lenis();
    if (l) l.scrollTo(el, { offset: -96, duration: 1.2 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <li className="relative border-t border-line">
      <span aria-hidden="true" className={`absolute -top-px left-0 h-px bg-ai transition-all duration-700 ${on ? "w-full" : "w-0"}`} />
      <button
        type="button"
        onClick={go}
        onPointerEnter={onFocus}
        onFocus={onFocus}
        className="cursor-target group grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-3 py-4 text-left"
      >
        <span className={`font-mono text-xs transition-colors ${on ? "text-ai" : "text-faint"}`}>{String(i + 1).padStart(2, "0")}</span>
        <span className="min-w-0">
          <span className={`block font-display text-[clamp(1.2rem,2vw,1.55rem)] leading-tight transition-colors duration-500 ${on ? "text-text" : "text-muted group-hover:text-text"}`}>
            {p.name}
          </span>
          <span className="mt-1 block text-[13px] text-faint">{p.line}</span>
        </span>
        <span className={`${pill} border-line-strong text-muted`}>{p.kind}</span>
      </button>
    </li>
  );
}

function AcademicCard({ p }: { p: AcademicProject }) {
  return (
    <article id={p.id} className="spin-border glass scroll-mt-28 flex flex-col rounded-3xl p-7 sm:p-9">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] tracking-widest text-faint uppercase">
          {p.kind}
          {p.ongoing ? "" : ` · ${p.period}`}
        </span>
        {p.ongoing && <span className={`${pill} border-ai/60 text-ai`}>Ongoing</span>}
      </div>
      <h3 className="mt-6 text-[clamp(1.6rem,2.6vw,2.1rem)] leading-[1.02]">{p.name}</h3>
      <p className="mt-2 text-sm text-muted">{p.line}</p>
      <dl className="mt-6 border-b border-line text-[15px]">
        {p.facts.map((f) => (
          <div key={f.label} className="grid grid-cols-[5.5rem_1fr] items-baseline gap-3 border-t border-line py-3">
            <dt className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">{f.label}</dt>
            <dd className={f.key ? "text-ai" : "text-text"}>{f.value}</dd>
          </div>
        ))}
      </dl>
      <details className="proj-details group mt-5">
        <summary className="cursor-target inline-flex cursor-pointer list-none items-center gap-2 font-mono text-[11px] tracking-widest text-text uppercase">
          Read the summary
          <Arrow className="h-2.5 w-6 transition-transform duration-300 group-open:rotate-90" />
        </summary>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">{p.summary}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {p.tools.map((t) => (
            <li key={t} className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
              {t}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

/**
 * Projects (chapter 04): the two products built independently lead, each opening into its own
 * film-led page; the two Master's projects follow, lighter. On desktop, hovering a row plays
 * that project's loop in the preview, and clicking grows the clip into the project's page.
 */
export default function Projects() {
  const [filter, setFilter] = useState<Filter>("all");
  const [active, setActive] = useState<string>(builtProjects[0].slug);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const desktop = useDesktop();

  const showBuilt = filter !== "academic";
  const showAcademic = filter !== "built";
  const activeBuilt = builtProjects.find((p) => p.slug === active);
  const activeAcademic = academicProjects.find((p) => p.id === active);
  const accent = activeBuilt?.accent.rgb ?? "58 109 255";

  const onTilt = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 });
  };

  const choose = (f: Filter) => {
    setFilter(f);
    if (f === "academic") setActive(academicProjects[0].id);
    else if (!builtProjects.some((p) => p.slug === active)) setActive(builtProjects[0].slug);
  };

  return (
    <section id="projects" data-shape="none" data-chapter="Projects" data-chapter-no="04" className="relative">
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="04"
          eyebrow="Projects"
          title="Two built. Two studied."
          intro="Two AI products I built on my own, and two projects from my Master's at SP Jain."
        />
        <div role="group" aria-label="Show projects" className="mb-8 inline-flex rounded-full border border-line-strong p-[3px] font-mono text-[11px] tracking-[0.14em] uppercase">
          {(
            [
              ["all", `All · ${builtProjects.length + academicProjects.length}`],
              ["built", `Built · ${builtProjects.length}`],
              ["academic", `Academic · ${academicProjects.length}`],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => choose(f)}
              className={`cursor-target rounded-full px-4 py-2 transition-colors ${filter === f ? "bg-text text-bg" : "text-muted hover:text-text"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:gap-14">
        <div>
          {showBuilt && (
            <div className="swap-in">
              <p className="flex items-center gap-4 font-mono text-[11px] tracking-[0.16em] text-faint uppercase after:h-px after:flex-1 after:bg-line">
                Built on my own
              </p>
              <ol className="mt-3">
                {builtProjects.map((p, i) => (
                  <BuiltRow key={p.slug} p={p} i={i} on={active === p.slug} onFocus={() => setActive(p.slug)} phone={desktop === false} />
                ))}
              </ol>
            </div>
          )}
          {showAcademic && (
            <div className={`swap-in ${showBuilt ? "mt-10" : ""}`}>
              <p className="flex items-center gap-4 font-mono text-[11px] tracking-[0.16em] text-faint uppercase after:h-px after:flex-1 after:bg-line">
                From my Master&apos;s · SP Jain
              </p>
              <ol className="mt-3 border-b border-line">
                {academicProjects.map((p, i) => (
                  <AcademicRow
                    key={p.id}
                    p={p}
                    i={i + (showBuilt ? builtProjects.length : 0)}
                    on={active === p.id}
                    onFocus={() => setActive(p.id)}
                  />
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* the preview (desktop): the hovered project's loop, or a figure for the academic ones */}
        <div className="hidden md:block">
          <div className="sticky top-28">
            <div
              onPointerMove={onTilt}
              onPointerLeave={() => setTilt({ x: 0, y: 0 })}
              className="[perspective:1200px]"
            >
              <div
                className="relative aspect-[16/10] overflow-hidden rounded-[22px] border border-white/15 bg-[#0b0b0b] transition-[transform,box-shadow] duration-500 ease-out"
                style={{
                  transform: `rotateX(${(-tilt.y * 3).toFixed(2)}deg) rotateY(${(tilt.x * 4).toFixed(2)}deg)`,
                  boxShadow: `0 40px 90px rgb(0 0 0 / .55), 0 0 80px rgb(${accent} / .18), 0 0 0 6px rgb(${accent} / .05)`,
                }}
              >
                {builtProjects.map((p) => (
                  <Morph key={p.slug} name={`film-${p.slug}`} on={desktop === true}>
                    <div className={`absolute inset-0 overflow-hidden rounded-[21px] transition-opacity duration-500 ${active === p.slug ? "opacity-100" : "opacity-0"}`}>
                      <LoopVideo
                        src={p.video.loop}
                        webm={p.video.loopWebm}
                        poster={p.video.loopPoster}
                        active={active === p.slug}
                        className="absolute inset-0 size-full object-cover"
                      />
                    </div>
                  </Morph>
                ))}
                {academicProjects.map((p) => (
                  <div key={p.id} className={`absolute inset-0 transition-opacity duration-500 ${active === p.id ? "opacity-100" : "opacity-0"}`}>
                    <div className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.05)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
                    <AcademicFigure p={p} />
                  </div>
                ))}
                {activeBuilt && (
                  <span className="micro absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-white/80 backdrop-blur">
                    <span className="size-1.5 rounded-full" style={{ background: activeBuilt.accent.dark }} />
                    Loop · muted
                  </span>
                )}
              </div>
            </div>
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <p className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">
                {activeBuilt ? "Click to open the project" : "Click to read it below"}
              </p>
              <p className="truncate text-sm text-muted">{activeBuilt?.tagline ?? activeAcademic?.line}</p>
            </div>
          </div>
        </div>
      </div>

      {showAcademic && (
        <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-16 pb-24 sm:px-6 md:grid-cols-2 md:pt-24 md:pb-32">
          {academicProjects.map((p) => (
            <AcademicCard key={p.id} p={p} />
          ))}
        </div>
      )}
      {!showAcademic && <div className="pb-24 md:pb-32" />}
    </section>
  );
}
