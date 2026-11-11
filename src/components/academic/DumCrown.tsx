"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { quietMedia } from "@/components/projects/LoopVideo";
import type { StoryState } from "@/components/academic/StickyStory";

/**
 * One chapter's stretch of the package's animation: which exported clip, and the seconds of it
 * the chapter scrubs through as it scrolls past. The clips (from the Blender handoff) each key
 * every moving part, so any clip fully defines the pose: DC_Unbox (closed → lid open),
 * DC_StoryReveal (story card lifts and turns), DC_PeelReveal (card set aside, seal peels back),
 * DC_Explode (closed → layers apart).
 */
export type Beat = { clip: "DC_Unbox" | "DC_StoryReveal" | "DC_PeelReveal" | "DC_Explode"; from: number; to: number };

type Props = {
  url: string;
  poster: string;
  beats: Beat[];
  state: RefObject<StoryState>;
};

const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));

/** A soft round shadow under the package, so it sits on something. */
function contactShadow() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.45, "rgba(0,0,0,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.0005;
  return m;
}

/**
 * The Dum Crown packaging concept (Behrouz group-order pack), live in three.js. Scroll position
 * in the story picks the clip and scrubs it; the camera re-frames to whatever is open, and the
 * package can be dragged round. Less motion: each chapter shows its finished pose, no idle turn.
 */
export default function DumCrown({ url, poster, beats, state }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(0); // 0..1 download progress; 1 = ready
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const quiet = quietMedia();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    } catch {
      // no WebGL: keep the rendered still (reported after this effect, not inside it)
      queueMicrotask(() => setFailed(true));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%;transition:opacity .28s ease";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.85;
    const key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(0.6, 1.2, 0.8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffc98a, 1.1);
    rim.position.set(-0.9, 0.5, -0.7);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 30);
    const pivot = new THREE.Group();
    scene.add(pivot);
    const shadow = contactShadow();
    pivot.add(shadow);

    // ---- size to the host
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ---- the model
    let mixer: THREE.AnimationMixer | null = null;
    const actions = new Map<string, THREE.AnimationAction>();
    let model: THREE.Object3D | null = null;
    const core: THREE.Object3D[] = []; // the pack itself (not the lid and band parked beside it)
    let disc: THREE.Object3D | null = null; // the story card: framed only while it's being read
    const food: THREE.Object3D[] = []; // hidden until the seal comes off: most of the geometry
    const draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    let disposed = false;
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        model = gltf.scene;
        pivot.add(model);
        model.traverse((o) => {
          if (["DC_Outer_Shell", "DC_Inner_Bowl"].includes(o.name)) core.push(o);
          if (o.name === "DC_Story_Disc") disc = o;
          if (o.name.startsWith("DC_Food_") && o.name !== "DC_Food_Root") food.push(o);
        });
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
          const a = mixer!.clipAction(clip);
          a.setLoop(THREE.LoopOnce, 1);
          a.clampWhenFinished = true;
          actions.set(clip.name, a);
        });
        draco.dispose();
        setLoaded(1);
      },
      (e) => {
        if (e.total) setLoaded(Math.min(0.99, e.loaded / e.total));
      },
      () => setFailed(true),
    );

    // ---- pose: one clip owns the package at a time
    let clipNow = "";
    let tNow = -1;
    let switching = 0; // a short fade while one clip hands over to another
    const pose = (clip: string, t: number) => {
      if (!mixer) return;
      const a = actions.get(clip);
      if (!a) return;
      if (clip !== clipNow) {
        actions.forEach((x) => x.stop());
        a.reset();
        a.play();
        a.paused = true;
        clipNow = clip;
      }
      a.time = Math.min(t, a.getClip().duration - 1e-3);
      mixer.update(0);
    };

    // ---- drag to turn
    let dragX: number | null = null;
    let yaw = 0;
    let yawVel = 0;
    const down = (e: PointerEvent) => {
      dragX = e.clientX;
      host.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (dragX === null) return;
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      yaw += dx * 0.008;
      yawVel = dx * 0.008;
    };
    const up = () => (dragX = null);
    host.addEventListener("pointerdown", down);
    host.addEventListener("pointermove", move);
    host.addEventListener("pointerup", up);
    host.addEventListener("pointercancel", up);

    // ---- loop (only while on screen)
    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    const look = new THREE.Vector3(0, 0.05, 0);
    let dist = 0.9;
    let raf = 0;
    let last = 0;
    let idle = 0;
    let visible = false;
    let lastSig = "";
    let tick = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if (!quiet) idle += dt;

      if (model && mixer) {
        const s = state.current;
        const beat = beats[Math.min(s.index, beats.length - 1)];
        // reach the beat's end about three quarters of the way through the chapter, then hold
        const target = quiet ? beat.to : beat.from + (beat.to - beat.from) * Math.min(1, s.progress * 1.35);
        if (beat.clip !== clipNow && clipNow) {
          // fade out, switch, fade back in
          if (!switching) {
            switching = now;
            renderer.domElement.style.opacity = "0";
          } else if (now - switching > 280) {
            tNow = target;
            pose(beat.clip, tNow);
            renderer.domElement.style.opacity = "1";
            switching = 0;
          }
        } else {
          tNow = tNow < 0 || quiet ? target : damp(tNow, target, 6, dt);
          pose(beat.clip, tNow);
        }

        // the food only shows once the seal is coming off
        const showFood = (beat.clip === "DC_PeelReveal" && tNow > 2.4) || beat.clip === "DC_Explode";
        food.forEach((f) => (f.visible = showFood));

        // frame the pack itself (the parked lid and band may sit partly outside); the exploded
        // view frames everything
        if (beat.clip === "DC_Explode" || core.length === 0) box.setFromObject(model);
        else {
          box.makeEmpty();
          core.forEach((o) => box.expandByObject(o));
          if (disc && (beat.clip === "DC_StoryReveal" || beat.clip === "DC_Unbox")) box.expandByObject(disc);
        }
        box.getCenter(center);
        box.getSize(size);
        const r = Math.max(size.x, size.y * 1.25, size.z) * (beat.clip === "DC_Explode" ? 0.6 : 0.78);
        const fit = r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect * 0.95);
        dist = damp(dist, fit, 3, dt);
        look.x = damp(look.x, center.x, 3, dt);
        look.y = damp(look.y, center.y, 3, dt);
        look.z = damp(look.z, center.z, 3, dt);
      }

      if (dragX === null) {
        yawVel *= Math.exp(-4 * dt);
        yaw += yawVel;
      }
      pivot.rotation.y = yaw + (quiet ? 0 : Math.sin(idle * 0.35) * 0.32);
      const sig = `${clipNow}|${tNow.toFixed(3)}|${dist.toFixed(4)}|${look.y.toFixed(4)}|${yaw.toFixed(4)}|${switching}`;
      const busy = sig !== lastSig || dragX !== null;
      lastSig = sig;
      tick++;
      if (!busy && (quiet || tick % 2)) return;
      const elev = THREE.MathUtils.degToRad(26);
      const az = THREE.MathUtils.degToRad(-28);
      camera.position.set(look.x + dist * Math.cos(elev) * Math.sin(az), look.y + dist * Math.sin(elev), look.z + dist * Math.cos(elev) * Math.cos(az));
      camera.lookAt(look);
      renderer.render(scene, camera);
    };
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        cancelAnimationFrame(raf);
        last = 0;
        if (visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
      },
      { threshold: 0.01 },
    );
    io.observe(host);
    const onVis = () => {
      cancelAnimationFrame(raf);
      last = 0;
      if (visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      mixer?.stopAllAction();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => {
          Object.values(mat).forEach((v) => v instanceof THREE.Texture && v.dispose());
          mat.dispose();
        });
      });
      env.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [url, beats, state]);

  return (
    <div className="relative">
      <div
        ref={hostRef}
        aria-hidden="true"
        className="relative aspect-[16/10] w-full cursor-grab touch-pan-y active:cursor-grabbing md:aspect-[5/4]"
      />
      {/* the rendered still stands in while the model loads (or if 3D can't run) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt="The Dum Crown packaging concept for Behrouz group orders, closed with its ceremonial band"
        className={`pointer-events-none absolute inset-0 size-full rounded-[22px] object-cover transition-opacity duration-700 ${loaded >= 1 && !failed ? "opacity-0" : "opacity-100"}`}
      />
      {loaded < 1 && !failed && (
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-white/80 uppercase backdrop-blur">
          Loading the package · {Math.round(loaded * 100)}%
        </span>
      )}
      <span className="pointer-events-none absolute top-3 right-3 hidden rounded-lg bg-black/45 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.14em] text-white/70 uppercase backdrop-blur md:block">
        Dum Crown · packaging concept · drag to turn
      </span>
    </div>
  );
}
