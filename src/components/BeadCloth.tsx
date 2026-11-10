/* eslint-disable */
// Bead Cloth Lift — Originkit (supplied by Himanshu; ported from a Framer code component)

"use client"

/**
 * CaviarShroud — a sheet of tens of thousands of shaded beads pulled up into a
 * creased peak, with a band of blue-lit beads stretching along one fold, the
 * view swinging in closer and tilting in one continuous move while a lower
 * layer of big beads rises and flashes, then easing back so the loop has no
 * cut.
 *
 * Refined from the user's BeadClothLift. The cloth, its timeline, shading and
 * every Advanced number are theirs; this pass:
 *   - contains the 1200×800 composition in any frame (no more 1200×800
 *     minimum) and adds the standard Placement group and a real Scale;
 *   - removes the hairline ring behind the cloth (its lower arc crossed the
 *     cloth in short frames), with its Ring, Ring Opacity and Ring Line
 *     controls;
 *   - makes the pointer touch the cloth itself: beads part and light under the
 *     cursor, pressing grabs the peak (drag to lean it, pull up to stretch it,
 *     let go and it springs back), and a tap sends a ripple across the beads;
 *   - paces, culls and budgets the drawing so it runs smoothly everywhere.
 *
 * Port to the portfolio (Next.js, no Framer runtime): the Framer property
 * controls and RenderTarget check are gone (it holds a still frame only for
 * reduced motion), and `rippleOn` names a window event that sends a ripple
 * from the peak (the Contact section fires it when someone reaches for the
 * email). Everything else is as supplied.
 */

import * as React from "react"
import { useEffect, useRef } from "react"

/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    highlightColor: "#0055FF",
    coreColor: "#CFE6FF",
    cycleMs: 12070,
    beadSize: 85,
    lowerSize: 150,
    gather: 55,
    creases: 100,
    drape: 100,
    peakStart: 135,
    peakEnd: 245,
    faceDepth: 35,
    faceSize: 42,
    bandRadius: 55,
    bandWidth: 7,
    glowStrength: 100,
    bloom: 300,
    bloomOpacity: 15,
    flickerMs: 400,
    sparkle: 100,
    arc: 60,
    lowerGlow: 100,
    holes: 10,
    lace: 35,
    fov: 55,
    seed: 7,
    grain: 0,
    vignette: 0,
    hover: 50,
}

// ── moved controls (builder) ──
/**
 * Controls moved in the builder: into Advanced, out of it, or into groups of
 * their own. The code reads each one where it was first written, so the props
 * are put back in that shape before anything reads them.
 */
const MOVED_CONTROLS: { into: Record<string, string>; out: Record<string, string> } = {"into":{},"out":{"hover":"advanced"}}
const GROUP_FALLBACKS: Record<string, any> = { advanced: ADVANCED_DEFAULTS }
function withMovedControls(props: any): any {
    const out = { ...props }
    for (const [k, g] of Object.entries(MOVED_CONTROLS.into)) out[k] = props?.[g]?.[k] ?? GROUP_FALLBACKS[g]?.[k]
    for (const [k, g] of Object.entries(MOVED_CONTROLS.out)) {
        if (out[k] !== undefined) out[g] = { ...(out[g] ?? {}), [k]: out[k] }
    }
    return out
}
// ── /moved controls ──

export type CaviarShroudAdvanced = typeof ADVANCED_DEFAULTS

export interface CaviarShroudPlacement {
    x: number
    y: number
    angle: number
    tilt: number
}

const DEFAULT_PLACEMENT: CaviarShroudPlacement = { x: 0, y: 0, angle: 0, tilt: 0 }

export interface CaviarShroudProps {
    background?: string
    /** How high the peak is pulled, 0–100. */
    lift?: number
    /** Bead pitch in %: spacing between beads, and their size with it. */
    scale?: number
    clothColor?: string
    glowColor?: string
    /** How big the cloth draws in its frame, in %. */
    zoom?: number
    placement?: Partial<CaviarShroudPlacement>
    /** Strength of the pointer response (touch, grab), 0 = none. Stored as advanced.hover. */
    hover?: number
    /** Strength of the ripple a tap sends across the beads, 0 = off. */
    ripple?: number
    speed?: number
    advanced?: Partial<CaviarShroudAdvanced>
    /** (portfolio) a window event that sends a ripple out from the peak. */
    rippleOn?: string
    style?: React.CSSProperties
}

const DEFAULTS = {
    background: "#000000",
    lift: 70,
    scale: 50,
    clothColor: "#000D2B",
    glowColor: "#1F5CFF",
    zoom: 100,
    ripple: 50,
    speed: 50,
}

/** The frame the composition is laid out for (the original component's size). */
const REF_W = 1200
const REF_H = 800
const REF_ASPECT = REF_W / REF_H
/** The first frame holds this long before the clip's timeline starts. */
const PREROLL_S = 1.5
/** Loop phase shown when nothing may move (reduced motion). */
const STILL_U = 0.29
/**
 * Where the cloth sits in the reference frame, in NDC: its middle, 60% of the
 * way down. Scale and Angle turn about this point, so the peak stays put.
 */
const CONTENT_Y = -0.2
/** Tilt leans the cloth about this point (mid-height of the peak), in scene units. */
const TILT_C = [0, 0.5, -0.5]
/** Bead count cap; the original's own (Bead Pitch can't go finer than this). */
const MAX_BEADS = 200000
/**
 * The beads are packed tile by tile (16 × 16 tiles over the sheet), so any run
 * of tiles is one draw. Each frame the tiles off the frame are skipped, and the
 * bloom pass only gets tiles that can glow. On ANGLE/D3D a point costs about
 * the same whether its shader draws it or culls it, so skipping it before the
 * draw is the only saving that counts.
 */
const TILES_X = 16
const TILES_Z = 16
const TILES = TILES_X * TILES_Z
/** Touch: radius of the lit, parted patch under the cursor (scene units). */
const TOUCH_R = 0.4
/** Ripples: how many can run at once, speed (units/s), life (s), band width. */
const RIPPLES = 4
const RIPPLE_SPEED = 1.1
const RIPPLE_LIFE = 2.4
const RIPPLE_W = 0.12
/** Grab: furthest the peak can be led (units), and how far it stretches. */
const GRAB_REACH = 1.2
const GRAB_LIFT_MIN = -0.6
const GRAB_LIFT_MAX = 0.9
/** Device pixels drawn at most, and the auto-resolution floor. */
const PIXEL_BUDGET = 4.2e6
const QUALITY_FLOOR = 0.6

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aQ;
layout(location=1) in vec2 aR;
uniform mat4 uVP;
uniform vec4 uPost;
uniform vec2 uPostB;
uniform mat3 uTiltM;
uniform vec3 uTiltC;
uniform vec3 uEye;
uniform float uTime;
uniform float uA;
uniform float uSig;
uniform float uGatherK;
uniform float uCreaseA;
uniform vec2 uFaceC;
uniform float uFaceR;
uniform float uFaceDepth;
uniform float uFaceSquash;
uniform float uDrape;
uniform vec2 uPull;
uniform vec2 uLean;
uniform float uLayer;
uniform float uPass;
uniform float uRise;
uniform float uRingR;
uniform float uBandW;
uniform float uBandI;
uniform float uBroken;
uniform float uArcI;
uniform float uArcR;
uniform float uFlickHz;
uniform float uFlickAmt;
uniform float uHoles;
uniform float uLace;
uniform float uBeadPx;
uniform float uBloom;
uniform float uLowerSize;
uniform float uLowerGlow;
uniform vec4 uTouch;
uniform float uTouchR;
uniform vec4 uRip0;
uniform vec4 uRip1;
uniform vec4 uRip2;
uniform vec4 uRip3;
uniform vec4 uRipA;
uniform float uRipW;
out float vShade;
out float vRim;
out float vGlow;
out float vSpec;

vec3 sheet(vec2 q) {
    vec2 d = q - uPull;
    float r2 = dot(d, d);
    float rr = sqrt(r2);
    float s2 = max(uSig * uSig, 1e-3);
    float g = exp(-r2 / s2);
    float k = uGatherK * exp(-r2 / (s2 * 4.0));
    vec2 p = uPull + d * (1.0 - k);
    float th = atan(d.y, d.x);
    float cr = sin(th * 7.0 + 1.3 * sin(th * 3.0 + uTime * 0.35) + rr * 2.2 - uTime * 0.25)
             + 0.55 * sin(th * 13.0 - rr * 3.1 + uTime * 0.5)
             + 0.3 * sin(th * 23.0 + rr * 5.0 - uTime * 0.2);
    float ca = uCreaseA * exp(-r2 / (s2 * 2.5)) * smoothstep(0.0, 0.35, rr) * (0.4 + rr);
    float h = uA * g + cr * ca;
    vec2 fd = q - uFaceC;
    fd.y *= uFaceSquash;
    h -= uFaceDepth * exp(-dot(fd, fd) / max(uFaceR * uFaceR, 1e-3));
    h += uDrape * (0.07 * sin(q.x * 1.7 + uTime * 0.31) * sin(q.y * 1.9 - uTime * 0.23)
                 + 0.03 * sin(q.x * 4.3 - q.y * 3.1 + uTime * 0.6));
    vec2 tg = vec2(-d.y, d.x) / max(rr, 1e-3);
    p += tg * cr * ca * 0.35;
    // Grab: the upper cloth leans after the hand while the hem stays put.
    p += uLean * pow(clamp(h / max(uA, 0.1), 0.0, 1.0), 1.5);
    return vec3(p.x, h, p.y);
}

vec2 lowerQ(vec2 a) { return vec2(a.x * 2.9, mix(0.8, 1.5, a.y * 0.5 + 0.5)); }

vec3 surf(vec2 q) {
    vec3 p = sheet(q);
    if (uLayer > 0.5) {
        p.y += -0.55 + uRise * 0.62 + 0.05 * sin(q.x * 4.0 + uTime * 0.7) * cos(q.y * 6.0 - uTime * 0.5);
    }
    return p;
}

float hash(vec2 r) { return fract(sin(dot(r, vec2(12.9898, 78.233))) * 43758.5453); }

// One tap ripple: a ring running out from r.xyz, its front r.w away. Lights
// the beads it passes (into g) and returns their lift along the normal.
float ripple(vec4 r, float a, vec3 P, inout float g) {
    if (a <= 0.0) return 0.0;
    float d = length(P - r.xyz) - r.w;
    float env = exp(-d * d / (uRipW * uRipW));
    g += a * env;
    return a * env * cos(d * 26.0) * 0.05;
}

void main() {
    bool lower = uLayer > 0.5;
    vec2 q = lower ? lowerQ(aQ) : aQ;
    vec3 P = surf(q);
    float ph = sin(uTime * 6.2832 * uFlickHz + aR.y * 6.2832);
    float flick = 1.0 + uFlickAmt * 0.4 * ph;

    float glow = 0.0;
    float holeT = 0.0;
    float size = uBeadPx;
    if (!lower) {
        vec2 fq = q - uFaceC;
        fq.y *= uFaceSquash;
        float ringR = max(uRingR, 1e-3);
        float band = 1.0 - smoothstep(0.3, 1.0, abs(length(fq) - ringR) / max(uBandW, 1e-3));
        band *= 1.0 + 0.8 * smoothstep(0.2, 1.0, fq.y / ringR);
        float ang = atan(fq.y, fq.x);
        float clump = 0.7 + 0.3 * sin(ang * 22.0 + aR.x * 3.0 + uTime * 0.7);
        float qa = atan(q.y, q.x);
        float arc = (1.0 - smoothstep(0.3, 1.0, abs(length(q) - uArcR) / max(uBandW, 1e-3)))
                  * smoothstep(0.2, 0.8, cos(qa - 0.45)) * uArcI;
        float alive = smoothstep(uBroken - 0.08, uBroken + 0.08, aR.y);
        glow = (band * uBandI + arc) * clump * flick * alive;
        float hn = clamp(P.y / max(uA, 0.1), 0.0, 1.0);
        holeT = uHoles + uLace * (smoothstep(2.6, 3.7, abs(q.x)) + smoothstep(0.75, 1.0, hn) * 0.6
              + (1.0 - smoothstep(-2.8, -2.0, q.y)));
        holeT += 0.6 * uLace * (1.0 - smoothstep(0.0, 0.45, length(fq) / ringR));
    } else {
        float n = sin(q.x * 3.1 + uTime * 1.1) * sin(q.y * 6.0 - uTime * 0.9)
                + 0.5 * sin(q.x * 7.3 - q.y * 4.0 - uTime * 1.7);
        glow = smoothstep(0.35, 0.95, n) * uLowerGlow * uRise * flick;
        holeT = uHoles * 0.5;
        size = uBeadPx * uLowerSize;
    }
    // Touch: the beads round the point under the cursor light up, as the
    // original's pointer glow did, but measured on the cloth rather than the
    // screen, so beads behind the fold stay dark.
    vec3 dT = P - uTouch.xyz;
    float tf = exp(-dot(dT, dT) / (uTouchR * uTouchR));
    float mb = uTouch.w * tf;
    glow = glow * (1.0 + 1.5 * mb) + mb * 0.35 * step(0.55, aR.x);
    float wg = 0.0;
    float wave = ripple(uRip0, uRipA.x, P, wg) + ripple(uRip1, uRipA.y, P, wg)
               + ripple(uRip2, uRipA.z, P, wg) + ripple(uRip3, uRipA.w, P, wg);
    glow += wg;
    vGlow = glow;

    // Cull before the two extra surface evaluations the normal needs: holes,
    // dark beads in the bloom pass, beads behind the eye or off the frame.
    float hk = hash(aR * 3.17 + 0.5);
    bool cull = hk < holeT;
    if (uPass > 0.5) cull = cull || glow < 0.02;
    vec4 c0 = uVP * vec4(uTiltC + uTiltM * (P - uTiltC), 1.0);
    vec2 s0 = vec2(uPost.x * c0.x + uPost.y * c0.y, uPost.z * c0.x + uPost.w * c0.y) + uPostB * c0.w;
    cull = cull || c0.w < 0.05 || any(greaterThan(abs(s0), vec2(1.15 * c0.w + 0.3)));
    if (cull) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        gl_PointSize = 1.0;
        vShade = 0.0;
        vRim = 0.0;
        vSpec = 0.0;
        return;
    }

    float e = 0.02;
    vec3 Px = surf(q + vec2(e, 0.0));
    vec3 Pz = surf(q + vec2(0.0, e));
    vec3 N = normalize(cross(Pz - P, Px - P));
    P += N * (uFlickAmt * 0.004) * sin(uTime * 6.2832 * uFlickHz + aR.x * 6.2832);
    // Part the beads round the touch along the cloth, and lift the ripples.
    vec3 tv = dT - N * dot(dT, N);
    float tl = length(tv);
    float tx = tl / uTouchR;
    P += tv / max(tl, 1e-4) * (uTouch.w * 0.5 * uTouchR * tx * exp(-1.5 * tx * tx));
    P += N * wave;

    // Placement: Tilt leans the cloth about its own middle; the lens then
    // applies Scale, Angle, the frame fit and the offsets on screen.
    vec3 Pw = uTiltC + uTiltM * (P - uTiltC);
    vec3 Nw = uTiltM * N;
    vec4 clip = uVP * vec4(Pw, 1.0);
    clip.xy = vec2(uPost.x * clip.x + uPost.y * clip.y, uPost.z * clip.x + uPost.w * clip.y) + uPostB * clip.w;
    vec3 L = normalize(vec3(-0.35, 0.9, 0.45));
    vec3 V = normalize(uEye - Pw);
    vShade = 0.22 + 0.78 * max(dot(Nw, L), 0.0);
    vRim = pow(1.0 - abs(dot(Nw, V)), 3.0);
    vSpec = 1.0 + uFlickAmt * 0.35 * ph;

    if (uPass > 0.5) {
        size *= uBloom;
        clip.z -= 0.002 * clip.w;
    }
    gl_Position = clip;
    gl_PointSize = clamp(size / clip.w, 1.0, 64.0);
}
`

const FRAG = `#version 300 es
precision highp float;
uniform float uPass;
uniform vec3 uCloth;
uniform vec3 uHigh;
uniform vec3 uGlowC;
uniform vec3 uCore;
uniform float uBloomA;
in float vShade;
in float vRim;
in float vGlow;
in float vSpec;
out vec4 o;
void main() {
    vec2 pc = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(pc, pc);
    if (r2 > 1.0) discard;
    float g = vGlow;
    if (uPass < 0.5) {
        vec3 sn = vec3(pc.x, -pc.y, sqrt(1.0 - r2));
        vec3 ld = normalize(vec3(-0.3, 0.6, 0.75));
        float sd = max(dot(sn, ld), 0.0);
        float sp = pow(max(dot(reflect(-ld, sn), vec3(0.0, 0.0, 1.0)), 0.0), 18.0);
        vec3 c = uCloth * vShade * (0.35 + 0.8 * sd)
               + uHigh * (sp * 0.4 * vShade * vSpec + vRim * 0.3 * sd);
        c = mix(c, uGlowC * (0.7 + 0.6 * sd), clamp(g, 0.0, 1.0) * 0.9);
        c += uCore * smoothstep(0.7, 1.5, g) * (1.0 - r2);
        o = vec4(c, 1.0);
    } else {
        float a = exp(-r2 * 3.5) * min(g, 2.0) * uBloomA;
        o = vec4(uGlowC * a, a);
    }
}
`

const UNIFORMS = [
    "uVP", "uPost", "uPostB", "uTiltM", "uTiltC", "uEye", "uTime", "uA", "uSig", "uGatherK",
    "uCreaseA", "uFaceC", "uFaceR", "uFaceDepth", "uFaceSquash", "uDrape", "uPull", "uLean",
    "uLayer", "uPass", "uRise", "uRingR", "uBandW", "uBandI", "uBroken", "uArcI", "uArcR",
    "uFlickHz", "uFlickAmt", "uHoles", "uLace", "uBeadPx", "uBloom", "uLowerSize", "uLowerGlow",
    "uTouch", "uTouchR", "uRip0", "uRip1", "uRip2", "uRip3", "uRipA", "uRipW",
    "uCloth", "uHigh", "uGlowC", "uCore", "uBloomA",
] as const
type UniformName = (typeof UNIFORMS)[number]

const GRAIN =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

function parseColor(c: unknown, fb: number[], out: Float32Array) {
    out[0] = fb[0]
    out[1] = fb[1]
    out[2] = fb[2]
    if (typeof c !== "string") return
    let s = c.trim()
    const v = s.match(/^var\([^,]+,\s*(.+)\)$/)
    if (v) s = v[1].trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4) h = h.split("").map((x) => x + x).join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return
        out[0] = ((n >> 16) & 255) / 255
        out[1] = ((n >> 8) & 255) / 255
        out[2] = (n & 255) / 255
        return
    }
    const r = s.match(/rgba?\(([^)]+)\)/)
    if (r) {
        const p = r[1].split(/[,\s/]+/).filter(Boolean).map(parseFloat)
        if (p.length >= 3) {
            out[0] = p[0] / 255
            out[1] = p[1] / 255
            out[2] = p[2] / 255
        }
    }
}

function rng(seed: number) {
    let a = seed >>> 0 || 1
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

interface MainGrid {
    data: Float32Array
    /** Per tile: first bead, bead count, and q bounds (x0, x1, z0, z1). */
    start: Int32Array
    count: Int32Array
    bounds: Float32Array
}

function buildMain(sp: number, seed: number): MainGrid {
    const rand = rng(seed)
    const rs = sp * 0.866
    const cols = Math.ceil(7.6 / sp)
    const rows = Math.ceil(4.3 / rs)
    const grid = new Float32Array(cols * rows * 4)
    let k = 0
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            grid[k++] = -3.8 + (i + (j & 1) * 0.5) * sp + (rand() - 0.5) * sp * 0.08
            grid[k++] = -2.8 + j * rs
            grid[k++] = rand()
            grid[k++] = rand()
        }
    }
    // Same beads, same random values; only the order changes (tile by tile).
    const tileOf = (i: number, j: number) =>
        Math.min(TILES_Z - 1, Math.floor((j * TILES_Z) / rows)) * TILES_X + Math.min(TILES_X - 1, Math.floor((i * TILES_X) / cols))
    const count = new Int32Array(TILES)
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) count[tileOf(i, j)]++
    const start = new Int32Array(TILES)
    for (let t = 1; t < TILES; t++) start[t] = start[t - 1] + count[t - 1]
    const fill = start.slice()
    const bounds = new Float32Array(TILES * 4)
    for (let t = 0; t < TILES; t++) {
        bounds[t * 4] = bounds[t * 4 + 2] = Infinity
        bounds[t * 4 + 1] = bounds[t * 4 + 3] = -Infinity
    }
    const data = new Float32Array(grid.length)
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            const t = tileOf(i, j)
            const s = (j * cols + i) * 4
            const d = fill[t]++ * 4
            data[d] = grid[s]
            data[d + 1] = grid[s + 1]
            data[d + 2] = grid[s + 2]
            data[d + 3] = grid[s + 3]
            const b = t * 4
            bounds[b] = Math.min(bounds[b], grid[s])
            bounds[b + 1] = Math.max(bounds[b + 1], grid[s])
            bounds[b + 2] = Math.min(bounds[b + 2], grid[s + 1])
            bounds[b + 3] = Math.max(bounds[b + 3], grid[s + 1])
        }
    }
    return { data, start, count, bounds }
}

function buildLower(sp: number, seed: number) {
    const rand = rng(seed * 31 + 5)
    const spL = sp * 1.6
    const cols = Math.ceil(5.8 / spL)
    const rows = Math.max(2, Math.ceil(0.7 / (spL * 0.866)))
    const out = new Float32Array(cols * rows * 4)
    let k = 0
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
            out[k++] = -1 + (2 * (i + (j & 1) * 0.5)) / cols
            out[k++] = -1 + (2 * j) / (rows - 1)
            out[k++] = rand()
            out[k++] = rand()
        }
    }
    return out
}

function perspective(o: Float32Array, fovy: number, aspect: number, near: number, far: number) {
    const f = 1 / Math.tan(fovy / 2)
    const nf = 1 / (near - far)
    o.fill(0)
    o[0] = f / aspect
    o[5] = f
    o[10] = (far + near) * nf
    o[11] = -1
    o[14] = 2 * far * near * nf
}

/** View matrix into `o`; the camera's right/up/back axes into `b` (rows of 3). */
function lookAt(o: Float32Array, b: Float64Array, e: Float64Array, t: Float64Array, u: Float64Array) {
    let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2]
    let l = Math.hypot(zx, zy, zz) || 1
    zx /= l; zy /= l; zz /= l
    let xx = u[1] * zz - u[2] * zy, xy = u[2] * zx - u[0] * zz, xz = u[0] * zy - u[1] * zx
    l = Math.hypot(xx, xy, xz) || 1
    xx /= l; xy /= l; xz /= l
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx
    o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0
    o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0
    o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0
    o[12] = -(xx * e[0] + xy * e[1] + xz * e[2])
    o[13] = -(yx * e[0] + yy * e[1] + yz * e[2])
    o[14] = -(zx * e[0] + zy * e[1] + zz * e[2])
    o[15] = 1
    b[0] = xx; b[1] = xy; b[2] = xz
    b[3] = yx; b[4] = yy; b[5] = yz
    b[6] = zx; b[7] = zy; b[8] = zz
}

function mul(o: Float32Array, a: Float32Array, b: Float32Array) {
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++) {
            let s = 0
            for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]
            o[c * 4 + r] = s
        }
}

const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

interface Timeline {
    L: number
    bandI: number
    bandW: number
    broken: number
    arc: number
    rise: number
    cam: number
    ring: number
    face: number
    squash: number
}

/**
 * One continuous move over the cycle (u 0..1): the cloth lifts, the view swings in
 * closer and tilts, the lower beads rise, then everything eases back. u = 0 and
 * u = 1 give the same values, so the loop joins with no cut.
 */
function timeline(o: Timeline, u: number) {
    const x = 0.5 - 0.5 * Math.cos(u * Math.PI * 2)
    const e = 1 - (1 - x) * (1 - x)
    o.L = 0.22 + 0.78 * (0.4 * x + 0.6 * e)
    o.bandI = 0.6 + 0.55 * smooth(0, 0.85, x)
    o.bandW = 0.7 + 0.5 * x
    o.broken = 0.08 * (1 - x) + 0.2 * smooth(0.8, 1, x)
    o.arc = smooth(0.04, 0.1, u) * (1 - smooth(0.25, 0.33, u)) + 0.3 * smooth(0.7, 1, x)
    o.rise = smooth(0.6, 1, x)
    o.cam = x
    o.ring = 0.35 + 0.95 * (0.3 * x + 0.7 * e)
    o.face = 0.3 + 0.4 * x
    o.squash = 1 - 0.25 * x
}

/** The cloth's shape parameters for one frame, shared by the GPU and the hit test. */
interface Sheet {
    pullX: number
    pullZ: number
    leanX: number
    leanZ: number
    A: number
    sig: number
    gK: number
    cA: number
    faceX: number
    faceZ: number
    faceR: number
    faceD: number
    squash: number
    drape: number
    t: number
}

/** The vertex shader's sheet(), on the CPU, so the pointer can find the cloth. */
function sheetAt(S: Sheet, qx: number, qz: number, o: Float64Array) {
    const dx = qx - S.pullX
    const dz = qz - S.pullZ
    const r2 = dx * dx + dz * dz
    const rr = Math.sqrt(r2)
    const s2 = Math.max(S.sig * S.sig, 1e-3)
    const g = Math.exp(-r2 / s2)
    const k = S.gK * Math.exp(-r2 / (s2 * 4))
    let px = S.pullX + dx * (1 - k)
    let pz = S.pullZ + dz * (1 - k)
    const th = Math.atan2(dz, dx)
    const t = S.t
    const cr =
        Math.sin(th * 7 + 1.3 * Math.sin(th * 3 + t * 0.35) + rr * 2.2 - t * 0.25) +
        0.55 * Math.sin(th * 13 - rr * 3.1 + t * 0.5) +
        0.3 * Math.sin(th * 23 + rr * 5 - t * 0.2)
    const ca = S.cA * Math.exp(-r2 / (s2 * 2.5)) * smooth(0, 0.35, rr) * (0.4 + rr)
    let h = S.A * g + cr * ca
    const fx = qx - S.faceX
    const fz = (qz - S.faceZ) * S.squash
    h -= S.faceD * Math.exp(-(fx * fx + fz * fz) / Math.max(S.faceR * S.faceR, 1e-3))
    h +=
        S.drape *
        (0.07 * Math.sin(qx * 1.7 + t * 0.31) * Math.sin(qz * 1.9 - t * 0.23) +
            0.03 * Math.sin(qx * 4.3 - qz * 3.1 + t * 0.6))
    const inv = 1 / Math.max(rr, 1e-3)
    px += -dz * inv * cr * ca * 0.35
    pz += dx * inv * cr * ca * 0.35
    const lf = Math.pow(clamp(h / Math.max(S.A, 0.1), 0, 1), 1.5)
    o[0] = px + S.leanX * lf
    o[1] = h
    o[2] = pz + S.leanZ * lf
}

/** CaviarShroud (Bead Cloth Lift). Fills its parent; lays out a 1200×800 composition contained in it. */
export default function CaviarShroud(rawProps: CaviarShroudProps) {
    const props = withMovedControls(rawProps) as CaviarShroudProps
    const {
        background = DEFAULTS.background,
        lift = DEFAULTS.lift,
        scale = DEFAULTS.scale,
        clothColor = DEFAULTS.clothColor,
        glowColor = DEFAULTS.glowColor,
        zoom = DEFAULTS.zoom,
        placement,
        ripple = DEFAULTS.ripple,
        speed = DEFAULTS.speed,
        rippleOn,
        style,
    } = props
    const adv: CaviarShroudAdvanced = { ...ADVANCED_DEFAULTS, ...(props.advanced ?? {}) }
    const place: CaviarShroudPlacement = { ...DEFAULT_PLACEMENT, ...(placement ?? {}) }

    const rootRef = useRef<HTMLDivElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const cfgNext = { lift, scale, clothColor, glowColor, zoom, ripple, speed, place, adv }
    const cfg = useRef(cfgNext)
    cfg.current = cfgNext
    const wakeRef = useRef<() => void>(() => {})
    const rippleRef = useRef<() => void>(() => {})
    // Wake the loop only when a value really changed, so no-op re-renders
    // draw nothing.
    const sig = JSON.stringify(cfgNext)
    const lastSig = useRef("")
    useEffect(() => {
        if (sig === lastSig.current) return
        lastSig.current = sig
        wakeRef.current()
    }, [sig])

    // (portfolio) a named window event sends a ripple out from the peak
    useEffect(() => {
        if (!rippleOn) return
        const fire = () => rippleRef.current()
        window.addEventListener(rippleOn, fire)
        return () => window.removeEventListener(rippleOn, fire)
    }, [rippleOn])

    useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const reduced = !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches

        // ── GL ──
        let gl: WebGL2RenderingContext | null = null
        let prog: WebGLProgram | null = null
        const U = {} as Record<UniformName, WebGLUniformLocation | null>
        let mainBuf: WebGLBuffer | null = null
        let lowerBuf: WebGLBuffer | null = null
        let mainVao: WebGLVertexArrayObject | null = null
        let lowerVao: WebGLVertexArrayObject | null = null
        let gridKey = ""
        let mainCount = 0
        let lowerCount = 0
        let tiles: MainGrid | null = null
        // Per tile: 1 = on the frame, 2 = can glow.
        const tileFlags = new Uint8Array(TILES)
        let sp = 0.014
        let lost = false
        // Last value sent per uniform, so a value is uploaded only when it changes.
        const sent = {} as Record<UniformName, Float64Array>
        for (const n of UNIFORMS) sent[n] = new Float64Array(4).fill(NaN)
        const changed = (n: UniformName, a: number, b: number, c: number, d: number) => {
            const s = sent[n]
            if (s[0] === a && s[1] === b && s[2] === c && s[3] === d) return false
            s[0] = a
            s[1] = b
            s[2] = c
            s[3] = d
            return true
        }
        const u1 = (n: UniformName, a: number) => {
            if (gl && changed(n, a, 0, 0, 0)) gl.uniform1f(U[n], a)
        }
        const u2 = (n: UniformName, a: number, b: number) => {
            if (gl && changed(n, a, b, 0, 0)) gl.uniform2f(U[n], a, b)
        }
        const u3 = (n: UniformName, a: number, b: number, c: number) => {
            if (gl && changed(n, a, b, c, 0)) gl.uniform3f(U[n], a, b, c)
        }
        const u4 = (n: UniformName, a: number, b: number, c: number, d: number) => {
            if (gl && changed(n, a, b, c, d)) gl.uniform4f(U[n], a, b, c, d)
        }

        const initGL = () => {
            gl = null
            prog = null
            const ctx = canvas.getContext("webgl2", {
                alpha: true,
                premultipliedAlpha: true,
                antialias: false,
                depth: true,
                stencil: false,
                powerPreference: "low-power",
                preserveDrawingBuffer: false,
            }) as WebGL2RenderingContext | null
            if (!ctx || ctx.isContextLost()) return
            const compile = (type: number, src: string) => {
                const sh = ctx.createShader(type)
                if (!sh) return null
                ctx.shaderSource(sh, src)
                ctx.compileShader(sh)
                if (!ctx.getShaderParameter(sh, ctx.COMPILE_STATUS)) {
                    console.warn("CaviarShroud:", ctx.getShaderInfoLog(sh))
                    return null
                }
                return sh
            }
            const vs = compile(ctx.VERTEX_SHADER, VERT)
            const fs = compile(ctx.FRAGMENT_SHADER, FRAG)
            const p = ctx.createProgram()
            if (!vs || !fs || !p) return
            ctx.attachShader(p, vs)
            ctx.attachShader(p, fs)
            ctx.linkProgram(p)
            ctx.deleteShader(vs)
            ctx.deleteShader(fs)
            if (!ctx.getProgramParameter(p, ctx.LINK_STATUS)) {
                console.warn("CaviarShroud:", ctx.getProgramInfoLog(p))
                return
            }
            for (const n of UNIFORMS) U[n] = ctx.getUniformLocation(p, n)
            mainBuf = ctx.createBuffer()
            lowerBuf = ctx.createBuffer()
            const makeVao = (buf: WebGLBuffer | null) => {
                const v = ctx.createVertexArray()
                ctx.bindVertexArray(v)
                ctx.bindBuffer(ctx.ARRAY_BUFFER, buf)
                ctx.enableVertexAttribArray(0)
                ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 16, 0)
                ctx.enableVertexAttribArray(1)
                ctx.vertexAttribPointer(1, 2, ctx.FLOAT, false, 16, 8)
                ctx.bindVertexArray(null)
                return v
            }
            mainVao = makeVao(mainBuf)
            lowerVao = makeVao(lowerBuf)
            gridKey = ""
            for (const n of UNIFORMS) sent[n].fill(NaN)
            prog = p
            gl = ctx
        }

        const onLost = (e: Event) => {
            e.preventDefault()
            lost = true
            gl = null
            stop()
        }
        const onRestored = () => {
            lost = false
            initGL()
            wake()
        }
        canvas.addEventListener("webglcontextlost", onLost)
        canvas.addEventListener("webglcontextrestored", onRestored)

        // ── size ──
        let W = 0 // layout px
        let H = 0
        let shown = 1 // on-screen px per layout px
        let quality = 1
        const sizeCanvas = () => {
            if (W <= 0 || H <= 0) return
            const dpr = Math.min(2, window.devicePixelRatio || 1)
            let s = dpr * clamp(shown, 1, 2)
            s = Math.min(s, Math.sqrt(PIXEL_BUDGET / (W * H)))
            s *= quality
            const bw = Math.max(1, Math.round(W * s))
            const bh = Math.max(1, Math.round(H * s))
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw
                canvas.height = bh
                // Setting the size wipes the buffer: redraw now, not next tick.
                if (gl) draw(0)
            }
        }
        const measureShown = () => {
            const r = root.getBoundingClientRect()
            if (W > 0 && r.width > 0) {
                const s = r.width / W
                if (Math.abs(s - shown) / shown > 0.05) {
                    shown = s
                    return true
                }
            }
            return false
        }
        const ro = new ResizeObserver((entries) => {
            const cr = entries[0].contentRect
            W = cr.width
            H = cr.height
            measureShown()
            sizeCanvas()
            wake()
        })
        ro.observe(root)

        // ── pointer (0–1 of the root as displayed) ──
        const ptr = {
            cx: 0,
            cy: 0,
            moved: false,
            u: 0.5,
            v: 0.5,
            inside: false,
            pressed: false,
            over: 0, // eased hover presence
            down: 0, // eased press
            x: 0, // eased, -1..1 across the frame (parallax)
            y: 0,
        }
        let scrolled = false
        const readPointer = () => {
            if (!ptr.moved && !scrolled) return
            const r = root.getBoundingClientRect()
            if (r.width > 0 && r.height > 0) {
                ptr.u = (ptr.cx - r.left) / r.width
                ptr.v = (ptr.cy - r.top) / r.height
            }
            ptr.moved = false
            scrolled = false
        }
        // Presses are queued and resolved against the cloth on the next frame.
        let pressQueued = false
        let releaseQueued = false
        let pressAt = 0
        let pressCX = 0
        let pressCY = 0
        let pressTravel = 0
        // (portfolio) ripples asked for from outside, sent from the peak
        let peakRippleQueued = false
        const onMove = (e: PointerEvent) => {
            if (e.clientX === ptr.cx && e.clientY === ptr.cy && ptr.inside) return
            if (ptr.pressed) pressTravel = Math.max(pressTravel, Math.hypot(e.clientX - pressCX, e.clientY - pressCY))
            ptr.cx = e.clientX
            ptr.cy = e.clientY
            ptr.moved = true
            if (e.pointerType !== "touch" || e.buttons) ptr.inside = true
            wake()
        }
        const onEnter = (e: PointerEvent) => {
            onMove(e)
            ptr.inside = true
        }
        const onLeave = () => {
            if (ptr.pressed) return // captured: the grab carries on outside
            ptr.inside = false
            wake()
        }
        const onDown = (e: PointerEvent) => {
            onMove(e)
            ptr.inside = true
            ptr.pressed = true
            pressQueued = true
            pressAt = performance.now()
            pressCX = e.clientX
            pressCY = e.clientY
            pressTravel = 0
            try {
                root.setPointerCapture(e.pointerId)
            } catch {
                // capture is a nicety; the grab still ends on pointerup
            }
            wake()
        }
        const onUp = (e: PointerEvent) => {
            if (!ptr.pressed) return
            ptr.pressed = false
            releaseQueued = true
            if (e.pointerType === "touch") ptr.inside = false
            else {
                const r = root.getBoundingClientRect()
                ptr.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
            }
            wake()
        }
        const onCancel = () => {
            if (ptr.pressed) releaseQueued = true
            ptr.pressed = false
            pressTravel = 1e9 // a cancelled press is never a tap
            ptr.inside = false
            wake()
        }
        const onScroll = () => {
            scrolled = true
        }
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerenter", onEnter)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onCancel)
        window.addEventListener("scroll", onScroll, { passive: true, capture: true })
        rippleRef.current = () => {
            peakRippleQueued = true
            wake()
        }

        // ── per-frame scratch (nothing below allocates) ──
        const Pm = new Float32Array(16)
        const Vm = new Float32Array(16)
        const VP = new Float32Array(16)
        const basis = new Float64Array(9)
        const eye = new Float64Array(3)
        const tgt = new Float64Array(3)
        const upv = new Float64Array(3)
        const tiltM = new Float32Array(9) // column-major
        const tl: Timeline = { L: 0, bandI: 0, bandW: 0, broken: 0, arc: 0, rise: 0, cam: 0, ring: 0, face: 0, squash: 0 }
        const S: Sheet = {
            pullX: 0, pullZ: -0.5, leanX: 0, leanZ: 0, A: 1, sig: 1, gK: 0, cA: 0,
            faceX: 0, faceZ: 0, faceR: 1, faceD: 0, squash: 1, drape: 1, t: 0,
        }
        const sp3 = new Float64Array(3)
        const qOut = new Float64Array(2) // sheet coordinates of the last heightAt()
        const srcs = new Float64Array((RIPPLES + 1) * 3) // glow sources in q: x, z, radius
        const hit = new Float64Array(3)
        const ray = new Float64Array(6) // origin, direction (subject frame)
        const post = { m00: 1, m01: 0, m10: 0, m11: 1, bx: 0, by: 0, aspect: 1, f: 1 }
        const cloth = new Float32Array(3)
        const high = new Float32Array(3)
        const glowC = new Float32Array(3)
        const core = new Float32Array(3)
        const colorKey = ["", "", "", ""]

        // Touch point on the cloth (subject frame), eased.
        const touch = { x: 0, y: 0, z: 0, k: 0, on: false }
        // Grab: lean (x, z) and stretch of the peak, as a spring.
        const grab = {
            active: false,
            ox: 0, oy: 0, oz: 0, // where it was grabbed
            nx: 0, ny: 0, nz: 1, // drag plane normal (faces the camera)
            sx: 0, sy: 0, sz: 0, // offsets at the moment of the grab
            tx: 0, ty: 0, tz: 0, // where the hand leads them
            lx: 0, ly: 0, lz: 0, // current
            vx: 0, vy: 0, vz: 0,
            acc: 0,
        }
        const pressHit = { ok: false, x: 0, y: 0, z: 0 }
        const rip = {
            x: new Float64Array(RIPPLES),
            y: new Float64Array(RIPPLES),
            z: new Float64Array(RIPPLES),
            t: new Float64Array(RIPPLES).fill(-1e9),
            next: 0,
        }

        /** Surface height under world (x, z) in the subject frame, or NaN off the cloth. */
        const heightAt = (x: number, z: number) => {
            let qx = x
            let qz = z
            for (let i = 0; i < 6; i++) {
                sheetAt(S, qx, qz, sp3)
                qx += (x - sp3[0]) * 0.85
                qz += (z - sp3[2]) * 0.85
            }
            sheetAt(S, qx, qz, sp3)
            qOut[0] = qx
            qOut[1] = qz
            if (Math.abs(sp3[0] - x) + Math.abs(sp3[2] - z) > 0.03) return NaN
            if (qx < -3.8 || qx > 3.8 || qz < -2.8 || qz > 1.5) return NaN
            return sp3[1]
        }
        /** Cursor (NDC) → ray in the subject's own (untilted) frame, into `ray`. */
        const makeRay = (nx: number, ny: number) => {
            // Undo the on-screen placement (fit, Scale, Angle, offsets).
            const vx = nx - post.bx
            const vy = ny - post.by
            const det = post.m00 * post.m11 - post.m01 * post.m10 || 1
            const rx = (post.m11 * vx - post.m01 * vy) / det
            const ry = (-post.m10 * vx + post.m00 * vy) / det
            const dx = (rx * post.aspect) / post.f
            const dy = ry / post.f
            const b = basis
            let wx = b[0] * dx + b[3] * dy - b[6]
            let wy = b[1] * dx + b[4] * dy - b[7]
            let wz = b[2] * dx + b[5] * dy - b[8]
            const l = Math.hypot(wx, wy, wz) || 1
            wx /= l
            wy /= l
            wz /= l
            // Undo Tilt: Rᵀ about TILT_C.
            const m = tiltM
            const ex = eye[0] - TILT_C[0], ey = eye[1] - TILT_C[1], ez = eye[2] - TILT_C[2]
            ray[0] = TILT_C[0] + m[0] * ex + m[1] * ey + m[2] * ez
            ray[1] = TILT_C[1] + m[3] * ex + m[4] * ey + m[5] * ez
            ray[2] = TILT_C[2] + m[6] * ex + m[7] * ey + m[8] * ez
            ray[3] = m[0] * wx + m[1] * wy + m[2] * wz
            ray[4] = m[3] * wx + m[4] * wy + m[5] * wz
            ray[5] = m[6] * wx + m[7] * wy + m[8] * wz
        }
        /** March the ray to the first crossing of the cloth; the point into `hit`. */
        const castCloth = () => {
            const STEP = 0.05
            let prevT = 0
            let prevAbove = true
            for (let t = 0.05; t < 10; t += STEP) {
                const x = ray[0] + ray[3] * t
                const y = ray[1] + ray[4] * t
                const z = ray[2] + ray[5] * t
                const h = heightAt(x, z)
                if (isNaN(h)) {
                    prevAbove = true
                    prevT = t
                    continue
                }
                const above = y > h
                if (!above && prevAbove && t > 0.05) {
                    let a = prevT
                    let b = t
                    for (let i = 0; i < 8; i++) {
                        const m = (a + b) / 2
                        const hm = heightAt(ray[0] + ray[3] * m, ray[2] + ray[5] * m)
                        if (!isNaN(hm) && ray[1] + ray[4] * m <= hm) b = m
                        else a = m
                    }
                    hit[0] = ray[0] + ray[3] * b
                    hit[1] = ray[1] + ray[4] * b
                    hit[2] = ray[2] + ray[5] * b
                    return true
                }
                prevAbove = above
                prevT = t
            }
            return false
        }

        /**
         * Is a box (subject frame) wholly off the picture? Its corners go
         * through Tilt, the camera and the on-screen placement; the box is
         * off when every corner lies past the same edge (mx, my: the edge,
         * widened for bead size) or behind the near cut.
         */
        const boxOut = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, mx: number, my: number) => {
            const m = tiltM
            let all = 31
            for (let c = 0; c < 8; c++) {
                const ex = (c & 1 ? x1 : x0) - TILT_C[0]
                const ey = (c & 2 ? y1 : y0) - TILT_C[1]
                const ez = (c & 4 ? z1 : z0) - TILT_C[2]
                const wx = TILT_C[0] + m[0] * ex + m[3] * ey + m[6] * ez
                const wy = TILT_C[1] + m[1] * ex + m[4] * ey + m[7] * ez
                const wz = TILT_C[2] + m[2] * ex + m[5] * ey + m[8] * ez
                const cx = VP[0] * wx + VP[4] * wy + VP[8] * wz + VP[12]
                const cy = VP[1] * wx + VP[5] * wy + VP[9] * wz + VP[13]
                const cw = VP[3] * wx + VP[7] * wy + VP[11] * wz + VP[15]
                const px = post.m00 * cx + post.m01 * cy + post.bx * cw
                const py = post.m10 * cx + post.m11 * cy + post.by * cw
                let o = 0
                if (px > cw * mx) o |= 1
                if (px < -cw * mx) o |= 2
                if (py > cw * my) o |= 4
                if (py < -cw * my) o |= 8
                if (cw < 0.05) o |= 16
                all &= o
                if (!all) return 0
            }
            return all
        }

        // ── loop ──
        let raf = 0
        let running = false
        let visible = true
        let clock = -PREROLL_S // animation time (scaled by Speed)
        let real = 0 // wall time, for the pointer's own motion
        let lastDraw = -1
        let tickPrev = -1
        let vs = 0
        let framesDrawn = 0
        let period = 1000 / 60
        const gaps = new Float64Array(15)
        const gapSort = new Float64Array(15)
        let gapN = 0
        let slowSince = -1
        let goodSince = -1
        let raiseLocked = false
        let lastDrop = -1e9

        const isStill = () => reduced

        const settled = () => {
            const c = cfg.current
            if (!isStill() && c.speed > 0) return false
            if (Math.abs(ptr.over - (ptr.inside ? 1 : 0)) > 0.002) return false
            if (Math.abs(ptr.down - (ptr.pressed ? 1 : 0)) > 0.002) return false
            if (ptr.over > 0.002 && Math.abs(ptr.x - (ptr.inside ? ptr.u * 2 - 1 : 0)) + Math.abs(ptr.y - (ptr.inside ? ptr.v * 2 - 1 : 0)) > 0.002)
                return false
            if (Math.abs(touch.k - (touch.on ? 1 : 0)) > 0.002) return false
            if (touch.on && Math.abs(touch.x - hit[0]) + Math.abs(touch.y - hit[1]) + Math.abs(touch.z - hit[2]) > 0.001) return false
            const g = grab
            if (Math.abs(g.lx - g.tx) + Math.abs(g.ly - g.ty) + Math.abs(g.lz - g.tz) > 0.001) return false
            if (Math.abs(g.vx) + Math.abs(g.vy) + Math.abs(g.vz) > 0.001) return false
            for (let i = 0; i < RIPPLES; i++) if (real - rip.t[i] < RIPPLE_LIFE) return false
            if (pressQueued || releaseQueued || peakRippleQueued) return false
            return true
        }

        function draw(dtMs: number) {
            const g = gl
            if (!g || !prog || W <= 0 || H <= 0) return
            const c = cfg.current
            const a = c.adv
            const pl = c.place
            const dt = Math.min(dtMs / 1000, 0.05)
            const still = isStill()
            const hk = Math.max(0, a.hover) / 50
            real += dt

            // Beads: rebuilt only when the pitch or seed changes.
            const sc = clamp(c.scale, 50, 200)
            const key = sc + ":" + a.seed
            if (key !== gridKey) {
                gridKey = key
                sp = 0.014 * (sc / 100)
                const minSp = Math.sqrt((7.6 * 4.3) / 0.866 / MAX_BEADS)
                sp = Math.max(sp, minSp)
                const m = buildMain(sp, a.seed)
                g.bindBuffer(g.ARRAY_BUFFER, mainBuf)
                g.bufferData(g.ARRAY_BUFFER, m.data, g.STATIC_DRAW)
                mainCount = m.data.length / 4
                tiles = m
                const lw = buildLower(sp, a.seed)
                g.bindBuffer(g.ARRAY_BUFFER, lowerBuf)
                g.bufferData(g.ARRAY_BUFFER, lw, g.STATIC_DRAW)
                lowerCount = lw.length / 4
            }

            // Pointer easing, as the original: presence ~250 ms, parallax ~170 ms.
            ptr.over += ((ptr.inside ? 1 : 0) - ptr.over) * (1 - Math.exp(-dt * 4))
            ptr.down += ((ptr.pressed ? 1 : 0) - ptr.down) * (1 - Math.exp(-dt * 8))
            const ke = 1 - Math.exp(-dt * 6)
            ptr.x += ((ptr.inside ? ptr.u * 2 - 1 : 0) - ptr.x) * ke
            ptr.y += ((ptr.inside ? ptr.v * 2 - 1 : 0) - ptr.y) * ke

            clock += still ? 0 : dt * (Math.max(0, c.speed) / 50)
            const cycle = Math.max(1000, a.cycleMs)
            const u = still ? STILL_U : ((Math.max(0, clock) * 1000) % cycle) / cycle
            timeline(tl, u)
            const uTime = still ? 0 : clock

            const ov = ptr.over * hk
            const Lp = Math.max(0, Math.min(1.15, tl.L + 0.12 * ptr.down * hk + 0.08 * ptr.y * ov))
            const liftAmt = Math.max(0, c.lift) / 70
            const A0 = a.peakStart / 100
            const A1 = a.peakEnd / 100

            const BW = g.drawingBufferWidth
            const BH = g.drawingBufferHeight
            const aspect = BW / Math.max(1, BH)
            const fovy = (clamp(a.fov, 20, 100) * Math.PI) / 180
            perspective(Pm, fovy, aspect, 0.05, 40)
            const cam = tl.cam
            const par = still ? 0 : ov
            eye[0] = 0.5 * cam + ptr.x * 0.11 * par
            eye[1] = 0.3 - ptr.y * 0.045 * par
            eye[2] = 2.3 - 0.45 * cam
            tgt[0] = 0
            tgt[1] = 0.85
            tgt[2] = -0.5 + 0.05 * cam
            upv[0] = 0.2 * cam
            upv[1] = 1
            upv[2] = 0
            lookAt(Vm, basis, eye, tgt, upv)
            mul(VP, Pm, Vm)

            // On-screen placement, one affine map in NDC: Scale and Angle about
            // the cloth's middle, then the frame fit (contain, about the frame
            // centre), then the offsets.
            const fit = Math.min(1, aspect / REF_ASPECT)
            const s = clamp(c.zoom, 25, 100) / 100
            const th = (clamp(pl.angle, -180, 180) * Math.PI) / 180
            const cs = Math.cos(th)
            const sn = Math.sin(th)
            const k = fit * s
            post.aspect = aspect
            post.f = Pm[5]
            post.m00 = k * cs
            post.m01 = (k * sn) / aspect
            post.m10 = -k * aspect * sn
            post.m11 = k * cs
            post.bx = fit * (-(s * sn * CONTENT_Y) / aspect) + (2 * clamp(pl.x, -50, 50)) / 100
            post.by = fit * (CONTENT_Y - s * cs * CONTENT_Y) - (2 * clamp(pl.y, -50, 50)) / 100

            // Tilt: turn the cloth about the camera's right axis, top away for
            // positive values.
            const ta = (-clamp(pl.tilt, -60, 60) * Math.PI) / 180
            {
                const rx = basis[0], ry = basis[1], rz = basis[2]
                const ct = Math.cos(ta)
                const st = Math.sin(ta)
                const it = 1 - ct
                // R = cos·I + (1−cos)·r rᵀ + sin·[r]×, stored column-major.
                tiltM[0] = ct + it * rx * rx
                tiltM[1] = it * rx * ry + st * rz
                tiltM[2] = it * rx * rz - st * ry
                tiltM[3] = it * rx * ry - st * rz
                tiltM[4] = ct + it * ry * ry
                tiltM[5] = it * ry * rz + st * rx
                tiltM[6] = it * rx * rz + st * ry
                tiltM[7] = it * ry * rz - st * rx
                tiltM[8] = ct + it * rz * rz
            }

            // Grab spring, on a fixed 120 Hz substep: follows the hand closely
            // while held, wobbles home when let go.
            {
                const G = grab
                G.acc += dt
                const w = G.active ? 22 : 8
                const z = G.active ? 1 : 0.28
                const h = 1 / 120
                while (G.acc >= h) {
                    G.acc -= h
                    G.vx += (w * w * (G.tx - G.lx) - 2 * z * w * G.vx) * h
                    G.vy += (w * w * (G.ty - G.ly) - 2 * z * w * G.vy) * h
                    G.vz += (w * w * (G.tz - G.lz) - 2 * z * w * G.vz) * h
                    G.lx += G.vx * h
                    G.ly += G.vy * h
                    G.lz += G.vz * h
                }
                if (!G.active && Math.abs(G.lx) + Math.abs(G.ly) + Math.abs(G.lz) + Math.abs(G.vx) + Math.abs(G.vy) + Math.abs(G.vz) < 2e-4) {
                    G.lx = G.ly = G.lz = G.vx = G.vy = G.vz = 0
                }
            }

            const ringR = (a.bandRadius / 100) * tl.ring
            // The base slides a quarter of the lean; the tip goes the rest.
            S.pullX = 0.25 * grab.lx
            S.pullZ = -0.5 + 0.25 * grab.lz
            S.leanX = 0.75 * grab.lx
            S.leanZ = 0.75 * grab.lz
            S.A = Math.max(0, (A0 + (A1 - A0) * Lp) * liftAmt + grab.ly)
            S.sig = 1.55 - 0.75 * Math.min(1, Lp)
            S.gK = (Math.max(0, a.gather) / 100) * Lp * 0.6
            S.cA = (Math.max(0, a.creases) / 100) * 0.09
            S.faceX = 0.25 * grab.lx
            S.faceZ = -0.5 + tl.face + 0.25 * grab.lz
            S.faceR = Math.max(0.02, ringR * (a.faceSize / 50))
            S.faceD = (Math.max(0, a.faceDepth) / 100) * (0.6 + 0.6 * Math.min(1, tl.ring / 1.3))
            S.squash = tl.squash
            S.drape = Math.max(0, a.drape) / 100
            S.t = uTime

            // (portfolio) a ripple asked for from outside starts at the peak
            if (peakRippleQueued) {
                peakRippleQueued = false
                if (c.ripple > 0 && !reduced) {
                    const i = rip.next
                    rip.x[i] = S.pullX + S.leanX
                    rip.y[i] = S.A
                    rip.z[i] = S.pullZ + S.leanZ
                    rip.t[i] = real
                    rip.next = (i + 1) % RIPPLES
                }
            }

            // ── pointer on the cloth ──
            readPointer()
            const pnx = ptr.u * 2 - 1
            const pny = 1 - ptr.v * 2
            const wantsTouch = hk > 0 && (ptr.inside || ptr.pressed)
            let onCloth = false
            if (wantsTouch || pressQueued) {
                makeRay(pnx, pny)
                onCloth = castCloth()
            }
            if (pressQueued) {
                pressQueued = false
                pressHit.ok = onCloth
                if (onCloth) {
                    pressHit.x = hit[0]
                    pressHit.y = hit[1]
                    pressHit.z = hit[2]
                }
                if (onCloth && hk > 0) {
                    const G = grab
                    G.active = true
                    G.ox = hit[0]
                    G.oy = hit[1]
                    G.oz = hit[2]
                    // Drag plane through the grab point, facing the camera.
                    const m = tiltM
                    G.nx = m[0] * basis[6] + m[1] * basis[7] + m[2] * basis[8]
                    G.ny = m[3] * basis[6] + m[4] * basis[7] + m[5] * basis[8]
                    G.nz = m[6] * basis[6] + m[7] * basis[7] + m[8] * basis[8]
                    G.sx = G.lx
                    G.sy = G.ly
                    G.sz = G.lz
                    G.tx = G.lx
                    G.ty = G.ly
                    G.tz = G.lz
                }
            }
            if (grab.active && !releaseQueued) {
                const G = grab
                makeRay(pnx, pny)
                const dn = ray[3] * G.nx + ray[4] * G.ny + ray[5] * G.nz
                if (Math.abs(dn) > 1e-4) {
                    const t = ((G.ox - ray[0]) * G.nx + (G.oy - ray[1]) * G.ny + (G.oz - ray[2]) * G.nz) / dn
                    if (t > 0) {
                        const gain = Math.min(1, hk)
                        let dx = (ray[0] + ray[3] * t - G.ox) * gain
                        const dy = (ray[1] + ray[4] * t - G.oy) * gain
                        let dz = (ray[2] + ray[5] * t - G.oz) * gain
                        const l = Math.hypot(dx, dz)
                        if (l > GRAB_REACH) {
                            dx *= GRAB_REACH / l
                            dz *= GRAB_REACH / l
                        }
                        G.tx = G.sx + dx
                        G.ty = clamp(G.sy + dy, GRAB_LIFT_MIN, GRAB_LIFT_MAX)
                        G.tz = G.sz + dz
                    }
                }
            }
            if (releaseQueued) {
                releaseQueued = false
                grab.active = false
                grab.tx = grab.ty = grab.tz = 0
                // A tap (short, barely moved) sends a ripple from where it landed.
                const tap = performance.now() - pressAt < 350 && pressTravel < 8
                if (tap && pressHit.ok && c.ripple > 0 && !reduced) {
                    const i = rip.next
                    rip.x[i] = pressHit.x
                    rip.y[i] = pressHit.y
                    rip.z[i] = pressHit.z
                    rip.t[i] = real
                    rip.next = (i + 1) % RIPPLES
                }
            }
            // Touch follows the cursor in ~30 ms, fades in and out over ~120 ms.
            touch.on = wantsTouch && onCloth
            if (touch.on) {
                if (touch.k < 0.01) {
                    touch.x = hit[0]
                    touch.y = hit[1]
                    touch.z = hit[2]
                }
                const kf = 1 - Math.exp(-dt * 35)
                touch.x += (hit[0] - touch.x) * kf
                touch.y += (hit[1] - touch.y) * kf
                touch.z += (hit[2] - touch.z) * kf
            }
            touch.k += ((touch.on ? 1 : 0) - touch.k) * (1 - Math.exp(-dt * 8))
            if (!touch.on && touch.k < 0.002) touch.k = 0

            // ── colours (parsed only when they change) ──
            if (colorKey[0] !== c.clothColor) {
                colorKey[0] = c.clothColor
                parseColor(c.clothColor, [0.14, 0.15, 0.18], cloth)
            }
            if (colorKey[1] !== a.highlightColor) {
                colorKey[1] = a.highlightColor
                parseColor(a.highlightColor, [0.48, 0.5, 0.55], high)
            }
            if (colorKey[2] !== c.glowColor) {
                colorKey[2] = c.glowColor
                parseColor(c.glowColor, [0.12, 0.36, 1], glowC)
            }
            if (colorKey[3] !== a.coreColor) {
                colorKey[3] = a.coreColor
                parseColor(a.coreColor, [0.81, 0.9, 1], core)
            }

            // ── tiles: which are on the frame, which can glow ──
            const tg = tiles
            if (tg) {
                const tb = tg.bounds
                const s2 = Math.max(S.sig * S.sig, 1e-3)
                const lean = Math.abs(S.leanX) + Math.abs(S.leanZ)
                // A bead is up to 64 px across, so it shows until 32 px past the edge.
                const mx = 1 + 64 / BW
                const my = 1 + 64 / BH
                // Glow sources as boxes in sheet coordinates: the band round the
                // hollow and the side arc (exact), touch and ripples (generous:
                // they are measured on the cloth, which gathers toward the peak).
                const bw = (Math.max(1, a.bandWidth) / 100) * tl.bandW
                const rb = ringR + bw
                const bandOn = tl.bandI * a.glowStrength > 0
                const ra = 1.35 + bw
                const arcOn = a.arc * tl.arc > 0
                const spread = 1 / Math.max(0.3, 1 - S.gK)
                let nSrc = 0
                if (touch.k * hk > 0) {
                    heightAt(touch.x, touch.z)
                    srcs[0] = qOut[0]
                    srcs[1] = qOut[1]
                    srcs[2] = TOUCH_R * 2.5 * spread + lean + 0.1
                    nSrc = 1
                }
                if (c.ripple > 0) {
                    for (let i = 0; i < RIPPLES; i++) {
                        const age = real - rip.t[i]
                        if (age < 0 || age >= RIPPLE_LIFE) continue
                        heightAt(rip.x[i], rip.z[i])
                        srcs[nSrc * 3] = qOut[0]
                        srcs[nSrc * 3 + 1] = qOut[1]
                        srcs[nSrc * 3 + 2] = (age * RIPPLE_SPEED + 3 * RIPPLE_W) * spread + lean + 0.1
                        nSrc++
                    }
                }
                const k1 = 1 - S.gK
                for (let t = 0; t < TILES; t++) {
                    const b = t * 4
                    const x0 = tb[b], x1 = tb[b + 1], z0 = tb[b + 2], z1 = tb[b + 3]
                    if (!(x0 <= x1)) {
                        tileFlags[t] = 0
                        continue
                    }
                    let glow =
                        (bandOn && x1 >= S.faceX - rb && x0 <= S.faceX + rb && z1 >= S.faceZ - rb / S.squash && z0 <= S.faceZ + rb / S.squash) ||
                        (arcOn && x1 >= -0.25 * ra && x0 <= ra && z1 >= -0.8 * ra && z0 <= ra)
                    for (let i = 0; i < nSrc && !glow; i++) {
                        const sx = srcs[i * 3], sz = srcs[i * 3 + 1], sr = srcs[i * 3 + 2]
                        glow = x1 >= sx - sr && x0 <= sx + sr && z1 >= sz - sr && z0 <= sz + sr
                    }
                    // Where the tile's beads can be: the tile and its gathered
                    // copy, widened by creases, lean and the pointer's nudges;
                    // as high as the peak can reach over it.
                    const wx0 = Math.min(x0, S.pullX + (x0 - S.pullX) * k1)
                    const wx1 = Math.max(x1, S.pullX + (x1 - S.pullX) * k1)
                    const wz0 = Math.min(z0, S.pullZ + (z0 - S.pullZ) * k1)
                    const wz1 = Math.max(z1, S.pullZ + (z1 - S.pullZ) * k1)
                    const dx = Math.max(0, x0 - S.pullX, S.pullX - x1)
                    const dz = Math.max(0, z0 - S.pullZ, S.pullZ - z1)
                    const fx = Math.max(Math.abs(x0 - S.pullX), Math.abs(x1 - S.pullX))
                    const fz = Math.max(Math.abs(z0 - S.pullZ), Math.abs(z1 - S.pullZ))
                    const crease = 1.85 * S.cA * (0.4 + Math.hypot(fx, fz))
                    const m = crease * 0.35 + lean + 0.25
                    const yTop = S.A * Math.exp(-(dx * dx + dz * dz) / s2) + crease + 0.1 * S.drape + 0.25
                    const yBot = -S.faceD - crease - 0.1 * S.drape - 0.25
                    const off = boxOut(wx0 - m, wx1 + m, yBot, yTop, wz0 - m, wz1 + m, mx, my)
                    tileFlags[t] = off ? 0 : glow ? 3 : 1
                }
            }

            // ── draw ──
            const pxPerUnit = BH * Pm[5] * 0.5
            g.viewport(0, 0, BW, BH)
            g.clearColor(0, 0, 0, 0)
            g.clearDepth(1)
            g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT)
            g.useProgram(prog)
            g.uniformMatrix4fv(U.uVP, false, VP)
            g.uniformMatrix3fv(U.uTiltM, false, tiltM)
            u4("uPost", post.m00, post.m01, post.m10, post.m11)
            u2("uPostB", post.bx, post.by)
            u3("uTiltC", TILT_C[0], TILT_C[1], TILT_C[2])
            u3("uEye", eye[0], eye[1], eye[2])
            u1("uTime", uTime)
            u1("uA", S.A)
            u1("uSig", S.sig)
            u1("uGatherK", S.gK)
            u1("uCreaseA", S.cA)
            u2("uFaceC", S.faceX, S.faceZ)
            u1("uFaceR", S.faceR)
            u1("uFaceDepth", S.faceD)
            u1("uFaceSquash", S.squash)
            u1("uDrape", S.drape)
            u2("uPull", S.pullX, S.pullZ)
            u2("uLean", S.leanX, S.leanZ)
            u1("uRise", tl.rise)
            u1("uRingR", ringR)
            u1("uBandW", (Math.max(1, a.bandWidth) / 100) * tl.bandW)
            u1("uBandI", tl.bandI * (Math.max(0, a.glowStrength) / 100))
            u1("uBroken", tl.broken)
            u1("uArcI", (Math.max(0, a.arc) / 100) * tl.arc)
            u1("uArcR", 1.35)
            u1("uFlickHz", 1000 / Math.max(50, a.flickerMs))
            u1("uFlickAmt", Math.max(0, a.sparkle) / 100)
            u1("uHoles", Math.max(0, a.holes) / 100)
            u1("uLace", Math.max(0, a.lace) / 100)
            // Beads shrink with the content (fit × Scale), not with the frame.
            u1("uBeadPx", sp * (Math.max(10, a.beadSize) / 100) * pxPerUnit * k)
            u1("uBloom", Math.max(1, a.bloom / 100))
            u1("uLowerSize", Math.max(1, a.lowerSize / 100))
            u1("uLowerGlow", Math.max(0, a.lowerGlow) / 100)
            u4("uTouch", touch.x, touch.y, touch.z, touch.k * Math.min(1.5, hk))
            u1("uTouchR", TOUCH_R)
            const rs = Math.max(0, c.ripple) / 50
            let ra0 = 0, ra1 = 0, ra2 = 0, ra3 = 0
            for (let i = 0; i < RIPPLES; i++) {
                const age = real - rip.t[i]
                const amp = age >= 0 && age < RIPPLE_LIFE ? rs * Math.pow(1 - age / RIPPLE_LIFE, 2) : 0
                const n = (i === 0 ? "uRip0" : i === 1 ? "uRip1" : i === 2 ? "uRip2" : "uRip3") as UniformName
                if (amp > 0) u4(n, rip.x[i], rip.y[i], rip.z[i], age * RIPPLE_SPEED)
                if (i === 0) ra0 = amp
                else if (i === 1) ra1 = amp
                else if (i === 2) ra2 = amp
                else ra3 = amp
            }
            u4("uRipA", ra0, ra1, ra2, ra3)
            u1("uRipW", RIPPLE_W)
            u3("uCloth", cloth[0], cloth[1], cloth[2])
            u3("uHigh", high[0], high[1], high[2])
            u3("uGlowC", glowC[0], glowC[1], glowC[2])
            u3("uCore", core[0], core[1], core[2])
            u1("uBloomA", Math.max(0, a.bloomOpacity) / 100)

            const showLower = tl.rise > 0.01
            // Main sheet: one draw per run of flagged tiles.
            const drawTiles = (mask: number) => {
                if (!tg) {
                    g.drawArrays(g.POINTS, 0, mainCount)
                    return
                }
                let first = -1
                let end = 0
                for (let t = 0; t < TILES; t++) {
                    const n = tg.count[t]
                    if (n === 0 || !(tileFlags[t] & mask)) continue
                    const s = tg.start[t]
                    if (first >= 0 && s === end) end += n
                    else {
                        if (first >= 0) g.drawArrays(g.POINTS, first, end - first)
                        first = s
                        end = s + n
                    }
                }
                if (first >= 0) g.drawArrays(g.POINTS, first, end - first)
            }
            const layers = (pass: number) => {
                u1("uPass", pass)
                u1("uLayer", 0)
                g.bindVertexArray(mainVao)
                drawTiles(pass ? 2 : 1)
                if (showLower) {
                    u1("uLayer", 1)
                    g.bindVertexArray(lowerVao)
                    g.drawArrays(g.POINTS, 0, lowerCount)
                }
            }
            g.enable(g.DEPTH_TEST)
            g.depthFunc(g.LEQUAL)
            g.depthMask(true)
            g.disable(g.BLEND)
            layers(0)
            // Bloom: soft additive halos round the lit beads (skipped at 0%).
            if (a.bloomOpacity > 0) {
                g.enable(g.BLEND)
                g.blendFunc(g.ONE, g.ONE)
                g.depthMask(false)
                layers(1)
                g.depthMask(true)
                g.disable(g.BLEND)
            }
            g.bindVertexArray(null)
            framesDrawn++
        }

        // Quality ladder: judged on the median lateness of recent frames, so a
        // lone stall never costs resolution; a raise that has to be reverted
        // locks further raises.
        const ladder = (now: number, lateMed: number, N: number) => {
            const budget = period * N
            if (lateMed > budget * 1.35) {
                goodSince = -1
                if (slowSince < 0) slowSince = now
                if (now - slowSince > 500 && quality > QUALITY_FLOOR) {
                    if (now - lastDrop < 3000) raiseLocked = true
                    quality = Math.max(QUALITY_FLOOR, quality * 0.85)
                    lastDrop = now
                    slowSince = -1
                    sizeCanvas()
                }
            } else {
                slowSince = -1
                if (goodSince < 0) goodSince = now
                if (!raiseLocked && quality < 1 && now - goodSince > 2500 && lateMed < budget * 1.1) {
                    quality = Math.min(1, quality / 0.85)
                    goodSince = -1
                    sizeCanvas()
                }
            }
        }
        const lates = new Float64Array(9)
        const lateSort = new Float64Array(9)
        let lateN = 0

        const tick = (now: number) => {
            raf = 0
            if (!running) return
            raf = requestAnimationFrame(tick)
            if (tickPrev >= 0) {
                const gap = now - tickPrev
                if (gap > 0 && gap < 100) {
                    gaps[gapN % 15] = gap
                    gapN++
                    const m = Math.min(gapN, 15)
                    for (let i = 0; i < m; i++) gapSort[i] = gaps[i]
                    period = gapSort.subarray(0, m).sort()[m >> 1]
                }
            }
            tickPrev = now
            // Lock to vsync: draw every Nth tick, ~60 fps on any refresh rate.
            const N = Math.max(1, Math.floor(1000 / 60 / period + 0.1))
            vs++
            if (vs % N !== 0) return
            if (framesDrawn % 30 === 29 && measureShown()) sizeCanvas()
            const dtMs = lastDraw < 0 ? 0 : now - lastDraw
            if (lastDraw >= 0 && framesDrawn > 30) {
                lates[lateN % 9] = dtMs
                lateN++
                const m = Math.min(lateN, 9)
                for (let i = 0; i < m; i++) lateSort[i] = lates[i]
                ladder(now, lateSort.subarray(0, m).sort()[m >> 1], N)
            }
            lastDraw = now
            draw(dtMs)
            if (settled()) stop()
        }
        function stop() {
            running = false
            if (raf) cancelAnimationFrame(raf)
            raf = 0
        }
        function wake() {
            if (running || !visible || lost || !gl) return
            running = true
            tickPrev = -1
            lastDraw = -1
            vs = -1
            raf = requestAnimationFrame(tick)
        }
        wakeRef.current = wake

        const io = new IntersectionObserver((es) => {
            const e = es[es.length - 1]
            visible = e.isIntersecting && !document.hidden
            if (W > 0 && e.boundingClientRect.width > 0) {
                const s = e.boundingClientRect.width / W
                if (Math.abs(s - shown) / shown > 0.05) {
                    shown = s
                    sizeCanvas()
                }
            }
            if (visible) wake()
            else stop()
        })
        io.observe(root)
        const onVis = () => {
            if (document.hidden) stop()
            else {
                visible = true
                wake()
            }
        }
        document.addEventListener("visibilitychange", onVis)

        initGL()
        if (!gl) {
            // No GPU path: the Background stays showing.
            canvas.style.display = "none"
        }
        sizeCanvas()
        wake()

        return () => {
            stop()
            wakeRef.current = () => {}
            rippleRef.current = () => {}
            ro.disconnect()
            io.disconnect()
            document.removeEventListener("visibilitychange", onVis)
            canvas.removeEventListener("webglcontextlost", onLost)
            canvas.removeEventListener("webglcontextrestored", onRestored)
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerenter", onEnter)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onCancel)
            window.removeEventListener("scroll", onScroll, { capture: true })
            const g = gl
            if (g && !g.isContextLost()) {
                g.deleteBuffer(mainBuf)
                g.deleteBuffer(lowerBuf)
                g.deleteVertexArray(mainVao)
                g.deleteVertexArray(lowerVao)
                g.deleteProgram(prog)
            }
            gl = null
        }
    }, [])

    const fill: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }
    const vignette = clamp(adv.vignette, 0, 100) / 100
    const grain = clamp(adv.grain, 0, 100) / 100

    return (
        <div
            ref={rootRef}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                aspectRatio: `${REF_W} / ${REF_H}`,
                ...style,
                background,
                overflow: "hidden",
                isolation: "isolate",
                touchAction: "pan-y",
            }}
        >
            <canvas ref={canvasRef} style={fill} />
            {vignette > 0 && (
                <div
                    style={{
                        ...fill,
                        pointerEvents: "none",
                        background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,${vignette}) 100%)`,
                    }}
                />
            )}
            {grain > 0 && <div style={{ ...fill, pointerEvents: "none", opacity: grain * 0.5, backgroundImage: GRAIN }} />}
        </div>
    )
}
