"use client";

import { useState } from "react";
import FoldText from "@/components/reactbits/FoldText";

type Props = {
  words: string[];
  /** start once the intro has finished (until then the first word only holds the space) */
  active?: boolean;
  className?: string;
};

/**
 * The hero's focus areas, one at a time: each word unfolds into place letter by letter, like
 * creased paper opening flat (React Bits Fold Text), holds, folds away along the same crease, and
 * the next word unfolds. Reduced motion: Fold Text swaps the words with a short fade instead.
 */
export default function FoldWords({ words, active = true, className = "" }: Props) {
  const [index, setIndex] = useState(0);
  const word = words[index % words.length].toUpperCase();

  if (!active) {
    return (
      <span className={`invisible ${className}`} aria-hidden="true">
        {words[0].toUpperCase()}
      </span>
    );
  }

  return (
    <span className={className}>
      <FoldText
        key={word}
        text={word}
        trigger="loop"
        loopDelay={2.1}
        onFolded={() => setIndex((n) => n + 1)}
        splitBy="char"
        hinge="top"
        foldStyle="paper"
        duration={0.6}
        stagger={0.04}
        foldAngle={95}
        perspective={260}
        creaseShading={0.6}
        fontSize="1em"
        fontWeight={400}
      />
    </span>
  );
}
