"use client";
// MIBTECH's building (Casa réel only), boulevard Mahdi Elmandjra (ex Rue des Papillons), L'Oasis.
// Sources (docs/research/mibtech-identification.md, mibtech-interieur-phase-A.md):
//   · the three office floors, their footprint, walls, windows, partitions, doors, columns, stair and lift: the architect's
//     dimensioned plans (MB Interior Architects, « plan cotation » APS, 16/10/2024) → mibtech/mibtechPlanData.ts (generated)
//     → mibtech/mibtechGeo.ts; the plans' footprint matches the roof seen on the overhead imagery (Esri World Imagery z19);
//   · the street front (no plan of it): three street photos supplied by the user (Google Maps, Feb. and Jul. 2025), REFERENCES
//     only — procedural surfaces, no shop sign: navy-blue curtain wall, folded aluminium fins, the cantilever over the street,
//     the ground floor (stone plinth, neutral shopfronts, service door) and the office entrance (fluted anthracite portal).
// Heights are provisional (mibtechGeo MB_H): ground floor 4.6 m, 3.8 m floor to floor, roof at 16 m.
// Placement: the plans' frame (x along the street front, z towards the street, origin = middle of the façade glass) is set
// on the front line found earlier from the Google pins and the overhead view, the boulevard's bearing 40°.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frame } from "@/lib/world";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade } from "./shared";
import { MB_CANT, MB_H, MB_OUTLINE, MB_PORTAL, MB_TOP, buildMibtech, floorY, inOutline, type MbFloor, type MbMat } from "./mibtech/mibtechGeo";
import { MIBTECH_PLANS } from "./mibtech/mibtechPlanData";
import { CENTER, MB_NEAR, MB_VIEW, ORIGIN, THETA, fromPlan, toPlan } from "./mibtech/mibtechFrame";
import { W } from "../../walk/state";
import MibtechPeople from "./mibtech/MibtechPeople";

export const MIBTECH_ID = "mibtech";
export { toPlan, fromPlan };
const GF = MB_H.ground, TOP = MB_TOP, FLOOR = MB_H.floor;
// street front in the plan frame: the façade glass of the floors (curtain wall element of the plans) and the ground floor
const FRONT = (() => { const c = MIBTECH_PLANS[2].curtain.reduce((a, P) => (P.length > a.length ? P : a), MIBTECH_PLANS[2].curtain[0]); const xs = c.map((q) => q[0]); return { x0: Math.min(...xs), x1: Math.max(...xs) }; })();
const PLATE = (() => { const xs = MB_OUTLINE.map((q) => q[0]); return { x0: Math.min(...xs), x1: Math.max(...xs) }; })();
const CANT = MB_CANT; // the ground floor's street wall, set back under the floors (photos; estimated)

// ---------------------------------------------------------------- procedural textures (canvas)
function canvas(w: number, h: number, f: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const rnd = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** curtain wall: one tile = 3 m × one floor (3.8 m): two 1.5 m bays, a floor band, a transom at 1.1 m */
const GLASS_TILE: [number, number] = [3, FLOOR];
function glassTex(night: boolean) {
  return canvas(256, 324, (g) => {
    const W = 256, H = 324, px = H / FLOOR;
    if (night) { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); }
    else { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, "#2F4677"); gr.addColorStop(0.55, "#3B5590"); gr.addColorStop(1, "#283C66"); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    for (let b = 0; b < 2; b++) {
      const x0 = (b * W) / 2;
      if (night) { if (rnd(b * 7.3) > 0.45) { g.fillStyle = `rgba(255,${226 + 20 * rnd(b)},${180 + 40 * rnd(b + 2)},0.9)`; g.fillRect(x0 + 4, 0.75 * px, W / 2 - 8, H - 0.9 * px); } }
      else { g.fillStyle = "rgba(190,210,240,0.16)"; g.fillRect(x0 + 6, 0.8 * px, (W / 2) * 0.35, H - px); }
    }
    if (night) return;
    g.fillStyle = "#4A525E"; // mullions and transoms (dark grey aluminium)
    for (const x of [0, W / 2, W - 3]) g.fillRect(x, 0, 4, H);
    g.fillRect(0, H - 0.55 * px, W, 0.55 * px); // floor band (spandrel)
    g.fillStyle = "#2A3039"; g.fillRect(0, H - 1.65 * px, W, 4); // transom
  });
}
const STONE_TILE: [number, number] = [2.4, 1.2];
function stoneTex() {
  return canvas(256, 128, (g) => {
    g.fillStyle = "#BDB8AE"; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 900; i++) { const v = 150 + 50 * rnd(i); g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.25)`; g.fillRect(256 * rnd(i + 1), 128 * rnd(i + 2), 2, 2); }
    g.fillStyle = "#99948A"; g.fillRect(0, 0, 256, 2); g.fillRect(0, 64, 256, 2); g.fillRect(0, 0, 2, 64); g.fillRect(128, 64, 2, 64);
  });
}
const FLUTE_TILE: [number, number] = [0.96, 2];
function fluteTex() {
  return canvas(256, 64, (g) => {
    g.fillStyle = "#3A4048"; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 16; i++) { const x = i * 16; g.fillStyle = "#5A616B"; g.fillRect(x, 0, 6, 64); g.fillStyle = "#23272D"; g.fillRect(x + 11, 0, 3, 64); }
  });
}
const SHOP_TILE: [number, number] = [3, GF];
function shopTex(night: boolean) {
  return canvas(192, 294, (g) => {
    const W = 192, H = 294, px = H / GF;
    if (night) { g.fillStyle = "#000"; g.fillRect(0, 0, W, H); g.fillStyle = "rgba(255,236,205,0.85)"; g.fillRect(6, 1.2 * px, W - 12, H - 1.3 * px); return; }
    g.fillStyle = "#2C333D"; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0.5 * px, 0, H); gr.addColorStop(0, "rgba(235,215,185,0.55)"); gr.addColorStop(1, "rgba(120,105,90,0.35)");
    g.fillStyle = gr; g.fillRect(8, 1.3 * px, W - 16, H - 2.55 * px); // lit interior, neutral (no signs)
    g.fillStyle = "rgba(255,255,255,0.10)"; g.fillRect(14, 1.3 * px, 22, H - 2.55 * px);
    g.fillStyle = "#111418"; g.fillRect(0, 0, 6, H); g.fillRect(W - 6, 0, 6, H); g.fillRect(0, H - 1.25 * px, W, 6); g.fillRect(0, 0, W, 0.5 * px);
  });
}

// ---------------------------------------------------------------- geometry helpers (UV in metres / tile)
type Acc = { pos: number[]; nor: number[]; uv: number[]; idx: number[] };
const acc = (): Acc => ({ pos: [], nor: [], uv: [], idx: [] });
/** vertical quad from (x0,z0) to (x1,z1), y0 → y1, facing the side given by `out` (the normal points to the right of a→b when out = 1) */
function wall(a: Acc, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, tile: [number, number], out = 1, u0 = 0) {
  const L = Math.hypot(x1 - x0, z1 - z0), nx = ((z1 - z0) / L) * out, nz = (-(x1 - x0) / L) * out, o = a.pos.length / 3;
  a.pos.push(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0);
  for (let k = 0; k < 4; k++) a.nor.push(nx, 0, nz);
  const u1 = u0 + L / tile[0];
  a.uv.push(u0, y0 / tile[1], u1, y0 / tile[1], u1, y1 / tile[1], u0, y1 / tile[1]);
  if (out > 0) a.idx.push(o, o + 2, o + 1, o, o + 3, o + 2); else a.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
}
/** horizontal rectangle at y (facing up or down) */
function flat(a: Acc, x0: number, z0: number, x1: number, z1: number, y: number, up = true, tile: [number, number] = [4, 4]) {
  const o = a.pos.length / 3, n = up ? 1 : -1;
  a.pos.push(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1);
  for (let k = 0; k < 4; k++) a.nor.push(0, n, 0);
  a.uv.push(x0 / tile[0], z0 / tile[1], x1 / tile[0], z0 / tile[1], x1 / tile[0], z1 / tile[1], x0 / tile[0], z1 / tile[1]);
  if (up) a.idx.push(o, o + 2, o + 1, o, o + 3, o + 2); else a.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
}
/** a closed box of 4 walls + top (local, axis-aligned) */
function boxWalls(a: Acc, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, tile: [number, number], top = true) {
  wall(a, x0, z1, x1, z1, y0, y1, tile, -1); // +z face
  wall(a, x1, z0, x0, z0, y0, y1, tile, -1); // −z face
  wall(a, x1, z1, x1, z0, y0, y1, tile, -1); // +x face
  wall(a, x0, z0, x0, z1, y0, y1, tile, -1); // −x face
  if (top) flat(a, x0, z0, x1, z1, y1, true, tile);
}
function geo(a: Acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(a.nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(a.uv, 2));
  g.setIndex(a.idx); g.computeBoundingSphere();
  return g;
}

/** the folded fins: each blade is three facets turned at different angles (a slow wave along the façade) */
function fins(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const blade = (x: number, z: number, faceYaw: number, i: number) => {
    const y0 = GF - 0.7, yTop = TOP + 0.5 + 0.8 * (0.5 + 0.5 * Math.sin(i * 0.37)), segs = [0, 0.38, 0.72, 1];
    for (let s = 0; s < 3; s++) {
      const a = y0 + (yTop - y0) * segs[s], b = y0 + (yTop - y0) * segs[s + 1];
      // turned ≈ 22° off the perpendicular, ±17° along a slow wave, each facet differently: seen from the street the glass shows
      // between the blades (photo 1), seen from below their broad faces catch the light (photo 3)
      const twist = 0.38 + 0.3 * Math.sin(i * 0.42 + s * 1.15) + 0.1 * Math.sin(i * 1.7 + s);
      const g = new THREE.BoxGeometry(0.05, b - a + 0.04, 0.7);
      g.rotateY(faceYaw + twist);
      g.translate(x, (a + b) / 2, z);
      parts.push(g);
    }
  };
  const pitch = 1.0, off = 0.6;
  let i = 0;
  for (let x = PLATE.x0 + 0.45; x <= PLATE.x1 - 0.3; x += pitch) blade(x, off, 0, i++);   // street front
  for (let z = -0.5; z >= -6.5; z -= pitch) blade(PLATE.x0 - off, z, Math.PI / 2, i++);  // around the south-west corner
  const m = mergeGeometries(parts)!; parts.forEach((p) => p.dispose());
  return m;
}

/** the street front from the photos (plan frame): curtain wall skin, cantilever, ground floor, office entrance, roof plant room */
function front() {
  const glass = acc(), stone = acc(), flute = acc(), shop = acc(), dark = acc(), render = acc(), door = acc(), entryDoor = acc(), entryGlass = acc();
  const zs = -CANT, X0 = PLATE.x0, X1 = PLATE.x1;
  wall(glass, FRONT.x0, 0.04, FRONT.x1, 0.04, GF, TOP, GLASS_TILE, -1);   // navy skin over the plans' glazed front (seen from outside)
  flat(dark, X0, zs, X1, 0.04, GF, false);                                // soffit of the cantilever
  wall(dark, X0, 0.05, X1, 0.05, GF - 0.45, GF, [4, 4], -1);              // slab edge
  // ground floor along the street (south-west → north-east), set back under the floors
  wall(stone, X0, zs, X0 + 6, zs, 0, GF, STONE_TILE, -1);
  wall(door, X0 + 3.2, zs + 0.02, X0 + 4.8, zs + 0.02, 0, 2.4, [1.6, 2.4], -1); // service door
  wall(shop, X0 + 6, zs, X0 + 12, zs, 0, GF, SHOP_TILE, -1);
  wall(stone, X0 + 12, zs, X0 + 12.6, zs, 0, GF, STONE_TILE, -1);
  wall(shop, X0 + 12.6, zs, X1 - 8.5, zs, 0, GF, SHOP_TILE, -1);
  wall(flute, X1 - 8.5, zs, X1 - 7, zs, 0, GF, FLUTE_TILE, -1);
  // office entrance: portal recessed 2 m, fluted anthracite, glazed door + transom, granite step (photo 2)
  const { zb, a, b, d0, d1 } = MB_PORTAL;
  wall(flute, a, zb, d0, zb, 0, GF, FLUTE_TILE, -1);                         // the back of the portal, round the door opening
  wall(flute, d1, zb, b, zb, 0, GF, FLUTE_TILE, -1, d1 - a);
  wall(flute, d0, zb, d1, zb, MB_PORTAL.door, GF, FLUTE_TILE, -1, d0 - a);
  wall(flute, a, zs, a, zb, 0, GF, FLUTE_TILE, -1);
  wall(flute, b, zb, b, zs, 0, GF, FLUTE_TILE, -1);
  flat(dark, a, zb, b, zs, GF - 0.32, false);
  // the glazed door (hidden — open — while someone walks in MIBTECH)
  wall(entryDoor, d0, zb + 0.02, d1, zb + 0.02, 0.15, MB_PORTAL.door, [2, 4], -1);
  wall(entryGlass, d0 + 0.12, zb + 0.04, d1 - 0.12, zb + 0.04, 0.15, 2.75, [1.76, GF], -1);
  wall(entryGlass, d0 + 0.12, zb + 0.04, d1 - 0.12, zb + 0.04, 2.87, 3.88, [1.76, GF], -1, 0.3);
  boxWalls(dark, a, zb, b, 0, 0, 0.15, [4, 4]);
  wall(stone, b, zs, X1, zs, 0, GF, STONE_TILE, -1);
  // roof: stair exit / plant room over the core
  const sb = MIBTECH_PLANS[2].stair_meta.box;
  boxWalls(render, sb[0][0], sb[0][1], sb[1][0], sb[1][1], TOP, TOP + 3, [4, 4]);
  return { glass: geo(glass), stone: geo(stone), flute: geo(flute), shop: geo(shop), dark: geo(dark), render: geo(render), door: geo(door), entryDoor: geo(entryDoor), entryGlass: geo(entryGlass), fins: fins() };
}

/** Walk-mode solids (world): the footprint as 2 m cells (each pushed as the AABB of its rotated square). */
export function mibtechSolids(): Solid[] {
  const out: Solid[] = [], c = 2;
  const xs = MB_OUTLINE.map((q) => q[0]), zs = MB_OUTLINE.map((q) => q[1]);
  for (let x = Math.min(...xs); x < Math.max(...xs); x += c)
    for (let z = Math.min(...zs); z < Math.max(...zs); z += c) {
      if (!inOutline(MB_OUTLINE, x + c / 2, z + c / 2)) continue;
      const pts = [[x, z], [x + c, z], [x, z + c], [x + c, z + c]].map(([a, b]) => fromPlan(a, b));
      out.push({ x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])), z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])), h: TOP });
    }
  return out;
}
/** The city layer must not draw the older OSM villas on the building's footprint (scene point, 1 m margin). */
export function mibtechCovers(x: number, z: number) {
  const [px, pz] = toPlan(x, z);
  return inOutline(MB_OUTLINE, px, pz) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => inOutline(MB_OUTLINE, px + a, pz + b));
}
/** label height above the ground */
export const MIBTECH_TOP = TOP;

/** Floor view (explore mode): 0 = the whole building; 1 … 3 = that floor open, the floors above, the roof and the street-front
 *  dressing hidden (no geometry duplicated: groups shown / hidden). Reset when MIBTECH is no longer selected. */
export { MB_VIEW };
export function mibtechShowFloor(f: 0 | MbFloor) {
  MB_VIEW.floor = f;
  const c = fromPlan(0, -14.5);
  if (f) rig.flyTo(new THREE.Vector3(c[0], floorY(f) + 1.2, c[1]), 46, { polar: 0.78, azimuth: THETA + 0.35, duration: 1.4 });
  else rig.flyTo(new THREE.Vector3(c[0], 8, c[1]), 95, { polar: 0.98, azimuth: THETA + 0.4, duration: 1.4 });
}

// ---------------------------------------------------------------- interior finishes (office photos supplied by the user)
// The photos are REFERENCES only (nothing traced, no photo texture, no brand): large light-grey veined marble-look floor tiles
// (≈ 60 × 120 cm), white walls with a slim light-grey skirting, a 60 × 60 suspended ceiling with LED panels and air diffusers,
// dark wood-veneer doors, glazed partitions in thin black frames with a frosted film of wavy vertical lines, greige desk tops on
// black legs with black screens and drawer units, black mesh chairs, a grey-green carpet in the meeting rooms, white gloss
// kitchenette with a walnut worktop, grey tiles and white render on the terrace.
// Where each finish applies is not documented room by room: carpet in the rooms of the meeting tables (mibtechGeo carpet()),
// the corridor / office finish everywhere else (WC marble and micro-cement walls not placed).
/** floor tiles, one texture = 1.2 m: two 0.6 × 1.2 m tiles, thin joints, a slight variation per tile */
function tileTex(base: [number, number, number], cols: number, rows: number, joint: string, seed: number, veins = false) {
  return canvas(256, 256, (g) => {
    const w = 256 / cols, h = 256 / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const v = (rnd(seed + i * 7 + j * 13) - 0.5) * 10;
      g.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`; g.fillRect(i * w, j * h, w, h);
      for (let n = 0; n < 60; n++) { // speckle
        g.fillStyle = `rgba(255,255,255,${rnd(seed + n + i * 31 + j * 57) * 0.05})`;
        g.fillRect(i * w + rnd(n * 3 + seed + i) * w, j * h + rnd(n * 5 + seed + j) * h, 6 + rnd(n) * 14, 1.5);
      }
      if (veins) for (let n = 0; n < 3; n++) { // marble-look veining (photos): thin grey meanders
        const r0 = rnd(seed * 3 + i * 11 + j * 17 + n * 5);
        g.strokeStyle = `rgba(120,118,112,${0.18 + r0 * 0.2})`; g.lineWidth = 0.6 + r0 * 1.1;
        g.beginPath();
        let px = i * w + rnd(n + i * 7 + seed) * w, py = j * h;
        g.moveTo(px, py);
        for (let k = 1; k <= 6; k++) { px += (rnd(n * 13 + k * 3 + i + seed) - 0.5) * w * 0.5; g.lineTo(Math.min(i * w + w, Math.max(i * w, px)), j * h + (h * k) / 6); }
        g.stroke();
      }
    }
    g.strokeStyle = joint; g.lineWidth = 1.6;
    for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo(i * w, 0); g.lineTo(i * w, 256); g.stroke(); }
    for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(0, j * h); g.lineTo(256, j * h); g.stroke(); }
  });
}
/** suspended ceiling, one texture = 2.4 m: 4 × 4 tiles of 0.6 m, two LED panels and an air-conditioning diffuser */
function ceilingTex(emit: boolean) {
  return canvas(256, 256, (g) => {
    const t = 64;
    // emissive map: the tiles glow softly (a ceiling is lit from below, the sun never reaches it), the LED panels fully
    g.fillStyle = emit ? "#C9C8C5" : "#F6F6F4"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = emit ? "#8A8884" : "#CFCBC3"; g.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * t); g.lineTo(256, i * t); g.stroke(); }
    for (const [i, j] of [[0, 1], [2, 3]]) { g.fillStyle = emit ? "#FFFFFF" : "#FBFBF6"; g.fillRect(i * t + 4, j * t + 4, t - 8, t - 8); }
    if (!emit) { g.fillStyle = "#DAD7D0"; g.fillRect(2 * t + 14, 1 * t + 14, t - 28, t - 28); g.strokeStyle = "#B9B5AC"; g.lineWidth = 1; for (let k = 0; k < 4; k++) g.strokeRect(2 * t + 18 + k * 4, t + 18 + k * 4, t - 36 - k * 8, t - 36 - k * 8); }
  });
}
/** wood veneer (doors, WC cubicles), one texture = 2.2 m: vertical grain, dark warm brown (photos) */
function veneerTex() {
  return canvas(128, 256, (g) => {
    g.fillStyle = "#7B4F33"; g.fillRect(0, 0, 128, 256);
    for (let x = 0; x < 128; x++) { g.fillStyle = `rgba(${rnd(x) > 0.5 ? "45,25,12" : "190,140,100"},${0.05 + rnd(x * 3) * 0.12})`; g.fillRect(x, 0, 1, 256); }
  });
}
/** painted wall, one texture = 4 m high measured from the floor: white, slim light-grey skirting (≈ 9 cm) */
function wallTex() {
  const t = canvas(16, 512, (g) => {
    g.fillStyle = "#EEEEEC"; g.fillRect(0, 0, 16, 512);
    const k = Math.round((0.09 / 4) * 512);
    g.fillStyle = "#BEBDB8"; g.fillRect(0, 512 - k, 16, k);
    g.fillStyle = "#A9A8A3"; g.fillRect(0, 512 - k, 16, 1);
  });
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}
/** frosted film on the glazed partitions (photos): frosted band of wavy vertical lines, clear glass at the foot and the head;
 *  one texture = 2.8 m along the wall × 2.8 m high from the floor (alpha: frosted ≈ 0.8, clear ≈ 0.1) */
function frostTex() {
  return canvas(256, 256, (g) => {
    g.clearRect(0, 0, 256, 256);
    g.fillStyle = "rgba(225,232,234,0.12)"; g.fillRect(0, 0, 256, 256);
    const top = 256 * (1 - 2.45 / 2.8), bot = 256 * (1 - 0.15 / 2.8);
    g.fillStyle = "rgba(240,245,246,0.95)"; g.fillRect(0, top, 256, bot - top);
    // clear wavy lines through the film: each a vertical line with one or two soft S-bends
    g.globalCompositeOperation = "destination-out";
    for (let n = 0; n < 22; n++) {
      let x = rnd(n * 7.3) * 256;
      const wdt = 0.8 + rnd(n * 3.1) * (rnd(n * 5.7) > 0.8 ? 6 : 1.6);
      g.lineWidth = wdt; g.strokeStyle = "rgba(0,0,0,0.7)";
      g.beginPath(); g.moveTo(x, top);
      const bends = 1 + Math.floor(rnd(n * 9.1) * 2);
      for (let k = 1; k <= bends; k++) {
        const y = top + ((bot - top) * k) / (bends + 1), dx = (rnd(n * 2.2 + k) - 0.5) * 22;
        g.lineTo(x, y - 14); g.bezierCurveTo(x, y, x + dx, y, x + dx, y + 14); x += dx;
      }
      g.lineTo(x, bot); g.stroke();
    }
    g.globalCompositeOperation = "source-over";
  });
}
/** brushed stainless steel (lift doors, speed gates), one texture = 1.2 m: fine horizontal brushing, soft reflection bands */
function steelTex() {
  return canvas(64, 256, (g) => {
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, "#A7ADB3"); gr.addColorStop(0.5, "#D5D9DD"); gr.addColorStop(1, "#9AA0A7");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y++) { g.fillStyle = `rgba(${rnd(y) > 0.5 ? "255,255,255" : "60,64,70"},${0.04 + rnd(y * 7) * 0.06})`; g.fillRect(0, y, 64, 1); }
  });
}
/** wood panelling (lobby photo): warm brown, long vertical grain, large panels with dark seams; one texture = 2.4 m */
function panelTex() {
  return canvas(128, 256, (g) => {
    g.fillStyle = "#8A5E3C"; g.fillRect(0, 0, 128, 256);
    for (let x = 0; x < 128; x++) { g.fillStyle = `rgba(${rnd(x * 1.3) > 0.5 ? "60,35,18" : "200,150,105"},${0.05 + rnd(x * 5) * 0.14})`; g.fillRect(x, 0, 1, 256); }
    for (let n = 0; n < 14; n++) { g.strokeStyle = "rgba(70,42,22,0.25)"; g.lineWidth = 1; g.beginPath(); const x = rnd(n * 9) * 128; g.moveTo(x, 0); g.bezierCurveTo(x + 8, 90, x - 8, 170, x + 4, 256); g.stroke(); }
    g.fillStyle = "rgba(40,24,12,0.8)"; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 1.5, 256); // seams
  });
}
/** black marble with white veins (lobby photo); one texture = 1.6 m */
function blackMarbleTex() {
  return canvas(256, 256, (g) => {
    g.fillStyle = "#121315"; g.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 9; n++) {
      g.strokeStyle = `rgba(235,235,232,${0.35 + rnd(n * 3) * 0.5})`; g.lineWidth = 0.6 + rnd(n * 5) * 1.8;
      g.beginPath(); let x = rnd(n * 7) * 256, y = 0; g.moveTo(x, y);
      while (y < 256) { x += (rnd(n * 11 + y) - 0.45) * 30; y += 14 + rnd(y + n) * 20; g.lineTo(x, y); }
      g.stroke();
    }
  });
}
/** carpet tiles (meeting room photo): mottled grey-green, one texture = 1 m */
function carpetTex() {
  return canvas(256, 256, (g) => {
    g.fillStyle = "#5D6056"; g.fillRect(0, 0, 256, 256);
    for (let n = 0; n < 5000; n++) {
      const v = rnd(n * 1.7);
      g.fillStyle = v > 0.5 ? `rgba(150,150,138,${(v - 0.5) * 0.5})` : `rgba(35,37,32,${v * 0.5})`;
      g.fillRect(rnd(n * 2.9) * 256, rnd(n * 4.3) * 256, 2 + rnd(n) * 3, 1 + rnd(n * 6.1) * 2);
    }
    g.strokeStyle = "rgba(40,42,36,0.35)"; g.lineWidth = 1; g.strokeRect(0.5, 0.5, 127, 127); g.strokeRect(128.5, 128.5, 127, 127); // 50 cm tiles
  });
}
function interiorMats(T: {
  floor: THREE.Texture; terrace: THREE.Texture; ceiling: THREE.Texture; ceilingE: THREE.Texture; veneer: THREE.Texture; wall: THREE.Texture; frost: THREE.Texture; carpet: THREE.Texture;
  steel: THREE.Texture; panel: THREE.Texture; blackMarble: THREE.Texture; marble: THREE.Texture;
}): Record<MbMat, THREE.MeshStandardMaterial> {
  const m = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive: color, emissiveIntensity: 0, ...o });
    if (mat.map && !mat.emissiveMap) { mat.emissiveMap = mat.map; mat.emissive.set("#FFFFFF"); } // the glow keeps the pattern
    return mat;
  };
  return {
    wall: m("#FFFFFF", { map: T.wall, emissive: "#E6E6E4" }), column: m("#FFFFFF", { map: T.wall, emissive: "#E6E6E4" }), partition: m("#FFFFFF", { map: T.wall, emissive: "#E6E6E4" }),
    cubicle: m("#FFFFFF", { map: T.veneer, emissive: "#7B4F33", roughness: 0.5 }),
    glass: m("#A9C4D6", { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false, emissiveIntensity: 0 }),
    frost: m("#FFFFFF", { map: T.frost, transparent: true, roughness: 0.3, depthWrite: false }),
    frame: m("#16181B", { roughness: 0.45, metalness: 0.5 }), door: m("#FFFFFF", { map: T.veneer, emissive: "#7B4F33", roughness: 0.55 }),
    floor: m("#FFFFFF", { map: T.floor, emissive: "#C9C8C4", roughness: 0.3 }), terrace: m("#FFFFFF", { map: T.terrace, emissive: "#9C9C99", roughness: 0.9 }),
    carpet: m("#FFFFFF", { map: T.carpet, emissive: "#5D6056", roughness: 1 }), walnut: m("#5C3A22", { roughness: 0.45 }),
    ceiling: m("#FFFFFF", { map: T.ceiling, emissiveMap: T.ceilingE, emissive: "#FFFFFF", roughness: 0.95 }), slabEdge: m("#DAD7D0"),
    lift: m("#FFFFFF", { map: T.steel, roughness: 0.3, metalness: 0.8, emissive: "#8E949B" }), roof: m("#C8C4BC", { roughness: 0.95 }), groundWall: m("#BDB8AE", { roughness: 0.82 }),
    stair: m("#36373A", { roughness: 0.35 }), rail: m("#121315", { roughness: 0.4, metalness: 0.6 }), // dark granite treads, black steel railing (photos)
    desk: m("#D7D0C5", { roughness: 0.5 }), chair: m("#1A1B1E", { roughness: 0.75 }), metal: m("#1E1F22", { roughness: 0.4, metalness: 0.5 }),
    panel: m("#B7AFA2", { roughness: 0.95 }), screen: m("#141518", { roughness: 0.25, metalness: 0.3 }), leaf: m("#4E7A3C", { roughness: 0.9 }), // greige desk screens (photos)
    steel: m("#FFFFFF", { map: T.steel, roughness: 0.32, metalness: 0.55, emissive: "#B5BABF" }), plaster: m("#F5F5F3", { roughness: 0.95 }),
    led: m("#2A0505", { emissive: "#FF2A1A", roughness: 0.4 }), ledStrip: m("#F4F7FF", { emissive: "#FFFFFF", roughness: 0.4 }), blueLed: m("#0A0F40", { emissive: "#3E5BFF", roughness: 0.4 }),
    marble: m("#FFFFFF", { map: T.marble, emissive: "#D6D8DB", roughness: 0.12, metalness: 0.05 }),
    woodPanel: m("#FFFFFF", { map: T.panel, emissive: "#8A5E3C", roughness: 0.5 }), blackMarble: m("#FFFFFF", { map: T.blackMarble, emissive: "#202124", roughness: 0.15 }),
    blind: m("#D8CFBF", { roughness: 0.95 }),
    pot: m("#B8B7B2", { roughness: 0.6 }), fabric: m("#8A8580", { roughness: 0.95 }), porcelain: m("#F7F7F5", { roughness: 0.15 }), cabinet: m("#EFECE6", { roughness: 0.2 }),
  };
}
/** interior light (provisional: the lighting plan is not supplied): the finishes glow a little, more at night; LED panels */
function lightInterior(P: Record<MbMat, THREE.MeshStandardMaterial>, night: number) {
  const k = 0.13 + night * 0.2;
  for (const [key, mat] of Object.entries(P) as [MbMat, THREE.MeshStandardMaterial][]) {
    if (key === "glass" || key === "roof" || key === "groundWall" || key === "terrace" || key === "slabEdge") continue;
    mat.emissiveIntensity = key === "ceiling" ? 0.75 + night * 0.25 : key === "frost" ? k * 1.5
      : key === "led" || key === "blueLed" ? 1.6 : key === "ledStrip" ? 1.2 : key === "steel" || key === "lift" ? 0.32 : key === "plaster" ? 0.3 : k;
  }
}

export function MibtechBuilding() {
  const res = useMemo(() => {
    const F = front(), B = buildMibtech();
    const T = {
      glass: glassTex(false), glassN: glassTex(true), stone: stoneTex(), flute: fluteTex(), shop: shopTex(false), shopN: shopTex(true),
      floor: tileTex([208, 207, 202], 2, 1, "rgba(150,148,142,0.55)", 3, true), terrace: tileTex([168, 168, 165], 2, 2, "rgba(90,90,88,0.6)", 9),
      ceiling: ceilingTex(false), ceilingE: ceilingTex(true), veneer: veneerTex(), wall: wallTex(), frost: frostTex(), carpet: carpetTex(),
      steel: steelTex(), panel: panelTex(), blackMarble: blackMarbleTex(), marble: tileTex([214, 216, 219], 2, 2, "rgba(150,152,156,0.45)", 21, true),
    };
    const M = {
      glass: new THREE.MeshStandardMaterial({ map: T.glass, emissiveMap: T.glassN, emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.14, metalness: 0.2, envMapIntensity: 1.2 }),
      stone: new THREE.MeshStandardMaterial({ map: T.stone, roughness: 0.82 }),
      flute: new THREE.MeshStandardMaterial({ map: T.flute, roughness: 0.55, metalness: 0.25 }),
      shop: new THREE.MeshStandardMaterial({ map: T.shop, emissiveMap: T.shopN, emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.12, metalness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: "#272B31", roughness: 0.7, metalness: 0.2 }),
      render: new THREE.MeshStandardMaterial({ color: "#D9D6CF", roughness: 0.9 }),
      door: new THREE.MeshStandardMaterial({ color: "#14181D", roughness: 0.2, metalness: 0.5 }),
      fin: new THREE.MeshStandardMaterial({ color: "#D6DADF", roughness: 0.38, metalness: 0.45, envMapIntensity: 1.1 }),
    };
    const P = interiorMats(T);
    // walk mode cut-away (third person): the visitor's floor is clipped at the cut height (walls, partitions, ceiling)
    const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
    for (const m of Object.values(P)) { m.clippingPlanes = [clip]; m.clipShadows = true; }
    return { F, B, T, M, P, clip };
  }, []);
  const list = useMemo(() => [...Object.values(res.M), ...Object.values(res.P)] as THREE.Material[], [res]);
  useEffect(() => () => {
    Object.values(res.F).forEach((g) => g.dispose()); Object.values(res.B).forEach((l) => l.forEach((p) => p.geo.dispose()));
    Object.values(res.T).forEach((t) => t.dispose()); list.forEach((m) => m.dispose());
  }, [res, list]);
  const root = useRef<THREE.Group>(null);
  const fade = useRef({ v: 1 });
  // dev (QA): __mibtech.show(f) shows the building up to floor f (0 = the whole building), for top views against the plans
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __mibtech?: unknown }).__mibtech = {
      root: () => root.current,
      show(f: number) {
        const g = root.current; if (!g) return;
        g.traverse((o) => {
          const m = /^mibtech\.(f(\d)|roof)$/.exec(o.name);
          if (m) o.visible = !f || (m[2] ? Number(m[2]) <= f : false);
          if (o instanceof THREE.Mesh && o.parent === g) o.visible = !f; // the street-front dressing
        });
      },
      origin: ORIGIN, theta: THETA,
    };
  }, []);
  const shown = useRef(-1);
  useFrame((state) => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    const sel = useApp.getState().sel;
    if (MB_VIEW.floor && !(sel?.kind === "landmark" && sel.id === MIBTECH_ID)) MB_VIEW.floor = 0;
    // walk mode inside MIBTECH (third person): the floors above the visitor cut away, like the floor view; the entrance
    // door open while walking there. Key = what is shown: floor view f (1…3), walk cut 10 + level, or 0 (whole building).
    const walking = W.phase !== "off" && W.site === "mibtech";
    // level of detail: the furnished floors only near the building (through its glass), in the floor view or on foot; far
    // away, a plain shell (key 30)
    const cam = state.camera.position, near = walking || MB_VIEW.floor > 0 || Math.hypot(cam.x - CENTER[0], cam.y, cam.z - CENTER[1]) < MB_NEAR;
    const key = walking && W.mbCut < 99 ? 10 + W.mbCut : walking ? 20 : !near ? 30 : MB_VIEW.floor;
    res.clip.constant = walking && W.mbCut < 99 && W.cutY < 1e5 ? W.cutY : 1e6;
    if (walking) state.gl.localClippingEnabled = true;
    if (shown.current !== key) {
      shown.current = key;
      const f = key >= 10 && key < 20 ? key - 10 : key >= 20 ? 0 : key, cut = key >= 10 && key < 20, far = key === 30;
      for (const o of g.children) {
        const m = /^mibtech\.(f|s)(\d)$/.exec(o.name);
        if (o.name === "mibtech.shell") o.visible = far;
        else if (far && m) o.visible = false;
        else if (o.name === "mibtech.ground") o.visible = true;
        else if (m) o.visible = cut ? Number(m[2]) <= f || (m[1] === "s" && Number(m[2]) === f + 1) : !f || Number(m[2]) <= f;
        else if (o.name === "mibtech.roof") o.visible = !f && !cut;
        else if (o.name === "mibtech.entry") o.visible = !walking && !f;
        else if (o.name !== "mibtech.ground") o.visible = !cut && !f; // the street-front dressing (photos)
      }
    }
    setFade(list.filter((m) => m !== res.P.glass && m !== res.P.frost), op, fade.current);
    lightInterior(res.P, ENV.night);
    res.M.glass.emissiveIntensity = ENV.night * 0.9; res.M.shop.emissiveIntensity = 0.28 + ENV.night * 0.6; // shops lit by day too (photos)
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); useApp.getState().select({ kind: "landmark", id: MIBTECH_ID }); };
  const { F, B, M, P } = res;
  return (
    <group ref={root} onClick={onClick} name="mibtech" position={[ORIGIN[0], 0, ORIGIN[1]]} rotation={[0, THETA, 0]}>
      {Object.entries(B).map(([grp, parts]) => (
        <group key={grp} name={`mibtech.${grp}`}>
          {parts.map((p) => <mesh key={p.key} geometry={p.geo} material={P[p.key]} castShadow={p.key === "wall" || p.key === "slabEdge" || p.key === "roof"} />)}
          {/^f\d$/.test(grp) && <MibtechPeople floor={Number(grp[1]) as MbFloor} />}
        </group>
      ))}
      <mesh geometry={F.glass} material={M.glass} />
      <group name="mibtech.plinth">
        <mesh geometry={F.stone} material={M.stone} castShadow receiveShadow />
        <mesh geometry={F.flute} material={M.flute} />
        <mesh geometry={F.shop} material={M.shop} />
        <mesh geometry={F.door} material={M.door} />
      </group>
      <mesh geometry={F.dark} material={M.dark} castShadow />
      <mesh geometry={F.render} material={M.render} castShadow />
      <group name="mibtech.entry">
        <mesh geometry={F.entryDoor} material={M.door} />
        <mesh geometry={F.entryGlass} material={M.shop} />
      </group>
      <mesh geometry={F.fins} material={M.fin} castShadow />
    </group>
  );
}
