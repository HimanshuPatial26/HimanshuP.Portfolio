"use client";

import MaskName from "@/components/hero/MaskName";
import HeroWave from "@/components/hero/HeroWave";
import ManifestoLine from "@/components/hero/ManifestoLine";
import { Chip, Roll } from "@/components/Buttons";
import { useIntroRevealed } from "@/hooks/useClientFlags";
import { profile } from "@/data/resume";

const NAME_LINES = ["Himanshu", "Patial"];

/**
 * Hero: the name huge and centred, at the exact middle of the screen (a three-row grid whose outer
 * rows are always equal), over the Gauze Blaze wave (the hero's own backdrop; the 3D scene shows
 * no object here). Just above it, the open-to-roles tag and the role; below it, a clear gap and
 * the manifesto line ("I turn [support tickets] into [products].", its words rolling on reels)
 * with its proof. Along the foot: the scroll cue in the middle, the resume and LinkedIn on the
 * right (stacked and centred on phones). The section and its text let the pointer through to the
 * wave behind them, except the name, the line, the cue and the buttons.
 */
export default function Hero() {
  const revealed = useIntroRevealed();
  const fade = `transition-all duration-1000 ease-out ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;

  return (
    <section
      id="top"
      data-shape="none"
      data-pose="center"
      data-chapter="Home"
      data-chapter-no="00"
      className="pointer-events-none relative grid h-[100svh] min-h-[640px] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] overflow-hidden"
    >
      <h1 className="sr-only">
        {profile.name}, {profile.title}
      </h1>

      {/* the wave behind everything in the hero */}
      <HeroWave revealed={revealed} />

      {/* above the name: the tag and the role */}
      <div className={`relative z-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 self-end px-4 pb-[4vh] text-center delay-500 ${fade}`}>
        <p className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-mono text-[10px] tracking-[0.06em] text-muted uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-blue" aria-hidden="true" />
          Open to AI &amp; Growth PM roles
        </p>
        <p className="text-[13px] text-muted">
          <span className="text-ai">AI</span> &amp; Growth Product Manager · {profile.location}
        </p>
      </div>

      {/* the name, at the middle of the screen */}
      <div className="relative z-10 flex justify-center overflow-x-clip px-3" aria-hidden="true">
        <MaskName lines={NAME_LINES} revealed={revealed} className="cursor-target text-text" />
      </div>

      {/* below it: the manifesto */}
      <div className="relative z-10 flex flex-col items-center self-start px-3">
        <ManifestoLine active={revealed} className={`mt-[5vh] delay-700 md:mt-[7vh] ${fade}`} />
      </div>

      {/* the foot: the scroll cue in the middle, the resume and LinkedIn on the right */}
      <div className={`absolute inset-x-0 bottom-0 z-10 delay-1000 ${fade}`}>
        <div className="relative flex flex-col items-center gap-5 px-4 pb-[5vh] sm:px-6 md:flex-row md:justify-end md:px-8">
          <a
            href="#about"
            aria-label="Scroll down to About"
            className="hero-scroll cursor-target pointer-events-auto md:absolute md:bottom-[5vh] md:left-1/2 md:-translate-x-1/2"
          >
            <span className="hero-scroll-mouse" aria-hidden="true" />
            <span className="hero-scroll-label">Scroll</span>
          </a>
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
            <a href={profile.resumeUrl} download className="btn btn-primary cursor-target">
              <Roll text="Download resume" />
              <Chip dir="s" />
            </a>
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile (opens in a new tab)" className="btn btn-line cursor-target">
              <Roll text="LinkedIn" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
