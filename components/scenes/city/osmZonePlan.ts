// OpenStreetMap zones in the city plan (pure data, no three.js scene objects): a zone (landmarks/zones/*Data.ts) placed at
// a world offset gives the plan its real streets (plan segments), its trees (the OSM trees and tree rows, scattered trees in
// its parks and gardens) and, where OSM has streets but no building footprints, illustrative frontage buildings along the
// streets (`zoneFillers`: NOT real footprints, see docs/research/maarif-pilote.md). Shared by the plan and the zone's
// geometry so that both see the same fillers. World = local + (ox, oz); map north = −z in both.
import type { OsmZone, ZoneBuilding } from "./landmarks/zones/types";

export type PlacedZone = {
  zone: OsmZone; ox: number; oz: number;
  /** local bands kept free of zone buildings (a city corridor running through the zone, e.g. the tram boulevard) */
  corridors: { z0: number; z1: number }[];
  /** illustrative frontage blocks where OSM maps streets but no buildings (default true; false in villa districts) */
  fill?: boolean;
  /** plausible garden trees around the mapped houses (illustrative; villa districts) */
  gardens?: boolean;
};

export function inPoly(p: number[], x: number, z: number) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
const segDist = (ax: number, az: number, bx: number, bz: number, x: number, z: number) => {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};
const hash = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** A coarse spatial index of the zone (25 m cells): road segments, building footprints, hard open spaces. */
type Seg = { ax: number; az: number; bx: number; bz: number; w: number; r: number };
class Index {
  C = 25; roads = new Map<number, Seg[]>(); blds = new Map<number, ZoneBuilding[]>();
  key(i: number, j: number) { return i * 4096 + j; }
  addBox<T>(m: Map<number, T[]>, v: T, x0: number, z0: number, x1: number, z1: number) {
    for (let i = Math.floor(x0 / this.C); i <= Math.floor(x1 / this.C); i++) for (let j = Math.floor(z0 / this.C); j <= Math.floor(z1 / this.C); j++) {
      const k = this.key(i, j); let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(v);
    }
  }
  near<T>(m: Map<number, T[]>, x: number, z: number, r: number) {
    const out = new Set<T>();
    for (let i = Math.floor((x - r) / this.C); i <= Math.floor((x + r) / this.C); i++) for (let j = Math.floor((z - r) / this.C); j <= Math.floor((z + r) / this.C); j++) for (const v of m.get(this.key(i, j)) ?? []) out.add(v);
    return out;
  }
}
const INDEX = new WeakMap<OsmZone, Index>();
function indexOf(Z: OsmZone) {
  let ix = INDEX.get(Z);
  if (ix) return ix;
  ix = new Index();
  Z.roads.forEach((r, k) => { for (let i = 0; i + 3 < r.p.length; i += 2) {
    const s = { ax: r.p[i], az: r.p[i + 1], bx: r.p[i + 2], bz: r.p[i + 3], w: r.w, r: k };
    ix.addBox(ix.roads, s, Math.min(s.ax, s.bx) - r.w, Math.min(s.az, s.bz) - r.w, Math.max(s.ax, s.bx) + r.w, Math.max(s.az, s.bz) + r.w);
  } });
  for (const b of Z.buildings) { const e = (b.o[3] + b.o[4]) / 2; ix.addBox(ix.blds, b, b.o[0] - e, b.o[1] - e, b.o[0] + e, b.o[1] + e); }
  INDEX.set(Z, ix);
  return ix;
}
/** distance to the nearest street edge (negative inside a carriageway) */
function roadClear(ix: Index, x: number, z: number) {
  let d = 1e9;
  for (const s of ix.near(ix.roads, x, z, 30)) d = Math.min(d, segDist(s.ax, s.az, s.bx, s.bz, x, z) - s.w / 2);
  return d;
}
const inBuilding = (ix: Index, x: number, z: number, m: number) => {
  for (const b of ix.near(ix.blds, x, z, m + 2)) {
    const e = (b.o[3] + b.o[4]) / 2 + m;
    if (Math.abs(x - b.o[0]) < e && Math.abs(z - b.o[1]) < e && (inPoly(b.p, x, z) || m > 0 && nearPoly(b.p, x, z, m))) return true;
  }
  return false;
};
function nearPoly(p: number[], x: number, z: number, m: number) {
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if (segDist(p[j], p[j + 1], p[i], p[i + 1], x, z) < m) return true;
  return false;
}
const HARD = new Set(["water", "pool", "pitch", "play", "plaza", "sport", "parking", "site", "park", "garden", "grass"]);
const inCorridor = (P: PlacedZone, z: number, m = 0) => P.corridors.some((c) => z > c.z0 - m && z < c.z1 + m);

/** Is (x, z) on a carriageway (within its half width + m) of a street other than road index `self`? (zone-local) */
export function onOtherRoad(Z: OsmZone, x: number, z: number, self: number, m: number) {
  const ix = indexOf(Z);
  for (const s of ix.near(ix.roads, x, z, 2)) if (s.r !== self && segDist(s.ax, s.az, s.bx, s.bz, x, z) < s.w / 2 + m) return true;
  return false;
}

/** The zone's streets as plan segments (world). */
export function zoneRoadSegs(P: PlacedZone) {
  const out: { x0: number; z0: number; x1: number; z1: number; w: number; c: number }[] = [];
  for (const r of P.zone.roads) for (let i = 0; i + 3 < r.p.length; i += 2)
    out.push({ x0: r.p[i] + P.ox, z0: r.p[i + 1] + P.oz, x1: r.p[i + 2] + P.ox, z1: r.p[i + 3] + P.oz, w: r.w, c: r.w > 20 ? 1 : 0 });
  return out;
}

/** Illustrative frontage buildings (zone-local) where OSM maps the streets but no footprint at all within 18 m: lots of
 *  11 … 18 m along the street, 13 … 16 m deep, 4 … 6 storeys (the common Maârif height in the mapped blocks), set back
 *  behind the pavement. Deterministic; never on a street, a mapped building, an open space or a corridor. */
export type Filler = { id: number; o: [number, number, number, number, number]; p: number[]; lv: number; shop: number };
const FILL = new WeakMap<OsmZone, Filler[]>();
export function zoneFillers(P: PlacedZone): Filler[] {
  const Z = P.zone;
  let out = FILL.get(Z);
  if (out) return out;
  out = [];
  if (P.fill === false) { FILL.set(Z, out); return out; }
  const ix = indexOf(Z), hard = Z.areas.filter((a) => HARD.has(a.k)), placed: Filler[] = [];
  const clash = (q: number[]) => placed.some((f) => Math.hypot(f.o[0] - q[0], f.o[1] - q[1]) < (f.o[3] + f.o[4]) / 2 + 6 && polyOverlap(f.p, q));
  let id = 1;
  for (const r of Z.roads) {
    if (r.k === "service" || r.k === "busway" || r.k.endsWith("_link")) continue;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], dx = r.p[i + 2] - ax, dz = r.p[i + 3] - az, L = Math.hypot(dx, dz);
      if (L < 14) continue;
      const ux = dx / L, uz = dz / L, nx = -uz, nz = ux, yaw = Math.atan2(-uz, ux);
      for (const side of [-1, 1]) {
        let t = 4;
        while (t < L - 4) {
          const lw = 11 + Math.floor(hash(ax + t, az + side) * 8), D = 13 + Math.floor(hash(az - t, ax) * 4), off = r.w / 2 + 3.6 + D / 2;
          const cx = ax + ux * (t + lw / 2) + nx * off * side, cz = az + uz * (t + lw / 2) + nz * off * side;
          t += lw + 0.3;
          const hw = lw / 2, hd = D / 2, c = Math.cos(yaw), s = Math.sin(yaw);
          const corner = (lx: number, lz: number) => [cx + lx * c + lz * s, cz - lx * s + lz * c];
          const q = [...corner(-hw, -hd), ...corner(hw, -hd), ...corner(hw, hd), ...corner(-hw, hd)];
          const samples: number[][] = [[cx, cz], ...[0, 2, 4, 6].map((k) => [q[k], q[k + 1]]), corner(0, -hd), corner(0, hd), corner(-hw, 0), corner(hw, 0)];
          const b = Z.box;
          if (samples.some(([x, z]) => x < b.x0 + 4 || x > b.x1 - 4 || z < b.z0 + 4 || z > b.z1 - 4 || inCorridor(P, z, 3))) continue;
          if (inBuilding(ix, cx, cz, 18)) continue;                                   // a mapped block: leave it as mapped
          if (samples.some(([x, z]) => roadClear(ix, x, z) < 3.2)) continue;           // on a street or its pavement
          if (samples.some(([x, z]) => hard.some((a) => inPoly(a.p, x, z)))) continue;
          if (clash(q)) continue;
          const f: Filler = { id: -(id++), o: [cx, cz, yaw, lw, D], p: q, lv: 4 + Math.floor(hash(cx, cz) * 3), shop: r.k === "primary" || r.k === "secondary" ? (hash(cz, cx) < 0.6 ? 1 : 0) : hash(cx + 1, cz) < 0.15 ? 1 : 0 };
          placed.push(f);
        }
      }
    }
  }
  out = placed;
  FILL.set(Z, out);
  return out;
}
function polyOverlap(a: number[], b: number[]) {
  // separating axis test for two convex quads
  for (const P of [a, b]) for (let i = 0; i < 8; i += 2) {
    const j = (i + 2) % 8, ex = P[j] - P[i], ez = P[j + 1] - P[i + 1], ax = -ez, az = ex;
    let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let k = 0; k < 8; k += 2) { const v = a[k] * ax + a[k + 1] * az; a0 = Math.min(a0, v); a1 = Math.max(a1, v); }
    for (let k = 0; k < 8; k += 2) { const v = b[k] * ax + b[k + 1] * az; b0 = Math.min(b0, v); b1 = Math.max(b1, v); }
    if (a1 < b0 || b1 < a0) return false;
  }
  return true;
}

/** Trees and palms of the zone (world): the OSM trees and tree rows (palms along the boulevards, trees elsewhere), and
 *  trees scattered in its parks and gardens, clear of buildings, streets, paths and hard ground. */
export function zoneGreenery(P: PlacedZone) {
  const Z = P.zone, ix = indexOf(Z), trees: [number, number, number][] = [], palms: [number, number][] = [];
  const hard = Z.areas.filter((a) => ["water", "pool", "pitch", "play", "plaza", "sport", "parking", "site"].includes(a.k));
  const W = (x: number, z: number): [number, number] => [x + P.ox, z + P.oz];
  const ok = (x: number, z: number) => !inCorridor(P, z, 2) && !inBuilding(ix, x, z, 1.5) && roadClear(ix, x, z) > 1.2 && !hard.some((a) => inPoly(a.p, x, z));
  for (const [x, z] of Z.trees) if (ok(x, z)) { const [wx, wz] = W(x, z); trees.push([wx, wz, 0.8 + hash(x, z) * 0.5]); }
  for (const r of Z.treeRows) for (let i = 0; i + 3 < r.length; i += 2) {
    const dx = r[i + 2] - r[i], dz = r[i + 3] - r[i + 1], L = Math.hypot(dx, dz);
    for (let t = 0; t < L; t += 9) { const x = r[i] + (dx * t) / L, z = r[i + 1] + (dz * t) / L; if (ok(x, z)) palms.push(W(x, z)); }
  }
  for (const a of Z.areas) {
    if (a.k !== "park" && a.k !== "garden") continue;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < a.p.length; i += 2) { x0 = Math.min(x0, a.p[i]); x1 = Math.max(x1, a.p[i]); z0 = Math.min(z0, a.p[i + 1]); z1 = Math.max(z1, a.p[i + 1]); }
    for (let x = x0 + 5; x < x1; x += 10) for (let z = z0 + 5; z < z1; z += 10) {
      const px = x + (hash(z, x) - 0.5) * 7, pz = z + (hash(x, z) - 0.5) * 7;
      if (hash(px, pz) > 0.55 || !inPoly(a.p, px, pz) || !ok(px, pz)) continue;
      if (Z.paths.some((p) => { for (let i = 0; i + 3 < p.p.length; i += 2) if (segDist(p.p[i], p.p[i + 1], p.p[i + 2], p.p[i + 3], px, pz) < p.w / 2 + 1.5) return true; return false; })) continue;
      const [wx, wz] = W(px, pz);
      if (hash(px + 3, pz - 7) < 0.3) palms.push([wx, wz]); else trees.push([wx, wz, 0.8 + hash(pz, px + 1) * 0.6]);
    }
  }
  // villa gardens (illustrative): two to four trees or palms around each house, on its own side of the street
  if (P.gardens) for (const b of Z.buildings) {
    if (b.type !== "house" && !(b.type === "yes" && b.a < 600)) continue;
    const n = 2 + Math.floor(hash(b.o[0], b.o[1]) * 3), R = Math.max(b.o[3], b.o[4]) / 2 + 4;
    for (let k = 0; k < n; k++) {
      const a = hash(b.o[0] + k, b.o[1] - k) * Math.PI * 2, r = R + hash(b.o[1] + k, b.o[0]) * 5;
      const x = b.o[0] + Math.cos(a) * r, z = b.o[1] + Math.sin(a) * r;
      if (!ok(x, z) || roadClear(ix, x, z) < 3) continue;
      const [wx, wz] = W(x, z);
      if (hash(x, z) < 0.3) palms.push([wx, wz]); else trees.push([wx, wz, 0.8 + hash(z, x) * 0.6]);
    }
  }
  // no tree inside an illustrative filler
  const F = zoneFillers(P);
  const inF = (x: number, z: number) => F.some((f) => Math.abs(x - P.ox - f.o[0]) < 12 && Math.abs(z - P.oz - f.o[1]) < 12 && inPoly(f.p, x - P.ox, z - P.oz));
  return { trees: trees.filter(([x, z]) => !inF(x, z)), palms: palms.filter(([x, z]) => !inF(x, z)) };
}
