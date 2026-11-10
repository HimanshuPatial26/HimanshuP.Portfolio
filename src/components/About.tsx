"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import FocusText from "@/components/FocusText";
import { useMinWidth } from "@/hooks/useClientFlags";
import { drawBadge } from "@/lib/badgeArt";

// React Bits: Lanyard (3D ID badge on a strap), client only.
const Lanyard = dynamic(() => import("@/components/reactbits/Lanyard"), { ssr: false });

const statement =
  "I started on the support desk, answering the questions users were stuck on. Then I moved into product and started fixing those problems in the product itself. Now I build AI tutors, conversion engines and payment flows, and I judge each one by the numbers it moves.";

export default function About() {
  const wide = useMinWidth(1024);
  const [art, setArt] = useState<{ front: string; back: string } | null>(null);
  // draw the badge faces once the display face (Syne) has actually loaded
  useEffect(() => {
    let alive = true;
    const display = getComputedStyle(document.documentElement).getPropertyValue("--font-syne").trim();
    const loads = display && document.fonts ? [document.fonts.load(`400 100px ${display}`)] : [];
    Promise.all([document.fonts?.ready, ...loads])
      .catch(() => undefined)
      .then(() => alive && setArt(drawBadge()));
    return () => {
      alive = false;
    };
  }, []);
  const sectionRef = useRef<HTMLElement>(null);
  const [touched, setTouched] = useState(false); // hide the hint once they've grabbed it

  return (
    <section
      ref={sectionRef}
      id="about"
      data-shape="Shape_Monogram"
      data-pose="back"
      data-chapter="About"
      data-chapter-no="01"
      className="relative lg:h-[230svh]"
    >
      {/* on desktop the whole block holds still while the statement is read word by word */}
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-24 sm:px-6 sm:py-32 lg:sticky lg:top-0 lg:h-[100svh] lg:grid-cols-[1.15fr_1fr] lg:pt-16 lg:pb-0">
        {/* sized against the screen height too, so the pinned panel fits short laptop screens */}
        <div className="glass rounded-[2rem] p-7 sm:p-10 lg:py-[min(2.5rem,4.5svh)]">
          <p className="mb-[min(1.5rem,3svh)] font-mono text-xs tracking-widest text-faint uppercase">01 / About</p>
          <FocusText
            text={statement}
            trackRef={sectionRef}
            className="text-[clamp(1.4rem,min(3vw,3.5svh),2.4rem)] leading-[1.3] font-medium tracking-tight text-text"
          />

          <dl className="mt-[min(2.5rem,4svh)] grid grid-cols-3 gap-4 border-t border-line pt-[min(1.5rem,3svh)] text-sm">
            <div>
              <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">Experience</dt>
              <dd className="mt-1 text-text">5 yrs at Classplus</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">As a PM</dt>
              <dd className="mt-1 text-text">2+ yrs, B2B &amp; D2C</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">Now</dt>
              <dd className="mt-1 text-text">MGB, SP Jain</dd>
            </div>
          </dl>
        </div>

        {/* no .cursor-target here: the custom cursor would hide the grab hand and box the whole canvas */}
        <div className="relative h-[560px] sm:h-[640px] lg:h-[min(640px,calc(100svh-6rem))]" onPointerDown={() => setTouched(true)}>
          {art ? (
            <Lanyard
              frontImage={art.front}
              backImage={art.back}
              cardColor="#050505"
              finish="glossy"
              metal="silver"
              strapColor="#0146f9"
              strapWidth={0.6}
              strapLength={wide ? 0.5 : 0.42}
              size={wide ? 0.52 : 0.5}
              anchor="center"
              breeze={0.6}
            />
          ) : (
            <div className="grid h-full place-items-center text-sm text-faint">Loading badge…</div>
          )}
          <p
            className={`pointer-events-none absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-line-strong bg-bg/60 px-3.5 py-2 font-mono text-[10px] tracking-[0.25em] whitespace-nowrap text-muted uppercase backdrop-blur transition-opacity duration-700 ${
              touched ? "opacity-0" : "opacity-100"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-4 animate-bounce text-ai" aria-hidden="true">
              <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.8a6 6 0 0 1-4.6-2.2L4.3 15.6a1.5 1.5 0 0 1 2.3-1.9L9 16V11" />
            </svg>
            Drag · throw · tap to flip
          </p>
        </div>
      </div>
    </section>
  );
}
