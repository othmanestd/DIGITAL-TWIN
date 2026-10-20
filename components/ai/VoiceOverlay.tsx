"use client";
// Voice overlay: centred while listening (live transcript + waveform of the mic); while Jabby thinks and answers it glides
// to the bottom of the screen so the cursor's navigation stays visible, and the waveform follows Jabby's voice.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "@/lib/store";
import { useAi } from "@/lib/ai/ui";
import { audio, hasAudio } from "@/lib/ai/audio";
import { micAnalyser, cancelVoice } from "@/lib/ai/voice";
import { JMark } from "./icons";
import { RichText } from "./ChatPanel";

const STATE_LABEL = { idle: "Jabby", listening: "Je vous écoute", thinking: "Jabby réfléchit…", speaking: "Jabby répond" } as const;

function Wave({ state }: { state: keyof typeof STATE_LABEL }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const st = useRef(state);
  st.current = state;
  useEffect(() => {
    const c = cv.current!;
    const g = c.getContext("2d")!;
    let raf = 0;
    const data = new Float32Array(1024);
    let level = 0;
    const draw = (now: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const s = st.current;
      const an = s === "listening" ? micAnalyser : s === "speaking" && hasAudio() ? audio().analyser : null;
      let rms = 0;
      if (an) {
        an.getFloatTimeDomainData(data);
        for (let i = 0; i < data.length; i++) rms += data[i] * data[i];
        rms = Math.sqrt(rms / data.length);
      }
      level += (Math.min(1, rms * 6) - level) * 0.18;
      const base = s === "thinking" ? 0.16 + 0.08 * Math.sin(now / 300) : 0.05;
      const amp = Math.max(base, level) * h * 0.42;
      // three soft layered sines whose amplitude follows the level — calm, not a jittery oscilloscope
      const layers = [
        { a: 1, f: 2.2, sp: 0.0021, col: "rgba(142,166,255,.95)", lw: 2 },
        { a: 0.6, f: 3.4, sp: -0.0016, col: "rgba(91,124,255,.55)", lw: 1.5 },
        { a: 0.35, f: 1.4, sp: 0.0011, col: "rgba(95,179,168,.45)", lw: 1.2 },
      ];
      for (const L of layers) {
        g.beginPath();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w;
          const env = Math.sin(Math.PI * u) ** 1.6;
          const y = h / 2 + Math.sin(u * Math.PI * 2 * L.f + now * L.sp) * amp * L.a * env;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.strokeStyle = L.col; g.lineWidth = L.lw; g.lineCap = "round";
        g.stroke();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={cv} className="jb-wave" />;
}

export default function VoiceOverlay() {
  const open = useAi((s) => s.voiceOpen);
  const heard = useAi((s) => s.heard);
  const heardFinal = useAi((s) => s.heardFinal);
  const answer = useAi((s) => s.answer);
  const note = useAi((s) => s.voiceNote);
  const voice = useApp((s) => s.voice);
  const centred = voice === "listening" || (!answer && voice === "idle");
  const [vh, setVh] = useState(1080);
  useEffect(() => { const f = () => setVh(window.innerHeight); f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f); }, []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="jb-voice-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <motion.div className="jb-voice-scrim" animate={{ opacity: centred ? 1 : 0 }} style={{ pointerEvents: centred ? "auto" : "none" }} onClick={cancelVoice} />
          <motion.div
            className="jb-voice glass-read"
            data-state={voice}
            initial={{ x: "-50%", top: vh / 2 + 16, y: "-50%", scale: 0.97 }}
            animate={centred ? { x: "-50%", top: vh / 2, y: "-50%", scale: 1 } : { x: "-50%", top: vh - 112, y: "-100%", scale: 0.94 }}
            transition={{ type: "spring", stiffness: 170, damping: 26 }}
            role="dialog"
            aria-label="Parler à Jabby"
          >
            <div className="jb-orb"><JMark size={26} color="#fff" /></div>
            <div className="jb-vstate">{STATE_LABEL[voice]}</div>
            <div className="jb-heard">
              {heard ? (heardFinal ? <>« {heard} »</> : <span className={heardFinal ? "" : "interim"}>{heard}</span>) : <span className="interim">{note || "…"}</span>}
            </div>
            {!!answer && <div className="jb-answer"><RichText text={answer} /></div>}
            {!!note && !!heard && voice === "idle" && !answer && <div className="jb-answer">{note}</div>}
            <Wave state={voice} />
            <div className="jb-vfoot">
              <span><span className="jb-kbd">Ctrl</span> + <span className="jb-kbd">Espace</span> {voice === "listening" ? "envoyer" : "arrêter"}</span>
              <span><span className="jb-kbd">Échap</span> annuler</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
