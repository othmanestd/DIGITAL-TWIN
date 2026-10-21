// The geography of the procedural Casablanca (pure data, no three.js scene objects): the coastline, the coast frame, the
// urban density field (dense centre, fading along the coast and the main roads into suburbs, then fields and scrub, with
// an irregular outline: no circle), the districts (medina by the port, Art Deco downtown, business axis, Anfa villas,
// suburbs, industrial east, countryside) and the sites of the remarkable places (port, El Hank, corniche, Arab League
// park, Anfa racetrack, rail). World metres, x east, z south (map north = −Z), y up. plan.ts re-exports the stable names.
import * as THREE from "three";

// ---------------------------------------------------------------- coastline
export const N = new THREE.Vector2(-Math.SQRT1_2, -Math.SQRT1_2);   // towards the ocean (north-west)
export const T = new THREE.Vector2(Math.SQRT1_2, -Math.SQRT1_2);    // along the coast (north-east)
export const COAST = 2750;
/** El Hank headland (a bump of the coastline, coast-frame t) */
export const HANK = { t: -1380, w: 230, h: 240 };
export const wiggle = (t: number) => 170 * Math.sin(t / 1150) + 70 * Math.sin(t / 430 + 1.3) + HANK.h * Math.exp(-(((t - HANK.t) / HANK.w) ** 2));
/** signed distance-ish to the coast: > 0 in the sea */
export const sea = (x: number, z: number) => x * N.x + z * N.y - wiggle(x * T.x + z * T.y) - COAST;
/** coast-frame coordinate along the shore (north-east positive) */
export const coastT = (x: number, z: number) => x * T.x + z * T.y;
/** world point at coast-frame t, `off` metres seaward of the coastline (negative = inland) */
export function atCoast(t: number, off: number): [number, number] { const b = COAST + wiggle(t) + off; return [N.x * b + T.x * t, N.y * b + T.y * t]; }
/** world point on a straight line parallel to the mean coast: t along, b = distance from the origin towards the sea */
export function atLine(t: number, b: number): [number, number] { return [N.x * b + T.x * t, N.y * b + T.y * t]; }

export const AVENUES: { p: [number, number]; a: number }[] = [
  { p: [300, -700], a: (35 * Math.PI) / 180 },
  { p: [-1200, 900], a: (-25 * Math.PI) / 180 },
  { p: [2000, 1500], a: (70 * Math.PI) / 180 },
];
export const DOWNTOWN = new THREE.Vector2(900, -1500);
/** The old port / medina: the centre of the radial-concentric plan (ring boulevards and radial roads) */
export const RC = (() => { const b = COAST + wiggle(600); return { x: N.x * b + T.x * 600, z: N.y * b + T.y * 600 }; })();
/** radial boulevards out of the centre (lines through RC; the seaward half is clipped by the coast) */
export const RADIALS: { p: [number, number]; a: number }[] = [110, 135].map((deg) => ({ p: [RC.x, RC.z] as [number, number], a: (deg * Math.PI) / 180 }));
/** ring boulevards around the centre (radii, m) */
export const RINGS = [2350, 4100];
/** distance (m) from a point to the nearest avenue, radial or ring boulevard centreline */
export function distBoulevard(x: number, z: number) {
  let d = 1e9;
  for (const av of AVENUES) d = Math.min(d, distToLine(x, z, av));
  for (const av of RADIALS) d = Math.min(d, distToLine(x, z, av));
  const rr = Math.hypot(x - RC.x, z - RC.z);
  for (const R of RINGS) d = Math.min(d, Math.abs(rr - R));
  return d;
}
export const TWIN: [number, number][] = [[-880, 560], [-835, 610]];
export const CFC = new THREE.Vector2(-1750, -500); // business district cluster (centre of the signature towers)

// ---------------------------------------------------------------- deterministic noise
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const hash2 = (i: number, j: number) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function vnoise(x: number, z: number) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fractal value noise, about −1 … 1 */
export function fbm(x: number, z: number, oct = 3) {
  let s = 0, a = 0.5, f = 1;
  for (let k = 0; k < oct; k++) { s += a * (vnoise(x * f + k * 17.3, z * f - k * 9.1) * 2 - 1); f *= 2.03; a *= 0.5; }
  return s / (1 - Math.pow(0.5, oct));
}
export function distToLine(x: number, z: number, av: { p: [number, number]; a: number }) {
  const dx = Math.cos(av.a), dz = Math.sin(av.a);
  return Math.abs((x - av.p[0]) * dz - (z - av.p[1]) * dx);
}
function distToSeg(x: number, z: number, ax: number, az: number, bx: number, bz: number) {
  const vx = bx - ax, vz = bz - az, L2 = vx * vx + vz * vz || 1;
  const k = Math.min(1, Math.max(0, ((x - ax) * vx + (z - az) * vz) / L2));
  return Math.hypot(x - ax - vx * k, z - az - vz * k);
}

// ---------------------------------------------------------------- remarkable sites (coast frame t, inland distance n)
/** Old medina: between the mosque and the port, along the shore */
export const MEDINA = { t0: 60, t1: 980, n0: 70, n1: 640 };
/** Port: the long jetty (Moulay Youssef) rooted near the medina, quays from t0 to t1, harbour mouth at the east */
export const PORT = { t0: 980, t1: 3700, root: 430, jettyOff: 820, jettyEnd: 3550, eastT: 3920, jettyB: COAST + 800, piers: [1300, 1800, 2300, 2800, 3300] };
/** Art Deco downtown (ellipse) */
export const DT = { t: 1500, n: 1350, rt: 1250, rn: 950 };
/** Anfa: villas and gardens on the hill behind El Hank and Aïn Diab */
export const ANFA = { t0: -4300, t1: -1150, n0: 220, n1: 2500 };
/** Corniche / Aïn Diab beaches */
export const CORNICHE = { t0: -7200, t1: -1650 };
/** Parc de la Ligue Arabe (axis-aligned rectangle, world metres) and the Anfa racetrack (oval, world metres, yaw) */
export const LEAGUE = (() => { const [x, z] = atLine(950, COAST - 1330); return { x: Math.round(x / 10) * 10, z: Math.round(z / 10) * 10, w: 300, d: 760 }; })();
export const RACE = (() => { const [x, z] = atLine(-2650, COAST - 1250); return { x, z, a: 330, b: 170, yaw: -Math.PI / 4 }; })();
/** Rail: Casa-Port → east along the port → inland towards Casa-Voyageurs and the south-east (polyline, coast frame) */
export const RAIL_TN: [number, number][] = [[900, 260], [1600, 330], [2400, 380], [3200, 470], [3900, 760], [4500, 1300], [5100, 1900], [5900, 2500], [7000, 3200], [8600, 4100], [10500, 5200], [13000, 6600]];
export const RAIL: [number, number][] = RAIL_TN.map(([t, n]) => atLine(t, COAST - n));
export const distRail = (x: number, z: number) => { let d = 1e9; for (let i = 0; i < RAIL.length - 1; i++) d = Math.min(d, distToSeg(x, z, RAIL[i][0], RAIL[i][1], RAIL[i + 1][0], RAIL[i + 1][1])); return d; };

/** Satellite towns and villages out in the plain (world metres): a little density of their own */
const TOWNS = [
  { t: -1500, n: 8600, r: 1100, d: 0.42 }, { t: 6800, n: 7800, r: 900, d: 0.36 }, { t: -6500, n: 4200, r: 700, d: 0.3 },
  { t: 10500, n: 2600, r: 1300, d: 0.4 }, { t: 3200, n: 9800, r: 600, d: 0.28 }, { t: -9500, n: 1200, r: 900, d: 0.32 },
].map((s) => { const [x, z] = atLine(s.t, COAST - s.n); return { x, z, r: s.r, d: s.d }; });

// ---------------------------------------------------------------- density field
/** Urban density 0 … 1 (≈ 1 in the centre, 0.4 in the suburbs, < 0.1 in the countryside; 0 in the sea). */
export function density(x: number, z: number) {
  const s = sea(x, z);
  if (s >= 0) return 0;
  const n = -s, t = coastT(x, z);
  const w1 = fbm(x / 2600 + 7.1, z / 2600 - 3.3), w2 = fbm(x / 820 - 11, z / 820 + 5);
  const at = (t - 900) / (t < 900 ? 6400 : 8000), an = n / 5600;
  const e = Math.sqrt(at * at + an * an) + w1 * 0.2 + w2 * 0.07;
  let d = 1 - smooth(0.3, 1.0, e);
  // the coastal strip runs further along the shore (Aïn Diab → Dar Bouazza, Aïn Sebaâ → Mohammedia)
  d = Math.max(d, Math.max(0, 0.6 - Math.abs(t - 1200) / 22000) * Math.exp(-n / 1500) * (1 + w2 * 0.5));
  // sprawl along the main roads out of the city
  for (const av of [...AVENUES, ...RADIALS]) d = Math.max(d, 0.42 * Math.exp(-((distToLine(x, z, av) / 420) ** 2)) * (1 - smooth(0.85, 1.9, e)) * (0.75 + 0.5 * (w2 * 0.5 + 0.5)));
  for (const c of TOWNS) d = Math.max(d, c.d * (1 - smooth(0.25, 1.0, Math.hypot(x - c.x, z - c.z) / c.r + w2 * 0.3)));
  return Math.min(1, Math.max(0, d));
}

// ---------------------------------------------------------------- districts
export const Z = { CORE: 0, DOWNTOWN: 1, MEDINA: 2, BUSINESS: 3, ANFA: 4, SUBURB: 5, INDUSTRY: 6, RURAL: 7 } as const;
export type Zone = (typeof Z)[keyof typeof Z];
const TW = { x: (TWIN[0][0] + TWIN[1][0]) / 2, z: (TWIN[0][1] + TWIN[1][1]) / 2 };
export function inMedina(x: number, z: number) {
  const t = coastT(x, z), n = -sea(x, z), w = fbm(x / 300, z / 300) * 70;
  return t > MEDINA.t0 + w && t < MEDINA.t1 + w && n > MEDINA.n0 && n < MEDINA.n1 + w * 0.8;
}
export function zoneAt(x: number, z: number, d: number): Zone {
  const t = coastT(x, z), n = -sea(x, z);
  if (inMedina(x, z)) return Z.MEDINA;
  if (distToSeg(x, z, TW.x, TW.z, CFC.x, CFC.y) < 330 || Math.hypot(x - CFC.x, z - CFC.y) < 520) return Z.BUSINESS;
  if ((t > 3500 && n < 3300 && d > 0.2) || (t > PORT.t0 && t < PORT.eastT + 300 && n < 520)) return Z.INDUSTRY;
  if (t > ANFA.t0 && t < ANFA.t1 && n > ANFA.n0 && n < ANFA.n1 + fbm(x / 700, z / 700) * 300) return Z.ANFA;
  if (((t - DT.t) / DT.rt) ** 2 + ((n - DT.n) / DT.rn) ** 2 < 1) return Z.DOWNTOWN;
  if (d > 0.6) return Z.CORE;
  if (d > 0.16) return Z.SUBURB;
  return Z.RURAL;
}
/** Beach width (m) of the shore at coast-frame t: wide sand at Aïn Diab, narrow elsewhere, rocks around El Hank. */
export function beachWidth(t: number) {
  if (t > CORNICHE.t0 && t < CORNICHE.t1) return 55 + 35 * Math.sin(t / 610) * Math.sin(t / 233);
  return 14;
}
