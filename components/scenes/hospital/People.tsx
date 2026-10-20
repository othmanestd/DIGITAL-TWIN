"use client";
// Stylised people of one floor (instanced: 6 draw calls per floor whatever the head count) + their AI agent companions.
// Each figure is built from primitives (legs, coat/torso, arms, head, hair) and animated procedurally:
// breathing, head turns, typing at desks, walking along short paths, lying in beds.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { useApp } from "@/lib/store";
import { registerAnchor } from "@/lib/anchors";
import type { FloorLayout } from "./layout";
import { haloTexture, rt, type FloorMats } from "./mats";
import { keptShrinkable, visibleStaff } from "./staffing";
import type { Year } from "@/lib/model";

const legGeo = new THREE.CapsuleGeometry(0.085, 0.7, 2, 7).translate(0, -0.435, 0);
const armGeo = new THREE.CapsuleGeometry(0.056, 0.5, 2, 6).translate(0, -0.3, 0);
const torsoGeo = new THREE.CapsuleGeometry(0.2, 0.36, 3, 12);
const headGeo = new THREE.SphereGeometry(0.13, 12, 9);
const hairGeo = new THREE.SphereGeometry(0.138, 12, 5, 0, Math.PI * 2, 0, Math.PI * 0.56);
const hitGeo = new THREE.BoxGeometry(0.75, 1.95, 0.7).translate(0, 0.97, 0);

const Y = new THREE.Vector3(0, 1, 0);
const qLie = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const _m = new THREE.Matrix4(), _root = new THREE.Matrix4(), _q = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _e = new THREE.Euler(), _v = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _c = new THREE.Color(), _w = new THREE.Color("#FFFFFF"), _sel = new THREE.Color("#C8D3FF");
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

function part(out: THREE.Matrix4, px: number, py: number, pz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, order: THREE.EulerOrder = "XYZ") {
  _e.set(rx, ry, rz, order);
  _q.setFromEuler(_e);
  _m.compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz));
  out.multiplyMatrices(_root, _m);
}

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function dampAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export default function People({ fl, mats, group, active }: {
  fl: FloorLayout; mats: FloorMats; group: React.RefObject<THREE.Group | null>; active: () => boolean;
}) {
  const N = fl.people.length;
  const torso = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), hair = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null), arms = useRef<THREE.InstancedMesh>(null), hit = useRef<THREE.InstancedMesh>(null);
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
  const shrinks = useMemo(() => fl.people.map((p) => p.shrink >= 0 && visibleStaff(p.dept, 2029).removed > 0), [fl]);
  const hover = useApp((s) => s.hover);
  const selIdx = sel?.kind === "person" ? fl.people.findIndex((p) => p.id === sel.id) : -1;
  const hovIdx = hover?.startsWith("person:") ? fl.people.findIndex((p) => "person:" + p.id === hover) : -1;
  const selRef = useRef(selIdx);
  selRef.current = selIdx;
  const camera = useThree((s) => s.camera);

  // colours (re-applied when hover / selection changes)
  useLayoutEffect(() => {
    const setC = (mesh: THREE.InstancedMesh | null, per: number, f: (i: number) => string, hl = false) => {
      if (!mesh) return;
      for (let i = 0; i < N; i++) {
        _c.set(f(i));
        if (hl && i === selIdx) _c.lerp(_sel, 0.45);
        else if (hl && i === hovIdx) _c.lerp(_w, 0.4);
        for (let k = 0; k < per; k++) mesh.setColorAt(i * per + k, _c);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    setC(torso.current, 1, (i) => fl.people[i].torso, true);
    setC(arms.current, 2, (i) => fl.people[i].torso, true);
    setC(legs.current, 2, (i) => fl.people[i].legs);
    setC(head.current, 1, (i) => fl.people[i].skin);
    setC(hair.current, 1, (i) => fl.people[i].hair ?? "#000000");
  }, [fl, N, selIdx, hovIdx]);

  useLayoutEffect(() => {
    for (const r of [torso, head, hair, legs, arms, hit, orb, halo]) {
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
    const T = torso.current!, H = head.current!, Hr = hair.current!, Lg = legs.current!, Ar = arms.current!, Hit = hit.current!;
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
      if (selRef.current !== i) st.clock[i] += dts;
      const ck = st.clock[i];
      let x = s.x, z = s.z, yaw = s.yaw, hip = 0.88, legL = 0, legR = 0, armL = 0.02, armR = 0.02, hy = 0, hp = 0, bob = 0;
      const y0 = s.y ?? 0;
      const breathe = 1 + 0.013 * Math.sin(1.55 * t + sd);
      if (s.pose === "walk" && s.path) {
        const [x1, z1, x2, z2] = s.path;
        const L = Math.hypot(x2 - x1, z2 - z1) || 1;
        const w = (2 * 0.8) / L;
        const ph = ck * w;
        const a = (1 - Math.cos(ph)) / 2;
        const vel = Math.sin(ph);
        x = x1 + (x2 - x1) * a; z = z1 + (z2 - z1) * a;
        const dist = a * L;
        const amp = Math.min(1, Math.abs(vel) * 2.4) * (selRef.current === i ? 0 : 1);
        const gait = Math.sin(dist * 3.6);
        legL = 0.5 * gait * amp; legR = -legL; armL = -0.38 * gait * amp; armR = -armL;
        bob = 0.03 * Math.abs(gait) * amp;
        const base = Math.atan2(x2 - x1, z2 - z1);
        const target = vel >= 0 ? base : base + Math.PI;
        st.yaw[i] = dampAngle(st.yaw[i], target, 1 - Math.exp(-dts * 5));
        yaw = st.yaw[i];
        hy = 0.15 * Math.sin(0.4 * t + sd);
      } else if (s.pose === "sit") {
        hip = 0.5; legL = legR = -1.05;
        if (s.type) {
          armL = -1.12 + 0.05 * Math.sin(12 * t + sd); armR = -1.12 + 0.05 * Math.sin(12 * t + sd + 1.9);
          hp = 0.1 + 0.04 * Math.sin(0.3 * t + sd); hy = 0.12 * Math.sin(0.17 * t + sd) * Math.max(0, Math.sin(0.05 * t + sd));
        } else {
          armL = armR = -0.5; hy = 0.35 * Math.sin(0.19 * t + sd) * Math.sin(0.07 * t + sd * 2);
        }
      } else if (s.pose === "lie") {
        hy = 0.3 * Math.sin(0.13 * t + sd); armL = armR = 0;
      } else {
        hy = 0.42 * Math.sin(0.21 * t + sd) * Math.sin(0.083 * t + sd * 2.3);
        hp = 0.05 * Math.sin(0.31 * t + sd);
        armL = 0.03 + 0.03 * Math.sin(1.55 * t + sd); armR = 0.03 - 0.03 * Math.sin(1.55 * t + sd);
        yaw += 0.06 * Math.sin(0.11 * t + sd);
      }
      let vs = 1;
      if (pr < 0.999) {
        const w = smooth((1 - pr) / 0.7);              // walk towards the door …
        const [dx, dz] = p.door;
        const bx = x, bz = z;
        x = bx + (dx - bx) * w; z = bz + (dz - bz) * w;
        if (w > 0.001) {
          const up = smooth(w / 0.15);                  // … standing up first if seated
          hip = hip + (0.88 - hip) * up;
          const gait = Math.sin(w * Math.hypot(dx - bx, dz - bz) * 3.6) * up;
          legL = legL * (1 - up) + 0.5 * gait; legR = legR * (1 - up) - 0.5 * gait;
          armL = armL * (1 - up) - 0.38 * gait; armR = armR * (1 - up) + 0.38 * gait;
          yaw = dampAngle(yaw, Math.atan2(dx - bx, dz - bz), up);
        }
        vs = smooth(pr / 0.3);                          // … then fade (shrink) away at the door
      }
      st.vis[i] = vs;
      _qy.setFromAxisAngle(Y, yaw);
      if (s.pose === "lie") _qy.multiply(qLie);
      _root.compose(_v.set(x, y0 + bob, z), _qy, _rs.set(vs, vs, vs));

      // torso / coat
      if (p.coat) part(_m, 0, hip + 0.2, 0, 0, 0, 0, 1.04, 1.32 * breathe, 0.76);
      else part(_m, 0, hip + 0.34, 0, 0, 0, 0, 1, breathe, 0.72);
      T.setMatrixAt(i, _m);
      // head + hair
      part(_m, 0, hip + 0.87, 0.01, hp, hy, 0, 1, 1, 1, "YXZ");
      H.setMatrixAt(i, _m);
      if (p.hair) {
        part(_m, 0, hip + 0.875, 0.0, hp - 0.32, hy, 0, 1, 1, 1, "YXZ");
        Hr.setMatrixAt(i, _m);
      } else Hr.setMatrixAt(i, ZERO);
      // legs
      part(_m, -0.1, hip, 0, legL, 0, 0, 1, 1, 1); Lg.setMatrixAt(i * 2, _m);
      part(_m, 0.1, hip, 0, legR, 0, 0, 1, 1, 1); Lg.setMatrixAt(i * 2 + 1, _m);
      // arms
      part(_m, -0.26, hip + 0.62, 0, armL, 0, -0.07, 1, 1, 1); Ar.setMatrixAt(i * 2, _m);
      part(_m, 0.26, hip + 0.62, 0, armR, 0, 0.07, 1, 1, 1); Ar.setMatrixAt(i * 2 + 1, _m);
      // hit proxy
      if (pr < 0.3) Hit.setMatrixAt(i, ZERO);
      else { part(_m, 0, s.pose === "sit" ? -0.25 : 0, 0, 0, 0, 0, 1, 1, 1); Hit.setMatrixAt(i, _m); }
      // pilots: the remaining staff of a shrinking department get a soft blue halo once agents are at work
      if (PL) {
        const pt = shrinks[i] && tgt > 0.5 ? smooth(rt.eco / 0.3) : 0;
        st.pilot[i] += (pt - st.pilot[i]) * Math.min(1, dts * 2);
        const k = st.pilot[i] * vs;
        if (k < 0.01) PL.setMatrixAt(i, ZERO);
        else { _m.compose(_v.set(x, y0 + 0.025, z), qFlat, _rs.set(1.5 * k, 1.5 * k, 1.5 * k)); PL.setMatrixAt(i, _m); }
      }
      // chest in world space (anchors, highlight ring, tooltips)
      st.local[i].set(0, hip + 0.3, 0).applyMatrix4(_root);
      st.chest[i].copy(st.local[i]).applyMatrix4(g.matrixWorld);
      rt.pos.set(p.id, st.chest[i]);
    }
    T.instanceMatrix.needsUpdate = true; H.instanceMatrix.needsUpdate = true; Hr.instanceMatrix.needsUpdate = true;
    if (PL) PL.instanceMatrix.needsUpdate = true;
    Lg.instanceMatrix.needsUpdate = true; Ar.instanceMatrix.needsUpdate = true; Hit.instanceMatrix.needsUpdate = true;

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
        // person position (floor-local) from the chest (world) minus the floor offset
        const px = st.local[i].x, pz = st.local[i].z;
        const tx = px + (lx + orbit) * c + lz * sn, tz = pz - (lx + orbit) * sn + lz * c, ty = (s.y ?? 0) + h;
        const o = st.orb[i];
        if (Number.isNaN(o.x)) o.set(tx, ty, tz); else o.set(o.x + (tx - o.x) * k, o.y + (ty - o.y) * k, o.z + (tz - o.z) * k);
        const sc = a * st.vis[i] * (1 + 0.06 * Math.sin(2.1 * t + sd));
        _m.compose(o, _q.identity(), _s.set(sc, sc, sc));
        O.setMatrixAt(j, _m);
        _m.compose(o, camera.quaternion, _s.set(sc * 1.15, sc * 1.15, sc * 1.15));
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
      <instancedMesh ref={torso} args={[torsoGeo, mats.figure, N]} castShadow receiveShadow />
      <instancedMesh ref={head} args={[headGeo, mats.figure, N]} castShadow />
      <instancedMesh ref={hair} args={[hairGeo, mats.figure, N]} castShadow />
      <instancedMesh ref={legs} args={[legGeo, mats.figure, N * 2]} castShadow />
      <instancedMesh ref={arms} args={[armGeo, mats.figure, N * 2]} castShadow />
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
