"use client";

import { useEffect, useRef, type CSSProperties } from "react";

const GLYPHS = "#%&*+=<>/01ABCDEFKXZ";
const OUT = 240; // ms for the old words to scramble away
const IN = 640; // ms for the new ones to settle

/** Each letter's turn to settle: spread evenly through the run, but out of order. */
const turnOf = (i: number) => (i * 0.618034 + 0.13) % 1;

function scramble(text: string, q: number, leaving: boolean, tick: number) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") {
      out += ch;
      continue;
    }
    const plain = leaving ? q < turnOf(i) : q >= turnOf(i);
    out += plain ? ch : GLYPHS[(tick * 7 + i * 13) % GLYPHS.length];
  }
  return out;
}

/**
 * Text that decodes: when `text` changes, the old words scramble into glyphs and the new
 * ones settle letter by letter. With `reveal`, it decodes once as it scrolls into view.
 * The real text stays in place (hidden while the glyphs run) so the layout never jumps
 * and screen readers always get the real words.
 */
export default function DecodeText({ text, reveal = false, className, style }: { text: string; reveal?: boolean; className?: string; style?: CSSProperties }) {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const baseRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<HTMLSpanElement>(null);
  const prev = useRef(text);
  const frame = useRef(0);

  const play = (from: string, to: string) => {
    const base = baseRef.current;
    const run = runRef.current;
    if (!base || !run || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(frame.current);
    const out = from ? OUT : 0;
    const t0 = performance.now();
    base.style.visibility = "hidden";
    const step = (now: number) => {
      const e = now - t0;
      if (e >= out + IN) {
        run.textContent = "";
        base.style.visibility = "";
        return;
      }
      const tick = Math.floor(now / 55);
      run.textContent = e < out ? scramble(from, e / out, true, tick) : scramble(to, (e - out) / IN, false, tick);
      frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    const from = prev.current;
    prev.current = text;
    if (from !== text) play(from, text);
  }, [text]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!reveal || !wrap) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        play("", prev.current);
      },
      { threshold: 0.6 },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [reveal]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <span ref={wrapRef} className={`relative block ${className ?? ""}`} style={style}>
      <span ref={baseRef}>{text}</span>
      <span ref={runRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
    </span>
  );
}
