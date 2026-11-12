import { ViewTransition, type CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, Ring, Roll } from "@/components/Buttons";
import LoopVideo from "@/components/projects/LoopVideo";
import ProjectChapters from "@/components/projects/ProjectChapters";
import ProjectHero from "@/components/projects/ProjectHero";
import { builtProjects, projectBySlug } from "@/data/projects";

// One film-led page per built project. Facts come from the project's own repo and films.

// Navigations into a project wait for the whole (static) page, so the preview clip and this
// page's film render in the same commit and the view transition can morph one into the other.
export const instant = false;

export function generateStaticParams() {
  return builtProjects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const p = projectBySlug(slug);
  if (!p) return {};
  return {
    title: p.name,
    description: p.tagline,
    openGraph: {
      title: `${p.name} · Himanshu Patial`,
      description: p.tagline,
      images: [{ url: `/projects/${p.slug}/poster.jpg`, width: 1600, height: 900 }],
    },
  };
}

export default async function ProjectPage(props: PageProps<"/projects/[slug]">) {
  const { slug } = await props.params;
  const p = projectBySlug(slug);
  if (!p) notFound();
  const index = builtProjects.indexOf(p);
  const next = builtProjects[(index + 1) % builtProjects.length];

  return (
    <article
      data-shape="none"
      data-project={p.slug}
      className="project-page relative isolate"
      style={{ "--p-acc": p.accent.dark, "--p-acc-l": p.accent.light, "--p-rgb": p.accent.rgb } as CSSProperties}
    >
      {/* the room takes on the product's colour (and, on Med-pedia's safety chapter, the tone's) */}
      <div aria-hidden="true" className="project-ambient">
        <span className="amb-base" />
        <span className="amb-tone amb-urgent" />
        <span className="amb-tone amb-caution" />
        <span className="amb-tone amb-steady" />
      </div>

      <ProjectHero p={p} index={index} total={builtProjects.length} />

      {/* at a glance */}
      <section aria-label="At a glance" className="mx-auto max-w-7xl px-4 pt-14 sm:px-6 md:pt-20">
        <dl className="grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {p.facts.map((f) => (
            <div key={f.label}>
              <dt className="font-mono text-[10.5px] tracking-[0.16em] text-faint uppercase">{f.label}</dt>
              <dd className="mt-2 text-[15px] leading-snug">{f.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-5">
          <ul className="flex flex-wrap gap-2">
            {p.stack.map((s) => (
              <li key={s} className="rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
                {s}
              </li>
            ))}
          </ul>
          {p.links.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {p.links.map((l, i) => (
                <a
                  key={l.href}
                  href={l.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={i === 0 ? "btn btn-primary cursor-target" : "btn btn-line cursor-target"}
                >
                  <Roll text={l.label} />
                  {i === 0 && <Chip dir="ne" />}
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <ProjectChapters p={p} />

      {/* next project: its clip grows into its page, the same way this one did */}
      <section className="relative border-t border-line">
        <Link
          href={`/projects/${next.slug}`}
          className="cursor-target group mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-[1fr_minmax(0,0.85fr)] md:py-28"
          style={{ "--n-acc": next.accent.dark } as CSSProperties}
        >
          <span>
            <span className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">Next project</span>
            <span className="mt-4 block font-display text-[clamp(3rem,8vw,7rem)] leading-[0.88] tracking-[-0.04em] transition-colors duration-500 group-hover:text-[var(--n-acc)]">
              {next.name} <span aria-hidden="true">→</span>
            </span>
            <span className="mt-4 block text-muted">{next.tagline}</span>
          </span>
          <ViewTransition name={`film-${next.slug}`} share="morph" default="none">
            <span className="relative block aspect-[16/10] overflow-hidden rounded-[22px] border border-white/12 bg-[#0b0b0b] transition-transform duration-700 group-hover:scale-[1.02]">
              <LoopVideo src={next.video.loop} webm={next.video.loopWebm} poster={next.video.loopPoster} className="absolute inset-0 size-full object-cover" />
            </span>
          </ViewTransition>
        </Link>
        <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/#projects" className="link-roll cursor-target">
            <Ring dir="w" />
            <Roll text="All projects" />
          </a>
        </div>
      </section>
    </article>
  );
}
