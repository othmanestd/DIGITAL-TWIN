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
import { geoToScene } from "@/lib/geo/casaFrame";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade } from "./shared";
import { MB_H, MB_OUTLINE, MB_TOP, buildMibtech, floorY, inOutline, type MbFloor, type MbMat } from "./mibtech/mibtechGeo";
import { MIBTECH_PLANS } from "./mibtech/mibtechPlanData";

export const MIBTECH_ID = "mibtech";
const ROOF_PIN = geoToScene(33.5558823, -7.6435464);
const THETA = (50 * Math.PI) / 180;                               // plan +x → along the boulevard (bearing 40°)
const U: [number, number] = [Math.cos(THETA), -Math.sin(THETA)];  // plan +x in the scene
const V: [number, number] = [Math.sin(THETA), Math.cos(THETA)];   // plan +z (towards the street) in the scene
/** scene position of the plans' origin (middle of the street façade glass) */
const ORIGIN: [number, number] = [ROOF_PIN.x + 4.9 + 7 * V[0], ROOF_PIN.z + 1.3 + 7 * V[1]];
/** scene point → plan frame */
export const toPlan = (x: number, z: number): [number, number] => {
  const dx = x - ORIGIN[0], dz = z - ORIGIN[1];
  return [dx * U[0] + dz * U[1], dx * V[0] + dz * V[1]];
};
/** plan frame → scene point */
export const fromPlan = (x: number, z: number): [number, number] => [ORIGIN[0] + x * U[0] + z * V[0], ORIGIN[1] + x * U[1] + z * V[1]];
const GF = MB_H.ground, TOP = MB_TOP, FLOOR = MB_H.floor;
// street front in the plan frame: the façade glass of the floors (curtain wall element of the plans) and the ground floor
const FRONT = (() => { const c = MIBTECH_PLANS[2].curtain.reduce((a, P) => (P.length > a.length ? P : a), MIBTECH_PLANS[2].curtain[0]); const xs = c.map((q) => q[0]); return { x0: Math.min(...xs), x1: Math.max(...xs) }; })();
const PLATE = (() => { const xs = MB_OUTLINE.map((q) => q[0]); return { x0: Math.min(...xs), x1: Math.max(...xs) }; })();
const CANT = 1.4; // the ground floor's street wall, set back under the floors (photos; estimated)

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
  const glass = acc(), stone = acc(), flute = acc(), shop = acc(), dark = acc(), render = acc(), door = acc();
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
  const zb = zs - 2, a = X1 - 7, b = X1 - 2;
  wall(flute, a, zb, b, zb, 0, GF, FLUTE_TILE, -1);
  wall(flute, a, zs, a, zb, 0, GF, FLUTE_TILE, -1);
  wall(flute, b, zb, b, zs, 0, GF, FLUTE_TILE, -1);
  flat(dark, a, zb, b, zs, GF - 0.32, false);
  wall(door, a + 1.5, zb + 0.02, a + 3.5, zb + 0.02, 0.15, 4.0, [2, 4], -1);
  wall(shop, a + 1.62, zb + 0.04, a + 3.38, zb + 0.04, 0.15, 2.75, [1.76, GF], -1);
  wall(shop, a + 1.62, zb + 0.04, a + 3.38, zb + 0.04, 2.87, 3.88, [1.76, GF], -1, 0.3);
  boxWalls(dark, a, zb, b, 0, 0, 0.15, [4, 4]);
  wall(stone, b, zs, X1, zs, 0, GF, STONE_TILE, -1);
  // roof: stair exit / plant room over the core
  const sb = MIBTECH_PLANS[2].stair_meta.box;
  boxWalls(render, sb[0][0], sb[0][1], sb[1][0], sb[1][1], TOP, TOP + 3, [4, 4]);
  return { glass: geo(glass), stone: geo(stone), flute: geo(flute), shop: geo(shop), dark: geo(dark), render: geo(render), door: geo(door), fins: fins() };
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
export const MB_VIEW = { floor: 0 as 0 | MbFloor };
export function mibtechShowFloor(f: 0 | MbFloor) {
  MB_VIEW.floor = f;
  const c = fromPlan(0, -14.5);
  if (f) rig.flyTo(new THREE.Vector3(c[0], floorY(f) + 1.2, c[1]), 46, { polar: 0.78, azimuth: THETA + 0.35, duration: 1.4 });
  else rig.flyTo(new THREE.Vector3(c[0], 8, c[1]), 95, { polar: 0.98, azimuth: THETA + 0.4, duration: 1.4 });
}

/** provisional interior materials (no finish schedule, photo or render of the interior yet: neutral, to be replaced) */
function plainMats(): Record<MbMat, THREE.MeshStandardMaterial> {
  const m = (color: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  return {
    wall: m("#E9E6DF"), column: m("#D8D6D1"), partition: m("#F1EFEA"), cubicle: m("#C9CCD1", { roughness: 0.5 }),
    glass: m("#A9C4D6", { transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    frame: m("#3B4048", { roughness: 0.45, metalness: 0.5 }), door: m("#B08A62", { roughness: 0.6 }),
    floor: m("#C9C4BA", { roughness: 0.7 }), ceiling: m("#F4F3EF", { roughness: 0.95 }), slabEdge: m("#DAD7D0"),
    lift: m("#9DA3A8", { roughness: 0.35, metalness: 0.6 }), roof: m("#C8C4BC", { roughness: 0.95 }), groundWall: m("#BDB8AE", { roughness: 0.82 }),
    stair: m("#B9B6AF", { roughness: 0.7 }), rail: m("#4A4F57", { roughness: 0.4, metalness: 0.6 }),
  };
}

export function MibtechBuilding() {
  const res = useMemo(() => {
    const F = front(), B = buildMibtech();
    const T = { glass: glassTex(false), glassN: glassTex(true), stone: stoneTex(), flute: fluteTex(), shop: shopTex(false), shopN: shopTex(true) };
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
    const P = plainMats();
    return { F, B, T, M, P };
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
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    const sel = useApp.getState().sel;
    if (MB_VIEW.floor && !(sel?.kind === "landmark" && sel.id === MIBTECH_ID)) MB_VIEW.floor = 0;
    if (shown.current !== MB_VIEW.floor) {
      const f = MB_VIEW.floor;
      shown.current = f;
      for (const o of g.children) {
        const m = /^mibtech\.(f|s)(\d)$/.exec(o.name);
        if (m) o.visible = !f || Number(m[2]) <= f;
        else if (o.name === "mibtech.roof") o.visible = !f;
        else if (o.name !== "mibtech.ground") o.visible = !f; // the street-front dressing (photos)
      }
    }
    setFade(list.filter((m) => m !== res.P.glass), op, fade.current);
    res.M.glass.emissiveIntensity = ENV.night * 0.9; res.M.shop.emissiveIntensity = 0.28 + ENV.night * 0.6; // shops lit by day too (photos)
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); useApp.getState().select({ kind: "landmark", id: MIBTECH_ID }); };
  const { F, B, M, P } = res;
  return (
    <group ref={root} onClick={onClick} name="mibtech" position={[ORIGIN[0], 0, ORIGIN[1]]} rotation={[0, THETA, 0]}>
      {Object.entries(B).map(([grp, parts]) => (
        <group key={grp} name={`mibtech.${grp}`}>
          {parts.map((p) => <mesh key={p.key} geometry={p.geo} material={P[p.key]} castShadow={p.key === "wall" || p.key === "slabEdge" || p.key === "roof"} />)}
        </group>
      ))}
      <mesh geometry={F.glass} material={M.glass} />
      <mesh geometry={F.stone} material={M.stone} castShadow receiveShadow />
      <mesh geometry={F.flute} material={M.flute} />
      <mesh geometry={F.shop} material={M.shop} />
      <mesh geometry={F.dark} material={M.dark} castShadow />
      <mesh geometry={F.render} material={M.render} castShadow />
      <mesh geometry={F.door} material={M.door} />
      <mesh geometry={F.fins} material={M.fin} castShadow />
    </group>
  );
}
