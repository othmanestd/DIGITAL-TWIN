"use client";
// Local state of the AI layer (chat messages, live transcript, tour progress). Navigation state stays in lib/store.ts.
import { create } from "zustand";

export type TourMode = "express" | "complete";
export type ChatMsg = { id: string; role: "user" | "assistant"; text: string; actions: string[]; pending?: boolean; error?: boolean; voice?: boolean };

type AiState = {
  messages: ChatMsg[];
  busy: boolean;
  voiceOpen: boolean;
  heard: string;          // live transcript (interim + final)
  heardFinal: boolean;
  answer: string;         // answer shown in the voice overlay
  voiceNote: string;      // status / error line in the voice overlay
  tourStatus: "idle" | "playing" | "paused";
  tourTitle: string;
  tourChapter: number;    // index of the current chapter
  tourMode: TourMode;
  tourTotals: Record<TourMode, number>; // total duration of each tour (s), from the narration manifest
  set: (p: Partial<AiState>) => void;
  push: (m: ChatMsg) => void;
  patch: (id: string, f: (m: ChatMsg) => Partial<ChatMsg>) => void;
};

export const useAi = create<AiState>((set, get) => ({
  messages: [],
  busy: false,
  voiceOpen: false,
  heard: "",
  heardFinal: false,
  answer: "",
  voiceNote: "",
  tourStatus: "idle",
  tourTitle: "",
  tourChapter: 0,
  tourMode: "express",
  tourTotals: { express: 0, complete: 0 },
  set: (p) => set(p),
  push: (m) => set({ messages: [...get().messages, m] }),
  patch: (id, f) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...f(m) } : m)) }),
}));

export const uid = () => Math.random().toString(36).slice(2, 10);
