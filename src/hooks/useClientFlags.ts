"use client";

import { useEffect, useState } from "react";

/** True once web fonts are ready, so canvas-drawn text uses the real typeface. */
export function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const done = () => alive && setReady(true);
    if (typeof document !== "undefined" && document.fonts?.ready) {
      document.fonts.ready.then(done, done);
    } else {
      done();
    }
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/** True on devices with a precise pointer that can hover (mouse / trackpad). */
export function useFinePointer() {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return fine;
}

/** True once the intro curtain starts lifting (or has already finished). */
export function useIntroRevealed() {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const w = window as unknown as { __introDone?: boolean };
    const on = () => setRevealed(true);
    if (w.__introDone) {
      queueMicrotask(on);
      return;
    }
    window.addEventListener("intro:reveal", on);
    window.addEventListener("intro:done", on);
    return () => {
      window.removeEventListener("intro:reveal", on);
      window.removeEventListener("intro:done", on);
    };
  }, []);
  return revealed;
}

/** True when the viewport is at least `px` wide. */
export function useMinWidth(px: number) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const update = () => setMatch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [px]);
  return match;
}
