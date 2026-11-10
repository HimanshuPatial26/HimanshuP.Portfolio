/**
 * Generated sound for the site, built with the Web Audio API (no audio files,
 * so nothing to license or download). Off until the visitor turns it on.
 *
 * - a low drone (A, E, A) whose filter opens and swells with scroll speed, plus
 *   a colour note that leans cool in AI chapters and warm in Growth ones;
 * - a whoosh on every shape change, and on page changes;
 * - a soft tick-and-thump when an Impact number locks into place;
 * - a light click on links and buttons;
 * - a rising whoosh when the paper plane takes off.
 *
 * Reads the shared `film` state on the GSAP ticker.
 */
import { gsap } from "gsap";
import { film } from "@/lib/film";

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  drone: GainNode;
  filter: BiquadFilterNode;
  colour: OscillatorNode;
  colourGain: GainNode;
  noise: AudioBuffer;
};

let engine: Engine | null = null;
let on = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const subscribeSound = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const isSoundOn = () => on;

function makeNoise(ctx: AudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function build(): Engine | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.ratio.value = 3;
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);

  // drone: root, fifth and octave through a slowly breathing low-pass filter
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 420;
  filter.Q.value = 0.8;
  const drone = ctx.createGain();
  drone.gain.value = 0.3;
  filter.connect(drone).connect(master);
  const voices: [number, OscillatorType, number, number][] = [
    [55, "sine", 0.6, 0],
    [82.41, "triangle", 0.14, 4],
    [110, "sine", 0.22, -5],
    [110, "triangle", 0.05, 7],
  ];
  for (const [f, type, g, detune] of voices) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    const gg = ctx.createGain();
    gg.gain.value = g;
    o.connect(gg).connect(filter);
    o.start();
  }
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.06;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 110;
  lfo.connect(lfoDepth).connect(filter.frequency);
  lfo.start();

  // colour note: the third (C cool / C# warm) or the fifth when neutral
  const colour = ctx.createOscillator();
  colour.type = "sine";
  colour.frequency.value = 164.81;
  const colourGain = ctx.createGain();
  colourGain.gain.value = 0.04;
  colour.connect(colourGain).connect(filter);
  colour.start();

  // air: a little filtered noise so the drone isn't sterile
  const noise = makeNoise(ctx, 2);
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const airBand = ctx.createBiquadFilter();
  airBand.type = "bandpass";
  airBand.frequency.value = 900;
  airBand.Q.value = 0.5;
  const airGain = ctx.createGain();
  airGain.gain.value = 0.02;
  air.connect(airBand).connect(airGain).connect(master);
  air.start();

  return { ctx, master, drone, filter, colour, colourGain, noise };
}

function whoosh(e: Engine, { from = 260, peak = 2200, to = 520, dur = 1.15, level = 0.2 } = {}) {
  const { ctx } = e;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = e.noise;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 1.1;
  bp.frequency.setValueAtTime(from, t);
  bp.frequency.exponentialRampToValueAtTime(peak, t + dur * 0.4);
  bp.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + dur * 0.38);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let out: AudioNode = g;
  if (ctx.createStereoPanner) {
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(-0.6, t);
    pan.pan.linearRampToValueAtTime(0.6, t + dur);
    g.connect(pan);
    out = pan;
  }
  src.connect(bp).connect(g);
  out.connect(e.master);
  src.start(t);
  src.stop(t + dur + 0.05);
}

function blip(e: Engine, freq: number, dur: number, level: number, type: OscillatorType = "sine", drop = 1) {
  const { ctx } = e;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (drop !== 1) o.frequency.exponentialRampToValueAtTime(freq * drop, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(e.master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// ---- reacting to the page
let wasMorphing = false;
let lastFormed = "";
let lastColour = 0;
let throttle = 0;

const tick = () => {
  const e = engine;
  if (!e || !on) return;
  const t = e.ctx.currentTime;

  // drone opens up and swells with scroll speed (updated ~20 times a second)
  if (t - throttle > 0.05) {
    throttle = t;
    const speed = Math.min(Math.abs(film.velocity), 3);
    e.filter.frequency.setTargetAtTime(380 + speed * 650, t, 0.25);
    e.drone.gain.setTargetAtTime(0.28 + speed * 0.07, t, 0.3);
    const colour = film.grade < -0.4 ? -1 : film.grade > 0.4 ? 1 : 0;
    if (colour !== lastColour) {
      lastColour = colour;
      e.colour.frequency.setTargetAtTime(colour < 0 ? 130.81 : colour > 0 ? 138.59 : 164.81, t, 0.8);
      e.colourGain.gain.setTargetAtTime(colour ? 0.07 : 0.04, t, 0.8);
    }
  }

  // a whoosh each time a shape starts changing
  if (!wasMorphing && film.morph > 0.35) {
    wasMorphing = true;
    whoosh(e, { level: film.chapter ? 0.22 : 0.13 });
  } else if (wasMorphing && film.morph < 0.12) {
    wasMorphing = false;
  }

  // a number locks into place
  if (film.formed !== lastFormed) {
    if (film.formed.startsWith("text:")) {
      blip(e, 95, 0.35, 0.32, "sine", 0.55);
      blip(e, 1760, 0.09, 0.05, "triangle");
    }
    lastFormed = film.formed;
  }
};

const onClick = (ev: PointerEvent) => {
  if (!engine || !on) return;
  const el = (ev.target as Element | null)?.closest?.("a, button");
  if (el) blip(engine, 2100, 0.035, 0.035, "triangle", 0.6);
};
const onLaunch = () => engine && on && whoosh(engine, { from: 300, peak: 4200, to: 1800, dur: 1.2, level: 0.24 });
const onRoute = () => engine && on && whoosh(engine, { from: 180, peak: 1400, to: 300, dur: 1, level: 0.18 });
const onVisibility = () => {
  if (!engine) return;
  if (document.visibilityState === "hidden") engine.ctx.suspend();
  else if (on) engine.ctx.resume();
};

let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  gsap.ticker.add(tick);
  document.addEventListener("pointerdown", onClick, { passive: true });
  window.addEventListener("plane:launch", onLaunch);
  window.addEventListener("route:leave", onRoute);
  document.addEventListener("visibilitychange", onVisibility);
}

/** Must be called from a click (browsers only allow audio after a user gesture). */
export function setSound(next: boolean) {
  if (next === on) return;
  if (next) {
    engine = engine ?? build();
    if (!engine) return;
    wire();
    on = true;
    lastFormed = film.formed;
    wasMorphing = film.morph > 0.35;
    const { ctx, master } = engine;
    ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 1.5);
  } else {
    on = false;
    if (engine) {
      const { ctx, master } = engine;
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      window.setTimeout(() => !on && ctx.suspend(), 500);
    }
  }
  emit();
}
