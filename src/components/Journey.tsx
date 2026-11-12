"use client";

import { useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import MagneticField from "@/components/MagneticField";
import SectionHeading from "@/components/SectionHeading";
import SpotlightCard from "@/components/reactbits/SpotlightCard";
import { education, experience, skills } from "@/data/resume";
import { useTheme } from "@/hooks/useTheme";

gsap.registerPlugin(ScrollTrigger);

type Panel = {
  mark: string; // big outlined label
  period: string;
  title: string;
  org: string;
  accent: "ai" | "growth";
  points?: string[];
  body?: string;
  tags?: string[];
  wide?: boolean;
  link?: { href: string; label: string };
};

const support = experience[1];
const apm = experience[0];
const mgb = education[0];
const bba = education[1];

const panels: Panel[] = [
  { mark: "2020", period: support.period, title: support.title, org: `${support.company} · ${support.place}`, accent: "growth", points: support.points },
  { mark: "2023", period: apm.period, title: apm.title, org: `${apm.company} · ${apm.place}`, accent: "ai", points: apm.points, wide: true },
  {
    mark: "2025",
    period: mgb.period,
    title: mgb.degree,
    org: `${mgb.school} · ${mgb.place}`,
    accent: "ai",
    body: `${mgb.detail}. Course projects include a FinTech adoption study across India and Dubai, and a strategy brief for Rebel Foods in the UAE.`,
    link: { href: "/#projects", label: "See the projects" },
  },
];

function PanelCard({ p }: { p: Panel }) {
  const { theme } = useTheme();
  const accentText = p.accent === "ai" ? "text-ai" : "text-growth";
  return (
    <SpotlightCard
      theme={theme}
      spotlightColor={p.accent === "ai" ? "rgba(1, 70, 249, 0.2)" : "rgba(255, 255, 255, 0.08)"}
      className={`spin-border cursor-target glass flex h-full flex-col p-7! sm:p-9! ${p.wide ? "md:w-[min(46rem,82vw)]" : "md:w-[min(34rem,78vw)]"}`}
    >
      <p
        aria-hidden="true"
        className={`font-display text-[clamp(4rem,9vw,7.5rem)] leading-[0.8] font-extrabold tracking-[-0.05em] text-transparent [-webkit-text-stroke:1.5px_currentColor] ${accentText} opacity-80`}
      >
        {p.mark}
      </p>
      <p className="mt-6 font-mono text-xs text-faint">{p.period}</p>
      <h3 className="mt-2 text-[clamp(1.4rem,2.4vw,2rem)] leading-tight font-semibold tracking-tight">{p.title}</h3>
      <p className="mt-1 text-sm text-muted">{p.org}</p>
      {p.points && (
        <ul className={`mt-6 grid gap-3 text-sm leading-relaxed text-muted sm:text-[15px] ${p.wide ? "md:grid-cols-2 md:gap-x-8" : ""}`}>
          {p.points.map((pt) => (
            <li key={pt} className="flex gap-3">
              <span className={`mt-2.5 size-1 shrink-0 rounded-full ${p.accent === "ai" ? "bg-ai" : "bg-growth"}`} aria-hidden="true" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      )}
      {p.body && <p className="mt-6 text-sm leading-relaxed text-muted sm:text-[15px]">{p.body}</p>}
      {p.link && (
        <a href={p.link.href} className="cursor-target mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-widest text-text uppercase hover:text-ai">
          {p.link.label} <span aria-hidden="true">→</span>
        </a>
      )}
      {p.tags && (
        <ul className="mt-auto flex flex-wrap gap-2 pt-6">
          {p.tags.map((t) => (
            <li key={t} className="rounded-full bg-white/5 px-3 py-1 text-xs text-muted">
              {t}
            </li>
          ))}
        </ul>
      )}
    </SpotlightCard>
  );
}

function ToolkitCard() {
  return (
    <div className="spin-border cursor-target glass flex h-full flex-col rounded-3xl p-7 sm:p-9 md:w-[min(34rem,78vw)]">
      <p
        aria-hidden="true"
        className="font-display text-[clamp(4rem,9vw,7.5rem)] leading-[0.8] font-extrabold tracking-[-0.05em] text-transparent opacity-80 [-webkit-text-stroke:1.5px_var(--text)]"
      >
        Kit
      </p>
      <h3 className="mt-6 text-[clamp(1.4rem,2.4vw,2rem)] leading-tight font-semibold tracking-tight">Toolkit</h3>
      {/* sweep the mouse through the tags: they scatter and spring back */}
      <MagneticField>
        <dl className="mt-6 space-y-4">
          {skills.map((s, gi) => (
            <div key={s.group}>
              <dt className="mb-2 font-mono text-[11px] tracking-widest text-faint uppercase">{s.group}</dt>
              <dd className="flex flex-wrap gap-2">
                {s.items.map((it) => (
                  <span
                    key={it}
                    data-tag
                    className={`inline-block rounded-full border px-3 py-1 text-sm text-muted will-change-transform ${
                      gi === 1 ? "border-ai/40" : gi === 0 ? "border-growth/40" : "border-line-strong"
                    }`}
                  >
                    {it}
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </MagneticField>
      <p className="mt-auto pt-6 text-sm text-faint">
        {bba.degree}, {bba.school} · {bba.period}
      </p>
    </div>
  );
}

/** Stops on the year dial: one per panel, plus the toolkit. */
const dialStops = [...panels.map((p) => p.mark), "Kit"];
const STEP = 9; // degrees between stops on the dial
const DIAL_R = 700; // px

/**
 * An instrument dial under the timeline: years ride its rim with tick marks
 * between them. As the timeline slides, the dial clicks round one stop at a
 * time with an elastic landing, and the year at the top lights up.
 */
function YearDial({ dialRef }: { dialRef: React.RefObject<HTMLDivElement | null> }) {
  const ticks = (dialStops.length - 1) * 5 + 11;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none relative mx-auto mt-6 hidden h-24 w-full max-w-5xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_22%,black_78%,transparent)] md:block"
    >
      <div
        ref={dialRef}
        className="absolute top-3 rounded-full border border-line-strong"
        style={{ width: DIAL_R * 2, height: DIAL_R * 2, left: `calc(50% - ${DIAL_R}px)` }}
      >
        {Array.from({ length: ticks }, (_, k) => {
          const a = (k - 5) * (STEP / 5);
          const major = (k - 5) % 5 === 0;
          return (
            <span
              key={k}
              className={`absolute top-0 left-1/2 w-px ${major ? "h-3 bg-text/50" : "h-1.5 bg-line-strong"}`}
              style={{ transform: `rotate(${a}deg)`, transformOrigin: `0 ${DIAL_R}px` }}
            />
          );
        })}
        {dialStops.map((label, i) => (
          <span key={label} className="absolute top-0 left-1/2 w-0" style={{ transform: `rotate(${i * STEP}deg)`, transformOrigin: `0 ${DIAL_R}px` }}>
            <span
              data-dial={i}
              className="absolute top-5 left-0 -translate-x-1/2 font-mono text-xs tracking-[0.25em] whitespace-nowrap text-faint transition-[color,opacity] duration-500"
            >
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Journey() {
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const dialRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!pin || !track) return;

    // year dial: light the stop at the top, click round to it with a spring
    let stop = -1;
    const setStop = (i: number) => {
      if (i === stop) return;
      stop = i;
      gsap.to(dialRef.current, { rotation: -i * STEP, duration: 0.9, ease: "elastic.out(1, 0.55)", overwrite: true });
      dialRef.current?.querySelectorAll<HTMLElement>("[data-dial]").forEach((el) => {
        const d = Math.abs(Number(el.dataset.dial) - i);
        el.style.color = d === 0 ? "var(--text)" : "";
        el.style.opacity = d === 0 ? "1" : String(Math.max(0.25, 0.8 - d * 0.22));
      });
    };
    setStop(0);

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => {
      const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${distance()}`,
          scrub: 1,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => setStop(Math.round(self.progress * (dialStops.length - 1))),
        },
      });
      return () => {
        tween.scrollTrigger?.kill();
        tween.kill();
      };
    });

    // layout can shift after fonts and 3D load; keep the pin distance honest
    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("intro:done", refresh);
    document.fonts?.ready.then(refresh);
    return () => {
      window.removeEventListener("intro:done", refresh);
      mm.revert();
    };
  }, []);

  return (
    <section
      id="journey"
      data-shape="Shape_Stairs"
      data-pose="back-right"
      data-grade="ai"
      data-chapter="Journey"
      data-chapter-no="05"
      className="relative"
    >
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="05"
          eyebrow="Journey"
          title="Support desk to strategy."
          intro="Three years in customer support, two-plus as a PM, and now a Master's in Global Business. Keep scrolling and the timeline slides sideways."
        />
      </div>

      <div ref={pinRef} className="relative md:flex md:h-[100svh] md:flex-col md:justify-center md:overflow-hidden">
        <div
          ref={trackRef}
          className="flex flex-col gap-5 px-4 pb-24 sm:px-6 md:w-max md:flex-row md:items-stretch md:gap-6 md:pr-[12vw] md:pb-0 md:pl-[max(1.5rem,calc((100vw-80rem)/2+1.5rem))]"
        >
          {panels.map((p) => (
            <div key={p.mark} className="md:h-[min(40rem,74svh)]">
              <PanelCard p={p} />
            </div>
          ))}
          <div className="md:h-[min(40rem,74svh)]">
            <ToolkitCard />
          </div>
        </div>

        <YearDial dialRef={dialRef} />
      </div>
    </section>
  );
}
