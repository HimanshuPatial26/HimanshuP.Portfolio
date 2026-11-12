"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Chip, Roll } from "@/components/Buttons";
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
              className="btn btn-primary btn-lg btn-plain cursor-target"
            >
              <Roll text={profile.email} />
              <Chip dir="ne" />
            </a>
          </Magnet>
          {/* copy → copied: the dot floods blue and "Copied" rolls in */}
          <button
            type="button"
            onClick={copyEmail}
            data-lit={copied || undefined}
            aria-label={copied ? "Email copied" : "Copy email address"}
            className="btn btn-line cursor-target"
          >
            <span className="btn-swap" data-on={copied || undefined}>
              <Roll text="Copy email" />
              <span aria-hidden="true">Copied ✓</span>
            </span>
          </button>
          <a href={profile.resumeUrl} download className="btn btn-line cursor-target">
            <Roll text="Download resume (PDF)" />
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
