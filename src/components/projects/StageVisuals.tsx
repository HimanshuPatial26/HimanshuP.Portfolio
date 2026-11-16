"use client";

import { useEffect, useState } from "react";
import { quietMedia } from "@/components/projects/LoopVideo";

/*
 * The Master's projects have no film, so the Projects stage shows them another way:
 * Behrouz as the Dum Crown pack, closed and then exploded into its layers (here);
 * FinTech as a glass card in 3D (FintechCard.tsx).
 */

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
