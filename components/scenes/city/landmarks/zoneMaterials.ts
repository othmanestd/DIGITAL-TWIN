// Materials of the OpenStreetMap districts (CFC, Maârif …), made on demand per key from the procedural painters (cfcPaint,
// texturePaint) and the shared TEX cache; `NIGHT` is the emissive strength of the lit façades at night. Each district asks
// only for the keys its geometry uses. The TEX.* textures are shared with the other landmarks (never disposed here).
import * as THREE from "three";
import { TEX } from "./textures";
import { paintGlass } from "./texturePaint";
import {
  paintApart, paintBase, paintCfcScreen, paintContact, paintDeco, paintFrame, paintGable, paintGreen, paintGrc, paintLawn, paintPanel, paintPaving,
  paintResidence, paintShop, paintShopAwning, paintVeil, paintVilla,
} from "./cfcPaint";
import type { CfcKey } from "./zoneKit";

const tex = (c: HTMLCanvasElement, srgb = true) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};
/** emissive strength at night per material (0 = never lit) */
export const NIGHT: Partial<Record<CfcKey, number>> = {
  "glass.cool": 0.85, "glass.green": 0.85, "glass.bronze": 0.85, "glass.silver": 0.85, "glass.sage": 0.85, bcpGlass: 0.85, screen: 0.8, "apart.white": 0.8, "apart.cream": 0.8,
  deco: 0.8, grc: 0.75, veil: 0.9, green: 0.8, shop: 0.9, panel: 0.7, villa: 0.7,
  "res.0": 0.8, "res.1": 0.8, "res.2": 0.8, "res.3": 0.8, "res.4": 0.8, "res.5": 0.8, "res.6": 0.8, "res.7": 0.8, "base.w": 0.6, "base.c": 0.6, shopAwn: 0.9,
};
/** keys whose textures belong to the shared TEX cache */
export const SHARED_TEX: ReadonlySet<CfcKey> = new Set(["glass.cool", "glass.green", "glass.bronze"]);
/** Maârif wall tints: white and cream render */
const WALL = ["#F2EFE8", "#ECE3D0"] as const;

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(o);
const lit = (p: [HTMLCanvasElement, HTMLCanvasElement], o: THREE.MeshStandardMaterialParameters = {}) =>
  std({ map: tex(p[0]), emissive: "#FFFFFF", emissiveMap: tex(p[1]), emissiveIntensity: 0, roughness: 0.7, ...o });
const glass = (v: "cool" | "green" | "bronze") => () => { const g = TEX.glass(v); return std({ map: g.map, emissive: "#FFFFFF", emissiveMap: g.glow, emissiveIntensity: 0, roughness: 0.32, metalness: 0.14, envMapIntensity: 0.95 }); };
const own = (top: string, bottom: string, spandrel: string, seed: number) => () => {
  const [a, b] = paintGlass({ top, bottom, spandrel, mullion: "#F0F3F6", blind: "#DDE3EA" }, seed);
  return std({ map: tex(a), emissive: "#FFFFFF", emissiveMap: tex(b), emissiveIntensity: 0, roughness: 0.34, metalness: 0.1, envMapIntensity: 0.9 });
};
const res = (style: number, tint: number) => () => lit(paintResidence(101 + style * 7 + tint, style, WALL[tint]));
const ground = { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 };

const MAKE: Record<CfcKey, () => THREE.MeshStandardMaterial> = {
  "glass.cool": glass("cool"), "glass.green": glass("green"), "glass.bronze": glass("bronze"), bcpGlass: own("#B7C6D6", "#6F849C", "#A8B3BF", 29),
  "glass.silver": own("#C8D4E0", "#8A9DB2", "#B9C3CD", 31), "glass.sage": own("#C0D3CE", "#7C9893", "#AFC0BB", 37),
  screen: () => lit(paintCfcScreen(41), { roughness: 0.55, metalness: 0.1 }),
  "apart.white": () => lit(paintApart(11)), "apart.cream": () => lit(paintApart(23, "#ECE3D2")), deco: () => lit(paintDeco(5), { roughness: 0.6 }),
  grc: () => lit(paintGrc(3), { roughness: 0.85 }), gable: () => lit(paintGable(4), { roughness: 0.9 }), veil: () => lit(paintVeil(7), { roughness: 0.45, metalness: 0.25 }),
  green: () => lit(paintGreen(9), { roughness: 0.85 }), shop: () => lit(paintShop(13), { roughness: 0.35, metalness: 0.2 }), panel: () => lit(paintPanel(17), { roughness: 0.5, metalness: 0.15 }),
  frame: () => lit(paintFrame(19), { roughness: 0.9 }), villa: () => lit(paintVilla(21), { roughness: 0.9 }),
  concrete: () => std({ color: "#BDB8AE", roughness: 0.9 }), roof: () => std({ color: "#C4C1B9", roughness: 0.92 }), parapet: () => std({ color: "#ECEAE3", roughness: 0.8 }),
  unit: () => std({ color: "#C9CCCF", roughness: 0.6, metalness: 0.3 }), steel: () => std({ color: "#A7AEB7", roughness: 0.4, metalness: 0.7 }),
  crane: () => std({ color: "#E2B023", roughness: 0.6, metalness: 0.2 }), hoarding: () => std({ color: "#E4E6E0", roughness: 0.85 }),
  lawn: () => std({ map: tex(paintLawn(3)), roughness: 0.95, ...ground }), scrub: () => std({ color: "#7E8A55", roughness: 1, ...ground }),
  turf: () => std({ color: "#5E9050", roughness: 0.9, ...ground }), skate: () => std({ color: "#C4C2BC", roughness: 0.8, ...ground }), rubber: () => std({ color: "#C47A5C", roughness: 0.95, ...ground }),
  water: () => std({ color: "#4C88AE", roughness: 0.12, metalness: 0.3, envMapIntensity: 1.4, ...ground }), sand: () => std({ color: "#CDBB98", roughness: 1, ...ground }),
  asphalt: () => std({ color: "#8C8F94", roughness: 0.95, ...ground }), plaza: () => std({ map: tex(paintPaving(5)), roughness: 0.9, ...ground }), path: () => std({ map: tex(paintPaving(8)), roughness: 0.95, ...ground }),
  rail: () => std({ color: "#9A9EA4", roughness: 0.35, metalness: 0.8, ...ground }), bed: () => std({ color: "#A9A69F", roughness: 0.95, ...ground }), mark: () => std({ color: "#F2F2EE", roughness: 0.8, ...ground }),
  "res.0": res(0, 0), "res.1": res(0, 1), "res.2": res(1, 0), "res.3": res(1, 1), "res.4": res(2, 0), "res.5": res(2, 1), "res.6": res(3, 0), "res.7": res(3, 1),
  "base.w": () => lit(paintBase(61, WALL[0])), "base.c": () => lit(paintBase(67, WALL[1])), shopAwn: () => lit(paintShopAwning(71), { roughness: 0.45, metalness: 0.1 }),
  awning: () => std({ color: "#5E6B63", roughness: 0.8 }), kerb: () => std({ color: "#CFCBC2", roughness: 0.9 }),
  zebra: () => std({ color: "#F4F4F0", roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
  ao: () => std({ color: "#000000", alphaMap: tex(paintContact(), false), transparent: true, opacity: 0.34, depthWrite: false, roughness: 1, ...ground }),
  dish: () => std({ color: "#E3E5E7", roughness: 0.5, metalness: 0.2 }), cage: () => std({ color: "#EEEBE3", roughness: 0.85 }),
};

/** The materials for the given keys (each made once per call). */
export function zoneMaterials(keys: Iterable<CfcKey>): Partial<Record<CfcKey, THREE.MeshStandardMaterial>> {
  const M: Partial<Record<CfcKey, THREE.MeshStandardMaterial>> = {};
  for (const k of keys) M[k] ??= MAKE[k]();
  return M;
}
