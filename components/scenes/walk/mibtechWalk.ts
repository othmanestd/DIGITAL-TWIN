// Walk mode in MIBTECH's office building (Casa réel): collisions, ground height, where the visitor is, camera hits, lift.
// Same contract as colliders.ts (hospital) so WalkWorld drives both sites with one controller.
// Frame: the scene centred on the plans' origin (mibtechFrame ORIGIN), NOT rotated — so the third-person camera, the visitor
// and the shared world (frame.player) only add W.ox / W.oz. Everything is built from the plans' own geometry:
//  · body / camera colliders: oriented boxes from the plan polygons of each floor (walls, windows, glazed and plain partitions,
//    WC cubicles, columns, lift, stair core), the furniture of the electrical plans (desks, tables, cabinets, sofas, plants…;
//    chairs are not obstacles), the terrace parapet (1st floor), the stair handrails; on the ground floor, the street front, the
//    portal and the provisional entrance hall (mibtechGeo MB_HALL), the plinth's other walls; nearby city solids (city/collide).
//    A polygon that fills its own oriented rectangle badly (L- or U-shaped cores, wall joints) is split into its edges.
//  · ground: street and ground floor y = 0, portal step, the three slabs (the stair well open), the treads and landings.
// Allocation-free at query time.
import { outdoorSolids } from "../city/collide";
import { MIBTECH_PLANS, type PlanPoly } from "../city/landmarks/mibtech/mibtechPlanData";
import { FURN_KINDS, MIBTECH_FURNITURE } from "../city/landmarks/mibtech/mibtechFurnitureData";
import { MB_FLOORS, MB_H, MB_HALL, MB_OUTLINE, MB_PARAPET, MB_PORTAL, MB_STAIR, floorY, inOutline, onTerrace, type MbFloor } from "../city/landmarks/mibtech/mibtechGeo";
import { ORIGIN, THETA, planVec, vecPlan } from "../city/landmarks/mibtech/mibtechFrame";

export const MB_ORIGIN = ORIGIN;

type Box = { cx: number; cz: number; hx: number; hz: number; c: number; s: number; y0: number; y1: number; cam: boolean; x0: number; x1: number; z0: number; z1: number };
const BODY: Box[] = [];

/** box from a plan rectangle: centre (plan), long side L at angle a (plan, atan2(dz, dx)), width T */
function put(px: number, pz: number, L: number, T: number, a: number, y0: number, y1: number, cam: boolean) {
  const [cx, cz] = planVec(px, pz);
  const phi = a - THETA;                    // the long side's direction in the scene (plan +x is THETA clockwise from scene +x)
  const c = Math.cos(phi), s = -Math.sin(phi), hx = Math.max(L, 0.04) / 2, hz = Math.max(T, 0.04) / 2;
  const ex = Math.abs(c) * hx + Math.abs(s) * hz, ez = Math.abs(s) * hx + Math.abs(c) * hz;
  BODY.push({ cx, cz, hx, hz, c, s, y0, y1, cam, x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez });
}
/** a wall segment p → q (plan), thickness t */
function seg(p: [number, number], q: [number, number], t: number, y0: number, y1: number, cam: boolean) {
  const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
  if (L < 0.02) return;
  put((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, L, t, Math.atan2(q[1] - p[1], q[0] - p[0]), y0, y1, cam);
}
const area = (P: PlanPoly) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s / 2); };
/** a plan polygon as obstacles: its minimum oriented rectangle when it fills it well, else its edges */
function poly(P: PlanPoly, y0: number, y1: number, cam: boolean) {
  if (P.length < 3) return;
  let best: [number, number, number, number, number, number] | null = null; // area, L, T, angle, cu, cv
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-4) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of P) { const u = q[0] * ux + q[1] * uz, v = -q[0] * uz + q[1] * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const A = (u1 - u0) * (v1 - v0);
    if (!best || A < best[0]) best = [A, u1 - u0, v1 - v0, Math.atan2(uz, ux), (u0 + u1) / 2, (v0 + v1) / 2];
  }
  if (!best) return;
  const [A, L, T, ang, cu, cv] = best;
  if (A < 1e-4) return;
  if (area(P) / A > 0.72 || Math.min(L, T) < 0.3) {
    const ux = Math.cos(ang), uz = Math.sin(ang);
    put(cu * ux - cv * uz, cu * uz + cv * ux, L, T, ang, y0, y1, cam);
  } else for (let i = 0; i < P.length; i++) seg(P[i], P[(i + 1) % P.length], 0.1, y0, y1, cam);
}

// ---------------------------------------------------------------- build
const S = MB_STAIR, KI = (k: (typeof FURN_KINDS)[number]) => FURN_KINDS.indexOf(k);
/** furniture heights (m) that stop the visitor; chairs, screens on desks, monitors and rugs do not */
const FURN_H: Partial<Record<(typeof FURN_KINDS)[number], number>> = { desk: 0.75, table: 0.75, round: 0.73, lounge: 0.4, armchair: 0.62, sofa: 0.62, cabinet: 0.85, low: 0.4, plant: 1.5, wc: 0.4 };
function build() {
  for (const f of MB_FLOORS) {
    const pl = MIBTECH_PLANS[f], y = floorY(f), top = y + MB_H.floor - MB_H.slab;
    for (const P of pl.masonry) poly(P, y, onTerrace(f, P) ? y + MB_PARAPET : top, true);
    for (const P of pl.window) poly(P, y, onTerrace(f, P) ? y + MB_PARAPET : top, true);
    for (const P of pl.concrete) poly(P, y, top, true);
    for (const P of pl.lift) poly(P, y, top, true);
    for (const P of pl.curtain) poly(P, y, y + MB_H.ceiling, true);
    for (const P of pl.glass) poly(P, y, y + MB_H.ceiling, true);
    for (const P of pl.partition) poly(P, y, y + MB_H.ceiling, true);
    for (const P of pl.cubicle) poly(P, y + 0.15, y + MB_H.cubicle, true);
    for (const [k, x, z, L, T, a] of MIBTECH_FURNITURE[f]) {
      const h = FURN_H[FURN_KINDS[k]];
      if (!h) continue;
      if (k === KI("plant")) put(x, z, 0.5, 0.5, a, y, y + h, false);
      else put(x, z, L, T, a, y, y + h, false);
    }
    // stair: the handrail between the two flights up to this floor; on the top floor, the guard over the flight below
    const y0 = f === 1 ? 0 : floorY((f - 1) as MbFloor);
    put((S.land.x1 + S.x1) / 2, S.zMid, S.x1 - S.land.x1, 0.06, 0, y0, y + 0.9, false);
    if (f === 3) seg([S.x1 + 0.02, S.zMid + 0.05], [S.x1 + 0.02, S.z1], 0.06, y, y + 1.0, false);
  }
  // ground floor: closed space under the first flight's upper half (the stair core at street level)
  put((S.land.x1 + S.x1) / 2, (S.z0 + S.zMid) / 2, S.x1 - S.land.x1, S.zMid - S.z0, 0, 0, 2.0, false);
  // ground floor: the provisional entrance hall, the lift shaft, the portal, the street front, the plinth's other walls
  const H = MB_HALL.H, P = MB_PORTAL;
  for (const [x0, z0, x1, z1] of MB_HALL.walls) seg([x0, z0], [x1, z1], 0.12, 0, H, true);
  for (const L of MIBTECH_PLANS[1].lift) poly(L, 0, H, true);
  seg([P.a, P.zb], [P.d0, P.zb], 0.2, 0, MB_H.ground, true);
  seg([P.d1, P.zb], [P.b, P.zb], 0.2, 0, MB_H.ground, true);
  seg([P.a, P.zs], [P.a, P.zb], 0.2, 0, MB_H.ground, true);
  seg([P.b, P.zs], [P.b, P.zb], 0.2, 0, MB_H.ground, true);
  const xs = MB_OUTLINE.map((q) => q[0]), X0 = Math.min(...xs), X1 = Math.max(...xs);
  seg([X0, P.zs], [P.a, P.zs], 0.2, 0, MB_H.ground, true);
  seg([P.b, P.zs], [X1, P.zs], 0.2, 0, MB_H.ground, true);
  for (let i = 0; i < MB_OUTLINE.length; i++) {
    const p = MB_OUTLINE[i], q = MB_OUTLINE[(i + 1) % MB_OUTLINE.length];
    if (p[1] > -1.5 && q[1] > -1.5) continue;
    seg(p, q, 0.25, 0, MB_H.ground, true);
  }
}
build();

// ---------------------------------------------------------------- grid (1 m cells over the colliders' extent)
let GX0 = Infinity, GZ0 = Infinity, NX = 0, NZ = 0;
{
  let x1 = -Infinity, z1 = -Infinity;
  for (const b of BODY) { GX0 = Math.min(GX0, b.x0); GZ0 = Math.min(GZ0, b.z0); x1 = Math.max(x1, b.x1); z1 = Math.max(z1, b.z1); }
  GX0 = Math.floor(GX0) - 2; GZ0 = Math.floor(GZ0) - 2; NX = Math.ceil(x1 - GX0) + 3; NZ = Math.ceil(z1 - GZ0) + 3;
}
const cellStart = new Int32Array(NX * NZ + 1);
const cellItems = (() => {
  const PAD = 0.5, cnt = new Int32Array(NX * NZ);
  const range = (b: Box) => [Math.max(0, Math.floor(b.x0 - PAD - GX0)), Math.min(NX - 1, Math.floor(b.x1 + PAD - GX0)), Math.max(0, Math.floor(b.z0 - PAD - GZ0)), Math.min(NZ - 1, Math.floor(b.z1 + PAD - GZ0))];
  for (const b of BODY) { const [a, c, d, e] = range(b); for (let j = d; j <= e; j++) for (let i = a; i <= c; i++) cnt[j * NX + i]++; }
  let acc = 0;
  for (let k = 0; k < NX * NZ; k++) { cellStart[k] = acc; acc += cnt[k]; }
  cellStart[NX * NZ] = acc;
  const items = new Int32Array(acc), fill = new Int32Array(NX * NZ);
  BODY.forEach((b, n) => { const [a, c, d, e] = range(b); for (let j = d; j <= e; j++) for (let i = a; i <= c; i++) { const k = j * NX + i; items[cellStart[k] + fill[k]++] = n; } });
  return items;
})();
export const MB_COLLIDERS = BODY.length;

// ---------------------------------------------------------------- city solids near the building (world AABB → this frame)
const near: { x0: number; x1: number; z0: number; z1: number; h: number }[] = [];
let nearX = Infinity, nearZ = Infinity, nearLen = -1;
const ENV = (() => { // the building's own block (its walk solids are replaced by the colliders above), 1 m margin
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const q of MB_OUTLINE) { const [x, z] = planVec(q[0], q[1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return { x0: x0 + ORIGIN[0] - 1, x1: x1 + ORIGIN[0] + 1, z0: z0 + ORIGIN[1] - 1, z1: z1 + ORIGIN[1] + 1 };
})();
function refreshNear(x: number, z: number) {
  if (Math.hypot(x - nearX, z - nearZ) < 25 && outdoorSolids.length === nearLen) return;
  nearX = x; nearZ = z; nearLen = outdoorSolids.length; near.length = 0;
  const wx = x + ORIGIN[0], wz = z + ORIGIN[1];
  for (const s of outdoorSolids) {
    if (s.x1 < wx - 60 || s.x0 > wx + 60 || s.z1 < wz - 60 || s.z0 > wz + 60) continue;
    if (s.x1 > ENV.x0 && s.x0 < ENV.x1 && s.z1 > ENV.z0 && s.z0 < ENV.z1) continue;
    near.push({ x0: s.x0 - ORIGIN[0], x1: s.x1 - ORIGIN[0], z0: s.z0 - ORIGIN[1], z1: s.z1 - ORIGIN[1], h: s.h });
  }
}

// ---------------------------------------------------------------- body collisions
export const STEP = 0.35;
/** MIBTECH's staff (city/landmarks/mibtech/MibtechPeople.tsx), this frame: soft circles the visitor steps round */
export const MB_PEOPLE: { x: number; z: number; y: number; on: boolean }[] = [];
const BODY_LO = 0.32, BODY_HI = 1.75;
let bx = 0, bz = 0, bnx = 0, bnz = 0, bLo = 0, bHi = 0, bR = 0, bHit = false;
function bPush(dx: number, dz: number) { bx += dx; bz += dz; bnx += dx; bnz += dz; bHit = true; }
function bTest(c: Box) {
  if (c.y1 <= bLo || c.y0 >= bHi) return;
  const r = bR, dx = bx - c.cx, dz = bz - c.cz;
  const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
  const qx = lx < -c.hx ? -c.hx : lx > c.hx ? c.hx : lx, qz = lz < -c.hz ? -c.hz : lz > c.hz ? c.hz : lz;
  let ex = lx - qx, ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 >= r * r) return;
  if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; ex *= k; ez *= k; }
  else { const px = c.hx - Math.abs(lx), pz = c.hz - Math.abs(lz); if (px < pz) { ex = (lx >= 0 ? 1 : -1) * (px + r); ez = 0; } else { ex = 0; ez = (lz >= 0 ? 1 : -1) * (pz + r); } }
  bPush(ex * c.c + ez * c.s, -ex * c.s + ez * c.c);
}
/** Push the circle (p.x, p.z, radius r) out of every collider overlapping the body [feet + 0.32, feet + 1.75]. */
export function mbResolveBody(p: { x: number; z: number }, feet: number, r: number, n: { x: number; z: number }, people = true): boolean {
  bx = p.x; bz = p.z; bnx = 0; bnz = 0; bHit = false; bLo = feet + BODY_LO; bHi = feet + BODY_HI; bR = r;
  const ci = Math.floor(bx - GX0), cj = Math.floor(bz - GZ0);
  if (ci >= 0 && ci < NX && cj >= 0 && cj < NZ) {
    const k = cj * NX + ci;
    for (let q = cellStart[k]; q < cellStart[k + 1]; q++) bTest(BODY[cellItems[q]]);
  }
  if (people) for (let i = 0; i < MB_PEOPLE.length; i++) {
    const pp = MB_PEOPLE[i];
    if (!pp.on || Math.abs(pp.y - feet) > 1.2) continue;
    const dx = bx - pp.x, dz = bz - pp.z, rr = r + 0.22, d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-8) { const d = Math.sqrt(d2), k = (rr - d) / d; bPush(dx * k, dz * k); }
  }
  refreshNear(bx, bz);
  for (let q = 0; q < near.length; q++) {
    const s = near[q];
    if (s.h <= STEP || feet > s.h || bx + r <= s.x0 || bx - r >= s.x1 || bz + r <= s.z0 || bz - r >= s.z1) continue;
    const qx = bx < s.x0 ? s.x0 : bx > s.x1 ? s.x1 : bx, qz = bz < s.z0 ? s.z0 : bz > s.z1 ? s.z1 : bz;
    let ex = bx - qx, ez = bz - qz;
    const d2 = ex * ex + ez * ez;
    if (d2 >= r * r) continue;
    if (d2 > 1e-10) { const d = Math.sqrt(d2), k = (r - d) / d; ex *= k; ez *= k; }
    else { const l = bx - s.x0, rr = s.x1 - bx, f = bz - s.z0, bk = s.z1 - bz, m = Math.min(l, rr, f, bk); ex = m === l ? -(l + r) : m === rr ? rr + r : 0; ez = m === f ? -(f + r) : m === bk ? bk + r : 0; }
    bPush(ex, ez);
    break;
  }
  p.x = bx; p.z = bz; n.x += bnx; n.z += bnz;
  return bHit;
}

// ---------------------------------------------------------------- ground height
const inR = (x: number, z: number, x0: number, z0: number, x1: number, z1: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const inWell = (x: number, z: number) => inR(x, z, S.land.x0, S.z0, S.x1, S.z1);
let gBest = 0, gLow = 0, gRef = 0;
function cand(h: number) { if (h <= gRef + STEP && h > gBest) gBest = h; if (h < gLow) gLow = h; }
const SLABS = MB_FLOORS.map((f) => MIBTECH_PLANS[f].slab[0]);
/** Height of the walkable surface under (x, z) (this frame) for feet near yRef (highest surface ≤ yRef + STEP). */
export function mbGroundAt(x: number, z: number, yRef: number): number {
  gBest = -Infinity; gLow = Infinity; gRef = yRef;
  const [px, pz] = vecPlan(x, z);
  cand(0);
  if (inR(px, pz, MB_PORTAL.a, MB_PORTAL.zb, MB_PORTAL.b, 0)) cand(0.15); // granite step of the portal
  const well = inWell(px, pz);
  for (let i = 0; i < 3; i++) if (!well && inOutline(SLABS[i], px, pz)) cand(floorY(MB_FLOORS[i]));
  if (inR(px, pz, S.land.x0 - 0.05, S.z0 - 0.05, S.x1 + 0.05, S.z1 + 0.05)) {
    for (const f of MB_FLOORS) {
      const y0 = f === 1 ? 0 : floorY((f - 1) as MbFloor), n = S.south.length + 1, rise = (floorY(f) - y0) / (2 * n);
      S.south.forEach((r, i) => { if (inR(px, pz, r.x0, r.z0, r.x1, r.z1)) cand(y0 + (i + 1) * rise); });
      if (inR(px, pz, S.land.x0, S.land.z0, S.land.x1, S.land.z1)) cand(y0 + n * rise);
      for (let j = 0; j < S.north.length; j++) { const r = S.north[S.north.length - 1 - j]; if (inR(px, pz, r.x0, r.z0, r.x1, r.z1)) cand(y0 + (n + j + 1) * rise); }
    }
  }
  return gBest > -Infinity ? gBest : gLow;
}

// ---------------------------------------------------------------- where
const S2 = MIBTECH_PLANS[2].slab[0];
const coreBox = MIBTECH_PLANS[1].stair_meta.box;
/** Inside the building, level (0 … 3), on the stair, on the terrace. */
export function mbWhere(x: number, z: number, y: number, out: { inside: boolean; level: number; stair: boolean; terrace: boolean }) {
  const [px, pz] = vecPlan(x, z);
  out.inside = inOutline(MB_OUTLINE, px, pz) || inR(px, pz, MB_PORTAL.a, MB_PORTAL.zb, MB_PORTAL.b, MB_PORTAL.zs);
  let lv = 0;
  for (const f of MB_FLOORS) if (y >= floorY(f) - 0.6) lv = f;
  out.level = out.inside ? lv : 0;
  out.stair = out.inside && inR(px, pz, coreBox[0][0], coreBox[0][1], S.x1, coreBox[1][1]) && inWell(px, pz);
  out.terrace = out.inside && lv === 1 && !out.stair && !inOutline(S2, px, pz);
  return out;
}

// ---------------------------------------------------------------- camera
let cpx = 0, cpy = 0, cpz = 0, cdx = 0, cdy = 0, cdz = 0, cBest = 1, cCut = Infinity, ct0 = 0, ct1 = 0, cMnx = 0, cMxx = 0, cMnz = 0, cMxz = 0;
function slab(o: number, v: number, lo: number, hi: number) {
  if (Math.abs(v) < 1e-9) return o >= lo && o <= hi;
  let a = (lo - o) / v, b = (hi - o) / v;
  if (a > b) { const t = a; a = b; b = t; }
  if (a > ct0) ct0 = a;
  if (b < ct1) ct1 = b;
  return ct0 <= ct1;
}
/** First hit of the segment p → q (this frame) against the tall colliders, as a fraction (1 = clear); everything above
 *  `cutY` is cut away (floors above, the upper part of the visitor's walls) and ignored. */
export function mbCameraHit(px: number, py: number, pz: number, qx: number, qy: number, qz: number, cutY: number): number {
  cpx = px; cpy = py; cpz = pz; cdx = qx - px; cdy = qy - py; cdz = qz - pz; cBest = 1; cCut = cutY;
  cMnx = Math.min(px, qx); cMxx = Math.max(px, qx); cMnz = Math.min(pz, qz); cMxz = Math.max(pz, qz);
  for (let i = 0; i < BODY.length; i++) {
    const c = BODY[i];
    if (!c.cam || c.y0 > cCut || c.x1 < cMnx || c.x0 > cMxx || c.z1 < cMnz || c.z0 > cMxz) continue;
    const ox = (cpx - c.cx) * c.c - (cpz - c.cz) * c.s, oz = (cpx - c.cx) * c.s + (cpz - c.cz) * c.c;
    const vx = cdx * c.c - cdz * c.s, vz = cdx * c.s + cdz * c.c;
    ct0 = 0; ct1 = cBest;
    if (!slab(ox, vx, -c.hx, c.hx) || !slab(cpy, cdy, c.y0, Math.min(c.y1, cCut)) || !slab(oz, vz, -c.hz, c.hz)) continue;
    if (ct0 > 0 && ct0 < cBest) cBest = ct0;
  }
  return cBest;
}

// ---------------------------------------------------------------- spawn and lift
/** On the pavement in front of the office entrance, facing it: position (this frame) and heading (0 = facing +z). */
export function mbSpawn() {
  const [x, z] = planVec((MB_PORTAL.d0 + MB_PORTAL.d1) / 2, 3.2);
  const [fx, fz] = planVec(0, -1);
  return { x, z, heading: Math.atan2(fx, fz) };
}
const LB = MIBTECH_PLANS[1].stair_meta.lift;
const LIFT = { cx: (LB[0][0] + LB[1][0]) / 2, cz: (LB[0][1] + LB[1][1]) / 2, hx: (LB[1][0] - LB[0][0]) / 2, hz: (LB[1][1] - LB[0][1]) / 2 };
/** Floor the lift would take the visitor to, when they stand at its door (≤ 1.1 m from the shaft), else null. */
export function mbLiftTarget(x: number, z: number, level: number, inside: boolean): number | null {
  if (!inside) return null;
  const [px, pz] = vecPlan(x, z);
  const dx = Math.max(0, Math.abs(px - LIFT.cx) - LIFT.hx), dz = Math.max(0, Math.abs(pz - LIFT.cz) - LIFT.hz);
  return Math.hypot(dx, dz) <= 1.1 ? (level + 1) % 4 : null;
}
const tmpN = { x: 0, z: 0 }, tmpP = { x: 0, z: 0 };
/** Where the lift lets the visitor out on `level`: the first free spot in front of the shaft (side nearest to `from`). */
export function mbLiftExit(level: number, fromX: number, fromZ: number): { x: number; z: number; y: number; heading: number } | null {
  const y = level === 0 ? 0 : floorY(level as MbFloor);
  const [fpx, fpz] = vecPlan(fromX, fromZ);
  const sides: [number, number][] = [[1, 0], [0, 1], [0, -1], [-1, 0]];
  sides.sort((a, b) => ((b[0] * (fpx - LIFT.cx) + b[1] * (fpz - LIFT.cz)) - (a[0] * (fpx - LIFT.cx) + a[1] * (fpz - LIFT.cz))));
  for (const [ux, uz] of sides) for (const d of [0.75, 1.1, 1.5]) for (const t of [0, -0.5, 0.5]) {
    const px = LIFT.cx + ux * (LIFT.hx + d) + uz * t, pz = LIFT.cz + uz * (LIFT.hz + d) + ux * t;
    const [x, z] = planVec(px, pz);
    if (Math.abs(mbGroundAt(x, z, y) - y) > 0.05) continue;
    tmpP.x = x; tmpP.z = z; tmpN.x = 0; tmpN.z = 0;
    if (mbResolveBody(tmpP, y, 0.3, tmpN)) continue;
    const [hx, hz] = planVec(ux, uz);
    return { x, z, y, heading: Math.atan2(hx, hz) };
  }
  return null;
}

/** dev (QA): colliders within r of (x, z) at feet height y, in the plan frame */
export function mbBoxesNear(x: number, z: number, y: number, r = 1) {
  return BODY.filter((b) => b.y1 > y + BODY_LO && b.y0 < y + BODY_HI && b.x1 > x - r && b.x0 < x + r && b.z1 > z - r && b.z0 < z + r)
    .map((b) => ({ c: vecPlan(b.cx, b.cz).map((v) => +v.toFixed(2)), hx: +b.hx.toFixed(2), hz: +b.hz.toFixed(2), y: [b.y0, +b.y1.toFixed(2)], cam: b.cam }));
}
