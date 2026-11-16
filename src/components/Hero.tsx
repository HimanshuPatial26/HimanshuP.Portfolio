"use client";

import MaskName from "@/components/hero/MaskName";
import HeroWave from "@/components/hero/HeroWave";
import ManifestoLine from "@/components/hero/ManifestoLine";
import { Chip, Roll } from "@/components/Buttons";
import { useIntroRevealed } from "@/hooks/useClientFlags";
import { profile } from "@/data/resume";

const NAME_LINES = ["Himanshu", "Patial"];

/**
 * Hero, "Stacked": the open-to-roles tag and the role at the top, the name huge and centred
 * over the Gauze Blaze wave (the hero's own backdrop; the 3D scene shows no object here), its
 * lines sliding up into view (Mask), a clear gap, then the manifesto line ("I turn [support
 * tickets] into [products].", its words rolling on reels) with its proof, a scroll cue, and
 * the buttons at the foot. The section and its text let the pointer through to the wave
 * (which sits behind them), except the name, the line, the cue and the buttons.
 */
export default function Hero() {
  const revealed = useIntroRevealed();
  const fade = `transition-all duration-1000 ease-out ${revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`;

  return (
    <section id="top" data-shape="none" data-pose="center" data-chapter="Home" data-chapter-no="00" className="pointer-events-none relative flex h-[100svh] min-h-[640px] flex-col overflow-hidden">
      <h1 className="sr-only">
        {profile.name}, {profile.title}
      </h1>

      {/* the wave behind everything in the hero */}
      <HeroWave revealed={revealed} />

      {/* the tag and the role */}
      <div className={`relative z-10 mt-20 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-center delay-500 ${fade}`}>
        <p className="inline-flex items-center gap-2 rounded-full border border-line-strong px-3 py-1 font-mono text-[10px] tracking-[0.06em] text-muted uppercase">
          <span className="size-1.5 animate-pulse rounded-full bg-blue" aria-hidden="true" />
          Open to AI &amp; Growth PM roles
        </p>
        <p className="text-[13px] text-muted">
          <span className="text-ai">AI</span> &amp; Growth Product Manager · {profile.location}
        </p>
      </div>

      {/* the name, a clear gap, then the manifesto */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center overflow-x-clip px-3">
        <div aria-hidden="true">
          <MaskName lines={NAME_LINES} revealed={revealed} className="cursor-target text-text" />
        </div>
        <ManifestoLine active={revealed} className={`mt-[6vh] delay-700 md:mt-[10vh] ${fade}`} />
        {/* the scroll cue, centred under the line */}
        <a href="#about" aria-label="Scroll down to About" className={`hero-scroll cursor-target pointer-events-auto mt-[4vh] delay-1000 ${fade}`}>
          <span className="hero-scroll-mouse" aria-hidden="true" />
          <span className="hero-scroll-label">Scroll</span>
        </a>
      </div>

      {/* the buttons */}
      <div className={`relative z-10 flex shrink-0 justify-center px-4 pb-[6vh] delay-1000 ${fade}`}>
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3">
          <a href="#work" className="btn btn-primary cursor-target">
            <Roll text="See my work" />
            <Chip dir="s" />
          </a>
          <a href={profile.resumeUrl} download className="btn btn-line cursor-target">
            <Roll text="Download resume" />
          </a>
        </div>
      </div>
    </section>
  );
}
