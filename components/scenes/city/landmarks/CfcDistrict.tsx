"use client";
// <CfcDistrict/>: Casablanca Finance City (Casa Anfa) as it stands, from OpenStreetMap: every building on its real
// footprint, the documented towers modelled one by one (cfcDistrictGeo.ts), Anfa Park, the Aeria palm grove, the T2 tramway.
// It replaces the generic CFC cluster (Cfc.tsx) at the same place (geography.CFC = the CFC Tower); the city plan leaves the
// district box empty and lays the district's real streets and trees (cfcDistrict.ts). Fades with the other landmarks; at
// night the offices, the shops and the perforated veils light up. The names of the towers show up when the camera is close.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { GeoHtml } from "../../geo/GeoHtml";
import { CFC } from "../geography";
import type { Solid } from "../collide";
import { ENV } from "./env";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { NIGHT, SHARED_TEX, zoneMaterials } from "./zoneMaterials";
import { creditNear } from "./OsmCredit";
import { DiscoverButton } from "./Discover";
import { placeIdOf } from "@/lib/geo/casaReferential";
import { buildCfcDistrict, type CfcKey } from "./cfcDistrictGeo";

let BUILT: ReturnType<typeof buildCfcDistrict> | null = null;
const district = () => (BUILT ??= buildCfcDistrict());

/** Walk-mode solids of the district (world). */
export function cfcDistrictSolids(): Solid[] {
  return district().solids.flatMap(({ o, h }) => yawedSolids(CFC.x + o[0], CFC.y + o[1], o[2], -o[3] / 2, o[3] / 2, -o[4] / 2, o[4] / 2, h, 12));
}
/** The main towers (world), in the shape the pedestrians expect (Cfc.cfcTowers). */
export function cfcDistrictTowers() {
  return district().towers.map((t) => ({ x: CFC.x + t.o[0], z: CFC.y + t.o[1], yaw: t.o[2], fw: t.o[3], fd: t.o[4], h: t.h }));
}

const LABEL_ALT = 1400, LABEL_NEAR = 950;

export function CfcDistrict() {
  const res = useMemo(() => { const d = district(); return { ...d, M: zoneMaterials(d.parts.map((p) => p.key)) }; }, []);
  const list = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  const root = useRef<THREE.Group>(null);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const fade = useRef({ v: -1 });
  useEffect(() => () => {
    res.parts.forEach((p) => p.geo.dispose());
    // the shared Moncef textures (TEX.*) stay cached; only ours go
    for (const [k, m] of Object.entries(res.M) as [CfcKey, THREE.MeshStandardMaterial][]) { if (!SHARED_TEX.has(k)) { m.map?.dispose(); m.emissiveMap?.dispose(); } m.dispose(); }
  }, [res]);
  useFrame(({ camera }) => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    const near = Math.hypot(camera.position.x - (CFC.x + 250), camera.position.z - (CFC.y + 80)) < LABEL_NEAR + 600;
    res.labels.forEach((l, i) => {
      const el = tags.current[i];
      if (!el) return;
      const d = Math.hypot(camera.position.x - (CFC.x + l.x), camera.position.z - (CFC.y + l.z), camera.position.y - l.y);
      const show = g.visible && near && frame.alt < LABEL_ALT && d < (l.hero ? LABEL_NEAR : LABEL_NEAR * 0.38);
      el.style.opacity = show ? "1" : "0";
      el.style.pointerEvents = show && placeIdOf(l.name) ? "auto" : "none"; // its "Découvrir" button, only while shown
      el.style.visibility = show ? "visible" : "hidden"; // out of the tab order while hidden
    });
    if (g.visible && near && frame.alt < LABEL_ALT * 2) creditNear();
    if (!g.visible) return;
    setFade(list, op, fade.current);
    const n = ENV.night;
    for (const [k, v] of Object.entries(NIGHT) as [CfcKey, number][]) { const m = res.M[k]; if (m) m.emissiveIntensity = n * v; }
  });
  return (
    <group ref={root} position={[CFC.x, 0, CFC.y]}>
      {res.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]!} raycast={() => null} />)}
      {res.labels.map((l, i) => (
        <GeoHtml key={i} position={[l.x, l.y, l.z]} center zIndex={5}>
          <div ref={(e) => { tags.current[i] = e; }} style={{ opacity: 0, visibility: "hidden", transition: "opacity .3s, visibility .3s" }}
            className={`pointer-events-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.6)] ring-1 backdrop-blur transition-opacity duration-300 ${l.hero ? "bg-[#0B1020]/85 ring-white/25" : "bg-[#0B1020]/60 ring-white/10 text-[10px]"}`}>
            {l.name}{l.sub ? <span className="ml-1.5 font-normal opacity-70">· {l.sub}</span> : null}
            {placeIdOf(l.name) && <DiscoverButton id={placeIdOf(l.name)!} />}
          </div>
        </GeoHtml>
      ))}
    </group>
  );
}
