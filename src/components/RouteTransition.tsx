"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type LenisLike = { scrollTo: (t: number | HTMLElement, o?: object) => void };
const lenis = () => (window as unknown as { __lenis?: LenisLike }).__lenis;

function scrollToHash(hash: string, immediate: boolean) {
  const el = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
  const l = lenis();
  if (l) l.scrollTo(el ?? 0, { offset: el ? -72 : 0, immediate });
  else if (el) el.scrollIntoView({ behavior: immediate ? "auto" : "smooth" });
  else window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  // move keyboard focus too (skip link, menu), without a second jump
  if (el && el.tabIndex < 0 && !el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
  el?.focus({ preventScroll: true });
}

/**
 * Page transitions for the whole site. Intercepts clicks on internal links
 * (plain <a> tags, including the menu), scatters the particle sculpture behind
 * a quick fade, swaps the page, then lets the particles gather into the new
 * page's first shape. Same-page #hash links get a smooth scroll instead.
 */
export default function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [covered, setCovered] = useState(false);
  const pendingHash = useRef("");
  const first = useRef(true);

  // intercept internal link clicks
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.protocol === "mailto:") return;

      if (url.pathname === location.pathname) {
        if (url.hash) {
          e.preventDefault();
          history.replaceState(null, "", url.hash);
          scrollToHash(url.hash, false);
        }
        return;
      }

      e.preventDefault();
      pendingHash.current = url.hash;
      window.dispatchEvent(new Event("route:leave"));
      setCovered(true);
      window.setTimeout(() => router.push(url.pathname + url.search, { scroll: false }), reduce ? 0 : 520);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [router]);

  // after the new page renders: position, re-read shapes, reveal
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const hash = pendingHash.current || location.hash;
    pendingHash.current = "";
    scrollToHash(hash, true);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("route:enter"));
        setCovered(false);
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [pathname]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[90] bg-bg transition-opacity duration-500 ease-out ${
        covered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-px origin-left bg-gradient-to-r from-ai to-growth transition-transform duration-[600ms] ${covered ? "scale-x-100" : "scale-x-0"}`} />
    </div>
  );
}
