"use client";
// <MaarifDistrict/>: the Maârif pilot district around the Twin Center, from OpenStreetMap (maarifGeo.ts; the towers are
// TwinCenter.tsx). The city plan leaves the district box empty except for its tram boulevard, and lays the district's real
// streets and trees (osmZonePlan.ts). Two levels of detail: the `core` (walls, roofs, ground) is always drawn while the
// landmarks are; the `detail` (rooftop plant, cornices, contact shadows, kerbs, zebras, shelters, street lamps) only when
// the camera is within ~1.4 km and below ~1.3 km of altitude. At night the windows, the shops and the street lamps light up.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frame } from "@/lib/world";
import { GeoHtml } from "../../geo/GeoHtml";
import { MAARIF_DISTRICT as M } from "../geography";
import { MAARIF_ZONE } from "../maarifZone";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { buildMaarif } from "./maarifGeo";
import { paintPool } from "./cfcPaint";
import { NIGHT, SHARED_TEX, zoneMaterials } from "./zoneMaterials";
import { creditNear } from "./OsmCredit";
import type { CfcKey } from "./zoneKit";

let BUILT: ReturnType<typeof buildMaarif> | null = null;
const district = () => (BUILT ??= buildMaarif(MAARIF_ZONE));

/** Walk-mode solids of the district (world). */
export function maarifSolids(): Solid[] {
  return district().solids.flatMap(({ o, h }) => yawedSolids(M.ox + o[0], M.oz + o[1], o[2], -o[3] / 2, o[3] / 2, -o[4] / 2, o[4] / 2, h, 12));
}
/** QA: what the district is made of (OSM footprints, storeys known / estimated, illustrative fillers). */
export const maarifStats = () => district().stats;
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __maarif: unknown }).__maarif = { stats: maarifStats, lamps: () => district().lamps.length };

const DETAIL_NEAR = 1400, DETAIL_ALT = 1300, LABEL_ALT = 1400, LABEL_NEAR = 950;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _y = new THREE.Vector3(0, 1, 0);

/** street lamp: an 8 m pole with its arm (instanced), the lantern (instanced, lit at night) and its pool of light */
function lampKit() {
  const pole = mergeGeometries([
    new THREE.CylinderGeometry(0.07, 0.11, 8, 8).translate(0, 4, 0),
    new THREE.BoxGeometry(1.7, 0.07, 0.07).translate(0.85, 7.95, 0),
  ], false);
  const head = new THREE.BoxGeometry(0.62, 0.14, 0.3).translate(1.65, 7.86, 0);
  const pool = new THREE.PlaneGeometry(17, 17).rotateX(-Math.PI / 2).translate(1.4, 0.12, 0);
  const poleMat = new THREE.MeshStandardMaterial({ color: "#59606A", roughness: 0.45, metalness: 0.6 });
  const headMat = new THREE.MeshStandardMaterial({ color: "#E9E4D6", roughness: 0.4, emissive: "#FFD9A0", emissiveIntensity: 0 });
  const alpha = new THREE.CanvasTexture(paintPool());
  const poolMat = new THREE.MeshBasicMaterial({ color: "#FFC98A", alphaMap: alpha, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  return { pole, head, pool, poleMat, headMat, poolMat, alpha };
}

export function MaarifDistrict() {
  const res = useMemo(() => {
    const d = district();
    const M = zoneMaterials([...d.core, ...d.detail].map((p) => p.key));
    return { ...d, M, lamp: lampKit() };
  }, []);
  const fadeList = useMemo(() => (Object.entries(res.M) as [CfcKey, THREE.MeshStandardMaterial][]).filter(([k]) => k !== "ao").map(([, m]) => m as THREE.Material).concat([res.lamp.poleMat, res.lamp.headMat]), [res]);
  const root = useRef<THREE.Group>(null), detail = useRef<THREE.Group>(null);
  const inst = useRef<(THREE.InstancedMesh | null)[]>([]);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const fade = useRef({ v: -1 });
  useEffect(() => {
    // place the street lamps once
    for (const m of inst.current) {
      if (!m) continue;
      res.lamps.forEach(([x, z, yaw], i) => { _q.setFromAxisAngle(_y, yaw); _m.compose(_p.set(x, 0, z), _q, _s); m.setMatrixAt(i, _m); });
      m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
    }
  }, [res]);
  useEffect(() => () => {
    [...res.core, ...res.detail].forEach((p) => p.geo.dispose());
    for (const [k, m] of Object.entries(res.M) as [CfcKey, THREE.MeshStandardMaterial][]) { if (!SHARED_TEX.has(k)) { m.map?.dispose(); m.emissiveMap?.dispose(); m.alphaMap?.dispose(); } m.dispose(); }
    const L = res.lamp; [L.pole, L.head, L.pool, L.poleMat, L.headMat, L.poolMat, L.alpha].forEach((x) => x.dispose());
  }, [res]);
  useFrame(({ camera }) => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    const dist = Math.hypot(camera.position.x - M.ox, camera.position.z - M.oz);
    if (detail.current) detail.current.visible = dist < DETAIL_NEAR && frame.alt < DETAIL_ALT;
    res.labels.forEach((l, i) => {
      const el = tags.current[i];
      if (!el) return;
      const d = Math.hypot(camera.position.x - (M.ox + l.x), camera.position.z - (M.oz + l.z), camera.position.y - l.y);
      el.style.opacity = g.visible && frame.alt < LABEL_ALT && d < (l.hero ? LABEL_NEAR : LABEL_NEAR * 0.38) ? "1" : "0";
    });
    if (!g.visible) return;
    if (dist < 1700 && frame.alt < LABEL_ALT * 2) creditNear();
    setFade(fadeList, op, fade.current);
    const ao = res.M.ao; if (ao) ao.opacity = 0.34 * op;
    const n = ENV.night;
    for (const [k, v] of Object.entries(NIGHT) as [CfcKey, number][]) { const m = res.M[k]; if (m) m.emissiveIntensity = n * v; }
    res.lamp.headMat.emissiveIntensity = n * 3;
    res.lamp.poolMat.opacity = n * 0.6 * op;
  });
  const N = res.lamps.length;
  return (
    <group ref={root} position={[M.ox, 0, M.oz]}>
      {res.core.map((p) => <mesh key={p.key} name={`maarif.core.${p.key}`} geometry={p.geo} material={res.M[p.key]!} raycast={() => null} />)}
      <group ref={detail}>
        {res.detail.map((p) => <mesh key={p.key} name={`maarif.detail.${p.key}`} geometry={p.geo} material={res.M[p.key]!} raycast={() => null} renderOrder={p.key === "ao" ? 1 : 0} />)}
        {N > 0 && <instancedMesh ref={(m) => { inst.current[0] = m; }} args={[res.lamp.pole, res.lamp.poleMat, N]} raycast={() => null} />}
        {N > 0 && <instancedMesh ref={(m) => { inst.current[1] = m; }} args={[res.lamp.head, res.lamp.headMat, N]} raycast={() => null} />}
        {N > 0 && <instancedMesh ref={(m) => { inst.current[2] = m; }} args={[res.lamp.pool, res.lamp.poolMat, N]} raycast={() => null} renderOrder={2} />}
      </group>
      {res.labels.map((l, i) => (
        <GeoHtml key={i} position={[l.x, l.y, l.z]} center zIndex={5}>
          <div ref={(e) => { tags.current[i] = e; }} style={{ opacity: 0 }}
            className={`pointer-events-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.6)] ring-1 backdrop-blur transition-opacity duration-300 ${l.hero ? "bg-[#0B1020]/85 ring-white/25" : "bg-[#0B1020]/60 ring-white/10 text-[10px]"}`}>
            {l.name}{l.sub ? <span className="ml-1.5 font-normal opacity-70">· {l.sub}</span> : null}
          </div>
        </GeoHtml>
      ))}
    </group>
  );
}
