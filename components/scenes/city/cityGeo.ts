// Geometry builders of the city (pure three.js, no React): the façade box (no bottom face), a Washingtonia palm crown,
// a leafy tree, roof props (tanks, dishes, AC units, stair cabins, laundry lines), a neighbourhood minaret, a green tiled
// hip roof, and a fast merged-box builder with vertex colours for the port, the racetrack and the other sites.
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./geography";

/** unit box centred at the origin without its bottom face (never seen; saves a sixth of the façade work) */
export function unitBox() {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const idx = g.index!, keep: number[] = [];
  for (let f = 0; f < 6; f++) if (f !== 3) for (let k = 0; k < 6; k++) keep.push(idx.getX(f * 6 + k));
  g.setIndex(keep); g.clearGroups();
  return g;
}

/** Fast builder of many coloured boxes / quads merged in one geometry (position, normal, colour). */
export class Boxes {
  pos: number[] = []; nor: number[] = []; col: number[] = []; idx: number[] = [];
  private quad(a: number[], b: number[], c: number[], d: number[], n: number[], cl: THREE.Color) {
    const o = this.pos.length / 3;
    this.pos.push(...a, ...b, ...c, ...d);
    for (let k = 0; k < 4; k++) { this.nor.push(n[0], n[1], n[2]); this.col.push(cl.r, cl.g, cl.b); }
    this.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  /** box centred (x, z), from y0 to y0 + h, size w (local x) × d (local z), yaw about +Y; colour (top face may differ) */
  box(x: number, y0: number, z: number, w: number, h: number, d: number, yaw: number, cl: THREE.Color, top?: THREE.Color, bottom = false) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx: number, y: number, lz: number) => [x + lx * c + lz * s, y, z - lx * s + lz * c];
    const N = (lx: number, lz: number) => [lx * c + lz * s, 0, -lx * s + lz * c];
    const hw = w / 2, hd = d / 2, y1 = y0 + h;
    this.quad(P(-hw, y1, hd), P(hw, y1, hd), P(hw, y1, -hd), P(-hw, y1, -hd), [0, 1, 0], top ?? cl);
    if (bottom) this.quad(P(-hw, y0, -hd), P(hw, y0, -hd), P(hw, y0, hd), P(-hw, y0, hd), [0, -1, 0], cl);
    this.quad(P(-hw, y0, hd), P(hw, y0, hd), P(hw, y1, hd), P(-hw, y1, hd), N(0, 1), cl);
    this.quad(P(hw, y0, -hd), P(-hw, y0, -hd), P(-hw, y1, -hd), P(hw, y1, -hd), N(0, -1), cl);
    this.quad(P(hw, y0, hd), P(hw, y0, -hd), P(hw, y1, -hd), P(hw, y1, hd), N(1, 0), cl);
    this.quad(P(-hw, y0, -hd), P(-hw, y0, hd), P(-hw, y1, hd), P(-hw, y1, -hd), N(-1, 0), cl);
  }
  /** box between two points (a beam / a segment of a jetty), width w, from y0 to y0 + h */
  beam(x0: number, z0: number, x1: number, z1: number, y0: number, h: number, w: number, cl: THREE.Color, top?: THREE.Color) {
    const L = Math.hypot(x1 - x0, z1 - z0);
    this.box((x0 + x1) / 2, y0, (z0 + z1) / 2, L, h, w, Math.atan2(-(z1 - z0), x1 - x0), cl, top);
  }
  /** flat quad strip along a segment (ground markings), at height y */
  flat(x0: number, z0: number, x1: number, z1: number, w: number, y: number, cl: THREE.Color) {
    const L = Math.hypot(x1 - x0, z1 - z0) || 1, nx = (-(z1 - z0) / L) * (w / 2), nz = ((x1 - x0) / L) * (w / 2);
    this.quad([x0 + nx, y, z0 + nz], [x1 + nx, y, z1 + nz], [x1 - nx, y, z1 - nz], [x0 - nx, y, z0 - nz], [0, 1, 0], cl);
  }
  /** vertical cylinder (n sides) */
  cyl(x: number, y0: number, z: number, r0: number, r1: number, h: number, n: number, cl: THREE.Color, top?: THREE.Color) {
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      this.quad([x + Math.cos(a0) * r0, y0, z + Math.sin(a0) * r0], [x + Math.cos(a0) * r1, y0 + h, z + Math.sin(a0) * r1],
        [x + Math.cos(a1) * r1, y0 + h, z + Math.sin(a1) * r1], [x + Math.cos(a1) * r0, y0, z + Math.sin(a1) * r0], [Math.cos(am), 0, Math.sin(am)], cl);
      this.quad([x, y0 + h, z], [x, y0 + h, z], [x + Math.cos(a1) * r1, y0 + h, z + Math.sin(a1) * r1], [x + Math.cos(a0) * r1, y0 + h, z + Math.sin(a0) * r1], [0, 1, 0], top ?? cl);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
const C = (h: string) => new THREE.Color(h);

/** Washingtonia palm crown (unit: ~3.4 m radius, sits at the top of the trunk): drooping fronds with dark bases, a skirt of
 *  dry fronds under it. Vertex colours (multiplied by the instance colour). */
export function palmCrown(lo = false) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const r = rng(9), F = lo ? 7 : 11, S = lo ? 2 : 3;
  const dark = C("#3F5A2C"), light = C("#7E9A4E"), dry = C("#8A7552");
  const push = (x: number, y: number, z: number, c: THREE.Color) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); return pos.length / 3 - 1; };
  for (let f = 0; f < F; f++) {
    const a = (f / F) * Math.PI * 2 + r() * 0.3, len = 3.0 + r() * 0.8, up = 0.6 + r() * 0.5, droop = 1.6 + r() * 0.6;
    const ca = Math.cos(a), sa = Math.sin(a);
    let prev: [number, number] | null = null;
    for (let k = 0; k <= S; k++) {
      const t = k / S, rad = len * t, y = up * t - droop * t * t, w = (0.62 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 0.06);
      const c = dark.clone().lerp(light, t * 0.9);
      const cx = ca * rad, cz = sa * rad, px = -sa * w, pz = ca * w;
      const i0 = push(cx + px, y + 0.06 * t, cz + pz, c), i1 = push(cx - px, y + 0.06 * t, cz - pz, c);
      if (prev) { idx.push(prev[0], i0, prev[1], prev[1], i0, i1); }
      prev = [i0, i1];
    }
  }
  // dry skirt: a short cone of hanging dead fronds
  const base = pos.length / 3;
  if (!lo) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; push(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55, dry); push(Math.cos(a) * 0.38, -1.3, Math.sin(a) * 0.38, dry.clone().multiplyScalar(0.8)); }
  if (!lo) for (let k = 0; k < 8; k++) { const a = base + k * 2, b = base + ((k + 1) % 8) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** leafy tree crown: a subdivided icosahedron, lumpy, lighter on top (vertex colours); unit radius, centre at the origin */
export function treeCrown(detail = 1) {
  const g0 = new THREE.IcosahedronGeometry(1, detail);
  g0.deleteAttribute("normal"); g0.deleteAttribute("uv");
  const g = mergeVertices(g0); g0.dispose();
  const p = g.attributes.position as THREE.BufferAttribute, col = new Float32Array(p.count * 3), r = rng(3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = 0.84 + 0.22 * (0.5 + 0.5 * Math.sin(x * 4.1 + y * 2.3) * Math.cos(z * 3.7 - y)) + r() * 0.08;
    p.setXYZ(i, x * s, y * s * 0.86, z * s);
    const t = 0.72 + 0.34 * (y * 0.5 + 0.5);
    col.set([t, t, t], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** neighbourhood minaret (unit side 1, unit height 1): white shaft, green zellige band, crenellated gallery, lantern, green cap */
export function minaretGeometry() {
  const b = new Boxes(), white = C("#EEE9DE"), cream = C("#E3D9C3"), green = C("#2F7A5E"), gold = C("#C9A54A");
  b.box(0, 0, 0, 1, 0.8, 1, 0, white);
  b.box(0, 0.62, 0, 1.03, 0.1, 1.03, 0, green);           // zellige band
  b.box(0, 0.8, 0, 1.08, 0.025, 1.08, 0, cream);          // gallery floor
  for (let k = 0; k < 4; k++) for (const sd of [-1, 1]) {   // merlons
    const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), o = 0.5 * sd * 0.6;
    b.box(c * 0.5 + -s * o, 0.825, s * 0.5 + c * o, 0.14, 0.04, 0.14, 0, white);
  }
  b.box(0, 0.825, 0, 0.46, 0.12, 0.46, 0, white);         // lantern
  b.box(0, 0.9, 0, 0.47, 0.03, 0.47, 0, green);
  // pyramid cap
  const o = b.pos.length / 3, y0 = 0.945, y1 = 1.0, h = 0.25;
  b.pos.push(-h, y0, -h, h, y0, -h, h, y0, h, -h, y0, h, 0, y1, 0);
  for (let k = 0; k < 5; k++) { b.nor.push(0, 1, 0); b.col.push(green.r, green.g, green.b); }
  b.idx.push(o, o + 4, o + 1, o + 1, o + 4, o + 2, o + 2, o + 4, o + 3, o + 3, o + 4, o);
  b.box(0, 1.0, 0, 0.03, 0.05, 0.03, 0, gold);            // jamour finial
  const g = b.geometry();
  g.computeVertexNormals();
  return g;
}

/** green tiled hip roof (unit footprint 1 × 1, unit height), ridge along x; uv in tiles (~8 courses) */
export function hipRoof() {
  const pos = [-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, -0.22, 1, 0, 0.22, 1, 0];
  const idx = [0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0];
  const g = new THREE.BufferGeometry();
  const P: number[] = [], U: number[] = [];
  for (let i = 0; i < idx.length; i++) { const k = idx[i]; P.push(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]); U.push((pos[k * 3] + pos[k * 3 + 2]) * 8, pos[k * 3 + 1] * 6); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals();
  return g;
}

/** a rooftop laundry line: two posts, a line, five pieces of washing in bright colours (unit ≈ 4 m long) */
export function laundryGeometry() {
  const b = new Boxes(), post = C("#9A9A96"), cloth = ["#E9E6DE", "#C8473B", "#3F6FB5", "#E2B544", "#5E9A62", "#D98AA8"].map(C), r = rng(17);
  b.box(-2, 0, 0, 0.06, 1.8, 0.06, 0, post); b.box(2, 0, 0, 0.06, 1.8, 0.06, 0, post);
  const quad = (x0: number, x1: number, y0: number, y1: number, cl: THREE.Color) => {
    const o = b.pos.length / 3;
    b.pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0);
    for (let k = 0; k < 4; k++) { b.nor.push(0, 0, 1); b.col.push(cl.r, cl.g, cl.b); }
    b.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  quad(-2, 2, 1.71, 1.73, post);
  for (let k = 0; k < 5; k++) { const w = 0.45 + r() * 0.35, h = 0.5 + r() * 0.5, x = -1.5 + k * 0.75; quad(x - w / 2, x + w / 2, 1.7 - h, 1.7, cloth[Math.floor(r() * cloth.length)]); }
  return b.geometry();
}
