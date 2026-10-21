"use client";
// The AI layer of the atlas: dock (tour · Jabby · music), Jabby chat, voice overlay, guided-tour captions and the blue
// AI cursor. Keyboard: Ctrl+Space voice · J chat · Esc closes / stops. Listens to "atlas:ask", "atlas:voice", "atlas:tour" (key T).
import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { useAi } from "@/lib/ai/ui";
import { ask } from "@/lib/ai/ask";
import { toggleVoice, startVoice, cancelVoice } from "@/lib/ai/voice";
import { tour, loadManifest } from "@/lib/ai/tour";
import { musicStart, musicStop, musicPlaying } from "@/lib/ai/music";
import { speaker } from "@/lib/ai/speech";
import { audio } from "@/lib/ai/audio";
import { initSfx } from "@/lib/ai/sfx";
import { AI_CSS } from "./styles";
import AiCursor from "./AiCursor";
import Dock from "./Dock";
import ChatPanel from "./ChatPanel";
import VoiceOverlay from "./VoiceOverlay";
import TourCaptions from "./TourCaptions";
import StoryOverlay from "./story/StoryOverlay";

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

export default function Assistant() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // capture phase + stopImmediatePropagation: a key Jabby consumes never reaches the global navigation shortcuts
      const eat = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.ctrlKey && (e.code === "Space" || e.key === " ")) {
        eat();
        if (useAi.getState().tourStatus === "playing") tour.pause();
        toggleVoice();
        return;
      }
      if (e.key === "Escape") {
        if (useAi.getState().voiceOpen) { eat(); cancelVoice(); return; }
        if (useAi.getState().tourStatus !== "idle") { eat(); tour.stop(); return; }
        if (useApp.getState().chatOpen) { eat(); useApp.getState().setChatOpen(false); return; }
        return;
      }
      // while the guided tour runs: ← → chapters, Space pause / resume
      if (useAi.getState().tourStatus !== "idle" && !typing(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "ArrowRight") { eat(); tour.next(); return; }
        if (e.key === "ArrowLeft") { eat(); tour.prev(); return; }
        if (e.key === " " || e.code === "Space") { eat(); tour.toggle(); return; }
      }
      if ((e.key === "j" || e.key === "J") && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) {
        eat();
        const s = useApp.getState();
        s.setChatOpen(!s.chatOpen);
      }
    };
    const onAsk = (e: Event) => {
      const text = String((e as CustomEvent<{ text?: string }>).detail?.text || "").trim();
      if (!text) return;
      if (useAi.getState().tourStatus === "playing") tour.pause();
      useApp.getState().setChatOpen(true);
      ask(text);
    };
    const onTour = () => { if (useAi.getState().tourStatus === "idle") tour.start("express", 0); else tour.stop(); };
    const onVoice = () => {
      if (useAi.getState().tourStatus === "playing") tour.pause();
      startVoice();
    };
    loadManifest(); // total duration for the dock and the chapter menu
    // QA hook (development only): window.__jabby.ask("…", {voice:true}), .tour.start(3), .startVoice()
    if (process.env.NODE_ENV !== "production") (window as unknown as { __jabby: object }).__jabby = { ask, startVoice, cancelVoice, tour, ui: useAi, app: useApp, speaker, audio };
    // sound design starts with the first user gesture (browser autoplay rules)
    const firstGesture = () => { try { audio(); initSfx(); } catch {} window.removeEventListener("pointerdown", firstGesture, true); window.removeEventListener("keydown", firstGesture, true); };
    window.addEventListener("pointerdown", firstGesture, true);
    window.addEventListener("keydown", firstGesture, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("atlas:tour", onTour);
    window.addEventListener("atlas:ask", onAsk);
    window.addEventListener("atlas:voice", onVoice);
    // the music engine follows the store (another component may switch it)
    const unsub = useApp.subscribe((s, p) => {
      if (s.musicOn === p.musicOn) return;
      if (s.musicOn && !musicPlaying()) musicStart();
      if (!s.musicOn && musicPlaying()) musicStop();
    });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", firstGesture, true);
      window.removeEventListener("keydown", firstGesture, true);
      window.removeEventListener("atlas:tour", onTour);
      window.removeEventListener("atlas:ask", onAsk);
      window.removeEventListener("atlas:voice", onVoice);
      unsub();
    };
  }, []);

  return (
    <>
      <style>{AI_CSS}</style>
      <StoryOverlay />
      <TourCaptions />
      <ChatPanel />
      <Dock />
      <VoiceOverlay />
      <AiCursor />
    </>
  );
}
