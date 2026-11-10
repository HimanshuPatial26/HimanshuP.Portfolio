"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import Toaster from "@/components/Toaster";
import StaggeredMenu from "@/components/reactbits/StaggeredMenu";
import { useFinePointer } from "@/hooks/useClientFlags";
import { useTheme } from "@/hooks/useTheme";
import { profile } from "@/data/resume";

const TargetCursor = dynamic(() => import("@/components/reactbits/TargetCursor"), { ssr: false });

// "/#…" so the links work from case-study pages too (RouteTransition handles both)
const menuItems = [
  { label: "Home", ariaLabel: "Back to the top", link: "/#top" },
  { label: "About", ariaLabel: "About Himanshu", link: "/#about" },
  { label: "Work", ariaLabel: "Selected work", link: "/#work" },
  { label: "Journey", ariaLabel: "Career journey", link: "/#journey" },
  { label: "Contact", ariaLabel: "Contact", link: "/#contact" },
];

const socialItems = [
  { label: "Email", link: `mailto:${profile.email}` },
  { label: "Resume (PDF)", link: profile.resumeUrl },
];

/** A hairline across the top of the screen that fills as you scroll down the page. */
function ScrollProgress() {
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (barRef.current) barRef.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div
      ref={barRef}
      aria-hidden="true"
      data-chrome
      className="pointer-events-none fixed inset-x-0 top-0 z-[46] h-[2px] origin-left scale-x-0 bg-gradient-to-r from-ai to-growth"
    />
  );
}

export default function SiteChrome() {
  const finePointer = useFinePointer();
  const { theme } = useTheme();

  return (
    <>
      {/* soft fade behind the fixed header so content scrolling under it stays legible */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 z-[35] h-24 bg-gradient-to-b from-bg/90 via-bg/50 to-transparent"
      />

      <ScrollProgress />
      <Toaster />

      {/* React Bits: Staggered Menu (full-screen layered menu) */}
      <StaggeredMenu
        isFixed
        position="right"
        items={menuItems}
        socialItems={socialItems}
        displaySocials
        displayItemNumbering
        logoUrl="/hp-logo.svg"
        menuButtonColor="#f4f4f4"
        openMenuButtonColor="#000000"
        changeMenuColorOnOpen
        colors={["#232323", "#0146f9"]}
        accentColor="#0146f9"
      />

      {/* React Bits: Target Cursor, mouse and trackpad only */}
      {finePointer && (
        <TargetCursor
          targetSelector=".cursor-target, a, button"
          cursorColor={theme === "light" ? "#0a0a0a" : "#f4f4f4"}
          spinDuration={2.4}
          hideDefaultCursor
          matchRadius
          clickEffect
        />
      )}
    </>
  );
}
