"use client";
// Jabby speaking. Text is cut into chunks (first sentence alone, so the voice starts fast); each chunk is fetched from
// /api/tts as soon as it is known (streamed 24 kHz PCM, played as it arrives through Web Audio), chunks play back to back.
// If the API fails, the browser's own French voice (speechSynthesis) reads that chunk.
import { audio, duck } from "./audio";
import { useApp } from "../store";
import { frenchVoice, utter } from "./voices";

type Item = { text: string; chunks: Float32Array[]; done: boolean; failed: boolean; wav?: AudioBuffer; wake?: () => void; ctrl: AbortController };

const RATE = 24000;

class Speaker {
  private items: Item[] = [];
  private playing = false;
  private sources: AudioBufferSourceNode[] = [];
  private nextT = 0;
  private gen = 0;
  private ducked = false;
  private holding = false;          // a producer (streamed answer) may still add text: do not finish in between
  private holdWake: (() => void) | null = null;
  onCaption: ((text: string) => void) | null = null;
  onEnd: (() => void) | null = null;

  get busy() { return this.playing || this.items.length > 0 || this.holding; }

  /** While held, the speaker waits for more text instead of ending between two chunks of a streamed answer. */
  hold(v: boolean) {
    this.holding = v;
    const w = this.holdWake; this.holdWake = null; w?.();
  }

  /** Queue a chunk of text (a sentence or more). */
  say(text: string) {
    const t = text.trim();
    if (!t) return;
    const it: Item = { text: t, chunks: [], done: false, failed: false, ctrl: new AbortController() };
    this.items.push(it);
    this.fetchItem(it);
    const w = this.holdWake; this.holdWake = null; w?.();
    if (!this.playing) this.run();
  }

  private async fetchItem(it: Item) {
    try {
      const r = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: it.text }), signal: it.ctrl.signal });
      if (!r.ok || !r.body) throw new Error("tts " + r.status);
      if ((r.headers.get("content-type") || "").includes("wav")) {
        const ab = await r.arrayBuffer();
        it.wav = await audio().ctx.decodeAudioData(ab);
      } else {
        const rd = r.body.getReader();
        let carry: number | null = null;
        for (;;) {
          const { value, done } = await rd.read();
          if (done) break;
          let bytes = value;
          if (carry !== null) { const b = new Uint8Array(bytes.length + 1); b[0] = carry; b.set(bytes, 1); bytes = b; carry = null; }
          if (bytes.length % 2) { carry = bytes[bytes.length - 1]; bytes = bytes.subarray(0, bytes.length - 1); }
          const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
          const f = new Float32Array(bytes.length / 2);
          for (let i = 0; i < f.length; i++) f[i] = dv.getInt16(i * 2, true) / 32768;
          it.chunks.push(f);
          it.wake?.();
        }
      }
    } catch {
      if (!it.ctrl.signal.aborted) it.failed = true;
    }
    it.done = true;
    it.wake?.();
  }

  private schedule(f: Float32Array | AudioBuffer) {
    const { ctx, voice } = audio();
    let buf: AudioBuffer;
    if (f instanceof Float32Array) {
      buf = ctx.createBuffer(1, f.length, RATE);
      buf.getChannelData(0).set(f);
    } else buf = f;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(voice);
    const t = Math.max(this.nextT, ctx.currentTime + 0.06);
    src.start(t);
    this.nextT = t + buf.duration;
    this.sources.push(src);
    src.onended = () => { this.sources = this.sources.filter((s) => s !== src); };
  }

  private startSpeaking() {
    if (!this.ducked) { duck(true); this.ducked = true; }
    useApp.getState().setVoice("speaking");
  }

  private async run() {
    this.playing = true;
    const gen = this.gen;
    const { ctx } = audio();
    while (this.items.length && gen === this.gen) {
      const it = this.items[0];
      // wait for data
      while (!it.done && !it.chunks.length && !it.wav) await new Promise<void>((r) => { it.wake = r; });
      if (gen !== this.gen) break;
      this.onCaption?.(it.text);
      if (it.failed && !it.chunks.length && !it.wav) {
        await this.waitUntil(this.nextT, gen);
        this.startSpeaking();
        await browserSay(it.text);
      } else if (it.wav) {
        this.startSpeaking();
        this.schedule(it.wav);
      } else {
        this.startSpeaking();
        let i = 0;
        for (;;) {
          while (i < it.chunks.length) this.schedule(it.chunks[i++]);
          if (it.done) break;
          await new Promise<void>((r) => { it.wake = r; });
          if (gen !== this.gen) break;
        }
      }
      this.items.shift();
      while (!this.items.length && this.holding && gen === this.gen) await new Promise<void>((r) => { this.holdWake = r; });
      if (!this.items.length) await this.waitUntil(this.nextT, gen);
    }
    if (gen === this.gen) this.finish();
    void ctx;
  }

  private waitUntil(t: number, gen: number) {
    // wall-clock deadline too, so a suspended AudioContext can never leave Jabby "speaking" forever
    const deadline = performance.now() + Math.max(0, t - audio().ctx.currentTime) * 1000 + 1500;
    return new Promise<void>((resolve) => {
      const tick = () => {
        if (gen !== this.gen) return resolve();
        const left = t - audio().ctx.currentTime;
        if (left <= 0.02 || performance.now() > deadline) return resolve();
        window.setTimeout(tick, Math.min(250, left * 1000));
      };
      tick();
    });
  }

  private finish() {
    this.playing = false;
    if (this.ducked) { duck(false); this.ducked = false; }
    const s = useApp.getState();
    if (s.voice === "speaking") s.setVoice("idle");
    this.onEnd?.();
  }

  /** Waits until everything queued has been spoken. */
  idle(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => (this.busy ? window.setTimeout(check, 150) : resolve());
      check();
    });
  }

  stop() {
    this.gen++;
    this.hold(false);
    for (const it of this.items) it.ctrl.abort();
    for (const it of this.items) it.wake?.();
    this.items = [];
    for (const s of this.sources) { try { s.stop(); } catch {} }
    this.sources = [];
    this.nextT = 0;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    if (this.playing) this.finish();
    this.playing = false;
  }
}

/** Browser voice fallback (French). */
export async function browserSay(text: string): Promise<void> {
  // the session's single French voice (lib/ai/voices.ts), sentence by sentence
  await frenchVoice();
  for (const part of text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text]) if (part.trim()) await utter(part.trim(), () => {});
}

export const speaker = new Speaker();

/**
 * Feeds a streamed answer to the speaker: the first sentence is sent alone as soon as it is complete, the rest in
 * paragraph-sized chunks, the tail when the stream ends.
 */
export class SentenceFeeder {
  private buf = "";
  private sent = 0;
  constructor() { speaker.hold(true); }
  push(delta: string) {
    this.buf += delta;
    const clean = this.buf;
    const min = this.sent === 0 ? 18 : 160;
    const re = /[.!?…:;](?=\s|$)/g;
    let m: RegExpExecArray | null;
    let cut = -1;
    while ((m = re.exec(clean))) { if (m.index + 1 >= min) { cut = m.index + 1; if (this.sent === 0) break; } }
    if (cut > 0 && /\s/.test(clean.slice(cut, cut + 1) || " ") && clean.length > cut) {
      speaker.say(clean.slice(0, cut));
      this.buf = clean.slice(cut);
      this.sent++;
    }
  }
  end(say = true) {
    if (say && this.buf.trim()) speaker.say(this.buf);
    this.buf = "";
    speaker.hold(false);
  }
}
