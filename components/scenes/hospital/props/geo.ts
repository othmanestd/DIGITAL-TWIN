// Drawing side of the props kit: unit templates, per-floor merged geometry (static parts: one draw call per material
// and layer) and instanced groups (parts that fold with the timeline: twin room stages, desks of posts not replaced).
// Every template carries a white vertex colour so merged meshes (baked colours) and instanced meshes (instance colours)
// share the same vertexColors materials.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Mat, PP } from "./kit";
import { SCREEN_W, SCREEN_H } from "./atlas";

// a uniform patch of each atlas (screens without their own picture, box sides)
const PLAIN_SCREEN: [number, number] = [1008 / SCREEN_W, 1 - 1008 / SCREEN_H];

function white(g: THREE.BufferGeometry) {
  const n = g.attributes.position.count;
  g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.index) {
    const idx = new Uint32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
  }
  return g;
}

const cache = new Map<string, THREE.BufferGeometry>();
function segFor(p: PP) {
  const m = Math.max(p.sx, p.sz);
  return m < 0.09 ? 8 : m < 0.5 ? 14 : m < 1.4 ? 24 : 40;
}
/** template key of a part (geometry shape only) */
export function templateKey(p: PP) {
  switch (p.g) {
    case "cyl": return `cyl|${segFor(p)}`;
    case "cone": return `cone|${segFor(p)}|${(p.t ?? 1).toFixed(2)}`;
    case "sph": return Math.max(p.sx, p.sy) < 0.16 ? "sph|s" : "sph|m";
    case "torus": return `torus|${(p.t ?? 0.2).toFixed(3)}|${Math.max(p.sx, p.sy) > 1.2 ? 64 : 28}`;
    default: return p.g;
  }
}
export function template(key: string): THREE.BufferGeometry {
  const hit = cache.get(key);
  if (hit) return hit;
  const [g, a, b] = key.split("|");
  let geo: THREE.BufferGeometry;
  switch (g) {
    case "box": geo = new THREE.BoxGeometry(1, 1, 1); break;
    case "rbox": geo = new RoundedBoxGeometry(1, 1, 1, 1, 0.1); break;
    case "cyl": geo = new THREE.CylinderGeometry(0.5, 0.5, 1, Number(a)); break;
    case "cone": geo = new THREE.CylinderGeometry(0.5 * Number(b), 0.5, 1, Number(a)); break;
    case "sph": geo = a === "s" ? new THREE.SphereGeometry(0.5, 8, 6) : new THREE.SphereGeometry(0.5, 14, 10); break;
    case "hemi": geo = new THREE.SphereGeometry(0.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2); break;
    case "torus": { const t = Number(a); geo = new THREE.TorusGeometry(0.5 - 0.5 * t, 0.5 * t, 6, Number(b)); break; }
    case "disc": geo = new THREE.CircleGeometry(0.5, 28); break;
    default: geo = new THREE.PlaneGeometry(1, 1);
  }
  geo = white(geo);
  cache.set(key, geo);
  return geo;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
const _nm = new THREE.Matrix3(), _v = new THREE.Vector3(), _c = new THREE.Color();
export function partMatrix(p: PP, out = _m) {
  _q.setFromEuler(_e.set(p.pitch, p.yaw, p.roll, "YXZ"));
  // hemispheres are placed by their base
  return out.compose(_p.set(p.x, p.y, p.z), _q, _s.set(p.sx, p.g === "hemi" ? p.sy * 2 : p.sy, p.g === "quad" || p.g === "disc" ? 1 : p.sz));
}

/** UVs of a part: quads map their whole surface to the atlas rect; boxes map only their front (+z) face. */
function uvFor(p: PP, tpl: THREE.BufferGeometry, i: number, out: [number, number]) {
  const uv = tpl.attributes.uv;
  const u = uv.getX(i), v = uv.getY(i);
  if (p.uv && (p.g === "quad" || p.g === "disc")) { out[0] = p.uv[0] + (p.uv[2] - p.uv[0]) * u; out[1] = p.uv[1] + (p.uv[3] - p.uv[1]) * v; return; }
  if (p.uv && p.g === "box" && i >= 16 && i < 20) { out[0] = p.uv[0] + (p.uv[2] - p.uv[0]) * u; out[1] = p.uv[1] + (p.uv[3] - p.uv[1]) * v; return; }
  if (p.m === "screen") { out[0] = PLAIN_SCREEN[0]; out[1] = PLAIN_SCREEN[1]; return; }
  out[0] = u; out[1] = v;
}

/** Merge static parts into one indexed geometry (positions, normals, baked colours, atlas UVs). */
export function mergeParts(parts: PP[]): THREE.BufferGeometry | null {
  if (!parts.length) return null;
  let nv = 0, ni = 0;
  const tpls = parts.map((p) => { const t = template(templateKey(p)); nv += t.attributes.position.count; ni += t.index!.count; return t; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), uvs = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let ov = 0, oi = 0;
  const uvo: [number, number] = [0, 0];
  parts.forEach((p, k) => {
    const t = tpls[k];
    partMatrix(p, _m);
    _nm.getNormalMatrix(_m);
    _c.setHex(p.c);
    const P = t.attributes.position, N = t.attributes.normal, I = t.index!;
    for (let i = 0; i < P.count; i++) {
      _v.fromBufferAttribute(P, i).applyMatrix4(_m);
      pos[(ov + i) * 3] = _v.x; pos[(ov + i) * 3 + 1] = _v.y; pos[(ov + i) * 3 + 2] = _v.z;
      _v.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
      nor[(ov + i) * 3] = _v.x; nor[(ov + i) * 3 + 1] = _v.y; nor[(ov + i) * 3 + 2] = _v.z;
      col[(ov + i) * 3] = _c.r; col[(ov + i) * 3 + 1] = _c.g; col[(ov + i) * 3 + 2] = _c.b;
      uvFor(p, t, i, uvo);
      uvs[(ov + i) * 2] = uvo[0]; uvs[(ov + i) * 2 + 1] = uvo[1];
    }
    for (let i = 0; i < I.count; i++) idx[oi + i] = I.getX(i) + ov;
    ov += P.count; oi += I.count;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  return g;
}

/** Geometry of an instanced group: the template, with its UVs baked when the parts carry an atlas rect. */
export function instanceGeometry(key: string, sample: PP): THREE.BufferGeometry {
  const t = template(templateKey(sample));
  if (!sample.uv && sample.m !== "screen") return t;
  const g = t.clone();
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const o: [number, number] = [0, 0];
  for (let i = 0; i < uv.count; i++) { uvFor(sample, t, i, o); uv.setXY(i, o[0], o[1]); }
  void key;
  return g;
}
/** instanced grouping key: shape + material + atlas rect */
export const dynKey = (p: PP) => `${templateKey(p)}#${p.m}#${p.uv ? p.uv.map((v) => v.toFixed(4)).join(",") : p.m === "screen" ? "plain" : ""}`;

export type MatSet = Record<Mat, THREE.Material> & { all: THREE.Material[] };
