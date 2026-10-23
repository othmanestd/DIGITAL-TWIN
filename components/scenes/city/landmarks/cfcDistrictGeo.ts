// Geometry of the Casablanca Finance City district (Casa Anfa), built from the OpenStreetMap footprints of cfcData.ts in
// district-local metres (x east, z south, origin = the CFC Tower), merged per material. Every building stands on its real
// outline; the towers that are documented get their own massing and façade (sources: docs/research/cfc-district.md):
//   CFC Tower (Morphosis, 122 m): canted glass base, straight shaft wrapped in the white brise-soleil, tapered glass crown;
//   BCP Tower (105.4 m): slab with a glass double skin to the north, a GRC moucharabieh to the south, blind GRC gables;
//   CIMR Tower (60 m): three rounded volumes stepping in height, wrapped in a white perforated aluminium veil;
//   Tour Mainstreet and Tour Casa Anfa (90 m, 22 floors), Le Métropolitain (30 m), Capital Tower (80 m);
//   BO52 (16 and 13 floors, Casablanca modernist white), Luxuria Tower (16 + 5 floors), CFC Bridge (R+6);
//   the four Tours Végétales (16 floors, planted façades); Aeria Mall (4 floors) and the old airport control tower;
//   Walili Tower (147 m) and Shift Tower (130 m), shown with their last floors still in bare concrete and a crane;
//   the Cross Tower plot and the other construction sites behind site hoardings.
// Façades whose material is not documented get the district's curtain wall or white render; storeys not tagged in OSM are
// estimates (marked `est` below). Ground: Anfa Park, the Aeria palm grove, lawns, pools, pitches, alleys, the T2 tramway.
import * as THREE from "three";
import { chamfered, loft, texBox, tube, type G, type Ring } from "./geo";
import { OSM_AREAS, OSM_BUILDINGS, OSM_PATHS, OSM_ROADS, OSM_TRAM, OSM_TRAM_STOPS, type OsmBuilding } from "./cfcData";
import { CFC_TILE } from "./cfcPaint";

export type CfcKey =
  | "glass.cool" | "glass.green" | "glass.bronze" | "glass.silver" | "glass.sage" | "bcpGlass" | "screen" | "apart.white" | "apart.cream" | "deco" | "grc" | "gable"
  | "veil" | "green" | "shop" | "panel" | "frame" | "villa" | "concrete" | "roof" | "parapet" | "unit" | "steel" | "crane" | "hoarding"
  | "lawn" | "scrub" | "turf" | "skate" | "rubber" | "water" | "sand" | "asphalt" | "plaza" | "path" | "rail" | "bed" | "mark";

const GT: [number, number] = [27.2, 30];
/** texture tile (m) of each façade material */
export const TILE: Partial<Record<CfcKey, readonly [number, number]>> = {
  "glass.cool": GT, "glass.green": GT, "glass.bronze": GT, "glass.silver": GT, "glass.sage": GT, bcpGlass: CFC_TILE.bcpGlass, screen: [12, 12],
  "apart.white": CFC_TILE.apart, "apart.cream": CFC_TILE.apart, deco: CFC_TILE.deco, grc: CFC_TILE.grc, gable: CFC_TILE.gable,
  veil: CFC_TILE.veil, green: CFC_TILE.green, shop: CFC_TILE.shop, panel: CFC_TILE.panel, frame: CFC_TILE.frame, villa: CFC_TILE.villa,
  concrete: [6, 6], roof: [8, 8], parapet: [6, 6], hoarding: [6, 2.6], lawn: [24, 24], scrub: [24, 24], plaza: [8, 8], path: [8, 8],
};
const tileOf = (k: CfcKey): readonly [number, number] => TILE[k] ?? [10, 10];

// ---------------------------------------------------------------- accumulators (one merged geometry per material)
type Acc = { pos: number[]; nor: number[]; uv: number[]; idx: number[] };
type Pt = [number, number];
class Buckets {
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
const pts = (p: number[]): Pt[] => { const o: Pt[] = []; for (let i = 0; i < p.length; i += 2) o.push([p[i], p[i + 1]]); return o; };
const signed = (P: Pt[]) => { let a = 0; for (let i = 0; i < P.length; i++) { const q = P[i], r = P[(i + 1) % P.length]; a += q[0] * r[1] - r[0] * q[1]; } return a / 2; };
const ccw = (P: Pt[]) => (signed(P) < 0 ? [...P].reverse() : P);
/** inward offset of a counter-clockwise polygon by d (mitred corners, capped) */
function inset(P: Pt[], d: number): Pt[] {
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
const inPoly = (P: Pt[], x: number, z: number) => {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) if (P[i][1] > z !== P[j][1] > z && x < ((P[j][0] - P[i][0]) * (z - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  return c;
};
const hash = (n: number, k = 0) => { const s = Math.sin(n * 0.0001234 + k * 17.31) * 43758.5453; return s - Math.floor(s); };
/** oriented-box local (lx, lz) → district */
const at = (o: OsmBuilding["o"], lx: number, lz: number): Pt => { const c = Math.cos(o[2]), s = Math.sin(o[2]); return [o[0] + lx * c + lz * s, o[1] - lx * s + lz * c]; };

// ---------------------------------------------------------------- primitives
/** vertical walls along a counter-clockwise polygon (outward), y0 … y1; `pick` chooses the material per edge from its
 *  outward normal and length. UVs in metres: u along the edge (whole tiles when snap), v = height. */
function walls(B: Buckets, P: Pt[], y0: number, y1: number, pick: CfcKey | ((nx: number, nz: number, len: number) => CfcKey), inward = false, snap = true) {
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
function cap(B: Buckets, key: CfcKey, P: Pt[], y: number, holes: Pt[][] = [], down = false) {
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
const box = (B: Buckets, key: CfcKey, x: number, z: number, yaw: number, w: number, d: number, y0: number, h: number) =>
  B.geo(key, texBox(w, h, d, tileOf(key) as [number, number], [0, 0, 0], { yaw }).translate(x, y0, z));
/** a strip along a polyline (flat, width w, at y) */
function strip(B: Buckets, key: CfcKey, p: number[], w: number, y: number, ext = 0) {
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
function roofOf(B: Buckets, P: Pt[], h: number, key: CfcKey = "parapet", ph = 1.1, roof: CfcKey = "roof", hole?: Pt[]) {
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
function plant(B: Buckets, b: OsmBuilding, P: Pt[], h: number, n: number) {
  const o = b.o;
  for (let k = 0; k < n; k++) {
    const lx = (hash(b.id, k) - 0.5) * o[3] * 0.6, lz = (hash(b.id, k + 9) - 0.5) * o[4] * 0.6, [x, z] = at(o, lx, lz);
    if (!inPoly(inset(P, 3), x, z)) continue;
    const w = 2.5 + hash(b.id, k + 3) * 4, d = 2 + hash(b.id, k + 5) * 3;
    box(B, "unit", x, z, o[2], w, d, h, 1.6 + hash(b.id, k + 7) * 1.4);
  }
}
/** a tower crane: mast from y0 to y0 + H, jib, counter-jib with its weight, cab (yaw = jib direction) */
function crane(B: Buckets, x: number, z: number, y0: number, H: number, yaw: number, jib = 55) {
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
function site(B: Buckets, P: Pt[]) {
  const I = inset(P, 0.6);
  walls(B, I, 0, 2.6, "hoarding");
  walls(B, I, 0, 2.6, "hoarding", true);
  cap(B, "sand", I, 0.05);
}

// ---------------------------------------------------------------- building catalogue
export type Label = { name: string; sub: string; x: number; y: number; z: number; hero?: boolean };
export type CfcSolid = { o: OsmBuilding["o"]; h: number };
const FL = 3.2;
const lvH = (lv: number) => lv * FL + 1.4;
const glassOf = (id: number): CfcKey => { const r = hash(id, 1); return r < 0.45 ? "glass.silver" : r < 0.7 ? "glass.sage" : r < 0.85 ? "glass.cool" : "glass.bronze"; };

/** CFC Tower (Morphosis): the real footprint as its oriented box (30.25 × 35.5 m, ~23° off north), 122 m. */
function cfcTower(B: Buckets, b: OsmBuilding): number {
  const o = b.o, H = 122, hx = o[3] / 2, hz = o[4] / 2;
  const ring = (y: number, sx: number, sz: number, c: number, ox = 0, oz = 0): Ring => {
    const p = chamfered(hx * sx, hz * sz, c, ox, oz).map(([lx, lz]) => at(o, lx, lz));
    return { y, p };
  };
  // the canted glass lobby (narrower at the ground), the flare up to the shaft, all under the white screen
  B.geo("glass.silver", loft([ring(0, 0.74, 0.74, 2.4), ring(9, 0.86, 0.86, 3)], GT, [0, 0, 0], { snap: true }));
  B.geo("parapet", loft([ring(9, 0.86, 0.86, 3), ring(10, 0.88, 0.88, 3.1)], [6, 6]));
  B.geo("screen", loft([ring(10, 0.88, 0.88, 3.1), ring(22, 1, 1, 3.8)], [12, 12], [0, 0, 0], { snap: true }));
  // the shaft wrapped in the brise-soleil
  B.geo("screen", loft([ring(22, 1, 1, 3.8), ring(104, 1, 1, 3.8)], [12, 12], [0, 0, 0], { snap: true }));
  // the shard crown: the screen folds in and leans to one corner, the glass top above it
  B.geo("screen", loft([ring(104, 1, 1, 3.8), ring(111, 0.9, 0.86, 4, 0.8, -0.6), ring(116, 0.72, 0.66, 3.8, 2.4, -2)], [12, 12], [0, 0, 0], { snap: true }));
  B.geo("glass.silver", loft([ring(116, 0.72, 0.66, 3.8, 2.4, -2), ring(H, 0.42, 0.36, 2.2, 5, -4.2)], GT, [0, 0, 0], { snap: true, cap: true }));
  return H;
}

/** BCP Tower: north glass double skin, south GRC moucharabieh, blind GRC gables, recessed lobby, 105.4 m. */
function bcpTower(B: Buckets, P: Pt[], h: number) {
  const face = (nx: number, nz: number, L: number): CfcKey => (L > 30 ? (nz < 0 ? "bcpGlass" : "grc") : "gable");
  walls(B, inset(P, 1.4), 0, 6.4, "shop");
  cap(B, "concrete", P, 6.4, [], true);
  walls(B, P, 6.4, h, face);
  roofOf(B, P, h, "gable", 2.2);
}

/** a generic tower or block: lobby band, façade, crown or parapet, plant */
function block(B: Buckets, b: OsmBuilding, P: Pt[], h: number, fac: CfcKey, opt: { lobby?: boolean; shop?: boolean; crown?: boolean; plant?: number; frameTop?: number; hole?: Pt[] } = {}) {
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

/** Build the whole district. Returns the merged parts, the labels, the colliders and the towers (for the pedestrians). */
export function buildCfcDistrict() {
  const B = new Buckets(), labels: Label[] = [], solids: CfcSolid[] = [];
  const towers: { id: number; o: OsmBuilding["o"]; h: number }[] = [];
  const lab = (b: OsmBuilding, name: string, sub: string, y: number, hero = false) => labels.push({ name, sub, x: b.o[0], y, z: b.o[1], hero });
  const named = new Set<string>();
  for (const b of OSM_BUILDINGS) {
    const P = ccw(pts(b.p)), o = b.o, est = hash(b.id, 2);
    let h = 0;
    switch (b.id) {
      case 871612907: h = cfcTower(B, b); lab(b, "CFC Tower", "Morphosis · 122 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 871612905: h = 105.4; bcpTower(B, P, h); lab(b, "Tour BCP", "Banque Centrale Populaire · 105 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 1242476327: h = 5 * FL + 3; block(B, b, P, h, "panel", { shop: true, plant: 3 }); break;          // probably the BCP podium (5 storeys)
      case 871612914: h = 60; block(B, b, P, h, "veil", { lobby: true }); cap(B, "lawn", inset(P, 1.5), h + 0.06); lab(b, "Tour CIMR", "60 m · voile d'aluminium perforé", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 871612913: h = 52; block(B, b, P, h, "veil", { lobby: true }); cap(B, "lawn", inset(P, 1.5), h + 0.06); break;   // est: the two lower CIMR volumes
      case 871612915: h = 44; block(B, b, P, h, "veil", { lobby: true }); cap(B, "lawn", inset(P, 1.5), h + 0.06); break;
      case 1056146783: h = 90; block(B, b, P, h - 4.5, "glass.silver", { lobby: true, crown: true, plant: 0 }); lab(b, "Tour Mainstreet", "Casa Business Towers · 90 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 1056146785: h = 90; block(B, b, P, h - 4.5, "glass.sage", { lobby: true, crown: true }); lab(b, "Tour Casa Anfa", "Casa Business Towers · 90 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 1056146784: h = 30; block(B, b, P, h, "glass.green", { lobby: true, plant: 2 }); break;
      case 1056146786: h = 80; block(B, b, P, h - 4.5, "glass.cool", { lobby: true, crown: true }); lab(b, "Capital Tower", "80 m", h + 8, true); break;
      case 871612908: h = 60; block(B, b, P, h, "deco", { shop: true, plant: 3 }); lab(b, "BO52", "résidences · 16 et 13 étages", h + 6); break;
      case 1308753446: h = lvH(13); block(B, b, P, h, "deco", { shop: true, plant: 3 }); break;
      case 1242476329: h = lvH(16); block(B, b, P, h, "apart.white", { plant: 2 }); lab(b, "Luxuria Tower", "R+15", h + 6); break;
      case 1242476330: h = lvH(5); block(B, b, P, h, "apart.white", { plant: 1 }); break;
      case 586649061: h = 7 * 3.6; block(B, b, P, h, "glass.silver", { lobby: true, plant: 4 }); break; // CFC Bridge, R+6
      case 1056146770: case 1056146771: case 1056146772: case 1056146773:
        h = lvH(16); block(B, b, P, h, "green", { shop: false, plant: 1 }); if (b.id === 1056146771) lab(b, "Tours Végétales", "Édouard François · R+16", h + 6); break;
      case 871612919: h = 4 * 4.2; block(B, b, P, h, "panel", { shop: true, plant: 9 }); lab(b, "Aeria Mall", "ancien aéroport d'Anfa", h + 6); break;
      case 1308152369: {                                                                                 // the old control tower (est.)
        h = 14; walls(B, P, 0, h, "gable"); const I = inset(P, -0.8); walls(B, I, h, h + 3, "glass.cool"); cap(B, "roof", I, h + 3); cap(B, "concrete", I, h, [], true); h += 3; break;
      }
      case 1308110828: {                                                                                 // Walili Tower: plot podium + tower (shaft size est.)
        const plot = inset(P, 2), hp = 14; block(B, b, plot, hp, "panel", { shop: true });
        h = 147; const s = 19, T: Pt[] = [at(o, -s, -s), at(o, s, -s), at(o, s, s), at(o, -s, s)];
        block(B, b, ccw(T), h, "glass.silver", { frameTop: 14 }); crane(B, o[0], o[1], h, 26, o[2] + 0.6, 50);
        lab(b, "Walili Tower", "147 m · en construction", h + 30, true); break;
      }
      case 1308151969: h = 130; block(B, b, P, h, "glass.bronze", { lobby: true, frameTop: 12 }); crane(B, o[0], o[1], h, 24, o[2] - 0.9, 48); lab(b, "Shift Tower", "130 m · en construction", h + 30, true); break;
      case 1308110887: case 871612916: {                                                                 // Cross Tower plot / building site
        site(B, P); const I = inset(P, 9); walls(B, I, 0, 7.2, "frame"); cap(B, "concrete", I, 7.2); h = 7.2;
        const [cx, cz] = at(o, o[3] * 0.18, -o[4] * 0.2); crane(B, cx, cz, 0, b.id === 1308110887 ? 52 : 38, o[2] + 2.1, 45);
        if (b.id === 1308110887) lab(b, "Cross Tower", "chantier", 64); break;
      }
      default: {
        const t = b.type;
        if (t === "house") { h = lvH(2) - 1; block(B, b, P, h, "villa", { plant: 1 }); break; }
        if (t === "construction") { site(B, P); break; }
        if (t === "civic" || t === "public" || t === "pavilion" || (b.lv ?? 9) <= 1) { h = 4.6; block(B, b, P, h, "panel", { shop: true }); break; }
        if (t === "retail" || t === "commercial") { h = lvH(b.lv ?? 2 + Math.round(est)); block(B, b, P, h, "panel", { shop: true, plant: 2 }); break; }
        const office = t === "office" || (t === "yes" && est < 0.45);
        const lv = b.lv ?? (office ? 6 + Math.round(est * 2) : 5 + Math.round(est * 2)); // est: storeys not in OSM
        h = b.h ?? lvH(lv);
        const fac: CfcKey = office ? glassOf(b.id) : hash(b.id, 4) < 0.7 ? "apart.white" : "apart.cream";
        const rect = P.length === 4 && b.a > 0.92 * o[3] * o[4];
        const court = rect && b.a > 2800 && Math.min(o[3], o[4]) > 40;
        const hole = court ? ccw(inset(P, 14)) : undefined;
        if (hole) cap(B, "lawn", hole, 0.06);
        block(B, b, P, h, fac, { lobby: office, shop: !office && b.a > 600 && hash(b.id, 6) < 0.5, plant: hole ? 0 : Math.min(6, 1 + Math.floor(b.a / 500)), hole });
        if (b.name && b.name !== "BO52" && b.a > 900 && !named.has(b.name)) { named.add(b.name); lab(b, b.name.split(" ").slice(0, 4).join(" "), `${b.lv ? b.lv : "~" + lv} niveaux`, h + 5); }
      }
    }
    if (h > 0) solids.push({ o, h });
  }

  // ------------------------------------------------------------ ground: parks, lawns, pools, pitches, sites, plazas
  const Y: Record<string, number> = { park: 0.03, garden: 0.034, grass: 0.034, scrub: 0.036, site: 0.04, sport: 0.036, parking: 0.04, plaza: 0.042, pitch: 0.046, play: 0.048, water: 0.05, pool: 0.052 };
  for (const a of OSM_AREAS) {
    const P = ccw(pts(a.p));
    const key: CfcKey = a.k === "park" || a.k === "garden" || a.k === "grass" || a.k === "sport" ? "lawn" : a.k === "scrub" ? "scrub"
      : a.k === "pitch" ? (a.name.includes("Skate") ? "skate" : "turf") : a.k === "play" ? "rubber" : a.k === "water" || a.k === "pool" ? "water"
      : a.k === "site" ? "sand" : a.k === "parking" ? "asphalt" : "plaza";
    try { cap(B, key, P, Y[a.k] ?? 0.04); } catch { /* degenerate outline */ }
    if (a.k === "water" || a.k === "pool") { walls(B, inset(P, -0.35), 0, 0.35, "parapet"); cap(B, "parapet", inset(P, -0.35), 0.35, [P]); }
  }
  for (const p of OSM_PATHS) strip(B, "path", p.p, p.w, 0.055, 0.4);
  // centre lines of the two-way streets
  for (const r of OSM_ROADS) if (!r.o && r.w >= 6.5) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz);
      for (let t = 2; t + 3 < L; t += 9) strip(B, "mark", [r.p[i] + (dx * t) / L, r.p[i + 1] + (dz * t) / L, r.p[i] + (dx * (t + 3)) / L, r.p[i + 1] + (dz * (t + 3)) / L], 0.15, 0.095);
    }
  }
  // the T2 tramway: a concrete bed and two rails per track, catenary poles along the outer track
  OSM_TRAM.forEach((p, k) => {
    strip(B, "bed", p, 3.1, 0.075, 0.6);
    for (const off of [-0.72, 0.72]) {
      const q: number[] = [];
      for (let i = 0; i < p.length; i += 2) {
        const j = Math.min(i, p.length - 4), dx = p[j + 2] - p[j], dz = p[j + 3] - p[j + 1], L = Math.hypot(dx, dz) || 1;
        q.push(p[i] - (dz / L) * off, p[i + 1] + (dx / L) * off);
      }
      strip(B, "rail", q, 0.12, 0.095, 0.3);
    }
    if (k === 0) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
      for (let t = 0; t < L; t += 34) {
        const x = p[i] + (dx * t) / L - nx * 2.6, z = p[i + 1] + (dz * t) / L - nz * 2.6;
        B.geo("steel", tube(0.12, 0.16, 7.2, 8, [1, 1], [x, 0, z]));
        box(B, "steel", x + nx * 2.4, z + nz * 2.4, Math.atan2(-nz, nx), 4.8, 0.12, 6.6, 0.12);
      }
    }
  });
  for (const s of OSM_TRAM_STOPS) {
    // the nearest point of each track; the stop stands between them, its platforms on either side
    const near = OSM_TRAM.map((p) => {
      let best = { d: 1e9, x: s.x, z: s.z, yaw: 0 };
      for (let i = 0; i + 3 < p.length; i += 2) {
        const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / L2)), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(s.x - qx, s.z - qz);
        if (d < best.d) best = { d, x: qx, z: qz, yaw: Math.atan2(-dz, dx) };
      }
      return best;
    }).filter((q) => q.d < 12);
    if (!near.length) continue;
    const px = near.reduce((a, q) => a + q.x, 0) / near.length, pz = near.reduce((a, q) => a + q.z, 0) / near.length, yaw = near[0].yaw;
    const c = Math.cos(yaw), sn = Math.sin(yaw), off = (near.length > 1 ? Math.hypot(near[0].x - near[1].x, near[0].z - near[1].z) / 2 : 0) + 3.1;
    for (const side of [-1, 1]) {
      const x = px + sn * side * off, z = pz + c * side * off;
      box(B, "plaza", x, z, yaw, 32, 2.6, 0, 0.32);
      box(B, "glass.cool", x + sn * side * 0.95, z + c * side * 0.95, yaw, 8, 0.08, 0.32, 2.3);
      box(B, "steel", x, z, yaw, 9, 2.2, 2.62, 0.14);
    }
    labels.push({ name: `Tram T2 · ${s.name}`, sub: "", x: px, y: 6, z: pz });
  }
  labels.push({ name: "Anfa Park", sub: "parc urbain · ~16 ha", x: 300, y: 10, z: 80 });
  labels.push({ name: "Aeria Palmeraie", sub: "", x: -110, y: 10, z: 70 });
  return { parts: B.build(), labels, solids, towers };
}
