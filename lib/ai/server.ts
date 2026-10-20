// Server-side AI helpers (route handlers only — never import from a client component: it reads secrets from process.env).
import "server-only";

export const env = {
  azureBase: () => (process.env.AZURE_PROXY_BASE || "").replace(/\/+$/, ""),
  azureVersion: () => process.env.AZURE_API_VERSION || "2025-04-01-preview",
  chatModel: () => process.env.AZURE_CHAT_MODEL || "gpt-5.4-mini",
  gemini: () => process.env.GEMINI_API_KEY || "",
};

// streaming models first (each has its own daily quota), then the non-streaming fallback
export const TTS_MODELS = () => [...new Set([process.env.TTS_MODEL, "gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts", "gemini-2.5-flash-preview-tts"].filter(Boolean) as string[])];
export const TTS_VOICE = () => process.env.TTS_VOICE || "Iapetus";

export function chatUrl(model = env.chatModel()) {
  return `${env.azureBase()}/openai/deployments/${model}/chat/completions?api-version=${env.azureVersion()}`;
}

/** Text → what a narrator reads aloud: units spelled out, no markdown, no parenthesised glossary duplicates. */
export function spoken(s: string): string {
  return s
    .replace(/\*\*|__|`|#+\s/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s*\((?:millions? de dirhams|milliers de dirhams|équivalents? temps plein[^)]*|retour sur investissement|dirhams marocains)\)/gi, "")
    .replace(/(\d)\s?MDH\b/g, "$1 millions de dirhams")
    .replace(/\bMDH\b/g, "millions de dirhams")
    .replace(/(\d)\s?kMAD\b/g, "$1 mille dirhams")
    .replace(/\bETP-éq\.?/g, "équivalents temps plein")
    .replace(/\bETP\b/g, "équivalents temps plein")
    .replace(/\b([ASPHT])-0?(\d{1,2})\b/g, (_, l: string, n: string) => `${l} ${n}`)
    .replace(/→/g, ", ")
    .replace(/≈\s?/g, "environ ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 24 kHz mono 16-bit PCM → WAV. */
export function wav(pcm: Buffer, rate = 24000): Buffer {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Strips a WAV header if the model returned one (newer TTS models do), so PCM chunks can be streamed back to back. */
export function pcmOf(b: Buffer): Buffer {
  if (b.length > 44 && b.subarray(0, 4).toString("latin1") === "RIFF") {
    // find the "data" chunk
    let o = 12;
    while (o + 8 <= b.length) {
      const id = b.subarray(o, o + 4).toString("latin1");
      const len = b.readUInt32LE(o + 4);
      // honour the declared length: newer TTS models append a metadata chunk after the samples (it played as a burst of static)
      if (id === "data") return len > 0 && len !== 0xffffffff && o + 8 + len <= b.length ? b.subarray(o + 8, o + 8 + len) : b.subarray(o + 8);
      o += 8 + len;
    }
    return b.subarray(44);
  }
  return b;
}
