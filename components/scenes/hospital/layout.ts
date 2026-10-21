// Pure layout of the "typical Akdital hospital": furniture parts, partition walls and people for every department.
// Everything is computed once from lib/hospital (DEPTS) and expressed in floor-local coordinates
// (origin = building centre, y = 0 at the floor surface). The 3D components only instance what is described here.
import { DEPTS, FLOORS, MAIN, ANNEX, FLOOR_H, ROLE_COLOR, type Dept, type Role } from "@/lib/hospital";
import { isShrinkRole } from "./staffing";
import { EXTRA_DOORS } from "../walk/plan";

export type G = "box" | "rbox" | "cyl" | "sph" | "torus";
export type M =
  | "white" | "light" | "grey" | "steel" | "dark" | "screen" | "wood" | "fabric" | "mattress" | "blanket"
  | "green" | "lamp" | "carton" | "curtain" | "wall" | "ecg" | "glassp" | "led" | "coral" | "band";
export type Part = { g: G; m: M; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; dept: string; paper?: boolean; pitch?: number; desk?: number };

export type Pose = "stand" | "sit" | "lie" | "walk";
export type Slot = { x: number; z: number; yaw: number; pose: Pose; y?: number; path?: [number, number, number, number]; type?: boolean; desk?: number };

export type Person = {
  id: string;            // "<dept>/<role>/<index within role>"
  dept: string;
  role: Role;
  label: string;
  slot: Slot;
  seed: number;
  torso: string; legs: string; skin: string; hair: string | null;
  coat: boolean;         // doctors: long white coat
  agent: number;         // threshold in [0,1) at which an AI agent companion appears; -1 = none
  shrink: number;        // index among the department's shrinking staff (staffing.ts), -1 = always there
  desk: number;          // desk id (layout parts tagged with it), -1 = none
  door: [number, number]; // where a leaving person walks to (department door, floor-local)
};
let DESK_ID = 0;

export type FloorLayout = {
  key: string; building: "main" | "annex"; floor: number;
  w: number; d: number; ox: number; oz: number; // plate size and building centre (world)
  depts: Dept[]; parts: Part[]; people: Person[];
};

export { FLOOR_H };

// ---------------------------------------------------------------- deterministic randomness
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const SKIN = ["#E7CBB2", "#D6AE8E", "#C08F6E", "#A47658", "#EBD3BD", "#CFA382"];
const HAIR = ["#2A2320", "#3A2C24", "#4B3A2D", "#1E1A19", "#6E625A", "#5A4334"];
const LEGS: Record<Role, string> = {
  patient: "#B5BBC8", medecin: "#4A5368", infirmier: "#5FA69D", aide: "#8DBB97", admin: "#3E465A", technique: "#6E675B", cadre: "#41455A", direction: "#2F3447",
};

// ---------------------------------------------------------------- department builder
class B {
  parts: Part[] = [];
  staff: Slot[] = [];
  pats: Slot[] = [];
  constructor(public dept: Dept, public cx: number, public cz: number, public w: number, public d: number, public s: number) {}
  /** (u, v) in department space → floor-local x, z. v = +d/2 is the inner side (corridor). */
  X(u: number, v: number): [number, number] { return [this.cx + u, this.cz + v * this.s]; }
  /** yaw of a direction given in department space */
  Y(du: number, dv: number) { return Math.atan2(du, dv * this.s); }
  /** an item frame at (u, v) facing (fu, fv): returns a function adding parts in item-local coords (x right, z forward). */
  at(u: number, v: number, fu: number, fv: number) {
    const [ox, oz] = this.X(u, v);
    const yaw = this.Y(fu, fv);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx: number, lz: number): [number, number] => [ox + lx * c + lz * s, oz - lx * s + lz * c];
    const add = (g: G, m: M, lx: number, y: number, lz: number, sx: number, sy: number, sz: number, extra?: Partial<Part>) => {
      const [x, z] = P(lx, lz);
      this.parts.push({ g, m, x, y, z, yaw: yaw + (extra?.yaw ?? 0), sx, sy, sz, dept: this.dept.id, paper: extra?.paper, pitch: extra?.pitch });
    };
    const slot = (lx: number, lz: number, pose: Pose, extra?: Partial<Slot> & { dyaw?: number }): Slot => {
      const [x, z] = P(lx, lz);
      return { x, z, yaw: yaw + (extra?.dyaw ?? 0), pose, y: extra?.y, type: extra?.type };
    };
    return { add, slot, P, yaw };
  }
  path(u1: number, v1: number, u2: number, v2: number): Slot {
    const [x1, z1] = this.X(u1, v1), [x2, z2] = this.X(u2, v2);
    return { x: x1, z: z1, yaw: Math.atan2(x2 - x1, z2 - z1), pose: "walk", path: [x1, z1, x2, z2] };
  }
  stand(u: number, v: number, fu: number, fv: number): Slot { const [x, z] = this.X(u, v); return { x, z, yaw: this.Y(fu, fv), pose: "stand" }; }

  // ------------------------------------------------ furniture
  /** office desk; the worker sits behind it facing (fu, fv). Returns the seat slot. */
  desk(u: number, v: number, fu: number, fv: number, o: { screens?: number; phone?: boolean; paper?: boolean; chair?: boolean; w?: number } = {}) {
    const start = this.parts.length, id = ++DESK_ID;
    const r = this.deskInner(u, v, fu, fv, o);
    for (let i = start; i < this.parts.length; i++) this.parts[i].desk = id;
    return { ...r, desk: id };
  }
  private deskInner(u: number, v: number, fu: number, fv: number, o: { screens?: number; phone?: boolean; paper?: boolean; chair?: boolean; w?: number }) {
    const { add, slot } = this.at(u, v, fu, fv);
    const w = o.w ?? 1.5;
    add("box", "wood", 0, 0.74, 0, w, 0.05, 0.75);
    add("box", "light", -w / 2 + 0.05, 0.36, 0, 0.05, 0.72, 0.7);
    add("box", "light", w / 2 - 0.05, 0.36, 0, 0.05, 0.72, 0.7);
    add("box", "light", 0, 0.5, 0.33, w - 0.1, 0.42, 0.03);
    const n = o.screens ?? 1;
    for (let i = 0; i < n; i++) {
      const lx = n === 1 ? 0 : (i - (n - 1) / 2) * 0.64;
      add("box", "screen", lx, 1.0, 0.2, 0.6, 0.36, 0.035, { yaw: n === 1 ? 0 : -(i - (n - 1) / 2) * 0.25 });
      add("box", "grey", lx, 0.84, 0.24, 0.05, 0.2, 0.05);
    }
    add("box", "light", 0, 0.775, -0.12, 0.46, 0.02, 0.16);
    if (o.paper !== false) add("box", "white", 0.48 * (w / 1.5), 0.765, 0.02, 0.27, 0.16, 0.34, { paper: true });
    if (o.phone) add("box", "dark", -0.5 * (w / 1.5), 0.79, -0.04, 0.18, 0.06, 0.21);
    if (o.chair !== false) this.chair(u, v, fu, fv, -0.74);
    return slot(0, -0.72, "sit", { type: true });
  }
  chair(u: number, v: number, fu: number, fv: number, lz = 0) {
    const { add } = this.at(u, v, fu, fv);
    add("box", "fabric", 0, 0.46, lz, 0.52, 0.08, 0.5);
    add("box", "fabric", 0, 0.82, lz - 0.25, 0.5, 0.56, 0.07);
    add("box", "grey", 0, 0.22, lz, 0.07, 0.42, 0.07);
    add("cyl", "grey", 0, 0.025, lz, 0.56, 0.05, 0.56);
  }
  armchair(u: number, v: number, fu: number, fv: number) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", "fabric", 0, 0.24, 0, 0.78, 0.36, 0.72);
    add("rbox", "fabric", 0, 0.62, -0.3, 0.78, 0.5, 0.14);
    add("rbox", "fabric", -0.34, 0.5, 0, 0.12, 0.22, 0.7);
    add("rbox", "fabric", 0.34, 0.5, 0, 0.12, 0.22, 0.7);
  }
  ivPole(u: number, v: number) {
    const { add } = this.at(u, v, 0, 1);
    add("cyl", "grey", 0, 0.03, 0, 0.42, 0.04, 0.42); add("box", "steel", 0, 1.0, 0, 0.04, 2.0, 0.04);
    add("rbox", "light", 0, 1.2, 0.05, 0.24, 0.28, 0.16); add("box", "led", 0, 1.25, 0.14, 0.12, 0.06, 0.02);
  }
  cart(u: number, v: number, fu: number, fv: number, m: M = "light", screen = false) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", m, 0, 0.5, 0, 0.6, 0.8, 0.45); add("box", "steel", 0, 0.94, 0, 0.64, 0.04, 0.5);
    for (let i = 0; i < 3; i++) add("box", "grey", 0, 0.25 + i * 0.22, 0.23, 0.5, 0.015, 0.01);
    if (screen) { add("box", "steel", 0, 1.25, -0.15, 0.04, 0.6, 0.04); add("box", "screen", 0, 1.5, -0.12, 0.42, 0.3, 0.03, { pitch: -0.3 }); }
  }
  ventilator(u: number, v: number, fu: number, fv: number) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", "white", 0, 0.55, 0, 0.45, 1.1, 0.45); add("box", "ecg", 0, 1.25, 0.05, 0.38, 0.3, 0.04, { pitch: -0.2 });
    add("box", "led", 0.15, 0.95, 0.23, 0.05, 0.05, 0.02);
  }
  fridge(u: number, v: number, fu: number, fv: number, glass = true) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", "white", 0, 1.0, 0, 0.75, 2.0, 0.7); if (glass) add("box", "glassp", 0, 1.05, 0.36, 0.6, 1.7, 0.02);
    add("box", "led", 0.25, 1.92, 0.36, 0.08, 0.04, 0.02);
  }
  /** a row of n waiting chairs facing (fu, fv); returns seat slots */
  chairs(u: number, v: number, fu: number, fv: number, n: number) {
    const { add, slot } = this.at(u, v, fu, fv);
    const out: Slot[] = [];
    add("box", "grey", 0, 0.22, -0.05, n * 0.62, 0.05, 0.32);
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * 0.62;
      add("box", "fabric", lx, 0.46, 0, 0.54, 0.08, 0.5);
      add("box", "fabric", lx, 0.76, -0.24, 0.54, 0.5, 0.07);
      out.push(slot(lx, 0.02, "sit"));
    }
    return out;
  }
  counter(u: number, v: number, fu: number, fv: number, len: number) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", "white", 0, 0.53, 0, len, 1.06, 0.7);
    add("box", "wood", 0, 1.08, 0.12, len + 0.08, 0.05, 0.5);
    add("box", "light", 0, 0.76, -0.45, len - 0.2, 0.04, 0.4);
  }
  bed(u: number, v: number, fu: number, fv: number, patient: boolean, o: { monitor?: boolean; crib?: boolean; stretcher?: boolean } = {}) {
    // head of the bed toward −(fu, fv)
    const { add, slot } = this.at(u, v, fu, fv);
    if (o.stretcher) {
      add("box", "steel", 0, 0.45, 0, 0.62, 0.05, 1.9);
      add("box", "grey", 0, 0.24, -0.75, 0.06, 0.44, 0.06);
      add("box", "grey", 0, 0.24, 0.75, 0.06, 0.44, 0.06);
      add("rbox", "mattress", 0, 0.56, 0, 0.7, 0.14, 2.0);
      add("rbox", "mattress", 0, 0.68, -0.78, 0.5, 0.09, 0.32);
      if (patient) add("rbox", "blanket", 0, 0.84, 0.35, 0.78, 0.18, 1.25);
      if (patient) this.pats.push(slot(0, 0.93, "lie", { y: 0.77 }));
      return;
    }
    add("box", "steel", 0, 0.28, 0, 0.9, 0.3, 1.95);
    add("rbox", "mattress", 0, 0.52, 0, 0.94, 0.18, 2.02);
    add("box", "light", 0, 0.58, -1.06, 1.0, 0.8, 0.07);
    add("box", "light", 0, 0.48, 1.05, 1.0, 0.5, 0.06);
    add("rbox", "mattress", 0, 0.66, -0.78, 0.62, 0.11, 0.34);
    add("rbox", "blanket", 0, patient ? 0.8 : 0.63, 0.32, 1.0, patient ? 0.2 : 0.06, 1.36);
    if (patient) this.pats.push(slot(0, 0.93, "lie", { y: 0.76 }));
    // side rails, wall oxygen panel behind the head, IV pole with pump next to an occupied bed
    add("box", "steel", -0.5, 0.74, 0.05, 0.03, 0.16, 0.95); add("box", "steel", 0.5, 0.74, 0.05, 0.03, 0.16, 0.95);
    add("box", "light", 0, 1.35, -1.16, 1.3, 0.28, 0.06); add("box", "led", 0.45, 1.35, -1.12, 0.06, 0.06, 0.03);
    if (patient) {
      add("cyl", "grey", 0.78, 0.03, -0.5, 0.42, 0.04, 0.42); add("box", "steel", 0.78, 1.0, -0.5, 0.04, 2.0, 0.04);
      add("rbox", "light", 0.78, 1.25, -0.46, 0.24, 0.28, 0.16); add("box", "led", 0.78, 1.3, -0.37, 0.12, 0.06, 0.02);
      add("rbox", "mattress", 0.78, 1.82, -0.5, 0.16, 0.24, 0.06);
    }
    if (o.monitor) {
      add("box", "steel", -0.85, 0.75, -0.95, 0.05, 1.5, 0.05);
      add("box", "ecg", -0.85, 1.42, -0.92, 0.42, 0.3, 0.05, { yaw: 0.6 });
    } else {
      add("box", "light", 0.85, 0.36, -0.8, 0.45, 0.72, 0.45); // bedside table
    }
    if (o.crib) {
      add("box", "grey", -1.05, 0.3, -0.35, 0.05, 0.6, 0.05);
      add("rbox", "curtain", -1.05, 0.72, -0.35, 0.5, 0.36, 0.78);
      add("rbox", "mattress", -1.05, 0.82, -0.35, 0.42, 0.06, 0.7);
    }
  }
  shelf(u: number, v: number, fu: number, fv: number, len: number, h = 2.0, fill: M = "carton") {
    const { add } = this.at(u, v, fu, fv);
    add("box", "light", -len / 2, h / 2, 0, 0.05, h, 0.55);
    add("box", "light", len / 2, h / 2, 0, 0.05, h, 0.55);
    for (let i = 0; i < 4; i++) add("box", "white", 0, 0.08 + i * ((h - 0.1) / 3), 0, len, 0.04, 0.55);
    const r = rng(hash(this.dept.id + u + v));
    for (let i = 0; i < 3; i++) {
      const y0 = 0.1 + i * ((h - 0.1) / 3);
      let x = -len / 2 + 0.08;
      while (x < len / 2 - 0.3) {
        const bw = 0.25 + r() * 0.45;
        if (x + bw > len / 2 - 0.06) break;
        const bh = 0.22 + r() * 0.26;
        if (r() > 0.12) add("box", fill, x + bw / 2, y0 + bh / 2, 0, bw - 0.04, bh, 0.42);
        x += bw;
      }
    }
  }
  trolley(u: number, v: number, fu: number, fv: number, m: M = "light", tall = 0.95) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", m, 0, 0.12 + tall / 2, 0, 0.62, tall, 1.0);
    add("box", "steel", 0, 0.06, 0, 0.56, 0.08, 0.94);
    add("box", "steel", 0, tall + 0.18, -0.56, 0.56, 0.04, 0.04);
  }
  plant(u: number, v: number, big = 1) {
    const { add } = this.at(u, v, 0, 1);
    add("cyl", "white", 0, 0.24 * big, 0, 0.46 * big, 0.48 * big, 0.46 * big);
    add("sph", "green", 0, 0.85 * big, 0, 0.8 * big, 0.95 * big, 0.8 * big);
  }
  table(u: number, v: number, fu: number, fv: number, w: number, d: number) {
    const { add } = this.at(u, v, fu, fv);
    add("rbox", "wood", 0, 0.74, 0, w, 0.06, d);
    add("box", "grey", 0, 0.36, 0, Math.max(0.1, w - 1.2), 0.7, 0.1);
  }
  stanchions(u: number, v: number, fu: number, fv: number, n: number, gap = 1.1) {
    const { add } = this.at(u, v, fu, fv);
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * gap;
      add("cyl", "steel", lx, 0.47, 0, 0.07, 0.94, 0.07);
      add("cyl", "steel", lx, 0.02, 0, 0.3, 0.04, 0.3);
      if (i < n - 1) add("box", "dark", lx + gap / 2, 0.88, 0, gap, 0.05, 0.015);
    }
  }
  partition(u1: number, v1: number, u2: number, v2: number, h = 1.0, m: M = "wall", t = 0.12) {
    const [x1, z1] = this.X(u1, v1), [x2, z2] = this.X(u2, v2);
    const len = Math.hypot(x2 - x1, z2 - z1);
    const yaw = Math.atan2(x2 - x1, z2 - z1);
    this.parts.push({ g: "box", m, x: (x1 + x2) / 2, y: h / 2, z: (z1 + z2) / 2, yaw, sx: t, sy: h, sz: len, dept: this.dept.id });
  }
  /** wall along a segment with an optional gap (door) centred at parameter g (0..1) of width gw */
  wall(u1: number, v1: number, u2: number, v2: number, gaps: [number, number][] = [], h = 1.0) {
    const L = Math.hypot(u2 - u1, v2 - v1);
    gaps = [...gaps, ...this.extraGaps(u1, v1, u2, v2, L)];
    const cuts = gaps.map(([c, gw]) => [Math.max(0, c * L - gw / 2), Math.min(L, c * L + gw / 2)]).sort((a, b) => a[0] - b[0]);
    let t0 = 0;
    const seg = (a: number, b: number) => {
      if (b - a < 0.05) return;
      const lu = (q: number) => u1 + ((u2 - u1) * q) / L, lv = (q: number) => v1 + ((v2 - v1) * q) / L;
      this.partition(lu(a), lv(a), lu(b), lv(b), h);
    };
    for (const [a, b] of cuts) { seg(t0, a); t0 = b; }
    seg(t0, L);
  }
  /** Door gaps added for walk-mode circulation (walk/plan.ts EXTRA_DOORS) that fall on this wall segment. */
  private extraGaps(u1: number, v1: number, u2: number, v2: number, L: number): [number, number][] {
    if (L < 0.5) return [];
    const [x1, z1] = this.X(u1, v1), [x2, z2] = this.X(u2, v2);
    const ex = (x2 - x1) / L, ez = (z2 - z1) / L;
    const out: [number, number][] = [];
    for (const d of EXTRA_DOORS) {
      if (d.building !== this.dept.building || d.floor !== this.dept.floor) continue;
      const along = (d.x - x1) * ex + (d.z - z1) * ez, off = Math.abs((d.x - x1) * ez - (d.z - z1) * ex);
      if (off < 0.2 && along > d.w / 2 && along < L - d.w / 2) out.push([along / L, d.w]);
    }
    return out;
  }
  room(gapsInner: [number, number][] = [[0.5, 2.2]], gapsOuter: [number, number][] = []) {
    const hw = this.w / 2, hd = this.d / 2;
    // hand-sanitiser station and a wayfinding totem at the door (department colour band on the totem)
    const du = -hw + this.w * gapsInner[0][0];
    const s1 = this.at(du + gapsInner[0][1] / 2 + 0.45, hd - 0.4, 0, 1);
    s1.add("box", "steel", 0, 0.55, 0, 0.05, 1.1, 0.05); s1.add("box", "white", 0, 1.12, 0.03, 0.16, 0.26, 0.12); s1.add("box", "coral", 0, 1.2, 0.1, 0.1, 0.05, 0.01);
    // (inside the door, facing the room: the 1 m corridors stay clear for people walking through)
    const s2 = this.at(du - gapsInner[0][1] / 2 - 0.5, hd - 0.35, 0, -1);
    s2.add("rbox", "white", 0, 0.85, 0, 0.5, 1.7, 0.12); s2.add("box", "screen", 0, 1.3, 0.065, 0.42, 0.5, 0.01); s2.add("box", "band", 0, 1.62, 0.065, 0.46, 0.08, 0.01);
    this.wall(-hw, hd, hw, hd, gapsInner);   // inner (corridor) side
    this.wall(-hw, -hd, hw, -hd, gapsOuter); // outer (façade) side
    this.wall(-hw, -hd, -hw, hd);
    this.wall(hw, -hd, hw, hd);
  }
}

// ---------------------------------------------------------------- per-department layouts
// The order of staff slots follows the order of `staff` entries (patients excepted, they use pats).
type Fn = (b: B) => void;
const L: Record<string, Fn> = {
  // ===== basement
  pharmacie: (b) => {
    b.room();
    b.shelf(-2.6, -5.2, 0, 1, 9.5, 2.1, "white");
    b.shelf(-2.6, -2.4, 0, 1, 9.5, 2.1, "white");
    b.shelf(-2.6, 0.3, 0, -1, 9.5, 2.1, "white");
    b.at(5.6, -1.2, 0, 1).add("rbox", "white", 0, 0.46, 0, 3.6, 0.92, 0.8);
    b.at(5.6, -1.2, 0, 1).add("box", "grey", 0, 0.94, 0, 3.64, 0.04, 0.84);
    b.at(6.4, -4.6, 0, 1).add("rbox", "steel", 0, 0.85, 0, 1.4, 1.7, 1.0);
    b.trolley(2.4, 3.6, 1, 0, "light");
    b.staff.push(b.stand(5.4, -0.2, 0, -1), b.stand(-2.2, -1.05, 0, -1), b.path(-6, 2.0, 1.5, 2.0));
    b.plant(-7.2, 4.8, 0.8);
    // automated dispensing cabinet (robot) and sterilisation autoclaves
    { const a = b.at(6.4, 3.4, -1, 0); a.add("rbox", "white", 0, 1.05, 0, 2.6, 2.1, 1.0); a.add("box", "glassp", 0, 1.2, 0.51, 2.3, 1.2, 0.02); a.add("box", "led", 1.0, 1.95, 0.52, 0.06, 0.06, 0.02); }
    { const a = b.at(3.6, -4.6, 0, 1); a.add("rbox", "steel", 0, 0.85, 0, 1.3, 1.7, 1.0); a.add("cyl", "grey", 0, 0.95, 0.51, 0.7, 0.04, 0.7, { pitch: Math.PI / 2 }); a.add("box", "led", 0.5, 1.6, 0.51, 0.06, 0.06, 0.02); }
    b.cart(0.8, 3.8, 0, -1, "light");
  },
  logistique: (b) => {
    b.room();
    const r = rng(7);
    for (let i = 0; i < 4; i++) {
      const u = -6 + i * 3.2;
      const { add } = b.at(u, -3.6, 0, 1);
      add("box", "wood", 0, 0.07, 0, 1.3, 0.14, 1.1);
      const lv = 1 + Math.floor(r() * 3);
      for (let k = 0; k < lv; k++) add("box", "carton", (r() - 0.5) * 0.1, 0.14 + 0.3 + k * 0.6, 0, 1.15, 0.58, 0.95);
    }
    b.trolley(-5.5, 0.6, 1, 0, "carton");
    b.trolley(-3.6, 0.6, 1, 0, "carton");
    b.staff.push(b.desk(5.2, 1.4, -1, 0, { screens: 2, phone: true }), b.path(-6.2, 3.3, 3.0, 3.3));
    // AGV trolley (automated guided vehicle) with its status light
    { const a = b.at(-1.0, 0.8, 1, 0); a.add("rbox", "light", 0, 0.22, 0, 0.9, 0.3, 1.4); a.add("rbox", "carton", 0, 0.62, 0, 0.8, 0.5, 1.2); a.add("box", "led", 0, 0.4, 0.71, 0.4, 0.05, 0.02); }
    b.shelf(5.0, -5.2, 0, 1, 5, 2.0, "carton");
  },
  bionettoyage: (b) => {
    b.room();
    for (let i = 0; i < 4; i++) b.trolley(-5.5 + i * 1.6, -3.6, 0, 1, "curtain", 0.8);
    b.shelf(4.4, -5.2, 0, 1, 6, 2.0, "white");
    b.at(6.6, 2.5, -1, 0).add("rbox", "steel", 0, 0.45, 0, 1.6, 0.9, 0.7);
    b.staff.push(b.stand(-4.7, -2.2, 0.3, 1), b.stand(-1.6, -2.1, -0.3, 1), b.path(-5.5, 2.6, 4.0, 2.6));
  },
  linge: (b) => {
    b.room();
    b.shelf(-3.5, -5.2, 0, 1, 8, 2.0, "white");
    for (let i = 0; i < 3; i++) b.trolley(-5 + i * 1.7, -1.4, 0, 1, "light", 1.3);
    for (let i = 0; i < 3; i++) b.trolley(3 + i * 1.7, -2.8, 0, 1, "curtain", 0.9);
    b.staff.push(b.stand(-1.5, -0.6, -1, 0.4), b.path(-5.5, 3.0, 5.5, 3.0));
    // washers and food carts
    for (let i = 0; i < 3; i++) { const a = b.at(-6.6 + i * 1.3, -1.0, 0, -1); a.add("rbox", "white", 0, 0.55, 0, 1.1, 1.1, 0.9); a.add("cyl", "dark", 0, 0.6, -0.46, 0.55, 0.03, 0.55, { pitch: Math.PI / 2 }); a.add("box", "led", 0.35, 1.0, -0.46, 0.05, 0.05, 0.02); }
    b.cart(5.6, 1.2, -1, 0, "steel"); b.cart(6.4, 1.2, -1, 0, "steel");
  },
  brancardage: (b) => {
    b.room();
    b.bed(-3.5, -1.5, 1, 0, false, { stretcher: true });
    b.bed(-3.5, -4.3, 1, 0, false, { stretcher: true });
    b.at(-6.4, 2.6, 0, 1).add("rbox", "steel", 0, 0.5, 0, 0.7, 0.9, 0.8); // wheelchair, simplified
    b.staff.push(b.desk(4.5, -2.2, 0, 1, { screens: 2, phone: true }), b.stand(-2.2, -0.4, -1, 0));
  },
  archives: (b) => {
    b.room();
    for (let i = 0; i < 4; i++) b.shelf(-6.2 + i * 2.5, -1.8, 1, 0, 6.2, 2.1, "curtain");
    b.staff.push(b.desk(4.8, -2.4, 0, 1, { screens: 1 }), b.stand(-4.95, 0.6, -1, -0.2));
    b.at(4.8, 2.6, 0, 1).add("rbox", "light", 0, 0.55, 0, 1.2, 1.1, 0.8);
  },

  // ===== ground floor
  accueil: (b) => {
    b.room([[0.5, 3.0]], [[0.5, 4.2]]);
    b.counter(0, 1.2, 0, -1, 5.6);
    b.staff.push(b.stand(-1.3, 2.05, 0, -1), b.stand(1.4, 2.05, 0, -1));
    b.pats.push(b.stand(-1.2, 0.15, 0, 1), b.stand(3.7, -5.0, 0.45, 1)); // at the counter · talking to the guide screen
    const seats = b.chairs(-5.8, -1.0, 1, 0, 4);
    b.chairs(5.8, -1.0, -1, 0, 4);
    b.pats.push(seats[1], seats[3]);
    b.at(0, -3.8, 0, 1).add("box", "light", 0, 0.012, 0, 4.2, 0.02, 2.4); // entrance mat
    b.at(-3.2, 3.6, 0, -1).add("rbox", "white", 0, 0.75, 0, 0.5, 1.5, 0.3); // ticket totem
    b.at(-3.2, 3.6, 0, -1).add("box", "screen", 0, 1.15, 0.16, 0.36, 0.5, 0.02);
    b.plant(-7.2, -5.0, 1.1); b.plant(7.2, -5.0, 1.1); b.plant(7.2, 5.0, 0.9);
    { const a = b.at(-7.4, 2.6, 1, 0); a.add("rbox", "white", 0, 0.95, 0, 0.9, 1.9, 0.8); a.add("box", "glassp", 0, 1.15, 0.41, 0.7, 1.2, 0.02); a.add("box", "band", 0, 1.82, 0.41, 0.8, 0.12, 0.02); }
    { const a = b.at(-7.4, 4.2, 1, 0); a.add("rbox", "white", 0, 0.5, 0, 0.35, 1.0, 0.3); a.add("cyl", "glassp", 0, 1.22, 0, 0.28, 0.45, 0.28); }
    { const a = b.at(7.4, 2.6, -1, 0); a.add("cyl", "grey", 0, 0.02, 0, 0.4, 0.04, 0.4); a.add("box", "grey", 0, 0.9, 0, 0.04, 1.8, 0.04); a.add("box", "grey", 0, 1.72, 0, 0.5, 0.03, 0.03); }
  },
  admissions: (b) => {
    b.room();
    const us = [-5.4, -1.8, 1.8, 5.4];
    for (const u of us) b.staff.push(b.desk(u, -2.0, 0, 1, { screens: 1, phone: true }));
    for (let i = 0; i < 3; i++) b.partition(-3.6 + i * 3.6, -3.0, -3.6 + i * 3.6, -1.2, 1.25, "curtain", 0.06);
    b.chair(-1.8, -0.8, 0, -1); b.chair(5.4, -0.8, 0, -1);
    b.pats.push(b.at(-1.8, -0.8, 0, -1).slot(0, 0.02, "sit"), b.stand(1.8, -0.75, 0, -1), b.stand(5.7, 1.85, 0, 1)); // … scanning a card at the kiosk
    b.stanchions(1.8, 3.6, 1, 0, 4);
    b.chairs(-5.8, 4.0, 0, -1, 4);
    b.plant(7.3, 5.0, 0.9);
  },
  urgences: (b) => {
    b.room([[0.5, 2.2]], [[0.82, 3.2]]);
    const beds = [-2.0, 1.6, 5.2];
    beds.forEach((u, i) => {
      b.bed(u, -3.6, 0, 1, i < 2, { monitor: true });
      if (i < 2) b.partition(u + 1.8, -6, u + 1.8, -2.0, 1.7, "curtain", 0.05);
    });
    b.staff.push(b.desk(-5.6, 2.6, 0, 1, { screens: 2, phone: true }));
    b.staff.push(b.stand(-0.7, -2.0, -1, -0.6), b.stand(2.9, -2.4, -1, -0.3), b.path(-3.5, 0.9, 6.0, 0.9));
    b.trolley(6.8, 3.6, -1, 0, "light", 0.8);
    // crash cart (muted coral) and an extra stretcher
    b.cart(-4.0, 3.8, 0, -1, "coral", true);
    b.bed(3.6, 2.6, 1, 0, false, { stretcher: true });
  },
  caisse: (b) => {
    b.room();
    b.staff.push(b.desk(-3.0, 0.2, 0, 1, { phone: true }), b.desk(0.2, 0.2, 0, 1, { phone: true }), b.desk(4.6, -2.8, 0, 1, { screens: 2, phone: true }));
    b.partition(-6.2, 1.2, 1.9, 1.2, 1.35, "curtain", 0.06);
    b.stanchions(-1.4, 3.4, 1, 0, 4);
    b.at(-7.0, -5.0, 0, 1).add("rbox", "dark", 0, 0.55, 0, 0.8, 1.1, 0.7);
    b.chairs(5.4, 3.4, 0, -1, 3);
  },
  standard: (b) => {
    b.room();
    b.staff.push(
      b.desk(-0.8, -0.8, 0, 1, { phone: true }), b.desk(0.8, -0.8, 0, 1, { phone: true }),
      b.desk(-0.8, 0.8, 0, -1, { phone: true }), b.desk(0.8, 0.8, 0, -1, { phone: true }),
    );
    const { add } = b.at(0, -5.6, 0, 1);
    add("box", "screen", 0, 1.6, 0, 4.2, 1.3, 0.08);
    add("box", "grey", 0, 0.5, 0, 0.1, 1.0, 0.1);
    b.plant(-7.0, 4.8, 0.9); b.plant(7.0, 4.8, 0.9);
    b.table(-5.2, 2.6, 0, 1, 1.6, 1.0);
  },
  imagerie: (b) => {
    b.room();
    const { add } = b.at(-3.4, -1.4, 1, 0);
    add("torus", "white", 0, 1.2, 0, 1, 1, 1);
    add("rbox", "white", 0, 0.32, 0, 0.8, 0.64, 2.3);
    add("rbox", "mattress", 0, 0.9, 1.35, 0.62, 0.12, 2.6);
    add("rbox", "light", 0, 0.42, 1.6, 0.46, 0.84, 1.5);
    b.pats.push(b.at(-3.4, -1.4, 1, 0).slot(0, 2.5, "lie", { y: 1.1 }));
    b.partition(3.2, -6, 3.2, 1.4, 1.0);
    b.staff.push(b.desk(5.6, -2.2, -1, 0, { screens: 2 }));
    b.staff.push(b.stand(-1.0, 0.7, -0.6, -1), b.stand(-4.4, 1.3, 0.3, -1));
    b.at(-6.8, -4.6, 0, 1).add("rbox", "light", 0, 0.9, 0, 1.0, 1.8, 0.7);
    // lead-glass control-room window, X-ray C-arm, ultrasound cart
    b.partition(3.2, -5.6, 3.2, 1.0, 2.0, "glassp", 0.05);
    { const a = b.at(-4.6, 3.6, 1, 0); a.add("cyl", "white", 0, 0.03, 0, 0.9, 0.06, 0.9); a.add("box", "white", 0, 0.9, 0, 0.18, 1.8, 0.18);
      a.add("box", "white", 0, 1.8, 0.45, 0.16, 0.16, 1.0); a.add("torus", "white", 0, 1.35, 0.95, 0.42, 0.42, 0.3, { pitch: 0 }); a.add("rbox", "light", 0, 1.0, 0.95, 0.35, 0.2, 0.35); }
    b.cart(1.4, 3.6, 0, -1, "white", true);
  },

  // ===== 1st floor
  consultations: (b) => {
    b.room();
    b.wall(-b.w / 2, -0.6, b.w / 2, -0.6, [[0.22, 1.6], [0.78, 1.6]]);
    b.partition(0, -6, 0, -0.6, 1.0);
    // room A: doctor at desk facing a patient
    b.staff.length = 0;
    const docA = b.desk(-4.2, -3.3, 1, 0, { screens: 1, paper: true });
    b.chair(-2.9, -3.3, -1, 0);
    // room B: exam couch
    b.bed(4.0, -4.0, 1, 0, true, {});
    // secretaries
    const sec = [b.desk(-3.0, 2.0, 0, 1, { phone: true }), b.desk(0, 2.0, 0, 1, { phone: true }), b.desk(3.0, 2.0, 0, 1, { phone: true })];
    b.staff.push(...sec, docA, b.stand(3.6, -2.2, 0, -1));
    const seats = b.chairs(-5.9, 4.9, 1, 0, 3);
    b.pats.unshift(b.at(-2.9, -3.3, -1, 0).slot(0, 0.02, "sit"));
    b.pats.push(seats[1]);
    b.plant(7.3, 5.0, 0.8);
  },
  documents: (b) => {
    b.room();
    b.staff.push(b.desk(-1.5, -1.2, 0, 1, { screens: 2 }));
    b.shelf(-3.2, -5.2, 0, 1, 8, 2.0, "curtain");
    const { add } = b.at(4.0, -2.6, 0, 1);
    add("rbox", "light", 0, 0.45, 0, 1.4, 0.9, 0.8);
    add("rbox", "white", 0, 1.05, 0, 1.2, 0.3, 0.7);
    b.table(3.6, 1.8, 1, 0, 2.6, 1.1);
    for (let i = 0; i < 4; i++) b.at(3.6, 0.9 + i * 0.6, 1, 0).add("box", "white", 0, 0.77, 0, 0.32, 0.3, 0.42, { paper: true });
    b.plant(-7.2, 4.8, 0.8);
  },
  pec: (b) => {
    b.room();
    b.staff.push(
      b.desk(-3.6, -0.8, 0, 1, { phone: true }), b.desk(-2.0, -0.8, 0, 1, { phone: true }),
      b.desk(2.0, -0.8, 0, 1, { phone: true }), b.desk(3.6, -0.8, 0, 1, { phone: true }),
    );
    b.shelf(0, -5.2, 0, 1, 7, 1.4, "curtain");
    { const a = b.at(6.4, 2.2, -1, 0); a.add("rbox", "light", 0, 0.38, 0, 0.7, 0.76, 0.55); a.add("rbox", "white", 0, 0.92, 0, 0.6, 0.32, 0.5); a.add("box", "led", 0.22, 1.06, 0.26, 0.04, 0.04, 0.02); }
    b.plant(-7.2, 4.8, 0.9);
  },
  facturation: (b) => {
    b.room();
    b.staff.push(
      b.desk(-4.4, -2.2, 0, 1, { phone: true }), b.desk(-2.8, -2.2, 0, 1, { phone: true }),
      b.desk(-4.4, 1.6, 0, 1, { phone: true }), b.desk(-2.8, 1.6, 0, 1, { phone: true }),
      b.desk(3.4, -1.2, 0, 1, { screens: 2, phone: true }),
    );
    b.shelf(4.0, -5.2, 0, 1, 6, 1.6, "curtain");
    b.at(6.6, 3.2, -1, 0).add("rbox", "light", 0, 0.55, 0, 1.0, 1.1, 0.7);
  },
  codage: (b) => {
    b.room();
    b.staff.push(b.desk(-2.2, -1.0, 0, 1, { screens: 2 }), b.desk(2.2, -1.0, 0, 1, { screens: 2 }));
    b.shelf(0, -5.2, 0, 1, 9, 1.8, "curtain");
    { const a = b.at(6.4, 2.2, -1, 0); a.add("rbox", "light", 0, 0.38, 0, 0.7, 0.76, 0.55); a.add("rbox", "white", 0, 0.92, 0, 0.6, 0.32, 0.5); a.add("box", "led", 0.22, 1.06, 0.26, 0.04, 0.04, 0.02); }
    b.plant(7.0, 4.6, 0.9);
  },
  laboratoire: (b) => {
    b.room();
    for (const v of [-3.6, 0.2]) {
      const { add } = b.at(-1.4, v, 0, 1);
      add("rbox", "white", 0, 0.44, 0, 10, 0.88, 0.8);
      add("box", "grey", 0, 0.9, 0, 10.04, 0.04, 0.84);
      add("box", "white", 0, 1.5, -0.28, 10, 0.03, 0.3);
      for (let i = 0; i < 5; i++) add("rbox", "light", -4 + i * 2, 1.15, -0.05, 0.6, 0.46, 0.5);
      for (let i = 0; i < 6; i++) add("cyl", "curtain", -3.3 + i * 1.4, 1.0, 0.18, 0.09, 0.18, 0.09);
    }
    b.staff.push(b.desk(6.0, 3.2, -1, 0, { screens: 1 }), b.stand(-3.0, -2.75, 0, -1), b.stand(1.6, 1.05, 0, -1));
    // centrifuges, microscopes, sample racks, fridges
    for (const [u, v] of [[-5.5, -3.75], [2.5, -3.75], [-4.5, 0.05]] as const) { const a = b.at(u, v, 0, 1); a.add("cyl", "white", 0, 1.08, 0, 0.42, 0.32, 0.42); a.add("cyl", "grey", 0, 1.25, 0, 0.36, 0.03, 0.36); a.add("box", "led", 0.15, 1.05, 0.21, 0.04, 0.04, 0.02); }
    for (const u of [-1.5, 4.5]) { const a = b.at(u, 0.05, 0, 1); a.add("box", "grey", 0, 1.0, 0, 0.18, 0.2, 0.25); a.add("box", "grey", 0, 1.22, -0.06, 0.06, 0.34, 0.06); a.add("cyl", "dark", 0, 1.38, 0.02, 0.12, 0.12, 0.12); }
    for (const u of [0.5, 5.5]) { const a = b.at(u, -3.65, 0, 1); a.add("box", "light", 0, 0.98, 0, 0.5, 0.1, 0.22); for (let k = 0; k < 6; k++) a.add("cyl", "coral", -0.2 + k * 0.08, 1.07, 0, 0.04, 0.12, 0.04); }
    b.fridge(-7.4, 4.6, 0, -1); b.fridge(-6.5, 4.6, 0, -1, false);
  },

  // ===== 2nd floor
  bloc: (b) => {
    b.room();
    b.partition(1.5, -6, 1.5, 2.6, 2.2, "wall");
    const or = (u: number, patient: boolean) => {
      const { add } = b.at(u, -1.8, 1, 0);
      add("box", "steel", 0, 0.38, 0, 0.5, 0.76, 0.6);
      add("rbox", "mattress", 0, 0.84, 0, 0.66, 0.12, 2.1);
      if (patient) add("rbox", "curtain", 0, 1.1, 0.35, 0.95, 0.12, 1.6);
      add("box", "grey", -1.5, 1.3, 0, 0.07, 2.6, 0.07);
      add("box", "grey", -0.75, 2.6, 0, 1.5, 0.06, 0.06);
      add("cyl", "lamp", 0, 2.5, 0, 1.0, 0.14, 1.0);
      add("cyl", "grey", 0, 2.6, 0, 1.08, 0.08, 1.08);
      add("box", "steel", 1.0, 0.7, -1.4, 0.6, 1.4, 0.5);
      add("box", "screen", 1.0, 1.65, -1.4, 0.55, 0.4, 0.05);
    };
    or(-5.0, true);
    or(7.0, false);
    b.pats.push(b.at(-5.0, -1.8, 1, 0).slot(0, 0.93, "lie", { y: 1.04 }));
    b.staff.push(b.stand(-5.4, -0.6, -0.1, -1), b.stand(-4.3, -3.0, -0.1, 1));
    b.trolley(-2.5, -3.6, -1, 0, "steel", 0.7);
    b.staff.push(b.stand(-2.2, -2.5, -1, 0.2), b.stand(-3.4, -0.4, -0.6, -1), b.path(-8, 4.2, 8, 4.2));
    for (let i = 0; i < 3; i++) b.at(-9.5 + i * 1.2, 5.6, 0, -1).add("rbox", "steel", 0, 0.5, 0, 1.0, 1.0, 0.55);
    // anaesthesia machine, instrument tables, boom monitors in both theatres
    for (const u of [-5.0, 7.0]) {
      { const a = b.at(u - 1.6, -3.4, 1, 0); a.add("rbox", "white", 0, 0.6, 0, 0.7, 1.2, 0.6); a.add("box", "ecg", 0, 1.45, 0.05, 0.5, 0.36, 0.04, { pitch: -0.15 }); a.add("box", "led", 0.25, 1.05, 0.31, 0.05, 0.05, 0.02); }
      { const a = b.at(u + 1.4, -0.3, -1, 0); a.add("box", "steel", 0, 0.88, 0, 1.2, 0.04, 0.6); a.add("box", "steel", 0, 0.45, 0, 0.05, 0.85, 0.05); a.add("box", "light", 0, 0.92, 0, 0.9, 0.03, 0.4); }
      { const a = b.at(u + 1.2, -3.6, 0, 1); a.add("box", "grey", 0, 2.7, 0, 0.12, 0.6, 0.12); a.add("box", "grey", -0.5, 2.4, 0, 1.0, 0.08, 0.08); a.add("box", "ecg", -1.0, 2.05, 0.05, 0.6, 0.4, 0.05); }
    }
    for (let i = 0; i < 2; i++) { const a = b.at(-0.8 + i * 1.1, 5.7, 0, -1); a.add("rbox", "steel", 0, 0.9, 0, 0.9, 0.35, 0.5); a.add("box", "steel", 0, 0.45, 0, 0.8, 0.9, 0.45); }
  },
  reanimation: (b) => {
    b.room();
    const us = [-9, -3, 3, 9];
    us.forEach((u, i) => {
      b.bed(u, -3.3, 0, 1, i < 3, { monitor: true });
      if (i < 3) b.partition(u + 3, -6, u + 3, -1.4, 1.8, "curtain", 0.05);
    });
    b.counter(0, 3.6, 0, -1, 6);
    b.staff.push(b.stand(-1.6, -2.4, -1, -0.3));
    b.staff.push(b.stand(-7.4, -2.2, -1, -0.5), b.desk(1.6, 4.3, 0, -1, { screens: 2, chair: true, paper: true }), b.path(-10, 0.6, 10, 0.6));
    // ventilators and IV pumps at every bay, a medication cart at the station
    for (const u of [-9, -3, 3, 9]) { b.ventilator(u + 1.1, -4.6, 0, 1); b.ivPole(u - 1.0, -2.0); }
    b.cart(-2.2, 3.6, 0, -1, "light", true);
  },
  maternite: (b) => {
    b.room();
    const us = [-8, 0, 8];
    us.forEach((u, i) => {
      b.bed(u, -3.0, 0, 1, i < 2, { crib: true });
      b.armchair(u + 1.9, -2.2, -1, 0.5);
      if (i < 2) b.wall(u + 4, -6, u + 4, 1.0);
    });
    b.staff.push(b.stand(-6.6, -1.8, -1, -0.3), b.stand(1.4, -1.8, -1, -0.4), b.path(-10, 3.4, 10, 3.4));
    // neonatal incubator and a nursing cart
    { const a = b.at(9.8, 2.4, -1, 0); a.add("box", "steel", 0, 0.45, 0, 0.6, 0.9, 0.9); a.add("rbox", "white", 0, 0.95, 0, 0.75, 0.12, 1.0); a.add("rbox", "glassp", 0, 1.22, 0, 0.66, 0.42, 0.9); a.add("box", "led", 0.3, 0.75, 0.46, 0.05, 0.05, 0.02); }
    b.cart(-10.4, 2.4, 1, 0, "light");
    b.plant(11.3, 5.0, 0.9);
  },
  reserve: (b) => {
    b.room();
    for (let i = 0; i < 3; i++) b.shelf(-6 + i * 4.2, -2.2, 0, 1, 3.4, 2.0, i === 1 ? "white" : "carton");
    b.shelf(-1.8, -5.3, 0, 1, 12, 2.0, "white");
    for (let i = 0; i < 3; i++) b.trolley(6 + i * 1.6, -0.5, 0, 1, "light", 1.0);
    b.staff.push(b.stand(-1.8, 0.1, -0.4, -1));
  },

  // ===== 3rd floor
  hospitalisation: (b) => {
    const hw = b.w / 2, hd = b.d / 2;
    b.wall(-hw, -hd, hw, -hd); b.wall(-hw, hd, hw, hd); b.wall(-hw, -hd, -hw, hd); b.wall(hw, -hd, hw, hd, [[0.5, 3]]);
    const rw = b.w / 3;
    for (const side of [-1, 1]) {
      const vFront = side * 4.6;
      b.wall(-hw, vFront, hw, vFront, [[1 / 6 + 0.06, 1.3], [0.5 + 0.06, 1.3], [5 / 6 + 0.06, 1.3]]);
      for (let k = 1; k < 3; k++) b.partition(-hw + k * rw, vFront, -hw + k * rw, side * hd, 1.0);
      for (let k = 0; k < 3; k++) {
        const u = -hw + rw * (k + 0.5);
        b.bed(u - 1.2, side * 9.0, 0, -side, true, {});
        b.armchair(u + 1.6, side * 8.2, -1, -side * 0.6);
      }
    }
    b.counter(0, 0, 0, 1, 5.5);
    b.staff.push(
      b.desk(-1.2, -1.1, 0, 1, { screens: 1, chair: true }), b.stand(1.4, -0.75, 0, 1),
      b.path(-10.5, 2.6, 9.5, 2.6), b.path(9.0, -2.6, -10.0, -2.6),
    );
    b.staff.push(b.stand(rw * 0 - hw + rw * 0.5 + 0.2, -7.6, 1, -1), b.stand(rw * 2 - hw + rw * 0.5 + 0.2, 7.6, 1, 1));
    b.staff.push(b.stand(-hw + rw * 1.5 + 0.2, -7.6, -1, -1));
    b.trolley(-5.5, 0.4, 1, 0, "light", 0.9);
    b.plant(10.8, 0, 0.9);
    // a TV facing each bed, screens on the nurse station, a medication cart
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const u = -hw + rw * (k + 0.5);
      const a = b.at(u - 1.2, side * 4.85, 0, side); a.add("box", "dark", 0, 1.9, 0, 0.9, 0.52, 0.05); a.add("box", "grey", 0, 1.5, -0.03, 0.05, 0.3, 0.05);
    }
    { const a = b.at(1.4, 0.35, 0, -1); a.add("box", "screen", -0.6, 1.3, 0, 0.5, 0.32, 0.03); a.add("box", "screen", 0.6, 1.3, 0, 0.5, 0.32, 0.03); }
    b.cart(3.6, -1.8, 0, 1, "light", true);
  },
  lits: (b) => {
    b.room();
    b.staff.push(b.desk(-3.0, -1.0, 0, 1, { screens: 2, phone: true }));
    const { add } = b.at(-3.0, -5.6, 0, 1);
    add("box", "screen", 0, 1.6, 0, 5.0, 1.5, 0.08);
    for (let i = 0; i < 2; i++) b.bed(5 + i * 2.6, -2.5, 0, 1, false);
    b.table(-6.5, 3.4, 1, 0, 1.8, 1.0);
  },
  cadres: (b) => {
    b.room();
    b.staff.push(b.desk(-6.5, -1.5, 0, 1, { screens: 1, phone: true }));
    b.table(3.0, 0.2, 0, 1, 4.0, 1.6);
    for (const [du, dv, fu, fv] of [[-1.2, -1.2, 0, 1], [1.2, -1.2, 0, 1], [-1.2, 1.2, 0, -1], [1.2, 1.2, 0, -1]] as const) b.chair(3.0 + du, 0.2 + dv, fu, fv);
    const { add } = b.at(3.0, -5.6, 0, 1);
    add("box", "white", 0, 1.5, 0, 3.2, 1.2, 0.05);
    add("box", "grey", 0, 0.45, 0, 0.08, 0.9, 0.08);
    b.staff.push(b.stand(1.6, -4.4, 0.4, -1));
    b.plant(11, 4.6, 0.9);
  },

  // ===== 4th floor (v1.3): quality & patient relations, technical management (JABB Twin)
  qualite: (b) => {
    b.room([[0.5, 2.4]]);
    // meeting room (partitioned) with the quality wall screen at the back
    b.wall(-b.w / 2, -3.0, 3.0, -3.0, [[0.78, 1.6]], 1.0);
    b.partition(3.0, -12.5, 3.0, -3.0, 1.0);
    b.table(-4.5, -7.6, 0, 1, 6.0, 2.0);
    const seats: Slot[] = [];
    for (let i = 0; i < 3; i++) {
      const u = -6.6 + i * 2.1;
      b.chair(u, -8.9, 0, 1); b.chair(u, -6.3, 0, -1);
      seats.push(b.at(u, -8.9, 0, 1).slot(0, 0.02, "sit"));
    }
    b.staff.push(b.stand(-1.4, -10.6, 0.4, 1));                                 // quality manager at the screen
    b.staff.push(b.desk(-5.5, 2.4, 0, 1, { phone: true }), b.desk(-2.4, 2.4, 0, 1, { phone: true })); // patient relations
    b.shelf(7.5, -11.9, 0, 1, 7, 1.6, "curtain");
    b.chairs(7.5, 6.5, 0, -1, 3);
    b.plant(-11.2, 11.2, 1.0); b.plant(11.2, 11.2, 1.0); b.plant(1.8, -4.0, 0.8);
    void seats;
  },
  technique: (b) => {
    b.room([[0.5, 2.4]]);
    // twin control room: two consoles facing the large twin screen (the screen itself is drawn by Twin.tsx)
    b.staff.push(b.stand(5.6, 3.6, -0.3, 1));                                    // biomedical technician at the bench
    b.staff.push(b.stand(-3.6, -9.6, 0.2, -1));                                  // technician at the twin screen
    b.staff.push(b.desk(-5.0, -6.4, 0, -1, { screens: 3, phone: true }));          // energy & maintenance manager
    b.desk(-1.6, -6.4, 0, -1, { screens: 2 });
    // biomedical workshop benches (equipment and blue location tags drawn by Twin.tsx)
    for (const v of [2.2, 6.6]) {
      const { add } = b.at(5.6, v, 0, -1);
      add("rbox", "white", 0, 0.44, 0, 7.0, 0.88, 0.85);
      add("box", "grey", 0, 0.9, 0, 7.04, 0.04, 0.89);
    }
    // equipment pool: pumps on poles, monitors on stands
    for (let i = 0; i < 4; i++) {
      const { add } = b.at(10.6, -2.4 + i * 1.3, -1, 0);
      add("cyl", "steel", 0, 0.03, 0, 0.5, 0.06, 0.5);
      add("box", "steel", 0, 0.85, 0, 0.05, 1.7, 0.05);
      add("rbox", "light", 0, 1.2, 0.08, 0.26, 0.34, 0.2);
    }
    b.shelf(-8.5, 11.9, 0, -1, 7, 1.8, "carton");
    b.plant(11.2, 11.2, 0.9);
  },

  // ===== head office annex
  "siege-generaux": (b) => {
    b.room([[0.5, 3]], [[0.5, 3]]);
    b.counter(0, 5.0, 0, 1, 4.5);
    b.staff.push(b.desk(-6.0, -1.5, 0, 1, { phone: true }), b.desk(-3.8, -1.5, 0, 1, { phone: true }));
    for (let i = 0; i < 3; i++) b.at(5.5 + i * 0.9, -7.6, 0, 1).add("rbox", "dark", 0, 1.0, 0, 0.7, 2.0, 0.9);
    b.staff.push(b.stand(4.6, -6.2, 0.4, -1));
    b.staff.push(b.desk(-1.6, -1.5, 0, 1, { phone: true }));
    b.shelf(-5, -7.8, 0, 1, 6, 1.6, "curtain");
    b.chairs(5.2, 2.6, -1, 0, 3);
    b.plant(-9.6, 7.6, 1.1); b.plant(9.6, 7.6, 1.1);
  },
  "siege-finance": (b) => {
    b.room();
    const pos: [number, number][] = [[-6.2, -3.6], [-4.6, -3.6], [-6.2, 0.4], [-4.6, 0.4], [2.6, -3.6]];
    for (const [u, v] of pos) b.staff.push(b.desk(u, v, 0, 1, { phone: true }));
    b.staff.push(b.desk(5.8, 1.5, -1, 0, { screens: 2 }));
    b.shelf(3.6, -7.8, 0, 1, 7, 1.6, "curtain");
    b.table(-1.0, 5.0, 1, 0, 3.2, 1.4);
    b.plant(9.6, 7.6, 1.0);
  },
  "siege-rh": (b) => {
    b.room();
    b.staff.push(b.desk(-6.4, -3.0, 0, 1, { phone: true }), b.desk(-4.8, -3.0, 0, 1, { phone: true }), b.desk(-5.6, 1.4, 0, 1, { screens: 2 }));
    b.wall(1.5, -8.5, 1.5, 2.0, [[0.8, 1.4]], 2.2);
    b.wall(1.5, 2.0, 10.5, 2.0, [], 2.2);
    b.table(6.0, -3.2, 0, 1, 3.6, 1.6);
    for (const [du, dv, fu, fv] of [[-1, -1.25, 0, 1], [1, -1.25, 0, 1], [-1, 1.25, 0, -1], [1, 1.25, 0, -1]] as const) b.chair(6.0 + du, -3.2 + dv, fu, fv);
    b.staff.push(b.at(7.0, -1.95, 0, -1).slot(0, 0.02, "sit"));
    b.plant(-9.6, 7.6, 1.0);
  },
  "siege-pilotage": (b) => {
    b.room();
    b.table(0, 0.6, 0, 1, 7.5, 2.2); // long side along u, chairs on both long sides facing it
    const seats: Slot[] = [];
    for (let i = 0; i < 4; i++) {
      const u = -2.7 + i * 1.8;
      b.chair(u, -0.75, 0, 1); b.chair(u, 1.95, 0, -1);
      seats.push(b.at(u, -0.75, 0, 1).slot(0, 0.02, "sit"), b.at(u, 1.95, 0, -1).slot(0, 0.02, "sit"));
    }
    b.staff.push(b.stand(-2.2, -5.2, 0.5, 1), b.stand(1.4, -5.4, -0.4, 1), seats[1], seats[4]);
    b.plant(-9.6, 7.6, 1.0); b.plant(9.6, 7.6, 1.0);
  },
};

// ---------------------------------------------------------------- assembly
function deptFrame(d: Dept) {
  const [cx, cz, w, dd] = d.rect;
  const s = d.building === "annex" || Math.abs(cz) < 0.01 ? 1 : cz < 0 ? 1 : -1;
  return new B(d, cx, cz, w, dd, s);
}

export const FLOOR_KEYS = FLOORS.map((f) => ({ building: f.building, floor: f.floor }));
/** Highest floor of each building (the roof sits on top of it). */
export const TOP_FLOOR: Record<"main" | "annex", number> = {
  main: Math.max(...FLOORS.filter((f) => f.building === "main").map((f) => f.floor)),
  annex: Math.max(...FLOORS.filter((f) => f.building === "annex").map((f) => f.floor)),
};

function build(): FloorLayout[] {
  const out: FloorLayout[] = [];
  const eligible: Person[] = [];
  for (const fk of FLOOR_KEYS) {
    const B0 = fk.building === "main" ? MAIN : ANNEX;
    const fl: FloorLayout = { key: `${fk.building}:${fk.floor}`, building: fk.building, floor: fk.floor, w: B0.w, d: B0.d, ox: B0.x, oz: B0.z, depts: [], parts: [], people: [] };
    for (const d of DEPTS) {
      if (d.building !== fk.building || d.floor !== fk.floor) continue;
      fl.depts.push(d);
      const b = deptFrame(d);
      (L[d.id] ?? ((x: B) => x.room()))(b);
      fl.parts.push(...b.parts);
      // assign people
      const roleIdx: Record<string, number> = {};
      let shrinkN = 0;
      const door: [number, number] = b.X(0, b.d / 2 + 0.6);
      let fallback = 0;
      for (const st of d.staff) {
        for (let k = 0; k < st.n; k++) {
          const idx = roleIdx[st.role] ?? 0;
          roleIdx[st.role] = idx + 1;
          let slot = st.role === "patient" ? b.pats.shift() : b.staff.shift();
          if (!slot) {
            const u = -b.w / 2 + 1.5 + ((fallback++ * 2.3) % (b.w - 3));
            slot = b.stand(u, b.d / 2 - 1.6, 0, -1);
          }
          const seed = hash(`${d.id}/${st.role}/${idx}`);
          const pr = rng(seed);
          const p: Person = {
            id: `${d.id}/${st.role}/${idx}`, dept: d.id, role: st.role, label: st.label, slot, seed: pr(),
            torso: ROLE_COLOR[st.role], legs: LEGS[st.role], skin: SKIN[Math.floor(pr() * SKIN.length)],
            hair: pr() < 0.86 ? HAIR[Math.floor(pr() * HAIR.length)] : null, coat: st.role === "medecin", agent: -1,
            shrink: isShrinkRole(d.id, st.role) ? shrinkN++ : -1, desk: slot.desk ?? -1, door,
          };
          fl.people.push(p);
          if (d.cases.length && st.role !== "patient") eligible.push(p);
        }
      }
    }
    out.push(fl);
  }
  // agent thresholds: spread evenly through the programme ramp, in a stable shuffled order
  const order = eligible.map((p) => ({ p, k: hash(p.id + "#agent") })).sort((a, b) => a.k - b.k);
  order.forEach(({ p }, i) => { p.agent = (i + 0.5) / order.length * 0.96; });
  return out;
}

export const FLOOR_LAYOUTS: FloorLayout[] = build();
export const FLOOR_BY_KEY: Record<string, FloorLayout> = Object.fromEntries(FLOOR_LAYOUTS.map((f) => [f.key, f]));
export const PERSON_BY_ID: Record<string, { floor: FloorLayout; i: number; p: Person }> = Object.fromEntries(
  FLOOR_LAYOUTS.flatMap((f) => f.people.map((p, i) => [p.id, { floor: f, i, p }])),
);
