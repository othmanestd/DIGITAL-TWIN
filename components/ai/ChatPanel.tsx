"use client";
// Jabby's chat: opens above the dock. Answers stream in, verdict first; the actions Jabby performed show as small chips.
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { useAi } from "@/lib/ai/ui";
import { ask } from "@/lib/ai/ask";
import { startVoice } from "@/lib/ai/voice";
import { JMark, CloseIcon, SendIcon, MicIcon, ArrowIcon } from "./icons";

const SUGGESTIONS = [
  "Combien rapporte le programme, net ?",
  "Montre-moi les admissions",
  "Pourquoi zéro licenciement ?",
  "Que fait l'agent vocal en darija ?",
  "Quand démarre le déploiement ?",
  "Qu'est-ce qui a déjà marché ailleurs pour les admissions ?",
];

/** **bold**, line breaks and "- " lists — enough for Jabby's short answers. */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}
export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: string[] = [];
  let para: string[] = [];
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>); para = []; } };
  const flushList = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (/^[-•*]\s+/.test(l)) { flushPara(); list.push(l.replace(/^[-•*]\s+/, "")); }
    else if (!l) { flushPara(); flushList(); }
    else { flushList(); para.push(l.replace(/^#+\s*/, "")); }
  }
  flushPara(); flushList();
  return <>{blocks}</>;
}

export default function ChatPanel() {
  const open = useApp((s) => s.chatOpen);
  const setOpen = useApp((s) => s.setChatOpen);
  const messages = useAi((s) => s.messages);
  const busy = useAi((s) => s.busy);
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 80); }, [open]);
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, open]);

  const send = (q?: string) => {
    const v = (q ?? text).trim();
    if (!v) return;
    setText("");
    ask(v);
  };

  if (!open) return null;
  return (
    <motion.section
      className="jb-panel glass-read"
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
      aria-label="Jabby, assistant IA"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <header className="jb-head">
        <span className="jb-av"><JMark size={17} color="#fff" /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 650, fontSize: 15 }}>Jabby</div>
          <div style={{ fontSize: 12, color: "var(--mut)" }}>Assistant IA du programme · Mibtech × JABB</div>
        </div>
        <button className="jb-ibtn" onClick={() => setOpen(false)} aria-label="Fermer"><CloseIcon size={16} /></button>
      </header>

      <div className="jb-msgs" ref={list}>
        {!messages.length && (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="jb-msg bot">
              Bonjour, je suis <strong>Jabby</strong>. Posez-moi une question sur le programme : je vous réponds, chiffres à l'appui, et je vous montre où regarder.
            </div>
            <div className="jb-chips">
              {SUGGESTIONS.map((s) => <button key={s} className="jb-chip" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="jb-msg me">{m.text}</div>
          ) : (
            <div key={m.id} className={`jb-msg bot${m.error ? " err" : ""}`}>
              {!!m.actions.length && (
                <div className="jb-acts">{m.actions.map((a, i) => <span key={i} className="jb-act"><ArrowIcon size={11} />{a}</span>)}</div>
              )}
              {m.text ? <RichText text={m.text} /> : m.pending ? <span className="jb-dots"><i /><i /><i /></span> : null}
            </div>
          ),
        )}
        {!!messages.length && !busy && messages.length < 6 && (
          <div className="jb-chips" style={{ marginTop: 2 }}>
            {SUGGESTIONS.filter((s) => !messages.some((m) => m.text === s)).slice(0, 3).map((s) => <button key={s} className="jb-chip" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
      </div>

      <div className="jb-input">
        <textarea
          ref={input}
          rows={1}
          value={text}
          placeholder="Posez une question à Jabby…"
          onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
            if (e.key === " " && e.ctrlKey) { e.preventDefault(); startVoice(); }
          }}
        />
        <button className="jb-ibtn" onClick={() => startVoice()} aria-label="Parler à Jabby (Ctrl+Espace)" title="Parler (Ctrl+Espace)"><MicIcon size={17} /></button>
        <button className="jb-ibtn send" onClick={() => send()} disabled={!text.trim()} aria-label="Envoyer"><SendIcon size={17} /></button>
      </div>
    </motion.section>
  );
}
