"use client";
// The Casablanca Finance City cluster: a signature tower in the manner of the Morphosis CFC tower (white, tapering at the base
// and at a shard-like crown, its middle wrapped in a lattice brise-soleil of nested diamonds over dark glazing) and four
// neighbours in the curtain-wall language of the district (cool, green and bronze glass with their night glow). Built on the
// park cells of the city plan nearest to plan.CFC, each tower nudged so no street tree stands in its footprint.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { CFC, cityPlan } from "../plan";
import type { Solid } from "../collide";
import { ENV, rng } from "./env";
import { TEX } from "./textures";
import { chamfered, loft, merge, texBox, texFloor, type G, type Ring } from "./geo";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { cfcDistrictTowers } from "./CfcDistrict";

type Kind = "sig" | "slab" | "slender" | "twin" | "podium";
type Lot = { x: number; z: number; w: number; d: number; kind: Kind };
export type CfcTower = { x: number; z: number; yaw: number; kind: Kind; fw: number; fd: number; h: number };

/** Park cells nearest to the CFC centre (plus the block that contains it) become the lots, nearest = signature tower. */
function lots(): Lot[] {
  const P = cityPlan();
  const near = P.parks.map(([x, z, w, d]) => ({ x, z, w, d, dist: Math.hypot(x - CFC.x, z - CFC.y) })).filter((p) => p.dist < 450).sort((a, b) => a.dist - b.dist);
  const kinds: Kind[] = ["sig", "slab", "twin", "podium", "slender"];
  const out: Lot[] = near.slice(0, 5).map((p, i) => ({ x: p.x, z: p.z, w: p.w, d: p.d, kind: kinds[i] }));
  // the block holding the centre (grid pitch 120 m, lines at 120 k + 60): a slender tower in its courtyard
  const cx = Math.floor((CFC.x - 60) / 120) * 120 + 120, cz = Math.floor((CFC.y - 60) / 120) * 120 + 120;
  if (!out.some((o) => Math.hypot(o.x - cx, o.z - cz) < 30) && out.length < 5) out.push({ x: cx, z: cz, w: 100, d: 100, kind: "slender" });
  else if (out.length >= 5) out[4] = { x: cx, z: cz, w: 74, d: 74, kind: "slender" };
  return out;
}

/** The main towers of the real district (landmarks/CfcDistrict, which replaces this cluster): footprints for the
 *  pedestrians' plazas. */
let REAL: CfcTower[] | null = null;
export function cfcTowers(): CfcTower[] {
  return (REAL ??= cfcDistrictTowers().map((t) => ({ ...t, kind: "slab" as Kind })));
}

/** The towers of the generic cluster (footprints, for its colliders and geometry). */
let TOWERS: CfcTower[] | null = null;
export function cfcClusterTowers(): CfcTower[] {
  if (TOWERS) return TOWERS;
  const P = cityPlan(), r = rng(77);
  const spec: Record<Kind, { fw: number; fd: number; h: number }> = {
    sig: { fw: 34, fd: 30, h: 130 }, slab: { fw: 46, fd: 28, h: 104 }, slender: { fw: 24, fd: 24, h: 92 }, twin: { fw: 64, fd: 40, h: 52 }, podium: { fw: 56, fd: 40, h: 100 },
  };
  TOWERS = lots().map((l) => {
    const s = spec[l.kind], mx = Math.max(0, l.w / 2 - s.fw / 2 - 6), mz = Math.max(0, l.d / 2 - s.fd / 2 - 6);
    let best = { x: l.x, z: l.z, c: 1e9 };
    for (let ox = -mx; ox <= mx + 0.1; ox += 6) for (let oz = -mz; oz <= mz + 0.1; oz += 6) {
      const x = l.x + ox, z = l.z + oz;
      let c = Math.hypot(ox, oz) * 0.02;
      for (const [tx, tz, ts] of P.trees) if (Math.abs(tx - x) < s.fw / 2 + 3.5 * ts && Math.abs(tz - z) < s.fd / 2 + 3.5 * ts) c += 10;
      for (const [px, pz] of P.palms) if (Math.abs(px - x) < s.fw / 2 + 2 && Math.abs(pz - z) < s.fd / 2 + 2) c += 6;
      if (c < best.c) best = { x, z, c };
    }
    return { x: best.x, z: best.z, yaw: l.kind === "sig" ? 0.12 : l.kind === "slender" ? 0 : (r() - 0.5) * 0.1, kind: l.kind, fw: s.fw, fd: s.fd, h: s.h };
  });
  return TOWERS;
}

export function cfcSolids(): Solid[] {
  return cfcClusterTowers().flatMap((t) => yawedSolids(t.x, t.z, t.yaw, -t.fw / 2, t.fw / 2, -t.fd / 2, t.fd / 2, t.h, 10));
}

type Bucket = Record<string, G[]>;
const add = (b: Bucket, k: string, g: G) => { (b[k] ??= []).push(g); };
const GT: [number, number] = [27.2, 30];                      // curtain-wall tile (8 bays × 8 floors)

/** place a geometry built around the origin at a tower (world) */
const put = (g: G, t: CfcTower, lx = 0, lz = 0, y = 0) => {
  const c = Math.cos(t.yaw), s = Math.sin(t.yaw);
  return g.rotateY(t.yaw).translate(t.x + lx * c + lz * s, y, t.z - lx * s + lz * c);
};
/** a glass box of a tower, from y0 to y0 + h, centred at local (lx, lz) */
const glassBox = (b: Bucket, v: string, t: CfcTower, w: number, h: number, d: number, y0: number, lx = 0, lz = 0) => {
  add(b, "glass." + v, put(texBox(w, h, d, GT, [0, 0, 0], { snap: true, drop: [2, 3] }), t, lx, lz, y0));
  add(b, "roof", put(texBox(w + 0.5, 0.7, d + 0.5, [6, 6], [0, h, 0]), t, lx, lz, y0));
};

function build() {
  const towers = cfcClusterTowers();
  const glass = { cool: TEX.glass("cool"), green: TEX.glass("green"), bronze: TEX.glass("bronze") };
  const lat = TEX.lattice();
  const mk = (g: { map: THREE.Texture; glow: THREE.Texture }) => new THREE.MeshStandardMaterial({ map: g.map, roughness: 0.28, metalness: 0.32, envMapIntensity: 1.25, emissive: "#FFFFFF", emissiveMap: g.glow, emissiveIntensity: 0 });
  const M: Record<string, THREE.MeshStandardMaterial> = {
    "glass.cool": mk(glass.cool), "glass.green": mk(glass.green), "glass.bronze": mk(glass.bronze),
    lattice: new THREE.MeshStandardMaterial({ map: lat.map, roughness: 0.55, metalness: 0.12, envMapIntensity: 0.9, emissive: "#FFFFFF", emissiveMap: lat.glow, emissiveIntensity: 0 }),
    concrete: new THREE.MeshStandardMaterial({ color: "#E9E5DA", roughness: 0.78 }),
    roof: new THREE.MeshStandardMaterial({ color: "#7A8196", roughness: 0.8 }),
    plaza: new THREE.MeshStandardMaterial({ map: TEX.plaza(), roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -3 }),
    steel: new THREE.MeshStandardMaterial({ color: "#B9C0D0", roughness: 0.4, metalness: 0.6 }),
  };
  const b: Bucket = {};
  for (const t of towers) {
    add(b, "plaza", texFloor(t.fw + 26, t.fd + 26, [8, 8], [t.x, 0.13, t.z], t.yaw));
    if (t.kind === "sig") {
      const ring = (y: number, hx: number, hz: number, c: number, ox = 0, oz = 0): Ring => ({ y, p: chamfered(hx, hz, c, ox, oz) });
      const flareLow: Ring[] = [ring(0, 12.5, 11, 3), ring(8, 14.5, 12.8, 3.6)];
      const flareUp: Ring[] = [ring(8, 14.5, 12.8, 3.6), ring(20, 17, 14.8, 4)];
      const shaft: Ring[] = [ring(20, 17, 14.8, 4), ring(108, 17, 14.8, 4)];
      const crownLow: Ring[] = [ring(108, 17, 14.8, 4), ring(116, 14.6, 12.2, 4.4, 0.6, -0.5)];
      const crown: Ring[] = [ring(116, 14.6, 12.2, 4.4, 0.6, -0.5), ring(123, 11.2, 9.2, 4.6, 2.4, -1.8), ring(128, 7.2, 5.8, 3.5, 4.6, -3.4), ring(t.h + 0.5, 3.2, 2.4, 1.5, 6.6, -4.6)];
      add(b, "glass.cool", put(loft(flareLow, GT, [0, 0, 0], { snap: true }), t));
      add(b, "concrete", put(loft(flareUp, [8, 8], [0, 0, 0]), t));
      add(b, "lattice", put(loft(shaft, [12, 12], [0, 0, 0], { snap: true }), t));
      add(b, "glass.cool", put(loft(crownLow, GT, [0, 0, 0], { snap: true }), t));
      add(b, "glass.cool", put(loft(crown, GT, [0, 0, 0], { snap: true, cap: true }), t));
      // an open crown terrace: a slender steel mast
      add(b, "steel", put(texBox(0.5, 14, 0.5, [2, 2], [0, 0, 0]), t, 6.6, -4.6, t.h + 0.5));
    } else if (t.kind === "slab") {
      glassBox(b, "cool", t, t.fw, t.h, t.fd, 0);
      glassBox(b, "cool", t, 26, 7, 14, t.h + 0.7, 4, 0);
      add(b, "concrete", put(texBox(t.fw + 1.2, 6, t.fd + 1.2, [6, 6], [0, 0, 0], { drop: [2, 3] }), t));
    } else if (t.kind === "slender") {
      glassBox(b, "green", t, t.fw, 64, t.fd, 0);
      glassBox(b, "green", t, t.fw - 4, 16, t.fd - 4, 64.7);
      glassBox(b, "green", t, t.fw - 10, 12, t.fd - 10, 81.4);
      add(b, "concrete", put(texBox(t.fw + 1.2, 5, t.fd + 1.2, [6, 6], [0, 0, 0], { drop: [2, 3] }), t));
    } else if (t.kind === "twin") {
      for (const s of [-1, 1]) {
        glassBox(b, s < 0 ? "bronze" : "cool", t, 20, t.h, t.fd, 0, s * 22, 0);
        add(b, "concrete", put(texBox(21.2, 5, t.fd + 1.2, [6, 6], [0, 0, 0], { drop: [2, 3] }), t, s * 22, 0));
      }
      add(b, "concrete", put(texBox(24, 9, 14, [6, 6], [0, 0, 0]), t, 0, 0)); // the link between the two slabs
    } else {
      glassBox(b, "bronze", t, t.fw, 26, t.fd, 0);
      glassBox(b, "cool", t, 28, t.h - 26, 28, 26.7, -8, 0);
      glassBox(b, "cool", t, 22, 10, 22, t.h + 0.7, -8, 0);
      add(b, "concrete", put(texBox(t.fw + 1.2, 4, t.fd + 1.2, [6, 6], [0, 0, 0], { drop: [2, 3] }), t));
    }
  }
  const parts = Object.entries(b).map(([k, list]) => ({ key: k, geo: merge(list)! }));
  return { M, parts };
}

export function Cfc() {
  const res = useMemo(build, []);
  const root = useRef<THREE.Group>(null);
  const fade = useRef({ v: -1 });
  const list = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  useEffect(() => () => { res.parts.forEach((p) => p.geo.dispose()); list.forEach((m) => m.dispose()); }, [res, list]);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    setFade(list, op, fade.current);
    const n = ENV.night;
    res.M["glass.cool"].emissiveIntensity = res.M["glass.green"].emissiveIntensity = res.M["glass.bronze"].emissiveIntensity = n * 0.85;
    res.M.lattice.emissiveIntensity = n * 0.8;
  });
  return <group ref={root}>{res.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]} raycast={() => null} />)}</group>;
}
