"use client";
// The 2026 → 2031 props of the guided visit (building frame), each with a state before | mid | after | off driven by the
// story cues, cross-dissolving calmly (opacity + a slight rise of the "after" glow):
//   calls     standard: calls waiting (coral) → calm voice agents (blue)
//   queue     admissions: the queue in front of Youssef → nobody waiting
//   ydesk     Youssef's desk: paper stacks → a clean console; his squad of agents (1 orb in mid, 3 after) follows him
//   npaper    nurse station: the end-of-shift paper → gone
//   machine   4th floor: a chiller failing (coral) → healthy, tagged and watched by the twin (green + blue)
//   invoices  billing: stacks with rejected sheets (coral) → one complete file (gold)
//   sheets    Leïla's spreadsheets → gone
// plus the flashes: Keeps alerts (amber rings, the camera's cone), twin pings (blue rings, a beam).
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useStory, type PropState } from "@/lib/ai/story";
import { haloTexture } from "../hospital/mats";
import { FIGURE } from "../hospital/People";
import { floorY } from "./spots";
import { spot, groupOffset } from "./place";
import { STAGE, floorShown } from "./stage";

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const flat = new THREE.Euler(-Math.PI / 2, 0, 0);
const B = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 18, 12);
const RING = new THREE.RingGeometry(0.86, 1, 56);
const DISC = new THREE.PlaneGeometry(1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18);
const CONE = new THREE.ConeGeometry(1, 1, 28, 1, true);

type Mats = ReturnType<typeof makeMats>;
function makeMats() {
  const std = (c: string, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, transparent: true, ...o });
  const glow = (c: string, o: Partial<THREE.MeshBasicMaterialParameters> = {}) => new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, toneMapped: false, ...o });
  return {
    wood: std("#E4DBCD"), light: std("#DEE2EA"), white: std("#F6F7FA"), steel: std("#C2C8D3", { metalness: 0.25, roughness: 0.45 }), dark: std("#394155"),
    screen: std("#1F2740", { emissive: new THREE.Color("#30436F"), emissiveIntensity: 0.5 }), paper: std("#FBFBFD", { roughness: 0.95 }),
    coralSheet: std("#D58B7E"), carton: std("#D8CAB2"), patient: std("#C9CED9"), patientLegs: std("#B5BBC8"), skin: std("#D6AE8E"),
    coral: glow("#E07A6F"), amber: glow("#E2B05A"), blue: glow("#7D97FF"), green: glow("#4CC79A"), gold: glow("#E0C37A"),
    haloBlue: glow("#7D97FF", { map: haloTexture() }), haloGold: glow("#E0C37A", { map: haloTexture() }), haloCoral: glow("#E07A6F", { map: haloTexture() }),
    haloAmber: glow("#E2B05A", { map: haloTexture() }), haloGreen: glow("#4CC79A", { map: haloTexture() }),
    cone: glow("#E2B05A", { side: THREE.DoubleSide, opacity: 0.1 }), beam: glow("#9CB0FF", { opacity: 0.35 }),
    orb: new THREE.MeshStandardMaterial({ color: "#9CB0FF", emissive: new THREE.Color("#5B7CFF"), emissiveIntensity: 1.0, roughness: 0.25, transparent: true }),
    goldFolder: new THREE.MeshStandardMaterial({ color: "#E0C37A", emissive: new THREE.Color("#CDAA62"), emissiveIntensity: 0.55, roughness: 0.5, transparent: true }),
  };
}

/** Animated presence of a prop state: before/mid/after/off → [a (before), m (mid), z (after)] each 0..1. */
function useProp(key: string) {
  const st = useRef({ a: 0, m: 0, z: 0, cur: "off" as PropState });
  useEffect(() => {
    const h = (s: ReturnType<typeof useStory.getState>) => { st.current.cur = (s.props[key] ?? "off") as PropState; };
    h(useStory.getState());
    return useStory.subscribe(h);
  }, [key]);
  const step = (dt: number) => {
    const s = st.current;
    const ta = s.cur === "before" ? 1 : 0, tm = s.cur === "mid" ? 1 : 0, tz = s.cur === "after" ? 1 : 0;
    const k = dt / 1.3;
    s.a += Math.max(-k, Math.min(k, ta - s.a)); s.m += Math.max(-k, Math.min(k, tm - s.m)); s.z += Math.max(-k * 0.8, Math.min(k * 0.8, tz - s.z));
    return s;
  };
  return step;
}

const setOp = (mats: THREE.Material[], op: number) => { for (const m of mats) { (m as THREE.MeshBasicMaterial).opacity = op; m.visible = op > 0.004; } };

// ---------------------------------------------------------------- standard: calls waiting → voice agents
function Calls({ M }: { M: Mats }) {
  const step = useProp("calls");
  const before = useMemo(() => [M.coral.clone(), M.haloCoral.clone()], [M]);
  const after = useMemo(() => [M.orb.clone(), M.haloBlue.clone()], [M]);
  const ringMats = useMemo(() => [0, 1, 2, 3].map(() => M.coral.clone()), [M]);
  const g = useRef<THREE.Group>(null), rings = useRef<(THREE.Mesh | null)[]>([]), orbs = useRef<(THREE.Group | null)[]>([]);
  const desks: [number, number][] = [[-0.8, -7.3], [0.8, -7.3], [-0.8, -5.7], [0.8, -5.7]];
  useFrame((state, dt) => {
    const s = step(Math.min(dt, 0.5));
    const t = state.clock.elapsedTime;
    const shown = floorShown("main:0") ? 1 : 0;
    if (g.current) g.current.visible = (s.a + s.z) * shown > 0.004;
    setOp([before[0]], s.a * shown * 0.85); setOp([before[1]], s.a * shown * 0.5);
    setOp([after[0]], s.z * shown); setOp([after[1]], s.z * shown * 0.45);
    rings.current.forEach((r, i) => { if (!r) return; const ph = ((t * 0.9 + i * 0.37) % 1); r.scale.setScalar(0.18 + ph * 0.55); (r.material as THREE.MeshBasicMaterial).opacity = s.a * shown * (1 - ph) * 0.9; });
    orbs.current.forEach((o, i) => { if (!o) return; o.position.y = 1.75 + 0.06 * Math.sin(1.4 * t + i); o.scale.setScalar(0.001 + smooth(s.z) * (1 + 0.05 * Math.sin(2 * t + i))); });
  });
  return (
    <group ref={g} visible={false}>
      {desks.map(([x, z], i) => (
        <group key={i}>
          <mesh geometry={RING} material={ringMats[i]} ref={(r) => { rings.current[i] = r; }} position={[x, 1.6, z]} rotation={flat} renderOrder={6} />
          <mesh geometry={SPH} material={before[0]} position={[x, 1.6, z]} scale={0.05} />
          <group ref={(r) => { orbs.current[i] = r; }} position={[x, 1.75, z]}>
            <mesh geometry={SPH} material={after[0]} scale={0.1} />
            <mesh geometry={DISC} material={after[1]} scale={0.7} renderOrder={6} />
          </group>
        </group>
      ))}
      {/* calls waiting: a row of coral dots above the desks */}
      {Array.from({ length: 6 }, (_, i) => <mesh key={"w" + i} geometry={SPH} material={before[0]} position={[-1.25 + i * 0.5, 2.75, -6.5]} scale={0.07} />)}
      <mesh geometry={DISC} material={before[1]} position={[0, 2.75, -6.5]} scale={[3.6, 0.6, 1]} renderOrder={5} />
    </group>
  );
}

// ---------------------------------------------------------------- admissions: the queue
function Queue({ M }: { M: Mats }) {
  const step = useProp("queue");
  const mats = useMemo(() => [M.patient.clone(), M.patientLegs.clone(), M.skin.clone()], [M]);
  const g = useRef<THREE.Group>(null);
  const o = groupOffset("ydesk");
  const spots: [number, number, number][] = [[-17.3, 4.45, 0], [-17.2, 5.25, 0.1], [-17.42, 6.05, -0.08], [-17.28, 6.85, 0.05]].map(([x, z, d]) => [x + o.dx, z + o.dz, d]);
  useFrame((state, dt) => {
    const s = step(Math.min(dt, 0.5));
    const op = smooth(s.a) * (floorShown("main:0") ? 1 : 0);
    if (g.current) { g.current.visible = op > 0.004; g.current.position.y = -0.05 * (1 - op); }
    setOp(mats, op);
  });
  return (
    <group ref={g} visible={false}>
      {spots.map(([x, z, d], i) => (
        <group key={i} position={[x, 0, z]} rotation={[0, Math.PI + d, 0]}>
          <mesh geometry={FIGURE.legGeo} material={mats[1]} position={[-0.1, 0.88, 0]} />
          <mesh geometry={FIGURE.legGeo} material={mats[1]} position={[0.1, 0.88, 0]} />
          <mesh geometry={FIGURE.torsoGeo} material={mats[0]} position={[0, 1.22, 0]} scale={[1, 1, 0.72]} />
          <mesh geometry={FIGURE.headGeo} material={mats[2]} position={[0, 1.75, 0]} />
          <mesh geometry={FIGURE.armGeo} material={mats[0]} position={[-0.26, 1.5, 0]} rotation={[0, 0, -0.07]} />
          <mesh geometry={FIGURE.armGeo} material={mats[0]} position={[0.26, 1.5, 0]} rotation={[0, 0, 0.07]} />
        </group>
      ))}
    </group>
  );
}

/** A desk (top, sides, monitor, chair) — a light, Mibtech-style workstation. */
function Desk({ M, mats, x, z, yaw, chair = true }: { M: Mats; mats: THREE.Material[]; x: number; z: number; yaw: number; chair?: boolean }) {
  void M;
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      <mesh geometry={B} material={mats[0]} position={[0, 0.74, 0]} scale={[1.3, 0.05, 0.66]} castShadow receiveShadow />
      <mesh geometry={B} material={mats[1]} position={[-0.6, 0.36, 0]} scale={[0.05, 0.72, 0.62]} />
      <mesh geometry={B} material={mats[1]} position={[0.6, 0.36, 0]} scale={[0.05, 0.72, 0.62]} />
      <mesh geometry={B} material={mats[2]} position={[0.32, 1.0, -0.18]} scale={[0.5, 0.32, 0.03]} rotation={[0, 0.15, 0]} />
      {chair && <>
        <mesh geometry={B} material={mats[1]} position={[0, 0.46, -0.72]} scale={[0.46, 0.06, 0.44]} />
        <mesh geometry={B} material={mats[1]} position={[0, 0.78, -0.95]} scale={[0.44, 0.6, 0.05]} />
      </>}
    </group>
  );
}

// ---------------------------------------------------------------- Youssef's desk and his squad of agents
function YDesk({ M }: { M: Mats }) {
  const step = useProp("ydesk");
  const fixed = useMemo(() => [M.wood.clone(), M.light.clone(), M.screen.clone()], [M]);
  const paper = useMemo(() => [M.paper.clone()], [M]);
  const glow = useMemo(() => [M.blue.clone()], [M]);
  const squad = useMemo(() => [M.orb.clone(), M.haloBlue.clone()], [M]);
  const g = useRef<THREE.Group>(null), stacks = useRef<(THREE.Mesh | null)[]>([]), orbs = useRef<(THREE.Group | null)[]>([]), sq = useRef<THREE.Group>(null);
  const H = [0.3, 0.42, 0.24];
  const n = useRef(0);
  const o = groupOffset("ydesk");
  useFrame((state, dt) => {
    const s = step(Math.min(dt, 0.5));
    const t = state.clock.elapsedTime;
    const shown = floorShown("main:0") ? 1 : 0;
    const any = Math.max(s.a, s.m, s.z) * shown;
    if (g.current) g.current.visible = any > 0.004;
    setOp(fixed, smooth(any));
    const fill = s.a + 0.45 * s.m;
    stacks.current.forEach((m, i) => { if (!m) return; const h = Math.max(0.001, H[i] * fill); m.scale.set(0.3, h, 0.22); m.position.y = 0.765 + h / 2; m.visible = fill > 0.02 && any > 0.01; });
    setOp(paper, smooth(any));
    setOp(glow, s.z * shown * 0.8);
    // squad: 1 agent in the first year, 3 once Youssef pilots — they follow him
    const want = s.z > 0.5 ? 3 : s.m > 0.5 ? 1 : 0;
    n.current += (want - n.current) * Math.min(1, dt * 1.5);
    const p = STAGE.pos.get("youssef");
    const yv = STAGE.vis.get("youssef") ?? 0;
    if (sq.current) { sq.current.visible = !!p && n.current > 0.02 && yv > 0.05; if (p) sq.current.position.set(p.x, 0, p.z); }
    setOp([squad[0]], Math.min(1, n.current) * yv * shown); setOp([squad[1]], Math.min(1, n.current) * yv * shown * 0.4);
    orbs.current.forEach((o, i) => {
      if (!o) return;
      const k = smooth(n.current - i);
      const a = t * 0.55 + (i * Math.PI * 2) / 3;
      o.position.set(Math.cos(a) * 0.62, 2.05 + 0.08 * Math.sin(1.3 * t + i), Math.sin(a) * 0.62);
      o.scale.setScalar(0.001 + k);
    });
  });
  return (
    <>
      <group ref={g} visible={false}>
        <Desk M={M} mats={fixed} x={-17.4 + o.dx} z={3.25 + o.dz} yaw={0} />
        {[[-17.85 + o.dx, 3.38 + o.dz], [-17.5 + o.dx, 3.4 + o.dz], [-17.12 + o.dx, 3.32 + o.dz]].map(([x, z], i) => (
          <mesh key={i} geometry={B} material={paper[0]} ref={(r) => { stacks.current[i] = r; }} position={[x, 0.9, z]} rotation={[0, (i - 1) * 0.12, 0]} castShadow />
        ))}
        <mesh geometry={DISC} material={glow[0]} position={[-17.55 + o.dx, 0.775, 3.3 + o.dz]} rotation={flat} scale={[0.28, 0.2, 1]} renderOrder={6} />
      </group>
      <group ref={sq} visible={false}>
        {[0, 1, 2].map((i) => (
          <group key={i} ref={(r) => { orbs.current[i] = r; }}>
            <mesh geometry={SPH} material={squad[0]} scale={0.085} />
            <mesh geometry={DISC} material={squad[1]} scale={0.55} renderOrder={6} />
          </group>
        ))}
      </group>
    </>
  );
}

// ---------------------------------------------------------------- nurse station paper
function NursePaper({ M }: { M: Mats }) {
  const step = useProp("npaper");
  const mats = useMemo(() => [M.paper.clone()], [M]);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const s = step(Math.min(dt, 0.5));
    const op = smooth(s.a) * (floorShown("main:3") ? 1 : 0);
    if (g.current) g.current.visible = op > 0.004;
    setOp(mats, op);
  });
  const y = floorY("main:3");
  return (
    <group ref={g} visible={false} position={[0, y, 0]}>
      <mesh geometry={B} material={mats[0]} position={[-13.3, 1.24, 0.12]} scale={[0.3, 0.26, 0.22]} rotation={[0, 0.1, 0]} castShadow />
      <mesh geometry={B} material={mats[0]} position={[-12.62, 1.2, 0.1]} scale={[0.3, 0.18, 0.22]} rotation={[0, -0.15, 0]} castShadow />
      <mesh geometry={B} material={mats[0]} position={[-12.95, 1.16, 0.18]} scale={[0.3, 0.1, 0.22]} rotation={[0, 0.3, 0]} castShadow />
    </group>
  );
}

// ---------------------------------------------------------------- the fall in the corridor: a patient sitting on the floor
function Fall({ M }: { M: Mats }) {
  const step = useProp("fall");
  const mats = useMemo(() => [M.patient.clone(), M.patientLegs.clone(), M.skin.clone()], [M]);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const s = step(Math.min(dt, 0.5));
    const op = smooth(Math.max(s.a, s.z)) * (floorShown("main:3") ? 1 : 0);
    if (g.current) g.current.visible = op > 0.004;
    setOp(mats, op);
  });
  const p = spot("corridor-fall")!;
  return (
    <group ref={g} visible={false} position={[p.x, floorY(p.floor), p.z]} rotation={[0, Math.PI / 2 + 0.3, 0]}>
      {/* seated on the floor, legs forward, one hand on the floor */}
      <mesh geometry={FIGURE.legGeo} material={mats[1]} position={[-0.1, 0.16, 0]} rotation={[-1.45, 0, 0.05]} />
      <mesh geometry={FIGURE.legGeo} material={mats[1]} position={[0.1, 0.16, 0]} rotation={[-1.35, 0, -0.08]} />
      <mesh geometry={FIGURE.torsoGeo} material={mats[0]} position={[0, 0.5, -0.06]} rotation={[-0.22, 0, 0]} scale={[1, 1, 0.74]} />
      <mesh geometry={FIGURE.headGeo} material={mats[2]} position={[0, 1.02, -0.16]} />
      <mesh geometry={FIGURE.armGeo} material={mats[0]} position={[-0.26, 0.78, -0.1]} rotation={[0.55, 0, -0.25]} />
      <mesh geometry={FIGURE.armGeo} material={mats[0]} position={[0.26, 0.78, -0.1]} rotation={[-0.3, 0, 0.12]} />
    </group>
  );
}

// ---------------------------------------------------------------- the chiller: failing → watched by the twin
function Machine({ M }: { M: Mats }) {
  const step = useProp("machine");
  const body = useMemo(() => [M.white.clone(), M.dark.clone(), M.steel.clone()], [M]);
  const lampC = useMemo(() => M.coral.clone(), [M]), lampG = useMemo(() => M.green.clone(), [M]);
  const halo = useMemo(() => [M.haloCoral.clone(), M.haloBlue.clone()], [M]);
  const tag = useMemo(() => M.blue.clone(), [M]), beam = useMemo(() => M.beam.clone(), [M]);
  const g = useRef<THREE.Group>(null), ring = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    const s = step(Math.min(dt, 0.5));
    const t = state.clock.elapsedTime;
    const shown = floorShown("main:4") ? 1 : 0;
    const any = Math.max(s.a, s.z) * shown;
    if (g.current) g.current.visible = any > 0.004;
    setOp(body, smooth(any));
    const blink = 0.35 + 0.65 * Math.max(0, Math.sin(t * 6));
    lampC.opacity = s.a * shown * blink; lampG.opacity = s.z * shown;
    halo[0].opacity = s.a * shown * 0.55 * blink; halo[1].opacity = s.z * shown * 0.4;
    tag.opacity = s.z * shown; beam.opacity = s.z * shown * (0.18 + 0.1 * Math.sin(t * 2.2));
    if (ring.current) { const ph = (t * 0.5) % 1; ring.current.scale.setScalar(0.6 + ph * 0.8); (ring.current.material as THREE.MeshBasicMaterial).opacity = s.z * shown * (1 - ph) * 0.6; }
  });
  const y = floorY("main:4");
  const ringMat = useMemo(() => M.blue.clone(), [M]);
  const o = groupOffset("machine");
  return (
    <group ref={g} visible={false} position={[7.8 + o.dx, y, 4.5 + o.dz]}>
      <mesh geometry={B} material={body[0]} position={[0, 0.65, 0]} scale={[1.7, 1.3, 0.95]} castShadow receiveShadow />
      <mesh geometry={CYL} material={body[1]} position={[-0.42, 1.31, 0]} scale={[0.3, 0.03, 0.3]} />
      <mesh geometry={CYL} material={body[1]} position={[0.42, 1.31, 0]} scale={[0.3, 0.03, 0.3]} />
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => <mesh key={x} geometry={B} material={body[2]} position={[x, 0.55, 0.48]} scale={[0.03, 0.8, 0.02]} />)}
      <mesh geometry={SPH} material={lampC} position={[0.68, 1.12, 0.49]} scale={0.055} />
      <mesh geometry={SPH} material={lampG} position={[0.68, 1.12, 0.49]} scale={0.055} />
      <mesh geometry={DISC} material={halo[0]} position={[0.68, 1.12, 0.52]} scale={0.6} renderOrder={6} />
      <mesh geometry={B} material={tag} position={[-0.7, 1.05, 0.49]} scale={[0.12, 0.08, 0.02]} />
      <mesh geometry={DISC} material={halo[1]} position={[-0.7, 1.05, 0.52]} scale={0.7} renderOrder={6} />
      <mesh geometry={CYL} material={beam} position={[-0.7, 2.5, 0.3]} scale={[0.012, 2.6, 0.012]} />
      <mesh ref={ring} geometry={RING} material={ringMat} position={[0, 0.03, 0]} rotation={flat} scale={1.2} renderOrder={6} />
    </group>
  );
}

// ---------------------------------------------------------------- billing: rejected stacks → one complete file
function Invoices({ M }: { M: Mats }) {
  const step = useProp("invoices");
  const fixed = useMemo(() => [M.wood.clone(), M.light.clone(), M.screen.clone()], [M]);
  const before = useMemo(() => [M.paper.clone(), M.coralSheet.clone(), M.carton.clone()], [M]);
  const after = useMemo(() => [M.goldFolder.clone(), M.haloGold.clone()], [M]);
  const g = useRef<THREE.Group>(null), ring = useRef<THREE.Mesh>(null);
  const ringMat = useMemo(() => M.gold.clone(), [M]);
  useFrame((state, dt) => {
    const s = step(Math.min(dt, 0.5));
    const t = state.clock.elapsedTime;
    const shown = floorShown("main:1") ? 1 : 0;
    const any = Math.max(s.a, s.z) * shown;
    if (g.current) g.current.visible = any > 0.004;
    setOp(fixed, smooth(any)); setOp(before, smooth(s.a) * shown);
    setOp([after[0]], smooth(s.z) * shown); setOp([after[1]], smooth(s.z) * shown * (0.45 + 0.1 * Math.sin(t * 1.8)));
    if (ring.current) { const ph = (t * 0.45) % 1; ring.current.scale.setScalar(0.3 + ph * 0.7); ringMat.opacity = s.z * shown * (1 - ph) * 0.5; }
  });
  const y = floorY("main:1");
  const stacks: [number, number, number][] = [[-16.0, -3.18, 0.3], [-15.62, -3.12, 0.4], [-15.25, -3.2, 0.26]];
  const o = groupOffset("billing");
  return (
    <group ref={g} visible={false} position={[o.dx, y, o.dz]}>
      <Desk M={M} mats={fixed} x={-15.6} z={-3.25} yaw={0} />
      {stacks.map(([x, z, h], i) => (
        <group key={i} position={[x, 0.765, z]} rotation={[0, (i - 1) * 0.14, 0]}>
          <mesh geometry={B} material={before[0]} position={[0, h / 2, 0]} scale={[0.3, h, 0.22]} castShadow />
          <mesh geometry={B} material={before[1]} position={[0, h + 0.008, 0]} scale={[0.3, 0.016, 0.22]} />
        </group>
      ))}
      <mesh geometry={B} material={before[2]} position={[-16.55, 0.2, -2.6]} scale={[0.45, 0.4, 0.34]} castShadow />
      <mesh geometry={B} material={before[2]} position={[-16.45, 0.6, -2.62]} scale={[0.42, 0.38, 0.32]} rotation={[0, 0.2, 0]} castShadow />
      <mesh geometry={B} material={after[0]} position={[-15.62, 0.785, -3.15]} scale={[0.34, 0.035, 0.25]} />
      <mesh geometry={DISC} material={after[1]} position={[-15.62, 0.81, -3.15]} rotation={flat} scale={1.0} renderOrder={6} />
      <mesh ref={ring} geometry={RING} material={ringMat} position={[-15.62, 0.8, -3.15]} rotation={flat} renderOrder={6} />
    </group>
  );
}

// ---------------------------------------------------------------- Leïla's spreadsheets
function Sheets({ M }: { M: Mats }) {
  const step = useProp("sheets");
  const fixed = useMemo(() => [M.wood.clone(), M.light.clone(), M.screen.clone()], [M]);
  const before = useMemo(() => [M.paper.clone()], [M]);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const s = step(Math.min(dt, 0.5));
    const shown = floorShown("annex:3") ? 1 : 0;
    const any = Math.max(s.a, s.z) * shown;
    if (g.current) g.current.visible = any > 0.004;
    setOp(fixed, smooth(any)); setOp(before, smooth(s.a) * shown);
  });
  const y = floorY("annex:3");
  const o = groupOffset("cmd");
  return (
    <group ref={g} visible={false} position={[o.dx, y, o.dz]}>
      <Desk M={M} mats={fixed} x={51.95} z={-4.4} yaw={Math.PI / 2} />
      {[0, 1, 2, 3, 4].map((i) => <mesh key={i} geometry={B} material={before[0]} position={[51.85 + (i % 2) * 0.12, 0.775 + i * 0.004, -4.75 + i * 0.17]} rotation={[0, 0.25 * (i - 2), 0]} scale={[0.22, 0.004, 0.3]} />)}
    </group>
  );
}

// ---------------------------------------------------------------- flashes: Keeps alerts and twin pings
function Flashes({ M }: { M: Mats }) {
  const ref = useRef<THREE.Group>(null);
  const pool = useMemo(() => Array.from({ length: 4 }, () => ({ rings: [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })), cone: M.cone.clone(), beam: M.beam.clone() })), [M]);
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const st = useStory.getState();
    const now = performance.now();
    const list = st.flashes.slice(-4);
    pool.forEach((p, i) => {
      const g = groups.current[i];
      const f = list[i];
      const sp = f ? spot(f.spot) : null;
      if (!g) return;
      if (!f || !sp || !floorShown(sp.floor)) { g.visible = false; return; }
      const age = (now - f.t) / 1000;
      const life = f.kind === "ping" ? 6 : 7.5;
      if (age > life) { g.visible = false; return; }
      g.visible = true;
      g.position.set(sp.x, floorY(sp.floor), sp.z);
      const env = smooth(age / 0.4) * (1 - smooth((age - life + 1.5) / 1.5));
      const col = f.kind === "ping" ? "#7D97FF" : f.dim ? "#E07A6F" : "#E2B05A";
      p.rings.forEach((m, k) => {
        const ph = ((age * 0.7 + k / 3) % 1);
        m.color.set(col);
        m.opacity = env * (1 - ph) * (f.dim ? 0.35 : 0.8);
        const mesh = g.children[k] as THREE.Mesh;
        mesh.scale.setScalar(0.25 + ph * 1.6);
      });
      // Keeps: the existing camera's view cone (corridor alerts); twin: a beam
      const cone = g.children[3] as THREE.Mesh, beam = g.children[4] as THREE.Mesh;
      cone.visible = f.kind === "alert" && !f.dim && f.spot === "corridor-fall";
      p.cone.opacity = 0.11 * env;
      beam.visible = f.kind === "ping";
      p.beam.opacity = 0.4 * env;
    });
  });
  return (
    <group ref={ref}>
      {pool.map((p, i) => (
        <group key={i} ref={(r) => { groups.current[i] = r; }} visible={false}>
          {p.rings.map((m, k) => <mesh key={k} geometry={RING} material={m} position={[0, 0.04 + k * 0.002, 0]} rotation={flat} renderOrder={7} />)}
          {/* camera on the ceiling, 2 m back along the corridor, looking at the spot */}
          <mesh geometry={CONE} material={p.cone} position={[1.1, 2.05, -0.55]} rotation={[0.24, 0, -0.5]} scale={[1.0, 4.0, 1.0]} renderOrder={6} />
          <mesh geometry={CYL} material={p.beam} position={[0, 1.6, 0]} scale={[0.03, 3.2, 0.03]} renderOrder={6} />
        </group>
      ))}
    </group>
  );
}

export default function StoryProps() {
  const M = useMemo(makeMats, []);
  useEffect(() => () => Object.values(M).forEach((m) => m.dispose()), [M]);
  return (
    <group>
      <Calls M={M} />
      <Queue M={M} />
      <YDesk M={M} />
      <NursePaper M={M} />
      <Fall M={M} />
      <Machine M={M} />
      <Invoices M={M} />
      <Sheets M={M} />
      <Flashes M={M} />
    </group>
  );
}
