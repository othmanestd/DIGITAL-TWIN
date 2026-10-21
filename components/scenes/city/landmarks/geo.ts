// Geometry helpers for the landmarks: boxes, frusta and lofted shells with world-metre UVs (so a texture keeps its real size
// whatever the building), merged per material. Every geometry is indexed and carries position / normal / uv only.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export type G = THREE.BufferGeometry;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

/** Transform a geometry in place (position, yaw about +Y, optional pitch about +X before yaw, uniform or per-axis scale). */
export function xf(g: G, x = 0, y = 0, z = 0, yaw = 0, o: { sx?: number; sy?: number; sz?: number; pitch?: number; roll?: number } = {}) {
  _e.set(o.pitch ?? 0, yaw, o.roll ?? 0, "YXZ");
  _m.compose(_v.set(x, y, z), _q.setFromEuler(_e), _s.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
  g.applyMatrix4(_m);
  return g;
}

/** Merge a list of geometries (same attribute set); null when empty. */
export function merge(list: G[]): G | null {
  if (!list.length) return null;
  const g = list.length === 1 ? list[0] : mergeGeometries(list, false);
  return g;
}

/** Box with world-metre UVs: u = span / tile[0], v = span / tile[1]. `snap` rounds the horizontal repeat to a whole number
 *  (≥ 1) so a pattern closes at the corners; `drop` removes faces (0 +x, 1 −x, 2 +y, 3 −y, 4 +z, 5 −z). Centre at (x, y0 + h/2, z). */
export function texBox(w: number, h: number, d: number, tile: [number, number], at: [number, number, number] = [0, 0, 0], o: { snap?: boolean; drop?: number[]; yaw?: number } = {}): G {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const spans: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    let ru = spans[f][0] / tile[0];
    if (o.snap && f !== 2 && f !== 3) ru = Math.max(1, Math.round(ru));
    const rv = spans[f][1] / tile[1];
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); }
  }
  if (o.drop?.length) {
    const idx = g.index!, keep: number[] = [];
    for (let f = 0; f < 6; f++) if (!o.drop.includes(f)) for (let k = 0; k < 6; k++) keep.push(idx.getX(f * 6 + k));
    g.setIndex(keep); g.clearGroups();
  }
  return xf(g, at[0], at[1] + h / 2, at[2], o.yaw ?? 0);
}

/** Frustum of a pyramid (rectangle base wB × dB at y0 to rectangle wT × dT at y0 + h, centre offset (ox, oz) at the top), flat
 *  shaded, UV in metres along the slope (v runs up the slope). cap adds the flat top. */
export function frustum(wB: number, dB: number, wT: number, dT: number, h: number, tile: [number, number], at: [number, number, number] = [0, 0, 0], o: { ox?: number; oz?: number; cap?: boolean } = {}): G {
  const ox = o.ox ?? 0, oz = o.oz ?? 0;
  const B = [[-wB / 2, -dB / 2], [wB / 2, -dB / 2], [wB / 2, dB / 2], [-wB / 2, dB / 2]];
  const T = [[ox - wT / 2, oz - dT / 2], [ox + wT / 2, oz - dT / 2], [ox + wT / 2, oz + dT / 2], [ox - wT / 2, oz + dT / 2]];
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], uu: number, vv: number) => {
    const o0 = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d);
    const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), ad = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const n = ab.cross(ad).normalize();
    for (let k = 0; k < 4; k++) nor.push(n.x, n.y, n.z);
    uvs.push(0, 0, uu / tile[0], 0, uu / tile[0], vv / tile[1], 0, vv / tile[1]);
    idx.push(o0, o0 + 1, o0 + 2, o0, o0 + 2, o0 + 3);
  };
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const a = [B[i][0], 0, B[i][1]], b = [B[j][0], 0, B[j][1]], c = [T[j][0], h, T[j][1]], d = [T[i][0], h, T[i][1]];
    // outward winding: (b − a) × (d − a) must point away from the centre
    const mid = [(a[0] + b[0]) / 2, (a[2] + b[2]) / 2];
    const n = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).cross(new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]));
    const out = n.x * mid[0] + n.z * mid[1] >= 0;
    const baseLen = Math.hypot(b[0] - a[0], b[2] - a[2]), slant = Math.hypot(h, Math.hypot((T[i][0] + T[j][0]) / 2 - mid[0], (T[i][1] + T[j][1]) / 2 - mid[1]));
    if (out) quad(a, b, c, d, baseLen, slant); else quad(b, a, d, c, baseLen, slant);
  }
  if (o.cap) {
    const t = [T[0], T[1], T[2], T[3]].map((p) => [p[0], h, p[1]]);
    quad(t[3], t[2], t[1], t[0], wT, dT);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return xf(g, at[0], at[1], at[2]);
}

export type Ring = { y: number; p: [number, number][] };
/** Lofted side shell between rings of the same point count (a closed polygon each, any winding), flat faces, UV in metres:
 *  u = along the edge (snapped to whole tiles), v = height. */
export function loft(rings: Ring[], tile: [number, number], at: [number, number, number] = [0, 0, 0], o: { snap?: boolean; cap?: boolean } = {}): G {
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];
  const n = rings[0].p.length;
  const cen = rings[0].p.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
  for (let k = 0; k < rings.length - 1; k++) {
    const A = rings[k], B = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const a = [A.p[i][0], A.y, A.p[i][1]], b = [A.p[j][0], A.y, A.p[j][1]], c = [B.p[j][0], B.y, B.p[j][1]], d = [B.p[i][0], B.y, B.p[i][1]];
      const nn = new THREE.Vector3(b[0] - a[0], 0, b[2] - a[2]).cross(new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2])).normalize();
      const flip = nn.x * ((a[0] + b[0]) / 2 - cen[0]) + nn.z * ((a[2] + b[2]) / 2 - cen[1]) < 0;
      if (flip) nn.negate();
      const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
      let ru = len / tile[0]; if (o.snap) ru = Math.max(1, Math.round(ru));
      const v0 = A.y / tile[1], v1 = B.y / tile[1];
      const o0 = pos.length / 3;
      pos.push(...a, ...b, ...c, ...d);
      for (let q = 0; q < 4; q++) nor.push(nn.x, nn.y, nn.z);
      uvs.push(0, v0, ru, v0, ru, v1, 0, v1);
      if (flip) idx.push(o0, o0 + 2, o0 + 1, o0, o0 + 3, o0 + 2); else idx.push(o0, o0 + 1, o0 + 2, o0, o0 + 2, o0 + 3);
    }
  }
  if (o.cap) {
    const T = rings[rings.length - 1], o0 = pos.length / 3;
    const c0 = T.p.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n], [0, 0]);
    pos.push(c0[0], T.y, c0[1]); nor.push(0, 1, 0); uvs.push(0.5, 0.5);
    T.p.forEach((p) => { pos.push(p[0], T.y, p[1]); nor.push(0, 1, 0); uvs.push(p[0] / tile[0], p[1] / tile[0]); });
    let area = 0; for (let i = 0; i < n; i++) { const p = T.p[i], q = T.p[(i + 1) % n]; area += p[0] * q[1] - q[0] * p[1]; }
    for (let i = 0; i < n; i++) { const a = o0 + 1 + i, b = o0 + 1 + ((i + 1) % n); if (area > 0) idx.push(o0, b, a); else idx.push(o0, a, b); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return xf(g, at[0], at[1], at[2]);
}

/** A rectangle with chamfered corners as a ring polygon (8 points), half sizes hx / hz, chamfer c, centre (cx, cz). */
export function chamfered(hx: number, hz: number, c: number, cx = 0, cz = 0, yaw = 0): [number, number][] {
  const p: [number, number][] = [[-hx + c, -hz], [hx - c, -hz], [hx, -hz + c], [hx, hz - c], [hx - c, hz], [-hx + c, hz], [-hx, hz - c], [-hx, -hz + c]];
  const s = Math.sin(yaw), co = Math.cos(yaw);
  return p.map(([x, z]) => [cx + x * co + z * s, cz - x * s + z * co]);
}

/** Cylinder / cone with UV scaled to metres (u around, v along the height). */
export function tube(rTop: number, rBot: number, h: number, seg: number, tile: [number, number], at: [number, number, number] = [0, 0, 0], yaw = 0): G {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1, false);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const circ = Math.PI * (rTop + rBot);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (circ / tile[0]), uv.getY(i) * (h / tile[1]));
  return xf(g, at[0], at[1] + h / 2, at[2], yaw);
}

/** Dispose of everything a React tree created for a landmark. */
export function disposeAll(items: ({ dispose: () => void } | null | undefined)[]) { for (const i of items) i?.dispose(); }

/** Horizontal rectangle w × d (facing +y) with world-metre UVs, centre (x, y, z). */
export function texFloor(w: number, d: number, tile: [number, number], at: [number, number, number] = [0, 0, 0], yaw = 0): G {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile[0]), uv.getY(i) * (d / tile[1]));
  return xf(g, at[0], at[1], at[2], yaw);
}

/** Vertical rectangle w × h facing +z (rotate with `yaw`), centre-bottom at (x, y, z); `snap` rounds the horizontal repeat. */
export function texWall(w: number, h: number, tile: [number, number], at: [number, number, number] = [0, 0, 0], yaw = 0, snap = true): G {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const ru = snap ? Math.max(1, Math.round(w / tile[0])) : w / tile[0];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * (h / tile[1]));
  return xf(g, at[0], at[1] + h / 2, at[2], yaw);
}

/** Arched window / niche (rectangle + half-cylinder top), facing +z, bottom-centre at the origin; depth d. */
export function archWindow(w: number, h: number, d: number): G {
  const r = w / 2, hb = Math.max(0.01, h - r);
  const a = new THREE.BoxGeometry(w, hb, d); a.translate(0, hb / 2, 0);
  const b = new THREE.CylinderGeometry(r, r, d, 14, 1, false, Math.PI / 2, Math.PI); b.rotateX(Math.PI / 2); b.translate(0, hb, 0);
  return mergeGeometries([a, b], false);
}
