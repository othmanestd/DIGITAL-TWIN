"use client";
// First person in walk mode: on the visitor's floor the 1 m maquette partitions rise to a 3 m dropped ceiling with soft
// light panels, so a corridor reads as a corridor and a room as a room. Third person and the overview are unchanged.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { FloorLayout, Part } from "./layout";
import { W } from "../walk/state";

export const FP_CEIL = 3.0;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const fpHere = (fl: FloorLayout) => W.phase === "on" && !W.third && !W.tower && (W.where === fl.building || W.bridge) && W.level === fl.floor; // (both floors 1 from the skybridge)
const smooth = (x: number) => x * x * (3 - 2 * x);

/** The partition walls of a floor ("box|wall" parts), raised to the dropped ceiling in first person. */
export function WallInst({ fl, geo, mat, parts }: { fl: FloorLayout; geo: THREE.BufferGeometry; mat: THREE.Material; parts: Part[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const t = useRef(0);
  const write = (k: number) => {
    const m = ref.current;
    if (!m) return;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const raise = k > 0 && Math.min(p.sx, p.sz) <= 0.16 && p.y - p.sy / 2 < 0.05 && p.sy < FP_CEIL;
      const sy = raise ? p.sy + (FP_CEIL - p.sy) * k : p.sy;
      _q.setFromEuler(_e.set(p.pitch ?? 0, p.yaw, 0, "YXZ"));
      _m.compose(_v.set(p.x, raise ? sy / 2 : p.y, p.z), _q, _s.set(p.sx, sy, p.sz));
      m.setMatrixAt(i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { t.current = 0; write(0); }, [parts]);
  useFrame((_, dt) => {
    const want = fpHere(fl) ? 1 : 0;
    if (t.current === want) return;
    t.current = Math.abs(want - t.current) < 0.01 ? want : t.current + (want - t.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 7));
    write(smooth(t.current));
  });
  return <instancedMesh ref={ref} args={[geo, mat, parts.length]} castShadow receiveShadow />;
}

let ceilTex: THREE.CanvasTexture | null = null;
function ceilingTexture() {
  if (ceilTex) return ceilTex;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#7E8594"; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(255,255,255,0.08)"; g.lineWidth = 2;
  for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke(); }
  const gr = g.createRadialGradient(128, 128, 20, 128, 128, 110);
  gr.addColorStop(0, "rgba(255,250,240,0.55)"); gr.addColorStop(1, "rgba(255,250,240,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.fillStyle = "#FFFDF8"; g.beginPath(); g.roundRect(84, 100, 88, 56, 6); g.fill();
  ceilTex = new THREE.CanvasTexture(c);
  ceilTex.colorSpace = THREE.SRGBColorSpace;
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.anisotropy = 4;
  return ceilTex;
}

/** Dropped ceiling of the visitor's floor (first person only). Floor-local frame. */
export function FpCeiling({ fl }: { fl: FloorLayout }) {
  const res = useMemo(() => {
    const map = ceilingTexture().clone();
    map.repeat.set(fl.w / 2.4, fl.d / 2.4);
    map.needsUpdate = true;
    return { map, mat: new THREE.MeshStandardMaterial({ color: "#E8EBF1", emissive: "#FFFFFF", emissiveMap: map, emissiveIntensity: 0.62, roughness: 0.9 }) };
  }, [fl]);
  useEffect(() => () => { res.map.dispose(); res.mat.dispose(); }, [res]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => { if (ref.current) ref.current.visible = fpHere(fl); });
  return (
    <mesh ref={ref} visible={false} position={[0, FP_CEIL, 0]} rotation-x={Math.PI / 2} material={res.mat}>
      <planeGeometry args={[fl.w - 0.1, fl.d - 0.1]} />
    </mesh>
  );
}
