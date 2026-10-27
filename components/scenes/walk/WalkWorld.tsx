"use client";
// Walk mode ("À pied"): a visitor you drive through the campus and both buildings, GTA-style.
//  · entry: the shared rig flies the camera down to the visitor on the plaza in front of the main entrance, then the
//    camera is handed to the walk camera (CameraControls disabled, R3F pointer events off, near plane 5 cm).
//  · third person: orbit camera behind and above the visitor (mouse look with pointer lock or drag, wheel = distance
//    1.5–8 m), lag on the pivot, pulls in on walls (camera colliders), eases back out, slowly realigns behind when moving.
//    V: first person (eye 1.65 m). Floors above the visitor and the roof are cut away in third person.
//  · movement: ZQSD / WASD (physical keys, so AZERTY and QWERTY both work) + arrows, Shift runs, Space jumps,
//    E opens the department the visitor stands in / faces (split-screen panel, walk mode continues).
//    Smooth acceleration, sub-stepped collisions (no tunnelling at run speed), sliding along walls, stairs by ground height.
//  · exit (Échap or the dock button): CameraControls are synced to the current camera and restored, then the rig flies
//    back to the hospital overview.
// Writes lib/world.ts frame.player every frame while walking. Dev handle: window.__walk.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DEPT, EXPERIENCES, FLOOR_H } from "@/lib/hospital";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import { frame } from "@/lib/world";
import { tour } from "@/lib/ai/tour";
import { CAMPUS_OFFSET } from "../hospital/nav";
import { rt } from "../hospital/mats";
import { XP_POS } from "../hospital/Experiences";
import { PERSON_VIS } from "../hospital/People";
import { BLD, SPAWN, TOWER_OF, type BId } from "./plan";
import { BLD_INDEX, COLLIDER_STATS, FLOOR_AT, STEP, refreshHospitalProps, setColliderYear, cameraHit, groundAt, meshSignatures, resolveBody, scanCampusProps, whereAt } from "./colliders";
import { TOUCH, W, WALK_API } from "./state";
import { useAi } from "@/lib/ai/ui";
import Visitor, { type VisitorApi } from "./Visitor";
import { MB_ORIGIN, mbBoxesNear, mbCameraHit, mbGroundAt, mbLiftExit, mbLiftTarget, mbResolveBody, mbSpawn, mbWhere } from "./mibtechWalk";
import { MIBTECH_ID, mibtechShowFloor } from "../city/landmarks/MibtechBuilding";
import { CASA_REEL } from "@/lib/geo/casaFrame";
import { floorY, type MbFloor } from "../city/landmarks/mibtech/mibtechGeo";

// ---------------------------------------------------------------- tuning
const RADIUS = 0.28, WALK = 1.75, RUN = 4.7, ACCEL = 9, BRAKE = 12, JUMP = 3.2, GRAVITY = 9.81, SUB = 0.08;
const PIVOT_H = 1.55, EYE = 1.65, SHOULDER = 0.2, AIM = 0.16; // aim a little above the head: the visitor sits low in the frame
const FOV_3P = 50, FOV_1P = 62, NEAR = 0.05;
const D_MIN = 1.5, D_MAX = 8, SENS = 0.0022;

type Keys = { f: number; b: number; l: number; r: number; run: boolean; jump: boolean };
const KEYS: Keys = { f: 0, b: 0, l: 0, r: 0, run: false, jump: false };
const held = new Set<string>();
const CODE: Record<string, keyof Keys> = {
  KeyW: "f", KeyS: "b", KeyA: "l", KeyD: "r", ArrowUp: "f", ArrowDown: "b", ArrowLeft: "l", ArrowRight: "r",
};
// letters as typed (e.key), so ZQSD also works on keyboards mapped differently from their physical layout
const KEYCH: Record<string, keyof Keys> = { z: "f", w: "f", s: "b", q: "l", a: "l", d: "r" };
function refreshKeys() {
  KEYS.f = KEYS.b = KEYS.l = KEYS.r = 0;
  for (const k of held) { const m = (CODE[k] ?? KEYCH[k]) as "f" | "b" | "l" | "r" | undefined; if (m) KEYS[m] = 1; }
  KEYS.run = held.has("ShiftLeft") || held.has("ShiftRight") || held.has("Shift");
}

const smoothstep = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

// scratch (no allocation in the frame loop)
const P = { x: 0, z: 0 }, N = { x: 0, z: 0 }, WH = { b: null as BId | null, tower: false, bridge: false as boolean | undefined };
const vPivot = new THREE.Vector3(), vCam = new THREE.Vector3(), vEye = new THREE.Vector3(), vLook = new THREE.Vector3(), vTmp = new THREE.Vector3();
const UI = { view: "third" as "third" | "first", where: null as BId | null, floor: 0, tower: false, bridge: false, near: null as string | null, nearCase: null as string | null,
  site: "hospital" as "hospital" | "mibtech", mb: null as string | null, lift: null as number | null };
const MBW = { inside: false, level: 0, stair: false, terrace: false };
const MB_CUT = 1.3;
// the site's physics (hospital campus or MIBTECH): chosen by W.site
const body = (p: { x: number; z: number }, feet: number, r: number, n: { x: number; z: number }) => (W.site === "mibtech" ? mbResolveBody(p, feet, r, n) : resolveBody(p, feet, r, n));
const ground = (x: number, z: number, y: number) => (W.site === "mibtech" ? mbGroundAt(x, z, y) : groundAt(x, z, y));
const qFrom = new THREE.Quaternion(), qTo = new THREE.Quaternion(), vFrom = new THREE.Vector3();

/** One physics step of the visitor (campus frame). Input: move axes relative to the camera yaw. */
function step(dt: number, mf: number, ms: number, run: boolean, jump: boolean) {
  // wish direction from the camera yaw (forward = from the camera toward the visitor)
  const sy = Math.sin(W.yaw), cy = Math.cos(W.yaw);
  let wx = -sy * mf + cy * ms, wz = -cy * mf - sy * ms;
  const wl = Math.hypot(wx, wz);
  if (wl > 1) { wx /= wl; wz /= wl; }
  const speed = run ? RUN : WALK;
  const tx = wx * speed, tz = wz * speed;
  const kk = damp(wl > 0.01 ? ACCEL : BRAKE, dt) * (W.grounded ? 1 : 0.25);
  W.vx += (tx - W.vx) * kk; W.vz += (tz - W.vz) * kk;
  if (Math.abs(W.vx) < 1e-4 && Math.abs(W.vz) < 1e-4) { W.vx = 0; W.vz = 0; }
  if (jump && W.grounded) { W.vy = JUMP; W.grounded = false; }
  // horizontal: sub-steps of ≤ 8 cm, push out of colliders, slide (drop the velocity going into the wall)
  const dist = Math.hypot(W.vx, W.vz) * dt;
  const n = Math.max(1, Math.ceil(dist / SUB));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    P.x = W.x + W.vx * h; P.z = W.z + W.vz * h;
    N.x = 0; N.z = 0;
    const rad = W.site === "mibtech" ? 0.2 : RADIUS; // MIBTECH: a slimmer body, easier between the desks
    for (let it = 0; it < 3; it++) if (!body(P, W.y, rad, N)) break;
    const nl = Math.hypot(N.x, N.z);
    if (nl > 1e-6) {
      const nx = N.x / nl, nz = N.z / nl, vn = W.vx * nx + W.vz * nz;
      if (vn < 0) { W.vx -= vn * nx; W.vz -= vn * nz; }
    }
    W.x = P.x; W.z = P.z;
    // vertical: floor slabs and stair ramps
    const g = ground(W.x, W.z, W.y);
    if (W.grounded) {
      if (g >= W.y - 0.5) { W.y = g; W.vy = 0; }       // walk up a step / down a stair, stay on the ground
      else W.grounded = false;                         // walked off an edge
    }
    if (!W.grounded) {
      W.vy -= GRAVITY * h;
      W.y += W.vy * h;
      if (W.y <= g) { W.y = g; W.vy = 0; W.grounded = true; }
    }
  }
  W.speed = Math.hypot(W.vx, W.vz);
}

/** Where the visitor is: building, tower, floor; cut-away heights for the drawing. */
function locate() {
  if (W.site === "mibtech") {
    // MIBTECH: no hospital building; floors above the visitor's are hidden in third person (MibtechBuilding reads W.mbCut)
    mbWhere(W.x, W.z, W.y, MBW);
    W.where = null; W.tower = false; W.bridge = false; W.cutB = null; W.clipY = Infinity;
    W.mbIn = MBW.inside; W.mbStair = MBW.stair; W.mbTerrace = MBW.terrace; W.level = MBW.level;
    // the entrance hall stays whole (walls and ceiling, no cut-away): the camera keeps under its ceiling instead
    // third person, like the hospital ("dollhouse"): the floors above, the ceiling and the upper part of every wall cut
    // away at 1.3 m above the visitor's floor (on the stair: above the feet), the camera high behind, seeing over the walls
    W.mbCut = W.third && MBW.inside ? (MBW.stair ? MBW.level + 1 : MBW.level) : 99;
    W.cutY = !MBW.inside ? Infinity : (MBW.stair ? W.y : MBW.level === 0 ? 0 : floorY(MBW.level as MbFloor)) + MB_CUT;
    return;
  }
  whereAt(W.x, W.z, WH, W.y);
  W.where = WH.b; W.tower = WH.tower; W.bridge = !!WH.bridge; // on the skybridge: the nearer building, level 1
  W.level = W.where ? Math.max(0, Math.min(TOWER_OF[W.where].top, Math.floor((W.y + 0.6) / FLOOR_H))) : 0;
  W.cutB = W.third && W.where ? W.where : null;
  W.cutY = W.y + 1.2;
  W.clipY = !W.cutB ? Infinity : W.tower ? W.y + 2.45 : (W.level + 1) * FLOOR_H - 0.45;
}

/** Department the visitor stands in, or faces within ~2 m (its walls / door), on the current floor. */
function nearDept(): string | null {
  if (!W.where || W.tower) return null;
  const fl = FLOOR_AT[W.where][W.level];
  if (!fl) return null;
  const B = BLD[W.where];
  const fx = -Math.sin(W.yaw), fz = -Math.cos(W.yaw);
  let best: string | null = null, bestD = 2.2;
  for (const d of fl.depts) {
    const [cx, cz, w, dd] = d.rect;
    const x0 = B.x + cx - w / 2, x1 = B.x + cx + w / 2, z0 = B.z + cz - dd / 2, z1 = B.z + cz + dd / 2;
    if (W.x > x0 && W.x < x1 && W.z > z0 && W.z < z1) return d.id;
    const qx = Math.min(x1, Math.max(x0, W.x)), qz = Math.min(z1, Math.max(z0, W.z));
    const dx = qx - W.x, dz = qz - W.z, dl = Math.hypot(dx, dz);
    if (dl < bestD && (dx * fx + dz * fz) / Math.max(dl, 1e-3) > 0.45) { best = d.id; bestD = dl; }
  }
  return best;
}

// ---------------------------------------------------------------- use-case spots
// A department's use cases are anchored where they happen: its Expériences IA kiosks (their first case) and its staff,
// each staff member standing for one of the department's cases in turn. E opens the case whose spot the visitor stands
// next to (≤ 1.3 m) or looks at (≤ 3.4 m, within ~23°); otherwise the department view.
let csBest: string | null = null, csScore = Infinity, csFx = 0, csFz = 0;
function csConsider(x: number, z: number, id: string) {
  const dx = x - W.x, dz = z - W.z, dl = Math.hypot(dx, dz);
  const cos = (dx * csFx + dz * csFz) / Math.max(dl, 1e-3);
  const near = dl < 1.3, look = dl < 3.4 && cos > 0.92;
  if (!near && !look) return;
  const score = dl * (near ? 0.6 : 1) * (2 - cos);
  if (score < csScore) { csScore = score; csBest = id; }
}
function nearCase(deptId: string | null): string | null {
  const d = deptId ? DEPT[deptId] : null;
  if (!d || !d.cases.length || !W.where) return null;
  csBest = null; csScore = Infinity; csFx = -Math.sin(W.yaw); csFz = -Math.cos(W.yaw);
  if (rt.eco >= 0.08) for (const xp of EXPERIENCES) {
    const p = XP_POS[xp.id];
    if (xp.dept === deptId && p && d.cases.includes(xp.cases[0])) csConsider(p.x, p.z, xp.cases[0]);
  }
  const fl = FLOOR_AT[W.where][W.level];
  if (fl) {
    let j = 0;
    for (const p of fl.people) {
      if (p.dept !== deptId || p.role === "patient") continue;
      const id = d.cases[j++ % d.cases.length];
      if ((PERSON_VIS.get(p.id) ?? 1) < 0.5) continue;
      const w = rt.pos.get(p.id);
      if (w) csConsider(w.x - CAMPUS_OFFSET.x, w.z - CAMPUS_OFFSET.z, id);
      else csConsider(fl.ox + p.slot.x, fl.oz + p.slot.z, id);
    }
  }
  return csBest;
}

export default function WalkWorld() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const setEvents = useThree((s) => s.setEvents);
  const visitor = useRef<VisitorApi | null>(null);
  const st = useRef({
    t: 0, enterT: 0, flightDone: -1, blend: 1, fp: 0, fov: 38, near: 0.5, savedFov: 38, savedNear: 0.5,
    dist: 4.2, touchAction: "", relock: false, propsAt: 0, pv: new THREE.Vector3(), pvInit: false, lastLook: -10, jumpEdge: false, report: 0, viewHint: 0,
  });

  useEffect(() => {
    const s = st.current;
    const setUi = () => {
      const app = useApp.getState();
      app.setWalk({ phase: W.phase, view: W.third ? "third" : "first", where: W.where, floor: W.level, tower: W.tower, bridge: W.bridge, site: W.site });
    };

    /** Leave walk mode immediately and give the camera back to CameraControls, synced to the current view. */
    const stop = () => {
      if (W.phase === "off") return;
      W.phase = "off";
      frame.player.active = false;
      held.clear(); refreshKeys();
      if (document.pointerLockElement === gl.domElement) document.exitPointerLock();
      camera.fov = s.savedFov; camera.near = s.savedNear; camera.updateProjectionMatrix();
      const c = rig.controls;
      if (c) {
        c.enabled = true;
        // look at the visitor's head (third person) or straight ahead (first person) from where the camera is now
        const look = W.third ? s.pv : vLook.copy(camera.position).add(vTmp.set(0, 0, -6).applyQuaternion(camera.quaternion));
        void c.setLookAt(camera.position.x, camera.position.y, camera.position.z, look.x, look.y, look.z, false);
      }
      setEvents({ enabled: true });
      gl.domElement.style.touchAction = s.touchAction;
      if (visitor.current?.root) visitor.current.root.visible = false;
      W.cutB = null; W.clipY = Infinity; W.bridge = false; W.mbIn = false; W.mbCut = 99;
      useApp.getState().setWalk({ phase: "off", near: null, nearCase: null, where: null, tower: false, bridge: false, floor: 0, mb: null, lift: null });
    };

    const enter = (site: "hospital" | "mibtech" = "hospital") => {
      if (W.phase !== "off") return;
      if (site === "mibtech" && !CASA_REEL) site = "hospital"; // MIBTECH's building is drawn in Casa réel only
      const app = useApp.getState();
      try { if (tour) tour.stop(true); } catch { /* the tour may not be loaded */ }
      app.setCursor({ visible: false });
      app.setHelpOpen(false);
      app.select({ kind: "overview", id: "hospital" }, { focus: false });
      // the visitor in front of the entrance (hospital plaza, or MIBTECH's portal on the boulevard); the camera behind
      W.site = site;
      const sp = site === "mibtech" ? mbSpawn() : SPAWN;
      if (site === "mibtech") { W.ox = MB_ORIGIN[0]; W.oz = MB_ORIGIN[1]; } else { W.ox = CAMPUS_OFFSET.x; W.oz = CAMPUS_OFFSET.z; }
      W.x = sp.x; W.z = sp.z; W.y = 0; W.vx = W.vy = W.vz = 0; W.heading = sp.heading; W.grounded = true; W.speed = 0;
      W.yaw = wrap(sp.heading + Math.PI); W.pitch = 0.2; W.dist = 5.6; W.third = true;
      locate();
      s.savedFov = camera.fov; s.savedNear = camera.near;
      s.fov = camera.fov; s.fp = 0; s.dist = W.dist; s.pvInit = false;
      s.enterT = performance.now(); s.flightDone = -1; s.relock = false;
      if (site === "hospital") { scanCampusProps(rt.root); refreshHospitalProps(); }
      W.phase = "enter";
      const c = rig.controls;
      if (c) { c.enabled = false; c.minDistance = 0.5; }
      if (visitor.current?.root) visitor.current.root.visible = true;
      // fly the shared rig to the third-person pose (its log-space flight for long moves)
      const pivot = vPivot.set(W.x + W.ox, W.y + PIVOT_H, W.z + W.oz);
      rig.flyTo(pivot.clone(), W.dist, { azimuth: W.yaw, polar: Math.PI / 2 - W.pitch, duration: 2.8 });
      setUi();
    };

    const exit = () => {
      if (W.phase === "off") return;
      const site = W.site;
      stop();
      if (site === "mibtech") { // back to MIBTECH's card and its overview
        useApp.getState().select({ kind: "landmark", id: MIBTECH_ID }, { focus: false });
        mibtechShowFloor(0);
      } else useApp.getState().home(); // the unified scene flies back to the hospital overview
    };
    /** MIBTECH: take the lift to the floor it shows (E at its door) */
    const ride = () => {
      if (W.site !== "mibtech") return false;
      const to = mbLiftTarget(W.x, W.z, W.level, W.mbIn);
      if (to === null) return false;
      const out = mbLiftExit(to, W.x, W.z);
      if (!out) return false;
      W.x = out.x; W.z = out.z; W.y = out.y; W.vx = W.vy = W.vz = 0; W.grounded = true; W.heading = out.heading;
      W.yaw = wrap(out.heading + Math.PI); W.pitch = 0.2; s.pvInit = false; s.dist = 0.5; // camera behind, facing the floor
      locate(); setUi();
      return true;
    };

    WALK_API.enter = () => enter(siteNow()); WALK_API.exit = exit; WALK_API.stop = stop;

    // "enter" / "toggle" walk the site on screen: MIBTECH when its card is open; otherwise the site nearest to the point the
    // camera looks at (the hospital campus or MIBTECH's building, Casa réel)
    const siteNow = (): "hospital" | "mibtech" => {
      if (!CASA_REEL) return "hospital";
      const sel = useApp.getState().sel;
      if (sel?.kind === "landmark" && sel.id === MIBTECH_ID) return "mibtech";
      const c = rig.controls;
      if (!c) return "hospital";
      const t = c.getTarget(vTmp);
      const dH = Math.hypot(t.x - CAMPUS_OFFSET.x, t.z - CAMPUS_OFFSET.z), dM = Math.hypot(t.x - MB_ORIGIN[0], t.z - MB_ORIGIN[1]);
      return dM < dH ? "mibtech" : "hospital";
    };
    const onReq = (e: Event) => {
      const what = (e as CustomEvent<string>).detail;
      if (what === "enter:mibtech") enter("mibtech");
      else if (what === "enter:hospital") enter("hospital");
      else if (what === "enter") enter(siteNow());
      else if (what === "exit") exit();
      else if (W.phase === "off") enter(siteNow()); else exit();
    };
    window.addEventListener("atlas:walk", onReq);

    // ---------------------------------------------------------------- input
    const typing = (t: EventTarget | null) => {
      const el = t as HTMLElement | null;
      return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    };
    const onDown = (e: KeyboardEvent) => {
      if (W.phase !== "on" || typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (useApp.getState().helpOpen) return;
      const ch = e.key.length === 1 ? e.key.toLowerCase() : "";
      if (CODE[e.code] || KEYCH[ch]) { held.add(CODE[e.code] ? e.code : ch); e.preventDefault(); }
      if (e.key === "Shift") held.add(e.code || "Shift");
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) s.jumpEdge = true; }
      if (!e.repeat && (e.code === "KeyV" || ch === "v")) {
        W.third = !W.third; e.preventDefault();
        if (!W.third) { W.pitch = Math.min(Math.max(W.pitch * 0.4, -0.4), 0.5); } else W.pitch = 0.24;
        setUi();
      }
      if (!e.repeat && (e.code === "KeyE" || ch === "e")) {
        // E toggles: opens the case in front of the visitor (or the department view), E again closes the panel
        e.preventDefault();
        if (ride()) return;
        const app = useApp.getState();
        if (app.panelOpen && app.sel && app.sel.kind !== "overview") { app.select({ kind: "overview", id: "hospital" }, { focus: false }); return; }
        const id = app.walk.near, cid = app.walk.nearCase;
        if (cid) app.select({ kind: "case", id: cid }, { focus: false });
        else if (id) app.select({ kind: "dept", id }, { focus: false });
      }
      refreshKeys();
    };
    const onUp = (e: KeyboardEvent) => {
      const ch = e.key.length === 1 ? e.key.toLowerCase() : "";
      held.delete(e.code); held.delete(ch); if (e.key === "Shift") { held.delete("ShiftLeft"); held.delete("ShiftRight"); held.delete("Shift"); }
      refreshKeys();
    };
    const onBlur = () => { held.clear(); refreshKeys(); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    // the split-screen panel needs the mouse: release pointer lock while it is open, lock again when it closes
    let wasOpen = false;
    const unsubPanel = useApp.subscribe((st) => {
      const open = st.panelOpen && !!st.sel && st.sel.kind !== "overview";
      if (W.phase === "on" && open !== wasOpen) {
        if (open && document.pointerLockElement === gl.domElement) { s.relock = true; document.exitPointerLock(); }
        else if (!open && s.relock) {
          s.relock = false;
          try { const r = gl.domElement.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => {}); } catch { /* needs a user gesture */ }
        }
      }
      wasOpen = open;
    });
    window.addEventListener("blur", onBlur);

    const el = gl.domElement;
    let drag = false;
    const look = (dx: number, dy: number) => {
      W.yaw = wrap(W.yaw - dx * SENS);
      const lo = W.third ? -0.28 : -1.2, hi = W.third ? 1.15 : 1.25;
      W.pitch = Math.min(hi, Math.max(lo, W.pitch + dy * SENS * (W.third ? 1 : 1)));
      s.lastLook = s.t;
    };
    const pDown = (e: PointerEvent) => {
      if (W.phase !== "on") return;
      const app = useApp.getState();
      if (app.panelOpen && app.sel && app.sel.kind !== "overview") { drag = true; return; } // panel open: drag to look, no lock
      if (e.pointerType === "mouse" && e.button === 0 && document.pointerLockElement !== el) {
        try { const r = el.requestPointerLock() as unknown as Promise<void> | undefined; r?.catch?.(() => {}); } catch { /* not allowed here */ }
      }
      drag = true;
    };
    const pMove = (e: PointerEvent) => {
      if (W.phase !== "on") return;
      if (document.pointerLockElement === el) look(e.movementX, e.movementY);
      else if (drag && e.buttons) look(e.movementX, e.movementY);
    };
    const pUp = () => { drag = false; };
    const wheel = (e: WheelEvent) => {
      if (W.phase === "off") return;
      e.preventDefault();
      if (W.phase !== "on") return;
      if (!W.third) { if (e.deltaY > 0) { W.third = true; W.dist = D_MIN; W.pitch = 0.25; setUi(); } return; }
      W.dist = Math.min(D_MAX, Math.max(D_MIN, W.dist * Math.exp(Math.max(-120, Math.min(120, e.deltaY)) * 0.0022)));
    };
    el.addEventListener("pointerdown", pDown);
    window.addEventListener("pointermove", pMove);
    window.addEventListener("pointerup", pUp);
    el.addEventListener("wheel", wheel, { passive: false });

    // anything else taking the camera (level change, Jabby flights) ends walk mode cleanly: handled by UnifiedWorld via WALK_API.stop

    // dev handle for QA scripts
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __walk: object }).__walk = {
        W, enter, exit, stop, keys: KEYS, mb: { near: mbBoxesNear, free: (x: number, z: number, y: number) => !mbResolveBody({ x, z }, y, RADIUS, { x: 0, z: 0 }), ground: mbGroundAt, where: (x: number, z: number, y: number) => mbWhere(x, z, y, { inside: false, level: 0, stair: false, terrace: false }), lift: () => ride() }, held, meshes: () => meshSignatures(rt.root), scan: () => scanCampusProps(rt.root), ground: groundAt, where: () => whereAt(W.x, W.z, { b: null, tower: false }, W.y), stats: COLLIDER_STATS,
        teleport: (x: number, z: number, y = 0, heading?: number) => {
          W.x = x; W.z = z; W.y = y; W.vx = W.vy = W.vz = 0; W.grounded = true; s.pvInit = false;
          if (heading !== undefined) { W.heading = heading; W.yaw = wrap(heading + Math.PI); }
          locate(); setUi();
        },
        look: (yaw: number, pitch?: number) => { W.yaw = yaw; if (pitch !== undefined) W.pitch = pitch; },
        view: (v: "first" | "third") => { W.third = v === "third"; setUi(); },
        /** Drive the physics synchronously (60 Hz) toward each waypoint [x, z] (campus); returns the trace of arrivals. */
        sim: (pts: [number, number][], o: { run?: boolean; maxT?: number } = {}) => {
          const out: { to: [number, number]; ok: boolean; t: number; x: number; y: number; z: number; where: string | null }[] = [];
          const dt = 1 / 60;
          for (const to of pts) {
            let t = 0, ok = false, lastX = W.x, lastZ = W.z, lastT = 0;
            while (t < (o.maxT ?? 30)) {
              const dx = to[0] - W.x, dz = to[1] - W.z, d = Math.hypot(dx, dz);
              if (d < 0.3) { ok = true; break; }
              W.yaw = Math.atan2(-dx, -dz);
              step(dt, Math.min(1, d / 0.6 + 0.25), 0, !!o.run, false);
              if (W.speed > 0.15) W.heading = Math.atan2(W.vx, W.vz);
              t += dt;
              if (t - lastT > 2) { if (Math.hypot(W.x - lastX, W.z - lastZ) < 0.05) break; lastX = W.x; lastZ = W.z; lastT = t; }
            }
            locate();
            out.push({ to, ok, t: Math.round(t * 100) / 100, x: +W.x.toFixed(2), y: +W.y.toFixed(2), z: +W.z.toFixed(2), where: W.bridge ? `passerelle(${W.where}):${W.level}` : W.where ? `${W.where}${W.tower ? "/tour" : ""}:${W.level}` : "dehors" });
            if (!ok) break;
          }
          W.vx = W.vz = 0; s.pvInit = false; setUi();
          return out;
        },
      };
    }

    return () => {
      window.removeEventListener("atlas:walk", onReq);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      unsubPanel();
      window.removeEventListener("blur", onBlur);
      el.removeEventListener("pointerdown", pDown);
      window.removeEventListener("pointermove", pMove);
      window.removeEventListener("pointerup", pUp);
      el.removeEventListener("wheel", wheel);
      stop();
    };
  }, [camera, gl, setEvents]);

  useFrame((state, rawDt) => {
    const s = st.current;
    const dt = Math.min(rawDt, 0.1);
    s.t += dt;
    if (W.phase === "off") return;

    // ---------------- entry flight → hand over to the walk camera
    if (W.phase === "enter") {
      visitor.current?.pose(dt, s.t, W.yaw + Math.PI);
      if (rig.flying) return;
      if (s.flightDone < 0) s.flightDone = s.t;
      if (s.t - s.flightDone < 0.25) return; // let camera-controls settle (short moves are damped transitions)
      W.phase = "on";
      setEvents({ enabled: false });
      s.touchAction = gl.domElement.style.touchAction; gl.domElement.style.touchAction = "none";
      document.body.style.cursor = "";
      s.blend = 0; vFrom.copy(camera.position); qFrom.copy(camera.quaternion);
      camera.near = NEAR; camera.updateProjectionMatrix();
      s.viewHint = s.t;
      useApp.getState().setWalk({ phase: "on", view: "third" });
    }

    // a guided tour started from the dock takes the camera: leave walk mode
    if (useAi.getState().tourStatus === "playing") { WALK_API.stop(); return; }

    // ---------------- input → physics (keyboard + touch joystick)
    const mf = Math.max(-1, Math.min(1, KEYS.f - KEYS.b + TOUCH.y)), ms = Math.max(-1, Math.min(1, KEYS.r - KEYS.l + TOUCH.x));
    const jump = s.jumpEdge; s.jumpEdge = false;
    step(dt, mf, ms, KEYS.run || Math.hypot(TOUCH.x, TOUCH.y) > 0.92, jump);
    if (!W.third) W.heading = wrap(W.yaw + Math.PI);
    else if (W.speed > 0.12) {
      const target = Math.atan2(W.vx, W.vz);
      W.heading = wrap(W.heading + wrap(target - W.heading) * damp(11, dt));
    }
    locate();

    // ---------------- visitor
    visitor.current?.pose(dt, s.t, W.yaw + Math.PI);

    // ---------------- camera
    const ox = W.ox, oz = W.oz;
    s.fp += ((W.third ? 0 : 1) - s.fp) * damp(9, dt);
    if (Math.abs(s.fp - (W.third ? 0 : 1)) < 0.002) s.fp = W.third ? 0 : 1;
    // gentle auto-follow: while moving without touching the mouse, the camera swings back behind the visitor
    if (W.third && W.speed > 0.6 && s.t - s.lastLook > 1.4) {
      const behind = wrap(W.heading + Math.PI);
      W.yaw = wrap(W.yaw + wrap(behind - W.yaw) * damp(0.9 * Math.min(1, W.speed / 3), dt));
    }
    // pivot with lag (vertical a little softer: stairs)
    const sy = Math.sin(W.yaw), cy = Math.cos(W.yaw);
    const tx = W.x + cy * SHOULDER, tz = W.z - sy * SHOULDER, ty = W.y + PIVOT_H;
    if (!s.pvInit) { s.pv.set(tx + ox, ty, tz + oz); s.pvInit = true; }
    s.pv.x += (tx + ox - s.pv.x) * damp(18, dt);
    s.pv.z += (tz + oz - s.pv.z) * damp(18, dt);
    s.pv.y += (ty - s.pv.y) * damp(11, dt);
    const cp = Math.cos(W.pitch), sp = Math.sin(W.pitch);
    // desired third-person camera, pulled in by the camera colliders (snap in, ease out)
    const px = s.pv.x - ox, py = s.pv.y, pz = s.pv.z - oz;
    const dx = sy * cp * W.dist, dy = sp * W.dist, dz = cy * cp * W.dist;
    const hit = W.site === "mibtech"
      ? mbCameraHit(px, py, pz, px + dx, py + dy, pz + dz, W.third && W.mbIn ? W.cutY : Infinity)
      : cameraHit(px, py, pz, px + dx, py + dy, pz + dz, W.cutB ? (W.bridge ? 3 : BLD_INDEX[W.cutB]) : 0, W.cutY);
    const want = Math.max(0.35, Math.min(W.dist, hit * W.dist - 0.22));
    s.dist = want < s.dist ? want : s.dist + (want - s.dist) * damp(3.5, dt);
    let cx = px + sy * cp * s.dist, cyy = py + sp * s.dist, cz = pz + cy * cp * s.dist;
    // never below the walkable surface around the visitor's level (a cut-away slab above does not count)
    const gnd = ground(cx, cz, Math.min(cyy, W.y + 1.2));
    if (cyy < gnd + 0.25) cyy = gnd + 0.25;
    cx += ox; cz += oz;
    // first person: eyes, gentle head bob
    const bob = W.grounded ? Math.sin(s.t * (W.speed > 3 ? 13 : 9)) * Math.min(1, W.speed / 2) * 0.025 : 0;
    vEye.set(W.x + ox, W.y + EYE + bob, W.z + oz);
    const lx = vEye.x - sy * cp * 5, ly = vEye.y - sp * 5, lz = vEye.z - cy * cp * 5;
    // blend third ↔ first person
    const f = smoothstep(s.fp);
    vCam.set(cx + (vEye.x - cx) * f, cyy + (vEye.y - cyy) * f, cz + (vEye.z - cz) * f);
    const ay = s.pv.y + AIM;
    vLook.set(s.pv.x + (lx - s.pv.x) * f, ay + (ly - ay) * f, s.pv.z + (lz - s.pv.z) * f);
    camera.up.set(0, 1, 0);
    camera.position.copy(vCam);
    camera.lookAt(vLook);
    if (s.blend < 1) {
      // hand-over from the entry flight: ease from where the camera was
      s.blend = Math.min(1, s.blend + dt / 0.45);
      const e = smoothstep(s.blend);
      camera.position.lerpVectors(vFrom, vCam, e);
      qTo.copy(camera.quaternion);
      camera.quaternion.slerpQuaternions(qFrom, qTo, e);
    }
    const fov = THREE.MathUtils.lerp(FOV_3P, FOV_1P, f);
    if (Math.abs(camera.fov - fov) > 0.01) { s.fov += (fov - s.fov) * damp(5, dt); camera.fov = s.fov; camera.updateProjectionMatrix(); }
    if (visitor.current?.root) visitor.current.root.visible = f < 0.6 && s.dist > 0.55;

    // ---------------- shared state
    frame.player.active = true;
    frame.player.x = W.x + ox; frame.player.y = W.y; frame.player.z = W.z + oz; frame.player.heading = W.heading;
    if (W.site === "hospital" && s.t - s.propsAt > 2) { s.propsAt = s.t; refreshHospitalProps(); }
    setColliderYear(useApp.getState().year); // interior props may arrive later (hot reload)
    if (s.t - s.report > 0.12) {
      s.report = s.t;
      UI.view = W.third ? "third" : "first"; UI.where = W.where; UI.floor = W.level; UI.tower = W.tower; UI.bridge = W.bridge; UI.near = W.bridge ? null : nearDept(); UI.nearCase = nearCase(UI.near);
      UI.site = W.site;
      UI.mb = W.site !== "mibtech" ? null : !W.mbIn ? "dehors" : W.mbStair ? "escalier" : W.level === 0 ? "hall" : W.mbTerrace ? "terrasse" : "etage";
      UI.lift = W.site === "mibtech" && !W.mbStair ? mbLiftTarget(W.x, W.z, W.level, W.mbIn) : null;
      useApp.getState().setWalk(UI);
    }
  });

  return <Visitor api={visitor} />;
}

/** Short label of a department for the HUD. */
export const deptShort = (id: string | null) => (id ? DEPT[id]?.short ?? id : "");
export { STEP };
