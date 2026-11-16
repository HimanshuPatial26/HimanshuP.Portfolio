"use client";

import { useEffect, useRef, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import SectionHeading from "@/components/SectionHeading";
import { caseStudies, experience, type CaseStudy, type Track } from "@/data/resume";

const N = caseStudies.length;
/** Leaves that turn: the cover plus every case but the last, whose page is glued to the back board. */
const LEAVES = N;
/** Places the book rests: closed on its cover, then open on each case. */
const STATES = N + 1;
const ROLE = `${experience[0].title}, ${experience[0].company}`;
const pad = (i: number) => String(i + 1).padStart(2, "0");
/** The still of a case's live figure: /figures/x.html -> /figures/stills/x.jpg */
const stillOf = (figure?: string) => (figure ? figure.replace(/\/([^/]+)\.html$/, "/stills/$1.jpg") : null);
const isAI = (c: CaseStudy) => c.tracks.includes("AI");
const gradeOf = (c: CaseStudy) => (c.tracks.length > 1 ? "" : isAI(c) ? "ai" : "growth");
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Headline results on the cover. */
const COVER_LINES: { id: string; big: string; text: string }[] = [
  { id: "ai-convert", big: "₹4M a month", text: "AI-Convert, the conversion engine" },
  { id: "crm-lms", big: "+30%", text: "agent productivity from the CRM" },
  { id: "payment-recovery", big: "+10–15%", text: "more successful payments" },
];

/** Narrow or portrait screens get a one-page book: a spread won't fit. */
const SINGLE_QUERY = "(max-width: 899px), (max-aspect-ratio: 1/1)";
const subscribeSingle = (cb: () => void) => {
  const m = window.matchMedia(SINGLE_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
const useSingle = () =>
  useSyncExternalStore(
    subscribeSingle,
    () => window.matchMedia(SINGLE_QUERY).matches,
    () => false,
  );

const trackStyle: Record<Track, string> = {
  AI: "border-ai/50 text-ai",
  Growth: "border-growth/50 text-growth",
};
function Tags({ tracks }: { tracks: Track[] }) {
  return (
    <span className="inline-flex gap-1.5">
      {tracks.map((t) => (
        <span key={t} className={`rounded-full border px-2 py-px font-mono text-[10px] tracking-wide uppercase ${trackStyle[t]}`}>
          {t}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- the pages

function Cover() {
  return (
    <div className="mg-pg mg-cv">
      <div className="mg-row mg-mono">
        <span>Issue 03</span>
        <span>Himanshu Patial</span>
      </div>
      <p className="mg-mast" aria-hidden="true">
        Selected<span>Work</span>
      </p>
      <div className="mg-mosaic" aria-hidden="true">
        {caseStudies.map((c, k) => {
          const still = stillOf(c.figure);
          return (
            <figure key={c.id}>
              {still && <Image src={still} alt="" fill sizes="180px" className="object-cover" />}
              <span className="mg-mono">{pad(k)}</span>
            </figure>
          );
        })}
      </div>
      <ul className="mg-lines">
        {COVER_LINES.map((l) => (
          <li key={l.id}>
            <b className={l.id === "ai-convert" ? "text-ai" : ""}>{l.big}</b>
            {l.text}
          </li>
        ))}
      </ul>
      <div className="mg-row mg-mono mg-foot">
        <span>Six products I shipped</span>
        <b>Scroll to open ↓</b>
      </div>
    </div>
  );
}

function Result({ c, className = "" }: { c: CaseStudy; className?: string }) {
  return (
    <div className={`mg-pull ${isAI(c) ? "is-ai" : ""} ${className}`}>
      <p className="mg-micro">Result</p>
      <p className={`mg-res ${c.resultIsMetric ? "" : "is-text"} ${isAI(c) ? "text-ai" : "text-growth"}`}>{c.result}</p>
    </div>
  );
}

/** The figure: its still, with the live page laid over it once it's loaded (src set by the book). */
function Plate({ c, k }: { c: CaseStudy; k: number }) {
  const still = stillOf(c.figure);
  return (
    <figure className="mg-plate">
      {still && <Image src={still} alt="" fill sizes="(min-width: 900px) 560px, 92vw" className="object-cover" />}
      {c.figure && <iframe className="mg-live" data-k={k} data-src={c.figure} title={`${c.name}, animated`} tabIndex={-1} aria-hidden="true" />}
      <span className="mg-badge mg-mono" aria-hidden="true">
        <i />
        Live
      </span>
    </figure>
  );
}

function CaseLink({ c }: { c: CaseStudy }) {
  return (
    <Link href={`/work/${c.id}`} className="mg-cta cursor-target">
      Read the case study →
    </Link>
  );
}

/** Left page of a spread: the story. */
function StoryPage({ c, k }: { c: CaseStudy; k: number }) {
  return (
    <div className="mg-pg mg-l">
      <div className="mg-row mg-mono mg-head">
        <span>Selected work</span>
        <span>{pad(k)} / 06</span>
      </div>
      <span className="mg-num" aria-hidden="true">
        {pad(k)}
      </span>
      <h3 className="mg-name">{c.name}</h3>
      <div className="mg-kind">
        {c.kind} <Tags tracks={c.tracks} />
      </div>
      <Result c={c} />
      <div className="mg-cols">
        <div>
          <p className="mg-micro">The problem</p>
          <p className="mg-drop">{c.problem}</p>
        </div>
        <div>
          <p className="mg-micro">What I built</p>
          <p>{c.built}</p>
        </div>
      </div>
      <div className="mg-row mg-mono mg-foot">
        <span>Himanshu Patial</span>
        <span>{2 + 2 * k}</span>
      </div>
    </div>
  );
}

/** Right page of a spread: the figure, running live. */
function FigurePage({ c, k }: { c: CaseStudy; k: number }) {
  return (
    <div className="mg-pg mg-r">
      <div className="mg-row mg-mono mg-head">
        <span>{c.kind}</span>
        <span>Fig. {pad(k)}</span>
      </div>
      <Plate c={c} k={k} />
      <p className="mg-cap mg-mono">
        Fig. {pad(k)} — {c.name}, running live
      </p>
      <dl className="mg-spec">
        <dt className="mg-mono">Track</dt>
        <dd>
          <Tags tracks={c.tracks} />
        </dd>
        <dt className="mg-mono">Role</dt>
        <dd>{ROLE}</dd>
      </dl>
      <div className="mg-act">
        <CaseLink c={c} />
        <span className="mg-mono mg-turn">{k < N - 1 ? "Scroll to turn ↓" : "End of section"}</span>
      </div>
      <div className="mg-row mg-mono mg-foot">
        <span>Product · AI &amp; growth</span>
        <span>{3 + 2 * k}</span>
      </div>
    </div>
  );
}

/** A case on one page, for the one-page book. */
function OnePage({ c, k }: { c: CaseStudy; k: number }) {
  return (
    <div className="mg-pg mg-one">
      <div className="mg-row mg-mono mg-head">
        <span>
          Selected work · {pad(k)} / 06
        </span>
        <Tags tracks={c.tracks} />
      </div>
      <h3 className="mg-name">{c.name}</h3>
      <p className="mg-kind">{c.kind}</p>
      <Plate c={c} k={k} />
      <Result c={c} />
      <div className="mg-cols">
        <div>
          <p className="mg-micro">The problem</p>
          <p>{c.problem}</p>
        </div>
        <div>
          <p className="mg-micro">What I built</p>
          <p>{c.built}</p>
        </div>
      </div>
      <div className="mg-act">
        <CaseLink c={c} />
        <span className="mg-mono mg-turn">{k < N - 1 ? "Scroll ↓" : "End"}</span>
      </div>
    </div>
  );
}

/** The back of a page in the one-page book: plain paper, seen only mid-turn. */
function PaperBack({ k }: { k: number }) {
  return (
    <div className="mg-pg mg-paper">
      <span className="mg-mono">Himanshu Patial · {k + 1}</span>
    </div>
  );
}

function Leaf({ j, front, back }: { j: number; front: ReactNode; back: ReactNode }) {
  return (
    <div className="mg-leaf" style={{ zIndex: 100 - j }}>
      <div className="mg-face mg-front">
        {front}
        <i className="mg-shade" />
        <i className="mg-gloss" />
      </div>
      <div className="mg-face mg-back">
        {back}
        <i className="mg-shade" />
        <i className="mg-gloss" />
      </div>
    </div>
  );
}

/**
 * Selected work as a printed magazine. The section pins while the book turns: it opens on its cover,
 * then each case is a spread, the story on the left page and its figure running live on the right
 * (one page per case on phones and portrait screens). The scroll turns the pages: the page follows
 * the scroll smoothly, never faster than about a page and a half a second, and if you stop part-way
 * it carries on the way you were going and settles flat. Arrow keys or a click turn one page.
 *
 * It's a real book: each leaf carries its two pages and only ever rotates, so a live figure keeps
 * running through a turn and never reloads. The figure on show and the one either side stay loaded;
 * the rest stay as stills. The chrome object stays away (data-shape="none") while the book is up.
 */
export default function Work() {
  const single = useSingle();
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const stepRef = useRef<(dir: number) => void>(() => {});

  useEffect(() => {
    const section = sectionRef.current;
    const pin = pinRef.current;
    const book = bookRef.current;
    const status = statusRef.current;
    if (!section || !pin || !book || !status) return;
    const leaves = [...book.querySelectorAll<HTMLElement>(":scope > .mg-leaf")];
    const base = book.querySelector<HTMLElement>(":scope > .mg-base")!;
    const faces = leaves.map((L) => [L.querySelector<HTMLElement>(".mg-front")!, L.querySelector<HTMLElement>(".mg-back")!] as const);
    // per leaf: front shade, front gloss, back shade, back gloss
    const shades = leaves.map((L) => [...L.querySelectorAll<HTMLElement>(":scope > .mg-face > i")]);
    const q = (s: string) => book.querySelector<HTMLElement>(s);
    const castL = q(".mg-cast.l"), castR = q(".mg-cast.r"), spine = q(".mg-spine"), floorL = q(".mg-floor.l"), edgeL = q(".mg-edge.l"), edgeR = q(".mg-edge.r");
    const frames = [...book.querySelectorAll<HTMLIFrameElement>("iframe[data-k]")].sort((a, b) => Number(a.dataset.k) - Number(b.dataset.k));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lenis = () => (window as unknown as { __lenis?: { scrollTo: (t: number, o?: object) => void } }).__lenis;

    // ---- where the scroll says the book should be ----
    // Each turn gets an equal stretch of scroll; a sliver at each end holds the page flat so it rests
    // cleanly, and the rest turns it, so the page starts to lift as soon as you scroll.
    const progress = () => {
      const r = pin.getBoundingClientRect();
      return clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
    };
    const posOf = (p: number) => {
      const u = p * (STATES - 1);
      const k = Math.min(STATES - 2, Math.floor(u));
      return k + clamp((u - k - 0.1) / 0.8, 0, 1);
    };
    const yOf = (s: number) => {
      const r = pin.getBoundingClientRect();
      return r.top + window.scrollY + (clamp(s, 0, STATES - 1) / (STATES - 1)) * (r.height - window.innerHeight);
    };
    // (set below) the scroll's last movement: a glide counts as one, the way it's heading
    let lastMove = 0;
    let dir = 1;
    const glideTo = (s: number) => {
      const y = yOf(s);
      lastMove = performance.now();
      dir = Math.sign(y - window.scrollY) || dir;
      const l = lenis();
      if (l) l.scrollTo(y, { duration: 1.1 });
      else window.scrollTo({ top: y, behavior: reduced ? "instant" : "smooth" });
    };

    // live figures: the case on show and its neighbours either side are loaded, so a turn never waits
    let liveAt = -9;
    const onLoad = (e: Event) => {
      const f = e.currentTarget as HTMLIFrameElement;
      if (f.dataset.on) window.setTimeout(() => f.dataset.on && f.classList.add("is-on"), 150);
    };
    frames.forEach((f) => f.addEventListener("load", onLoad));
    const live = (s: number) => {
      if (s === liveAt) return;
      liveAt = s;
      frames.forEach((f, k) => {
        if (s >= 0 && Math.abs(k - (s - 1)) <= 1) {
          if (!f.dataset.on) {
            f.dataset.on = "1";
            f.src = f.dataset.src!;
          }
        } else if (f.dataset.on) {
          delete f.dataset.on;
          f.classList.remove("is-on");
          f.src = "about:blank";
        }
      });
    };

    // ---- drawing the book at a position: 0 = closed on the cover, s = open on case s ----
    // a heavy page: it eases off the book and down onto the other side, with an even swing between
    const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;
    const tri = (v: number, c: number, w: number) => Math.max(0, 1 - Math.abs(v - c) / w);
    const setO = (el: HTMLElement | null, v: number) => {
      if (el) el.style.opacity = v.toFixed(3);
    };
    const inertNow = leaves.map(() => [false, false]);
    let onCase = -1;
    const draw = (X: number) => {
      const j = Math.min(LEAVES - 1, Math.floor(X));
      const t = clamp(X - j, 0, 1);
      const e = ease(t);
      leaves.forEach((L, i) => {
        const ti = clamp(X - i, 0, 1);
        const ei = ease(ti);
        const moving = ti > 0 && ti < 1;
        L.style.transform = `rotateY(${(-180 * ei).toFixed(2)}deg)`;
        L.style.zIndex = String(moving ? 300 : ti >= 1 ? 10 + i : 100 - i);
        // only what you can see is drawn: the open pages, and the page under the one that's turning
        const shown = i === j || (i === j + 1 && t > 0) || (!single && i === j - 1);
        L.classList.toggle("is-hidden", !shown);
        // only the side facing you can be reached (keyboard, screen readers)
        const turned = ti >= 0.5;
        if (inertNow[i][0] !== turned) faces[i][0].inert = inertNow[i][0] = turned;
        if (inertNow[i][1] !== !turned) faces[i][1].inert = inertNow[i][1] = !turned;
        const [fs, fg, bs, bg] = shades[i];
        setO(fs, moving ? Math.min(0.5, ei) : 0);
        setO(bs, moving ? Math.min(0.5, 1 - ei) : 0);
        setO(fg, moving ? tri(ei, 0.36, 0.16) : 0);
        setO(bg, moving ? 0.8 * tri(ei, 0.64, 0.16) : 0);
      });
      base.classList.toggle("is-hidden", !(j === LEAVES - 1 && t > 0));
      // the lifting page throws a shadow on the page it uncovers, then on the page it comes down on
      const turning = t > 0 && t < 1;
      setO(castR, turning ? 0.85 * clamp(1 - e / 0.62, 0, 1) : 0);
      setO(castL, turning && j > 0 && !single ? 0.65 * clamp((e - 0.58) / 0.32, 0, 1) * clamp((1 - e) / 0.08, 0, 1) : 0);
      if (!single) {
        // closed, the book sits centred on its cover; it slides to the middle as the cover opens
        const open = ease(clamp(X, 0, 1));
        book.style.transform = `translate3d(${(-25 * (1 - open)).toFixed(3)}%,0,0)`;
        setO(floorL, open);
        setO(spine, open);
        if (edgeL) edgeL.style.width = `${(X * 1.5).toFixed(2)}px`;
        if (edgeR) edgeR.style.width = `${((LEAVES - X + 1) * 1.5).toFixed(2)}px`;
      }
      const s = Math.round(X);
      live(s);
      if (s !== onCase) {
        onCase = s;
        const c = s > 0 ? caseStudies[s - 1] : null;
        // the page's light follows the case: blue for AI, chrome for growth, neutral for both
        section.dataset.grade = c ? gradeOf(c) : "";
        status.textContent = c ? `Case ${s} of ${N}: ${c.name}` : "Cover";
      }
    };

    // ---- the loop: the book follows the scroll, eased and capped in speed ----
    const SPEED = 1.5; // pages a second, at most
    const FOLLOW = 9;
    let x = NaN;
    let drawn = NaN;
    let lastY = window.scrollY;
    let settling = false;
    let raf = 0;
    let last = performance.now();
    let near = false;
    const tick = (now: number) => {
      raf = 0;
      if (!near || document.hidden) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // read the scroll here rather than from scroll events, which arrive a frame late: a glide
      // that has just started must already count as movement, or it would be "settled" straight back
      const y = window.scrollY;
      if (y !== lastY) {
        dir = Math.sign(y - lastY);
        lastY = y;
        lastMove = now;
      }
      const target = posOf(progress());
      if (Number.isNaN(x) || reduced) x = reduced ? Math.round(target) : target;
      else {
        x += clamp((target - x) * (1 - Math.exp(-FOLLOW * dt)), -SPEED * dt, SPEED * dt);
        if (Math.abs(target - x) < 0.0004) x = target;
      }
      if (x !== drawn) {
        drawn = x;
        draw(x);
      }
      // stopped part-way through a turn: the page carries on the way you were scrolling and settles
      // flat. It waits for a real stop, so it never tugs against a slow scroll.
      const frac = target - Math.floor(target);
      if (!reduced && now - lastMove > 320 && frac > 0.001 && frac < 0.999) {
        if (!settling) {
          settling = true;
          glideTo(dir > 0 ? (frac > 0.06 ? Math.ceil(target) : Math.floor(target)) : frac < 0.94 ? Math.floor(target) : Math.ceil(target));
        }
      } else if (now - lastMove <= 320) settling = false;
      raf = requestAnimationFrame(tick);
    };
    const run = () => {
      if (!raf && near && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    // runs only while the book is on (or about to come on) screen; off screen, the live figures unload
    const io = new IntersectionObserver(
      ([en]) => {
        near = en.isIntersecting;
        if (near) run();
        else {
          live(-9);
          drawn = NaN;
        }
      },
      { rootMargin: "200px 0px" },
    );
    io.observe(pin);
    stepRef.current = (d: number) => glideTo(Math.round(posOf(progress())) + d);
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) return;
      const r = book.getBoundingClientRect();
      const at = Math.round(posOf(progress()));
      const forward = single ? e.clientX > r.left + r.width / 3 : at === 0 || e.clientX > r.left + r.width / 2;
      stepRef.current(forward ? 1 : -1);
    };
    book.addEventListener("click", onClick);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      book.removeEventListener("click", onClick);
      document.removeEventListener("visibilitychange", run);
      frames.forEach((f) => f.removeEventListener("load", onLoad));
    };
  }, [single]);

  // arrow keys turn one page while focus is on the book
  const onKey = (e: KeyboardEvent) => {
    const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    stepRef.current(d);
  };

  // the pages in reading order, bound onto leaves: leaf j carries page 2j and page 2j+1 (one page per
  // leaf in the one-page book, with plain paper behind); the last page is glued to the back board
  const leaves: ReactNode[] = [];
  let backBoard: ReactNode;
  if (single) {
    const pages = [<Cover key="cover" />, ...caseStudies.map((c, k) => <OnePage key={c.id} c={c} k={k} />)];
    for (let j = 0; j < LEAVES; j++) leaves.push(<Leaf key={j} j={j} front={pages[j]} back={<PaperBack k={j} />} />);
    backBoard = pages[LEAVES];
  } else {
    const pages = [<Cover key="cover" />, ...caseStudies.flatMap((c, k) => [<StoryPage key={`${c.id}-l`} c={c} k={k} />, <FigurePage key={`${c.id}-r`} c={c} k={k} />])];
    for (let j = 0; j < LEAVES; j++) leaves.push(<Leaf key={j} j={j} front={pages[2 * j]} back={pages[2 * j + 1]} />);
    backBoard = pages[2 * LEAVES];
  }

  return (
    <section ref={sectionRef} id="work" data-shape="none" data-pose="deep" data-chapter="Work" data-chapter-no="03" className="relative">
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="03"
          eyebrow="Selected work"
          title="Six products I shipped."
          intro="Built at Classplus between 2023 and 2025. Three put AI into the product and four moved conversion or revenue. AI-Convert did both."
        />
      </div>

      {/* pinned while the book turns: one screen of scroll per page */}
      <div ref={pinRef} className="relative" style={{ height: `calc(100svh + ${STATES - 1} * 100svh)` }}>
        <div
          className="mg-stage sticky top-0 h-[100svh] overflow-hidden"
          role="region"
          aria-roledescription="magazine"
          aria-label="Selected work. Scroll, or use the arrow keys, to turn the pages."
          tabIndex={0}
          onKeyDown={onKey}
        >
          <div
            ref={bookRef}
            key={single ? "one" : "spread"}
            className={`mg-book ${single ? "is-single" : ""}`}
            style={single ? undefined : { transform: "translate3d(-25%,0,0)" }}
          >
            <i className="mg-floor l" />
            <i className="mg-floor r" />
            <i className="mg-edge l" />
            <i className="mg-edge r" />
            <div className="mg-base is-hidden" style={{ zIndex: 1 }}>
              {backBoard}
            </div>
            {leaves}
            <i className="mg-cast l" />
            <i className="mg-cast r" />
            <i className="mg-spine" />
          </div>
          <p ref={statusRef} className="sr-only" aria-live="polite" />
        </div>
      </div>
    </section>
  );
}
