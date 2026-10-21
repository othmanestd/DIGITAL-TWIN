// The procedural Casablanca plan (pure data, built once, no React / no rendering): street centrelines, blocks, parks,
// palms, the tram run, the business district, the mosque site, the coast, the district around the hospital and the
// traffic network. Shared by CityContent (rendering), the walk mode (colliders) and the landmarks (mosque, CFC towers,
// tram vehicles, sky, pedestrians) so everything lines up. World metres, x east, z south (map north = −Z), y up.
//
// Stable exports (please keep them): cityPlan(), Plan, Bx / Seg / Run, sea(), wiggle(), N / T / COAST, AVENUES, DOWNTOWN,
// TWIN, CFC, CFC_TOWERS (via cityPlan().cfc), MOSQUE, TRAM_TRACK, sidewalkWidth(), sidewalkCentrelines(), R_* constants.
import * as THREE from "three";
import type { Net } from "./roads";
import type { Solid } from "./collide";
import {
  SUPER, RB, PLAZA_R, DISTRICT_ROADS, buildDistrictNet, districtBlocks, districtDecals, districtKerbs, districtMedians, cutDisc,
  type Bx, type DSeg as Seg, type Quad,
} from "./district";
export type { Bx, Seg, Quad };
// ---------------------------------------------------------------- city plan constants
export const R_CITY = 7000;            // buildings / streets
export const R_GROUND = 9000;          // ground disc
export const R_FAR = 75000;            // far rim (blends into the Morocco map, whose hole around Casablanca spans 30 … 75 km)
export const CELL = 120;               // street grid pitch
export const R_TRAFFIC = 1250;         // traffic network radius
export const N = new THREE.Vector2(-Math.SQRT1_2, -Math.SQRT1_2);   // towards the ocean (north-west)
export const T = new THREE.Vector2(Math.SQRT1_2, -Math.SQRT1_2);    // along the coast
export const COAST = 2750;
export const wiggle = (t: number) => 170 * Math.sin(t / 1150) + 70 * Math.sin(t / 430 + 1.3);
/** signed distance-ish to the coast: > 0 in the sea */
export const sea = (x: number, z: number) => x * N.x + z * N.y - wiggle(x * T.x + z * T.y) - COAST;

export const AVENUES: { p: [number, number]; a: number }[] = [
  { p: [300, -700], a: (35 * Math.PI) / 180 },
  { p: [-1200, 900], a: (-25 * Math.PI) / 180 },
  { p: [2000, 1500], a: (70 * Math.PI) / 180 },
];
export const DOWNTOWN = new THREE.Vector2(900, -1500);
export const TWIN: [number, number][] = [[-880, 560], [-835, 610]];
export const CFC = new THREE.Vector2(-1750, -500); // business district cluster (centre of the signature towers)
/** The Hassan II-like mosque site on the shore, facing the ocean: centre, yaw (rotation about +Y of its local frame,
 *  local +x along the coast), and the footprint of the legacy model (prayer-hall esplanade 300 × 190 m, minaret at
 *  local (−95, −40), 25 m square, ~230 m high). */
export const MOSQUE = (() => {
  const t = -260; // along the coast, a little south-west of the axis
  const base = COAST + wiggle(t) + 25;
  return { x: N.x * base + T.x * t, z: N.y * base + T.y * t, yaw: Math.atan2(T.x, T.y), esplanade: [300, 190] as const, minaret: { x: -95, z: -40, size: 25, h: 229 } };
})();
/** Tram line: cityPlan().tram is the run (along z = TRAM.z); two tracks at z ± 1.6 (rails 1.44 m apart), catenary
 *  poles every 34 m on the centreline, contact wires at y = 6.1 above each track. */
export const TRAM = { z: 6 * CELL + CELL / 2, tracks: [-1.6, 1.6] as const, gauge: 1.44, wireY: 6.1, poleStep: 34 };


// ---------------------------------------------------------------- deterministic noise
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash2 = (i: number, j: number) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

function distToLine(x: number, z: number, av: (typeof AVENUES)[number]) {
  const dx = Math.cos(av.a), dz = Math.sin(av.a);
  return Math.abs((x - av.p[0]) * dz - (z - av.p[1]) * dx);
}
function intersect(a: (typeof AVENUES)[number], b: (typeof AVENUES)[number]): [number, number] | null {
  const d1x = Math.cos(a.a), d1z = Math.sin(a.a), d2x = Math.cos(b.a), d2z = Math.sin(b.a);
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((b.p[0] - a.p[0]) * d2z - (b.p[1] - a.p[1]) * d2x) / den;
  return [a.p[0] + d1x * t, a.p[1] + d1z * t];
}
/** inside the hospital superblock (grid streets x, z = ±180 excluded) */
const inSuper = (x: number, z: number, m = 0) => Math.abs(x) < SUPER - m && Math.abs(z) < SUPER - m;
const boxNearSuper = (x0: number, z0: number, x1: number, z1: number, m: number) =>
  Math.max(x0, x1) > -SUPER - m && Math.min(x0, x1) < SUPER + m && Math.max(z0, z1) > -SUPER - m && Math.min(z0, z1) < SUPER + m;
export const onLand = (x: number, z: number, margin: number) => sea(x, z) < -margin && Math.hypot(x, z) < R_CITY;
const nearRB = (x: number, z: number, m: number) => Math.hypot(x - RB.x, z - RB.z) < m;

// ---------------------------------------------------------------- plan generation (once)
export type Run = { x0: number; z0: number; x1: number; z1: number };
export type Plan = {
  /** street centrelines (asphalt width w; d = district street); grid = the grid streets only */
  segs: Seg[]; grid: Seg[];
  /** building blocks (box footprints, h = height); near = within ~420 m of the hospital (cast shadows) */
  boxes: Bx[]; near: Bx[]; signs: Bx[];
  /** legacy CFC signature towers and their crown signs (CityContent draws them while LEGACY_LANDMARKS is on) */
  cfc: Bx[]; cfcSigns: Bx[];
  parks: [number, number, number, number][];
  trees: [number, number, number][]; palms: [number, number][]; roundabouts: [number, number][];
  decals: Quad[]; roofs: { x: number; z: number; y: number; k: number; s: number }[];
  parked: Bx[]; tram: Run | null; poles: [number, number][]; streetTrees: [number, number][];
  net: Net; kerbs: ReturnType<typeof districtKerbs>; medians: ReturnType<typeof districtMedians>;
};

function makePlan(): Plan {
  const segs: Seg[] = [], grid: Seg[] = [], boxes: Bx[] = [], near: Bx[] = [], signs: Bx[] = [], cfc: Bx[] = [], cfcSigns: Bx[] = [];
  const parks: [number, number, number, number][] = [], trees: [number, number, number][] = [], palms: [number, number][] = [];
  const decals: Quad[] = [], roofs: Plan["roofs"] = [], parked: Bx[] = [], poles: [number, number][] = [], streetTrees: [number, number][] = [];
  const r = rng(20261020);
  const K = Math.ceil(R_CITY / CELL) + 1;
  const line = (k: number) => k * CELL + CELL / 2;           // grid line coordinate
  const width = (k: number) => (((k % 6) + 6) % 6 === 0 ? 30 : 12); // boulevards every 6th line
  // roundabouts at avenue crossings + two boulevard crossings
  const rbs: [number, number][] = [];
  for (let i = 0; i < AVENUES.length; i++) for (let j = i + 1; j < AVENUES.length; j++) {
    const p = intersect(AVENUES[i], AVENUES[j]);
    if (p && onLand(p[0], p[1], 200) && Math.hypot(p[0], p[1]) < 5000) rbs.push(p);
  }
  rbs.push([line(5), line(-7)], [line(-12), line(5)]);

  const nearAvenue = (x: number, z: number, m: number) => AVENUES.some((a) => distToLine(x, z, a) < m);
  const nearRb = (x: number, z: number, m: number) => rbs.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < m);

  // grid streets (one segment per cell edge, clipped to land / city; the superblock interior belongs to the district)
  for (let a = -K; a <= K; a++) {
    for (let b = -K; b < K; b++) {
      const c = line(a), s0 = line(b), s1 = line(b + 1);
      for (const vertical of [true, false]) {
        const [x0, z0, x1, z1] = vertical ? [c, s0, c, s1] : [s0, c, s1, c];
        if (!onLand(x0, z0, 110) || !onLand(x1, z1, 110)) continue;
        if (inSuper((x0 + x1) / 2, (z0 + z1) / 2, 1)) continue;
        const w = width(a);
        const sg = { x0, z0, x1, z1, w, c: w > 20 ? 1 : 0 };
        segs.push(sg); grid.push(sg);
      }
    }
  }
  // district streets around the hospital (front boulevard, back street, side streets, hospital axis)
  for (const d of DISTRICT_ROADS) segs.push({ x0: d.x0, z0: d.z0, x1: d.x1, z1: d.z1, w: d.w, c: d.w > 20 ? 1 : 0, d: true });
  // avenues (long diagonals, cut into 120 m pieces so they clip to land)
  for (const av of AVENUES) {
    const dx = Math.cos(av.a), dz = Math.sin(av.a);
    for (let t = -9000; t < 9000; t += 120) {
      const x0 = av.p[0] + dx * t, z0 = av.p[1] + dz * t, x1 = x0 + dx * 120, z1 = z0 + dz * 120;
      if (!onLand(x0, z0, 110) || !onLand(x1, z1, 110) || boxNearSuper(x0, z0, x1, z1, 20)) continue;
      segs.push({ x0, z0, x1, z1, w: 34, c: 1 });
    }
  }
  // corniche along the coast
  let prev: [number, number] | null = null;
  for (let t = -9000; t <= 9000; t += 90) {
    const base = COAST + wiggle(t) - 95;
    const x = N.x * base + T.x * t, z = N.y * base + T.y * t;
    if (Math.hypot(x, z) < R_CITY + 600 && prev) segs.push({ x0: prev[0], z0: prev[1], x1: x, z1: z, w: 28, c: 1 });
    prev = Math.hypot(x, z) < R_CITY + 600 ? [x, z] : null;
  }
  // roundabout rings (as short chords): the city ones, and the district one next to the hospital
  for (const [cx, cz] of rbs) for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
    segs.push({ x0: cx + Math.cos(a0) * 52, z0: cz + Math.sin(a0) * 52, x1: cx + Math.cos(a1) * 52, z1: cz + Math.sin(a1) * 52, w: 16, c: 1 });
  }
  for (let i = 0; i < 32; i++) {
    const a0 = (i / 32) * Math.PI * 2, a1 = ((i + 1) / 32) * Math.PI * 2, R = (RB.inner + RB.outer) / 2;
    segs.push({ x0: RB.x + Math.cos(a0) * R, z0: RB.z + Math.sin(a0) * R, x1: RB.x + Math.cos(a1) * R, z1: RB.z + Math.sin(a1) * R, w: RB.outer - RB.inner, c: 1, d: true });
  }
  for (const [cx, cz] of rbs) for (let i = 0; i < 6; i++) palms.push([cx + Math.cos(i) * 18, cz + Math.sin(i) * 18]);

  // blocks
  for (let i = -K; i < K; i++) for (let j = -K; j < K; j++) {
    const xa = line(i) + width(i) / 2 + 3, xb = line(i + 1) - width(i + 1) / 2 - 3;
    const za = line(j) + width(j) / 2 + 3, zb = line(j + 1) - width(j + 1) / 2 - 3;
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, bw = xb - xa, bd = zb - za;
    const dist = Math.hypot(cx, cz);
    if (dist > R_CITY - 80 || !onLand(cx, cz, 160)) continue;
    if (inSuper(cx, cz)) continue; // the district builds the superblock
    if (nearAvenue(cx, cz, 17 + Math.max(bw, bd) * 0.55) || nearRb(cx, cz, 95)) continue;
    const h0 = hash2(i, j);
    // parks (fewer in the dense centre)
    if (h0 < 0.055 || (dist < 520 && h0 < 0.2)) {
      parks.push([cx, cz, bw, bd]);
      const nt = dist < 2500 ? 14 : 6;
      for (let t = 0; t < nt; t++) { const x = xa + r() * bw, z = za + r() * bd; if (!nearRB(x, z, PLAZA_R + 3)) trees.push([x, z, 0.8 + r() * 0.6]); }
      continue;
    }
    // parking lots with painted bays (a few, within 4 km)
    if (dist < 4000 && dist > 300 && h0 >= 0.055 && h0 < 0.08) {
      decals.push({ x0: xa, z0: cz, x1: xb, z1: cz, w: bd, y: 0.07, c: 2 });
      for (const row of [-1, 1]) {
        const zr = cz + row * (bd / 4);
        for (let x = xa + 2; x <= xb - 2; x += 2.7) {
          decals.push({ x0: x, z0: zr - 2.6, x1: x, z1: zr + 2.6, w: 0.12, y: 0.09, c: 0 });
          if (x + 2.7 <= xb - 2 && r() < 0.62) parked.push({ x: x + 1.35, z: zr, w: 1.85, d: 4.3, h: 1.45, yaw: 0, c: r() });
        }
      }
      continue;
    }
    const dt = Math.hypot(cx - DOWNTOWN.x, cz - DOWNTOWN.y);
    const nearK = Math.min(1, Math.max(0.35, (dist - 250) / 700));            // keep it low around the hospital
    const dense = Math.max(0, 1 - dt / 2600);
    const kind = dist > 4300 ? "low" : h0 < 0.45 + dense * 0.3 ? "haussmann" : "modern";
    const tone = dense > 0.45 ? r() * 0.5 : r();
    const push = (b0: Bx) => { const b = dist < 260 ? cutDisc(b0, RB.x, RB.z, PLAZA_R) : b0; if (b) (dist < 420 ? near : boxes).push(b); };
    if (kind === "haussmann") {
      const H = (13 + r() * 9 + dense * 8) * nearK, dep = 14;
      push({ x: cx, z: za + dep / 2, w: bw, d: dep, h: H, yaw: 0, c: tone });
      push({ x: cx, z: zb - dep / 2, w: bw, d: dep, h: H * (0.9 + r() * 0.2), yaw: 0, c: tone });
      push({ x: xa + dep / 2, z: cz, w: dep, d: bd - 2 * dep, h: H * (0.9 + r() * 0.15), yaw: 0, c: tone });
      push({ x: xb - dep / 2, z: cz, w: dep, d: bd - 2 * dep, h: H, yaw: 0, c: tone });
    } else if (kind === "modern") {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const w = 18 + r() * Math.min(40, bw - 20), d = 16 + r() * Math.min(36, bd - 20);
        const x = xa + w / 2 + r() * Math.max(0, bw - w), z = za + d / 2 + r() * Math.max(0, bd - d);
        const h = (16 + r() * 22 + dense * 14) * nearK;
        push({ x, z, w, d, h, yaw: 0, c: tone });
        if (h > 26 && r() < 0.07) signs.push({ x, z, w: Math.min(w * 0.6, 14), d: 0.6, h: h + 1.6, yaw: 0, c: 0 });
      }
    } else {
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const w = 14 + r() * 16, d = 12 + r() * 14;
        boxes.push({ x: xa + w / 2 + r() * Math.max(0, bw - w), z: za + d / 2 + r() * Math.max(0, bd - d), w, d, h: 6 + r() * 7, yaw: 0, c: tone });
      }
    }
  }
  // the district: blocks, garden, palms
  const D = districtBlocks();
  near.push(...D.blocks); parks.push(...D.parks); trees.push(...D.trees); palms.push(...D.palms);
  // façade styles: shop band at street level facing the boulevards (and some on the streets), balconies / punched /
  // ribbon windows, a few warm painted façades (soft ochre / sand / terracotta tints in the blue key)
  const boulevardEdge = (v: number) => { const k = Math.round((v - CELL / 2) / (CELL * 6)); return Math.abs(Math.abs(v - (k * CELL * 6 + CELL / 2)) - 15); };
  for (const b of [...boxes, ...near]) {
    const dist = Math.hypot(b.x, b.z);
    const faces = Math.min(boulevardEdge(b.x - b.w / 2), boulevardEdge(b.x + b.w / 2), boulevardEdge(b.z - b.d / 2), boulevardEdge(b.z + b.d / 2));
    const main = faces < 4.5 && dist < 4000;
    b.shop = b.h > 5.5 && (main ? r() < 0.9 : r() < (dist < 2000 ? 0.3 : 0.08)) ? 1 : 0;
    b.acc = b.shop && r() < 0.75 ? 1 + Math.floor(r() * 4) : 0;
    b.win = b.win ?? (b.h > 26 && r() < 0.5 ? 2 : r() < 0.55 ? 1 : 0);
    b.warm = r() < 0.07;
  }
  // roof details (water tanks, rooftop units, satellite dishes): dense near the hospital, sparser further out
  for (const b of [...boxes, ...near]) {
    const dist = Math.hypot(b.x, b.z);
    if (b.h < 6 || dist > 3500) continue;
    const big = Math.max(b.w, b.d) > 45 ? 2 : 0;
    const n = dist < 1400 ? 1 + Math.floor(r() * 3) + big : dist < 2800 ? (r() < 0.4 ? 0 : 1 + Math.floor(r() * 2)) : r() < 0.6 ? 0 : 1;
    for (let k = 0; k < n; k++) {
      const kind = r() < 0.4 ? 0 : r() < 0.5 ? 1 : 2;
      roofs.push({ x: b.x + (r() - 0.5) * b.w * 0.75, z: b.z + (r() - 0.5) * b.d * 0.75, y: b.h, k: kind, s: 0.8 + r() * 0.5 });
    }
  }
  // landmarks: a Twin-Center-like pair and a business district cluster
  for (const [x, z] of TWIN) boxes.push({ x, z, w: 30, d: 30, h: 116, yaw: 0.26, c: 0.15 });
  boxes.push({ x: -858, z: 585, w: 95, d: 70, h: 16, yaw: 0.26, c: 0.15 });
  signs.push({ x: TWIN[0][0], z: TWIN[0][1], w: 18, d: 0.8, h: 118, yaw: 0.26, c: 0 });
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, rr = 40 + k * 22;
    const x = CFC.x + Math.cos(a) * rr, z = CFC.y + Math.sin(a) * rr;
    const t: Bx = { x, z, w: 26 + r() * 14, d: 24 + r() * 12, h: 60 + r() * 50, yaw: 0, c: 0.3, win: 2 };
    cfc.push(t);
    if (k % 3 === 0) cfcSigns.push({ x, z, w: 14, d: 0.6, h: t.h + 1.6, yaw: 0, c: 1 });
  }
  for (const b of boxes) if (b.h > 100) b.win = 2;

  // boulevards: dashed centre lines (within 3.5 km), palms near the hospital, street trees further out
  const tramZ = line(6);
  for (const sg of segs) {
    if (sg.w < 20 || sg.w > 32 || sg.d) continue;
    const L = Math.hypot(sg.x1 - sg.x0, sg.z1 - sg.z0), mx = (sg.x0 + sg.x1) / 2, mz = (sg.z0 + sg.z1) / 2;
    const dist = Math.hypot(mx, mz);
    const ux = (sg.x1 - sg.x0) / (L || 1), uz = (sg.z1 - sg.z0) / (L || 1);
    const isTram = Math.abs(sg.z0 - tramZ) < 0.1 && Math.abs(sg.z1 - tramZ) < 0.1;
    if (dist < 3500 && !isTram) for (let t = 1.5; t < L - 1.5; t += 9) {
      const x = sg.x0 + ux * t, z = sg.z0 + uz * t;
      if (nearRB(x, z, RB.outer + 6)) continue;
      decals.push({ x0: x, z0: z, x1: sg.x0 + ux * (t + 3), z1: sg.z0 + uz * (t + 3), w: 0.22, y: 0.09, c: 0 });
    }
    const side = sg.w / 2 + 2.6;
    for (let t = 6; t < L; t += dist < 1600 ? 22 : 30) {
      const px = sg.x0 + ux * t, pz = sg.z0 + uz * t;
      for (const sd of dist < 1600 ? [-1, 1] : [1]) {
        const x = px - uz * side * sd, z = pz + ux * side * sd;
        if (boxNearSuper(x, z, x, z, 4) || nearRB(x, z, PLAZA_R + 2)) continue;
        if (dist < 1600) palms.push([x, z]); else if (dist < 4500) streetTrees.push([x, z]);
      }
    }
  }
  // roundabouts: green centres
  for (const [cx, cz] of rbs) for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    decals.push({ x0: cx - Math.cos(a) * 40, z0: cz - Math.sin(a) * 40, x1: cx + Math.cos(a) * 40, z1: cz + Math.sin(a) * 40, w: 11, y: 0.08, c: 3 });
  }
  // tram line on the main boulevard: two tracks (4 rails), catenary poles, wires
  let tram: Run | null = null;
  {
    const pts: number[] = [];
    for (let x = -4200; x <= 4200; x += 30) if (onLand(x, tramZ, 140) && Math.hypot(x, tramZ) < 4300) pts.push(x);
    let best: [number, number] | null = null, start = pts[0];
    for (let i = 1; i <= pts.length; i++) {
      if (i === pts.length || pts[i] - pts[i - 1] > 31) { const end = pts[i - 1]; if (!best || end - start > best[1] - best[0]) best = [start, end]; start = pts[i]; }
    }
    if (best && best[1] - best[0] > 600) {
      tram = { x0: best[0], z0: tramZ, x1: best[1], z1: tramZ };
      for (const tz of [-1.6, 1.6]) for (const rl of [-0.72, 0.72]) decals.push({ x0: best[0], z0: tramZ + tz + rl, x1: best[1], z1: tramZ + tz + rl, w: 0.14, y: 0.1, c: 1 });
      for (let x = best[0]; x <= best[1]; x += 34) poles.push([x, tramZ]);
    }
  }
  // traffic network + the district markings that depend on its junctions
  const net = buildDistrictNet(grid, R_TRAFFIC);
  decals.push(...districtDecals(net));
  const kerbs = districtKerbs(net), medians = districtMedians(net);
  for (const m of medians) for (let x = m.x0 + 7; x <= m.x1 - 5; x += 15) palms.push([x, m.z]);
  for (let k = 0; k < 3; k++) { const a = 0.6 + (k * Math.PI * 2) / 3; palms.push([RB.x + Math.cos(a) * 7, RB.z + Math.sin(a) * 7]); }
  return { segs, grid, boxes, near, signs, cfc, cfcSigns, parks, trees, palms, roundabouts: rbs, decals, roofs, parked, tram, poles, streetTrees, net, kerbs, medians };
}

/** Walk-mode colliders of the city (world AABBs). */
export function citySolids(P: Plan, legacy: boolean): Solid[] {
  const mosque = MOSQUE;
  const out: Solid[] = [];
  const aabb = (x: number, z: number, w: number, d: number, yaw: number, h: number) => {
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const ex = (w * c + d * s) / 2, ez = (w * s + d * c) / 2;
    out.push({ x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez, h });
  };
  for (const b of P.boxes) aabb(b.x, b.z, b.w, b.d, b.yaw, b.h);
  if (legacy) for (const b of P.cfc) aabb(b.x, b.z, b.w, b.d, b.yaw, b.h);
  for (const b of P.near) aabb(b.x, b.z, b.w, b.d, b.yaw, b.h);
  for (const b of P.parked) aabb(b.x, b.z, b.w, b.d, 0, b.h);
  const trunk = (x: number, z: number, h: number) => { if (Math.hypot(x, z) < 900) out.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, h }); };
  for (const [x, z] of P.palms) trunk(x, z, 7);
  for (const [x, z] of P.trees) trunk(x, z, 2.5);
  for (const [x, z] of P.streetTrees) trunk(x, z, 2.5);
  for (const [x, z] of P.poles) out.push({ x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15, h: 7 });
  for (const m of P.medians) out.push({ x0: m.x0, x1: m.x1, z0: m.z - 1.2, z1: m.z + 1.2, h: 0.17 }); // walkable kerb height
  // the legacy mosque: its rotated base as a few sub-boxes, the prayer hall and the minaret
  if (!legacy) return out;
  const c = Math.cos(mosque.yaw), s = Math.sin(mosque.yaw);
  const local = (lx: number, lz: number): [number, number] => [mosque.x + lx * c + lz * s, mosque.z - lx * s + lz * c];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const [x, z] = local(-125 + i * 50, -71.25 + j * 47.5); aabb(x, z, 50, 47.5, mosque.yaw, 5); }
  { const [x, z] = local(30, 10); aabb(x, z, 190, 100, mosque.yaw, 27); }
  { const [x, z] = local(-95, -40); aabb(x, z, 25, 25, mosque.yaw, 229); }
  return out;
}

let PLAN: Plan | null = null;
/** The city plan (memoised; the first call builds it, ~0.3 s). */
export const cityPlan = () => (PLAN ??= makePlan());

/** Sidewalk width on each side of a street segment (asphalt width `w`), as drawn by CityContent. */
export const sidewalkWidth = (w: number) => (w > 20 ? 4.5 : 3);
/** Sidewalk centrelines (both sides of every street segment within `maxDist` of the hospital), for pedestrians.
 *  Each line is offset from the street centreline by w/2 + sidewalk/2; `w` is the sidewalk width. Not trimmed at junctions. */
export function sidewalkCentrelines(maxDist = 1500): { x0: number; z0: number; x1: number; z1: number; w: number }[] {
  const out: { x0: number; z0: number; x1: number; z1: number; w: number }[] = [];
  for (const s of cityPlan().segs) {
    if (s.w > 32 && !s.d) continue; // avenues: no pavement model
    const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
    if (Math.hypot(mx, mz) > maxDist) continue;
    const L = Math.hypot(s.x1 - s.x0, s.z1 - s.z0) || 1, nx = -(s.z1 - s.z0) / L, nz = (s.x1 - s.x0) / L;
    const sw = sidewalkWidth(s.w), o = s.w / 2 + sw / 2;
    for (const sd of [-1, 1]) out.push({ x0: s.x0 + nx * o * sd, z0: s.z0 + nz * o * sd, x1: s.x1 + nx * o * sd, z1: s.z1 + nz * o * sd, w: sw });
  }
  return out;
}
