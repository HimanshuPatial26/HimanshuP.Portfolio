"use client";

import { useEffect, useRef, useState } from "react";
import { useIntroRevealed } from "@/hooks/useClientFlags";

/**
 * The blue "hp" tile, hand-drawn: when the intro lifts, the h and p draw themselves stroke by
 * stroke and the dot pops in last; hovering draws it again. It stays drawn (static) for people
 * who prefer less motion, or if script never runs.
 */
export default function HpLogo({ className = "" }: { className?: string }) {
  const revealed = useIntroRevealed();
  // "drawn" is the safe default (server render, no JS); the browser hides it until the intro lifts
  const [state, setState] = useState<"drawn" | "hidden" | "play">("drawn");
  const busy = useRef(false);
  const timer = useRef(0);

  const play = () => {
    if (busy.current) return;
    busy.current = true;
    setState("hidden");
    // two frames so the reset is painted before the strokes start again
    requestAnimationFrame(() => requestAnimationFrame(() => setState("play")));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => (busy.current = false), 1500);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!revealed) {
      // behind the intro curtain: hide the strokes so they can draw in when it lifts
      const id = requestAnimationFrame(() => setState("hidden"));
      return () => cancelAnimationFrame(id);
    }
    const id = window.setTimeout(play, 250);
    return () => window.clearTimeout(id);
  }, [revealed]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <svg
      viewBox="0 0 36 36"
      width="36"
      height="36"
      role="img"
      aria-label="Himanshu Patial"
      data-state={state}
      onPointerEnter={() => {
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) play();
      }}
      className={`hp-logo ${className}`}
    >
      <rect width="36" height="36" rx="2" fill="#0146F9" />
      <g fill="none" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="square" strokeLinejoin="miter">
        <path pathLength={1} d="M8.5 8.5V25.5" />
        <path pathLength={1} d="M8.5 17.6C8.5 14.6 10.4 13.2 12.6 13.2C14.8 13.2 16.6 14.6 16.6 17.6V25.5" />
        <path pathLength={1} d="M20.6 13.4V29" />
        <circle pathLength={1} cx="24.4" cy="19.4" r="4.6" />
      </g>
      <circle className="hp-dot" cx="30.2" cy="6" r="1.4" fill="#ffffff" />
    </svg>
  );
}
