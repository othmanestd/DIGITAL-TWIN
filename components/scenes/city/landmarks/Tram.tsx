"use client";
// The Casablanca tramway: three Citadis-like trams (five articulated modules, rounded cab ends, burnt-orange metallic livery
// with a dark glazed band and a cream waist stripe, two pantographs on the catenary of plan.TRAM) running on the existing two
// tracks, braking into side-platform stops with a canopy and dwelling there, then going on; turn-around at both ends.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { cityPlan, TRAM } from "../plan";
import { ENV } from "./env";
import { TEX } from "./textures";
import { merge, texBox, type G } from "./geo";
import { lmOpacity, setFade } from "./shared";

// ---------------------------------------------------------------- the line
export const TRAM_STOPS_X = [-2900, -2100, -1260, 1260, 2100, 2900];
const Z0 = TRAM.z, TRACK = 1.6, W = 2.66, MODULE = 11.2, MODS = 5, BODY = MODULE * MODS, NOSE = 3.4, LEN = BODY + 2 * NOSE;
const VMAX = 11, ACC = 1.0, DEC = 1.1;
export type TramState = { x: number; v: number; dir: 1 | -1; z: number; dwell: number; stop: number; hold: boolean };
/** Live state of the trams, read by the pedestrians (boarding at the stops). */
export const TRAMS: TramState[] = [];
export const platformZ = (dir: 1 | -1) => Z0 + dir * 4.6;   // the platform on the doors' side (right of the travel): south for eastbound
export const TRAM_LEN = LEN;

/** Cab end: a rounded bullet nose, superellipse sections shrinking along the length, raked windscreen, painted by vertex colour. */
function nose(sign: 1 | -1): G {
  const N = 14, M = 28, Ln = NOSE, yc = 1.85, Hh = 1.75, Wh = W / 2, pw = 4.5;
  const pos: number[] = [], col: number[] = [], idx: number[] = [], uv: number[] = [];
  const body = new THREE.Color("#C8683A"), glass = new THREE.Color("#1B222D"), skirt = new THREE.Color("#3C3F48"), stripe = new THREE.Color("#E8E3D8");
  const c = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * 0.93, s = Math.pow(Math.max(0, 1 - Math.pow(u, 2.3)), 0.5);
    for (let j = 0; j < M; j++) {
      const a = (j / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const z = Wh * s * Math.sign(ca) * Math.pow(Math.abs(ca), 2 / pw);
      const dy = Hh * Math.sign(sa) * Math.pow(Math.abs(sa), 2 / pw) * (0.45 + 0.55 * s);
      const y = yc + dy, x = Ln * u - Math.max(0, dy) * 0.32 * u;
      pos.push(sign * (BODY / 2 + x), y, z);
      // painting: skirt below, orange body, a dark windscreen on the upper front, stripe at the waist
      const fy = (y - 0.1) / 3.5;
      if (fy < 0.1) c.copy(skirt); else if (fy > 0.52 && fy < 0.55) c.copy(stripe);
      else if (fy > 0.58 && u > 0.12 && Math.abs(z) < Wh * s * 0.95) c.copy(glass); else c.copy(body);
      col.push(c.r, c.g, c.b); uv.push(0, 0);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + ((j + 1) % M), d = (i + 1) * M + j, e = (i + 1) * M + ((j + 1) % M);
    if (sign > 0) idx.push(a, d, b, b, d, e); else idx.push(a, b, d, b, e, d);
  }
  // front cap
  const t = pos.length / 3; let cx = 0, cy = 0, cz = 0;
  for (let j = 0; j < M; j++) { const k = (N * M + j) * 3; cx += pos[k] / M; cy += pos[k + 1] / M; cz += pos[k + 2] / M; }
  pos.push(cx, cy, cz); col.push(glass.r, glass.g, glass.b); uv.push(0, 0);
  for (let j = 0; j < M; j++) { const a = N * M + j, b = N * M + ((j + 1) % M); if (sign > 0) idx.push(t, b, a); else idx.push(t, a, b); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function buildTram() {
  const livery = TEX.tram();
  const M = {
    body: new THREE.MeshStandardMaterial({ map: livery.map, roughness: 0.34, metalness: 0.28, envMapIntensity: 1.2, emissive: "#FFFFFF", emissiveMap: livery.glow, emissiveIntensity: 0 }),
    nose: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.28, envMapIntensity: 1.2 }),
    roof: new THREE.MeshStandardMaterial({ color: "#A7ADBB", roughness: 0.6, metalness: 0.2 }),
    dark: new THREE.MeshStandardMaterial({ color: "#2D3139", roughness: 0.55, metalness: 0.3 }),
    head: new THREE.MeshBasicMaterial({ color: "#FFF1D0", toneMapped: false }),
    tail: new THREE.MeshBasicMaterial({ color: "#E5473E", toneMapped: false }),
  };
  const body = texBox(BODY, 3.5, W, [MODULE, 3.5], [0, 0.1, 0], { snap: true, drop: [0, 1, 2, 3] });
  const noseG = merge([nose(1), nose(-1)])!;
  const roof: G[] = [texBox(BODY + 0.4, 0.28, W - 0.3, [4, 4], [0, 3.58, 0])];
  for (let m = 0; m < MODS; m++) roof.push(texBox(4.2, 0.5, 1.7, [4, 4], [-BODY / 2 + MODULE * (m + 0.5), 3.84, 0]));
  const dark: G[] = [];
  for (const m of [1, 3]) {
    const x = -BODY / 2 + MODULE * (m + 0.5);
    for (const sx of [-1, 1]) dark.push(texBox(0.09, 2.3, 0.09, [1, 1]).rotateZ(sx * 0.22).translate(x + sx * 0.5, 3.86, 0));
    dark.push(texBox(0.14, 0.1, 1.9, [1, 1], [x, 6.04, 0]));
    for (const sx of [-1, 1]) dark.push(texBox(0.4, 0.3, 0.6, [1, 1], [x + sx * 0.9, 3.86, 0]));
  }
  // bogies under the skirt at every joint and the ends
  for (let m = 0; m <= MODS; m++) for (const sz of [-1, 1]) dark.push(texBox(2.4, 0.5, 0.18, [1, 1], [-BODY / 2 + MODULE * m + (m === 0 ? 1.8 : m === MODS ? -1.8 : 0), 0.15, sz * 1.0]));
  const head: G[] = [], tail: G[] = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    head.push(texBox(0.1, 0.32, 0.5, [1, 1], [sx * (BODY / 2 + NOSE * 0.85), 0.85, sz * 0.62]));
    tail.push(texBox(0.1, 0.26, 0.3, [1, 1], [sx * (BODY / 2 + NOSE * 0.85), 1.4, sz * 0.7]));
  }
  return { M, geos: { body, nose: noseG, roof: merge(roof)!, dark: merge(dark)!, head: merge(head)!, tail: merge(tail)! } };
}

/** side platforms with a canopy at every stop */
function buildStops() {
  const M = {
    slab: new THREE.MeshStandardMaterial({ map: TEX.stone(), color: "#E2DDD2", roughness: 0.9 }),
    edge: new THREE.MeshStandardMaterial({ color: "#B7AE96", roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: "#3B414D", roughness: 0.5, metalness: 0.5 }),
    glass: new THREE.MeshStandardMaterial({ color: "#6E8296", roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.55, envMapIntensity: 1.2 }),
    totem: new THREE.MeshStandardMaterial({ color: "#C8683A", roughness: 0.5, metalness: 0.2 }),
    lamp: new THREE.MeshBasicMaterial({ color: "#FFF3D6", toneMapped: false }),
  };
  const b: Record<string, G[]> = {};
  const add = (k: string, g: G) => { (b[k] ??= []).push(g); };
  for (const sx of TRAM_STOPS_X) for (const dir of [1, -1] as const) {
    const z = platformZ(dir), out = dir; // out = away from the tracks
    add("slab", texBox(60, 0.32, 3.1, [6, 6], [sx, 0, z]));
    add("edge", texBox(60, 0.34, 0.45, [2, 2], [sx, 0, z - out * 1.3]));
    for (let k = -3; k <= 3; k++) add("steel", texBox(0.16, 3.2, 0.16, [1, 1], [sx + k * 5.6, 0.3, z + out * 1.35]));
    add("steel", texBox(36, 0.18, 3.0, [1, 1], [sx, 3.45, z + out * 0.3]));
    add("glass", texBox(36, 2.1, 0.06, [1, 1], [sx, 0.9, z + out * 1.45]));
    add("lamp", texBox(34, 0.05, 0.3, [1, 1], [sx, 3.38, z + out * 0.6]));
    for (const k of [-1, 0, 1]) add("steel", texBox(1.8, 0.45, 0.5, [1, 1], [sx + k * 8, 0.3, z + out * 0.9]));
    add("totem", texBox(0.5, 3.6, 0.3, [1, 1], [sx + 30.5 * (dir), 0.3, z]));
  }
  return { M, parts: Object.entries(b).map(([k, l]) => ({ key: k, geo: merge(l)! })) };
}

export function Trams() {
  const P = cityPlan();
  const run = P.tram;
  const res = useMemo(buildTram, []);
  const stops = useMemo(buildStops, []);
  const refs = useRef<Record<string, THREE.InstancedMesh | null>>({});
  const root = useRef<THREE.Group>(null), stopG = useRef<THREE.Group>(null);
  const fade = useRef({ v: -1 });
  const mats = useMemo(() => Object.values(res.M) as THREE.Material[], [res]);
  const smats = useMemo(() => Object.values(stops.M) as THREE.Material[], [stops]);
  const N = run ? 3 : 0;
  const xMin = run ? Math.max(run.x0 + 60, TRAM_STOPS_X[0]) : 0, xMax = run ? Math.min(run.x1 - 60, TRAM_STOPS_X[TRAM_STOPS_X.length - 1]) : 0;

  useLayoutEffect(() => {
    // three trams spread along the line: two eastbound, one westbound; the first two begin in a station
    TRAMS.length = 0;
    const init: [number, 1 | -1, number, number][] = [[-2100, 1, 4, 1], [2500, -1, 0, -1], [0, 1, 0, -1]];
    init.forEach(([x, dir, dw, stop]) => TRAMS.push({ x, v: dw ? 0 : VMAX * 0.8, dir, z: dir * TRACK, dwell: dw, stop, hold: false }));
    void N;
  }, [N]);
  useEffect(() => () => {
    Object.values(res.geos).forEach((g) => g.dispose()); mats.forEach((m) => m.dispose());
    stops.parts.forEach((p) => p.geo.dispose()); smats.forEach((m) => m.dispose());
  }, [res, mats, stops, smats]);
  useEffect(() => { if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __tram: unknown }).__tram = { jump: (i: number, x: number, dir: 1 | -1) => { const t = TRAMS[i]; if (t) { t.x = x; t.dir = dir; t.v = 0; t.dwell = 30; t.z = dir * TRACK; } } }; }, []);

  const m4 = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), v3 = useMemo(() => new THREE.Vector3(), []), sc = useMemo(() => new THREE.Vector3(1, 1, 1), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useFrame((_, dt0) => {
    const alt = frame.alt, g = root.current;
    if (!g || !run) return;
    const op = lmOpacity(alt);
    g.visible = op > 0.004;
    if (stopG.current) stopG.current.visible = alt < 6000 && op > 0.5;
    if (!g.visible) return;
    setFade(mats, op, fade.current);
    const dt = Math.min(dt0, 0.1), n = ENV.night;
    res.M.body.emissiveIntensity = 0.12 + n * 0.8;
    stops.M.lamp.color.setScalar(0.55 + 0.45 * n);

    // ---- simulation: stop-to-stop with smooth braking, dwell, turn-around at the ends
    for (let i = 0; i < TRAMS.length; i++) {
      const t = TRAMS[i];
      // next target in the travel direction: a stop (or the end of the line)
      let tx = t.dir > 0 ? xMax : xMin, ti = -1;
      for (let s = 0; s < TRAM_STOPS_X.length; s++) {
        const sx = TRAM_STOPS_X[s];
        if (sx < xMin - 1 || sx > xMax + 1) continue;
        if ((sx - t.x) * t.dir > 1.5 && (ti < 0 || Math.abs(sx - t.x) < Math.abs(tx - t.x))) { tx = sx; ti = s; }
      }
      // keep the distance to a tram ahead on the same track
      t.hold = false;
      for (let j = 0; j < TRAMS.length; j++) {
        if (j === i || TRAMS[j].dir !== t.dir) continue;
        const gap = (TRAMS[j].x - t.x) * t.dir;
        if (gap > 0 && gap < LEN + 20 + t.v * t.v / (2 * DEC)) t.hold = true;
      }
      if (t.dwell > 0) {
        t.dwell -= dt; t.v = 0;
        if (t.dwell <= 0 && t.hold) t.dwell = 0.5;
        // the end of the line: change track while stopped
        const want = t.dir * TRACK;
        t.z += (want - t.z) * Math.min(1, dt * 1.2);
        if (t.dwell <= 0) { t.stop = -1; }
      } else {
        const ds = (tx - t.x) * t.dir, brake = (t.v * t.v) / (2 * DEC) + 0.6;
        let a = ds <= brake ? -Math.max(DEC, (t.v * t.v) / (2 * Math.max(ds, 0.5))) : t.v < VMAX ? ACC : 0;
        if (t.hold) a = -DEC * 1.5;
        t.v = Math.max(0, Math.min(VMAX, t.v + a * dt));
        t.x += t.dir * t.v * dt;
        if (ds < 0.4 || (ds < 2 && t.v < 0.25)) {
          t.x = tx; t.v = 0; t.stop = ti;
          if (Math.abs(tx - (t.dir > 0 ? xMax : xMin)) < 2) { t.dwell = 14; t.dir = (t.dir * -1) as 1 | -1; }   // end of the line: wait, then turn round
          else t.dwell = 9 + ((i * 3 + ti) % 4);                                                                  // a station: doors open, people board
        }
        t.z += (t.dir * TRACK - t.z) * Math.min(1, dt * 1.2);
      }
    }

    // ---- instance matrices
    const set = (key: string) => {
      const m = refs.current[key];
      if (!m) return;
      for (let i = 0; i < TRAMS.length; i++) {
        const t = TRAMS[i];
        q.setFromAxisAngle(up, t.dir > 0 ? 0 : Math.PI);
        m.setMatrixAt(i, m4.compose(v3.set(t.x, 0, Z0 + t.z), q, sc));
      }
      m.instanceMatrix.needsUpdate = true;
    };
    for (const k of ["body", "nose", "roof", "dark", "head", "tail"]) set(k);
  });

  if (!run) return null;
  const inst = (key: string, geo: G, mat: THREE.Material) => (
    <instancedMesh key={key} ref={(r) => { refs.current[key] = r; }} args={[geo, mat, N]} frustumCulled={false} raycast={() => null} />
  );
  return (
    <>
      <group ref={root}>
        {inst("body", res.geos.body, res.M.body)}
        {inst("nose", res.geos.nose, res.M.nose)}
        {inst("roof", res.geos.roof, res.M.roof)}
        {inst("dark", res.geos.dark, res.M.dark)}
        {inst("head", res.geos.head, res.M.head)}
        {inst("tail", res.geos.tail, res.M.tail)}
        <group ref={stopG}>{stops.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={(stops.M as Record<string, THREE.Material>)[p.key]} raycast={() => null} />)}</group>
      </group>
    </>
  );
}
