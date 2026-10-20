"use client";
// Guided-tour captions: bottom-centre of the stage, just above the timeline. Large readable text, sentence by sentence,
// the current chapter, elapsed / total time, chapter controls (◀ ▶, menu to jump), pause / stop and a progress bar
// split in chapters (click a chapter to jump). No "next beat" button: the tour plays by itself.
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "@/lib/store";
import { useAi } from "@/lib/ai/ui";
import { tour, TOURS, MODE_LABEL, fmtTime, fmtDur } from "@/lib/ai/tour";
import { PauseIcon, PlayIcon, StopIcon } from "./icons";

const Prev = () => <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M6 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M18.5 5.8v12.4c0 .8-.9 1.3-1.6.8L8.6 12.8a1 1 0 0 1 0-1.6l8.3-6.2c.7-.5 1.6 0 1.6.8z" fill="currentColor" /></svg>;
const Next = () => <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden><path d="M18 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M5.5 5.8v12.4c0 .8.9 1.3 1.6.8l8.3-6.2a1 1 0 0 0 0-1.6L7.1 5c-.7-.5-1.6 0-1.6.8z" fill="currentColor" /></svg>;
const List = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden><path d="M9 6.5h11M9 12h11M9 17.5h11" /><circle cx="4.5" cy="6.5" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="17.5" r="1" fill="currentColor" /></svg>;

/** Sits above the timeline when it is on screen, else 28 px from the bottom. */
function useBottom(active: boolean) {
  const [b, setB] = useState(112);
  useEffect(() => {
    if (!active) return;
    const f = () => {
      const tl = document.querySelector<HTMLElement>('[data-anchor="timeline"]');
      const els = tl ? [tl] : Array.from(document.querySelectorAll<HTMLElement>('[data-anchor^="year:"]'));
      let top = Infinity;
      for (const el of els) { const r = el.getBoundingClientRect(); if (r.height) top = Math.min(top, r.top); }
      const v = top === Infinity ? 28 : Math.max(28, Math.min(340, window.innerHeight - top + 14));
      setB((p) => (Math.abs(p - v) > 2 ? v : p));
    };
    f();
    const id = window.setInterval(f, 700);
    return () => clearInterval(id);
  }, [active]);
  return b;
}

export default function TourCaptions() {
  const status = useAi((s) => s.tourStatus);
  const chapter = useAi((s) => s.tourChapter);
  const title = useAi((s) => s.tourTitle);
  const mode = useAi((s) => s.tourMode);
  const total = useAi((s) => s.tourTotals[s.tourMode]);
  const { chapters: CHAPTERS, timeline } = TOURS[mode];
  const caption = useApp((s) => s.tour.caption);
  const explorer = useApp((s) => s.section === "explorer"); // the sidebar is on screen: keep clear of it
  const bar = useRef<HTMLElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const [menu, setMenu] = useState(false);
  const active = status !== "idle";
  const bottom = useBottom(active);

  useEffect(() => {
    if (!active) { setMenu(false); return; }
    let raf = 0;
    const f = () => {
      if (bar.current) bar.current.style.width = `${(tour.progress() * 100).toFixed(2)}%`;
      if (clock.current) clock.current.textContent = `${fmtTime(tour.position())} / ${fmtTime(tour.T.timeline.total)}`;
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="jb-tour"
          style={{ right: "var(--panel-w, 0px)", bottom, left: explorer ? 136 : 0 }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="jb-tour-card glass-read" role="region" aria-label="Visite guidée" aria-live="polite">
            <AnimatePresence>
              {menu && (
                <motion.div className="jb-chapters glass-read" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.22 }}>
                  <div className="eyebrow" style={{ padding: "4px 10px 8px" }}>{MODE_LABEL[mode]} · {CHAPTERS.length} chapitres · {fmtDur(total)}{TOURS[mode].plan === "live" ? " (estimé)" : ""} · {tour.narration()}</div>
                  {CHAPTERS.map((c, i) => (
                    <button key={c.id} data-now={i === chapter} onClick={() => { setMenu(false); tour.goChapter(i); }}>
                      <span className="n">{String(i + 1).padStart(2, "0")}</span>
                      <span className="t">{c.title}</span>
                      <span className="d">{fmtTime(timeline.chapters[i]?.start ?? 0)}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="jb-tour-top">
              <span className="eyebrow">{mode === "complete" ? "Complète" : "Express"} · {chapter + 1} / {CHAPTERS.length}</span>
              <span className="chap">{CHAPTERS[chapter]?.title}</span>
              {title && title !== CHAPTERS[chapter]?.title && <span className="title">· {title}</span>}
              <div className="jb-tour-ctl">
                <span ref={clock} className="clock" />
                <button onClick={() => tour.prev()} aria-label="Chapitre précédent" title="Chapitre précédent (←)"><Prev /></button>
                <button onClick={() => tour.toggle()} aria-label={status === "playing" ? "Pause" : "Reprendre"} title={status === "playing" ? "Pause (Espace)" : "Reprendre (Espace)"}>
                  {status === "playing" ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
                </button>
                <button onClick={() => tour.next()} aria-label="Chapitre suivant" title="Chapitre suivant (→)"><Next /></button>
                <button onClick={() => setMenu((m) => !m)} data-on={menu} aria-label="Chapitres" title="Chapitres"><List /></button>
                <button onClick={() => tour.stop()} aria-label="Arrêter la visite" title="Arrêter (Échap)"><StopIcon size={14} /></button>
              </div>
            </div>
            <div className="jb-tour-cap">
              <AnimatePresence mode="wait">
                <motion.div key={caption} initial={{ opacity: 0, y: 6, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.34, ease: [0.2, 0.8, 0.2, 1] } }} exit={{ opacity: 0, y: -3, filter: "blur(2px)", transition: { duration: 0.16, ease: "easeIn" } }}>
                  {caption || " "}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="jb-tour-bar">
              <i ref={bar} />
              {timeline.total > 0 && timeline.chapters.map((c, i) => (
                <button key={i} className="seg" style={{ left: `${(c.start / timeline.total) * 100}%`, width: `${(c.dur / timeline.total) * 100}%` }} onClick={() => tour.goChapter(i)} title={`${i + 1}. ${c.title}`} aria-label={`Aller au chapitre ${i + 1}`} />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
