// Dictation fallback (browsers without the Web Speech API): POST the recorded audio (raw body, content-type = its mime) → {text}.
import { env } from "@/lib/ai/server";

export const maxDuration = 60;
const API = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELS = () => [...new Set([process.env.TRANSCRIBE_MODEL, "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean) as string[])];

const PROMPT =
  "Transcris exactement ce que dit la personne, dans la langue parlée (français, arabe, darija ou anglais). Contexte : une présentation du programme d'agents IA d'Akdital (groupe hospitalier marocain) par Mibtech et JABB ; mots probables : Akdital, Jabby, JABB, Mibtech, MDH, ETP, ROI, Agentic Command Center, admissions, prise en charge, AMO, CNSS, Oryon. Réponds uniquement par la transcription, sans guillemets. Si rien n'est audible, réponds par une chaîne vide.";

export async function POST(req: Request) {
  const key = env.gemini();
  if (!key) return Response.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
  const mime = (req.headers.get("content-type") || "audio/webm").split(";")[0].trim();
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length < 800) return Response.json({ text: "" });
  if (buf.length > 12 * 1024 * 1024) return Response.json({ error: "too long" }, { status: 413 });
  const t0 = Date.now();
  for (const model of MODELS()) {
    try {
      const r = await fetch(`${API}/${model}:generateContent?key=${key}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: PROMPT }, { inlineData: { mimeType: mime, data: buf.toString("base64") } }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 600, ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
        }),
        signal: req.signal,
      });
      const j = await r.json();
      const text = String(j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "").replace(/^["«»“”\s]+|["«»“”\s]+$/g, "");
      if (r.ok) return Response.json({ text, ms: Date.now() - t0, model });
    } catch {
      if (req.signal.aborted) return new Response(null, { status: 499 });
    }
  }
  return Response.json({ error: "transcription unavailable" }, { status: 502 });
}
