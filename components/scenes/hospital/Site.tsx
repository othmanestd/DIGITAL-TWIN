"use client";
// The campus around the buildings: plinth (architectural model base), roads, plaza, lawns, trees, parking, canopies,
// the AKDITAL sign, ambulances, plus the roofs and the glass skybridge (they lift away when a floor below is opened).
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { ANNEX, FLOOR_H, MAIN } from "@/lib/hospital";
import { useApp } from "@/lib/store";
import { GEO, PAL, rt, setFloorOpacity } from "./mats";
import { letteringTexture, logoTexture, ribbonGeometry } from "./Facade";
import { TOP_FLOOR } from "./layout";
import { CAMPUS } from "@/components/scenes/city/district";
import { registerSolids, type Solid } from "@/components/scenes/city/collide";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; color?: string };
function Boxes({ geo = GEO.box, mat, items, shadow = true }: { geo?: THREE.BufferGeometry; mat: THREE.Material; items: Box[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromEuler(_e.set(0, b.yaw ?? 0, 0));
      _m.compose(_v.set(b.x, b.y, b.z), _q, _s.set(b.sx, b.sy, b.sz));
      m.setMatrixAt(i, _m);
      if (b.color) m.setColorAt(i, _c.set(b.color));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow />;
}

const std = (color: string, rough = 0.9, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

// ---------------------------------------------------------------- site plan (campus frame, front = +z)
const SITE = { x0: -60, x1: 88, z0: -42, z1: 52, r: 9, depth: 5.6 };
// The campus group sits at CAMPUS_OFFSET = (−14, 0, −5) in the unified world: campus = world + (14, 0, 5).
// The vehicle loop (city/district.ts CAMPUS) is defined in world metres so it lines up with the city streets.
const OX = 14, OZ = 5;

function textTexture(text: string, color: string, w = 1024, h = 160, weight = 600, spacing = 0.32, bg?: string) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  const fam = typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "system-ui";
  const size = Math.round(h * 0.62);
  g.font = `${weight} ${size}px ${fam}`;
  g.fillStyle = color;
  g.textBaseline = "middle";
  const chars = [...text];
  const widths = chars.map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * size * (chars.length - 1);
  let x = (w - total) / 2;
  chars.forEach((ch, i) => { g.fillText(ch, x, h / 2 + size * 0.04); x += widths[i] + spacing * size; });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function helipadTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = "#D9DEE7"; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#F7F8FA"; g.lineWidth = 14; g.beginPath(); g.arc(256, 256, 214, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#F7F8FA";
  g.fillRect(176, 150, 40, 212); g.fillRect(296, 150, 40, 212); g.fillRect(176, 236, 160, 40);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(128, 128, 30, 128, 128, 128);
  gr.addColorStop(0, "rgba(2,4,12,0.55)");
  gr.addColorStop(0.6, "rgba(2,4,12,0.25)");
  gr.addColorStop(1, "rgba(2,4,12,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** Ground apron around the plinth: plinth colour fading to transparent over `w` metres (blends into a map underneath). */
function apronGeometry(w: number) {
  const { x0, x1, z0, z1 } = SITE;
  const inner = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const outer = [[x0 - w, z0 - w], [x1 + w, z0 - w], [x1 + w, z1 + w], [x0 - w, z1 + w]];
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  for (let i = 0; i < 4; i++) {
    pos.push(inner[i][0], 0, inner[i][1]); col.push(1, 1, 1, 0.95);
    pos.push(outer[i][0], 0, outer[i][1]); col.push(1, 1, 1, 0);
  }
  for (let i = 0; i < 4; i++) {
    const a = i * 2, b = a + 1, c = ((i + 1) % 4) * 2, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function Site({ standalone = false }: { standalone?: boolean }) {
  const select = useApp((s) => s.select);
  const res = useMemo(() => {
    // plinth with a pit for the basement
    const { x0, x1, z0, z1, r } = SITE;
    const sh = new THREE.Shape();
    // shape in XY with y = −z (rotated −90° about X afterwards)
    sh.moveTo(x0 + r, -z0);
    sh.lineTo(x1 - r, -z0); sh.quadraticCurveTo(x1, -z0, x1, -z0 - r);
    sh.lineTo(x1, -z1 + r); sh.quadraticCurveTo(x1, -z1, x1 - r, -z1);
    sh.lineTo(x0 + r, -z1); sh.quadraticCurveTo(x0, -z1, x0, -z1 + r);
    sh.lineTo(x0, -z0 - r); sh.quadraticCurveTo(x0, -z0, x0 + r, -z0);
    const hw = MAIN.w / 2 + 0.62, hd = MAIN.d / 2 + 0.62;
    const hole = new THREE.Path();
    hole.moveTo(-hw, -hd); hole.lineTo(-hw, hd); hole.lineTo(hw, hd); hole.lineTo(hw, -hd); hole.lineTo(-hw, -hd);
    sh.holes.push(hole);
    const plinth = new THREE.ExtrudeGeometry(sh, { depth: SITE.depth, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 3, curveSegments: 24 });
    plinth.rotateX(-Math.PI / 2);
    plinth.translate(0, -SITE.depth - 0.25, 0);

    const mats = {
      top: std(PAL.plinthTop, 0.95), side: std(PAL.plinthSide, 0.9), road: std(PAL.road, 0.95), lawn: std(PAL.lawn, 1), paving: std(PAL.paving, 0.95),
      white: std("#F3F4F7", 0.85), light: std("#DCE0E8", 0.8), grey: std("#9AA3B4", 0.6), dark: std("#394155", 0.5),
      glass: new THREE.MeshStandardMaterial({ color: "#7E8AA3", roughness: 0.2, metalness: 0.15 }),
      car: std("#FFFFFF", 0.45, { metalness: 0.15 }), tree: std("#FFFFFF", 0.9, { flatShading: true }), trunk: std("#B9AE9E", 0.9),
      coral: std("#C9776C", 0.7), line: std("#F6F7FA", 0.9),
    };

    // ground surfaces (thin boxes on the plinth top); fw takes WORLD x0, x1, z0, z1 (see OX, OZ)
    const flat = (x0: number, x1: number, z0: number, z1: number, y = 0.02): Box => ({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, sx: x1 - x0, sy: 0.04, sz: z1 - z0 });
    const fw = (x0: number, x1: number, z0: number, z1: number, y = 0.02) => flat(x0 + OX, x1 + OX, z0 + OZ, z1 + OZ, y);
    const C = CAMPUS, ca = C.ca, hE = C.rampE.w / 2, hW = C.rampW.w / 2, hdl = C.drop.w / 2, ht = C.tin.w / 2;
    const PK = { x0: -70, x1: -44, z0: -15, z1: 28, aisle: C.tout.x };   // car park (world); its north–south aisle lines up with the exit throat
    const roads: Box[] = [
      fw(ca.x0, ca.x1, ca.z0, ca.z1),                                                  // contre-allée (one-way, westbound)
      fw(C.tin.x - ht, C.tin.x + ht, ca.z1 - 0.1, 47.2), fw(C.tout.x - ht, C.tout.x + ht, ca.z1 - 0.1, 47.2), // entry / exit throats
      fw(C.rampE.x - hE, C.rampE.x + hE, C.drop.z + hdl, ca.z0 + 0.1),                    // east ramp (up to the drop-off)
      fw(C.rampW.x - hW, C.rampW.x + hW, C.drop.z + hdl, ca.z0 + 0.1),                    // west ramp (back down)
      fw(C.rampW.x - hW, C.rampE.x + hE, C.drop.z - hdl, C.drop.z + hdl),                  // drop-off lane under the canopy
      fw(-4.5, 12, 8.6, C.drop.z - hdl),                                                  // ambulance bay (Urgences)
      fw(PK.x0, PK.x1, PK.z0, PK.z1),                                                    // car park
      fw(PK.x1, C.rampW.x - hW, C.drop.z - hdl, C.drop.z + hdl),                           // car park <- drop-off lane
      fw(PK.aisle - 3, PK.aisle + 3, PK.z1 - 0.1, ca.z0 + 0.1),                          // car park -> exit throat
    ];
    const lawns: Box[] = [
      flat(SITE.x0 + 0.5, SITE.x1 - 0.5, -41, -16, 0.015),
      flat(60, SITE.x1 - 0.5, -16, 36, 0.015),
      flat(-29, -26.6, -14, 19, 0.015),
      flat(-19, 25.5, 25.5, 36, 0.015),
      flat(33, 59, 21, 36, 0.015),
      fw(-73.6, ca.x0, PK.z1 + 0.2, ca.z1, 0.015), fw(ca.x1, 73.6, 31, ca.z1, 0.015),   // ends of the contre-allée
      fw(PK.x0, PK.aisle - 3, PK.z1, ca.z0, 0.015), fw(PK.aisle + 3, C.rampW.x - hW, PK.z1, ca.z0, 0.015),
    ];
    const paving: Box[] = [
      flat(-14, 9, 13.6, 20.2, 0.025),                   // entrance forecourt
      flat(-8, 6, 24.6, 36, 0.03),                       // plaza across the lane
      flat(33.5, 59, 7.4, 20.2, 0.025),                  // head-office forecourt
      flat(26.6, 34.6, -16, 13.4, 0.022),                // walkway between buildings
      // front pavement along the boulevard (between the throats), with the bus shelter
      fw(-73.6, C.tout.x - ht, ca.z1, 47.2, 0.022), fw(C.tout.x + ht, C.tin.x - ht, ca.z1, 47.2, 0.022), fw(C.tin.x + ht, 73.6, ca.z1, 47.2, 0.022),
    ];
    // markings: car-park bays, zebras (stripes along the road), one-way arrows, the ambulance bay edge
    const lines: Box[] = [], coral: Box[] = [];
    const ln = (x: number, z: number, sx: number, sz: number, yaw = 0) => lines.push({ x: x + OX, y: 0.05, z: z + OZ, sx, sy: 0.01, sz, yaw });
    const stallW = 2.6, rows: [number, number][] = [[PK.z0, PK.z0 + 5], [-4, 1], [1, 6], [12, 17], [17, 22]]; // [z0, z1] of each row of bays
    const opensSouth = (z0: number) => z0 === PK.z0 || z0 === 1 || z0 === 17;
    for (const [z0, z1] of rows) {
      for (let x = PK.x0 + 0.6; x <= PK.aisle - 3.2; x += stallW) ln(x, (z0 + z1) / 2, 0.1, z1 - z0);
      ln((PK.x0 + 0.6 + PK.aisle - 3.2) / 2, opensSouth(z0) ? z0 : z1, PK.aisle - 3.2 - PK.x0 - 0.6, 0.1);
    }
    const zebraX = (xc: number, z0: number, z1: number) => { for (let z = z0 + 0.6; z <= z1 - 0.5; z += 1.1) ln(xc, z, 2.8, 0.5); };  // road along x
    const zebraZ = (zc: number, x0: number, x1: number) => { for (let x = x0 + 0.6; x <= x1 - 0.5; x += 1.1) ln(x, zc, 0.5, 2.8); };  // road along z
    zebraX(-16, C.drop.z - hdl, C.drop.z + hdl);          // entrance <-> plaza
    zebraX(-16, ca.z0, ca.z1);                          // plaza <-> front pavement and the bus stop
    zebraZ(42.6, C.tin.x - ht, C.tin.x + ht); zebraZ(42.6, C.tout.x - ht, C.tout.x + ht); // pavement across the throats
    const arrow = (x: number, z: number, dx: number, dz: number) => {
      const yaw = Math.atan2(dx, dz);
      ln(x, z, 0.24, 2.2, yaw);
      const hx = x + dx * 1.1, hz = z + dz * 1.1;
      for (const sd of [-1, 1]) { const a = yaw + sd * 0.62; ln(hx - Math.sin(a) * 0.55, hz - Math.cos(a) * 0.55, 0.22, 1.25, a); }
    };
    arrow(36, ca.z, -1, 0); arrow(-2, ca.z, -1, 0); arrow(-30, ca.z, -1, 0);
    arrow(C.tin.x, 41.2, 0, -1); arrow(C.tout.x, 37.4, 0, 1);
    arrow(C.rampE.x, 26, 0, -1); arrow(C.rampW.x, 26, 0, 1); arrow(6, C.drop.z, -1, 0);
    // ambulance bay edge (muted coral)
    for (const [x0, x1, z0, z1] of [[-4.5, 12, 8.75, 8.9], [-4.5, 12, C.drop.z - hdl - 0.15, C.drop.z - hdl], [-4.5, -4.35, 8.6, C.drop.z - hdl], [11.85, 12, 8.6, C.drop.z - hdl]] as const)
      coral.push({ x: (x0 + x1) / 2 + OX, y: 0.052, z: (z0 + z1) / 2 + OZ, sx: x1 - x0, sy: 0.012, sz: z1 - z0 });

    // cars
    const PAINT = ["#F4F5F7", "#C9CED8", "#8F98AA", "#4C5568", "#E6E1D8", "#B8C3D6", "#2F3647"];
    const rr = (() => { let a = 12345; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const cars: Box[] = [], cabins: Box[] = [];
    const car = (x: number, z: number, yaw: number, color: string) => {
      cars.push({ x, y: 0.62, z, sx: 1.85, sy: 0.72, sz: 4.3, yaw, color });
      const c = Math.cos(yaw), s = Math.sin(yaw);
      cabins.push({ x: x - 0.15 * s, y: 1.18, z: z - 0.15 * c, sx: 1.62, sy: 0.55, sz: 2.2, yaw });
    };
    // parked cars in the bays (nose towards the aisle), leaving gaps
    for (const [z0, z1] of rows) for (let x = PK.x0 + 0.6; x + stallW <= PK.aisle - 3.2 + 0.01; x += stallW) {
      if (rr() < 0.3) continue;
      car(x + stallW / 2 + OX, (z0 + z1) / 2 + OZ, opensSouth(z0) ? 0 : Math.PI, PAINT[Math.floor(rr() * PAINT.length)]);
    }

    // ambulances
    const amb: Box[] = [], ambCab: Box[] = [], ambStripe: Box[] = [], ambLight: Box[] = [];
    const ambulance = (x: number, z: number, yaw: number) => {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      amb.push({ x: x - 0.6 * s, y: 1.35, z: z - 0.6 * c, sx: 2.2, sy: 2.3, sz: 3.9, yaw });
      ambCab.push({ x: x + 1.75 * s, y: 0.95, z: z + 1.75 * c, sx: 2.1, sy: 1.5, sz: 1.5, yaw });
      ambStripe.push({ x: x - 0.6 * s, y: 1.25, z: z - 0.6 * c, sx: 2.24, sy: 0.28, sz: 3.94, yaw });
      ambLight.push({ x: x + 0.9 * s, y: 2.56, z: z + 0.9 * c, sx: 1.2, sy: 0.14, sz: 0.3, yaw });
    };
    for (const wx of [-1.2, 3.6, 8.4]) ambulance(wx + OX, 12.3 + OZ, Math.PI); // nose towards the Urgences doors

    // trees
    const trees: { x: number; z: number; s: number; color: string }[] = [];
    const TREE = ["#A3B99E", "#93AD94", "#B4C6AE", "#9AB3A0"];
    const tree = (x: number, z: number, s = 1) => trees.push({ x, z, s: s * (0.85 + rr() * 0.35), color: TREE[Math.floor(rr() * TREE.length)] });
    const clear = (wx: number, a: number, b: number) => wx > a && wx < b;
    for (let x = SITE.x0 + 5; x < SITE.x1 - 3; x += 7.5) {
      const wx = x - OX; // front row along the boulevard pavement: not in the throats, the bus shelter or the entrance axis
      if (!clear(wx, C.tout.x - ht - 2, C.tout.x + ht + 2) && !clear(wx, C.tin.x - ht - 2, C.tin.x + ht + 2) && !clear(wx, 3, 14) && !clear(wx, -20, -12)) tree(x, 46.5);
      if ((x < -32 && !clear(wx + 3, PK.aisle - 5, PK.aisle + 5)) || x > 34) tree(x + 3, 34.5, 0.9);
    }
    for (let i = 0; i < 26; i++) tree(SITE.x0 + 4 + rr() * (SITE.x1 - SITE.x0 - 8), -38 + rr() * 19, 1.1);
    for (let z = -12; z < 34; z += 7) tree(64 + rr() * 16, z + rr() * 3, 1.05);
    for (const x of [-6, -2, 2, 6]) tree(x - 1, 33.5, 0.8);
    tree(-6.5, 27.5, 0.75); tree(4.5, 27.5, 0.75);
    for (let z = -12; z <= 30; z += 9.5) tree(-58 + 2.2, z, 0.85);
    for (const x of [36, 56]) for (const z of [11, 16]) tree(x, z, 0.8);
    tree(-28, -6, 0.8); tree(-28, 6, 0.8); tree(-28, 16, 0.8);
    // a few more trees and planters grow with the programme (2028 → 2029)
    const grow: { x: number; z: number; s: number; color: string }[] = [];
    for (const [x, z] of [[-11, 28.5], [8.5, 28.5], [-13, 15], [30.5, -8], [30.5, 4], [38, 18.5], [54, 18.5], [-24, 30]] as const) grow.push({ x, z, s: 0.7 + rr() * 0.2, color: TREE[Math.floor(rr() * TREE.length)] });
    const gTrunks: Box[] = grow.map((t) => ({ x: t.x, y: 0.9 * t.s, z: t.z, sx: 0.28 * t.s, sy: 1.8 * t.s, sz: 0.28 * t.s }));
    const gCrowns: Box[] = grow.map((t) => ({ x: t.x, y: 2.9 * t.s, z: t.z, sx: 3.2 * t.s, sy: 3.4 * t.s, sz: 3.2 * t.s, yaw: t.x, color: t.color }));
    const trunks: Box[] = trees.map((t) => ({ x: t.x, y: 0.9 * t.s, z: t.z, sx: 0.28 * t.s, sy: 1.8 * t.s, sz: 0.28 * t.s }));
    const crowns: Box[] = trees.map((t) => ({ x: t.x, y: 2.9 * t.s, z: t.z, sx: 3.2 * t.s, sy: 3.4 * t.s, sz: 3.2 * t.s, yaw: t.x * 0.37, color: t.color }));

    // plaza furniture (benches, planters, bollards)
    const benches: Box[] = [];
    for (const x of [-5, 3]) benches.push({ x, y: 0.25, z: 30, sx: 2.4, sy: 0.45, sz: 0.6 });
    for (const x of [40, 52]) benches.push({ x, y: 0.25, z: 14, sx: 2.4, sy: 0.45, sz: 0.6 });

    // canopies (main entrance, emergency, head office)
    const canopy: Box[] = [
      { x: -1, y: 4.06, z: 16.2, sx: 13, sy: 0.34, sz: 5.9 },
      { x: 17.5, y: 4.26, z: 16.7, sx: 15.5, sy: 0.34, sz: 6.9 },
      { x: ANNEX.x, y: 3.6, z: ANNEX.z + ANNEX.d / 2 + 2.0, sx: 9, sy: 0.3, sz: 4.0 },
    ];
    const posts: Box[] = [
      { x: -6.9, y: 2, z: 18.6, sx: 0.26, sy: 4, sz: 0.26 }, { x: 4.9, y: 2, z: 18.6, sx: 0.26, sy: 4, sz: 0.26 },
      { x: 10.4, y: 2.1, z: 19.6, sx: 0.26, sy: 4.2, sz: 0.26 }, { x: 24.6, y: 2.1, z: 19.6, sx: 0.26, sy: 4.2, sz: 0.26 },
      { x: ANNEX.x - 4.2, y: 1.8, z: ANNEX.z + ANNEX.d / 2 + 3.7, sx: 0.22, sy: 3.6, sz: 0.22 }, { x: ANNEX.x + 4.2, y: 1.8, z: ANNEX.z + ANNEX.d / 2 + 3.7, sx: 0.22, sy: 3.6, sz: 0.22 },
    ];

    const sign = logoTexture("row");
    const urg = textTexture("URGENCES", "#B8635A", 1024, 150, 650, 0.28, "#F3F4F7");
    const siege = textTexture("SIÈGE", "#22305E", 512, 120, 600, 0.35);
    const shadow = shadowTexture();
    const paintDrop = textTexture("DÉPOSE MINUTE", "#F6F7FA", 1024, 150, 700, 0.18);
    const paintAmb = textTexture("AMBULANCES", "#F6F7FA", 1024, 150, 700, 0.2);
    // walk-mode colliders (WORLD metres): main building outer walls with the two entrances open, the annex, posts,
    // benches, tree trunks, parked cars and ambulances (see city/collide.ts for the contract)
    const solids: Solid[] = [];
    const sw = (x0: number, x1: number, z0: number, z1: number, h: number) => solids.push({ x0, x1, z0, z1, h });
    const mx0 = MAIN.x - MAIN.w / 2 - OX, mx1 = MAIN.x + MAIN.w / 2 - OX, mz0 = MAIN.z - MAIN.d / 2 - OZ, mz1 = MAIN.z + MAIN.d / 2 - OZ, H = (TOP_FLOOR.main + 1) * FLOOR_H;
    sw(mx0 - 0.5, mx1 + 0.5, mz0 - 0.5, mz0, H); sw(mx0 - 0.5, mx0, mz0, mz1 + 0.5, H); sw(mx1, mx1 + 0.5, mz0, mz1 + 0.5, H);
    const gaps: [number, number][] = [[-18.1, -11.8], [0.5, 6.5]]; // main entrance (Accueil), emergency entrance (Urgences)
    let gx = mx0 - 0.5;
    for (const [a, b] of gaps) { sw(gx, a, mz1, mz1 + 0.5, H); gx = b; }
    sw(gx, mx1 + 0.5, mz1, mz1 + 0.5, H);
    sw(ANNEX.x - ANNEX.w / 2 - OX - 0.4, ANNEX.x + ANNEX.w / 2 - OX + 0.4, ANNEX.z - ANNEX.d / 2 - OZ - 0.4, ANNEX.z + ANNEX.d / 2 - OZ + 0.4, (TOP_FLOOR.annex + 1) * FLOOR_H);
    const boxSolid = (b: Box) => {
      const c = Math.abs(Math.cos(b.yaw ?? 0)), sn = Math.abs(Math.sin(b.yaw ?? 0));
      const ex = (b.sx * c + b.sz * sn) / 2, ez = (b.sx * sn + b.sz * c) / 2;
      sw(b.x - OX - ex, b.x - OX + ex, b.z - OZ - ez, b.z - OZ + ez, b.y + b.sy / 2);
    };
    for (const b of [...posts, ...benches, ...cars, ...amb, ...ambCab]) boxSolid(b);
    for (const t of [...trunks, ...gTrunks]) boxSolid({ ...t, sx: 0.5, sz: 0.5 });
    const apron = apronGeometry(46);
    const apronMat = new THREE.MeshStandardMaterial({ color: PAL.plinthTop, roughness: 0.95, vertexColors: true, transparent: true, depthWrite: false });
    const growMat = std("#9AB89A", 0.9, { flatShading: true });
    return { gTrunks, gCrowns, growMat, apron, apronMat, plinth, mats, roads, lawns, paving, lines, coral, cars, cabins, amb, ambCab, ambStripe, ambLight, trunks, crowns, benches, canopy, posts, sign, urg, siege, shadow, paintDrop, paintAmb, solids };
  }, []);
  useEffect(() => () => {
    res.plinth.dispose(); Object.values(res.mats).forEach((m) => m.dispose());
    res.sign.dispose(); res.urg.dispose(); res.siege.dispose(); res.shadow.dispose(); res.apron.dispose(); res.apronMat.dispose(); res.growMat.dispose();
    res.paintDrop.dispose(); res.paintAmb.dispose();
  }, [res]);
  useEffect(() => { registerSolids("campus", res.solids); }, [res]);

  const plinthMats = useMemo(() => [res.mats.top, res.mats.side], [res]);
  const growRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = growRef.current;
    if (!g) return;
    const a = Math.min(1, Math.max(0, (rt.eco - 0.35) / 0.5));
    g.visible = a > 0.01;
    g.children.forEach((c) => c.scale.setScalar(Math.max(0.001, a * a * (3 - 2 * a))));
  });
  const ground = (e: ThreeEvent<MouseEvent>) => {
    // the ground is "empty space": handled by the canvas-level click (steps back up)
    void e; void select;
  };
  const W = (SITE.x1 - SITE.x0) * 1.35, D = (SITE.z1 - SITE.z0) * 1.45;
  return (
    <group>
      <mesh geometry={res.plinth} material={plinthMats} receiveShadow castShadow onClick={ground} />
      {standalone ? (
        <mesh position={[(SITE.x0 + SITE.x1) / 2, -SITE.depth - 0.3, (SITE.z0 + SITE.z1) / 2 + 4]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[W, D]} />
          <meshBasicMaterial map={res.shadow} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ) : null /* unified world: the city's white hospital square surrounds the plinth (city/CityContent) */}
      <Boxes mat={res.mats.road} items={res.roads} shadow={false} />
      <Boxes mat={res.mats.lawn} items={res.lawns} shadow={false} />
      <Boxes mat={res.mats.paving} items={res.paving} shadow={false} />
      <Boxes mat={res.mats.line} items={res.lines} shadow={false} />
      <Boxes mat={res.mats.coral} items={res.coral} shadow={false} />
      {/* painted words: drop-off under the canopy, the ambulance bay */}
      <mesh position={[-29 + OX, 0.056, CAMPUS.drop.z + OZ]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[5.6, 0.82]} />
        <meshStandardMaterial map={res.paintDrop} transparent alphaTest={0.05} roughness={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[3.75 + OX, 0.056, 13.6 + OZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.4, 0.95]} />
        <meshStandardMaterial map={res.paintAmb} transparent alphaTest={0.05} roughness={0.9} depthWrite={false} />
      </mesh>
      <Boxes geo={GEO.rbox} mat={res.mats.car} items={res.cars} />
      <Boxes geo={GEO.rbox} mat={res.mats.glass} items={res.cabins} />
      <Boxes geo={GEO.rbox} mat={res.mats.white} items={res.amb} />
      <Boxes geo={GEO.rbox} mat={res.mats.white} items={res.ambCab} />
      <Boxes mat={res.mats.coral} items={res.ambStripe} shadow={false} />
      <Boxes mat={res.mats.grey} items={res.ambLight} shadow={false} />
      <Boxes geo={GEO.cyl} mat={res.mats.trunk} items={res.trunks} />
      <Boxes geo={GEO.sph} mat={res.mats.tree} items={res.crowns} />
      <group ref={growRef}>
        {res.gTrunks.map((t, i) => (
          <group key={i} position={[t.x, 0, t.z]}>
            <mesh geometry={GEO.cyl} material={res.mats.trunk} position={[0, t.y, 0]} scale={[t.sx, t.sy, t.sz]} castShadow />
            <mesh geometry={GEO.sph} material={res.growMat} position={[0, res.gCrowns[i].y, 0]} scale={[res.gCrowns[i].sx, res.gCrowns[i].sy, res.gCrowns[i].sz]} rotation-y={t.x} castShadow />
          </group>
        ))}
      </group>
      <Boxes mat={res.mats.light} items={res.benches} />
      <Boxes mat={res.mats.white} items={res.canopy} />
      <Boxes mat={res.mats.light} items={res.posts} />
      {/* AKDITAL letters standing on the entrance canopy */}
      <mesh position={[-1, 5.15, 18.9]}>
        <planeGeometry args={[7.2, 1.8]} />
        <meshStandardMaterial map={res.sign} transparent roughness={0.6} alphaTest={0.02} />
      </mesh>
      <mesh position={[17.5, 3.72, 20.17]}>
        <planeGeometry args={[6.6, 0.95]} />
        <meshStandardMaterial map={res.urg} roughness={0.8} />
      </mesh>
      <mesh position={[ANNEX.x, 4.15, ANNEX.z + ANNEX.d / 2 + 3.9]}>
        <planeGeometry args={[3.2, 0.75]} />
        <meshStandardMaterial map={res.siege} transparent roughness={0.6} alphaTest={0.02} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- roofs and skybridge (fade away like floors)
function useFade(key: string, hidden: boolean, baseY: number, mats: THREE.Material[], lift = 12) {
  const group = useRef<THREE.Group>(null);
  const hid = useRef(hidden);
  hid.current = hidden;
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 4.2);
    const target = hid.current ? 1 : 0;
    let h = rt.lift[key] ?? target;
    h += (target - h) * k;
    if (Math.abs(h - target) < 0.002) h = target;
    rt.lift[key] = h;
    const e = h * h * (3 - 2 * h);
    g.position.y = baseY + e * lift;
    g.visible = h < 0.985;
    if (g.visible) setFloorOpacity(mats, 1 - e);
  });
  return { group, hid };
}

function fadeMats(list: THREE.Material[]) {
  for (const m of list) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; m.userData.baseDepthWrite = m.depthWrite; }
  return list;
}

export function Roof({ building, hidden }: { building: "main" | "annex"; hidden: boolean }) {
  const B = building === "main" ? MAIN : ANNEX;
  const main = building === "main";
  const select = useApp((s) => s.select);
  const res = useMemo(() => {
    const top = std(PAL.slabTop, 0.92), edge = std(PAL.slabEdge, 0.85), unit = std("#DDE1E9", 0.7), dark = std("#AEB6C4", 0.55);
    const band = std("#F5F6F8", 0.5);
    const pad = new THREE.MeshStandardMaterial({ map: main ? helipadTexture() : null, color: "#FFFFFF", roughness: 0.8, transparent: true });
    const solar = new THREE.MeshStandardMaterial({ color: "#2A3B5E", roughness: 0.25, metalness: 0.5, envMapIntensity: 1.5 });
    const frame = std("#2B3038", 0.5, { metalness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: "#7DB8E2", roughness: 0.07, metalness: 0.35, transparent: true, opacity: 0.55, depthWrite: false, envMapIntensity: 2 });
    const letters = new THREE.MeshStandardMaterial({ map: letteringTexture(), transparent: true, roughness: 0.6, alphaTest: 0.02 });
    const logo = new THREE.MeshStandardMaterial({ map: logoTexture(main ? "row" : "stack"), transparent: true, roughness: 0.6, alphaTest: 0.02, side: THREE.DoubleSide });
    // top ribbon: the last fluid white band of the façade (main), crisp stone parapet (annex)
    const ribbon = main ? ribbonGeometry(B.w, B.d, { base: 1.05, r: 4.4, height: 1.55, wave: 0.5, phase: 0.4 }) : ribbonGeometry(B.w, B.d, { base: 0.75, r: 0.5, height: 1.1 });
    const units: Box[] = [], fans: Box[] = [], panels: Box[] = [], frames: Box[] = [];
    if (main) {
      for (const [x, z] of [[-17, -6], [-11, -6], [-17, 4]] as const) {
        units.push({ x, y: 1.1, z, sx: 4.2, sy: 1.6, sz: 3.2 });
        fans.push({ x: x - 0.9, y: 1.95, z, sx: 1.3, sy: 0.12, sz: 1.3 }, { x: x + 0.9, y: 1.95, z, sx: 1.3, sy: 0.12, sz: 1.3 });
      }
      units.push({ x: -3, y: 1.6, z: -8, sx: 3.2, sy: 2.6, sz: 3.2 }); // lift machine room
      // 2029 tech upgrade: solar rows on the free roof (appear with the programme)
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) panels.push({ x: -21 + c * 3.4, y: 0.75, z: 8.2 - r * 2.2 + (c > 1 ? 0 : 0), sx: 3.0, sy: 0.08, sz: 1.7 });
      for (let c = 0; c < 4; c++) panels.push({ x: 0.5 + c * 3.4, y: 0.75, z: 8.6, sx: 3.0, sy: 0.08, sz: 1.7 });
    } else {
      units.push({ x: -7.5, y: 1.0, z: -5.5, sx: 3.2, sy: 1.4, sz: 2.4 });
      fans.push({ x: -7.5, y: 1.75, z: -5.5, sx: 1.2, sy: 0.12, sz: 1.2 });
      // glazed rooftop pavilion with a dark frame
      const px = 1.5, pz = -1.5, pw = 11, pd = 8, ph = 3.2, y0 = 0.3, t = 0.16;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) frames.push({ x: px + (sx * pw) / 2, y: y0 + ph / 2, z: pz + (sz * pd) / 2, sx: t, sy: ph, sz: t });
      for (const sz of [-1, 1]) for (const yy of [y0, y0 + ph]) frames.push({ x: px, y: yy, z: pz + (sz * pd) / 2, sx: pw, sy: t, sz: t });
      for (const sx of [-1, 1]) for (const yy of [y0, y0 + ph]) frames.push({ x: px + (sx * pw) / 2, y: yy, z: pz, sx: t, sy: t, sz: pd });
      for (let i = 1; i < 4; i++) frames.push({ x: px - pw / 2 + (pw * i) / 4, y: y0 + ph / 2, z: pz + pd / 2, sx: 0.08, sy: ph, sz: 0.08 });
      frames.push({ x: px, y: y0 + ph + 0.18, z: pz, sx: pw + 0.8, sy: 0.22, sz: pd + 0.8 }); // thin dark roof
    }
    const mats = fadeMats([top, edge, unit, dark, band, pad, solar, frame, glass, letters, logo]);
    return { top, edge, unit, dark, band, pad, solar, frame, glass, letters, logo, ribbon, units, fans, panels, frames, mats };
  }, [B, main]);
  useEffect(() => () => { res.mats.forEach((m) => m.dispose()); res.ribbon.dispose(); }, [res]);
  const top = TOP_FLOOR[building];
  const { group, hid } = useFade(`${building}:${top + 1}`, hidden, (top + 1) * FLOOR_H, res.mats);
  const slabMats = useMemo(() => [res.edge, res.edge, res.top, res.top, res.edge, res.edge], [res]);
  const solarRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = solarRef.current;
    if (!g) return;
    const a = Math.min(1, Math.max(0, (rt.eco - 0.7) / 0.25));
    g.visible = a > 0.01;
    g.scale.set(1, a, 1);
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (hid.current || e.delta > 6) return;
    e.stopPropagation();
    rt.clickHandled = true;
    select({ kind: "floor", id: `${building}:${top}` });
  };
  const fz = B.d / 2 + (main ? 1.05 : 0.75) + 0.09; // front face of the top ribbon
  return (
    <group ref={group} position={[B.x, (top + 1) * FLOOR_H, B.z]}>
      <mesh position={[0, -0.03, 0]} material={slabMats} castShadow receiveShadow onClick={click}>
        <boxGeometry args={[B.w + 0.6, 0.66, B.d + 0.6]} />
      </mesh>
      <mesh geometry={res.ribbon} material={res.band} position={[0, -0.75, 0]} castShadow receiveShadow />
      <Boxes geo={GEO.rbox} mat={res.unit} items={res.units} />
      <Boxes geo={GEO.cyl} mat={res.dark} items={res.fans} />
      {main ? (
        <>
          <group ref={solarRef}><Boxes mat={res.solar} items={res.panels} /></group>
          <mesh position={[12, 0.31, 0]} rotation-x={-Math.PI / 2} material={res.pad} receiveShadow>
            <circleGeometry args={[7, 48]} />
          </mesh>
          {/* "Hôpital Privé Akdital" lettering along the top ribbon + the Akdital sign standing on the roof edge */}
          <mesh position={[-7, 0.02, fz + 0.5]} material={res.letters}>
            <planeGeometry args={[20, 1.83]} />
          </mesh>
          <mesh position={[15.5, 2.25, B.d / 2 - 0.2]} material={res.logo}>
            <planeGeometry args={[9.6, 2.4]} />
          </mesh>
          <Boxes mat={res.frame} items={[{ x: 12.5, y: 1.1, z: B.d / 2 - 0.3, sx: 0.12, sy: 1.6, sz: 0.12 }, { x: 18.5, y: 1.1, z: B.d / 2 - 0.3, sx: 0.12, sy: 1.6, sz: 0.12 }]} />
        </>
      ) : (
        <>
          <Boxes mat={res.frame} items={res.frames} />
          <mesh position={[1.5, 0.3 + 1.6, -1.5]} material={res.glass}><boxGeometry args={[10.9, 3.15, 7.9]} /></mesh>
          <mesh position={[B.w / 2 - 2.6, 1.55, fz + 0.03]} material={res.logo}>
            <planeGeometry args={[3.4, 2.87]} />
          </mesh>
        </>
      )}
    </group>
  );
}

export function Skybridge({ hidden }: { hidden: boolean }) {
  const res = useMemo(() => {
    const slab = std(PAL.slabTop, 0.9), edge = std(PAL.slabEdge, 0.85);
    const glass = new THREE.MeshStandardMaterial({ color: PAL.glass, roughness: 0.08, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4 });
    const mull = std(PAL.mullion, 0.5);
    return { slab, edge, glass, mull, mats: fadeMats([slab, edge, glass, mull]) };
  }, []);
  useEffect(() => () => res.mats.forEach((m) => m.dispose()), [res]);
  const y = 1 * FLOOR_H;
  const { group } = useFade("bridge", hidden, y, res.mats, 10);
  const x0 = MAIN.x + MAIN.w / 2 + 0.25, x1 = ANNEX.x - ANNEX.w / 2 - 0.25, L = x1 - x0, cx = (x0 + x1) / 2, z = -3.5;
  const mull: Box[] = [];
  for (let i = 0; i <= 4; i++) for (const s of [-1, 1]) mull.push({ x: cx - L / 2 + (L * i) / 4, y: 1.5, z: z + s * 1.75, sx: 0.08, sy: 3.0, sz: 0.1 });
  return (
    <group ref={group} position={[0, y, 0]}>
      <mesh position={[cx, -0.2, z]} material={res.edge} castShadow receiveShadow><boxGeometry args={[L, 0.4, 3.8]} /></mesh>
      <mesh position={[cx, 3.1, z]} material={res.slab} castShadow><boxGeometry args={[L, 0.3, 3.8]} /></mesh>
      <mesh position={[cx, 1.5, z]} material={res.glass}><boxGeometry args={[L, 3.0, 3.5]} /></mesh>
      <Boxes mat={res.mull} items={mull} />
    </group>
  );
}
