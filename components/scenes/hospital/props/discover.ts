// Reads the existing furniture of layout.ts (read only) and recognises what the props attach to: beds, desks, chairs,
// waiting rows, armchairs, tables, counters, department doors. Recognition is by part signature (size, height, material),
// so the props follow layout.ts if it moves things around. Floor-local coordinates throughout.
import { DEPT, type Dept } from "@/lib/hospital";
import type { FloorLayout, Part } from "../layout";

const near = (a: number, b: number, e = 0.011) => Math.abs(a - b) < e;
const fwd = (yaw: number): [number, number] => [Math.sin(yaw), Math.cos(yaw)];

export type BedF = { x: number; z: number; yaw: number; dept: string; patient: boolean; monitor: boolean; crib: boolean };
export type DeskF = { x: number; z: number; yaw: number; w: number; dept: string; desk: number; screens: number; phone: boolean; occupied: boolean };
export type SeatF = { x: number; z: number; yaw: number; dept: string; kind: "chair" | "row" | "arm"; top: number; taken: boolean; desk: number };
export type TableF = { x: number; z: number; yaw: number; w: number; d: number; dept: string };
export type CounterF = { x: number; z: number; yaw: number; len: number; dept: string };
export type DoorF = { x: number; z: number; w: number; nx: number; nz: number; dept: string; side: "inner" | "outer" | "w" | "e"; along: "x" | "z" };

export type FloorFeatures = {
  beds: BedF[]; desks: DeskF[]; seats: SeatF[]; tables: TableF[]; counters: CounterF[]; doors: DoorF[];
};

function seatTaken(fl: FloorLayout, x: number, z: number) {
  return fl.people.some((p) => (p.slot.pose === "sit") && Math.hypot(p.slot.x - x, p.slot.z - z) < 0.35);
}

/** Door gaps along the four sides of a department rectangle (from its wall parts). n = outward normal of that side. */
function doorsOf(fl: FloorLayout, d: Dept): DoorF[] {
  const [cx, cz, w, dd] = d.rect;
  const walls = fl.parts.filter((p) => p.dept === d.id && p.m === "wall" && p.g === "box" && p.sx <= 0.2);
  const s = d.building === "annex" || Math.abs(cz) < 0.01 ? 1 : cz < 0 ? 1 : -1;
  const out: DoorF[] = [];
  const sides: { side: DoorF["side"]; along: "x" | "z"; at: number; a0: number; a1: number; nx: number; nz: number }[] = [
    { side: "inner", along: "x", at: cz + (dd / 2) * s, a0: cx - w / 2, a1: cx + w / 2, nx: 0, nz: s },
    { side: "outer", along: "x", at: cz - (dd / 2) * s, a0: cx - w / 2, a1: cx + w / 2, nx: 0, nz: -s },
    { side: "w", along: "z", at: cx - w / 2, a0: cz - dd / 2, a1: cz + dd / 2, nx: -1, nz: 0 },
    { side: "e", along: "z", at: cx + w / 2, a0: cz - dd / 2, a1: cz + dd / 2, nx: 1, nz: 0 },
  ];
  for (const sd of sides) {
    const segs: [number, number][] = [];
    for (const p of walls) {
      const alongX = Math.abs(Math.sin(p.yaw)) > 0.7; // yaw = atan2(dx, dz): walls along x have |sin| = 1
      if ((sd.along === "x") !== alongX) continue;
      const pos = sd.along === "x" ? p.z : p.x;
      if (Math.abs(pos - sd.at) > 0.08) continue;
      const c = sd.along === "x" ? p.x : p.z;
      segs.push([c - p.sz / 2, c + p.sz / 2]);
    }
    segs.sort((a, b) => a[0] - b[0]);
    let t = sd.a0;
    const gaps: [number, number][] = [];
    for (const [a, b] of segs) { if (a - t > 0.6) gaps.push([t, a]); t = Math.max(t, b); }
    if (sd.a1 - t > 0.6 && segs.length) gaps.push([t, sd.a1]);
    for (const [a, b] of gaps) {
      const c = (a + b) / 2;
      out.push(sd.along === "x"
        ? { x: c, z: sd.at, w: b - a, nx: sd.nx, nz: sd.nz, dept: d.id, side: sd.side, along: "x" }
        : { x: sd.at, z: c, w: b - a, nx: sd.nx, nz: sd.nz, dept: d.id, side: sd.side, along: "z" });
    }
  }
  return out;
}

const cache = new Map<string, FloorFeatures>();
export function features(fl: FloorLayout): FloorFeatures {
  const hit = cache.get(fl.key);
  if (hit) return hit;
  const P = fl.parts;
  const beds: BedF[] = [];
  for (const p of P) {
    if (!(p.g === "box" && p.m === "steel" && near(p.sx, 0.9) && near(p.sy, 0.3) && near(p.sz, 1.95) && near(p.y, 0.28))) continue;
    const [fx, fz] = fwd(p.yaw);
    const blanket = P.find((q) => q.m === "blanket" && Math.hypot(q.x - (p.x + fx * 0.32), q.z - (p.z + fz * 0.32)) < 0.05);
    const monitor = P.some((q) => q.m === "ecg" && q.dept === p.dept && Math.hypot(q.x - p.x, q.z - p.z) < 1.6);
    const crib = P.some((q) => q.g === "rbox" && q.m === "curtain" && near(q.y, 0.72) && Math.hypot(q.x - p.x, q.z - p.z) < 1.4);
    beds.push({ x: p.x, z: p.z, yaw: p.yaw, dept: p.dept, patient: !!blanket && blanket.y > 0.7, monitor, crib });
  }
  const desks: DeskF[] = [];
  const deskTops = P.filter((p) => p.g === "box" && p.m === "wood" && near(p.y, 0.74) && near(p.sy, 0.05) && near(p.sz, 0.75) && p.desk);
  for (const p of deskTops) {
    const own = P.filter((q) => q.desk === p.desk);
    desks.push({
      x: p.x, z: p.z, yaw: p.yaw, w: p.sx, dept: p.dept, desk: p.desk!,
      screens: own.filter((q) => q.m === "screen").length, phone: own.some((q) => q.m === "dark" && near(q.sy, 0.06)),
      occupied: fl.people.some((q) => q.desk === p.desk),
    });
  }
  const seats: SeatF[] = [];
  for (const p of P) {
    if (p.g === "box" && p.m === "fabric" && near(p.y, 0.46) && near(p.sy, 0.08)) {
      const kind = near(p.sx, 0.54) ? "row" : "chair";
      const [fx, fz] = fwd(p.yaw);
      const x = p.x + fx * 0.02, z = p.z + fz * 0.02;
      seats.push({ x, z, yaw: p.yaw, dept: p.dept, kind, top: 0.5, taken: seatTaken(fl, x, z), desk: p.desk ?? 0 });
    } else if (p.g === "rbox" && p.m === "fabric" && near(p.y, 0.24) && near(p.sx, 0.78) && near(p.sy, 0.36)) {
      const [fx, fz] = fwd(p.yaw);
      const x = p.x + fx * 0.06, z = p.z + fz * 0.06;
      seats.push({ x, z, yaw: p.yaw, dept: p.dept, kind: "arm", top: 0.42, taken: seatTaken(fl, x, z), desk: 0 });
    }
  }
  const tables: TableF[] = P.filter((p) => p.g === "rbox" && p.m === "wood" && near(p.y, 0.74) && near(p.sy, 0.06))
    .map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, w: p.sx, d: p.sz, dept: p.dept }));
  const counters: CounterF[] = P.filter((p) => p.g === "rbox" && p.m === "white" && near(p.y, 0.53) && near(p.sy, 1.06) && near(p.sz, 0.7))
    .map((p) => ({ x: p.x, z: p.z, yaw: p.yaw, len: p.sx, dept: p.dept }));
  const doors = fl.depts.flatMap((d) => doorsOf(fl, d));
  const f = { beds, desks, seats, tables, counters, doors };
  cache.set(fl.key, f);
  return f;
}

/** Department frame of layout.ts: (u, v) in department space → floor-local; v = +d/2 is the corridor side. */
export function deptFrame(id: string) {
  const d = DEPT[id];
  const [cx, cz, w, dd] = d.rect;
  const s = d.building === "annex" || Math.abs(cz) < 0.01 ? 1 : cz < 0 ? 1 : -1;
  return {
    d, cx, cz, w, dd, s,
    X: (u: number, v: number): [number, number] => [cx + u, cz + v * s],
    /** yaw of a direction (du, dv) given in department space */
    Y: (du: number, dv: number) => Math.atan2(du, dv * s),
  };
}

/** Axis-aligned boxes of the existing furniture of a floor (for overlap checks in QA): [x0, x1, z0, z1, top]. */
export function layoutBoxes(fl: FloorLayout): [number, number, number, number, number, Part][] {
  return fl.parts.map((p) => {
    const c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
    const hx = (c * p.sx + s * p.sz) / 2, hz = (s * p.sx + c * p.sz) / 2;
    return [p.x - hx, p.x + hx, p.z - hz, p.z + hz, p.y + p.sy / 2, p];
  });
}
