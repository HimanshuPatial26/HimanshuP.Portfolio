"use client";

/**
 * Full-site liquid-chrome scene (mounted once in the root layout).
 *
 * Every section asks for an object with `data-shape`: the hero is a liquid
 * glass orb (froth at its edges, a liquid sheet inside) with orbiting bubbles; the other sections get chunky shapes built in
 * Blender (public/models/chrome-shapes.glb) or 3D text in Syne for
 * `data-shape="text:₹4M"`. Between sections the current object melts into a
 * liquid blob and the blob re-forms into the next one: every object maps onto
 * the same "blob" surface, so the hand-over at the midpoint is seamless.
 *
 * The look (from his reference): clear, colourless liquid glass in a
 * black-and-white studio, with a faint prismatic fringe. The glass sees a bright
 * studio of warped bands through itself (drawn only into the refraction pass;
 * the page behind stays black or grey), which refraction bends into black liquid
 * streaks. On capable desktops highlights also bloom; phones, small laptops and
 * slow frame rates fall back to silver chrome without bloom. The black → blue
 * horizon of the page is drawn here (not in CSS).
 *
 * The camera is one continuous shot: each shape has a ShotIn/ShotOut empty
 * (placed in Blender); it drifts In → Out while a section is on screen and
 * arcs to the next shape's In between sections.
 *
 * Section attributes: data-shape ("none" = no 3D object, the section brings its own visual), data-pose (framing), data-stop="tight"
 * (short steps under a pinned screen), data-grade ("ai" | "growth"),
 * data-chapter / data-chapter-no.
 * Reads film.intro (the opening). Writes morph, chapter, grade, velocity,
 * formed and quality to `film` for the overlays and sound.
 * Events in: "route:leave", "route:enter", "themechange", "plane:launch", "scene:spin" (drag
 * to turn the object), "scene:reshape" (a section changed its data-shape in place).
 * Events out: "scene:progress" (0..1), "scene:ready".
 * Add ?hq to the URL to keep glass and bloom on regardless of the device.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { TTFLoader } from "three/examples/jsm/loaders/TTFLoader.js";
import { Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TessellateModifier } from "three/examples/jsm/modifiers/TessellateModifier.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { film } from "@/lib/film";

/** Where the subject sits on screen (fx, fy in -1..1) and how far the camera stands. */
type Frame = { fx: number; fy: number; dist: number };

// solid chrome reads much bigger than particles did, so the camera stands further back
const FRAMES: Record<string, Frame> = {
  center: { fx: 0, fy: -0.02, dist: 10 },
  back: { fx: 0.1, fy: 0.02, dist: 13 },
  low: { fx: 0, fy: -0.4, dist: 11.5 },
  right: { fx: 0.5, fy: 0, dist: 12.5 },
  left: { fx: -0.5, fy: 0, dist: 12.5 },
  "back-right": { fx: 0.52, fy: -0.04, dist: 13.5 },
  deep: { fx: 0.14, fy: 0, dist: 13.5 },
  // Impact numbers: right half beside the list on desktop (pulled back to fit), top half on phones
  number: { fx: 0.42, fy: 0.04, dist: 6.5 },
};

const REF_DIST = 7;
const FRONT_SHOT = { in: new THREE.Vector3(0, 0.25, 7.2), out: new THREE.Vector3(0, 0.2, 6.9) };
/** How far the camera eases in during a hand-over (kept small: the objects are solid). */
const DIP = 0.22;
/** Radius of the shared liquid blob every object melts into. */
const BLOB_R = 1.55;
const HERO = "Shape_Globe"; // the hero's data-shape: the liquid glass orb (blender/orb_shape.py)

// horizon: the reference's electric blue rising from the bottom of the screen (as --horizon in globals.css)
const PALETTE = {
  dark: { bg: "#000000", tintAI: "#00061c", tintGrowth: "#070708", metal: "#ffffff", metalAI: "#eef1f8", haloN: "#0b1430", haloAI: "#0146f9", haloGrowth: "#8f97a6", haloOpacity: 0.32, horizon: 0.42, glassTint: "#c9ced6", glassDepth: 2.2, bloom: 0.25 },
  light: { bg: "#d4d4d4", tintAI: "#c7cfe6", tintGrowth: "#cdcdcd", metal: "#ffffff", metalAI: "#eef1f8", haloN: "#e6e6e6", haloAI: "#7d9bff", haloGrowth: "#ffffff", haloOpacity: 0.45, horizon: 0.2, glassTint: "#d5d9df", glassDepth: 2.6, bloom: 0 },
};
type Palette = typeof PALETTE.dark;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const clamp = (t: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const damp = (a: number, b: number, lambda: number, dt: number) => lerp(a, b, 1 - Math.exp(-lambda * dt));

// ---------------------------------------------------------------- liquid shader
// Injected into MeshPhysicalMaterial: each vertex can melt towards a point on a
// shared, slowly churning noise blob (uMelt 0 = the object, 1 = the blob); the
// cursor presses a dent into the surface; while the opening runs the blob is
// spiky, like droplets pulling together.
const NOISE = /* glsl */ `
  vec3 lq_mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 lq_mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 lq_perm(vec4 x){ return lq_mod289(((x * 34.0) + 1.0) * x); }
  vec4 lq_tis(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
  float lq_noise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = lq_mod289(i);
    vec4 p = lq_perm(lq_perm(lq_perm(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = lq_tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
  attribute vec3 meltDir;
  uniform float uTime;
  uniform float uMelt;
  uniform float uWobble;
  uniform float uBlobR;
  uniform float uSpike;
  uniform vec3 uMouse;
  uniform float uMouseStrength;
  vec3 lq_blob(vec3 d){
    float t = uTime * 0.28;
    float n1 = lq_noise(d * 0.9 + vec3(t, t * 0.7, -t * 0.5));
    float n2 = lq_noise(d * 1.9 + vec3(-t * 0.8, t * 0.4, t * 0.9));
    float fold = sin(d.y * 4.5 + n1 * 3.5 + t) * 0.018;
    float spike = uSpike * max(0.0, lq_noise(d * 4.0 + vec3(t * 2.0))) * 0.9;
    return d * uBlobR * (1.0 + 0.24 * n1 + 0.05 * n2 + fold + spike) * vec3(1.06, 0.95, 1.0);
  }
`;

// meltDir: where on the blob this vertex goes (its length < 1 tucks it just inside, for
// surfaces that would otherwise land on top of each other, like the inside of the ring)
const VERT_NORMAL = /* glsl */ `
  vec3 lqDir = normalize(meltDir);
  float lqDepth = length(meltDir);
  vec3 lqPos = position;
  vec3 lqNrm = normal;
  if (uMelt > 0.001) {
    vec3 ta = normalize(cross(lqDir, abs(lqDir.y) < 0.98 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 tb = cross(lqDir, ta);
    vec3 b0 = lq_blob(lqDir) * lqDepth;
    vec3 b1 = lq_blob(normalize(lqDir + ta * 0.012)) * lqDepth;
    vec3 b2 = lq_blob(normalize(lqDir + tb * 0.012)) * lqDepth;
    vec3 bn = normalize(cross(b1 - b0, b2 - b0));
    if (dot(bn, lqDir) < 0.0) bn = -bn;
    lqPos = mix(position, b0, uMelt);
    lqNrm = normalize(mix(normal, bn, uMelt));
  }
  // a slow swell along the surface, so a held shape still reads as liquid
  if (uWobble > 0.001) {
    float wt = uTime * 0.35;
    lqPos += lqNrm * lq_noise(position * 1.4 + vec3(wt, -wt * 0.6, wt * 0.4)) * 0.045 * uWobble;
  }
  float lqPress = smoothstep(1.5, 0.0, length(lqPos - uMouse)) * uMouseStrength;
  lqPos -= lqNrm * lqPress * 0.2;
  vec3 objectNormal = lqNrm;
  #ifdef USE_TANGENT
    vec3 objectTangent = vec3( tangent.xyz );
  #endif
`;

function liquidMaterial(
  shared: Record<string, THREE.IUniform>,
  melt: THREE.IUniform,
  wobble: THREE.IUniform,
  color: string,
  envMapIntensity: number,
) {
  const mat = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness: 0.07,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity,
  });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, shared, { uMelt: melt, uWobble: wobble });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${NOISE}`)
      .replace("#include <beginnormal_vertex>", VERT_NORMAL)
      .replace("#include <begin_vertex>", "vec3 transformed = lqPos;");
  };
  mat.customProgramCacheKey = () => "liquid-chrome-2";
  return mat;
}

/** Clear, colourless glass: the fixed parts (whether it's glass or chrome is set by setGlass). */
function glassReady(mat: THREE.MeshPhysicalMaterial) {
  mat.thickness = 1.6;
  mat.ior = 1.55;
  mat.iridescenceIOR = 1.3;
  mat.iridescenceThicknessRange = [200, 420];
  mat.specularIntensity = 1;
  mat.clearcoatRoughness = 0.02;
}

/**
 * Glass (1) or silver chrome (0, the fallback for phones and slow frame rates). Transmission,
 * dispersion and the faint thin-film sheen switch fully off for chrome, so it costs nothing extra.
 */
function setGlass(mat: THREE.MeshPhysicalMaterial, g: number) {
  const k = g > 0.01 ? g : 0;
  mat.transmission = k;
  mat.metalness = 1 - k;
  mat.roughness = lerp(0.07, 0.02, k);
  mat.dispersion = 3.5 * k;
  mat.iridescence = 0.12 * k;
  mat.envMapIntensity = lerp(1.55, 1.2, k);
}

/** Where each vertex goes on the blob when a shape melts: straight out from its centre. */
function radialMeltDirs(g: THREE.BufferGeometry) {
  const p = g.attributes.position;
  const dirs = new Float32Array(p.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).add(new THREE.Vector3(1e-4, 2e-4, 3e-4)).normalize();
    dirs.set([v.x, v.y, v.z], i * 3);
  }
  g.setAttribute("meltDir", new THREE.BufferAttribute(dirs, 3));
}

/**
 * The background: the chapter's colour with the electric-blue horizon, mixed like the CSS
 * gradient. In the refraction pass (uInGlass = 1) it draws the studio the glass sees through
 * itself instead: bright grey with warped, thin dark bands, which refraction bends into the
 * reference's black liquid streaks.
 */
function backdrop() {
  const uniforms = {
    uBg: { value: new THREE.Vector3() },
    uHorizon: { value: new THREE.Vector3(1 / 255, 70 / 255, 249 / 255) },
    uAmt: { value: 0.42 },
    uInGlass: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }",
    // colours arrive in sRGB and blend in sRGB, as the browser does for CSS gradients
    fragmentShader: /* glsl */ `
      uniform vec3 uBg; uniform vec3 uHorizon; uniform float uAmt; uniform float uInGlass; varying vec2 vUv;
      void main(){
        float y = vUv.y;
        float a = y < 0.22 ? mix(1.0, 0.35, y / 0.22) : mix(0.35, 0.0, clamp((y - 0.22) / 0.33, 0.0, 1.0));
        vec3 c = mix(uBg, uHorizon, a * uAmt);
        if (uInGlass > 0.5) {
          vec2 q = vUv;
          q.x += 0.05 * sin(q.y * 7.0 + q.x * 3.0) + 0.025 * sin(q.y * 17.0 - q.x * 5.0);
          float w = 0.5 + 0.5 * sin(q.x * 6.2831 * 9.0);
          float w2 = 0.5 + 0.5 * sin((q.x * 0.6 + q.y * 0.8) * 6.2831 * 5.0);
          float k = smoothstep(0.12, 0.28, min(w, mix(1.0, w2, 0.6)));
          c = vec3(mix(0.05, 0.95, k) * mix(0.82, 1.05, y));
        }
        gl_FragColor = sRGBTransferEOTF(vec4(c, 1.0));
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

/**
 * A black-and-white studio for the glass and chrome to reflect: a grey dome, white strip
 * lights, soft white cards and black flags (the dark bands in the reflections). No colour.
 */
function studioEnv(renderer: THREE.WebGLRenderer, light: boolean) {
  const s = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(40, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { light: { value: light ? 1 : 0 } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform float light; varying vec3 vP; void main(){
        float h = vP.y;
        vec3 floorC = mix(vec3(0.015), vec3(0.32), light);
        vec3 horizon = mix(vec3(0.12), vec3(0.95), light);
        vec3 top = mix(vec3(0.25), vec3(0.7), light);
        vec3 c = h > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.6, h)) : mix(horizon, floorC, smoothstep(0.0, -0.35, h));
        gl_FragColor = vec4(c, 1.0); }`,
    }),
  );
  s.add(dome);
  const panel = (w: number, h: number, k: number, pos: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    s.add(m);
  };
  panel(30, 2.4, 9, [0, 14, 6]); // overhead strip
  panel(2.4, 20, 7, [-14, 2, 8]); // side strips
  panel(1.6, 16, 7, [13, -1, 9]);
  panel(18, 12, 1.6, [-9, 5, -15]); // soft cards behind
  panel(10, 16, 1.1, [11, -3, -13]);
  // a soft fill behind the camera and a broad sky overhead (up-facing faces: wings, stair treads)
  panel(16, 7, light ? 1.6 : 0.7, [0, 3, 18]);
  panel(40, 16, light ? 1.3 : 0.45, [0, 20, -2]);
  // black flags
  panel(5, 26, 0, [-7, 0, -11]);
  panel(4, 26, 0, [6, 0, -14]);
  panel(26, 3, 0, [0, -9, 10]);
  panel(4, 30, 0, [-7, 0, 15]);
  panel(3, 30, 0, [6, 0, 16]);
  panel(30, 2.5, 0, [0, 8, 14]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(s, 0.02).texture;
  pmrem.dispose();
  s.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    (m.material as THREE.Material | undefined)?.dispose?.();
  });
  return tex;
}

function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** ₹ drawn to sit with Syne's figures (Syne has no rupee sign). x0 = left edge, h = figure height, t = stroke. */
function rupeeShapes(x0: number, h: number, t: number) {
  const w = h * 0.62;
  const rect = (x: number, y: number, rw: number, rh: number) => {
    const s = new THREE.Shape();
    s.moveTo(x, y);
    s.lineTo(x + rw, y);
    s.lineTo(x + rw, y + rh);
    s.lineTo(x, y + rh);
    s.closePath();
    return s;
  };
  const cx = x0 + w * 0.3;
  const cy = h * 0.72;
  const R = h * 0.28;
  const bowl = new THREE.Shape();
  bowl.absarc(cx, cy, R, -Math.PI / 2, Math.PI / 2, false);
  bowl.lineTo(cx, cy + R - t);
  bowl.absarc(cx, cy, R - t, Math.PI / 2, -Math.PI / 2, true);
  bowl.closePath();
  const legTop = h * 0.44;
  const tw = t * 1.2;
  const leg = new THREE.Shape();
  leg.moveTo(x0 + w * 0.02, legTop);
  leg.lineTo(x0 + w * 0.02 + tw, legTop);
  leg.lineTo(x0 + w * 0.98, 0);
  leg.lineTo(x0 + w * 0.98 - tw * 1.1, 0);
  leg.closePath();
  return {
    width: w,
    shapes: [rect(x0, h - t, w, t), rect(x0, h * 0.72 - t / 2, w, t), bowl, rect(x0, legTop, cx - x0, t), leg],
  };
}

function deviceTier() {
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const wide = window.innerWidth >= 900;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (fine && wide && cores >= 6 && memory >= 6) return { level: 3, dpr: 1.75, bubbles: 16 };
  if (fine && wide) return { level: 2, dpr: 1.5, bubbles: 14 };
  if (cores >= 6 && memory >= 4) return { level: 1, dpr: 1.5, bubbles: 10 };
  return { level: 0, dpr: 1.25, bubbles: 8 };
}

type Obj = { mesh: THREE.Mesh; melt: THREE.IUniform; wobble: THREE.IUniform; mat: THREE.MeshPhysicalMaterial; hero: boolean };

/**
 * Glass, bloom and pixel density cost the most. Starting from what the device tier allows,
 * the scene steps down one at a time while frames run slow: bloom, then resolution, then glass.
 */
type Quality = { glass: boolean; bloom: boolean; dpr: number };

export default function ChromeScene() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let narrow = window.innerWidth < 768;
    const tier = deviceTier();
    const forceHQ = new URLSearchParams(window.location.search).has("hq");
    film.reduced = reduce;
    film.tier = tier.level;
    let disposed = false;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      document.documentElement.dataset.scene = "off";
      window.dispatchEvent(new Event("scene:ready"));
      return;
    }
    // glass from the stronger phones up, bloom on desktops only (the governor still steps down)
    const quality: Quality = {
      glass: forceHQ || tier.level >= 1,
      bloom: forceHQ || tier.level >= 2,
      dpr: Math.min(window.devicePixelRatio, tier.dpr),
    };
    film.quality = quality.bloom ? 3 : quality.glass ? 1 : 0;
    renderer.setPixelRatio(quality.dpr);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // what the glass sees through itself is blurred anyway: half resolution is plenty
    renderer.transmissionResolutionScale = 0.5;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
    // the scene draws the horizon itself now (so the glass refracts it): the CSS copy steps aside
    document.documentElement.dataset.scene = "on";

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 140);
    camera.position.set(0, 0.3, 7.5);

    const sky = backdrop();
    scene.add(sky.mesh);
    // any render target other than the screen (or the bloom buffer) is three's refraction pass
    let screenTarget: THREE.WebGLRenderTarget | null = null;
    sky.mesh.onBeforeRender = (r) => {
      const t = r.getRenderTarget();
      sky.uniforms.uInGlass.value = t !== null && t !== screenTarget ? 1 : 0;
    };

    // a soft pool of coloured light behind the subject: the chapter's colour grade
    const haloTex = haloTexture();
    // depth-tested, so it glows around the object rather than over the glass
    const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false });
    const halo = new THREE.Sprite(haloMat);
    halo.scale.setScalar(16);
    halo.renderOrder = -1;
    scene.add(halo);

    const pivot = new THREE.Group();
    scene.add(pivot);

    // ---- shared liquid uniforms
    const shared = {
      uTime: { value: 0 },
      uBlobR: { value: BLOB_R },
      uSpike: { value: reduce ? 0 : 1 },
      uMouse: { value: new THREE.Vector3(99, 99, 99) },
      uMouseStrength: { value: 0 },
    };
    const objects = new Map<string, Obj>();
    const allMats = new Set<THREE.MeshPhysicalMaterial>();
    let pal: Palette = PALETTE.dark;
    const addObject = (key: string, geo: THREE.BufferGeometry, isHero = false) => {
      if (!geo.attributes.meltDir) radialMeltDirs(geo);
      const melt = { value: 0 };
      const wobble = { value: 0 };
      const mat = liquidMaterial(shared, melt, wobble, pal.metal, 1.55);
      glassReady(mat);
      setGlass(mat, quality.glass ? 1 : 0);
      allMats.add(mat);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      pivot.add(mesh);
      const obj = { mesh, melt, wobble, mat, hero: isHero };
      objects.set(key, obj);
      return obj;
    };

    // stands in, fully melted, for anything still loading (the orb comes with the shapes file)
    let blobGeo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(BLOB_R, 48);
    blobGeo.deleteAttribute("uv");
    blobGeo.deleteAttribute("normal");
    blobGeo = mergeVertices(blobGeo);
    blobGeo.computeVertexNormals();
    const standIn = addObject("__blob", blobGeo);

    // the liquid sheet inside the orb: a mirror-finish surface the glass refracts (shown with glass only)
    let inner: THREE.Mesh | null = null;

    // bubbles: small glass spheres orbiting the object
    const bubbleMat = new THREE.MeshPhysicalMaterial({ color: pal.metal, metalness: 1, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.3 });
    glassReady(bubbleMat);
    setGlass(bubbleMat, quality.glass ? 1 : 0);
    allMats.add(bubbleMat);
    const applyGlass = (g: number) => allMats.forEach((m) => setGlass(m, g));
    const bubbleGeo = new THREE.SphereGeometry(1, 32, 16);
    const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, tier.bubbles);
    bubbles.frustumCulled = false;
    scene.add(bubbles); // follows the pivot's position, but not its scale (they fly in during the opening)
    const xAxis = new THREE.Vector3(1, 0, 0);
    const bubbleData = Array.from({ length: tier.bubbles }, (_, i) => {
      const rnd = (k: number) => {
        const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
        return x - Math.floor(x);
      };
      return {
        r: 0.04 + Math.pow(rnd(1), 2.2) * 0.24,
        orbit: 2.25 + rnd(2) * 0.95,
        speed: (0.08 + rnd(3) * 0.16) * (rnd(4) > 0.5 ? 1 : -1),
        phase: rnd(5) * Math.PI * 2,
        tilt: (rnd(6) - 0.5) * 1.6,
        bob: rnd(7) * Math.PI * 2,
        far: new THREE.Vector3((rnd(8) - 0.5) * 30, (rnd(9) - 0.5) * 18, 4 + rnd(10) * 6),
      };
    });
    const bm = new THREE.Matrix4();
    const bq = new THREE.Quaternion();
    const bs = new THREE.Vector3();
    const bp = new THREE.Vector3();

    // ---- environment + theme
    let envTex: THREE.Texture | null = null;
    const col = {
      bg: new THREE.Color(),
      tintAI: new THREE.Color(),
      tintGrowth: new THREE.Color(),
      metal: new THREE.Color(),
      metalAI: new THREE.Color(),
      haloN: new THREE.Color(),
      haloAI: new THREE.Color(),
      haloGrowth: new THREE.Color(),
    };
    const applyTheme = () => {
      const light = document.documentElement.dataset.theme === "light";
      pal = light ? PALETTE.light : PALETTE.dark;
      (Object.keys(col) as (keyof typeof col)[]).forEach((k) => col[k].set(pal[k]));
      renderer.setClearColor(col.bg, 1);
      envTex?.dispose();
      envTex = studioEnv(renderer, light);
      scene.environment = envTex;
      allMats.forEach((m) => {
        m.attenuationColor.set(pal.glassTint);
        m.attenuationDistance = pal.glassDepth;
      });
      sky.uniforms.uAmt.value = pal.horizon;
      haloMat.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      haloMat.needsUpdate = true;
    };
    applyTheme();
    window.addEventListener("themechange", applyTheme);

    // ---- bloom: the frame goes into a buffer first, rendered exactly as it would be to the
    // screen (tone mapped, sRGB), so the backgrounds keep their exact page colours; the glow is
    // added on top and the result copied out. Built only for devices that start with bloom.
    type Post = { rt: THREE.WebGLRenderTarget; bloom: UnrealBloomPass; copy: FullScreenQuad };
    let post: Post | null = null;
    const bufferSize = new THREE.Vector2();
    if (quality.bloom) {
      renderer.getDrawingBufferSize(bufferSize);
      const rt = new THREE.WebGLRenderTarget(bufferSize.x, bufferSize.y, { samples: 4, colorSpace: THREE.SRGBColorSpace });
      // three applies tone mapping and sRGB output only for the screen or an XR target: borrow the
      // latter. The values arrive already encoded, so store them as plain RGBA8 (this also keeps the
      // multisample buffer and its resolve texture in the same format, which the resolve requires)
      (rt as unknown as { isXRRenderTarget: boolean }).isXRRenderTarget = true;
      rt.texture.internalFormat = "RGBA8";
      // the glow is soft: blur it at half the resolution (the pass halves again internally)
      const bloom = new UnrealBloomPass(bufferSize.clone().multiplyScalar(0.5), PALETTE.dark.bloom, 0.45, 0.9);
      const copy = new FullScreenQuad(
        new THREE.ShaderMaterial({
          uniforms: { tDiffuse: { value: rt.texture } },
          depthTest: false,
          depthWrite: false,
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
          fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }",
        }),
      );
      post = { rt, bloom, copy };
      screenTarget = rt;
    }
    const resizePost = () => {
      if (!post) return;
      renderer.getDrawingBufferSize(bufferSize);
      post.rt.setSize(bufferSize.x, bufferSize.y);
      post.bloom.setSize(bufferSize.x / 2, bufferSize.y / 2);
    };

    // ---- frame-rate governor: after the opening, average 90 frames at a time; under ~32 fps,
    // give up the next most expensive thing (never steps back up, so it can't oscillate)
    const perf = { wait: 2.5, t: 0, n: 0 };
    const stepDown = () => {
      if (quality.bloom) quality.bloom = false;
      else if (quality.dpr > 1) {
        quality.dpr = 1;
        renderer.setPixelRatio(1);
        resizePost();
      } else if (quality.glass) {
        quality.glass = false;
        applyGlass(0);
      }
      film.quality = Math.max(0, film.quality - 1);
    };
    // (frames between sections don't count: a brief heavy hand-over shouldn't cost the formed shapes their glass)
    let busy = false;
    const govern = (rawDt: number) => {
      if (forceHQ || !(quality.glass || quality.bloom || quality.dpr > 1) || film.intro < 1 || busy) return;
      if (perf.wait > 0) {
        perf.wait -= rawDt;
        return;
      }
      perf.t += rawDt;
      perf.n += 1;
      if (perf.n < 90) return;
      if (perf.t / perf.n > 1 / 32) {
        stepDown();
        perf.wait = 1.5;
      }
      perf.t = 0;
      perf.n = 0;
    };

    // ---- chrome 3D text (the Impact numbers), set in Syne
    let font: Font | null = null;
    const textHalfWidth = new Map<string, number>();
    const pendingText = new Set<string>();
    const buildText = (key: string) => {
      if (!font || objects.has(key)) return;
      const raw = key.slice(5);
      const size = 1;
      const hasRupee = raw.includes("₹");
      const text = raw.replace("₹", "");
      const shapes = font.generateShapes(text, size);
      // figure height, measured from the font, so the hand-drawn ₹ matches it
      const probe = font.generateShapes("4", size).flatMap((s) => s.getPoints());
      const figH = Math.max(...probe.map((p) => p.y)) - Math.min(...probe.map((p) => p.y)) || 0.7;
      if (hasRupee) {
        const r = rupeeShapes(0, figH, size * 0.085);
        const shift = r.width + size * 0.08; // the ₹ sits just left of the figures
        const offset = new THREE.Matrix4().makeTranslation(-shift, 0, 0);
        const rg = new THREE.ExtrudeGeometry(r.shapes, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 10 });
        rg.applyMatrix4(offset);
        const tg = new THREE.ExtrudeGeometry(shapes, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 10 });
        finishText(key, [rg, tg]);
      } else {
        finishText(key, [new THREE.ExtrudeGeometry(shapes, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.035, bevelSegments: 4, curveSegments: 10 })]);
      }
    };
    const finishText = (key: string, parts: THREE.ExtrudeGeometry[]) => {
      // join the parts, centre, fit to ~4.6 wide (or 1.7 tall), then tessellate so it can melt smoothly
      let geo: THREE.BufferGeometry = parts.length === 1 ? parts[0] : mergeParts(parts);
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const w = bb.max.x - bb.min.x;
      const h = bb.max.y - bb.min.y;
      const s = Math.min(4.6 / Math.max(w, 1e-3), 1.7 / Math.max(h, 1e-3));
      geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2);
      geo.scale(s, s, s);
      geo.deleteAttribute("uv");
      geo = new TessellateModifier(0.14, 7).modify(geo);
      textHalfWidth.set(key, (w * s) / 2);
      addObject(key, geo);
      pair = "";
    };
    const mergeParts = (parts: THREE.BufferGeometry[]) => {
      const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p));
      const count = flat.reduce((n, p) => n + p.attributes.position.count, 0);
      const pos = new Float32Array(count * 3);
      const nrm = new Float32Array(count * 3);
      let o = 0;
      flat.forEach((p) => {
        pos.set(p.attributes.position.array as Float32Array, o * 3);
        nrm.set(p.attributes.normal.array as Float32Array, o * 3);
        o += p.attributes.position.count;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      return g;
    };
    const ensureText = (key: string) => {
      if (objects.has(key)) return;
      if (font) buildText(key);
      else pendingText.add(key);
    };
    new TTFLoader().load(
      "/fonts/syne-400.woff",
      (json) => {
        if (disposed) return;
        font = new Font(json);
        pendingText.forEach(buildText);
        pendingText.clear();
      },
      undefined,
      () => undefined,
    );

    // compile every shader variant now, behind the opening, so nothing stutters on first use
    // (glass, and the chrome fallback the frame-rate governor may switch to)
    const prewarm = () => {
      const list = [...objects.values()];
      const was = list.map((o) => o.mesh.visible);
      list.forEach((o) => (o.mesh.visible = true));
      if (inner) inner.visible = true;
      if (quality.glass) {
        applyGlass(1);
        renderer.compile(scene, camera);
      }
      applyGlass(0);
      renderer.compile(scene, camera);
      applyGlass(quality.glass ? 1 : 0);
      list.forEach((o, i) => (o.mesh.visible = was[i]));
      if (inner) inner.visible = false;
    };

    // ---- load the chrome shapes + camera shots
    const shots = new Map<string, { in: THREE.Vector3; out: THREE.Vector3 }>();
    const manager = new THREE.LoadingManager();
    manager.onProgress = (_u, loaded, total) =>
      window.dispatchEvent(new CustomEvent("scene:progress", { detail: total ? loaded / total : 0 }));
    const draco = new DRACOLoader(manager);
    draco.setDecoderPath("/draco/");
    const loader = new GLTFLoader(manager);
    loader.setDRACOLoader(draco);
    loader.load(
      "/models/chrome-shapes.glb",
      (gltf) => {
        if (disposed) return;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((o) => {
          const shot = /^Shot(In|Out)_(.+)$/.exec(o.name);
          if (shot) {
            const entry = shots.get(shot[2]) ?? { in: FRONT_SHOT.in.clone(), out: FRONT_SHOT.out.clone() };
            o.getWorldPosition(shot[1] === "In" ? entry.in : entry.out);
            shots.set(shot[2], entry);
            return;
          }
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const g = (mesh.geometry as THREE.BufferGeometry).clone();
          g.applyMatrix4(mesh.matrixWorld);
          if (!g.attributes.normal) g.computeVertexNormals();
          if (mesh.name === "Globe_Liquid") {
            inner = new THREE.Mesh(
              g,
              new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.05, envMapIntensity: 1.4, side: THREE.DoubleSide }),
            );
            inner.visible = false;
            inner.frustumCulled = false;
            pivot.add(inner);
            return;
          }
          if (mesh.name.startsWith("Shape_")) addObject(mesh.name, g, mesh.name === HERO);
        });
        draco.dispose();
        prewarm();
        snapNext = true;
        requestAnimationFrame(() => window.dispatchEvent(new Event("scene:ready")));
        (window as unknown as { __sceneReady?: boolean }).__sceneReady = true;
      },
      undefined,
      () => window.dispatchEvent(new Event("scene:ready")),
    );

    // ---- stops: read from the DOM, re-read on route changes and layout shifts
    type Stop = { el: HTMLElement | null; shape: string; frame: Frame; start: number; end: number; chapter: string; chapterNo: string };
    let stops: Stop[] = [];
    const measure = () => {
      const vh = window.innerHeight;
      // Next keeps the previous page mounted but hidden after a navigation; skip anything not laid out
      const els = Array.from(document.querySelectorAll<HTMLElement>("[data-shape]")).filter(
        (el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height > 0,
      );
      stops = els.map((el) => {
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        const tight = el.dataset.stop === "tight";
        const start = top - vh * (tight ? 0.35 : 0.3);
        const end = Math.max(start, top + r.height - vh * (tight ? 0.65 : 0.8));
        const shape = el.dataset.shape || HERO;
        if (shape.startsWith("text:")) ensureText(shape);
        return {
          el,
          shape,
          frame: FRAMES[el.dataset.pose || "center"] ?? FRAMES.center,
          start,
          end,
          chapter: el.dataset.chapter ?? "",
          chapterNo: el.dataset.chapterNo ?? "",
        };
      });
      if (stops.length) stops[0].start = -Infinity;
      else stops = [{ el: null, shape: HERO, frame: FRAMES.center, start: -Infinity, end: Infinity, chapter: "", chapterNo: "" }];
    };
    measure();

    /** Timeline position: stop i holds over [2i, 2i+1]; [2i+1, 2i+2] is the hand-over to stop i+1. */
    const targetU = () => {
      const y = window.scrollY;
      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        if (y <= s.end) {
          const from = Number.isFinite(s.start) ? s.start : Math.min(0, s.end - 1);
          return 2 * i + clamp01((y - from) / Math.max(1, s.end - from));
        }
        const next = stops[i + 1];
        if (!next) return 2 * i + 1;
        if (y < next.start) return 2 * i + 1 + smooth(clamp01((y - s.end) / Math.max(1, next.start - s.end)));
      }
      return 0;
    };


    const frameOf = (s: Stop): Frame => {
      const f = s.frame;
      if (f === FRAMES.number) {
        const hw = textHalfWidth.get(s.shape) ?? 2.3;
        const share = narrow ? 0.84 : 0.46;
        const fit = hw / (share * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
        return narrow ? { fx: 0, fy: 0.5, dist: Math.max(f.dist, fit) } : { fx: f.fx, fy: f.fy, dist: Math.max(f.dist, fit) };
      }
      return narrow ? { fx: f.fx * 0.15, fy: f.fy + 0.1, dist: f.dist * 1.85 } : f;
    };

    const shotA = new THREE.Vector3();
    const shotB = new THREE.Vector3();
    const shotAt = (s: Stop, h: number, out: THREE.Vector3) => {
      const sh = s.shape.startsWith("text:") ? FRONT_SHOT : shots.get(s.shape) ?? FRONT_SHOT;
      shotA.copy(sh.in);
      shotB.copy(sh.out);
      const len = lerp(shotA.length(), shotB.length(), h);
      out.copy(shotA.normalize()).lerp(shotB.normalize(), h).normalize();
      return len / REF_DIST;
    };
    const gradeOf = (s: Stop) => (s.el?.dataset.grade === "ai" ? -1 : s.el?.dataset.grade === "growth" ? 1 : 0);

    // ---- route transitions: melt to liquid behind the cover, re-form on the new page
    let scatterTarget = 0;
    let scatter = 0;
    let snapNext = false;
    const onLeave = () => (scatterTarget = 1);
    const onEnter = () => {
      measure();
      snapNext = true;
      scatterTarget = 0;
    };
    window.addEventListener("route:leave", onLeave);
    window.addEventListener("route:enter", onEnter);

    // ---- the paper plane takes off when someone reaches for the email
    let flyStart = -1;
    const fly = new THREE.Vector3();
    const onLaunch = () => {
      if (!reduce && flyStart < 0) flyStart = performance.now();
    };
    window.addEventListener("plane:launch", onLaunch);

    // ---- the Impact number can be turned by dragging (Metrics sends "scene:spin"); it eases
    // back to face the reader when let go
    let dragYaw = 0;
    let dragging = false;
    const onSpin = (e: Event) => {
      const d = (e as CustomEvent<{ dx?: number; end?: boolean }>).detail ?? {};
      if (d.end) dragging = false;
      else {
        dragging = true;
        dragYaw = clamp(dragYaw + (d.dx ?? 0) * 0.012, -Math.PI, Math.PI);
      }
    };
    window.addEventListener("scene:spin", onSpin);

    // ---- a section changed what it shows in place (the Impact currency switch): melt the
    // object, re-read the sections, re-form as the new one
    let reshapeTimer = 0;
    const onReshape = () => {
      if (reduce) return measure();
      scatterTarget = 1;
      window.clearTimeout(reshapeTimer);
      reshapeTimer = window.setTimeout(() => {
        if (disposed) return;
        measure();
        scatterTarget = 0;
      }, 420);
    };
    window.addEventListener("scene:reshape", onReshape);

    // ---- pointer (presses into the liquid) and tilt (phones nudge the camera)
    const ndc = new THREE.Vector2(9, 9);
    let pointerActive = false;
    const onPointer = (e: PointerEvent) => {
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      pointerActive = true;
    };
    const onPointerLeave = () => (pointerActive = false);
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);

    const tilt = { x: 0, y: 0, rest: null as null | [number, number] };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      if (!tilt.rest) tilt.rest = [e.gamma, e.beta];
      tilt.x = clamp((e.gamma - tilt.rest[0]) / 22, -1, 1);
      tilt.y = clamp((e.beta - tilt.rest[1]) / 22, -1, 1);
      tilt.rest[0] += (e.gamma - tilt.rest[0]) * 0.01;
      tilt.rest[1] += (e.beta - tilt.rest[1]) * 0.01;
    };
    const needsPermission =
      typeof DeviceOrientationEvent !== "undefined" &&
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission === "function";
    const useTilt = !fine && !reduce && typeof DeviceOrientationEvent !== "undefined" && !needsPermission;
    if (useTilt) window.addEventListener("deviceorientation", onTilt);

    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane();
    const hit = new THREE.Vector3();
    const inv = new THREE.Matrix4();

    // frames skipped while nothing 3D is on screen (see the end of frame()); any resize clears
    // the canvas, so it draws again
    let rested = 0;
    let restSig = -1;
    const onResize = () => {
      narrow = window.innerWidth < 768;
      camera.aspect = window.innerWidth / window.innerHeight;
      renderer.setSize(window.innerWidth, window.innerHeight);
      resizePost();
      measure();
      rested = 0;
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(measure);
    ro.observe(document.body);

    // ---- loop
    const clock = new THREE.Clock();
    let u = 0;
    let pair = "";
    let idle = 0;
    let liquidTime = 0;
    let lastY = window.scrollY;
    let vel = 0;
    let spin = 0;
    const cur = { dir: new THREE.Vector3(0, 0.03, 1).normalize(), dist: 7.6, fx: 0, fy: -0.04, roll: 0, grade: 0 };
    const tgtDir = new THREE.Vector3();
    const dirB = new THREE.Vector3();
    const look = new THREE.Vector3();
    const par = { x: 0, y: 0 };
    const bg = new THREE.Color();
    const srgb = { r: 0, g: 0, b: 0 };
    const haloCol = new THREE.Color();
    const metal = new THREE.Color();

    const frame = () => {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      govern(rawDt);
      if (!reduce) idle += dt;

      // scroll speed (viewport heights per second), ignoring instant jumps; it stirs the liquid
      const y = window.scrollY;
      let raw = (y - lastY) / Math.max(dt, 1e-3) / window.innerHeight;
      lastY = y;
      if (snapNext || Math.abs(raw) > 40) raw = 0;
      vel = damp(vel, raw, 6, dt);
      film.velocity = vel;
      if (!reduce) liquidTime += dt * (1 + Math.min(Math.abs(vel), 3) * 0.9);
      shared.uTime.value = liquidTime;

      // opening: droplets fly in and pull together into the blob
      const intro = reduce ? 1 : film.intro;
      shared.uSpike.value = reduce ? 0 : 1 - smooth(clamp01(intro * 1.15));
      scatter = reduce ? scatterTarget : damp(scatter, scatterTarget, scatterTarget ? 6 : 3, dt);

      // where we are on the timeline
      const snap = snapNext || reduce;
      const tu = targetU();
      u = snap ? tu : damp(u, tu, 2.6, dt);
      const a = Math.min(stops.length - 1, Math.floor(u / 2));
      const seg = u - 2 * a;
      const changing = seg > 1 && a + 1 < stops.length;
      const mix = changing ? seg - 1 : 0;
      const hold = changing ? 1 : clamp01(seg);
      const sa = stops[a];
      const sb = stops[Math.min(a + 1, stops.length - 1)];

      // which object shows, and how melted it is: A melts into the blob, then the blob re-forms as B
      // (in the opening, the droplets pull together into the blob and the blob forms the orb)
      let shape: string;
      let melt: number;
      if (changing && mix >= 0.5) {
        shape = sb.shape;
        melt = 1 - smooth((mix - 0.5) / 0.5);
      } else {
        shape = sa.shape;
        melt = changing ? smooth(mix / 0.5) : 0;
      }
      let show = objects.get(shape);
      // data-shape="none": the section has its own visual; the blob shrinks away into it and
      // grows back out of it on the way to the next shape
      let vanish = 0;
      if (shape === "none") {
        vanish = !changing ? 1 : mix >= 0.5 ? smooth((mix - 0.5) / 0.5) : 1 - smooth(mix / 0.5);
      }
      if (!show) {
        show = standIn; // still loading (or "none"): the liquid blob stands in
        melt = 1;
      }
      const introMelt = reduce ? 0 : 1 - smooth(clamp01((intro - 0.3) / 0.6));
      melt = Math.max(melt, scatter, show.hero ? introMelt : 0);
      const key = `${show.mesh.id}`;
      if (key !== pair) {
        objects.forEach((o) => (o.mesh.visible = false));
        pair = key;
      }
      show.mesh.visible = true;
      show.melt.value = melt;
      show.wobble.value = show.hero && !reduce ? 1 - melt : 0;
      // the shared liquid is silver chrome: glass gives way as a shape melts and returns as it forms
      // (also keeps the half-melted blob, which fills much of the screen, cheap to draw)
      setGlass(show.mat, quality.glass ? 1 - smooth(clamp01((melt - 0.35) / 0.5)) : 0);
      busy = changing || scatter > 0.01;
      // the liquid inside the orb shrinks away as the orb melts
      if (inner) {
        inner.visible = show.hero && quality.glass && melt < 0.98;
        inner.scale.setScalar(Math.max(0.001, 1 - melt));
      }


      // camera: drift through this shape's shot, or arc to the next one
      let tDist: number, tFx: number, tFy: number, tRoll: number, tGrade: number;
      if (changing) {
        const t = smooth(mix);
        const ma = shotAt(sa, 1, tgtDir);
        const mb = shotAt(sb, 0, dirB);
        tgtDir.lerp(dirB, t).normalize();
        const fa = frameOf(sa);
        const fb = frameOf(sb);
        tFx = lerp(fa.fx, fb.fx, t);
        tFy = lerp(fa.fy, fb.fy, t);
        tDist = lerp(fa.dist * ma, fb.dist * mb, t) * (1 - (reduce ? 0 : DIP) * Math.sin(Math.PI * t));
        tRoll = reduce ? 0 : Math.sin(Math.PI * t) * 0.05 * (a % 2 ? 1 : -1);
        tGrade = lerp(gradeOf(sa), gradeOf(sb), t);
      } else {
        const m = shotAt(sa, reduce ? 0.5 : hold, tgtDir);
        const f = frameOf(sa);
        tFx = f.fx;
        tFy = f.fy;
        tDist = f.dist * m;
        tRoll = 0;
        tGrade = gradeOf(sa);
      }
      const L = snap ? 1000 : 4;
      cur.dir.lerp(tgtDir, 1 - Math.exp(-L * dt)).normalize();
      cur.dist = damp(cur.dist, tDist, L, dt);
      cur.fx = damp(cur.fx, tFx, L, dt);
      cur.fy = damp(cur.fy, tFy, L, dt);
      cur.roll = damp(cur.roll, tRoll, L, dt);
      cur.grade = damp(cur.grade, tGrade, snap ? 1000 : 2, dt);
      snapNext = false;

      const px = fine && pointerActive ? ndc.x : useTilt ? tilt.x : 0;
      const py = fine && pointerActive ? ndc.y : useTilt ? -tilt.y : 0;
      par.x = damp(par.x, reduce ? 0 : px, 3, dt);
      par.y = damp(par.y, reduce ? 0 : py, 3, dt);

      camera.position.copy(cur.dir).multiplyScalar(cur.dist);
      camera.up.set(0, 1, 0);
      look.set(0, 0, 0);
      camera.lookAt(look);
      camera.translateX(par.x * cur.dist * (useTilt ? 0.07 : 0.04));
      camera.translateY(par.y * cur.dist * (useTilt ? 0.05 : 0.03));
      camera.lookAt(look);
      camera.rotateZ(cur.roll);
      const W = window.innerWidth;
      const H = window.innerHeight;
      camera.setViewOffset(W, H, (-cur.fx * W) / 2, (cur.fy * H) / 2, W, H);

      // the sculpture sways (the ring a little more, never far enough to turn edge-on);
      // the plane can take off
      const isHero = show.hero;
      spin = damp(spin, Math.round(spin / (Math.PI * 2)) * Math.PI * 2, 3, dt);
      let nose = 0;
      fly.set(0, 0, 0);
      if (flyStart >= 0) {
        const t = (performance.now() - flyStart) / 1000;
        if (t < 1.1) {
          const k = Math.pow(t / 1.1, 2.2);
          fly.set(k * 16, k * 7, -k * 5);
          nose = k * 0.6;
        } else if (t < 1.6) {
          fly.set(-20, -5, -3);
        } else if (t < 3) {
          const k = 1 - Math.pow(1 - (t - 1.6) / 1.4, 3);
          fly.set(lerp(-20, 0, k), lerp(-5, 0, k), lerp(-3, 0, k));
        } else {
          flyStart = -1;
        }
      }
      const textShape = (changing && mix >= 0.5 ? sb : sa).shape.startsWith("text:");
      pivot.position.copy(fly);
      const sway = textShape ? 0.05 : isHero ? 0.38 : 0.14;
      if (!dragging) dragYaw = damp(dragYaw, 0, 2.4, dt);
      pivot.rotation.set(reduce || !isHero ? 0 : Math.sin(idle * 0.19) * 0.08, spin + dragYaw + (reduce ? 0 : Math.sin(idle * 0.25) * sway), nose);
      const grow = reduce ? 1 : smooth(clamp01((intro - 0.05) / 0.75));
      pivot.scale.setScalar(Math.max(0.001, grow * (1 - scatter * 0.35) * (1 - vanish)));
      pivot.visible = vanish < 0.999;

      // bubbles orbit the object; in the opening they fly in from all around
      const bubbleAmt = (isHero ? 1 : 0.65) * (1 - scatter) * (1 - vanish);
      bubbles.visible = vanish < 0.999;
      bubbles.position.copy(pivot.position);
      bubbleData.forEach((b, i) => {
        const ang = b.phase + (reduce ? 0 : idle * b.speed);
        bp.set(Math.cos(ang) * b.orbit, Math.sin(ang * 0.7 + b.bob) * 0.6 + b.tilt * 0.4, Math.sin(ang) * b.orbit);
        bp.applyAxisAngle(xAxis, b.tilt * 0.4);
        if (intro < 1) bp.lerp(b.far, 1 - smooth(clamp01(intro * 1.3)));
        bs.setScalar(Math.max(1e-4, b.r * bubbleAmt));
        bm.compose(bp, bq, bs);
        bubbles.setMatrixAt(i, bm);
      });
      bubbles.instanceMatrix.needsUpdate = true;

      // colour grade: background, the light behind the subject, and a hint of blue in the metal
      const g = Math.abs(cur.grade);
      bg.copy(col.bg).lerp(cur.grade < 0 ? col.tintAI : col.tintGrowth, g * 0.85);
      renderer.setClearColor(bg, 1);
      bg.getRGB(srgb, THREE.SRGBColorSpace);
      sky.uniforms.uBg.value.set(srgb.r, srgb.g, srgb.b);
      metal.copy(col.metal).lerp(col.metalAI, cur.grade < 0 ? g * 0.6 : 0);
      allMats.forEach((m) => m.color.copy(metal));
      haloCol.copy(col.haloN).lerp(cur.grade < 0 ? col.haloAI : col.haloGrowth, g);
      haloMat.color.copy(haloCol);
      haloMat.opacity = pal.haloOpacity * (0.55 + 0.45 * g) * (reduce ? 1 : intro);
      halo.position.copy(cur.dir).multiplyScalar(-3.8);

      // the cursor presses into the liquid
      if (pointerActive && fine && !reduce) {
        raycaster.setFromCamera(ndc, camera);
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(hit).negate(), pivot.position);
        if (raycaster.ray.intersectPlane(plane, hit)) {
          pivot.updateMatrixWorld();
          inv.copy(pivot.matrixWorld).invert();
          shared.uMouse.value.copy(hit.applyMatrix4(inv));
        }
        shared.uMouseStrength.value = damp(shared.uMouseStrength.value, 1, 6, dt);
      } else {
        shared.uMouseStrength.value = damp(shared.uMouseStrength.value, 0, 4, dt);
      }

      film.mix = mix;
      film.morph = changing ? Math.sin(Math.PI * mix) : 0;
      film.chapter = changing ? sb.chapter : "";
      film.chapterNo = changing ? sb.chapterNo : "";
      film.grade = cur.grade;
      film.formed = changing ? "" : sa.shape;

      // nothing 3D on screen (data-shape="none": Projects, Contact, the project pages): once the
      // object has shrunk away and the colour has settled, the picture can't change, so stop
      // drawing and leave the GPU to the films and the cloth
      const sig = bg.getHex();
      const settled = vanish >= 0.999 && !changing && scatter < 0.002 && Math.abs(cur.grade - tGrade) < 0.004 && sig === restSig;
      restSig = sig;
      rested = settled ? rested + 1 : 0;
      if (rested > 4) return;

      const glow = post && quality.bloom ? pal.bloom : 0;
      if (post && glow > 0) {
        post.bloom.strength = glow;
        renderer.setRenderTarget(post.rt);
        renderer.render(scene, camera);
        post.bloom.render(renderer, post.rt, post.rt, dt, false);
        renderer.setRenderTarget(null);
        post.copy.render(renderer);
      } else {
        renderer.render(scene, camera);
      }
    };
    renderer.setAnimationLoop(frame);

    const onVisibility = () => {
      const on = document.visibilityState !== "hidden";
      if (on) clock.getDelta();
      renderer.setAnimationLoop(on ? frame : null);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener("themechange", applyTheme);
      window.removeEventListener("route:leave", onLeave);
      window.removeEventListener("route:enter", onEnter);
      window.removeEventListener("plane:launch", onLaunch);
      window.removeEventListener("scene:spin", onSpin);
      window.removeEventListener("scene:reshape", onReshape);
      window.clearTimeout(reshapeTimer);
      window.removeEventListener("pointermove", onPointer);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("deviceorientation", onTilt);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      objects.forEach((o) => {
        o.mesh.geometry.dispose();
        o.mat.dispose();
      });
      bubbleGeo.dispose();
      bubbleMat.dispose();
      if (inner) {
        inner.geometry.dispose();
        (inner.material as THREE.Material).dispose();
      }
      envTex?.dispose();
      sky.mesh.geometry.dispose();
      (sky.mesh.material as THREE.Material).dispose();
      if (post) {
        post.rt.dispose();
        post.bloom.dispose();
        post.copy.material.dispose();
        post.copy.dispose();
      }
      haloTex.dispose();
      haloMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete document.documentElement.dataset.scene;
    };
  }, []);

  return <div ref={hostRef} className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true" />;
}
