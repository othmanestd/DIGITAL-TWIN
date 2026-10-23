// The Casablanca Finance City district in the city plan (pure data, no three.js scene objects): its real streets as plan
// segments, and the greenery of Anfa Park, the Aeria palm grove, the gardens and the OSM tree rows as plan trees and palms,
// all in world metres. The buildings are drawn by landmarks/CfcDistrict. Source: landmarks/cfcData (OpenStreetMap).
import { CFC } from "./geography";
import { OSM_AREAS, OSM_BUILDINGS, OSM_PATHS, OSM_ROADS, OSM_TREES, OSM_TREE_ROWS, type OsmArea } from "./landmarks/cfcData";

/** local (district) → world */
export const cfcWorld = (x: number, z: number): [number, number] => [x + CFC.x, z + CFC.y];

/** point in a flat polygon [x0, z0, x1, z1, …] */
export function inPoly(p: number[], x: number, z: number) {
  let c = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
/** distance from a point to a flat polyline */
export function distLine(p: number[], x: number, z: number) {
  let d = 1e9;
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return d;
}

/** The streets of the district as plan segments (world): one per polyline edge; dual carriageways are two one-way lines. */
export function cfcRoadSegs() {
  const out: { x0: number; z0: number; x1: number; z1: number; w: number; c: number }[] = [];
  for (const r of OSM_ROADS) for (let i = 0; i + 3 < r.p.length; i += 2) {
    const [x0, z0] = cfcWorld(r.p[i], r.p[i + 1]), [x1, z1] = cfcWorld(r.p[i + 2], r.p[i + 3]);
    out.push({ x0, z0, x1, z1, w: r.w, c: r.w > 20 ? 1 : 0 });
  }
  return out;
}

const hash = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
const HARD = new Set(["water", "pool", "pitch", "play", "plaza", "sport", "parking", "site"]);

/** Trees and palms of the district (world): Anfa Park (young trees and palms over open lawns, clear of its alleys, pools and
 *  pitches), the Aeria palm grove, the gardens and lawns, the OSM tree rows (palms) and single trees. */
export function cfcGreenery() {
  const trees: [number, number, number][] = [], palms: [number, number][] = [];
  const hard = OSM_AREAS.filter((a) => HARD.has(a.k));
  const clear = (x: number, z: number, m: number) => {
    if (hard.some((a) => inPoly(a.p, x, z))) return false;
    if (OSM_BUILDINGS.some((b) => Math.abs(x - b.o[0]) < b.o[3] / 2 + b.o[4] / 2 + 3 && Math.abs(z - b.o[1]) < b.o[3] / 2 + b.o[4] / 2 + 3 && inPoly(b.p, x, z))) return false;
    if (OSM_ROADS.some((r) => distLine(r.p, x, z) < r.w / 2 + 4)) return false;
    return !OSM_PATHS.some((p) => distLine(p.p, x, z) < p.w / 2 + m);
  };
  const scatter = (a: OsmArea, step: number, keep: number, palmShare: number) => {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < a.p.length; i += 2) { x0 = Math.min(x0, a.p[i]); x1 = Math.max(x1, a.p[i]); z0 = Math.min(z0, a.p[i + 1]); z1 = Math.max(z1, a.p[i + 1]); }
    for (let x = x0 + step / 2; x < x1; x += step) for (let z = z0 + step / 2; z < z1; z += step) {
      const h = hash(x, z), px = x + (hash(z, x) - 0.5) * step * 0.8, pz = z + (h - 0.5) * step * 0.8;
      if (h > keep || !inPoly(a.p, px, pz) || !clear(px, pz, 1.6)) continue;
      const [wx, wz] = cfcWorld(px, pz);
      if (hash(px + 3, pz - 7) < palmShare) palms.push([wx, wz]); else trees.push([wx, wz, 0.75 + hash(pz, px + 1) * 0.6]);
    }
  };
  for (const a of OSM_AREAS) {
    if (a.k === "park" && a.name.startsWith("Aeria")) scatter(a, 9, 0.75, 1);
    else if (a.k === "park" && a.name.startsWith("Anfa Park")) scatter(a, 15, 0.42, 0.3);
    else if (a.k === "park" || a.k === "garden") scatter(a, 10, 0.55, 0.35);
    else if (a.k === "grass" || a.k === "scrub") scatter(a, 14, 0.22, 0.5);
  }
  for (const r of OSM_TREE_ROWS) for (let i = 0; i + 3 < r.length; i += 2) {
    const dx = r[i + 2] - r[i], dz = r[i + 3] - r[i + 1], L = Math.hypot(dx, dz);
    for (let t = 0; t < L; t += 10) palms.push(cfcWorld(r[i] + (dx * t) / L, r[i + 1] + (dz * t) / L));
  }
  for (const [x, z] of OSM_TREES) { const [wx, wz] = cfcWorld(x, z); trees.push([wx, wz, 1]); }
  return { trees, palms };
}
