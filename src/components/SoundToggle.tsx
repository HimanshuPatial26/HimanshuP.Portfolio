"use client";

import { useSyncExternalStore } from "react";
import { isSoundOn, setSound, subscribeSound } from "@/lib/sound";

/** Speaker button beside the theme switch. Sound starts off on every visit. */
export default function SoundToggle() {
  const on = useSyncExternalStore(subscribeSound, isSoundOn, () => false);

  return (
    <button
      type="button"
      data-chrome
      onClick={() => setSound(!on)}
      aria-pressed={on}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      data-tip={on ? "Sound off" : "Sound on"}
      className="tip cursor-target fixed top-5 right-[calc(clamp(1rem,4vw,2rem)+11.5rem)] z-[45] grid size-[2.35rem] place-items-center rounded-full border border-line-strong bg-[color-mix(in_srgb,var(--text)_6%,transparent)] text-text backdrop-blur transition-colors hover:bg-[color-mix(in_srgb,var(--text)_12%,transparent)]"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" fill="currentColor" />
        {on ? (
          <>
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </>
        ) : (
          <path d="m16 9 5 6m0-6-5 6" />
        )}
      </svg>
      {/* quiet equaliser bars while playing */}
      {on && (
        <span className="pointer-events-none absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-[2px]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="eq-bar block w-[2px] rounded-full bg-text" style={{ animationDelay: `${i * 0.18}s` }} />
          ))}
        </span>
      )}
    </button>
  );
}
