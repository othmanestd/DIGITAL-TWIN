"use client";
// <CasaCity/>: the whole of Casablanca in "Casa réel" mode, from OpenStreetMap (docs/research/casa-city-extract.py →
// public/casa/tiles/*.json, 1 km tiles on the single geographic chain of lib/geo/casaFrame): every mapped building on its
// footprint (height from OSM, else storeys × 3.2 m, else an estimate by type, flagged in the data), every street, the
// railways and the tram, parks, beaches, water. Tiles stream in around the camera, the nearest first, and drop out behind
// it. Three levels of detail, by the camera's 3D distance to the tile (with a margin each way so tiles do not flicker
// between two levels):
//   · near (< 1.6 km, low views): the district façades (typologies, not surveyed), parapets and lit windows at night;
//   · mid (< 6 km): every building as a plain coloured volume, one draw call a tile;
//   · far: the skyline only — buildings of 14 m and more, or 600 m² and more on the ground — one draw call a tile.
// A level's geometry is built when first needed (a few milliseconds a frame, nearest tiles first) and freed when the tile
// is well past it. The OSM districts drawn in detail (CFC, Maârif, Anfa Prime, Hassan II) and the typical hospital's
// campus keep their own buildings: the tiles skip theirs.
import { mibtechCovers } from "./landmarks/MibtechBuilding";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { CASA } from "@/components/scenes/geo/MoroccoBase";
import { ANFA_DISTRICT, CFC_DISTRICT, MAARIF_DISTRICT } from "./geography";
import { HASSAN2_PLACED } from "./hassanZone";
import { ENV } from "./landmarks/env";
import { Buckets, ccw, roofOf, walls, type CfcKey, type Pt } from "./landmarks/zoneKit";
import { NIGHT, zoneMaterials } from "./landmarks/zoneMaterials";

type TB = { p: number[]; h: number; k: string; e?: number; m?: number };
type TR = { p: number[]; w: number; c: string };
type TA = { p: number[]; k: string };
type TL = { p: number[]; c: string };
type TileData = { b: TB[]; r: TR[]; a: TA[]; l: TL[] };
type Index = { tile: number; tiles: [number, number, number, number][] };

// levels of detail (camera distance to the tile centre, m): [enter, leave]
const NEAR: [number, number] = [1600, 2100];
const MID: [number, number] = [6000, 7000];
const SKYLINE_H = 14, SKYLINE_AREA = 600;
const hash = (x: number, z: number) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };

/** rectangles (world) whose buildings are drawn by a detailed district or the campus */
function skipRects() {
  const H = HASSAN2_PLACED, hb = H.zone.box;
  return [
    CFC_DISTRICT, MAARIF_DISTRICT, ANFA_DISTRICT,
    { x0: H.ox + hb.x0, x1: H.ox + hb.x1, z0: H.oz + hb.z0, z1: H.oz + hb.z1 },
    { x0: -190, x1: 190, z0: -190, z1: 190 },
  ];
}

const COL: Record<string, string> = {
  park: "#8FAE6B", grass: "#9DB57A", wood: "#6E8F55", cemetery: "#A9B59A", beach: "#E2D3AE", water: "#4C88AE", pitch: "#6E9D5A",
  industrial: "#BDB7AC", parking: "#9A9DA2", plaza: "#E0D9CA",
};
const ROAD_COL: Record<string, string> = { motorway: "#5A5C61", trunk: "#5F6166", primary: "#66686D", secondary: "#6C6E73", tertiary: "#727479" };
const BLD_COL: Record<string, string[]> = {
  r: ["#EFEBE2", "#E9E2D2", "#E4DED3", "#F2EEE6", "#E6DCC6"], v: ["#F3EFE7", "#EEE6D8"], o: ["#A9B7C6", "#B8C4CF", "#9FB1B9"],
  c: ["#E6E2DA", "#DCD8CF"], i: ["#B9BBBE", "#C4C3BE", "#A9ADB2"], m: ["#F1EEE6"], p: ["#E8E1D2", "#EDE8DD"],
};

/** a flat filled polygon (scene x, z) into position / colour arrays, facing up */
function fill(pos: number[], col: number[], P: Pt[], y: number, c: THREE.Color) {
  if (P.length < 3) return;
  const tris = THREE.ShapeUtils.triangulateShape(P.map((q) => new THREE.Vector2(q[0], q[1])), []);
  for (const [a, b, d] of tris) {
    const A = P[a], B = P[b], D = P[d], cy = (B[1] - A[1]) * (D[0] - A[0]) - (B[0] - A[0]) * (D[1] - A[1]);
    const seq = cy > 0 ? [A, B, D] : [A, D, B];
    for (const v of seq) { pos.push(v[0], y, v[1]); col.push(c.r, c.g, c.b); }
  }
}
function strip(pos: number[], col: number[], p: number[], w: number, y: number, c: THREE.Color, ox: number, oz: number) {
  for (let i = 0; i + 3 < p.length; i += 2) {
    const ax = ox + p[i] / 10, az = oz + p[i + 1] / 10, bx = ox + p[i + 2] / 10, bz = oz + p[i + 3] / 10;
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    if (L < 0.05) continue;
    const nx = (-dz / L) * w / 2, nz = (dx / L) * w / 2, ex = (dx / L) * w * 0.2, ez = (dz / L) * w * 0.2;
    const v = [[ax - ex + nx, az - ez + nz], [bx + ex + nx, bz + ez + nz], [bx + ex - nx, bz + ez - nz], [ax - ex - nx, az - ez - nz]];
    for (const k of [0, 2, 1, 0, 3, 2]) { pos.push(v[k][0], y, v[k][1]); col.push(c.r, c.g, c.b); }
  }
}
const flatGeo = (pos: number[], col: number[]) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

/** the ground of a tile: open spaces, streets, railways (one coloured mesh) */
function groundOf(t: TileData, ox: number, oz: number) {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color();
  for (const a of t.a) {
    const P: Pt[] = []; for (let i = 0; i < a.p.length; i += 2) P.push([ox + a.p[i] / 10, oz + a.p[i + 1] / 10]);
    c.set(COL[a.k] ?? "#D6CFC0");
    fill(pos, col, P, a.k === "water" ? 0.05 : 0.025, c);
  }
  // pavements (a light band 3 m wider on each side on the larger streets), then the carriageways
  const pave = new THREE.Color("#DCD6CA");
  for (const r of t.r) if (r.c !== "service" && r.c !== "motorway") strip(pos, col, r.p, r.w + (r.w > 12 ? 9 : 6), 0.04, pave, ox, oz);
  for (const r of t.r) { c.set(ROAD_COL[r.c] ?? "#7E8186"); strip(pos, col, r.p, r.w, 0.06, c, ox, oz); }
  for (const l of t.l) { c.set(l.c === "tram" ? "#6D6A66" : "#5E5B57"); strip(pos, col, l.p, l.c === "tram" ? 6.5 : 4.5, 0.07, c, ox, oz); }
  return flatGeo(pos, col);
}

const areaOf = (P: Pt[]) => { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a / 2); };
/** mid / far LOD: the buildings of a tile as coloured volumes (walls + roof); `skyline`: the tall or large ones only */
function coarseOf(t: TileData, ox: number, oz: number, skip: (x: number, z: number) => boolean, skyline = false) {
  const pos: number[] = [], col: number[] = [], c = new THREE.Color(), roofC = new THREE.Color();
  for (const b of t.b) {
    const P: Pt[] = []; for (let i = 0; i < b.p.length; i += 2) P.push([ox + b.p[i] / 10, oz + b.p[i + 1] / 10]);
    if (skyline && b.h < SKYLINE_H && areaOf(P) < SKYLINE_AREA) continue;
    const cx = P.reduce((s, q) => s + q[0], 0) / P.length, cz = P.reduce((s, q) => s + q[1], 0) / P.length;
    if (skip(cx, cz)) continue;
    const pal = BLD_COL[b.k] ?? BLD_COL.r; c.set(pal[Math.floor(hash(cx, cz) * pal.length)]);
    roofC.copy(c).multiplyScalar(0.86);
    const Q = ccw(P), y0 = b.m ?? 0, h = b.h;
    for (let i = 0; i < Q.length; i++) {
      const A = Q[i], B = Q[(i + 1) % Q.length];
      const shade = 0.82 + 0.18 * Math.abs((B[1] - A[1]) / (Math.hypot(B[0] - A[0], B[1] - A[1]) || 1)); // a touch of facet shading
      const r = c.r * shade, g = c.g * shade, bl = c.b * shade;
      const v = [[A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], h, B[1]], [A[0], h, A[1]]];
      for (const k of [0, 3, 2, 0, 2, 1]) { pos.push(v[k][0], v[k][1], v[k][2]); col.push(r, g, bl); }
    }
    try { fill(pos, col, Q, h, roofC); } catch { /* degenerate outline */ }
  }
  return flatGeo(pos, col);
}

/** near LOD: the district typologies (same façades as the OSM districts) */
function detailedOf(t: TileData, ox: number, oz: number, skip: (x: number, z: number) => boolean) {
  const B = new Buckets();
  for (const b of t.b) {
    const P: Pt[] = []; for (let i = 0; i < b.p.length; i += 2) P.push([ox + b.p[i] / 10, oz + b.p[i + 1] / 10]);
    const cx = P.reduce((s, q) => s + q[0], 0) / P.length, cz = P.reduce((s, q) => s + q[1], 0) / P.length;
    if (skip(cx, cz)) continue;
    const Q = ccw(P), y0 = b.m ?? 0, hs = hash(cx, cz);
    const fac: CfcKey = b.k === "v" ? "villa" : b.k === "o" ? (hs < 0.5 ? "glass.silver" : "glass.sage") : b.k === "c" || b.k === "p" ? "panel" : b.k === "i" ? "concrete"
      : (`res.${Math.floor(hs * 4) * 2 + (hash(cz, cx) < 0.62 ? 0 : 1)}` as CfcKey);
    walls(B, Q, y0, b.h, fac);
    try { roofOf(B, Q, b.h, "parapet", b.k === "i" ? 0.4 : 0.9); } catch { /* degenerate outline */ }
  }
  return B.build();
}

type Lod = 0 | 1 | 2; // near, mid, far
type Live = { key: string; dist: number; lod: Lod; ground?: THREE.Mesh; coarse?: THREE.Mesh; sky?: THREE.Mesh; detail?: THREE.Group; data?: TileData; loading?: boolean };

export function CasaCity() {
  const root = useRef<THREE.Group>(null);
  const state = useMemo(() => ({
    index: null as Index | null, live: new Map<string, Live>(), queue: 0, last: 0, rects: skipRects(),
    want: new Set<string>(), order: [] as Live[],
    groundMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, transparent: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    coarseMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, transparent: true }),
    M: zoneMaterials(["res.0", "res.1", "res.2", "res.3", "res.4", "res.5", "res.6", "res.7", "villa", "glass.silver", "glass.sage", "panel", "concrete", "parapet", "roof"]),
  }), []);
  useEffect(() => {
    let off = false;
    fetch("/casa/index.json").then((r) => (r.ok ? r.json() : null)).then((j) => { if (!off) state.index = j; }).catch(() => {});
    return () => {
      off = true;
      for (const l of state.live.values()) drop(l);
      state.groundMat.dispose(); state.coarseMat.dispose();
      for (const m of Object.values(state.M)) { m?.map?.dispose(); m?.emissiveMap?.dispose(); m?.dispose(); }
    };
  }, [state]);
  // the districts' boxes, and MIBTECH's footprint from its plans (the older OSM villas there are gone)
  const skip = (x: number, z: number) => state.rects.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) || mibtechCovers(x, z);
  const dropMesh = (m?: THREE.Mesh) => { if (m) { m.geometry.dispose(); m.removeFromParent(); } };
  const dropDetail = (l: Live) => {
    if (l.detail) { l.detail.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); l.detail.removeFromParent(); }
    l.detail = undefined;
  };
  function drop(l: Live) {
    dropMesh(l.ground); dropMesh(l.coarse); dropMesh(l.sky); dropDetail(l);
    l.ground = l.coarse = l.sky = undefined;
  }
  useFrame(({ camera, clock }) => {
    const g = root.current, I = state.index;
    if (!g || !I) return;
    const op = CASA.v;
    g.visible = op > 0.003;
    state.groundMat.opacity = op; state.coarseMat.opacity = op;
    const n = ENV.night;
    for (const [k, v] of Object.entries(NIGHT) as [CfcKey, number][]) { const m = state.M[k]; if (m) m.emissiveIntensity = n * v; }
    if (!g.visible) return;
    const T = I.tile, cx = camera.position.x, cz = camera.position.z, cy = Math.max(0, camera.position.y);
    const radius = Math.min(20000, Math.max(3500, frame.alt * 2.6));
    if (clock.elapsedTime - state.last >= 0.2) { state.last = clock.elapsedTime; scan(I, cx, cy, cz, radius); }
    // build / switch LOD within a few milliseconds a frame (nearest first), so zooming never stalls on a burst of tiles
    const t0 = performance.now();
    for (const l of state.order) {
      if (performance.now() - t0 > 4) break;
      if (!state.want.has(l.key) || !l.data) continue;
      const [i, j] = l.key.split("_").map(Number), ox = i * T, oz = j * T;
      if (!l.ground) { l.ground = new THREE.Mesh(groundOf(l.data, ox, oz), state.groundMat); l.ground.raycast = () => {}; l.ground.renderOrder = -1; g.add(l.ground); continue; }
      // the level this tile wants (hysteresis: a tile leaves a level only past its "leave" distance)
      const d = l.dist, lowView = frame.alt < 1500;
      const lod: Lod = (l.lod === 0 ? d < NEAR[1] : d < NEAR[0]) && lowView ? 0 : (l.lod <= 1 ? d < MID[1] : d < MID[0]) ? 1 : 2;
      l.lod = lod;
      if (lod === 0 && !l.detail) {
        const grp = new THREE.Group();
        for (const p of detailedOf(l.data, ox, oz, skip)) { const m = new THREE.Mesh(p.geo, state.M[p.key]); m.raycast = () => {}; grp.add(m); }
        l.detail = grp; g.add(grp);
      } else if (lod === 1 && !l.coarse) { l.coarse = new THREE.Mesh(coarseOf(l.data, ox, oz, skip), state.coarseMat); l.coarse.raycast = () => {}; g.add(l.coarse); }
      else if (lod === 2 && !l.sky) { l.sky = new THREE.Mesh(coarseOf(l.data, ox, oz, skip, true), state.coarseMat); l.sky.raycast = () => {}; g.add(l.sky); }
      // show the wanted level; while it is being built, the level that is ready stands in (no hole)
      const ready = lod === 0 ? !!l.detail : lod === 1 ? !!l.coarse : !!l.sky;
      if (l.detail) l.detail.visible = lod === 0 || (!ready && lod === 1);
      if (l.coarse) l.coarse.visible = lod === 1 || (!ready && lod === 0);
      if (l.sky) l.sky.visible = lod === 2 || (!ready && !l.coarse);
      // free what is well out of use (façades past twice the near distance, volumes past the far one)
      if (l.detail && d > NEAR[1] * 2) dropDetail(l);
      if (l.coarse && d > MID[1] * 1.6) { dropMesh(l.coarse); l.coarse = undefined; }
    }
  });
  /** which tiles the view wants (fetching the missing ones, nearest first); drops the far ones. Distances are 3D (from the
   *  camera, its height included) for the levels of detail, horizontal for the streaming radius. */
  function scan(I: Index, cx: number, cy: number, cz: number, radius: number) {
    const T = I.tile, want = state.want;
    want.clear();
    const missing: Live[] = [];
    for (const [i, j] of I.tiles) {
      const dh = Math.hypot((i + 0.5) * T - cx, (j + 0.5) * T - cz);
      if (dh > radius) continue;
      const key = `${i}_${j}`;
      want.add(key);
      let l = state.live.get(key);
      if (!l) state.live.set(key, (l = { key, dist: 0, lod: 1 }));
      l.dist = Math.hypot(dh, cy);
      if (!l.data && !l.loading) missing.push(l);
    }
    missing.sort((a, b) => a.dist - b.dist);
    for (const l of missing) {
      if (state.queue >= 8) break;
      l.loading = true; state.queue++;
      fetch(`/casa/tiles/${l.key}.json`).then((r) => r.json()).then((t: TileData) => { l.data = t; }).catch(() => {}).finally(() => { l.loading = false; state.queue--; });
    }
    for (const l of state.live.values()) if (!want.has(l.key) && l.dist > radius * 1.3) { drop(l); state.live.delete(l.key); }
    state.order = [...state.live.values()].sort((a, b) => a.dist - b.dist);
  }
  return <group ref={root} />;
}
