// Draws the front and back of the 3D Lanyard ID badge on a 2D canvas, using the
// site's loaded fonts, and returns them as data URLs for the Lanyard textures.
// Every figure comes from the resume data; nothing is invented here.

import { metrics, profile } from "@/data/resume";

const W = 640;
const H = 900; // Lanyard portrait card is 1.6 × 2.25

const C = {
  bg: "#050505",
  bg2: "#161616",
  text: "#f4f4f4",
  muted: "#a3a3a3",
  faint: "#6e6e6e",
  ai: "#3a6dff",
  growth: "#c8ccd4",
  line: "rgba(255,255,255,0.12)",
};

function fontVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v ? `${v}, ${fallback}` : fallback;
}

function base(ctx: CanvasRenderingContext2D) {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, C.bg2);
  g.addColorStop(1, C.bg);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // an electric-blue glow and a faint white one
  const glow = (x: number, y: number, r: number, color: string) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, color);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
  };
  glow(W * 0.85, H * 0.12, 360, "rgba(1,70,249,0.42)");
  glow(W * 0.1, H * 0.95, 340, "rgba(255,255,255,0.06)");

  // fine grid texture
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  // punch-hole slot for the clip
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, W / 2 - 56, 34, 112, 18, 9);
  ctx.fill();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, label: string, color: string, mono: string) {
  ctx.font = `500 20px ${mono}`;
  const w = ctx.measureText(label).width + 32;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, 38, 19);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 16, y + 20);
  ctx.textBaseline = "alphabetic";
  return w;
}

export function drawBadge(): { front: string; back: string } | null {
  if (typeof document === "undefined") return null;
  const sans = fontVar("--font-geist-sans", "system-ui, sans-serif");
  const serif = fontVar("--font-syne", "Arial, sans-serif");
  const display = serif;
  const mono = fontVar("--font-geist-mono", "ui-monospace, monospace");

  const make = () => {
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    return canvas;
  };

  // ---------- FRONT ----------
  const front = make();
  const f = front.getContext("2d");
  if (!f) return null;
  base(f);
  const pad = 52;

  f.fillStyle = C.faint;
  f.font = `500 20px ${mono}`;
  f.fillText("PRODUCT · ID", pad, 118);
  f.textAlign = "right";
  f.fillText("2026", W - pad, 118);
  f.textAlign = "left";

  // monogram
  f.strokeStyle = "rgba(255,255,255,0.4)";
  f.lineWidth = 2;
  f.beginPath();
  f.arc(pad + 44, 214, 44, 0, Math.PI * 2);
  f.stroke();
  f.fillStyle = C.text;
  f.font = `400 50px ${serif}`;
  f.textAlign = "center";
  f.fillText("hp", pad + 44, 228);
  f.textAlign = "left";

  // name
  f.fillStyle = C.text;
  f.font = `400 76px ${display}`;
  if ("letterSpacing" in f) (f as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "-3px";
  f.fillText("HIMANSHU", pad - 4, 392);
  f.fillText("PATIAL", pad - 4, 470);
  if ("letterSpacing" in f) (f as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";

  // title with coloured accents
  f.font = `400 46px ${serif}`;
  f.fillStyle = C.ai;
  f.fillText("AI", pad, 556);
  let x = pad + f.measureText("AI ").width;
  f.fillStyle = C.muted;
  f.font = `400 34px ${sans}`;
  f.fillText("&", x, 554);
  x += f.measureText("& ").width;
  f.font = `400 46px ${serif}`;
  f.fillStyle = C.growth;
  f.fillText("Growth", x, 556);
  x += f.measureText("Growth ").width;
  f.font = `400 34px ${sans}`;
  f.fillStyle = C.muted;
  f.fillText("PM", x, 554);

  // divider
  f.strokeStyle = C.line;
  f.lineWidth = 1.5;
  f.beginPath();
  f.moveTo(pad, 612);
  f.lineTo(W - pad, 612);
  f.stroke();

  // three headline numbers from the resume
  const stats: [string, string][] = [
    ["₹4M", "monthly rev."],
    ["+30%", "agent prod."],
    ["89–90%", "CSAT"],
  ];
  const colW = (W - pad * 2) / 3;
  stats.forEach(([v, l], i) => {
    const sx = pad + colW * i;
    f.fillStyle = C.text;
    f.font = `700 40px ${sans}`;
    f.fillText(v, sx, 678);
    f.fillStyle = C.faint;
    f.font = `500 18px ${mono}`;
    f.fillText(l.toUpperCase(), sx, 710);
  });

  // footer
  f.fillStyle = C.muted;
  f.font = `400 22px ${sans}`;
  f.fillText(profile.location, pad, 800);
  f.fillStyle = C.faint;
  f.font = `400 20px ${mono}`;
  f.fillText(profile.email, pad, 838);

  // ---------- BACK ----------
  const back = make();
  const b = back.getContext("2d");
  if (!b) return null;
  base(b);

  b.fillStyle = C.faint;
  b.font = `500 20px ${mono}`;
  b.fillText("WHAT I WORK ON", pad, 118);

  b.fillStyle = C.text;
  b.font = `400 54px ${display}`;
  b.fillText("PRODUCTS THAT", pad, 214);
  b.fillText("MOVE NUMBERS.", pad, 280);

  let y = 360;
  const rows: [string, string[]][] = [
    ["AI", ["LLM products", "RAG", "Conversational AI"]],
    ["Growth", ["Conversion", "Payments", "Automation"]],
  ];
  rows.forEach(([track, items]) => {
    const color = track === "AI" ? C.ai : C.growth;
    b.fillStyle = color;
    b.font = `400 44px ${serif}`;
    b.fillText(track, pad, y + 6);
    y += 30;
    let px = pad;
    let py = y;
    items.forEach((it) => {
      b.font = `500 20px ${mono}`;
      const w = b.measureText(it).width + 32;
      if (px + w > W - pad) {
        px = pad;
        py += 52;
      }
      px += pill(b, px, py, it, color, mono) + 12;
    });
    y = py + 100;
  });

  b.strokeStyle = C.line;
  b.lineWidth = 1.5;
  b.beginPath();
  b.moveTo(pad, 700);
  b.lineTo(W - pad, 700);
  b.stroke();

  const growth = metrics.find((m) => m.label === "successful payments");
  b.fillStyle = C.muted;
  b.font = `400 24px ${sans}`;
  b.fillText("Classplus · APM, 2023–2025", pad, 752);
  b.fillText(`Payment recovery: ${growth?.lead ?? ""}${growth?.value ?? ""}%`, pad, 790);
  b.fillStyle = C.faint;
  b.font = `400 20px ${mono}`;
  b.fillText("SP JAIN · MASTER OF GLOBAL BUSINESS", pad, 840);

  return { front: front.toDataURL("image/png"), back: back.toDataURL("image/png") };
}
