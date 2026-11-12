"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import SectionHeading from "@/components/SectionHeading";
import { Chip, Roll } from "@/components/Buttons";
import { caseStudies, type Track } from "@/data/resume";

const trackStyle: Record<Track, string> = {
  AI: "border-ai/50 text-ai",
  Growth: "border-growth/50 text-growth",
};

function Tags({ tracks }: { tracks: Track[] }) {
  return (
    <>
      {tracks.map((t) => (
        <span key={t} className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase ${trackStyle[t]}`}>
          {t}
        </span>
      ))}
    </>
  );
}

/**
 * Pinned story: on desktop the active case study's name and result stay pinned
 * on the left and swap as its details scroll past on the right.
 */
export default function Work() {
  const [active, setActive] = useState(0);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    itemRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const jump = (i: number) => {
    const el = itemRefs.current[i];
    if (!el) return;
    const lenis = (window as unknown as { __lenis?: { scrollTo: (t: HTMLElement, o?: object) => void } }).__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -window.innerHeight * 0.3 });
    else el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const c = caseStudies[active];
  const isAI = c.tracks.includes("AI");
  // the scene's light follows the case on screen: blue for AI, orange for growth, neutral for both
  const grade = c.tracks.length > 1 ? "" : isAI ? "ai" : "growth";

  return (
    <section
      id="work"
      data-shape="Shape_Phone"
      data-pose="deep"
      data-grade={grade}
      data-chapter="Work"
      data-chapter-no="03"
      className="relative"
    >
      <div className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32">
        <SectionHeading
          index="03"
          eyebrow="Selected work"
          title="Six products I shipped."
          intro="Built at Classplus between 2023 and 2025. Three put AI into the product and four moved conversion or revenue. AI-Convert did both."
        />
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-24 sm:px-6 md:grid-cols-[1.05fr_1fr] md:gap-16">
        {/* pinned summary (desktop) */}
        <div className="hidden md:block">
          <div className="sticky top-0 flex h-[100svh] items-center">
            <div className="flex w-full gap-8">
              <ol className="flex flex-col gap-2 pt-2" aria-label="Case studies">
                {caseStudies.map((cs, i) => (
                  <li key={cs.id}>
                    <button
                      type="button"
                      onClick={() => jump(i)}
                      aria-label={`Go to ${cs.name}`}
                      aria-current={i === active}
                      className="cursor-target group flex items-center gap-3 py-1"
                    >
                      <span
                        className={`h-px transition-all duration-500 ${
                          i === active ? `w-10 ${cs.tracks.includes("AI") ? "bg-ai" : "bg-growth"}` : "w-4 bg-line-strong group-hover:w-6"
                        }`}
                      />
                      <span className={`font-mono text-[11px] transition-colors ${i === active ? "text-text" : "text-faint"}`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>

              <div key={c.id} className="min-w-0 flex-1" aria-live="polite">
                <div className="swap-in flex flex-wrap items-center gap-3">
                  <span className="font-mono text-xs text-faint">{String(active + 1).padStart(2, "0")} / 06</span>
                  <Tags tracks={c.tracks} />
                </div>
                <h3
                  className="swap-in mt-6 font-display text-[clamp(2.75rem,5.5vw,5.25rem)] leading-[0.9] tracking-[-0.03em] [font-variation-settings:'wght'_800,'wdth'_80,'opsz'_144]"
                  style={{ animationDelay: "60ms" }}
                >
                  {c.name}
                </h3>
                <p className="swap-in mt-3 text-lg text-muted" style={{ animationDelay: "120ms" }}>
                  {c.kind}
                </p>
                <div className="swap-in mt-10" style={{ animationDelay: "180ms" }}>
                  <p className="font-mono text-[11px] tracking-widest text-faint uppercase">Result</p>
                  <p
                    className={`mt-2 ${
                      c.resultIsMetric
                        ? `font-display text-[clamp(1.75rem,3vw,2.6rem)] leading-tight font-bold tracking-tight ${isAI ? "text-ai" : "text-growth"}`
                        : "max-w-md text-lg leading-relaxed text-text"
                    }`}
                  >
                    {c.result}
                  </p>
                </div>
                <a href={`/work/${c.id}`} className="btn btn-primary cursor-target swap-in mt-10" style={{ animationDelay: "240ms" }}>
                  <Roll text="Read the case study" />
                  <Chip />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* scrolling details */}
        <ol className="flex flex-col gap-6 md:gap-0">
          {caseStudies.map((cs, i) => {
            const ai = cs.tracks.includes("AI");
            return (
              <li
                key={cs.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                data-index={i}
                className="md:flex md:min-h-[85svh] md:items-center"
              >
                <article
                  data-active={i === active}
                  className={`spin-border cursor-target glass w-full rounded-3xl p-7 transition-[opacity,transform] duration-700 sm:p-9 ${
                    i === active ? "md:scale-100 md:opacity-100" : "md:scale-[0.96] md:opacity-40"
                  }`}
                >
                  {/* the case's object in chrome, rendered offline in Blender (blender/render_case_tiles.py):
                      electric blue behind AI work, graphite behind growth work */}
                  <div
                    className={`relative mb-7 aspect-[16/10] overflow-hidden rounded-2xl ${ai ? "bg-blue" : "bg-[#232323]"}`}
                    aria-hidden="true"
                  >
                    <Image src={`/tiles/${cs.id}.png`} alt="" fill sizes="(min-width: 768px) 42vw, 92vw" className="object-contain" />
                  </div>

                  {/* name + result shown inline on phones, where there's no pinned column */}
                  <div className="mb-6 md:hidden">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-faint">{String(i + 1).padStart(2, "0")} / 06</span>
                      <Tags tracks={cs.tracks} />
                    </div>
                    <h3 className="mt-4 font-display text-3xl font-extrabold tracking-tight">{cs.name}</h3>
                    <p className="mt-1 text-muted">{cs.kind}</p>
                  </div>

                  <dl className="space-y-6 text-[15px] leading-relaxed">
                    <div>
                      <dt className="mb-1.5 font-mono text-[11px] tracking-widest text-faint uppercase">Problem</dt>
                      <dd className="text-lg leading-snug text-text">{cs.problem}</dd>
                    </div>
                    <div>
                      <dt className="mb-1.5 font-mono text-[11px] tracking-widest text-faint uppercase">What I did</dt>
                      <dd className="text-muted">{cs.built}</dd>
                    </div>
                    <div className="md:hidden">
                      <dt className="mb-1.5 font-mono text-[11px] tracking-widest text-faint uppercase">Result</dt>
                      <dd className={`text-xl font-bold ${ai ? "text-ai" : "text-growth"}`}>{cs.result}</dd>
                    </div>
                  </dl>
                  <a
                    href={`/work/${cs.id}`}
                    className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-text underline-offset-4 hover:underline md:hidden"
                  >
                    Read the case study <span aria-hidden="true">→</span>
                  </a>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
