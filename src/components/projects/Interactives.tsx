"use client";

import { useEffect, useRef, useState } from "react";
import Seg from "@/components/Seg";

/**
 * CallEvals' Phase 0 eval, from its README: extraction precision on six hand-labelled mock calls,
 * before and after one prompt rule. Recall was 100% in both runs; the PRD's launch gate is 85%
 * next-step precision.
 */
export function EvalToggle() {
  const [run, setRun] = useState<1 | 2>(2);
  const rows = [
    { label: "Next steps", r1: 75, r2: 100, gate: 85 },
    { label: "Objections", r1: 50, r2: 75 },
  ];
  return (
    <div className="glass mt-8 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-muted uppercase">Extraction precision</span>
        <Seg
          label="Eval run"
          value={run}
          onChange={setRun}
          options={[
            { value: 1 as const, label: "Run 1" },
            { value: 2 as const, label: "Run 2" },
          ]}
        />
      </div>
      <div className="mt-6 space-y-5">
        {rows.map((row) => {
          const v = run === 1 ? row.r1 : row.r2;
          const pass = row.gate ? v >= row.gate : true;
          return (
            <div key={row.label} className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3">
              <span className="text-sm">{row.label}</span>
              <span className="relative h-2 rounded-full bg-line">
                <span
                  className="absolute inset-y-0 left-0 rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
                  style={{ width: `${v}%`, background: row.gate && !pass ? "#ff6b7a" : "var(--acc)" }}
                />
                {row.gate && (
                  <span className="absolute -top-2 -bottom-2 border-l border-dashed border-text/60" style={{ left: `${row.gate}%` }}>
                    <span className="absolute -top-5 -translate-x-1/2 font-mono text-[9.5px] tracking-widest whitespace-nowrap text-faint">GATE {row.gate}%</span>
                  </span>
                )}
              </span>
              <span className="text-right font-display text-lg tabular-nums">{v}%</span>
            </div>
          );
        })}
      </div>
      <p className="mt-5 text-sm leading-relaxed text-muted" aria-live="polite">
        {run === 1
          ? "Not met. The model split one promise into two, so a correct commitment came back as a false duplicate."
          : "Met on this mock set, after one prompt rule to merge near-duplicates. Recall was 100% in both runs."}
      </p>
    </div>
  );
}

const TONES = [
  {
    id: "urgent",
    label: "Urgent",
    color: "#ff6b7a",
    meaning: "A possible emergency that needs care right away.",
    example: "Warning signs of a heart attack",
  },
  {
    id: "caution",
    label: "Caution",
    color: "#e8a33d",
    meaning: "Drug interactions, dosage limits, or something to raise with a clinician.",
    example: "Ibuprofen vs acetaminophen",
  },
  {
    id: "steady",
    label: "Steady",
    color: "#3fbfa4",
    meaning: "Reassuring, in-range, low-risk information.",
    example: "Lowering cholesterol naturally",
  },
] as const;

/**
 * AI Med-pedia's safety read: the three tones its prompt asks the model to tag every answer with
 * (llm.py), each with one of the app's own example questions. Picking one also tints the page.
 */
export function ToneSwitch() {
  const [tone, setTone] = useState<(typeof TONES)[number]["id"]>("urgent");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const page = ref.current?.closest<HTMLElement>(".project-page");
    if (page) page.dataset.tone = tone;
  }, [tone]);
  const t = TONES.find((x) => x.id === tone)!;
  return (
    <div ref={ref} className="mt-8">
      <p className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">Try a tone · questions from the app</p>
      <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Safety tone">
        {TONES.map((x) => {
          const on = x.id === tone;
          return (
            <button
              key={x.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setTone(x.id)}
              className="cursor-target flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-[background-color,border-color] duration-500"
              style={{
                borderColor: on ? `${x.color}99` : "var(--line)",
                background: on ? `${x.color}1a` : "transparent",
              }}
            >
              <span className="flex items-center gap-3">
                <span className="size-2 rounded-full" style={{ background: x.color, boxShadow: on ? `0 0 12px ${x.color}` : "none" }} />
                <span className={`font-mono text-[10.5px] tracking-[0.16em] uppercase ${on ? "text-text" : "text-faint"}`}>{x.label}</span>
              </span>
              <span className={`text-sm ${on ? "text-text" : "text-muted"}`}>{x.example}</span>
            </button>
          );
        })}
      </div>
      <p key={t.id} className="swap-in mt-4 text-sm leading-relaxed text-muted" aria-live="polite">
        <span style={{ color: t.color }}>{t.label}:</span> {t.meaning}
      </p>
    </div>
  );
}

/** The plain-language switch, with the example sentence from the launch film. */
export function PlainToggle() {
  const [plain, setPlain] = useState(false);
  const text = plain ? "Chest pressure that spreads to your arm." : "Retrosternal pressure radiating to the left arm.";
  return (
    <div className="glass mt-8 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">Example</span>
        <Seg
          label="Explain in"
          value={plain}
          onChange={setPlain}
          options={[
            { value: false, label: "Clinical detail" },
            { value: true, label: "Plain language" },
          ]}
        />
      </div>
      <p key={text} className="swap-in mt-6 font-display text-[clamp(1.4rem,2.4vw,1.9rem)] leading-[1.08] tracking-[-0.02em]" aria-live="polite">
        {text}
      </p>
    </div>
  );
}
