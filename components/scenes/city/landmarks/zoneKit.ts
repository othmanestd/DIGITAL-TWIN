// Shared kit of the OpenStreetMap districts (CFC, Maârif …): material keys and tile sizes, merged-geometry buckets,
// polygon helpers and the building primitives (walls along a footprint, caps with holes, parapets, rooftop plant,
// cranes, site hoardings, a generic block with lobby / shops / crown). District-local metres, x east, z south.
import * as THREE from "three";
import { texBox, type G } from "./geo";
import { CFC_TILE } from "./cfcPaint";

/** a footprint carrying an id and its oriented box [cx, cz, yaw, w, d] */
export type Footprint = { id: number; o: [number, number, number, number, number] };
export type CfcKey =
  | "glass.cool" | "glass.green" | "glass.bronze" | "glass.silver" | "glass.sage" | "bcpGlass" | "screen" | "apart.white" | "apart.cream" | "deco" | "grc" | "gable"
  | "veil" | "green" | "shop" | "panel" | "frame" | "villa" | "concrete" | "roof" | "parapet" | "unit" | "steel" | "crane" | "hoarding"
  | "lawn" | "scrub" | "turf" | "skate" | "rubber" | "water" | "sand" | "asphalt" | "plaza" | "path" | "rail" | "bed" | "mark"
  // Maârif: residential typologies × wall tint, ground floors, shops, street details
  | "res.0" | "res.1" | "res.2" | "res.3" | "res.4" | "res.5" | "res.6" | "res.7" | "base.w" | "base.c" | "shopAwn" | "awning"
  | "kerb" | "zebra" | "ao" | "dish" | "cage"
  // monuments built from OSM building:parts (Hassan II): the shared landmark textures
  | "arcade" | "zellige" | "greenTile" | "stoneW";
/** the key set of every zone (CFC, Maârif …) */
export type ZoneKey = CfcKey;

export const GT: [number, number] = [27.2, 30];
/** texture tile (m) of each façade material */
export const TILE: Partial<Record<CfcKey, readonly [number, number]>> = {
  "glass.cool": GT, "glass.green": GT, "glass.bronze": GT, "glass.silver": GT, "glass.sage": GT, bcpGlass: CFC_TILE.bcpGlass, screen: [12, 12],
  "apart.white": CFC_TILE.apart, "apart.cream": CFC_TILE.apart, deco: CFC_TILE.deco, grc: CFC_TILE.grc, gable: CFC_TILE.gable,
  veil: CFC_TILE.veil, green: CFC_TILE.green, shop: CFC_TILE.shop, panel: CFC_TILE.panel, frame: CFC_TILE.frame, villa: CFC_TILE.villa,
  concrete: [6, 6], roof: [8, 8], parapet: [6, 6], hoarding: [6, 2.6], lawn: [24, 24], scrub: [24, 24], plaza: [8, 8], path: [8, 8],
  "res.0": CFC_TILE.apart, "res.1": CFC_TILE.apart, "res.2": CFC_TILE.apart, "res.3": CFC_TILE.apart,
  "res.4": CFC_TILE.apart, "res.5": CFC_TILE.apart, "res.6": CFC_TILE.apart, "res.7": CFC_TILE.apart,
  "base.w": [16, 3.6], "base.c": [16, 3.6], shopAwn: [16, 4.2], kerb: [4, 4], cage: [6, 6],
  arcade: [24, 27], zellige: [4.8, 4.8], greenTile: [6, 6], stoneW: [6, 6],
};
export const tileOf = (k: CfcKey): readonly [number, number] => TILE[k] ?? [10, 10];

// ---------------------------------------------------------------- accumulators (one merged geometry per material)
export type Acc = { pos: number[]; nor: number[]; uv: number[]; idx: number[] };
export type Pt = [number, number];
export class Buckets {
  m = new Map<CfcKey, Acc>();
  get(k: CfcKey) { let a = this.m.get(k); if (!a) this.m.set(k, (a = { pos: [], nor: [], uv: [], idx: [] })); return a; }
  /** append an indexed (or not) geometry with position / normal / uv */
  geo(k: CfcKey, g: G) {
    const a = this.get(k), o = a.pos.length / 3;
    const P = g.attributes.position as THREE.BufferAttribute, Nn = g.attributes.normal as THREE.BufferAttribute, U = g.attributes.uv as THREE.BufferAttribute | undefined;
    for (let i = 0; i < P.count; i++) { a.pos.push(P.getX(i), P.getY(i), P.getZ(i)); a.nor.push(Nn.getX(i), Nn.getY(i), Nn.getZ(i)); a.uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0); }
    if (g.index) for (let i = 0; i < g.index.count; i++) a.idx.push(g.index.getX(i) + o); else for (let i = 0; i < P.count; i++) a.idx.push(i + o);
    g.dispose();
  }
  build() {
    const out: { key: CfcKey; geo: G }[] = [];
    for (const [key, a] of this.m) {
      if (!a.idx.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(a.uv, 2));
      g.setIndex(a.idx);
      g.computeBoundingSphere();
      out.push({ key, geo: g });
    }
    return out;
  }
}

// ---------------------------------------------------------------- polygon helpers
export const pts = (p: number[]): Pt[] => { const o: Pt[] = []; for (let i = 0; i < p.length; i += 2) o.push([p[i], p[i + 1]]); return o; };
export const signed = (P: Pt[]) => { let a = 0; for (let i = 0; i < P.length; i++) { const q = P[i], r = P[(i + 1) % P.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
export const ccw = (P: Pt[]) => (signed(P) < 0 ? [...P].reverse() : P);
/** inward offset of a counter-clockwise polygon by d (mitred corners, capped) */
export function inset(P: Pt[], d: number): Pt[] {
  const n = P.length, out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const n1: Pt = [-(b[1] - a[1]) / l1, (b[0] - a[0]) / l1], n2: Pt = [-(c[1] - b[1]) / l2, (c[0] - b[0]) / l2]; // inward normals
    const mx = n1[0] + n2[0], mz = n1[1] + n2[1], k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    const s = Math.min(3, 1 / Math.max(0.15, k));
    out.push([b[0] + mx * d * s, b[1] + mz * d * s]);
  }
  return out;
}
export const inPoly = (P: Pt[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i][1] > z !== P[j][1] > z && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  return c;
};
export const hash = (n: number, k = 0) => { const s = Math.sin(n * 0.0001234 + k * 17.31) * 43758.5453; return s - Math.floor(s); };
/** oriented-box local (lx, lz) → district */
export const at = (o: Footprint["o"], lx: number, lz: number): Pt => { const c = Math.cos(o[2]), s = Math.sin(o[2]); return [o[0] + lx * c + lz * s, o[1] - lx * s + lz * c]; };

// ---------------------------------------------------------------- primitives
/** vertical walls along a counter-clockwise polygon (outward), y0 … y1; `pick` chooses the material per edge from its
 *  outward normal and length. UVs in metres: u along the edge (whole tiles when snap), v = height. */
export function walls(B: Buckets, P: Pt[], y0: number, y1: number, pick: CfcKey | ((nx: number, nz: number, len: number) => CfcKey), inward = false, snap = true) {
  const n = P.length;
  for (let i = 0; i < n; i++) {
    let [ax, az] = P[i], [bx, bz] = P[(i + 1) % n];
    if (inward) [ax, az, bx, bz] = [bx, bz, ax, az];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const nx = dz / L, nz = -dx / L, key = typeof pick === "string" ? pick : pick(nx, nz, L), t = tileOf(key);
    const ru = snap ? Math.max(1, Math.round(L / t[0])) : L / t[0];
    const a = B.get(key), o = a.pos.length / 3;
    a.pos.push(ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y1, az);
    for (let k = 0; k < 4; k++) a.nor.push(nx, 0, nz);
    a.uv.push(ru, y0 / t[1], 0, y0 / t[1], 0, y1 / t[1], ru, y1 / t[1]);
    a.idx.push(o, o + 3, o + 2, o, o + 2, o + 1);
  }
}
/** flat cap (facing up, or down) over a polygon with optional holes, UV in metres */
export function cap(B: Buckets, key: CfcKey, P: Pt[], y: number, holes: Pt[][] = [], down = false) {
  const t = tileOf(key), V = (q: Pt) => new THREE.Vector2(q[0], q[1]);
  const tris = THREE.ShapeUtils.triangulateShape(P.map(V), holes.map((h) => h.map(V)));
  const all = [...P, ...holes.flat()], a = B.get(key), o = a.pos.length / 3;
  for (const q of all) { a.pos.push(q[0], y, q[1]); a.nor.push(0, down ? -1 : 1, 0); a.uv.push(q[0] / t[0], q[1] / t[1]); }
  for (const [i, j, k] of tris) {
    const A = all[i], Bq = all[j], C = all[k], cy = (Bq[1] - A[1]) * (C[0] - A[0]) - (Bq[0] - A[0]) * (C[1] - A[1]);
    if (cy > 0 !== down) a.idx.push(o + i, o + j, o + k); else a.idx.push(o + i, o + k, o + j);
  }
}
/** a box centred at (x, z), yawed, from y0 */
export const box = (B: Buckets, key: CfcKey, x: number, z: number, yaw: number, w: number, d: number, y0: number, h: number) =>
  B.geo(key, texBox(w, h, d, tileOf(key) as [number, number], [0, 0, 0], { yaw }).translate(x, y0, z));
/** a strip along a polyline (flat, width w, at y) */
export function strip(B: Buckets, key: CfcKey, p: number[], w: number, y: number, ext = 0) {
  const t = tileOf(key), a = B.get(key);
  for (let i = 0; i + 3 < p.length; i += 2) {
    const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const ux = dx / L, uz = dz / L, nx = -uz * w / 2, nz = ux * w / 2;
    const x0 = p[i] - ux * ext, z0 = p[i + 1] - uz * ext, x1 = p[i + 2] + ux * ext, z1 = p[i + 3] + uz * ext, o = a.pos.length / 3;
    a.pos.push(x0 + nx, y, z0 + nz, x1 + nx, y, z1 + nz, x1 - nx, y, z1 - nz, x0 - nx, y, z0 - nz);
    for (let k = 0; k < 4; k++) a.nor.push(0, 1, 0);
    a.uv.push(0, 0, (L + 2 * ext) / t[0], 0, (L + 2 * ext) / t[0], w / t[1], 0, w / t[1]);
    // facing up: (b − a) × (d − a) must point to +y
    const cy = (nz * 2) * dx - (nx * 2) * dz;
    if (cy > 0) a.idx.push(o, o + 1, o + 2, o, o + 2, o + 3); else a.idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
}
/** a parapet around a roof outline (outer and inner faces, coping) and the roof itself */
export function roofOf(B: Buckets, P: Pt[], h: number, key: CfcKey = "parapet", ph = 1.1, roof: CfcKey = "roof", hole?: Pt[]) {
  const I = inset(P, 0.35);
  walls(B, P, h, h + ph, key);
  walls(B, I, h, h + ph, key, true);
  cap(B, key, P, h + ph, [I]);
  if (!hole) { cap(B, roof, I, h + 0.02); return; }
  const O = inset(hole, -0.35);                       // the courtyard's own parapet
  walls(B, hole, h, h + ph, key, true);
  walls(B, O, h, h + ph, key);
  cap(B, key, O, h + ph, [hole]);
  cap(B, roof, I, h + 0.02, [O]);
}
/** rooftop plant: a few units inside the outline, away from its edge */
export function plant(B: Buckets, b: Footprint, P: Pt[], h: number, n: number) {
  const o = b.o;
  for (let k = 0; k < n; k++) {
    const lx = (hash(b.id, k) - 0.5) * o[3] * 0.6, lz = (hash(b.id, k + 9) - 0.5) * o[4] * 0.6, [x, z] = at(o, lx, lz);
    if (!inPoly(inset(P, 3), x, z)) continue;
    const w = 2.5 + hash(b.id, k + 3) * 4, d = 2 + hash(b.id, k + 5) * 3;
    box(B, "unit", x, z, o[2], w, d, h, 1.6 + hash(b.id, k + 7) * 1.4);
  }
}
/** a tower crane: mast from y0 to y0 + H, jib, counter-jib with its weight, cab (yaw = jib direction) */
export function crane(B: Buckets, x: number, z: number, y0: number, H: number, yaw: number, jib = 55) {
  const c = Math.cos(yaw), s = Math.sin(yaw), P = (l: number): Pt => [x + l * c, z - l * s];
  box(B, "crane", x, z, yaw, 2, 2, y0, H);
  const top = y0 + H;
  { const [jx, jz] = P(jib / 2 - 4); box(B, "crane", jx, jz, yaw, jib, 1.3, top, 1.5); }
  { const [jx, jz] = P(-10); box(B, "crane", jx, jz, yaw, 18, 1.6, top, 1.2); }
  { const [jx, jz] = P(-16); box(B, "concrete", jx, jz, yaw, 5, 2.4, top - 2.2, 2.4); }
  box(B, "crane", x, z, yaw, 1.4, 1.4, top, 7);                     // apex
  { const [jx, jz] = P(2.2); box(B, "glass.cool", jx, jz, yaw, 2.2, 2.2, top - 2.6, 2.4); } // cab
  { const [jx, jz] = P(jib * 0.6); box(B, "steel", jx, jz, yaw, 0.2, 0.2, top - 18, 18); }  // hook line
}
/** a construction site: hoarding around the outline, sand ground */
export function site(B: Buckets, P: Pt[]) {
  const I = inset(P, 0.6);
  walls(B, I, 0, 2.6, "hoarding");
  walls(B, I, 0, 2.6, "hoarding", true);
  cap(B, "sand", I, 0.05);
}

export const FL = 3.2;
export const lvH = (lv: number) => lv * FL + 1.4;
export const glassOf = (id: number): CfcKey => { const r = hash(id, 1); return r < 0.45 ? "glass.silver" : r < 0.7 ? "glass.sage" : r < 0.85 ? "glass.cool" : "glass.bronze"; };

/** a generic tower or block: lobby band, façade, crown or parapet, plant */
export function block(B: Buckets, b: Footprint, P: Pt[], h: number, fac: CfcKey, opt: { lobby?: boolean; shop?: boolean; crown?: boolean; plant?: number; frameTop?: number; hole?: Pt[] } = {}) {
  let y = 0;
  if (opt.lobby || opt.shop) {
    const g = opt.shop ? 4.8 : 5.2;
    walls(B, opt.shop ? P : inset(P, 1.1), 0, g, "shop");
    if (opt.hole) walls(B, opt.hole, 0, g, "shop", true);
    if (opt.lobby) cap(B, "concrete", P, g, [], true);
    y = g;
  }
  const top = opt.frameTop ? h - opt.frameTop : h;
  walls(B, P, y, top, fac);
  if (opt.hole) walls(B, opt.hole, y, top, fac, true);
  if (opt.frameTop) { walls(B, inset(P, 0.4), top, h, "frame"); cap(B, "concrete", inset(P, 0.4), h); return; }
  if (opt.crown) {
    const I = inset(P, 1.8);
    roofOf(B, P, h, "parapet", 1.2);
    walls(B, I, h, h + 4.5, fac); cap(B, "roof", I, h + 4.5);
  } else {
    roofOf(B, P, h, "parapet", 1.1, "roof", opt.hole);
  }
  if (opt.plant) plant(B, b, opt.hole ? inset(P, 2) : P, h, opt.plant);
}

/** A soft contact shadow ring around a footprint at the ground (outward, width w); uv.v = 0 at the wall, 1 outside. */
export function contactRing(B: Buckets, P: Pt[], w: number, y = 0.075) {
  const O = inset(P, -w), a = B.get("ao"), n = P.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, o = a.pos.length / 3;
    a.pos.push(P[i][0], y, P[i][1], P[j][0], y, P[j][1], O[j][0], y, O[j][1], O[i][0], y, O[i][1]);
    for (let k = 0; k < 4; k++) a.nor.push(0, 1, 0);
    a.uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    // facing up whatever the winding
    const cy = (P[j][1] - P[i][1]) * (O[j][0] - P[i][0]) - (P[j][0] - P[i][0]) * (O[j][1] - P[i][1]);
    if (cy > 0) a.idx.push(o, o + 1, o + 2, o, o + 2, o + 3); else a.idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
}
