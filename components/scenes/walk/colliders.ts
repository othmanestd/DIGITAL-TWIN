// Walk mode collisions and ground height, built once from the hospital layout (campus frame, see plan.ts).
//  · body colliders: oriented boxes with a height range — department walls and big furniture (layout.ts parts), structural
//    columns, façade glass with its openings, stair towers (glass, well, guards), Expériences IA kiosks, floor-4 twin room,
//    campus props found in the scene (trees, cars, ambulances, benches, canopy posts). Bucketed in a 1 m grid.
//  · outdoor solids from city/collide.ts (read only), except those overlapping the buildings, whose envelope is modelled here.
//  · camera colliders: façades, tall walls, canopies, skybridge — so the third-person camera never goes through them.
//  · ground height: floor slabs, the stair flights (ramps fitted to the tread centres) and landings, the skybridge
//    deck (floor 1), y = 0 outdoors.
// Everything is allocation-free at query time.
import * as THREE from "three";
import { FLOOR_H, DEPT } from "@/lib/hospital";
import { FLOOR_LAYOUTS, FLOOR_BY_KEY, type FloorLayout, type Part } from "../hospital/layout";
import { GEO, rt } from "../hospital/mats";
import { CAMPUS_OFFSET } from "../hospital/nav";
import { XP_POS } from "../hospital/Experiences";
import { TWIN_POS } from "../hospital/Twin";
import { PERSON_VIS } from "../hospital/People";
import { outdoorSolids } from "../city/collide";
import { hospitalPropSolids } from "./propSolids";
import { BLD, BRIDGE, GLASS_OFF, SLAB_T, ST, TOWERS, TOWER_OF, bridgeY, columnCut, inBridge, openingsOf, subtract, towerTopY, towerZ, type BId, type Side, type Tower } from "./plan";

export type Col = {
  cx: number; cz: number; hx: number; hz: number; c: number; s: number; // centre, local half sizes, cos / sin of the yaw
  y0: number; y1: number;
  desk: number;   // layout desk id (folds away with the timeline staffing), 0 = none
  cond: number;   // 0 always · 1 only once the Expériences IA are installed (rt.eco)
  bld: number;    // 0 none · 1 main · 2 annex · 3 skybridge — camera colliders of a cut-away floor are ignored
  yr: number;     // year mask of a prop (bit 0 = 2026 …), 0 = every year
  x0: number; x1: number; z0: number; z1: number; // AABB
};
const BI: Record<BId, number> = { main: 1, annex: 2 };

function mk(cx: number, cz: number, hx: number, hz: number, yaw: number, y0: number, y1: number, desk = 0, cond = 0, bld = 0): Col {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
  return { cx, cz, hx, hz, c, s, y0, y1, desk, cond, bld, yr: 0, x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez };
}
/** axis-aligned box from bounds */
const aabb = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, bld = 0) =>
  mk((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2, 0, y0, y1, 0, 0, bld);

// ---------------------------------------------------------------- tower-local helpers
function towerBox(t: Tower, xa: number, xb: number, za: number, zb: number, y0: number, y1: number, bld = 0) {
  const z0 = towerZ(t, za), z1 = towerZ(t, zb);
  return aabb(t.xF + xa, t.xF + xb, Math.min(z0, z1), Math.max(z0, z1), y0, y1, bld);
}

// ---------------------------------------------------------------- build
const BODY: Col[] = [];
const CAM: Col[] = [];
const PROPS: Col[] = [];      // campus props found in the scene (scanCampusProps)

function halfExtents(p: Part): [number, number, number] {
  let hx = p.sx / 2, hy = p.sy / 2, hz = p.sz / 2;
  if (p.g === "torus") { hx = 1.25 * p.sx; hy = 1.25 * p.sy; hz = 0.3 * p.sz; }
  if (p.pitch) {
    const c = Math.abs(Math.cos(p.pitch)), s = Math.abs(Math.sin(p.pitch));
    const nhy = c * hy + s * hz, nhz = s * hy + c * hz;
    hy = nhy; hz = nhz;
  }
  return [hx, hy, hz];
}

function facade(b: BId, floor: number) {
  const B = BLD[b], baseY = floor * FLOOR_H, H = FLOOR_H - SLAB_T, top = baseY + H;
  const gx = B.w / 2 + GLASS_OFF, gz = B.d / 2 + GLASS_OFF, t = 0.06;
  const sides: [Side, number][] = [["+z", gz], ["-z", -gz], ["+x", gx], ["-x", -gx]];
  for (const [side, off] of sides) {
    const alongX = side === "+z" || side === "-z";
    const L = alongX ? gx : gz;
    const ops = openingsOf(b, floor, side);
    const runs = subtract(-L - t, L + t, ops.map((o) => [o.c - o.w / 2, o.c + o.w / 2]));
    const put = (a0: number, a1: number, y0: number, y1: number) => {
      const box = alongX
        ? aabb(B.x + a0, B.x + a1, B.z + off - t, B.z + off + t, y0, y1, BI[b])
        : aabb(B.x + off - t, B.x + off + t, B.z + a0, B.z + a1, y0, y1, BI[b]);
      BODY.push(box); CAM.push(box);
    };
    for (const [a0, a1] of runs) put(a0, a1, baseY - 0.4, top);
    for (const o of ops) put(o.c - o.w / 2, o.c + o.w / 2, baseY + o.h, top); // transom above the opening
  }
  // structural columns (same rule as Floor.tsx shellParts)
  const hx = B.w / 2 - 0.3, hz = B.d / 2 - 0.3;
  const nx = Math.max(2, Math.round(B.w / 6.5)), nz = Math.max(2, Math.round(B.d / 6.5));
  for (let i = 0; i <= nx; i++) for (const [z, side] of [[-hz, "-z"], [hz, "+z"]] as const) {
    const x = -hx + (2 * hx * i) / nx;
    if (!columnCut(b, floor, side, x)) BODY.push(mk(B.x + x, B.z + z, 0.19, 0.19, 0, baseY, top));
  }
  for (let j = 1; j < nz; j++) for (const [x, side] of [[-hx, "-x"], [hx, "+x"]] as const) {
    const z = -hz + (2 * hz * j) / nz;
    if (!columnCut(b, floor, side, z)) BODY.push(mk(B.x + x, B.z + z, 0.19, 0.19, 0, baseY, top));
  }
}

function tower(t: Tower) {
  const top = t.top * FLOOR_H, roof = towerTopY(t);
  BODY.push(towerBox(t, ST.glass - 0.03, ST.glass + 0.03, ST.endA, ST.endB, -0.3, roof));                 // outer glass
  BODY.push(towerBox(t, 0, ST.glass, ST.endA - 0.03, ST.endA + 0.03, -0.3, roof));                         // end glass (door side)
  BODY.push(towerBox(t, 0, ST.glass, ST.endB - 0.03, ST.endB + 0.03, -0.3, roof));                         // end glass (mid landings)
  BODY.push(towerBox(t, ST.laneB1, ST.laneA0, ST.land, ST.mid0, -0.3, top + 1.2));                         // well + balustrades
  BODY.push(towerBox(t, ST.laneA0, ST.x1, ST.land, ST.land + 0.12, top - 0.1, top + 1.1));                 // guard over the void, top landing
  BODY.push(towerBox(t, ST.x0, ST.laneB1, ST.land, ST.mid0, -0.1, 1.95));                                  // closed space under the first flights
  BODY.push(towerBox(t, ST.x0, ST.x1, ST.mid0, ST.mid1, -0.1, 1.95));
}

function build() {
  for (const fl of FLOOR_LAYOUTS) {
    if (fl.floor < 0) continue;
    const baseY = fl.floor * FLOOR_H;
    for (const p of fl.parts) {
      const [hx, hy, hz] = halfExtents(p);
      const y0 = baseY + p.y - hy, y1 = baseY + p.y + hy;
      if (y1 - baseY <= 0.3 || hx < 0.015 || hz < 0.015) continue;
      const col = mk(fl.ox + p.x, fl.oz + p.z, hx, hz, p.yaw, y0, y1, p.desk ?? 0, 0, BI[fl.building]);
      BODY.push(col);
      // partitions, glass walls and curtains also stop the camera (when it looks up from low behind them)
      if ((p.m === "wall" || p.m === "glassp" || p.m === "curtain") && p.sy >= 0.9 && Math.min(p.sx, p.sz) <= 0.2) CAM.push(col);
    }
    facade(fl.building, fl.floor);
  }
  for (const t of TOWERS) tower(t);

  // floor 4: twin table (≈ octagon) and the wall screens; head office floor 3: the command-center wall screen
  const y4 = 4 * FLOOR_H;
  BODY.push(mk(TWIN_POS.x, TWIN_POS.z, 1.48, 1.48, 0, y4, y4 + 2.7), mk(TWIN_POS.x, TWIN_POS.z, 1.48, 1.48, Math.PI / 4, y4, y4 + 2.7));
  const tech = DEPT.technique?.rect ?? [13, 0], qual = DEPT.qualite?.rect ?? [-13, 0];
  BODY.push(aabb(qual[0] - 4.5 - 3.2, qual[0] - 4.5 + 3.2, -12.2, -12.1, y4 + 0.9, y4 + 3.2));
  BODY.push(aabb(tech[0] - 3 - 4.3, tech[0] - 3 + 4.3, -12.2, -12.1, y4 + 0.5, y4 + 4.0));
  BODY.push(aabb(tech[0] + 8.5 - 2.2, tech[0] + 8.5 + 2.2, -12.2, -12.1, y4 + 0.9, y4 + 3.1));
  BODY.push(mk(qual[0] - 9.5, 9.4, 0.3, 0.18, 0, y4, y4 + 1.6));
  const A = BLD.annex, y3 = 3 * FLOOR_H;
  BODY.push(aabb(A.x - 3.5, A.x + 3.5, A.z - 8.1, A.z - 8.0, y3 + 0.72, y3 + 3.6));

  // Expériences IA (ground floor), present once the programme has started
  const xp = (id: string, dx: number, dz: number, hx: number, hz: number, y1: number, y0 = 0) => {
    const p = XP_POS[id];
    if (p) BODY.push(mk(p.x + dx, p.z + dz, hx, hz, p.yaw, y0, y1, 0, 1));
  };
  xp("xp-guide", 0, 0, 0.62, 0.3, 2.7); xp("xp-plan", 0, 0, 0.5, 0.33, 1.4);
  for (const [dx, dz] of [[0, 0], [11.6, 0], [-6.8, -2.6]]) xp("xp-ecrans", dx, dz - 0.1, 0.09, 0.09, 2.6);
  for (const dx of [-0.6, 0.65]) xp("xp-borne", dx, 0, 0.3, 0.18, 1.6);
  xp("xp-devis", 0, 0, 0.49, 0.04, 1.97, 1.35);

  // campus: entrance canopies (camera), their posts (body), the terracotta accent wall and portal at the main entrance,
  // the skybridge (camera). Mirrors hospital/Site.tsx and Facade.tsx.
  const M = BLD.main;
  const canopies: [number, number, number, number, number, number][] = [
    [-1, 4.06, 16.2, 13, 0.34, 5.9], [17.5, 4.26, 16.7, 15.5, 0.34, 6.9], [A.x, 3.6, A.z + A.d / 2 + 2.0, 9, 0.3, 4.0],
  ];
  for (const [x, y, z, sx, sy, sz] of canopies) CAM.push(aabb(x - sx / 2, x + sx / 2, z - sz / 2, z + sz / 2, y - sy / 2, y + sy / 2 + 1.0));
  for (const [x, z, h] of [[-6.9, 18.6, 4], [4.9, 18.6, 4], [10.4, 19.6, 4.2], [24.6, 19.6, 4.2], [A.x - 4.2, A.z + A.d / 2 + 3.7, 3.6], [A.x + 4.2, A.z + A.d / 2 + 3.7, 3.6]]) {
    const c = mk(x, z, 0.16, 0.16, 0, 0, h); BODY.push(c); CAM.push(c);
  }
  { const c = aabb(-8.3, -4.1, M.d / 2 + 0.12, M.d / 2 + 0.52, 0, 3.9); BODY.push(c); CAM.push(c); }
  CAM.push(aabb(-4.2, 2.2, M.d / 2 + 0.05, M.d / 2 + 0.55, 3.5, 4.0));
  // the skybridge (walkable, plan.ts BRIDGE): side glass (body + camera), deck and roof (camera), tagged 3 so the roof
  // is ignored by the camera whenever the cut-away is on at or below the bridge level (the roof is hidden then)
  const by = bridgeY();
  for (const sd of [-1, 1]) {
    const zc = BRIDGE.z + sd * (BRIDGE.inner + 0.02);
    const c = aabb(BRIDGE.x0 - 0.1, BRIDGE.x1 + 0.1, zc - 0.05, zc + 0.05, by - 0.45, by + BRIDGE.ceil, 3);
    BODY.push(c); CAM.push(c);
  }
  CAM.push(aabb(BRIDGE.s0, BRIDGE.s1, BRIDGE.z - BRIDGE.half, BRIDGE.z + BRIDGE.half, by - BRIDGE.slabT, by, 3));
  CAM.push(aabb(BRIDGE.x0, BRIDGE.x1, BRIDGE.z - BRIDGE.half, BRIDGE.z + BRIDGE.half, by + BRIDGE.ceil, by + BRIDGE.ceil + BRIDGE.roofT, 3));
}
build();

// ---------------------------------------------------------------- grid (campus x −62…92, z −44…54, 1 m cells)
const GX0 = -62, GZ0 = -44, NX = 154, NZ = 98, PAD = 0.5;
const cellStart = new Int32Array(NX * NZ + 1);
let cellItems = new Int32Array(0);
function bucket() {
  const cnt = new Int32Array(NX * NZ);
  const range = (c: Col) => [
    Math.max(0, Math.floor(c.x0 - PAD - GX0)), Math.min(NX - 1, Math.floor(c.x1 + PAD - GX0)),
    Math.max(0, Math.floor(c.z0 - PAD - GZ0)), Math.min(NZ - 1, Math.floor(c.z1 + PAD - GZ0)),
  ];
  for (const c of BODY) { const [a, b, d, e] = range(c); for (let j = d; j <= e; j++) for (let i = a; i <= b; i++) cnt[j * NX + i]++; }
  let acc = 0;
  for (let k = 0; k < NX * NZ; k++) { cellStart[k] = acc; acc += cnt[k]; }
  cellStart[NX * NZ] = acc;
  cellItems = new Int32Array(acc);
  const fill = new Int32Array(NX * NZ);
  BODY.forEach((c, n) => { const [a, b, d, e] = range(c); for (let j = d; j <= e; j++) for (let i = a; i <= b; i++) { const k = j * NX + i; cellItems[cellStart[k] + fill[k]++] = n; } });
}
bucket();

export const STEP = 0.35;

// ---------------------------------------------------------------- hospital interior props (hospital/props/**, optional)
const BASE_BODY = BODY.length, BASE_CAM = CAM.length;
let propCount = 0;
/** Pull the props engineer's `propSolids` into the body grid (and tall ones into the camera list) when they change. */
export function refreshHospitalProps() {
  const { boxes, changed } = hospitalPropSolids();
  if (!changed) return propCount;
  BODY.length = BASE_BODY; CAM.length = BASE_CAM;
  for (const b of boxes) {
    if (b.y1 - b.floor * FLOOR_H <= 0.3) continue;
    const c = mk(b.cx, b.cz, b.hx, b.hz, b.yaw, b.y0, b.y1, 0, 0, BI[b.building]);
    c.yr = b.yr;
    BODY.push(c);
    if (b.y1 - b.y0 >= 1.9) CAM.push(c);
  }
  propCount = boxes.length;
  bucket();
  return propCount;
}

// ---------------------------------------------------------------- outdoor solids (world → campus), minus the buildings
const ENVELOPES: [number, number, number, number][] = [
  ...(["main", "annex"] as BId[]).map((b): [number, number, number, number] => { const B = BLD[b]; return [B.x - B.w / 2 - 0.6, B.x + B.w / 2 + 0.6, B.z - B.d / 2 - 0.6, B.z + B.d / 2 + 0.6]; }),
  ...TOWERS.map((t): [number, number, number, number] => { const a = towerZ(t, ST.endA), b = towerZ(t, ST.endB); return [t.xF - 0.1, t.xF + ST.glass + 0.4, Math.min(a, b) - 0.4, Math.max(a, b) + 0.4]; }),
];
// sparse 8 m grid (world), rebuilt only when the city engineer's list changes
const OCELL = 8, okey = (i: number, j: number) => (i + 4096) * 8192 + (j + 4096);
const outGrid = new Map<number, number[]>();
const outBig: number[] = [];   // large solids (city blocks): few, scanned directly
const EMPTY: number[] = [];
let outLen = -1, outRef: unknown = null, outCount = 0;
function outdoorIndex() {
  if (outdoorSolids.length === outLen && outRef === outdoorSolids[0]) return outGrid;
  outLen = outdoorSolids.length; outRef = outdoorSolids[0];
  outGrid.clear(); outBig.length = 0; outCount = 0;
  const ox = CAMPUS_OFFSET.x, oz = CAMPUS_OFFSET.z;
  outdoorSolids.forEach((s, n) => {
    const x0 = s.x0 - ox, x1 = s.x1 - ox, z0 = s.z0 - oz, z1 = s.z1 - oz;
    if (s.h <= STEP) return;
    if (ENVELOPES.some(([a, b, c, d]) => x1 > a && x0 < b && z1 > c && z0 < d)) return; // the buildings are modelled here
    outCount++;
    const i0 = Math.floor((s.x0 - 1) / OCELL), i1 = Math.floor((s.x1 + 1) / OCELL), j0 = Math.floor((s.z0 - 1) / OCELL), j1 = Math.floor((s.z1 + 1) / OCELL);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 9) { outBig.push(n); return; }
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = okey(i, j);
      let l = outGrid.get(k);
      if (!l) { l = []; outGrid.set(k, l); }
      l.push(n);
    }
  });
  return outGrid;
}

// ---------------------------------------------------------------- where is a point
const plateIn = (b: BId, x: number, z: number, m: number) => { const B = BLD[b]; return Math.abs(x - B.x) <= B.w / 2 + m && Math.abs(z - B.z) <= B.d / 2 + m; };
function towerAt(x: number, z: number): Tower | null {
  for (const t of TOWERS) {
    const xl = x - t.xF, zl = (z - t.zDoor) * t.dir;
    if (xl >= 0 && xl <= ST.glass && zl >= ST.endA && zl <= ST.endB) return t;
  }
  return null;
}
/** Building (plate or stair tower) containing the point, and whether it is the tower. With the feet height `y`, the
 *  skybridge counts too: `bridge`, and b = the nearer building (its level-1 floor). */
export function whereAt(x: number, z: number, out: { b: BId | null; tower: boolean; bridge?: boolean }, y?: number) {
  out.tower = false; out.b = null; out.bridge = false;
  if (plateIn("main", x, z, GLASS_OFF)) out.b = "main";
  else if (plateIn("annex", x, z, GLASS_OFF)) out.b = "annex";
  else if (y !== undefined && y > bridgeY() - 1.2 && inBridge(x, z, 0.2)) { out.b = x < (BRIDGE.x0 + BRIDGE.x1) / 2 ? "main" : "annex"; out.bridge = true; }
  else { const t = towerAt(x, z); if (t) { out.b = t.building; out.tower = true; } }
  return out;
}

// ---------------------------------------------------------------- ground height
const R = ST.half / ST.risers;
/** Stair ramp fitted through the centres of the treads (12 treads, 13 risers per half storey). */
const ramp = (t: number) => Math.min(ST.half, Math.max(0, R * (0.5 + 12 * t)));
let gBest = 0, gLow = 0, gRef = 0;
function cand(h: number) { if (h <= gRef + STEP && h > gBest) gBest = h; if (h < gLow) gLow = h; }

/** Height of the walkable surface under (x, z) for someone whose feet are near yRef (highest surface ≤ yRef + STEP). */
export function groundAt(x: number, z: number, yRef: number): number {
  gBest = -Infinity; gLow = Infinity; gRef = yRef;
  let b: BId | null = null;
  if (plateIn("main", x, z, 0.25)) b = "main"; else if (plateIn("annex", x, z, 0.25)) b = "annex";
  if (b) {
    const top = TOWER_OF[b].top;
    for (let f = 0; f <= top; f++) cand(f * FLOOR_H);
  } else {
    const t = towerAt(x, z);
    if (t) {
      const xl = x - t.xF, zl = (z - t.zDoor) * t.dir;
      cand(0);
      if (zl <= ST.land + 0.02) for (let f = 1; f <= t.top; f++) cand(f * FLOOR_H);
      else if (zl >= ST.mid0) for (let s = 0; s < t.top; s++) cand(s * FLOOR_H + ST.half);
      else {
        const u = (zl - ST.land) / ST.run;
        const laneA = xl >= (ST.laneB1 + ST.laneA0) / 2;
        for (let s = 0; s < t.top; s++) cand(s * FLOOR_H + (laneA ? ramp(u) : ST.half + ramp(1 - u)));
      }
    } else {
      cand(0);
      if (inBridge(x, z, BRIDGE.half - BRIDGE.inner)) cand(bridgeY()); // skybridge deck, level with both floors 1
    }
  }
  return gBest > -Infinity ? gBest : gLow;
}

// ---------------------------------------------------------------- body collisions
export const BODY_LO = 0.32, BODY_HI = 1.75;
const tmpW = { b: null as BId | null, tower: false, bridge: false as boolean | undefined };
/** floor layouts by building and level (no string keys in the frame loop) */
export const FLOOR_AT: Record<BId, (FloorLayout | undefined)[]> = {
  main: [0, 1, 2, 3, 4].map((f) => FLOOR_BY_KEY[`main:${f}`]),
  annex: [0, 1, 2, 3].map((f) => FLOOR_BY_KEY[`annex:${f}`]),
};
let bx = 0, bz = 0, bnx = 0, bnz = 0, bLo = 0, bHi = 0, bR = 0, bHit = false, bEco = 0;
let yearBit = 1 << 3;
/** Timeline year (props can come and go with the programme). */
export function setColliderYear(year: number) { yearBit = 1 << Math.max(0, year - 2026); }
function bPush(dx: number, dz: number) { bx += dx; bz += dz; bnx += dx; bnz += dz; bHit = true; }
function bTest(c: Col) {
  if (c.y1 <= bLo || c.y0 >= bHi) return;
  if (c.desk && (rt.desk.get(c.desk) ?? 1) < 0.5) return;
  if (c.cond === 1 && bEco < 0.08) return;
  if (c.yr && !(c.yr & yearBit)) return;
  const r = bR, dx = bx - c.cx, dz = bz - c.cz;
  const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
  const qx = lx < -c.hx ? -c.hx : lx > c.hx ? c.hx : lx, qz = lz < -c.hz ? -c.hz : lz > c.hz ? c.hz : lz;
  let ex = lx - qx, ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 >= r * r) return;
  if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; ex *= k; ez *= k; }
  else { // centre inside the box: leave along the shallowest axis
    const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz);
    if (px < pz) { ex = (lx >= 0 ? 1 : -1) * (px + r); ez = 0; } else { ex = 0; ez = (lz >= 0 ? 1 : -1) * (pz + r); }
  }
  bPush(ex * c.c + ez * c.s, -ex * c.s + ez * c.c);
}

/** Push the circle (p.x, p.z, radius r) out of every collider overlapping the body [feet + 0.32, feet + 1.75].
 *  n accumulates the push (for sliding). Returns true if anything was hit. */
export function resolveBody(p: { x: number; z: number }, feet: number, r: number, n: { x: number; z: number }): boolean {
  bx = p.x; bz = p.z; bnx = 0; bnz = 0; bHit = false; bLo = feet + BODY_LO; bHi = feet + BODY_HI; bR = r; bEco = rt.eco;
  // people of this floor (standing or walking): soft circles
  whereAt(bx, bz, tmpW, feet);
  if (tmpW.b && !tmpW.tower && !tmpW.bridge) {
    const fl = FLOOR_AT[tmpW.b][Math.round(feet / FLOOR_H)];
    if (fl) for (let i = 0; i < fl.people.length; i++) {
      const pp = fl.people[i];
      if (pp.slot.pose === "lie" || pp.slot.pose === "sit") continue;
      if ((PERSON_VIS.get(pp.id) ?? 0) < 0.5) continue;
      const w = rt.pos.get(pp.id);
      if (!w || Math.abs(w.y - feet - 1.2) > 1.4) continue;
      const dx = bx - (w.x - CAMPUS_OFFSET.x), dz = bz - (w.z - CAMPUS_OFFSET.z), rr = r + 0.22;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), k = (rr - d) / d; bPush(dx * k, dz * k); }
    }
  }
  for (let i = 0; i < PROPS.length; i++) bTest(PROPS[i]);
  const ci = Math.floor(bx - GX0), cj = Math.floor(bz - GZ0);
  if (ci >= 0 && ci < NX && cj >= 0 && cj < NZ) {
    const k = cj * NX + ci;
    for (let q = cellStart[k]; q < cellStart[k + 1]; q++) bTest(BODY[cellItems[q]]);
  }
  // outdoor solids (city blocks…): AABB in world metres
  const x = bx + CAMPUS_OFFSET.x, z = bz + CAMPUS_OFFSET.z;
  const idx = outdoorIndex().get(okey(Math.floor(x / OCELL), Math.floor(z / OCELL))) ?? EMPTY;
  const nSmall = idx.length;
  for (let q = 0; q < nSmall + outBig.length; q++) {
    const s = outdoorSolids[q < nSmall ? idx[q] : outBig[q - nSmall]];
    if (x + r <= s.x0 || x - r >= s.x1 || z + r <= s.z0 || z - r >= s.z1) continue;
    if (s.h <= STEP || feet > s.h) continue;
    if (x + r <= s.x0 || x - r >= s.x1 || z + r <= s.z0 || z - r >= s.z1) continue;
    const qx = x < s.x0 ? s.x0 : x > s.x1 ? s.x1 : x, qz = z < s.z0 ? s.z0 : z > s.z1 ? s.z1 : z;
    let ex = x - qx, ez = z - qz;
    const d2 = ex * ex + ez * ez;
    if (d2 >= r * r) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; ex *= k; ez *= k; }
    else {
      const l = x - s.x0, rt2 = s.x1 - x, f = z - s.z0, bk = s.z1 - z, m = Math.min(l, rt2, f, bk);
      ex = m === l ? -(l + r) : m === rt2 ? rt2 + r : 0; ez = m === f ? -(f + r) : m === bk ? bk + r : 0;
    }
    bPush(ex, ez);
    break; // one solid per pass (the caller iterates)
  }
  p.x = bx; p.z = bz; n.x += bnx; n.z += bnz;
  return bHit;
}

// ---------------------------------------------------------------- camera
let cpx = 0, cpy = 0, cpz = 0, cdx = 0, cdy = 0, cdz = 0, cBest = 1, cMnx = 0, cMxx = 0, cMnz = 0, cMxz = 0, cCutB = 0, cCutY = 0, ct0 = 0, ct1 = 0;
function slab(o: number, v: number, lo: number, hi: number) {
  if (Math.abs(v) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / v, b = (hi - o) / v;
  if (a > b) { const t = a; a = b; b = t; }
  if (a > ct0) ct0 = a;
  if (b < ct1) ct1 = b;
  return ct0 <= ct1;
}
function camOne(c: Col) {
  if (c.x1 < cMnx || c.x0 > cMxx || c.z1 < cMnz || c.z0 > cMxz) return;
  // cut-away: the visitor's building (both on the skybridge, cutB 3) and the skybridge itself, above the cut height
  if (cCutB && (c.bld === cCutB || c.bld === 3 || cCutB === 3) && c.y0 > cCutY) return;
  if (c.desk && (rt.desk.get(c.desk) ?? 1) < 0.5) return;
  if (c.yr && !(c.yr & yearBit)) return;
  const ox = (cpx - c.cx) * c.c - (cpz - c.cz) * c.s, oz = (cpx - c.cx) * c.s + (cpz - c.cz) * c.c;
  const vx = cdx * c.c - cdz * c.s, vz = cdx * c.s + cdz * c.c;
  ct0 = 0; ct1 = cBest;
  if (!slab(ox, vx, -c.hx, c.hx) || !slab(cpy, cdy, c.y0, c.y1) || !slab(oz, vz, -c.hz, c.hz)) return;
  if (ct0 > 0 && ct0 < cBest) cBest = ct0;
}
/** First hit of the segment p → q (campus) against the camera colliders, as a fraction of the segment (1 = clear).
 *  Colliders of building `cutB` (1 main, 2 annex, 3 both: on the skybridge) and of the skybridge starting above `cutY`
 *  (cut away) are ignored. */
export function cameraHit(px: number, py: number, pz: number, qx: number, qy: number, qz: number, cutB: number, cutY: number): number {
  cpx = px; cpy = py; cpz = pz; cdx = qx - px; cdy = qy - py; cdz = qz - pz; cBest = 1; cCutB = cutB; cCutY = cutY;
  cMnx = Math.min(px, qx); cMxx = Math.max(px, qx); cMnz = Math.min(pz, qz); cMxz = Math.max(pz, qz);
  for (let i = 0; i < CAM.length; i++) camOne(CAM[i]);
  for (let i = 0; i < PROPS.length; i++) { const c = PROPS[i]; if (c.y1 > 2.2) camOne(c); }
  return cBest;
}
export const BLD_INDEX = BI;

// ---------------------------------------------------------------- campus props (read from the scene, Site.tsx is not ours)
const _m = new THREE.Matrix4(), _mi = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
/** Trees, cars, ambulances, benches and canopy posts of the campus, identified by their shared geometry and colour. */
export function scanCampusProps(root: THREE.Object3D | null) {
  PROPS.length = 0;
  if (!root) return 0;
  root.updateWorldMatrix(true, true);
  root.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (Array.isArray(mat) || !mat.color) return;
    const hex = mat.color.getHex();
    let kind = "";
    if (m.geometry === GEO.cyl && hex === 0xb9ae9e) kind = "trunk";
    else if (m.geometry === GEO.rbox && hex === 0xffffff && mat.metalness === 0.15) kind = "car";
    else if (m.geometry === GEO.rbox && hex === 0xf3f4f7) kind = "van";
    else if (m.geometry === GEO.box && hex === 0xdce0e8) kind = "bench";
    if (!kind) return;
    for (let i = 0; i < m.count; i++) {
      m.getMatrixAt(i, _mi);
      _m.multiplyMatrices(m.matrixWorld, _mi);
      _m.decompose(_p, _q, _s);
      if (_s.x < 1e-3) continue;
      const yaw = _e.setFromQuaternion(_q, "YXZ").y;
      const x = _p.x - CAMPUS_OFFSET.x, z = _p.z - CAMPUS_OFFSET.z;
      if (ENVELOPES.some(([a, b, c, d]) => x > a - 0.5 && x < b + 0.5 && z > c - 0.5 && z < d + 0.5)) continue; // furniture inside
      
      if (kind === "trunk") PROPS.push(mk(x, z, Math.max(0.2, _s.x / 2), Math.max(0.2, _s.z / 2), 0, 0, 2.4));
      else PROPS.push(mk(x, z, _s.x / 2, _s.z / 2, yaw, _p.y - _s.y / 2, _p.y + _s.y / 2));
    }
  });
  return PROPS.length;
}

/** Debug: signatures of the instanced meshes under a root (geometry, colour, metalness, count). */
export function meshSignatures(root: THREE.Object3D | null) {
  const out: string[] = [];
  root?.traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (!m.isInstancedMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    const g = Object.entries(GEO).find(([, v]) => v === m.geometry)?.[0] ?? m.geometry.type;
    out.push(`${g}|${mat.color ? mat.color.getHexString() : "-"}|${mat.metalness ?? "-"}|${m.count}`);
  });
  return out;
}

/** Debug counters. */
export const COLLIDER_STATS = () => { outdoorIndex(); return { hospitalProps: propCount, body: BODY.length, cam: CAM.length, props: PROPS.length, outdoor: outdoorSolids.length, outdoorUsed: outCount, cells: outGrid.size, big: outBig.length }; };
