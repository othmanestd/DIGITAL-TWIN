"use client";
// One AudioContext for the whole AI layer: music bus (ducked under speech), voice bus (Jabby's answers) and an analyser
// for the waveform. Created lazily inside a user gesture (browser autoplay rules).

type Graph = { ctx: AudioContext; master: GainNode; music: GainNode; duck: GainNode; voice: GainNode; analyser: AnalyserNode };
let g: Graph | null = null;

export function audio(): Graph {
  if (g) {
    if (g.ctx.state === "suspended") g.ctx.resume().catch(() => {});
    return g;
  }
  const AC: typeof AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AC({ latencyHint: "interactive" });
  const master = ctx.createGain();
  master.gain.value = 1;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  master.connect(comp).connect(ctx.destination);
  const duck = ctx.createGain();
  duck.gain.value = 1;
  const music = ctx.createGain();
  music.gain.value = 0;
  music.connect(duck).connect(master);
  const voice = ctx.createGain();
  voice.gain.value = 1;
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.6;
  voice.connect(analyser);
  voice.connect(master);
  g = { ctx, master, music, duck, voice, analyser };
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return g;
}

export const hasAudio = () => !!g;

/** Lowers the music under speech (narration or Jabby's voice), then brings it back slowly. */
let duckers = 0;
export function duck(on: boolean) {
  if (!g) return;
  duckers = Math.max(0, duckers + (on ? 1 : -1));
  const t = g.ctx.currentTime;
  const p = g.duck.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  if (duckers > 0) p.linearRampToValueAtTime(0.32, t + 0.5);
  else p.linearRampToValueAtTime(1, t + 1.8);
}
export function resetDuck() { duckers = 1; duck(false); }
