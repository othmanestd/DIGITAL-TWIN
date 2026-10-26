"use client";
// Mibtech's building (Casa réel only), boulevard Mahdi Elmandjra (ex Rue des Papillons), L'Oasis — an ESTIMATED volume.
// Identification (docs/research/mibtech-identification.md): both Google pins of the « MIBTECH » listing (the link given by the
// user and the one of mibtech.ma) fall on a recent building that OpenStreetMap does not have yet (OSM still maps two older
// villas, ways 419748653 and 419748511, which the city layer no longer draws here: city/CasaCity skip rect).
// Massing from overhead imagery (Esri World Imagery z19, OBSERVATION only, nothing traced, rounded to the metre):
//   · a main wing ≈ 26 × 14 m along the boulevard (bearing ≈ 40°), its street façade fully glazed (blue-grey glass);
//   · a north-west annex ≈ 11 × 9 m; flat roof, white parapet, a rooftop plant room;
//   · white rendered side walls; the back (north-west) façade is not visible: neutral office panel (simplification).
// Height ≈ 25.5 m = 7 levels (ground 4.5 m + 6 × 3.5 m), ESTIMATED ±1 level from its lean and shadow against the R+1
// villas next door. Anchor: the roof pin of the listing (33.5558823, −7.6435464) through casaFrame.geoToScene.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { frame } from "@/lib/world";
import { useApp } from "@/lib/store";
import { geoToScene } from "@/lib/geo/casaFrame";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { Buckets, box, ccw, roofOf, walls, type CfcKey, type Pt } from "./zoneKit";
import { NIGHT, SHARED_TEX, zoneMaterials } from "./zoneMaterials";

export const MIBTECH_ID = "mibtech";
const ROOF_PIN = geoToScene(33.5558823, -7.6435464);
/** east / north offsets (m) from the roof pin → scene (x east, z south) */
const P = (e: number, n: number): Pt => [ROOF_PIN.x + e, ROOF_PIN.z - n];
const H = 4.5 + 6 * 3.5; // 25.5 m, estimated
const BEARING = (40 * Math.PI) / 180;
// main wing frame in the scene: u along the boulevard (towards the north-east), v towards the street (south-east)
const U: Pt = [Math.sin(BEARING), -Math.cos(BEARING)], V: Pt = [Math.cos(BEARING), Math.sin(BEARING)];
const MAIN = { c: P(4.9, -1.3), L: 26, W: 14 };
const ANNEX = { c: P(-2.7, 8), w: 11, d: 9 };
const YAW = Math.atan2(U[0], U[1]); // local +z along U (zoneKit / yawedSolids convention: x' = x cos + z sin)

function mainRing(): Pt[] {
  const { c, L, W } = MAIN;
  return ccw(([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([a, b]) => [c[0] + (a * L) / 2 * U[0] + (b * W) / 2 * V[0], c[1] + (a * L) / 2 * U[1] + (b * W) / 2 * V[1]] as Pt));
}
function annexRing(): Pt[] {
  const { c, w, d } = ANNEX;
  return ccw([[c[0] - w / 2, c[1] - d / 2], [c[0] + w / 2, c[1] - d / 2], [c[0] + w / 2, c[1] + d / 2], [c[0] - w / 2, c[1] + d / 2]]);
}

function build() {
  const B = new Buckets();
  // façades by orientation: glazed towards the street (south-east), panels on the unseen back, white render elsewhere
  const face = (nx: number, nz: number): CfcKey => {
    const toStreet = nx * V[0] + nz * V[1];
    return toStreet > 0.7 ? "glass.cool" : toStreet < -0.7 ? "panel" : "parapet";
  };
  const M = mainRing(), A = annexRing();
  walls(B, M, 0, H, face);
  walls(B, A, 0, H, (nx, nz) => (nz < -0.7 || nx < -0.7 ? "panel" : "parapet"));
  roofOf(B, M, H);
  roofOf(B, A, H);
  // rooftop plant room (stairs / lift), seen on the roof towards the north
  const pr = P(3.5, 7.5);
  box(B, "concrete", pr[0], pr[1], YAW, 4.5, 6, H, 3);
  return B.build();
}

/** Walk-mode solids (world). */
export function mibtechSolids(): Solid[] {
  const { c, L, W } = MAIN;
  return [
    ...yawedSolids(c[0], c[1], YAW, -W / 2, W / 2, -L / 2, L / 2, H, 12),
    ...yawedSolids(ANNEX.c[0], ANNEX.c[1], 0, -ANNEX.w / 2, ANNEX.w / 2, -ANNEX.d / 2, ANNEX.d / 2, H, 12),
  ];
}
/** Where the city layer must not draw the older OSM villas (scene rect around the lot). */
export const MIBTECH_SKIP = (() => { const a = P(-8, 9), b = P(4, -9); return { x0: a[0], x1: b[0], z0: a[1], z1: b[1] }; })();

export function MibtechBuilding() {
  const res = useMemo(() => { const parts = build(); return { parts, M: zoneMaterials(parts.map((p) => p.key)) }; }, []);
  const list = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  const root = useRef<THREE.Group>(null);
  const fade = useRef({ v: 1 });
  useEffect(() => () => {
    res.parts.forEach((p) => p.geo.dispose());
    for (const [k, m] of Object.entries(res.M) as [CfcKey, THREE.MeshStandardMaterial][]) { if (!SHARED_TEX.has(k)) { m.map?.dispose(); m.emissiveMap?.dispose(); } m.dispose(); }
  }, [res]);
  useFrame(() => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (!g.visible) return;
    setFade(list, op, fade.current);
    for (const [k, v] of Object.entries(NIGHT) as [CfcKey, number][]) { const m = res.M[k]; if (m) m.emissiveIntensity = ENV.night * v; }
  });
  const onClick = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); useApp.getState().select({ kind: "landmark", id: MIBTECH_ID }); };
  return (
    <group ref={root} onClick={onClick} name="mibtech">
      {res.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]!} castShadow receiveShadow />)}
    </group>
  );
}
