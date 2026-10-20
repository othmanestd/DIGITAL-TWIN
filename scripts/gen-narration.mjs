// Records the narration of BOTH guided visits (lib/ai/tour-script.json = express, lib/ai/tour-complete.json = complete)
// with ONE model and ONE voice, into public/audio/tour/<id>.mp3 + manifest.json (duration, text hash, model, voice).
// The player plays from these files only when every beat of a visit matches (same model, same voice, current text);
// otherwise that visit is spoken live by one browser voice. Nothing is ever mixed.
//   node scripts/build-tour.mjs && node scripts/gen-narration.mjs --uniform   ← all it takes once the Gemini cap is raised
//   --uniform  also redoes beats recorded with another model or voice   · --force  redoes every beat
//   --verify   transcribes each file back (checks nothing extra was read aloud)
//   TTS_MODEL=… TTS_VOICE=… to choose the model / voice (default gemini-3.8-flash-tts / Iapetus) · TTS_WORKERS=3
// Exit code 1 and a "NOT READY" verdict when any beat is missing, out of date or from another model/voice.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public", "audio", "tour");
const SCRIPT = JSON.parse(fs.readFileSync(path.join(ROOT, "lib", "ai", "tour-script.json"), "utf8"));
// chapters → beats (v2), or a flat beats list (v1); both tours (express + complete), each beat id once
const flat = (s) => (s.chapters ? s.chapters.flatMap((c) => c.beats) : s.beats || []);
const COMPLETE_PATH = path.join(ROOT, "lib", "ai", "tour-complete.json");
const ALL = [...flat(SCRIPT), ...(fs.existsSync(COMPLETE_PATH) ? flat(JSON.parse(fs.readFileSync(COMPLETE_PATH, "utf8"))) : [])];
const BEATS = ALL.filter((b, i) => ALL.findIndex((x) => String(x.id) === String(b.id)) === i);
const args = new Set(process.argv.slice(2));

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const i = l.indexOf("=");
      if (i > 0 && !l.trim().startsWith("#")) { const k = l.slice(0, i).trim(); if (!(k in process.env)) process.env[k] = l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
    }
  }
}
loadEnv();
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("GEMINI_API_KEY missing (.env.local)"); process.exit(1); }
// ONE model and ONE voice for the whole narration (the player only uses recorded audio when every beat matches)
const MODELS = [process.env.TTS_MODEL || "gemini-3.8-flash-tts"];
const VOICE = process.env.TTS_VOICE || SCRIPT.voice || "Iapetus";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

const hasFfmpeg = (() => { try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();

function wav(pcm, rate = 24000) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}
function pcmOf(b) {
  if (b.subarray(0, 4).toString("latin1") !== "RIFF") return b;
  let o = 12;
  while (o + 8 <= b.length) { const id = b.subarray(o, o + 4).toString("latin1"); const len = b.readUInt32LE(o + 4); if (id === "data") return len > 0 && len !== 0xffffffff && o + 8 + len <= b.length ? b.subarray(o + 8, o + 8 + len) : b.subarray(o + 8); /* trailing metadata chunk = static burst */ o += 8 + len; }
  return b.subarray(44);
}

async function tts(text) {
  let last = "";
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t = model.startsWith("gemini-2.5") ? `Lis en français, d'une voix calme, chaleureuse et posée de narrateur : ${text}` : text;
        const r = await fetch(`${API}/${model}:generateContent?key=${KEY}`, {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: t }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } } }),
        });
        const j = await r.json();
        const p = (j?.candidates?.[0]?.content?.parts || []).find((x) => x?.inlineData?.data);
        if (p) return { pcm: pcmOf(Buffer.from(p.inlineData.data, "base64")), model };
        last = JSON.stringify(j).slice(0, 200);
        if (j?.error?.code === 429) {
          // daily quota or spending cap: no point retrying today; per-minute limit: wait and retry
          if (/per.?day|spending cap|monthly/i.test(String(j?.error?.message))) break;
          await new Promise((r) => setTimeout(r, 20000));
        }
      } catch (e) { last = String(e.message || e); }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error("TTS failed: " + last);
}

/** Trims leading/trailing silence (keeps 120 ms) so beats chain tightly. */
function trim(pcm) {
  const s = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.length - (pcm.length % 2)));
  const th = 220, keep = 24000 * 0.12;
  let a = 0; while (a < s.length && Math.abs(s[a]) < th) a++;
  let b = s.length - 1; while (b > a && Math.abs(s[b]) < th) b--;
  // guard: if the last ~300 ms after a silent gap is a loud burst (container junk), cut before the gap
  { const w = 240; let k = b; while (k > a && Math.abs(s[k]) > 3000) k--; let g = 0, j = k; while (j > a && Math.abs(s[j]) < th) { j--; g++; } if (b - k < 24000 * 0.3 && g > w) b = j; }
  a = Math.max(0, a - keep); b = Math.min(s.length, b + keep * 2);
  return Buffer.from(s.slice(a, b).buffer);
}

async function transcribe(buf, mime) {
  const r = await fetch(`${API}/gemini-2.5-flash:generateContent?key=${KEY}`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Transcris exactement ce qui est dit, sans commentaire." }, { inlineData: { mimeType: mime, data: buf.toString("base64") } }] }], generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } } }),
  });
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
}

fs.mkdirSync(OUT, { recursive: true });
const manPath = path.join(OUT, "manifest.json");
const old = fs.existsSync(manPath) ? JSON.parse(fs.readFileSync(manPath, "utf8")) : { beats: {} };
const manifest = { generated: new Date().toISOString(), voice: VOICE, beats: { ...(old.beats || {}) } };

const todo = BEATS.filter((b) => {
  const hash = crypto.createHash("sha1").update(VOICE + "|" + (b.speech || b.text)).digest("hex").slice(0, 12);
  b._hash = hash;
  const prev = manifest.beats[b.id];
  // --uniform: also redo the beats voiced by a fallback model (quota), so the whole tour has one timbre
  return args.has("--force") || !prev || prev.hash !== hash || !fs.existsSync(path.join(OUT, prev.file)) || (args.has("--uniform") && (prev.model !== MODELS[0] || (prev.voice ?? old.voice) !== VOICE));
});
console.log(`${todo.length} beat(s) to generate with ${MODELS[0]} / ${VOICE}${hasFfmpeg ? " → mp3" : " → wav"}`);

let i = 0;
const failed = [];
async function worker() {
  while (i < todo.length) {
    const b = todo[i++];
    const t0 = Date.now();
    let got;
    try { got = await tts(b.speech || b.text); } catch (e) { failed.push(b.id); console.log(`  #${b.id} FAILED: ${String(e.message).slice(0, 140)}`); continue; }
    const { pcm: raw, model } = got;
    const pcm = trim(raw);
    const dur = pcm.length / 48000;
    const wavBuf = wav(pcm);
    let file = `${b.id}.wav`;
    if (hasFfmpeg) {
      const tmp = path.join(OUT, `${b.id}.tmp.wav`);
      fs.writeFileSync(tmp, wavBuf);
      file = `${b.id}.mp3`;
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", tmp, "-af", "afade=t=in:d=0.04", "-ac", "1", "-ar", "24000", "-codec:a", "libmp3lame", "-b:a", "80k", path.join(OUT, file)]);
      fs.unlinkSync(tmp);
      const stale = path.join(OUT, `${b.id}.wav`); if (fs.existsSync(stale)) fs.unlinkSync(stale);
    } else fs.writeFileSync(path.join(OUT, file), wavBuf);
    manifest.beats[b.id] = { file, duration: Math.round(dur * 100) / 100, hash: b._hash, model, voice: VOICE };
    let check = "";
    if (args.has("--verify")) check = "\n      heard: " + (await transcribe(wavBuf, "audio/wav"));
    console.log(`  #${b.id} ${dur.toFixed(1)} s  (${model}, ${Date.now() - t0} ms)${check}`);
  }
}
await Promise.all(Array.from({ length: Number(process.env.TTS_WORKERS || 3) }, worker));
// drop beats no longer in the script
for (const id of Object.keys(manifest.beats)) if (!BEATS.some((b) => String(b.id) === id)) delete manifest.beats[id];
fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2));
const total = Object.values(manifest.beats).reduce((s, b) => s + b.duration, 0);
console.log(`done · ${Object.keys(manifest.beats).length} beats · ${total.toFixed(0)} s of narration · ${manPath}`);
// remove audio files no longer referenced (keeps the committed folder clean)
const keepFiles = new Set(Object.values(manifest.beats).map((b) => b.file).concat("manifest.json"));
for (const f of fs.readdirSync(OUT)) if (!keepFiles.has(f) && /\.(mp3|wav)$/.test(f)) fs.unlinkSync(path.join(OUT, f));
// final verdict, per visit: every beat present, ONE model, ONE voice, hash of the current text
const visits = [["Visite express", flat(SCRIPT)], ["Visite complète", fs.existsSync(COMPLETE_PATH) ? flat(JSON.parse(fs.readFileSync(COMPLETE_PATH, "utf8"))) : []]];
let ok = !failed.length;
for (const [name, beats] of visits) {
  const missing = [], models = new Set(), voices = new Set();
  let dur = 0;
  for (const b of beats) {
    const e = manifest.beats[String(b.id)];
    const h = crypto.createHash("sha1").update(VOICE + "|" + (b.speech || b.text)).digest("hex").slice(0, 12);
    if (!e || e.hash !== h || !fs.existsSync(path.join(OUT, e.file))) { missing.push(b.id); continue; }
    models.add(e.model); voices.add(e.voice ?? manifest.voice); dur += e.duration + 0.6;
  }
  const ready = !missing.length && models.size === 1 && voices.size === 1;
  ok = ok && ready;
  console.log(ready
    ? `READY  ${name}: ${beats.length} beats from files, ${[...models][0]} / ${[...voices][0]}, ${Math.floor(dur / 60)} min ${String(Math.round(dur % 60)).padStart(2, "0")} s`
    : `NOT READY  ${name}: ${missing.length} beat(s) missing or out of date${models.size > 1 ? `, ${models.size} models mixed` : ""}${voices.size > 1 ? `, ${voices.size} voices mixed` : ""} — the visit will play LIVE (browser voice) until this is fixed`);
}
if (!ok) {
  console.error(`
✗ NARRATION INCOMPLETE${failed.length ? ` (${failed.length} beat(s) failed: ${failed.join(", ")})` : ""}. Nothing is mixed: an incomplete visit plays live. Re-run: node scripts/gen-narration.mjs --uniform`);
  process.exitCode = 1;
}
