"use client";
// A procedural Casablanca around the typical hospital, in its real materials and colours at street level: white and cream
// plaster, Art Deco façades, ochre and salmon suburbs, roof terraces with their tanks, dishes and laundry, shop awnings,
// green tiled roofs and minarets, palm-lined boulevards, worn asphalt and tiled pavements, beaches, the port. As the
// camera rises the whole city eases into the blues of the Morocco map (cityMats.ts, uMapK) so the hand-off stays seamless;
// the hospital square stays a touch brighter, with white kerbs.
// 1 unit = 1 m, campus at the origin, ground at y = 0, map north = −Z (the Atlantic is to the north-west).
// No controls / lights / background: mounted next to <HospitalContent/> in the unified world.
//  · ground: an opaque disc (9 km) + a far ring (to 75 km) with the same shader: land use (density field), fields and
//    scrub beyond the city, the coastline, beaches, rocks, foam and the ocean; the far ring fades into the Morocco map
//  · streets / boulevards / avenues / country roads / roundabouts / corniche / promenade as one merged geometry; the
//    district around the hospital (district.ts): connected streets, kerbs, zebras, stop lines, median, roundabout, square
//  · blocks (plan.ts): instanced boxes in spatial chunks, procedural façades and roofs (cityMats.ts facadeMaterial)
//  · parks and lawns, trees, palms, roof props, minarets, green tiled roofs, pools, the tram tracks; the sites (Sites.tsx)
//  · legacy landmarks behind LEGACY_LANDMARKS (the textured ones live in landmarks/)
//  · traffic (Traffic.tsx); LOD by camera altitude (lib/world frame.alt) and by chunk distance; walk-mode colliders
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frame, fadeIn } from "@/lib/world";
import { rt } from "@/components/scenes/hospital/mats";
import { CASA } from "@/components/scenes/geo/MoroccoBase";
import { blockedOutdoors, outdoorSolids, registerSolids } from "./collide";
import { Traffic } from "./Traffic";
import { SQUARE, RB, PLAZA_R } from "./district";
import { cityPlan, citySolids, MOSQUE, R_FAR, R_GROUND, rng, type Bx, type Plan, type Quad, type Seg } from "./plan";
import { atCoast, density, zoneAt, Z, CORNICHE, T } from "./geography";
import { CU, facadeMaterial, groundMaterial, landTexture, lawnMaterial, plainMat, streetMaterial } from "./cityMats";
import { hipRoof, laundryGeometry, minaretGeometry, palmCrown, treeCrown, unitBox } from "./cityGeo";
import { CitySites } from "./Sites";
import { TEX } from "./landmarks/textures";

/** Legacy landmarks (mosque + minaret, CFC signature towers, tram vehicles). The landmarks engineer's versions replace
 *  them: flip to false once theirs are in (the tram tracks, poles and wires stay). */
export const LEGACY_LANDMARKS = false; // replaced by components/scenes/city/landmarks (textured mosque, CFC towers, trams)

// ---------------------------------------------------------------- palette (real Casablanca colours)
const COL = {
  square: "#ECE8E0", squareKerb: "#F6F4EF", kerb: "#BDB9B0", trunk: "#857560", palmTrunk: "#8E7E68",
  roofProps: "#E9E8E4", tankBlack: "#2A2C2E", dish: "#F1F1EE", unit: "#C9CBCB", sign: "#F4F1E8", mosque: "#E4DCC9",
};
/** façade colour families (plan Bx.pal): white, cream, warm grey, sand, ochre, salmon, glass, metal, rampart, pastel */
const PALETTES = [
  ["#F1EEE7", "#ECE8DF", "#F4F1EA", "#E9E5DC", "#EFEBE3", "#F2EFE6"],
  ["#EDE3CF", "#E9DCC3", "#F0E7D6", "#E5D7BD", "#EBDFC8"],
  ["#DAD6CE", "#D2CEC6", "#DEDAD2", "#CFCAC1"],
  ["#DCCAA8", "#D6C29E", "#E0D0B2", "#D2BC96"],
  ["#D9AE72", "#D3A367", "#DDB57E", "#CF9D60"],
  ["#D99A7E", "#D08C70", "#DDA68C", "#C98266", "#E2B39C"],
  ["#7F9BAA", "#6F8E9E", "#8AA3AE", "#6C8A8E", "#93A6AC", "#5F7C8C"],
  ["#C9CCCF", "#B9C1C8", "#D3D1CB", "#A9B4BC", "#C4BBAA"],
  ["#C9A27A", "#C29A70", "#CDA881"],
  ["#EADBA8", "#E8CDBF", "#E3D9B0", "#E6D3C0"],
].map((l) => l.map((h) => new THREE.Color(h)));
const GREENS = ["#5C7A43", "#4E6B3A", "#6B8A4E", "#58733F", "#476336", "#77904F", "#62804A"].map((h) => new THREE.Color(h));
const CARS = ["#F2F2F0", "#F2F2F0", "#C9CCCF", "#B7BBBE", "#8A8E92", "#2B2D30", "#B3382E", "#2F4F7F", "#D9CDB4"].map((h) => new THREE.Color(h));
/** night tint (multiplies the diffuse colours) */
const NIGHT_MUL = new THREE.Vector3(0.42, 0.47, 0.66);
// decal colours (vertex colours of the markings geometry): paint, rail, parking asphalt, roundabout lawn, pool, pool rim
const DC = ["#E9E7E0", "#3A3836", "#5B5B5C", "#5E7A3E", "#3FB2C8", "#EDEBE4"].map((h) => new THREE.Color(h));

/** Dev hook for screenshot QA: pin the time-lapse daylight (null = follow the hospital's time-lapse). */
const DEV: { night: number | null; hide?: boolean; root?: THREE.Object3D | null; three?: unknown; blocked: typeof blockedOutdoors; solids: typeof outdoorSolids; plan?: () => Plan; stats?: unknown } = { night: null, blocked: blockedOutdoors, solids: outdoorSolids, plan: cityPlan };
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __city: unknown }).__city = DEV;

// ---------------------------------------------------------------- geometry helpers
/** Flat coloured quads (one merged geometry, vertex colours, optional road attribute). */
type QD = { x0: number; z0: number; x1: number; z1: number; w: number; y: number; col?: THREE.Color; ext?: number; road?: [number, number, number] };
function quadGeometry(quads: QD[]) {
  const n = quads.length, pos = new Float32Array(n * 12), col = new Float32Array(n * 12), road = new Float32Array(n * 16), idx = new Uint32Array(n * 6);
  const wc = new THREE.Color(1, 1, 1);
  quads.forEach((s, i) => {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * (s.w / 2), nz = (dx / L) * (s.w / 2);
    const e = s.ext ?? 0, ex = (dx / L) * e, ez = (dz / L) * e;
    const P = [[s.x0 - ex + nx, s.z0 - ez + nz, 1], [s.x0 - ex - nx, s.z0 - ez - nz, -1], [s.x1 + ex - nx, s.z1 + ez - nz, -1], [s.x1 + ex + nx, s.z1 + ez + nz, 1]];
    const c = s.col ?? wc;
    P.forEach(([x, z, sd], k) => {
      pos.set([x, s.y, z], (i * 4 + k) * 3); col.set([c.r, c.g, c.b], (i * 4 + k) * 3);
      if (s.road) road.set([s.road[0], (sd * s.w) / 2, s.road[1], s.road[2]], (i * 4 + k) * 4);
    });
    const b = i * 4;
    idx.set([b, b + 2, b + 1, b, b + 3, b + 2], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("aRoad", new THREE.BufferAttribute(road, 4));
  const nrm = new Float32Array(n * 12); for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

/** Streets: pavements under the asphalt (aRoad = kind, lateral, asphalt half width, total half width), the corniche
 *  promenade and the paved esplanades. */
function streetGeometry(segs: Seg[], plazas: Plan["plazas"]) {
  const q: QD[] = [];
  for (const sg of segs) if (sg.c !== 2) { const sw = sg.w > 20 ? 4.5 : 3; q.push({ ...sg, w: sg.w + 2 * sw, y: 0.03, ext: sg.w * 0.2, road: [0, sg.w / 2, sg.w / 2 + sw] }); }
  for (const sg of segs) q.push({ ...sg, y: 0.06, ext: sg.w * 0.12, road: [sg.c === 2 ? 3 : sg.w > 20 ? 2 : 1, sg.w / 2, sg.w / 2] });
  // corniche promenade on the sea side of the coastal road (Aïn Diab → the port)
  let prev: [number, number] | null = null;
  for (let t = CORNICHE.t0; t <= 450; t += 45) {
    const p = atCoast(t, -76);
    if (prev && !(t > -650 && t < 120)) q.push({ x0: prev[0], z0: prev[1], x1: p[0], z1: p[1], w: 10, y: 0.035, ext: 1, road: [4, -1, 99] });
    prev = p;
  }
  for (const [x, z, w, d] of plazas) q.push({ x0: x - (T.x * d) / 2, z0: z - (T.y * d) / 2, x1: x + (T.x * d) / 2, z1: z + (T.y * d) / 2, w, y: 0.032, road: [4, -1, 99] });
  return quadGeometry(q);
}
function decalGeometry(d: Quad[], pools: Plan["pools"]) {
  const q: QD[] = d.map((x) => ({ ...x, col: DC[x.c] }));
  for (const [x, z, w, dd] of pools) {
    q.push({ x0: x - w / 2 - 0.6, z0: z, x1: x + w / 2 + 0.6, z1: z, w: dd + 1.2, y: 0.08, col: DC[5] });
    q.push({ x0: x - w / 2, z0: z, x1: x + w / 2, z1: z, w: dd, y: 0.1, col: DC[4] });
  }
  return quadGeometry(q);
}
/** Lawns of the parks (crisp edges over the ground). */
function lawnGeometry(parks: Plan["parks"]) {
  return quadGeometry(parks.map(([x, z, w, d]) => ({ x0: x - w / 2, z0: z, x1: x + w / 2, z1: z, w: d, y: 0.025 })));
}

/** Raised kerb strips (top + both faces) along the district streets. */
function kerbGeometry(list: { x0: number; z0: number; x1: number; z1: number }[], h = 0.13, w = 0.3) {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    const o = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) nrm.push(...n);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (const k of list) {
    const dx = k.x1 - k.x0, dz = k.z1 - k.z0, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz * w / 2, nz = ux * w / 2;
    const A = [k.x0 + nx, k.z0 + nz], B = [k.x1 + nx, k.z1 + nz], Cc = [k.x1 - nx, k.z1 - nz], Dd = [k.x0 - nx, k.z0 - nz];
    quad([A[0], h, A[1]], [B[0], h, B[1]], [Cc[0], h, Cc[1]], [Dd[0], h, Dd[1]], [0, 1, 0]);
    quad([Dd[0], 0, Dd[1]], [Dd[0], h, Dd[1]], [Cc[0], h, Cc[1]], [Cc[0], 0, Cc[1]], [uz, 0, -ux]);
    quad([B[0], 0, B[1]], [B[0], h, B[1]], [A[0], h, A[1]], [A[0], 0, A[1]], [-uz, 0, ux]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** The hospital square: pavement up to the inner kerbs, with a hole for the plinth (rounded rectangle). */
function squareGeometry() {
  const s = new THREE.Shape();
  s.moveTo(SQUARE.x0, -SQUARE.z0); s.lineTo(SQUARE.x1, -SQUARE.z0); s.lineTo(SQUARE.x1, -(SQUARE.z1 + 3)); s.lineTo(SQUARE.x0, -(SQUARE.z1 + 3)); s.lineTo(SQUARE.x0, -SQUARE.z0);
  const x0 = -74, x1 = 74, z0 = -47, z1 = 47, r = 9;
  const h = new THREE.Path();
  h.moveTo(x0 + r, -z0);
  h.lineTo(x1 - r, -z0); h.quadraticCurveTo(x1, -z0, x1, -z0 - r);
  h.lineTo(x1, -z1 + r); h.quadraticCurveTo(x1, -z1, x1 - r, -z1);
  h.lineTo(x0 + r, -z1); h.quadraticCurveTo(x0, -z1, x0, -z1 + r);
  h.lineTo(x0, -z0 - r); h.quadraticCurveTo(x0, -z0, x0 + r, -z0);
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 12);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.045, 0);
  return g;
}

/** Ground: opaque disc (R_GROUND) with a hole for the campus plinth, and the far ring (R_GROUND → R_FAR). */
function groundGeometry() {
  const s = new THREE.Shape();
  s.absarc(0, 0, 2500, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  h.moveTo(-74, -47); h.lineTo(74, -47); h.lineTo(74, 47); h.lineTo(-74, 47); h.lineTo(-74, -47);
  s.holes.push(h);
  const inner = new THREE.ShapeGeometry(s, 96);
  inner.rotateX(-Math.PI / 2);
  const ring = ringGeometry(2500, R_GROUND, 160, 14);
  const g = mergeFlat([inner, ring]);
  return g;
}
function ringGeometry(r0: number, r1: number, A: number, K: number) {
  const pos: number[] = [], idx: number[] = [];
  for (let k = 0; k <= K; k++) {
    const r = r0 * Math.pow(r1 / r0, k / K);
    for (let a = 0; a <= A; a++) { const t = (a / A) * Math.PI * 2; pos.push(Math.cos(t) * r, 0, Math.sin(t) * r); }
  }
  for (let k = 0; k < K; k++) for (let a = 0; a < A; a++) {
    const i0 = k * (A + 1) + a, i1 = i0 + 1, j0 = i0 + A + 1, j1 = j0 + 1;
    idx.push(i0, i1, j0, i1, j1, j0); // counter-clockwise seen from above
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
/** merge flat (upward) geometries keeping only positions, normals = +Y */
function mergeFlat(list: THREE.BufferGeometry[]) {
  const pos: number[] = [], idx: number[] = [];
  for (const g of list) {
    const p = g.attributes.position as THREE.BufferAttribute, o = pos.length / 3;
    for (let i = 0; i < p.count; i++) pos.push(p.getX(i), 0, p.getZ(i));
    const ix = g.index; if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + o); else for (let i = 0; i < p.count; i++) idx.push(i + o);
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.setIndex(idx);
  // force CCW seen from above
  const ix = g.index!, P = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < ix.count; i += 3) {
    const a = ix.getX(i), b = ix.getX(i + 1), c = ix.getX(i + 2);
    const cr = (P.getX(b) - P.getX(a)) * (P.getZ(c) - P.getZ(a)) - (P.getZ(b) - P.getZ(a)) * (P.getX(c) - P.getX(a));
    if (cr > 0) { ix.setX(i + 1, c); ix.setX(i + 2, b); }
  }
  return g;
}

/** land use of the ground texture: urban density, greenery (Anfa gardens), hard ground (port, industry) */
function landUse(x: number, z: number): [number, number, number] {
  const d = density(x, z);
  if (d < 0.02) return [d, 0, 0];
  const zn = zoneAt(x, z, d);
  return [d, zn === Z.ANFA ? 0.85 : zn === Z.SUBURB ? 0.06 : 0, zn === Z.INDUSTRY ? 0.6 : 0];
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
function chunks<V extends { x: number; z: number }>(items: V[], size: number): V[][] {
  const m = new Map<number, V[]>();
  for (const it of items) { const k = Math.floor(it.x / size) * 1000 + Math.floor(it.z / size); let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(it); }
  return [...m.values()];
}

function Blocks({ items, mat, geo, shadow = false }: { items: Bx[]; mat: THREE.Material; geo: THREE.BufferGeometry; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // façade styles live on a per-mesh copy of the geometry (instanced attribute)
  const g = useMemo(() => {
    const c = geo.clone();
    const a = new Float32Array(items.length * 4);
    items.forEach((b, i) => a.set([b.shop ?? 0, b.win ?? 0, b.acc ?? 0, (Math.abs(Math.sin(b.x * 12.99 + b.z * 78.23)) * 43758.5) % 1], i * 4));
    c.setAttribute("aStyle", new THREE.InstancedBufferAttribute(a, 4));
    return c;
  }, [geo, items]);
  useEffect(() => () => g.dispose(), [g]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.h / 2, b.z), _q, _s.set(b.w, b.h, b.d));
      m.setMatrixAt(i, _m);
      const pal = PALETTES[b.pal ?? 0] ?? PALETTES[0];
      m.setColorAt(i, pal[Math.floor(b.c * pal.length) % pal.length]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, g]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[g, mat, items.length]} castShadow={shadow} receiveShadow={shadow} />;
}

type Inst = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number; col?: THREE.Color };
/** generic instanced props (position of the geometry's origin, per-axis scale, yaw, optional colour) */
function Instances({ items, geo, mat, shadow = false, mref }: { items: Inst[]; geo: THREE.BufferGeometry; mat: THREE.Material; shadow?: boolean; mref?: (m: THREE.InstancedMesh | null) => void }) {
  const ref = useRef<THREE.InstancedMesh | null>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.y, b.z), _q, _s.set(b.sx, b.sy, b.sz));
      m.setMatrixAt(i, _m);
      if (b.col) m.setColorAt(i, b.col);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, geo]);
  if (!items.length) return null;
  return <instancedMesh ref={(r) => { ref.current = r; mref?.(r); }} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow={shadow} />;
}

// ---------------------------------------------------------------- component
export function CityContent() {
  const P = cityPlan();
  const three = useThree((s) => s.get);
  const camera = useThree((s) => s.camera);
  useEffect(() => { DEV.three = three; DEV.stats = { boxes: P.boxes.length, near: P.near.length, segs: P.segs.length, trees: P.trees.length, palms: P.palms.length, roofs: P.roofs.length, minarets: P.minarets.length, hips: P.hips.length, pools: P.pools.length }; }, [three, P]);
  const mosque = MOSQUE;
  useEffect(() => { registerSolids("city", citySolids(P, LEGACY_LANDMARKS)); }, [P]);

  const res = useMemo(() => {
    const box = unitBox();
    const bld = facadeMaterial();
    const sign = plainMat({ color: COL.sign, emissive: "#FFF1D6", emissiveIntensity: 0.1, roughness: 0.5 }, "sign");
    const streets = streetGeometry(P.segs, P.plazas);
    const street = streetMaterial();
    const plaza = new THREE.CircleGeometry(PLAZA_R, 64).rotateX(-Math.PI / 2).translate(RB.x, 0.028, RB.z);
    plaza.setAttribute("aRoad", new THREE.BufferAttribute(new Float32Array(plaza.attributes.position.count * 4).map((_, i) => [4, 0, -1, 99][i % 4]), 4));
    const land = landTexture(landUse);
    const ground = groundGeometry();
    const groundMat = groundMaterial(land, false);
    const far = ringGeometry(R_GROUND, R_FAR, 384, 44);
    const n = new Float32Array((far.attributes.position as THREE.BufferAttribute).count * 3); for (let i = 1; i < n.length; i += 3) n[i] = 1;
    far.setAttribute("normal", new THREE.BufferAttribute(n, 3));
    const farMat = groundMaterial(land, true);
    const lawns = lawnGeometry(P.parks);
    const lawnMat = lawnMaterial();
    const tree = treeCrown(1), treeLo = treeCrown(0);
    const treeMat = plainMat({ vertexColors: true, roughness: 0.9 }, "tree");
    const trunk = new THREE.CylinderGeometry(0.16, 0.26, 1, 6).translate(0, 0.5, 0);
    const trunkMat = plainMat({ color: COL.trunk, roughness: 0.95 }, "trunk");
    const palmTrunk = new THREE.CylinderGeometry(0.24, 0.34, 1, 6, 1, true).translate(0, 0.5, 0);
    const palmTrunkMat = plainMat({ color: COL.palmTrunk, roughness: 0.95 }, "palmtrunk");
    const crown = palmCrown(), crownLo = palmCrown(true);
    const palmMat = plainMat({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }, "palm");
    const laundryMat = plainMat({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }, "laundry");
    const car = new THREE.BoxGeometry(1.9, 1.45, 4.4);
    const carMat = plainMat({ color: "#FFFFFF", roughness: 0.4, metalness: 0.2 }, "car");
    const decals = decalGeometry(P.decals, P.pools);
    const decalMat = plainMat({ vertexColors: true, roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }, "decal");
    const tank = new THREE.CylinderGeometry(0.7, 0.7, 1.5, 7).translate(0, 0.75, 0);
    const unit = new THREE.BoxGeometry(1.6, 0.9, 1.1).translate(0, 0.45, 0);
    const dish = new THREE.CylinderGeometry(0.5, 0.12, 0.14, 7, 1, true).rotateX(-0.9).translate(0, 0.9, 0);
    const cabin = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const laundry = laundryGeometry();
    const roofMat = plainMat({ color: "#FFFFFF", roughness: 0.7, metalness: 0.05 }, "roofprops");
    const roofVC = plainMat({ vertexColors: true, roughness: 0.85 }, "roofvc");
    const cabinMat = plainMat({ color: "#FFFFFF", roughness: 0.9 }, "cabin");
    const minaret = minaretGeometry();
    const minaretMat = plainMat({ vertexColors: true, roughness: 0.75 }, "minaret");
    const hip = hipRoof();
    const roofTex = TEX.roof().clone(); roofTex.needsUpdate = true;
    const hipMat = plainMat({ map: roofTex, roughness: 0.42, metalness: 0.08, envMapIntensity: 0.9 }, "hip");
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 7, 6);
    const darkMat = plainMat({ color: "#3A3F48", roughness: 0.6 }, "dark");
    const tramBody = new THREE.BoxGeometry(32, 2.4, 2.6);
    const tramBand = new THREE.BoxGeometry(31.4, 0.8, 2.64);
    const tramMat = plainMat({ color: "#F4F5F7", roughness: 0.4, metalness: 0.1 }, "tram");
    const tramGlass = plainMat({ color: "#2E3646", roughness: 0.2, metalness: 0.3 }, "tramglass");
    const mosqueMat = plainMat({ color: COL.mosque, roughness: 0.8, emissive: "#FFD9A6", emissiveIntensity: 0 }, "lmosque");
    const roofGreen = plainMat({ color: "#2F7A5E", roughness: 0.5 }, "lroof");
    // the hospital square (a touch brighter than the pavements), its white kerbs; the district kerbs, median, roundabout island
    const square = squareGeometry();
    const squareMat = plainMat({ color: COL.square, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1 }, "square");
    const kerbW = kerbGeometry(P.kerbs.filter((k) => k.white)), kerbB = kerbGeometry(P.kerbs.filter((k) => !k.white));
    const kerbWMat = plainMat({ color: COL.squareKerb, roughness: 0.75 }, "kerbw");
    const kerbBMat = plainMat({ color: COL.kerb, roughness: 0.85 }, "kerbb");
    const island = new THREE.CylinderGeometry(RB.inner, RB.inner, 0.18, 64).translate(RB.x, 0.09, RB.z);
    const islandTop = new THREE.CircleGeometry(RB.inner - 0.45, 64).rotateX(-Math.PI / 2).translate(RB.x, 0.185, RB.z);
    const all: THREE.Material[] = [bld, sign, street, decalMat, roofMat, roofVC, laundryMat, cabinMat, tramMat, tramGlass, darkMat, groundMat, farMat, lawnMat, treeMat, trunkMat, palmTrunkMat, palmMat, carMat, mosqueMat, roofGreen, squareMat, kerbWMat, kerbBMat, minaretMat, hipMat];
    for (const m of all) m.userData.base = m.opacity;
    return { decals, decalMat, tank, unit, dish, cabin, laundry, laundryMat, treeLo, crownLo, roofMat, roofVC, cabinMat, pole, tramBody, tramBand, tramMat, tramGlass, darkMat, box, bld, sign, streets, street, plaza, land, ground, groundMat, far, farMat, lawns, lawnMat, tree, treeMat, trunk, trunkMat, palmTrunk, palmTrunkMat, crown, palmMat, car, carMat, mosqueMat, roofGreen, square, squareMat, kerbW, kerbB, kerbWMat, kerbBMat, island, islandTop, minaret, minaretMat, hip, hipMat, roofTex, all };
  }, [P]);
  useEffect(() => () => {
    for (const k of ["box", "streets", "plaza", "ground", "far", "lawns", "tree", "treeLo", "trunk", "palmTrunk", "crown", "crownLo", "car", "decals", "tank", "unit", "dish", "cabin", "laundry", "pole", "tramBody", "tramBand", "square", "kerbW", "kerbB", "island", "islandTop", "minaret", "hip"] as const) res[k].dispose();
    res.land.dispose(); res.roofTex.dispose(); res.all.forEach((m) => m.dispose());
  }, [res]);

  // building chunks (2 km tiles, frustum culled)
  const blockChunks = useMemo(() => chunks(P.boxes, 2000), [P]);
  // vegetation
  const veg = useMemo(() => {
    const r = rng(5);
    const crowns: Inst[] = [], trunks: Inst[] = [], palmT: Inst[] = [], palmC: Inst[] = [];
    const tree = (x: number, z: number, s: number, street: boolean) => {
      const rad = (street ? 2.4 : 3.1) * s * (0.85 + r() * 0.3), ht = rad * (1.5 + r() * 0.4);
      const g = GREENS[Math.floor(r() * GREENS.length)];
      crowns.push({ x, y: ht, z, sx: rad, sy: rad * 1.05, sz: rad, yaw: r() * 6, col: g });
      if (Math.hypot(x, z) < 3500) trunks.push({ x, y: 0, z, sx: s, sy: ht - rad * 0.6, sz: s, yaw: 0 });
    };
    for (const [x, z, s] of P.trees) tree(x, z, s, false);
    for (const [x, z] of P.streetTrees) tree(x, z, 1, true);
    for (const [x, z] of P.palms) {
      const h = 8 + r() * 6, lean = (r() - 0.5) * 0.06;
      palmT.push({ x, y: 0, z, sx: 1, sy: h, sz: 1, yaw: lean });
      const g = GREENS[Math.floor(r() * GREENS.length)].clone().lerp(new THREE.Color(1, 1, 1), 0.25);
      const s = 0.85 + r() * 0.3;
      palmC.push({ x, y: h, z, sx: s, sy: s, sz: s, yaw: r() * 6, col: g });
    }
    const near = (l: Inst[]) => l.filter((b) => Math.hypot(b.x, b.z) < 260), far = (l: Inst[]) => l.filter((b) => Math.hypot(b.x, b.z) >= 260);
    return { crowns: chunks(crowns, 1500), trunks: chunks(trunks, 1500), palmT: chunks(far(palmT), 1500), palmC: chunks(far(palmC), 1500), palmTN: near(palmT), palmCN: near(palmC) };
  }, [P]);
  // roof props by kind, in 1.5 km chunks (shown near the camera only)
  const props = useMemo(() => {
    const r = rng(13), out: { kind: number; items: Inst[] }[] = [];
    const lists: Inst[][] = [[], [], [], [], [], []];
    const tankW = new THREE.Color(COL.roofProps), tankB = new THREE.Color(COL.tankBlack), unitC = new THREE.Color(COL.unit), dishC = new THREE.Color(COL.dish);
    const roofTone = [new THREE.Color("#E9E5DC"), new THREE.Color("#DCD6CB"), new THREE.Color("#EFEDE7"), new THREE.Color("#D8CCB6")];
    for (const p of P.roofs) {
      const yaw = r() * 6;
      switch (p.k) {
        case 0: lists[0].push({ x: p.x, y: p.y, z: p.z, sx: p.s, sy: p.s, sz: p.s, yaw, col: tankW }); break;
        case 5: lists[0].push({ x: p.x, y: p.y, z: p.z, sx: p.s, sy: p.s, sz: p.s, yaw, col: tankB }); break;
        case 1: lists[1].push({ x: p.x, y: p.y, z: p.z, sx: p.s, sy: p.s, sz: p.s, yaw, col: unitC }); break;
        case 2: lists[2].push({ x: p.x, y: p.y, z: p.z, sx: p.s, sy: p.s, sz: p.s, yaw, col: dishC }); break;
        case 3: lists[3].push({ x: p.x, y: p.y, z: p.z, sx: 2.8 * p.s, sy: 2.6, sz: 3.2 * p.s, yaw: 0, col: roofTone[Math.floor(r() * roofTone.length)] }); break;
        case 4: lists[4].push({ x: p.x, y: p.y, z: p.z, sx: p.s, sy: 1, sz: 1, yaw, col: undefined }); break;
      }
    }
    lists.forEach((l, kind) => { for (const c of chunks(l, 1500)) out.push({ kind, items: c }); });
    return out;
  }, [P]);
  const minarets = useMemo<Inst[]>(() => P.minarets.map((m) => ({ x: m.x, y: 0, z: m.z, sx: m.s, sy: m.h, sz: m.s, yaw: 0 })), [P]);
  const hips = useMemo<Inst[]>(() => P.hips.map((h) => ({ x: h.x, y: h.y, z: h.z, sx: h.w, sy: h.h, sz: h.d, yaw: h.yaw })), [P]);
  const parked = useMemo<Inst[]>(() => P.parked.map((b) => ({ x: b.x, y: 0.72, z: b.z, sx: 1, sy: 1, sz: 1, yaw: b.yaw, col: CARS[Math.floor(b.c * CARS.length) % CARS.length] })), [P]);
  const signItems = useMemo<Inst[]>(() => P.signs.map((b) => ({ x: b.x, y: b.h - 1.6, z: b.z, sx: b.w, sy: 2.2, sz: b.d, yaw: b.yaw })), [P]);
  const poleItems = useMemo<Inst[]>(() => P.poles.map(([x, z]) => ({ x, y: 3.5, z, sx: 1, sy: 1, sz: 1, yaw: 0 })), [P]);
  const medianItems = useMemo(() => P.medians.flatMap((m) => [
    { x: (m.x0 + m.x1) / 2, y: 0.08, z: m.z, w: m.x1 - m.x0, h: 0.16, d: 2.4, k: 0 },
    { x: (m.x0 + m.x1) / 2, y: 0.165, z: m.z, w: m.x1 - m.x0 - 0.5, h: 0.02, d: 1.9, k: 1 },
  ]), [P]);
  const TRAMS = P.tram ? 3 : 0;
  const tramState = useMemo(() => Array.from({ length: TRAMS }, (_, i) => ({ s: i / TRAMS, dir: i % 2 ? -1 : 1 })), [TRAMS]);
  const tramRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const propRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const trunkRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lod = useRef<{ hi: THREE.InstancedMesh | null; lo: THREE.InstancedMesh | null }[]>([]);

  const group = useRef<THREE.Group>(null), detail = useRef<THREE.Group>(null), trees = useRef<THREE.Group>(null), palmsG = useRef<THREE.Group>(null);
  const lastOp = useRef(-1);
  useEffect(() => { DEV.root = group.current; }, []);
  useFrame((_, dt) => {
    const alt = frame.alt;
    const op = 1 - fadeIn(alt, 25_000, 60_000);
    if (group.current) group.current.visible = op > 0.005 && !DEV.hide; // hide: QA only (window.__city.hide)
    if (op <= 0.005) return;
    if (Math.abs(op - lastOp.current) > 0.003) {
      lastOp.current = op;
      for (let q = 0; q < res.all.length; q++) {
        const m = res.all[q], tr = op < 0.999 || m === res.farMat;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = (m.userData.base ?? 1) * op;
      }
    }
    if (detail.current) detail.current.visible = alt < 2000;
    if (trees.current) trees.current.visible = alt < 7000;
    if (palmsG.current) palmsG.current.visible = alt < 3200;
    // vegetation LOD: full crowns near the camera, light ones beyond; trunks only near
    if (alt < 7000) {
      const cx = camera.position.x, cz = camera.position.z, R = alt > 2500 ? -1e9 : 700 + alt * 0.6;
      for (let i = 0; i < lod.current.length; i++) {
        const p = lod.current[i], s = p.hi?.boundingSphere ?? p.lo?.boundingSphere;
        if (!s) continue;
        const close = Math.hypot(s.center.x - cx, s.center.z - cz) < R + s.radius;
        if (p.hi) p.hi.visible = close;
        if (p.lo) p.lo.visible = !close;
      }
      for (let i = 0; i < trunkRefs.current.length; i++) {
        const m = trunkRefs.current[i], s = m?.boundingSphere;
        if (m && s) m.visible = alt < 1500 && Math.hypot(s.center.x - cx, s.center.z - cz) < 900 + s.radius;
      }
    }
    // roof props: only the chunks near the camera
    if (alt < 2000) {
      const cx = camera.position.x, cz = camera.position.z, R = 1400 + alt;
      for (let i = 0; i < propRefs.current.length; i++) {
        const m = propRefs.current[i];
        if (!m) continue;
        const s = m.boundingSphere;
        m.visible = !s || Math.hypot(s.center.x - cx, s.center.z - cz) < R + s.radius;
      }
    }
    // shared uniforms: map blend by altitude, night tint, daylight, time, the map's hole around Casablanca
    if (DEV.night !== null) rt.day = 1 - DEV.night; // screenshot QA only (window.__city.night = 0…1), inert otherwise
    const night = 1 - rt.day;
    CU.uMapK.value = fadeIn(Math.max(alt, 1), 4000, 26_000);
    CU.uNight.value = night;
    CU.uDay.value = 1 - night;
    CU.uNightMul.value.set(1 + (NIGHT_MUL.x - 1) * night, 1 + (NIGHT_MUL.y - 1) * night, 1 + (NIGHT_MUL.z - 1) * night);
    CU.uTime.value = (CU.uTime.value + Math.min(dt, 0.1)) % 10_000;
    CU.uHole.value = CASA.v;
    res.mosqueMat.emissiveIntensity = night * 0.35;
    res.sign.emissiveIntensity = 0.1 + night * 0.6;
    // trams (slow, along the main boulevard; legacy)
    if (LEGACY_LANDMARKS && P.tram && alt < 2500) {
      const Lt = Math.hypot(P.tram.x1 - P.tram.x0, P.tram.z1 - P.tram.z0);
      for (let i = 0; i < tramState.length; i++) {
        const tr = tramState[i];
        tr.s = (tr.s + (tr.dir * 5.5 * Math.min(dt, 0.1)) / Lt + 1) % 1;
        const x = P.tram.x0 + (P.tram.x1 - P.tram.x0) * tr.s, z = P.tram.z0 + tr.dir * 1.6;
        _q.setFromAxisAngle(_y, 0);
        _m.compose(_v.set(x, 1.75, z), _q, _s.set(1, 1, 1)); tramRefs.current[0]?.setMatrixAt(i, _m);
        _m.compose(_v.set(x, 2.25, z), _q, _s.set(1, 1, 1)); tramRefs.current[1]?.setMatrixAt(i, _m);
      }
      for (let q = 0; q < tramRefs.current.length; q++) { const mm = tramRefs.current[q]; if (mm) mm.instanceMatrix.needsUpdate = true; }
    }
  });

  const propGeo = [res.tank, res.unit, res.dish, res.cabin, res.laundry];
  const propMat = [res.roofMat, res.roofMat, res.roofMat, res.cabinMat, res.laundryMat];
  return (
    <group ref={group}>
      <mesh geometry={res.ground} material={res.groundMat} position={[0, -0.3, 0]} receiveShadow raycast={() => null} />
      {/* drawn after the Morocco map layers (renderOrder ≤ 3) so their navy never hides it; it fades into them */}
      <mesh geometry={res.far} material={res.farMat} position={[0, -0.3, 0]} renderOrder={8} raycast={() => null} />
      <mesh geometry={res.lawns} material={res.lawnMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.streets} material={res.street} receiveShadow raycast={() => null} />
      <mesh geometry={res.plaza} material={res.street} receiveShadow raycast={() => null} />
      <mesh geometry={res.decals} material={res.decalMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.square} material={res.squareMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.kerbW} material={res.kerbWMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.kerbB} material={res.kerbBMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.island} material={res.kerbBMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.islandTop} material={res.lawnMat} receiveShadow raycast={() => null} />
      <MedianBoxes items={medianItems} geo={res.box} mats={[res.kerbBMat, res.lawnMat]} />
      {blockChunks.map((c, i) => <Blocks key={i} items={c} mat={res.bld} geo={res.box} />)}
      <Blocks items={P.near} mat={res.bld} geo={res.box} shadow />
      <Instances items={signItems} geo={res.cabin} mat={res.sign} />
      <Instances items={minarets} geo={res.minaret} mat={res.minaretMat} shadow />
      <Instances items={hips} geo={res.hip} mat={res.hipMat} />
      <CitySites />
      <group ref={trees}>
        {veg.crowns.map((c, i) => <LodPair key={"c" + i} items={c} hi={res.tree} lo={res.treeLo} mat={res.treeMat} lod={lod.current} />)}
        {veg.trunks.map((c, i) => <Instances key={"t" + i} items={c} geo={res.trunk} mat={res.trunkMat} mref={(m) => { trunkRefs.current[i] = m; }} />)}
        <group ref={palmsG}>
          {veg.palmT.map((c, i) => <Instances key={"pt" + i} items={c} geo={res.palmTrunk} mat={res.palmTrunkMat} />)}
          {veg.palmC.map((c, i) => <LodPair key={"pc" + i} items={c} hi={res.crown} lo={res.crownLo} mat={res.palmMat} lod={lod.current} />)}
          <Instances items={veg.palmTN} geo={res.palmTrunk} mat={res.palmTrunkMat} shadow />
          <Instances items={veg.palmCN} geo={res.crown} mat={res.palmMat} shadow />
        </group>
      </group>
      <group ref={detail}>
        {props.map((p, i) => (
          <group key={i}>
            <Instances items={p.items} geo={propGeo[p.kind]} mat={propMat[p.kind]} mref={(m) => { propRefs.current[i] = m; }} />
          </group>
        ))}
        <Instances items={parked} geo={res.car} mat={res.carMat} />
        <Instances items={poleItems} geo={res.pole} mat={res.darkMat} />
        {P.tram && (
          <>
            {[-1.6, 1.6].map((tz) => (
              <mesh key={tz} material={res.darkMat} position={[(P.tram!.x0 + P.tram!.x1) / 2, 6.1, P.tram!.z0 + tz]}>
                <boxGeometry args={[P.tram!.x1 - P.tram!.x0, 0.04, 0.04]} />
              </mesh>
            ))}
            {LEGACY_LANDMARKS && (
              <>
                <instancedMesh ref={(r) => { tramRefs.current[0] = r; }} args={[res.tramBody, res.tramMat, TRAMS]} frustumCulled={false} />
                <instancedMesh ref={(r) => { tramRefs.current[1] = r; }} args={[res.tramBand, res.tramGlass, TRAMS]} frustumCulled={false} />
              </>
            )}
          </>
        )}
      </group>
      <Traffic net={P.net} />
      {/* Hassan II-like mosque and minaret by the sea (legacy) */}
      {LEGACY_LANDMARKS && <group position={[mosque.x, 0, mosque.z]} rotation-y={mosque.yaw}>
        <mesh material={res.mosqueMat} position={[0, 2.5, 0]} castShadow><boxGeometry args={[300, 5, 190]} /></mesh>
        <mesh material={res.mosqueMat} position={[30, 16, 10]}><boxGeometry args={[190, 22, 100]} /></mesh>
        <mesh material={res.roofGreen} position={[30, 28.5, 10]}><boxGeometry args={[150, 3, 70]} /></mesh>
        <mesh material={res.mosqueMat} position={[-95, 100, -40]}><boxGeometry args={[25, 200, 25]} /></mesh>
        <mesh material={res.roofGreen} position={[-95, 202, -40]}><boxGeometry args={[25.5, 4, 25.5]} /></mesh>
        <mesh material={res.mosqueMat} position={[-95, 213, -40]}><boxGeometry args={[13, 18, 13]} /></mesh>
        <mesh material={res.roofGreen} position={[-95, 225, -40]}><coneGeometry args={[7, 8, 4]} /></mesh>
      </group>}
    </group>
  );
}

/** the same instances with a detailed and a light geometry; CityContent switches them by camera distance */
function LodPair({ items, hi, lo, mat, lod }: { items: Inst[]; hi: THREE.BufferGeometry; lo: THREE.BufferGeometry; mat: THREE.Material; lod: { hi: THREE.InstancedMesh | null; lo: THREE.InstancedMesh | null }[] }) {
  const slot = useMemo(() => { const e = { hi: null as THREE.InstancedMesh | null, lo: null as THREE.InstancedMesh | null }; lod.push(e); return e; }, [lod]);
  useEffect(() => () => { const k = lod.indexOf(slot); if (k >= 0) lod.splice(k, 1); }, [lod, slot]);
  return (
    <>
      <Instances items={items} geo={hi} mat={mat} mref={(m) => { slot.hi = m; }} />
      <Instances items={items} geo={lo} mat={mat} mref={(m) => { slot.lo = m; if (m) m.visible = false; }} />
    </>
  );
}

/** Raised median of the front boulevard: kerb body + lawn top (k = material index). */
function MedianBoxes({ items, geo, mats }: { items: { x: number; y: number; z: number; w: number; h: number; d: number; k: number }[]; geo: THREE.BufferGeometry; mats: THREE.Material[] }) {
  const lists = useMemo(() => mats.map((_, k) => items.filter((b) => b.k === k).map((b) => ({ x: b.x, y: b.y - b.h / 2, z: b.z, sx: b.w, sy: b.h, sz: b.d, yaw: 0 }))), [items, mats]);
  const g = useMemo(() => geo.clone().translate(0, 0.5, 0), [geo]);
  useEffect(() => () => g.dispose(), [g]);
  return <>{lists.map((l, k) => <Instances key={k} items={l} geo={g} mat={mats[k]} shadow={k === 0} />)}</>;
}
