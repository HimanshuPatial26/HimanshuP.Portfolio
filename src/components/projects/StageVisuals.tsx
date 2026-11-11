"use client";

import { useEffect, useState } from "react";
import { quietMedia } from "@/components/projects/LoopVideo";

/*
 * The Master's projects have no film, so the Projects stage draws them:
 * FinTech as its structural model, switching between India and Dubai;
 * Behrouz as the Dum Crown pack, closed and then exploded into its layers.
 */

const NEG = "#ff8a7a";
const POS = "#7aa2ff";

// [India β, Dubai β] from the study's structural models
const PATHS: { d: string; india: number; dubai: number }[] = [
  { d: "M118 66 C 170 66, 170 66, 222 66", india: -0.88, dubai: -0.866 }, // trust → risk
  { d: "M118 66 C 170 66, 170 140, 222 140", india: 0.534, dubai: 0.5 }, // trust → usefulness
  { d: "M118 140 C 170 140, 170 140, 222 140", india: 0.501, dubai: 0.518 }, // ease → usefulness
  { d: "M118 214 C 260 214, 260 140, 318 140", india: 0.386, dubai: 0.062 }, // social → adoption
  { d: "M298 66 C 318 66, 318 132, 330 136", india: -0.271, dubai: -0.529 }, // risk → adoption
  { d: "M298 140 C 312 140, 316 140, 330 140", india: 0.653, dubai: 0.152 }, // usefulness → adoption
];

function Model({ market }: { market: "india" | "dubai" }) {
  return (
    <svg viewBox="0 0 400 250" className="absolute inset-0 size-full" aria-hidden="true">
      <g fill="none" strokeLinecap="round">
        {PATHS.map((p) => {
          const b = market === "dubai" ? p.dubai : p.india;
          const weak = Math.abs(b) < 0.2;
          return <path key={p.d} d={p.d} stroke={weak ? "rgb(150 150 150 / .55)" : b < 0 ? NEG : POS} strokeDasharray={weak ? "4 5" : undefined} strokeWidth={1 + Math.abs(b) * 6} />;
        })}
      </g>
      {[
        ["Brand trust", 80, 66],
        ["Ease of use", 80, 140],
        ["Social", 80, 214],
        ["Risk", 260, 66],
        ["Usefulness", 260, 140],
      ].map(([t, x, y]) => (
        <g key={t as string}>
          <rect x={(x as number) - 38} y={(y as number) - 14} width="76" height="28" rx="14" fill="#070a14" stroke="rgb(255 255 255 / .35)" />
          <text x={x} y={(y as number) + 4} textAnchor="middle" fontSize="10" fill="#ddd">
            {t}
          </text>
        </g>
      ))}
      <rect x="330" y="122" width="62" height="36" rx="18" fill="#070a14" stroke={POS} />
      <text x="361" y="144" textAnchor="middle" fontSize="10" fill="#fff">
        Adoption
      </text>
      <text x="18" y="238" fontSize="9" fill={POS} letterSpacing="1.5" className="font-mono">
        {market === "dubai" ? "DUBAI · N 35 · R² 0.962" : "INDIA · N 36 · R² 0.960"}
      </text>
    </svg>
  );
}

/**
 * FinTech: the structural model, switching between the two markets while it's on stage. Both are
 * drawn once and cross-fade (opacity only), so nothing is redrawn inside the tilted stage.
 */
export function FintechStage({ active }: { active: boolean }) {
  const [dubai, setDubai] = useState(false);
  useEffect(() => {
    if (!active || quietMedia()) return;
    const t = window.setInterval(() => setDubai((d) => !d), 2600);
    return () => window.clearInterval(t);
  }, [active]);
  return (
    <div role="img" aria-label="FinTech adoption model: brand trust, ease of use and social influence acting on adoption through risk and usefulness, in India and Dubai" className="absolute inset-0 bg-[#070a14] bg-[linear-gradient(rgb(255_255_255/.035)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/.035)_1px,transparent_1px)] bg-[size:12.5%_20%]">
      <div className={`absolute inset-0 transition-opacity duration-700 will-change-[opacity] ${dubai ? "opacity-0" : "opacity-100"}`}>
        <Model market="india" />
      </div>
      <div className={`absolute inset-0 transition-opacity duration-700 will-change-[opacity] ${dubai ? "opacity-100" : "opacity-0"}`}>
        <Model market="dubai" />
      </div>
    </div>
  );
}

/** Behrouz: the Dum Crown pack, closed, then opening into its layers, while it's on stage. */
export function BehrouzStage({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!active || quietMedia()) return;
    const t = window.setInterval(() => setOpen((o) => !o), 3000);
    return () => window.clearInterval(t);
  }, [active]);
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/projects/behrouz-biryani/closed.jpg"
        alt="The Dum Crown packaging concept for Behrouz group orders"
        className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-1000 ${open ? "scale-105 opacity-0" : "scale-100 opacity-100"}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/projects/behrouz-biryani/exploded.jpg"
        alt=""
        loading="lazy"
        className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-1000 ${open ? "scale-100 opacity-100" : "scale-95 opacity-0"}`}
      />
    </>
  );
}
