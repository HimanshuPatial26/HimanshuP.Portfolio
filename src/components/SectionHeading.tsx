"use client";

import ScrollFloat from "@/components/reactbits/ScrollFloat";

type Props = {
  index: string;
  eyebrow: string;
  title: string;
  intro?: string;
};

export default function SectionHeading({ index, eyebrow, title, intro }: Props) {
  return (
    <div className="mb-14 grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-end">
      <div>
        <p className="mb-4 font-mono text-xs tracking-widest text-faint uppercase">
          {index} / {eyebrow}
        </p>
        {/* React Bits: Scroll Float (letters float into place on scroll) */}
        <ScrollFloat
          effect="blur"
          splitBy="words"
          order="start"
          stagger={0.06}
          containerClassName="!my-0"
          textClassName="!text-left !text-[clamp(2.25rem,6vw,4.5rem)] !leading-[1.08] !font-semibold tracking-[-0.04em]"
        >
          {title}
        </ScrollFloat>
      </div>
      {intro && <p className="max-w-md text-base leading-relaxed text-muted md:justify-self-end">{intro}</p>}
    </div>
  );
}
