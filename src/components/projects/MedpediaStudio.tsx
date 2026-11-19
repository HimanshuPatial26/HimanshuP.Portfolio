"use client";

import { Instrument_Serif, Inter_Tight } from "next/font/google";
import { ViewTransition, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Chip, Ring, Roll } from "@/components/Buttons";
import { quietMedia } from "@/components/projects/LoopVideo";
import { TONES } from "@/components/projects/Interactives";
import type { BuiltProject } from "@/data/projects";

/*
 * AI Med-pedia's page, as a studio case study on a dotted page. The name huge, the app itself (rebuilt
 * here from the launch film's own interface text) playing the film's exchange, then: the problem struck
 * through as you scroll; the ask and the sources reacting to the scroll; the safety read as three
 * full-screen colour fields that slide over each other; clinical and plain on a slider you drag; one
 * question travelling through the real system (with the chat moving in step, upright on a phone); the
 * film; the credits. A rail on the left marks the chapter. Less motion or save-data: everything rests
 * in its finished state and the films rest on their posters.
 */

const tight = Inter_Tight({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--ms-tight", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--ms-serif", display: "swap" });

type Lenis = { scrollTo: (target: number, opts?: { duration?: number }) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;
const pad2 = (n: number) => String(n).padStart(2, "0");
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const ease = (t: number) => (1 - Math.cos(Math.PI * clamp(t))) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
/** progress through a tall wrapper whose child is sticky: 0 when it pins, 1 when it lets go */
const pinP = (el: Element) => {
  const r = el.getBoundingClientRect();
  return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
};
/** progress of an element across the screen: 0 as its top enters at the bottom, 1 as its bottom leaves at the top */
const seenP = (el: Element) => {
  const r = el.getBoundingClientRect();
  return clamp((window.innerHeight - r.top) / (window.innerHeight + r.height));
};
const glideTo = (y: number) => {
  const l = lenis();
  if (l) l.scrollTo(y, { duration: 1.2 });
  else window.scrollTo({ top: y, behavior: "smooth" });
};

/** the app's own words, read off the launch film */
const UI = {
  header: "Enquiry · 1 exchange",
  models: ["Llama 3.3 70B", "Gemini 2.5 Flash"],
  ask: "What are the warning signs of a heart attack?",
  prompt: "Describe a symptom, or name a medication",
  loading: ["Reading question", "Consulting sources", "Checking safety rules"],
  answer: {
    lead: "Call emergency services right away",
    rest: " if you notice:",
    points: ["Chest pain, pressure or squeezing that lasts more than a few minutes", "Pain spreading to the arm, jaw, neck or back", "Shortness of breath, a cold sweat, nausea or light-headedness"],
    note: "Symptoms can be subtler in women and older adults.",
  },
  callout: "Happening now? Call emergency services immediately.",
  sources: ["Heart attack: symptoms", "Warning signs of a heart attack", "Chest pain: when to call 911"],
  toggles: { sources: "Sources on", clinical: "Clinical detail", plain: "Plain language" },
  plain: { clinical: "Retrosternal pressure radiating to the left arm.", plain: "Chest pressure that spreads to your arm." },
  noise: ["Chest hurts?", "Google it.", "It's always fatal."],
  calm: "Just ask.",
  cards: [
    { tone: "urgent", tag: "Emergency", q: "Warning signs of a heart attack", also: "stroke, high fever, anaphylaxis", note: "Chest pain with sweating or breathlessness? Call emergency services now." },
    { tone: "caution", tag: "Medications", q: "Ibuprofen vs acetaminophen", also: "antihistamines, steroid effects", note: "Stay within daily dose limits — too much acetaminophen can harm the liver." },
    { tone: "steady", tag: "Everyday", q: "Lowering cholesterol naturally", also: "exercise targets, sodium and BP", note: "Diet, fibre and regular exercise are a safe, well-supported first step." },
  ],
};

/** the journey of one question through the system (the parts and their jobs come from the project's own stack) */
const STEPS = [
  { h: "You ask", p: "The chat (Next.js) sends your question to the FastAPI backend.", edge: "ui", dir: 1, nodes: ["ui", "api"], read: ["Question", UI.ask] },
  { h: "It searches your files", p: "Gemini embeddings in Pinecone return the five closest passages from your own documents.", edge: "emb", dir: 2, nodes: ["api", "emb"], read: ["Consulting sources", "the five closest passages from your files"] },
  { h: "And the live web", p: "When sources are on, Tavily adds live web results with their links.", edge: "web", dir: 2, nodes: ["api", "web"], read: ["Consulting sources", "live web results, with links"] },
  { h: "It remembers the thread", p: "Recent messages, plus a running summary every ten, keep the conversation's context.", edge: "mem", dir: 2, nodes: ["api", "mem"], read: ["Context", "recent messages + a running summary"] },
  { h: "The model answers", p: "Llama 3.3 70B on Groq or Gemini 2.5 Flash writes the answer, with its safety read.", edge: "llm", dir: 2, nodes: ["api", "llm"], read: ["Checking safety rules", "Urgent · safety read"] },
  { h: "Streamed back to you", p: "FastAPI streams the answer into the chat as it's written.", edge: "ui", dir: -1, nodes: ["api", "ui"], read: ["Streaming", `${UI.answer.lead}${UI.answer.rest} ${UI.answer.points[0]}`], stream: true },
  { h: "Kept for next time", p: "Supabase keeps the conversation, and every thumbs up or down on an answer.", edge: "db", dir: 1, nodes: ["api", "db"], read: ["Saved", "the conversation · 👍 / 👎"] },
] as const;
const NAME: Record<string, [string, string]> = {
  ui: ["Next.js", "the chat you type into"],
  api: ["FastAPI", "streams the answer"],
  emb: ["Gemini embeddings → Pinecone", "the five closest passages"],
  web: ["Tavily", "live web results, with links"],
  mem: ["Recent messages + summary", "a running summary every ten"],
  llm: ["Llama 3.3 70B · Gemini 2.5 Flash", "on Groq, or Gemini; your pick"],
  db: ["Supabase", "conversations · every 👍 / 👎"],
};
/** the system drawn two ways: wide, and upright for a phone */
const LAY = {
  wide: {
    vb: "0 0 900 500", h: 72, ty: [31, 52], tag: [700, 442, 190],
    nodes: { ui: [20, 220, 170], api: [270, 220, 180], emb: [560, 30, 330], web: [560, 140, 330], mem: [560, 250, 330], llm: [560, 360, 330], db: [270, 420, 180] } as Record<string, number[]>,
    edges: { ui: "M190 256 H270", emb: "M450 244 C510 244 500 66 560 66", web: "M450 250 C510 250 500 176 560 176", mem: "M450 262 C510 262 500 286 560 286", llm: "M450 268 C510 268 500 396 560 396", db: "M360 292 V420" } as Record<string, string>,
  },
  tall: {
    vb: "0 0 360 560", h: 56, ty: [24, 42], tag: [150, 470, 190],
    nodes: { ui: [90, 0, 180], api: [90, 90, 180], emb: [30, 190, 310], web: [30, 262, 310], mem: [30, 334, 310], llm: [30, 406, 310], db: [90, 500, 180] } as Record<string, number[]>,
    edges: { ui: "M180 56 V90", emb: "M180 146 V190", web: "M100 146 V168 H12 V290 H30", mem: "M100 146 V168 H12 V362 H30", llm: "M100 146 V168 H12 V434 H30", db: "M270 118 H352 V528 H270" } as Record<string, string>,
  },
};
const CHAPS = [
  ["prob", "The problem"],
  ["ask", "Ask"],
  ["sources", "Sources"],
  ["safety", "Safety"],
  ["plain", "Plain words"],
  ["hood", "Under the hood"],
  ["film", "The film"],
] as const;

/* ------------------------------------------------------------------ pieces */

/** words that rise out of a mask, line after line, when they come into view (the accent phrase in colour) */
function Rise({ text, em, as: Tag = "span", className = "" }: { text: string; em?: string; as?: "span" | "h1" | "h2" | "h3" | "p"; className?: string }) {
  const parts: [string, boolean][] = em && text.includes(em) ? [[text.slice(0, text.indexOf(em)), false], [em, true], [text.slice(text.indexOf(em) + em.length), false]] : [[text, false]];
  return (
    <Tag className={`ms-rise ${className}`}>
      {parts.map(([s, on], j) => {
        const ws = s.split(/(\s+)/).filter(Boolean).map((w, i) => (/\s/.test(w) ? w : <span key={`${j}-${i}`} className="wm"><span>{w}</span></span>));
        return on ? <em key={`e${j}`}>{ws}</em> : <span key={`s${j}`}>{ws}</span>;
      })}
    </Tag>
  );
}

/** an answer's words, each in its own span so it can stream in */
function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).filter(Boolean).map((w, i) => (/\s/.test(w) ? w : <span key={i} className="w">{w}</span>))}
    </>
  );
}

function Pulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13h4l2-5 4 10 2-6 1.5 1H21" />
    </svg>
  );
}

/** the app's chat, as in the film: the question, the steps it reads through, the tagged answer, the call-out, the sources, the composer */
function AppUI() {
  const A = UI.answer;
  return (
    <div className="ms-app" aria-hidden="true">
      <div className="ms-app-top">
        <span>{UI.header}</span>
        <span className="ms-app-model"><i /><b>{UI.models[0]}</b></span>
      </div>
      <div className="ms-app-body">
        <div className="ms-app-user">{UI.ask}</div>
        <div className="ms-app-load"><i /><span>{UI.loading[0]}</span></div>
        <div className="ms-app-bot">
          <span className="ms-app-ic"><Pulse /></span>
          <div className="ms-app-ans">
            <span className="ms-app-tag">Urgent · safety read</span>
            <div className="ms-app-txt">
              <p><b><Words text={A.lead} /></b><Words text={A.rest} /></p>
              <ul>{A.points.map((x) => <li key={x}><Words text={x} /></li>)}</ul>
              <p className="note"><Words text={A.note} /></p>
            </div>
            <div className="ms-app-call">{UI.callout}</div>
            <div className="ms-app-src">{UI.sources.map((s) => <span key={s}>{s}</span>)}</div>
            <div className="ms-app-fb"><span>▲</span><span>▼</span><span>Copy</span></div>
          </div>
        </div>
      </div>
      <div className="ms-app-comp">
        <div className="ms-app-in"><span className="ph">{UI.prompt}</span></div>
        <div className="ms-app-tg"><span className="on">{UI.toggles.sources}</span><span>{UI.toggles.clinical}</span><span className="send">↑</span></div>
      </div>
    </div>
  );
}

type AppState = { typed?: number; loading?: number; stream?: number; tag?: boolean; call?: boolean; sources?: number; fb?: boolean };
/** drive one app: each setting is written only when it changes */
function appCtl(node: HTMLElement) {
  const q = <T extends Element>(s: string) => node.querySelector<T>(s)!;
  const user = q<HTMLElement>(".ms-app-user"), load = q<HTMLElement>(".ms-app-load"), loadT = q<HTMLElement>(".ms-app-load span"), tag = q<HTMLElement>(".ms-app-tag"), txt = q<HTMLElement>(".ms-app-txt"), call = q<HTMLElement>(".ms-app-call"), fb = q<HTMLElement>(".ms-app-fb"), inp = q<HTMLElement>(".ms-app-in"), bot = q<HTMLElement>(".ms-app-bot");
  const ws = [...node.querySelectorAll<HTMLElement>(".ms-app-txt .w")], src = [...node.querySelectorAll<HTMLElement>(".ms-app-src span")];
  const st: Record<string, number | boolean> = {};
  const put = (k: string, v: number | boolean, f: (v: never) => void) => {
    if (st[k] === v) return;
    st[k] = v;
    f(v as never);
  };
  return {
    set(o: AppState) {
      if (o.typed !== undefined) put("typed", Math.round(clamp(o.typed) * UI.ask.length), (n: number) => {
        const sent = n >= UI.ask.length;
        inp.textContent = "";
        if (sent || n === 0) {
          const ph = document.createElement("span");
          ph.className = "ph";
          ph.textContent = UI.prompt;
          inp.append(ph);
        } else {
          inp.append(UI.ask.slice(0, n));
          const c = document.createElement("i");
          c.className = "caret";
          inp.append(c);
        }
        user.classList.toggle("on", sent);
        bot.style.visibility = sent ? "visible" : "hidden";
      });
      if (o.loading !== undefined) put("loading", o.loading, (i: number) => {
        load.classList.toggle("on", i >= 0);
        if (i >= 0) loadT.textContent = UI.loading[i];
      });
      if (o.stream !== undefined) put("stream", Math.round(clamp(o.stream) * ws.length), (n: number) => {
        ws.forEach((w, j) => w.classList.toggle("on", j < n));
        load.style.display = n > 0 ? "none" : "";
        txt.style.visibility = n > 0 ? "visible" : "hidden";
      });
      if (o.tag !== undefined) put("tag", o.tag, (v: boolean) => tag.classList.toggle("on", v));
      if (o.call !== undefined) put("call", o.call, (v: boolean) => call.classList.toggle("on", v));
      if (o.sources !== undefined) put("sources", o.sources, (n: number) => src.forEach((s, j) => s.classList.toggle("on", j < n)));
      if (o.fb !== undefined) put("fb", o.fb, (v: boolean) => fb.classList.toggle("on", v));
    },
  };
}
/** the app playing the film's exchange on its own, over and over (t in seconds) */
const appPlay = (ctl: ReturnType<typeof appCtl>, t: number) => {
  const k = t % 19;
  ctl.set({ typed: (k - 0.6) / 2.6, loading: k < 3.4 ? -1 : k < 4.2 ? 0 : k < 5 ? 1 : k < 5.8 ? 2 : -1, stream: (k - 5.8) / 3.2, tag: k > 6, call: k > 9.2, sources: k > 9.8 ? Math.min(3, Math.floor((k - 9.8) / 0.35) + 1) : 0, fb: k > 11 });
};
const APP_DONE: AppState = { typed: 1, loading: -1, stream: 1, tag: true, call: true, sources: 3, fb: true };

function Win({ children, h }: { children: ReactNode; h: string }) {
  return (
    <div className="ms-win">
      <div className="ms-win-bar" aria-hidden="true"><i /><i /><i /><span>AI Med-pedia</span></div>
      <div className="ms-win-in" style={{ height: h }}>{children}</div>
    </div>
  );
}

function ToneCard({ c, rot }: { c: (typeof UI.cards)[number]; rot: number }) {
  const t = TONES.find((x) => x.id === c.tone)!;
  return (
    <div className="ms-tcard" style={{ "--t": c.tone === "caution" ? "#8fa2ff" : t.color, "--rot": `${rot}deg` } as CSSProperties}>
      <span className="tg">{c.tag}</span>
      <h4>{c.q}</h4>
      <p className="al">Also: {c.also}</p>
      <p className="nt" style={{ "--t": t.color } as CSSProperties}>{c.note}</p>
    </div>
  );
}

function Diagram({ k }: { k: "wide" | "tall" }) {
  const L = LAY[k];
  return (
    <svg viewBox={L.vb} className={`ms-dia-${k}`} role="img" aria-label="How a question travels through Med-pedia">
      {Object.entries(L.edges).map(([e, d]) => <path key={e} className="ed" data-e={e} d={d} />)}
      {Object.entries(L.nodes).map(([n, [x, y, w]]) => (
        <g key={n} className={`nd${n === "api" ? " hub" : ""}`} data-n={n} transform={`translate(${x} ${y})`}>
          <rect width={w} height={L.h} rx="14" />
          <text x="16" y={L.ty[0]}>{NAME[n][0]}</text>
          <text className="r" x="16" y={L.ty[1]}>{NAME[n][1]}</text>
        </g>
      ))}
      <g className="tagc" transform={`translate(${L.tag[0]} ${L.tag[1]})`}>
        <rect width={L.tag[2]} height="24" rx="12" />
        <text x="14" y="16">URGENT · SAFETY READ</text>
      </g>
      {Array.from({ length: 6 }, (_, j) => <circle key={j} className="pk" r={j ? 4.5 : 7} />)}
    </svg>
  );
}

/** the project's links as buttons (the first one solid); one without a URL yet shows as a quiet "soon" pill, not a dead link */
function Links({ links }: { links: BuiltProject["links"] }) {
  return (
    <>
      {links.map((l, i) =>
        l.href ? (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={i === 0 ? "btn btn-primary cursor-target" : "btn btn-line cursor-target"}>
            <Roll text={l.label} />
            {i === 0 && <Chip dir="ne" />}
          </a>
        ) : (
          <span key={l.label} className="ms-soon" title={`${l.label}: link coming soon`}>
            {l.label} <i>· soon</i>
          </span>
        ),
      )}
    </>
  );
}

/** the brand film, muted and looping while it's on screen; the switch (or the hero's button) turns the sound on from the top */
function Film({ p }: { p: BuiltProject }) {
  const vRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const [sound, setSound] = useState(false);
  useEffect(() => {
    const v = vRef.current;
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
      if (barRef.current) barRef.current.style.transform = `scaleX(${(v.currentTime / (v.duration || 21)).toFixed(4)})`;
      if (timeRef.current) timeRef.current.textContent = `0:${pad2(Math.floor(v.currentTime))} / ${p.video.filmLength}`;
    };
    // the hero's "Watch the film" scrolls here and starts it from the top with sound
    const withSound = () => {
      v.muted = false;
      v.currentTime = 0;
      v.play().catch(() => {});
      setSound(true);
    };
    v.addEventListener("timeupdate", onTime);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("ms-film-sound", withSound);
    return () => {
      io.disconnect();
      v.removeEventListener("timeupdate", onTime);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("ms-film-sound", withSound);
    };
  }, [p.video.filmLength]);
  const toggle = () => {
    const v = vRef.current;
    if (!v) return;
    const on = v.muted;
    v.muted = !on;
    if (on) v.currentTime = 0;
    v.play().catch(() => {});
    setSound(on);
  };
  return (
    <div className="ms-film">
      <video ref={vRef} src={p.video.film} poster={p.video.scrubPoster} muted loop playsInline preload="metadata" disablePictureInPicture aria-label={`${p.name}: the brand film, ${p.video.filmLength}`} />
      <span className="ms-film-tag" aria-hidden="true"><i />Brand film · on loop</span>
      <div className="ms-film-ui">
        <button type="button" onClick={toggle} aria-pressed={sound} className={`ms-snd cursor-target ${sound ? "on" : ""}`}>
          {sound ? "Sound on" : "Sound off"}
        </button>
        <span className="ms-bar" aria-hidden="true"><i ref={barRef} /></span>
        <span ref={timeRef} className="ms-time" aria-hidden="true">0:00 / {p.video.filmLength}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the page */

export default function MedpediaStudio({ p, index, total }: { p: BuiltProject; index: number; total: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ch = (id: string) => p.chapters.find((c) => c.id === id)!;
  const ask = ch("ask"), sources = ch("sources"), safety = ch("safety"), plain = ch("plain"), stack = ch("stack");

  const watchFilm = () => {
    // glide until the film sits in the middle of the screen
    const f = document.querySelector<HTMLElement>(".ms-film");
    if (f) {
      const r = f.getBoundingClientRect();
      glideTo(r.top + window.scrollY - Math.max(40, (window.innerHeight - r.height) / 2));
    }
    window.dispatchEvent(new Event("ms-film-sound"));
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const quiet = quietMedia();
    // the site's paper takes this page's while it's showing (the header's fade reads it)
    document.documentElement.setAttribute("data-ms-page", "");
    const $ = <T extends Element>(s: string) => root.querySelector<T>(s)!;
    const $$ = <T extends Element>(s: string) => [...root.querySelectorAll<T>(s)];

    // words rise in as they come into view, line after line
    const rio = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = e.target as HTMLElement;
      let top: number | null = null;
      let line = -1;
      n.querySelectorAll<HTMLElement>(".wm").forEach((w) => {
        if (top === null || Math.abs(w.offsetTop - top) > 6) {
          top = w.offsetTop;
          line++;
        }
        (w.firstElementChild as HTMLElement).style.transitionDelay = `${(line * 0.085).toFixed(3)}s`;
      });
      n.classList.add("on");
      rio.unobserve(n);
    }), { threshold: 0.2 });
    $$<HTMLElement>(".ms-rise").forEach((n) => (quiet ? n.classList.add("on") : rio.observe(n)));

    // the apps
    const hero = appCtl($(".ms-shot .ms-app"));
    const phone = appCtl($(".ms-phone .ms-app"));
    const chat = appCtl($(".ms-chat .ms-app"));
    const shot = $<HTMLElement>(".ms-shot .ms-win");
    // the problem
    const prob = $<HTMLElement>(".ms-prob"), lines = $$<HTMLElement>(".ms-lines .ln"), okT = $<HTMLElement>(".ms-lines .ok .tx"), pb = $<HTMLElement>(".ms-pb");
    // the rows that react
    const askRow = $<HTMLElement>("[data-ch=ask]"), srcRow = $<HTMLElement>("[data-ch=sources]"), chips = $$<HTMLElement>(".ms-src .ms-app-src span"), num = $<HTMLElement>(".ms-n");
    // the slider
    const cmp = $<HTMLElement>(".ms-cmp");
    let x = 50, touched = false, drag = false;
    const setX = (v: number) => {
      x = clamp(v, 0, 100);
      cmp.style.setProperty("--x", `${x.toFixed(1)}%`);
      cmp.setAttribute("aria-valuenow", String(Math.round(x)));
    };
    const fromPtr = (e: PointerEvent) => {
      const r = cmp.getBoundingClientRect();
      setX(((e.clientX - r.left) / r.width) * 100);
    };
    const onDown = (e: PointerEvent) => {
      touched = drag = true;
      cmp.setPointerCapture(e.pointerId);
      fromPtr(e);
    };
    const onMove = (e: PointerEvent) => drag && fromPtr(e);
    const onUp = () => (drag = false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      touched = true;
      setX(x + (e.key === "ArrowLeft" ? -5 : 5));
    };
    cmp.addEventListener("pointerdown", onDown);
    cmp.addEventListener("pointermove", onMove);
    cmp.addEventListener("pointerup", onUp);
    cmp.addEventListener("pointercancel", onUp);
    cmp.addEventListener("keydown", onKey);
    // the colour fields
    const fields = $$<HTMLElement>(".ms-f").map((s) => ({ s, fin: s.querySelector<HTMLElement>(".ms-fin")!, dim: s.querySelector<HTMLElement>(".ms-dim")!, k: -1 }));
    // under the hood: the diagram that's showing (wide, or upright on a phone)
    const hood = $<HTMLElement>(".ms-hood"), nowB = $<HTMLElement>(".ms-now b"), nowH = $<HTMLElement>(".ms-now h4"), nowP = $<HTMLElement>(".ms-now p"), sdots = $$<HTMLElement>(".ms-sdots i"), rdK = $<HTMLElement>(".ms-read em"), rdT = $<HTMLElement>(".ms-read .t");
    const mq = window.matchMedia("(max-width: 859px)");
    let nodes: Record<string, SVGGElement> = {}, edges: Record<string, { p: SVGPathElement; L: number }> = {}, pks: SVGCircleElement[] = [], tagc: SVGGElement | null = null, on = -1, lastTxt = "";
    const bind = () => {
      const svg = $<SVGSVGElement>(mq.matches ? ".ms-dia-tall" : ".ms-dia-wide");
      nodes = Object.fromEntries([...svg.querySelectorAll<SVGGElement>(".nd")].map((g) => [g.dataset.n!, g]));
      edges = Object.fromEntries([...svg.querySelectorAll<SVGPathElement>(".ed")].map((e) => [e.dataset.e!, { p: e, L: e.getTotalLength() }]));
      pks = [...svg.querySelectorAll<SVGCircleElement>(".pk")];
      tagc = svg.querySelector(".tagc");
      on = -1;
    };
    bind();
    mq.addEventListener("change", bind);
    // the chapter rail
    const rail = $$<HTMLAnchorElement>(".ms-rail a"), secs = CHAPS.map(([k]) => root.querySelector<HTMLElement>(`[data-ch="${k}"]`));
    const onRail = rail.map((a, j) => {
      const f = (e: Event) => {
        e.preventDefault();
        const s = secs[j];
        if (s) glideTo(s.getBoundingClientRect().top + window.scrollY - 8);
      };
      a.addEventListener("click", f);
      return f;
    });

    if (quiet) {
      // less motion: every piece rests in its finished state
      hero.set(APP_DONE);
      phone.set(APP_DONE);
      chat.set(APP_DONE);
      lines.forEach((l) => l.style.setProperty("--k", "1"));
      okT.textContent = UI.calm;
      pb.style.opacity = "1";
      num.textContent = "5";
      chips.forEach((c) => c.classList.add("on"));
    }

    const rowP = (row: HTMLElement) => {
      const r = row.getBoundingClientRect();
      return clamp((window.innerHeight * 0.8 - r.top) / (r.height * 0.85));
    };
    const at = (e: string, tt: number) => edges[e].p.getPointAtLength(clamp(tt) * edges[e].L);

    let raf = 0, last = 0, t = 0, railOn = -2, fieldUnder = false;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      t += dt;
      const H = window.innerHeight;

      // the chapter rail
      let ci = -1;
      secs.forEach((s, j) => {
        if (s && s.getBoundingClientRect().top < H * 0.45) ci = j;
      });
      if (ci !== railOn) {
        railOn = ci;
        rail.forEach((a, j) => a.classList.toggle("on", j === ci));
      }

      // the colour fields sink back as the next slides over them; while one is under the header, the header's fade steps aside
      const fr0 = fields[0].s.getBoundingClientRect(), fr1 = fields[fields.length - 1].s.getBoundingClientRect();
      const under = fr0.top <= 1 && fr1.bottom > 96;
      if (under !== fieldUnder) {
        fieldUnder = under;
        document.documentElement.toggleAttribute("data-ms-field", under);
      }
      fields.forEach((o, j) => {
        const nx = fields[j + 1];
        const k = nx ? clamp((H - nx.s.getBoundingClientRect().top) / H) : 0;
        if (Math.abs(k - o.k) < 0.0005) return;
        o.k = k;
        o.fin.style.transform = `translate3d(0, ${(-k * 2.5).toFixed(2)}vh, 0) scale(${(1 - 0.06 * k).toFixed(4)})`;
        o.dim.style.opacity = (k * 0.45).toFixed(3);
      });

      if (!quiet) {
        appPlay(hero, t + 10);
        const k0 = easeOut(clamp(seenP(shot.parentElement!) * 2.2));
        shot.style.transform = `perspective(1600px) rotateX(${((1 - k0) * 18).toFixed(2)}deg) translate3d(0, ${((1 - k0) * 40).toFixed(1)}px, 0)`;
        // the problem: each line struck in turn, then the answer to it typed in
        const pr = prob.getBoundingClientRect();
        if (pr.bottom > 0 && pr.top < H) {
          const pp = pinP(prob);
          lines.forEach((l, j) => {
            const k = smooth((pp - 0.08 - j * 0.17) / 0.13);
            l.style.setProperty("--k", k.toFixed(3));
            (l.firstElementChild as HTMLElement).style.opacity = (1 - 0.55 * k).toFixed(3);
          });
          const n = Math.round(clamp((pp - 0.62) / 0.18) * UI.calm.length);
          if (okT.textContent!.length !== n) okT.textContent = UI.calm.slice(0, n);
          pb.style.opacity = smooth((pp - 0.8) / 0.12).toFixed(3);
        }
        // the phone acts out the exchange as its row comes up
        const q = rowP(askRow);
        phone.set({ typed: q / 0.3, loading: q < 0.32 ? -1 : q < 0.42 ? 1 : q < 0.5 ? 2 : -1, stream: (q - 0.5) / 0.3, tag: q > 0.55, call: q > 0.84, sources: q > 0.88 ? 3 : 0, fb: q > 0.94 });
        // the sources arrive one by one, and the count runs up to five
        const qs = rowP(srcRow);
        const nn = String(Math.round(clamp((qs - 0.1) / 0.5) * 5));
        if (num.textContent !== nn) num.textContent = nn;
        chips.forEach((c, j) => c.classList.toggle("on", qs > 0.25 + j * 0.15));
        // the slider breathes until someone drags it
        if (!touched) {
          const r = cmp.getBoundingClientRect();
          if (r.bottom > 0 && r.top < H) setX(50 + Math.sin(t * 1.4) * 22);
        }
      }

      // under the hood: one question through the system, the chat moving in step
      const r = hood.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H || !tagc) return;
      const N = STEPS.length, u = Math.min(N - 0.001, pinP(hood) * N), i = Math.floor(u), f = u - i, s = STEPS[i];
      const e = quiet ? 1 : ease(clamp((f - 0.06) / 0.74));
      if (i !== on) {
        on = i;
        nowB.textContent = pad2(i + 1);
        nowH.textContent = s.h;
        nowP.textContent = s.p;
        sdots.forEach((d, j) => d.classList.toggle("on", j <= i));
        Object.entries(nodes).forEach(([key, g]) => g.classList.toggle("on", (s.nodes as readonly string[]).includes(key)));
        Object.entries(edges).forEach(([key, o]) => o.p.classList.toggle("on", key === s.edge));
        tagc.classList.toggle("on", i >= 4);
        rdK.textContent = s.read[0];
      }
      pks.forEach((c, k) => {
        let tt = -1;
        if ("stream" in s) {
          if (k > 0) tt = 1 - clamp(e * 1.7 - (k - 1) * 0.17);
        } else if (k === 0) tt = s.dir === 2 ? (e < 0.5 ? e * 2 : 2 - e * 2) : s.dir === 1 ? e : 1 - e;
        const vis = !quiet && tt >= 0 && f > 0.05 && f < 0.95 && !("stream" in s && (tt <= 0 || tt >= 1));
        c.style.opacity = vis ? "1" : "0";
        if (vis) {
          const pt = at(s.edge, tt);
          c.setAttribute("cx", pt.x.toFixed(1));
          c.setAttribute("cy", pt.y.toFixed(1));
        }
      });
      const txt = "stream" in s ? s.read[1].slice(0, Math.max(1, Math.round(s.read[1].length * clamp(e * 1.1)))) : s.read[1];
      if (txt !== lastTxt) {
        lastTxt = txt;
        rdT.textContent = txt;
      }
      if (!quiet) chat.set({ typed: i === 0 ? e * 1.1 : 1, loading: i === 1 || i === 2 ? 1 : i === 3 ? 0 : i === 4 ? 2 : -1, stream: i < 5 ? 0 : i === 5 ? e * 1.1 : 1, tag: i >= 4 && (i > 4 || e > 0.5), call: i === 6 || (i === 5 && e > 0.9), sources: i === 6 ? 3 : 0, fb: i === 6 });
    };
    raf = requestAnimationFrame(tick);

    return () => {
      document.documentElement.removeAttribute("data-ms-page");
      document.documentElement.removeAttribute("data-ms-field");
      cancelAnimationFrame(raf);
      rio.disconnect();
      mq.removeEventListener("change", bind);
      cmp.removeEventListener("pointerdown", onDown);
      cmp.removeEventListener("pointermove", onMove);
      cmp.removeEventListener("pointerup", onUp);
      cmp.removeEventListener("pointercancel", onUp);
      cmp.removeEventListener("keydown", onKey);
      rail.forEach((a, j) => a.removeEventListener("click", onRail[j]));
    };
  }, []);

  const feat = (key: string, n: number, c: typeof ask, r: boolean, vis: ReactNode) => (
    <section className={`ms-feat${r ? " r" : ""}`} data-ch={key} id={`ms-${key}`}>
      <div className="ms-tx">
        <span className="ms-lbl">{pad2(n)} — {c.label}</span>
        <Rise as="h3" text={c.title} />
        <p>{c.body[0]}</p>
      </div>
      <div className="ms-vis">{vis}</div>
    </section>
  );

  return (
    <div ref={rootRef} className={`ms ${tight.variable} ${serif.variable}`}>
      <nav className="ms-rail" aria-label="Chapters">
        {CHAPS.map(([k, n]) => (
          <a key={k} href={`#ms-${k}`} aria-label={n} className="cursor-target">
            <span>{n}</span>
          </a>
        ))}
      </nav>

      <header className="ms-hero">
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
        </div>
        <div className="ms-meta">
          <div><span className="ms-lbl">Project</span><b>{p.name}</b></div>
          <div><span className="ms-lbl">What it is</span><b>An AI health assistant</b></div>
          <div><span className="ms-lbl">Year</span><b>{p.year}</b></div>
          <div><span className="ms-lbl">Status</span><b>{p.status}</b></div>
        </div>
        <h1 className="ms-name rise-in" style={{ animationDelay: "80ms" }}>
          AI <em>Med-pedia</em>
        </h1>
        <div className="ms-row rise-in" style={{ animationDelay: "160ms" }}>
          <p>{p.tagline}</p>
          <div className="flex flex-wrap items-center gap-3">
            {/* the project's links (Live app first) lead; the film becomes a quieter link beside them */}
            <Links links={p.links} />
            {p.links.length > 0 ? (
              <button type="button" onClick={watchFilm} className="link-roll cursor-target">
                <Ring dir="play" />
                <Roll text={`Watch the film · ${p.video.filmLength}`} />
              </button>
            ) : (
              <button type="button" onClick={watchFilm} className="btn btn-primary cursor-target">
                <Roll text={`Watch the film · ${p.video.filmLength}`} />
                <Chip dir="play" />
              </button>
            )}
            <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">
              {p.status} · {p.year}
            </span>
          </div>
        </div>
      </header>

      <div className="ms-shot">
        <ViewTransition name={`film-${p.slug}`} share="morph" default="none">
          <div className="ms-win-wrap">
            <Win h="min(560px, 62vh)"><AppUI /></Win>
          </div>
        </ViewTransition>
      </div>

      {/* the problem, struck through line by line, then the answer to it */}
      <section className="ms-prob" data-ch="prob" id="ms-prob">
        <div className="ms-pst">
          <span className="ms-lbl">01 — The problem</span>
          <div>
            <div className="ms-lines">
              {UI.noise.map((l) => (
                <div key={l} className="ln"><span>{l}</span><i aria-hidden="true" /></div>
              ))}
              <div className="ok"><span className="tx" /><i className="caret" aria-hidden="true" /></div>
            </div>
            <p className="ms-pb">{p.line}. {p.tagline}</p>
          </div>
        </div>
      </section>

      {feat("ask", 2, ask, false, <div className="ms-phone"><div className="scr"><AppUI /></div></div>)}
      {feat("sources", 3, sources, true, (
        <div className="ms-src">
          <span className="k">Sources per answer</span>
          <div className="n"><b className="ms-n">0</b><span>closest passages from your own files (Gemini embeddings in Pinecone), plus live web results</span></div>
          <div className="ms-app-src">{UI.sources.map((s) => <span key={s}>{s}</span>)}</div>
        </div>
      ))}

      {/* the safety read: three colour fields that slide over each other */}
      <section className="ms-sint" data-ch="safety" id="ms-safety">
        <span className="ms-lbl">04 — Safety</span>
        <div>
          <Rise as="h2" className="ms-big" text={safety.title} em="emergencies." />
          <p className="ms-b">{safety.body[0]}</p>
        </div>
      </section>
      <div className="ms-fields">
        {TONES.map((tn, i) => (
          <section key={tn.id} className="ms-f" style={{ background: tn.color }}>
            <div className="ms-fin">
              <div>
                <span className="k">04 — Safety · {i + 1} of 3</span>
                <h3>{tn.label}.</h3>
                <p>
                  {tn.meaning}
                  <br />
                  <b>For example:</b> {tn.example.toLowerCase()}.
                </p>
              </div>
              <ToneCard c={UI.cards[i]} rot={[2, -2.5, 1.5][i]} />
            </div>
            <span className="num" aria-hidden="true">0{i + 1} / 03</span>
            <div className="ms-dim" aria-hidden="true" />
          </section>
        ))}
      </div>

      {feat("plain", 5, plain, false, (
        <>
          <div className="ms-cmp" tabIndex={0} role="slider" aria-label="From clinical detail to plain language" aria-valuemin={0} aria-valuemax={100} aria-valuenow={50}>
            <div className="lay cl"><span className="tg">{UI.toggles.clinical}</span><p>{UI.plain.clinical}</p></div>
            <div className="lay pl"><span className="tg">{UI.toggles.plain}</span><p>{UI.plain.plain}</p></div>
            <div className="hd" aria-hidden="true"><i /></div>
          </div>
          <p className="ms-hint">Drag the line · the same sentence, two ways</p>
        </>
      ))}

      {/* under the hood: one question through the real system, the chat moving in step */}
      <section className="ms-hood" data-ch="hood" id="ms-hood">
        <div className="ms-hst">
          <div className="ms-cap">
            <span className="ms-lbl">06 — Under the hood</span>
            <Rise as="h2" className="ms-big" text="How one question travels." em="travels." />
            <div className="ms-now"><b>01</b><h4>{STEPS[0].h}</h4><p>{STEPS[0].p}</p></div>
            <div className="ms-sdots" aria-hidden="true">{STEPS.map((s) => <i key={s.h} />)}</div>
            <div className="ms-chat"><Win h="min(290px, 33vh)"><AppUI /></Win></div>
            <p className="sr-only">{stack.body[0]}</p>
          </div>
          <div className="ms-dia">
            <Diagram k="wide" />
            <Diagram k="tall" />
            <div className="ms-read" aria-live="off"><i aria-hidden="true" /><span><em /><span className="t" /></span></div>
          </div>
        </div>
      </section>

      <section className="ms-filmsec" data-ch="film" id="ms-film">
        <span className="ms-lbl">07 — The film</span>
        <Film p={p} />
      </section>

      {/* the credits */}
      <section aria-label="At a glance" className="ms-credits">
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
              <li key={s} className="rounded-full border border-line-strong px-3 py-1 text-xs text-muted">{s}</li>
            ))}
          </ul>
          {p.links.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <Links links={p.links} />
            </div>
          )}
        </div>
        <p className="mt-8 font-mono text-[10.5px] tracking-[0.14em] text-faint uppercase">General health information only — not a diagnosis.</p>
      </section>
    </div>
  );
}
