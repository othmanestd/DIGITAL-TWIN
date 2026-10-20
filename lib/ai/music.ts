"use client";
// Background music, generated live with Web Audio (no files): slow evolving warm pads (detuned saws through a breathing
// low-pass), a soft sub, sparse glassy bells through a dark plate-like reverb and a quiet dotted delay. The chord path,
// chord lengths, bell notes and timings are drawn at random, so it never loops. Very low level (≈ −24 dBFS), fades in/out.
import { audio } from "./audio";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// D major / B minor colours: maj9, m11, maj7#11, m9, add9 — open voicings, no thirds stacked low.
const CHORDS: { name: string; root: number; notes: number[]; bells: number[] }[] = [
  { name: "Dmaj9", root: 38, notes: [50, 57, 61, 64, 66], bells: [74, 76, 78, 81, 85, 86] },
  { name: "Bm11", root: 35, notes: [47, 54, 57, 62, 64], bells: [71, 74, 76, 78, 81, 83] },
  { name: "Gmaj7#11", root: 31, notes: [43, 50, 54, 59, 61], bells: [74, 78, 79, 81, 83, 86] },
  { name: "Em9", root: 40, notes: [52, 59, 62, 66, 67], bells: [71, 74, 76, 78, 79, 83] },
  { name: "Asus2", root: 33, notes: [45, 52, 59, 62, 64], bells: [69, 71, 74, 76, 81, 83] },
  { name: "F#m7", root: 42, notes: [54, 57, 61, 64, 69], bells: [73, 76, 78, 81, 85] },
];
const NEXT: Record<string, string[]> = {
  Dmaj9: ["Bm11", "Gmaj7#11", "Em9", "F#m7"],
  Bm11: ["Gmaj7#11", "Em9", "Dmaj9", "Asus2"],
  "Gmaj7#11": ["Dmaj9", "Asus2", "Em9", "Bm11"],
  Em9: ["Asus2", "Gmaj7#11", "Dmaj9"],
  Asus2: ["Dmaj9", "Bm11", "F#m7"],
  "F#m7": ["Bm11", "Gmaj7#11", "Em9"],
};

export function impulse(ctx: AudioContext, seconds = 5.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.4);
      const a = 0.55 - 0.48 * t; // the tail darkens as it decays
      y += a * (x - y);
      d[i] = i < ctx.sampleRate * 0.012 ? 0 : y; // 12 ms pre-delay
    }
  }
  return buf;
}

type Voice = { stop: (t: number) => void };

class Ambient {
  private ctx: AudioContext;
  private bus: GainNode;
  private padIn: GainNode;
  private bellIn: GainNode;
  private nodes: AudioNode[] = [];
  private timers: number[] = [];
  private current: Voice | null = null;
  private chord = CHORDS[0];
  private alive = true;

  constructor() {
    const { ctx, music } = audio();
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 1;
    this.bus.connect(music);
    // reverb
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    verb.connect(wet).connect(this.bus);
    // pads: dry + reverb
    this.padIn = ctx.createGain(); this.padIn.gain.value = 1;
    const padDry = ctx.createGain(); padDry.gain.value = 0.7;
    const padSend = ctx.createGain(); padSend.gain.value = 0.45;
    this.padIn.connect(padDry).connect(this.bus);
    this.padIn.connect(padSend).connect(verb);
    // bells: little dry, delay, mostly reverb
    this.bellIn = ctx.createGain(); this.bellIn.gain.value = 1;
    const bellDry = ctx.createGain(); bellDry.gain.value = 0.32;
    const bellSend = ctx.createGain(); bellSend.gain.value = 0.9;
    const delay = ctx.createDelay(2); delay.delayTime.value = 0.56;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 2600;
    const dOut = ctx.createGain(); dOut.gain.value = 0.28;
    this.bellIn.connect(bellDry).connect(this.bus);
    this.bellIn.connect(bellSend).connect(verb);
    this.bellIn.connect(delay); delay.connect(dlp).connect(fb).connect(delay); dlp.connect(dOut).connect(verb); dOut.connect(this.bus);
    // air: very quiet band-passed noise, slowly breathing
    const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 5200; bp.Q.value = 0.7;
    const air = ctx.createGain(); air.gain.value = 0.0035;
    const airLfo = ctx.createOscillator(); airLfo.frequency.value = 0.031;
    const airDepth = ctx.createGain(); airDepth.gain.value = 0.0025;
    airLfo.connect(airDepth).connect(air.gain);
    noise.connect(bp).connect(air).connect(verb);
    noise.start(); airLfo.start();
    this.nodes.push(verb, wet, this.padIn, padDry, padSend, this.bellIn, bellDry, bellSend, delay, fb, dlp, dOut, noise, bp, air, airLfo, airDepth);
  }

  start() {
    this.chord = pick(CHORDS);
    this.playChord();
    this.later(rnd(2.5, 4.5), () => this.bellLoop());
  }

  private later(sec: number, f: () => void) {
    const id = window.setTimeout(() => { if (this.alive) f(); }, sec * 1000);
    this.timers.push(id);
  }

  private playChord() {
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const attack = rnd(4, 6.5);
    const hold = rnd(11, 19);
    const c = this.chord;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + attack);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.Q.value = 0.5;
    const base = rnd(650, 1000);
    lp.frequency.value = base;
    const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(0.035, 0.07);
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = base * 0.45;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lp.connect(env).connect(this.padIn);
    const oscs: OscillatorNode[] = [lfo];
    c.notes.forEach((n, i) => {
      const pan = ctx.createStereoPanner();
      pan.pan.value = ((i / (c.notes.length - 1)) * 2 - 1) * 0.55;
      const vg = ctx.createGain(); vg.gain.value = 0.034 * (i === 0 ? 1.1 : 1);
      pan.connect(lp);
      vg.connect(pan);
      for (const det of [-7, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(n);
        o.detune.value = det + rnd(-2, 2);
        o.connect(vg);
        o.start(t);
        oscs.push(o);
      }
      // a soft triangle an octave up on the two top notes: glassy shimmer
      if (i >= c.notes.length - 2) {
        const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = mtof(n + 12);
        const sg = ctx.createGain(); sg.gain.value = 0.012;
        o.connect(sg).connect(pan); o.start(t); oscs.push(o);
      }
    });
    // sub
    const sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.value = mtof(c.root + 12 > 45 ? c.root : c.root + 12);
    const sg = ctx.createGain(); sg.gain.value = 0.11;
    sub.connect(sg).connect(env);
    sub.start(t); oscs.push(sub);
    lfo.start(t);

    const prev = this.current;
    this.current = {
      stop: (at: number) => {
        const r = rnd(6, 8);
        env.gain.cancelScheduledValues(at);
        env.gain.setValueAtTime(env.gain.value, at);
        env.gain.linearRampToValueAtTime(0, at + r);
        for (const o of oscs) { try { o.stop(at + r + 0.1); } catch {} }
        window.setTimeout(() => { try { env.disconnect(); lp.disconnect(); } catch {} }, (r + 1) * 1000 + (at - ctx.currentTime) * 1000);
      },
    };
    prev?.stop(t + attack * 0.4);

    this.later(attack + hold, () => {
      this.chord = CHORDS.find((x) => x.name === pick(NEXT[c.name])) || CHORDS[0];
      this.playChord();
    });
  }

  private bell(midi: number, when: number, vel: number) {
    const ctx = this.ctx;
    const f = mtof(midi);
    const out = ctx.createGain(); out.gain.value = vel;
    const pan = ctx.createStereoPanner(); pan.pan.value = rnd(-0.6, 0.6);
    out.connect(pan).connect(this.bellIn);
    const partials: [number, number, number][] = [[1, 1, 3.2], [2.756, 0.32, 1.4], [5.404, 0.12, 0.6], [2, 0.18, 2.2]];
    for (const [ratio, amp, dec] of partials) {
      const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f * ratio;
      const e = ctx.createGain();
      e.gain.setValueAtTime(0, when);
      e.gain.linearRampToValueAtTime(amp, when + 0.006);
      e.gain.exponentialRampToValueAtTime(0.0001, when + dec);
      o.connect(e).connect(out);
      o.start(when); o.stop(when + dec + 0.05);
    }
    window.setTimeout(() => { try { out.disconnect(); pan.disconnect(); } catch {} }, (when - ctx.currentTime + 3.6) * 1000);
  }

  private bellLoop() {
    const t = this.ctx.currentTime + 0.05;
    const r = Math.random();
    const notes = this.chord.bells;
    if (r < 0.55) this.bell(pick(notes), t, rnd(0.035, 0.06));
    else if (r < 0.85) {
      // a short rising figure of 2–4 notes
      const n = 2 + Math.floor(Math.random() * 3);
      const start = Math.floor(Math.random() * Math.max(1, notes.length - n));
      const step = rnd(0.16, 0.26);
      for (let i = 0; i < n; i++) this.bell(notes[Math.min(notes.length - 1, start + i)], t + i * step, rnd(0.025, 0.05) * (1 - i * 0.12));
    } // else: silence, room to breathe
    this.later(rnd(2.2, 6.5), () => this.bellLoop());
  }

  dispose(fade: number) {
    this.alive = false;
    for (const id of this.timers) clearTimeout(id);
    const t = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(t);
    this.bus.gain.setValueAtTime(this.bus.gain.value, t);
    this.bus.gain.linearRampToValueAtTime(0, t + fade);
    this.current?.stop(t + fade);
    window.setTimeout(() => {
      for (const n of this.nodes) { try { (n as AudioScheduledSourceNode).stop?.(); } catch {} try { n.disconnect(); } catch {} }
      try { this.bus.disconnect(); } catch {}
    }, (fade + 9) * 1000);
  }
}

let amb: Ambient | null = null;
const LEVEL = 0.08; // ≈ −22 dB on the bus; the pads themselves peak well below 0 dBFS (≈ −24 dBFS overall)

/** Starts the ambient music (call from a user gesture). */
export function musicStart() {
  const { ctx, music } = audio();
  if (amb) return;
  amb = new Ambient();
  amb.start();
  const t = ctx.currentTime;
  music.gain.cancelScheduledValues(t);
  music.gain.setValueAtTime(music.gain.value, t);
  music.gain.linearRampToValueAtTime(LEVEL, t + 4);
}

export function musicStop() {
  if (!amb) return;
  const { ctx, music } = audio();
  const t = ctx.currentTime;
  music.gain.cancelScheduledValues(t);
  music.gain.setValueAtTime(music.gain.value, t);
  music.gain.linearRampToValueAtTime(0, t + 2.5);
  amb.dispose(2.5);
  amb = null;
}

export const musicPlaying = () => !!amb;

/** The presenter switched the music off: the tour will not switch it back on. */
let userOff = false;
export const musicUserOff = () => userOff;
export function setMusicUserOff(v: boolean) { userOff = v; }
