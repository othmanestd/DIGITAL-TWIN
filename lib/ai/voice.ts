"use client";
// Voice questions (Ctrl+Space, "atlas:voice", mic buttons). Listening uses the browser's speech recognition (fr-FR, live
// interim text) when available; otherwise the audio is recorded, cut on silence and transcribed by /api/transcribe.
// The final transcript goes to ask(…, {voice:true}): cursor actions + spoken answer.
import { useApp } from "../store";
import { useAi } from "./ui";
import { audio } from "./audio";
import { ask, cancelAsk } from "./ask";
import { speaker } from "./speech";

type SR = {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; onspeechend?: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};

export let micAnalyser: AnalyserNode | null = null;
let stream: MediaStream | null = null;
let rec: SR | null = null;
let recorder: MediaRecorder | null = null;
let session = 0;
let closeTimer = 0;
let submitted = false;

const SRClass = (): (new () => SR) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
};

function releaseMic() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  micAnalyser = null;
}

function note(t: string) { useAi.getState().set({ voiceNote: t }); }

export function voiceActive() { return useAi.getState().voiceOpen; }

/** Ctrl+Space: starts listening; pressed again, it ends listening (and sends) or stops Jabby speaking. */
export async function toggleVoice() {
  const v = useApp.getState().voice;
  if (useAi.getState().voiceOpen) {
    if (v === "listening") return finishListening();
    return cancelVoice();
  }
  return startVoice();
}

export async function startVoice() {
  const my = ++session;
  clearTimeout(closeTimer);
  submitted = false;
  cancelAsk();
  speaker.stop();
  const a = audio(); // created inside the user gesture
  window.dispatchEvent(new CustomEvent("atlas:ai-voice-start"));
  useAi.getState().set({ voiceOpen: true, heard: "", heardFinal: false, answer: "", voiceNote: "Jabby vous écoute…" });
  useApp.getState().setVoice("listening");

  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    const n = (e as { name?: string }).name || "";
    note(n === "NotAllowedError" || n === "SecurityError" ? "Le micro est bloqué : autorisez-le dans la barre d'adresse, puis réessayez." : n === "NotFoundError" ? "Aucun micro détecté. Vous pouvez écrire votre question à Jabby (touche J)." : "Impossible d'activer le micro.");
    useApp.getState().setVoice("idle");
    return;
  }
  if (my !== session) { releaseMic(); return; }
  const src = a.ctx.createMediaStreamSource(stream);
  const an = a.ctx.createAnalyser();
  an.fftSize = 1024; an.smoothingTimeConstant = 0.55;
  src.connect(an);
  micAnalyser = an;

  const C = SRClass();
  if (C) listenWithSR(C, my);
  else listenWithRecorder(my);
}

function listenWithSR(C: new () => SR, my: number) {
  const r = new C();
  rec = r;
  r.lang = "fr-FR"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let finalText = "";
  let interim = "";
  let failedOver = false;
  r.onresult = (e) => {
    interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    useAi.getState().set({ heard: (finalText + " " + interim).trim(), voiceNote: "" });
  };
  r.onerror = (e) => {
    if (my !== session) return;
    if (e.error === "network" || e.error === "service-not-allowed" || e.error === "language-not-supported") {
      failedOver = true;
      rec = null;
      listenWithRecorder(my);
    } else if (e.error === "not-allowed") note("Le micro est bloqué : autorisez-le dans la barre d'adresse, puis réessayez.");
    else if (e.error === "no-speech") note("Je n'ai rien entendu. Appuyez sur Ctrl+Espace pour réessayer.");
  };
  r.onend = () => {
    if (my !== session || failedOver) return;
    rec = null;
    const text = (finalText || interim).trim();
    if (text) submit(text, my);
    else { releaseMic(); useApp.getState().setVoice("idle"); if (!useAi.getState().voiceNote) note("Je n'ai rien entendu. Appuyez sur Ctrl+Espace pour réessayer."); scheduleClose(3200); }
  };
  try { r.start(); } catch { rec = null; listenWithRecorder(my); }
}

function listenWithRecorder(my: number) {
  if (!stream) return;
  const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
  let mr: MediaRecorder;
  try { mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch { note("Ce navigateur ne permet pas la dictée. Écrivez votre question à Jabby (touche J)."); return; }
  recorder = mr;
  const parts: Blob[] = [];
  let cancelled = false;
  mr.ondataavailable = (e) => { if (e.data.size) parts.push(e.data); };
  mr.onstop = async () => {
    recorder = null;
    if (cancelled || my !== session) return;
    const blob = new Blob(parts, { type: mr.mimeType || "audio/webm" });
    releaseMic();
    useApp.getState().setVoice("thinking");
    note("Transcription…");
    try {
      const r = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": blob.type }, body: blob });
      const j = await r.json();
      if (my !== session) return;
      const text = String(j.text || "").trim();
      if (text) submit(text, my);
      else { useApp.getState().setVoice("idle"); note("Je n'ai rien entendu. Appuyez sur Ctrl+Espace pour réessayer."); scheduleClose(3200); }
    } catch {
      useApp.getState().setVoice("idle");
      note("La transcription n'a pas abouti. Réessayez, ou écrivez votre question (touche J).");
    }
  };
  (mr as MediaRecorder & { _cancel?: () => void })._cancel = () => { cancelled = true; };
  mr.start(250);
  note("Jabby vous écoute…");
  // end of speech: 1.1 s of silence after some speech; nothing said in 7 s; 20 s max
  const t0 = performance.now();
  let spoke = false, lastLoud = t0;
  const buf = new Float32Array(1024);
  const tick = () => {
    if (my !== session || recorder !== mr || mr.state !== "recording") return;
    const an = micAnalyser;
    if (an) {
      an.getFloatTimeDomainData(buf);
      let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
      const rms = Math.sqrt(s / buf.length);
      const now = performance.now();
      if (rms > 0.025) { spoke = true; lastLoud = now; }
      if ((spoke && now - lastLoud > 1100) || (!spoke && now - t0 > 7000) || now - t0 > 20000) { mr.stop(); return; }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Ends listening now and sends what was heard. */
export function finishListening() {
  if (rec) { try { rec.stop(); } catch {} return; }
  if (recorder && recorder.state === "recording") { recorder.stop(); return; }
}

async function submit(text: string, my: number) {
  if (submitted || my !== session) return;
  submitted = true;
  releaseMic();
  useAi.getState().set({ heard: text, heardFinal: true, voiceNote: "" });
  useApp.getState().setVoice("thinking");
  await ask(text, { voice: true });
  if (my !== session) return;
  scheduleClose(2600);
}

function scheduleClose(ms: number) {
  const my = session;
  clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => {
    if (my !== session) return;
    const v = useApp.getState().voice;
    if (v === "idle") useAi.getState().set({ voiceOpen: false });
  }, ms);
}

/** Esc: stops everything (listening, thinking, speaking) and closes the overlay. */
export function cancelVoice() {
  session++;
  clearTimeout(closeTimer);
  if (rec) { try { rec.abort(); } catch {} rec = null; }
  if (recorder) { (recorder as MediaRecorder & { _cancel?: () => void })._cancel?.(); try { recorder.stop(); } catch {} recorder = null; }
  releaseMic();
  cancelAsk();
  speaker.stop();
  useApp.getState().setVoice("idle");
  useAi.getState().set({ voiceOpen: false, voiceNote: "" });
}
