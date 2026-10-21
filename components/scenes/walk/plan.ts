// Walk mode ("À pied") — pure architectural plan shared by the hospital drawing (layout, floors, façades, stair towers)
// and the walk controller (colliders, ground height). No three.js, no React: safe to import from layout.ts.
// Coordinates: CAMPUS frame = the "building frame" of lib/hospital (main building centred on 0,0; front = +z;
// map north = −z), y = 0 at the ground. Building-local = campus − (B.x, B.z). World = campus + CAMPUS_OFFSET (nav.ts).
import { ANNEX, DEPT, FLOOR_H, MAIN } from "@/lib/hospital";

export type BId = "main" | "annex";
export const BLD: Record<BId, { w: number; d: number; x: number; z: number }> = { main: MAIN, annex: ANNEX };
/** Glass line of the façade, outside the plate edge (Floor.tsx draws the glass box w + 0.12 × d + 0.12). */
export const GLASS_OFF = 0.06;
export const SLAB_T = 0.36;

// ---------------------------------------------------------------- glazed stair towers
// A switchback stair in a glass tower adjoining the +x façade of each building. Tower-local frame:
//   x' = x − xF (outward from the façade glass), z' = (z − zDoor) · dir (along the flights, from the door).
//   floor landing z' ∈ [−0.8, 0.8] (door in the façade at z' = 0), flights z' ∈ [0.8, 4.16], mid landing z' ∈ [4.16, 5.56]
//   lane B (inner, along the façade) x' ∈ [0.04, 1.52] · well x' ∈ [1.52, 1.76] · lane A (outer) x' ∈ [1.76, 3.24]
// Going up from floor f: lane A (rising toward +z') → mid landing (f + ½) → lane B (rising back toward the door) → floor f + 1.
export const ST = {
  x0: 0.04, laneB1: 1.52, laneA0: 1.76, x1: 3.24, glass: 3.29,
  land: 0.8, run: 3.36, mid0: 4.16, mid1: 5.56, endA: -0.85, endB: 5.61,
  risers: 13, half: FLOOR_H / 2,
  door: 1.4, doorH: 2.4,
  roofH: 3.4,               // tower roof above the top landing
};
export type Tower = { id: BId; building: BId; xF: number; zDoor: number; dir: 1 | -1; top: number; floors: number[] };
export const TOWERS: Tower[] = [
  // main: east façade, door on the central corridor (z = 0) of every floor, flights toward the front (+z), clear of the skybridge
  { id: "main", building: "main", xF: MAIN.x + MAIN.w / 2 + GLASS_OFF, zDoor: MAIN.z, dir: 1, top: 4, floors: [0, 1, 2, 3, 4] },
  // head office: east façade, door 4.5 m in front of the centre, flights toward the back (−z)
  { id: "annex", building: "annex", xF: ANNEX.x + ANNEX.w / 2 + GLASS_OFF, zDoor: ANNEX.z + 4.5, dir: -1, top: 3, floors: [0, 1, 2, 3] },
];
export const TOWER_OF: Record<BId, Tower> = { main: TOWERS[0], annex: TOWERS[1] };
export const towerZ = (t: Tower, zl: number) => t.zDoor + zl * t.dir;
/** Campus z-range covered by the tower (glass ends). */
export function towerZRange(t: Tower): [number, number] {
  const a = towerZ(t, ST.endA), b = towerZ(t, ST.endB);
  return [Math.min(a, b), Math.max(a, b)];
}
export const towerTopY = (t: Tower) => t.top * FLOOR_H + ST.roofH;
/** Is the campus point (x, z) inside the tower footprint (interior, glass included)? */
export function inTower(t: Tower, x: number, z: number, m = 0) {
  const xl = x - t.xF, zl = (z - t.zDoor) * t.dir;
  return xl >= -m && xl <= ST.glass + m && zl >= ST.endA - m && zl <= ST.endB + m;
}

// ---------------------------------------------------------------- openings in the façades
export type Side = "+x" | "-x" | "+z" | "-z";
/** An opening in a building's glass façade. c = centre along the side, building-local (x for ±z sides, z for ±x sides). */
export type Opening = { building: BId; side: Side; c: number; w: number; h: number; floors: number[]; kind: "slide" | "open" };
const urg = DEPT.urgences?.rect ?? [17.3, 6.5, 16.3, 12];
export const OPENINGS: Opening[] = [
  // main entrance: aligned with the hall's façade-side opening (accueil, layout.ts room outer gap of 4.2 m)
  { building: "main", side: "+z", c: DEPT.accueil?.rect[0] ?? 0, w: 4.2, h: 2.75, floors: [0], kind: "slide" },
  // emergency entrance: aligned with the emergency department's façade-side opening (gap at 82 % of its width, 3.2 m)
  { building: "main", side: "+z", c: urg[0] - urg[2] / 2 + 0.82 * urg[2], w: 3.2, h: 2.75, floors: [0], kind: "slide" },
  // head office entrance (front door of the general services floor, 3 m)
  { building: "annex", side: "+z", c: 0, w: 3.0, h: 2.75, floors: [0], kind: "slide" },
  // stair tower doors, every floor
  ...TOWERS.map((t): Opening => ({ building: t.building, side: "+x", c: t.zDoor - BLD[t.building].z, w: ST.door, h: ST.doorH, floors: t.floors, kind: "open" })),
];
export function openingsOf(building: BId, floor: number, side?: Side) {
  return OPENINGS.filter((o) => o.building === building && o.floors.includes(floor) && (!side || o.side === side));
}
/** Intervals along a side (building-local) excluded from façade elements (columns, mullions, louvres, piers). */
export function sideCuts(building: BId, floor: number, side: Side, margin = 0.25): [number, number][] {
  const out: [number, number][] = openingsOf(building, floor, side).map((o) => [o.c - o.w / 2 - margin, o.c + o.w / 2 + margin]);
  // the stair tower hides the outer façade elements over its whole length
  const t = TOWER_OF[building];
  if (side === "+x" && floor >= 0 && floor <= t.top) {
    const [a, b] = towerZRange(t);
    out.push([a - BLD[building].z - 0.05, b - BLD[building].z + 0.05]);
  }
  return out;
}
export const inCuts = (v: number, cuts: [number, number][]) => cuts.some(([a, b]) => v >= a && v <= b);
/** Structural columns (0.3 m inside the façade) that would stand in an opening are left out (transfer beam above). */
export const columnCut = (building: BId, floor: number, side: Side, along: number) =>
  openingsOf(building, floor, side).some((o) => Math.abs(along - o.c) < o.w / 2 + 0.3);
/** Split [a, b] by removing the cut intervals. */
export function subtract(a: number, b: number, cuts: [number, number][]): [number, number][] {
  let runs: [number, number][] = [[a, b]];
  for (const [c0, c1] of cuts) {
    const next: [number, number][] = [];
    for (const [r0, r1] of runs) {
      if (c1 <= r0 || c0 >= r1) { next.push([r0, r1]); continue; }
      if (c0 > r0) next.push([r0, c0]);
      if (c1 < r1) next.push([c1, r1]);
    }
    runs = next;
  }
  return runs.filter(([r0, r1]) => r1 - r0 > 0.02);
}

// ---------------------------------------------------------------- interior doors added for real circulation
/** Door gaps cut into the department walls (building-local floor coordinates), see layout.ts B.wall(). */
export const EXTRA_DOORS: { building: BId; floor: number; x: number; z: number; w: number }[] = [
  { building: "main", floor: 4, x: MAIN.w / 2 - 0.5, z: 0, w: 1.4 },   // technical management → stair tower
  { building: "main", floor: 4, x: -0.5, z: 0, w: 1.8 },               // quality → central corridor
  { building: "main", floor: 4, x: 0.5, z: 0, w: 1.8 },                // technical management → central corridor
  ...[0, 1, 2, 3].map((f) => ({ building: "annex" as BId, floor: f, x: ANNEX.w / 2 - 0.5, z: 4.5, w: 1.4 })), // head office → tower
];

// ---------------------------------------------------------------- spawn
/** Where the personnage starts, every time walk mode is entered: on the forecourt sidewalk in front of the main entrance,
 *  4.5 m from the sliding doors, facing them (campus frame). */
export const SPAWN = { x: 0, z: BLD.main.z + BLD.main.d / 2 + GLASS_OFF + 4.5, heading: Math.PI };
