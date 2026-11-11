"use client";

import { useEffect, useRef, type CSSProperties } from "react";

/** People who asked for less motion, or to save data, get the poster and no autoplay. */
export function quietMedia() {
  if (typeof window === "undefined") return true;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches || !!saveData;
}

type Props = {
  src: string;
  webm?: string;
  poster: string;
  className?: string;
  style?: CSSProperties;
  /** play only while this is true (a hovered preview); default: whenever it's on screen */
  active?: boolean;
  /** loop from this second instead of 0 (skips a cold open) */
  from?: number;
  /** load eagerly (the hero) instead of on approach */
  eager?: boolean;
};

/**
 * A muted, looping clip that plays only while it's on screen (and, for previews, while it's the
 * active one), so a page full of them costs almost nothing. Decorative: the words around it
 * carry the meaning, so it's hidden from screen readers.
 */
export default function LoopVideo({ src, webm, poster, className = "", style, active = true, from = 0, eager = false }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const visible = useRef(false);
  const want = useRef(active);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const quiet = quietMedia();
    const sync = () => {
      if (quiet) return;
      if (visible.current && want.current && document.visibilityState === "visible") {
        if (v.preload !== "auto") v.preload = "auto";
        v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible.current = e.isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    io.observe(v);
    // loop from a later point than the file's start
    const onEnded = () => {
      v.currentTime = from;
      sync();
    };
    const onMeta = () => {
      if (from > 0 && v.currentTime < from) v.currentTime = from;
    };
    v.addEventListener("ended", onEnded);
    v.addEventListener("loadedmetadata", onMeta);
    document.addEventListener("visibilitychange", sync);
    (v as HTMLVideoElement & { __sync?: () => void }).__sync = sync;
    return () => {
      io.disconnect();
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("loadedmetadata", onMeta);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [from]);

  // a preview became (in)active: a newly chosen one starts its little story from the top
  useEffect(() => {
    const v = ref.current as (HTMLVideoElement & { __sync?: () => void }) | null;
    if (v && active && !want.current && v.readyState >= 1) v.currentTime = from;
    want.current = active;
    v?.__sync?.();
  }, [active, from]);

  return (
    <video
      ref={ref}
      className={className}
      style={style}
      poster={poster}
      muted
      playsInline
      loop={from === 0}
      preload={eager ? "auto" : "metadata"}
      aria-hidden="true"
      tabIndex={-1}
      disablePictureInPicture
    >
      {webm && <source src={webm} type="video/webm" />}
      <source src={src} type="video/mp4" />
    </video>
  );
}
