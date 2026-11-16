"use client";

import { useEffect, useRef } from "react";

/** What goes in, what comes out, and the proof from the resume. */
const PAIRS = [
  { from: "support tickets", to: "products", proof: "Three years on the support desk, then product" },
  { from: "students' questions", to: "an AI tutor", proof: "Doubt Mate · RAG keeps answers in the course" },
  { from: "sales calls", to: "insights", proof: "AI Call Analysis · +8–10% quality-team productivity" },
  { from: "buyer intent", to: "conversions", proof: "AI-Convert · ₹4M (~US $50K) a month" },
  { from: "failed payments", to: "recovered revenue", proof: "WhatsApp recovery · +10–15% successful transactions" },
];
const HOLD = 2600; // ms each pair stays
const ROW = 1.14; // em, one row of a reel
const REEL = [...PAIRS, PAIRS[0]]; // the first pair again at the end, so the wheel rolls on round

/**
 * The hero's manifesto, "Wheel": "I turn [support tickets] into [products]." Each slot is a reel
 * holding every word; every few seconds both reels roll on one row (the outcome a beat after
 * the input) and the bracket and the highlight ease to the new word's width. The proof under
 * the line changes with the pair. Hovering the line holds it; a hidden tab skips turns; reduced
 * motion keeps the first pair. Screen readers get the whole sentence once, as plain text.
 */
export default function ManifestoLine({ active, className = "" }: { active: boolean; className?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const slots = Array.from(root.querySelectorAll<HTMLElement>(".mf-slot"));
    const reels = slots.map((s) => s.querySelector<HTMLElement>(".mf-reel"));
    const proof = root.querySelector<HTMLElement>(".mf-proof");
    if (!proof || reels.some((r) => !r)) return;
    let i = 0;
    // each slot is as wide as the word it shows
    const fit = () =>
      slots.forEach((s, k) => {
        const w = reels[k]?.children[i] as HTMLElement | undefined;
        if (w) s.style.setProperty("--mfw", `${w.offsetWidth}px`);
      });
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => window.removeEventListener("resize", fit);

    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        fn();
      }, ms);
      timers.add(t);
    };
    const next = () => {
      const to = i + 1; // PAIRS.length lands on the copy of the first pair
      slots.forEach((s, k) =>
        later(() => {
          const reel = reels[k];
          const w = reel?.children[to] as HTMLElement | undefined;
          if (!reel || !w) return;
          reel.style.transition = "";
          reel.style.transform = `translateY(${-to * ROW}em)`;
          s.style.setProperty("--mfw", `${w.offsetWidth}px`);
        }, k ? 380 : 0),
      );
      i = to % PAIRS.length;
      proof.textContent = PAIRS[i].proof;
      proof.style.animation = "none";
      void proof.offsetWidth;
      proof.style.animation = "";
      // round the end: once the copy has rolled in, jump both reels back to the top unseen
      if (to === PAIRS.length)
        later(() => reels.forEach((r) => {
          if (!r) return;
          r.style.transition = "none";
          r.style.transform = "translateY(0)";
        }), 380 + 950);
    };
    let paused = false;
    const hold = () => (paused = true);
    const free = () => (paused = false);
    root.addEventListener("pointerenter", hold);
    root.addEventListener("pointerleave", free);
    let loop = 0;
    const tick = () => {
      if (!paused && !document.hidden) next();
      loop = window.setTimeout(tick, HOLD);
    };
    loop = window.setTimeout(tick, HOLD);
    return () => {
      window.clearTimeout(loop);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", fit);
      root.removeEventListener("pointerenter", hold);
      root.removeEventListener("pointerleave", free);
    };
  }, [active]);

  return (
    <div ref={rootRef} className={`mf ${className}`}>
      <p className="sr-only">
        I turn {PAIRS.map((p, k) => `${k === PAIRS.length - 1 ? "and " : ""}${p.from} into ${p.to}`).join(", ")}.
      </p>
      <p className="mf-line" aria-hidden="true">
        <span className="mf-row">
          <span className="mf-lab">I turn</span>
          {/* the widths here are only a first guess for before the script measures them */}
          <span className="mf-slot mf-x" style={{ "--mfw": "7.65em" } as React.CSSProperties}>
            <span className="mf-reel">
              {REEL.map((p, k) => (
                <span key={k}>{p.from}</span>
              ))}
            </span>
          </span>
        </span>
        <span className="mf-row">
          <span className="mf-lab">into</span>
          <span className="mf-slot mf-y" style={{ "--mfw": "4.5em" } as React.CSSProperties}>
            <span className="mf-reel">
              {REEL.map((p, k) => (
                <span key={k}>{p.to}</span>
              ))}
            </span>
          </span>
          <span className="mf-dot">.</span>
        </span>
      </p>
      <p className="mf-proof" aria-hidden="true">
        {PAIRS[0].proof}
      </p>
    </div>
  );
}
