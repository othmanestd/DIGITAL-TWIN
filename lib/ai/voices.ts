"use client";
// One French browser voice for everything spoken live (guided tour in live mode, Jabby's answers when the TTS API is
// unavailable). Chosen once, deterministically: Edge natural voices first, then Google français, then the best fr-FR.

const PREF: RegExp[] = [
  /Microsoft Remy Online \(Natural\)/i,
  /Microsoft Henri Online \(Natural\)/i,
  /Microsoft Denise Online \(Natural\)/i,
  /Microsoft \w+ Online \(Natural\).*(French|France)/i,
  /^Google français$/i,
];
export const LIVE_RATE = 1;
export const LIVE_PITCH = 1;
/** Speaking speed used to estimate live durations (characters per second). */
export const CPS = 14.5;

let chosen: SpeechSynthesisVoice | null | undefined;
let pending: Promise<SpeechSynthesisVoice | null> | null = null;

function rank(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  for (const re of PREF) { const v = voices.find((x) => re.test(x.name)); if (v) return v; }
  const fr = voices.filter((v) => /^fr(-|_|$)/i.test(v.lang || "")).sort((a, b) => a.name.localeCompare(b.name));
  const frFR = fr.filter((v) => /fr[-_]FR/i.test(v.lang));
  return frFR.find((v) => /natural|neural|online/i.test(v.name)) || frFR.find((v) => v.localService) || frFR[0] || fr[0] || null;
}

/** The voice of the whole session (null when the browser has no French voice: timing then falls back to estimates). */
export function frenchVoice(): Promise<SpeechSynthesisVoice | null> {
  if (chosen !== undefined) return Promise.resolve(chosen);
  if (pending) return pending;
  pending = new Promise((resolve) => {
    if (typeof speechSynthesis === "undefined") { chosen = null; return resolve(null); }
    const done = () => {
      const v = rank(speechSynthesis.getVoices());
      if (v || performance.now() - t0 > 1500) { chosen = v; clearInterval(id); speechSynthesis.removeEventListener?.("voiceschanged", done); resolve(v); }
    };
    const t0 = performance.now();
    const id = window.setInterval(done, 150);
    speechSynthesis.addEventListener?.("voiceschanged", done);
    done();
  });
  return pending;
}
export const voiceName = () => (chosen ? chosen.name.replace(/\s*-\s*French.*$/i, "") : chosen === null ? "aucune voix française" : "");

/** Speaks one sentence with the session voice. Resolves true when it ended, false when interrupted (abort()). */
export function utter(text: string, onAbort: (abort: () => void) => void): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;
    let safety = 0;
    const est = text.length / CPS;
    const fin = (ok: boolean) => { if (finished) return; finished = true; clearTimeout(safety); resolve(ok); };
    // no speech engine or no French voice: keep the rhythm with the estimate, silently
    if (typeof speechSynthesis === "undefined" || !chosen) {
      const t = window.setTimeout(() => fin(true), est * 1000);
      onAbort(() => { clearTimeout(t); fin(false); });
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.voice = chosen; u.lang = chosen.lang || "fr-FR"; u.rate = LIVE_RATE; u.pitch = LIVE_PITCH;
    let aborted = false;
    u.onend = () => fin(!aborted);
    u.onerror = () => fin(!aborted);
    safety = window.setTimeout(() => fin(true), (est * 1.8 + 5) * 1000); // a lost "end" event never blocks the tour
    onAbort(() => { aborted = true; speechSynthesis.cancel(); fin(false); });
    if (speechSynthesis.paused) speechSynthesis.resume();
    speechSynthesis.speak(u);
  });
}
