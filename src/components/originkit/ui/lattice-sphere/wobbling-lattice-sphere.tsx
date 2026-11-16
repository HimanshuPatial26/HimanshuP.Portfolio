/* eslint-disable */
// Wobbling Lattice Sphere — Originkit

// Delivered by Originkit · stack: nextjs
"use client";

import * as React from "react"
/** Tuning values. Stripped at publish; the tuned values are baked in here. */
const ADVANCED_DEFAULTS = {
    cycleMs: 3200,
    sweepStart: 235,
    cubeHold: 65,
    perspective: 400,
    depthFade: 30,
    edgeOpacity: 55,
    lineWidth: 1,
    nodeSize: 3,
    nodeColor: "#FFFFFF",
    innerRatio: 48,
    innerDivisions: 5,
    innerOpacity: 55,
    rimWidth: 3,
    rimOpacity: 90,
    coreGlow: 18,
    cloudCount: 320,
    cloudInner: 108,
    cloudOuter: 200,
    cloudSpacing: 26,
    cloudOpacity: 80,
    rayLength: 210,
    rayOpacity: 35,
    haloWidth: 14,
    haloLobes: 9,
    haloRipple: 5,
    haloOpacity: 30,
    haloColor: "#6A6A6A",
    gridGap: 24,
    gridDot: 2,
    gridColor: "#6A6A6A",
    gridOpacity: 70,
    bandOpacity: 4,
    grain: 10,
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

const NB = 6
const CLOUD_SEED = 7

type Geo = {
    pts: Float32Array
    edges: Uint32Array
    n: number
    sx: Float32Array
    sy: Float32Array
    sz: Float32Array
    sp: Float32Array
    extra?: Float32Array
}

type Lat = Geo & { sph: Float32Array }

function clamp(v: number, a: number, b: number) {
    return v < a ? a : v > b ? b : v
}

function smooth(x: number) {
    const v = clamp(x, 0, 1)
    return v * v * (3 - 2 * v)
}

function norm3(x: number, y: number, z: number) {
    const l = Math.hypot(x, y, z) || 1
    return [x / l, y / l, z / l]
}

function parseColor(c: any, fb: number[] = [255, 255, 255]): number[] {
    if (typeof c !== "string") return fb
    const s = c.trim()
    if (s[0] === "#") {
        let h = s.slice(1)
        if (h.length === 3 || h.length === 4)
            h = h
                .split("")
                .map((x) => x + x)
                .join("")
        const n = parseInt(h.slice(0, 6), 16)
        if (isNaN(n)) return fb
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    }
    const m = s.match(/rgba?\(([^)]+)\)/)
    if (m) {
        const p = m[1]
            .split(/[ ,/]+/)
            .filter(Boolean)
            .map(parseFloat)
        return [p[0] || 0, p[1] || 0, p[2] || 0]
    }
    return fb
}

function rgba(c: number[], a: number) {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${clamp(a, 0, 1)})`
}

function mulberry32(seed: number) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// row-major 3x3
function mulM(A: number[], B: number[]) {
    const r = new Array(9).fill(0)
    for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++)
            r[i * 3 + j] =
                A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]
    return r
}

function mulV(M: number[], v: number[]) {
    return [
        M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
        M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
        M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
    ]
}

function rotX(t: number) {
    const c = Math.cos(t),
        s = Math.sin(t)
    return [1, 0, 0, 0, c, -s, 0, s, c]
}

function rotY(t: number) {
    const c = Math.cos(t),
        s = Math.sin(t)
    return [c, 0, s, 0, 1, 0, -s, 0, c]
}

function rotZ(t: number) {
    const c = Math.cos(t),
        s = Math.sin(t)
    return [c, -s, 0, s, c, 0, 0, 0, 1]
}

// minimal rotation taking unit a onto unit b
function rotTo(a: number[], b: number[]) {
    const vx = a[1] * b[2] - a[2] * b[1]
    const vy = a[2] * b[0] - a[0] * b[2]
    const vz = a[0] * b[1] - a[1] * b[0]
    const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    if (c < -0.9999) return [1, 0, 0, 0, -1, 0, 0, 0, -1]
    const k = 1 / (1 + c)
    return [
        vx * vx * k + c,
        vx * vy * k - vz,
        vx * vz * k + vy,
        vy * vx * k + vz,
        vy * vy * k + c,
        vy * vz * k - vx,
        vz * vx * k - vy,
        vz * vy * k + vx,
        vz * vz * k + c,
    ]
}

// quaternions [w, x, y, z] for the drag turn
function qAxis(x: number, y: number, z: number, a: number) {
    const s = Math.sin(a / 2)
    return [Math.cos(a / 2), x * s, y * s, z * s]
}

function qMul(a: number[], b: number[]) {
    return [
        a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
        a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
        a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
        a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
    ]
}

function qNorm(q: number[]) {
    const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
    return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

function qMat(q: number[]) {
    const [w, x, y, z] = q
    return [
        1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
        2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
        2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y),
    ]
}

// pole → +z (toward the viewer), seam → straight down on screen
function orient(pole: number[], seam: number[], spinDeg: number) {
    const R0 = rotTo(norm3(pole[0], pole[1], pole[2]), [0, 0, 1])
    const s = mulV(R0, seam)
    const ang = Math.PI / 2 - Math.atan2(s[1], s[0])
    return mulM(rotZ(ang + (spinDeg * Math.PI) / 180), R0)
}

// cube corner faces the camera, its three edges run up, lower-left, lower-right
const BASE = orient([1, 1, 1], [0, 0, 1], 0)

function makeGeo(pts: number[], edges: number[], extra?: number[]): Geo {
    const n = pts.length / 3
    return {
        pts: new Float32Array(pts),
        edges: new Uint32Array(edges),
        n,
        sx: new Float32Array(n),
        sy: new Float32Array(n),
        sz: new Float32Array(n),
        sp: new Float32Array(n),
        extra: extra ? new Float32Array(extra) : undefined,
    }
}

function applyMat(pts: number[], M: number[]) {
    for (let i = 0; i < pts.length; i += 3) {
        const v = mulV(M, [pts[i], pts[i + 1], pts[i + 2]])
        pts[i] = v[0]
        pts[i + 1] = v[1]
        pts[i + 2] = v[2]
    }
}

// cube surface grid (corners on the unit sphere) plus the same points pushed onto the sphere
function buildLattice(d: number): Lat {
    const pts: number[] = []
    const edges: number[] = []
    const vmap = new Map<string, number>()
    const co = (i: number) => (-1 + (2 * i) / d) / Math.sqrt(3)
    const vid = (c: number[]) => {
        const k = c.join(",")
        let i = vmap.get(k)
        if (i === undefined) {
            i = pts.length / 3
            pts.push(co(c[0]), co(c[1]), co(c[2]))
            vmap.set(k, i)
        }
        return i
    }
    for (let ax = 0; ax < 3; ax++) {
        const bx = (ax + 1) % 3,
            cx = (ax + 2) % 3
        for (let i = 0; i <= d; i++)
            for (let j = 0; j <= d; j++) {
                if (!(i === 0 || i === d || j === 0 || j === d)) continue
                for (let s = 0; s < d; s++) {
                    const c1 = [0, 0, 0],
                        c2 = [0, 0, 0]
                    c1[ax] = s
                    c2[ax] = s + 1
                    c1[bx] = c2[bx] = i
                    c1[cx] = c2[cx] = j
                    edges.push(vid(c1), vid(c2))
                }
            }
    }
    applyMat(pts, BASE)
    const g = makeGeo(pts, edges) as Lat
    const sph = new Float32Array(pts.length)
    for (let i = 0; i < pts.length; i += 3) {
        const v = norm3(pts[i], pts[i + 1], pts[i + 2])
        sph[i] = v[0]
        sph[i + 1] = v[1]
        sph[i + 2] = v[2]
    }
    g.sph = sph
    return g
}

function buildCloud(count: number, ri: number, ro: number, spacing: number, seed: number): Geo {
    const rng = mulberry32(seed * 9973 + 17)
    const sp = Math.max(0.08, spacing)
    const m = Math.ceil(ro / sp)
    const cands: number[][] = []
    for (let i = -m; i <= m; i++)
        for (let j = -m; j <= m; j++)
            for (let k = -m; k <= m; k++) {
                const x = i * sp + (rng() - 0.5) * sp * 0.15
                const y = j * sp + (rng() - 0.5) * sp * 0.15
                const z = k * sp + (rng() - 0.5) * sp * 0.15
                const r = Math.hypot(x, y, z)
                if (r < ri || r > ro) continue
                cands.push([x, y, z, (r - ri) / (ro - ri) + rng() * 0.9, 0.55 + 0.45 * rng()])
            }
    cands.sort((a, b) => a[3] - b[3])
    const pts: number[] = []
    const extra: number[] = []
    for (let i = 0; i < Math.min(count, cands.length); i++) {
        pts.push(cands[i][0], cands[i][1], cands[i][2])
        extra.push(cands[i][4])
    }
    applyMat(pts, BASE)
    return makeGeo(pts, [], extra)
}

function project(g: Geo, scale: number, M: number[], f: number, cx: number, cy: number, R: number, zNorm: number) {
    const { pts, n, sx, sy, sz, sp } = g
    for (let i = 0; i < n; i++) {
        const x = pts[i * 3] * scale,
            y = pts[i * 3 + 1] * scale,
            z = pts[i * 3 + 2] * scale
        const X = M[0] * x + M[1] * y + M[2] * z
        const Y = M[3] * x + M[4] * y + M[5] * z
        const Z = M[6] * x + M[7] * y + M[8] * z
        const p = f / Math.max(0.2, f - Z)
        sx[i] = cx + X * R * p
        sy[i] = cy + Y * R * p
        sz[i] = Z / zNorm
        sp[i] = p
    }
}

// how far toward the sphere a point is: a sector round the view axis goes first, then the rest
function morphAt(a: number, s: number, hold: number) {
    return smooth((a - hold + (hold + 0.1) * s) / 0.35)
}

// mix cube → sphere per point (fixedM < 0: by screen angle against the sweep), rotate, project
function placeLattice(
    g: Lat,
    scale: number,
    M: number[],
    f: number,
    ox: number,
    oy: number,
    R: number,
    s: number,
    hold: number,
    c0: number,
    s0: number,
    fixedM: number,
    waves: number[],
    lit: Float32Array | null
) {
    const { pts, sph, n, sx, sy, sz, sp } = g
    for (let i = 0; i < n; i++) {
        const a3 = i * 3
        const px = pts[a3],
            py = pts[a3 + 1],
            pz = pts[a3 + 2]
        const qx = sph[a3],
            qy = sph[a3 + 1],
            qz = sph[a3 + 2]
        const CX = M[0] * px + M[1] * py + M[2] * pz
        const CY = M[3] * px + M[4] * py + M[5] * pz
        const CZ = M[6] * px + M[7] * py + M[8] * pz
        const QX = M[0] * qx + M[1] * qy + M[2] * qz
        const QY = M[3] * qx + M[4] * qy + M[5] * qz
        const QZ = M[6] * qx + M[7] * qy + M[8] * qz
        let m = fixedM
        if (m < 0) {
            const rr = Math.hypot(QX, QY)
            const a = rr > 1e-4 ? 0.5 + (0.5 * (QX * c0 + QY * s0)) / rr : 0.5
            m = morphAt(a, s, hold)
        }
        // tap ripples: a crest (with a trough behind it) runs over the surface from the tapped point
        let k = 1,
            glow = 0
        for (let wI = 0; wI < waves.length; wI += 5) {
            const d = clamp(qx * waves[wI] + qy * waves[wI + 1] + qz * waves[wI + 2], -1, 1)
            const x = (Math.acos(d) - waves[wI + 3]) / 0.35
            const env = Math.exp(-x * x) * waves[wI + 4]
            k += 0.16 * env * Math.cos(x * 2.2)
            glow += env
        }
        if (lit) lit[i] = glow
        const X = (CX + (QX - CX) * m) * scale * k
        const Y = (CY + (QY - CY) * m) * scale * k
        const Z = (CZ + (QZ - CZ) * m) * scale * k
        const p = f / Math.max(0.2, f - Z)
        sx[i] = ox + X * R * p
        sy[i] = oy + Y * R * p
        sz[i] = Z / scale
        sp[i] = p
    }
}

function strokeBuckets(ctx: CanvasRenderingContext2D, g: Geo, col: number[], alpha: number, fade: number, lw: number) {
    if (alpha <= 0 || g.edges.length === 0) return
    const paths: Path2D[] = []
    for (let b = 0; b < NB; b++) paths.push(new Path2D())
    const { edges, sx, sy, sz } = g
    for (let e = 0; e < edges.length; e += 2) {
        const i = edges[e],
            j = edges[e + 1]
        const fz = clamp(((sz[i] + sz[j]) * 0.5 + 1) * 0.5, 0, 1)
        const b = Math.min(NB - 1, Math.floor(fz * NB))
        paths[b].moveTo(sx[i], sy[i])
        paths[b].lineTo(sx[j], sy[j])
    }
    ctx.lineWidth = lw
    for (let b = 0; b < NB; b++) {
        ctx.strokeStyle = rgba(col, alpha * (fade + ((1 - fade) * (b + 0.5)) / NB))
        ctx.stroke(paths[b])
    }
}

function dotBuckets(ctx: CanvasRenderingContext2D, g: Geo, col: number[], alpha: number, fade: number, r: number) {
    if (alpha <= 0 || r <= 0) return
    const paths: Path2D[] = []
    for (let b = 0; b < NB; b++) paths.push(new Path2D())
    const { n, sx, sy, sz, sp, extra } = g
    for (let i = 0; i < n; i++) {
        const fz = clamp((sz[i] + 1) * 0.5, 0, 1)
        const br = extra ? extra[i] : 1
        const b = Math.min(NB - 1, Math.floor(clamp(fz * br, 0, 0.999) * NB))
        const rad = r * sp[i] * (0.75 + 0.35 * fz)
        paths[b].moveTo(sx[i] + rad, sy[i])
        paths[b].arc(sx[i], sy[i], rad, 0, Math.PI * 2)
    }
    for (let b = 0; b < NB; b++) {
        ctx.fillStyle = rgba(col, alpha * (fade + ((1 - fade) * (b + 0.5)) / NB))
        ctx.fill(paths[b])
    }
}

// edges and nodes the tap ripple is crossing, lit brighter and thicker
function drawLit(ctx: CanvasRenderingContext2D, g: Geo, lit: Float32Array, col: number[], r: number, lw: number) {
    const lines = [new Path2D(), new Path2D(), new Path2D()]
    const dots = [new Path2D(), new Path2D(), new Path2D()]
    const { edges, n, sx, sy, sz, sp } = g
    const level = (l: number) => Math.min(2, Math.floor(clamp(l, 0, 0.999) * 3))
    let any = false
    for (let e = 0; e < edges.length; e += 2) {
        const i = edges[e],
            j = edges[e + 1]
        const fz = clamp(((sz[i] + sz[j]) * 0.5 + 1) * 0.5, 0, 1)
        const l = ((lit[i] + lit[j]) / 2) * (0.35 + 0.65 * fz)
        if (l < 0.08) continue
        any = true
        const b = level(l)
        lines[b].moveTo(sx[i], sy[i])
        lines[b].lineTo(sx[j], sy[j])
    }
    if (!any) return
    for (let i = 0; i < n; i++) {
        const fz = clamp((sz[i] + 1) * 0.5, 0, 1)
        const l = lit[i] * (0.35 + 0.65 * fz)
        if (l < 0.08) continue
        const b = level(l)
        const rad = r * sp[i] * (1 + 1.6 * clamp(l, 0, 1)) + 0.5
        dots[b].moveTo(sx[i] + rad, sy[i])
        dots[b].arc(sx[i], sy[i], rad, 0, Math.PI * 2)
    }
    ctx.lineWidth = lw * 1.6
    for (let b = 0; b < 3; b++) {
        const a = (b + 0.5) / 3
        ctx.strokeStyle = rgba(col, a * 0.9)
        ctx.stroke(lines[b])
        ctx.fillStyle = rgba(col, a)
        ctx.fill(dots[b])
    }
}

// thick beaded rim on the side that has turned into a sphere
function drawRim(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: number[], alpha: number, width: number, phi0: number, s: number) {
    if (alpha <= 0 || width <= 0) return
    const N = 90
    const step = (Math.PI * 2) / N
    ctx.lineWidth = width * 0.6
    for (let k = 0; k < N; k++) {
        const t = k * step
        const a = 0.5 + 0.5 * Math.cos(t + step / 2 - phi0)
        const wgt = smooth((a - 0.5) / 0.45)
        if (wgt < 0.02) continue
        const al = alpha * wgt * (0.55 + 0.45 * s)
        ctx.strokeStyle = rgba(col, al)
        ctx.beginPath()
        ctx.arc(cx, cy, r, t, t + step + 0.004)
        ctx.stroke()
        if (k % 3 === 0) {
            ctx.fillStyle = rgba(col, al)
            ctx.beginPath()
            ctx.arc(cx + Math.cos(t) * r, cy + Math.sin(t) * r, width * 0.55, 0, Math.PI * 2)
            ctx.fill()
        }
    }
}

// grey smoky ripple outside the rim, strongest on the swept side
function drawHalo(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, R: number, adv: any, phi0: number, drift: number) {
    const op = adv.haloOpacity / 100
    if (op <= 0) return
    const col = parseColor(adv.haloColor, [106, 106, 106])
    const N = 72
    const lobes = Math.max(1, Math.round(adv.haloLobes))
    const rip = (R * adv.haloRipple) / 100
    const width = (R * adv.haloWidth) / 100
    ctx.lineWidth = 3
    for (let j = 0; j < 3; j++) {
        const base = r + width * (0.2 + 0.4 * j)
        const rad = (t: number) => base + rip * Math.sin(lobes * t + drift * (1 + j * 0.3) + j * 2)
        for (let k = 0; k < N; k++) {
            const t0 = (k / N) * Math.PI * 2,
                t1 = ((k + 1) / N) * Math.PI * 2
            const a = 0.5 + 0.5 * Math.cos((t0 + t1) / 2 - phi0)
            const wgt = 0.2 + 0.8 * a * a
            const r0 = rad(t0),
                r1 = rad(t1)
            ctx.strokeStyle = rgba(col, op * wgt * (1 - j * 0.25))
            ctx.beginPath()
            ctx.moveTo(cx + Math.cos(t0) * r0, cy + Math.sin(t0) * r0)
            ctx.lineTo(cx + Math.cos(t1) * r1, cy + Math.sin(t1) * r1)
            ctx.stroke()
        }
    }
}

function buildStatic(w: number, h: number, dpr: number, R: number, cx: number, cy: number, showGrid: boolean, showRays: boolean, rayCount: number, adv: any) {
    const c = document.createElement("canvas")
    c.width = Math.max(1, Math.round(w * dpr))
    c.height = Math.max(1, Math.round(h * dpr))
    const g = c.getContext("2d")
    if (!g) return c
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const band = adv.bandOpacity / 100
    if (band > 0) {
        const gr = g.createLinearGradient(0, 0, w, 0)
        const st: [number, number][] = [
            [0, 0], [0.12, 0], [0.185, band], [0.25, 0],
            [0.73, 0], [0.79, band], [0.85, 0], [1, 0],
        ]
        for (const [o, a] of st) gr.addColorStop(o, `rgba(255,255,255,${a})`)
        g.fillStyle = gr
        g.fillRect(0, 0, w, h)
    }
    if (showGrid && adv.gridOpacity > 0) {
        const gap = Math.max(4, adv.gridGap)
        const dot = Math.max(1, adv.gridDot)
        const base = adv.gridOpacity / 100
        g.fillStyle = rgba(parseColor(adv.gridColor, [106, 106, 106]), 1)
        const x0 = cx - Math.ceil(cx / gap) * gap
        const y0 = cy - Math.ceil(cy / gap) * gap
        for (let x = x0; x <= w; x += gap)
            for (let y = y0; y <= h; y += gap) {
                const d = Math.hypot(x - cx, y - cy) / (R * 2.2)
                g.globalAlpha = Math.min(1, base * (1 + 0.5 * Math.exp(-d * d)))
                g.fillRect(Math.round(x - dot / 2), Math.round(y - dot / 2), dot, dot)
            }
        g.globalAlpha = 1
    }
    if (showRays && adv.rayOpacity > 0 && rayCount > 0) {
        const r0 = R * 1.04
        const r1 = R * Math.max(1.1, adv.rayLength / 100)
        g.strokeStyle = `rgba(200,200,200,${adv.rayOpacity / 100})`
        g.lineWidth = 1
        g.setLineDash([1.5, 4])
        g.beginPath()
        // evenly spaced dashed lines, one straight down; 6 gives the reference's set
        for (let k = 0; k < rayCount; k++) {
            const t = Math.PI / 2 + (k * Math.PI * 2) / rayCount
            const r = r1 * (1 + 0.075 * Math.sin(t))
            g.moveTo(cx + Math.cos(t) * r0, cy + Math.sin(t) * r0)
            g.lineTo(cx + Math.cos(t) * r, cy + Math.sin(t) * r)
        }
        g.stroke()
        g.setLineDash([])
    }
    return c
}

/**
 * Wobbling Lattice Sphere
 *
 * @framerIntrinsicWidth 1200
 * @framerIntrinsicHeight 800
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 */
function __OriginkitBase_WobblingLatticeSphere(props: any) {
    props = withMovedControls(props)
    const {
        background = "#000000",
        baseColor = "#D9D9D9",
        speed = 50,
        size = 100,
        wobble = 20,
        detail = 8,
        showGrid = false,
        showRays = false,
        rayCount = 1,
        style,
    } = props

    const rootRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const live = React.useRef<any>({})
    live.current = { baseColor, speed, size, wobble, detail, showGrid, showRays, rayCount, advanced: props.advanced }

    const pointer = React.useRef({
        x: 0, y: 0, tx: 0, ty: 0, over: 0, inside: false, down: 0, pressed: false, seeded: false,
        dragging: false, lx: 0, ly: 0, ddx: 0, ddy: 0, vx: 0, vy: 0, idle: 0,
        travel: 0, downAt: 0, taps: 0, downX: 0, downY: 0, tapX: 0, tapY: 0,
    })

    React.useEffect(() => {
        const root = rootRef.current
        const canvas = canvasRef.current
        if (!root || !canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) return

        let w = 0,
            h = 0,
            dpr = 1
        const resize = () => {
            w = root.offsetWidth
            h = root.offsetHeight
            dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.max(1, Math.round(w * dpr))
            canvas.height = Math.max(1, Math.round(h * dpr))
            const P = pointer.current
            if (!P.seeded) {
                P.x = P.tx = w / 2
                P.y = P.ty = h / 2
                P.seeded = true
            }
        }
        resize()
        const ro = new ResizeObserver(resize)
        ro.observe(root)

        const mq = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null
        let reduced = !!(mq && mq.matches)
        const onMq = () => {
            reduced = !!(mq && mq.matches)
        }
        mq?.addEventListener?.("change", onMq)

        const onEnter = () => {
            pointer.current.inside = true
        }
        const onMove = (e: PointerEvent) => {
            const P = pointer.current
            P.inside = true
            P.tx = e.offsetX
            P.ty = e.offsetY
        }
        const onLeave = () => {
            const P = pointer.current
            P.inside = false
            P.tx = w / 2
            P.ty = h / 2
        }
        const onDown = (e: PointerEvent) => {
            const P = pointer.current
            P.pressed = true
            P.dragging = true
            P.lx = e.clientX
            P.ly = e.clientY
            P.vx = P.vy = 0
            P.travel = 0
            P.downAt = performance.now()
            P.downX = e.offsetX
            P.downY = e.offsetY
        }
        const onDrag = (e: PointerEvent) => {
            const P = pointer.current
            if (!P.dragging) return
            P.ddx += e.clientX - P.lx
            P.ddy += e.clientY - P.ly
            P.travel += Math.abs(e.clientX - P.lx) + Math.abs(e.clientY - P.ly)
            P.lx = e.clientX
            P.ly = e.clientY
        }
        const up = () => {
            const P = pointer.current
            // a press that barely moved and let go quickly is a tap, not a drag
            if (P.dragging && P.travel < 6 && performance.now() - P.downAt < 350) {
                P.taps++
                P.tapX = P.downX
                P.tapY = P.downY
            }
            P.pressed = false
            P.dragging = false
        }
        root.addEventListener("pointerenter", onEnter)
        root.addEventListener("pointermove", onMove)
        root.addEventListener("pointerleave", onLeave)
        root.addEventListener("pointerdown", onDown)
        window.addEventListener("pointermove", onDrag)
        window.addEventListener("pointerup", up)
        window.addEventListener("pointercancel", up)

        // film grain tile, made once
        const noise = document.createElement("canvas")
        noise.width = noise.height = 128
        const nctx = noise.getContext("2d")
        if (nctx) {
            const img = nctx.createImageData(128, 128)
            for (let i = 0; i < img.data.length; i += 4) {
                const v = (Math.random() * 255) | 0
                img.data[i] = img.data[i + 1] = img.data[i + 2] = v
                img.data[i + 3] = 255
            }
            nctx.putImageData(img, 0, 0)
        }
        const noisePat = ctx.createPattern(noise, "repeat")

        let geoKey = ""
        let geo: { outer: Lat; inner: Lat; cloud: Geo } | null = null
        let staticKey = ""
        let staticLayer: HTMLCanvasElement | null = null

        let raf = 0
        let last = -1
        let phase = 0
        // drag turn, in screen space: identity = the reference's resting view
        let Q = [1, 0, 0, 0]
        const turn = (ax: number, ay: number) => {
            if (ax === 0 && ay === 0) return
            Q = qNorm(qMul(qMul(qAxis(0, 1, 0, ax), qAxis(1, 0, 0, -ay)), Q))
        }
        // tap ripples: direction on the lattice (object space), age in s, strength
        const waves: { dir: number[]; age: number; amp: number }[] = []
        let litArr = new Float32Array(0)

        const tick = (now: number) => {
            raf = requestAnimationFrame(tick)
            const dt = last < 0 ? 0 : Math.min((now - last) / 1000, 1 / 20)
            last = now
            if (w <= 0 || h <= 0) return

            const L = live.current
            const adv = { ...ADVANCED_DEFAULTS, ...(L.advanced ?? {}) }
            const hk = Math.max(0, adv.hover / 50)

            const P = pointer.current
            const ease = 1 - Math.exp(-dt * 6)
            P.over += ((P.inside ? 1 : 0) - P.over) * ease
            P.down += ((P.pressed ? 1 : 0) - P.down) * ease
            P.x += (P.tx - P.x) * ease
            P.y += (P.ty - P.y) * ease

            // drag turns the lattice freely (every side), flings on release,
            // then eases back to the resting view after a pause
            const spinK = 0.009 * hk
            if (P.dragging) {
                const ax = P.ddx * spinK,
                    ay = P.ddy * spinK
                P.ddx = P.ddy = 0
                if (dt > 0) {
                    P.vx += (ax / dt - P.vx) * 0.5
                    P.vy += (ay / dt - P.vy) * 0.5
                }
                turn(ax, ay)
                P.idle = 0
            } else {
                P.ddx = P.ddy = 0
                const k = Math.exp(-dt * 2.5)
                P.vx *= k
                P.vy *= k
                turn(P.vx * dt, P.vy * dt)
                P.idle += dt
                if (P.idle > 1.5 && Math.hypot(P.vx, P.vy) < 0.3) {
                    if (Q[0] < 0) Q = [-Q[0], -Q[1], -Q[2], -Q[3]]
                    const e = 1 - Math.exp(-dt * 1.5)
                    Q = qNorm([Q[0] + (1 - Q[0]) * e, Q[1] * (1 - e), Q[2] * (1 - e), Q[3] * (1 - e)])
                }
            }

            const rate = (clamp(L.speed, 0, 100) / 50) * (reduced ? 0.3 : 1)
            phase += (dt * rate * 1000) / Math.max(300, adv.cycleMs)
            const u = phase - Math.floor(phase)
            const s = 0.5 - 0.5 * Math.cos(u * Math.PI * 2)
            const phi0 = (adv.sweepStart * Math.PI) / 180 + u * Math.PI * 2

            const div = Math.round(clamp(L.detail, 2, 14))
            const idiv = Math.round(clamp(adv.innerDivisions, 2, 10))
            const gk = [div, idiv, adv.cloudCount, adv.cloudInner, adv.cloudOuter, adv.cloudSpacing].join("|")
            if (gk !== geoKey || !geo) {
                geo = {
                    outer: buildLattice(div),
                    inner: buildLattice(idiv),
                    cloud: buildCloud(
                        Math.max(0, Math.round(adv.cloudCount)),
                        adv.cloudInner / 100,
                        Math.max(adv.cloudInner + 1, adv.cloudOuter) / 100,
                        adv.cloudSpacing / 100,
                        CLOUD_SEED
                    ),
                }
                geoKey = gk
            }

            const R = Math.min(w, h) * 0.19 * (clamp(L.size, 10, 400) / 100)
            const cx = w / 2,
                cy = h / 2

            const sk = [
                w, h, dpr, R.toFixed(1), L.showGrid ? 1 : 0, adv.bandOpacity, adv.gridGap, adv.gridDot,
                adv.gridColor, adv.gridOpacity, adv.rayLength, adv.rayOpacity,
                L.showRays ? 1 : 0, L.rayCount,
            ].join("|")
            if (sk !== staticKey || !staticLayer) {
                const rc = Math.round(clamp(L.rayCount, 1, 36))
                staticLayer = buildStatic(w, h, dpr, R, cx, cy, !!L.showGrid, !!L.showRays, rc, adv)
                staticKey = sk
            }

            // wobble about the view, plus a lean toward the pointer
            const amp = (clamp(L.wobble, 0, 100) * 0.4 * Math.PI) / 180
            const ang = u * Math.PI * 2
            const px = clamp((P.x - cx) / (w / 2), -1, 1)
            const py = clamp((P.y - cy) / (h / 2), -1, 1)
            const pk = 0.35 * hk * P.over
            const M = mulM(qMat(Q), mulM(rotY(amp * Math.cos(ang + 0.5) + px * pk), rotX(amp * 0.5 * Math.sin(ang) - py * pk)))

            // tap: find the point on the lattice under the finger and start a ripple there
            if (P.taps > 0) {
                P.taps = 0
                if (hk > 0) {
                    const dx = (P.tapX - cx) / (R * 1.03),
                        dy = (P.tapY - cy) / (R * 1.03)
                    const d2 = dx * dx + dy * dy
                    const v = d2 < 1 ? [dx, dy, Math.sqrt(1 - d2)] : norm3(dx, dy, 0)
                    const o = norm3(
                        M[0] * v[0] + M[3] * v[1] + M[6] * v[2],
                        M[1] * v[0] + M[4] * v[1] + M[7] * v[2],
                        M[2] * v[0] + M[5] * v[1] + M[8] * v[2]
                    )
                    waves.push({ dir: o, age: 0, amp: Math.min(hk, 2) })
                    if (waves.length > 5) waves.shift()
                }
            }
            // crest travels half way round (to the far side) in 1.1 s and dies out by 1.8 s
            const wl: number[] = []
            for (let i = waves.length - 1; i >= 0; i--) {
                const wv = waves[i]
                wv.age += dt
                if (wv.age > 1.8) {
                    waves.splice(i, 1)
                    continue
                }
                const life = 1 - wv.age / 1.8
                wl.push(wv.dir[0], wv.dir[1], wv.dir[2], (wv.age * Math.PI) / 1.1, wv.amp * life * Math.sqrt(life) * smooth(wv.age / 0.08))
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, w, h)
            if (staticLayer) ctx.drawImage(staticLayer, 0, 0, w, h)

            const col = parseColor(L.baseColor, [217, 217, 217])
            const ncol = parseColor(adv.nodeColor, [255, 255, 255])
            const f = Math.max(1.5, adv.perspective / 100)
            const fade = clamp(adv.depthFade / 100, 0, 1)
            const hold = clamp(adv.cubeHold / 100, 0, 1)
            const c0 = Math.cos(phi0),
                s0 = Math.sin(phi0)
            const sil = (rr: number) => (R * rr * f) / Math.sqrt(Math.max(0.01, f * f - rr * rr))

            drawHalo(ctx, cx, cy, sil(1), R, adv, phi0, phase * Math.PI * 2)

            project(geo.cloud, 1, M, f, cx, cy, R, Math.max(0.5, adv.cloudOuter / 100))
            dotBuckets(ctx, geo.cloud, ncol, adv.cloudOpacity / 100, fade, 1.1)

            if (adv.coreGlow > 0) {
                const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6)
                const ga = (adv.coreGlow / 100) * (1 - 0.7 * s)
                gl.addColorStop(0, rgba(ncol, ga))
                gl.addColorStop(1, rgba(ncol, 0))
                ctx.fillStyle = gl
                ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
            }

            const ir = clamp(adv.innerRatio / 100, 0.1, 0.95)
            const mi = smooth((s - 0.25) / 0.5)
            if (litArr.length !== geo.outer.n) litArr = new Float32Array(geo.outer.n)
            placeLattice(geo.outer, 1, M, f, cx, cy, R, s, hold, c0, s0, -1, wl, litArr)
            placeLattice(geo.inner, ir, M, f, cx, cy, R, s, hold, c0, s0, mi, wl, null)

            const lw = Math.max(0.5, adv.lineWidth)
            strokeBuckets(ctx, geo.inner, col, adv.innerOpacity / 100, fade, lw * 0.8)
            strokeBuckets(ctx, geo.outer, col, adv.edgeOpacity / 100, fade, lw)

            // the inner ring and the outer rim follow the Lattice colour, lifted a little toward white
            const ringCol = [col[0] + (255 - col[0]) * 0.2, col[1] + (255 - col[1]) * 0.2, col[2] + (255 - col[2]) * 0.2]
            if (mi > 0.01) {
                ctx.strokeStyle = rgba(ringCol, mi * Math.min(1, (adv.innerOpacity / 100) * 1.5))
                ctx.lineWidth = 1.6
                ctx.beginPath()
                ctx.arc(cx, cy, sil(ir), 0, Math.PI * 2)
                ctx.stroke()
            }

            const nr = Math.max(0, adv.nodeSize) * 0.5
            dotBuckets(ctx, geo.inner, ncol, (0.8 * adv.innerOpacity) / 55, fade, nr * 0.7)
            dotBuckets(ctx, geo.outer, ncol, 1, fade, nr)
            if (wl.length) drawLit(ctx, geo.outer, litArr, ncol, Math.max(1, nr), lw)

            drawRim(ctx, cx, cy, sil(1), ringCol, adv.rimOpacity / 100, Math.max(0, adv.rimWidth), phi0, s)


            if (adv.grain > 0 && noisePat) {
                ctx.save()
                ctx.globalAlpha = (adv.grain / 100) * 0.15
                ctx.translate(-((Math.random() * 128) | 0), -((Math.random() * 128) | 0))
                ctx.fillStyle = noisePat
                ctx.fillRect(0, 0, w + 128, h + 128)
                ctx.restore()
            }

            if (adv.vignette > 0) {
                const vg = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.3, cx, cy, Math.hypot(w, h) * 0.6)
                vg.addColorStop(0, "rgba(0,0,0,0)")
                vg.addColorStop(1, `rgba(0,0,0,${adv.vignette / 100})`)
                ctx.fillStyle = vg
                ctx.fillRect(0, 0, w, h)
            }
        }
        raf = requestAnimationFrame(tick)

        return () => {
            cancelAnimationFrame(raf)
            ro.disconnect()
            mq?.removeEventListener?.("change", onMq)
            root.removeEventListener("pointerenter", onEnter)
            root.removeEventListener("pointermove", onMove)
            root.removeEventListener("pointerleave", onLeave)
            root.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointermove", onDrag)
            window.removeEventListener("pointerup", up)
            window.removeEventListener("pointercancel", up)
        }
    }, [])

    return (
        <div
            ref={rootRef}
            style={{
                minWidth: 1200,
                minHeight: 800,
                ...style,
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background,
                touchAction: "none",
                cursor: "grab",
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }}
            />
        </div>
    )
}

const __originkitPresetProps = {
  "baseColor": "#0011FF",
  "advanced": {
    "grain": 10,
    "cycleMs": 3200,
    "gridDot": 2,
    "gridGap": 24,
    "coreGlow": 18,
    "cubeHold": 65,
    "nodeSize": 3,
    "rimWidth": 3,
    "vignette": 0,
    "depthFade": 30,
    "gridColor": "#6A6A6A",
    "haloColor": "#6A6A6A",
    "haloLobes": 9,
    "haloWidth": 14,
    "lineWidth": 1,
    "nodeColor": "#FFFFFF",
    "rayLength": 210,
    "cloudCount": 320,
    "cloudInner": 108,
    "cloudOuter": 200,
    "haloRipple": 5,
    "innerRatio": 48,
    "rayOpacity": 35,
    "rimOpacity": 90,
    "sweepStart": 235,
    "bandOpacity": 4,
    "edgeOpacity": 55,
    "gridOpacity": 70,
    "haloOpacity": 30,
    "perspective": 400,
    "cloudOpacity": 80,
    "cloudSpacing": 26,
    "floorOpacity": 12,
    "innerOpacity": 55,
    "innerDivisions": 5
  }
};

export default function WobblingLatticeSphere(props: Record<string, unknown>) {
  return <__OriginkitBase_WobblingLatticeSphere {...(__originkitPresetProps as Record<string, unknown>)} {...props} />;
}
