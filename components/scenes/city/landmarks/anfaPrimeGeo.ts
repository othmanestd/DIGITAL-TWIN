// Geometry and painted textures of Anfa Prime Hospital (ATP Architectes / Abdou Lahlou, 2025), modelled from the architect's
// published photographs: two low pill-shaped volumes (about three levels) wrapped in a white pebble lattice laid in three wavy
// bands with dark joints (white by day, lit gold from behind at night), a long stadium-shaped canopy with an open slot on one
// white V strut and a column, the AKDITAL / logo medallion / « Anfa Prime Hospital » signage, a glazed entrance between the
// volumes, tall grasses on the roofs, cloud-pruned niwaki and palms behind a slatted fence. Dimensions are a modelling
// estimate from the photos (no plans published). Local frame: origin = ANFA_PRIME (geography.ts), x east, z south, +z = the
// front, facing the boulevard. Built once, merged per material (non-indexed position / normal / uv).
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./env";

type G = THREE.BufferGeometry;
export type ApKey = "skin" | "glow" | "core" | "joint" | "roof" | "grass" | "glass" | "canopy" | "white" | "fence" | "plaza" | "lawn" | "leaf" | "trunk" | "frond";
const V = THREE.Vector3;

/** Footprint of the volumes (local), for colliders and the click box. */
export const AP_VOLUMES = [
  { x: -20, z: -8, w: 26, d: 46 },
  { x: 18, z: -3, w: 24, d: 32 },
];
export const AP_ENTRANCE = { x0: -7, x1: 6, z0: -24, z1: 12 };
export const AP_SIGN_Y = 9.3, AP_SIGN_Z = 22.72;

// ---------------------------------------------------------------- textures (painted once)
/** Pebble lattice: white = solid lattice, black = hole; seamless; 16 × 8 cells (one tile = 26 × 13 m on the façade). */
export function latticeTexture() {
  const W = 512, H = 256, C = 32, cols = W / C, rows = H / C, r = rng(7);
  const pts = new Float32Array(cols * rows * 2);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const k = (j * cols + i) * 2; pts[k] = (i + 0.12 + r() * 0.76) * C; pts[k + 1] = (j + 0.12 + r() * 0.76) * C; }
  const mask = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const gx = Math.floor(x / C), gy = Math.floor(y / C); let f1 = 1e9, f2 = 1e9;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ci = (gx + di + cols) % cols, cj = (gy + dj + rows) % rows, k = (cj * cols + ci) * 2;
      const d = Math.hypot(x - (pts[k] + (gx + di - ci) * C), y - (pts[k + 1] + (gy + dj - cj) * C));
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
    }
    mask[y * W + x] = f2 - f1 > 7 ? 0 : 1;   // white web around pebble-shaped openings (openings ≈ 55 % of the surface, as on the photographs)
  }
  // a box blur then a threshold rounds the holes into pebbles
  const R = 3, n = 2 * R + 1, tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let o = -R; o <= R; o++) s += mask[y * W + ((x + o + W) % W)]; tmp[y * W + x] = s / n; }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d")!, img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0; for (let o = -R; o <= R; o++) s += tmp[((y + o + H) % H) * W + x];
    const v = s / n > 0.42 ? 255 : 0, p = (y * W + x) * 4;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
/** Warm backlight of the lattice at night: bright at the foot of each band. */
export function glowTexture() {
  const c = document.createElement("canvas"); c.width = 4; c.height = 128;
  const g = c.getContext("2d")!, gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, "#fff0c2"); gr.addColorStop(0.35, "#ffc061"); gr.addColorStop(1, "#a8561a");
  g.fillStyle = gr; g.fillRect(0, 0, 4, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function akditalMark(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, color: string) {
  g.strokeStyle = color; g.lineWidth = s * 0.12; g.beginPath(); g.arc(cx, cy, s, 0, Math.PI * 2); g.stroke();
  g.fillStyle = color;
  for (const [dx, dy] of [[0, -0.32], [-0.3, 0.22], [0.3, 0.22]]) { g.beginPath(); g.arc(cx + dx * s, cy + dy * s, s * 0.27, 0, Math.PI * 2); g.fill(); }
}
/** Backlit lettering on a transparent canvas. */
export function letterTexture(text: string, color: string, weight: number, size: number, w: number) {
  const c = document.createElement("canvas"); c.width = w; c.height = 256;
  const g = c.getContext("2d")!;
  g.font = `${weight} ${size}px Manrope, Inter, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.shadowColor = color; g.shadowBlur = 22; g.fillStyle = color; g.fillText(text, w / 2, 134);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** The round logo medallion's face. */
export function medalTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!; g.fillStyle = "#0b1830"; g.fillRect(0, 0, 256, 256); akditalMark(g, 128, 128, 92, "#45bdf5");
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** The white welcome panel on the right volume's ground floor. */
export function panelTexture() {
  const c = document.createElement("canvas"); c.width = 512; c.height = 320;
  const g = c.getContext("2d")!; g.fillStyle = "#f7f8fa"; g.fillRect(0, 0, 512, 320); akditalMark(g, 256, 92, 48, "#2b7fc2");
  g.fillStyle = "#1c3a5e"; g.textAlign = "center"; g.font = "800 40px Manrope, Inter, Arial, sans-serif"; g.fillText("ANFA PRIME HOSPITAL", 256, 200);
  g.font = "600 38px Arial, sans-serif"; g.fillText("مستشفى أنفا برايم", 256, 262);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- geometry helpers
const ni = (g: G) => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") o.deleteAttribute(k); return o; };
type Pt = { x: number; z: number; nx: number; nz: number; s: number };
/** Pill outline (long axis on z), samples with outward normal and arc length. */
function stadium(w: number, d: number, n: number) {
  const r = w / 2, a = Math.max(0, (d - w) / 2), P = 4 * a + 2 * Math.PI * r, pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const s = (P * i) / n; let q = s, x: number, z: number, nx: number, nz: number, t: number;
    if (q < 2 * a) { x = r; z = -a + q; nx = 1; nz = 0; }
    else if ((q -= 2 * a) < Math.PI * r) { t = q / r; x = r * Math.cos(t); z = a + r * Math.sin(t); nx = Math.cos(t); nz = Math.sin(t); }
    else if ((q -= Math.PI * r) < 2 * a) { x = -r; z = a - q; nx = -1; nz = 0; }
    else { q -= 2 * a; t = Math.PI + q / r; x = r * Math.cos(t); z = -a + r * Math.sin(t); nx = Math.cos(t); nz = Math.sin(t); }
    pts.push({ x, z, nx, nz, s });
  }
  return { pts, P, r, a };
}
function stadiumShape(w: number, d: number) {
  const r = w / 2, a = Math.max(0, (d - w) / 2), sh = new THREE.Shape();
  sh.absarc(0, a, r, 0, Math.PI, false); sh.absarc(0, -a, r, Math.PI, Math.PI * 2, false);
  return sh;
}
/** Vertical band along the outline between yb(p) and yt(p); `bandUV` = v from 0 (foot) to 1 (top), else v in metres / 13. */
function band(st: ReturnType<typeof stadium>, yb: (p: Pt) => number, yt: (p: Pt) => number, inset: number, bandUV: boolean, dx: number, dz: number): G {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  const uS = Math.max(1, Math.round(st.P / 20)) / st.P;   // one lattice tile = 20 × 10 m (pebbles of about 1.2 m)
  for (const p of st.pts) {
    const x = p.x - p.nx * inset + dx, z = p.z - p.nz * inset + dz, b = yb(p), t = yt(p);
    pos.push(x, b, z, x, t, z); nor.push(p.nx, 0, p.nz, p.nx, 0, p.nz);
    if (bandUV) uv.push(p.s * uS, 0, p.s * uS, 1); else uv.push(p.s * uS, b / 10, p.s * uS, t / 10);
  }
  for (let i = 0; i < st.pts.length - 1; i++) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return ni(g);
}
function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1 = r0, seg = 10): G {
  const g = new THREE.CylinderGeometry(r1, r0, a.distanceTo(b), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().lerp(b, 0.5); g.translate(m.x, m.y, m.z);
  return ni(g);
}
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => ni(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z));
const slab = (w: number, d: number, x: number, z: number, y: number) => ni(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2).translate(x, y, z));

// ---------------------------------------------------------------- the model
/** The runs of the front fence (local x spans at z = 29) kept by `keep` (the gate between −6 and 9 stays open). */
export function fenceRuns(keep: (x: number, z: number) => boolean = () => true): [number, number][] {
  const runs: [number, number][] = [];
  let a: number | null = null, last = 0;
  for (let x = -48; x <= 48.001; x += 0.38) {
    const on = (x < -6 || x > 9) && keep(x, 29);
    if (on && a === null) a = x;
    if (!on && a !== null) { runs.push([a, last]); a = null; }
    if (on) last = x;
  }
  if (a !== null) runs.push([a, last]);
  return runs;
}
/** the part of [x0, x1] at depth z that `keep` accepts (the garden lawns are clipped to the parcel) */
const clipSpan = (x0: number, x1: number, z: number, keep: (x: number, z: number) => boolean): [number, number] | null => {
  let a: number | null = null, b = 0;
  for (let x = x0; x <= x1 + 1e-6; x += 0.5) if (keep(x, z)) { if (a === null) a = x; b = x; }
  return a === null || b - a < 2 ? null : [a, b];
};

/** The clinic model in its local frame; `keep` trims the front garden, the fence and the planting to the real parcel. */
export function buildAnfaPrime(keep: (x: number, z: number) => boolean = () => true) {
  const B: Partial<Record<ApKey, G[]>> = {};
  const add = (k: ApKey, g: G) => { (B[k] ??= []).push(g); };
  const r = rng(2025);

  for (const [vi, v] of AP_VOLUMES.entries()) {
    const side = vi === 0 ? -1 : 1, st = stadium(v.w, v.d, 200);
    const k = (p: Pt) => (Math.max(-1, Math.min(1, (side * p.x) / st.r)) + 1) / 2;       // 0 inner end … 1 outer end
    const wave = (p: Pt) => 0.6 * Math.sin((p.s / st.P) * Math.PI * 4);
    const yb = (p: Pt) => 5.2 - 4.4 * k(p), yt = (p: Pt) => 12.8 + 3.6 * k(p) + wave(p);
    const cut = [0, 0.36, 0.68, 1];
    for (let b = 0; b < 3; b++) {
      const lo = (p: Pt) => yb(p) + (yt(p) - yb(p)) * cut[b] + (b ? 0.3 : 0);
      const hi = (p: Pt) => yb(p) + (yt(p) - yb(p)) * cut[b + 1] - (b < 2 ? 0.3 : 0);
      add("skin", band(st, lo, hi, 0, false, v.x, v.z));
      add("glow", band(st, lo, hi, 0.55, true, v.x, v.z));
      if (b < 2) { const jy = (p: Pt) => yb(p) + (yt(p) - yb(p)) * cut[b + 1]; add("joint", band(st, (p) => jy(p) - 0.32, (p) => jy(p) + 0.32, 0.35, true, v.x, v.z)); }
    }
    add("core", ni(new THREE.ExtrudeGeometry(stadiumShape(v.w - 2.4, v.d - 2.4), { depth: 13, bevelEnabled: false, curveSegments: 20 }).rotateX(-Math.PI / 2).translate(v.x, 0, v.z)));
    add("glass", band(st, () => 0.2, (p) => Math.max(0.4, yb(p) - 0.3), 1.15, true, v.x, v.z));
    add("roof", ni(new THREE.ShapeGeometry(stadiumShape(v.w - 1, v.d - 1), 20).rotateX(-Math.PI / 2).translate(v.x, 13.05, v.z)));
    // tall ornamental grasses on the roof
    const cone = new THREE.ConeGeometry(0.06, 1, 3), n = Math.round(v.w * v.d * 0.45), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
      const x = (r() - 0.5) * v.w, z = (r() - 0.5) * v.d, rr = st.r - 1.4;
      if (Math.abs(x) > rr || (Math.abs(z) > st.a && x * x + (z - Math.sign(z) * st.a) ** 2 > rr * rr)) continue;
      const h = 2.4 + r() * 2.6;
      e.set((r() - 0.5) * 0.35, 0, (r() - 0.5) * 0.35); q.setFromEuler(e);
      m.compose(new V(v.x + x, 13.05 + h / 2, v.z + z), q, new V(1 + r(), h, 1 + r()));
      add("grass", ni(cone.clone().applyMatrix4(m))); i++;
    }
  }
  // glazed entrance between the volumes, dark connector behind it, pebble band over the entrance (seen through the canopy slot)
  add("glass", box(13, 7.5, 10, -0.5, 0, 7));
  add("core", box(13, 9.2, 26, -0.5, 0, -11));
  add("roof", box(13.4, 0.4, 26.4, -0.5, 9.2, -11));
  { const g = ni(new THREE.PlaneGeometry(13, 4.4).translate(-0.5, 9.8, 2.12)); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 0.65, uv.getY(i) * 0.44); add("skin", g); }
  add("glow", ni(new THREE.PlaneGeometry(13, 4.4).translate(-0.5, 9.8, 2.03)));
  // stadium canopy with its open slot, cantilevered towards the boulevard
  // a slender band (about 1.3 m) as on the photographs, the slot wide open
  const cs = stadiumShape(7.4, 46); cs.holes.push(stadiumShape(3.6, 34));
  add("canopy", ni(new THREE.ExtrudeGeometry(cs, { depth: 1.1, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2, curveSegments: 28 }).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2).translate(4, 8.75, 18.8)));
  // one big V from a single footing, a column behind it, a slimmer brace on the right
  add("white", rod(new V(2.5, 0, 19.5), new V(-7.5, 8.7, 16.5), 0.58, 0.5));
  add("white", rod(new V(2.5, 0, 19.5), new V(12, 8.7, 16.5), 0.58, 0.5));
  add("white", rod(new V(0.2, 0, 14.2), new V(0.2, 8.7, 14.2), 0.42));
  add("white", rod(new V(12.5, 0, 15.5), new V(15, 8.7, 13), 0.3));
  // forecourt, lawns, slatted fence with the gate posts
  add("plaza", slab(24, 17, 2, 20.5, 0.06));
  for (const [w, d, x, z] of [[36, 12, -28, 22.5], [26, 9, 33, 24]] as const) {
    const sp = clipSpan(x - w / 2, x + w / 2, z, keep);
    if (sp) add("lawn", slab(sp[1] - sp[0], d, (sp[0] + sp[1]) / 2, z, 0.07));
  }
  for (const [x0, x1] of fenceRuns(keep)) {
    for (let x = x0; x <= x1 + 1e-6; x += 0.38) add("fence", box(0.1, 1.9, 0.12, x, 0.35, 29));
    add("fence", box(x1 - x0 + 0.4, 0.35, 0.4, (x0 + x1) / 2, 0, 29));
  }
  for (const x of [-6.15, 9.15]) add("fence", box(0.3, 2.5, 0.3, x, 0, 29));
  // cloud-pruned niwaki and palms in the front garden
  const niwaki = (x: number, z: number, s: number) => {
    const top = new V(x + 0.25 * s, 2.6 * s, z - 0.15 * s);
    add("trunk", rod(new V(x, 0, z), top, 0.26 * s, 0.18 * s, 6));
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26 + r() * 0.5, y = (1.3 + i * 0.32) * s, from = new V(x, 0, z).lerp(top, y / (2.6 * s));
      const to = new V(x + Math.cos(a) * (1.1 + r() * 0.4) * s, y + 0.5 * s, z + Math.sin(a) * (1.1 + r() * 0.4) * s);
      add("trunk", rod(from, to, 0.09 * s, 0.06 * s, 5));
      add("leaf", ni(new THREE.IcosahedronGeometry((0.62 + r() * 0.25) * s, 1).scale(1, 0.42, 1).translate(to.x, to.y + 0.12 * s, to.z)));
    }
    add("leaf", ni(new THREE.IcosahedronGeometry(0.8 * s, 1).scale(1, 0.45, 1).translate(top.x, top.y + 0.25 * s, top.z)));
  };
  for (const [x, z, s] of [[-30, 25, 1.3], [-21, 26, 1.2], [-12, 22.5, 1], [-8.5, 26.5, 1.1], [13, 22, 1], [21, 26.6, 1.25], [30, 25, 1.3], [38, 24, 1.1]]) if (keep(x, z)) niwaki(x, z, s);
  const palm = (x: number, z: number, h: number) => {
    add("trunk", rod(new V(x, 0, z), new V(x, h, z), 0.38, 0.22, 7));
    for (let i = 0; i < 9; i++) {
      const f = new THREE.PlaneGeometry(0.9, 4.2).translate(0, 2, 0).rotateX(0.2);
      f.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(1.05 + r() * 0.3, (i * Math.PI * 2) / 9, 0, "YXZ")));
      add("frond", ni(f.translate(x, h, z)));
    }
  };
  for (const [x, z, h] of [[-40, 21, 8], [-33, 22, 9], [-13, 21, 7], [26, 21, 8.5], [36, 22, 7.5], [44, 20, 9], [-46, 10, 8], [42, 6, 8], [-44, 26.5, 2.6], [-26, 27.6, 2.2], [44, 27, 2.4]]) if (keep(x, z)) palm(x, z, h);

  return (Object.keys(B) as ApKey[]).map((key) => ({ key, geo: mergeGeometries(B[key]!, false) }));
}
