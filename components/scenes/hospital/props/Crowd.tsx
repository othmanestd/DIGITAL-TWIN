"use client";
// The non-staff crowd of a floor (patients, visitors, families), drawn with the shared human kit (one instanced draw call):
// seated people sit on a recognised seat (hip on the seat top, thighs level, feet on the floor, facing the seat's way),
// standing people shift their weight and look around, walkers move slowly along clear lanes (a patient holding an IV pole,
// a wheelchair pushed by a relative with both hands on its handles) and stop for the walking visitor. Phones, cups, books
// and babies sit in the hands. Not clickable, no staff.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { MAIN, ANNEX } from "@/lib/hospital";
import { W, walkOn } from "../../walk/state";
import { Kit, C } from "./kit";
import * as F from "./furniture";
import { mergeParts } from "./geo";
import { humanOf, type CrowdSpec, type Look } from "./crowdSpec";
import type { PropMats } from "./FloorProps";
import { BONE, newPose, posePhone, poseIdle, posePush, poseSit, poseWalk } from "../../people/human";
import { useHumanCrowd } from "../../people/useHumans";

type Fig = {
  look: Look; seed: number;
  kind: "sit" | "stand" | "walk";
  act: string;
  x: number; z: number; yaw: number; top: number; // seated / standing pose (floor-local); top = seat top
  walker: number; dx: number; dz: number; role: string;
};

/** Live positions of the crowd (floor-local, per floor key) for anyone who wants them (walk-mode soft collisions). */
export const CROWD_POS = new Map<string, Float32Array>();

const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _s = new THREE.Vector3();
const P = newPose();
const WHEEL_SEAT = 0.52, WHEEL_FOOT = 0.08;   // wheelchair seat top and footrest (props/furniture.ts)
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
    for (const s of spec.seated) out.push({ look: s.look, seed: s.seed, kind: "sit", act: s.act, x: s.x, z: s.z, yaw: s.yaw, top: s.top, walker: -1, dx: 0, dz: 0, role: "" });
    for (const s of spec.standing) out.push({ look: s.look, seed: s.seed, kind: "stand", act: s.act, x: s.x, z: s.z, yaw: s.yaw, top: 0, walker: -1, dx: 0, dz: 0, role: "" });
    spec.walkers.forEach((w, wi) => w.members.forEach((m) => out.push({
      look: m.look, seed: Math.floor(w.phase * 997 + m.dx * 31), kind: m.role === "wheel" ? "sit" : "walk", act: m.role === "wheel" ? "rest" : "walk",
      x: 0, z: 0, yaw: 0, top: WHEEL_SEAT, walker: wi, dx: m.dx, dz: m.dz, role: m.role,
    })));
    return out;
  }, [spec]);
  const N = figs.length;
  const crowd = useHumanCrowd(N);
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
    figs.forEach((f, i) => crowd.setLook(i, humanOf(f.look, f.seed * 7919 + i)));
    for (const m of Object.values(accRefs.current)) if (m) m.frustumCulled = false;
  }, [figs, crowd]);

  useFrame((state, dt) => {
    let o: THREE.Object3D | null = root.current;
    while (o) { if (!o.visible) return; o = o.parent; }
    crowd.sync(mats.figure);
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
      const f = figs[i], sd = f.seed * 0.37, sc = f.look.kid ? 0.62 : 1, hs = sc * crowd.height[i];
      let x = f.x, z = f.z, yaw = f.yaw;
      if (f.walker >= 0) {
        const w = f.walker, c = Math.cos(st.yaw[w]), s = Math.sin(st.yaw[w]);
        yaw = st.yaw[w];
        x = st.x[w] + f.dx * c + f.dz * s; z = st.z[w] - f.dx * s + f.dz * c;
        const amp = st.amp[w], ph = (st.dist[w] * 3.6) / hs + f.dx * 2;
        if (f.role === "wheel") poseSit(P, WHEEL_SEAT, hs, t, sd, WHEEL_FOOT);
        else if (f.role === "push") posePush(P, ph, amp, 0.235, 1.0, 0.43, hs);            // the wheelchair's handles, 0.82 m ahead
        else {
          poseWalk(P, ph, amp, crowd.robe[i] === 1);
          if (f.role === "iv") { P.ikL = 1; P.txL = 0.39 / hs; P.tyL = 1.08 / hs; P.tzL = 0.13 / hs; P.hp = 0.12; }
          P.hy += 0.12 * Math.sin(0.4 * t + sd);
        }
      } else if (f.kind === "sit") {
        poseSit(P, f.top, hs, t, sd);
        const hip = P.hipY;
        if (f.act === "phone") posePhone(P, t, sd, hip + 0.5);
        if (f.act === "talk") { P.hy = 0.45 * Math.sin(0.23 * t + sd); P.ikR = 1; P.tyR = hip + 0.22 + 0.04 * Math.sin(1.7 * t + sd); P.tzR = 0.34; P.txR = -0.16; }
        if (f.act === "read") { P.txL = 0.11; P.txR = -0.11; P.tyL = P.tyR = hip + 0.24; P.tzL = P.tzR = 0.33; P.hp = 0.48; P.hy = 0.04 * Math.sin(0.5 * t); }
        if (f.act === "cup") { const lift = Math.max(0, Math.sin(0.35 * t + sd)); P.ikR = 1; P.txR = -0.12 + 0.07 * lift; P.tyR = hip + 0.2 + 0.32 * lift; P.tzR = 0.3 - 0.13 * lift; }
        if (f.act === "baby") { P.txL = 0.06; P.txR = -0.1; P.tyL = P.tyR = hip + 0.17; P.tzL = P.tzR = 0.26; P.hp = 0.38; P.hy = 0.08 * Math.sin(0.6 * t); }
        if (f.act === "child") { P.lkL += 0.28 * Math.sin(2.2 * t + sd); P.lkR += 0.28 * Math.sin(2.2 * t + sd + 1.4); }
      } else {
        poseIdle(P, t, sd);
        yaw += 0.06 * Math.sin(0.11 * t + sd);
        if (f.act === "talk") { P.ikR = 1; P.txR = -0.17; P.tyR = 1.05 + 0.05 * Math.sin(1.4 * t + sd); P.tzR = 0.3; P.hy = 0.2 * Math.sin(0.5 * t + sd); }
        if (f.act === "cup") { P.ikR = 1; P.txR = -0.1; P.tyR = 1.08; P.tzR = 0.26; }
        if (f.act === "phone") posePhone(P, t, sd);
      }
      st.pos[i * 2] = x; st.pos[i * 2 + 1] = z;
      crowd.write(i, x, 0, z, yaw, sc, P);
      // accessories: in the hands (phone, cup), between them (book), on the lap (baby), or under / beside the person
      if (f.act === "phone" || f.act === "cup") {
        crowd.point(_v, BONE.farmR, 0, -0.31, f.act === "phone" ? 0.015 : 0.03);
        _q.setFromEuler(_e.set(f.act === "phone" ? -0.35 : 0, yaw + (f.act === "phone" ? Math.PI : 0), 0, "YXZ"));
        _m.compose(f.act === "cup" ? _v.setY(_v.y - 0.02) : _v, _q, _s.set(sc, sc, sc));
        put(f.act === "phone" ? "phone" : "cup", _m);
      } else if (f.act === "read") {
        crowd.point(_v, BONE.farmL, 0, -0.31, 0.02); crowd.point(_v2, BONE.farmR, 0, -0.31, 0.02); _v.add(_v2).multiplyScalar(0.5);
        _q.setFromEuler(_e.set(-0.95, yaw, 0, "YXZ")); _m.compose(_v.setY(_v.y + 0.02), _q, _s.set(sc, sc, sc)); put("book", _m);
      } else if (f.act === "baby") {
        crowd.point(_v, BONE.pelvis, 0, 0.17, 0.25);
        _q.setFromEuler(_e.set(0, yaw - 0.25, 0.15, "YXZ")); _m.compose(_v, _q, _s.set(1, 1, 1)); put("baby", _m);
      }
      if (f.role === "wheel") { _q.setFromAxisAngle(Y, yaw); _m.compose(_v.set(x, 0, z), _q, _s.set(1, 1, 1)); put("wheel", _m); }
      else if (f.role === "iv") { _q.setFromAxisAngle(Y, yaw); _m.compose(_v.set(x + 0.42 * Math.cos(yaw) + 0.12 * Math.sin(yaw), 0, z - 0.42 * Math.sin(yaw) + 0.12 * Math.cos(yaw)), _q, _s.set(1, 1, 1)); put("iv", _m); }
    }
    for (const k of ACC_KEYS) { const m = accRefs.current[k]; if (m) m.instanceMatrix.needsUpdate = true; }
  });

  if (!N) return null;
  return (
    <group ref={root}>
      <primitive object={crowd.mesh} />
      {ACC_KEYS.filter((k) => acc[k] > 0).map((k) => (
        <instancedMesh key={k} ref={(r) => { accRefs.current[k] = r; }} args={[geo[k], mats.satin, acc[k]]} castShadow />
      ))}
    </group>
  );
}
