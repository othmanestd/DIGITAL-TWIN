"use client";
// One floor's props: follows the floor exactly like Floor.tsx does (lift of the exploded view, fade, walk-mode cut-away),
// is drawn only when the floor's furnished interior is (open floor, camera within 120 m, or near the walking visitor),
// and shows its wall-mounted layer only in first person on that floor (when the partitions rise to the ceiling).
// Static parts: one merged mesh per material and layer. Parts that fold (twin room years, desks of posts not replaced):
// instanced, recomputed only while they move.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FLOOR_H, MAIN, ANNEX } from "@/lib/hospital";
import { useApp } from "@/lib/store";
import { visualStage } from "@/lib/model";
import { rt, setFloorOpacity } from "../mats";
import { focusOf } from "../nav";
import { W, floorCut } from "../../walk/state";
import type { Mat, PP } from "./kit";
import { mergeParts, dynKey, instanceGeometry } from "./geo";
import { printAtlas, screenAtlas } from "./tex";
import { propsOf, type FloorProps as FP } from "./rooms";
import Crowd from "./Crowd";

const MATS: Mat[] = ["matte", "satin", "metal", "glass", "glow", "print", "screen"];
export type PropMats = Record<Mat, THREE.Material> & { all: THREE.Material[]; figure: THREE.MeshStandardMaterial };

function makeMats(): PropMats {
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  const m = {
    matte: std({ roughness: 0.86 }),
    satin: std({ roughness: 0.5, metalness: 0.04 }),
    metal: std({ roughness: 0.36, metalness: 0.45 }),
    glass: std({ roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.34, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    print: std({ roughness: 0.78, map: printAtlas() }),
    screen: std({ color: "#000000", roughness: 0.32, emissive: "#FFFFFF", emissiveMap: screenAtlas(), emissiveIntensity: 0.88 }),
    figure: new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.78 }),
  } as unknown as PropMats;
  m.all = [...MATS.map((k) => m[k]), m.figure];
  for (const x of m.all) { x.userData.baseOpacity = x.opacity; x.userData.baseTransparent = x.transparent; x.userData.baseDepthWrite = x.depthWrite; }
  return m;
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const deskFold = (pr: number) => smooth((pr - 0.2) / 0.5);
const fpHere = (b: string, f: number) => W.phase === "on" && !W.third && !W.tower && W.where === b && W.level === f;

/** Dev / QA: bumping SNAP.n settles every timeline transition at once (window.__props.snap()). */
export const SNAP = { n: 0 };
/** Timeline state shared by the dynamic parts of a floor: year, its visual stage (lib/model visualStage), when it changed. */
export type YearClock = { year: number; stage: number; at: number; t: number };

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function DynInst({ parts, mat, clock, shadow }: { parts: PP[]; mat: THREE.Material; clock: YearClock; shadow: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => instanceGeometry(dynKey(parts[0]), parts[0]), [parts]);
  const st = useMemo(() => {
    const bit = 1 << clock.stage;
    return {
      pres: Float32Array.from(parts.map((p) => (p.yr === undefined || p.yr & bit ? 1 : 0))),
      delay: Float32Array.from(parts.map((p) => (p.item % 28) * 0.032)),
      deskVer: -1, dirty: true, snap: SNAP.n,
    };
  }, [parts, clock]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    parts.forEach((p, i) => m.setColorAt(i, _c.setHex(p.c)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.boundingSphere = null;
    st.dirty = true;
  }, [parts, st]);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m || !m.parent?.visible) return;
    const bit = 1 << clock.stage;
    const snap = st.snap !== SNAP.n;
    st.snap = SNAP.n;
    const since = snap ? 99 : clock.t - clock.at, step = snap ? 1 : Math.min(dt, 0.1) / 0.95;
    let dirty = st.dirty;
    if (parts[0].desk !== undefined && st.deskVer !== rt.deskVer) { st.deskVer = rt.deskVer; dirty = true; }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p.yr === undefined) continue;
      const tgt = p.yr & bit ? 1 : 0, cur = st.pres[i];
      if (cur === tgt || since < st.delay[i]) continue;
      st.pres[i] = Math.abs(tgt - cur) <= step ? tgt : cur + Math.sign(tgt - cur) * step;
      dirty = true;
    }
    if (!dirty) return;
    st.dirty = false;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      let f = smooth(st.pres[i]);
      if (p.desk !== undefined) f *= deskFold(rt.desk.get(p.desk) ?? 1);
      if (f < 0.01) { m.setMatrixAt(i, ZERO); continue; }
      const k = 0.5 + 0.5 * f;
      _q.setFromEuler(_e.set(p.pitch, p.yaw, p.roll, "YXZ"));
      _m.compose(_v.set(p.ax + (p.x - p.ax) * k, p.y * f, p.az + (p.z - p.az) * k), _q,
        _s.set(p.sx * k, (p.g === "hemi" ? p.sy * 2 : p.sy) * f, p.g === "quad" || p.g === "disc" ? 1 : p.sz * k));
      m.setMatrixAt(i, _m);
    }
    m.instanceMatrix.needsUpdate = true;
    if (!m.boundingSphere) m.computeBoundingSphere();
  });
  return <instancedMesh ref={ref} args={[geo, mat, parts.length]} castShadow={shadow} receiveShadow />;
}

/** fp: the floor (key, building, floor); its props are generated the first time the floor's interior is drawn. */
export default function FloorProps({ fp, children }: { fp: { key: string; building: "main" | "annex"; floor: number }; children?: (mats: PropMats, clock: YearClock) => ReactNode }) {
  const mats = useMemo(makeMats, []);
  useEffect(() => () => { mats.all.forEach((m) => m.dispose()); }, [mats]);
  const group = useRef<THREE.Group>(null), inner = useRef<THREE.Group>(null), hiRef = useRef<THREE.Group>(null);
  const baseY = fp.floor * FLOOR_H;
  const plate = useMemo(() => { const B = fp.building === "main" ? MAIN : ANNEX; return { ox: B.x, oz: B.z, w: B.w, d: B.d }; }, [fp.building]);

  // ---------- geometry, built lazily the first time the floor's interior is drawn
  const built = useRef(false);
  const [geoms, setGeoms] = useGeoms();
  const year = useApp((s) => s.year);
  const clock = useMemo<YearClock>(() => ({ year, stage: visualStage(year), at: -10, t: 0 }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (clock.year === year) return;
    const s = visualStage(year);
    clock.year = year;
    if (s !== clock.stage) { clock.stage = s; clock.at = clock.t; }
  }, [year, clock]);

  const sel = useApp((s) => s.sel);
  const walkPhase = useApp((s) => s.walk.phase);
  const openKey = walkPhase !== "off" ? null : focusOf(sel).floor;
  const openRef = useRef(false);
  openRef.current = openKey === fp.key;
  const camera = useThree((s) => s.camera);
  const st = useRef({ cut: 0, op: -1, hi: 0, here: false, shadowed: null as boolean | null });

  useFrame((_, dt) => {
    clock.t += Math.min(dt, 0.25);
    const g = group.current;
    if (!g) return;
    const h = rt.lift[fp.key] ?? 0;
    const walkOn = W.phase === "on";
    const cutT = walkOn && floorCut(fp.building, fp.floor) ? 1 : 0;
    const s = st.current;
    s.cut += (cutT - s.cut) * (1 - Math.exp(-Math.min(dt, 0.25) * 10));
    if (Math.abs(s.cut - cutT) < 0.004) s.cut = cutT;
    const e = Math.max(smooth(h), s.cut);
    g.position.set(plate.ox, baseY + smooth(h) * 11, plate.oz);
    let vis = e < 0.985;
    if (vis) {
      if (walkOn) {
        const dx = Math.max(0, Math.abs(W.x - plate.ox) - plate.w / 2), dz = Math.max(0, Math.abs(W.z - plate.oz) - plate.d / 2);
        const dy = Math.max(0, baseY - (W.y + 1.2), W.y + 1.2 - (baseY + FLOOR_H));
        vis = dx * dx + dy * dy + dz * dz < 26 * 26;
      } else {
        g.getWorldPosition(_v);
        vis = openRef.current || camera.position.distanceTo(_v) < 120;
      }
    }
    g.visible = vis;
    if (!vis) return;
    if (!built.current) { built.current = true; const full = propsOf(fp.key); if (full) setGeoms(full); }
    const op = 1 - e;
    if (Math.abs(op - s.op) > 0.002) { s.op = op; setFloorOpacity(mats.all, op); }
    // wall-mounted layer: first person on this floor, with the partitions raised
    const want = fpHere(fp.building, fp.floor) ? 1 : 0;
    s.hi += (want - s.hi) * (1 - Math.exp(-Math.min(dt, 0.1) * 7));
    if (hiRef.current) hiRef.current.visible = s.hi > 0.6;
    // calm signs of life: LEDs and light strips breathe
    const t = clock.t;
    (mats.glow as THREE.MeshBasicMaterial).color.setScalar(0.78 + 0.22 * Math.sin(t * 2.1 + fp.floor));
    // shadows only on the floor in focus (open, or where the visitor walks), like the furniture
    const walkKey = walkOn && W.where && !W.tower ? `${W.where}:${W.level}` : null;
    const here = openRef.current || walkKey === fp.key;
    if (s.shadowed !== here && inner.current) {
      s.shadowed = here;
      inner.current.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) o.castShadow = here; });
    }
  });

  return (
    <group ref={group} visible={false}>
      <group ref={inner}>
        {geoms && geoms.base.map(([m, g]) => <mesh key={"b" + m} geometry={g} material={mats[m]} receiveShadow userData={{ noShadow: m === "glow" || m === "glass" }} />)}
        <group ref={hiRef} visible={false}>
          {geoms && geoms.hi.map(([m, g]) => <mesh key={"h" + m} geometry={g} material={mats[m]} userData={{ noShadow: true }} />)}
          {geoms && geoms.dynHi.map(([k, parts]) => <DynInst key={k} parts={parts} mat={mats[parts[0].m]} clock={clock} shadow={false} />)}
        </group>
        {geoms && geoms.dyn.map(([k, parts]) => <DynInst key={k} parts={parts} mat={mats[parts[0].m]} clock={clock} shadow={parts[0].m !== "glow" && parts[0].m !== "glass"} />)}
        {geoms && <Crowd spec={geoms.crowd} mats={mats} building={fp.building} floor={fp.floor} />}
        {geoms && children?.(mats, clock)}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- lazy geometry state
type Geoms = { base: [Mat, THREE.BufferGeometry][]; hi: [Mat, THREE.BufferGeometry][]; dyn: [string, PP[]][]; dynHi: [string, PP[]][]; crowd: FP["crowd"] };
function useGeoms(): [Geoms | null, (fp: FP) => void] {
  const [g, set] = useState<Geoms | null>(null);
  useEffect(() => () => { g?.base.forEach(([, x]) => x.dispose()); g?.hi.forEach(([, x]) => x.dispose()); }, [g]);
  const build = (fp: FP) => {
    const base: [Mat, THREE.BufferGeometry][] = [], hi: [Mat, THREE.BufferGeometry][] = [];
    const stat = fp.kit.parts.filter((p) => p.yr === undefined && p.desk === undefined);
    for (const m of MATS) {
      const b = mergeParts(stat.filter((p) => p.m === m && !p.hi));
      if (b) base.push([m, b]);
      const h = mergeParts(stat.filter((p) => p.m === m && p.hi));
      if (h) hi.push([m, h]);
    }
    const map = new Map<string, PP[]>(), mapHi = new Map<string, PP[]>();
    for (const p of fp.kit.parts) {
      if (p.yr === undefined && p.desk === undefined) continue;
      const k = dynKey(p) + (p.desk !== undefined ? "#d" : "#y");
      const into = p.hi ? mapHi : map;
      if (!into.has(k)) into.set(k, []);
      into.get(k)!.push(p);
    }
    set({ base, hi, dyn: [...map.entries()], dynHi: [...mapHi.entries()], crowd: fp.crowd });
  };
  return [g, build];
}
