"use client";
// Store-driven camera flights for the hospital content (floor / department / person / use case), through the shared rig
// (lib/rig.ts). Also: re-frame when the stage is resized by the side panel, and "click on empty space" to step back up.
// The overview flight is NOT handled here (the unified scene, or the standalone HospitalScene wrapper, owns it).
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DEPT, FLOOR_H } from "@/lib/hospital";
import { useApp, type Sel } from "@/lib/store";
import { rig } from "@/lib/rig";
import { PERSON_BY_ID, FLOOR_BY_KEY } from "./layout";
import { deptCenter, fitPosition, floorCenter, focusOf, stageAspect, toLocal, toWorld } from "./nav";
import { rt } from "./mats";
import { XP_POS } from "./Experiences";

export const FOV = 38;

/** Camera position + look target in building-frame coordinates (lib/hospital), or null for the overview. */
export function shotLocal(sel: Sel, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 } | null {
  const f = focusOf(sel);
  if (sel?.kind === "xp" && XP_POS[sel.id]) {
    const p = XP_POS[sel.id];
    const look = new THREE.Vector3(p.x, 1.3, p.z);
    // steep enough to look over the entrance canopy
    return { look, pos: fitPosition(look, new THREE.Vector3(2.4, 1.4, 2.4), new THREE.Vector3(0.25 + Math.sin(p.yaw) * 0.5, 1.55, 1), FOV, aspect, 1.3) };
  }
  if (f.person) {
    const rec = PERSON_BY_ID[f.person];
    if (rec) {
      const s = rec.p.slot;
      // live position only if the person's floor is in place (a lifted / hidden floor keeps stale positions)
      const w = (rt.lift[rec.floor.key] ?? 0) < 0.01 ? rt.pos.get(f.person) : undefined;
      const look = w ? toLocal(w.clone()) : new THREE.Vector3(rec.floor.ox + s.x, rec.floor.floor * FLOOR_H + 1.1, rec.floor.oz + s.z);
      const lie = s.pose === "lie";
      const dir = lie ? new THREE.Vector3(0.45, 1.25, 1) : new THREE.Vector3(0.5, 0.62, 1);
      if (!lie) look.y += 0.15;
      return { look, pos: fitPosition(look, new THREE.Vector3(2.0, 1.3, 2.0), dir, FOV, aspect, 1.3) };
    }
  }
  if (f.dept) {
    const d = DEPT[f.dept];
    const look = deptCenter(f.dept).add(new THREE.Vector3(0, 0.8, 0));
    const dir = d.floor < 0 ? new THREE.Vector3(0.18, 1.6, 1) : new THREE.Vector3(0.24, 1.08, 1);
    return { look, pos: fitPosition(look, new THREE.Vector3(d.rect[2] / 2, 1, d.rect[3] / 2), dir, FOV, aspect, 1.12) };
  }
  if (f.floor) {
    const fl = FLOOR_BY_KEY[f.floor];
    if (fl) {
      const look = floorCenter(f.floor).add(new THREE.Vector3(0, 0.8, 0));
      const dir = fl.floor < 0 ? new THREE.Vector3(0.2, 1.9, 1) : new THREE.Vector3(0.28, 1.55, 1);
      return { look, pos: fitPosition(look, new THREE.Vector3(fl.w / 2, 1, fl.d / 2), dir, FOV, aspect, 1.02) };
    }
  }
  return null;
}

/** Overview of the campus (building frame) — used by the standalone wrapper. */
export function overviewLocal(aspect: number) {
  const look = new THREE.Vector3(14, 5, 3);
  return { look, pos: fitPosition(look, new THREE.Vector3(46, 10, 24), new THREE.Vector3(0.66, 0.6, 1), FOV, aspect, 1.1) };
}

export function currentAspect(el: HTMLElement) {
  const s = useApp.getState();
  const panel = s.panelOpen && s.section === "explorer" && !!s.sel && s.sel.kind !== "overview";
  return stageAspect(panel, el.clientWidth / Math.max(1, el.clientHeight));
}

/** Fly the shared rig to a building-frame shot. */
export function flyShot(shot: { pos: THREE.Vector3; look: THREE.Vector3 }) {
  const look = toWorld(shot.look.clone()), pos = toWorld(shot.pos.clone());
  const sph = new THREE.Spherical().setFromVector3(pos.sub(look));
  rig.flyTo(look, sph.radius, { azimuth: sph.theta, polar: sph.phi });
  rt.userMoved = false;
}

export function FocusFlights() {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const nonce = useApp((s) => s.focusNonce);
  const sel = useApp((s) => s.sel);
  const ready = useRef(false);

  const fly = () => {
    const shot = shotLocal(useApp.getState().sel, currentAspect(gl.domElement));
    if (shot) flyShot(shot);
  };

  // first flight shortly after mount (lets the scene attach the rig and place its intro first)
  useEffect(() => {
    const t = setTimeout(() => { ready.current = true; if (useApp.getState().level === "hospital") fly(); }, 140);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready.current) return;
    fly();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, sel?.kind, sel?.id]);

  // keep the subject framed when the side panel resizes the stage — unless the user took over the camera
  useEffect(() => {
    if (!ready.current || rt.userMoved) return;
    const t = setTimeout(() => { if (!rt.userMoved) fly(); }, 240);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height]);

  // user input detection (drag / wheel) + click on empty space → step back up (person/dept → floor → overview)
  useEffect(() => {
    const el = gl.domElement;
    let downX = 0, downY = 0, down = false;
    const onDown = (e: PointerEvent) => { downX = e.clientX; downY = e.clientY; down = true; rt.clickHandled = false; };
    const onMove = (e: PointerEvent) => { if (down && Math.hypot(e.clientX - downX, e.clientY - downY) > 5) rt.userMoved = true; };
    const onUp = () => { down = false; };
    const onWheel = () => { rt.userMoved = true; };
    const onClick = (e: MouseEvent) => {
      if (e.target !== el) return;
      if (rt.clickHandled) { rt.clickHandled = false; return; }
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const s = useApp.getState();
      if (s.level !== "hospital") return;
      const f = focusOf(s.sel);
      if (s.sel?.kind === "floor") s.select({ kind: "overview", id: "hospital" });
      else if (f.floor && s.sel && s.sel.kind !== "overview") s.select({ kind: "floor", id: f.floor });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    // on the document so R3F's own click handlers (attached to the canvas wrapper) have already run
    document.addEventListener("click", onClick);
    return () => {
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp); el.removeEventListener("wheel", onWheel);
      document.removeEventListener("click", onClick);
    };
  }, [gl]);

  return null;
}
