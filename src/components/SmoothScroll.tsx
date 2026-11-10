"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Site-wide inertial scrolling (Lenis), kept in lock-step with GSAP
 * ScrollTrigger. Paused while the intro is on screen; off entirely for
 * people who prefer reduced motion.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      lerp: 0.085,
      smoothWheel: true,
      // #hash links are handled by RouteTransition so menu links work from any page
      anchors: false,
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    const w = window as unknown as { __introDone?: boolean; __lenis?: Lenis };
    w.__lenis = lenis;
    if (!w.__introDone) lenis.stop();
    const start = () => {
      lenis.scrollTo(0, { immediate: true });
      lenis.start();
    };
    window.addEventListener("intro:reveal", start);

    return () => {
      window.removeEventListener("intro:reveal", start);
      gsap.ticker.remove(tick);
      lenis.destroy();
      delete w.__lenis;
    };
  }, []);

  return null;
}
