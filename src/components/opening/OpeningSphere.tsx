"use client";

import { useSyncExternalStore } from "react";
import WobblingLatticeSphere from "@/components/originkit/ui/lattice-sphere/wobbling-lattice-sphere";
import { useTheme } from "@/hooks/useTheme";

const noop = () => () => {};

/**
 * The loading screen's centrepiece: Originkit's Wobbling Lattice Sphere, a wire cube that
 * sweeps into a sphere and back, drawn above the counter on a transparent canvas so the
 * cover's own ground shows through. Dark theme only for now; the light theme gets its own
 * piece later. It waits for hydration, so the saved theme is known before it draws, then
 * fades in. Drag turns it, a tap sends a ripple over it. It stops when the opening unmounts.
 */
export default function OpeningSphere() {
  const { theme } = useTheme();
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  if (!hydrated || theme !== "dark") return null;
  return (
    // the lower edge stops short of the foot, so the sphere sits in the open space above the counter
    <div className="opening-sphere absolute inset-x-0 top-0 bottom-[18%]" aria-hidden="true">
      <WobblingLatticeSphere background="transparent" style={{ minWidth: 0, minHeight: 0 }} />
    </div>
  );
}
