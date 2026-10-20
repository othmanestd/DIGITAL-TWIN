"use client";
// Sends a question to /api/chat, streams the answer into the chat, runs the returned tool calls through the cursor and,
// in voice mode, speaks the answer as it streams.
import { useApp } from "../store";
import { useAi, uid } from "./ui";
import { OpQueue, opOf, opLabel } from "./actions";
import { cursorRest } from "./cursor";
import { speaker, SentenceFeeder } from "./speech";
import { parseToolCall } from "./tools";

const queue = new OpQueue();
let ctrl: AbortController | null = null;

export function cancelAsk() {
  ctrl?.abort();
  ctrl = null;
  queue.cancel();
  speaker.stop();
  useAi.getState().set({ busy: false });
}

export async function ask(text: string, opts: { voice?: boolean } = {}) {
  const q = text.trim();
  if (!q) return;
  cancelAsk();
  const ai = useAi.getState();
  const app = useApp.getState();
  const history = ai.messages.filter((m) => !m.error && m.text).map((m) => ({ role: m.role, content: m.text }));
  const me = { id: uid(), role: "user" as const, text: q, actions: [], voice: opts.voice };
  const bot = { id: uid(), role: "assistant" as const, text: "", actions: [] as string[], pending: true, voice: opts.voice };
  ai.push(me);
  ai.push(bot);
  ai.set({ busy: true, answer: "" });
  if (opts.voice) app.setVoice("thinking");

  const c = new AbortController();
  ctrl = c;
  const feeder = opts.voice ? new SentenceFeeder() : null;
  let answer = "";
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: c.signal,
      body: JSON.stringify({
        voice: !!opts.voice,
        messages: [...history, { role: "user", content: q }],
        state: { level: app.level, section: app.section, sel: app.sel, caseId: app.caseId, year: app.year, perSite: app.perSite },
      }),
    });
    if (!r.ok || !r.body) throw new Error(String(r.status));
    const rd = r.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await rd.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let ev: { type: string; delta?: string; name?: string; args?: unknown; message?: string };
        try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === "text" && ev.delta) {
          answer += ev.delta;
          useAi.getState().patch(bot.id, () => ({ text: answer }));
          if (opts.voice) useAi.getState().set({ answer });
          feeder?.push(ev.delta);
        } else if (ev.type === "tool" && ev.name) {
          const call = parseToolCall(ev.name, JSON.stringify(ev.args ?? {}));
          const op = call && opOf(call);
          if (op) {
            useAi.getState().patch(bot.id, (m) => ({ actions: [...m.actions, opLabel(op)] }));
            queue.push(op);
          }
        } else if (ev.type === "error") {
          throw new Error(ev.message || "error");
        }
      }
    }
    useAi.getState().patch(bot.id, () => ({ pending: false, text: answer || "Je n'ai pas de réponse à cette question." }));
  } catch (e) {
    if (c.signal.aborted) { useAi.getState().patch(bot.id, () => ({ pending: false })); return; }
    const msg = "Je n'arrive pas à joindre mon moteur pour l'instant. Réessayez dans un instant.";
    useAi.getState().patch(bot.id, () => ({ pending: false, error: true, text: msg }));
    if (opts.voice) { useAi.getState().set({ answer: msg }); speaker.say(msg); }
    void e;
  } finally {
    feeder?.end(!c.signal.aborted);
    if (ctrl === c) ctrl = null;
    useAi.getState().set({ busy: false });
    await queue.done();
    if (!useApp.getState().tour.playing) cursorRest(1400);
    if (opts.voice) {
      await speaker.idle();
      const s = useApp.getState();
      if (s.voice === "thinking") s.setVoice("idle");
    }
  }
}
