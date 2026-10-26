"use client";
// Mibtech's building (Casa réel only), boulevard Mahdi Elmandjra (ex Rue des Papillons), L'Oasis.
// Sources (docs/research/mibtech-identification.md): both Google pins of the « MIBTECH » listing; overhead imagery (Esri World
// Imagery z19) for the massing; three street photos supplied by the user (Google Maps, Feb. and Jul. 2025) for the
// architecture — REFERENCES only: every surface below is procedural, nothing is copied from a photo, and the shop signs and
// posters of the ground floor are left out (no advertising in the city).
// What the photos show, and what is modelled:
//   · ground floor (≈ 4.6 m): light grey stone plinth, glazed shopfronts, a service door, and on the right the office entrance:
//     a recessed portal clad in anthracite fluted panels, glazed door and transom, dark granite step;
//   · above it, cantilevered over the street (≈ 1.4 m), three office floors (≈ 3.8 m) in a navy-blue glass curtain wall with dark
//     mullions and a band at each floor;
//   · in front of the glass, light grey aluminium fins, folded into facets and turned at varying angles (the "wave"), hanging
//     below the slab and rising in a saw-tooth above the roof, on the street front and around the south-west corner.
// Estimated (not measured): footprint ≈ 26 × 14 m + a north-west annex ≈ 11 × 9 m (overhead view), floor heights (photos),
// total ≈ 16 m. The back (north-west) and the side against the neighbour are not documented: plain render.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frame } from "@/lib/world";
import { useApp } from "@/lib/store";
import { geoToScene } from "@/lib/geo/casaFrame";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade, yawedSolids } from "./shared";

export const MIBTECH_ID = "mibtech";
const ROOF_PIN = geoToScene(33.5558823, -7.6435464);
/** east / north offsets (m) from the roof pin → scene (x east, z south) */
const P = (e: number, n: number): [number, number] => [ROOF_PIN.x + e, ROOF_PIN.z - n];
const MAIN = { c: P(4.9, -1.3), L: 26, W: 14 };
const ANNEX = { c: P(-2.7, 8), w: 11, d: 9 };
// local frame of the main wing: +x along the boulevard (towards the north-east), +z towards the street (south-east)
const THETA = (50 * Math.PI) / 180; // bearing of the boulevard 40° → group rotation
const GF = 4.6, FLOOR = 3.8, FLOORS = 3, TOP = GF + FLOORS * FLOOR; // 16.0 m
const CANT = 1.4; // cantilever of the upper floors over the street
const HL = MAIN.L / 2, HW = MAIN.W / 2;

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
  const pitch = 1.0, off = 0.55;
  let i = 0;
  for (let x = -HL + 0.45; x <= HL - 0.3; x += pitch) blade(x, HW + off, 0, i++);         // street front (+z)
  for (let z = HW - 0.5; z >= -HW + 0.4; z -= pitch) blade(-HL - off, z, Math.PI / 2, i++); // south-west side (−x)
  const m = mergeGeometries(parts)!; parts.forEach((p) => p.dispose());
  return m;
}

function build() {
  const glass = acc(), stone = acc(), flute = acc(), shop = acc(), dark = acc(), render = acc(), roof = acc(), door = acc();
  const zs = HW - CANT; // ground-floor street wall, under the cantilever
  // ---- upper floors: curtain wall on the street and the south-west side, render elsewhere
  wall(glass, -HL, HW, HL, HW, GF, TOP, GLASS_TILE, -1);
  wall(glass, -HL, -HW, -HL, HW, GF, TOP, GLASS_TILE, -1);
  wall(render, HL, HW, HL, -HW, GF, TOP, [4, 4], -1);
  wall(render, HL, -HW, -HL, -HW, GF, TOP, [4, 4], -1);
  flat(dark, -HL, zs, HL, HW, GF, false);                         // soffit of the cantilever
  wall(dark, -HL, HW, HL, HW, GF - 0.45, GF, [4, 4], -1);          // slab edge
  // roof: flat, thin parapet, plant room
  flat(roof, -HL, -HW, HL, HW, TOP, true, [6, 6]);
  for (const [x0, z0, x1, z1] of [[-HL, HW - 0.25, HL, HW], [-HL, -HW, HL, -HW + 0.25], [-HL, -HW, -HL + 0.25, HW], [HL - 0.25, -HW, HL, HW]] as const) boxWalls(dark, x0, z0, x1, z1, TOP, TOP + 0.5, [4, 4]);
  boxWalls(render, 1.5, -5.5, 6.5, -1.5, TOP, TOP + 3, [4, 4]);
  // ---- ground floor along the street (south-west → north-east)
  wall(stone, -HL, zs, -9, zs, 0, GF, STONE_TILE, -1);
  wall(door, -11.8, zs + 0.02, -10.2, zs + 0.02, 0, 2.4, [1.6, 2.4], -1);  // service door
  wall(shop, -9, zs, -3, zs, 0, GF, SHOP_TILE, -1);
  wall(stone, -3, zs, -2.4, zs, 0, GF, STONE_TILE, -1);
  wall(shop, -2.4, zs, 6.5, zs, 0, GF, SHOP_TILE, -1);
  wall(flute, 6.5, zs, 8, zs, 0, GF, FLUTE_TILE, -1);
  // entrance portal: recessed 2 m, fluted anthracite, glazed door + transom, granite step
  const zb = zs - 2;
  wall(flute, 8, zb, HL, zb, 0, GF, FLUTE_TILE, -1);
  wall(flute, 8, zs, 8, zb, 0, GF, FLUTE_TILE, -1);
  wall(flute, HL, zb, HL, zs, 0, GF, FLUTE_TILE, -1);
  flat(dark, 8, zb, HL, zs, GF - 0.02, false);
  // glazed door and transom in a dark frame (photo 2)
  wall(door, 9.0, zb + 0.02, 11.0, zb + 0.02, 0.15, 4.0, [2, 4], -1);
  wall(shop, 9.12, zb + 0.04, 10.88, zb + 0.04, 0.15, 2.75, [1.76, GF], -1);
  wall(shop, 9.12, zb + 0.04, 10.88, zb + 0.04, 2.87, 3.88, [1.76, GF], -1, 0.3);
  boxWalls(dark, 8, zb, HL, HW, 0, 0.15, [4, 4]);
  // ground-floor sides and back
  wall(stone, -HL, -HW, -HL, zs, 0, GF, STONE_TILE, -1);
  wall(stone, HL, zs, HL, -HW, 0, GF, STONE_TILE, -1);
  wall(stone, HL, -HW, -HL, -HW, 0, GF, STONE_TILE, -1);
  return { glass: geo(glass), stone: geo(stone), flute: geo(flute), shop: geo(shop), dark: geo(dark), render: geo(render), roof: geo(roof), door: geo(door), fins: fins() };
}
/** the north-west annex (world axes, centred on its own origin): plain render, same height (not documented) */
function buildAnnex() {
  const r = acc(), w = ANNEX.w / 2, d = ANNEX.d / 2;
  boxWalls(r, -w, -d, w, d, 0, TOP, [4, 4]);
  return geo(r);
}

/** Walk-mode solids (world). */
export function mibtechSolids(): Solid[] {
  const yaw = Math.PI / 2 + THETA; // yawedSolids frame: its local +z along the boulevard
  return [
    ...yawedSolids(MAIN.c[0], MAIN.c[1], yaw, -HW, HW, -HL, HL, TOP, 12),
    ...yawedSolids(ANNEX.c[0], ANNEX.c[1], 0, -ANNEX.w / 2, ANNEX.w / 2, -ANNEX.d / 2, ANNEX.d / 2, TOP, 12),
  ];
}
/** Where the city layer must not draw the older OSM villas (scene rect around the lot). */
export const MIBTECH_SKIP = (() => { const a = P(-8, 9), b = P(4, -9); return { x0: a[0], x1: b[0], z0: a[1], z1: b[1] }; })();
/** label height above the ground */
export const MIBTECH_TOP = TOP;

export function MibtechBuilding() {
  const res = useMemo(() => {
    const G = build(), annex = buildAnnex();
    const T = { glass: glassTex(false), glassN: glassTex(true), stone: stoneTex(), flute: fluteTex(), shop: shopTex(false), shopN: shopTex(true) };
    const M = {
      glass: new THREE.MeshStandardMaterial({ map: T.glass, emissiveMap: T.glassN, emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.14, metalness: 0.2, envMapIntensity: 1.2 }),
      stone: new THREE.MeshStandardMaterial({ map: T.stone, roughness: 0.82 }),
      flute: new THREE.MeshStandardMaterial({ map: T.flute, roughness: 0.55, metalness: 0.25 }),
      shop: new THREE.MeshStandardMaterial({ map: T.shop, emissiveMap: T.shopN, emissive: "#FFFFFF", emissiveIntensity: 0, roughness: 0.12, metalness: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: "#272B31", roughness: 0.7, metalness: 0.2 }),
      render: new THREE.MeshStandardMaterial({ color: "#D9D6CF", roughness: 0.9 }),
      roof: new THREE.MeshStandardMaterial({ color: "#C8C4BC", roughness: 0.95 }),
      door: new THREE.MeshStandardMaterial({ color: "#14181D", roughness: 0.2, metalness: 0.5 }),
      fin: new THREE.MeshStandardMaterial({ color: "#D6DADF", roughness: 0.38, metalness: 0.45, envMapIntensity: 1.1 }),
    };
    return { G, annex, T, M };
  }, []);
  const list = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  useEffect(() => () => {
    Object.values(res.G).forEach((g) => g.dispose()); res.annex.dispose();
    Object.values(res.T).forEach((t) => t.dispose()); Object.values(res.M).forEach((m) => m.dispose());
  }, [res]);
  const root = useRef<THREE.Group>(null);
  const fade = useRef({ v: 1 });
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    setFade(list, op, fade.current);
    res.M.glass.emissiveIntensity = ENV.night * 0.9; res.M.shop.emissiveIntensity = 0.28 + ENV.night * 0.6; // shops lit by day too (photos)
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); useApp.getState().select({ kind: "landmark", id: MIBTECH_ID }); };
  const { G, M } = res;
  return (
    <group ref={root} onClick={onClick} name="mibtech">
      <group position={[MAIN.c[0], 0, MAIN.c[1]]} rotation={[0, THETA, 0]}>
        <mesh geometry={G.glass} material={M.glass} castShadow />
        <mesh geometry={G.stone} material={M.stone} castShadow receiveShadow />
        <mesh geometry={G.flute} material={M.flute} />
        <mesh geometry={G.shop} material={M.shop} />
        <mesh geometry={G.dark} material={M.dark} castShadow />
        <mesh geometry={G.render} material={M.render} castShadow />
        <mesh geometry={G.roof} material={M.roof} receiveShadow />
        <mesh geometry={G.door} material={M.door} />
        <mesh geometry={G.fins} material={M.fin} castShadow />
      </group>
      <mesh position={[ANNEX.c[0], 0, ANNEX.c[1]]} geometry={res.annex} material={M.render} castShadow />
    </group>
  );
}
