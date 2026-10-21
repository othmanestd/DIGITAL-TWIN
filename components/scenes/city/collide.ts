// Outdoor solids for the walking character (world metres, y up, ground at y = 0, map north = −Z).
// The city (CityContent / district), the traffic furniture (bus shelters, signal poles) and the campus (hospital/Site)
// register their footprints here once built; the walk controller asks `blockedOutdoors` before moving.
//
// Contract (read by the walk-mode engineer):
//  · Every solid is an axis-aligned footprint in WORLD coordinates (not the campus frame): x0 < x1, z0 < z1, and h is
//    its height above the ground in metres. Yawed buildings (the Twin-Center-like towers) are pushed as their AABB.
//  · Sources: "city" (every building block of the procedural Casablanca, the mosque, park trees and palms near the
//    hospital), "district" (bus shelters, traffic-light poles, sign poles, the roundabout island palms) and "campus"
//    (hospital/Site: building outer walls, canopy posts, benches, trees, parked cars and ambulances).
//  · Hospital buildings: the MAIN building is pushed as four 0.5 m outer wall strips (world x −40…12, z −18…8, front
//    face = +z at z = 8), NOT as a full footprint, so its interior stays walkable. The front wall has two OPEN gaps:
//      – main entrance (Accueil):   world x −18.1 … −11.8 on z = 8 (under the AKDITAL canopy)
//      – emergency entrance (Urgences): world x 0.5 … 6.5 on z = 8 (under the URGENCES canopy)
//    Indoor partitions are NOT in this list (the walk controller owns indoor collisions).
//    The head-office ANNEX (world x 21…43, z −16…2) is one full solid (no public entrance in walk mode).
//  · The plinth, roads, lawns, kerbs (≤ 0.2 m) and the roundabout island kerb are below `step` and stay walkable.
//  · Moving vehicles are not solids; the traffic brakes for `frame.player` instead (see city/trafficSim.ts).
//  · Pushing directly into `outdoorSolids` still works: the spatial index rebuilds lazily when its length changes.
//    Prefer `registerSolids(source, list)`, which replaces a source's previous list (safe across re-mounts / HMR).
export type Solid = { x0: number; x1: number; z0: number; z1: number; h: number };
export const outdoorSolids: Solid[] = [];

const sources = new Map<string, Solid[]>();
/** Replace the solids of one source (e.g. "city", "campus") and mark the spatial index dirty. */
export function registerSolids(source: string, list: Solid[]) {
  sources.set(source, list);
  outdoorSolids.length = 0;
  for (const l of sources.values()) for (const s of l) outdoorSolids.push(s);
  indexed = -1;
}

// ---------------------------------------------------------------- uniform-grid spatial hash (CSR buckets)
const CELL = 8;                 // metres
const BITS = 16, MASK = (1 << BITS) - 1;
let start = new Int32Array(MASK + 2);
let items = new Int32Array(0);
let indexed = -1;               // outdoorSolids.length when the index was built (-1 = dirty)
const key = (ix: number, iz: number) => (Math.imul(ix, 73856093) ^ Math.imul(iz, 19349663)) & MASK;

function rebuild() {
  const n = outdoorSolids.length;
  const count = new Int32Array(MASK + 2);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const s = outdoorSolids[i];
    const ix0 = Math.floor(s.x0 / CELL), ix1 = Math.floor(s.x1 / CELL), iz0 = Math.floor(s.z0 / CELL), iz1 = Math.floor(s.z1 / CELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) { count[key(ix, iz) + 1]++; total++; }
  }
  for (let k = 1; k <= MASK + 1; k++) count[k] += count[k - 1];
  start = count.slice();
  items = new Int32Array(total);
  const fill = count; // reuse as write cursors
  for (let i = 0; i < n; i++) {
    const s = outdoorSolids[i];
    const ix0 = Math.floor(s.x0 / CELL), ix1 = Math.floor(s.x1 / CELL), iz0 = Math.floor(s.z0 / CELL), iz1 = Math.floor(s.z1 / CELL);
    for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) items[fill[key(ix, iz)]++] = i;
  }
  indexed = n;
}

/** true if a circle of radius r at (x, z) overlaps a solid taller than `step` metres. O(1): only the 1–4 grid cells
 *  under the circle are visited (hash collisions only add candidates, the exact box test decides). No allocation. */
export function blockedOutdoors(x: number, z: number, r: number, step = 0.35): boolean {
  if (indexed !== outdoorSolids.length) rebuild();
  const ix0 = Math.floor((x - r) / CELL), ix1 = Math.floor((x + r) / CELL), iz0 = Math.floor((z - r) / CELL), iz1 = Math.floor((z + r) / CELL);
  for (let ix = ix0; ix <= ix1; ix++) for (let iz = iz0; iz <= iz1; iz++) {
    const k = key(ix, iz);
    for (let j = start[k], e = start[k + 1]; j < e; j++) {
      const s = outdoorSolids[items[j]];
      if (s.h <= step) continue;
      if (x + r > s.x0 && x - r < s.x1 && z + r > s.z0 && z - r < s.z1) return true;
    }
  }
  return false;
}
