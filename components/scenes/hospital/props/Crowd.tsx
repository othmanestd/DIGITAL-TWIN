"use client";
// The non-staff crowd of a floor (patients, visitors, families), instanced with the figure primitives of People.tsx
// (same proportions and rig): seated people sit on a recognised seat (hip on the seat top, facing the seat's way),
// standing people shift their weight and look around, walkers move slowly along clear lanes (an IV pole, a wheelchair
// pushed by a relative) and stop for the walking visitor. Not clickable, no staff.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAIN, ANNEX } from "@/lib/hospital";
import { FIGURE } from "../People";
import { W, walkOn } from "../../walk/state";
import { Kit, C } from "./kit";
import * as F from "./furniture";
import { mergeParts } from "./geo";
import type { CrowdSpec, Look } from "./crowdSpec";
import type { PropMats } from "./FloorProps";

type Fig = {
  look: Look; seed: number;
  kind: "sit" | "stand" | "walk";
  act: string;
  x: number; z: number; yaw: number; y: number; // seated / standing pose (floor-local); y = root height
  walker: number; dx: number; dz: number; role: string;
};

/** Live positions of the crowd (floor-local, per floor key) for anyone who wants them (walk-mode soft collisions). */
export const CROWD_POS = new Map<string, Float32Array>();

const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _root = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _v = new THREE.Vector3(), _c = new THREE.Color();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function part(out: THREE.Matrix4, px: number, py: number, pz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number, order: THREE.EulerOrder = "XYZ") {
  _e.set(rx, ry, rz, order); _q.setFromEuler(_e);
  _m.compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz));
  out.multiplyMatrices(_root, _m);
}
function dampAngle(a: number, b: number, k: number) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }

/** small accessory geometries built with the props kit (merged, vertex coloured) */
function accessory(fn: (k: Kit) => void) { const k = new Kit(); fn(k); return mergeParts(k.parts)!; }
const ACC = {
  wheel: () => accessory((k) => F.wheelchair(k.at(0, 0, 0), C.navy)),
  iv: () => accessory((k) => {
    const f = k.at(0, 0, 0);
    f.cyl("satin", C.dark, 0, 0.05, 0, 0.5, 0.04);
    for (let i = 0; i < 5; i++) f.cyl("satin", C.dark, Math.sin(i * 1.26) * 0.22, 0.03, Math.cos(i * 1.26) * 0.22, 0.06, 0.05, { roll: Math.PI / 2 });
    f.cyl("metal", C.chrome, 0, 1.0, 0, 0.03, 1.95); f.box("metal", C.chrome, 0, 1.95, 0, 0.26, 0.02, 0.02);
    f.rbox("glass", C.bottle, 0.1, 1.78, 0, 0.12, 0.22, 0.05); f.rbox("satin", C.white, 0, 1.2, 0.06, 0.18, 0.22, 0.12);
    f.box("glow", C.ledGreen, 0, 1.24, 0.125, 0.08, 0.04, 0.004); f.box("matte", C.light, 0.08, 1.45, 0.03, 0.006, 0.5, 0.006);
  }),
  phone: () => accessory((k) => { const f = k.at(0, 0, 0); f.box("satin", C.black, 0, 0, 0, 0.075, 0.15, 0.012); f.box("satin", 0x30436f, 0, 0, 0.007, 0.065, 0.13, 0.002); }),
  cup: () => accessory((k) => { const f = k.at(0, 0, 0); f.cyl("satin", C.white, 0, 0, 0, 0.08, 0.1); f.cyl("matte", 0x6b4a33, 0, 0.051, 0, 0.068, 0.004); }),
  book: () => accessory((k) => { const f = k.at(0, 0, 0); f.box("satin", C.coral, 0, 0, 0, 0.3, 0.012, 0.22); f.box("matte", C.paper, 0, 0.008, 0, 0.28, 0.006, 0.2); }),
  baby: () => accessory((k) => { const f = k.at(0, 0, 0); f.sph("matte", C.cream, 0, 0, 0, 0.36, 0.16, 0.2); f.sph("matte", 0xf0d9d4, 0.16, 0.04, 0, 0.12, 0.11, 0.12); f.sph("matte", 0xe7cbb2, 0.17, 0.045, 0.01, 0.09, 0.09, 0.09); }),
};
type AccKey = keyof typeof ACC;
const ACC_KEYS = Object.keys(ACC) as AccKey[];

export default function Crowd({ spec, mats, building, floor }: { spec: CrowdSpec; mats: PropMats; building: "main" | "annex"; floor: number }) {
  const figs = useMemo<Fig[]>(() => {
    const out: Fig[] = [];
    for (const s of spec.seated) out.push({ look: s.look, seed: s.seed, kind: "sit", act: s.act, x: s.x, z: s.z, yaw: s.yaw, y: s.top - 0.5 * (s.look.kid ? 0.62 : 1), walker: -1, dx: 0, dz: 0, role: "" });
    for (const s of spec.standing) out.push({ look: s.look, seed: s.seed, kind: "stand", act: s.act, x: s.x, z: s.z, yaw: s.yaw, y: 0, walker: -1, dx: 0, dz: 0, role: "" });
    spec.walkers.forEach((w, wi) => w.members.forEach((m) => out.push({
      look: m.look, seed: Math.floor(w.phase * 997 + m.dx * 31), kind: m.role === "wheel" ? "sit" : "walk", act: m.role === "wheel" ? "rest" : "walk",
      x: 0, z: 0, yaw: 0, y: m.role === "wheel" ? 0.02 : 0, walker: wi, dx: m.dx, dz: m.dz, role: m.role,
    })));
    return out;
  }, [spec]);
  const N = figs.length;
  const geo = useMemo(() => Object.fromEntries(ACC_KEYS.map((k) => [k, ACC[k]()])) as Record<AccKey, THREE.BufferGeometry>, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const acc = useMemo(() => {
    const n: Record<AccKey, number> = { wheel: 0, iv: 0, phone: 0, cup: 0, book: 0, baby: 0 };
    for (const f of figs) {
      if (f.role === "wheel") n.wheel++;
      if (f.role === "iv") n.iv++;
      if (f.act === "phone") n.phone++;
      if (f.act === "cup") n.cup++;
      if (f.act === "read") n.book++;
      if (f.act === "baby") n.baby++;
    }
    return n;
  }, [figs]);
  const torso = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), hair = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null), arms = useRef<THREE.InstancedMesh>(null), scarf = useRef<THREE.InstancedMesh>(null);
  const accRefs = useRef<Partial<Record<AccKey, THREE.InstancedMesh | null>>>({});
  const root = useRef<THREE.Group>(null);
  const key = `${building}:${floor}`;
  const st = useMemo(() => {
    const n = spec.walkers.length;
    return {
      clock: Float32Array.from(spec.walkers.map((w) => w.phase * 40)),
      yaw: Float32Array.from(spec.walkers.map((w) => Math.atan2(w.path[2] - w.path[0], w.path[3] - w.path[1]))),
      x: new Float32Array(n), z: new Float32Array(n), px: new Float32Array(n).fill(NaN), pz: new Float32Array(n),
      amp: new Float32Array(n), dist: new Float32Array(n),
      pos: new Float32Array(figs.length * 2),
      ai: { wheel: 0, iv: 0, phone: 0, cup: 0, book: 0, baby: 0 } as Record<AccKey, number>,
    };
  }, [spec, figs]);
  useEffect(() => { CROWD_POS.set(key, st.pos); return () => { if (CROWD_POS.get(key) === st.pos) CROWD_POS.delete(key); }; }, [key, st]);
  const B = building === "main" ? MAIN : ANNEX;
  function put(k: AccKey, m: THREE.Matrix4) { const mesh = accRefs.current[k]; if (mesh) mesh.setMatrixAt(st.ai[k]++, m); }

  useEffect(() => {
    const setC = (mesh: THREE.InstancedMesh | null, per: number, f: (i: number) => number) => {
      if (!mesh) return;
      for (let i = 0; i < N; i++) for (let k = 0; k < per; k++) mesh.setColorAt(i * per + k, _c.setHex(f(i)));
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    setC(torso.current, 1, (i) => figs[i].look.torso);
    setC(arms.current, 2, (i) => figs[i].look.torso);
    setC(legs.current, 2, (i) => figs[i].look.legs);
    setC(head.current, 1, (i) => figs[i].look.skin);
    setC(hair.current, 1, (i) => figs[i].look.hair ?? 0);
    setC(scarf.current, 2, (i) => figs[i].look.scarfCol);
    for (const r of [torso, head, hair, legs, arms, scarf]) if (r.current) r.current.frustumCulled = false;
    for (const m of Object.values(accRefs.current)) if (m) m.frustumCulled = false;
  }, [figs, N]);

  useFrame((state, dt) => {
    let o: THREE.Object3D | null = root.current;
    while (o) { if (!o.visible) return; o = o.parent; }
    const T = torso.current, H = head.current, Hr = hair.current, Lg = legs.current, Ar = arms.current, Sc = scarf.current;
    if (!T || !H || !Hr || !Lg || !Ar || !Sc) return;
    const t = state.clock.elapsedTime, dts = Math.max(1e-3, Math.min(dt, 0.1));
    // walkers: advance along their lane (slowing at the ends), stop for the visitor in their way
    const here = walkOn() && W.where === building && W.level === floor;
    for (let i = 0; i < spec.walkers.length; i++) {
      const w = spec.walkers[i];
      const [x1, z1, x2, z2] = w.path;
      const L = Math.hypot(x2 - x1, z2 - z1) || 1;
      let block = false;
      if (here && !Number.isNaN(st.px[i])) {
        const dx = W.x - B.x - st.x[i], dz = W.z - B.z - st.z[i];
        block = dx * dx + dz * dz < 3.2 && dx * Math.sin(st.yaw[i]) + dz * Math.cos(st.yaw[i]) > -0.3;
      }
      if (!block) st.clock[i] += dts;
      const ph = st.clock[i] * ((2 * w.speed) / L);
      const a = (1 - Math.cos(ph)) / 2;
      const x = x1 + (x2 - x1) * a, z = z1 + (z2 - z1) * a;
      if (Number.isNaN(st.px[i])) { st.px[i] = x; st.pz[i] = z; }
      const mx = x - st.px[i], mz = z - st.pz[i], d = Math.hypot(mx, mz);
      st.dist[i] += d;
      st.amp[i] += (Math.min(1, d / dts / (w.speed * 0.45)) - st.amp[i]) * Math.min(1, dts * 6);
      if (d > 1e-4) st.yaw[i] = dampAngle(st.yaw[i], Math.atan2(mx, mz), 1 - Math.exp(-dts * 2.4));
      st.px[i] = x; st.pz[i] = z; st.x[i] = x; st.z[i] = z;
    }
    const ai = st.ai;
    ai.wheel = ai.iv = ai.phone = ai.cup = ai.book = ai.baby = 0;
    for (let i = 0; i < N; i++) {
      const f = figs[i], sd = f.seed * 0.37, lk = f.look, sc = lk.kid ? 0.62 : 1;
      let x = f.x, z = f.z, yaw = f.yaw, hip = 0.88, legL = 0, legR = 0, armL = 0.02, armR = 0.02, hy = 0, hp = 0, bob = 0, rollR = 0.07, rollL = -0.07;
      const y0 = f.y;
      const breathe = 1 + 0.013 * Math.sin(1.55 * t + sd);
      if (f.walker >= 0) {
        const w = f.walker, c = Math.cos(st.yaw[w]), s = Math.sin(st.yaw[w]);
        yaw = st.yaw[w];
        x = st.x[w] + f.dx * c + f.dz * s; z = st.z[w] - f.dx * s + f.dz * c;
        const amp = st.amp[w], gait = Math.sin((st.dist[w] * 3.4) / sc + f.dx * 2);
        if (f.role === "wheel") { hip = 0.5; legL = legR = -1.25; armL = armR = -0.55; hy = 0.25 * Math.sin(0.2 * t + sd); }
        else {
          legL = 0.42 * gait * amp; legR = -legL; bob = 0.025 * Math.abs(gait) * amp;
          armL = -0.32 * gait * amp; armR = -armL;
          if (f.role === "push") { armL = armR = -1.1; rollL = 0.05; rollR = -0.05; }
          if (f.role === "iv") { armR = -0.5; rollR = 0.2; hp = 0.12; }
          hy = 0.12 * Math.sin(0.4 * t + sd);
        }
      } else if (f.kind === "sit") {
        hip = 0.5; legL = legR = -1.05;
        armL = armR = -0.5; hy = 0.3 * Math.sin(0.19 * t + sd) * Math.sin(0.07 * t + sd * 2);
        if (f.act === "phone") { armR = -1.9; rollR = -0.35; hp = 0.3; hy = 0.04; }
        if (f.act === "talk") { hy = 0.45 * Math.sin(0.23 * t + sd); armR = -0.7 + 0.12 * Math.sin(1.7 * t + sd); }
        if (f.act === "read") { armL = armR = -1.05; rollL = 0.3; rollR = -0.3; hp = 0.38; hy = 0.04 * Math.sin(0.5 * t); }
        if (f.act === "cup") { armR = -1.25 - 0.4 * Math.max(0, Math.sin(0.35 * t + sd)); rollR = -0.15; }
        if (f.act === "baby") { armL = armR = -1.0; rollL = 0.42; rollR = -0.42; hp = 0.35; hy = 0.08 * Math.sin(0.6 * t); }
        if (f.act === "child") { legL = -1.05 + 0.25 * Math.sin(2.2 * t + sd); legR = -1.05 + 0.25 * Math.sin(2.2 * t + sd + 1.4); }
      } else {
        hy = 0.42 * Math.sin(0.21 * t + sd) * Math.sin(0.083 * t + sd * 2.3);
        hp = 0.05 * Math.sin(0.31 * t + sd);
        armL = 0.03 + 0.03 * Math.sin(1.55 * t + sd); armR = 0.03 - 0.03 * Math.sin(1.55 * t + sd);
        yaw += 0.06 * Math.sin(0.11 * t + sd);
        if (f.act === "talk") { armR = -0.55 + 0.2 * Math.sin(1.4 * t + sd); hy = 0.2 * Math.sin(0.5 * t + sd); }
        if (f.act === "cup") { armR = -1.35; rollR = -0.15; }
        if (f.act === "phone") { armR = -1.9; rollR = -0.35; hp = 0.25; }
      }
      st.pos[i * 2] = x; st.pos[i * 2 + 1] = z;
      _q.setFromAxisAngle(Y, yaw);
      _root.compose(_v.set(x, y0 + bob, z), _q, _s.set(sc, sc, sc));
      // torso (a long robe reaches the knees, like the doctors' coats)
      if (lk.long) part(_m, 0, hip + 0.2, 0, 0, 0, 0, 1.04, 1.32 * breathe, 0.76);
      else part(_m, 0, hip + 0.34, 0, 0, 0, 0, 1, breathe, 0.72);
      T.setMatrixAt(i, _m);
      part(_m, 0, hip + 0.87, 0.01, hp, hy, 0, 1, 1, 1, "YXZ"); H.setMatrixAt(i, _m);
      if (lk.hair && !lk.scarf) { part(_m, 0, hip + 0.875, 0, hp - 0.32, hy, 0, 1, 1, 1, "YXZ"); Hr.setMatrixAt(i, _m); } else Hr.setMatrixAt(i, ZERO);
      if (lk.scarf) {
        part(_m, 0, hip + 0.86, -0.012, hp - 0.12, hy, 0, 1.16, 1.32, 1.16, "YXZ"); Sc.setMatrixAt(i * 2, _m);
        part(_m, 0, hip + 0.69, 0, 0, hy * 0.3, 0, 0.78, 0.3, 0.7); Sc.setMatrixAt(i * 2 + 1, _m);
      } else { Sc.setMatrixAt(i * 2, ZERO); Sc.setMatrixAt(i * 2 + 1, ZERO); }
      part(_m, -0.1, hip, 0, legL, 0, 0, 1, 1, 1); Lg.setMatrixAt(i * 2, _m);
      part(_m, 0.1, hip, 0, legR, 0, 0, 1, 1, 1); Lg.setMatrixAt(i * 2 + 1, _m);
      part(_m, -0.26, hip + 0.62, 0, armL, 0, rollL, 1, 1, 1); Ar.setMatrixAt(i * 2, _m);
      part(_m, 0.26, hip + 0.62, 0, armR, 0, rollR, 1, 1, 1); Ar.setMatrixAt(i * 2 + 1, _m);
      // accessories: in the right hand (end of a 0.58 m arm: roll about z, then the arm swing about x)
      if (f.act === "phone" || f.act === "cup") {
        const L = 0.58, cr = Math.cos(rollR);
        part(_m, 0.26 + L * Math.sin(rollR), hip + 0.62 - L * cr * Math.cos(armR), -L * cr * Math.sin(armR), f.act === "phone" ? -0.5 : 0, 0, 0, 1, 1, 1);
        put(f.act === "phone" ? "phone" : "cup", _m);
      } else if (f.act === "read") { part(_m, 0, hip + 0.36, 0.36, -0.95, 0, 0, 1, 1, 1); put("book", _m); }
      else if (f.act === "baby") { part(_m, 0, hip + 0.3, 0.24, 0, -0.25, 0.15, 1, 1, 1); put("baby", _m); }
      if (f.role === "wheel") { part(_m, 0, -0.02, 0, 0, 0, 0, 1, 1, 1); put("wheel", _m); }
      else if (f.role === "iv") { part(_m, 0.42, 0, 0.12, 0, 0, 0, 1 / sc, 1 / sc, 1 / sc); put("iv", _m); }
    }
    T.instanceMatrix.needsUpdate = true; H.instanceMatrix.needsUpdate = true; Hr.instanceMatrix.needsUpdate = true;
    Lg.instanceMatrix.needsUpdate = true; Ar.instanceMatrix.needsUpdate = true; Sc.instanceMatrix.needsUpdate = true;
    for (const k of ACC_KEYS) { const m = accRefs.current[k]; if (m) m.instanceMatrix.needsUpdate = true; }
  });

  if (!N) return null;
  return (
    <group ref={root}>
      <instancedMesh ref={torso} args={[FIGURE.torsoGeo, mats.figure, N]} castShadow receiveShadow />
      <instancedMesh ref={head} args={[FIGURE.headGeo, mats.figure, N]} castShadow />
      <instancedMesh ref={hair} args={[FIGURE.hairGeo, mats.figure, N]} castShadow />
      <instancedMesh ref={scarf} args={[FIGURE.hairGeo, mats.figure, N * 2]} castShadow />
      <instancedMesh ref={legs} args={[FIGURE.legGeo, mats.figure, N * 2]} castShadow />
      <instancedMesh ref={arms} args={[FIGURE.armGeo, mats.figure, N * 2]} castShadow />
      {ACC_KEYS.filter((k) => acc[k] > 0).map((k) => (
        <instancedMesh key={k} ref={(r) => { accRefs.current[k] = r; }} args={[geo[k], mats.satin, acc[k]]} castShadow />
      ))}
    </group>
  );
}
