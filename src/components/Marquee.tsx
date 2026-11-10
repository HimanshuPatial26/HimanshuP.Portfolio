"use client";

import ScrollVelocity from "@/components/reactbits/ScrollVelocity";
import { useTheme } from "@/hooks/useTheme";

const rows = [
  "AI products · RAG · LLMs · Conversational AI · Automation ·",
  "Growth · Conversion · Payments · CRM · Lead scoring ·",
];

export default function Marquee() {
  const { theme } = useTheme();
  return (
    <section aria-label="Focus areas" className="overflow-hidden border-y border-line py-7">
      {/* React Bits: Scroll Velocity (speed and skew follow your scroll) */}
      <ScrollVelocity
        texts={rows}
        velocity={55}
        numCopies={6}
        fadeEdges
        skewWithVelocity={6}
        outlineAlternate
        gap={32}
        fontSize="clamp(2.25rem, 6vw, 4.75rem)"
        fontWeight={400}
        color={theme === "light" ? "#0a0a0a" : "#f4f4f4"}
        className="font-display"
      />
    </section>
  );
}
