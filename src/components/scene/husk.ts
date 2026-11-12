import * as THREE from "three";

/*
 * Ember Husk (Originkit), rebuilt as a piece of the site's 3D scene: the hero object.
 *
 * A ball of charred rock broken into slabs (convex Voronoi cells of a faceted ball, so the seams
 * close exactly), molten light in the cracks, a swarm of white crosses, pebbles and chrome beads.
 * In the site's colours the melt is electric blue and the fire below is the page's blue horizon.
 *
 * What changed from the standalone component: it draws through the scene's renderer and camera
 * (tone mapped by three, bloom from the scene's own pass); the cursor comes from the scene; and
 * `open` (0 closed … 1 gone) bursts it apart so the scene's liquid blob can take over, which is
 * how the hero hands over to the next section, forms in the opening and leaves on a route change.
 * The cursor push and its springs are the original's.
 */

/* ------------------------------------------------------------------ settings (Ember Husk's defaults) */

const R = 1;
const HULL_PLANES = 26;
const SHARDS = 11;
const IRREGULARITY = 6;
const THICKNESS = 5;
const SEAM = 4;
const WEATHERING = 0.5;
const INTENSITY = 0.6;
const FLOW = 5;
const PHYS_STEP = 1 / 120;
const MAX_SUBSTEPS = 5;
const DAMPING = 0.88;

const RESPONSE = { reach: 5, strength: 5, repel: 6, settle: 5 };
const DRIFT = { spin: 3, bob: 4, sway: 4 };

export const COLORS = {
  dark: { rock: "#141518", lava: "#1f5cff", hot: "#cfe0ff", ground: "#0146f9", cross: "#edeff5" },
  light: { rock: "#1a1b1f", lava: "#1f5cff", hot: "#cfe0ff", ground: "#5a7dff", cross: "#f4f5f8" },
};

export const KEY_DIR = new THREE.Vector3(2, 8, 4).normalize();
export const FILL_DIR = new THREE.Vector3(0.72, -0.12, -0.62).normalize();
export const BOUNCE_DIR = new THREE.Vector3(0, -4, 1).normalize();

/* ------------------------------------------------------------------ maths */

function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomQuat(rng: () => number) {
  const u = rng();
  const v = rng() * Math.PI * 2;
  const w = rng() * Math.PI * 2;
  const a = Math.sqrt(1 - u);
  const b = Math.sqrt(u);
  return new THREE.Quaternion(a * Math.sin(v), a * Math.cos(v), b * Math.sin(w), b * Math.cos(w));
}

function randomDir(rng: () => number) {
  const z = rng() * 2 - 1;
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, z);
}

function fibonacciDirs(n: number) {
  const out: THREE.Vector3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / Math.max(1, n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i;
    out.push(new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r));
  }
  return out;
}

/* ------------------------------------------------------------------ the slabs: convex clipping */

type Face = { n: THREE.Vector3; pts: THREE.Vector3[] };
const CLIP_EPS = 1e-7;

function boxFaces(h: number): Face[] {
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  return [
    { n: v(1, 0, 0), pts: [v(h, -h, -h), v(h, h, -h), v(h, h, h), v(h, -h, h)] },
    { n: v(-1, 0, 0), pts: [v(-h, -h, h), v(-h, h, h), v(-h, h, -h), v(-h, -h, -h)] },
    { n: v(0, 1, 0), pts: [v(-h, h, -h), v(-h, h, h), v(h, h, h), v(h, h, -h)] },
    { n: v(0, -1, 0), pts: [v(-h, -h, h), v(-h, -h, -h), v(h, -h, -h), v(h, -h, h)] },
    { n: v(0, 0, 1), pts: [v(-h, -h, h), v(h, -h, h), v(h, h, h), v(-h, h, h)] },
    { n: v(0, 0, -1), pts: [v(h, -h, -h), v(-h, -h, -h), v(-h, h, -h), v(h, h, -h)] },
  ];
}

/** Keep the half-space dot(p, n) <= d (Sutherland-Hodgman per face, plus a cap from the cut). */
function clipConvex(faces: Face[], n: THREE.Vector3, d: number): Face[] {
  const out: Face[] = [];
  const cut: THREE.Vector3[] = [];
  for (const f of faces) {
    const pts = f.pts;
    const kept: THREE.Vector3[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const da = a.dot(n) - d;
      const db = b.dot(n) - d;
      if (da <= CLIP_EPS) kept.push(a);
      if ((da < -CLIP_EPS && db > CLIP_EPS) || (da > CLIP_EPS && db < -CLIP_EPS)) {
        const p = a.clone().lerp(b, da / (da - db));
        kept.push(p);
        cut.push(p);
      }
    }
    if (kept.length >= 3) out.push({ n: f.n.clone(), pts: kept });
  }
  if (cut.length >= 3) {
    const c = new THREE.Vector3();
    for (const p of cut) c.add(p);
    c.multiplyScalar(1 / cut.length);
    const helper = Math.abs(n.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(n, helper).normalize();
    const w = new THREE.Vector3().crossVectors(n, u);
    const ranked = cut
      .map((p) => {
        const rel = p.clone().sub(c);
        return { p, a: Math.atan2(rel.dot(w), rel.dot(u)) };
      })
      .sort((x, y) => x.a - y.a);
    const ring: THREE.Vector3[] = [];
    for (const r of ranked) {
      const last = ring[ring.length - 1];
      if (!last || last.distanceToSquared(r.p) > 1e-12) ring.push(r.p);
    }
    if (ring.length >= 3 && ring[0].distanceToSquared(ring[ring.length - 1]) < 1e-12) ring.pop();
    if (ring.length >= 3) out.push({ n: n.clone(), pts: ring });
  }
  return out;
}

type Slab = { geometry: THREE.BufferGeometry; home: THREE.Vector3; dir: THREE.Vector3 };

/** One slab per seed; `aRest` keeps each vertex's place in the closed husk, so grain and heat stay put. */
function buildHusk(): { slabs: Slab[]; inner: number } {
  const rng = makeRng(0x9e3779b9);
  const inner = THREE.MathUtils.lerp(0.62, 0.28, THICKNESS / 10);
  const amp = 0.06 + (IRREGULARITY / 10) * 0.42;
  const hull = fibonacciDirs(HULL_PLANES).map((dir) => ({ n: dir, d: R * (1 - amp * 0.5 + rng() * amp) }));
  const spread = 0.15 + (IRREGULARITY / 10) * 0.45;
  const seeds = fibonacciDirs(SHARDS).map((dir) => {
    const jitter = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(spread);
    return dir.clone().add(jitter).normalize().multiplyScalar(R * (0.7 + rng() * 0.5));
  });

  const slabs: Slab[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const si = seeds[i];
    const axis = si.clone().normalize();
    let faces = boxFaces(R * 2.4);
    for (const h of hull) faces = clipConvex(faces, h.n, h.d);
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      const n = seeds[j].clone().sub(si);
      const len = n.length();
      if (len < 1e-6) continue;
      n.multiplyScalar(1 / len);
      faces = clipConvex(faces, n, seeds[j].clone().add(si).multiplyScalar(0.5).dot(n));
    }
    faces = clipConvex(faces, axis.clone().negate(), -inner * R);
    if (faces.length < 4) continue;

    const centroid = new THREE.Vector3();
    let count = 0;
    for (const f of faces)
      for (const p of f.pts) {
        centroid.add(p);
        count++;
      }
    if (!count) continue;
    centroid.multiplyScalar(1 / count);

    const slabValue = rng();
    const pos: number[] = [];
    const nor: number[] = [];
    const rest: number[] = [];
    const seed: number[] = [];
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const fn = new THREE.Vector3();
    for (const f of faces) {
      const pts = f.pts;
      for (let k = 1; k + 1 < pts.length; k++) {
        const a = pts[0];
        const b = pts[k];
        const c = pts[k + 1];
        ab.subVectors(b, a);
        ac.subVectors(c, a);
        fn.crossVectors(ab, ac);
        const area = fn.length();
        if (area < 1e-10) continue;
        fn.multiplyScalar(1 / area);
        const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
        const flip = fn.dot(mid.sub(centroid)) < 0;
        const tri = flip ? [a, c, b] : [a, b, c];
        if (flip) fn.negate();
        for (const v of tri) {
          pos.push(v.x - centroid.x, v.y - centroid.y, v.z - centroid.z);
          nor.push(fn.x, fn.y, fn.z);
          rest.push(v.x, v.y, v.z);
          seed.push(slabValue);
        }
      }
    }
    if (pos.length < 9) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    geometry.setAttribute("aRest", new THREE.Float32BufferAttribute(rest, 3));
    geometry.setAttribute("aSlab", new THREE.Float32BufferAttribute(seed, 1));
    slabs.push({ geometry, home: centroid.clone(), dir: centroid.clone().normalize() });
  }
  return { slabs, inner };
}

/* ------------------------------------------------------------------ the cross and the pebble */

function buildCrossGeometry(depth: number) {
  const A = 0.5;
  const W = 1 / 6;
  const T = Math.max(0.004, depth);
  const B = Math.min(0.016, T * 0.35);
  const pos: number[] = [];
  const nor: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
    const n = new THREE.Vector3().crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
    if (n.lengthSq() < 1e-12) return;
    n.normalize();
    const mid = a.clone().add(b).add(c).multiplyScalar(1 / 3);
    const flip = n.dot(mid) < 0;
    const v = flip ? [a, c, b] : [a, b, c];
    if (flip) n.negate();
    for (const p of v) {
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
    }
  };
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    tri(a, b, c);
    tri(a, c, d);
  };
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const outlineOf = (a: number, w: number): [number, number][] => [
    [w, a], [w, w], [a, w], [a, -w], [w, -w], [w, -a], [-w, -a], [-w, -w], [-a, -w], [-a, w], [-w, w], [-w, a],
  ];
  const ai = A - B;
  const wi = W - B;
  const rects: [number, number, number, number][] = [
    [-wi, wi, -ai, ai],
    [-ai, -wi, -wi, wi],
    [wi, ai, -wi, wi],
  ];
  for (const z of [T, -T]) for (const [x0, x1, y0, y1] of rects) quad(V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z));
  const outer = outlineOf(A, W);
  const inner = outlineOf(ai, wi);
  const zs = T - B;
  for (let i = 0; i < outer.length; i++) {
    const [x0, y0] = outer[i];
    const [x1, y1] = outer[(i + 1) % outer.length];
    quad(V(x0, y0, -zs), V(x1, y1, -zs), V(x1, y1, zs), V(x0, y0, zs));
    const [u0, v0] = inner[i];
    const [u1, v1] = inner[(i + 1) % inner.length];
    quad(V(x0, y0, zs), V(x1, y1, zs), V(u1, v1, T), V(u0, v0, T));
    quad(V(x1, y1, -zs), V(x0, y0, -zs), V(u0, v0, -T), V(u1, v1, -T));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function buildDebrisGeometry() {
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const rng = makeRng(0x27d4eb2f);
  const moved = new Map<string, THREE.Vector3>();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const key = `${v.x.toFixed(4)}|${v.y.toFixed(4)}|${v.z.toFixed(4)}`;
    let out = moved.get(key);
    if (!out) {
      out = v
        .clone()
        .multiplyScalar(0.58 + rng() * 0.62)
        .add(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.26));
      moved.set(key, out);
    }
    pos.setXYZ(i, out.x, out.y, out.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ shaders */

// HUSK_LOW (slow devices): three octaves instead of five, and no bump from the grain
export const NOISE_GLSL = /* glsl */ `
float hash31(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash31(i + vec3(0.0, 0.0, 0.0)), hash31(i + vec3(1.0, 0.0, 0.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 0.0)), hash31(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(hash31(i + vec3(0.0, 0.0, 1.0)), hash31(i + vec3(1.0, 0.0, 1.0)), f.x),
        mix(hash31(i + vec3(0.0, 1.0, 1.0)), hash31(i + vec3(1.0, 1.1, 1.0)), f.x), f.y),
    f.z);
}
float fbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  #ifdef HUSK_LOW
  for (int i = 0; i < 3; i++) {
  #else
  for (int i = 0; i < 5; i++) {
  #endif
    s += a * vnoise(p);
    p *= 2.03;
    a *= 0.5;
  }
  #ifdef HUSK_LOW
  s *= 1.14;
  #endif
  return s;
}
`;

// one lighting model for rock, crosses, pebbles and beads; distances are in husk radii (uUnit)
export const LIGHT_GLSL = /* glsl */ `
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform vec3 uBounceDir;
uniform vec3 uGroundColor;
uniform vec3 uLavaColor;
uniform float uLavaPower;
uniform vec3 uCenter;
uniform float uUnit;
vec3 shade(vec3 P, vec3 N, vec3 V, vec3 albedo, float spec, float gloss, float ground) {
  vec3 col = albedo * max(dot(N, uKeyDir), 0.0) * 2.05;
  col += albedo * max(dot(N, uFillDir), 0.0) * vec3(0.2, 0.235, 0.35);
  col += albedo * max(dot(N, uBounceDir), 0.0) * uGroundColor * 1.55 * ground;
  float up = N.y * 0.5 + 0.5;
  col += albedo * mix(uGroundColor * 0.42 * ground, vec3(0.078, 0.085, 0.108), up);
  vec3 toCore = uCenter - P;
  float dist = max(length(toCore), 0.0001);
  vec3 L = toCore / dist;
  float d = dist / uUnit;
  float atten = 1.0 / (1.0 + d * d * 3.2);
  col += albedo * uLavaColor * max(dot(N, L), 0.0) * atten * uLavaPower * 5.5 * ground;
  vec3 H = normalize(uKeyDir + V);
  col += vec3(1.0) * pow(max(dot(N, H), 0.0), gloss) * spec;
  return col;
}
`;

export const OUT_GLSL = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

const ROCK_VERT = /* glsl */ `
attribute vec3 aRest;
attribute float aSlab;
varying float vSlab;
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;
void main() {
  vRest = aRest;
  vSlab = aSlab;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ROCK_FRAG = /* glsl */ `
varying float vSlab;
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;
uniform vec3 uRockColor;
uniform float uWeathering;
uniform vec3 uHotColor;
uniform float uInner;
uniform float uHeat;
uniform float uTime;
${NOISE_GLSL}
${LIGHT_GLSL}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float grain = fbm(vRest * 9.0);
  float coarse = fbm(vRest * 1.9 + 11.0);
  #ifndef HUSK_LOW
  float e = 0.035;
  vec3 g = vec3(
    fbm(vRest * 9.0 + vec3(e, 0.0, 0.0)) - grain,
    fbm(vRest * 9.0 + vec3(0.0, e, 0.0)) - grain,
    fbm(vRest * 9.0 + vec3(0.0, 0.0, e)) - grain
  );
  N = normalize(N - (g - N * dot(g, N)) * 5.5);
  #endif
  float plate = smoothstep(0.44 + (0.5 - vSlab) * 0.28, 0.74, coarse + grain * 0.14);
  vec3 albedo = mix(uRockColor, uRockColor + vec3(0.34, 0.335, 0.325), plate * uWeathering);
  albedo *= (0.86 + grain * 0.38) * (0.42 + vSlab * 1.25);
  vec3 col = shade(vW, N, V, albedo, 0.035, 26.0, 1.0);
  float depth = length(vRest);
  float heat = 1.0 - smoothstep(uInner * 0.96, uInner * 1.55, depth);
  heat *= heat;
  float vein = smoothstep(0.34, 0.78, fbm(vRest * 5.0 + vec3(0.0, uTime * 0.35, 0.0)));
  col += mix(uLavaColor, uHotColor, vein * 0.8) * heat * (0.35 + vein * 0.9) * uHeat;
  float fis = vnoise(vRest * 1.6 + 3.7);
  float ridge = 1.0 - abs(fis - 0.5) * 22.0;
  float mask = smoothstep(0.44, 0.74, fbm(vRest * 0.9 + 9.1));
  float line = smoothstep(0.5, 1.0, ridge) * mask;
  float skirt = smoothstep(-1.6, 1.0, ridge) * mask;
  col += mix(uLavaColor, uHotColor, line * 0.8) * (line * 2.6 + skirt * skirt * 0.22) * uHeat * 0.35;
  gl_FragColor = vec4(col, 1.0);
  ${OUT_GLSL}
}
`;

export const DEBRIS_VERT = /* glsl */ `
attribute float aSlab;
varying float vSlab;
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;
void main() {
  vSlab = aSlab;
  vec4 lp = instanceMatrix * vec4(position, 1.0);
  vRest = lp.xyz * 2.6;
  vec4 wp = modelMatrix * lp;
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CROSS_VERT = /* glsl */ `
attribute vec3 aSeedColor;
varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;
void main() {
  vTint = aSeedColor;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CROSS_FRAG = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
varying vec3 vTint;
uniform vec3 uCrossColor;
${LIGHT_GLSL}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 albedo = uCrossColor * vTint;
  vec3 col = shade(vW, N, V, albedo, 0.13, 130.0, 0.12);
  col += albedo * vec3(0.088, 0.099, 0.128);
  float rim = pow(1.0 - max(dot(N, V), 0.0), 5.0);
  col += vec3(0.42, 0.44, 0.5) * rim * 0.35;
  gl_FragColor = vec4(col, 1.0);
  ${OUT_GLSL}
}
`;

const BEAD_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
void main() {
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const BEAD_FRAG = /* glsl */ `
varying vec3 vN;
varying vec3 vW;
uniform vec3 uKeyDir;
uniform vec3 uGroundColor;
uniform vec3 uLavaColor;
uniform float uLavaPower;
uniform vec3 uCenter;
uniform float uUnit;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 Rv = reflect(-V, N);
  vec3 env = mix(uGroundColor * 1.35, vec3(0.045, 0.05, 0.07), smoothstep(-0.35, 0.45, Rv.y));
  env += vec3(1.0) * pow(max(dot(Rv, uKeyDir), 0.0), 90.0) * 2.4;
  vec3 toCore = normalize(uCenter - vW);
  float d = max(length(uCenter - vW), 0.0001) / uUnit;
  env += uLavaColor * pow(max(dot(Rv, toCore), 0.0), 8.0) * uLavaPower * 2.2 / (1.0 + d * d);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
  env += vec3(0.5, 0.52, 0.58) * fres * 0.5;
  gl_FragColor = vec4(env, 1.0);
  ${OUT_GLSL}
}
`;

/* ------------------------------------------------------------------ pieces */

type Piece = {
  home: THREE.Vector3;
  dir: THREE.Vector3;
  axis: THREE.Vector3;
  tilt: number;
  delay: number;
  push: number;
  pushVel: number;
  ang: number;
  angVel: number;
  base: THREE.Quaternion;
  spin: THREE.Vector3;
  free: boolean;
  scale: number;
  lateral: THREE.Vector3;
  /** how far it flies when the husk bursts open, in husk radii */
  fling: number;
};

const piece = (p: Partial<Piece> & Pick<Piece, "home" | "dir" | "axis" | "tilt" | "delay">): Piece => ({
  push: 0,
  pushVel: 0,
  ang: 0,
  angVel: 0,
  base: new THREE.Quaternion(),
  spin: new THREE.Vector3(),
  free: false,
  scale: 1,
  lateral: new THREE.Vector3(),
  fling: 2,
  ...p,
});

export type HuskFrame = {
  /** seconds since load (idle motion) */
  t: number;
  dt: number;
  /** 0 = closed, 1 = burst apart and gone (the liquid blob has taken over) */
  open: number;
  /** pointer in screen NDC, or null when it isn't over the page (or for touch) */
  pointer: THREE.Vector2 | null;
  camera: THREE.Camera;
  aspect: number;
  reduce: boolean;
};

/** The husk, ready to hang in the scene. `counts` trims the swarm on small devices. */
export function createHusk(counts: { crosses: number; debris: number; beads: number }, lowDetail: boolean) {
  const group = new THREE.Group(); // positioned and scaled by the scene
  const rig = new THREE.Group(); // turns, rises and rocks; the pieces hang off it
  group.add(rig);

  const lava = new THREE.Color();
  const hot = new THREE.Color();
  const ground = new THREE.Color();
  const centre = new THREE.Vector3();
  const shared = {
    uKeyDir: { value: KEY_DIR.clone() },
    uFillDir: { value: FILL_DIR.clone() },
    uBounceDir: { value: BOUNCE_DIR.clone() },
    uGroundColor: { value: ground },
    uLavaColor: { value: lava },
    uLavaPower: { value: 0.12 + INTENSITY * 1.55 },
    uCenter: { value: centre },
    uUnit: { value: 1 },
  };
  const { slabs, inner } = buildHusk();
  const rockUniforms = {
    ...shared,
    uRockColor: { value: new THREE.Color() },
    uWeathering: { value: WEATHERING },
    uHotColor: { value: hot },
    uInner: { value: inner },
    uHeat: { value: 0.4 + INTENSITY * 5.2 },
    uTime: { value: 0 },
  };
  // two levels of rock detail, swapped by reference (no recompiling): the cheap one on slow
  // devices, and for everyone while the husk is bursting (big slabs near the camera cost the most)
  const rockMat = new THREE.ShaderMaterial({ uniforms: rockUniforms, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG });
  const rockLow = new THREE.ShaderMaterial({ uniforms: rockUniforms, vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG, defines: { HUSK_LOW: "" } });
  const debrisMat = new THREE.ShaderMaterial({ uniforms: rockUniforms, vertexShader: DEBRIS_VERT, fragmentShader: ROCK_FRAG });
  const debrisLow = new THREE.ShaderMaterial({ uniforms: rockUniforms, vertexShader: DEBRIS_VERT, fragmentShader: ROCK_FRAG, defines: { HUSK_LOW: "" } });
  const crossMat = new THREE.ShaderMaterial({
    uniforms: { ...shared, uCrossColor: { value: new THREE.Color() } },
    vertexShader: CROSS_VERT,
    fragmentShader: CROSS_FRAG,
  });
  const beadMat = new THREE.ShaderMaterial({ uniforms: { ...shared }, vertexShader: BEAD_VERT, fragmentShader: BEAD_FRAG });

  const rng = makeRng(0x1f123bb5);

  // slabs
  const slabMeshes: THREE.Mesh[] = [];
  const slabPieces: Piece[] = [];
  for (const s of slabs) {
    const mesh = new THREE.Mesh(s.geometry, rockMat);
    mesh.frustumCulled = false;
    rig.add(mesh);
    slabMeshes.push(mesh);
    slabPieces.push(
      piece({
        home: s.home.clone(),
        dir: s.dir.clone(),
        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        tilt: rng() - 0.5,
        delay: rng(),
        fling: 1.4 + rng() * 0.8,
      }),
    );
  }

  // crosses
  const crossGeo = buildCrossGeometry(0.015 + 0.5 * 0.1034);
  const crossMesh = new THREE.InstancedMesh(crossGeo, crossMat, Math.max(1, counts.crosses));
  crossMesh.count = counts.crosses;
  crossMesh.frustumCulled = false;
  const crossPieces: Piece[] = [];
  const tints = new Float32Array(Math.max(1, counts.crosses) * 3);
  const crossSpread = 0.5 + 0.5 * 1.1;
  for (let i = 0; i < counts.crosses; i++) {
    const dir = randomDir(rng);
    const radius = R * (0.45 + Math.pow(rng(), 0.62) * 1.15);
    const t = 0.82 + rng() * 0.3;
    tints.set([t, t, t * (0.99 + rng() * 0.05)], i * 3);
    crossPieces.push(
      piece({
        home: dir.clone().multiplyScalar(radius * crossSpread),
        dir,
        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        tilt: rng() - 0.5,
        delay: rng(),
        ang: rng() * Math.PI * 2,
        base: randomQuat(rng),
        spin: new THREE.Vector3((rng() - 0.5) * 0.62, (rng() - 0.5) * 0.62, (rng() - 0.5) * 0.62),
        free: true,
        scale: 0.7 + rng() * 0.6,
        fling: 2.4 + rng() * 1.6,
      }),
    );
  }
  crossGeo.setAttribute("aSeedColor", new THREE.InstancedBufferAttribute(tints, 3));
  rig.add(crossMesh);

  // pebbles
  const debrisGeo = buildDebrisGeometry();
  const debrisMesh = new THREE.InstancedMesh(debrisGeo, debrisMat, Math.max(1, counts.debris));
  debrisMesh.count = counts.debris;
  debrisMesh.frustumCulled = false;
  const debrisPieces: Piece[] = [];
  const values = new Float32Array(Math.max(1, counts.debris));
  const dust = 0.6 + 0.5 * 0.8;
  for (let i = 0; i < counts.debris; i++) {
    const dir = randomDir(rng);
    const radius = R * (1.12 + Math.pow(rng(), 0.8) * 0.95);
    values[i] = 0.4 + rng() * 0.6;
    debrisPieces.push(
      piece({
        home: dir.clone().multiplyScalar(radius * dust),
        dir,
        axis: randomDir(rng),
        tilt: rng() - 0.5,
        delay: rng(),
        base: randomQuat(rng),
        spin: new THREE.Vector3((rng() - 0.5) * 1.6, (rng() - 0.5) * 1.6, (rng() - 0.5) * 1.6),
        free: true,
        scale: 0.05 + rng() * 0.1,
        fling: 3 + rng() * 2,
      }),
    );
  }
  debrisGeo.setAttribute("aSlab", new THREE.InstancedBufferAttribute(values, 1));
  rig.add(debrisMesh);

  // chrome beads
  const beadGeo = new THREE.SphereGeometry(1, 18, 14);
  const beadMesh = new THREE.InstancedMesh(beadGeo, beadMat, Math.max(1, counts.beads));
  beadMesh.count = counts.beads;
  beadMesh.frustumCulled = false;
  const beadPieces: Piece[] = [];
  for (let i = 0; i < counts.beads; i++) {
    const dir = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
    beadPieces.push(
      piece({
        home: dir.clone().multiplyScalar(R * (0.95 + rng() * 0.65)),
        dir,
        axis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
        tilt: rng() - 0.5,
        delay: rng(),
        scale: 0.016 + rng() * 0.016,
        fling: 2.6,
      }),
    );
  }
  rig.add(beadMesh);

  const setTheme = (light: boolean) => {
    const c = light ? COLORS.light : COLORS.dark;
    rockUniforms.uRockColor.value.set(c.rock);
    lava.set(c.lava);
    hot.set(c.hot);
    ground.set(c.ground);
    crossMat.uniforms.uCrossColor.value.set(c.cross);
  };
  setTheme(false);

  let low = lowDetail;
  let drawnLow: boolean | null = null;
  const pickDetail = (l: boolean) => {
    if (l === drawnLow) return;
    drawnLow = l;
    for (const m of slabMeshes) m.material = l ? rockLow : rockMat;
    debrisMesh.material = l ? debrisLow : debrisMat;
  };
  const setDetail = (l: boolean) => {
    low = l;
  };

  /* ---- motion */
  const tmpVec = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpSpin = new THREE.Quaternion();
  const tmpEuler = new THREE.Euler();
  const tmpMat = new THREE.Matrix4();
  const tmpScale = new THREE.Vector3();
  const away = new THREE.Vector2();
  const lateralWorld = new THREE.Vector3();
  const rigInv = new THREE.Quaternion();
  const camQ = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  let hover = 0;

  const k = 14 + (RESPONSE.settle / 10) * 62;
  const c = 2 * Math.sqrt(k) * DAMPING;
  const reach = 0.12 + (RESPONSE.reach / 10) * 0.9;
  const repel = RESPONSE.repel / 10;
  const restGap = (SEAM / 10) * 0.045 + 0.002;

  const step = (list: Piece[], f: HuskFrame, dt: number, kk: number, cc: number, strength: number, rch: number) => {
    for (const p of list) {
      let near = 0;
      if (hover > 0.001 && f.pointer) {
        tmpVec.copy(p.home).applyMatrix4(rig.matrixWorld).project(f.camera);
        let dx = tmpVec.x - f.pointer.x;
        const dy = tmpVec.y - f.pointer.y;
        away.set(dx, dy);
        dx *= f.aspect > 1 ? f.aspect : 1;
        const dyc = f.aspect < 1 ? dy / Math.max(f.aspect, 0.05) : dy;
        const fall = 1 - THREE.MathUtils.clamp(Math.sqrt(dx * dx + dyc * dyc) / Math.max(rch, 0.001), 0, 1);
        near = fall * fall;
      }
      if (near > 0.0001) {
        // away from the cursor on screen, carried into the rig's own space
        lateralWorld.set(away.x, away.y, 0);
        if (lateralWorld.lengthSq() < 1e-9) lateralWorld.copy(p.dir);
        else lateralWorld.normalize().applyQuaternion(camQ).applyQuaternion(rigInv);
        p.lateral.lerp(lateralWorld, 1 - Math.exp(-dt * 11));
        const len = p.lateral.length();
        if (len > 1e-6) p.lateral.multiplyScalar(1 / len);
      }
      const targetPush = near * strength;
      const targetAng = near * strength * p.tilt * 3.4;
      p.pushVel += ((targetPush - p.push) * kk - p.pushVel * cc) * dt;
      p.push += p.pushVel * dt;
      p.angVel += ((targetAng - p.ang) * kk - p.angVel * cc) * dt;
      p.ang += p.angVel * dt;
    }
  };

  /** How far one piece is along the burst: they go one after another and land in waves. */
  const openOf = (p: Piece, open: number) => {
    const o = THREE.MathUtils.clamp((open - p.delay * 0.3) / 0.7, 0, 1);
    return o * o * (3 - 2 * o);
  };
  const shrinkOf = (o: number) => 1 - THREE.MathUtils.smoothstep(o, 0.35, 0.9);

  const update = (f: HuskFrame) => {
    const open = THREE.MathUtils.clamp(f.open, 0, 1);
    group.visible = open < 0.999;
    if (!group.visible) return;
    pickDetail(low || open > 0.02);

    // idle: the rig turns, rises and rocks
    const t = f.reduce ? 8 : f.t;
    rig.rotation.y = t * (DRIFT.spin / 10) * 0.52;
    rig.rotation.z = Math.sin(t * 0.43) * (DRIFT.sway / 10) * 0.17;
    rig.rotation.x = Math.sin(t * 0.31 + 1.1) * (DRIFT.sway / 10) * 0.17 * 0.6;
    rig.position.y = Math.sin(t * 0.6) * (DRIFT.bob / 10) * 0.11;
    group.updateMatrixWorld(true);
    rig.getWorldPosition(centre);
    rig.getWorldScale(worldScale);
    shared.uUnit.value = Math.max(1e-3, worldScale.x);
    rockUniforms.uTime.value = t * (0.12 + (FLOW / 10) * 1.3);

    // the cursor shoves the nearest pieces aside (only while it's closed)
    const wanted = f.pointer && !f.reduce && open < 0.05 ? 1 : 0;
    hover += (wanted - hover) * (1 - Math.exp(-f.dt * 9));
    if (hover < 0.002) hover = 0;
    const strength = Math.pow(RESPONSE.strength / 10, 1.35) * 1.9 * hover;
    rig.getWorldQuaternion(rigInv).invert();
    camQ.copy(f.camera.quaternion);
    let remaining = Math.min(f.dt, MAX_SUBSTEPS * PHYS_STEP);
    let guard = 0;
    while (remaining > 0 && guard < MAX_SUBSTEPS) {
      const dt = Math.min(PHYS_STEP, remaining);
      step(slabPieces, f, dt, k, c, strength, reach);
      step(crossPieces, f, dt, k, c, strength * 1.3, reach);
      step(debrisPieces, f, dt, k * 0.55, c * 0.55, strength * 2.4, reach * 1.2);
      step(beadPieces, f, dt, k * 0.7, c * 0.7, strength * 1.6, reach);
      remaining -= dt;
      guard++;
    }

    // pose: home, plus the cursor's push, plus the burst
    for (let i = 0; i < slabMeshes.length; i++) {
      const p = slabPieces[i];
      const m = slabMeshes[i];
      const o = openOf(p, open);
      m.position
        .copy(p.home)
        .addScaledVector(p.dir, p.push * (1 - repel) + restGap + Math.pow(o, 1.4) * p.fling)
        .addScaledVector(p.lateral, p.push * repel);
      m.quaternion.setFromAxisAngle(p.axis, p.ang + o * p.tilt * 7);
      m.scale.setScalar(Math.max(1e-3, shrinkOf(o)));
    }
    const poseInstances = (mesh: THREE.InstancedMesh, list: Piece[], baseScale: number) => {
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        const o = openOf(p, open);
        tmpVec
          .copy(p.home)
          .addScaledVector(p.dir, p.push * (1 - repel) + Math.pow(o, 1.4) * p.fling)
          .addScaledVector(p.lateral, p.push * repel);
        tmpQuat.setFromAxisAngle(p.axis, p.ang + o * p.tilt * 9);
        if (p.free) {
          tmpEuler.set(p.spin.x * t, p.spin.y * t, p.spin.z * t);
          tmpQuat.multiply(tmpSpin.setFromEuler(tmpEuler));
        }
        tmpQuat.multiply(p.base);
        tmpScale.setScalar(Math.max(1e-4, baseScale * p.scale * shrinkOf(o)));
        tmpMat.compose(tmpVec, tmpQuat, tmpScale);
        mesh.setMatrixAt(i, tmpMat);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    poseInstances(crossMesh, crossPieces, 0.5 * 0.4 + 0.08);
    poseInstances(debrisMesh, debrisPieces, 0.5 * 1.4 + 0.3);
    poseInstances(beadMesh, beadPieces, 1);
  };

  /** Compile both levels of detail now (`draw` renders the husk the way it's drawn for real). */
  const prewarm = (draw: () => void) => {
    const was = group.visible;
    group.visible = true;
    pickDetail(true);
    draw();
    pickDetail(false);
    draw();
    pickDetail(low);
    group.visible = was;
  };

  const dispose = () => {
    for (const m of slabMeshes) m.geometry.dispose();
    crossGeo.dispose();
    debrisGeo.dispose();
    beadGeo.dispose();
    crossMesh.dispose();
    debrisMesh.dispose();
    beadMesh.dispose();
    rockMat.dispose();
    rockLow.dispose();
    debrisMat.dispose();
    debrisLow.dispose();
    crossMat.dispose();
    beadMat.dispose();
  };

  // drawn on its own layer, through the original's own pipeline (createHuskPost), not the scene's
  group.traverse((o) => o.layers.set(HUSK_LAYER));

  return { group, update, setTheme, setDetail, prewarm, dispose };
}

export type Husk = ReturnType<typeof createHusk>;

/* ------------------------------------------------------------------ the original's look: its own HDR + bloom */

export const HUSK_LAYER = 1;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const PREFILTER_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uThreshold;
uniform float uKnee;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float lum = max(c.r, max(c.g, c.b));
  float soft = clamp(lum - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 0.0001);
  gl_FragColor = vec4(c * max(soft, lum - uThreshold) / max(lum, 0.0001), 1.0);
}
`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
varying vec2 vUv;
vec3 tap(float x, float y) { return texture2D(tDiffuse, vUv + vec2(x, y) * uTexel).rgb; }
void main() {
  vec3 a = tap(-2.0, 2.0), b = tap(0.0, 2.0), c = tap(2.0, 2.0);
  vec3 d = tap(-2.0, 0.0), e = tap(0.0, 0.0), f = tap(2.0, 0.0);
  vec3 g = tap(-2.0, -2.0), h = tap(0.0, -2.0), i = tap(2.0, -2.0);
  vec3 j = tap(-1.0, 1.0), k = tap(1.0, 1.0);
  vec3 l = tap(-1.0, -1.0), m = tap(1.0, -1.0);
  vec3 sum = e * 0.125;
  sum += (a + c + g + i) * 0.03125;
  sum += (b + d + f + h) * 0.0625;
  sum += (j + k + l + m) * 0.125;
  gl_FragColor = vec4(sum, 1.0);
}
`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexel;
uniform float uRadius;
varying vec2 vUv;
vec3 tap(float x, float y) { return texture2D(tDiffuse, vUv + vec2(x, y) * uTexel * uRadius).rgb; }
void main() {
  vec3 sum = tap(-1.0, 1.0) + tap(0.0, 1.0) * 2.0 + tap(1.0, 1.0);
  sum += tap(-1.0, 0.0) * 2.0 + tap(0.0, 0.0) * 4.0 + tap(1.0, 0.0) * 2.0;
  sum += tap(-1.0, -1.0) + tap(0.0, -1.0) * 2.0 + tap(1.0, -1.0);
  gl_FragColor = vec4(sum * 0.0625, 1.0);
}
`;

// the husk (linear, unclipped) plus its glow, tone mapped, laid over the scene's finished frame:
// opaque where the rock is, and the glow added on top elsewhere
// (with a backdrop function given, it can also paint the page behind, so a settled hero needs no
// separate pass for it: uBackdrop = 1)
const compositeFrag = (backdrop: string) => /* glsl */ `
uniform sampler2D tBase;
uniform sampler2D tBloom;
uniform float uStrength;
uniform float uAlphaGlow;
uniform float uBackdrop;
varying vec2 vUv;
${backdrop || "vec3 backdropColor(vec2 uv) { return vec3(0.0); }"}
void main() {
  vec4 base = texture2D(tBase, vUv);
  vec3 bloom = texture2D(tBloom, vUv).rgb * uStrength;
  gl_FragColor = vec4(base.rgb + bloom, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  if (uBackdrop > 0.5) {
    gl_FragColor = vec4(gl_FragColor.rgb + backdropColor(vUv) * (1.0 - base.a), 1.0);
    return;
  }
  float glowA = clamp(max(gl_FragColor.r, max(gl_FragColor.g, gl_FragColor.b)), 0.0, 1.0);
  gl_FragColor.a = max(base.a, glowA * uAlphaGlow);
}
`;

/**
 * Ember Husk's own rendering, as in the original component: the husk alone into a half-float
 * buffer (no clipping, no tone mapping), a soft-knee bright pass, a 13-tap downsample chain and
 * a 9-tap tent upsample, then ACES on the sum, laid over the scene. Its settings are the original's
 * defaults (Glow strength 5, radius 5, threshold 5).
 */
// (no multisampling, as in the original: on his Intel graphics it cost a third of the frame rate)
export function createHuskPost(
  renderer: THREE.WebGLRenderer,
  backdrop?: { glsl: string; uniforms: Record<string, THREE.IUniform> },
  samples = 0,
) {
  const makeRT = (w: number, h: number, depth: boolean, samples = 0) =>
    new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: depth,
      stencilBuffer: false,
      samples,
    });
  const rtScene = makeRT(1, 1, true, samples);
  let mips: { rt: THREE.WebGLRenderTarget; w: number; h: number }[] = [];
  const size = new THREE.Vector2();
  let sizeW = 0;
  let sizeH = 0;

  const quadScene = new THREE.Scene();
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(quadGeo);
  quad.frustumCulled = false;
  quadScene.add(quad);
  const passMat = (fragmentShader: string, extra: Record<string, THREE.IUniform>) =>
    new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, ...extra },
      vertexShader: QUAD_VERT,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
      toneMapped: false,
    });
  const threshold = 0.4 + 0.5 * 3.0;
  const prefilterMat = passMat(PREFILTER_FRAG, { uThreshold: { value: threshold }, uKnee: { value: Math.max(0.05, threshold * 0.4) } });
  const downMat = passMat(DOWN_FRAG, { uTexel: { value: new THREE.Vector2() } });
  const upMat = passMat(UP_FRAG, { uTexel: { value: new THREE.Vector2() }, uRadius: { value: 0.55 + 0.5 * 1.7 } });
  upMat.blending = THREE.AdditiveBlending;
  const compositeMat = new THREE.ShaderMaterial({
    uniforms: {
      ...(backdrop?.uniforms ?? {}),
      tBase: { value: null },
      tBloom: { value: null },
      uStrength: { value: 0.04 + 0.5 * 0.62 },
      uAlphaGlow: { value: 0 },
      uBackdrop: { value: 0 },
    },
    vertexShader: QUAD_VERT,
    fragmentShader: compositeFrag(backdrop?.glsl ?? ""),
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });

  const blit = (mat: THREE.Material, target: THREE.WebGLRenderTarget | null, clear: boolean) => {
    quad.material = mat;
    renderer.setRenderTarget(target);
    if (clear) renderer.clear(true, true, false);
    renderer.render(quadScene, quadCam);
  };

  const resize = () => {
    renderer.getDrawingBufferSize(size);
    const pw = Math.max(1, Math.round(size.x));
    const ph = Math.max(1, Math.round(size.y));
    if (pw === sizeW && ph === sizeH) return;
    sizeW = pw;
    sizeH = ph;
    rtScene.setSize(pw, ph);
    for (const m of mips) m.rt.dispose();
    mips = [];
    const levels = Math.max(2, Math.min(5, Math.floor(Math.log2(Math.min(pw, ph))) - 3));
    let mw = Math.max(1, pw >> 1);
    let mh = Math.max(1, ph >> 1);
    for (let i = 0; i < levels; i++) {
      mips.push({ rt: makeRT(mw, mh, false), w: mw, h: mh });
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
    }
  };

  const clear = new THREE.Color();
  /**
   * Draw the husk layer of `scene` through this pipeline, over whatever is on screen (or, with
   * `withBackdrop`, over the page's backdrop painted in the same pass: nothing else need be drawn).
   */
  const render = (scene: THREE.Scene, camera: THREE.Camera, toScreen = true, withBackdrop = false) => {
    resize();
    const autoClear = renderer.autoClear;
    const clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(clear);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0);

    const layers = camera.layers.mask;
    camera.layers.set(HUSK_LAYER);
    renderer.setRenderTarget(rtScene);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    camera.layers.mask = layers;

    prefilterMat.uniforms.tDiffuse.value = rtScene.texture;
    blit(prefilterMat, mips[0].rt, true);
    for (let i = 1; i < mips.length; i++) {
      const src = mips[i - 1];
      downMat.uniforms.tDiffuse.value = src.rt.texture;
      downMat.uniforms.uTexel.value.set(1 / src.w, 1 / src.h);
      blit(downMat, mips[i].rt, true);
    }
    for (let i = mips.length - 1; i > 0; i--) {
      const src = mips[i];
      upMat.uniforms.tDiffuse.value = src.rt.texture;
      upMat.uniforms.uTexel.value.set(1 / src.w, 1 / src.h);
      blit(upMat, mips[i - 1].rt, false);
    }
    if (toScreen) {
      const opaque = withBackdrop && !!backdrop;
      compositeMat.uniforms.tBase.value = rtScene.texture;
      compositeMat.uniforms.tBloom.value = mips[0].rt.texture;
      compositeMat.uniforms.uBackdrop.value = opaque ? 1 : 0;
      compositeMat.blending = opaque ? THREE.NoBlending : THREE.CustomBlending;
      blit(compositeMat, null, false);
    }
    renderer.setRenderTarget(null);
    renderer.setClearColor(clear, clearAlpha);
    renderer.autoClear = autoClear;
  };

  return {
    render,
    /** a transparent canvas (the poster capture): let the glow carry its own alpha */
    setAlphaGlow: (on: boolean) => (compositeMat.uniforms.uAlphaGlow.value = on ? 1 : 0),
    dispose: () => {
      rtScene.dispose();
      for (const m of mips) m.rt.dispose();
      quadGeo.dispose();
      prefilterMat.dispose();
      downMat.dispose();
      upMat.dispose();
      compositeMat.dispose();
    },
  };
}
