// Jabby's voice. POST {text} → audio.
// Default: streamed raw PCM (16-bit, 24 kHz, mono; header x-audio: pcm16-24k) from Gemini TTS streaming — first audio in ≈1 s.
// Fallback: a whole WAV file (older model, no streaming). The client handles both, and falls back to speechSynthesis on error.
import { env, spoken, TTS_MODELS, TTS_VOICE, pcmOf, wav } from "@/lib/ai/server";

export const maxDuration = 60;
const API = "https://generativelanguage.googleapis.com/v1beta/models";

function body(text: string, model: string, voice: string) {
  // gemini-2.5 TTS follows a style lead-in; newer models read it aloud, so they get the bare text.
  const t = model.startsWith("gemini-2.5") ? `Lis en français, d'une voix calme, chaleureuse et posée : ${text}` : text;
  return JSON.stringify({ contents: [{ role: "user", parts: [{ text: t }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } });
}

export async function POST(req: Request) {
  let b: { text?: string; voice?: string; raw?: boolean };
  try { b = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  const text = (b.raw ? String(b.text || "") : spoken(String(b.text || ""))).slice(0, 1200);
  if (text.length < 2) return Response.json({ error: "empty" }, { status: 400 });
  const key = env.gemini();
  if (!key) return Response.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  const voice = /^[A-Z][a-z]+$/.test(String(b.voice || "")) ? String(b.voice) : TTS_VOICE();
  const models = TTS_MODELS();
  const streaming = models.filter((m) => !m.startsWith("gemini-2.5"));
  const rest = models.filter((m) => m.startsWith("gemini-2.5"));

  // 1) streaming models in order (a quota refusal, 429, moves to the next one) → raw PCM stream
  for (const primary of streaming) try {
    const up = await fetch(`${API}/${primary}:streamGenerateContent?alt=sse&key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: body(text, primary, voice), signal: req.signal });
    if (up.ok && up.body) {
      const rd = up.body.getReader();
      const dec = new TextDecoder();
      // wait for the first audio chunk before answering, so a refusal can still fall back
      let buf = "";
      const pending: Buffer[] = [];
      let finished = false;
      const pull = async (): Promise<boolean> => {
        const { value, done } = await rd.read();
        if (done) { finished = true; return false; }
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try {
            const j = JSON.parse(line.slice(5));
            for (const p of j?.candidates?.[0]?.content?.parts || []) if (p?.inlineData?.data) pending.push(pcmOf(Buffer.from(p.inlineData.data, "base64")));
          } catch {}
        }
        return true;
      };
      while (!pending.length && !finished) await pull();
      if (pending.length) {
        const stream = new ReadableStream({
          async pull(controller) {
            try {
              while (!pending.length && !finished) await pull();
              if (pending.length) { controller.enqueue(new Uint8Array(Buffer.concat(pending.splice(0)))); return; }
              controller.close();
            } catch { try { controller.close(); } catch {} }
          },
          cancel() { rd.cancel().catch(() => {}); },
        });
        return new Response(stream, { headers: { "content-type": "audio/L16; rate=24000; channels=1", "x-audio": "pcm16-24k", "cache-control": "no-store", "x-tts-model": primary } });
      }
    }
  } catch {
    if (req.signal.aborted) return new Response(null, { status: 499 });
  }

  // 2) fallback models → whole WAV
  for (const model of rest) {
    try {
      const r = await fetch(`${API}/${model}:generateContent?key=${key}`, { method: "POST", headers: { "content-type": "application/json" }, body: body(text, model, voice), signal: req.signal });
      const j = await r.json();
      const p = (j?.candidates?.[0]?.content?.parts || []).find((x: { inlineData?: { data?: string } }) => x?.inlineData?.data);
      if (!p) continue;
      const out = wav(pcmOf(Buffer.from(p.inlineData.data, "base64")));
      return new Response(new Uint8Array(out), { headers: { "content-type": "audio/wav", "cache-control": "no-store", "x-tts-model": model } });
    } catch {}
  }
  return Response.json({ error: "tts unavailable" }, { status: 502 });
}
