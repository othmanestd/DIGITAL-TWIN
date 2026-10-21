"use client";
// Ambient life in the corridors of the open floor: porters pushing a stretcher or a wheelchair (a patient seated in it),
// staff and visitors walking calmly along the central corridor. People from the shared human kit (one draw call), the
// porter's hands on the handles, walking in step. Decorative only (not clickable, no ids); drawn only with the floor content.
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FloorMats } from "./mats";
import { Kit, C } from "./props/kit";
import * as F from "./props/furniture";
import { mergeParts } from "./props/geo";
import { dress, newPose, posePush, poseSit, poseWalk, type Garb } from "../people/human";
import { useHumanCrowd } from "../people/useHumans";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const Y = new THREE.Vector3(0, 1, 0);
const P = newPose();
const CHAIR_Z = 0.82, STRETCHER_Z = 1.35;      // ahead of the pusher (walker frame)

type Walker = { x0: number; z0: number; x1: number; z1: number; speed: number; ph: number; garb: Garb; push: 0 | 1 | 2 };
/** dev / QA: live walker positions per floor (floor-local) */
const AMB: Record<number, [number, number, number][]> = {};
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __ambient: typeof AMB }).__ambient = AMB;

/** Corridor walkers for a main-building floor (building frame, floor-local). */
function walkersFor(floor: number): Walker[] {
  const z = 0.0;
  if (floor === 4) return [{ x0: 0, z0: -11, x1: 0, z1: 11, speed: 0.75, ph: 0.2, garb: "admin", push: 0 }];
  if (floor === 3) return [
    { x0: 2, z0: z, x1: 24, z1: z, speed: 0.7, ph: 0.1, garb: "porter", push: 1 },
    { x0: 24, z0: z + 0.1, x1: 3, z1: z + 0.1, speed: 0.8, ph: 0.6, garb: "aide", push: 0 },
  ];
  return [
    { x0: -24, z0: z, x1: 24, z1: z, speed: 0.65, ph: 0.0, garb: "porter", push: 1 },                                   // porter + stretcher
    { x0: 22, z0: z + 0.1, x1: -22, z1: z + 0.1, speed: 0.8, ph: 0.45, garb: "infirmier", push: 0 },                    // nurse
    { x0: -20, z0: z - 0.1, x1: 18, z1: z - 0.1, speed: 0.6, ph: 0.8, garb: floor === 0 ? "visitor" : "admin", push: floor === 0 ? 2 : 0 }, // relative + wheelchair / admin
  ];
}

const geoOf = (fn: (k: Kit) => void) => { const k = new Kit(); fn(k); return mergeParts(k.parts)!; };
/** a transport stretcher: mattress on a steel frame, push bar at the near end (local +z ahead, near end at z 0.4) */
const stretcherGeo = () => geoOf((k) => {
  const f = k.at(0, 0, 0);
  f.box("metal", C.steel, 0, 0.62, STRETCHER_Z, 0.6, 0.05, 1.85);
  f.rbox("satin", C.light, 0, 0.71, STRETCHER_Z, 0.64, 0.1, 1.86);
  f.rbox("satin", C.white, 0, 0.79, STRETCHER_Z - 0.68, 0.46, 0.08, 0.3);
  for (const sx of [-1, 1]) for (const dz of [-0.75, 0.75]) {
    f.box("metal", C.chrome, sx * 0.24, 0.33, STRETCHER_Z + dz, 0.03, 0.56, 0.03);
    f.cyl("satin", C.dark, sx * 0.24, 0.06, STRETCHER_Z + dz, 0.1, 0.04, { roll: Math.PI / 2 });
  }
  f.box("metal", C.chrome, 0, 0.92, 0.42, 0.56, 0.03, 0.03);
  for (const sx of [-1, 1]) f.box("metal", C.chrome, sx * 0.27, 0.78, 0.47, 0.03, 0.3, 0.03);
});

export function Ambient({ floor, mats }: { floor: number; mats: FloorMats }) {
  const ws = useMemo(() => walkersFor(floor), [floor]);
  const riders = useMemo(() => ws.map((w, i) => (w.push === 2 ? i : -1)).filter((i) => i >= 0), [ws]);
  const n = ws.length, nStr = ws.filter((w) => w.push === 1).length, nCh = riders.length;
  const crowd = useHumanCrowd(n + nCh);
  const props = useMemo(() => ({
    mat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.04 }),
    str: nStr ? stretcherGeo() : null, ch: nCh ? geoOf((k) => F.wheelchair(k.at(0, 0, 0), C.navy)) : null,
  }), [nStr, nCh]);
  useEffect(() => () => { props.mat.dispose(); props.str?.dispose(); props.ch?.dispose(); }, [props]);
  const meshes = useMemo(() => ({
    str: props.str ? new THREE.InstancedMesh(props.str, props.mat, nStr) : null,
    ch: props.ch ? new THREE.InstancedMesh(props.ch, props.mat, nCh) : null,
  }), [props, nStr, nCh]);
  useEffect(() => {
    for (const m of [meshes.str, meshes.ch]) if (m) { m.frustumCulled = false; m.castShadow = true; m.raycast = () => {}; }
    ws.forEach((w, i) => crowd.setLook(i, dress(w.garb, 31 + floor * 7 + i * 13)));
    riders.forEach((_, k) => crowd.setLook(n + k, dress("patient", 97 + floor * 5 + k, { gown: false })));
  }, [ws, riders, crowd, floor, n, meshes]);
  const st = useMemo(() => ({ yaw: ws.map(() => 0), dist: ws.map(() => 0), px: ws.map(() => NaN), pz: ws.map(() => 0) }), [ws]);

  useFrame((s, dt) => {
    const mesh = crowd.mesh;
    if (mesh.parent && mesh.parent.parent && !mesh.parent.parent.visible) return;
    crowd.sync(mats.figure);
    const pm = props.mat;
    if (pm.transparent !== mats.figure.transparent) { pm.transparent = mats.figure.transparent; pm.needsUpdate = true; }
    pm.opacity = mats.figure.opacity; pm.depthWrite = mats.figure.depthWrite;
    const t = s.clock.elapsedTime;
    let si = 0, ci = 0;
    ws.forEach((w, i) => {
      const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0) || 1;
      const ph = t * ((2 * w.speed) / L) + w.ph * Math.PI * 2;
      const a = (1 - Math.cos(ph)) / 2, vel = Math.sin(ph);
      const x = w.x0 + (w.x1 - w.x0) * a, z = w.z0 + (w.z1 - w.z0) * a;
      const target = Math.atan2(w.x1 - w.x0, w.z1 - w.z0) + (vel >= 0 ? 0 : Math.PI);
      let d = target - st.yaw[i];
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      st.yaw[i] += d * Math.min(1, dt * 4.8);
      if (!Number.isNaN(st.px[i])) st.dist[i] += Math.hypot(x - st.px[i], z - st.pz[i]);
      st.px[i] = x; st.pz[i] = z;
      const amp = Math.min(1, Math.abs(vel) * 2), yaw = st.yaw[i], hs = crowd.height[i], gait = (st.dist[i] * 3.6) / hs;
      if (w.push === 1) posePush(P, gait, amp, 0.25, 0.92, 0.42, hs);
      else if (w.push === 2) posePush(P, gait, amp, 0.235, 1.0, CHAIR_Z - 0.39, hs);
      else poseWalk(P, gait, amp);
      crowd.write(i, x, 0, z, yaw, 1, P);
      (AMB[floor] ??= [])[i] = [x, z, yaw];
      _q.setFromAxisAngle(Y, yaw);
      if (w.push === 1 && meshes.str) { _m.compose(_v.set(x, 0, z), _q, _s); meshes.str.setMatrixAt(si++, _m); }
      if (w.push === 2 && meshes.ch) {
        const cx = x + Math.sin(yaw) * CHAIR_Z, cz = z + Math.cos(yaw) * CHAIR_Z, k = riders.indexOf(i);
        _m.compose(_v.set(cx, 0, cz), _q, _s); meshes.ch.setMatrixAt(ci++, _m);
        poseSit(P, 0.52, crowd.height[n + k], t, i * 3.1, 0.08);
        crowd.write(n + k, cx, 0, cz, yaw, 1, P);
      }
    });
    if (meshes.str) meshes.str.instanceMatrix.needsUpdate = true;
    if (meshes.ch) meshes.ch.instanceMatrix.needsUpdate = true;
  });
  return (
    <group>
      <primitive object={crowd.mesh} />
      {meshes.str && <primitive object={meshes.str} />}
      {meshes.ch && <primitive object={meshes.ch} />}
    </group>
  );
}
