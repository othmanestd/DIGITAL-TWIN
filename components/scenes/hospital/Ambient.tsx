"use client";
// Ambient life in the corridors of the open floor: porters pushing a stretcher or a wheelchair, staff and visitors
// walking calmly along the central corridor. Decorative only (not clickable, no ids); drawn only with the floor content.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FloorMats } from "./mats";

const body = new THREE.CapsuleGeometry(0.2, 1.05, 2, 8).translate(0, 0.75, 0);
const head = new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.66, 0);
const stretcher = new THREE.BoxGeometry(0.66, 0.12, 1.9).translate(0, 0.82, 1.35);
const chair = new THREE.BoxGeometry(0.6, 0.55, 0.6).translate(0, 0.45, 0.75);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _c = new THREE.Color();
const Y = new THREE.Vector3(0, 1, 0);

type Walker = { x0: number; z0: number; x1: number; z1: number; speed: number; ph: number; color: string; push: 0 | 1 | 2 };

/** Corridor walkers for a main-building floor (building frame, floor-local). */
function walkersFor(floor: number): Walker[] {
  const z = floor === 4 ? 0 : 0.0;
  if (floor === 4) return [{ x0: 0, z0: -11, x1: 0, z1: 11, speed: 0.75, ph: 0.2, color: "#7C93D6", push: 0 }];
  if (floor === 3) return [
    { x0: 2, z0: z, x1: 24, z1: z, speed: 0.7, ph: 0.1, color: "#D6B47C", push: 1 },
    { x0: 24, z0: z + 0.1, x1: 3, z1: z + 0.1, speed: 0.8, ph: 0.6, color: "#C9CED9", push: 0 },
  ];
  return [
    { x0: -24, z0: z, x1: 24, z1: z, speed: 0.65, ph: 0.0, color: "#D6B47C", push: 1 },               // porter + stretcher
    { x0: 22, z0: z + 0.1, x1: -22, z1: z + 0.1, speed: 0.8, ph: 0.45, color: "#6FB7AE", push: 0 },    // nurse
    { x0: -20, z0: z - 0.1, x1: 18, z1: z - 0.1, speed: 0.6, ph: 0.8, color: floor === 0 ? "#B8C3D6" : "#7C93D6", push: floor === 0 ? 2 : 0 }, // visitor + wheelchair / admin
  ];
}

export function Ambient({ floor, mats }: { floor: number; mats: FloorMats }) {
  const ws = useMemo(() => walkersFor(floor), [floor]);
  const bodies = useRef<THREE.InstancedMesh>(null), heads = useRef<THREE.InstancedMesh>(null);
  const str = useRef<THREE.InstancedMesh>(null), chs = useRef<THREE.InstancedMesh>(null);
  const yaw = useRef<number[]>(ws.map(() => 0));
  const n = ws.length;
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const B = bodies.current, H = heads.current;
    if (!B || !H) return;
    if (B.parent && B.parent.parent && !B.parent.parent.visible) return;
    let si = 0, ci = 0;
    ws.forEach((w, i) => {
      const L = Math.hypot(w.x1 - w.x0, w.z1 - w.z0) || 1;
      const ph = t * ((2 * w.speed) / L) + w.ph * Math.PI * 2;
      const a = (1 - Math.cos(ph)) / 2, vel = Math.sin(ph);
      const x = w.x0 + (w.x1 - w.x0) * a, z = w.z0 + (w.z1 - w.z0) * a;
      const target = Math.atan2(w.x1 - w.x0, w.z1 - w.z0) + (vel >= 0 ? 0 : Math.PI);
      let d = target - yaw.current[i];
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      yaw.current[i] += d * 0.08;
      const bob = 0.025 * Math.abs(Math.sin(a * L * 3.6)) * Math.min(1, Math.abs(vel) * 2);
      _q.setFromAxisAngle(Y, yaw.current[i]);
      _m.compose(_v.set(x, bob, z), _q, _s); B.setMatrixAt(i, _m); H.setMatrixAt(i, _m);
      if (w.push === 1 && str.current) str.current.setMatrixAt(si++, _m);
      if (w.push === 2 && chs.current) chs.current.setMatrixAt(ci++, _m);
    });
    B.instanceMatrix.needsUpdate = true; H.instanceMatrix.needsUpdate = true;
    if (str.current) str.current.instanceMatrix.needsUpdate = true;
    if (chs.current) chs.current.instanceMatrix.needsUpdate = true;
  });
  const nStr = ws.filter((w) => w.push === 1).length, nCh = ws.filter((w) => w.push === 2).length;
  return (
    <group>
      <instancedMesh ref={(r) => {
        bodies.current = r;
        if (r) { ws.forEach((w, i) => r.setColorAt(i, _c.set(w.color))); if (r.instanceColor) r.instanceColor.needsUpdate = true; }
      }} args={[body, mats.figure, n]} frustumCulled={false} castShadow />
      <instancedMesh ref={(r) => {
        heads.current = r;
        if (r) { ws.forEach((_, i) => r.setColorAt(i, _c.set(i % 2 ? "#C08F6E" : "#E7CBB2"))); if (r.instanceColor) r.instanceColor.needsUpdate = true; }
      }} args={[head, mats.figure, n]} frustumCulled={false} castShadow />
      {nStr > 0 && <instancedMesh ref={str} args={[stretcher, mats.parts.mattress, nStr]} frustumCulled={false} castShadow />}
      {nCh > 0 && <instancedMesh ref={chs} args={[chair, mats.parts.fabric, nCh]} frustumCulled={false} castShadow />}
    </group>
  );
}
