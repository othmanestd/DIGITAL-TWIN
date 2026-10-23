"use client";
// <TwinCenter/>: the Twin Center of Casablanca (geometry and façade painting in twinCenterGeo.ts). Each tower now stands on
// its OpenStreetMap footprint in the Maârif district (zones/maarifData: West Tower, way 97667268, offices; East Tower,
// way 75698627, the Kenzi Tower Hotel; both 115 m and 28 storeys in OSM), at its real size and orientation; the model is
// scaled to the footprint (27.2 × 26.5 m and 30.7 × 28 m against the model's 30 m). The real podium (the shop wings) is
// drawn by MaarifDistrict. No advertising in the city: both towers carry the same neutral stone crown (a simplified
// treatment; the earlier telecom crown with its brand lettering was an advertising surface and is gone). Fades out with the
// other landmarks; at night the offices and the hotel light up and the shop arcade glows.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { MAARIF_DISTRICT } from "../geography";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { TC, buildTower, paintFront, paintSide, towerFaces, type TcKey } from "./twinCenterGeo";
import { MAARIF } from "./zones/maarifData";

/** OSM ids of the two towers */
export const TWIN_TOWER_IDS = [97667268, 75698627] as const;
/** no tower carries a branded crown (rule: no advertising in the 3D city) */
const BRANDED = -1;

/** The towers in world metres: centre, yaw, footprint (OSM oriented box) and height. */
export const TWIN_TOWERS = TWIN_TOWER_IDS.map((id) => {
  const b = MAARIF.buildings.find((q) => q.id === id);
  const o = b?.o ?? [0, 0, 0, TC.W, TC.W];
  return { id, x: MAARIF_DISTRICT.ox + o[0], z: MAARIF_DISTRICT.oz + o[1], yaw: o[2], w: o[3], d: o[4], h: b?.h ?? TC.H };
});
/** Centre between the two towers (world), kept for the camera and the labels. */
export const TWIN_SITE = { x: (TWIN_TOWERS[0].x + TWIN_TOWERS[1].x) / 2, z: (TWIN_TOWERS[0].z + TWIN_TOWERS[1].z) / 2 };

/** Walk-mode solids: the two towers (world). */
export function twinCenterSolids(): Solid[] {
  return TWIN_TOWERS.flatMap((t) => yawedSolids(t.x, t.z, t.yaw, -t.w / 2, t.w / 2, -t.d / 2, t.d / 2, TC.H, 10));
}

const tex = (c: HTMLCanvasElement, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

function build() {
  const towers = [0, 1].map((i) => {
    const triangles = i !== BRANDED;
    const f = paintFront(11 + i * 7, triangles), s = paintSide(31 + i * 5, triangles);
    const face = (p: { map: HTMLCanvasElement; glow: HTMLCanvasElement }) =>
      new THREE.MeshStandardMaterial({ map: tex(p.map), emissive: "#FFFFFF", emissiveMap: tex(p.glow), emissiveIntensity: 0, roughness: 0.55, metalness: 0.08 });
    return { geo: towerFaces(0), front: face(f), side: face(s), parts: buildTower(i === BRANDED) };
  });
  const M: Record<TcKey, THREE.MeshStandardMaterial> = {
    stone: new THREE.MeshStandardMaterial({ color: "#E7E0D1", roughness: 0.82 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: "#8A8478", roughness: 0.9 }),
    arcade: new THREE.MeshStandardMaterial({ color: "#1F262E", roughness: 0.3, metalness: 0.4, emissive: "#FFD39A", emissiveIntensity: 0 }),
    podium: new THREE.MeshStandardMaterial({ color: "#E9E4DA", roughness: 0.6 }),
    plaza: new THREE.MeshStandardMaterial({ color: "#D9D2C2", roughness: 0.95 }),
    steel: new THREE.MeshStandardMaterial({ color: "#9AA3AD", roughness: 0.4, metalness: 0.7 }),
    purple: new THREE.MeshStandardMaterial({ color: "#6E2C8F", roughness: 0.5, emissive: "#6E2C8F", emissiveIntensity: 0 }),
    dish: new THREE.MeshStandardMaterial({ color: "#E8EAEC", roughness: 0.5 }),
  };
  const list: THREE.Material[] = [...Object.values(M), ...towers.flatMap((t) => [t.front, t.side])];
  return { towers, M, list };
}

export function TwinCenter() {
  const res = useMemo(build, []);
  const root = useRef<THREE.Group>(null);
  const fade = useRef({ v: -1 });
  useEffect(() => () => {
    res.towers.forEach((t) => { t.geo.front.dispose(); t.geo.side.dispose(); t.parts.forEach((p) => p.geo.dispose()); });
    res.list.forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); (m as THREE.MeshStandardMaterial).emissiveMap?.dispose(); m.dispose(); });
  }, [res]);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    setFade(res.list, op, fade.current);
    const n = ENV.night;
    for (const t of res.towers) { t.front.emissiveIntensity = n * 0.95; t.side.emissiveIntensity = n * 0.95; }
    res.M.arcade.emissiveIntensity = n * 0.7; res.M.purple.emissiveIntensity = 0.15 + n * 0.6;
  });
  const W = TC.W;
  return (
    <group ref={root}>
      {res.towers.map((t, i) => {
        const T = TWIN_TOWERS[i];
        return (
          <group key={i} position={[T.x, 0, T.z]} rotation={[0, T.yaw, 0]} scale={[T.w / W, 1, T.d / W]}>
            <mesh geometry={t.geo.front} material={t.front} raycast={() => null} />
            <mesh geometry={t.geo.side} material={t.side} raycast={() => null} />
            {t.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]} raycast={() => null} />)}
          </group>
        );
      })}
    </group>
  );
}
