"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import SectionHeading from "@/components/SectionHeading";
import { createConstellation, type ConStop, type Track } from "@/components/journey/constellation";
import { education, experience, profile, skills } from "@/data/resume";
import { useTuck } from "@/hooks/useTuck";

const support = experience[1];
const apm = experience[0];
const mgb = education[0];
const bba = education[1];

type Stop = {
  year: string;
  short: string;
  title: string;
  org: string;
  period: string;
  track: Track;
  stats: [string, string][];
  points: string[];
  link?: { href: string; label: string };
  skills?: boolean;
};

/** The five stops, in order. Every figure is from the resume. */
const STOPS: Stop[] = [
  {
    year: "2016",
    short: "Business school",
    title: bba.degree,
    org: `${bba.school} · ${bba.place}`,
    period: bba.period,
    track: "study",
    stats: [
      ["2016–19", "Bachelor's, three years"],
      [bba.school, bba.place],
    ],
    points: [],
  },
  {
    year: "2020",
    short: "Support desk",
    title: support.title,
    org: `${support.company} · ${support.place}`,
    period: support.period,
    track: "growth",
    stats: [
      ["16", "person support team"],
      ["89–90%", "CSAT, vs 78–85% benchmark"],
      ["90%", "tickets solved within 6 hours"],
      ["+40%", "agent productivity"],
    ],
    points: support.points,
  },
  {
    year: "2023",
    short: "Product",
    title: apm.title,
    org: `${apm.company} · ${apm.place}`,
    period: apm.period,
    track: "ai",
    stats: [
      ["6", "products shipped"],
      ["₹4M", "a month from AI-Convert"],
      ["+30%", "agent productivity, CRM"],
      ["+10–15%", "successful transactions"],
    ],
    points: apm.points,
  },
  {
    year: "2025",
    short: "Strategy",
    title: mgb.degree,
    org: `${mgb.school} · ${mgb.place}`,
    period: mgb.period,
    track: "ai",
    stats: [
      ["3", "campuses: Singapore, London, Dubai"],
      ["2", "course projects"],
    ],
    points: [`${mgb.detail}.`, "A FinTech adoption study across India and Dubai.", "A strategy brief for Rebel Foods in the UAE."],
    link: { href: "/#projects", label: "See the projects" },
  },
  {
    year: "Now",
    short: profile.location,
    title: profile.title,
    org: `Based in ${profile.location} · Open to product roles`,
    period: "Now",
    track: "ai",
    stats: [],
    points: [],
    skills: true,
  },
];
const N = STOPS.length;

/** What the canvas draws round each star: its figures, or the toolkit's groups (with their skills) on the last. */
const CON: ConStop[] = STOPS.map((s) => ({
  year: s.year,
  short: s.short,
  track: s.track,
  sats: s.skills ? skills.map((g) => ({ b: g.group, s: `${g.items.length} skills`, sub: g.items })) : s.stats.map(([b, t]) => ({ b, s: t })),
}));

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
/** Scroll progress 0…1 → a place on the route that rests flat on each star for a while (0 … N-1). */
const restPos = (p: number) => {
  const u = clamp(p, 0, 1) * (N - 1);
  const k = Math.min(N - 2, Math.floor(u));
  return k + ease((u - k - 0.15) / 0.7);
};
const trackLabel: Record<Track, string> = { ai: "AI · Product", growth: "Growth · Ops", study: "Study" };

function StopCard({ s }: { s: Stop }) {
  return (
    <div className="cn-in">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-[11px] tracking-[0.12em] text-faint uppercase">{s.period}</span>
        <span className={`cn-tag cn-${s.track}`}>{trackLabel[s.track]}</span>
      </div>
      <h3 className="mt-3 font-display text-[clamp(1.4rem,2.3vw,2.35rem)] leading-[0.95] tracking-[-0.035em] uppercase">{s.title}</h3>
      <p className="mt-2 text-sm text-muted">{s.org}</p>
      {s.stats.length > 0 && (
        <dl className="cn-stats">
          {s.stats.map(([b, t]) => (
            <div key={b}>
              <dt className={`cn-${s.track}`}>{b}</dt>
              <dd>{t}</dd>
            </div>
          ))}
        </dl>
      )}
      {s.points.length > 0 && (
        <ul className="cn-points">
          {s.points.slice(0, 3).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {s.skills && (
        <ul className="cn-skills">
          {skills.flatMap((g) => g.items).map((it) => (
            <li key={it}>{it}</li>
          ))}
        </ul>
      )}
      {s.link && (
        <a href={s.link.href} className="cursor-target mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-text uppercase hover:text-ai">
          {s.link.label} <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}

/**
 * Journey as a constellation (components/journey/constellation.ts). The section pins while the scroll
 * flies a comet along the route from star to star: 2016, 2020, 2023, 2025 and now. Each star's figures
 * orbit it; the card beside the chart tells the chapter in full. Arrow keys glide to the next star.
 * The chrome object stays away (data-shape="none"): the section brings its own sky.
 */
export default function Journey() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chapRef = useRef<HTMLSpanElement>(null);
  const legRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const stepRef = useRef<(d: number) => void>(() => {});
  const [active, setActive] = useState(0);
  // the readout and the card start a step below the heading, not a screen-centring further down
  useTuck(pinRef, stageRef);

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !pin || !stage || !canvas) return;
    const con = createConstellation(canvas, CON);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const layout = () => con.resize(stage.clientWidth, stage.clientHeight);
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    const onTheme = () => con.theme();
    window.addEventListener("themechange", onTheme);

    const progress = () => {
      const r = pin.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
    };
    const yOf = (s: number) => {
      const r = pin.getBoundingClientRect();
      return r.top + window.scrollY + (clamp(s, 0, N - 1) / (N - 1)) * (r.height - window.innerHeight);
    };
    stepRef.current = (d: number) => {
      const y = yOf(Math.round(restPos(progress())) + d);
      const l = (window as unknown as { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;
      if (l) l.scrollTo(y, { duration: 1.4 });
      else window.scrollTo({ top: y, behavior: reduced ? "instant" : "smooth" });
    };

    // the cursor's pull on the view, and what it's over
    let hover: { x: number; y: number } | null = null;
    const lean = { x: 0, y: 0, tx: 0, ty: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = stage.getBoundingClientRect();
      hover = { x: e.clientX - r.left, y: e.clientY - r.top };
      lean.tx = hover.x / r.width - 0.5;
      lean.ty = hover.y / r.height - 0.5;
    };
    const onLeave = () => {
      hover = null;
      lean.tx = lean.ty = 0;
    };
    if (fine) {
      stage.addEventListener("pointermove", onMove);
      stage.addEventListener("pointerleave", onLeave);
    }

    let x = NaN;
    let raf = 0;
    let last = performance.now();
    let near = false;
    let shown = -1;
    let chap = "";
    let leg = "";
    // at rest on a star (nothing travelling, no cursor moving, the arrival over) the slow orbits and
    // twinkle don't need every frame: the chart is redrawn on every other one
    let calmSince = 0;
    let wasSettled = false;
    let skip = false;
    let acc = 0;
    let lastHover: { x: number; y: number } | null = null;
    const tick = (now: number) => {
      raf = 0;
      if (!near || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = restPos(progress());
      if (Number.isNaN(x) || reduced) x = reduced ? Math.round(target) : target;
      else x += (target - x) * (1 - Math.exp(-3.2 * dt));
      if (!reduced) {
        lean.x += (lean.tx - lean.x) * (1 - Math.exp(-2.5 * dt));
        lean.y += (lean.ty - lean.y) * (1 - Math.exp(-2.5 * dt));
      }
      const moving = Math.abs(target - x) > 0.0008 || Math.abs(lean.tx - lean.x) > 0.002 || Math.abs(lean.ty - lean.y) > 0.002 || hover !== lastHover;
      lastHover = hover;
      if (moving || !wasSettled) calmSince = now;
      acc += dt;
      if (now - calmSince > 1800) {
        skip = !skip;
        if (skip) {
          raf = requestAnimationFrame(tick);
          return;
        }
      }
      const out = con.frame({ x, dt: Math.min(0.05, acc), now, lean: { x: lean.x, y: lean.y }, hover, reduced });
      acc = 0;
      wasSettled = out.settled;
      canvas.style.cursor = out.hit ? "pointer" : "";
      if (out.at !== shown) {
        shown = out.at;
        setActive(out.at);
        // the page's light follows the chapter: blue for AI, chrome for growth
        const tr = STOPS[out.at].track;
        section.dataset.grade = tr === "ai" ? "ai" : tr === "growth" ? "growth" : "";
      }
      const s = STOPS[out.at];
      const k = Math.min(N - 2, Math.floor(x));
      const c = `Chapter ${String(out.at + 1).padStart(2, "0")} / ${String(N).padStart(2, "0")} · ${s.short}`;
      const l = out.settled ? `${s.year} · arrived` : `In transit · ${STOPS[k].year} → ${STOPS[k + 1].year.toLowerCase()}`;
      if (c !== chap && chapRef.current) chapRef.current.textContent = chap = c;
      if (l !== leg && legRef.current) legRef.current.textContent = leg = l;
      if (barRef.current) barRef.current.style.transform = `scaleX(${(x / (N - 1)).toFixed(4)})`;
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!raf && near && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    // draws only while the chart is on (or about to come on) screen
    const io = new IntersectionObserver(
      ([en]) => {
        near = en.isIntersecting;
        run();
      },
      { rootMargin: "160px 0px" },
    );
    io.observe(pin);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      window.removeEventListener("themechange", onTheme);
      document.removeEventListener("visibilitychange", run);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    stepRef.current(d);
  };

  return (
    <section ref={sectionRef} id="journey" data-shape="none" data-pose="deep" data-chapter="Journey" data-chapter-no="05" className="relative">
      {/* drawn above the stage tucked up under it (useTuck) */}
      <div className="pointer-events-none relative z-10 mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="05"
          eyebrow="Journey"
          title="Support desk to strategy."
          intro="Three years in customer support, two-plus as a PM, and now a Master's in Global Business. Keep scrolling to fly the route, star by star."
        />
      </div>

      {/* the whole route, for screen readers and anyone not scrolling through */}
      <ol className="sr-only">
        {STOPS.map((s) => (
          <li key={s.year}>
            {s.year}: {s.title}, {s.org}, {s.period}. {s.stats.map(([b, t]) => `${b} ${t}`).join("; ")}. {s.points.join(" ")}
            {s.skills ? ` Toolkit: ${skills.flatMap((g) => g.items).join(", ")}.` : ""}
          </li>
        ))}
      </ol>

      {/* pinned while the comet flies the route: about one screen of scroll per leg */}
      <div ref={pinRef} className="relative" style={{ height: `calc(100svh + ${N - 1} * 90svh)` }}>
        <div
          ref={stageRef}
          className="cn-stage sticky top-0 h-[100svh] overflow-hidden"
          role="region"
          aria-label="Journey, charted as a constellation. Scroll, or use the arrow keys, to travel between the milestones."
          tabIndex={0}
          onKeyDown={onKey}
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          <div className="cn-hud" data-tuck="" aria-hidden="true">
            <span ref={chapRef} className="cn-chap">
              Chapter 01 / 05 · {STOPS[0].short}
            </span>
            <span ref={legRef}>{STOPS[0].year} · arrived</span>
            <i className="cn-bar">
              <em ref={barRef} />
            </i>
          </div>
          <aside className="cn-card" data-tuck="" aria-live="polite">
            <StopCard key={active} s={STOPS[active]} />
          </aside>
        </div>
      </div>
    </section>
  );
}
