// The procedural Casablanca plan (pure data, built once, no React / no rendering): street centrelines, blocks, parks,
// palms, the tram run, the business district, the mosque site, the coast, the district around the hospital and the
// traffic network. Shared by CityContent (rendering), the walk mode (colliders) and the landmarks (mosque, CFC towers,
// tram vehicles, sky, pedestrians) so everything lines up. World metres, x east, z south (map north = −Z), y up.
//
// The city has no circular edge: a density field (geography.ts) is high in the centre, along the coast and the main roads,
// and fades into suburbs, villages and fields. Each 120 m grid cell is built by its district: tight medina grain by the
// port, Art Deco perimeter blocks downtown, towers on the business axis, villas and gardens in Anfa, rows of R+2/R+3
// houses in the suburbs, sheds in the industrial east, a few douars in the countryside.
//
// Stable exports (please keep them): cityPlan(), Plan, Bx / Seg / Run, sea(), wiggle(), N / T / COAST, AVENUES, DOWNTOWN,
// TWIN, CFC, CFC_TOWERS (via cityPlan().cfc), MOSQUE, TRAM_TRACK, sidewalkWidth(), sidewalkCentrelines(), R_* constants.
import type { Net } from "./roads";
import type { Solid } from "./collide";
import {
  SUPER, RB, PLAZA_R, DISTRICT_ROADS, buildDistrictNet, districtBlocks, districtDecals, districtKerbs, districtMedians, cutDisc,
  type Bx, type DSeg as Seg, type Quad,
} from "./district";
import {
  N, T, COAST, wiggle, sea, AVENUES, DOWNTOWN, TWIN, CFC, rng, hash2, distToLine, density, zoneAt, inMedina, Z, type Zone,
  coastT, atCoast, LEAGUE, RACE, HANK, distRail, CORNICHE, beachWidth, RADIALS, RINGS, RC, distBoulevard, inAnfaPrime, inCfc, inMaarif, inAnfaZone,
} from "./geography";
import { cfcGreenery, cfcRoadSegs } from "./cfcDistrict";
import { zoneGreenery, zoneRoadSegs } from "./osmZonePlan";
import { MAARIF_ZONE } from "./maarifZone";
import { ANFA_ZONE } from "./anfaZone";
export type { Bx, Seg, Quad };
export { N, T, COAST, wiggle, sea, AVENUES, DOWNTOWN, TWIN, CFC, rng };
// ---------------------------------------------------------------- city plan constants
export const R_CITY = 7000;            // legacy radius (onLand); the built area now follows the density field
export const R_GROUND = 9000;          // legacy
export const R_FAR = 75000;            // ground extent (blends into the Morocco map, whose hole around Casablanca spans 30 … 75 km)
export const R_BUILT = 12500;          // the plan looks for cells to build within this distance
export const CELL = 120;               // street grid pitch
export const R_TRAFFIC = 1250;         // traffic network radius
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
/** El Hank lighthouse (world metres) */
export const LIGHTHOUSE = (() => { const [x, z] = atCoast(HANK.t, -55); return { x, z, h: 51 }; })();

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
const land = (x: number, z: number, margin: number) => sea(x, z) < -margin;
const nearRB = (x: number, z: number, m: number) => Math.hypot(x - RB.x, z - RB.z) < m;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** inside the Arab League park (+ margin) */
export const inLeague = (x: number, z: number, m = 0) => Math.abs(x - LEAGUE.x) < LEAGUE.w / 2 + m && Math.abs(z - LEAGUE.z) < LEAGUE.d / 2 + m;
/** inside the racetrack oval (+ margin) */
export function inRace(x: number, z: number, m = 0) {
  const c = Math.cos(RACE.yaw), s = Math.sin(RACE.yaw), dx = x - RACE.x, dz = z - RACE.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return (lx / (RACE.a + m)) ** 2 + (lz / (RACE.b + m)) ** 2 < 1;
}
/** inside the Twin Center lot (towers, podium, plaza: about 160 × 110 m around the pair, landmarks/TwinCenter) + margin */
export function inTwin(x: number, z: number, m = 0) {
  const cx = (TWIN[0][0] + TWIN[1][0]) / 2, cz = (TWIN[0][1] + TWIN[1][1]) / 2, dx = TWIN[1][0] - TWIN[0][0], dz = TWIN[1][1] - TWIN[0][1];
  const L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
  const lx = (x - cx) * ux + (z - cz) * uz, lz = -(x - cx) * uz + (z - cz) * ux;
  return Math.abs(lx) < 80 + m && Math.abs(lz) < 55 + m;
}
/** the esplanade on the land side of the mosque */
export const inEsplanade = (x: number, z: number) => { const t = coastT(x, z), n = -sea(x, z); return t > -620 && t < 90 && n < 430; };

// ---------------------------------------------------------------- plan generation (once)
export type Run = { x0: number; z0: number; x1: number; z1: number };
/** green tiled hip roof sitting on a building (base y, roof height h) */
export type Hip = { x: number; z: number; w: number; d: number; y: number; h: number; yaw: number };
export type Plan = {
  /** street centrelines (asphalt width w; d = district street; c = 2 rural road without pavements); grid = the grid streets only */
  segs: Seg[]; grid: Seg[];
  /** building blocks (box footprints, h = height); near = within ~420 m of the hospital (cast shadows) */
  boxes: Bx[]; near: Bx[]; signs: Bx[];
  /** legacy CFC signature towers and their crown signs (CityContent draws them while LEGACY_LANDMARKS is on) */
  cfc: Bx[]; cfcSigns: Bx[];
  parks: [number, number, number, number][];
  trees: [number, number, number][]; palms: [number, number][]; roundabouts: [number, number][];
  decals: Quad[];
  /** roof props: k 0 water tank, 1 AC unit, 2 satellite dish, 3 stair cabin, 4 laundry line, 5 black tank */
  roofs: { x: number; z: number; y: number; k: number; s: number }[];
  parked: Bx[]; tram: Run | null; poles: [number, number][]; streetTrees: [number, number][];
  net: Net; kerbs: ReturnType<typeof districtKerbs>; medians: ReturnType<typeof districtMedians>;
  /** villa pools, green tiled roofs, neighbourhood minarets (base centre, shaft side s, height h), paved plazas */
  pools: [number, number, number, number][]; hips: Hip[]; minarets: { x: number; z: number; s: number; h: number }[];
  plazas: [number, number, number, number][];
};

const PAL = { WHITE: 0, CREAM: 1, GREY: 2, SAND: 3, OCHRE: 4, SALMON: 5, GLASS: 6, METAL: 7, RAMPART: 8, PASTEL: 9 } as const;
const FLOOR = 3.1;
const floors = (h: number, f = FLOOR) => Math.max(1, Math.round((h - 0.9) / f)) * f + 0.9;

function makePlan(): Plan {
  const segs: Seg[] = [], grid: Seg[] = [], boxes: Bx[] = [], near: Bx[] = [], signs: Bx[] = [], cfc: Bx[] = [], cfcSigns: Bx[] = [];
  const parks: [number, number, number, number][] = [], trees: [number, number, number][] = [], palms: [number, number][] = [];
  const decals: Quad[] = [], roofs: Plan["roofs"] = [], parked: Bx[] = [], poles: [number, number][] = [], streetTrees: [number, number][] = [];
  const pools: Plan["pools"] = [], hips: Hip[] = [], minarets: Plan["minarets"] = [], plazas: Plan["plazas"] = [];
  const r = rng(20261020);
  const K = Math.ceil(R_BUILT / CELL) + 1;
  const line = (k: number) => k * CELL + CELL / 2;           // grid line coordinate
  const width = (k: number) => (((k % 6) + 6) % 6 === 0 ? 30 : 12); // boulevards every 6th line
  // roundabouts at avenue crossings + two boulevard crossings
  const rbs: [number, number][] = [];
  for (let i = 0; i < AVENUES.length; i++) for (let j = i + 1; j < AVENUES.length; j++) {
    const p = intersect(AVENUES[i], AVENUES[j]);
    if (p && onLand(p[0], p[1], 200) && Math.hypot(p[0], p[1]) < 5000) rbs.push(p);
  }
  rbs.push([line(5), line(-7)], [line(-12), line(5)]);

  const nearRb = (x: number, z: number, m: number) => rbs.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < m);
  const blocked = (x: number, z: number) => inLeague(x, z, 4) || inRace(x, z, 26) || inEsplanade(x, z) || Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 95 || inAnfaPrime(x, z, 4) || inTwin(x, z, 4) || inCfc(x, z, -1) || inMaarif(x, z, -1) || inAnfaZone(x, z, -1);
  /** a grid street exists between two nodes: on land, dense enough (boulevards reach further out), not through the medina / parks */
  const streetOn = (x0: number, z0: number, x1: number, z1: number, w: number) => {
    if (!land(x0, z0, 110) || !land(x1, z1, 110)) return false;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (Math.hypot(mx, mz) < 1500) return true; // the whole centre around the hospital stays connected (traffic, pedestrians)
    if (inLeague(mx, mz, 2) || inRace(mx, mz, 10) || inEsplanade(mx, mz)) return false;
    const d = density(mx, mz);
    if (w > 20) return d > 0.13;
    if (inMedina(mx, mz)) return false;
    const hs = hash2(Math.round(mx), Math.round(mz));
    if (Math.hypot(mx, mz) > 1700 && d > 0.45 && hash2(Math.round(mz), Math.round(mx)) < 0.14) return false; // merged blocks (lanes only)
    return d > 0.2 + 0.12 * hs;
  };

  // grid streets (one segment per cell edge; the superblock interior belongs to the district)
  for (let a = -K; a <= K; a++) {
    for (let b = -K; b < K; b++) {
      const c = line(a), s0 = line(b), s1 = line(b + 1);
      for (const vertical of [true, false]) {
        const [x0, z0, x1, z1] = vertical ? [c, s0, c, s1] : [s0, c, s1, c];
        if (inSuper((x0 + x1) / 2, (z0 + z1) / 2, 1)) continue;
        if (inCfc((x0 + x1) / 2, (z0 + z1) / 2, -2)) continue; // the CFC district has its real streets (below)
        if (inMaarif((x0 + x1) / 2, (z0 + z1) / 2, -2) && !(z0 === TRAM.z && z1 === TRAM.z)) continue; // Maârif too, but the tram boulevard stays
        if (inAnfaZone((x0 + x1) / 2, (z0 + z1) / 2, -2)) continue; // and around Anfa Prime
        const w = width(a);
        if (!streetOn(x0, z0, x1, z1, w)) continue;
        // out in the loose edge of the city the streets lose their pavements (dusty lanes)
        const lowD = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2) > 1500 && density((x0 + x1) / 2, (z0 + z1) / 2) < 0.36;
        const sg = { x0, z0, x1, z1, w, c: lowD ? 2 : w > 20 ? 1 : 0 };
        segs.push(sg); grid.push(sg);
      }
    }
  }
  // the real streets of the Casablanca Finance City district (OpenStreetMap, see cfcDistrict.ts)
  for (const s of cfcRoadSegs()) segs.push(s);
  // … and of the Maârif pilot district around the Twin Center (osmZonePlan.ts)
  for (const s of zoneRoadSegs(MAARIF_ZONE)) segs.push(s);
  // … and around Anfa Prime (boulevard Ghandi, boulevard Abdelkrim El Khattabi, the Anfa villas)
  for (const s of zoneRoadSegs(ANFA_ZONE)) segs.push(s);
  // district streets around the hospital (front boulevard, back street, side streets, hospital axis)
  for (const d of DISTRICT_ROADS) segs.push({ x0: d.x0, z0: d.z0, x1: d.x1, z1: d.z1, w: d.w, c: d.w > 20 ? 1 : 0, d: true });
  // avenues (long diagonals, cut into 120 m pieces so they clip to land); out in the plain they become country roads
  for (const av of [...AVENUES, ...RADIALS]) {
    const dx = Math.cos(av.a), dz = Math.sin(av.a);
    for (let t = -16000; t < 16000; t += 120) {
      const x0 = av.p[0] + dx * t, z0 = av.p[1] + dz * t, x1 = x0 + dx * 120, z1 = z0 + dz * 120;
      if (!land(x0, z0, 110) || !land(x1, z1, 110) || boxNearSuper(x0, z0, x1, z1, 20)) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (inLeague(mx, mz, 30) || inRace(mx, mz, 30) || inCfc(mx, mz, -2) || inMaarif(mx, mz, -2) || inAnfaZone(mx, mz, -2)) continue;
      const d = density(mx, mz);
      segs.push(d > 0.16 ? { x0, z0, x1, z1, w: 34, c: 1 } : { x0, z0, x1, z1, w: 10, c: 2 });
    }
  }
  // ring boulevards around the old centre (arcs on land)
  for (const R of RINGS) {
    const n = Math.ceil((2 * Math.PI * R) / 110);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const x0 = RC.x + Math.cos(a0) * R, z0 = RC.z + Math.sin(a0) * R, x1 = RC.x + Math.cos(a1) * R, z1 = RC.z + Math.sin(a1) * R;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (!land(x0, z0, 110) || !land(x1, z1, 110) || boxNearSuper(x0, z0, x1, z1, 20) || inLeague(mx, mz, 30) || inRace(mx, mz, 30) || inCfc(mx, mz, -2) || inMaarif(mx, mz, -2) || inAnfaZone(mx, mz, -2)) continue;
      const d = density(mx, mz);
      if (d < 0.1) continue;
      segs.push({ x0, z0, x1, z1, w: 32, c: 1 });
    }
  }
  // corniche along the coast (a coastal road all the way)
  let prev: [number, number] | null = null;
  for (let t = -14000; t <= 14000; t += 90) {
    const base = COAST + wiggle(t) - 95;
    const x = N.x * base + T.x * t, z = N.y * base + T.y * t;
    if (prev) {
      const d = density(x, z);
      segs.push(d > 0.12 || (t > CORNICHE.t0 && t < 4500) ? { x0: prev[0], z0: prev[1], x1: x, z1: z, w: 28, c: 1 } : { x0: prev[0], z0: prev[1], x1: x, z1: z, w: 11, c: 2 });
    }
    prev = [x, z];
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

  // ---------------------------------------------------------------- buildings by district
  const railClear = (b: Bx) => distRail(b.x, b.z) > 22 + Math.max(b.w, b.d) / 2;
  /** clear of the avenues, radial and ring boulevards (34 m + pavements) */
  const roadClear = (b: Bx) => distBoulevard(b.x, b.z) > 21 + Math.hypot(b.w, b.d) / 2;
  /** clear of the corniche (road + pavement end 114 m inland of the coastline) */
  const shoreClear = (b: Bx) => { const hw = b.w / 2, hd = b.d / 2; return sea(b.x - hw, b.z - hd) < -118 && sea(b.x + hw, b.z - hd) < -118 && sea(b.x - hw, b.z + hd) < -118 && sea(b.x + hw, b.z + hd) < -118; };
  const add = (b: Bx, dist: number) => {
    if (!railClear(b) || !shoreClear(b) || !roadClear(b)) return;
    const c = dist < 260 ? cutDisc(b, RB.x, RB.z, PLAZA_R) : b;
    if (c) (dist < 420 ? near : boxes).push(c);
  };
  const pick = <V,>(list: readonly V[]) => list[Math.floor(r() * list.length) % list.length];
  const palOf = (zone: Zone) => {
    const q = r();
    switch (zone) {
      case Z.DOWNTOWN: return q < 0.5 ? PAL.WHITE : q < 0.86 ? PAL.CREAM : q < 0.95 ? PAL.GREY : PAL.PASTEL;
      case Z.MEDINA: return q < 0.62 ? PAL.WHITE : q < 0.8 ? PAL.CREAM : q < 0.92 ? PAL.SAND : PAL.OCHRE;
      case Z.ANFA: return q < 0.75 ? PAL.WHITE : q < 0.93 ? PAL.CREAM : PAL.PASTEL;
      case Z.SUBURB: return q < 0.18 ? PAL.WHITE : q < 0.32 ? PAL.CREAM : q < 0.58 ? PAL.SAND : q < 0.76 ? PAL.OCHRE : q < 0.94 ? PAL.SALMON : PAL.PASTEL;
      case Z.RURAL: return q < 0.4 ? PAL.WHITE : q < 0.7 ? PAL.SAND : PAL.OCHRE;
      default: return q < 0.42 ? PAL.WHITE : q < 0.7 ? PAL.CREAM : q < 0.82 ? PAL.GREY : q < 0.9 ? PAL.SAND : q < 0.96 ? PAL.SALMON : PAL.PASTEL;
    }
  };
  /** one side of a perimeter block, split into buildings of 12 … 30 m frontage (longer further out), heights per building */
  const strip = (x0: number, z0: number, x1: number, z1: number, along: "x" | "z", H: number, dist: number, zone: Zone, style: () => number, segLen: number) => {
    const L = along === "x" ? x1 - x0 : z1 - z0;
    if (L < 6) return;
    let p = 0;
    while (p < L - 0.5) {
      let s = segLen * (0.55 + r() * 0.9);
      if (L - p - s < segLen * 0.45) s = L - p;
      const h = floors(H * (0.8 + r() * 0.45));
      const b: Bx = along === "x"
        ? { x: x0 + p + s / 2, z: (z0 + z1) / 2, w: s - 0.15, d: z1 - z0, h, yaw: 0, c: r(), win: style(), pal: palOf(zone) }
        : { x: (x0 + x1) / 2, z: z0 + p + s / 2, w: x1 - x0, d: s - 0.15, h, yaw: 0, c: r(), win: style(), pal: palOf(zone) };
      add(b, dist);
      p += s;
    }
  };
  const perimeter = (xa: number, za: number, xb: number, zb: number, dep: number, H: number, dist: number, zone: Zone, style: () => number) => {
    const seg = dist < 2500 ? 18 : dist < 5000 ? 30 : 60;
    strip(xa, za, xb, za + dep, "x", H, dist, zone, style, seg);
    strip(xa, zb - dep, xb, zb, "x", H, dist, zone, style, seg);
    strip(xa, za + dep, xa + dep, zb - dep, "z", H, dist, zone, style, seg);
    strip(xb - dep, za + dep, xb, zb - dep, "z", H, dist, zone, style, seg);
  };
  /** recursive split of a rectangle into medina plots, with a few lanes */
  const medina = (x0: number, z0: number, x1: number, z1: number, depth: number, dist: number) => {
    const w = x1 - x0, d = z1 - z0;
    if (w < 4 || d < 4) return;
    if ((w < 15 && d < 15) || depth > 7) {
      if (r() < 0.08) return; // a riad courtyard / tiny square
      const h = floors(5.5 + r() * 7.5, 3.0);
      add({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: w - 0.1, d: d - 0.1, h, yaw: 0, c: r(), win: 4, pal: palOf(Z.MEDINA), shop: r() < 0.3 ? 1 : 0 }, dist);
      return;
    }
    const alongX = w > d ? true : w < d ? false : r() < 0.5;
    const k = 0.32 + r() * 0.36, lane = depth < 3 && r() < 0.6 ? 3 + r() * 2 : depth < 5 && r() < 0.25 ? 2.2 : 0;
    if (alongX) { const m = x0 + w * k; medina(x0, z0, m - lane / 2, z1, depth + 1, dist); medina(m + lane / 2, z0, x1, z1, depth + 1, dist); }
    else { const m = z0 + d * k; medina(x0, z0, x1, m - lane / 2, depth + 1, dist); medina(x0, m + lane / 2, x1, z1, depth + 1, dist); }
  };
  const mosqueAt = (x: number, z: number, dist: number, s: number) => {
    const hw = 30, hd = 22;
    add({ x, z, w: hw, d: hd, h: 8.5, yaw: 0, c: r() * 0.4, win: 4, pal: PAL.WHITE }, dist);
    hips.push({ x, z, w: hw - 1, d: hd - 1, y: 8.5, h: 3.2, yaw: 0 });
    const mx = x - hw / 2 + s / 2 + 1, mz = z - hd / 2 - s / 2 - 1;
    minarets.push({ x: mx, z: mz, s, h: 20 + s * 2.4 + r() * 6 });
  };

  // blocks
  const medinaCells: [number, number][] = [];
  for (let i = -K; i < K; i++) for (let j = -K; j < K; j++) {
    const xa = line(i) + width(i) / 2 + 3, xb = line(i + 1) - width(i + 1) / 2 - 3;
    const za = line(j) + width(j) / 2 + 3, zb = line(j + 1) - width(j + 1) / 2 - 3;
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, bw = xb - xa, bd = zb - za;
    const dist = Math.hypot(cx, cz);
    if (dist > R_BUILT || !land(cx, cz, 70)) continue;
    if (inSuper(cx, cz)) continue; // the district builds the superblock
    if (blocked(cx, cz)) continue;
    const dens = density(cx, cz);
    if (dens < 0.012) continue;
    const zone = zoneAt(cx, cz, dens);
    if (nearRb(cx, cz, 95)) continue;
    const h0 = hash2(i, j), h1 = hash2(i + 7, j - 3);
    // the edge of the city: cells thin out stochastically as the density falls
    if (zone === Z.RURAL || dens < 0.08 + 0.3 * h1) {
      // a douar (hamlet) now and then in the fields
      if (dens > 0.02 && h0 < 0.05 + dens * 0.6) {
        const n = 3 + Math.floor(r() * 5), ox = cx + (r() - 0.5) * 40, oz = cz + (r() - 0.5) * 40;
        for (let k = 0; k < n; k++) add({ x: ox + (r() - 0.5) * 46, z: oz + (r() - 0.5) * 46, w: 6 + r() * 6, d: 6 + r() * 6, h: 3.4 + r() * 3, yaw: 0, c: r(), win: 4, pal: palOf(Z.RURAL) }, dist);
        for (let k = 0; k < 4; k++) trees.push([ox + (r() - 0.5) * 70, oz + (r() - 0.5) * 70, 0.6 + r() * 0.4]);
      }
      continue;
    }
    // parks (fewer in the dense centre)
    const cfcNear = Math.hypot(cx - CFC.x, cz - CFC.y) < 560; // keep the CFC lots exactly as the landmarks expect them
    if (zone !== Z.MEDINA && (h0 < (cfcNear ? 0.055 : 0.02) || (dist < 520 && h0 < 0.2))) {
      parks.push([cx, cz, bw, bd]);
      const nt = dist < 2500 ? 14 : 6;
      for (let t = 0; t < nt; t++) { const x = xa + r() * bw, z = za + r() * bd; if (!nearRB(x, z, PLAZA_R + 3) && distBoulevard(x, z) > 22) trees.push([x, z, 0.8 + r() * 0.6]); }
      continue;
    }
    // parking lots with painted bays (a few, within 4 km)
    if (dist < 2600 && dist > 300 && h0 >= 0.055 && h0 < 0.07 && zone !== Z.MEDINA && distBoulevard(cx, cz) > 80) {
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
    const nearK = Math.min(1, Math.max(0.35, (dist - 250) / 700));            // keep it low around the hospital
    const hk = 0.45 + 0.55 * smooth(0.12, 0.8, dens);
    // a neighbourhood mosque with its minaret, now and then
    const mosqueCell = dist > 450 && (zone === Z.CORE || zone === Z.SUBURB || zone === Z.DOWNTOWN) && hash2(i + 31, j - 17) < 0.011;
    if (zone === Z.MEDINA) { medinaCells.push([i, j]); continue; }
    if (mosqueCell) {
      mosqueAt(cx, cz, dist, 4.6 + r() * 1.6);
      const H = floors((10 + r() * 6) * hk * nearK);
      strip(xa, za, xb, za + 13, "x", H, dist, zone, () => (r() < 0.5 ? 0 : 1), 16);
      strip(xa, zb - 13, xb, zb, "x", H, dist, zone, () => (r() < 0.5 ? 0 : 1), 16);
      continue;
    }
    switch (zone) {
      case Z.DOWNTOWN: {
        const H = (17 + r() * 8 + (dens > 0.9 ? 4 : 0)) * nearK;
        const st = () => { const q = r(); return q < 0.6 ? 3 : q < 0.85 ? 1 : 0; };
        if (h0 > 0.08 && h0 < 0.1) {
          // a public building with a green tiled roof (wilaya, post office, courthouse ...)
          const w = Math.min(bw - 16, 56), d = Math.min(bd - 16, 40), h = floors(13 + r() * 3, 3.6);
          add({ x: cx, z: cz, w, d, h, yaw: 0, c: r(), win: 3, pal: PAL.CREAM, shop: 0 }, dist);
          hips.push({ x: cx, z: cz, w: w - 1, d: d - 1, y: h, h: 4.2, yaw: 0 });
          for (let k = 0; k < 8; k++) palms.push([xa + 4 + r() * (bw - 8), k < 4 ? za + 3 : zb - 3]);
          break;
        }
        perimeter(xa, za, xb, zb, 17, H, dist, zone, st);
        if (r() < 0.15) { for (let k = 0; k < 3; k++) trees.push([cx + (r() - 0.5) * (bw - 44), cz + (r() - 0.5) * (bd - 44), 0.7 + r() * 0.4]); }
        else { const iw = bw - 34 - 8 * r(), id = bd - 34 - 8 * r(), sx = r() < 0.5; add({ x: cx - (sx ? iw / 4 + 1.5 : 0), z: cz - (sx ? 0 : id / 4 + 1.5), w: sx ? iw / 2 - 3 : iw, d: sx ? id : id / 2 - 3, h: floors(9 + r() * 9), yaw: 0, c: r(), win: 0, pal: palOf(zone) }, dist); add({ x: cx + (sx ? iw / 4 + 1.5 : 0), z: cz + (sx ? 0 : id / 4 + 1.5), w: sx ? iw / 2 - 3 : iw, d: sx ? id : id / 2 - 3, h: floors(6 + r() * 9), yaw: 0, c: r(), win: 1, pal: palOf(zone) }, dist); }
        break;
      }
      case Z.BUSINESS: {
        const n = r() < 0.55 ? 1 : 0;
        if (n === 0 || r() < 0.5) add({ x: cx, z: cz, w: bw - 14, d: bd - 14, h: floors(n ? 9 + r() * 4 : 18 + r() * 14, 3.6), yaw: 0, c: r(), win: r() < 0.5 ? 2 : 7, pal: r() < 0.6 ? PAL.WHITE : PAL.GLASS, shop: 1 }, dist);
        for (let k = 0; k < n; k++) {
          const w = 22 + r() * 14, d = 20 + r() * 14;
          const x = xa + w / 2 + 4 + r() * Math.max(0, bw - w - 8), z = za + d / 2 + 4 + r() * Math.max(0, bd - d - 8);
          const glass = r() < 0.7;
          add({ x, z, w, d, h: floors(36 + r() * 46, 3.6), yaw: 0, c: r(), win: glass ? 7 : 2, pal: glass ? PAL.GLASS : PAL.WHITE }, dist);
        }
        break;
      }
      case Z.ANFA: {
        // villas in gardens: 2 × 3 plots, each a white villa, a pool, trees
        const nx = 2, nz = 3, pw = bw / nx, pd = bd / nz;
        for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
          const px0 = xa + a * pw, pz0 = za + b * pd;
          if (r() < 0.08) { for (let k = 0; k < 4; k++) trees.push([px0 + r() * pw, pz0 + r() * pd, 0.9 + r() * 0.5]); continue; }
          const w = 11 + r() * 8, d = 9 + r() * 6, vx = px0 + 3 + w / 2 + r() * Math.max(0, pw - w - 6), vz = pz0 + 3 + d / 2 + r() * Math.max(0, pd - d - 14);
          add({ x: vx, z: vz, w, d, h: r() < 0.25 ? 4 : 7.2, yaw: 0, c: r(), win: 5, pal: palOf(Z.ANFA) }, dist);
          if (r() < 0.6) { const ow = 4 + r() * 4, od = 3 + r() * 2.5; pools.push([Math.min(px0 + pw - ow / 2 - 2, vx + (r() - 0.5) * 4), Math.min(pz0 + pd - od / 2 - 2, vz + d / 2 + 2.5 + od / 2), ow, od]); }
          for (let k = 0; k < 4; k++) trees.push([px0 + 2 + r() * (pw - 4), pz0 + 2 + r() * (pd - 4), 0.7 + r() * 0.6]);
          if (r() < 0.5) palms.push([px0 + 3 + r() * (pw - 6), pz0 + 3 + r() * (pd - 6)]);
        }
        break;
      }
      case Z.INDUSTRY: {
        const n = 1 + Math.floor(r() * 3);
        for (let k = 0; k < n; k++) {
          const w = Math.min(bw - 6, 34 + r() * 50), d = Math.min(bd - 6, 26 + r() * 40);
          add({ x: xa + w / 2 + 3 + r() * Math.max(0, bw - w - 6), z: za + d / 2 + 3 + r() * Math.max(0, bd - d - 6), w, d, h: 7 + r() * 7 * hk, yaw: 0, c: r(), win: 6, pal: PAL.METAL }, dist);
        }
        break;
      }
      case Z.SUBURB: {
        if (dens < 0.32) {
          // loose edge of the city: a few houses and their yards
          const n = 2 + Math.floor(r() * 4);
          for (let k = 0; k < n; k++) {
            const w = 9 + r() * 9, d = 8 + r() * 8;
            add({ x: xa + w / 2 + r() * Math.max(0, bw - w), z: za + d / 2 + r() * Math.max(0, bd - d), w, d, h: floors(4 + r() * 5 * hk), yaw: 0, c: r(), win: r() < 0.5 ? 0 : 4, pal: palOf(zone) }, dist);
          }
          if (r() < 0.5) trees.push([cx + (r() - 0.5) * bw, cz + (r() - 0.5) * bd, 0.7 + r() * 0.4]);
          break;
        }
        if (r() < 0.16) {
          // social housing: 4 … 5-storey slabs around a yard
          const H = floors(14 + r() * 3);
          add({ x: cx, z: za + 7, w: bw - 4, d: 13, h: H, yaw: 0, c: r(), win: 1, pal: palOf(zone) }, dist);
          add({ x: cx, z: zb - 7, w: bw - 4, d: 13, h: H, yaw: 0, c: r(), win: 1, pal: palOf(zone) }, dist);
          if (r() < 0.6) add({ x: xa + 7, z: cz, w: 13, d: bd - 34, h: H, yaw: 0, c: r(), win: 1, pal: palOf(zone) }, dist);
          break;
        }
        // rows of R+2 / R+3 houses, back to back, with lanes between the rows
        const H = floors((8.5 + r() * 4.5) * (0.7 + 0.3 * hk) * nearK);
        const rowsZ = bd > 80 ? 3 : 2, lane = 7, sub = (bd - lane * (rowsZ - 1)) / rowsZ;
        for (let q = 0; q < rowsZ; q++) {
          const z0 = za + q * (sub + lane), z1 = z0 + sub;
          const twin = sub > 20;
          for (const [s0, s1] of twin ? [[z0, (z0 + z1) / 2], [(z0 + z1) / 2, z1]] : [[z0, z1]]) {
            const cut = r() < 0.5 ? xa + bw * (0.35 + r() * 0.3) : xb;
            add({ x: (xa + cut) / 2, z: (s0 + s1) / 2, w: cut - xa, d: s1 - s0 - 0.2, h: H, yaw: 0, c: r(), win: r() < 0.55 ? 0 : 1, pal: palOf(zone) }, dist);
            if (cut < xb - 1) add({ x: (cut + xb) / 2, z: (s0 + s1) / 2, w: xb - cut, d: s1 - s0 - 0.2, h: floors(H + (r() < 0.5 ? -FLOOR : FLOOR)), yaw: 0, c: r(), win: r() < 0.55 ? 0 : 1, pal: palOf(zone) }, dist);
          }
        }
        break;
      }
      default: {
        // the core (Maarif / Gauthier / Racine): perimeter blocks and modern slabs, 5 … 8 floors
        const modern = r() < 0.36;
        if (!modern) {
          const H = (14 + r() * 9 + dens * 4) * nearK * hk;
          perimeter(xa, za, xb, zb, 16, H, dist, zone, () => { const q = r(); return q < 0.45 ? 1 : q < 0.75 ? 0 : 3; });
          if (r() < 0.25) { for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) trees.push([cx + (r() - 0.5) * (bw - 42), cz + (r() - 0.5) * (bd - 42), 0.7 + r() * 0.4]); }
          else if (r() < 0.9) { const iw = (bw - 38) * (0.7 + r() * 0.3), id = (bd - 38) * (0.7 + r() * 0.3); add({ x: cx + (r() - 0.5) * (bw - 38 - iw), z: cz + (r() - 0.5) * (bd - 38 - id), w: iw, d: id, h: floors(4 + r() * 6), yaw: 0, c: r(), win: r() < 0.5 ? 0 : 1, pal: palOf(zone) }, dist); }
        } else {
          const n = 1 + Math.floor(r() * 3);
          for (let k = 0; k < n; k++) {
            const w = 18 + r() * Math.min(40, bw - 20), d = 16 + r() * Math.min(36, bd - 20);
            const x = xa + w / 2 + r() * Math.max(0, bw - w), z = za + d / 2 + r() * Math.max(0, bd - d);
            const h = floors((16 + r() * 22 + dens * 10) * nearK * hk);
            add({ x, z, w, d, h, yaw: 0, c: r(), win: h > 26 && r() < 0.5 ? 2 : r() < 0.6 ? 1 : 0, pal: palOf(zone) }, dist);
            if (h > 26 && r() < 0.07) signs.push({ x, z, w: Math.min(w * 0.6, 14), d: 0.6, h: h + 1.6, yaw: 0, c: 0 });
          }
        }
      }
    }
  }
  // the medina: whole cells (small grid streets dropped), split into tight plots with lanes, a few mosques
  medinaCells.forEach(([i, j], q) => {
    const bi = width(i) > 20, bi1 = width(i + 1) > 20, bj = width(j) > 20, bj1 = width(j + 1) > 20;
    const x0 = line(i) + (bi ? 18 : 2), x1 = line(i + 1) - (bi1 ? 18 : 2), z0 = line(j) + (bj ? 18 : 2), z1 = line(j + 1) - (bj1 ? 18 : 2);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, dist = Math.hypot(cx, cz);
    // keep clear of the streets that still run along the cell (outside the medina)
    const sx0 = streetOn(line(i), line(j), line(i), line(j + 1), width(i)) ? Math.max(x0, line(i) + width(i) / 2 + 3) : x0;
    const sx1 = streetOn(line(i + 1), line(j), line(i + 1), line(j + 1), width(i + 1)) ? Math.min(x1, line(i + 1) - width(i + 1) / 2 - 3) : x1;
    const sz0 = streetOn(line(i), line(j), line(i + 1), line(j), width(j)) ? Math.max(z0, line(j) + width(j) / 2 + 3) : z0;
    const sz1 = streetOn(line(i), line(j + 1), line(i + 1), line(j + 1), width(j + 1)) ? Math.min(z1, line(j + 1) - width(j + 1) / 2 - 3) : z1;
    if (q % 11 === 5) { mosqueAt(cx, cz, dist, 5 + r()); medina(sx0, sz0, sx1, cz - 16, 2, dist); medina(sx0, cz + 16, sx1, sz1, 2, dist); return; }
    medina(sx0, sz0, sx1, sz1, 0, dist);
  });
  // the district: blocks, garden, palms
  const D = districtBlocks();
  near.push(...D.blocks); parks.push(...D.parks); trees.push(...D.trees); palms.push(...D.palms);
  // façade styles: shop band at street level facing the boulevards (and some on the streets), awnings
  const boulevardEdge = (v: number) => { const k = Math.round((v - CELL / 2) / (CELL * 6)); return Math.abs(Math.abs(v - (k * CELL * 6 + CELL / 2)) - 15); };
  for (const b of [...boxes, ...near]) {
    const dist = Math.hypot(b.x, b.z);
    const faces = Math.min(boulevardEdge(b.x - b.w / 2), boulevardEdge(b.x + b.w / 2), boulevardEdge(b.z - b.d / 2), boulevardEdge(b.z + b.d / 2));
    const main = faces < 4.5 && dist < 6000;
    const st = b.win ?? 0;
    if (b.shop === undefined) b.shop = b.h > 5.5 && st !== 5 && st !== 6 && st !== 7 && (main ? r() < 0.9 : r() < (dist < 2500 ? 0.35 : 0.12)) ? 1 : 0;
    b.acc = b.shop && r() < 0.8 ? 1 + Math.floor(r() * 6) : 0;
    b.win = b.win ?? (b.h > 26 && r() < 0.5 ? 2 : r() < 0.55 ? 1 : 0);
    b.pal = b.pal ?? (r() < 0.45 ? PAL.WHITE : r() < 0.6 ? PAL.CREAM : r() < 0.5 ? PAL.SAND : PAL.GREY);
    b.warm = false;
  }
  // roof props (stair cabins, water tanks, AC units, satellite dishes, laundry): in 3D near the hospital and in the old
  // centre; the roof shader paints them as dots further out
  for (const b of [...boxes, ...near]) {
    const dist = Math.hypot(b.x, b.z), st = b.win ?? 0;
    if (b.h < 3 || st === 6 || st === 7 || st === 8) continue;
    const close = dist < 1900;
    if (!close && dist > 3200) continue;
    const big = Math.max(b.w, b.d) > 45 ? 2 : 0;
    // one stair cabin per building (two on long ones)
    const nc = (Math.max(b.w, b.d) > 40 ? 2 : 1) * (b.w * b.d > 60 ? 1 : 0);
    for (let k = 0; k < nc; k++) roofs.push({ x: b.x + (r() - 0.5) * Math.max(0, b.w - 4), z: b.z + (r() - 0.5) * Math.max(0, b.d - 4), y: b.h, k: 3, s: 0.9 + r() * 0.3 });
    if (!close) continue;
    const n = 1 + Math.floor(r() * 3) + big;
    for (let k = 0; k < n; k++) {
      const q = r(), kind = q < 0.22 ? 0 : q < 0.36 ? 5 : q < 0.52 ? 1 : 2;
      roofs.push({ x: b.x + (r() - 0.5) * b.w * 0.8, z: b.z + (r() - 0.5) * b.d * 0.8, y: b.h, k: kind, s: 0.8 + r() * 0.5 });
    }
    if (r() < 0.18 && b.w > 8 && b.d > 8) roofs.push({ x: b.x + (r() - 0.5) * (b.w - 6), z: b.z + (r() - 0.5) * (b.d - 6), y: b.h, k: 4, s: 0.8 + r() * 0.4 });
  }
  // landmarks: the Twin Center is drawn by landmarks/TwinCenter (its lot is kept clear, see `blocked`); a business district cluster
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, rr = 40 + k * 22;
    const x = CFC.x + Math.cos(a) * rr, z = CFC.y + Math.sin(a) * rr;
    const t: Bx = { x, z, w: 26 + r() * 14, d: 24 + r() * 12, h: 60 + r() * 50, yaw: 0, c: 0.3, win: 2 };
    cfc.push(t);
    if (k % 3 === 0) cfcSigns.push({ x, z, w: 14, d: 0.6, h: t.h + 1.6, yaw: 0, c: 1 });
  }
  // the Arab League park: a dense grove of ficus and palms on a grid of alleys
  parks.push([LEAGUE.x, LEAGUE.z, LEAGUE.w, LEAGUE.d]);
  for (let x = LEAGUE.x - LEAGUE.w / 2 + 6; x <= LEAGUE.x + LEAGUE.w / 2 - 6; x += 8) for (let z = LEAGUE.z - LEAGUE.d / 2 + 6; z <= LEAGUE.z + LEAGUE.d / 2 - 6; z += 8) {
    const onAlley = Math.abs(((x - LEAGUE.x) % 50 + 50) % 50 - 25) < 4 || Math.abs(((z - LEAGUE.z) % 60 + 60) % 60 - 30) < 4;
    if (onAlley) continue;
    if (r() < 0.72) trees.push([x + (r() - 0.5) * 5, z + (r() - 0.5) * 5, 0.9 + r() * 0.6]);
  }
  for (let z = LEAGUE.z - LEAGUE.d / 2 + 10; z < LEAGUE.z + LEAGUE.d / 2 - 6; z += 16) palms.push([LEAGUE.x - 3, z], [LEAGUE.x + 3, z]);
  // the racetrack: trees around the oval
  for (let k = 0; k < 120; k++) {
    const a = (k / 120) * Math.PI * 2, m = 22 + r() * 18, lx = Math.cos(a) * (RACE.a + m), lz = Math.sin(a) * (RACE.b + m);
    const c = Math.cos(-RACE.yaw), s = Math.sin(-RACE.yaw);
    trees.push([RACE.x + lx * c - lz * s, RACE.z + lx * s + lz * c, 0.9 + r() * 0.5]);
  }
  // the mosque esplanade (paved, palm-lined)
  {
    const [ex, ez] = atCoast(-265, -215);
    plazas.push([ex, ez, 190, 300]);
    for (let k = 0; k < 40; k++) { const [px, pz] = atCoast(-560 + k * 15, -360); palms.push([px, pz]); }
  }
  // corniche promenade palms (sea side of the coastal road) where the beaches are
  for (let t = CORNICHE.t0; t < 600; t += 17) {
    if (t > -650 && t < 120) continue; // the mosque
    const bw = beachWidth(t), [x, z] = atCoast(t, -95 + 14 + 3.5);
    if (bw > 20 || t > -1650) palms.push([x, z]);
  }
  for (const b of boxes) if (b.h > 100) b.win = 7;

  // boulevards: dashed centre lines, palms, street trees
  const tramZ = line(6);
  for (const sg of segs) {
    if (sg.w < 20 || sg.w > 34 || sg.d) continue;
    const L = Math.hypot(sg.x1 - sg.x0, sg.z1 - sg.z0), mx = (sg.x0 + sg.x1) / 2, mz = (sg.z0 + sg.z1) / 2;
    const dist = Math.hypot(mx, mz);
    const ux = (sg.x1 - sg.x0) / (L || 1), uz = (sg.z1 - sg.z0) / (L || 1);
    const isTram = Math.abs(sg.z0 - tramZ) < 0.1 && Math.abs(sg.z1 - tramZ) < 0.1;
    const dens = density(mx, mz);
    if (dist < 4500 && !isTram && sg.w <= 30) for (let t = 1.5; t < L - 1.5; t += 9) {
      const x = sg.x0 + ux * t, z = sg.z0 + uz * t;
      if (nearRB(x, z, RB.outer + 6)) continue;
      decals.push({ x0: x, z0: z, x1: sg.x0 + ux * (t + 3), z1: sg.z0 + uz * (t + 3), w: 0.22, y: 0.09, c: 0 });
    }
    // the big boulevards (avenues, radials, rings): a planted median with a row of palms
    if (sg.w >= 32 && sg.c === 1 && dens > 0.3 && dist < 6500) {
      decals.push({ x0: sg.x0, z0: sg.z0, x1: sg.x1, z1: sg.z1, w: 3.2, y: 0.085, c: 3 });
      for (let t = 8; t < L - 4; t += 22) palms.push([sg.x0 + ux * t, sg.z0 + uz * t]);
    }
    const side = sg.w / 2 + 2.6;
    const palmy = dist < 3400 && dens > 0.35;
    for (let t = 6; t < L; t += palmy ? 20 : 30) {
      const px = sg.x0 + ux * t, pz = sg.z0 + uz * t;
      for (const sd of palmy ? [-1, 1] : [1]) {
        const x = px - uz * side * sd, z = pz + ux * side * sd;
        if (boxNearSuper(x, z, x, z, 4) || nearRB(x, z, PLAZA_R + 2)) continue;
        if (palmy) palms.push([x, z]); else if (dist < 7000 && dens > 0.25) streetTrees.push([x, z]);
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
  // the CFC lots (park cells nearest the CFC centre, see landmarks/Cfc): keep them clear for the towers
  {
    const lots = parks.map(([x, z, w, d]) => ({ x, z, w, d, dist: Math.hypot(x - CFC.x, z - CFC.y) })).filter((p) => p.dist < 450).sort((a, b) => a.dist - b.dist).slice(0, 5);
    for (let k = trees.length - 1; k >= 0; k--) {
      const [x, z] = trees[k];
      if (lots.some((l) => Math.abs(x - l.x) < l.w / 2 - 7 && Math.abs(z - l.z) < l.d / 2 - 7)) trees.splice(k, 1);
    }
  }
  // the Anfa Prime lot (see landmarks/AnfaPrime): its own garden, nothing of the plan inside
  const dropLot = (list: number[][]) => { for (let k = list.length - 1; k >= 0; k--) if (inAnfaPrime(list[k][0], list[k][1], -1)) list.splice(k, 1); };
  dropLot(trees); dropLot(palms); dropLot(streetTrees);
  // the Twin Center lot (landmarks/TwinCenter): its towers, podium and plaza, no tree of the plan inside
  for (const list of [trees, palms, streetTrees] as number[][][]) for (let k = list.length - 1; k >= 0; k--) if (inTwin(list[k][0], list[k][1], -2)) list.splice(k, 1);
  // the CFC district (landmarks/CfcDistrict): nothing of the generated city inside, its own trees and palms instead
  for (const list of [trees, palms, streetTrees, poles] as number[][][]) for (let k = list.length - 1; k >= 0; k--) if (inCfc(list[k][0], list[k][1], -1)) list.splice(k, 1);
  for (const list of [parked, signs] as Bx[][]) for (let k = list.length - 1; k >= 0; k--) if (inCfc(list[k].x, list[k].z, -1)) list.splice(k, 1);
  for (let k = decals.length - 1; k >= 0; k--) if (inCfc((decals[k].x0 + decals[k].x1) / 2, (decals[k].z0 + decals[k].z1) / 2, -1)) decals.splice(k, 1);
  { const g = cfcGreenery(); trees.push(...g.trees); palms.push(...g.palms); }
  // the Maârif district (landmarks/MaarifDistrict): the same, except along the tram boulevard that crosses it
  const inM = (x: number, z: number) => (inMaarif(x, z, -1) && Math.abs(z - TRAM.z) > 22) || inAnfaZone(x, z, -1);
  for (const list of [trees, palms, streetTrees, poles] as number[][][]) for (let k = list.length - 1; k >= 0; k--) if (inM(list[k][0], list[k][1])) list.splice(k, 1);
  for (const list of [parked, signs] as Bx[][]) for (let k = list.length - 1; k >= 0; k--) if (inM(list[k].x, list[k].z)) list.splice(k, 1);
  for (let k = decals.length - 1; k >= 0; k--) if (inM((decals[k].x0 + decals[k].x1) / 2, (decals[k].z0 + decals[k].z1) / 2)) decals.splice(k, 1);
  for (const Z of [MAARIF_ZONE, ANFA_ZONE]) { const g = zoneGreenery(Z); trees.push(...g.trees); palms.push(...g.palms); }
  return { segs, grid, boxes, near, signs, cfc, cfcSigns, parks, trees, palms, roundabouts: rbs, decals, roofs, parked, tram, poles, streetTrees, net, kerbs, medians, pools, hips, minarets, plazas };
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
  for (const m of P.minarets) aabb(m.x, m.z, m.s, m.s, 0, m.h);
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
/** The city plan (memoised; the first call builds it, ~0.5 s). */
export const cityPlan = () => (PLAN ??= makePlan());

/** Sidewalk width on each side of a street segment (asphalt width `w`), as drawn by CityContent. */
export const sidewalkWidth = (w: number) => (w > 20 ? 4.5 : 3);
/** Sidewalk centrelines (both sides of every street segment within `maxDist` of the hospital), for pedestrians.
 *  Each line is offset from the street centreline by w/2 + sidewalk/2; `w` is the sidewalk width. Not trimmed at junctions. */
export function sidewalkCentrelines(maxDist = 1500): { x0: number; z0: number; x1: number; z1: number; w: number }[] {
  const out: { x0: number; z0: number; x1: number; z1: number; w: number }[] = [];
  for (const s of cityPlan().segs) {
    if ((s.w > 32 && !s.d) || s.c === 2) continue; // avenues / country roads: no pavement model
    const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
    if (Math.hypot(mx, mz) > maxDist) continue;
    const L = Math.hypot(s.x1 - s.x0, s.z1 - s.z0) || 1, nx = -(s.z1 - s.z0) / L, nz = (s.x1 - s.x0) / L;
    const sw = sidewalkWidth(s.w), o = s.w / 2 + sw / 2;
    for (const sd of [-1, 1]) out.push({ x0: s.x0 + nx * o * sd, z0: s.z0 + nz * o * sd, x1: s.x1 + nx * o * sd, z1: s.z1 + nz * o * sd, w: sw });
  }
  return out;
}
