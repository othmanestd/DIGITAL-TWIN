"use client";
// Sound design that belongs to the score: same key (D major / B minor, pentatonic bells) and the same kind of dark plate
// reverb as the ambient music. Everything is quiet and reacts to the store:
//   zoom (altitude speed) → airy whoosh · selection / AI cursor click → soft chime · year change → riser + swell
//   altitude ≥ 3 km → deep "space" pad fading in up to the globe · altitude > 6e7 m (JABB easter egg) → sparkle.
// Starts after the first user gesture (autoplay rules); muted with the sound button of the dock.
import { audio } from "./audio";
import { impulse } from "./music";
import { useApp } from "../store";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const CHIME = [86, 88, 90, 93, 95]; // D6 E6 F#6 A6 B6

type G = {
  ctx: AudioContext; bus: GainNode; dry: GainNode; send: GainNode;
  wind: GainNode; windBp: BiquadFilterNode; space: GainNode; noise: AudioBuffer;
};
let g: G | null = null;
let enabled = true;
let lastChime = 0;

export function sfxEnabled(v: boolean) {
  enabled = v;
  if (!g) return;
  const t = g.ctx.currentTime;
  g.bus.gain.cancelScheduledValues(t);
  g.bus.gain.setTargetAtTime(v ? 1 : 0, t, 0.25);
}

function noiseBuffer(ctx: AudioContext, sec = 3) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
  const d = b.getChannelData(0);
  // soft pink-ish noise (Paul Kellet's economy filter)
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
  }
  return b;
}

function bell(midi: number, when: number, vel: number, pan = 0) {
  if (!g) return;
  const { ctx } = g;
  const out = ctx.createGain(); out.gain.value = vel;
  const p = ctx.createStereoPanner(); p.pan.value = pan;
  out.connect(p); p.connect(g.dry); p.connect(g.send);
  const f = mtof(midi);
  for (const [ratio, amp, dec] of [[1, 1, 2.2], [2.756, 0.28, 0.9], [5.404, 0.1, 0.4]] as const) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * ratio;
    const e = ctx.createGain();
    e.gain.setValueAtTime(0, when);
    e.gain.linearRampToValueAtTime(amp, when + 0.005);
    e.gain.exponentialRampToValueAtTime(0.0001, when + dec);
    o.connect(e).connect(out);
    o.start(when); o.stop(when + dec + 0.05);
  }
  setTimeout(() => { try { out.disconnect(); p.disconnect(); } catch {} }, (when - ctx.currentTime + 2.6) * 1000);
}

/** Soft chime (selection, AI cursor click). */
export function chime() {
  if (!g || !enabled) return;
  const now = performance.now();
  if (now - lastChime < 140) return;
  lastChime = now;
  const t = g.ctx.currentTime + 0.01;
  const n = CHIME[Math.floor(Math.random() * CHIME.length)];
  bell(n, t, 0.22, rnd(-0.3, 0.3));
  if (Math.random() < 0.5) bell(n + (Math.random() < 0.5 ? 5 : 7), t + 0.07, 0.1, rnd(-0.3, 0.3));
}

/** Time travel: a filtered-noise riser with a D major swell. */
export function riser(up = true) {
  if (!g || !enabled) return;
  const { ctx } = g;
  const t = ctx.currentTime + 0.01;
  const src = ctx.createBufferSource(); src.buffer = g.noise;
  const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(up ? 320 : 2600, t);
  bp.frequency.exponentialRampToValueAtTime(up ? 2800 : 380, t + 0.95);
  const e = ctx.createGain();
  e.gain.setValueAtTime(0, t);
  e.gain.linearRampToValueAtTime(0.5, t + 0.75);
  e.gain.linearRampToValueAtTime(0, t + 1.25);
  src.connect(bp).connect(e); e.connect(g.dry); e.connect(g.send);
  src.start(t, Math.random() * 1.5); src.stop(t + 1.4);
  // swell: D4 A4 E5 F#5
  for (const [m, a] of [[62, 0.07], [69, 0.06], [76, 0.045], [78, 0.035]] as const) {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(m); o.detune.value = rnd(-4, 4);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t + 0.35);
    og.gain.linearRampToValueAtTime(a, t + 0.95);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(og); og.connect(g.send); og.connect(g.dry);
    o.start(t + 0.35); o.stop(t + 2.7);
  }
}

/** Chapter change in the guided tour: a soft D major swell, no noise (sits under the music). */
export function swell() {
  if (!g || !enabled) return;
  const { ctx } = g;
  const t = ctx.currentTime + 0.02;
  for (const [m, a] of [[50, 0.09], [57, 0.07], [62, 0.06], [66, 0.045], [69, 0.035], [76, 0.02]] as const) {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(m); o.detune.value = rnd(-5, 5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t);
    og.gain.linearRampToValueAtTime(a, t + 1.4);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
    o.connect(og); og.connect(g.send); og.connect(g.dry);
    o.start(t); o.stop(t + 4.3);
  }
  bell(CHIME[2], t + 1.1, 0.08, -0.2);
}

/** Guided visit, value ledger: a value flows in (n lines → a short rising arpeggio) or the cost is deducted (lower, softer). */
export function reveal(n = 1, cost = false) {
  if (!g || !enabled) return;
  const t = g.ctx.currentTime + 0.05;
  if (cost) { bell(74, t, 0.1, -0.2); bell(69, t + 0.16, 0.08, 0.2); return; }
  const notes = [81, 85, 88, 90, 93].slice(0, Math.max(2, Math.min(5, n + 1)));
  notes.forEach((m, i) => bell(m, t + 0.35 + i * 0.11, 0.11 * (1 - i * 0.1), (i / 4) * 0.8 - 0.4));
}

/** Guided visit, title card: a low D major bloom with one high bell (under the music, no noise). */
export function titleSting() {
  if (!g || !enabled) return;
  const { ctx } = g;
  const t = ctx.currentTime + 0.05;
  for (const [m, a] of [[38, 0.08], [45, 0.06], [50, 0.05], [57, 0.035], [62, 0.025]] as const) {
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = mtof(m); o.detune.value = rnd(-4, 4);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + 2.2); og.gain.exponentialRampToValueAtTime(0.0001, t + 7.5);
    o.connect(og); og.connect(g.send); og.connect(g.dry);
    o.start(t); o.stop(t + 7.6);
  }
  bell(CHIME[3], t + 1.6, 0.12, 0);
  bell(CHIME[1], t + 2.3, 0.07, 0.25);
}

/** Guided visit, the net value: a warm full chord and a slow descending-then-rising bell figure. */
export function finaleChord() {
  if (!g || !enabled) return;
  const { ctx } = g;
  const t = ctx.currentTime + 0.05;
  for (const [m, a] of [[50, 0.09], [57, 0.07], [62, 0.06], [66, 0.05], [69, 0.04], [74, 0.03], [78, 0.02]] as const) {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(m); o.detune.value = rnd(-5, 5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + 0.9); og.gain.exponentialRampToValueAtTime(0.0001, t + 6);
    o.connect(og); og.connect(g.send); og.connect(g.dry);
    o.start(t); o.stop(t + 6.1);
  }
  [90, 86, 88, 93, 98].forEach((m, i) => bell(m, t + 0.5 + i * 0.18, 0.12 * (1 - i * 0.12), (i / 4) * 1.0 - 0.5));
}

/** JABB easter egg: a tiny ascending sparkle. */
export function sparkle() {
  if (!g || !enabled) return;
  const t = g.ctx.currentTime + 0.01;
  [86, 88, 90, 93, 95, 98, 100].forEach((m, i) => bell(m, t + i * 0.055, 0.09 * (1 - i * 0.07), (i / 6) * 1.2 - 0.6));
}

/** Creates the graph and starts listening to the store. Call from a user gesture. */
export function initSfx() {
  if (g) return;
  const { ctx, master } = audio();
  const out = ctx.createGain(); out.gain.value = 0.16; // master level of the sound design: low
  out.connect(master);
  const bus = ctx.createGain(); bus.gain.value = enabled ? 1 : 0;
  bus.connect(out);
  const dry = ctx.createGain(); dry.gain.value = 0.55; dry.connect(bus);
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 4.5);
  const send = ctx.createGain(); send.gain.value = 0.8; send.connect(verb);
  const wet = ctx.createGain(); wet.gain.value = 0.6; verb.connect(wet).connect(bus);
  const noise = noiseBuffer(ctx);

  // wind (zoom whoosh): continuous noise whose level and brightness follow the zoom speed
  const ns = ctx.createBufferSource(); ns.buffer = noise; ns.loop = true;
  const windBp = ctx.createBiquadFilter(); windBp.type = "bandpass"; windBp.Q.value = 0.8; windBp.frequency.value = 600;
  const wind = ctx.createGain(); wind.gain.value = 0;
  ns.connect(windBp).connect(wind); wind.connect(dry); wind.connect(send);
  ns.start();

  // space pad: D1 / A1 / D2, dark low-pass, very slow breathing
  const space = ctx.createGain(); space.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; lp.Q.value = 0.4;
  lp.connect(space); space.connect(dry); space.connect(send);
  for (const [m, type, a, det] of [[26, "sine", 0.5, 0], [33, "sine", 0.32, 0], [38, "triangle", 0.12, -5], [38, "triangle", 0.12, 6], [45, "sine", 0.06, 0]] as const) {
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
    const og = ctx.createGain(); og.gain.value = a;
    o.connect(og).connect(lp); o.start();
  }
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
  const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 90;
  lfo.connect(lfoAmt).connect(lp.frequency); lfo.start();

  g = { ctx, bus, dry, send, wind, windBp, space, noise };

  // ------------------------------------------------ store → sound
  let lastAlt = useApp.getState().altitude || 300;
  let lastT = performance.now();
  let windOff = 0;
  const applyAltitude = (alt: number) => {
    const now = performance.now();
    const dt = Math.max(0.016, (now - lastT) / 1000);
    const speed = Math.abs(Math.log(Math.max(1, alt) / Math.max(1, lastAlt))) / dt; // e-folds per second
    const t = ctx.currentTime;
    if (enabled && speed > 0.05) {
      const k = Math.min(1, speed / 4);
      wind.gain.setTargetAtTime(0.08 + 0.55 * k, t, 0.06);
      windBp.frequency.setTargetAtTime(420 + 2600 * k * (alt > lastAlt ? 1 : 0.7), t, 0.08);
      clearTimeout(windOff);
      windOff = window.setTimeout(() => wind.gain.setTargetAtTime(0, ctx.currentTime, 0.28), 160);
    }
    // deep space pad from ≈3 km (Morocco) to ≈3 500 km (world)
    const lo = Math.log(3000), hi = Math.log(3.5e6);
    const x = Math.min(1, Math.max(0, (Math.log(Math.max(1, alt)) - lo) / (hi - lo)));
    space.gain.setTargetAtTime(0.42 * Math.pow(x, 1.3), t, 0.9);
    if (lastAlt <= 6e7 && alt > 6e7) sparkle();
    lastAlt = alt; lastT = now;
  };
  applyAltitude(lastAlt);
  useApp.subscribe((s, p) => {
    if (s.altitude !== p.altitude) applyAltitude(s.altitude);
    if (s.sel !== p.sel && s.sel && (s.sel.kind !== p.sel?.kind || s.sel.id !== p.sel?.id)) chime();
    if (s.caseId !== p.caseId && s.caseId) chime();
    if (s.cursor.clicking && !p.cursor.clicking) chime();
    if (s.year !== p.year) riser(s.year > p.year);
  });
}
