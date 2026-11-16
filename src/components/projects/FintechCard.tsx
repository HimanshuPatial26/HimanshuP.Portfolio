"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { quietMedia } from "@/components/projects/LoopVideo";

/*
 * FinTech's picture on the Projects stage: a glass card turning slowly in the light, the study
 * etched on its face (the structural model, both markets, R² 0.96, 71 responses), a sheen sliding
 * across it as it turns and the two market colours glowing behind. It leans toward the cursor.
 *
 * The WebGL is built the first time the stage comes near the screen (so it's ready before the card
 * is shown), draws only while FinTech is the project on stage and on screen, and holds a still
 * frame otherwise. Reduced motion or data-saver: a single still frame. No WebGL: the face alone.
 */

const W = 3.2; // the card, in scene units (credit-card proportions)
const H = W / 1.586;
const FACE_W = 1280;
const FACE_H = Math.round(FACE_W / 1.586);

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** The card's face: the study, etched. */
function drawFace(c: HTMLCanvasElement) {
  const f = c.getContext("2d");
  if (!f) return;
  const display = fontVar("--font-syne", "Arial, sans-serif");
  const mono = fontVar("--font-geist-mono", "ui-monospace, monospace");
  const w = c.width, h = c.height;
  const gr = f.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, "#0d1530");
  gr.addColorStop(0.55, "#0a0f22");
  gr.addColorStop(1, "#151a2e");
  f.fillStyle = gr;
  f.fillRect(0, 0, w, h);
  f.strokeStyle = "rgba(122,162,255,.08)";
  f.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { f.beginPath(); f.moveTo(x, 0); f.lineTo(x, h); f.stroke(); }
  for (let y = 0; y < h; y += 40) { f.beginPath(); f.moveTo(0, y); f.lineTo(w, y); f.stroke(); }
  // the chip
  const cg = f.createLinearGradient(90, 260, 230, 370);
  cg.addColorStop(0, "#e9d39b");
  cg.addColorStop(1, "#9c7a35");
  f.fillStyle = cg;
  f.beginPath();
  f.roundRect(90, 250, 150, 112, 18);
  f.fill();
  f.strokeStyle = "rgba(60,40,10,.55)";
  f.lineWidth = 3;
  [[90, 306, 240, 306], [165, 250, 165, 362], [120, 278, 210, 278], [120, 334, 210, 334]].forEach(([a, b, x, y]) => {
    f.beginPath(); f.moveTo(a, b); f.lineTo(x, y); f.stroke();
  });
  f.fillStyle = "#dfe6ff";
  f.font = `700 64px ${display}`;
  f.fillText("FINTECH ADOPTION", 90, 150);
  f.fillStyle = "#7f8db5";
  f.font = `500 30px ${mono}`;
  f.fillText("INDIA × DUBAI · PLS-SEM", 92, 200);
  // the structural model, etched: trust, ease, social → risk, usefulness → adoption (coral: the negative paths)
  const n: [number, number][] = [[720, 300], [720, 420], [720, 540], [930, 300], [930, 420], [1130, 420]];
  f.lineWidth = 3;
  [[0, 3], [0, 4], [1, 4], [2, 5], [3, 5], [4, 5]].forEach(([a, b], k) => {
    f.strokeStyle = k === 0 || k === 4 ? "rgba(255,138,122,.8)" : "rgba(122,162,255,.85)";
    f.beginPath();
    f.moveTo(n[a][0], n[a][1]);
    f.bezierCurveTo(n[a][0] + 90, n[a][1], n[b][0] - 90, n[b][1], n[b][0], n[b][1]);
    f.stroke();
  });
  n.forEach(([x, y], k) => {
    f.fillStyle = "#0b1124";
    f.strokeStyle = k === 5 ? "#9db4ff" : "rgba(223,230,255,.55)";
    f.beginPath();
    f.arc(x, y, k === 5 ? 30 : 20, 0, Math.PI * 2);
    f.fill();
    f.stroke();
  });
  f.fillStyle = "#9db4ff";
  f.font = `500 30px ${mono}`;
  f.fillText("R² 0.96", 1060, 490);
  f.fillStyle = "#dfe6ff";
  f.font = `500 44px ${mono}`;
  f.fillText("N 71  ·  36 / 35", 90, h - 90);
  f.fillStyle = "#7f8db5";
  f.font = `500 26px ${mono}`;
  f.fillText("SP JAIN · 2026", w - 330, h - 92);
}

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

type Engine = { setActive: (on: boolean) => void; dispose: () => void };

function createEngine(host: HTMLDivElement): Engine {
  const quiet = quietMedia();
  const face = document.createElement("canvas");
  face.width = FACE_W;
  face.height = FACE_H;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    renderer = null;
  }
  if (!renderer) {
    // no WebGL: the face alone, as a flat card
    face.className = "absolute left-1/2 top-1/2 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[4%] border border-white/20";
    host.appendChild(face);
    document.fonts?.ready.then(() => drawFace(face));
    return { setActive() {}, dispose: () => face.remove() };
  }
  const r = renderer;
  r.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
  r.setClearColor(0x070a14, 1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.domElement.className = "absolute inset-0 size-full";
  host.appendChild(r.domElement);

  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(28, 1.6, 0.1, 50);
  cam.position.set(0, 0, 6.3);
  scene.add(new THREE.AmbientLight(0x8fa2ff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 3, 4);
  const rim = new THREE.DirectionalLight(0x7aa2ff, 0.9);
  rim.position.set(-4, -1, -2);
  const key = new THREE.PointLight(0x9db4ff, 30, 12);
  key.position.set(-2, 2, 3);
  scene.add(sun, rim, key);

  // the two market colours glowing behind the card
  const gTex = glowTexture();
  const glow = (color: number, size: number, opacity: number, x: number, y: number) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: gTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(size);
    s.position.set(x, y, -1.3);
    scene.add(s);
  };
  glow(0x3a5cff, 4.2, 0.35, -0.9, 0.2);
  glow(0xd9a84e, 3.2, 0.22, 1.1, -0.3);

  // the card: a rounded slab, the face on its caps, polished metal round its edge
  const tex = new THREE.CanvasTexture(face);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, r.capabilities.getMaxAnisotropy());
  tex.repeat.set(1 / W, 1 / H);
  tex.offset.set(0.5, 0.5);
  const rr = 0.16;
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2 + rr, -H / 2);
  sh.lineTo(W / 2 - rr, -H / 2);
  sh.quadraticCurveTo(W / 2, -H / 2, W / 2, -H / 2 + rr);
  sh.lineTo(W / 2, H / 2 - rr);
  sh.quadraticCurveTo(W / 2, H / 2, W / 2 - rr, H / 2);
  sh.lineTo(-W / 2 + rr, H / 2);
  sh.quadraticCurveTo(-W / 2, H / 2, -W / 2, H / 2 - rr);
  sh.lineTo(-W / 2, -H / 2 + rr);
  sh.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + rr, -H / 2);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3 });
  geo.center();
  const faceMat = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.32, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.5, iridescenceIOR: 1.4 });
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0x9db4ff, roughness: 0.2, metalness: 0.9 });
  const cardMesh = new THREE.Mesh(geo, [faceMat, edgeMat]);
  scene.add(cardMesh);

  // the sheen: a soft band of light sliding over the face as the card turns
  const sc = document.createElement("canvas");
  sc.width = 512;
  sc.height = 16;
  const sg = sc.getContext("2d");
  if (sg) {
    const g = sg.createLinearGradient(0, 0, 512, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.36, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(200,215,255,.16)");
    g.addColorStop(0.64, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    sg.fillStyle = g;
    sg.fillRect(0, 0, 512, 16);
  }
  const sheenTex = new THREE.CanvasTexture(sc);
  sheenTex.wrapS = THREE.RepeatWrapping;
  const sheen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: sheenTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sheen.position.z = 0.05;
  cardMesh.add(sheen);

  // the face is drawn once the site's fonts are in
  drawFace(face);
  tex.needsUpdate = true;
  document.fonts?.ready.then(() => {
    drawFace(face);
    tex.needsUpdate = true;
    if (!running) draw(performance.now());
  });

  // the cursor, over the card
  let px = 0, py = 0;
  const onMove = (e: PointerEvent) => {
    const b = host.getBoundingClientRect();
    px = ((e.clientX - b.left) / b.width) * 2 - 1;
    py = ((e.clientY - b.top) / b.height) * 2 - 1;
  };
  const onLeave = () => { px = py = 0; };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);

  const size = () => {
    const w = Math.max(1, Math.round(host.clientWidth)), h = Math.max(1, Math.round(host.clientHeight));
    r.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(() => { size(); if (!running) draw(performance.now()); });
  ro.observe(host);
  size();

  let last = performance.now();
  const draw = (now: number) => {
    const t = now / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = quiet ? 1 : 1 - Math.exp(-dt * 3);
    const ry = (quiet ? 0.28 : Math.sin(t * 0.45) * 0.5) + px * 0.35;
    const rx = (quiet ? 0.05 : Math.sin(t * 0.33) * 0.12) - py * 0.25;
    cardMesh.rotation.y += (ry - cardMesh.rotation.y) * k;
    cardMesh.rotation.x += (rx - cardMesh.rotation.x) * k;
    cardMesh.position.y = quiet ? 0 : Math.sin(t * 0.8) * 0.04;
    sheenTex.offset.x = -cardMesh.rotation.y * 0.9 + 0.1;
    key.position.x = quiet ? -1 : -2 + Math.sin(t * 0.4) * 2;
    r.render(scene, cam);
  };

  // draw while on stage and on screen; otherwise hold the last frame
  let active = false, visible = false, raf = 0, running = false;
  const loop = (now: number) => {
    draw(now);
    raf = requestAnimationFrame(loop);
  };
  const update = () => {
    const want = active && visible && !document.hidden && !quiet;
    if (want && !running) {
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    } else if (!want && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
    if (!running) draw(performance.now());
  };
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; update(); }, { rootMargin: "120px" });
  io.observe(host);
  document.addEventListener("visibilitychange", update);

  return {
    setActive(on) {
      active = on;
      update();
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", update);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => x.dispose());
      });
      [tex, sheenTex, gTex].forEach((x) => x.dispose());
      r.dispose();
      r.forceContextLoss();
      r.domElement.remove();
    },
  };
}

export default function FintechCard({ active }: { active: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const activeRef = useRef(active);

  // build the WebGL the first time the stage comes near the screen; keep it until unmount
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || engineRef.current) return;
        engineRef.current = createEngine(host);
        engineRef.current.setActive(activeRef.current);
        io.disconnect();
      },
      { rootMargin: "600px" },
    );
    io.observe(host);
    return () => {
      io.disconnect();
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    activeRef.current = active;
    engineRef.current?.setActive(active);
  }, [active]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label="FinTech adoption: a glass card etched with the study's structural model, India and Dubai, R² 0.96 from 71 responses"
      className="absolute inset-0 overflow-hidden bg-[#070a14]"
    />
  );
}
