"use client";
// The guided visit's stage, inside the campus group of the hospital (building frame of lib/hospital): the six fictional
// characters (low-poly, one accent each, a soft pool of light under their feet), their walks and gestures, the 2026 → 2031
// props (StoryProps), the alerts of Keeps and the pings of the JABB Twin, screen anchors for the DOM overlay
// ("story:<id>", "spot:<id>"), and the story camera (cinematic dollies between shots, lib/ai/story.ts → cam).
// Renders nothing unless a visit is playing. Mounted once in HospitalContent.
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useStory, CAST_IDS, type CastId, type Pose } from "@/lib/ai/story";
import { useApp } from "@/lib/store";
import { registerAnchor } from "@/lib/anchors";
import { rig } from "@/lib/rig";
import { FIGURE } from "../hospital/People";
import { haloTexture, rt } from "../hospital/mats";
import { focusOf, toWorld } from "../hospital/nav";
import { SHOTS, floorY } from "./spots";
import { spot, groupOffset } from "./place";
import { LOOKS } from "./cast";
import StoryProps from "./StoryProps";
import { STAGE, floorShown } from "./stage";
export { STAGE };

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
function dampAngle(a: number, b: number, k: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ---------------------------------------------------------------- geometry of the silhouettes
const G = {
  skirt: new THREE.CylinderGeometry(0.2, 0.31, 0.62, 16),
  hijab: new THREE.SphereGeometry(0.158, 16, 12),
  neck: new THREE.CylinderGeometry(0.12, 0.22, 0.24, 16),
  cap: new THREE.CylinderGeometry(0.142, 0.142, 0.07, 16),
  visor: new THREE.BoxGeometry(0.17, 0.018, 0.13),
  scarf: new THREE.TorusGeometry(0.13, 0.042, 8, 20),
  scarfEnd: new THREE.BoxGeometry(0.09, 0.26, 0.04),
  longHair: new THREE.CapsuleGeometry(0.12, 0.22, 3, 10),
  bun: new THREE.SphereGeometry(0.068, 10, 8),
  collar: new THREE.BoxGeometry(0.2, 0.06, 0.05),
  badge: new THREE.BoxGeometry(0.06, 0.085, 0.012),
  belt: new THREE.TorusGeometry(0.205, 0.028, 6, 22),
  tablet: new THREE.BoxGeometry(0.2, 0.28, 0.016),
  screen: new THREE.PlaneGeometry(0.17, 0.24),
  pool: new THREE.PlaneGeometry(2.6, 2.6),
  ring: new THREE.RingGeometry(0.92, 1.0, 56),
};
const qFlat = new THREE.Euler(-Math.PI / 2, 0, 0);

type Plan = { path: [number, number][]; pose: Pose; yawEnd: number; floor: string; seat: boolean };

function Member({ id }: { id: CastId }) {
  const look = LOOKS[id];
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const mats = useMemo(() => {
    const m = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.78, transparent: true, ...o });
    return {
      skin: m(look.skin), hair: m(look.hair ?? "#222"), torso: m(look.torso), legs: m(look.legs), arms: m(look.arms ?? look.torso),
      hijab: m(look.hijab ?? "#999"), skirt: m(look.skirt ?? "#999"), cap: m(look.cap ?? "#444"), scarf: m(look.scarf ?? "#999"),
      collar: m(look.collar ?? "#fff"), belt: m(look.belt ?? "#333"), badge: m("#F3F4F7", { emissive: new THREE.Color("#7C93FF"), emissiveIntensity: 0.25 }),
      tablet: m("#1C2233", { roughness: 0.4 }), screen: new THREE.MeshBasicMaterial({ color: "#9CB0FF", transparent: true, toneMapped: false }),
      pool: new THREE.MeshBasicMaterial({ map: haloTexture(), color: look.accent, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: look.accent, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    };
  }, [look]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const all = useMemo(() => Object.entries(mats).filter(([k]) => k !== "pool" && k !== "ring").map(([, v]) => v), [mats]);

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null), legR = useRef<THREE.Mesh>(null), armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null), head = useRef<THREE.Group>(null), tab = useRef<THREE.Group>(null), skirt = useRef<THREE.Mesh>(null);
  const pool = useRef<THREE.Mesh>(null), ring = useRef<THREE.Mesh>(null);
  const S = useRef({
    x: 0, z: 0, yaw: 0, floor: "out", vis: 0, want: 0, plan: null as Plan | null, next: null as Plan | null, seg: 0, segT: 0, walkPh: 0,
    hip: 0.88, legA: 0, legB: 0, armA: 0.03, armB: 0.03, tilt: 0, tabK: 0, nonce: -1, placed: false, chipT: -1e9, seed: Math.random() * 100,
  });

  // the store → a plan (walk along from/via/at, or dissolve to the new spot)
  useEffect(() => {
    const h = (st: ReturnType<typeof useStory.getState>) => {
    const m = st.on ? st.cast[id] : undefined;
    const s = S.current;
    const chip = st.chips.filter((c) => c.id === id).pop();
    if (chip) s.chipT = chip.t;
    if (!m) { s.want = 0; s.nonce = -1; return; }
    if (m.nonce === s.nonce) return;
    s.nonce = m.nonce;
    const dest = spot(m.place.at);
    if (!dest) return;
    const pose: Pose = m.place.pose ?? (dest.seat ? "sit" : "stand");
    const path: [number, number][] = [];
    const from = m.place.from ? spot(m.place.from) : null;
    for (const v of m.place.via ?? []) { const p = spot(v); if (p) path.push([p.x, p.z]); }
    path.push([dest.x, dest.z]);
    const plan: Plan = { path, pose, yawEnd: dest.yaw, floor: dest.floor, seat: !!dest.seat };
    const visible = s.vis > 0.05 && s.placed;
    if (from && (!visible || s.floor !== dest.floor)) {
      // appear at the start of the walk, then walk
      s.x = from.x; s.z = from.z; s.yaw = Math.atan2(path[0][0] - from.x, path[0][1] - from.z); s.floor = dest.floor; s.placed = true;
      s.plan = plan; s.seg = 0; s.next = null;
      if (!visible) s.vis = 0;
    } else if (from || (visible && Math.hypot(dest.x - s.x, dest.z - s.z) < 0.4)) {
      s.plan = plan; s.seg = 0; s.next = null; // walk from where they stand
    } else if (visible) {
      s.next = plan; // dissolve: fade out, move, fade in
    } else {
      s.x = dest.x; s.z = dest.z; s.yaw = dest.yaw; s.floor = dest.floor; s.placed = true; s.plan = { ...plan, path: [] }; s.next = null;
    }
    s.want = 1;
    };
    h(useStory.getState());
    return useStory.subscribe(h);
  }, [id]);

  // anchor for the DOM chips and the value threads: just above the head
  useEffect(() => {
    const v = new THREE.Vector3();
    return registerAnchor("story:" + id, () => {
      const s = S.current;
      if (s.vis < 0.05 || !root.current) return null;
      root.current.updateWorldMatrix(true, false);
      v.set(0, 2.05, 0).applyMatrix4(root.current.matrixWorld).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
    });
  }, [id, camera, gl]);

  useFrame((state, dtRaw) => {
    const s = S.current;
    const dt = Math.min(dtRaw, 0.5); // real time (slow machines keep the timing of the narration)
    const t = state.clock.elapsedTime;
    const g = root.current;
    if (!g) return;
    // presence: wanted, floor in view, not being dissolved to another spot
    const shown = s.want > 0 && s.placed && floorShown(s.floor) && useApp.getState().walk.phase === "off";
    const target = s.next ? 0 : shown ? 1 : 0;
    s.vis += Math.max(-dt / 0.55, Math.min(dt / 0.8, target - s.vis));
    if (s.next && s.vis <= 0.001) {
      const p = s.next; s.next = null;
      const end = p.path[p.path.length - 1];
      s.x = end[0]; s.z = end[1]; s.yaw = p.yawEnd; s.floor = p.floor; s.plan = { ...p, path: [] };
    }
    STAGE.vis.set(id, s.vis);
    g.visible = s.vis > 0.004;
    if (!g.visible) { STAGE.pos.delete(id); return; }

    // walking along the plan
    let walking = false, pose: Pose = s.plan?.pose ?? "stand";
    const plan = s.plan;
    if (plan && s.seg < plan.path.length) {
      const [tx, tz] = plan.path[s.seg];
      const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
      if (d < 0.05) s.seg++;
      else {
        walking = true;
        const sp = Math.min(d, 1.25 * dt * smooth(0.25 + s.vis));
        s.x += (dx / d) * sp; s.z += (dz / d) * sp;
        s.yaw = dampAngle(s.yaw, Math.atan2(dx, dz), 1 - Math.exp(-dt * 8));
        s.walkPh += sp * 3.4;
      }
    }
    if (!walking && plan) s.yaw = dampAngle(s.yaw, plan.yawEnd, 1 - Math.exp(-dt * 3));
    const seat = !!plan?.seat;
    // pose targets
    let hip = 0.88, legA = 0, legB = 0, armA = 0.03, armB = 0.03, tilt = 0, tabK = 0;
    if (walking) {
      const gait = Math.sin(s.walkPh);
      legA = 0.5 * gait; legB = -legA; armA = -0.36 * gait; armB = -armA;
    } else if (pose === "sit" || (pose === "type" && seat)) {
      hip = 0.5; legA = legB = -1.05; armA = armB = -0.5;
      if (pose === "type") { armA = -1.12 + 0.05 * Math.sin(12 * t + s.seed); armB = -1.12 + 0.05 * Math.sin(12 * t + s.seed + 1.9); tilt = 0.06; }
    } else if (pose === "type") {
      armA = -1.0 + 0.05 * Math.sin(11 * t + s.seed); armB = -1.0 + 0.05 * Math.sin(11 * t + s.seed + 2); tilt = 0.1;
    } else if (pose === "tablet") {
      armA = -1.25; armB = -0.95 + 0.06 * Math.sin(3.1 * t + s.seed); tabK = 1; tilt = 0.04;
    } else if (pose === "kneel") {
      hip = 0.6; legA = -1.25; legB = 0.2; armA = -0.9; armB = -0.7 + 0.05 * Math.sin(2 * t); tilt = 0.32;
    } else {
      armA = 0.03 + 0.03 * Math.sin(1.55 * t + s.seed); armB = 0.03 - 0.03 * Math.sin(1.55 * t + s.seed);
    }
    const k = 1 - Math.exp(-dt * 7);
    s.hip += (hip - s.hip) * k; s.legA += (legA - s.legA) * k; s.legB += (legB - s.legB) * k;
    s.armA += (armA - s.armA) * k; s.armB += (armB - s.armB) * k; s.tilt += (tilt - s.tilt) * k; s.tabK += (tabK - s.tabK) * k;

    g.position.set(s.x, floorY(s.floor), s.z);
    g.rotation.y = s.yaw;
    const sc = 0.92 + 0.08 * smooth(s.vis);
    if (body.current) {
      body.current.scale.setScalar(sc);
      body.current.position.y = s.hip - 0.88 + (walking ? 0.03 * Math.abs(Math.sin(s.walkPh)) : 0);
    }
    if (upper.current) upper.current.rotation.x = s.tilt;
    if (legL.current) legL.current.rotation.x = s.legA;
    if (legR.current) legR.current.rotation.x = s.legB;
    if (armL.current) armL.current.rotation.x = s.armA;
    if (armR.current) armR.current.rotation.x = s.armB;
    if (head.current) { head.current.rotation.y = 0.3 * Math.sin(0.23 * t + s.seed) * Math.sin(0.09 * t + s.seed); head.current.rotation.x = 0.04 * Math.sin(0.31 * t + s.seed) + (s.tabK * 0.25); }
    if (skirt.current) skirt.current.visible = s.hip > 0.7;
    if (tab.current) { tab.current.visible = s.tabK > 0.05; tab.current.scale.setScalar(Math.max(0.001, s.tabK)); }
    // fade
    const op = smooth(s.vis);
    for (const m of all) m.opacity = op;
    // pool of light, brighter when the character is introduced / named
    const since = (performance.now() - s.chipT) / 1000;
    const hl = since < 5 ? smooth(since / 0.4) * (1 - smooth((since - 3.6) / 1.4)) : 0;
    mats.pool.opacity = op * (0.42 + 0.3 * hl) * (0.92 + 0.08 * Math.sin(1.6 * t + s.seed));
    if (pool.current) pool.current.scale.setScalar(1 + 0.12 * hl);
    if (ring.current) {
      const ph = since < 5 ? (since % 1.6) / 1.6 : 1;
      ring.current.scale.setScalar(0.5 + ph * 1.1);
      mats.ring.opacity = op * hl * (1 - ph) * 0.55;
    }
    STAGE.pos.set(id, (STAGE.pos.get(id) ?? new THREE.Vector3()).set(s.x, floorY(s.floor), s.z));
  });

  const hipY = 0.88;
  return (
    <group ref={root} visible={false}>
      <mesh ref={pool} geometry={G.pool} material={mats.pool} rotation={qFlat} position={[0, 0.03, 0]} renderOrder={4} raycast={() => null} />
      <mesh ref={ring} geometry={G.ring} material={mats.ring} rotation={qFlat} position={[0, 0.035, 0]} renderOrder={4} raycast={() => null} />
      <group ref={body}>
        <mesh ref={legL} geometry={FIGURE.legGeo} material={mats.legs} position={[-0.1, hipY, 0]} castShadow />
        <mesh ref={legR} geometry={FIGURE.legGeo} material={mats.legs} position={[0.1, hipY, 0]} castShadow />
        {look.skirt && <mesh ref={skirt} geometry={G.skirt} material={mats.skirt} position={[0, hipY - 0.29, 0]} castShadow />}
        <group ref={upper} position={[0, hipY, 0]}>
          <mesh geometry={FIGURE.torsoGeo} material={mats.torso} position={[0, 0.34, 0]} scale={[1, look.skirt ? 1.05 : 1, 0.74]} castShadow />
          {look.belt && <mesh geometry={G.belt} material={mats.belt} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 0.74, 1]} />}
          {look.collar && <mesh geometry={G.collar} material={mats.collar} position={[0, 0.69, 0.1]} />}
          {look.badge && <mesh geometry={G.badge} material={mats.badge} position={[-0.11, 0.48, 0.155]} />}
          {look.scarf && <><mesh geometry={G.scarf} material={mats.scarf} position={[0, 0.7, 0]} rotation={[Math.PI / 2, 0, 0]} /><mesh geometry={G.scarfEnd} material={mats.scarf} position={[0.07, 0.56, 0.16]} rotation={[0.1, 0, 0.12]} /></>}
          {look.hijab && <mesh geometry={G.neck} material={mats.hijab} position={[0, 0.7, 0]} />}
          <group ref={armL} position={[-0.26, 0.62, 0]} rotation={[0, 0, -0.07]}><mesh geometry={FIGURE.armGeo} material={mats.arms} castShadow /></group>
          <group ref={armR} position={[0.26, 0.62, 0]} rotation={[0, 0, 0.07]}><mesh geometry={FIGURE.armGeo} material={mats.arms} castShadow /></group>
          <group ref={tab} position={[0, 0.42, 0.3]} rotation={[-0.75, 0, 0]} visible={false}>
            <mesh geometry={G.tablet} material={mats.tablet} />
            <mesh geometry={G.screen} material={mats.screen} position={[0, 0, 0.009]} />
          </group>
          <group ref={head} position={[0, 0.87, 0.01]}>
            <mesh geometry={FIGURE.headGeo} material={mats.skin} castShadow />
            {look.hair && !look.hijab && <mesh geometry={FIGURE.hairGeo} material={mats.hair} position={[0, 0.005, -0.01]} rotation={[-0.32, 0, 0]} />}
            {look.hijab && <mesh geometry={G.hijab} material={mats.hijab} position={[0, 0.02, -0.025]} scale={[1, 1.06, 1.02]} />}
            {look.bun && <mesh geometry={G.bun} material={mats.hair} position={[0, 0.07, -0.13]} />}
            {look.longHair && <mesh geometry={G.longHair} material={mats.hair} position={[0, -0.12, -0.09]} />}
            {look.cap && <><mesh geometry={G.cap} material={mats.cap} position={[0, 0.1, 0]} /><mesh geometry={G.visor} material={mats.cap} position={[0, 0.075, 0.12]} /></>}
          </group>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------- story camera: dollies between shots
function Director() {
  const gl = useThree((s) => s.gl);
  const tw = useRef<{ t0: number; dur: number; T0: THREE.Vector3; T1: THREE.Vector3; r0: number; r1: number; p0: number; p1: number; a0: number; a1: number } | null>(null);
  useEffect(() => {
    const stop = () => { tw.current = null; hold.current = null; };
    const el = gl.domElement;
    el.addEventListener("pointerdown", stop);
    el.addEventListener("wheel", stop, { passive: true });
    let timer = 0, seq = 0;
    const unsub = useStory.subscribe((st, prev) => {
      if (!st.on) { tw.current = null; return; }
      if (!st.cam || st.cam.nonce === prev.cam?.nonce) return;
      const shot = SHOTS[st.cam.shot];
      if (!shot) return;
      clearTimeout(timer);
      const go = () => {
        const c = rig.controls;
        if (!c) return;
        const o = shot.group ? groupOffset(shot.group) : { dx: 0, dz: 0 };
        const L = toWorld(new THREE.Vector3(shot.look[0] + o.dx, shot.look[1], shot.look[2] + o.dz));
        if (shot.cut || shot.far) {
          tw.current = null; hold.current = null;
          rig.cancel();
          rig.flyTo(L, shot.dist, { azimuth: shot.az, polar: shot.pol, duration: shot.dur, transition: shot.cut ? false : undefined });
          rt.userMoved = true;
          return;
        }
        rig.cancel();
        const T0 = new THREE.Vector3(); c.getTarget(T0);
        const P0 = new THREE.Vector3(); c.getPosition(P0);
        const sph = new THREE.Spherical().setFromVector3(P0.clone().sub(T0));
        let a1 = shot.az;
        while (a1 - sph.theta > Math.PI) a1 -= Math.PI * 2;
        while (a1 - sph.theta < -Math.PI) a1 += Math.PI * 2;
        tw.current = { t0: performance.now(), dur: (shot.dur ?? 3) * 1000, T0, T1: L, r0: Math.max(1, sph.radius), r1: shot.dist, p0: sph.phi, p1: shot.pol, a0: sph.theta, a1 };
        rt.userMoved = true;
      };
      // after the department selection's own flight has been requested (FocusFlights runs on the next commit): a few
      // frames later, whatever the frame rate, so the story shot always wins
      const id = ++seq;
      let n = 0;
      const wait = () => { if (id !== seq) return; if (++n >= 4) go(); else requestAnimationFrame(wait); };
      timer = window.setTimeout(() => requestAnimationFrame(wait), 60);
    });
    return () => { unsub(); clearTimeout(timer); el.removeEventListener("pointerdown", stop); el.removeEventListener("wheel", stop); };
  }, [gl]);
  const last = useRef(0);
  useFrame(() => {
    const w = tw.current, c = rig.controls;
    if (!w || !c) { last.current = performance.now(); return; }
    // a machine drawing under ~2 frames a second (software rendering) gets the end of the shot at once
    const now = performance.now(), slow = now - last.current > 600;
    last.current = now;
    const k = slow ? 1 : Math.min(1, (now - w.t0) / w.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    if (rig.flying) rig.cancel();
    const T = new THREE.Vector3().lerpVectors(w.T0, w.T1, e);
    const r = Math.exp(Math.log(w.r0) + (Math.log(w.r1) - Math.log(w.r0)) * e);
    const pos = new THREE.Vector3().setFromSphericalCoords(r, w.p0 + (w.p1 - w.p0) * e, w.a0 + (w.a1 - w.a0) * e).add(T);
    void c.setLookAt(pos.x, pos.y, pos.z, T.x, T.y, T.z, false);
    rt.userMoved = true;
    if (k >= 1) { tw.current = null; hold.current = { pos, T, until: now + 1500, frames: 6 }; }
  });
  // hold the shot a moment: a department flight requested late (slow frame, late commit) must not take it back
  const hold = useRef<{ pos: THREE.Vector3; T: THREE.Vector3; until: number; frames: number } | null>(null);
  const tmpT = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const h = hold.current, c = rig.controls;
    if (!h || !c || tw.current) return;
    if (rig.flying) rig.cancel();
    c.getTarget(tmpT);
    if (tmpT.distanceTo(h.T) > 0.3 || c.camera.position.distanceTo(h.pos) > 0.3) void c.setLookAt(h.pos.x, h.pos.y, h.pos.z, h.T.x, h.T.y, h.T.z, false);
    if (--h.frames <= 0 && performance.now() > h.until) hold.current = null;
  });
  return null;
}

/** Screen anchors of the story spots (value threads that start from a place, e.g. "spot:campus"). */
function SpotAnchors() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const v = new THREE.Vector3();
    const offs = ["campus", "hq-finance", "machine", "pump", "corridor-fall"].map((k) => registerAnchor("spot:" + k, () => {
      const p = spot(k);
      if (!p || !useStory.getState().on) return null;
      v.set(p.x, floorY(p.floor) + (k === "campus" ? 18 : 1.2), p.z);
      toWorld(v).project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
    }));
    return () => offs.forEach((o) => o());
  }, [camera, gl]);
  return null;
}

export default function StoryStage() {
  const on = useStory((s) => s.on);
  const sel = useApp((s) => s.sel);
  STAGE.open = useMemo(() => focusOf(sel).floor, [sel]);
  return (
    <group>
      <Director />
      <SpotAnchors />
      {on && CAST_IDS.map((id) => <Member key={id} id={id} />)}
      {on && <StoryProps />}
    </group>
  );
}
