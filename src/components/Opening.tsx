"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";
import { film } from "@/lib/film";

const SEEN_KEY = "hp-opening-seen";

type Stage = { scene: boolean; particles: boolean; type: boolean; frame: boolean };

const STEPS: { key: keyof Stage; label: string }[] = [
  { key: "scene", label: "Fetching the 3D scene" },
  { key: "particles", label: "Shaping the glass" },
  { key: "type", label: "Setting the type" },
  { key: "frame", label: "Framing the first shot" },
];

/** One digit as a wheel: 0–9 stacked, rolled to the current digit. */
function Wheel({ digit, dim }: { digit: number; dim: boolean }) {
  return (
    <span className={`counter-wheel ${dim ? "text-faint/40" : ""}`}>
      <span style={{ transform: `translateY(${-digit * 10}%)` }}>
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * The opening. First a boot readout: a large percentage counter whose digits
 * roll like a watch's date wheels, beside the four real loading steps ticking
 * off as they finish (3D file, particle sampling, fonts, first frame), over the
 * Blender render of the hero's glass orb developing as the page loads. At 100
 * the readout collapses to a thin line like an old screen switching off, and
 * the scene takes over: particles stream in like a starfield, gather into the
 * globe, the name lands and the letterbox opens.
 *
 * Plays in full once per browser session; after that a short version. Skip
 * (button or Esc) fast-forwards. Reduced motion goes straight to the page.
 * Drives film.intro / film.warp / film.forceBars; fires "intro:reveal" and "intro:done".
 */
export default function Opening() {
  const coverRef = useRef<HTMLDivElement>(null);
  const readoutRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const [gone, setGone] = useState(false);
  const [count, setCount] = useState(0);
  const [stage, setStage] = useState<Stage>({ scene: false, particles: false, type: false, frame: false });

  useEffect(() => {
    const cover = coverRef.current;
    if (!cover) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const html = document.documentElement;
    html.style.overflow = "hidden";
    html.dataset.opening = "playing"; // hides the header chrome until the name lands

    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {}

    // what has actually finished loading
    let loaded = 0;
    let sceneReady = Boolean((window as unknown as { __sceneReady?: boolean }).__sceneReady);
    let fontsReady = false;
    const onProgress = (e: Event) => {
      loaded = Math.max(loaded, (e as CustomEvent<number>).detail ?? 0);
    };
    const onReady = () => {
      sceneReady = true;
      loaded = 1;
    };
    window.addEventListener("scene:progress", onProgress);
    window.addEventListener("scene:ready", onReady);
    document.fonts?.ready.then(() => (fontsReady = true));
    if (!document.fonts) fontsReady = true;

    let started = false;
    let skipped = false;
    let tl: gsap.core.Timeline | null = null;
    const start = performance.now();
    const MIN_MS = reduce ? 0 : 1600; // the counter always gets a moment on screen
    const MAX_MS = 8000;

    const reveal = () => {
      html.style.overflow = "";
      delete html.dataset.opening;
      try {
        sessionStorage.setItem(SEEN_KEY, "1");
      } catch {}
      window.dispatchEvent(new Event("intro:reveal"));
    };
    const done = () => {
      film.intro = 1;
      film.warp = 0;
      film.forceBars = 0;
      (window as unknown as { __introDone?: boolean }).__introDone = true;
      window.dispatchEvent(new Event("intro:done"));
      setGone(true);
    };

    const play = () => {
      if (started) return;
      started = true;
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      const skip = skipRef.current;
      const wheels = readoutRef.current?.querySelectorAll(".counter-wheel, .counter-pct");
      const log = readoutRef.current?.querySelectorAll("[data-log]");

      if (reduce) {
        film.intro = 1;
        film.warp = 0;
        film.forceBars = 0;
        reveal();
        gsap.to(cover, { autoAlpha: 0, duration: 0.2, onComplete: done });
        return;
      }

      tl = gsap.timeline({ onComplete: done });
      // exit of the readout: digits roll away, the screen folds to a line and goes out
      tl.to(wheels ?? [], { yPercent: -110, duration: 0.55, ease: "power3.in", stagger: 0.06 }, 0.15)
        .to(log ?? [], { autoAlpha: 0, x: 12, duration: 0.35, stagger: 0.04 }, 0.15)
        .to(cover, { clipPath: "inset(49.6% 0% 49.6% 0%)", duration: 0.7, ease: "expo.inOut" }, 0.55)
        .to(cover, { autoAlpha: 0, duration: 0.35 }, 1.2);
      const T = 1.25; // the scene takes over from here

      if (seen || skipped) {
        // short version: gather and go
        tl.to(film, { intro: 1, duration: 1.6, ease: "power2.out" }, T - 0.4)
          .call(reveal, [], T)
          .to(film, { forceBars: 0, duration: 1, ease: "expo.inOut" }, T + 0.2)
          .to(skip, { autoAlpha: 0, duration: 0.3 }, 0);
        return;
      }
      // chrome droplets fly in from all sides and pull together into the liquid blob
      tl.to(film, { intro: 1, duration: 2.6, ease: "power2.inOut" }, T - 0.3)
        .call(reveal, [], T + 1.9)
        .to(skip, { autoAlpha: 0, duration: 0.3 }, T + 1.9)
        .to(film, { forceBars: 0, duration: 1.3, ease: "expo.inOut" }, T + 2.1);
    };

    const onSkip = () => {
      skipped = true;
      if (tl) tl.timeScale(5);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSkip();
    };
    const skipBtn = skipRef.current;
    skipBtn?.addEventListener("click", onSkip);
    window.addEventListener("keydown", onKey);

    // the counter: real progress (fonts 15%, 3D file 60%, particles 25%), never faster than MIN_MS
    let raf = 0;
    let shown = 0;
    let last = start;
    let lastCount = -1;
    let lastStage = "";
    const tick = () => {
      const now = performance.now();
      const elapsed = now - start;
      const real = 0.15 * (fontsReady ? 1 : 0) + 0.6 * Math.min(1, loaded) + 0.25 * (sceneReady ? 1 : 0);
      const goal = Math.min(real, MIN_MS ? elapsed / MIN_MS : 1);
      shown += (goal - shown) * (1 - Math.exp(-(now - last) / 140));
      last = now;
      const n = Math.min(100, Math.round(shown * 100));
      if (n !== lastCount) {
        lastCount = n;
        setCount(n);
      }
      if (barRef.current) barRef.current.style.transform = `scaleX(${shown.toFixed(3)})`;
      // the rendered ring develops behind the readout as the site loads
      if (posterRef.current) {
        posterRef.current.style.opacity = (0.55 * shown).toFixed(3);
        posterRef.current.style.transform = `scale(${(1.06 - 0.06 * shown).toFixed(4)})`;
      }
      const st: Stage = { scene: loaded >= 0.999 || sceneReady, particles: sceneReady, type: fontsReady, frame: n >= 100 };
      const key = JSON.stringify(st);
      if (key !== lastStage) {
        lastStage = key;
        setStage(st);
      }
      if ((sceneReady && fontsReady && n >= 100) || elapsed > MAX_MS) {
        if (n < 100) setCount(100);
        setStage({ scene: true, particles: true, type: true, frame: true });
        play();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      tl?.kill();
      skipBtn?.removeEventListener("click", onSkip);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scene:progress", onProgress);
      window.removeEventListener("scene:ready", onReady);
      html.style.overflow = "";
      delete html.dataset.opening;
    };
  }, []);

  if (gone) return null;

  const digits = String(count).padStart(3, "0").split("").map(Number);
  const activeIdx = STEPS.findIndex((s) => !stage[s.key]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      {/* the boot readout */}
      <div ref={coverRef} className="opening-cover pointer-events-auto absolute inset-0 bg-bg">
        <div className="film-horizon absolute inset-0" aria-hidden="true" />
        {/* the hero's glass orb, rendered offline in Blender (the live one forms from droplets after this) */}
        <div ref={posterRef} className="absolute inset-0 opacity-0" aria-hidden="true">
          <Image src="/posters/orb.png" alt="" fill sizes="100vw" className="object-contain" />
        </div>
        <div ref={readoutRef} className="relative flex h-full flex-col justify-between p-6 sm:p-10">
          <div className="flex flex-col gap-1.5 font-mono text-[11px] tracking-[0.25em] text-faint uppercase">
            <span>Himanshu Patial</span>
            <span>
              <span className="text-ai">AI</span> &amp; <span className="text-growth">Growth</span> PM
            </span>
          </div>

          <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
            <p className="counter flex items-start font-display leading-[0.8] text-text" role="status" aria-live="polite" aria-label={`Loading, ${count} percent`}>
              {digits.map((d, i) => (
                <Wheel key={i} digit={d} dim={i < digits.length - 1 && digits.slice(0, i + 1).every((x) => x === 0)} />
              ))}
              <span className="counter-pct ml-[0.04em] text-[0.32em] text-ai">%</span>
            </p>

            <ol className="w-full max-w-[21rem] space-y-2.5 pb-2 font-mono text-[11px] tracking-[0.14em] uppercase" aria-hidden="true">
              {STEPS.map((s, i) => {
                const done = stage[s.key];
                const active = i === activeIdx;
                return (
                  <li key={s.key} data-log className="flex items-baseline gap-3">
                    <span className="text-faint">{String(i + 1).padStart(2, "0")}</span>
                    <span className={done ? "text-text" : active ? "text-muted" : "text-faint/60"}>{s.label}</span>
                    <span className="mx-1 flex-1 translate-y-[-3px] border-b border-dotted border-line-strong" />
                    <span className={done ? "text-growth" : active ? "animate-pulse text-muted" : "text-faint/60"}>
                      {done ? "done" : active ? "····" : "—"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-px bg-line">
          <div ref={barRef} className="h-px origin-left scale-x-0 bg-gradient-to-r from-ai via-text to-growth" />
        </div>
      </div>

      <button
        ref={skipRef}
        type="button"
        className="cursor-target pointer-events-auto absolute top-5 right-5 rounded-full border border-line-strong bg-bg/40 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-muted uppercase backdrop-blur transition-colors hover:text-text sm:top-8 sm:right-8"
      >
        Skip intro
      </button>
    </div>
  );
}
