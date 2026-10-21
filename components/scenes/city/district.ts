// The neighbourhood around the hospital (world metres, x east, z south, map north = −Z) and the traffic network.
// The campus sits in a "superblock" bounded by the grid streets x = ±180 and z = ±180 of CityContent's plan:
//  · front boulevard z = 60 (30 m, 2 × 2 lanes, planted median with palms), through the whole city;
//  · back street z = −60 (12 m) and the two campus side streets x = ±86 (14 m);
//  · the hospital axis x = −14 (main building centreline): one street from the north, one from the south;
//  · signals at the axis junction (−14, 60) and at (−180, 60); a roundabout at (180, 60);
//  · the campus loop (right-in at x = 52, contre-allée, ramps, drop-off under the entrance canopy, right-out at x = −50);
//  · the white hospital square = the plinth + its pavement up to the inner kerbs (SQUARE), the rest of the city is blue.
import { buildNet, findLane, type Net, type NodeDef, type RoadDef } from "./roads";
import type { BusLine } from "./trafficSim";

/** A building box: centre, footprint (w along x, d along z), height, yaw, palette tone 0…1, and façade style:
 *  shop = street-level shop band, acc = awning colour (0 none, 1…6), win = façade style (see CityContent: 0 punched windows,
 *  1 balconies, 2 ribbon, 3 Art Deco, 4 medina, 5 villa, 6 shed, 7 curtain wall, 8 rampart, 9 beach club), warm = painted
 *  façade (legacy), pal = colour family (see CityContent PALETTES). */
export type Bx = { x: number; z: number; w: number; d: number; h: number; yaw: number; c: number; shop?: number; acc?: number; win?: number; warm?: boolean; pal?: number };
export type DSeg = { x0: number; z0: number; x1: number; z1: number; w: number; c: number; d?: boolean };
export type Quad = { x0: number; z0: number; x1: number; z1: number; w: number; y: number; c: number };

export const SUPER = 180;
/** The white hospital square (to the inner kerbs of the surrounding streets). */
export const SQUARE = { x0: -79, x1: 79, z0: -54, z1: 45 };
export const RB = { x: 180, z: 60, r: 20, inner: 15, outer: 25 };
export const PLAZA_R = 31;
/** Campus loop in world coordinates (hospital/Site draws it in the campus frame, CAMPUS_OFFSET = (−14, 0, −5)). */
export const CAMPUS = {
  ca: { x0: -53.5, x1: 55.5, z0: 32, z1: 39, z: 35.5 },   // contre-allée (one-way westbound)
  tin: { x: 52, w: 7 }, tout: { x: -50, w: 7 },          // entry / exit throats through the front pavement (z 39 … 45)
  rampE: { x: 15.25, w: 5.5 }, rampW: { x: -37.25, w: 5.5 },
  drop: { z: 17.4, w: 4.4 },                              // drop-off lane under the AKDITAL canopy (x −40 … 18)
  dropStop: -24,                                          // front bumper of a stopping taxi
};

// ---------------------------------------------------------------- roads
const blvd = (x0: number, x1: number): RoadDef => ({ x0, z0: 60, x1, z1: 60, w: 30, fwd: 2, bwd: 2, off: [4, 8.5], vmax: 12.5, d: true });
const street = (x0: number, z0: number, x1: number, z1: number, w = 12): RoadDef => ({ x0, z0, x1, z1, w, fwd: 1, bwd: 1, off: [w > 12 ? 3.3 : 3], vmax: w > 12 ? 8.5 : 9.5, d: true });
const oneWay = (x0: number, z0: number, x1: number, z1: number, w: number, vmax = 4.6): RoadDef => ({ x0, z0, x1, z1, w, fwd: 1, bwd: 0, off: [0], vmax, campus: true });
const C = CAMPUS;
export const DISTRICT_ROADS: RoadDef[] = [
  blvd(-180, 180),
  street(-180, -60, 180, -60),
  street(-86, -60, -86, 60, 14), street(86, -60, 86, 60, 14),
  street(-14, -180, -14, -60), street(-14, 60, -14, 180),
];
export const CAMPUS_ROADS: RoadDef[] = [
  oneWay(C.tin.x, 60, C.tin.x, C.ca.z, C.tin.w, 5),
  oneWay(C.tin.x, C.ca.z, C.rampE.x, C.ca.z, 7),
  oneWay(C.rampE.x, C.ca.z, C.rampE.x, C.drop.z, C.rampE.w, 4),
  oneWay(C.rampE.x, C.drop.z, C.rampW.x, C.drop.z, C.drop.w, 4),
  oneWay(C.rampW.x, C.drop.z, C.rampW.x, C.ca.z, C.rampW.w, 4),
  oneWay(C.rampE.x, C.ca.z, C.rampW.x, C.ca.z, 7),
  oneWay(C.rampW.x, C.ca.z, C.tout.x, C.ca.z, 7),
  oneWay(C.tout.x, C.ca.z, C.tout.x, 60, C.tout.w, 5),
];
const campusNode = (x: number, z: number): NodeDef => ({ x, z, setback: 0.5 });
export const SPECIALS: NodeDef[] = [
  { x: -180, z: 60, signal: 12 }, { x: -86, z: 60 }, { x: C.tout.x, z: 60, setback: 1.5, rightOnly: true }, { x: -14, z: 60, signal: 0 },
  { x: C.tin.x, z: 60, setback: 1.5, rightOnly: true }, { x: 86, z: 60 }, { x: RB.x, z: RB.z, rb: { r: RB.r, outer: RB.outer, delta: 0.5 } },
  { x: -86, z: -60 }, { x: -14, z: -60 }, { x: 86, z: -60 }, { x: -14, z: -180 }, { x: -14, z: 180 },
  campusNode(C.tin.x, C.ca.z), campusNode(C.rampE.x, C.ca.z), campusNode(C.rampE.x, C.drop.z), campusNode(C.rampW.x, C.drop.z),
  campusNode(C.rampW.x, C.ca.z), campusNode(C.tout.x, C.ca.z),
  { x: 660, z: -780, rb: { r: 52, outer: 60, delta: 0.2 } }, // the grid roundabout of CityContent (line(5), line(−7))
];

// ---------------------------------------------------------------- Casa Bus lines (clockwise loops: right turns only, kerb lane)
export const BUS_LINES: BusLine[] = [
  { label: "Hôpital", n: 5, corners: [[300, 60], [-420, 60], [-420, -300], [300, -300]],
    stops: [{ x: 4, z: 51.5 }, { x: -417, z: -20 }, { x: -120, z: -297 }, { x: 297, z: -120 }] },
  { label: "Centre-ville", n: 5, corners: [[-420, 60], [300, 60], [300, 420], [-420, 420]],
    stops: [{ x: 30, z: 68.5 }, { x: 297, z: 240 }, { x: 0, z: 417 }, { x: -417, z: 240 }] },
];
/** Bus shelters (centre, yaw: the open side faces the street along local +z). */
export const SHELTERS: { x: number; z: number; yaw: number; hospital?: boolean }[] = [
  { x: 8, z: 43.2, yaw: 0, hospital: true }, { x: -412.4, z: -16, yaw: -Math.PI / 2 }, { x: -124, z: -292.4, yaw: Math.PI }, { x: 292.4, z: -124, yaw: Math.PI / 2 },
  { x: 26, z: 76.8, yaw: Math.PI, hospital: true }, { x: 292.4, z: 236, yaw: Math.PI / 2 }, { x: 4, z: 412.4, yaw: 0 }, { x: -412.4, z: 244, yaw: -Math.PI / 2 },
];

/** Builds the traffic network: the grid streets near the hospital + the district + the campus loop. */
export function buildDistrictNet(grid: DSeg[], radius: number): Net {
  const defs: RoadDef[] = [];
  for (const g of grid) {
    if (Math.hypot(g.x0, g.z0) > radius || Math.hypot(g.x1, g.z1) > radius) continue;
    defs.push(g.w > 20 ? { x0: g.x0, z0: g.z0, x1: g.x1, z1: g.z1, w: 30, fwd: 2, bwd: 2, off: [4, 8.5], vmax: 13 }
      : { x0: g.x0, z0: g.z0, x1: g.x1, z1: g.z1, w: 12, fwd: 1, bwd: 1, off: [3], vmax: 10 });
  }
  defs.push(...DISTRICT_ROADS, ...CAMPUS_ROADS);
  const net = buildNet(defs, SPECIALS, (x, z) => (Math.hypot(x, z) < 600 ? 4.5 : 2.5));
  BUS_LINES.forEach((L, li) => {
    L.stops.forEach((p, k) => {
      const c = L.corners;
      // heading of the leg the stop is on
      let hx = 0, hz = 0, bd = 1e9;
      for (let q = 0; q < c.length; q++) {
        const a = c[q], b = c[(q + 1) % c.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len;
        const t = (p.x - a[0]) * ux + (p.z - a[1]) * uz, lat = Math.abs((p.x - a[0]) * uz - (p.z - a[1]) * ux);
        if (t > 0 && t < len && lat < bd) { bd = lat; hx = ux; hz = uz; }
      }
      const f = findLane(net, p.x, p.z, hx, hz);
      if (f) net.segs[f.seg].stops.push({ line: li, s: f.s });
      void k;
    });
  });
  const d = findLane(net, C.dropStop, C.drop.z, -1, 0, 1.5);
  if (d) net.segs[d.seg].drop = d.s;
  return net;
}

// ---------------------------------------------------------------- drawing data derived from the network
type End = Net["nodes"][number]["ends"][number];
/** Zebras, stop lines and lane markings of the district streets (decal colour 0 = paint). */
export function districtDecals(net: Net): Quad[] {
  const out: Quad[] = [];
  const bar = (x0: number, z0: number, x1: number, z1: number, w: number) => out.push({ x0, z0, x1, z1, w, y: 0.095, c: 0 });
  const dashes = (ax: number, az: number, ux: number, uz: number, t0: number, t1: number, dash: number, gap: number, w: number) => {
    for (let t = t0; t + dash <= t1; t += dash + gap) bar(ax + ux * t, az + uz * t, ax + ux * (t + dash), az + uz * (t + dash), w);
  };
  for (const n of net.nodes) {
    const deg = n.ends.length, junction = deg >= 3 || !!n.rb;
    if (!junction || Math.hypot(n.x, n.z) > 620) continue;
    let hwMax = 0;
    for (const e of n.ends) hwMax = Math.max(hwMax, e.hw);
    for (const e of n.ends) {
      const R = net.roads[e.road];
      if (R.campus) continue;
      const rx = -e.uz, rz = e.ux; // right of the direction leaving the node
      const cross = n.rb ? n.rb.outer : e.trim - n.setback;
      // zebra band across the arm (stripes along the road), not across the boulevard at the campus throats
      if (!n.rightOnly) {
        const c0 = cross + 0.8, cx = n.x + e.ux * (c0 + 1.5), cz = n.z + e.uz * (c0 + 1.5);
        for (let q = -e.hw + 0.9; q <= e.hw - 0.9; q += 1.1) bar(cx + rx * q - e.ux * 1.5, cz + rz * q - e.uz * 1.5, cx + rx * q + e.ux * 1.5, cz + rz * q + e.uz * 1.5, 0.5);
      }
      // stop line across the arriving half (on its left when leaving the node): signals, roundabouts, minor arms, equal crossings
      const minor = e.hw < hwMax - 1, equal = n.ends.every((o) => Math.abs(o.hw - e.hw) < 1);
      if (n.signal >= 0 || n.rb || minor || equal) {
        const arriving = e.end === 1 ? R.fwd : R.bwd;
        if (arriving) {
          const t = e.trim - 0.25, a = e.hw > 12 ? 1.3 : 0.25, b = e.hw - 0.4;
          bar(n.x + e.ux * t - rx * a, n.z + e.uz * t - rz * a, n.x + e.ux * t - rx * b, n.z + e.uz * t - rz * b, 0.42);
        }
      }
    }
  }
  // lane markings along the district pieces
  for (const R of net.roads) {
    if (!R.d) continue;
    const A = net.nodes[R.a], B = net.nodes[R.b];
    const eA = A.ends.find((e) => e.road === R.id && e.end === 0)!, eB = B.ends.find((e) => e.road === R.id && e.end === 1)!;
    const t0 = (A.ends.length >= 3 || A.rb ? eA.trim : 0) + 0.5, t1 = R.L - (B.ends.length >= 3 || B.rb ? eB.trim : 0) - 0.5;
    if (t1 - t0 < 4) continue;
    const rx = -R.uz, rz = R.ux;
    if (R.w > 20) {
      for (const sd of [-1, 1]) {
        dashes(R.x0 + rx * 6.25 * sd, R.z0 + rz * 6.25 * sd, R.ux, R.uz, t0, t1, 3, 6, 0.16);
        bar(R.x0 + rx * 10.8 * sd + R.ux * t0, R.z0 + rz * 10.8 * sd + R.uz * t0, R.x0 + rx * 10.8 * sd + R.ux * t1, R.z0 + rz * 10.8 * sd + R.uz * t1, 0.13);
      }
    } else dashes(R.x0, R.z0, R.ux, R.uz, t0 + 1, t1 - 1, 2, 5, 0.14);
  }
  return out;
}

/** Raised kerbs along the district streets (white on the hospital square side, soft blue elsewhere). */
export function districtKerbs(net: Net): { x0: number; z0: number; x1: number; z1: number; white: boolean }[] {
  const out: { x0: number; z0: number; x1: number; z1: number; white: boolean }[] = [];
  const inSquare = (x: number, z: number) => x > SQUARE.x0 - 0.5 && x < SQUARE.x1 + 0.5 && z > SQUARE.z0 - 0.5 && z < SQUARE.z1 + 0.5;
  const cut = (n: Net["nodes"][number], self: End, rx: number, rz: number, sd: number, lat: number) => {
    if (n.rb) return Math.sqrt(Math.max(0, n.rb.outer * n.rb.outer - lat * lat));
    let d = 0;
    for (const o of n.ends) {
      if (o === self) continue;
      if (sd * (o.ux * rx + o.uz * rz) > 0.3) d = Math.max(d, o.hw + 2);
    }
    return d;
  };
  for (const R of net.roads) {
    if (!R.d) continue;
    const A = net.nodes[R.a], B = net.nodes[R.b];
    const eA = A.ends.find((e) => e.road === R.id && e.end === 0)!, eB = B.ends.find((e) => e.road === R.id && e.end === 1)!;
    const rx = -R.uz, rz = R.ux, hw = R.w / 2 + 0.15;
    for (const sd of [-1, 1]) {
      const a = cut(A, eA, rx, rz, sd, hw), b = R.L - cut(B, eB, -rx, -rz, -sd, hw);
      // campus throats cut the hospital-side kerb of the boulevard
      if (b - a < 0.8) continue;
      const ox = rx * hw * sd, oz = rz * hw * sd;
      const mx = R.x0 + R.ux * (a + b) / 2 + rx * sd * (hw + 1.5), mz = R.z0 + R.uz * (a + b) / 2 + rz * sd * (hw + 1.5);
      out.push({ x0: R.x0 + R.ux * a + ox, z0: R.z0 + R.uz * a + oz, x1: R.x0 + R.ux * b + ox, z1: R.z0 + R.uz * b + oz, white: inSquare(mx, mz) });
    }
  }
  // roundabout: outer kerb between the arms
  const n = net.nodes.find((q) => q.rb && Math.abs(q.x - RB.x) < 1 && Math.abs(q.z - RB.z) < 1);
  if (n) {
    const R = RB.outer + 0.15;
    const arms = n.ends.map((e) => ({ a: Math.atan2(e.uz, e.ux), h: Math.asin(Math.min(0.99, (e.hw + 0.15) / R)) })).sort((p, q) => p.a - q.a);
    arms.forEach((p, k) => {
      const q = arms[(k + 1) % arms.length];
      let a0 = p.a + p.h, a1 = q.a - q.h; if (a1 < a0) a1 += Math.PI * 2;
      const steps = Math.max(1, Math.ceil((a1 - a0) / 0.12));
      for (let s = 0; s < steps; s++) {
        const u = a0 + ((a1 - a0) * s) / steps, v = a0 + ((a1 - a0) * (s + 1)) / steps;
        out.push({ x0: n.x + R * Math.cos(u), z0: n.z + R * Math.sin(u), x1: n.x + R * Math.cos(v), z1: n.z + R * Math.sin(v), white: false });
      }
    });
  }
  return out;
}

/** Planted medians of the front boulevard (between the junction mouths; continuous through the right-in/right-out throats). */
export function districtMedians(net: Net): { x0: number; x1: number; z: number }[] {
  const out: { x0: number; x1: number; z: number }[] = [];
  for (const R of net.roads) {
    if (!R.d || R.w < 20 || Math.abs(R.uz) > 0.01) continue;
    const A = net.nodes[R.a], B = net.nodes[R.b];
    const eA = A.ends.find((e) => e.road === R.id && e.end === 0)!, eB = B.ends.find((e) => e.road === R.id && e.end === 1)!;
    const a = A.rightOnly || A.ends.length < 3 && !A.rb ? 0 : eA.trim - 0.6, b = R.L - (B.rightOnly || B.ends.length < 3 && !B.rb ? 0 : eB.trim - 0.6);
    if (b - a > 3) out.push({ x0: Math.min(R.x0 + R.ux * a, R.x0 + R.ux * b), x1: Math.max(R.x0 + R.ux * a, R.x0 + R.ux * b), z: R.z0 });
  }
  // merge touching pieces
  out.sort((p, q) => p.x0 - q.x0);
  const m: typeof out = [];
  for (const p of out) { const l = m[m.length - 1]; if (l && Math.abs(l.x1 - p.x0) < 0.5 && l.z === p.z) l.x1 = p.x1; else m.push({ ...p }); }
  return m;
}

/** Traffic-light heads: one per arriving arm of a signalised junction, on the right kerb at the stop line. */
export function signalHeads(net: Net): { x: number; z: number; yaw: number; node: number; group: number; offset: number }[] {
  const out: { x: number; z: number; yaw: number; node: number; group: number; offset: number }[] = [];
  for (const n of net.nodes) {
    if (n.signal < 0) continue;
    for (const e of n.ends) {
      const R = net.roads[e.road];
      if (!(e.end === 1 ? R.fwd : R.bwd)) continue;
      const rx = e.uz, rz = -e.ux; // right of the arriving traffic
      out.push({ x: n.x + e.ux * (e.trim - 1) + rx * (e.hw + 0.9), z: n.z + e.uz * (e.trim - 1) + rz * (e.hw + 0.9), yaw: Math.atan2(e.ux, e.uz), node: n.id, group: Math.abs(e.ux) > Math.abs(e.uz) ? 0 : 1, offset: n.signal });
    }
  }
  return out;
}

// ---------------------------------------------------------------- blocks, parks, palms of the district
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Shrinks a building box out of a disc (corner plazas of the roundabout); null when nothing useful is left. */
export function cutDisc(b: Bx, cx: number, cz: number, R: number): Bx | null {
  const x0 = b.x - b.w / 2, x1 = b.x + b.w / 2, z0 = b.z - b.d / 2, z1 = b.z + b.d / 2;
  const dx = Math.max(x0 - cx, 0, cx - x1), dz = Math.max(z0 - cz, 0, cz - z1);
  if (dx * dx + dz * dz >= R * R) return b;
  let nx0 = x0, nx1 = x1, nz0 = z0, nz1 = z1;
  if (b.w >= b.d) {
    const h = Math.sqrt(Math.max(0, R * R - dz * dz));
    if (cx < b.x) nx0 = Math.max(x0, cx + h); else nx1 = Math.min(x1, cx - h);
  } else {
    const h = Math.sqrt(Math.max(0, R * R - dx * dx));
    if (cz < b.z) nz0 = Math.max(z0, cz + h); else nz1 = Math.min(z1, cz - h);
  }
  if (nx1 - nx0 < 7 || nz1 - nz0 < 7) return null;
  return { ...b, x: (nx0 + nx1) / 2, z: (nz0 + nz1) / 2, w: nx1 - nx0, d: nz1 - nz0 };
}

export type DistrictBlocks = { blocks: Bx[]; parks: [number, number, number, number][]; trees: [number, number, number][]; palms: [number, number][] };
export function districtBlocks(): DistrictBlocks {
  const r = rng(20261021);
  const blocks: Bx[] = [], parks: DistrictBlocks["parks"] = [], trees: DistrictBlocks["trees"] = [], palms: DistrictBlocks["palms"] = [];
  const push = (b: Bx) => { const c = cutDisc(b, RB.x, RB.z, PLAZA_R); if (c) blocks.push(c); };
  const perimeter = (xa: number, za: number, xb: number, zb: number) => {
    const bw = xb - xa, bd = zb - za, dep = 13, tone = r();
    const H = 6.5 + r() * 3;
    push({ x: (xa + xb) / 2, z: za + dep / 2, w: bw, d: dep, h: H, yaw: 0, c: tone });
    push({ x: (xa + xb) / 2, z: zb - dep / 2, w: bw, d: dep, h: H * (0.9 + r() * 0.2), yaw: 0, c: tone });
    push({ x: xa + dep / 2, z: (za + zb) / 2, w: dep, d: bd - 2 * dep, h: H * (0.9 + r() * 0.15), yaw: 0, c: tone });
    push({ x: xb - dep / 2, z: (za + zb) / 2, w: dep, d: bd - 2 * dep, h: H, yaw: 0, c: tone });
  };
  const slabs = (xa: number, za: number, xb: number, zb: number) => {
    const bw = xb - xa, bd = zb - za, tone = r();
    const n = bw > 60 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const w = Math.min(bw / n - 6, 16 + r() * 14), d = Math.min(bd - 12, 18 + r() * 22);
      const x = xa + (bw / n) * (k + 0.5) + (r() - 0.5) * 4, z = za + 6 + d / 2 + r() * Math.max(0, bd - d - 12);
      push({ x, z, w, d, h: 7 + r() * 5, yaw: 0, c: tone });
    }
  };
  // west and east strips beside the campus side streets
  perimeter(-171, -51, -96, 42);
  slabs(96, -51, 171, 42);
  // north strip (behind the hospital), split by passages
  perimeter(-171, -171, -102, -69); perimeter(-92, -171, -23, -69);
  perimeter(-5, -171, 52, -69); slabs(62, -171, 112, -69); perimeter(122, -171, 171, -69);
  // south strip (across the boulevard): a public garden facing the hospital, then blocks
  perimeter(-171, 78, -102, 171); slabs(-92, 78, -23, 171);
  parks.push([28.5, 107, 67, 58]); // garden x −5 … 62, z 78 … 136
  for (let k = 0; k < 26; k++) trees.push([-2 + r() * 61, 81 + r() * 52, 0.8 + r() * 0.5]);
  for (let x = -2; x <= 59; x += 10) palms.push([x, 81.5]);
  perimeter(-5, 144, 62, 171);
  perimeter(72, 78, 120, 171); slabs(130, 78, 171, 171);
  // palms: south pavement of the front boulevard, the outer pavements of the side streets, around the roundabout
  for (let x = -174; x <= 150; x += 16) if (Math.abs(x + 14) > 10 && Math.abs(x - 26) > 7 && (x < -2 || x > 60)) palms.push([x, 77.6]);
  for (let x = -172; x <= -96; x += 16) if (Math.abs(x + 86) > 11) palms.push([x, 42.4]);
  for (let x = 98; x <= 146; x += 16) palms.push([x, 42.4]);
  for (const sx of [-1, 1]) for (let z = -48; z <= 38; z += 14) palms.push([sx * 94.6, z]);
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; palms.push([RB.x + Math.cos(a) * 28.5, RB.z + Math.sin(a) * 28.5]); }
  // street trees on the back street's north pavement
  for (let x = -170; x <= 170; x += 18) if (Math.abs(x + 14) > 10) trees.push([x, -67.6, 0.75]);
  return { blocks, parks, trees, palms };
}
