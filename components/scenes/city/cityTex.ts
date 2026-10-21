// Procedural textures of the city (generated in code, no photo): lime plaster, roof-terrace cement tiles, worn asphalt,
// Casablanca pavement tiles, beach sand with ripples, patchy park grass, field soil. Every canvas is ≤ 512 px and tileable;
// detail maps are greyscale (the shaders tint them with the colours of each building, street or field). Built lazily on
// the client and cached. Shaders sample them in world metres (see cityMats.ts for the tile sizes).
import * as THREE from "three";
import { rng } from "./geography";

/** periodic value noise on a P × P lattice (tileable), 0 … 1 */
function pnoise(P: number, seed: number) {
  const r = rng(seed), L = new Float32Array(P * P).map(() => r());
  return (x: number, y: number) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const i0 = ((i % P) + P) % P, j0 = ((j % P) + P) % P, i1 = (i0 + 1) % P, j1 = (j0 + 1) % P;
    const a = L[j0 * P + i0], b = L[j0 * P + i1], c = L[j1 * P + i0], d = L[j1 * P + i1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
/** tileable fbm over a canvas of S px: base period P lattice cells across the tile, octaves doubling */
function pfbm(S: number, P: number, oct: number, seed: number) {
  const ns = Array.from({ length: oct }, (_, k) => pnoise(P << k, seed + k * 101));
  return (px: number, py: number) => {
    let s = 0, a = 0.5, n = 0;
    for (let k = 0; k < oct; k++) { const p = P << k; s += a * ns[k]((px / S) * p, (py / S) * p); n += a; a *= 0.5; }
    return s / n;
  };
}
function canvas(S: number) { const c = document.createElement("canvas"); c.width = c.height = S; return [c, c.getContext("2d")!] as const; }
function fromField(S: number, f: (x: number, y: number) => [number, number, number]) {
  const [c, g] = canvas(S), img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const [r, gg, b] = f(x, y), o = (y * S + x) * 4;
    img.data[o] = Math.max(0, Math.min(255, r)); img.data[o + 1] = Math.max(0, Math.min(255, gg)); img.data[o + 2] = Math.max(0, Math.min(255, b)); img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return [c, g] as const;
}
const grey = (v: number): [number, number, number] => [v, v, v];

/** lime plaster / stucco (tile 4 m): trowel blotches, fine grain, rain streaks; greyscale around 200 */
export function paintPlaster() {
  const S = 512, f1 = pfbm(S, 4, 4, 11), f2 = pfbm(S, 16, 3, 23), streak = pnoise(24, 31), r = rng(5);
  const [c, g] = fromField(S, (x, y) => {
    const blot = f1(x, y), grain = f2(x, y), st = streak((x / S) * 24, (y / S) * 2.2);
    return grey(196 + (blot - 0.5) * 34 + (grain - 0.5) * 22 - Math.max(0, st - 0.62) * 70 + (r() - 0.5) * 10);
  });
  // a few hairline cracks and patched spots
  g.strokeStyle = "rgba(90,90,90,0.18)"; g.lineWidth = 1;
  for (let i = 0; i < 10; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 30; y += r() * 18; g.lineTo(x, y); } g.stroke(); }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "120,120,120"},${0.05 + r() * 0.06})`; g.fillRect(r() * S, r() * S, 10 + r() * 50, 8 + r() * 30); }
  return c;
}

/** roof terrace (tile 6 m): 50 cm cement tiles, bitumen patches, stains; greyscale around 190 */
export function paintRoof() {
  const S = 512, f = pfbm(S, 6, 4, 41), r = rng(43), T = S / 12;
  const tone = Array.from({ length: 144 }, () => (r() - 0.5) * 18);
  const [c, g] = fromField(S, (x, y) => {
    const i = Math.floor(x / T), j = Math.floor(y / T), jx = x - i * T, jy = y - j * T;
    const joint = jx < 1.5 || jy < 1.5 ? -26 : 0;
    return grey(188 + tone[(j % 12) * 12 + (i % 12)] + (f(x, y) - 0.5) * 50 + joint + (r() - 0.5) * 8);
  });
  for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(60,60,60,${0.12 + r() * 0.15})`; g.beginPath(); g.ellipse(r() * S, r() * S, 20 + r() * 50, 14 + r() * 40, r() * 3, 0, 7); g.fill(); }
  return c;
}

/** worn asphalt (tile 8 m): aggregate, patches, cracks, oil spots; greyscale around 128 (the shader tints it) */
export function paintAsphalt() {
  const S = 512, f = pfbm(S, 5, 5, 51), r = rng(53);
  const [c, g] = fromField(S, (x, y) => grey(124 + (f(x, y) - 0.5) * 46 + (r() < 0.06 ? 40 * r() : 0) - (r() < 0.04 ? 30 * r() : 0)));
  // patched repairs, cracks, oil
  for (let i = 0; i < 5; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "40,40,40" : "170,170,170"},${0.12 + r() * 0.12})`; g.fillRect(r() * S, r() * S, 40 + r() * 120, 30 + r() * 90); }
  g.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    g.strokeStyle = `rgba(20,20,20,${0.25 + r() * 0.3})`;
    let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 10; k++) { x += (r() - 0.5) * 26; y += (r() - 0.5) * 26; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 9; i++) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, "rgba(10,10,10,0.35)"); gr.addColorStop(1, "rgba(10,10,10,0)"); g.save(); g.translate(r() * S, r() * S); g.scale(10 + r() * 20, 6 + r() * 12); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 1, 0, 7); g.fill(); g.restore(); }
  return c;
}

/** pavement (tile 4 m): 40 cm concrete tiles in two tones, worn joints, a few broken tiles; greyscale around 200 */
export function paintPavement() {
  const S = 512, f = pfbm(S, 4, 4, 61), r = rng(63), T = S / 10;
  const tone = Array.from({ length: 100 }, () => (r() - 0.5) * 22 + (r() < 0.08 ? -30 : 0));
  const [c, g] = fromField(S, (x, y) => {
    const i = Math.floor(x / T), j = Math.floor(y / T), jx = x - i * T, jy = y - j * T;
    const joint = jx < 2 || jy < 2 ? -38 : 0;
    // studded pattern of the tiles (a soft 4 × 4 grid of grooves)
    const gx = (jx / T) * 4, gy = (jy / T) * 4, groove = Math.abs(gx - Math.round(gx)) < 0.05 || Math.abs(gy - Math.round(gy)) < 0.05 ? -9 : 0;
    return grey(198 + tone[(j % 10) * 10 + (i % 10)] + (f(x, y) - 0.5) * 36 + joint + groove + (r() - 0.5) * 8);
  });
  for (let i = 0; i < 7; i++) { g.fillStyle = `rgba(70,70,70,${0.08 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * S, r() * S, 16 + r() * 40, 10 + r() * 26, r() * 3, 0, 7); g.fill(); }
  return c;
}

/** beach sand (tile 12 m), colour: wind ripples, grain, footprints */
export function paintSand() {
  const S = 512, f = pfbm(S, 4, 4, 71), w = pfbm(S, 3, 2, 73), r = rng(77);
  const [c, g] = fromField(S, (x, y) => {
    const warp = (w(x, y) - 0.5) * 60;
    const rip = Math.sin(((y + warp) / S) * Math.PI * 2 * 26 + Math.sin((x / S) * Math.PI * 2 * 3) * 2) * 0.5 + 0.5;
    const v = (f(x, y) - 0.5) * 26 + rip * 10 + (r() - 0.5) * 18;
    return [226 + v, 210 + v * 0.95, 176 + v * 0.85];
  });
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(150,120,80,${0.05 + r() * 0.07})`; g.beginPath(); g.ellipse(r() * S, r() * S, 2 + r() * 3, 3 + r() * 3, r() * 3, 0, 7); g.fill(); }
  return c;
}

/** park grass (tile 10 m), colour: green with dry patches and fine blades */
export function paintGrass() {
  const S = 512, f = pfbm(S, 3, 4, 81), d = pfbm(S, 5, 3, 83), r = rng(87);
  return fromField(S, (x, y) => {
    const dry = Math.max(0, d(x, y) - 0.56) * 2.4, v = (f(x, y) - 0.5) * 40 + (r() - 0.5) * 34;
    return [92 + v * 0.6 + dry * 70, 128 + v + dry * 30, 62 + v * 0.4 + dry * 34];
  })[0];
}

/** field soil (tile 24 m), greyscale clods and stones around 160 (the ground shader colours the fields) */
export function paintSoil() {
  const S = 512, f = pfbm(S, 6, 5, 91), r = rng(93);
  return fromField(S, (x, y) => grey(160 + (f(x, y) - 0.5) * 70 + (r() < 0.02 ? 50 : 0) + (r() - 0.5) * 16))[0];
}

/** coastal rocks (tile 15 m), colour: dark weathered rock with sand pockets and a little green (fallback of rocks.jpg) */
export function paintRocks() {
  const S = 512, f = pfbm(S, 5, 5, 101), m = pfbm(S, 3, 3, 103), r = rng(107);
  return fromField(S, (x, y) => {
    const v = f(x, y), sandy = Math.max(0, m(x, y) - 0.55) * 3, g = (r() - 0.5) * 20;
    const rock = 70 + v * 90 + g;
    return [rock + sandy * 90, rock * 0.96 + sandy * 78 + 6, rock * 0.88 + sandy * 50];
  })[0];
}

// ---------------------------------------------------------------- three.js wrappers
// Each texture starts as its procedural painting and is swapped for the CC0 photo (public/textures/city, see CREDITS.md)
// once that loads; `tile` (metres per repeat) follows, so the shaders keep the real size of whichever is in use.
type Key = "plaster" | "roof" | "asphalt" | "pavement" | "sand" | "grass" | "soil" | "rocks";
const SPEC: Record<Key, { paint: () => HTMLCanvasElement; tile: number; photoTile: number; srgb: boolean }> = {
  plaster: { paint: paintPlaster, tile: 4, photoTile: 2, srgb: false },
  roof: { paint: paintRoof, tile: 6, photoTile: 2, srgb: false },
  asphalt: { paint: paintAsphalt, tile: 8, photoTile: 3, srgb: false },
  pavement: { paint: paintPavement, tile: 4, photoTile: 1.9, srgb: false },
  soil: { paint: paintSoil, tile: 24, photoTile: 4, srgb: false },
  sand: { paint: paintSand, tile: 12, photoTile: 15, srgb: true },
  grass: { paint: paintGrass, tile: 10, photoTile: 2, srgb: true },
  rocks: { paint: paintRocks, tile: 15, photoTile: 15, srgb: true },
};
const cache = new Map<Key, { tex: THREE.Texture; tile: { value: number } }>();
function entry(key: Key) {
  let e = cache.get(key);
  if (!e) {
    const s = SPEC[key];
    const tex: THREE.Texture = new THREE.Texture(s.paint()); tex.needsUpdate = true;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = s.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const tile = { value: s.tile };
    e = { tex, tile };
    cache.set(key, e);
    new THREE.ImageLoader().load(`/textures/city/${key}.jpg`, (img) => { tex.image = img; tex.needsUpdate = true; tile.value = s.photoTile; }, undefined, () => { /* keep the procedural fallback */ });
  }
  return e;
}
/** city textures (procedural fallback → CC0 photo) */
export const CTEX = {
  plaster: () => entry("plaster").tex, roof: () => entry("roof").tex, asphalt: () => entry("asphalt").tex, pavement: () => entry("pavement").tex,
  sand: () => entry("sand").tex, grass: () => entry("grass").tex, soil: () => entry("soil").tex, rocks: () => entry("rocks").tex,
};
/** tile size (metres per repeat) of each city texture, as a shader uniform */
export const CTILE = (key: Key) => entry(key).tile;
