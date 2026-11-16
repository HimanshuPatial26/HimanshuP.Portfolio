/**
 * The hero name, "Mask": each line slides up into view from behind its own lower edge once the
 * intro has played (the second a beat after the first), and a hovered line opens its tracking a
 * little. Only the words take the pointer, so the wave behind still gets it everywhere else.
 */
export default function MaskName({ lines, revealed, className = "" }: { lines: string[]; revealed: boolean; className?: string }) {
  return (
    <p className={`mask-name ${className}`} data-revealed={revealed || undefined}>
      {lines.map((line, i) => (
        <span key={line} className="mask-line">
          <span className="mask-move" style={{ "--d": `${250 + i * 140}ms` } as React.CSSProperties}>
            {line}
          </span>
        </span>
      ))}
    </p>
  );
}
