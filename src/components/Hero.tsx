"use client";

import Image from "next/image";
import RollName from "@/components/RollName";
import FoldWords from "@/components/FoldWords";
import Squiggle from "@/components/Squiggle";
import { DotsTag, ThinArrow } from "@/components/Tags";
import { useIntroRevealed } from "@/hooks/useClientFlags";
import { profile } from "@/data/resume";

const NAME_LINES = [
  { text: "Himanshu", accent: "ai" as const },
  { text: "Patial", accent: "growth" as const },
];

/**
 * Hero, set like an editorial poster: a "●● 2026" tag and a line of micro
 * copy at the top, the name huge and staggered over the glass orb (drawn by the
 * 3D scene behind the page), a thin arrow, and the role, the unfolding focus words and the buttons
 * along the bottom.
 */
export default function Hero() {
  const revealed = useIntroRevealed();
  const fade = `transition-all duration-1000 ease-out ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;

  return (
    <section id="top" data-shape="Shape_Globe" data-pose="center" className="relative flex h-[100svh] min-h-[640px] flex-col overflow-hidden">
      <h1 className="sr-only">
        {profile.name}, {profile.title}
      </h1>

      {/* where the live 3D can't run (no WebGL), the Blender render of the orb stands in */}
      <div className="scene-fallback pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <Image src="/posters/orb.png" alt="" fill sizes="100vw" className="object-contain" />
      </div>

      {/* micro header */}
      <div className={`relative z-10 mx-auto mt-24 flex max-w-[19rem] flex-col items-center gap-3 text-center delay-500 sm:mt-24 ${fade}`}>
        <DotsTag>2026 · {profile.location}</DotsTag>
        <p className="micro text-muted">
          Product manager shipping AI tutors, conversion engines and payment flows. Five years at Classplus, now at SP Jain.
        </p>
      </div>

      {/* the name over the glass orb */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-x-clip px-3" aria-hidden="true">
        <RollName lines={NAME_LINES} revealed={revealed} className="cursor-target text-text" />
        <ThinArrow className={`mt-6 h-9 w-4 text-muted delay-1000 ${fade}`} />
      </div>

      <div className={`relative z-10 shrink-0 delay-700 ${fade}`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pb-12 sm:px-6 md:flex-row md:items-end md:justify-between md:gap-8">
          <div className="max-w-xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-mono text-[10px] tracking-[0.06em] text-muted uppercase">
              <span className="size-1.5 animate-pulse rounded-full bg-blue" aria-hidden="true" />
              Open to AI &amp; Growth PM roles
            </p>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-2 font-display text-[clamp(1.1rem,2.2vw,1.7rem)] leading-tight text-text">
              <span>
                <span className="text-ai">AI</span> &amp; Growth PM building
              </span>
              {/* what I build, one word at a time: each unfolds like creased paper (React Bits Fold Text) */}
              <FoldWords words={profile.focusAreas} active={revealed} className="basis-full text-ai" />
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a href="#work" className="btn-arrow cursor-target">
              See my work
              <Squiggle />
            </a>
            <a href={profile.resumeUrl} download className="btn-glow cursor-target">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4" aria-hidden="true">
                <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" />
              </svg>
              Download resume
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
