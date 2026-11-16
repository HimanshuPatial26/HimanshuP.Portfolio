"use client";

import GauzeBlaze from "@/components/originkit/ui/hero-58/gauze-blaze";
import { useTheme } from "@/hooks/useTheme";
import { WAVE_THEMES } from "./waveThemes";

/**
 * The hero's backdrop: Gauze Blaze (Originkit, hero-58), a WebGL ribbon of light that
 * leans toward the cursor. It follows the site's theme (remounted on a change so the canvas
 * picks up the new ground), fades in as the intro reveals the page, and melts into the
 * page colour at the bottom so the next section starts clean. It pauses itself off screen.
 * Layer: z-0, above the 3D scene's canvas (-z-10), the film vignette (-z-[4]) and the page's
 * in-flow boxes (so it gets the pointer), under the hero's text (z-10).
 */
export default function HeroWave({ revealed }: { revealed: boolean }) {
  const { theme } = useTheme();
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-auto absolute inset-0 z-0 transition-opacity duration-[1600ms] ease-out ${revealed ? "opacity-100" : "opacity-0"}`}
    >
      <GauzeBlaze key={theme} {...WAVE_THEMES[theme]} />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[24svh] bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
