/** The "●● 2026" motif: two dots and a small inverted pill. */
export function DotsTag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span aria-hidden="true" className="flex">
        <span className="size-2.5 rounded-full bg-text" />
        <span className="-ml-px size-2.5 rounded-full bg-text" />
      </span>
      <span className="rounded-full bg-text px-3 py-[3px] font-mono text-[9px] leading-none tracking-[0.04em] text-on-text uppercase">
        {children}
      </span>
    </span>
  );
}

/** A thin down arrow, the scroll cue. */
export function ThinArrow({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 40" fill="none" stroke="currentColor" strokeWidth="1" className={className} aria-hidden="true">
      <path d="M12 1v37M2 28l10 10 10-10" />
    </svg>
  );
}
