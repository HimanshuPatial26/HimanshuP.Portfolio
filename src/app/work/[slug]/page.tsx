import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { caseStudies, experience } from "@/data/resume";

// One static page per product. Content comes only from the resume: no invented detail.

// Navigations into a case study wait for the page (behind RouteTransition's
// particle scatter) rather than streaming a placeholder first.
export const instant = false;

export function generateStaticParams() {
  return caseStudies.map((c) => ({ slug: c.id }));
}

export async function generateMetadata(props: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = caseStudies.find((x) => x.id === slug);
  if (!c) return {};
  const description = `${c.kind}. ${c.result}.`;
  return {
    title: c.name,
    description,
    openGraph: { title: `${c.name} · Himanshu Patial`, description },
  };
}

export default async function CaseStudyPage(props: PageProps<"/work/[slug]">) {
  const { slug } = await props.params;
  const index = caseStudies.findIndex((x) => x.id === slug);
  if (index < 0) notFound();

  const c = caseStudies[index];
  const next = caseStudies[(index + 1) % caseStudies.length];
  const role = experience[0];
  const resumeLine = role.points[index];
  const isAI = c.tracks.includes("AI");
  const accent = isAI ? "text-ai" : "text-growth";

  return (
    <article>
      {/* hero */}
      <section
        data-shape={c.shape}
        data-pose="right"
        data-grade={c.tracks.length > 1 ? "" : isAI ? "ai" : "growth"}
        className="relative flex min-h-[100svh] flex-col justify-end"
      >
        <div className="mx-auto w-full max-w-7xl px-4 pt-32 pb-16 sm:px-6 sm:pb-24">
          {/* plain <a> on purpose: RouteTransition intercepts it for the particle page transition */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#work" className="cursor-target rise-in mb-10 inline-flex items-center gap-2 font-mono text-xs tracking-widest text-muted uppercase hover:text-text">
            <span aria-hidden="true">←</span> All work
          </a>
          <div className="rise-in flex flex-wrap items-center gap-3" style={{ animationDelay: "80ms" }}>
            <span className="font-mono text-xs text-faint">{String(index + 1).padStart(2, "0")} / 06</span>
            {c.tracks.map((t) => (
              <span
                key={t}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase ${
                  t === "AI" ? "border-ai/50 text-ai" : "border-growth/50 text-growth"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
          <h1
            className="rise-in mt-6 max-w-5xl font-display text-[clamp(3.5rem,11vw,10rem)] leading-[0.86] tracking-[-0.03em] [font-variation-settings:'wght'_800,'wdth'_80,'opsz'_144]"
            style={{ animationDelay: "160ms" }}
          >
            {c.name}
          </h1>
          <p className="rise-in mt-5 text-xl text-muted" style={{ animationDelay: "240ms" }}>
            {c.kind}
          </p>
          <div className="rise-in mt-12 border-t border-line pt-6" style={{ animationDelay: "320ms" }}>
            <p className="font-mono text-[11px] tracking-widest text-faint uppercase">Result</p>
            <p
              className={`mt-2 max-w-3xl ${
                c.resultIsMetric
                  ? `font-display text-[clamp(2rem,4.5vw,3.75rem)] leading-tight font-bold tracking-tight ${accent}`
                  : "text-2xl leading-snug"
              }`}
            >
              {c.result}
            </p>
          </div>
        </div>
      </section>

      {/* body */}
      <section className="relative">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-24 sm:px-6 md:grid-cols-[18rem_1fr] md:gap-16">
          <aside className="md:sticky md:top-28 md:self-start">
            <dl className="glass space-y-5 rounded-3xl p-6 text-sm">
              <div>
                <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">Role</dt>
                <dd className="mt-1 text-text">{role.title}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">Company</dt>
                <dd className="mt-1 text-text">
                  {role.company} · {role.place}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">Period</dt>
                <dd className="mt-1 text-text">{role.period}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-widest text-faint uppercase">Type</dt>
                <dd className="mt-1 text-text">{c.kind}</dd>
              </div>
            </dl>
          </aside>

          <div className="glass space-y-14 rounded-3xl p-7 sm:p-12">
            <section aria-labelledby="problem">
              <h2 id="problem" className="font-mono text-xs tracking-widest text-faint uppercase">
                01 / The problem
              </h2>
              <p className="mt-4 font-display text-[clamp(1.6rem,3vw,2.4rem)] leading-tight tracking-tight [font-variation-settings:'wght'_560,'wdth'_90]">
                {c.problem}
              </p>
            </section>
            <section aria-labelledby="did">
              <h2 id="did" className="font-mono text-xs tracking-widest text-faint uppercase">
                02 / What I did
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">{c.built}</p>
              <blockquote className={`mt-6 border-l-2 pl-5 text-base leading-relaxed text-text ${isAI ? "border-ai" : "border-growth"}`}>
                <span className="mb-1 block font-mono text-[11px] tracking-widest text-faint uppercase">From my resume</span>
                {resumeLine}
              </blockquote>
            </section>
            <section aria-labelledby="result">
              <h2 id="result" className="font-mono text-xs tracking-widest text-faint uppercase">
                03 / The result
              </h2>
              <p className={`mt-4 font-display text-[clamp(1.8rem,3.5vw,2.75rem)] leading-tight font-bold tracking-tight ${accent}`}>
                {c.result}
              </p>
            </section>
          </div>
        </div>
      </section>

      {/* next */}
      <section data-shape="Shape_Plane" data-pose="left" data-chapter="Next case" className="relative border-t border-line">
        <a
          href={`/work/${next.id}`}
          className="cursor-target group mx-auto flex min-h-[70svh] max-w-7xl flex-col justify-center px-4 py-24 sm:px-6 md:items-end md:text-right"
        >
          <span className="font-mono text-xs tracking-widest text-faint uppercase">Next case study</span>
          <span className="mt-4 font-display text-[clamp(3rem,9vw,8rem)] leading-[0.88] tracking-[-0.03em] transition-[font-variation-settings] duration-700 [font-variation-settings:'wght'_500,'wdth'_60,'opsz'_144] group-hover:[font-variation-settings:'wght'_900,'wdth'_110,'opsz'_144]">
            {next.name} <span aria-hidden="true">→</span>
          </span>
          <span className="mt-3 text-muted">{next.kind}</span>
        </a>
      </section>
    </article>
  );
}
