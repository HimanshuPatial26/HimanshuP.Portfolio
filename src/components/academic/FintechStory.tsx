"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import StickyStory, { type StoryChapter } from "@/components/academic/StickyStory";

/*
 * Drivers of FinTech app adoption, India × Dubai: Himanshu's International Business Research
 * study. All coefficients are from the final report (PLS-SEM in SmartPLS 4, bootstrap 1,000;
 * India n = 36, Dubai n = 35).
 */

type Market = "india" | "dubai";
type Node = { id: string; label: string; short: string; x: number; y: number };
type Edge = { from: string; to: string; india: [number, boolean]; dubai: [number, boolean] };

const NEG = "#ff8a7a";

const NODES: Node[] = [
  { id: "BT", label: "Brand trust", short: "BT", x: 70, y: 70 },
  { id: "PEOU", label: "Ease of use", short: "PEOU", x: 70, y: 200 },
  { id: "SI", label: "Social influence", short: "SI", x: 70, y: 320 },
  { id: "PR", label: "Perceived risk", short: "PR", x: 270, y: 70 },
  { id: "PU", label: "Usefulness", short: "PU", x: 270, y: 200 },
  { id: "AI", label: "Adoption intention", short: "AI", x: 460, y: 200 },
];

// [β, significant at p < 0.05]
const EDGES: Edge[] = [
  { from: "BT", to: "PR", india: [-0.88, true], dubai: [-0.866, true] },
  { from: "BT", to: "PU", india: [0.534, true], dubai: [0.5, true] },
  { from: "BT", to: "AI", india: [-0.164, false], dubai: [-0.009, false] },
  { from: "PEOU", to: "PU", india: [0.501, true], dubai: [0.518, true] },
  { from: "PEOU", to: "AI", india: [-0.192, true], dubai: [0.297, true] },
  { from: "SI", to: "AI", india: [0.386, true], dubai: [0.062, false] },
  { from: "PR", to: "AI", india: [-0.271, true], dubai: [-0.529, true] },
  { from: "PU", to: "AI", india: [0.653, true], dubai: [0.152, false] },
];

// which edges each chapter points at (none: all at rest)
const FOCUS: Record<string, string[]> = {
  brief: [],
  question: [],
  trust: ["BT-PR", "BT-PU", "BT-AI", "PR-AI", "PU-AI"],
  india: ["PU-AI", "SI-AI", "PEOU-AI", "BT-PU"],
  dubai: ["PR-AI", "BT-PR", "PEOU-AI"],
  levers: [],
  limits: [],
};

const pos = (id: string) => NODES.find((n) => n.id === id)!;

/** The structural model, drawn with each market's path coefficients. */
function PathModel({ market, setMarket, focus }: { market: Market; setMarket: (m: Market) => void; focus: string[] }) {
  return (
    <div className="glass rounded-[22px] p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] tracking-[0.16em] text-faint uppercase">PLS-SEM · path coefficients</span>
        <div role="group" aria-label="Market" className="inline-flex rounded-full border border-line-strong p-[3px] font-mono text-[10.5px] tracking-[0.14em] uppercase">
          {(["india", "dubai"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={market === m}
              onClick={() => setMarket(m)}
              className={`cursor-target rounded-full px-3.5 py-1.5 transition-colors ${market === m ? "bg-text text-bg" : "text-muted hover:text-text"}`}
            >
              {m === "india" ? "India" : "Dubai"}
              <span className="hidden sm:inline">{m === "india" ? " · n 36" : " · n 35"}</span>
            </button>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 540 390" className="mt-3 w-full" role="img" aria-label={`Path model for ${market === "india" ? "India" : "Dubai"}`}>
        <defs>
          <marker id="fa" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10z" fill="currentColor" />
          </marker>
        </defs>
        {EDGES.map((e) => {
          const a = pos(e.from);
          const b = pos(e.to);
          const [beta, sig] = e[market];
          const key = `${e.from}-${e.to}`;
          const lit = focus.length === 0 || focus.includes(key);
          const col = beta < 0 ? NEG : "var(--acc)";
          const x1 = a.x + 58;
          const x2 = b.x - 58;
          const mx = (x1 + x2) / 2;
          const d = `M${x1} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${x2} ${b.y}`;
          const lx = mx;
          const ly = (a.y + b.y) / 2 + (a.y === b.y ? -8 : 0);
          return (
            <g key={key} style={{ opacity: lit ? 1 : 0.18, transition: "opacity .6s" }}>
              <path
                d={d}
                fill="none"
                stroke={sig ? col : "rgb(150 150 150)"}
                strokeDasharray={sig ? undefined : "5 5"}
                style={{ strokeWidth: sig ? 1 + Math.abs(beta) * 6 : 1.2, transition: "stroke-width .7s, stroke .7s" }}
              />
              <g transform={`translate(${lx} ${ly})`}>
                <rect x="-26" y="-11" width="52" height="20" rx="10" fill="var(--bg)" stroke="rgb(160 160 160 / .3)" />
                <text y="3.5" textAnchor="middle" fontSize="10.5" className="font-mono" fill={sig ? col : "rgb(150 150 150)"}>
                  {beta > 0 ? "+" : "−"}
                  {Math.abs(beta).toFixed(2)}
                </text>
              </g>
            </g>
          );
        })}
        {NODES.map((n) => (
          <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
            <rect x="-58" y="-24" width="116" height="48" rx="24" fill="var(--bg)" stroke={n.id === "AI" ? "var(--acc)" : "rgb(160 160 160 / .45)"} />
            <text y="-2" textAnchor="middle" fontSize="11.5" fill="currentColor">
              {n.label}
            </text>
            <text y="13" textAnchor="middle" fontSize="8.5" letterSpacing="1" className="font-mono" fill="rgb(150 150 150)">
              {n.id === "AI" ? `R² ${market === "india" ? "0.960" : "0.962"}` : n.short}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-1 font-mono text-[9.5px] tracking-widest text-faint uppercase">
        Line width = strength · <span style={{ color: NEG }}>coral</span> = negative · dashed = not significant
      </p>
    </div>
  );
}

/** One lever pulled in both markets: the change in adoption intention per unit, from the paths. */
function WhatIf() {
  const levers = [
    { id: "badge", label: "Show the regulator's badge", sub: "Brand trust +1, via the risk route", india: 0.238, dubai: 0.458 },
    { id: "referral", label: "Run a referral campaign", sub: "Social influence +1", india: 0.386, dubai: 0.062, dubaiNs: true },
    { id: "onboarding", label: "Simplify onboarding", sub: "Ease of use +1", india: -0.192, dubai: 0.297 },
    { id: "incident", label: "Suffer a security incident", sub: "Perceived risk +1", india: -0.271, dubai: -0.529 },
  ];
  const [id, setId] = useState("badge");
  const l = levers.find((x) => x.id === id)!;
  const bar = (v: number, ns?: boolean) => (
    <span className="relative block h-7">
      <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
      <span
        className="absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full transition-all duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{
          left: v < 0 ? `${50 - Math.abs(v) * 80}%` : "50%",
          width: `${Math.abs(v) * 80}%`,
          background: ns ? "rgb(150 150 150 / .6)" : v < 0 ? NEG : "var(--acc)",
        }}
      />
    </span>
  );
  return (
    <div className="glass mt-8 rounded-2xl p-5 sm:p-6">
      <p className="font-mono text-[10.5px] tracking-[0.16em] text-muted uppercase">Pull one lever</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Lever">
        {levers.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={x.id === id}
            onClick={() => setId(x.id)}
            className={`cursor-target rounded-xl border px-3.5 py-2.5 text-left transition-colors ${x.id === id ? "border-[var(--acc)] bg-[color-mix(in_srgb,var(--acc)_10%,transparent)]" : "border-line hover:border-line-strong"}`}
          >
            <span className="block text-sm">{x.label}</span>
            <span className="mt-0.5 block font-mono text-[9.5px] tracking-[0.12em] text-faint uppercase">{x.sub}</span>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {[
          { m: "India", v: l.india, ns: false },
          { m: "Dubai", v: l.dubai, ns: !!l.dubaiNs },
        ].map((r) => (
          <div key={r.m} className="grid grid-cols-[4rem_1fr_3.6rem] items-center gap-3">
            <span className="text-sm">{r.m}</span>
            {bar(r.v, r.ns)}
            <span className="text-right font-display text-lg tabular-nums" style={{ color: r.ns ? "rgb(150 150 150)" : r.v < 0 ? NEG : "var(--acc)" }}>
              {r.v > 0 ? "+" : "−"}
              {Math.abs(r.v).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-faint">Change in adoption intention per unit, from the estimated paths{l.dubaiNs ? "; grey = not significant" : ""}.</p>
    </div>
  );
}

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

const RECS = [
  { t: "Lead with each market's trust signal", d: "RBI and NPCI badges in India; DFSA and DIFC registration, and Sharia compliance, in Dubai." },
  { t: "Fund referrals in India only", d: "WhatsApp payment links, family onboarding, community payments. In Dubai, spend on personal utility instead." },
  { t: "Sell usefulness in India, simplicity in Dubai", d: "In India, deepen into investments, credit and planning; in Dubai, keep cutting onboarding friction." },
  { t: "Make risk a tier-1 priority in Dubai", d: "Fraud detection, fast incident response and visible security reporting." },
  { t: "Run separate India and Dubai roadmaps", d: "Separate teams, budgets and dashboards; a uniform strategy is systematically second-best." },
];

const MARKET_BY_CHAPTER: Record<string, Market> = { india: "india", dubai: "dubai" };

export default function FintechStory({ header }: { header: ReactNode }) {
  const [market, setMarket] = useState<Market>("india");
  // entering the India or Dubai chapter switches the model to that market
  const onChapter = useCallback((id: string) => {
    const m = MARKET_BY_CHAPTER[id];
    if (m) setMarket(m);
  }, []);

  const chapters = useMemo<StoryChapter[]>(
    () => [
      {
        id: "brief",
        label: "Brief",
        lead: true,
        content: (
          <>
            {header}
            <Stats
              items={[
                { value: "71", label: "Clean responses: 36 India, 35 Dubai" },
                { value: "6", label: "Constructs in one structural model" },
                { value: "96%", label: "Of adoption intention explained, each market" },
              ]}
            />
          </>
        ),
      },
      {
        id: "question",
        label: "Question",
        content: (
          <>
            <Title>Why do people hesitate to trust a finance app?</Title>
            <Body>
              There&apos;s no branch to walk into, so people judge a FinTech app by signals: a regulator&apos;s badge, how easy it feels, what friends use. I tested three drivers
              (brand trust, ease of use, social influence) and the two routes they might work through (perceived risk and perceived usefulness).
            </Body>
            <Body>
              And I tested them in two contrasting markets: compliance-first, collectivist India, and innovation-first, expatriate Dubai.
            </Body>
          </>
        ),
      },
      {
        id: "trust",
        label: "Trust",
        content: (
          <>
            <Title>Trust never works alone.</Title>
            <Body>
              In both markets the direct path from brand trust to adoption isn&apos;t significant (India p = 0.081, Dubai p = 0.918). Trust works entirely through the two
              mediators, and its total effect is strong: +0.42 in India, +0.53 in Dubai.
            </Body>
            <Body>What differs is the door it goes through.</Body>
          </>
        ),
      },
      {
        id: "india",
        label: "India",
        content: (
          <>
            <Title>India adopts on usefulness, and on friends.</Title>
            <Body>
              Usefulness is the dominant route (β = +0.65), carrying most of trust&apos;s effect. Social influence is a strong direct driver (+0.39), while in Dubai it isn&apos;t
              significant. And ease of use turns slightly negative (−0.19): where UPI made every app easy, easy on its own reads as shallow.
            </Body>
          </>
        ),
      },
      {
        id: "dubai",
        label: "Dubai",
        content: (
          <>
            <Title>Dubai adopts when risk comes down.</Title>
            <Body>
              Here trust works almost entirely by lowering perceived risk (indirect +0.46), and risk weighs about twice as heavily as in India (−0.53 against −0.27).
              Usefulness and social influence aren&apos;t significant; ease of use still helps (+0.30).
            </Body>
            <Body>The trust-to-risk path itself is nearly identical in both markets (−0.88 and −0.87): the difference is what risk then does to adoption.</Body>
          </>
        ),
      },
      {
        id: "levers",
        label: "So what",
        content: (
          <>
            <Title>Same lever, different payoff.</Title>
            <Body>A strategy that works in one market can return nothing, or the opposite, in the other. Five recommendations follow from the paths.</Body>
            <WhatIf />
            <ol className="mt-7 max-w-xl border-b border-line">
              {RECS.map((r, i) => (
                <li key={r.t} className="grid grid-cols-[2rem_1fr] gap-x-2 border-t border-line py-4">
                  <span className="font-mono text-[11px] text-[var(--acc)]">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <span className="font-medium">{r.t}</span>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{r.d}</p>
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
            <Title>What this can&apos;t tell you.</Title>
            <ul className="mt-6 max-w-xl space-y-3 text-[15px] leading-relaxed text-muted">
              {[
                "Small groups: 36 and 35 respondents, below the 50 per market the power analysis set and well short of the 100 a multi-group comparison wants. The null result on market moderating trust → risk may be a power problem, not a true equivalence.",
                "Cross-sectional and intention-based: it can't show causation, and intention isn't download or use.",
                "Pan-urban India and a mostly expatriate Dubai sample, surveyed in English through professional networks, so likely more digitally engaged than average.",
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
    ],
    [header],
  );

  return (
    <StickyStory
      label="FinTech adoption, chapter by chapter"
      chapters={chapters}
      hint="Scroll through the model"
      renderVisual={(_state, active) => <ChapterWatcher id={chapters[active].id} onChange={onChapter} market={market} setMarket={setMarket} />}
    />
  );
}

/** Reports the active chapter up (to switch markets) and draws the model with that chapter's focus. */
function ChapterWatcher({ id, onChange, market, setMarket }: { id: string; onChange: (id: string) => void; market: Market; setMarket: (m: Market) => void }) {
  useEffect(() => onChange(id), [id, onChange]);
  return <PathModel market={market} setMarket={setMarket} focus={FOCUS[id] ?? []} />;
}
