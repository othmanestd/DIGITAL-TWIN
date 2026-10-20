// Selection → what the 3D scene shows: which floor is open, which department and person are in focus.
import * as THREE from "three";
import { CASE_DEPT, DEPT, FLOOR_H, MAIN, ANNEX, XP } from "@/lib/hospital";
import type { Sel } from "@/lib/store";
import { rt } from "./mats";

export type Focus = { floor: string | null; dept: string | null; person: string | null };

export function focusOf(sel: Sel): Focus {
  if (!sel) return { floor: null, dept: null, person: null };
  if (sel.kind === "floor") return { floor: sel.id, dept: null, person: null };
  let dept: string | null = null, person: string | null = null;
  if (sel.kind === "dept") dept = sel.id;
  else if (sel.kind === "person") { person = sel.id; dept = sel.id.split("/")[0]; }
  else if (sel.kind === "case") dept = CASE_DEPT[sel.id] ?? null;
  else if (sel.kind === "xp") dept = XP[sel.id]?.dept ?? null;
  const d = dept ? DEPT[dept] : null;
  if (!d) return { floor: null, dept: null, person: null };
  return { floor: `${d.building}:${d.floor}`, dept: d.id, person };
}

/** Is floor `key` ("main:2", roof = "main:4") lifted away because a lower floor of the same building is open? */
export function isHidden(key: string, open: string | null) {
  if (!open) return false;
  const [b, f] = key.split(":");
  const [ob, of] = open.split(":");
  return b === ob && Number(f) > Number(of);
}

export const bld = (b: "main" | "annex") => (b === "main" ? MAIN : ANNEX);

/** World-space centre of a floor plate (surface level). */
export function floorCenter(key: string, out = new THREE.Vector3()) {
  const [b, f] = key.split(":");
  const B = bld(b as "main" | "annex");
  return out.set(B.x, Number(f) * FLOOR_H, B.z);
}

export function deptCenter(id: string, out = new THREE.Vector3()) {
  const d = DEPT[id];
  const B = bld(d.building);
  return out.set(B.x + d.rect[0], d.floor * FLOOR_H, B.z + d.rect[1]);
}

/** Expected aspect of the stage once the side panel has finished opening/closing (mirrors AtlasApp's layout rule). */
export function stageAspect(panelOpen: boolean, fallback: number) {
  if (typeof window === "undefined") return fallback;
  const W = window.innerWidth, H = window.innerHeight;
  const pw = panelOpen ? Math.min(780, Math.max(520, 0.39 * W)) : 0;
  return H > 0 ? (W - pw) / H : fallback;
}

/** Camera position that frames an axis-aligned box seen along `dir` (from target toward camera). */
export function fitPosition(center: THREE.Vector3, half: THREE.Vector3, dir: THREE.Vector3, fovDeg: number, aspect: number, margin = 1.2) {
  const d = dir.clone().normalize();
  const fwd = d.clone().negate();
  const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
  const up = new THREE.Vector3().crossVectors(right, fwd).normalize();
  const proj = (a: THREE.Vector3) => Math.abs(a.x) * half.x + Math.abs(a.y) * half.y + Math.abs(a.z) * half.z;
  const ex = proj(right), ey = proj(up), ez = proj(fwd);
  const tv = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2), th = tv * aspect;
  const dist = Math.max(ex / th, ey / tv) * margin + ez;
  return center.clone().addScaledVector(d, dist);
}

/** Offset of the campus group inside HospitalContent (building frame → content frame). HospitalContent re-exports it. */
export const CAMPUS_OFFSET = new THREE.Vector3(-14, 0, -5);
/** The campus group, only if it is really attached to the scene (a stale or missing ref must never shift labels/flights). */
function liveRoot(): THREE.Object3D | null {
  let o = rt.root;
  if (!o) return null;
  while (o.parent) o = o.parent;
  return (o as THREE.Object3D & { isScene?: boolean }).isScene ? rt.root : null;
}
/** Building-frame coordinates (lib/hospital) → world, through the campus group; falls back to the known campus offset
 *  (the hospital content sits at the world origin in the unified scene). */
export function toWorld(v: THREE.Vector3) {
  const r = liveRoot();
  if (r) { r.updateWorldMatrix(true, false); r.localToWorld(v); } else v.add(CAMPUS_OFFSET);
  return v;
}
export function toLocal(v: THREE.Vector3) {
  const r = liveRoot();
  if (r) { r.updateWorldMatrix(true, false); r.worldToLocal(v); } else v.sub(CAMPUS_OFFSET);
  return v;
}
