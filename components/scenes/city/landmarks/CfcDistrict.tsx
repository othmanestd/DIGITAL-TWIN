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
import { TEX } from "./textures";
import { paintGlass } from "./texturePaint";
import { lmOpacity, setFade, yawedSolids } from "./shared";
import { paintApart, paintCfcScreen, paintDeco, paintFrame, paintGable, paintGreen, paintGrc, paintLawn, paintPanel, paintPaving, paintShop, paintVeil, paintVilla } from "./cfcPaint";
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

const tex = (c: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
/** emissive strength at night per material (0 = never lit) */
const NIGHT: Partial<Record<CfcKey, number>> = {
  "glass.cool": 0.85, "glass.green": 0.85, "glass.bronze": 0.85, "glass.silver": 0.85, "glass.sage": 0.85, bcpGlass: 0.85, screen: 0.8, "apart.white": 0.8, "apart.cream": 0.8,
  deco: 0.8, grc: 0.75, veil: 0.9, green: 0.8, shop: 0.9, panel: 0.7, villa: 0.7,
};

function materials() {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
  const lit = (p: [HTMLCanvasElement, HTMLCanvasElement], o: THREE.MeshStandardMaterialParameters = {}) =>
    std({ map: tex(p[0]), emissive: "#FFFFFF", emissiveMap: tex(p[1]), emissiveIntensity: 0, roughness: 0.7, ...o });
  const glass = (v: "cool" | "green" | "bronze") => { const g = TEX.glass(v); return std({ map: g.map, emissive: "#FFFFFF", emissiveMap: g.glow, emissiveIntensity: 0, roughness: 0.32, metalness: 0.14, envMapIntensity: 0.95 }); };
  const own = (top: string, bottom: string, spandrel: string, seed: number) => {
    const [a, b] = paintGlass({ top, bottom, spandrel, mullion: "#F0F3F6", blind: "#DDE3EA" }, seed);
    return std({ map: tex(a), emissive: "#FFFFFF", emissiveMap: tex(b), emissiveIntensity: 0, roughness: 0.34, metalness: 0.1, envMapIntensity: 0.9 });
  };
  const ground = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };
  const M: Record<CfcKey, THREE.MeshStandardMaterial> = {
    "glass.cool": glass("cool"), "glass.green": glass("green"), "glass.bronze": glass("bronze"), bcpGlass: own("#B7C6D6", "#6F849C", "#A8B3BF", 29),
    "glass.silver": own("#C8D4E0", "#8A9DB2", "#B9C3CD", 31), "glass.sage": own("#C0D3CE", "#7C9893", "#AFC0BB", 37),
    screen: lit(paintCfcScreen(41), { roughness: 0.55, metalness: 0.1 }),
    "apart.white": lit(paintApart(11)), "apart.cream": lit(paintApart(23, "#ECE3D2")), deco: lit(paintDeco(5), { roughness: 0.6 }),
    grc: lit(paintGrc(3), { roughness: 0.85 }), gable: lit(paintGable(4), { roughness: 0.9 }), veil: lit(paintVeil(7), { roughness: 0.45, metalness: 0.25 }),
    green: lit(paintGreen(9), { roughness: 0.85 }), shop: lit(paintShop(13), { roughness: 0.35, metalness: 0.2 }), panel: lit(paintPanel(17), { roughness: 0.5, metalness: 0.15 }),
    frame: lit(paintFrame(19), { roughness: 0.9 }), villa: lit(paintVilla(21), { roughness: 0.9 }),
    concrete: std({ color: "#BDB8AE", roughness: 0.9 }), roof: std({ color: "#B4B3AE", roughness: 0.92 }), parapet: std({ color: "#ECEAE3", roughness: 0.8 }),
    unit: std({ color: "#C9CCCF", roughness: 0.6, metalness: 0.3 }), steel: std({ color: "#A7AEB7", roughness: 0.4, metalness: 0.7 }),
    crane: std({ color: "#E2B023", roughness: 0.6, metalness: 0.2 }), hoarding: std({ color: "#E4E6E0", roughness: 0.85 }),
    lawn: std({ map: tex(paintLawn(3)), roughness: 0.95, ...ground }), scrub: std({ color: "#7E8A55", roughness: 1, ...ground }),
    turf: std({ color: "#5E9050", roughness: 0.9, ...ground }), skate: std({ color: "#C4C2BC", roughness: 0.8, ...ground }), rubber: std({ color: "#C47A5C", roughness: 0.95, ...ground }),
    water: std({ color: "#4C88AE", roughness: 0.12, metalness: 0.3, envMapIntensity: 1.4, ...ground }), sand: std({ color: "#CDBB98", roughness: 1, ...ground }),
    asphalt: std({ color: "#8C8F94", roughness: 0.95, ...ground }), plaza: std({ map: tex(paintPaving(5)), roughness: 0.9, ...ground }), path: std({ map: tex(paintPaving(8)), roughness: 0.95, ...ground }),
    rail: std({ color: "#9A9EA4", roughness: 0.35, metalness: 0.8, ...ground }), bed: std({ color: "#A9A69F", roughness: 0.95, ...ground }), mark: std({ color: "#F2F2EE", roughness: 0.8, ...ground }),
  };
  return M;
}

const LABEL_ALT = 1400, LABEL_NEAR = 950;

export function CfcDistrict() {
  const res = useMemo(() => ({ ...district(), M: materials() }), []);
  const list = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  const root = useRef<THREE.Group>(null);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const credit = useRef<HTMLDivElement>(null);
  const fade = useRef({ v: -1 });
  useEffect(() => () => {
    res.parts.forEach((p) => p.geo.dispose());
    // the shared Moncef textures (TEX.*) stay cached; only ours go
    for (const [k, m] of Object.entries(res.M)) { if (!["glass.cool", "glass.green", "glass.bronze"].includes(k)) { m.map?.dispose(); m.emissiveMap?.dispose(); } m.dispose(); }
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
    });
    if (credit.current) credit.current.style.opacity = g.visible && near && frame.alt < LABEL_ALT * 2 ? "1" : "0";
    if (!g.visible) return;
    setFade(list, op, fade.current);
    const n = ENV.night;
    for (const [k, v] of Object.entries(NIGHT) as [CfcKey, number][]) res.M[k].emissiveIntensity = n * v;
  });
  return (
    <group ref={root} position={[CFC.x, 0, CFC.y]}>
      {res.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]} raycast={() => null} />)}
      {res.labels.map((l, i) => (
        <GeoHtml key={i} position={[l.x, l.y, l.z]} center zIndex={5}>
          <div ref={(e) => { tags.current[i] = e; }} style={{ opacity: 0 }}
            className={`pointer-events-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.6)] ring-1 backdrop-blur transition-opacity duration-300 ${l.hero ? "bg-[#0B1020]/85 ring-white/25" : "bg-[#0B1020]/60 ring-white/10 text-[10px]"}`}>
            {l.name}{l.sub ? <span className="ml-1.5 font-normal opacity-70">· {l.sub}</span> : null}
          </div>
        </GeoHtml>
      ))}
      {/* ODbL attribution of the district data, while it is on screen */}
      <GeoHtml fullscreen zIndex={5}>
        <div ref={credit} style={{ opacity: 0 }} className="pointer-events-none absolute bottom-[86px] right-4 rounded bg-[#0B1020]/55 px-2 py-0.5 text-[10px] text-white/75 transition-opacity duration-300">
          Casablanca Finance City · bâtiments et rues © contributeurs OpenStreetMap (ODbL)
        </div>
      </GeoHtml>
    </group>
  );
}
