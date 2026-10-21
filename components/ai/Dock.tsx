"use client";
// Bottom-left dock: guided tour (play / pause), Jabby (chat), music.
import { useApp } from "@/lib/store";
import { useAi } from "@/lib/ai/ui";
import { tour, MODE_LABEL, fmtDur, type TourMode } from "@/lib/ai/tour";
import { useState } from "react";
import { musicStart, musicStop, setMusicUserOff, musicUserOff } from "@/lib/ai/music";
import { sfxEnabled, initSfx } from "@/lib/ai/sfx";
import { audio } from "@/lib/ai/audio";
import { JMark, PlayIcon, PauseIcon, MusicIcon, EqBars } from "./icons";
import { WalkButton } from "@/components/scenes/walk/WalkHud";
import { V23 } from "@/lib/data/dataset";

export default function Dock() {
  const status = useAi((s) => s.tourStatus);
  const totals = useAi((s) => s.tourTotals);
  const [pick, setPick] = useState(false);
  const onTour = () => { if (status === "idle") setPick((v) => !v); else tour.toggle(); };
  const go = (m: TourMode) => { setPick(false); tour.start(m, 0); };
  const chatOpen = useApp((s) => s.chatOpen);
  const setChatOpen = useApp((s) => s.setChatOpen);
  const musicOn = useApp((s) => s.musicOn);
  const setMusicOn = useApp((s) => s.setMusicOn);
  // when the side panel is open the stage narrows and the timeline slides left: the dock folds to icons
  const compact = useApp((s) => s.panelOpen && s.section === "explorer" && !!s.sel && s.sel.kind !== "overview");

  const [soundOff, setSoundOff] = useState(() => musicUserOff());
  // one button for all sound: music bed + sound design
  const toggleMusic = () => {
    audio();
    initSfx();
    if (musicOn) { setMusicUserOff(true); setSoundOff(true); sfxEnabled(false); musicStop(); setMusicOn(false); }
    else { setMusicUserOff(false); setSoundOff(false); sfxEnabled(true); musicStart(); setMusicOn(true); }
  };

  return (
    <nav className="jb-dock" aria-label="Jabby" data-compact={compact}>
      {pick && status === "idle" && (
        <div className="jb-modes glass-read" role="menu" aria-label="Visites guidées">
          {(["express", "complete"] as TourMode[]).map((m) => (
            <button key={m} role="menuitem" onClick={() => go(m)} data-anchor={`ai:tour:${m}`}>
              <span className="ico blue"><PlayIcon size={12} /></span>
              <span className="t"><b>{MODE_LABEL[m]}</b><small>{V23 ? (m === "express" ? "Le même mardi, en 2026 puis en 2031 : six personnages, la valeur nette pas à pas" : "Toute l'histoire, scène par scène : patient, soin, actifs, revenu, temps rendu, le compte, le monde") : m === "express" ? "L'histoire et les cas les plus forts, résultats mesurés à l'appui" : "Les 89 cas, étage par étage, puis le Maroc et le monde"}</small></span>
              <span className="d">{totals[m] ? fmtDur(totals[m]) : ""}</span>
            </button>
          ))}
        </div>
      )}
      <button className="jb-btn glass" data-anchor="ai:tour" data-active={status !== "idle" || pick} onClick={onTour} title="Visites guidées narrées">
        <span className="ico blue">{status === "playing" ? <PauseIcon size={14} /> : <PlayIcon size={14} />}</span>
        <span className="lbl">{status === "idle" ? "Visite guidée" : status === "playing" ? "Pause" : "Reprendre"}</span>
        {status === "idle" && totals.express > 0 && <span className="jb-kbd lbl-t">{fmtDur(totals.express)}</span>}
      </button>
      <button className="jb-btn glass" data-anchor="ai:jabby" data-active={chatOpen} onClick={() => setChatOpen(!chatOpen)} title="Parler à Jabby (J)">
        <span className="ico blue"><JMark size={15} color="#fff" /></span>
        <span className="lbl">Jabby</span>
        <span className="jb-kbd">J</span>
      </button>
      <WalkButton />
      <button className="jb-btn glass round" data-anchor="ai:music" data-active={musicOn} onClick={toggleMusic} aria-label={musicOn ? "Couper le son" : "Musique d'ambiance et son"} title={musicOn ? "Couper le son (musique et effets)" : "Musique d'ambiance et son"} style={{ color: musicOn ? "#B9C7FF" : "var(--txt-2)" }}>
        {musicOn ? <EqBars on /> : <MusicIcon size={18} on={!soundOff} />}
      </button>
    </nav>
  );
}
