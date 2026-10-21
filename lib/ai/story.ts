"use client";
// The story director of the guided visits: the fictional cast staged in the 3D hospital, the 2026 → 2031 before / after
// props, the cinematic layer (letterbox, title card, time stamp) and the value ledger that builds the bridge
// ① savings + ② margin − ③ cost = net value, live. Driven by the tour's story cues ({do:"cue"}, lib/ai/actions.ts);
// read by components/scenes/story (3D) and components/ai/story (DOM). Every figure comes from the tour JSON
// (scripts/build-tour-v23.mjs), itself computed from lib/data/v23.
import { create } from "zustand";
import { chime, reveal, titleSting, finaleChord } from "./sfx";
import { anchorIds, locate } from "../anchors";

export type CastId = "amina" | "youssef" | "salma" | "karim" | "hicham" | "leila";
export const CAST_IDS: CastId[] = ["amina", "youssef", "salma", "karim", "hicham", "leila"];
export type Pose = "stand" | "sit" | "type" | "tablet" | "kneel";
export type Place = { at: string; pose?: Pose; from?: string; via?: string[] };
export type PropState = "before" | "mid" | "after" | "off";
export type LedgerKey = "ms" | "hms" | "rec" | "neu";
export type Ledger = Record<LedgerKey, number>;
export type Stamp = { t: string; year: number } | null;
export type ChartStep = number | "cumul" | null;

/** The story state at the start of a beat (written by the build script; restores everything on a chapter jump). */
export type Story0 = {
  cast: Record<string, { at: string; pose?: Pose }>; props: Record<string, PropState>; stamp: Stamp; ledger: Ledger;
  hud: boolean; cost: boolean; net: boolean; finale: boolean; chart: ChartStep; letterbox: boolean;
};

export type Cue = {
  do: "cue";
  reset?: boolean; delay?: number;
  sel?: { kind: "dept" | "floor" | "overview"; id: string };
  cam?: string;
  cast?: Partial<Record<CastId, Place | null>>;
  props?: Record<string, PropState>;
  stamp?: Stamp;
  letterbox?: boolean; title?: boolean; fade?: number; closing?: boolean;
  intro?: CastId; chip?: CastId[];
  ledger?: Partial<Ledger> & { from?: string; stream?: string };
  hud?: boolean; cost?: boolean; net?: boolean; finale?: "on" | "off"; chart?: ChartStep; focus?: string;
  from?: string;
  alert?: string; dim?: boolean; ping?: string;
  sfx?: "title" | "reveal" | "finale";
};

type Member = { place: Place; nonce: number };
type Pulse = { id: number; from: string; lines: LedgerKey[] | ["cost"]; t: number };
type Chip = { id: CastId; t: number; intro: boolean };
type Flash = { spot: string; t: number; dim?: boolean; kind: "alert" | "ping" };

type StoryState = {
  on: boolean;
  cast: Partial<Record<CastId, Member>>;
  props: Record<string, PropState>;
  stamp: Stamp;
  ledger: Ledger;            // target values (MDH, 2031); the HUD animates towards them
  snap: number;              // bumps when the HUD must jump to the targets (chapter jump)
  hud: boolean; cost: boolean; net: boolean; finale: boolean; chart: ChartStep; focus: string | null; focusT: number;
  letterbox: boolean; title: boolean; fade: number; closing: boolean;
  chips: Chip[]; pulses: Pulse[]; flashes: Flash[];
  cam: { shot: string; nonce: number } | null;
};

const ZERO: Ledger = { ms: 0, hms: 0, rec: 0, neu: 0 };
const initial = (): Omit<StoryState, "on"> => ({
  cast: {}, props: {}, stamp: null, ledger: { ...ZERO }, snap: 0, hud: false, cost: false, net: false, finale: false, chart: null,
  focus: null, focusT: 0, letterbox: false, title: false, fade: 0, closing: false, chips: [], pulses: [], flashes: [], cam: null,
});

export const useStory = create<StoryState>(() => ({ on: false, ...initial() }));

let seq = 0;
const now = () => performance.now();
const timers = new Set<number>();
const later = (sec: number, f: () => void) => { const id = window.setTimeout(() => { timers.delete(id); f(); }, sec * 1000); timers.add(id); };

/** Story on/off (the 3D cast and the overlay only render while a visit plays). */
export function storyOn() { if (!useStory.getState().on) useStory.setState({ on: true }); }
export function storyOff() {
  timers.forEach((t) => clearTimeout(t)); timers.clear();
  useStory.setState({ on: false, ...initial(), snap: useStory.getState().snap + 1 });
}

/** Restores the state a beat starts from (chapter jump): cast in place, props, stamp, ledger values without animation. */
export function storySync(s: Story0 | undefined) {
  if (!s) return;
  timers.forEach((t) => clearTimeout(t)); timers.clear();
  const cast: Partial<Record<CastId, Member>> = {};
  for (const [k, v] of Object.entries(s.cast)) cast[k as CastId] = { place: { at: v.at, pose: v.pose }, nonce: ++seq };
  const st = useStory.getState();
  useStory.setState({
    on: true, cast, props: { ...s.props }, stamp: s.stamp, ledger: { ...s.ledger }, snap: st.snap + 1,
    hud: s.hud, cost: s.cost, net: s.net, finale: s.finale, chart: s.chart, letterbox: s.letterbox,
    title: false, fade: 0, closing: false, chips: [], pulses: [], flashes: [], focus: null,
  });
}

/** Applies one story cue (from the tour). Returns at once; delayed parts run on their own timers. */
export function applyCue(c: Cue) {
  if (c.delay) { const { delay, ...rest } = c; later(delay, () => applyCue(rest as Cue)); return; }
  const st = useStory.getState();
  const patch: Partial<StoryState> = { on: true };
  if (c.reset) Object.assign(patch, initial(), { snap: st.snap + 1 });
  const base = c.reset ? initial() : st;
  if (c.cast) {
    const cast = { ...base.cast };
    for (const [k, v] of Object.entries(c.cast) as [CastId, Place | null][]) {
      if (v) cast[k] = { place: v, nonce: ++seq }; else delete cast[k];
    }
    patch.cast = cast;
  }
  if (c.props) patch.props = { ...base.props, ...c.props };
  if (c.stamp !== undefined) patch.stamp = c.stamp;
  if (c.letterbox !== undefined) patch.letterbox = c.letterbox;
  if (c.title !== undefined) patch.title = c.title;
  if (c.fade !== undefined) patch.fade = c.fade;
  if (c.closing !== undefined) patch.closing = c.closing;
  if (c.hud !== undefined) patch.hud = c.hud;
  if (c.finale !== undefined) patch.finale = c.finale === "on";
  if (c.chart !== undefined) patch.chart = c.chart;
  if (c.focus !== undefined) { patch.focus = c.focus; patch.focusT = now(); }
  if (c.cam) patch.cam = { shot: c.cam, nonce: (st.cam?.nonce ?? 0) + 1 };
  const t = now();
  const chips = (patch.chips ?? base.chips).filter((x) => t - x.t < 9000);
  if (c.intro) chips.push({ id: c.intro, t, intro: true });
  if (c.chip) for (const id of c.chip) chips.push({ id, t, intro: false });
  if (c.intro || c.chip) patch.chips = chips;
  const flashes = base.flashes.filter((x) => t - x.t < 12000);
  if (c.alert) { flashes.push({ spot: c.alert, t, dim: c.dim, kind: "alert" }); patch.flashes = flashes; }
  if (c.ping) { flashes.push({ spot: c.ping, t, kind: "ping" }); patch.flashes = flashes; }
  if (c.ledger) {
    const L = { ...base.ledger };
    const lines: LedgerKey[] = [];
    for (const k of ["ms", "hms", "rec", "neu"] as LedgerKey[]) {
      const v = c.ledger[k] ?? 0;
      if (v > 0.004) { L[k] = Math.round((L[k] + v) * 1e4) / 1e4; lines.push(k); }
    }
    patch.ledger = L;
    patch.hud = true;
    patch.pulses = [...base.pulses.filter((p) => t - p.t < 4000), { id: ++seq, from: c.ledger.from ?? "stage", lines, t }];
    reveal(lines.length);
  }
  if (c.cost) {
    patch.cost = true;
    patch.pulses = [...(patch.pulses ?? base.pulses).filter((p) => t - p.t < 4000), { id: ++seq, from: c.from ?? "stage", lines: ["cost"], t }];
    reveal(1, true);
  }
  if (c.net) patch.net = true;
  if (c.sfx === "title") titleSting();
  if (c.sfx === "finale") finaleChord();
  if (c.sfx === "reveal") chime();
  useStory.setState(patch);
}

// dev / QA hook: window.__story.{state, apply, sync, off}
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __story: object }).__story = { state: useStory, apply: applyCue, sync: storySync, off: storyOff, on: storyOn, anchors: () => anchorIds().filter((a) => a.startsWith("story") || a.startsWith("spot")), locate };
}
