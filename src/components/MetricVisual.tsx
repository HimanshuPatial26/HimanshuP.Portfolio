"use client";

import type { CSSProperties } from "react";
import Seg from "@/components/Seg";
import type { Metric } from "@/data/resume";

type Props = {
  metric: Metric;
  /** the row is the active one: bars and bands grow in */
  on: boolean;
  ai: boolean;
  /** currency rows: showing US dollars */
  usd: boolean;
  onCurrency: (usd: boolean) => void;
};

/** A labelled bar: track, fill (and an optional striped tail for a range), value at the end. */
function Bar({
  label,
  value,
  fill,
  tail = 0,
  tone,
  on,
  delay = 0,
}: {
  label: string;
  value: string;
  fill: number; // % of the track
  tail?: number; // % of the track after the fill, striped (a range)
  tone: string;
  on: boolean;
  delay?: number;
}) {
  return (
    <div className="grid grid-cols-[3.4rem_1fr_3.6rem] items-center gap-3">
      <span className="micro text-faint">{label}</span>
      <span className="relative h-1.5 overflow-hidden rounded-full bg-line">
        <span className={`mv-fill absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: on ? `${fill}%` : 0, transitionDelay: `${delay}ms` } as CSSProperties} />
        {tail > 0 && (
          <span
            className={`mv-fill mv-stripes absolute inset-y-0 rounded-r-full ${tone}`}
            style={{ left: `${fill}%`, width: on ? `${tail}%` : 0, transitionDelay: `${delay + 350}ms` } as CSSProperties}
          />
        )}
      </span>
      <span className="text-right font-mono text-[11px] text-muted tabular-nums">{value}</span>
    </div>
  );
}

/**
 * What a result means, at a glance, from the resume's own figures only: the same revenue in
 * both currencies, output before and after (before = 100), a lift known as a range, and CSAT
 * against the industry benchmark.
 */
export default function MetricVisual({ metric, on, ai, usd, onCurrency }: Props) {
  const v = metric.visual;
  const tone = ai ? "bg-ai" : "bg-growth";

  if (v.kind === "currency") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Seg
          label="Show revenue in"
          value={usd}
          onChange={onCurrency}
          options={[
            { value: false, label: "₹ INR" },
            { value: true, label: "US $" },
          ]}
        />
        <span className="micro text-faint">Every month, from one engine</span>
      </div>
    );
  }

  if (v.kind === "lift") {
    const after = 100 + v.pct;
    return (
      <div className="space-y-2" aria-label={`Output per agent: 100 before, ${after} after`}>
        <Bar label="Before" value="100" fill={(100 / after) * 100} tone="bg-line-strong" on={on} />
        <Bar label="After" value={String(after)} fill={100} tone={tone} on={on} delay={180} />
      </div>
    );
  }

  if (v.kind === "range") {
    const top = 100 + v.to;
    return (
      <div className="space-y-2" aria-label={`Successful payments: 100 before, ${100 + v.from} to ${top} after`}>
        <Bar label="Before" value="100" fill={(100 / top) * 100} tone="bg-line-strong" on={on} />
        <Bar
          label="After"
          value={`${100 + v.from}–${top}`}
          fill={((100 + v.from) / top) * 100}
          tail={((v.to - v.from) / top) * 100}
          tone={tone}
          on={on}
          delay={180}
        />
      </div>
    );
  }

  // CSAT against the industry benchmark, on a 70–100% scale
  const lo = 70;
  const span = 30;
  const at = (x: number) => ((x - lo) / span) * 100;
  return (
    <div aria-label={`CSAT ${v.team[0]}–${v.team[1]}% against an industry benchmark of ${v.industry[0]}–${v.industry[1]}%`}>
      <div className="relative h-9">
        {/* labels above the bands */}
        <span className="micro absolute top-0 text-faint" style={{ left: `${at(v.industry[0])}%` }}>
          Industry {v.industry[0]}–{v.industry[1]}
        </span>
        <span className={`micro absolute top-0 -translate-x-1/2 ${ai ? "text-ai" : "text-growth"}`} style={{ left: `${at((v.team[0] + v.team[1]) / 2)}%` }}>
          Team
        </span>
        {/* the scale */}
        <span className="absolute inset-x-0 bottom-2 h-px bg-line" />
        <span
          className="mv-band absolute bottom-[0.3rem] h-1.5 origin-left rounded-full bg-line-strong"
          style={{ left: `${at(v.industry[0])}%`, width: `${at(v.industry[1]) - at(v.industry[0])}%`, transform: `scaleX(${on ? 1 : 0})` }}
        />
        <span
          className={`mv-band absolute bottom-[0.3rem] h-1.5 origin-left rounded-full ${tone}`}
          style={{
            left: `${at(v.team[0])}%`,
            width: `max(0.5rem, ${at(v.team[1]) - at(v.team[0])}%)`,
            transform: `scaleX(${on ? 1 : 0})`,
            transitionDelay: "380ms",
          }}
        />
        <span
          className={`mv-band absolute bottom-0 size-3 rounded-full border-2 border-bg ${tone}`}
          style={{ left: `${at((v.team[0] + v.team[1]) / 2)}%`, transform: `translateX(-50%) scale(${on ? 1 : 0})`, transitionDelay: "520ms" }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-faint tabular-nums">
        {[70, 80, 90, 100].map((t) => (
          <span key={t}>{t}%</span>
        ))}
      </div>
    </div>
  );
}
