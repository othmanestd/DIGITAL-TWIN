"use client";
// The floors of Anfa Prime Hospital, built like the hôpital type's: its department furniture builders, its people
// (hospital/People, the shared human kit) and its tinted department zones, laid out in the clinic's two pill-shaped
// volumes (lib/hospital.ts AP_DEPTS → hospital/layout.ts AP_LAYOUTS). Opening a floor, a department or a person of the
// clinic shows the floors as glass boxes, that floor furnished and peopled, lifts the floors above it away (exploded view)
// and fades the landmark's shell (AP_VIEW, read by AnfaPrime.tsx). Department chips float over the open floor.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { AP_FAC, DEPT, FLOOR_H, KIND_COLOR, type BId, type Dept } from "@/lib/hospital";
import { useApp, type Sel } from "@/lib/store";
import { rig } from "@/lib/rig";
import { AP_LAYOUTS, type FloorLayout, type Part } from "../../hospital/layout";
import { GEO, makeFloorMats, rt, setFloorOpacity } from "../../hospital/mats";
import People from "../../hospital/People";
import { focusOf, isHidden } from "../../hospital/nav";
import { GeoHtml } from "../../geo/GeoHtml";
import { ANFA_PRIME } from "../geography";

/** Open floor of the clinic (null = none) and how far its interiors are shown (0 … 1, eased); written every frame. */
export const AP_VIEW = { open: null as string | null, fade: 0 };

/** The clinic's floor a selection opens (a floor, department or person of Anfa Prime), else null. */
export function apOpenKey(sel: Sel): string | null {
  if (!sel) return null;
  if (sel.kind === "floor") return sel.id.startsWith("ap.") ? sel.id : null;
  if (sel.kind !== "dept" && sel.kind !== "person") return null;
  const f = focusOf(sel);
  return f.dept && DEPT[f.dept]?.fac === AP_FAC ? f.floor : null;
}
/** Is this selection inside Anfa Prime (so the hôpital type's camera flights must leave it alone)? */
export const inAnfaPrime = (sel: Sel) => apOpenKey(sel) !== null;

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
function Inst({ geo, mat, parts }: { geo: THREE.BufferGeometry; mat: THREE.Material; parts: Part[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    parts.forEach((p, i) => {
      _q.setFromEuler(_e.set(p.pitch ?? 0, p.yaw, 0, "YXZ"));
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(p.sx, p.sy, p.sz));
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[geo, mat, parts.length]} receiveShadow raycast={() => null} />;
}

function ApFloor({ fl }: { fl: FloorLayout<BId> }) {
  const select = useApp((s) => s.select);
  const mats = useMemo(() => makeFloorMats(fl.floor === 0 ? "main-ground" : "annex"), [fl]);
  const zones = useMemo(() => fl.depts.map((d) => ({ d, mat: new THREE.MeshStandardMaterial({ color: new THREE.Color("#F1F2F6").lerp(new THREE.Color(KIND_COLOR[d.kind]), 0.2), roughness: 0.95 }) })), [fl]);
  const all = useMemo(() => {
    for (const z of zones) { z.mat.userData.baseOpacity = 1; z.mat.userData.baseTransparent = false; z.mat.userData.baseDepthWrite = true; }
    return [...mats.all, ...zones.map((z) => z.mat)];
  }, [mats, zones]);
  useEffect(() => () => { all.forEach((m) => m.dispose()); }, [all]);
  const groups = useMemo(() => {
    const map = new Map<string, Part[]>();
    for (const p of fl.parts) { const k = p.g + "|" + p.m; if (!map.has(k)) map.set(k, []); map.get(k)!.push(p); }
    return [...map.entries()];
  }, [fl]);
  const group = useRef<THREE.Group>(null), content = useRef<THREE.Group>(null);
  const shown = useRef(false), open = useRef(false);
  const active = useMemo(() => () => shown.current, []);
  const H = FLOOR_H - 0.36, baseY = fl.floor * FLOOR_H;
  const slabMats = useMemo(() => [mats.slabEdge, mats.slabEdge, mats.slabTop, mats.slabTop, mats.slabEdge, mats.slabEdge], [mats]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 4.2);
    const tgt = isHidden(fl.key, AP_VIEW.open) ? 1 : 0;
    const cur = rt.lift[fl.key] ?? tgt, nx = cur + (tgt - cur) * k;
    rt.lift[fl.key] = Math.abs(nx - tgt) < 0.002 ? tgt : nx;
    const h = rt.lift[fl.key], e = h * h * (3 - 2 * h);
    g.position.y = baseY + e * 11;
    const op = AP_VIEW.fade * (1 - e);
    g.visible = op > 0.01;
    open.current = fl.key === AP_VIEW.open;
    shown.current = g.visible && open.current;
    if (content.current) content.current.visible = open.current;
    mats.glass.userData.baseOpacity = open.current ? 0.04 : 0.42;
    setFloorOpacity(all, op);
  });

  const stop = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); rt.clickHandled = true; };
  const clickFloor = (e: ThreeEvent<MouseEvent>) => { if (!group.current?.visible || open.current || e.delta > 6) return; stop(e); select({ kind: "floor", id: fl.key }); };
  const clickZone = (d: Dept) => (e: ThreeEvent<MouseEvent>) => { if (!shown.current || e.delta > 6) return; stop(e); select({ kind: "dept", id: d.id }); };
  const over = () => { if (group.current?.visible) document.body.style.cursor = "pointer"; };
  const out = () => { document.body.style.cursor = ""; };

  return (
    <group ref={group} position={[fl.ox, baseY, fl.oz]}>
      <mesh position={[0, -0.18, 0]} material={slabMats} receiveShadow onClick={clickFloor}><boxGeometry args={[fl.w + 0.3, 0.36, fl.d + 0.3]} /></mesh>
      <mesh position={[0, H / 2, 0]} material={mats.glass} renderOrder={1} onClick={clickFloor} onPointerOver={over} onPointerOut={out}><boxGeometry args={[fl.w + 0.1, H, fl.d + 0.1]} /></mesh>
      {zones.map(({ d, mat }) => (
        <mesh key={d.id} position={[d.rect[0], 0.012, d.rect[1]]} rotation-x={-Math.PI / 2} material={mat} receiveShadow onClick={clickZone(d)} onPointerOver={over} onPointerOut={out}>
          <planeGeometry args={[d.rect[2], d.rect[3]]} />
        </mesh>
      ))}
      <group ref={content} visible={false}>
        {groups.map(([k, parts]) => { const [g, m] = k.split("|") as [Part["g"], Part["m"]]; return <Inst key={k} geo={GEO[g]} mat={mats.parts[m]} parts={parts} />; })}
        <People fl={fl as FloorLayout} mats={mats} group={group} active={active} />
      </group>
    </group>
  );
}

/** Chips over the departments of the open floor (short name, number of use cases reused from the hôpital type). */
function Chips({ open }: { open: string | null }) {
  const select = useApp((s) => s.select);
  const fl = open ? AP_LAYOUTS.find((f) => f.key === open) : undefined;
  if (!fl) return null;
  return (
    <>
      {fl.depts.map((d) => (
        <GeoHtml key={d.id} position={[fl.ox + d.rect[0], fl.floor * FLOOR_H + 3.6, fl.oz + d.rect[1]]} center zIndex={6}>
          <button type="button" data-anchor={`dept:${d.id}`} onClick={() => { rt.clickHandled = true; select({ kind: "dept", id: d.id }); }}
            className="pointer-events-auto whitespace-nowrap rounded-full bg-[#0B1020]/85 px-3 py-1 text-[12px] font-medium text-white ring-1 ring-white/15 backdrop-blur hover:bg-[#1DB4EA] hover:text-[#04121c]">
            {d.short}{d.cases.length ? <span className="ml-1.5 rounded-full bg-white/15 px-1.5 text-[11px]">{d.cases.length}</span> : null}
          </button>
        </GeoHtml>
      ))}
    </>
  );
}

export function AnfaPrimeFloors() {
  const sel = useApp((s) => s.sel);
  const nonce = useApp((s) => s.focusNonce);
  const open = apOpenKey(sel);
  const armed = useRef(false);
  if (open) armed.current = true; // mount the floors the first time the clinic is opened, then keep them

  useFrame((_, dt) => {
    AP_VIEW.open = apOpenKey(useApp.getState().sel);
    const t = AP_VIEW.open ? 1 : 0;
    AP_VIEW.fade += (t - AP_VIEW.fade) * (1 - Math.exp(-Math.min(dt, 0.25) * 4));
    if (Math.abs(AP_VIEW.fade - t) < 0.002) AP_VIEW.fade = t;
  });

  // camera flights for the clinic's floors and departments (the hôpital type's FocusFlights leave them alone)
  useEffect(() => {
    const s = useApp.getState().sel, key = apOpenKey(s);
    if (!key || !s) return;
    const fl = AP_LAYOUTS.find((f) => f.key === key);
    if (!fl) return;
    const d = s.kind === "dept" ? DEPT[s.id] : s.kind === "person" ? DEPT[s.id.split("/")[0]] : undefined;
    const x = ANFA_PRIME.x + fl.ox + (d ? d.rect[0] : 0), z = ANFA_PRIME.z + fl.oz + (d ? d.rect[1] : 0);
    rig.flyTo(new THREE.Vector3(x, fl.floor * FLOOR_H + 1, z), d ? 30 : 46, { azimuth: 0.35, polar: 0.92 });
    rt.userMoved = false;
  }, [nonce]);

  if (!armed.current) return null;
  return (
    <>
      {AP_LAYOUTS.map((fl) => <ApFloor key={fl.key} fl={fl} />)}
      <Chips open={open} />
    </>
  );
}
