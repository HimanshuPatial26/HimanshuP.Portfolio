import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Ring, Roll } from "@/components/Buttons";
import type { AcademicProject } from "@/data/projects";

/** The page wrapper: the project's colour, and the room's glow behind everything. */
export function AcademicArticle({ p, children }: { p: AcademicProject; children: ReactNode }) {
  return (
    <article
      data-shape="none"
      data-project={p.id}
      className="project-page relative isolate"
      style={{ "--p-acc": p.accent.dark, "--p-acc-l": p.accent.light, "--p-rgb": p.accent.rgb } as CSSProperties}
    >
      <div aria-hidden="true" className="project-ambient">
        <span className="amb-base" />
      </div>
      {children}
    </article>
  );
}

/** The page title block, carried by the story's first chapter. */
export function AcademicHeader({ p, title, subtitle }: { p: AcademicProject; title: string; subtitle: string }) {
  return (
    <>
      <div className="rise-in flex flex-wrap items-center gap-x-5 gap-y-3">
        {/* plain <a>: RouteTransition takes it back to the list */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/#projects" className="link-roll cursor-target">
          <Ring dir="w" />
          <Roll text="All projects" />
        </a>
        <span className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">04 / Projects · From my Master&apos;s</span>
        <span className="flex gap-2">
          <span className="rounded-full border border-[var(--acc)]/60 px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-[var(--acc)] uppercase">{p.kind}</span>
          <span className="rounded-full border border-line-strong px-2.5 py-0.5 font-mono text-[10.5px] tracking-[0.12em] text-muted uppercase">{p.period}</span>
        </span>
      </div>
      <h1 className="rise-in mt-7 text-[clamp(2.7rem,6vw,5.4rem)] leading-[0.9] tracking-[-0.045em]" style={{ animationDelay: "80ms" }}>
        {title}
      </h1>
      <p className="rise-in mt-4 font-display text-[clamp(1.05rem,1.7vw,1.45rem)] leading-tight text-[var(--acc)]" style={{ animationDelay: "140ms" }}>
        {subtitle}
      </p>
      <p className="rise-in mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base" style={{ animationDelay: "200ms" }}>
        {p.tagline}
      </p>
      <p className="rise-in mt-4 font-mono text-[10.5px] tracking-[0.14em] text-faint uppercase" style={{ animationDelay: "240ms" }}>
        {p.credit}
      </p>
    </>
  );
}

/** How the work was done: evidence streams, then methods and frameworks as tags. */
export function MethodSection({ title, streams, tags, note }: { title: string; streams: { label: string; body: string }[]; tags: string[]; note?: string }) {
  return (
    <section aria-label={title} className="mx-auto max-w-7xl px-4 pt-10 pb-20 sm:px-6 md:pb-28">
      <div className="border-t border-line pt-10">
        <p className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">Method</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.02]">{title}</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {streams.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-6">
              <p className="font-mono text-[10.5px] tracking-[0.16em] text-[var(--acc)] uppercase">{s.label}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <ul className="mt-6 flex flex-wrap gap-2">
          {tags.map((t) => (
            <li key={t} className="rounded-full border border-line-strong px-3 py-1 text-xs text-muted">
              {t}
            </li>
          ))}
        </ul>
        {note && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-faint">{note}</p>}
      </div>
    </section>
  );
}

/** On to the other Master's project. */
export function NextAcademic({ next }: { next: AcademicProject }) {
  return (
    <section className="relative border-t border-line">
      <Link
        href={`/projects/${next.id}`}
        className="cursor-target group mx-auto flex min-h-[55svh] max-w-7xl flex-col justify-center px-4 py-20 sm:px-6 md:items-end md:text-right"
        style={{ "--n-acc": next.accent.dark } as CSSProperties}
      >
        <span className="font-mono text-[11px] tracking-[0.16em] text-faint uppercase">Next from my Master&apos;s</span>
        <span className="mt-4 font-display text-[clamp(2.6rem,7vw,6rem)] leading-[0.9] tracking-[-0.04em] transition-colors duration-500 group-hover:text-[var(--n-acc)]">
          {next.name} <span aria-hidden="true">→</span>
        </span>
        <span className="mt-3 text-muted">{next.line}</span>
      </Link>
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/#projects" className="link-roll cursor-target">
          <Ring dir="w" />
          <Roll text="All projects" />
        </a>
      </div>
    </section>
  );
}
