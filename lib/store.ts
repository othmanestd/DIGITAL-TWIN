"use client";
// Single source of truth for navigation. Scenes, panels, the AI assistant and the guided tour all read and drive this store.
import { create } from "zustand";
import type { Year } from "./model";

export type Level = "world" | "morocco" | "hospital";
export type Section = "explorer" | "synthese" | "cas" | "preuves" | "gouvernance" | "emplois" | "deploiement" | "sources";
export type SelKind = "overview" | "floor" | "dept" | "person" | "case" | "xp" | "city" | "site" | "country";
/** id formats: floor "main:0" | dept "admissions" | person "admissions/admin/0" (dept/role/index) | case "A-02"
 *  xp "xp-guide" (front-desk AI experience, lib/hospital.ts EXPERIENCES) | city "casablanca" | site "<establishment slug>" | country "MA" */
export type Sel = { kind: SelKind; id: string } | null;

export type CursorState = { x: number; y: number; visible: boolean; clicking: boolean; label?: string };

type State = {
  level: Level;
  section: Section;
  sel: Sel;
  caseId: string | null;      // use case opened inside the side panel (drill-down)
  year: Year;
  perSite: boolean;           // hospital figures: whole group or one typical establishment (group ÷ 45)
  focusNonce: number;         // bumps on every navigation request so scenes re-run the camera move
  hover: string | null;
  panelOpen: boolean;
  cursor: CursorState;        // the blue AI cursor
  tour: { playing: boolean; step: number; caption: string };
  chatOpen: boolean;
  voice: "idle" | "listening" | "thinking" | "speaking";
  musicOn: boolean;
  searchOpen: boolean;
  /** Zoom inside the current level, reported by the active scene: 0 = closest, 1 = farthest (log scale). */
  zoom: number;
  /** Zoom request from the slider / shortcuts, applied by the scene of that level (see lib/zoom.ts). */
  zoomCmd: { level: Level; value?: number; delta?: number; g?: number; nonce: number } | null;
  helpOpen: boolean;
  /** Camera altitude above the ground, metres (continuous world). */
  altitude: number;

  setLevel: (l: Level) => void;
  setSection: (s: Section) => void;
  select: (sel: Sel, opts?: { focus?: boolean }) => void;
  openCase: (id: string | null) => void;
  setYear: (y: Year) => void;
  setPerSite: (v: boolean) => void;
  setHover: (id: string | null) => void;
  setPanelOpen: (v: boolean) => void;
  setCursor: (c: Partial<CursorState>) => void;
  setTour: (t: Partial<State["tour"]>) => void;
  setChatOpen: (v: boolean) => void;
  setVoice: (v: State["voice"]) => void;
  setMusicOn: (v: boolean) => void;
  setSearchOpen: (v: boolean) => void;
  home: () => void;
  setZoom: (z: number) => void;
  /** value: absolute 0..1 within `level`; delta: relative step (+ = out, − = in) within the current level. */
  /** value: 0..1 inside `level`'s altitude band; delta: relative step (+ = out); g: 0..1 over the whole continuous range. */
  requestZoom: (r: { level?: Level; value?: number; delta?: number; g?: number }) => void;
  setHelpOpen: (v: boolean) => void;
  /** Level derived from the camera altitude (no navigation side effects). */
  syncLevel: (l: Level, altitude: number) => void;
};

export const useApp = create<State>((set, get) => ({
  level: "hospital",
  section: "explorer",
  sel: { kind: "overview", id: "hospital" },
  caseId: null,
  year: 2029,
  perSite: false,
  focusNonce: 0,
  hover: null,
  panelOpen: true,
  cursor: { x: -100, y: -100, visible: false, clicking: false },
  tour: { playing: false, step: 0, caption: "" },
  chatOpen: false,
  voice: "idle",
  musicOn: false,
  searchOpen: false,
  zoom: 0.5,
  zoomCmd: null,
  helpOpen: false,
  altitude: 300,

  setLevel: (level) => set({ level, sel: { kind: "overview", id: level }, caseId: null, focusNonce: get().focusNonce + 1 }),
  setSection: (section) => set({ section }),
  select: (sel, opts) => {
    // selecting something inside another level switches level first
    let level = get().level;
    if (sel && (sel.kind === "floor" || sel.kind === "dept" || sel.kind === "person" || sel.kind === "case" || sel.kind === "xp")) level = "hospital";
    if (sel && (sel.kind === "city" || sel.kind === "site")) level = "morocco";
    if (sel && sel.kind === "country") level = "world";
    set({ sel, level, section: "explorer", panelOpen: true, caseId: sel?.kind === "case" ? sel.id : null, focusNonce: opts?.focus === false ? get().focusNonce : get().focusNonce + 1 });
  },
  openCase: (caseId) => set({ caseId }),
  setYear: (year) => set({ year }),
  setPerSite: (perSite) => set({ perSite }),
  setHover: (hover) => set({ hover }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
  setCursor: (c) => set({ cursor: { ...get().cursor, ...c } }),
  setTour: (t) => set({ tour: { ...get().tour, ...t } }),
  setChatOpen: (chatOpen) => set({ chatOpen }),
  setVoice: (voice) => set({ voice }),
  setMusicOn: (musicOn) => set({ musicOn }),
  setSearchOpen: (searchOpen) => set({ searchOpen }),
  home: () => set({ level: "hospital", section: "explorer", sel: { kind: "overview", id: "hospital" }, caseId: null, focusNonce: get().focusNonce + 1 }),
  setZoom: (zoom) => { if (Math.abs(zoom - get().zoom) > 0.002) set({ zoom }); },
  requestZoom: (r) => {
    const level = r.level ?? get().level;
    const nonce = (get().zoomCmd?.nonce ?? 0) + 1;
    set({ zoomCmd: { level, value: r.value, delta: r.delta, g: r.g, nonce } });
  },
  syncLevel: (level, altitude) => {
    const s = get();
    if (s.level !== level) set({ level, altitude });
    else if (Math.abs(Math.log(altitude / s.altitude)) > 0.02) set({ altitude });
  },
  setHelpOpen: (helpOpen) => set({ helpOpen }),
}));
