"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The 3D scene is browser-only (WebGL), so it never renders on the server.
const ChromeScene = dynamic(() => import("@/components/scene/ChromeScene"), { ssr: false });

/**
 * Full brightness in the hero; once you scroll into the content the 3D world
 * dims a little (more on phones, where it sits directly behind the text).
 */
function SceneDimmer() {
  const [dim, setDim] = useState(false);
  useEffect(() => {
    const onScroll = () => setDim(window.scrollY > window.innerHeight * 0.55);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 -z-[5] bg-bg transition-opacity duration-700 ${
        dim ? "opacity-55 md:opacity-25" : "opacity-0"
      }`}
    />
  );
}

export default function SceneMount() {
  return (
    <>
      <ChromeScene />
      <SceneDimmer />
    </>
  );
}
