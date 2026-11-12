import type { CSSProperties, ReactNode } from "react";

/*
 * The site's buttons: "arrow bloom" × "editorial roll".
 *
 * Every button carries a chip, an arrow circle or a small blue dot. On hover the chip blooms until
 * it fills the whole button and the label flips colour; the label itself is set in Syne capitals and
 * rolls over letter by letter. Styles are in globals.css under "Buttons".
 *
 *   <Link className="btn btn-primary"><Roll text="Open project" /><Chip /></Link>
 *   <a className="btn btn-line"><Roll text="Download resume" /></a>      (the dot is drawn by CSS)
 *   <button className="link-roll"><Ring dir="play" /><Roll text="Play the film" /></button>
 *   <button className="btn-ghost"><Trace /><Roll text="Skip intro" /></button>
 */

export type Dir = "e" | "ne" | "s" | "w" | "play";

const GLYPH: Record<Dir, ReactNode> = {
  e: <path d="M2 8h11M9 4l4 4-4 4" />,
  ne: <path d="M4 12 12 4M5.5 4H12v6.5" />,
  s: <path d="M8 2v11M4 9l4 4 4-4" />,
  w: <path d="M14 8H3M7 4 3 8l4 4" />,
  play: <path d="M5 3.2v9.6L12.8 8z" fill="currentColor" stroke="none" />,
};

function Glyph({ dir }: { dir: Dir }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {GLYPH[dir]}
    </svg>
  );
}

/** The icon, twice: on hover the first shoots out along its direction and the second slides in. */
export function Ico({ dir = "e" }: { dir?: Dir }) {
  return (
    <span className="btn-ico" data-dir={dir} aria-hidden="true">
      <Glyph dir={dir} />
      <Glyph dir={dir} />
    </span>
  );
}

/** A label whose letters roll over one by one on hover. Screen readers get the plain text. */
export function Roll({ text }: { text: string }) {
  return (
    <span className="roll">
      <span className="sr-only">{text}</span>
      <span className="roll-row" aria-hidden="true">
        {/* one moving piece per letter: the letter stacked on a copy of itself, slid up a line */}
        {Array.from(text).map((c, i) => (
          <span key={i} className="roll-ch" style={{ "--i": i } as CSSProperties}>
            <span>{c}</span>
            <span>{c}</span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** The arrow circle at the end of a .btn; the button's ::before draws the circle and blooms it. */
export function Chip({ dir = "e" }: { dir?: Dir }) {
  return (
    <span className="btn-chip">
      <Ico dir={dir} />
    </span>
  );
}

/** The small ring beside a .link-roll; it fills blue from its centre on hover. */
export function Ring({ dir = "e" }: { dir?: Dir }) {
  return (
    <span className="link-ring">
      <Ico dir={dir} />
    </span>
  );
}

/** The outline of a .btn-ghost, which draws itself round the button on hover. */
export function Trace() {
  return (
    <svg className="btn-trace" aria-hidden="true">
      <rect x="0.5" y="0.5" width="100%" height="100%" rx="17.5" />
      <rect className="run" x="0.5" y="0.5" width="100%" height="100%" rx="17.5" pathLength={1} />
    </svg>
  );
}
