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

/**
 * A project's code on GitHub: a dark circle with the GitHub mark that opens into a labelled pill on hover or
 * keyboard focus (.gh-btn in globals.css; a Uiverse.io-format button Himanshu supplied).
 */
export function GithubButton({ href, label = "Code on GitHub" }: { href: string; label?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} (opens in a new tab)`} className="gh-btn cursor-target">
      <svg className="gh-btn-icon" viewBox="0 0 496 512" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
        <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
      </svg>
      <span className="gh-btn-text" aria-hidden="true">
        GitHub
      </span>
    </a>
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
