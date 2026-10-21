"use client";
// A Hassan II-like mosque on the shore, built from references (see the engineering notes): a platform on the sea with a
// rubble breakwater, a marble esplanade with octagonal fountains, a long prayer hall in pale stone with horseshoe arcades,
// green glazed roofs (outer hip roof + raised central nave), the square minaret with carved panels, turquoise zellige bands,
// a green zellige upper third, a lantern with arches, a green cap and a fine spire. Local frame = plan.MOSQUE (group at its
// position, rotation-y = yaw): +x seaward, +z along the coast, y up, ground = 0.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { MOSQUE } from "../plan";
import type { Solid } from "../collide";
import { ENV, rng } from "./env";
import { TEX } from "./textures";
import { archWindow, frustum, merge, texBox, texFloor, texWall, tube, xf, type G } from "./geo";
import { glowTexture, lmOpacity, setFade, yawedSolids } from "./shared";

// ---------------------------------------------------------------- layout (local metres)
const Y0 = 2.0;                                                   // esplanade level
const POD = { x0: -98, x1: 150, z0: -95, z1: 95 };
const HALL = { x0: -40, x1: 130, z0: -36, z1: 64, h: 22 };         // prayer hall, walls Y0 → Y0 + h
const HC = { x: (HALL.x0 + HALL.x1) / 2, z: (HALL.z0 + HALL.z1) / 2 };
const MIN = { x: -68, z: -44, s: 25 };                            // minaret centre and side
const FOUNTAINS: [number, number][] = [[-10, 87], [25, 87], [60, 87], [95, 87], [125, 87], [5, -72], [45, -72], [85, -72], [125, -72]];
export const MOSQUE_TOP = 212;

export function mosqueSolids(): Solid[] {
  const { x, z, yaw } = MOSQUE, S: Solid[] = [];
  S.push(...yawedSolids(x, z, yaw, POD.x0, POD.x1, POD.z0, POD.z1, Y0, 16));
  S.push(...yawedSolids(x, z, yaw, HALL.x0, HALL.x1, HALL.z0, HALL.z1, Y0 + HALL.h + 6, 12));
  S.push(...yawedSolids(x, z, yaw, -56, 130, -48, -36, 12, 14), ...yawedSolids(x, z, yaw, HALL.x0, HALL.x1, 64, 78, 12, 14));
  S.push(...yawedSolids(x, z, yaw, MIN.x - 14.2, MIN.x + 14.2, MIN.z - 14.2, MIN.z + 14.2, MOSQUE_TOP, 7));
  return S;
}

type Bucket = Record<string, G[]>;
const add = (b: Bucket, k: string, g: G) => { (b[k] ??= []).push(g); };

function build() {
  const T = {
    stone: TEX.stone(), arcade: TEX.arcade(), arcadeGlow: TEX.arcadeGlow(), panel: TEX.panel(), panelGlow: TEX.panelGlow(),
    zG: TEX.zGreen(), zT: TEX.zTurq(), roof: TEX.roof(), marble: TEX.marble(),
  };
  const M = {
    stone: new THREE.MeshStandardMaterial({ map: T.stone, roughness: 0.92, emissive: "#FFFFFF", emissiveMap: T.stone, emissiveIntensity: 0.08 }),
    arcade: new THREE.MeshStandardMaterial({ map: T.arcade, roughness: 0.9, emissive: "#FFFFFF", emissiveMap: T.arcadeGlow, emissiveIntensity: 0 }),
    panel: new THREE.MeshStandardMaterial({ map: T.panel, roughness: 0.9, emissive: "#FFFFFF", emissiveMap: T.panelGlow, emissiveIntensity: 0 }),
    zG: new THREE.MeshStandardMaterial({ map: T.zG, roughness: 0.34, metalness: 0.04, envMapIntensity: 0.9, emissive: "#FFFFFF", emissiveMap: T.zG, emissiveIntensity: 0.14 }),
    zT: new THREE.MeshStandardMaterial({ map: T.zT, roughness: 0.34, metalness: 0.04, envMapIntensity: 0.9, emissive: "#FFFFFF", emissiveMap: T.zT, emissiveIntensity: 0.14 }),
    roof: new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.4, metalness: 0.1, envMapIntensity: 1, emissive: "#FFFFFF", emissiveMap: T.roof, emissiveIntensity: 0.1 }),
    marble: new THREE.MeshStandardMaterial({ map: T.marble, roughness: 0.55, polygonOffset: true, polygonOffsetFactor: -1 }),
    glass: new THREE.MeshStandardMaterial({ color: "#2C3A44", roughness: 0.22, metalness: 0.3, emissive: "#FFC98A", emissiveIntensity: 0 }),
    metal: new THREE.MeshStandardMaterial({ color: "#C8B07C", roughness: 0.34, metalness: 0.65 }),
    water: new THREE.MeshStandardMaterial({ color: "#86AFC2", roughness: 0.08, metalness: 0.15, envMapIntensity: 1.4 }),
    rock: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }),
  };
  const far: Bucket = {}, near: Bucket = {};

  // ---- platform, esplanade, parapet, steps, breakwater
  const PW = POD.x1 - POD.x0, PD = POD.z1 - POD.z0, pcx = (POD.x0 + POD.x1) / 2;
  add(far, "stone", texBox(PW, Y0 + 0.3, PD, [6, 6], [pcx, -0.3, 0], { drop: [2, 3] }));
  add(far, "marble", texFloor(PW, PD, [20, 20], [pcx, Y0 + 0.02, 0]));
  add(far, "stone", texBox(0.8, 1.1, PD, [6, 6], [POD.x1 - 0.4, Y0, 0]));
  add(far, "stone", texBox(PW, 1.1, 0.8, [6, 6], [pcx, Y0, POD.z0 + 0.4]));
  add(far, "stone", texBox(PW, 1.1, 0.8, [6, 6], [pcx, Y0, POD.z1 - 0.4]));
  for (let k = 0; k < 5; k++) add(far, "stone", texBox(1.7, Y0 - (k + 1) * 0.33, 60, [6, 6], [POD.x0 - 0.85 - k * 1.7, 0, 0], { drop: [3] }));
  const R = rng(61), rocks: G[] = [];
  const rock = (x: number, z: number, s: number) => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    const col = new Float32Array(g.attributes.position.count * 3), t = 0.42 + R() * 0.2;
    for (let i = 0; i < col.length; i += 3) { col[i] = t * 0.92; col[i + 1] = t * 0.95; col[i + 2] = t * 1.06; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    rocks.push(xf(g, x, s * 0.35, z, R() * 6, { sx: s * (1.1 + R() * 0.4), sy: s * 0.8, sz: s * (0.9 + R() * 0.4) }));
  };
  for (let z = POD.z0 - 8; z <= POD.z1 + 8; z += 4.2) for (let k = 0; k < 2; k++) rock(POD.x1 + 3 + k * 5.5 + R() * 3, z + R() * 2, 2.6 + R() * 2.6 - k * 0.6);
  for (let x = POD.x1 - 4; x > 20; x -= 6) for (const zs of [POD.z0, POD.z1]) rock(x, zs + Math.sign(zs) * (2.5 + R() * 2.5), 2.2 + R() * 1.8);

  // ---- prayer hall: arcaded walls, outer hip roof, clerestory, raised central roof, corner turrets
  const HW = HALL.x1 - HALL.x0, HD = HALL.z1 - HALL.z0, wy = Y0 + HALL.h;
  add(far, "arcade", texBox(HW, HALL.h, HD, [24, HALL.h], [HC.x, Y0, HC.z], { snap: true, drop: [3] }));
  add(far, "roof", frustum(HW + 2.4, HD + 2.4, 102, 48, 7, [3, 3], [HC.x, wy, HC.z], { cap: true }));
  add(far, "stone", texBox(102, 6, 48, [6, 6], [HC.x, wy + 7, HC.z]));
  add(far, "roof", frustum(104, 50, 54, 24, 11, [3, 3], [HC.x, wy + 13, HC.z], { cap: true }));
  add(far, "zT", texBox(104.4, 1.3, 50.4, [4.8, 4.8], [HC.x, wy + 12.2, HC.z], { snap: true, drop: [2, 3] }));
  for (const sx of [HALL.x0 + 4, HALL.x1 - 4]) for (const sz of [HALL.z0 + 4, HALL.z1 - 4]) {
    add(far, "stone", texBox(9, 28, 9, [6, 6], [sx, Y0, sz]));
    add(far, "zT", texBox(9.6, 3, 9.6, [4.8, 4.8], [sx, Y0 + 24, sz], { snap: true, drop: [2, 3] }));
    add(far, "roof", frustum(11, 11, 0.8, 0.8, 11, [3, 3], [sx, Y0 + 28, sz], { cap: true }));
  }
  // clerestory windows (near)
  const win = archWindow(3.6, 4.4, 0.5);
  const wz = (x: number, z: number, yaw: number) => add(near, "glass", xf(win.clone(), x, wy + 7.8, z, yaw));
  for (let k = -5; k <= 5; k++) { wz(HC.x + k * 8.6, HC.z - 24.15, Math.PI); wz(HC.x + k * 8.6, HC.z + 24.15, 0); }
  for (let k = -2; k <= 2; k++) { wz(HC.x + 51.15, HC.z + k * 9, Math.PI / 2); wz(HC.x - 51.15, HC.z + k * 9, -Math.PI / 2); }

  // ---- galleries (arcaded outer face, sloping green roof)
  const gallery = (zIn: number, zOut: number, x0: number, x1: number) => {
    const dir = Math.sign(zOut - zIn), depth = Math.abs(zOut - zIn), w = x1 - x0, cx = (x0 + x1) / 2;
    add(far, "stone", texBox(w, 11, depth, [6, 6], [cx, Y0, (zIn + zOut) / 2], { drop: [3] }));
    add(far, "arcade", texWall(w, 11, [24, 11], [cx, Y0, zOut + dir * 0.03], dir > 0 ? 0 : Math.PI));
    const len = Math.hypot(depth, 3.5), roof = texBox(w + 1.6, 0.5, len + 0.6, [3, 3]);
    add(far, "roof", xf(roof, cx, Y0 + 12.9, (zIn + zOut) / 2, 0, { pitch: dir * Math.atan2(3.5, depth) }));
  };
  gallery(HALL.z1, HALL.z1 + 14, HALL.x0, HALL.x1);
  gallery(HALL.z0, HALL.z0 - 12, -56, HALL.x1);

  // ---- minaret
  const S = MIN.s, mx = MIN.x, mz = MIN.z;
  const sec = (y0: number, h: number, w: number, key: string, tile: [number, number]) => add(far, key, texBox(w, h, w, tile, [mx, y0, mz], { snap: true }));
  sec(Y0, 7, 28.4, "stone", [6, 6]);
  sec(Y0 + 7, 53, S, "panel", [S, S]);
  sec(Y0 + 60, 3.5, S + 0.8, "zT", [4.8, 4.8]);
  sec(Y0 + 63.5, 52.5, S, "panel", [S, S]);
  sec(Y0 + 116, 3.5, S + 0.8, "zT", [4.8, 4.8]);
  sec(Y0 + 119.5, 43.5, S - 0.6, "zG", [9, 9]);
  sec(Y0 + 163, 2, 29, "stone", [6, 6]);
  add(far, "arcade", texBox(15, 19, 15, [15, 19], [mx, Y0 + 165, mz], { snap: true }));
  sec(Y0 + 184, 1.2, 16.8, "stone", [6, 6]);
  add(far, "roof", frustum(16.4, 16.4, 0.9, 0.9, 13, [3, 3], [mx, Y0 + 185.2, mz], { cap: true }));
  add(far, "metal", tube(0.18, 0.5, 12.5, 8, [2, 2], [mx, Y0 + 198, mz]));
  add(far, "metal", xf(new THREE.SphereGeometry(1.15, 14, 10), mx, Y0 + 198.4, mz));
  add(near, "stone", texBox(29.4, 1.0, 0.5, [6, 6], [mx, Y0 + 165, mz + 14.5]));
  add(near, "stone", texBox(29.4, 1.0, 0.5, [6, 6], [mx, Y0 + 165, mz - 14.5]));
  add(near, "stone", texBox(0.5, 1.0, 28.4, [6, 6], [mx + 14.5, Y0 + 165, mz]));
  add(near, "stone", texBox(0.5, 1.0, 28.4, [6, 6], [mx - 14.5, Y0 + 165, mz]));

  // ---- fountains (octagonal basins)
  for (const [fx, fz] of FOUNTAINS) {
    add(near, "stone", tube(4.6, 4.7, 0.3, 8, [6, 6], [fx, Y0, fz]));
    add(near, "stone", new THREE.CylinderGeometry(4.0, 4.0, 0.9, 8, 1, true).translate(fx, Y0 + 0.45, fz));
    add(near, "stone", xf(new THREE.RingGeometry(3.7, 4.05, 8).rotateX(-Math.PI / 2), fx, Y0 + 0.9, fz));
    add(near, "water", xf(new THREE.CircleGeometry(3.7, 8).rotateX(-Math.PI / 2), fx, Y0 + 0.62, fz));
    add(near, "water", tube(0.12, 0.28, 2.6, 6, [2, 2], [fx, Y0 + 0.62, fz]));
  }

  const build2 = (b: Bucket) => Object.entries(b).map(([k, list]) => ({ key: k, geo: merge(list)! }));
  const rockGeo = merge(rocks)!;
  return { M, far: build2(far), near: build2(near), rockGeo };
}

export function Mosque() {
  const res = useMemo(build, []);
  const root = useRef<THREE.Group>(null), nearG = useRef<THREE.Group>(null), tip = useRef<THREE.Sprite>(null);
  const fade = useRef({ v: -1 });
  const camera = useThree((s) => s.camera);
  const glow = useMemo(() => glowTexture(), []);
  const tipMat = useMemo(() => new THREE.SpriteMaterial({ map: glow, color: "#FFF4E2", transparent: true, depthWrite: false, toneMapped: false, opacity: 0.3 }), [glow]);
  const list = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  const centre = useMemo(() => new THREE.Vector3(MOSQUE.x, 20, MOSQUE.z), []);
  useEffect(() => () => {
    for (const p of [...res.far, ...res.near]) p.geo.dispose();
    res.rockGeo.dispose(); list.forEach((m) => m.dispose()); tipMat.dispose(); glow.dispose();
  }, [res, list, tipMat, glow]);

  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    setFade(list, op, fade.current);
    const n = ENV.night;
    res.M.arcade.emissiveIntensity = n * 0.62; res.M.panel.emissiveIntensity = n * 0.5; res.M.glass.emissiveIntensity = n * 0.9;
    const d = camera.position.distanceTo(centre);
    if (nearG.current) nearG.current.visible = d < 1600;
    tipMat.opacity = (0.22 + 0.78 * n) * op;
    // the tip glows a little more as it gets far (it is the landmark of the skyline)
    if (tip.current) tip.current.scale.setScalar(THREE.MathUtils.clamp(d * 0.012, 5, 60));
  });

  const m = res.M as unknown as Record<string, THREE.Material>;
  return (
    <group ref={root} position={[MOSQUE.x, 0, MOSQUE.z]} rotation-y={MOSQUE.yaw}>
      {res.far.map((p) => <mesh key={p.key} geometry={p.geo} material={m[p.key]} raycast={() => null} />)}
      <mesh geometry={res.rockGeo} material={res.M.rock} raycast={() => null} />
      <group ref={nearG}>{res.near.map((p) => <mesh key={p.key} geometry={p.geo} material={m[p.key]} raycast={() => null} />)}</group>
      <sprite ref={tip} position={[MIN.x, Y0 + 211, MIN.z]} material={tipMat} raycast={() => null} />
    </group>
  );
}
