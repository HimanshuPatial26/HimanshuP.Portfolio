"use client";

import ClickSpark from "@/components/reactbits/ClickSpark";

// React Bits: Click Spark, a small, quiet burst of electric blue and white on every click.
export default function Sparks({ children }: { children: React.ReactNode }) {
  return (
    <ClickSpark sparkColor={["#3a6dff", "#ffffff"]} sparkCount={6} sparkRadius={14} shape="dot" glow={0.12}>
      {children}
    </ClickSpark>
  );
}
