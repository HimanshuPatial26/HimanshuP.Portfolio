import type { Theme } from "@/hooks/useTheme";

/**
 * Himanshu's two Originkit presets for the loading screen's Wobbling Lattice Sphere.
 * Dark is the preset baked into the component file (blue lattice, white nodes, grey halo);
 * light is the one he tuned for the light theme (blue lattice, black nodes and halo).
 * The canvas is drawn transparent either way, so the loader's own ground shows through
 * (his light preset's white background would read as a box on the site's grey).
 */
const SHARED = {
  grain: 10,
  cycleMs: 3200,
  gridDot: 2,
  gridGap: 24,
  coreGlow: 18,
  cubeHold: 65,
  nodeSize: 3,
  rimWidth: 3,
  vignette: 0,
  depthFade: 30,
  lineWidth: 1,
  haloLobes: 9,
  haloWidth: 14,
  rayLength: 210,
  cloudCount: 320,
  cloudInner: 108,
  cloudOuter: 200,
  haloRipple: 5,
  innerRatio: 48,
  rayOpacity: 35,
  rimOpacity: 90,
  sweepStart: 235,
  bandOpacity: 4,
  edgeOpacity: 55,
  gridOpacity: 70,
  perspective: 400,
  cloudOpacity: 80,
  cloudSpacing: 26,
  floorOpacity: 12,
  innerOpacity: 55,
  innerDivisions: 5,
};

export const SPHERE_THEMES: Record<Theme, { baseColor: string; advanced: Record<string, number | string> }> = {
  dark: {
    baseColor: "#0011FF",
    advanced: { ...SHARED, gridColor: "#6A6A6A", haloColor: "#6A6A6A", nodeColor: "#FFFFFF", haloOpacity: 30 },
  },
  light: {
    baseColor: "#0011FF",
    advanced: { ...SHARED, gridColor: "#4D4D4D", haloColor: "#000000", nodeColor: "#000000", haloOpacity: 28 },
  },
};
