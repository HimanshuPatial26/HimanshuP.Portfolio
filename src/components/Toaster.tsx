"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; title: string; body?: string };

/** Show a small notification card at the bottom of the screen. */
export function toast(title: string, body?: string) {
  window.dispatchEvent(new CustomEvent<Omit<Toast, "id">>("toast", { detail: { title, body } }));
}

/**
 * Notification cards, bottom centre: slide up, stay ~3 seconds, can be closed.
 * Card design adapted from Uiverse.io by seyed-mohsen-mousavi (MIT).
 */
export default function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let id = 0;
    const timers = new Set<number>();
    const onToast = (e: Event) => {
      const t = { id: ++id, ...(e as CustomEvent<Omit<Toast, "id">>).detail };
      setItems((list) => [...list.slice(-2), t]);
      const timer = window.setTimeout(() => {
        setItems((list) => list.filter((x) => x.id !== t.id));
        timers.delete(timer);
      }, 3200);
      timers.add(timer);
    };
    window.addEventListener("toast", onToast);
    return () => {
      window.removeEventListener("toast", onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed bottom-[calc(6svh+1rem)] left-1/2 z-[110] flex w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 md:bottom-[calc(9svh+1rem)]"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className="toast-in pointer-events-auto flex h-14 items-center justify-between rounded-xl border border-line-strong bg-surface-2/90 px-2.5 shadow-2xl backdrop-blur-xl"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-text/5 text-ai">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm text-text">{t.title}</p>
              {t.body && <p className="truncate text-xs text-faint">{t.body}</p>}
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setItems((list) => list.filter((x) => x.id !== t.id))}
            className="rounded-md p-1 text-faint transition-colors hover:bg-text/10 hover:text-text"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
