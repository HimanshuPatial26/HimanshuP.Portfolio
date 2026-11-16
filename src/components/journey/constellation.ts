/**
 * The Journey constellation, drawn on one canvas.
 *
 * Each milestone is a star on a chart in deep space, with its figures orbiting it as satellites on
 * tilted rings. `x` runs 0 … stops-1 (whole numbers rest on a star). In flight between two stars a
 * comet leads the camera, which pulls back to show the chart, rolls a little and dives in at the
 * next star; the background stars streak with the speed. Arriving sets off a shockwave, then the
 * lines out to the satellites draw one by one and their labels fade in. Hovering a satellite lights
 * it (and lists a toolkit group's skills). Glows are painted once as sprites and the background
 * stars are drawn in a few batches, so a frame stays cheap.
 */

export type Track = "ai" | "growth" | "study";
export type Satellite = { b: string; s: string; sub?: string[] };
export type ConStop = { year: string; short: string; track: Track; sats: Satellite[] };
export type ConFrame = {
  x: number;
  dt: number;
  now: number; // ms
  lean: { x: number; y: number }; // -0.5 … 0.5, the cursor's pull on the view
  hover: { x: number; y: number } | null; // in canvas pixels
  reduced: boolean;
};
export type ConOut = { at: number; settled: boolean; hit: boolean };

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (1 - Math.cos(Math.PI * clamp(t, 0, 1))) / 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** Where the stars sit on the chart (world units), up and down along the route. */
const CHART: [number, number][] = [
  [-1500, 330],
  [-720, -290],
  [120, 250],
  [920, -270],
  [1680, 150],
];

type Pal = { star: string; text: string; muted: string; faint: string; ai: string; growth: string; study: string; dark: boolean };

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

export function createConstellation(canvas: HTMLCanvasElement, stops: ConStop[]) {
  const g = canvas.getContext("2d")!;
  const N = stops.length;
  const STARS = CHART.slice(0, N);
  const SAT = stops.map((st, i) =>
    st.sats.map((s, k) => ({ ...s, r: 240 + (k % 2) * 85, a0: (k / st.sats.length) * TAU + 0.6, w: 0.045 + (k % 3) * 0.012, tilt: 0.62, rot: -0.3 + (i % 2) * 0.45 })),
  );
  const LAYERS = (
    [
      [320, 0.08, 0.9],
      [160, 0.2, 1.4],
      [70, 0.42, 2.1],
    ] as const
  ).map(([n, f, s]) => ({ f, s, stars: Array.from({ length: n }, () => ({ u: Math.random(), v: Math.random() })) }));
  const shooters: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  let nextShoot = 0;
  const arrived = stops.map(() => -1e9);
  const trail: [number, number][] = [];
  let W = 1;
  let H = 1;
  let dpr = 1;
  let lastCam: [number, number] | null = null;
  let pal: Pal | null = null;
  let fonts = { sans: "sans-serif", display: "sans-serif", mono: "monospace" };

  const readPal = (): Pal => {
    const dark = document.documentElement.dataset.theme !== "light";
    return dark
      ? { star: "255,255,255", text: "#f4f4f4", muted: "#a3a3a3", faint: "#6e6e6e", ai: "127,156,255", growth: "200,204,212", study: "163,163,163", dark }
      : { star: "10,10,10", text: "#0a0a0a", muted: "#3d3d3d", faint: "#5f5f5f", ai: "1,70,249", growth: "35,35,35", study: "95,95,95", dark };
  };
  const tint = (i: number) => pal![stops[i].track];

  // ---- painted once: the nebula clouds, and a soft glow per colour
  const neb = [document.createElement("canvas"), document.createElement("canvas")];
  const paintNebula = () => {
    const cols = pal!.dark ? ["58,109,255", "112,74,255", "36,150,220", "180,190,255"] : ["1,70,249", "90,60,220", "20,120,200", "120,140,200"];
    neb.forEach((c, li) => {
      c.width = 640;
      c.height = 360;
      const n = c.getContext("2d")!;
      n.clearRect(0, 0, 640, 360);
      for (let k = 0; k < 18; k++) {
        const x = rnd(0, 640);
        const y = rnd(60, 300);
        const r = rnd(50, 170);
        const gr = n.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(${cols[(k + li) % cols.length]},${(pal!.dark ? rnd(0.06, 0.16) : rnd(0.04, 0.09)).toFixed(3)})`);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        n.fillStyle = gr;
        n.beginPath();
        n.arc(x, y, r, 0, TAU);
        n.fill();
      }
    });
  };
  const sprites = new Map<string, HTMLCanvasElement>();
  const glowOf = (rgb: string) => {
    let c = sprites.get(rgb);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, `rgba(${rgb},1)`);
    gr.addColorStop(0.25, `rgba(${rgb},.45)`);
    gr.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, 128, 128);
    sprites.set(rgb, c);
    return c;
  };
  const stamp = (rgb: string, x: number, y: number, r: number, a: number) => {
    g.globalAlpha = a;
    g.drawImage(glowOf(rgb), x - r, y - r, r * 2, r * 2);
  };

  const theme = () => {
    pal = readPal();
    sprites.clear();
    paintNebula();
    fonts = { sans: fontVar("--font-geist-sans", "system-ui, sans-serif"), display: fontVar("--font-syne", "Arial, sans-serif"), mono: fontVar("--font-geist-mono", "ui-monospace, monospace") };
  };
  theme();

  const resize = (w: number, h: number) => {
    W = Math.max(1, w);
    H = Math.max(1, h);
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };

  const frame = (f: ConFrame): ConOut => {
    const C = pal!;
    const T = f.now / 1000;
    const dt = f.dt;
    const x = clamp(f.x, 0, N - 1);
    const narrow = W < 768;
    const k = Math.min(N - 2, Math.floor(x));
    const t = x - k;
    const e = ease(t);
    const arc = f.reduced ? 0 : Math.sin(Math.PI * t);
    // ---- the camera: pulls back mid-flight to show the chart, rolls a little, dives in at the next star
    const [ax, ay] = STARS[k];
    const [bx, by] = STARS[k + 1];
    const nx = -(by - ay);
    const ny = bx - ax;
    const nl = Math.hypot(nx, ny) || 1;
    const camX = lerp(ax, bx, e) + (nx / nl) * arc * 140;
    const camY = lerp(ay, by, e) + (ny / nl) * arc * 140;
    const base = narrow ? W / 760 : W / 1500;
    const zoom = base * lerp(1.18, 0.52, Math.pow(arc, 0.85));
    const roll = arc * 0.075 * (k % 2 ? 1 : -1);
    const lx = f.lean.x;
    const ly = f.lean.y;
    const OX = (narrow ? W * 0.5 : W * 0.355) - lx * 34;
    const OY = (narrow ? H * 0.33 : H * 0.52) - ly * 24;
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    const P = (wx: number, wy: number): [number, number] => {
      const dx = (wx - camX) * zoom;
      const dy = (wy - camY) * zoom;
      return [OX + dx * cr - dy * sr, OY + dx * sr + dy * cr];
    };
    // how fast the view slides (px/s): the streaks
    const cam: [number, number] = [camX * zoom, camY * zoom];
    const vx = lastCam ? (cam[0] - lastCam[0]) / Math.max(dt, 1e-3) : 0;
    const vy = lastCam ? (cam[1] - lastCam[1]) / Math.max(dt, 1e-3) : 0;
    lastCam = cam;
    const speed = f.reduced ? 0 : Math.hypot(vx, vy);
    const ls = narrow ? 0.82 : 1; // label scale

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // ---- deep space: nebula, then three depths of stars (in a few batches), streaking at speed
    // (the clouds are much bigger than the screen; only the slice on screen is drawn)
    neb.forEach((c, li) => {
      const fz = li ? 0.2 : 0.1;
      const w = W + 1400;
      const h = H + 800;
      const sx = (W - w) / 2 - camX * zoom * fz - lx * 20 * (li + 1) + (li ? 160 : -120);
      const sy = (H - h) / 2 - camY * zoom * fz - ly * 14 * (li + 1);
      const x0 = Math.max(0, sx);
      const y0 = Math.max(0, sy);
      const x1 = Math.min(W, sx + w);
      const y1 = Math.min(H, sy + h);
      if (x1 <= x0 || y1 <= y0) return;
      const kx = c.width / w;
      const ky = c.height / h;
      g.globalAlpha = 1;
      g.drawImage(c, (x0 - sx) * kx, (y0 - sy) * ky, (x1 - x0) * kx, (y1 - y0) * ky, x0, y0, x1 - x0, y1 - y0);
    });
    const starA = C.dark ? 0.85 : 0.35;
    const ux = speed ? vx / speed : 0;
    const uy = speed ? vy / speed : 0;
    LAYERS.forEach((L, li) => {
      const ox = -camX * zoom * L.f - lx * 60 * L.f;
      const oy = -camY * zoom * L.f - ly * 40 * L.f;
      const sl = Math.min(90, speed * L.f * 0.06);
      g.strokeStyle = g.fillStyle = `rgb(${C.star})`;
      g.lineWidth = L.s * 0.7;
      for (let b = 0; b < 4; b++) {
        const tw = f.reduced ? 0.7 : 0.35 + 0.65 * Math.abs(Math.sin(T * 0.9 + b * 1.7 + li));
        g.globalAlpha = starA * tw * (0.55 + b * 0.15);
        g.beginPath();
        for (let q = b; q < L.stars.length; q += 4) {
          const st = L.stars[q];
          let px = (st.u * W + ox) % W;
          if (px < 0) px += W;
          let py = (st.v * H + oy) % H;
          if (py < 0) py += H;
          if (sl > 2) {
            g.moveTo(px, py);
            g.lineTo(px - ux * sl, py - uy * sl);
          } else g.rect(px, py, L.s * 0.8, L.s * 0.8);
        }
        if (sl > 2) g.stroke();
        else g.fill();
      }
    });
    // the odd shooting star
    if (!f.reduced && T > nextShoot) {
      nextShoot = T + rnd(2.2, 5.5);
      shooters.push({ x: rnd(0.1, 0.9) * W, y: rnd(0.05, 0.4) * H, vx: rnd(-900, -500), vy: rnd(220, 420), life: 0 });
    }
    for (let i = shooters.length - 1; i >= 0; i--) {
      const s = shooters[i];
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const a = Math.max(0, 1 - s.life / 0.9);
      if (a <= 0) {
        shooters.splice(i, 1);
        continue;
      }
      const gr = g.createLinearGradient(s.x, s.y, s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      gr.addColorStop(0, `rgba(${C.star},${(0.9 * a).toFixed(3)})`);
      gr.addColorStop(1, `rgba(${C.star},0)`);
      g.globalAlpha = 1;
      g.strokeStyle = gr;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(s.x, s.y);
      g.lineTo(s.x - s.vx * 0.12, s.y - s.vy * 0.12);
      g.stroke();
    }
    // ---- a faint chart grid that turns with the camera
    g.globalAlpha = C.dark ? 0.07 : 0.1;
    g.strokeStyle = C.text;
    g.lineWidth = 1;
    g.beginPath();
    for (let gx = -2400; gx <= 2600; gx += 400) {
      const [x1, y1] = P(gx, -1400);
      const [x2, y2] = P(gx, 1400);
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    for (let gy = -1200; gy <= 1200; gy += 400) {
      const [x1, y1] = P(-2600, gy);
      const [x2, y2] = P(2800, gy);
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
    }
    g.stroke();
    // ---- the route: dashed ahead, lit behind
    for (let i = 0; i < N - 1; i++) {
      const [x1, y1] = P(...STARS[i]);
      const [x2, y2] = P(...STARS[i + 1]);
      g.globalAlpha = 0.4;
      g.strokeStyle = C.faint;
      g.lineWidth = 1.2;
      g.setLineDash([4, 7]);
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
      g.setLineDash([]);
      const lit = clamp(x - i, 0, 1);
      if (lit > 0) {
        const ex = lerp(x1, x2, i === k ? e : lit);
        const ey = lerp(y1, y2, i === k ? e : lit);
        const gr = g.createLinearGradient(x1, y1, ex, ey);
        gr.addColorStop(0, `rgba(${tint(i)},.9)`);
        gr.addColorStop(1, `rgba(${C.ai},1)`);
        g.globalAlpha = 1;
        g.strokeStyle = gr;
        g.lineWidth = 2.4;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(ex, ey);
        g.stroke();
      }
    }
    const at = Math.round(x);
    const settled = Math.abs(x - at) < 0.04;
    if (settled && arrived[at] < 0) arrived[at] = T;
    for (let i = 0; i < N; i++) if (Math.abs(x - i) > 0.6) arrived[i] = -1e9;

    // ---- satellites on their tilted orbits, brighter round the star you're at
    let hit = false;
    const orbit = f.reduced ? 0 : T;
    SAT.forEach((sats, i) => {
      const near = clamp(1 - Math.abs(x - i) * 1.5, 0, 1);
      const since = arrived[i] > 0 ? T - arrived[i] : 0;
      const [cx0, cy0] = P(...STARS[i]);
      if (near > 0.02) {
        g.globalAlpha = 0.16 * near;
        g.strokeStyle = `rgb(${tint(i)})`;
        g.lineWidth = 1;
        new Set(sats.map((s) => s.r)).forEach((r) => {
          g.beginPath();
          g.ellipse(cx0, cy0, r * zoom, r * zoom * sats[0].tilt, sats[0].rot + roll, 0, TAU);
          g.stroke();
        });
      }
      let hovered: (typeof sats)[number] | null = null;
      sats.forEach((s, j) => {
        const a = s.a0 + orbit * s.w;
        const ox = Math.cos(a) * s.r;
        const oy = Math.sin(a) * s.r * s.tilt;
        const rx = ox * Math.cos(s.rot) - oy * Math.sin(s.rot);
        const ry = ox * Math.sin(s.rot) + oy * Math.cos(s.rot);
        const [sx, sy] = P(STARS[i][0] + rx, STARS[i][1] + ry);
        const depth = 0.75 + 0.25 * Math.sin(a);
        // the line out to it draws on arrival, one satellite after another
        const draw = f.reduced ? near : near > 0.5 ? clamp((since - j * 0.16) / 0.55, 0, 1) : near;
        if (draw > 0) {
          g.globalAlpha = (0.2 + 0.55 * near) * depth;
          g.strokeStyle = `rgb(${tint(i)})`;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(cx0, cy0);
          g.lineTo(lerp(cx0, sx, draw), lerp(cy0, sy, draw));
          g.stroke();
        }
        const isHover = !!f.hover && near > 0.5 && Math.hypot(f.hover.x - sx, f.hover.y - sy) < 34;
        if (isHover) {
          hit = true;
          hovered = s;
        }
        const rr = (3 + 2.5 * near) * depth * (isHover ? 1.8 : 1);
        stamp(tint(i), sx, sy, rr * 4.5, (0.25 + 0.5 * near) * depth);
        g.globalAlpha = (0.3 + 0.7 * near) * depth;
        g.fillStyle = `rgb(${tint(i)})`;
        g.beginPath();
        g.arc(sx, sy, rr, 0, TAU);
        g.fill();
        // a toolkit group carries its skills as a tiny cluster
        if (s.sub && near > 0.05) {
          g.globalAlpha = near * 0.8;
          g.fillStyle = `rgb(${C.star})`;
          s.sub.forEach((_, q) => {
            const qa = a * 2.3 + (q / s.sub!.length) * TAU;
            g.fillRect(sx + Math.cos(qa) * 16 - 1, sy + Math.sin(qa) * 9 - 1, 2, 2);
          });
        }
        const lab = f.reduced ? near : near > 0.5 ? clamp((since - j * 0.16 - 0.35) / 0.4, 0, 1) : 0;
        if (lab > 0) {
          g.globalAlpha = lab * depth * (hovered && hovered !== s ? 0.45 : 1);
          g.textAlign = "center";
          g.fillStyle = C.text;
          g.font = `600 ${Math.round((isHover ? 21 : 18) * ls)}px ${fonts.display}`;
          g.fillText(s.b, sx, sy - 16 - (1 - lab) * 8);
          g.fillStyle = C.muted;
          g.font = `${Math.round(12 * ls)}px ${fonts.sans}`;
          g.fillText(s.s.length > 36 ? s.s.slice(0, 35) + "…" : s.s, sx, sy + 24);
          if (isHover && s.sub) {
            g.fillStyle = C.text;
            s.sub.forEach((name, q) => g.fillText(name, sx, sy + 44 + q * 16));
          }
        }
      });
    });

    // ---- the comet leading the camera, with its tail
    const hxw = lerp(ax, bx, e);
    const hyw = lerp(ay, by, e);
    trail.push([hxw, hyw]);
    if (trail.length > 28) trail.shift();
    if (arc > 0.02) {
      for (let q = 1; q < trail.length; q++) {
        const [x1, y1] = P(...trail[q - 1]);
        const [x2, y2] = P(...trail[q]);
        g.globalAlpha = (q / trail.length) * 0.8 * Math.min(1, arc * 4);
        g.strokeStyle = `rgb(${C.ai})`;
        g.lineWidth = 1 + (q / trail.length) * 5;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
      }
      const [hx, hy] = P(hxw, hyw);
      stamp(C.ai, hx, hy, 34, Math.min(1, arc * 4));
      stamp(C.star, hx, hy, 12, Math.min(1, arc * 4));
    }

    // ---- the milestone stars: glow, soft flare spikes, a shockwave on arrival, the core, the name
    STARS.forEach(([wx, wy], i) => {
      const [sx, sy] = P(wx, wy);
      const on = i === at && settled ? 1 : 0;
      const past = i <= x + 0.02;
      const since = arrived[i] > 0 ? T - arrived[i] : 99;
      const pulse = f.reduced ? 1 : 1 + 0.12 * Math.sin(T * 2.4 + i) + 0.35 * Math.max(0, 1 - since / 0.5);
      const R = (past ? 60 : 38) * pulse * Math.max(0.7, zoom * 1.1);
      stamp(past ? C.ai : tint(i), sx, sy, R * 1.2, past ? 0.75 : 0.35);
      const spike = R * (on ? 1.5 : past ? 1.05 : 0.7);
      g.strokeStyle = `rgb(${C.star})`;
      for (let q = 0; q < 2; q++) {
        const ang = (f.reduced ? 0 : T * 0.1) + i + Math.PI / 4 + (q * Math.PI) / 2;
        const len = spike * (q ? 0.62 : 1);
        const dx = Math.cos(ang) * len;
        const dy = Math.sin(ang) * len;
        for (const [lw, a] of [
          [5, past ? 0.08 : 0.04],
          [1, past ? 0.55 : 0.22],
        ]) {
          g.globalAlpha = a;
          g.lineWidth = lw;
          g.beginPath();
          g.moveTo(sx - dx, sy - dy);
          g.lineTo(sx + dx, sy + dy);
          g.stroke();
        }
      }
      if (!f.reduced && since < 1.6) {
        for (const d of [0, 0.25]) {
          const s2 = clamp((since - d) / 1.3, 0, 1);
          if (s2 <= 0) continue;
          g.globalAlpha = (1 - s2) * 0.7;
          g.strokeStyle = `rgb(${C.ai})`;
          g.lineWidth = 2 * (1 - s2) + 0.5;
          g.beginPath();
          g.arc(sx, sy, 20 + s2 * 380 * zoom, 0, TAU);
          g.stroke();
        }
      }
      g.globalAlpha = 1;
      g.fillStyle = past ? C.text : C.muted;
      g.beginPath();
      g.arc(sx, sy, 5 + 4 * on, 0, TAU);
      g.fill();
      const up = i % 2 ? -1 : 1;
      g.globalAlpha = past ? 1 : 0.55;
      g.textAlign = "center";
      g.fillStyle = past ? C.text : C.faint;
      g.font = `${Math.round(12 * ls)}px ${fonts.mono}`;
      // on a phone the orbits sit close, so the star you're at shows just its year (the readout and
      // the card name it)
      if (narrow && i === at) {
        g.fillText(stops[i].year.toUpperCase(), sx, sy - 22);
        return;
      }
      g.fillText(stops[i].year.toUpperCase(), sx, sy + up * 46 + (up < 0 ? 0 : 8));
      g.font = `600 ${Math.round((on ? 26 : 20) * ls)}px ${fonts.display}`;
      g.fillText(stops[i].short.toUpperCase(), sx, sy + up * 72 + (up < 0 ? 0 : 8));
    });

    // ---- the chart, small, bottom left (wide screens)
    if (!narrow) {
      const mw = 210;
      const mh = 110;
      const mx0 = 24;
      const my0 = H - mh - 26;
      g.globalAlpha = 1;
      g.fillStyle = C.dark ? "rgba(13,14,17,.82)" : "rgba(230,230,230,.85)";
      g.strokeStyle = C.dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.18)";
      g.beginPath();
      g.roundRect(mx0, my0, mw, mh, 12);
      g.fill();
      g.stroke();
      const MP = (wx: number, wy: number): [number, number] => [mx0 + 18 + ((wx + 1600) / 3400) * (mw - 36), my0 + 22 + ((wy + 340) / 720) * (mh - 44)];
      g.lineWidth = 1;
      for (let i = 0; i < N - 1; i++) {
        const [x1, y1] = MP(...STARS[i]);
        const [x2, y2] = MP(...STARS[i + 1]);
        g.globalAlpha = 0.5;
        g.strokeStyle = C.faint;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.stroke();
        const lit = clamp(x - i, 0, 1);
        if (lit > 0) {
          g.globalAlpha = 1;
          g.strokeStyle = `rgb(${C.ai})`;
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(lerp(x1, x2, lit), lerp(y1, y2, lit));
          g.stroke();
        }
      }
      STARS.forEach((s, i) => {
        const [a1, b1] = MP(...s);
        g.globalAlpha = 1;
        g.fillStyle = i <= x + 0.02 ? C.text : C.faint;
        g.beginPath();
        g.arc(a1, b1, i === at ? 3.5 : 2.2, 0, TAU);
        g.fill();
      });
      const [cmx, cmy] = MP(hxw, hyw);
      g.strokeStyle = `rgb(${C.ai})`;
      g.beginPath();
      g.arc(cmx, cmy, 6 + (f.reduced ? 0 : Math.sin(T * 4) * 1.5), 0, TAU);
      g.stroke();
      g.fillStyle = C.faint;
      g.font = `10px ${fonts.mono}`;
      g.textAlign = "left";
      g.fillText("CHART", mx0 + 12, my0 + 15);
    }
    g.globalAlpha = 1;
    return { at, settled, hit };
  };

  return { resize, theme, frame };
}

export type Constellation = ReturnType<typeof createConstellation>;
