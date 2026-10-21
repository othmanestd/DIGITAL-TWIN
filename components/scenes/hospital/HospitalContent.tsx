"use client";
// The whole "typical Akdital hospital" scene graph — buildings, campus, departments, people, AI agents, labels,
// pointer interactions, anchors and selection-driven flights (through lib/rig) — with NO camera controls, no global
// lights / environment / background. 1 unit = 1 metre, ground at y = 0, campus centred on the local origin.
// Used by the unified "powers of ten" scene, and by the standalone HospitalScene wrapper.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FLOOR_H } from "@/lib/hospital";
import { yearProgress } from "@/lib/model";
import { useApp } from "@/lib/store";
import { FLOOR_LAYOUTS, PERSON_BY_ID } from "./layout";
import { PAL, rt, tickEcg } from "./mats";
import { focusOf, CAMPUS_OFFSET, toLocal } from "./nav";
import Floor from "./Floor";
import { Roof, Site, Skybridge } from "./Site";
import { THREE_STATE } from "./People";
import Overlay from "./Overlay";
import { FocusFlights } from "./Focus";
import TimeTravel from "./TimeTravel";
import { SensorNet } from "./Twin";
import { StairTowers } from "./StairTower";
import { HospitalProps } from "./props";
import StoryStage from "../story/StoryStage";

/** Offset applied inside HospitalContent so that the campus (building frame of lib/hospital) is centred on the origin. */
export { CAMPUS_OFFSET };
/** Time-lapse daylight shared with the lights of the host scene: HOSPITAL_TIME.day = 1 (day) … 0 (night). */
export const HOSPITAL_TIME = { get day() { return rt.day; } };
/** Approximate campus bounds in HospitalContent-local metres (plinth, basement pit and roofs included). */
export const HOSPITAL_BOX = new THREE.Box3(new THREE.Vector3(-74, -6, -47), new THREE.Vector3(74, 34, 47));

export function HospitalContent({ standalone = false }: { standalone?: boolean }) {
  const sel = useApp((s) => s.sel);
  const year = useApp((s) => s.year);
  const f = useMemo(() => focusOf(sel), [sel]);
  const get = useThree((s) => s.get);
  const campus = useRef<THREE.Group>(null);

  useEffect(() => {
    rt.root = campus.current;
    THREE_STATE.get = () => { const s = get(); return { camera: s.camera, gl: s.gl }; };
    return () => {
      if (rt.root === campus.current) rt.root = null;
      THREE_STATE.get = null;
      document.body.style.cursor = "";
      rt.pos.clear();
    };
  }, [get]);

  // the programme ramp (agents, paper stacks) follows the timeline smoothly
  const first = useRef(true);
  useFrame((st, dt) => {
    tickEcg(st.clock.elapsedTime);
    const target = yearProgress(year);
    if (first.current) { rt.eco = target; first.current = false; }
    rt.eco += (target - rt.eco) * (1 - Math.exp(-Math.min(dt, 0.25) * 1.8));
  });

  // walk mode: every floor in place (no exploded view); roofs / skybridge cut away above a visitor inside, third person
  const walk = useApp((s) => s.walk);
  const walking = walk.phase !== "off";
  const cutting = walk.phase === "on" && walk.view === "third" && !!walk.where;
  const open = walking ? null : f.floor;
  const [ob, of] = open ? open.split(":") : [null, "9"];
  const bridgeHidden = cutting ? walk.floor < 1 : !!open && Number(of) < 1;
  const walkKey = walk.phase === "on" && walk.where && !walk.tower ? `${walk.where}:${walk.floor}` : null;

  return (
    <group>
      <group ref={campus} position={CAMPUS_OFFSET}>
        <Site standalone={standalone} />
        {FLOOR_LAYOUTS.map((fl) => (
          <Floor key={fl.key} fl={fl} openKey={open} focusDept={f.dept} walkKey={walkKey} walking={walking} />
        ))}
        <StairTowers openKey={open} />
        <Roof building="main" hidden={cutting ? walk.where === "main" : ob === "main"} />
        <Roof building="annex" hidden={cutting ? walk.where === "annex" : ob === "annex"} />
        <Skybridge hidden={bridgeHidden} />
        <PersonHighlight />
        <SensorNet />
        <HospitalProps />
        <StoryStage />
      </group>
      <TimeTravel />
      <Overlay />
      <FocusFlights />
    </group>
  );
}

/** Soft ring under the hovered / selected person (rendered in the campus frame). */
function PersonHighlight() {
  const sel = useApp((s) => s.sel);
  const hover = useApp((s) => s.hover);
  const selId = sel?.kind === "person" ? sel.id : null;
  const hovId = hover?.startsWith("person:") ? hover.slice(7) : null;
  const ringSel = useRef<THREE.Group>(null), ringHov = useRef<THREE.Group>(null);
  const mats = useMemo(() => ({
    ring: new THREE.MeshBasicMaterial({ color: PAL.select, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }),
    fill: new THREE.MeshBasicMaterial({ color: PAL.select, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }),
    hring: new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }),
  }), []);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame((st) => {
    const place = (g: THREE.Group | null, id: string | null) => {
      if (!g) return;
      const rec = id ? PERSON_BY_ID[id] : null;
      const p = id ? rt.pos.get(id) : null;
      const lift = rec ? rt.lift[rec.floor.key] ?? 0 : 1;
      if (!rec || !p || lift > 0.05) { g.visible = false; return; }
      g.visible = true;
      toLocal(v.copy(p));
      g.position.set(v.x, rec.floor.floor * FLOOR_H + lift * 11 + 0.03, v.z);
      g.scale.setScalar(rec.p.slot.pose === "lie" ? 1.7 : 1);
    };
    place(ringSel.current, selId);
    place(ringHov.current, hovId && hovId !== selId ? hovId : null);
    if (ringSel.current) ringSel.current.children[0].scale.setScalar(1 + 0.06 * Math.sin(st.clock.elapsedTime * 2.2));
  });
  return (
    <>
      <group ref={ringSel} visible={false}>
        <mesh rotation-x={-Math.PI / 2} material={mats.ring} renderOrder={5}><ringGeometry args={[0.55, 0.64, 48]} /></mesh>
        <mesh rotation-x={-Math.PI / 2} material={mats.fill} renderOrder={5}><circleGeometry args={[0.55, 48]} /></mesh>
      </group>
      <group ref={ringHov} visible={false}>
        <mesh rotation-x={-Math.PI / 2} material={mats.hring} renderOrder={5}><ringGeometry args={[0.52, 0.58, 48]} /></mesh>
      </group>
    </>
  );
}
