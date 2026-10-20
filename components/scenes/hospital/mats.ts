// Shared palette, geometries and per-floor material sets for the hospital maquette.
// Calm architectural-model palette: matte whites and light greys, muted accents, no saturated colour.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { G, M } from "./layout";

export const PAL = {
  slabTop: "#EEF0F5", slabEdge: "#C3CAD8", plinthTop: "#E4E8EF", plinthSide: "#C9CFDB",
  road: "#D3D8E2", lawn: "#D5E0D3", paving: "#ECEEF3", glass: "#D8E4FF", mullion: "#D7DCE5",
  agent: "#5B7CFF", agentCore: "#9CB0FF", select: "#8EA4FF",
};

const C = (h: string) => new THREE.Color(h);

/** Unit geometries shared by every instanced mesh (never disposed while the app runs). */
export const GEO: Record<G, THREE.BufferGeometry> = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: new RoundedBoxGeometry(1, 1, 1, 1, 0.1),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 20),
  sph: new THREE.IcosahedronGeometry(0.5, 1),
  torus: new THREE.TorusGeometry(0.95, 0.3, 14, 40),
};

const SPEC: Record<M, { color: string; rough?: number; metal?: number; emissive?: string; ei?: number; flat?: boolean }> = {
  white: { color: "#F3F4F7", rough: 0.85 },
  wall: { color: "#F6F7FA", rough: 0.9 },
  light: { color: "#DEE2EA", rough: 0.8 },
  grey: { color: "#9AA3B4", rough: 0.6 },
  steel: { color: "#C2C8D3", rough: 0.42, metal: 0.25 },
  dark: { color: "#394155", rough: 0.55 },
  screen: { color: "#1F2740", rough: 0.35, emissive: "#30436F", ei: 0.35 },
  wood: { color: "#E4DBCD", rough: 0.75 },
  fabric: { color: "#7B88A4", rough: 0.95 },
  mattress: { color: "#FAFBFD", rough: 0.95 },
  blanket: { color: "#C6D3E8", rough: 0.95 },
  green: { color: "#A2B79D", rough: 0.9, flat: true },
  lamp: { color: "#FFFFFF", rough: 0.4, emissive: "#FFF4E2", ei: 0.75 },
  carton: { color: "#D8CAB2", rough: 0.9 },
  curtain: { color: "#C9D6DE", rough: 0.95 },
};

export type FloorMats = {
  parts: Record<M, THREE.MeshStandardMaterial>;
  slabTop: THREE.MeshStandardMaterial; slabEdge: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial; mullion: THREE.MeshStandardMaterial;
  band: THREE.MeshStandardMaterial; louvre: THREE.MeshStandardMaterial; glassBase: number;
  figure: THREE.MeshStandardMaterial; hit: THREE.MeshBasicMaterial;
  orb: THREE.MeshStandardMaterial; halo: THREE.MeshBasicMaterial;
  all: THREE.Material[];
};

let haloTex: THREE.Texture | null = null;
export function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,0.9)");
  gr.addColorStop(0.25, "rgba(255,255,255,0.35)");
  gr.addColorStop(0.6, "rgba(255,255,255,0.08)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(c);
  haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}

export type FacadeStyle = "basement" | "main-ground" | "main" | "annex";
const GLASS: Record<FacadeStyle, { color: string; opacity: number; metal: number; rough: number; env: number }> = {
  basement: { color: PAL.glass, opacity: 0.11, metal: 0, rough: 0.08, env: 1.4 },
  "main-ground": { color: "#B4C4D6", opacity: 0.26, metal: 0.1, rough: 0.06, env: 1.6 },
  main: { color: "#1E2836", opacity: 0.66, metal: 0.3, rough: 0.12, env: 1.8 },
  annex: { color: "#7DB8E2", opacity: 0.62, metal: 0.35, rough: 0.07, env: 2.0 },
};

export function makeFloorMats(style: FacadeStyle = "main"): FloorMats {
  const parts = {} as Record<M, THREE.MeshStandardMaterial>;
  for (const k of Object.keys(SPEC) as M[]) {
    const s = SPEC[k];
    parts[k] = new THREE.MeshStandardMaterial({
      color: C(s.color), roughness: s.rough ?? 0.8, metalness: s.metal ?? 0, flatShading: !!s.flat,
      emissive: s.emissive ? C(s.emissive) : C("#000000"), emissiveIntensity: s.ei ?? 0,
    });
  }
  const slabTop = new THREE.MeshStandardMaterial({ color: C(PAL.slabTop), roughness: 0.92 });
  const slabEdge = new THREE.MeshStandardMaterial({ color: C(PAL.slabEdge), roughness: 0.85 });
  const gs = GLASS[style];
  const glass = new THREE.MeshStandardMaterial({
    color: C(gs.color), roughness: gs.rough, metalness: gs.metal, transparent: true, opacity: gs.opacity, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: gs.env,
  });
  if (style !== "basement") { glass.emissive = C("#FFCF8A"); glass.emissiveIntensity = 0; } // windows light up at night
  const band = new THREE.MeshStandardMaterial({ color: C("#F5F6F8"), roughness: 0.5 });
  const louvre = new THREE.MeshStandardMaterial({ color: C("#3A3F48"), roughness: 0.55, metalness: 0.25 });
  const mullion = new THREE.MeshStandardMaterial({ color: C(PAL.mullion), roughness: 0.5, metalness: 0.1 });
  const figure = new THREE.MeshStandardMaterial({ color: C("#FFFFFF"), roughness: 0.78 });
  const hit = new THREE.MeshBasicMaterial({ visible: false });
  const orb = new THREE.MeshStandardMaterial({ color: C(PAL.agentCore), emissive: C(PAL.agent), emissiveIntensity: 0.9, roughness: 0.25 });
  const halo = new THREE.MeshBasicMaterial({
    map: haloTexture(), color: C("#7D97FF"), transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false,
  });
  const all: THREE.Material[] = [...Object.values(parts), slabTop, slabEdge, glass, mullion, band, louvre, figure, orb, halo];
  for (const m of all) { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; m.userData.baseDepthWrite = m.depthWrite; }
  return { parts, slabTop, slabEdge, glass, mullion, band, louvre, glassBase: gs.opacity, figure, hit, orb, halo, all };
}

/** Fade a whole floor (op = 1 opaque … 0 gone). Only touches state when it changes. */
export function setFloorOpacity(mats: THREE.Material[], op: number) {
  for (const m of mats) {
    const base = m.userData.baseOpacity ?? 1;
    const eff = base * op;
    const tr = eff < 0.999 || !!m.userData.baseTransparent;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = eff;
    m.depthWrite = !!m.userData.baseDepthWrite && eff > 0.55;
    m.visible = eff > 0.004;
  }
}

/** Runtime values shared between the scene parts (mutated every frame, never rendered by React). */
export const rt = {
  eco: 0,                                  // animated share(year).eco
  lift: {} as Record<string, number>,      // floor key → 0 (in place) … 1 (lifted away)
  pos: new Map<string, THREE.Vector3>(),   // person id → world position of the chest
  hoverFloor: null as string | null,
  clickHandled: false,                     // set by any 3D click handler so the canvas-level "empty click" can ignore it
  userMoved: false,                        // the user moved the camera since the last programmatic flight
  root: null as THREE.Object3D | null,
  day: 1,                                  // time-lapse daylight (1 day … 0 night), see TimeTravel.tsx
  desk: new Map<number, number>(),         // desk id → presence of its person (1 there … 0 folded away)
  deskVer: 0,                              // bumped whenever a desk presence changes
  yearChangedAt: -1,                       // performance.now() of the last timeline change (caption)     // campus frame ("building frame" coordinates of lib/hospital) → world
};
