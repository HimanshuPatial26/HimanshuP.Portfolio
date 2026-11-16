"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import SectionHeading from "@/components/SectionHeading";
import { Chip, Ico, Roll } from "@/components/Buttons";
import DecodeText from "@/components/DecodeText";
import { caseStudies, type Track } from "@/data/resume";
import { BOOT_LOCK, LOCK_MS, createRadar, type Blip, type Tone } from "@/components/radar/radar";

const N = caseStudies.length;
const pad = (i: number) => String(i + 1).padStart(2, "0");
/** How long a case stays locked before its live figure takes over from the still. */
const LIVE_AFTER = 1400;

/**
 * Where each case sits on the radar: bearing in degrees (clockwise from the right, seen from
 * above) and range as a share of the radius. AI work fills the left-hand sector and growth work
 * the right; AI-Convert, which did both, sits on the line between them.
 */
const PLOT: Record<string, [number, number]> = {
  "doubt-mate": [188, 0.62],
  "call-analysis": [230, 0.84],
  "ai-convert": [270, 0.5],
  "payment-recovery": [306, 0.8],
  "crm-lms": [340, 0.58],
  "super-coaching": [16, 0.86],
};
const toneOf = (t: Track[]): Tone => (t.length > 1 ? "both" : t[0] === "AI" ? "ai" : "growth");
const BLIPS: Blip[] = caseStudies.map((c, i) => {
  const [bearing, range] = PLOT[c.id] ?? [(i * 60) % 360, 0.7];
  return { bearing, range, tone: toneOf(c.tracks), label: `${pad(i)} ${c.name.toUpperCase()}` };
});
/** The still of a case's live figure: /figures/x.html -> /figures/stills/x.jpg */
const stillOf = (figure?: string) => (figure ? figure.replace(/\/([^/]+)\.html$/, "/stills/$1.jpg") : null);

const trackStyle: Record<Track, string> = {
  AI: "border-ai/50 text-ai",
  Growth: "border-growth/50 text-growth",
};

function Tags({ tracks }: { tracks: Track[] }) {
  return (
    <>
      {tracks.map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase ${trackStyle[t]}`}>
          {t}
        </span>
      ))}
    </>
  );
}

/** A readout value: digits scramble while the lock closes in, then settle. */
function Readout({ value, settled }: { value: string; settled: boolean }) {
  const [noise, setNoise] = useState(value);
  useEffect(() => {
    if (settled) return;
    const id = window.setInterval(() => setNoise(value.replace(/\d/g, () => String(Math.floor(Math.random() * 10)))), 45);
    return () => window.clearInterval(id);
  }, [value, settled]);
  return <b>{settled ? value : noise}</b>;
}

/** The numbers in a result count up from zero once the lock settles; screen readers get the real text. */
function CountUp({ text, run }: { text: string; run: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!run || reduced) {
      el.textContent = run || reduced ? text : " ";
      return;
    }
    const parts = text.split(/(\d+)/);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = parts.map((s, i) => (i % 2 ? String(Math.round(Number(s) * e)) : s)).join("");
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, run]);
  return (
    <>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden="true" />
    </>
  );
}

/** Scroll so case i is on: the middle of its step under the pinned screen. */
function scrollToCase(pin: HTMLElement | null, i: number) {
  if (!pin) return;
  const r = pin.getBoundingClientRect();
  const k = Math.max(0, Math.min(N - 1, i));
  const y = r.top + window.scrollY + ((k + 0.5) / N) * (r.height - window.innerHeight);
  const lenis = (window as unknown as { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;
  if (lenis) lenis.scrollTo(y, { immediate: true });
  else window.scrollTo({ top: y, behavior: "instant" });
}

/**
 * Selected work as a radar. The six cases stand on a holographic table, AI work in one sector and
 * growth work in the other, and the section pins for one short scroll step per case. Arriving boots
 * the radar; each step locks on to the next case, and the readout beside it draws the case in: the
 * name decodes, the figure scans in from its still and then plays live, and the result counts up.
 * Hover a post for a preview, click it (or the numbers, or the arrows, or use the arrow keys) to go
 * straight to it. The radar is drawn in ./radar/radar.ts; the chrome object stays away
 * (data-shape="none") so the 3D scene rests while the radar runs.
 */
export default function Work() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hudRef = useRef<HTMLElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [booted, setBooted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [live, setLive] = useState(false);
  const [liveReady, setLiveReady] = useState("");
  const [peek, setPeek] = useState(-1);

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const hud = hudRef.current;
    const peekEl = peekRef.current;
    if (!section || !pin || !stage || !canvas || !hud || !peekEl) return;
    const radar = createRadar(canvas, BLIPS);
    radar.theme();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const pointer = { x: 0, y: 0, inside: false, lean: fine && !reduced };
    let W = 1;
    let H = 1;
    // once the radar reports nothing moving, it isn't redrawn until something changes (dirty)
    let idle = false;
    let dirty = true;
    const layout = () => {
      const r = stage.getBoundingClientRect();
      W = r.width;
      H = r.height;
      radar.resize(W, H);
      dirty = true;
    };
    layout();
    const ro = new ResizeObserver(layout);
    ro.observe(stage);

    let raf = 0;
    let last = performance.now();
    let near = false;
    let armed = true; // the next arrival boots the radar
    let bootAt = 0;
    let activeNow = -1;
    let lockAt = -1e9;
    let lockedNow = false;
    let liveNow = false;
    let bootedNow = false;
    let hoverNow = -1;

    const tick = (now: number) => {
      raf = 0;
      if (!near || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const vh = window.innerHeight;
      const pr = pin.getBoundingClientRect();
      // arriving (and not hidden behind the chapter card) boots it; leaving re-arms the boot
      const seen = pr.top < vh * 0.4 && pr.bottom > vh * 0.6 && !section.hasAttribute("data-veiled");
      if (seen && armed) {
        armed = false;
        bootAt = now;
        radar.boot(now);
        activeNow = -1;
        dirty = true;
        if (bootedNow) {
          bootedNow = false;
          setBooted(false);
        }
      }
      if (!seen && (pr.top > vh * 0.9 || pr.bottom < vh * 0.1)) armed = true;
      // which case the scroll is on: each gets an equal step, so it switches at once
      const p = Math.min(1, Math.max(0, -pr.top / Math.max(1, pr.height - vh)));
      const want = Math.min(N - 1, Math.floor(p * N));
      if (!armed && (reduced || now - bootAt >= BOOT_LOCK) && want !== activeNow) {
        activeNow = want;
        lockAt = now;
        lockedNow = reduced;
        liveNow = false;
        dirty = true;
        setActive(want);
        setLocked(reduced);
        setLive(false);
        if (!bootedNow) {
          bootedNow = true;
          setBooted(true);
        }
      }
      if (activeNow >= 0 && !lockedNow && now - lockAt >= LOCK_MS) {
        lockedNow = true;
        setLocked(true);
      }
      if (activeNow >= 0 && !liveNow && now - lockAt >= LIVE_AFTER) {
        liveNow = true;
        dirty = true;
        setLive(true);
      }
      // nothing moving on the radar: leave the frame to the live figure
      if (idle && !dirty) {
        raf = requestAnimationFrame(tick);
        return;
      }
      dirty = false;
      // the leader runs to the readout's top-left corner (side by side only, not on phones)
      let anchor: { x: number; y: number } | null = null;
      if (W >= 768 && bootedNow) {
        const h = hud.getBoundingClientRect();
        const s = stage.getBoundingClientRect();
        anchor = { x: h.left - s.left, y: h.top - s.top + 30 };
      }
      // once the live figure has taken over, the beam swings onto the case and holds there
      const out = radar.frame({ now, dt, active: activeNow, lockAt, anchor, reduced, pointer, hold: liveNow });
      idle = out.idle;
      if (out.hover !== hoverNow) {
        hoverNow = out.hover;
        canvas.style.cursor = hoverNow >= 0 ? "pointer" : "";
        setPeek(hoverNow >= 0 && hoverNow !== activeNow ? hoverNow : -1);
      }
      // the preview card rides beside its post
      if (hoverNow >= 0 && hoverNow !== activeNow) {
        const [x, y] = out.tops[hoverNow];
        const w = peekEl.offsetWidth;
        const h = peekEl.offsetHeight;
        const px = Math.min(Math.max(x + 18, 12), W - w - 12);
        const py = Math.min(Math.max(y - h - 18, 80), H - h - 12);
        peekEl.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!raf && near && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    // draw only while the radar is on (or about to come on) screen
    const io = new IntersectionObserver(
      ([e]) => {
        near = e.isIntersecting;
        run();
      },
      { rootMargin: "120px 0px" },
    );
    io.observe(pin);

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
      pointer.inside = e.target === canvas && e.pointerType === "mouse";
      dirty = true;
    };
    const onLeave = () => {
      pointer.inside = false;
      dirty = true;
    };
    const onClick = (e: MouseEvent) => {
      if (e.target !== canvas) return;
      const r = stage.getBoundingClientRect();
      const i = radar.pick(e.clientX - r.left, e.clientY - r.top, fine ? 30 : 44);
      if (i >= 0) scrollToCase(pin, i);
    };
    const onTheme = () => {
      radar.theme();
      dirty = true;
    };
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerleave", onLeave);
    stage.addEventListener("click", onClick);
    window.addEventListener("themechange", onTheme);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerleave", onLeave);
      stage.removeEventListener("click", onClick);
      window.removeEventListener("themechange", onTheme);
      document.removeEventListener("visibilitychange", run);
    };
  }, []);

  const go = (i: number) => scrollToCase(pinRef.current, i);
  // arrow keys step through the cases while focus is in the radar
  const onKey = (e: KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    go(active + dir);
  };

  const c = caseStudies[active];
  const isAI = c.tracks.includes("AI");
  // the page's light follows the case on screen: blue for AI, chrome for growth, neutral for both
  const grade = c.tracks.length > 1 ? "" : isAI ? "ai" : "growth";
  const blip = BLIPS[active];
  const pc = peek >= 0 ? caseStudies[peek] : null;

  return (
    <section
      ref={sectionRef}
      id="work"
      data-shape="none"
      data-pose="deep"
      data-grade={grade}
      data-chapter="Work"
      data-chapter-no="03"
      className="relative"
    >
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="03"
          eyebrow="Selected work"
          title="Six products I shipped."
          intro="Built at Classplus between 2023 and 2025. Three put AI into the product and four moved conversion or revenue. AI-Convert did both."
        />
      </div>

      {/* pinned for one short scroll step per case */}
      <div ref={pinRef} className="relative" style={{ height: `calc(100svh + ${N * 70}svh)` }}>
        <div ref={stageRef} className="radar-stage sticky top-0 h-[100svh] overflow-hidden" onKeyDown={onKey}>
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          <div className="radar-scan" aria-hidden="true" />

          {/* the preview beside a hovered post */}
          <div ref={peekRef} className={`radar-peek ${pc ? "is-on" : ""}`} aria-hidden="true">
            {pc && (
              <>
                <div className="radar-peek-fig">
                  {stillOf(pc.figure) && <Image src={stillOf(pc.figure)!} alt="" fill sizes="200px" className="object-cover" />}
                </div>
                <b>
                  {pad(peek)}&nbsp; {pc.name}
                </b>
                <span className={pc.tracks.includes("AI") ? "text-ai" : "text-growth"}>{pc.resultIsMetric ? pc.result : pc.kind}</span>
              </>
            )}
          </div>

          <nav className="radar-chips radar-mono" aria-label="Case studies">
            {caseStudies.map((cs, i) => (
              <button key={cs.id} type="button" onClick={() => go(i)} aria-label={cs.name} aria-current={i === active ? "true" : undefined} className="cursor-target">
                {pad(i)}
              </button>
            ))}
          </nav>

          {/* the readout */}
          <aside ref={hudRef} className={`radar-hud ${booted ? "is-on" : ""}`} aria-live="polite" aria-label="Selected case">
            <div className="radar-mono flex items-center justify-between text-[11px] tracking-[0.14em] text-ai uppercase">
              <span>{locked ? "◉ Locked" : "◌ Acquiring"}</span>
              <span className="flex gap-2">
                <Tags tracks={c.tracks} />
              </span>
            </div>
            <p className="radar-tgt radar-mono">
              TGT <b>{pad(active)}</b> &nbsp;·&nbsp; BRG <Readout value={String(blip.bearing).padStart(3, "0")} settled={locked} />° &nbsp;·&nbsp; RNG{" "}
              <Readout value={blip.range.toFixed(2)} settled={locked} />
            </p>
            <h3 className="mt-3 font-display text-[clamp(1.6rem,2.3vw,2.35rem)] leading-[0.95] tracking-[-0.03em] uppercase">
              <DecodeText text={c.name} />
            </h3>
            <p className="mt-1.5 text-sm text-muted">{c.kind}</p>

            {/* the panel draws its own figure in behind a scan line; after a moment the live one takes over */}
            <div className="radar-fig mt-4" aria-hidden="true">
              {caseStudies.map((cs, i) => {
                const still = stillOf(cs.figure);
                return still ? (
                  <Image key={cs.id} src={still} alt="" fill sizes="(min-width: 768px) 470px, 92vw" className={`object-cover ${i === active ? "is-on" : ""}`} />
                ) : null;
              })}
              {live && c.figure && (
                <iframe
                  key={c.id}
                  src={c.figure}
                  title={`${c.name}, animated`}
                  tabIndex={-1}
                  className={liveReady === c.id ? "is-on" : ""}
                  onLoad={() => window.setTimeout(() => setLiveReady(c.id), 250)}
                />
              )}
              <i key={`scan-${c.id}`} className="radar-scanline" />
            </div>

            <p className="mt-4 font-mono text-[11px] tracking-widest text-faint uppercase">Result</p>
            <p
              className={`mt-1 ${
                c.resultIsMetric
                  ? `font-display text-[clamp(1.25rem,1.7vw,1.7rem)] leading-tight tracking-tight uppercase ${isAI ? "text-ai" : "text-growth"}`
                  : "text-[15px] leading-snug text-text"
              }`}
            >
              <CountUp text={c.result} run={locked} />
            </p>
            <p className="mt-2 hidden text-sm leading-relaxed text-muted sm:block">{c.problem}</p>

            <div className="mt-5 flex items-center gap-3">
              <a href={`/work/${c.id}`} className="btn btn-primary cursor-target">
                <Roll text="Read the case study" />
                <Chip />
              </a>
              <div className="ml-auto flex gap-2">
                <button type="button" className="radar-step cursor-target" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous case">
                  <Ico dir="w" />
                </button>
                <button type="button" className="radar-step cursor-target" onClick={() => go(active + 1)} disabled={active === N - 1} aria-label="Next case">
                  <Ico dir="e" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
