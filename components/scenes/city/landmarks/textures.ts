// three.js wrappers of the procedural painters (texturePaint.ts): built lazily on the client, cached, shared by the landmarks.
import * as THREE from "three";
import * as P from "./texturePaint";

const cache = new Map<string, THREE.Texture>();

function wrap(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function get(key: string, make: () => THREE.Texture) {
  let t = cache.get(key);
  if (!t) { t = make(); cache.set(key, t); }
  return t;
}
const pair = (key: string, make: () => [HTMLCanvasElement, HTMLCanvasElement]) => {
  const k0 = key + ".map", k1 = key + ".glow";
  if (!cache.has(k0)) { const [a, b] = make(); cache.set(k0, wrap(a)); cache.set(k1, wrap(b)); }
  return { map: cache.get(k0)!, glow: cache.get(k1)! };
};

export const TEX = {
  stone: () => get("stone", () => wrap(P.paintStone())),
  arcade: () => get("arcade", () => wrap(P.paintArcade())),
  arcadeGlow: () => get("arcadeGlow", () => wrap(P.paintArcade(true))),
  panel: () => get("panel", () => wrap(P.paintPanel())),
  panelGlow: () => get("panelGlow", () => wrap(P.paintPanel(true))),
  zGreen: () => get("zGreen", () => wrap(P.paintZellige(P.ZELLIGE.green))),
  zTurq: () => get("zTurq", () => wrap(P.paintZellige(P.ZELLIGE.turquoise))),
  roof: () => get("roof", () => wrap(P.paintGreenRoof())),
  marble: () => get("marble", () => wrap(P.paintMarble())),
  plaza: () => get("plaza", () => wrap(P.paintPlaza())),
  glass: (v: "cool" | "green" | "bronze") => pair("glass." + v, () => P.paintGlass(P.GLASS[v], v === "cool" ? 3 : v === "green" ? 9 : 5)),
  lattice: () => pair("lattice", () => P.paintLattice()),
  tram: () => pair("tram", () => P.paintTram()),
  /** periodic noise for the cloud layer (RGBA = 4 octaves) */
  cloud: () => get("cloud", () => {
    const t = new THREE.DataTexture(P.cloudNoise(256), 256, 256, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  }),
};
