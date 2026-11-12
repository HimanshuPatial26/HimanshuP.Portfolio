"use client";

import { useMemo, useState, type ReactNode } from "react";
import DumCrown, { type Beat } from "@/components/academic/DumCrown";
import StickyStory, { type StoryChapter } from "@/components/academic/StickyStory";
import Seg from "@/components/Seg";

/*
 * Behrouz Biryani, UAE: Team 1's Global Industry Project for Rebel Foods. Every figure comes from
 * the team's final report (survey of 136 UAE delivery users, platform audit, public filings).
 * Figures the kitchen operator gave verbally are left out on purpose.
 */

const NEG = "#ff8a7a";

function Title({ children }: { children: ReactNode }) {
  return <h2 className="mt-4 text-[clamp(2rem,3.6vw,3.1rem)] leading-[1.02]">{children}</h2>;
}
function Body({ children }: { children: ReactNode }) {
  return <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">{children}</p>;
}
function Stats({ items }: { items: { value: string; label: string }[] }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      {items.map((s) => (
        <div key={s.label} className="glass min-w-[9rem] rounded-2xl px-5 py-4">
          <p className="font-display text-[1.7rem] leading-none tracking-[-0.03em]">{s.value}</p>
          <p className="mt-2 max-w-[11rem] font-mono text-[10px] leading-snug tracking-[0.14em] text-faint uppercase">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

/** Quality vs rivals (7-point scale), blended and then split by order size. */
function ReversalChart() {
  const [split, setSplit] = useState(false);
  const rows = [
    { label: "All orders", gap: -0.25, note: "p = 0.243, not significant", show: true, dim: split },
    { label: "1–2 people", gap: 0.27, note: "p = 0.360, not significant", show: split, dim: false },
    { label: "3+ people", gap: -0.78, note: "p = 0.008", show: split, dim: false },
  ];
  return (
    <div className="glass mt-8 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-muted uppercase">Behrouz quality vs rivals</span>
        <Seg
          label="View"
          value={split}
          onChange={setSplit}
          options={[
            { value: false, label: "Blended" },
            { value: true, label: "By order size" },
          ]}
        />
      </div>
      <div className="mt-6 space-y-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`grid grid-cols-[6.2rem_1fr_3.4rem] items-center gap-3 transition-all duration-700 ${r.show ? "opacity-100" : "pointer-events-none h-0 opacity-0"} ${r.dim ? "opacity-40" : ""}`}
            aria-hidden={!r.show}
          >
            <span className="text-sm">{r.label}</span>
            <span className="relative h-7">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
              <span
                className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{
                  left: r.gap < 0 ? `${50 - (r.show ? Math.abs(r.gap) * 50 : 0)}%` : "50%",
                  width: `${r.show ? Math.abs(r.gap) * 50 : 0}%`,
                  background: r.gap < 0 ? NEG : "var(--acc)",
                }}
              />
            </span>
            <span className="text-right font-display text-lg tabular-nums" style={{ color: r.gap < 0 ? NEG : "var(--acc)" }}>
              {r.gap > 0 ? "+" : "−"}
              {Math.abs(r.gap).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[9.5px] tracking-widest text-faint uppercase">
        <span>Behind rivals</span>
        <span>Ahead</span>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-muted" aria-live="polite">
        {split
          ? "Split by order size, the lead on small orders and the deficit on group orders cancel out. Within Behrouz, quality falls from 4.51 to 3.77 as orders grow (p = 0.018)."
          : "Blended, Behrouz looks level with rivals: a gap of −0.25 that isn't significant. Switch the view."}
      </p>
    </div>
  );
}

/** What builds brand equity, and what brand equity buys. */
function DriverMap() {
  const levers = [
    { y: 40, label: "Product quality", stat: "β 0.348 · p 0.013", sig: true },
    { y: 110, label: "Delivery speed", stat: "p 0.148", sig: false },
    { y: 180, label: "Trust & hygiene", stat: "p 0.510", sig: false },
  ];
  return (
    <div className="glass mt-8 rounded-2xl p-4 sm:p-5">
      <svg viewBox="0 0 520 220" className="w-full" role="img" aria-label="Product quality is the only significant driver of brand equity; brand equity drives preference and willingness to pay a premium">
        {levers.map((l) => (
          <g key={l.label}>
            <path
              d={`M150 ${l.y} C 200 ${l.y}, 200 110, 248 110`}
              fill="none"
              stroke={l.sig ? "var(--acc)" : "rgb(160 160 160 / .45)"}
              strokeWidth={l.sig ? 2.6 : 1}
              strokeDasharray={l.sig ? undefined : "4 5"}
            />
            <rect x="4" y={l.y - 19} width="146" height="38" rx="19" fill="rgb(255 255 255 / .04)" stroke={l.sig ? "var(--acc)" : "rgb(160 160 160 / .35)"} />
            <text x="77" y={l.y - 2} textAnchor="middle" fontSize="11.5" fill="currentColor">
              {l.label}
            </text>
            <text x="77" y={l.y + 12} textAnchor="middle" fontSize="8.5" letterSpacing="0.6" fill={l.sig ? "var(--acc)" : "rgb(150 150 150)"} className="font-mono">
              {l.stat}
            </text>
          </g>
        ))}
        <circle cx="300" cy="110" r="52" fill="rgb(255 255 255 / .04)" stroke="var(--acc)" />
        <text x="300" y="107" textAnchor="middle" fontSize="12" fill="currentColor">
          Brand
        </text>
        <text x="300" y="122" textAnchor="middle" fontSize="12" fill="currentColor">
          equity
        </text>
        {[
          { y: 60, label: "Preference", stat: "r 0.349" },
          { y: 160, label: "Pays a premium", stat: "r 0.271" },
        ].map((o) => (
          <g key={o.label}>
            <path d={`M352 110 C 390 110, 390 ${o.y}, 420 ${o.y}`} fill="none" stroke="var(--acc)" strokeWidth="1.6" />
            <text x="426" y={o.y - 1} fontSize="11.5" fill="currentColor">
              {o.label}
            </text>
            <text x="426" y={o.y + 13} fontSize="8.5" letterSpacing="0.6" fill="var(--acc)" className="font-mono">
              {o.stat}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 font-mono text-[9.5px] tracking-widest text-faint uppercase">Dashed: not significant once quality is in the model</p>
    </div>
  );
}

const MOVES = [
  { t: "Diagnose group-order variance", d: "Cross-tabulate complaints against batch, day and order value; weigh portions above a set order size.", w: "4–8 weeks" },
  { t: "Measure quality by order size", d: "A weekly Group Order Quality Index: ratings above an order-value threshold minus those below it.", w: "2–4 weeks" },
  { t: "Design group-format packaging", d: "Dubai's plastics rules already force a redesign. Build it for three or more portions: insulation, compartments, sealing. The Dum Crown is our concept.", w: "With the rule change" },
  { t: "Aim trust content where it works", d: "Hygiene and compliance messaging for South Asian customers, not as a universal campaign.", w: "4–6 weeks" },
  { t: "Don't reposition around occasion", d: "Keep the positioning; move that budget to the first three moves.", w: "Now" },
];

// the package's animation, chapter by chapter
const BEATS: Beat[] = [
  { clip: "DC_Unbox", from: 0, to: 0 },
  { clip: "DC_Unbox", from: 0, to: 4.9 },
  { clip: "DC_StoryReveal", from: 0, to: 5.7 },
  { clip: "DC_PeelReveal", from: 0, to: 2 },
  { clip: "DC_PeelReveal", from: 2, to: 7 },
  { clip: "DC_Explode", from: 0, to: 4.1 },
  { clip: "DC_Explode", from: 4.1, to: 4.1 },
];

export default function BehrouzStory({ header }: { header: ReactNode }) {
  const chapters = useMemo<StoryChapter[]>(() => [
    {
      id: "brief",
      label: "Brief",
      lead: true,
      content: (
        <>
          {header}
          <Stats
            items={[
              { value: "16", label: "Cloud kitchens in the UAE" },
              { value: "4.7", label: "Talabat rating, top of the brands tracked" },
              { value: "76%", label: "Of triallists become regulars" },
            ]}
          />
          <Body>Rebel Foods asked why that reach hasn&apos;t turned into category leadership: biryani doesn&apos;t appear in the 2025 platform rankings we checked. Scroll to open the brief.</Body>
        </>
      ),
    },
    {
      id: "hypothesis",
      label: "Hypothesis",
      content: (
        <>
          <Title>We thought it was positioning. We were wrong.</Title>
          <Body>
            At mid-review our answer was to reposition Behrouz around premium occasions. The survey didn&apos;t support it: Behrouz orders are no more occasion-led than
            rivals&apos; (66.7% against 69.5%, p = 0.872), and occasion doesn&apos;t raise willingness to pay (p = 0.744).
          </Body>
          <Body>Three times the evidence contradicted our working conclusion. Each time we changed the argument.</Body>
        </>
      ),
    },
    {
      id: "reversal",
      label: "Reversal",
      content: (
        <>
          <Title>Parity hid a reversal.</Title>
          <Body>Averaged across all orders, Behrouz looks level with its rivals. Split by order size, it leads on meals for one or two and falls behind on orders for three or more.</Body>
          <ReversalChart />
        </>
      ),
    },
    {
      id: "money",
      label: "Revenue",
      content: (
        <>
          <Title>And the big orders pay the bills.</Title>
          <Body>
            Group orders are 48% of Behrouz orders in our sample, but most of the revenue: at least 57% on a conservative estimate, 74% on what customers say they spend. The
            blended 4.7 rating hides the problem, because it averages a lead on small orders against a deficit on large ones.
          </Body>
          <Stats
            items={[
              { value: "48%", label: "Of orders are for 3+ people" },
              { value: "57–74%", label: "Of revenue comes from them" },
              { value: "×3", label: "Expected spend: AED 151 vs AED 49" },
            ]}
          />
        </>
      ),
    },
    {
      id: "quality",
      label: "Driver",
      content: (
        <>
          <Title>Quality is the only lever.</Title>
          <Body>
            In our path model, product quality is the only factor that builds brand equity, and brand equity is what drives choice and the willingness to pay more. Delivery speed
            and hygiene messaging add nothing once quality is accounted for. Trust does matter for South Asian customers (r = 0.515), and not for others (r = −0.092).
          </Body>
          <DriverMap />
        </>
      ),
    },
    {
      id: "plan",
      label: "Plan",
      content: (
        <>
          <Title>Fix consistency, then grow.</Title>
          <Body>Five moves, all on existing data, staff and procurement, which fits a parent that is narrowing its losses. Demand generation waits until the quality index shows the gap closing.</Body>
          <ol className="mt-7 max-w-xl border-b border-line">
            {MOVES.map((m, i) => (
              <li key={m.t} className="grid grid-cols-[2rem_1fr] gap-x-2 border-t border-line py-4">
                <span className="font-mono text-[11px] text-[var(--acc)]">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-medium">{m.t}</span>
                    <span className="font-mono text-[10px] tracking-[0.14em] text-faint uppercase">{m.w}</span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{m.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </>
      ),
    },
    {
      id: "limits",
      label: "Limits",
      content: (
        <>
          <Title>What to treat with care.</Title>
          <ul className="mt-6 max-w-xl space-y-3 text-[15px] leading-relaxed text-muted">
            {[
              "The order-size finding rests on 26 group and 28 individual Behrouz respondents. The effect is significant and medium to large, but it should be confirmed with Behrouz's own order and review data.",
              "We measured perceived quality, not the food itself, and spend was stated, not taken from transactions.",
              "A convenience and referral sample, not a representative one; the order-size split was added after the first results and is reported as exploratory.",
              "One snapshot of a market that moved quickly after Keeta's entry.",
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2.5 size-1 shrink-0 rounded-full bg-[var(--acc)]" aria-hidden="true" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </>
      ),
    },
  ], [header]);

  return (
    <StickyStory
      label="Behrouz Biryani, chapter by chapter"
      chapters={chapters}
      hint="Scroll to open the pack"
      renderVisual={(state) => <DumCrown url="/projects/behrouz-biryani/dum-crown.glb" poster="/projects/behrouz-biryani/closed.jpg" beats={BEATS} state={state} />}
    />
  );
}
