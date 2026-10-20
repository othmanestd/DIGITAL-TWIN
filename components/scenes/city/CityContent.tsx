"use client";
// A calm, procedural Casablanca around the typical hospital (white architectural-model style).
// 1 unit = 1 m, campus at the origin, ground at y = 0, map north = −Z (the Atlantic is to the north-west).
// No controls / lights / background: mounted next to <HospitalContent/> in the unified world.
//  · ground disc (≈ 9 km, fading rim) that hides the Morocco map underneath, with a hole for the campus plinth
//  · streets / boulevards / diagonal avenues / roundabouts / corniche as one merged geometry
//  · blocks: Haussmann-like perimeter blocks, modern slabs, low-rise outskirts, a Twin-Center-like pair, a business
//    district cluster (one InstancedMesh, thousands of instances), lit windows at night (time-lapse of the hospital)
//  · parks, palm-lined boulevards around the hospital, the ocean, a Hassan II-like mosque and minaret by the sea
//  · slow cars on the main boulevards; LOD by camera altitude (lib/world frame.alt)
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame, fadeIn } from "@/lib/world";
import { rt } from "@/components/scenes/hospital/mats";

// ---------------------------------------------------------------- city plan constants
const R_CITY = 7000;            // buildings / streets
const R_GROUND = 9000;          // ground disc (fades from 7.6 km)
const CELL = 120;               // street grid pitch
const PLOT = { x: 99, z: 72 };  // clear plot around the campus (HOSPITAL_BOX + ~25 m street ring)
const RING = { x: 86, z: 59, w: 20 };
const N = new THREE.Vector2(-Math.SQRT1_2, -Math.SQRT1_2);   // towards the ocean (north-west)
const T = new THREE.Vector2(Math.SQRT1_2, -Math.SQRT1_2);    // along the coast
const COAST = 2750;
const wiggle = (t: number) => 170 * Math.sin(t / 1150) + 70 * Math.sin(t / 430 + 1.3);
/** signed distance-ish to the coast: > 0 in the sea */
const sea = (x: number, z: number) => x * N.x + z * N.y - wiggle(x * T.x + z * T.y) - COAST;

const AVENUES: { p: [number, number]; a: number }[] = [
  { p: [300, -700], a: (35 * Math.PI) / 180 },
  { p: [-1200, 900], a: (-25 * Math.PI) / 180 },
  { p: [2000, 1500], a: (70 * Math.PI) / 180 },
];
const DOWNTOWN = new THREE.Vector2(900, -1500);
const TWIN: [number, number][] = [[-880, 560], [-835, 610]];
const CFC = new THREE.Vector2(-1750, -500); // business district cluster

// ---------------------------------------------------------------- deterministic noise
function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash2 = (i: number, j: number) => { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

type Bx = { x: number; z: number; w: number; d: number; h: number; yaw: number; c: number };
type Seg = { x0: number; z0: number; x1: number; z1: number; w: number; c: number };

function distToLine(x: number, z: number, av: (typeof AVENUES)[number]) {
  const dx = Math.cos(av.a), dz = Math.sin(av.a);
  return Math.abs((x - av.p[0]) * dz - (z - av.p[1]) * dx);
}
function intersect(a: (typeof AVENUES)[number], b: (typeof AVENUES)[number]): [number, number] | null {
  const d1x = Math.cos(a.a), d1z = Math.sin(a.a), d2x = Math.cos(b.a), d2z = Math.sin(b.a);
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((b.p[0] - a.p[0]) * d2z - (b.p[1] - a.p[1]) * d2x) / den;
  return [a.p[0] + d1x * t, a.p[1] + d1z * t];
}
const inPlot = (x0: number, z0: number, x1: number, z1: number, m = 0) =>
  Math.max(x0, x1) > -PLOT.x - m && Math.min(x0, x1) < PLOT.x + m && Math.max(z0, z1) > -PLOT.z - m && Math.min(z0, z1) < PLOT.z + m;
const onLand = (x: number, z: number, margin: number) => sea(x, z) < -margin && Math.hypot(x, z) < R_CITY;

// ---------------------------------------------------------------- plan generation (once)
type Quad = { x0: number; z0: number; x1: number; z1: number; w: number; y: number; c: number };
type Run = { x0: number; z0: number; x1: number; z1: number };
type Plan = {
  segs: Seg[]; boxes: Bx[]; near: Bx[]; signs: Bx[]; parks: [number, number, number, number][];
  trees: [number, number, number][]; palms: [number, number][]; roundabouts: [number, number][];
  lanes: Run[]; decals: Quad[]; roofs: { x: number; z: number; y: number; k: number; s: number }[];
  parked: Bx[]; tram: Run | null; poles: [number, number][]; streetTrees: [number, number][];
};
// decal colours (vertex colours of the markings geometry): paint, rail, parking asphalt, roundabout lawn
const DC = ["#E9E7E0", "#2C3038", "#4F5561", "#9DBA97"].map((h) => new THREE.Color(h));

function makePlan(): Plan {
  const segs: Seg[] = [], boxes: Bx[] = [], near: Bx[] = [], signs: Bx[] = [];
  const parks: [number, number, number, number][] = [], trees: [number, number, number][] = [], palms: [number, number][] = [];
  const decals: Quad[] = [], roofs: Plan["roofs"] = [], parked: Bx[] = [], poles: [number, number][] = [], streetTrees: [number, number][] = [];
  const r = rng(20261020);
  const K = Math.ceil(R_CITY / CELL) + 1;
  const line = (k: number) => k * CELL + CELL / 2;           // grid line coordinate
  const width = (k: number) => (((k % 6) + 6) % 6 === 0 ? 30 : 12); // boulevards every 6th line
  // roundabouts at avenue crossings + two boulevard crossings
  const rbs: [number, number][] = [];
  for (let i = 0; i < AVENUES.length; i++) for (let j = i + 1; j < AVENUES.length; j++) {
    const p = intersect(AVENUES[i], AVENUES[j]);
    if (p && onLand(p[0], p[1], 200) && Math.hypot(p[0], p[1]) < 5000) rbs.push(p);
  }
  rbs.push([line(5), line(-7)], [line(-12), line(5)]);

  const nearAvenue = (x: number, z: number, m: number) => AVENUES.some((a) => distToLine(x, z, a) < m);
  const nearRb = (x: number, z: number, m: number) => rbs.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < m);

  // grid streets (one segment per cell edge, clipped to land / city / plot)
  for (let a = -K; a <= K; a++) {
    for (let b = -K; b < K; b++) {
      const c = line(a), s0 = line(b), s1 = line(b + 1);
      for (const vertical of [true, false]) {
        const [x0, z0, x1, z1] = vertical ? [c, s0, c, s1] : [s0, c, s1, c];
        if (!onLand(x0, z0, 110) || !onLand(x1, z1, 110)) continue;
        if (inPlot(x0, z0, x1, z1, 2)) continue;
        const w = width(a);
        segs.push({ x0, z0, x1, z1, w, c: w > 20 ? 1 : 0 });
      }
    }
  }
  // avenues (long diagonals, cut into 120 m pieces so they clip to land)
  for (const av of AVENUES) {
    const dx = Math.cos(av.a), dz = Math.sin(av.a);
    for (let t = -9000; t < 9000; t += 120) {
      const x0 = av.p[0] + dx * t, z0 = av.p[1] + dz * t, x1 = x0 + dx * 120, z1 = z0 + dz * 120;
      if (!onLand(x0, z0, 110) || !onLand(x1, z1, 110) || inPlot(x0, z0, x1, z1, 20)) continue;
      segs.push({ x0, z0, x1, z1, w: 34, c: 1 });
    }
  }
  // corniche along the coast
  let prev: [number, number] | null = null;
  for (let t = -9000; t <= 9000; t += 90) {
    const base = COAST + wiggle(t) - 95;
    const x = N.x * base + T.x * t, z = N.y * base + T.y * t;
    if (Math.hypot(x, z) < R_CITY + 600 && prev) segs.push({ x0: prev[0], z0: prev[1], x1: x, z1: z, w: 28, c: 1 });
    prev = Math.hypot(x, z) < R_CITY + 600 ? [x, z] : null;
  }
  // ring road around the hospital plot
  const { x: rx, z: rz, w: rw } = RING;
  segs.push({ x0: -rx, z0: -rz, x1: rx, z1: -rz, w: rw, c: 1 }, { x0: -rx, z0: rz, x1: rx, z1: rz, w: rw, c: 1 });
  segs.push({ x0: -rx, z0: -rz, x1: -rx, z1: rz, w: rw, c: 1 }, { x0: rx, z0: -rz, x1: rx, z1: rz, w: rw, c: 1 });
  // roundabout rings (as short chords)
  for (const [cx, cz] of rbs) for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
    segs.push({ x0: cx + Math.cos(a0) * 52, z0: cz + Math.sin(a0) * 52, x1: cx + Math.cos(a1) * 52, z1: cz + Math.sin(a1) * 52, w: 16, c: 1 });
  }
  // palms along the ring road (outer side) and the two boulevards nearest to the hospital
  for (let x = -rx; x <= rx; x += 24) { palms.push([x, -rz - rw / 2 - 3], [x, rz + rw / 2 + 3]); }
  for (let z = -rz + 12; z <= rz - 12; z += 24) { palms.push([-rx - rw / 2 - 3, z], [rx + rw / 2 + 3, z]); }
  for (const c of [line(-2) - 18, line(1) + 18]) for (let x = -900; x <= 900; x += 22) if (Math.abs(x) > PLOT.x + 30) { palms.push([x, c]); }
  for (const [cx, cz] of rbs) for (let i = 0; i < 6; i++) palms.push([cx + Math.cos(i) * 18, cz + Math.sin(i) * 18]);

  // blocks
  for (let i = -K; i < K; i++) for (let j = -K; j < K; j++) {
    const xa = line(i) + width(i) / 2 + 3, xb = line(i + 1) - width(i + 1) / 2 - 3;
    const za = line(j) + width(j) / 2 + 3, zb = line(j + 1) - width(j + 1) / 2 - 3;
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, bw = xb - xa, bd = zb - za;
    const dist = Math.hypot(cx, cz);
    if (dist > R_CITY - 80 || !onLand(cx, cz, 160)) continue;
    if (inPlot(xa, za, xb, zb, 26)) continue;
    if (nearAvenue(cx, cz, 17 + Math.max(bw, bd) * 0.55) || nearRb(cx, cz, 95)) continue;
    const h0 = hash2(i, j);
    // parks (fewer in the dense centre)
    if (h0 < 0.055 || (dist < 520 && h0 < 0.2)) {
      parks.push([cx, cz, bw, bd]);
      const nt = dist < 2500 ? 14 : 6;
      for (let t = 0; t < nt; t++) trees.push([xa + r() * bw, za + r() * bd, 0.8 + r() * 0.6]);
      continue;
    }
    // parking lots with painted bays (a few, within 4 km)
    if (dist < 4000 && dist > 300 && h0 >= 0.055 && h0 < 0.08) {
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
    const dt = Math.hypot(cx - DOWNTOWN.x, cz - DOWNTOWN.y);
    const nearK = Math.min(1, Math.max(0.35, (dist - 250) / 700));            // keep it low around the hospital
    const dense = Math.max(0, 1 - dt / 2600);
    const kind = dist > 4300 ? "low" : h0 < 0.45 + dense * 0.3 ? "haussmann" : "modern";
    const tone = dense > 0.45 ? r() * 0.5 : r();   // Art-Deco white downtown, more cream / ochre / sand outside
    const push = (b: Bx) => { (dist < 420 ? near : boxes).push(b); };
    if (kind === "haussmann") {
      const H = (13 + r() * 9 + dense * 8) * nearK, dep = 14;
      push({ x: cx, z: za + dep / 2, w: bw, d: dep, h: H, yaw: 0, c: tone });
      push({ x: cx, z: zb - dep / 2, w: bw, d: dep, h: H * (0.9 + r() * 0.2), yaw: 0, c: tone });
      push({ x: xa + dep / 2, z: cz, w: dep, d: bd - 2 * dep, h: H * (0.9 + r() * 0.15), yaw: 0, c: tone });
      push({ x: xb - dep / 2, z: cz, w: dep, d: bd - 2 * dep, h: H, yaw: 0, c: tone });
    } else if (kind === "modern") {
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const w = 18 + r() * Math.min(40, bw - 20), d = 16 + r() * Math.min(36, bd - 20);
        const x = xa + w / 2 + r() * Math.max(0, bw - w), z = za + d / 2 + r() * Math.max(0, bd - d);
        const h = (16 + r() * 22 + dense * 14) * nearK;
        const b = { x, z, w, d, h, yaw: 0, c: tone };
        push(b);
        if (h > 26 && r() < 0.07) signs.push({ x, z, w: Math.min(w * 0.6, 14), d: 0.6, h: h + 1.6, yaw: 0, c: 0 });
      }
    } else {
      const n = 2 + Math.floor(r() * 2);
      for (let k = 0; k < n; k++) {
        const w = 14 + r() * 16, d = 12 + r() * 14;
        boxes.push({ x: xa + w / 2 + r() * Math.max(0, bw - w), z: za + d / 2 + r() * Math.max(0, bd - d), w, d, h: 6 + r() * 7, yaw: 0, c: tone });
      }
    }
  }
  // roof details (water tanks, rooftop units, satellite dishes) within 3.5 km
  for (const b of [...boxes, ...near]) {
    if (b.h < 7 || Math.hypot(b.x, b.z) > 3500) continue;
    const n = r() < 0.45 ? 0 : 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const kind = r() < 0.45 ? 0 : r() < 0.6 ? 1 : 2;
      roofs.push({ x: b.x + (r() - 0.5) * b.w * 0.6, z: b.z + (r() - 0.5) * b.d * 0.6, y: b.h, k: kind, s: 0.8 + r() * 0.5 });
    }
  }
  // landmarks: a Twin-Center-like pair and a business district cluster
  for (const [x, z] of TWIN) boxes.push({ x, z, w: 30, d: 30, h: 116, yaw: 0.26, c: 0.15 });
  boxes.push({ x: -858, z: 585, w: 95, d: 70, h: 16, yaw: 0.26, c: 0.15 });
  signs.push({ x: TWIN[0][0], z: TWIN[0][1], w: 18, d: 0.8, h: 118, yaw: 0.26, c: 0 });
  for (let k = 0; k < 9; k++) {
    const a = k * 2.4, rr = 40 + k * 22;
    const x = CFC.x + Math.cos(a) * rr, z = CFC.y + Math.sin(a) * rr;
    boxes.push({ x, z, w: 26 + r() * 14, d: 24 + r() * 12, h: 60 + r() * 50, yaw: 0, c: 0.3 });
    if (k % 3 === 0) signs.push({ x, z, w: 14, d: 0.6, h: 0, yaw: 0, c: 1 });
  }
  // tall sign heights for the CFC signs are set from their tower
  for (const s of signs) if (s.h === 0) { const t = boxes.find((b) => Math.abs(b.x - s.x) < 0.01 && Math.abs(b.z - s.z) < 0.01); s.h = (t?.h ?? 60) + 1.6; }

  // car lanes: long boulevard runs within 2.6 km
  const lanes: Plan["lanes"] = [];
  for (let a = -K; a <= K; a++) {
    if (width(a) < 20) continue;
    const c = line(a);
    for (const vertical of [true, false]) {
      const pts: number[] = [];
      for (let s = -2600; s <= 2600; s += 40) {
        const [x, z] = vertical ? [c, s] : [s, c];
        if (onLand(x, z, 140) && Math.hypot(x, z) < 2600 && !inPlot(x, z, x, z, 6)) pts.push(s);
      }
      // longest continuous run
      let best: [number, number] | null = null, start = pts[0];
      for (let i = 1; i <= pts.length; i++) {
        if (i === pts.length || pts[i] - pts[i - 1] > 41) {
          const end = pts[i - 1];
          if (end - start > 400 && (!best || end - start > best[1] - best[0])) best = [start, end];
          start = pts[i];
        }
      }
      if (best) lanes.push(vertical ? { x0: c, z0: best[0], x1: c, z1: best[1] } : { x0: best[0], z0: c, x1: best[1], z1: c });
    }
  }
  // boulevards: dashed centre lines (within 3.5 km), palms near the hospital, street trees further out
  const tramZ = line(6);
  for (const sg of segs) {
    if (sg.w < 20 || sg.w > 32) continue;
    const L = Math.hypot(sg.x1 - sg.x0, sg.z1 - sg.z0), mx = (sg.x0 + sg.x1) / 2, mz = (sg.z0 + sg.z1) / 2;
    const dist = Math.hypot(mx, mz);
    const ux = (sg.x1 - sg.x0) / (L || 1), uz = (sg.z1 - sg.z0) / (L || 1);
    const isTram = Math.abs(sg.z0 - tramZ) < 0.1 && Math.abs(sg.z1 - tramZ) < 0.1;
    if (dist < 3500 && !isTram) for (let t = 1.5; t < L - 1.5; t += 9) {
      decals.push({ x0: sg.x0 + ux * t, z0: sg.z0 + uz * t, x1: sg.x0 + ux * (t + 3), z1: sg.z0 + uz * (t + 3), w: 0.22, y: 0.09, c: 0 });
    }
    const side = sg.w / 2 + 2.6;
    for (let t = 6; t < L; t += dist < 1600 ? 22 : 30) {
      const px = sg.x0 + ux * t, pz = sg.z0 + uz * t;
      for (const sd of dist < 1600 ? [-1, 1] : [1]) {
        const x = px - uz * side * sd, z = pz + ux * side * sd;
        if (inPlot(x, z, x, z, 4)) continue;
        if (dist < 1600) palms.push([x, z]); else if (dist < 4500) streetTrees.push([x, z]);
      }
    }
  }
  // zebra crossings around the hospital (ring road) and at the entrance
  const zebra = (cx: number, cz: number, alongX: boolean, len: number) => {
    for (let k = -3; k <= 3; k++) {
      const o = k * 1.1;
      if (alongX) decals.push({ x0: cx + o, z0: cz - len / 2, x1: cx + o, z1: cz + len / 2, w: 0.55, y: 0.09, c: 0 });
      else decals.push({ x0: cx - len / 2, z0: cz + o, x1: cx + len / 2, z1: cz + o, w: 0.55, y: 0.09, c: 0 });
    }
  };
  zebra(0, rz, true, rw - 2); zebra(-40, rz, true, rw - 2); zebra(40, -rz, true, rw - 2); zebra(-rx, 0, false, rw - 2); zebra(rx, 20, false, rw - 2);
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
  return { segs, boxes, near, signs, parks, trees, palms, roundabouts: rbs, lanes, decals, roofs, parked, tram, poles, streetTrees };
}

let PLAN: Plan | null = null;
const plan = () => (PLAN ??= makePlan());

// ---------------------------------------------------------------- geometry helpers
/** Flat coloured quads (one merged geometry, vertex colours). */
type QD = { x0: number; z0: number; x1: number; z1: number; w: number; y: number; col: THREE.Color; ext?: number };
function quadGeometry(quads: QD[]) {
  const pos = new Float32Array(quads.length * 4 * 3), col = new Float32Array(quads.length * 4 * 3), idx: number[] = [];
  quads.forEach((s, i) => {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * (s.w / 2), nz = (dx / L) * (s.w / 2);
    const e = s.ext ?? 0, ex = (dx / L) * e, ez = (dz / L) * e;
    const P = [
      [s.x0 - ex + nx, s.z0 - ez + nz], [s.x0 - ex - nx, s.z0 - ez - nz],
      [s.x1 + ex - nx, s.z1 + ez - nz], [s.x1 + ex + nx, s.z1 + ez + nz],
    ];
    P.forEach(([x, z], k) => { pos.set([x, s.y, z], (i * 4 + k) * 3); col.set([s.col.r, s.col.g, s.col.b], (i * 4 + k) * 3); });
    const b = i * 4;
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2); // counter-clockwise seen from above (upward-facing)
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the quads may be wound either way: force upward normals
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

const SIDEWALK = new THREE.Color("#D9D6CF"), ASPHALT = [new THREE.Color("#4C525E"), new THREE.Color("#454A55")];
/** Streets: light sidewalks (with a curb-like edge) under warm dark-grey asphalt. */
function streetGeometry(segs: Seg[]) {
  const q: QD[] = [];
  for (const sg of segs) q.push({ ...sg, w: sg.w + (sg.w > 20 ? 9 : 6), y: 0.03, col: SIDEWALK, ext: sg.w * 0.2 });
  for (const sg of segs) q.push({ ...sg, y: 0.06, col: ASPHALT[sg.c], ext: sg.w * 0.12 });
  return quadGeometry(q);
}
function decalGeometry(d: Quad[]) { return quadGeometry(d.map((x) => ({ ...x, col: DC[x.c] }))); }

/** Ground disc with a hole for the campus plinth; uv = world xz over the disc (for the painted ground texture). */
const R_FADE = 7200; // the ground fades out from here to R_GROUND
function worldUV(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + R_GROUND) / (2 * R_GROUND); uv[i * 2 + 1] = 1 - (p.getZ(i) + R_GROUND) / (2 * R_GROUND); }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
/** Fading rim of the ground (R_FADE → R_GROUND), alpha in vertex colours. */
function rimGeometry() {
  const g = new THREE.RingGeometry(R_FADE, R_GROUND, 160, 4);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(p.count * 4);
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    const a = 1 - (r - R_FADE) / (R_GROUND - R_FADE);
    col.set([1, 1, 1, a * a * (3 - 2 * a)], i * 4);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 4));
  worldUV(g);
  return g;
}
function groundGeometry() {
  const s = new THREE.Shape();
  s.absarc(0, 0, R_FADE, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  // campus plinth outline (HospitalContent: x −74…74, z −47…47); the plinth covers it
  h.moveTo(-74, -47); h.lineTo(74, -47); h.lineTo(74, 47); h.lineTo(-74, 47); h.lineTo(-74, -47);
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 96);
  g.rotateX(-Math.PI / 2); // shape y → −z
  worldUV(g);
  return g;
}

function groundTexture(parks: Plan["parks"]) {
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  const land = [226, 229, 236], sand = [233, 221, 196], water = [104, 140, 178];
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = (px / S) * 2 * R_GROUND - R_GROUND, z = (py / S) * 2 * R_GROUND - R_GROUND;
    const d = sea(x, z);
    const col = d > 0 ? water : d > -95 ? sand : land;
    const o = (py * S + px) * 4;
    img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = "rgb(204,219,203)";
  const k = S / (2 * R_GROUND);
  for (const [x, z, w, d] of parks) g.fillRect((x - w / 2 + R_GROUND) * k, (z - d / 2 + R_GROUND) * k, w * k, d * k);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Ocean: polar strip from the coastline out to the ground rim, fading outward (vertex alpha). */
function oceanGeometry() {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const RAD = R_GROUND;
  const FOAM = new THREE.Color("#EEF2F3"), SHALLOW = new THREE.Color("#7FA2C4"), DEEP = new THREE.Color("#5A80AA");
  const rows = [-6, 10, 60, 400, 1500, 3200, 99999]; // metres from the coastline
  const steps = rows.length - 1;
  const cols: number[] = [];
  for (let i = 0; i <= 200; i++) {
    const th = Math.atan2(N.y, N.x) + ((i / 200) * 2 - 1) * 1.12;
    const dx = Math.cos(th), dz = Math.sin(th);
    // march out to the coast
    let rc = -1;
    for (let rr = 1500; rr < RAD; rr += 25) if (sea(dx * rr, dz * rr) > 0) { rc = rr; break; }
    if (rc < 0) { cols.push(-1); continue; }
    cols.push(pos.length / 3);
    for (let k = 0; k <= steps; k++) {
      const rr = Math.min(RAD, rc + rows[k]);
      pos.push(dx * rr, -0.02, dz * rr);
      const fr = Math.min(1, Math.max(0, (rr - R_FADE) / (R_GROUND - R_FADE)));
      const c = k === 0 ? FOAM : k === 1 ? SHALLOW : DEEP;
      col.push(c.r, c.g, c.b, k === steps ? 0 : (k === 0 ? 0.9 : 1) * (1 - fr * fr * (3 - 2 * fr)));
    }
  }
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i], b = cols[i + 1];
    if (a < 0 || b < 0) continue;
    for (let k = 0; k < steps; k++) idx.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  const n = new Float32Array(pos.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  return g;
}

/** Window grid for the night: warm lit cells on black (roofs map to the black corner). */
function windowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128);
  const r = rng(7);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 6; x++) {
    if (r() < 0.3) { g.fillStyle = r() < 0.5 ? "#FFD49A" : "#FFE6C2"; g.fillRect(6 + x * 19, 6 + y * 14, 10, 6); }
  }
  g.fillStyle = "#000"; g.fillRect(112, 112, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const PALETTE = [
  "#F5F3EE", "#F2F0EA", "#EFEDE7", "#F4EFE4", "#F1EBDD", "#ECE3D1", "#E8DCC4", "#E3D3B5",
  "#DCC8A6", "#E9E1D3", "#F3F1EC", "#EEF0F2", "#D6E1EA", "#D9C2AE", "#F0EEE8", "#E5D7C0",
].map((h) => new THREE.Color(h));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function Blocks({ items, mat, geo, shadow = false, colors = true }: { items: Bx[]; mat: THREE.Material; geo: THREE.BufferGeometry; shadow?: boolean; colors?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.h / 2, b.z), _q, _s.set(b.w, b.h, b.d));
      m.setMatrixAt(i, _m);
      if (colors) m.setColorAt(i, PALETTE[Math.floor(b.c * PALETTE.length) % PALETTE.length]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, colors]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow={shadow} />;
}

// ---------------------------------------------------------------- component
export function CityContent() {
  const P = plan();
  const res = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    // roof / floor faces → black corner of the window texture (no lit windows on roofs)
    const uv = box.attributes.uv as THREE.BufferAttribute;
    for (let i = 8; i < 16; i++) uv.setXY(i, 0.97, 0.03);
    const win = windowTexture();
    const bld = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.88, emissive: "#FFFFFF", emissiveMap: win, emissiveIntensity: 0 });
    const sign = new THREE.MeshStandardMaterial({ color: "#3E62C4", emissive: "#3E62C4", emissiveIntensity: 0.25, roughness: 0.4 });
    const streets = streetGeometry(P.segs);
    const street = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    const ground = groundGeometry();
    const gtex = groundTexture(P.parks);
    const groundMat = new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.97 });
    const rim = rimGeometry();
    const rimMat = new THREE.MeshStandardMaterial({ map: gtex, vertexColors: true, transparent: true, roughness: 0.97, depthWrite: false });
    const ocean = oceanGeometry();
    const oceanMat = new THREE.MeshStandardMaterial({ color: "#FFFFFF", vertexColors: true, transparent: true, roughness: 0.32, metalness: 0.08, depthWrite: false, envMapIntensity: 1.2 });
    const tree = new THREE.IcosahedronGeometry(1, 0);
    const treeMat = new THREE.MeshStandardMaterial({ color: "#A3B99E", roughness: 0.9, flatShading: true });
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#C4B8A6", roughness: 0.9 });
    const palmMat = new THREE.MeshStandardMaterial({ color: "#8FAE93", roughness: 0.85, flatShading: true });
    const car = new THREE.BoxGeometry(1.9, 1.45, 4.4);
    const carMat = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.45, metalness: 0.15 });
    const mosque = new THREE.MeshStandardMaterial({ color: "#F2EDE3", roughness: 0.8, emissive: "#FFD9A6", emissiveIntensity: 0 });
    const roofGreen = new THREE.MeshStandardMaterial({ color: "#8FB0A3", roughness: 0.7 });
    const decals = decalGeometry(P.decals);
    const decalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const tank = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 10);
    const unit = new THREE.BoxGeometry(2.2, 1.1, 1.5);
    const dish = new THREE.CylinderGeometry(0.55, 0.3, 0.12, 12);
    const roofMat = new THREE.MeshStandardMaterial({ color: "#E4E6EA", roughness: 0.7, metalness: 0.1 });
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 7, 6);
    const tramBody = new THREE.BoxGeometry(32, 2.4, 2.6);
    const tramBand = new THREE.BoxGeometry(31.4, 0.8, 2.64);
    const tramMat = new THREE.MeshStandardMaterial({ color: "#F4F5F7", roughness: 0.4, metalness: 0.1 });
    const tramGlass = new THREE.MeshStandardMaterial({ color: "#2E3646", roughness: 0.2, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#3A3F48", roughness: 0.6 });
    const all: THREE.Material[] = [bld, sign, street, decalMat, roofMat, tramMat, tramGlass, darkMat, groundMat, rimMat, oceanMat, treeMat, trunkMat, palmMat, carMat, mosque, roofGreen];
    for (const m of all) m.userData.base = m.opacity;
    return { decals, decalMat, tank, unit, dish, roofMat, pole, tramBody, tramBand, tramMat, tramGlass, darkMat, box, win, bld, sign, streets, street, ground, gtex, groundMat, rim, rimMat, ocean, oceanMat, tree, treeMat, trunk, trunkMat, palmMat, car, carMat, mosque, roofGreen, all };
  }, [P]);
  useEffect(() => () => {
    for (const k of ["box", "streets", "ground", "rim", "ocean", "tree", "trunk", "car", "decals", "tank", "unit", "dish", "pole", "tramBody", "tramBand"] as const) res[k].dispose();
    res.win.dispose(); res.gtex.dispose(); res.all.forEach((m) => m.dispose());
  }, [res]);

  // trees (parks + roundabouts), palms
  const treeItems = useMemo<Bx[]>(() => P.trees.map(([x, z, s]) => ({ x, z, w: 3.4 * s, d: 3.4 * s, h: 0, yaw: x, c: 0 })), [P]);
  const palmItems = useMemo(() => P.palms, [P]);
  const streetTreeItems = useMemo<Bx[]>(() => P.streetTrees.map(([x, z], i) => ({ x, z, w: 2.6 + (i % 3) * 0.4, d: 2.6 + (i % 3) * 0.4, h: 0, yaw: x, c: 0 })), [P]);
  const roofItems = useMemo(() => [0, 1, 2].map((k) => P.roofs.filter((r) => r.k === k).map((r) => {
    const hh = k === 0 ? 1.5 : k === 1 ? 1.1 : 0.12;
    return { x: r.x, z: r.z, w: r.s, d: r.s, h: hh * r.s, yaw: r.x * 0.7, c: 0, y0: r.y + (k === 2 ? 0.8 : 0) };
  })), [P]);
  const poleItems = useMemo(() => P.poles.map(([x, z]) => ({ x, z })), [P]);
  const TRAMS = P.tram ? 3 : 0;
  const tramState = useMemo(() => Array.from({ length: TRAMS }, (_, i) => ({ s: i / TRAMS, dir: i % 2 ? -1 : 1 })), [TRAMS]);
  const tramRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  // Hassan II-like mosque on the shore, facing the ocean (prayer hall + minaret ~200 m)
  const mosque = useMemo(() => {
    const t = -260; // along the coast, a little south-west of the axis
    const base = COAST + wiggle(t) + 25;
    const x = N.x * base + T.x * t, z = N.y * base + T.y * t;
    const yaw = Math.atan2(T.x, T.y);
    return { x, z, yaw };
  }, []);

  // cars on the boulevards
  const CARS = 360;
  const cars = useMemo(() => {
    const r = rng(99);
    if (!P.lanes.length) return [];
    return Array.from({ length: CARS }, () => {
      const lane = Math.floor(r() * P.lanes.length);
      return { lane, s: r(), v: (7 + r() * 5) * (r() < 0.5 ? 1 : -1), c: r() };
    });
  }, [P]);
  const carRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = carRef.current;
    if (!m) return;
    const pal = ["#F4F5F7", "#C9CED8", "#8F98AA", "#4C5568", "#E6E1D8", "#B8C3D6"].map((h) => new THREE.Color(h));
    cars.forEach((c, i) => m.setColorAt(i, pal[Math.floor(c.c * pal.length)]));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3000);
  }, [cars]);

  const group = useRef<THREE.Group>(null), detail = useRef<THREE.Group>(null), trees = useRef<THREE.Group>(null);
  const lastOp = useRef(-1);
  useFrame((_, dt) => {
    const alt = frame.alt;
    const op = 1 - fadeIn(alt, 25_000, 60_000);
    if (group.current) group.current.visible = op > 0.005;
    if (op <= 0.005) return;
    if (Math.abs(op - lastOp.current) > 0.003) {
      lastOp.current = op;
      for (const m of res.all) {
        const tr = op < 0.999 || m === res.rimMat || m === res.oceanMat;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = (m.userData.base ?? 1) * op;
      }
    }
    if (detail.current) detail.current.visible = alt < 2000;
    if (trees.current) trees.current.visible = alt < 4500;
    // night: lit windows follow the hospital's time-lapse
    const night = 1 - rt.day;
    res.bld.emissiveIntensity = night * 0.85;
    res.mosque.emissiveIntensity = night * 0.35;
    // trams (slow, along the main boulevard)
    if (P.tram && alt < 2500) {
      const L = Math.hypot(P.tram.x1 - P.tram.x0, P.tram.z1 - P.tram.z0);
      tramState.forEach((tr, i) => {
        tr.s = (tr.s + (tr.dir * 5.5 * Math.min(dt, 0.1)) / L + 1) % 1;
        const x = P.tram!.x0 + (P.tram!.x1 - P.tram!.x0) * tr.s, z = P.tram!.z0 + tr.dir * 1.6;
        _q.setFromAxisAngle(_y, 0);
        _m.compose(_v.set(x, 1.75, z), _q, _s.set(1, 1, 1)); tramRefs.current[0]?.setMatrixAt(i, _m);
        _m.compose(_v.set(x, 2.25, z), _q, _s.set(1, 1, 1)); tramRefs.current[1]?.setMatrixAt(i, _m);
      });
      tramRefs.current.forEach((mm) => { if (mm) mm.instanceMatrix.needsUpdate = true; });
    }
    // cars
    const m = carRef.current;
    if (m && alt < 2000) {
      const step = Math.min(dt, 0.1);
      cars.forEach((c, i) => {
        const L = P.lanes[c.lane];
        const len = Math.hypot(L.x1 - L.x0, L.z1 - L.z0) || 1;
        c.s = (c.s + (c.v * step) / len + 1) % 1;
        const ux = (L.x1 - L.x0) / len, uz = (L.z1 - L.z0) / len;
        const off = c.v > 0 ? 4.5 : -4.5; // right-hand traffic
        const x = L.x0 + (L.x1 - L.x0) * c.s - uz * off, z = L.z0 + (L.z1 - L.z0) * c.s + ux * off;
        _q.setFromAxisAngle(_y, Math.atan2(ux, uz) + (c.v > 0 ? 0 : Math.PI));
        _m.compose(_v.set(x, 0.8, z), _q, _s.set(1, 1, 1));
        m.setMatrixAt(i, _m);
      });
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={res.ground} material={res.groundMat} position={[0, -0.3, 0]} receiveShadow raycast={() => null} />
      <mesh geometry={res.rim} material={res.rimMat} position={[0, -0.3, 0]} renderOrder={-2} raycast={() => null} />
      <mesh geometry={res.ocean} material={res.oceanMat} renderOrder={-1} raycast={() => null} />
      <mesh geometry={res.streets} material={res.street} receiveShadow raycast={() => null} />
      <mesh geometry={res.decals} material={res.decalMat} receiveShadow raycast={() => null} />
      <Blocks items={P.boxes} mat={res.bld} geo={res.box} />
      <Blocks items={P.near} mat={res.bld} geo={res.box} shadow />
      <Blocks items={P.signs} mat={res.sign} geo={res.box} colors={false} />
      <group ref={trees}>
        <Trees items={treeItems} geo={res.tree} mat={res.treeMat} />
        <Trees items={streetTreeItems} geo={res.tree} mat={res.treeMat} />
      </group>
      <group ref={detail}>
        <Props items={roofItems[0]} geo={res.tank} mat={res.roofMat} />
        <Props items={roofItems[1]} geo={res.unit} mat={res.roofMat} />
        <Props items={roofItems[2]} geo={res.dish} mat={res.roofMat} />
        <Blocks items={P.parked} mat={res.carMat} geo={res.car} colors />
        {poleItems.length > 0 && <Props items={poleItems.map((p) => ({ ...p, w: 1, d: 1, h: 1, yaw: 0, c: 0, y0: 3.5 }))} geo={res.pole} mat={res.darkMat} unit />}
        {P.tram && (
          <>
            {[-1.6, 1.6].map((tz) => (
              <mesh key={tz} material={res.darkMat} position={[(P.tram!.x0 + P.tram!.x1) / 2, 6.1, P.tram!.z0 + tz]}>
                <boxGeometry args={[P.tram!.x1 - P.tram!.x0, 0.04, 0.04]} />
              </mesh>
            ))}
            <instancedMesh ref={(r) => { tramRefs.current[0] = r; }} args={[res.tramBody, res.tramMat, TRAMS]} frustumCulled={false} />
            <instancedMesh ref={(r) => { tramRefs.current[1] = r; }} args={[res.tramBand, res.tramGlass, TRAMS]} frustumCulled={false} />
          </>
        )}
        <Palms items={palmItems} trunk={res.trunk} trunkMat={res.trunkMat} crown={res.tree} crownMat={res.palmMat} />
        {cars.length > 0 && <instancedMesh ref={carRef} args={[res.car, res.carMat, cars.length]} frustumCulled={false} />}
      </group>
      {/* Hassan II-like mosque and minaret by the sea */}
      <group position={[mosque.x, 0, mosque.z]} rotation-y={mosque.yaw}>
        <mesh material={res.mosque} position={[0, 2.5, 0]} castShadow><boxGeometry args={[300, 5, 190]} /></mesh>
        <mesh material={res.mosque} position={[30, 16, 10]}><boxGeometry args={[190, 22, 100]} /></mesh>
        <mesh material={res.roofGreen} position={[30, 28.5, 10]}><boxGeometry args={[150, 3, 70]} /></mesh>
        <mesh material={res.mosque} position={[-95, 100, -40]}><boxGeometry args={[25, 200, 25]} /></mesh>
        <mesh material={res.roofGreen} position={[-95, 202, -40]}><boxGeometry args={[25.5, 4, 25.5]} /></mesh>
        <mesh material={res.mosque} position={[-95, 213, -40]}><boxGeometry args={[13, 18, 13]} /></mesh>
        <mesh material={res.roofGreen} position={[-95, 225, -40]}><coneGeometry args={[7, 8, 4]} /></mesh>
      </group>
    </group>
  );
}

type Prop = { x: number; z: number; w: number; d: number; h: number; yaw: number; c: number; y0: number };
/** Small instanced props sitting at y0 (roof items, poles). `unit` keeps the geometry's own size. */
function Props({ items, geo, mat, unit = false }: { items: Prop[]; geo: THREE.BufferGeometry; mat: THREE.Material; unit?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.y0 + (unit ? 0 : b.h / 2), b.z), _q, unit ? _s.set(1, 1, 1) : _s.set(b.w, b.w, b.d)); // uniform scale (geometry already in metres)
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, unit, geo]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />;
}

function Trees({ items, geo, mat }: { items: Bx[]; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.w * 0.9, b.z), _q, _s.set(b.w, b.w * 1.1, b.d));
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />;
}

function Palms({ items, trunk, trunkMat, crown, crownMat }: { items: [number, number][]; trunk: THREE.BufferGeometry; trunkMat: THREE.Material; crown: THREE.BufferGeometry; crownMat: THREE.Material }) {
  const t = useRef<THREE.InstancedMesh>(null), c = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mt = t.current, mc = c.current;
    if (!mt || !mc) return;
    const r = rng(5);
    items.forEach(([x, z], i) => {
      const h = 7 + r() * 2.5;
      _q.identity();
      _m.compose(_v.set(x, h / 2, z), _q, _s.set(1, h, 1));
      mt.setMatrixAt(i, _m);
      _q.setFromAxisAngle(_y, r() * 6);
      _m.compose(_v.set(x, h + 0.2, z), _q, _s.set(2.6, 0.7, 2.6));
      mc.setMatrixAt(i, _m);
    });
    mt.instanceMatrix.needsUpdate = true; mc.instanceMatrix.needsUpdate = true;
    mt.computeBoundingSphere(); mc.computeBoundingSphere();
  }, [items]);
  return (
    <>
      <instancedMesh ref={t} args={[trunk, trunkMat, items.length]} castShadow />
      <instancedMesh ref={c} args={[crown, crownMat, items.length]} castShadow />
    </>
  );
}
