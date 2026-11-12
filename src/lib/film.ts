/**
 * Shared per-frame state for the cinematic layers.
 *
 * Written by the 3D scene (morph, chapter, grade, velocity, formed, quality) and
 * the opening (intro, warp, forceBars); read every frame by the letterbox,
 * chapter cards and sound. A plain mutable object on purpose: these values
 * change 60 times a second and must never trigger React renders.
 */
export const film = {
  /** 0..1 particles gathered into the first shape (the opening drives this) */
  intro: 0,
  /** 0..1 starfield streaming toward the camera during the opening */
  warp: 0,
  /** 0..1 letterbox held closed (opening, page changes) */
  forceBars: 1,
  /** 0..1, peaks halfway through a shape change */
  morph: 0,
  /** 0..1 progress through the current shape change */
  mix: 0,
  /** label of the section being entered during a shape change ("" if none) */
  chapter: "",
  chapterNo: "",
  /** label of the section above it in the same change: the one being entered when scrolling up */
  chapterFrom: "",
  chapterFromNo: "",
  /** -1 AI blue .. 0 neutral .. +1 Growth orange */
  grade: 0,
  /** scroll speed in viewport heights per second (signed) */
  velocity: 0,
  /** shape currently held still ("" while changing) */
  formed: "",
  /** true when the visitor asked for reduced motion */
  reduced: false,
  /** 0 = lightest device tier … 3 = strongest */
  tier: 3,
  /** what the scene can afford right now: 3 = glass + bloom … 0 = plain chrome (steps down on slow frames) */
  quality: 3,
};

export type Film = typeof film;

// development only: poke the state from the console (e.g. __film.intro = 0; __film.warp = 1)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as { __film?: Film }).__film = film;
}
