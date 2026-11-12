"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

type Option<T> = { value: T; label: ReactNode };

/**
 * A small switch between two or three options. The white thumb shrinks to a dot, travels to the
 * option you picked, and blooms open again under it (the arrow-bloom button system).
 */
export default function Seg<T extends string | number | boolean>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // sit the thumb under the chosen option; after the first time, travel there as a dot
  useLayoutEffect(() => {
    const el = root.current;
    const th = thumb.current;
    if (!el || !th) return;
    const on = el.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!on) return;
    const first = !placed.current;
    if (first) th.style.transition = "none";
    else th.classList.add("travel");
    th.style.left = `${on.offsetLeft}px`;
    th.style.width = `${on.offsetWidth}px`;
    if (first) {
      void th.offsetWidth;
      th.style.transition = "";
      el.dataset.ready = "";
      placed.current = true;
      return;
    }
    const t = window.setTimeout(() => th.classList.remove("travel"), 280);
    return () => window.clearTimeout(t);
  }, [value]);

  // fonts and layout can shift the options: follow them without the travel
  useEffect(() => {
    const el = root.current;
    const th = thumb.current;
    if (!el || !th) return;
    const ro = new ResizeObserver(() => {
      const on = el.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!on) return;
      th.style.left = `${on.offsetLeft}px`;
      th.style.width = `${on.offsetWidth}px`;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} role="group" aria-label={label} className="seg">
      <span ref={thumb} className="seg-thumb" aria-hidden="true" />
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)} className="seg-btn cursor-target">
          {o.label}
        </button>
      ))}
    </div>
  );
}
