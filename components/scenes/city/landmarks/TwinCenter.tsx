"use client";
// <TwinCenter/>: the Twin Center of Casablanca (geometry and façade painting in twinCenterGeo.ts), replacing the legacy
// glass boxes of plan.ts / Sites.tsx at the same place (geography.ts TWIN). The two towers stand side by side along the line
// joining them, as on the boulevard. Fades out with the other landmarks; at night the offices and the hotel light up, the
// shop arcade glows and the "inwi" crown is lit; the flag on the plaza stirs in the wind.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { TWIN } from "../geography";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { TC, buildSite, flagCanvas, paintFront, paintInwi, paintPodium, paintSide, towerFaces, type TcKey } from "./twinCenterGeo";

/** Placement: centre between the two towers, yaw so that local +x runs from TWIN[0] to TWIN[1]. */
export const TWIN_SITE = (() => {
  const [a, b] = TWIN, dx = b[0] - a[0], dz = b[1] - a[1];
  return { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, yaw: Math.atan2(-dz, dx) };
})();
const INWI = 1; // the tower at TWIN[1] carries the telecom crown

/** Walk-mode solids: the towers, the podium and the plaza (world). */
export function twinCenterSolids(): Solid[] {
  const { x, z, yaw } = TWIN_SITE, h = TC.W / 2;
  const at = (lx: number, lz: number) => [x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z - lx * Math.sin(yaw) + lz * Math.cos(yaw)] as const;
  const out: Solid[] = [];
  for (const cx of [-TC.HALF_GAP, TC.HALF_GAP]) { const [px, pz] = at(cx, 0); out.push(...yawedSolids(px, pz, yaw, -h, h, -h, h, TC.H, 10)); }
  const [qx, qz] = at(0, -38); out.push(...yawedSolids(qx, qz, yaw, -75, 75, -23, 23, 21, 15));
  return out;
}

const tex = (c: HTMLCanvasElement, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

function build() {
  const towers = [0, 1].map((i) => {
    const triangles = i !== INWI;
    const f = paintFront(11 + i * 7, triangles), s = paintSide(31 + i * 5, triangles);
    const face = (p: { map: HTMLCanvasElement; glow: HTMLCanvasElement }) =>
      new THREE.MeshStandardMaterial({ map: tex(p.map), emissive: "#FFFFFF", emissiveMap: tex(p.glow), emissiveIntensity: 0, roughness: 0.55, metalness: 0.08 });
    return { geo: towerFaces(i ? TC.HALF_GAP : -TC.HALF_GAP), front: face(f), side: face(s) };
  });
  const podTex = tex(paintPodium(5)); podTex.wrapS = THREE.RepeatWrapping; podTex.repeat.set(6, 1);
  const M: Record<TcKey, THREE.MeshStandardMaterial> = {
    stone: new THREE.MeshStandardMaterial({ color: "#E7E0D1", roughness: 0.82 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: "#8A8478", roughness: 0.9 }),
    arcade: new THREE.MeshStandardMaterial({ color: "#1F262E", roughness: 0.3, metalness: 0.4, emissive: "#FFD39A", emissiveIntensity: 0 }),
    podium: new THREE.MeshStandardMaterial({ map: podTex, roughness: 0.6, metalness: 0.1, emissive: "#FFE0B0", emissiveIntensity: 0 }),
    plaza: new THREE.MeshStandardMaterial({ color: "#D9D2C2", roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: "#9AA3AD", roughness: 0.4, metalness: 0.7 }),
    purple: new THREE.MeshStandardMaterial({ color: "#6E2C8F", roughness: 0.5, emissive: "#6E2C8F", emissiveIntensity: 0 }),
    dish: new THREE.MeshStandardMaterial({ color: "#E8EAEC", roughness: 0.5 }),
  };
  const inwi = new THREE.MeshBasicMaterial({ map: tex(paintInwi()), transparent: true });
  const flag = new THREE.MeshStandardMaterial({ map: tex(flagCanvas()), side: THREE.DoubleSide, roughness: 0.9 });
  const parts = buildSite(INWI);
  const list: THREE.Material[] = [...Object.values(M), ...towers.flatMap((t) => [t.front, t.side]), flag];
  return { towers, M, inwi, flag, parts, list };
}

export function TwinCenter() {
  const res = useMemo(build, []);
  const root = useRef<THREE.Group>(null), flagRef = useRef<THREE.Group>(null);
  const fade = useRef({ v: -1 });
  useEffect(() => () => {
    res.parts.forEach((p) => p.geo.dispose());
    res.towers.forEach((t) => { t.geo.front.dispose(); t.geo.side.dispose(); });
    [...res.list, res.inwi].forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); (m as THREE.MeshStandardMaterial).emissiveMap?.dispose(); m.dispose(); });
  }, [res]);
  useFrame(({ clock }) => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    setFade(res.list, op, fade.current);
    res.inwi.opacity = op;
    const n = ENV.night;
    for (const t of res.towers) { t.front.emissiveIntensity = n * 0.95; t.side.emissiveIntensity = n * 0.95; }
    res.M.arcade.emissiveIntensity = n * 0.7; res.M.podium.emissiveIntensity = n * 0.35; res.M.purple.emissiveIntensity = 0.15 + n * 0.6;
    if (flagRef.current) flagRef.current.rotation.y = 0.25 * Math.sin(clock.elapsedTime * 1.3);
  });
  const H = TC.H, W = TC.W, cx = TC.HALF_GAP * (INWI ? 1 : -1), bandY = H + 0.5 + TC.CROWN / 2;
  return (
    <group ref={root} position={[TWIN_SITE.x, 0, TWIN_SITE.z]} rotation={[0, TWIN_SITE.yaw, 0]}>
      {res.towers.map((t, i) => (
        <group key={i}>
          <mesh geometry={t.geo.front} material={t.front} raycast={() => null} />
          <mesh geometry={t.geo.side} material={t.side} raycast={() => null} />
        </group>
      ))}
      {res.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]} raycast={() => null} />)}
      {/* the "inwi" lettering on the four sides of the telecom crown */}
      {[0, Math.PI / 2, Math.PI, -Math.PI / 2].map((ry, k) => (
        <mesh key={k} position={[cx + Math.sin(ry) * (W / 2 + 0.28), bandY, Math.cos(ry) * (W / 2 + 0.28)]} rotation={[0, ry, 0]} material={res.inwi} raycast={() => null}>
          <planeGeometry args={[W * 0.62, TC.CROWN * 0.9]} />
        </mesh>
      ))}
      <group ref={flagRef} position={[9, 20.4, 8]}>
        <mesh position={[1.6, 0, 0]} material={res.flag} raycast={() => null}><planeGeometry args={[3.2, 2.1]} /></mesh>
      </group>
    </group>
  );
}
