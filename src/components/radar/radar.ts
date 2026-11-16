/**
 * The Selected Work radar, drawn on one 2D canvas.
 *
 * A holographic table tipped back in 3D: rings, ticks, bearings, an AI sector and a Growth sector,
 * and a sweep with a long phosphor tail. Each case stands on the table as a small post of light
 * that glows when the sweep passes. The table leans a little toward a fine pointer.
 *
 * It boots when asked (rings draw out, ticks run round, the sweep spins up, the posts check in one
 * by one with their labels typing in), and it locks on to the active case: the reticle closes in
 * three steps, a ring ripples out across the table and a dashed leader runs to the readout panel.
 * Hovering a post spins a wide reticle onto it, and the cursor's crosshair lies flat on the table.
 *
 * The page owns everything else (the panel, scrolling, which case is active); this file only draws
 * and reports which post is under the pointer and where each post's top is on screen.
 */

export type Tone = "ai" | "growth" | "both";
export type Blip = { bearing: number; range: number; tone: Tone; label: string };
export type Pointer = { x: number; y: number; inside: boolean; lean: boolean };
export type FrameIn = {
  now: number;
  dt: number;
  /** the locked case, or -1 before the first lock */
  active: number;
  /** when the current lock began (performance.now) */
  lockAt: number;
  /** where the leader ends: the readout panel's top-left corner, or null for no leader */
  anchor: { x: number; y: number } | null;
  reduced: boolean;
  pointer: Pointer;
  /** hold on the lock: the beam swings round onto the active case and stops there */
  hold: boolean;
};
/** `idle`: nothing is moving, so until something changes the next frame would look the same */
export type FrameOut = { hover: number; tops: [number, number][]; idle: boolean };

/** How long the boot runs before the first lock. */
export const BOOT_LOCK = 1250;
/** How long the lock takes to close in. */
export const LOCK_MS = 380;

const TAU = Math.PI * 2;
const SPEED = 1.25; // the sweep, in radians a second
const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

type Spring = { x: number; v: number; to: number; step(dt: number): number; snap(v: number): void };
/** A spring with a little overshoot: the snap in the reticle and the posts. */
function spring(k: number, c: number, x = 0): Spring {
  return {
    x,
    v: 0,
    to: x,
    step(dt) {
      const h = dt / 2;
      for (let i = 0; i < 2; i++) {
        this.v += (-k * (this.x - this.to) - c * this.v) * h;
        this.x += this.v * h;
      }
      return this.x;
    },
    snap(v) {
      this.x = this.to = v;
      this.v = 0;
    },
  };
}

/** Colours as "r,g,b" so alpha can be set per stroke. */
type Palette = {
  ring: string;
  rim: string;
  table: string;
  tableA: number;
  glow: string;
  glowA: number;
  ai: string;
  both: string;
  growth: string;
  text: string;
  beam: string;
  cursor: string;
  sectorAI: number;
  sectorGrowth: number;
};
const PALETTES: Record<"dark" | "light", Palette> = {
  dark: {
    ring: "140,165,255",
    rim: "150,175,255",
    table: "14,40,120",
    tableA: 0.16,
    glow: "1,60,200",
    glowA: 0.32,
    ai: "58,109,255",
    both: "127,156,255",
    growth: "205,209,217",
    text: "230,235,255",
    beam: "170,195,255",
    cursor: "255,255,255",
    sectorAI: 0.1,
    sectorGrowth: 0.06,
  },
  light: {
    ring: "1,40,160",
    rim: "1,50,200",
    table: "1,70,249",
    tableA: 0.07,
    glow: "1,70,249",
    glowA: 0.14,
    ai: "1,70,249",
    both: "60,100,255",
    growth: "35,35,35",
    text: "10,10,10",
    beam: "1,70,249",
    cursor: "0,0,0",
    sectorAI: 0.08,
    sectorGrowth: 0.06,
  },
};

export function createRadar(canvas: HTMLCanvasElement, blips: Blip[]) {
  const ctx = canvas.getContext("2d")!;
  const n = blips.length;
  let W = 1;
  let H = 1;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 1;
  let D = 3.2;
  let pal = PALETTES.dark;
  let mono = "ui-monospace, monospace";
  const tilt = { T: rad(58), yaw: 0 };
  let sw = -Math.PI / 2;
  let bootAt = -1e9;
  let retReady = false;
  let lastHover = -1;
  let holdK = 0; // how far the sweep has given way to holding on the lock
  const ret = { x: spring(340, 30), y: spring(340, 30), s: spring(420, 26, 30) };
  const hgt = blips.map(() => spring(260, 22, 0.11));
  const tops: [number, number][] = blips.map(() => [0, 0]);
  const bases: [number, number, number][] = blips.map(() => [0, 0, 0]);

  /* ---- the table, seen through a lens ---- */
  // a bearing on the table: 0 is to the right, angles run clockwise seen from above, "up" is the far side
  const onTable = (a: number, r: number): [number, number] => [Math.cos(a) * r, -Math.sin(a) * r];
  // a point on the table (in radii, y away from you) at height h -> the screen, and its depth
  const proj = (x: number, y: number, h = 0): [number, number, number] => {
    const c = Math.cos(tilt.yaw);
    const s = Math.sin(tilt.yaw);
    const px = (x * c - y * s) * R;
    const py = (x * s + y * c) * R;
    const hh = h * R;
    const cT = Math.cos(tilt.T);
    const sT = Math.sin(tilt.T);
    const Z = D + py * sT - hh * cT;
    const k = D / Z;
    return [cx + px * k, cy + (-py * cT - hh * sT) * k, Z];
  };
  // and back: where on the table a screen point lands
  const unproj = (sx: number, sy: number): [number, number] => {
    const a = (sx - cx) / D;
    const b = (sy - cy) / D;
    const cT = Math.cos(tilt.T);
    const sT = Math.sin(tilt.T);
    const py = (-b * D) / (cT + b * sT);
    const px = a * (D + py * sT);
    const c = Math.cos(-tilt.yaw);
    const s = Math.sin(-tilt.yaw);
    return [(px * c - py * s) / R, (px * s + py * c) / R];
  };
  const pathArc = (r: number, a0: number, a1: number, steps: number, wedge = false) => {
    ctx.beginPath();
    if (wedge) {
      const [x, y] = proj(0, 0);
      ctx.moveTo(x, y);
    }
    for (let j = 0; j <= steps; j++) {
      const [tx, ty] = onTable(a0 + ((a1 - a0) * j) / steps, r);
      const [x, y] = proj(tx, ty);
      if (j || wedge) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    if (wedge) ctx.closePath();
  };
  const ringAt = (x0: number, y0: number, r: number) => {
    ctx.beginPath();
    for (let j = 0; j <= 24; j++) {
      const a = (j / 24) * TAU;
      const [x, y] = proj(x0 + Math.cos(a) * r, y0 + Math.sin(a) * r);
      if (j) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  };
  const line = (a: number[], b: number[]) => {
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const font = (px: number) => `${px}px ${mono}`;
  const toneOf = (b: Blip) => (b.tone === "both" ? pal.both : b.tone === "ai" ? pal.ai : pal.growth);
  const pt = (i: number) => onTable(rad(blips[i].bearing), blips[i].range);
  // the post nearest a screen point, within reach, by its distance to the whole post
  const nearest = (x: number, y: number, reach: number) => {
    let hit = -1;
    let best = reach;
    for (let i = 0; i < n; i++) {
      const [ax, ay] = bases[i];
      const [bx, by] = tops[i];
      const vx = bx - ax;
      const vy = by - ay;
      const t = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      const d = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
      if (d < best) {
        best = d;
        hit = i;
      }
    }
    return hit;
  };

  return {
    /** Re-read the theme's colours and the mono font. */
    theme() {
      const root = document.documentElement;
      pal = root.dataset.theme === "light" ? PALETTES.light : PALETTES.dark;
      mono = getComputedStyle(root).getPropertyValue("--font-geist-mono").trim() || "ui-monospace, monospace";
    },

    resize(w: number, h: number) {
      W = Math.max(1, w);
      H = Math.max(1, h);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      if (W < 768) {
        // phones: the table across the top, the readout below it
        R = Math.min(W * 0.4, H * 0.2);
        cx = W / 2;
        cy = H * 0.24;
      } else {
        R = Math.min(W * 0.26, H * 0.58);
        cx = W * 0.31;
        cy = H * 0.52;
      }
      D = R * 3.2;
    },

    /** The post under a click or tap (a finger gets a wider reach), as of the last frame; -1 for none. */
    pick(x: number, y: number, reach = 30) {
      return nearest(x, y, reach);
    },

    boot(now: number) {
      bootAt = now;
      sw = -Math.PI / 2;
      retReady = false;
    },

    frame(f: FrameIn): FrameOut {
      const { now, dt, active, lockAt, anchor, reduced, pointer, hold } = f;
      const bt = reduced ? 1e9 : now - bootAt;
      // the table leans toward a fine pointer
      const mx = pointer.lean && pointer.inside ? (pointer.x / W) * 2 - 1 : 0;
      const my = pointer.lean && pointer.inside ? (pointer.y / H) * 2 - 1 : 0;
      const wantT = rad(58 - 5 * my);
      const wantYaw = rad(-8 * mx);
      tilt.T = Math.abs(tilt.T - wantT) < 1e-4 ? wantT : lerp(tilt.T, wantT, 0.06);
      tilt.yaw = Math.abs(tilt.yaw - wantYaw) < 1e-4 ? wantYaw : lerp(tilt.yaw, wantYaw, 0.06);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.lineWidth = 1;
      // the boot: rings draw out, ticks run round, the sweep spins up, the posts check in one by one
      const ringP = (k: number) => ease((bt - k * 90) / 480);
      const sectorA = ease((bt - 300) / 600);
      const tickP = ease((bt - 180) / 520);
      const labelA = ease((bt - 500) / 500);
      const spinUp = reduced ? 0 : smooth(clamp((bt - 350) / 700, 0, 1));
      // holding on a lock, the beam carries on round to the case (never backwards), slows onto it
      // and stops, and the tail fades; otherwise it sweeps
      const holding = hold && active >= 0;
      holdK = lerp(holdK, holding ? 1 : 0, Math.min(1, dt * 5));
      if (Math.abs(holdK - (holding ? 1 : 0)) < 1e-3) holdK = holding ? 1 : 0;
      let ahead = 0;
      if (holding) {
        ahead = (((rad(blips[active].bearing) - sw) % TAU) + TAU) % TAU;
        if (ahead < 0.002) ahead = 0;
        sw += Math.min(SPEED * Math.max(spinUp, 0.4), ahead * 4) * dt;
      } else sw += SPEED * spinUp * dt;
      const spin = spinUp * (1 - holdK);
      const depth = (z: number) => clamp((D * 1.5 - z) / D, 0.3, 1);

      // the glow under the table, and the table
      const [c0x, c0y] = proj(0, 0);
      ctx.save();
      ctx.translate(c0x, c0y);
      ctx.scale(1, Math.cos(tilt.T) * 0.9);
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.35);
      glow.addColorStop(0, `rgba(${pal.glow},${pal.glowA * ringP(3)})`);
      glow.addColorStop(1, `rgba(${pal.glow},0)`);
      ctx.fillStyle = glow;
      ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
      ctx.restore();
      pathArc(1, 0, TAU, 96);
      ctx.fillStyle = `rgba(${pal.table},${pal.tableA * ringP(3)})`;
      ctx.fill();
      // the sectors
      pathArc(1, rad(160), rad(262), 36, true);
      ctx.fillStyle = `rgba(${pal.ai},${pal.sectorAI * sectorA})`;
      ctx.fill();
      pathArc(1, rad(278), rad(380), 36, true);
      ctx.fillStyle = `rgba(${pal.growth},${pal.sectorGrowth * sectorA})`;
      ctx.fill();
      // rings; the outer one glows like a rim
      for (let k = 1; k <= 4; k++) {
        const pr = ringP(k - 1);
        if (pr <= 0) continue;
        pathArc(k / 4, -Math.PI / 2, -Math.PI / 2 + TAU * pr, Math.ceil(96 * pr));
        if (k === 4) {
          ctx.strokeStyle = `rgba(${pal.rim},0.6)`;
          ctx.lineWidth = 1.5;
          ctx.shadowColor = `rgb(${pal.ai})`;
          ctx.shadowBlur = 14;
        } else ctx.strokeStyle = `rgba(${pal.ring},0.16)`;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }
      const cr = ringP(1);
      ctx.strokeStyle = `rgba(${pal.ring},0.12)`;
      line(proj(-cr, 0), proj(cr, 0));
      line(proj(0, -cr), proj(0, cr));
      // ticks, bearings and the sector names
      ctx.strokeStyle = `rgba(${pal.ring},0.4)`;
      ctx.beginPath();
      for (let a = 0; a < 360 * tickP; a += 5) {
        const l = a % 30 === 0 ? 0.05 : 0.022;
        const [x1, y1] = onTable(rad(a), 1);
        const [x2, y2] = onTable(rad(a), 1 + l);
        const p1 = proj(x1, y1);
        const p2 = proj(x2, y2);
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(p2[0], p2[1]);
      }
      ctx.stroke();
      ctx.font = font(10);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let a = 0; a < 360; a += 30) {
        const [x, y] = onTable(rad(a), 1.12);
        const q = proj(x, y);
        ctx.fillStyle = `rgba(${pal.ring},${(0.5 * labelA * depth(q[2])).toFixed(3)})`;
        ctx.fillText(String(a).padStart(3, "0"), q[0], q[1]);
      }
      ctx.font = font(11);
      (
        [
          [211, "AI", pal.both],
          [329, "GROWTH", pal.growth],
        ] as const
      ).forEach(([a, t, rgb]) => {
        const [x, y] = onTable(rad(a), 1.27);
        const q = proj(x, y);
        ctx.fillStyle = `rgba(${rgb},${(0.95 * sectorA).toFixed(3)})`;
        ctx.fillText(t, q[0], q[1]);
      });
      // the sweep, with a long phosphor tail
      if (spinUp > 0) {
        for (let m = 0; m < 22 && spin > 0.001; m++) {
          const a1 = sw - m * 0.065;
          pathArc(1, a1 - 0.066, a1, 3, true);
          ctx.fillStyle = `rgba(${pal.ai},${(0.34 * Math.pow(1 - m / 22, 1.8) * spin).toFixed(3)})`;
          ctx.fill();
        }
        const [bx, by] = onTable(sw, 1);
        ctx.strokeStyle = `rgba(${pal.beam},${0.95 * spinUp})`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = `rgb(${pal.ai})`;
        ctx.shadowBlur = 12;
        line(proj(0, 0), proj(bx, by));
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
      }

      // the posts: where they stand, and which one the pointer is on
      const appear = blips.map((b, i) => (reduced ? 1 : ease((bt - (650 + i * 110)) / 220)));
      for (let i = 0; i < n; i++) {
        hgt[i].to = i === active ? 0.22 : i === lastHover ? 0.17 : 0.11;
        if (reduced) hgt[i].snap(hgt[i].to);
        else hgt[i].step(dt);
        const [x, y] = pt(i);
        bases[i] = proj(x, y, 0);
        const t = proj(x, y, hgt[i].x * appear[i]);
        tops[i] = [t[0], t[1]];
      }
      const hover = pointer.inside && bt > 1000 ? nearest(pointer.x, pointer.y, 30) : -1;
      lastHover = hover;
      // far posts first
      const order = blips.map((b, i) => i).sort((a, b) => bases[b][2] - bases[a][2]);
      for (const i of order) {
        if (appear[i] <= 0) continue;
        const b = blips[i];
        const rgb = toneOf(b);
        const on = i === active;
        const [x, y] = pt(i);
        const B = bases[i];
        const T = tops[i];
        const age = reduced ? 0.6 : ((((sw - rad(b.bearing)) % TAU) + TAU) % TAU) / SPEED;
        const lit = Math.max(0.3, Math.exp(-age * 0.9)) * appear[i];
        ringAt(x, y, 0.028);
        ctx.strokeStyle = `rgba(${rgb},${(0.55 * appear[i]).toFixed(3)})`;
        ctx.stroke();
        if (!reduced && age < 1.3 && spin > 0.5) {
          ringAt(x, y, 0.03 + age * 0.12);
          ctx.strokeStyle = `rgba(${rgb},${((1 - age / 1.3) * 0.6 * appear[i]).toFixed(3)})`;
          ctx.stroke();
        }
        const pg = ctx.createLinearGradient(B[0], B[1], T[0], T[1]);
        pg.addColorStop(0, `rgba(${rgb},0.08)`);
        pg.addColorStop(1, `rgba(${rgb},${(0.95 * Math.max(lit, on ? 1 : 0)).toFixed(3)})`);
        ctx.strokeStyle = pg;
        ctx.lineWidth = on ? 2 : 1.5;
        line(B, T);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(T[0], T[1], on ? 5.5 : 4, 0, TAU);
        ctx.fillStyle = `rgba(${rgb},${on ? 1 : lit.toFixed(3)})`;
        ctx.shadowColor = `rgb(${rgb})`;
        ctx.shadowBlur = on ? 18 : 10 * lit;
        ctx.fill();
        ctx.shadowBlur = 0;
        // the label types itself in during the boot
        const typed = reduced ? 99 : Math.max(0, Math.floor((bt - (650 + i * 110)) / 22));
        ctx.font = font(10);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = `rgba(${pal.text},${on || i === hover ? 0.95 : ((0.22 + lit * 0.45) * depth(B[2])).toFixed(3)})`;
        ctx.fillText(b.label.slice(0, typed), T[0] + 10, T[1] - 8);
      }

      // the lock
      const e = reduced ? 1e9 : now - lockAt;
      if (active >= 0) {
        const T = tops[active];
        const [sx, sy] = pt(active);
        // a ring ripples out across the table once locked
        if (e > LOCK_MS && e < 1100) {
          const k = (e - LOCK_MS) / 720;
          ringAt(sx, sy, 0.03 + k * 0.32);
          ctx.strokeStyle = `rgba(${pal.both},${(0.8 * (1 - k)).toFixed(3)})`;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.lineWidth = 1;
        }
        // the leader to the readout
        if (anchor && e > LOCK_MS) {
          const le = reduced ? 1 : ease((e - LOCK_MS) / 260);
          const ex = anchor.x;
          const ey = anchor.y;
          const mx2 = ex - 46;
          const L1 = Math.hypot(mx2 - T[0], ey - T[1]);
          const L2 = ex - mx2;
          const run = (L1 + L2) * le;
          ctx.beginPath();
          ctx.moveTo(T[0], T[1]);
          if (run <= L1) ctx.lineTo(T[0] + ((mx2 - T[0]) * run) / L1, T[1] + ((ey - T[1]) * run) / L1);
          else {
            ctx.lineTo(mx2, ey);
            ctx.lineTo(mx2 + run - L1, ey);
          }
          ctx.strokeStyle = `rgba(${pal.both},0.75)`;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      // the reticle: closes in on a lock in three steps; on a hovered post it spins, wide
      const tgt = hover >= 0 ? hover : active;
      if (tgt >= 0) {
        const [tx, ty] = tops[tgt];
        const locked = tgt === active;
        ret.x.to = tx;
        ret.y.to = ty;
        ret.s.to = !locked ? 24 : e < 110 ? 30 : e < 220 ? 22 : e < 330 ? 16 : 12;
        if (!retReady || reduced) {
          ret.x.snap(tx);
          ret.y.snap(ty);
          ret.s.snap(ret.s.to);
          retReady = true;
        }
        const rx = ret.x.step(dt);
        const ry = ret.y.step(dt);
        const rs = ret.s.step(dt);
        ctx.save();
        ctx.translate(rx, ry);
        if (!locked && !reduced) ctx.rotate(now / 500);
        ctx.strokeStyle = locked ? `rgba(${pal.both},1)` : `rgba(${pal.cursor},0.9)`;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = `rgb(${pal.ai})`;
        ctx.shadowBlur = locked ? 10 : 0;
        const k = rs * 0.45;
        for (const [ux, uy] of [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ]) {
          ctx.beginPath();
          ctx.moveTo(ux * rs, uy * (rs - k));
          ctx.lineTo(ux * rs, uy * rs);
          ctx.lineTo(ux * (rs - k), uy * rs);
          ctx.stroke();
        }
        ctx.restore();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        if (locked && e < 1700) {
          const txt = e < LOCK_MS ? (Math.floor(now / 90) % 2 ? "ACQUIRING" : "") : "LOCKED";
          ctx.font = font(10);
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(${pal.beam},${e < 1300 ? 0.9 : 0.9 * (1 - (e - 1300) / 400)})`;
          ctx.fillText(txt, rx, ry + rs + 16);
        }
      }
      // the pointer's crosshair, laid flat on the table, with its bearing and range
      if (pointer.inside && pointer.lean) {
        const [ux, uy] = unproj(pointer.x, pointer.y);
        const r = Math.hypot(ux, uy);
        if (r < 1) {
          const hw = Math.sqrt(1 - uy * uy);
          const hh = Math.sqrt(1 - ux * ux);
          ctx.strokeStyle = `rgba(${pal.cursor},0.14)`;
          line(proj(-hw, uy), proj(hw, uy));
          line(proj(ux, -hh), proj(ux, hh));
          ringAt(ux, uy, 0.03);
          ctx.strokeStyle = `rgba(${pal.cursor},0.5)`;
          ctx.stroke();
          const deg = ((Math.atan2(-uy, ux) * 180) / Math.PI + 360) % 360;
          ctx.font = font(10);
          ctx.textAlign = "left";
          ctx.fillStyle = `rgba(${pal.cursor},0.65)`;
          ctx.fillText(`R ${r.toFixed(2)}   ${deg.toFixed(0).padStart(3, "0")}°`, pointer.x + 14, pointer.y + 22);
        }
      }
      ctx.beginPath();
      ctx.arc(c0x, c0y, 2.5, 0, TAU);
      ctx.fillStyle = `rgb(${pal.both})`;
      ctx.fill();
      // nothing left moving (the beam is held, every spring at rest, the lock finished, no
      // hovered post spinning its reticle): the page can stop drawing until something changes
      const rest = (s: Spring) => Math.abs(s.x - s.to) < 1e-3 && Math.abs(s.v) < 1e-3;
      const idle =
        (reduced || (holding && ahead === 0 && holdK === 1)) &&
        tilt.T === wantT &&
        tilt.yaw === wantYaw &&
        rest(ret.x) &&
        rest(ret.y) &&
        rest(ret.s) &&
        hgt.every(rest) &&
        (hover < 0 || hover === active) &&
        e > 1750 &&
        bt > 2500;
      return { hover, tops, idle };
    },
  };
}

export type Radar = ReturnType<typeof createRadar>;
