"use client";
// The staff and patients of one floor, drawn with the shared human kit (components/scenes/people/human.ts): one instanced
// draw call per floor whatever the head count, dressed by role (white coats, teal / navy scrubs, light scrubs, business
// casual, polos, jackets, gowns), plus their AI agent companions. Animated procedurally: breathing, look-around, typing at
// desks (hands on the keyboard), seated exactly on their chairs (seat top, thighs level, feet on the floor), walking short
// paths with a natural gait, lying in beds under the blanket; leaving staff stand up, walk to the department door and fade.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useApp } from "@/lib/store";
import { registerAnchor } from "@/lib/anchors";
import type { FloorLayout, Person } from "./layout";
import { haloTexture, rt, type FloorMats } from "./mats";
import { keptShrinkable, visibleStaff } from "./staffing";
import { FINAL_YEAR, type Year } from "@/lib/model";
import { W, walkOn } from "../walk/state";
import { BONE, dress, hex, mixPose, newPose, poseIdle, poseLie, poseSit, poseType, poseWalk, type Garb } from "../people/human";
import { useHumanCrowd } from "../people/useHumans";

const hitGeo = new THREE.BoxGeometry(0.75, 1.95, 0.7).translate(0, 0.97, 0);
/** person id → how present the figure is (1 drawn … 0 gone), for the walk-mode collisions. */
export const PERSON_VIS = new Map<string, number>();

/** Seat top of the layout's chairs (desk chairs, waiting rows, meeting chairs: layout.ts). */
const SEAT_TOP = 0.5;
/** A layout bed slot's y is the old figure's body centre: the mattress top is 0.14 lower. */
const BED_DROP = 0.14;

const Y = new THREE.Vector3(0, 1, 0);
const qLie = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _v = new THREE.Vector3(), _s = new THREE.Vector3();
const _w = new THREE.Color("#FFFFFF"), _sel = new THREE.Color("#C8D3FF");
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const P0 = newPose(), P1 = newPose(), P2 = newPose();

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function dampAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
/** The look of a layout person: their role's wardrobe, their skin and hair; patients in beds wear a gown, others are dressed. */
function lookOf(p: Person) {
  const garb: Garb = p.role === "patient" ? (p.slot.pose === "lie" ? "patient" : "visitor") : p.role;
  const lab = p.label.toLowerCase();
  const fem = /sage-femme|patiente\b|^infirmière|secrétaire/.test(lab) ? true : undefined;
  return dress(garb, hash(p.id), { fem, skin: hex(p.skin), hair: p.hair ? hex(p.hair) : null, gown: p.slot.pose === "lie" ? true : undefined });
}

export default function People({ fl, mats, group, active }: {
  fl: FloorLayout; mats: FloorMats; group: React.RefObject<THREE.Group | null>; active: () => boolean;
}) {
  const N = fl.people.length;
  const crowd = useHumanCrowd(N);
  const hit = useRef<THREE.InstancedMesh>(null);
  const orb = useRef<THREE.InstancedMesh>(null), halo = useRef<THREE.InstancedMesh>(null);
  const agents = useMemo(() => fl.people.map((p, i) => (p.agent >= 0 ? i : -1)).filter((i) => i >= 0), [fl]);
  const st = useMemo(() => ({
    yaw: Float32Array.from(fl.people.map((p) => p.slot.yaw)),
    clock: Float32Array.from(fl.people.map((p) => p.seed * 40)),
    pres: Float32Array.from(fl.people.map((p) => presenceTarget(p.dept, p.shrink, useApp.getState().year))),
    vis: new Float32Array(N).fill(1),
    pilot: new Float32Array(N),
    a: new Float32Array(N),
    orb: fl.people.map(() => new THREE.Vector3(NaN, 0, 0)),
    chest: fl.people.map(() => new THREE.Vector3()),      // world space
    local: fl.people.map(() => new THREE.Vector3()),      // floor-group space
  }), [fl, N]);
  const hoverIdx = useRef<number | null>(null);
  const sel = useApp((s) => s.sel);
  const year = useApp((s) => s.year);
  const yearRef = useRef(year);
  yearRef.current = year;
  const pilotRef = useRef<THREE.InstancedMesh>(null);
  const shrinks = useMemo(() => fl.people.map((p) => p.shrink >= 0 && visibleStaff(p.dept, FINAL_YEAR).removed > 0), [fl]);
  const hover = useApp((s) => s.hover);
  const selIdx = sel?.kind === "person" ? fl.people.findIndex((p) => p.id === sel.id) : -1;
  const hovIdx = hover?.startsWith("person:") ? fl.people.findIndex((p) => "person:" + p.id === hover) : -1;
  const selRef = useRef(selIdx);
  selRef.current = selIdx;
  const camera = useThree((s) => s.camera);

  // wardrobe (once per floor), highlight of the hovered / selected person
  useLayoutEffect(() => { fl.people.forEach((p, i) => crowd.setLook(i, lookOf(p))); }, [fl, crowd]);
  useLayoutEffect(() => {
    for (let i = 0; i < N; i++) crowd.tint(i, i === selIdx ? _sel : i === hovIdx ? _w : null, i === selIdx ? 0.45 : 0.4);
  }, [crowd, N, selIdx, hovIdx]);

  useLayoutEffect(() => {
    for (const r of [hit, orb, halo]) {
      const m = r.current;
      if (!m) continue;
      m.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 40);
      m.frustumCulled = false;
    }
  }, []);

  // anchors: one per person
  useEffect(() => {
    const v = new THREE.Vector3();
    const offs = fl.people.map((p, i) =>
      registerAnchor("person:" + p.id, () => {
        if (!THREE_STATE.get) return null;
        const { camera: cam, gl } = THREE_STATE.get();
        v.copy(st.chest[i]).project(cam);
        const r = gl.domElement.getBoundingClientRect();
        return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: active() && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
      }),
    );
    return () => offs.forEach((o) => o());
  }, [fl, st, active]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const g = group.current;
    if (!g) return;
    if (!g.visible) return;
    g.updateWorldMatrix(true, false);
    const Hit = hit.current!, mesh = crowd.mesh;
    if (mesh.parent && mesh.parent.parent && !mesh.parent.parent.visible) return; // floor interior not drawn (LOD)
    crowd.sync(mats.figure);
    const dts = Math.min(dt, 0.25);
    const PL = pilotRef.current;
    for (let i = 0; i < N; i++) {
      const p = fl.people[i], s = p.slot, sd = p.seed * 100;
      // timeline staffing: leaving staff walk to the department door and fade out (~1.5 s), and back again
      const tgt = presenceTarget(p.dept, p.shrink, yearRef.current);
      const prev = st.pres[i];
      st.pres[i] += Math.max(-dts / 1.5, Math.min(dts / 1.5, tgt - st.pres[i]));
      const pr = st.pres[i];
      if (p.desk >= 0 && Math.abs(pr - prev) > 1e-4) { rt.desk.set(p.desk, pr); rt.deskVer++; }
      else if (p.desk >= 0 && !rt.desk.has(p.desk)) { rt.desk.set(p.desk, pr); rt.deskVer++; }
      // walk mode: someone walking toward the visitor stops for a moment and lets them pass
      let yieldTo = false;
      if (s.pose === "walk" && walkOn() && W.where === fl.building && W.level === fl.floor) {
        const lx = st.local[i].x + fl.ox, lz = st.local[i].z + fl.oz, dx = W.x - lx, dz = W.z - lz, d2 = dx * dx + dz * dz;
        yieldTo = d2 < 2.6 && dx * Math.sin(st.yaw[i]) + dz * Math.cos(st.yaw[i]) > 0;
      }
      if (selRef.current !== i && !yieldTo) st.clock[i] += dts;
      const ck = st.clock[i];
      const sc = crowd.height[i];
      let x = s.x, z = s.z, yaw = s.yaw, y0 = s.y ?? 0;
      const P = P0;
      if (s.pose === "walk" && s.path) {
        const [x1, z1, x2, z2] = s.path;
        const L = Math.hypot(x2 - x1, z2 - z1) || 1;
        const w = (2 * 0.8) / L;
        const ph = ck * w;
        const a = (1 - Math.cos(ph)) / 2;
        const vel = Math.sin(ph);
        x = x1 + (x2 - x1) * a; z = z1 + (z2 - z1) * a;
        const amp = Math.min(1, Math.abs(vel) * 2.4) * (selRef.current === i || yieldTo ? 0 : 1);
        const hc = Math.floor(ph / Math.PI), dist = (hc + (1 - Math.cos(ph - hc * Math.PI)) / 2) * L; // travelled, always forward
        poseWalk(P, (dist * 3.6) / sc, amp, crowd.robe[i] === 1);
        P.hy += 0.15 * Math.sin(0.4 * t + sd);
        const base = Math.atan2(x2 - x1, z2 - z1);
        st.yaw[i] = dampAngle(st.yaw[i], vel >= 0 ? base : base + Math.PI, 1 - Math.exp(-dts * 5));
        yaw = st.yaw[i];
      } else if (s.pose === "sit") {
        if (s.type) poseType(P, SEAT_TOP + y0, sc, t, sd, 0.785, 0.52); else poseSit(P, SEAT_TOP + y0, sc, t, sd);
        y0 = 0;
      } else if (s.pose === "lie") {
        poseLie(P, t, sd);
        y0 = (s.y ?? 0.76) - BED_DROP;
      } else {
        poseIdle(P, t, sd);
        yaw += 0.06 * Math.sin(0.11 * t + sd);
      }
      let vs = 1;
      let out = P;
      if (pr < 0.999) {
        const w = smooth((1 - pr) / 0.7);              // walk towards the door …
        const [dx, dz] = p.door;
        const bx = x, bz = z;
        x = bx + (dx - bx) * w; z = bz + (dz - bz) * w;
        if (w > 0.001) {
          const up = smooth(w / 0.15);                  // … standing up first if seated
          poseWalk(P1, (w * Math.hypot(dx - bx, dz - bz) * 3.6) / sc, up);
          out = mixPose(P2, P, P1, up);
          yaw = dampAngle(yaw, Math.atan2(dx - bx, dz - bz), up);
        }
        vs = smooth(pr / 0.3);                          // … then fade (shrink) away at the door
      }
      st.vis[i] = vs;
      PERSON_VIS.set(p.id, vs);
      crowd.write(i, x, y0, z, yaw, vs, out);
      // hit proxy
      _qy.setFromAxisAngle(Y, yaw);
      if (s.pose === "lie") _qy.multiply(qLie);
      if (pr < 0.3) Hit.setMatrixAt(i, ZERO);
      else { _m.compose(_v.set(x, y0 + (s.pose === "sit" ? -0.25 * vs : 0), z), _qy, _s.set(vs, vs, vs)); Hit.setMatrixAt(i, _m); }
      // pilots: the remaining staff of a shrinking department get a soft blue halo once agents are at work
      if (PL) {
        const pt = shrinks[i] && tgt > 0.5 ? smooth(rt.eco / 0.3) : 0;
        st.pilot[i] += (pt - st.pilot[i]) * Math.min(1, dts * 2);
        const k = st.pilot[i] * vs;
        if (k < 0.01) PL.setMatrixAt(i, ZERO);
        else { _m.compose(_v.set(x, (s.y ?? 0) + 0.025, z), qFlat, _rs.set(1.5 * k, 1.5 * k, 1.5 * k)); PL.setMatrixAt(i, _m); }
      }
      // chest in world space (anchors, highlight ring, tooltips)
      crowd.point(st.local[i], BONE.chest, 0, 0.2, 0);
      st.chest[i].copy(st.local[i]).applyMatrix4(g.matrixWorld);
      rt.pos.set(p.id, st.chest[i]);
    }
    if (PL) PL.instanceMatrix.needsUpdate = true;
    Hit.instanceMatrix.needsUpdate = true;

    // AI agents: one luminous companion per assisted staff member, appearing along the programme ramp
    const O = orb.current, Hl = halo.current;
    if (O && Hl) {
      const k = 1 - Math.exp(-dts * 6);
      for (let j = 0; j < agents.length; j++) {
        const i = agents[j], p = fl.people[i], s = p.slot, sd = p.seed * 100;
        const target = smooth((rt.eco - p.agent) / 0.07);
        st.a[i] += (target - st.a[i]) * Math.min(1, dts * 3);
        const a = st.a[i];
        if (a < 0.01) { O.setMatrixAt(j, ZERO); Hl.setMatrixAt(j, ZERO); st.orb[i].x = NaN; continue; }
        const yaw = s.pose === "walk" ? st.yaw[i] : s.yaw;
        const sit = s.pose === "sit";
        const lx = sit ? 0.62 : 0.5, lz = sit ? 0.15 : 0.1, h = (sit ? 1.45 : 2.05) + 0.07 * Math.sin(1.3 * t + sd);
        const orbit = 0.12 * Math.sin(0.6 * t + sd);
        const c = Math.cos(yaw), sn = Math.sin(yaw);
        // person position (floor-local) from the chest
        const px = st.local[i].x, pz = st.local[i].z;
        const tx = px + (lx + orbit) * c + lz * sn, tz = pz - (lx + orbit) * sn + lz * c, ty = (s.y ?? 0) + h;
        const o = st.orb[i];
        if (Number.isNaN(o.x)) o.set(tx, ty, tz); else o.set(o.x + (tx - o.x) * k, o.y + (ty - o.y) * k, o.z + (tz - o.z) * k);
        const scl = a * st.vis[i] * (1 + 0.06 * Math.sin(2.1 * t + sd));
        _m.compose(o, _q.identity(), _s.set(scl, scl, scl));
        O.setMatrixAt(j, _m);
        _m.compose(o, camera.quaternion, _s.set(scl * 1.15, scl * 1.15, scl * 1.15));
        Hl.setMatrixAt(j, _m);
      }
      O.instanceMatrix.needsUpdate = true; Hl.instanceMatrix.needsUpdate = true;
    }
  });

  const setHover = useApp((s) => s.setHover);
  const select = useApp((s) => s.select);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (!active() || e.instanceId == null) return;
    e.stopPropagation();
    const i = e.instanceId;
    if (hoverIdx.current !== i) {
      hoverIdx.current = i;
      setHover("person:" + fl.people[i].id);
      document.body.style.cursor = "pointer";
    }
  };
  const onOut = () => {
    if (hoverIdx.current == null) return;
    hoverIdx.current = null;
    if (useApp.getState().hover?.startsWith("person:")) setHover(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active() || e.instanceId == null || e.delta > 6) return;
    e.stopPropagation();
    rt.clickHandled = true;
    select({ kind: "person", id: fl.people[e.instanceId].id });
  };

  return (
    <group>
      <primitive object={crowd.mesh} />
      <instancedMesh ref={hit} args={[hitGeo, mats.hit, N]} onPointerMove={onMove} onPointerOut={onOut} onClick={onClick} />
      <instancedMesh ref={pilotRef} args={[pilotGeo, pilotMatGet(), N]} renderOrder={4} frustumCulled={false} />
      {agents.length > 0 && (
        <>
          <instancedMesh ref={orb} args={[orbGeo, mats.orb, agents.length]} renderOrder={2} />
          <instancedMesh ref={halo} args={[haloPlane, mats.halo, agents.length]} renderOrder={3} />
        </>
      )}
    </group>
  );
}

const haloPlane = new THREE.PlaneGeometry(1.1, 1.1);
const pilotGeo = new THREE.PlaneGeometry(1, 1);
let pilotMatCache: THREE.MeshBasicMaterial | null = null;
const pilotMatGet = () => (pilotMatCache ??= new THREE.MeshBasicMaterial({ map: haloTexture(), color: "#6F8CFF", transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
const qFlat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _rs = new THREE.Vector3();
/** 1 if this person is drawn in `year`, 0 if their post was not replaced (staffing.ts). */
function presenceTarget(dept: string, shrink: number, year: Year) {
  return shrink < 0 || shrink < keptShrinkable(dept, year) ? 1 : 0;
}
const orbGeo = new THREE.SphereGeometry(0.095, 18, 12);

/** Access to the R3F root state from anchor callbacks (set by HospitalScene). */
export const THREE_STATE: { get: (() => { camera: THREE.Camera; gl: THREE.WebGLRenderer }) | null } = { get: null };
