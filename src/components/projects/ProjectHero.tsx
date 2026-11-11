"use client";

import { ViewTransition, useEffect, useRef, useState } from "react";
import LoopVideo from "@/components/projects/LoopVideo";
import type { BuiltProject } from "@/data/projects";

type Lenis = { stop: () => void; start: () => void; scrollTo: (t: HTMLElement | string, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: Lenis }).__lenis;

function Play({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
    </svg>
  );
}

/** The film with sound, in a modal player. Opened by a click, so the browser lets it play aloud. */
function FilmDialog({ open, onClose, p }: { open: boolean; onClose: () => void; p: BuiltProject }) {
  const ref = useRef<HTMLDialogElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const d = ref.current;
    const v = vid.current;
    if (!d || !v) return;
    if (open && !d.open) {
      d.showModal();
      lenis()?.stop();
      v.currentTime = 0;
      v.play().catch(() => {});
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const closed = () => {
    vid.current?.pause();
    lenis()?.start();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onClose={closed}
      onClick={(e) => e.target === e.currentTarget && ref.current?.close()}
      aria-label={`${p.name}: the film`}
      className="film-dialog m-auto max-h-none max-w-none bg-transparent p-0 text-text backdrop:bg-black/80"
    >
      <div className="relative w-[min(92vw,calc(84svh*16/9))]">
        <div className="aspect-video overflow-hidden rounded-2xl border border-white/15 bg-black shadow-[0_40px_120px_rgb(0_0_0/.7)]">
          <video ref={vid} src={p.video.film} poster={p.video.scrubPoster} controls playsInline preload="none" className="size-full" />
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] tracking-[0.16em] text-white/60 uppercase">
            {p.name} · the film · {p.video.filmLength}
          </p>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="cursor-target rounded-full border border-white/25 px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-white uppercase transition-colors hover:bg-white/10"
          >
            Close <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * The project's first screen: a huge title over the film. The clip is the same element the
 * Projects preview grew from (a shared view-transition name), so entering feels like zooming in.
 */
export default function ProjectHero({ p, index, total }: { p: BuiltProject; index: number; total: number }) {
  const [open, setOpen] = useState(false);
  const long = p.name.length > 10;
  const toChapter = (id: string) => {
    const el = document.getElementById(`ch-${id}`);
    if (!el) return;
    const l = lenis();
    if (l) l.scrollTo(el, { offset: -window.innerHeight * 0.18, duration: 1.4 });
    else el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative mx-auto max-w-7xl px-4 pt-28 sm:px-6 sm:pt-32">
      <div className="rise-in flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* plain <a>: RouteTransition takes it back to the list */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/#projects" className="cursor-target inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-muted uppercase hover:text-text">
          <span aria-hidden="true">←</span> All projects
        </a>
        <span className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">
          04 / Projects · Built {String(index + 1).padStart(2, "0")} of {String(total).padStart(2, "0")}
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

      {/* short names sit beside the tagline; longer ones take the full width on one line */}
      <div className={`mt-4 grid gap-5 md:mt-2 md:items-end ${long ? "" : "md:grid-cols-[1fr_minmax(0,22rem)]"}`}>
        <h1
          className={`rise-in leading-[0.86] tracking-[-0.05em] whitespace-nowrap ${long ? "text-[clamp(2.4rem,9.6vw,9rem)]" : "text-[clamp(2.9rem,12.5vw,10.5rem)]"}`}
          style={{ animationDelay: "80ms" }}
        >
          {p.name}
        </h1>
        <p className={`rise-in text-base leading-relaxed text-muted md:pb-4 ${long ? "max-w-xl" : "md:text-right"}`} style={{ animationDelay: "160ms" }}>
          {p.tagline}
        </p>
      </div>

      <ViewTransition name={`film-${p.slug}`} share="morph" default="none">
        <div
          className="relative mt-8 aspect-video overflow-hidden rounded-[22px] border border-white/12 bg-[#0b0b0b] md:mt-10 md:rounded-[28px]"
          style={{ boxShadow: "0 0 120px rgb(var(--p-rgb) / .18), 0 40px 100px rgb(0 0 0 / .45)" }}
        >
          <LoopVideo src={p.video.scrub} poster={p.video.scrubPoster} from={p.video.heroFrom} eager className="absolute inset-0 size-full object-cover" />
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="cursor-target bg-black/50 backdrop-blur-md absolute top-5 left-5 hidden items-center gap-3 rounded-full border border-white/15 py-1.5 pr-4 pl-1.5 text-white sm:flex"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[var(--p-acc)] text-black">
              <Play className="size-3" />
            </span>
            <span className="text-sm font-medium">Play the film</span>
            <span className="font-mono text-[10.5px] tracking-[0.14em] text-white/60 uppercase">{p.video.filmLength} · sound on</span>
          </button>
          <span className="bg-black/50 backdrop-blur-md absolute top-5 right-5 hidden rounded-lg border border-white/15 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.16em] text-white/70 uppercase sm:block">
            Muted loop
          </span>
          {/* the chapters, docked along the film's foot */}
          <nav aria-label="Chapters" className="bg-black/50 backdrop-blur-md absolute inset-x-3 bottom-3 hidden items-center justify-between gap-4 rounded-2xl border border-white/12 px-5 py-3 sm:inset-x-5 sm:bottom-5 md:flex">
            <ol className="flex flex-wrap gap-x-6 gap-y-1">
              {p.chapters.map((c, i) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => toChapter(c.id)}
                    className="cursor-target font-mono text-[10.5px] tracking-[0.16em] text-white/60 uppercase transition-colors hover:text-white"
                  >
                    <span className="text-[var(--p-acc)]">{String(i + 1).padStart(2, "0")}</span> {c.label}
                  </button>
                </li>
              ))}
            </ol>
            <span className="font-mono text-[10.5px] tracking-[0.16em] text-white/50 uppercase">Scroll to play ↓</span>
          </nav>
        </div>
      </ViewTransition>

      {/* phones: the play button sits under the film, so it doesn't cover the film's own words */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="cursor-target mt-4 flex items-center gap-3 rounded-full border border-line-strong py-1.5 pr-4 pl-1.5 sm:hidden"
      >
        <span className="grid size-8 place-items-center rounded-full bg-[var(--p-acc)] text-black">
          <Play className="size-3" />
        </span>
        <span className="text-sm font-medium">Play the film</span>
        <span className="font-mono text-[10.5px] tracking-[0.14em] text-muted uppercase">{p.video.filmLength} · sound on</span>
      </button>

      <FilmDialog open={open} onClose={() => setOpen(false)} p={p} />
    </section>
  );
}
