"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import Magnet from "@/components/reactbits/Magnet";
import Scribble from "@/components/Scribble";
import { DotsTag } from "@/components/Tags";
import { toast } from "@/components/Toaster";
import { profile } from "@/data/resume";
import { useTheme } from "@/hooks/useTheme";

// Bead Cloth Lift (Originkit): a sheet of beads pulled into a creased peak, lit by a blue band;
// it answers the pointer (touch, grab and pull the peak, tap for a ripple). WebGL, client only.
const BeadCloth = dynamic(() => import("@/components/BeadCloth"), { ssr: false });

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const { theme } = useTheme();

  const copyEmail = async () => {
    window.dispatchEvent(new Event("plane:launch"));
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      toast("Email copied", `${profile.email} is on your clipboard`);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = `mailto:${profile.email}`;
    }
  };

  return (
    // data-shape="none": the 3D element melts away here and the bead cloth takes the stage
    <section id="contact" data-shape="none" data-chapter="Contact" data-chapter-no="06" className="relative isolate overflow-hidden border-t border-line">
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <BeadCloth
          background="transparent"
          clothColor={theme === "light" ? "#1b2440" : "#000D2B"}
          glowColor={theme === "light" ? "#0146f9" : "#1F5CFF"}
          placement={{ x: 28, y: 16 }}
          zoom={88}
          rippleOn="plane:launch"
        />
        {/* keeps the heading and buttons on the left readable over the beads */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-bg/80 via-bg/25 to-transparent" />
      </div>

      <div className="pointer-events-none mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-4 py-28 sm:px-6">
        <p className="mb-6 font-mono text-xs tracking-widest text-faint uppercase">06 / Contact</p>
        <h2 className="max-w-5xl text-[clamp(2.6rem,8vw,7rem)] leading-[0.9]">
          Hiring for an{" "}
          <Scribble kind="line" className="text-ai">
            AI
          </Scribble>{" "}
          or{" "}
          <Scribble kind="line" className="text-ai">
            growth
          </Scribble>{" "}
          PM?
        </h2>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
          I&apos;m based in {profile.location} and open to product roles. Email is the fastest way to reach me.
        </p>

        <div className="pointer-events-auto mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          {/* React Bits: Magnet */}
          <Magnet padding={80} magnetStrength={3}>
            <a
              href={`mailto:${profile.email}`}
              onClick={() => window.dispatchEvent(new Event("plane:launch"))}
              className="cursor-target inline-flex items-center justify-center rounded-full bg-text px-8 py-4 text-base font-medium text-bg transition-opacity hover:opacity-90"
            >
              {profile.email}
            </a>
          </Magnet>
          {/* copy → copied morph, from Uiverse.io by fabiodevbr (MIT) */}
          <button
            type="button"
            onClick={copyEmail}
            data-state={copied ? "copied" : "idle"}
            aria-label={copied ? "Email copied" : "Copy email address"}
            className="btn-copy cursor-target"
          >
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4" aria-hidden="true">
                <rect x="8" y="8" width="12" height="12" rx="2.5" />
                <path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8" />
              </svg>
              Copy email
            </span>
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="size-4">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
              Copied
            </span>
          </button>
          <a href={profile.resumeUrl} download className="btn-glow cursor-target">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="size-4" aria-hidden="true">
              <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" />
            </svg>
            Download resume (PDF)
          </a>
        </div>
      </div>

      {/* full-width wordmark, edge to edge */}
      <div className="pointer-events-none relative overflow-hidden px-3 pt-10" aria-hidden="true">
        <div className="mb-4 flex items-center justify-between gap-4 px-1">
          <DotsTag>2026</DotsTag>
          <p className="micro max-w-[16rem] text-right text-muted">
            AI &amp; Growth Product Manager · {profile.location} · open to product roles
          </p>
        </div>
        <p className="font-display text-[12vw] leading-[0.8] tracking-[-0.06em] whitespace-nowrap text-text">Himanshu Patial</p>
      </div>

      <footer className="relative border-t border-line bg-bg/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-faint sm:flex-row sm:justify-between sm:px-6">
          <p>© {profile.name}</p>
          <p>
            Components adapted from{" "}
            <a href="https://reactbits.dev" className="underline underline-offset-2 hover:text-muted">
              React Bits
            </a>{" "}
            and{" "}
            <a href="https://uiverse.io" className="underline underline-offset-2 hover:text-muted">
              Uiverse
            </a>{" "}
            (MIT), and Originkit
          </p>
        </div>
      </footer>
    </section>
  );
}
