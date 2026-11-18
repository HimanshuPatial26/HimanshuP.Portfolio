"use client";

import { ViewTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { Chip, Ring, Roll } from "@/components/Buttons";
import { quietMedia } from "@/components/projects/LoopVideo";
import { EVAL_ROWS, EvalToggle } from "@/components/projects/Interactives";
import type { BuiltProject, Chapter } from "@/data/projects";

/*
 * CallEvals' page, told as a pipeline on a dotted page. The name runs huge across the top; under it
 * the five steps a call goes through and the brand film, looping (muted, with a sound switch). One
 * line flows out of the bottom of the film and draws itself down the page as you scroll, through
 * the chapters as stations. At Product it forks into four branches, one per output, which merge
 * again at Proof (the outputs the eval scored are tagged), and one line carries on to Next. The
 * station the line is on plays its own stretch of footage. Less motion or save-data: the line is
 * drawn, everything is lit and the films rest on their posters.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** what happens to a call in CallEvals (from its stack and the outputs on this page) */
const FLOW = [
  { step: "Upload", what: "A call recording" },
  { step: "Transcribe", what: "faster-whisper · Deepgram" },
  { step: "Extract", what: "Gemini 2.5 Flash: summary, next steps, objections" },
  { step: "Flag", what: "Rule-based coaching flags" },
  { step: "Review", what: "The manager's view, in the React app" },
];
/** the question each station answers */
const ASKS = ["Why it matters", "Where the market is", "What it does", "Does it work", "What comes next"];

const still = (c: Chapter) => `/projects/callevals/ch-${c.id}.jpg`;

/** a path that draws itself up to a height, with a head (and a halo) riding its tip */
function drawnLine(draw: SVGPathElement, base: SVGPathElement | null, head: SVGCircleElement | null, halo: SVGCircleElement | null) {
  let L = 0;
  let len = 0;
  let marks: [number, number][] = [];
  return {
    set(d: string) {
      draw.setAttribute("d", d);
      base?.setAttribute("d", d);
      L = draw.getTotalLength();
      draw.style.strokeDasharray = `${L} ${L}`;
      marks = [];
      for (let s = 0; s <= L; s += 5) marks.push([s, draw.getPointAtLength(s).y]);
      len = Math.min(len, L);
    },
    get ready() {
      return L > 0;
    },
    get drawn() {
      return len;
    },
    /** move the tip toward the furthest point at or above height y (instantly when `jump`) */
    step(y: number, dt: number, now: number, jump = false) {
      let want = 0;
      for (const [s, c] of marks) {
        if (c <= y + 0.5) want = s;
        else break;
      }
      len = jump ? want : len + (want - len) * (1 - Math.exp(-dt * 8));
      draw.style.strokeDashoffset = (L - len).toFixed(1);
      const p = draw.getPointAtLength(len);
      if (head) {
        head.setAttribute("cx", String(p.x));
        head.setAttribute("cy", String(p.y));
        head.style.opacity = len > 2 && len < L - 2 ? "1" : "0";
      }
      if (halo) {
        halo.setAttribute("cx", String(p.x));
        halo.setAttribute("cy", String(p.y));
        halo.setAttribute("r", (12 + Math.sin(now / 300) * 4).toFixed(1));
        halo.style.opacity = len > 2 && len < L - 2 ? ".5" : "0";
      }
      return p;
    },
  };
}

/** a smooth vertical path through points, swinging out (alternately) between them */
function snake(pts: number[][], swing: number, start: number[]) {
  let d = `M ${start[0]} ${start[1]} C ${start[0]} ${start[1] + 120}, ${pts[0][0]} ${pts[0][1] - 160}, ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const sw = (i % 2 ? 1 : -1) * swing;
    const my = (y0 + y1) / 2;
    d += ` C ${x0} ${y0 + (y1 - y0) * 0.3}, ${x0 + sw} ${my - (y1 - y0) * 0.15}, ${x0 + sw} ${my} S ${x1} ${y1 - (y1 - y0) * 0.3}, ${x1} ${y1}`;
  }
  return d;
}

function Frame({ c }: { c: Chapter }) {
  return (
    <div className="cp-frm">
      <video muted playsInline preload="none" poster={still(c)} aria-hidden="true" tabIndex={-1} disablePictureInPicture />
      <span className="cp-live" aria-hidden="true">
        ● {c.media === "log" ? "Builder's log" : "Film"} · live
      </span>
    </div>
  );
}

function Stats({ c }: { c: Chapter }) {
  if (!c.stats) return null;
  return (
    <div className="cp-stats">
      {c.stats.map((s) => (
        <div key={s.label}>
          <b>{s.value.startsWith("~") ? <><span className="cp-approx">~</span>{s.value.slice(1)}</> : s.value}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/** a station with its card on one side of the line and its name, set huge, on the other */
function SideStation({ c, i, side }: { c: Chapter; i: number; side: "l" | "r" }) {
  return (
    <div className={`cp-st ${side}`} id={`ch-${c.id}`} data-i={i}>
      <div className="cp-card">
        <p className="cp-k">
          Station {pad2(i + 1)} · {c.label}
        </p>
        <h2>{c.title}</h2>
        {c.body.map((b) => (
          <p key={b}>{b}</p>
        ))}
        <Frame c={c} />
        <Stats c={c} />
      </div>
      <span className="cp-node" aria-hidden="true">
        {pad2(i + 1)}
      </span>
      <div className="cp-side" aria-hidden="true">
        <p className="cp-lbl">{c.label}</p>
        <p className="cp-sub">{ASKS[i]}</p>
      </div>
    </div>
  );
}

/** a station in the middle of the page: name and question either side of the node, the card under it */
function CentreStation({ c, i, children }: { c: Chapter; i: number; children: ReactNode }) {
  return (
    <div className="cp-st c" id={`ch-${c.id}`} data-i={i}>
      <div className="cp-side a" aria-hidden="true">
        <p className="cp-lbl">{c.label}</p>
      </div>
      <span className="cp-node" aria-hidden="true">
        {pad2(i + 1)}
      </span>
      <div className="cp-side b" aria-hidden="true">
        <p className="cp-sub">{ASKS[i]}</p>
      </div>
      <div className="cp-card">
        <p className="cp-k">
          Station {pad2(i + 1)} · {c.label}
        </p>
        <h2>{c.title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function CallEvalsPipeline({ p, index, total }: { p: BuiltProject; index: number; total: number }) {
  const [problem, gap, product, proof, next] = p.chapters;
  const outputs = product.list ?? [];
  const bodyRef = useRef<HTMLElement>(null);
  const filmRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const mainBaseRef = useRef<SVGPathElement>(null);
  const mainDrawRef = useRef<SVGPathElement>(null);
  const tailBaseRef = useRef<SVGPathElement>(null);
  const tailDrawRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const head2Ref = useRef<SVGCircleElement>(null);
  const brBaseRef = useRef<(SVGPathElement | null)[]>([]);
  const brDrawRef = useRef<(SVGPathElement | null)[]>([]);
  const brHeadRef = useRef<(SVGCircleElement | null)[]>([]);
  const [sound, setSound] = useState(false);

  // the brand film: muted and looping while it's on screen; the switch turns the sound on from the top
  useEffect(() => {
    const v = filmRef.current;
    if (!v) return;
    const quiet = quietMedia();
    let seen = false;
    const sync = () => {
      if (seen && document.visibilityState === "visible" && (!quiet || !v.muted)) v.play().catch(() => {});
      else if (!v.paused) v.pause();
    };
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      sync();
    }, { threshold: 0.2 });
    io.observe(v);
    const onTime = () => {
      if (barRef.current) barRef.current.style.transform = `scaleX(${(v.currentTime / (v.duration || 24)).toFixed(4)})`;
      if (timeRef.current) timeRef.current.textContent = `0:${pad2(Math.floor(v.currentTime))} / ${p.video.filmLength}`;
    };
    v.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      v.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [p.video.filmLength]);

  const toggleSound = () => {
    const v = filmRef.current;
    if (!v) return;
    const on = v.muted;
    v.muted = !on;
    if (on) v.currentTime = 0;
    v.play().catch(() => {});
    setSound(on);
  };

  // the line, the fork, the stations lighting up and their footage
  useEffect(() => {
    const body = bodyRef.current;
    const mainDraw = mainDrawRef.current;
    const tailDraw = tailDrawRef.current;
    if (!body || !mainDraw || !tailDraw) return;
    const quiet = quietMedia();
    const main = drawnLine(mainDraw, mainBaseRef.current, headRef.current, haloRef.current);
    const tail = drawnLine(tailDraw, tailBaseRef.current, head2Ref.current, null);
    const branches = outputs.map((_, j) => {
      const d = brDrawRef.current[j];
      return d ? drawnLine(d, brBaseRef.current[j], brHeadRef.current[j], null) : null;
    });
    const stations = [...body.querySelectorAll<HTMLElement>(".cp-st")];
    const outs = [...body.querySelectorAll<HTMLElement>(".cp-out")];
    const film = body.querySelector<HTMLElement>(".cp-bf");
    let tailStart = Infinity;

    const build = () => {
      const br = body.getBoundingClientRect();
      if (!br.width || !film) return;
      const at = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - br.left, y: r.top + r.height / 2 - br.top, top: r.top - br.top, bottom: r.bottom - br.top };
      };
      const f = at(film);
      const n = stations.map((s) => at(s.querySelector(".cp-node")!));
      const narrow = br.width < 860;
      const hero = at(body.querySelector(".cp-hero")!);
      main.set(snake([n[0], n[1], n[2]].map((q) => [q.x, q.y]), narrow ? 0 : Math.min(br.width * 0.22, 260), narrow ? [n[0].x, hero.bottom + 12] : [f.x, f.bottom]));
      // the branches leave from under Product's card and meet at Proof's node
      const pc = at(stations[2].querySelector(".cp-card")!);
      const [px, py] = [pc.x, pc.bottom - 2];
      const [qx, qy] = [n[3].x, n[3].y];
      outs.forEach((o, j) => {
        const d = at(o.querySelector(".cp-dot")!);
        branches[j]?.set(`M ${px} ${py} C ${px} ${py + 120}, ${d.x} ${d.y - 140}, ${d.x} ${d.y} S ${qx} ${qy - 160}, ${qx} ${qy}`);
      });
      const qc = at(stations[3].querySelector(".cp-card")!);
      tailStart = qc.bottom - 2;
      tail.set(`M ${qc.x} ${tailStart} C ${qc.x} ${tailStart + 160}, ${n[4].x} ${n[4].y - 180}, ${n[4].x} ${n[4].y} C ${n[4].x} ${n[4].y + 220}, ${qc.x} ${br.height - 220}, ${qc.x} ${br.height}`);
    };

    // footage: the station the line is on plays its own stretch of the film or the builder's log
    const vids = stations.map((s) => s.querySelector<HTMLVideoElement>(".cp-frm video"));
    let live = -1;
    const play = (i: number) => {
      vids.forEach((v, j) => j !== i && v && !v.paused && v.pause());
      const v = vids[i];
      const c = p.chapters[i];
      if (!v || !c || quiet) return;
      if (!v.getAttribute("src")) v.src = c.media === "log" ? p.video.log ?? p.video.scrub : p.video.scrub;
      try {
        v.currentTime = c.at[0];
      } catch {}
      v.play().catch(() => {});
    };

    let raf = 0;
    let last = 0;
    let running = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!main.ready) build();
      if (!main.ready) return;
      const br = body.getBoundingClientRect();
      const y = quiet ? Infinity : window.innerHeight * 0.68 - br.top;
      const p1 = main.step(y, dt, now, quiet);
      let yb = 0;
      branches.forEach((b) => {
        if (!b) return;
        const q = b.step(y, dt, now, quiet);
        if (b.drawn > 2) yb = Math.max(yb, q.y);
      });
      const p2 = tail.step(y, dt, now, quiet);
      const reach = Math.max(p1.y, yb, y > tailStart + 2 ? p2.y : 0);
      let lit = -1;
      stations.forEach((s, i) => {
        const r = s.querySelector(".cp-node")!.getBoundingClientRect();
        const on = r.top + r.height / 2 - br.top <= reach + 4;
        if (s.classList.contains("lit") !== on) s.classList.toggle("lit", on);
        if (on) lit = i;
      });
      outs.forEach((o) => {
        const r = o.querySelector(".cp-dot")!.getBoundingClientRect();
        const on = r.top + r.height / 2 - br.top <= yb + 4;
        if (o.classList.contains("lit") !== on) o.classList.toggle("lit", on);
      });
      if (lit !== live) {
        live = lit;
        stations.forEach((s, i) => s.classList.toggle("now", i === lit && !quiet));
        play(lit);
      }
      // keep the live footage inside its chapter's stretch
      const v = vids[live];
      const c = p.chapters[live];
      if (v && c && !v.paused && (v.currentTime >= c.at[1] || v.currentTime < c.at[0] - 0.5)) v.currentTime = c.at[0];
    };

    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !running) {
          running = true;
          last = 0;
          raf = requestAnimationFrame(tick);
        } else if (!e.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(raf);
          vids.forEach((v) => v && !v.paused && v.pause());
          live = -2;
        }
      },
      { rootMargin: "20% 0px" },
    );
    io.observe(body);
    const ro = new ResizeObserver(() => requestAnimationFrame(build));
    ro.observe(body);
    document.fonts?.ready.then(() => requestAnimationFrame(build));
    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      vids.forEach((v) => v?.pause());
    };
    // the refs are stable; the chapters and films come with the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  return (
    <>
      <section ref={bodyRef} className="cp-body" aria-label={`${p.name}, as a pipeline`}>
        <svg className="cp-svg" aria-hidden="true">
          <path ref={mainBaseRef} className="cp-base" />
          <path ref={mainDrawRef} className="cp-draw" />
          {outputs.map((o, j) => (
            <g key={o.label} className={`cp-o${j + 1}`}>
              <path ref={(el) => void (brBaseRef.current[j] = el)} className="cp-base" />
              <path ref={(el) => void (brDrawRef.current[j] = el)} className="cp-br" />
              <circle ref={(el) => void (brHeadRef.current[j] = el)} className="cp-bh" r="5" />
            </g>
          ))}
          <path ref={tailBaseRef} className="cp-base" />
          <path ref={tailDrawRef} className="cp-draw" />
          <circle ref={haloRef} className="cp-halo" r="16" />
          <circle ref={headRef} className="cp-head" r="6" />
          <circle ref={head2Ref} className="cp-head" r="6" />
        </svg>

        <header className="cp-hero">
          <div className="rise-in flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* plain <a>: RouteTransition takes it back to the list */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/#projects" className="link-roll cursor-target">
              <Ring dir="w" />
              <Roll text="All projects" />
            </a>
            <span className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">
              04 / Projects · Built {pad2(index + 1)} of {pad2(total)}
            </span>
            <span className="flex gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--acc)]/60 px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-[var(--acc)] uppercase">
                <span aria-hidden="true" className="flex gap-0.5">
                  <span className="size-1.5 rounded-full bg-current" />
                  <span className="size-1.5 rounded-full bg-current" />
                </span>
                {p.status}
              </span>
              <span className="rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">{p.year}</span>
            </span>
          </div>

          <h1 className="cp-name rise-in" style={{ animationDelay: "80ms" }}>
            {p.name}
          </h1>

          <div className="cp-row">
            <div className="rise-in" style={{ animationDelay: "160ms" }}>
              <p className="cp-tl">
                {p.tagline} {p.line}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {p.links.map((l, i) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={i === 0 ? "btn btn-primary cursor-target" : "btn btn-line cursor-target"}>
                    <Roll text={l.label} />
                    {i === 0 && <Chip dir="ne" />}
                  </a>
                ))}
              </div>
              <div className="cp-mini">
                <span className="cp-pk" aria-hidden="true" />
                <ol aria-label="What happens to a call">
                {FLOW.map((f, i) => (
                  <li key={f.step}>
                    <i aria-hidden="true">{pad2(i + 1)}</i>
                    <b>{f.step}</b>
                    <span>{f.what}</span>
                  </li>
                ))}
                </ol>
              </div>
            </div>

            <div className="cp-film rise-in" style={{ animationDelay: "220ms" }}>
              <ViewTransition name={`film-${p.slug}`} share="morph" default="none">
                <div className="cp-bf">
                  <video
                    ref={filmRef}
                    src={p.video.film}
                    poster={`/projects/${p.slug}/poster.jpg`}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    disablePictureInPicture
                    aria-label={`${p.name}: the brand film, ${p.video.filmLength}`}
                  />
                  <span className="cp-bf-tag" aria-hidden="true">
                    <i />
                    Brand film · on loop
                  </span>
                  <div className="cp-bf-ui">
                    <button type="button" onClick={toggleSound} aria-pressed={sound} className={`cp-snd cursor-target ${sound ? "on" : ""}`}>
                      {sound ? "Sound on" : "Sound off"}
                    </button>
                    <span className="cp-bar" aria-hidden="true">
                      <i ref={barRef} />
                    </span>
                    <span ref={timeRef} className="cp-time" aria-hidden="true">
                      0:00 / {p.video.filmLength}
                    </span>
                  </div>
                </div>
              </ViewTransition>
              <p className="cp-cap">
                <span>The brand film · {p.video.filmLength}</span>
                <span aria-hidden="true">Follow the line ↓</span>
              </p>
            </div>
          </div>
        </header>

        <SideStation c={problem} i={0} side="l" />
        <SideStation c={gap} i={1} side="r" />
        <CentreStation c={product} i={2}>
          <p>{product.body[0]}</p>
          <Frame c={product} />
        </CentreStation>

        <ul className="cp-fork" aria-label={product.listTitle ?? "What it returns"}>
          {outputs.map((o, j) => {
            const scored = EVAL_ROWS.find((r) => r.label === o.label);
            return (
              <li key={o.label} className={`cp-out cp-o${j + 1}`}>
                <span className="cp-dot" aria-hidden="true" />
                <div className="cp-oc">
                  <p className="cp-oi">Output {pad2(j + 1)}</p>
                  <p className="cp-ob">{o.label}</p>
                  <p className="cp-os">{o.value}</p>
                  {scored ? <span className="cp-tag ev">Evaluated · Run 2 · {scored.r2}% precision</span> : <span className="cp-tag">Not scored in this eval</span>}
                </div>
              </li>
            );
          })}
        </ul>

        <CentreStation c={proof} i={3}>
          {proof.body.map((b) => (
            <p key={b}>{b}</p>
          ))}
          <div className="cp-two">
            <Frame c={proof} />
            <EvalToggle />
          </div>
        </CentreStation>
        <SideStation c={next} i={4} side="l" />
      </section>

      {/* the credits: who it's for, what it ships, the stack and the links */}
      <section aria-label="At a glance" className="cp-credits mx-auto max-w-7xl px-4 sm:px-6">
        <dl className="grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {p.facts.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">{f.label}</dt>
              <dd className="mt-2 text-[15px] leading-snug">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
          <ul className="flex flex-wrap gap-2">
            {p.stack.map((s) => (
              <li key={s} className="rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
                {s}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            {p.links.map((l, i) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={i === 0 ? "btn btn-primary cursor-target" : "btn btn-line cursor-target"}>
                <Roll text={l.label} />
                {i === 0 && <Chip dir="ne" />}
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
