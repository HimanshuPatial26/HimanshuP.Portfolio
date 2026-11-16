import type { GauzeBlazeProps } from "@/components/originkit/ui/hero-58/gauze-blaze";
import type { Theme } from "@/hooks/useTheme";

/** Himanshu's GauzeBlaze presets for the hero wave, one per site theme (from his wave project). */
export const WAVE_THEMES: Record<Theme, GauzeBlazeProps> = {
  // Soft blue gauze drawn as ink on white (Hero 58's light look).
  light: {
    ground: "light",
    background: "#ffffff",
    baseColor: "#2F6FE0",
    midColor: "#4F94F0",
    accentColor: "#7FB2F5",
    particles: 160,
    speed: 40,
    advanced: { coreColor: "#2F6FE0", exposure: 450, lineOpacity: 80, haze: 0, vignette: 0, edgeGlow: 80 },
  },
  // Indigo gauze with a gold core: the reference GauzeBlaze preset.
  dark: {
    background: "#030207",
    baseColor: "#4A4DFF",
    midColor: "#362AFF",
    accentColor: "#1A1EFF",
    particles: 205,
    speed: 50,
    advanced: {
      sheets: 4,
      lineCount: 56,
      ribbonWidth: 12,
      centerY: 50,
      waveLength: 45,
      twistLength: 140,
      lineWidth: 100,
      lineOpacity: 38,
      speckle: 40,
      backDim: 45,
      coreColor: "#FFD36A",
      coreGain: 300,
      edgeGlow: 160,
      glowSize: 24,
      exposure: 300,
      hazeColor: "#1A0A2E",
      haze: 40,
      vignette: 20,
      grain: 0,
      emberSize: 100,
      emberLife: 100,
      emberRise: 5,
      emberDrift: 3,
      travel: 20,
      twistMs: 30000,
      breathe: 15,
      breatheMs: 8000,
      hover: 50,
      pointerLift: 35,
      pointerRadius: 20,
    },
  },
};
