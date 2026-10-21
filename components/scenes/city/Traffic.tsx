"use client";
// Traffic of the procedural Casablanca: cars, red petits taxis and Casa Bus city buses (simulation in trafficSim.ts),
// plus the street furniture tied to it: traffic lights and bus shelters. One InstancedMesh per vehicle part (body,
// roof, glass, wheels, taxi roof sign, bus band, destination signs, head / tail lamps, night light pools); matrices are
// written straight into the instance buffers every frame (no per-vehicle React component, no allocation in useFrame).
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { frame } from "@/lib/world";
import { rt } from "@/components/scenes/hospital/mats";
import { Traffic as Sim, BUS, TAXI, DIM as DIM_IMPORT, lightState as lightStateImport } from "./trafficSim";
import type { Net } from "./roads";
import { BUS_LINES, SHELTERS, signalHeads } from "./district";
import { registerSolids, type Solid } from "./collide";

const DIM = DIM_IMPORT, lightState = lightStateImport; // local bindings for the per-frame loops (no import getters)
const COUNTS = { cars: 280, taxis: 64 };
const SHOW_ALT = 3000; // traffic hidden (and paused) above this camera altitude

// part tables per vehicle type: [sx, sy, sz, y, z offset]
const BODY = [[1.8, 0.74, 4.3, 0.6, 0], [1.66, 0.72, 3.85, 0.58, 0], [2.55, 2.75, 12, 1.705, 0]];
const GLASS = [[1.56, 0.56, 2.2, 1.23, -0.2], [1.46, 0.58, 2.05, 1.21, -0.24], [2.6, 1.0, 11.12, 2.15, 0.45]];
const ROOF = [[1.5, 0.08, 1.96, 1.53, -0.22], [1.4, 0.08, 1.84, 1.53, -0.27], [2.5, 0.12, 11.9, 3.12, 0]];
const LAMP_Y = [[0.66, 0.72], [0.62, 0.68], [0.9, 1.02]]; // front, rear
const CAR_PAINT = ["#F4F5F7", "#C9CED8", "#8F98AA", "#4C5568", "#E6E1D8", "#B8C3D6", "#2F3647", "#EDEFF3"];
const TAXI_RED = ["#BF3A30", "#C4402F", "#B9372D"];

function signTexture(text: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 96;
  const g = c.getContext("2d")!;
  g.fillStyle = "#151B2E"; g.fillRect(0, 0, 512, 96);
  const fam = getComputedStyle(document.body).fontFamily || "system-ui";
  g.fillStyle = "#F3B562"; g.textBaseline = "middle"; g.textAlign = "center";
  g.font = `700 50px ${fam}`;
  g.fillText(text, 256, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function flagTexture() {
  const c = document.createElement("canvas");
  c.width = 128; c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#2E5AA6"; g.fillRect(0, 0, 128, 160);
  g.fillStyle = "#F4F6FA";
  // a generic bus pictogram (no logo)
  g.fillRect(30, 22, 68, 46); g.fillStyle = "#2E5AA6"; g.fillRect(36, 28, 56, 18); g.fillStyle = "#F4F6FA";
  g.beginPath(); g.arc(44, 72, 7, 0, Math.PI * 2); g.arc(84, 72, 7, 0, Math.PI * 2); g.fill();
  const fam = getComputedStyle(document.body).fontFamily || "system-ui";
  g.textAlign = "center"; g.textBaseline = "middle"; g.font = `700 30px ${fam}`;
  g.fillText("Casa", 64, 108); g.fillText("Bus", 64, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function poolTexture() {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 16, 4, 32, 58, 70); // bright end towards the car (local −z after rotation)
  gr.addColorStop(0, "rgba(255,236,200,0.9)"); gr.addColorStop(0.5, "rgba(255,226,180,0.3)"); gr.addColorStop(1, "rgba(255,220,170,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Two small lamp boxes (left / right) at x = ±0.36 of a unit-wide vehicle. */
function lampPair() {
  const a = new THREE.BoxGeometry(0.24, 0.13, 0.06).translate(-0.33, 0, 0), b = new THREE.BoxGeometry(0.24, 0.13, 0.06).translate(0.33, 0, 0);
  const pos = [...(a.attributes.position.array as Float32Array), ...(b.attributes.position.array as Float32Array)];
  const ia = Array.from(a.index!.array as ArrayLike<number>), ib = Array.from(b.index!.array as ArrayLike<number>);
  const idx = ia.concat(ib.map((i) => i + a.attributes.position.count));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  a.dispose(); b.dispose();
  return g;
}

/** Column-major instance matrix: yaw rotation (sin = hx, cos = hz) and scale, at (px, py, pz). */
function writeYaw(arr: Float32Array, o: number, hx: number, hz: number, sx: number, sy: number, sz: number, px: number, py: number, pz: number) {
  arr[o] = hz * sx; arr[o + 1] = 0; arr[o + 2] = -hx * sx; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = hx * sz; arr[o + 9] = 0; arr[o + 10] = hz * sz; arr[o + 11] = 0;
  arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
}
/** Yaw × spin about the local x axis (wheels). */
function writeWheel(arr: Float32Array, o: number, hx: number, hz: number, cp: number, sp: number, w: number, r: number, px: number, py: number, pz: number) {
  arr[o] = hz * w; arr[o + 1] = 0; arr[o + 2] = -hx * w; arr[o + 3] = 0;
  arr[o + 4] = hx * sp * r; arr[o + 5] = cp * r; arr[o + 6] = hz * sp * r; arr[o + 7] = 0;
  arr[o + 8] = hx * cp * r; arr[o + 9] = -sp * r; arr[o + 10] = hz * cp * r; arr[o + 11] = 0;
  arr[o + 12] = px; arr[o + 13] = py; arr[o + 14] = pz; arr[o + 15] = 1;
}

export function Traffic({ net }: { net: Net }) {
  const sim = useMemo(() => new Sim(net, COUNTS, BUS_LINES), [net]);
  const N = sim.N;
  const ids = useMemo(() => {
    const taxis: number[] = [], buses: number[][] = BUS_LINES.map(() => []);
    for (let i = 0; i < N; i++) { if (sim.type[i] === TAXI) taxis.push(i); else if (sim.type[i] === BUS) buses[sim.line[i]].push(i); }
    return { taxis, buses, allBuses: buses.flat() };
  }, [sim, N]);
  const heads = useMemo(() => signalHeads(net), [net]);

  const res = useMemo(() => {
    const rbox = new RoundedBoxGeometry(1, 1, 1, 1, 0.14);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const wheel = new THREE.CylinderGeometry(1, 1, 1, 10, 1).rotateZ(Math.PI / 2);
    const plane = new THREE.PlaneGeometry(1, 1);
    const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const lamps = lampPair();
    const pole = new THREE.CylinderGeometry(0.09, 0.11, 1, 8);
    const paint = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.42, metalness: 0.18 });
    const glass = new THREE.MeshStandardMaterial({ color: "#36415A", roughness: 0.2, metalness: 0.3 });
    const tyre = new THREE.MeshStandardMaterial({ color: "#23272F", roughness: 0.85 });
    const taxiSign = new THREE.MeshStandardMaterial({ color: "#F1E7CF", roughness: 0.5, emissive: "#FFE2A8", emissiveIntensity: 0 });
    const band = new THREE.MeshStandardMaterial({ color: "#2E5AA6", roughness: 0.5 });
    const signs = BUS_LINES.map((l) => { const map = signTexture(`Casa Bus · ${l.label}`); return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: "#FFFFFF", emissiveIntensity: 0.55, roughness: 0.6 }); });
    const head = new THREE.MeshBasicMaterial({ color: "#D9DEE7", toneMapped: false });
    const tail = new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false });
    const pool = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const dark = new THREE.MeshStandardMaterial({ color: "#3A4050", roughness: 0.55, metalness: 0.3 });
    const lampOn = new THREE.MeshBasicMaterial({ color: "#FFFFFF", toneMapped: false });
    const shelterFrame = new THREE.MeshStandardMaterial({ color: "#E9ECF2", roughness: 0.5, metalness: 0.2 });
    const shelterGlass = new THREE.MeshStandardMaterial({ color: "#B9CBE0", roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false });
    const flag = new THREE.MeshStandardMaterial({ map: flagTexture(), roughness: 0.6, side: THREE.DoubleSide });
    return { rbox, box, wheel, plane, flat, lamps, pole, paint, glass, tyre, taxiSign, band, signs, head, tail, pool, dark, lampOn, shelterFrame, shelterGlass, flag };
  }, []);
  useEffect(() => () => {
    for (const g of [res.rbox, res.box, res.wheel, res.plane, res.flat, res.lamps, res.pole]) g.dispose();
    for (const m of [res.paint, res.glass, res.tyre, res.taxiSign, res.band, res.head, res.tail, res.pool, res.dark, res.lampOn, res.shelterFrame, res.shelterGlass, res.flag, ...res.signs]) {
      (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose();
    }
  }, [res]);

  const body = useRef<THREE.InstancedMesh>(null), roof = useRef<THREE.InstancedMesh>(null), glass = useRef<THREE.InstancedMesh>(null);
  const wheels = useRef<THREE.InstancedMesh>(null), tsign = useRef<THREE.InstancedMesh>(null), band = useRef<THREE.InstancedMesh>(null);
  const bsigns = useRef<(THREE.InstancedMesh | null)[]>([]), headM = useRef<THREE.InstancedMesh>(null), tailM = useRef<THREE.InstancedMesh>(null), pools = useRef<THREE.InstancedMesh>(null);
  const lights = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);

  // per-vehicle colours (once)
  useLayoutEffect(() => {
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const t = sim.type[i];
      c.set(t === BUS ? "#F2F4F7" : t === TAXI ? TAXI_RED[i % TAXI_RED.length] : CAR_PAINT[(i * 7) % CAR_PAINT.length]);
      body.current?.setColorAt(i, c); roof.current?.setColorAt(i, c);
      tailM.current?.setColorAt(i, c.set("#7A2A26"));
    }
    for (const m of [body.current, roof.current, tailM.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true;
    for (const m of [body.current, roof.current, glass.current, wheels.current, tsign.current, band.current, headM.current, tailM.current, pools.current, ...bsigns.current]) {
      if (m) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
    }
  }, [sim, N]);

  // static furniture: traffic-light poles / heads, bus shelters (+ their colliders)
  const furniture = useMemo(() => {
    const poles: THREE.Matrix4[] = [], headBoxes: THREE.Matrix4[] = [], lampMs: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
    const solids: Solid[] = [];
    for (const h of heads) {
      q.setFromAxisAngle(Y, h.yaw);
      poles.push(new THREE.Matrix4().compose(v.set(h.x, 1.6, h.z), q, s.set(1, 3.2, 1)));
      headBoxes.push(new THREE.Matrix4().compose(v.set(h.x, 3.05, h.z), q, s.set(0.34, 0.95, 0.26)));
      const fx = Math.sin(h.yaw) * 0.15, fz = Math.cos(h.yaw) * 0.15;
      for (let k = 0; k < 3; k++) lampMs.push(new THREE.Matrix4().compose(v.set(h.x + fx, 3.34 - k * 0.29, h.z + fz), q, s.set(0.2, 0.2, 0.04)));
      solids.push({ x0: h.x - 0.2, x1: h.x + 0.2, z0: h.z - 0.2, z1: h.z + 0.2, h: 3.2 });
    }
    // shelter parts in shelter-local metres (open side = +z): [x, y, z, sx, sy, sz, kind] kind 0 frame, 1 glass, 2 flag
    const P: [number, number, number, number, number, number, number][] = [
      [0, 2.5, 0, 3.9, 0.12, 1.7, 0], [-1.85, 1.25, -0.72, 0.08, 2.5, 0.08, 0], [1.85, 1.25, -0.72, 0.08, 2.5, 0.08, 0],
      [0, 0.45, -0.45, 2.6, 0.08, 0.42, 0], [0, 1.3, -0.76, 3.6, 2.2, 0.04, 1], [-1.86, 1.3, -0.2, 0.04, 2.2, 1.0, 1],
      [2.55, 1.45, 0.62, 0.07, 2.9, 0.07, 0], [2.55, 2.6, 0.62, 0.5, 0.62, 0.02, 2],
    ];
    const frames: THREE.Matrix4[] = [], glassMs: THREE.Matrix4[] = [], flags: THREE.Matrix4[] = [];
    for (const sh of SHELTERS) {
      q.setFromAxisAngle(Y, sh.yaw);
      const c = Math.cos(sh.yaw), sn = Math.sin(sh.yaw);
      for (const [x, y, z, sx, sy, sz, k] of P) {
        const wx = sh.x + x * c + z * sn, wz = sh.z - x * sn + z * c;
        const m = new THREE.Matrix4().compose(v.set(wx, y, wz), q, s.set(sx, sy, sz));
        (k === 0 ? frames : k === 1 ? glassMs : flags).push(m);
        if (k !== 2 && sy > 0.3) {
          const ex = Math.abs(sx * c) + Math.abs(sz * sn), ez = Math.abs(sx * sn) + Math.abs(sz * c);
          solids.push({ x0: wx - ex / 2, x1: wx + ex / 2, z0: wz - ez / 2, z1: wz + ez / 2, h: y + sy / 2 });
        }
      }
    }
    return { poles, headBoxes, lampMs, frames, glassMs, flags, solids };
  }, [heads]);
  useEffect(() => { registerSolids("district", furniture.solids); }, [furniture]);
  const poleRef = useRef<THREE.InstancedMesh>(null), headRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null), glassRef = useRef<THREE.InstancedMesh>(null), flagRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const set = (m: THREE.InstancedMesh | null, list: THREE.Matrix4[]) => { if (!m) return; list.forEach((x, i) => m.setMatrixAt(i, x)); m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); };
    set(poleRef.current, furniture.poles); set(headRef.current, furniture.headBoxes); set(lights.current, furniture.lampMs);
    set(frameRef.current, furniture.frames); set(glassRef.current, furniture.glassMs); set(flagRef.current, furniture.flags);
    const LM = lights.current;
    if (LM) { const c = new THREE.Color("#5A2422"); for (let k = 0; k < furniture.lampMs.length; k++) LM.setColorAt(k, c); LM.instanceColor!.needsUpdate = true; }
  }, [furniture]);

  const lampCol = useMemo(() => ({
    r: [new THREE.Color("#5A2422"), new THREE.Color("#F0513F")], a: [new THREE.Color("#5C4720"), new THREE.Color("#F6B443")], g: [new THREE.Color("#1F4A3A"), new THREE.Color("#46D08F")],
    tail: [new THREE.Color("#7A2A26"), new THREE.Color("#E2483C"), new THREE.Color("#B8352C"), new THREE.Color("#FF5A47")],
    tmp: new THREE.Color(), headDay: new THREE.Color("#D9DEE7"), headNight: new THREE.Color(1.6, 1.45, 1.15),
  }), []);
  const lastNight = useRef(-1);
  if (typeof window !== "undefined") (window as unknown as { __traffic: unknown }).__traffic = { sim, net };

  useFrame((_, dt) => {
    const tStart = performance.now();
    const g = group.current;
    const on = frame.alt < SHOW_ALT;
    if (g) g.visible = on;
    if (!on) return;
    // small parts only when close enough to be seen
    const close = frame.alt < 650;
    if (wheels.current) wheels.current.visible = close;
    if (headM.current) headM.current.visible = close || rt.day < 0.9;
    if (tailM.current) tailM.current.visible = close || rt.day < 0.9;
    sim.step(dt);
    const night = 1 - rt.day;
    const B = body.current, R = roof.current, Gl = glass.current, W = wheels.current, H = headM.current, T = tailM.current, PL = pools.current;
    if (!B || !R || !Gl || !W || !H || !T || !PL) return;
    const bA = B.instanceMatrix.array as Float32Array, rA = R.instanceMatrix.array as Float32Array, gA = Gl.instanceMatrix.array as Float32Array;
    const wA = W.instanceMatrix.array as Float32Array, hA = H.instanceMatrix.array as Float32Array, tA = T.instanceMatrix.array as Float32Array, pA = PL.instanceMatrix.array as Float32Array;
    const tailCol = T.instanceColor!.array as Float32Array;
    const nightOn = night > 0.03;
    for (let i = 0; i < N; i++) {
      const t = sim.type[i], hx = sim.hx[i], hz = sim.hz[i], cx = sim.cx[i], cz = sim.cz[i];
      const D = DIM[t], bo = BODY[t], go = GLASS[t], ro = ROOF[t];
      writeYaw(bA, i * 16, hx, hz, bo[0], bo[1], bo[2], cx + hx * bo[4], bo[3], cz + hz * bo[4]);
      writeYaw(gA, i * 16, hx, hz, go[0], go[1], go[2], cx + hx * go[4], go[3], cz + hz * go[4]);
      writeYaw(rA, i * 16, hx, hz, ro[0], ro[1], ro[2], cx + hx * ro[4], ro[3], cz + hz * ro[4]);
      const sp = Math.sin(sim.wheel[i]), cp = Math.cos(sim.wheel[i]);
      const lx = hz, lz = -hx; // local +x axis in world
      for (let k = 0; k < 4; k++) {
        const ax = k < 2 ? D.af : -D.ar, sd = k % 2 ? 1 : -1;
        writeWheel(wA, (i * 4 + k) * 16, hx, hz, cp, sp, t === BUS ? 0.3 : 0.22, D.wr, cx + hx * ax + lx * D.tr * sd, D.wr, cz + hz * ax + lz * D.tr * sd);
      }
      const L2 = D.len / 2 + 0.03;
      writeYaw(hA, i * 16, hx, hz, D.w * 0.9, 1, 1, cx + hx * L2, LAMP_Y[t][0], cz + hz * L2);
      writeYaw(tA, i * 16, hx, hz, D.w * 0.9, 1, 1, cx - hx * L2, LAMP_Y[t][1], cz - hz * L2);
      const tc = lampCol.tail[(nightOn ? 2 : 0) + sim.brake[i]];
      tailCol[i * 3] = tc.r; tailCol[i * 3 + 1] = tc.g; tailCol[i * 3 + 2] = tc.b;
      if (nightOn) writeYaw(pA, i * 16, hx, hz, D.w * 2.0, 1, t === BUS ? 10 : 8.5, cx + hx * (L2 + 4.1), 0.11, cz + hz * (L2 + 4.1));
    }
    B.instanceMatrix.needsUpdate = R.instanceMatrix.needsUpdate = Gl.instanceMatrix.needsUpdate = W.instanceMatrix.needsUpdate = true;
    H.instanceMatrix.needsUpdate = T.instanceMatrix.needsUpdate = true;
    T.instanceColor!.needsUpdate = true;
    PL.visible = nightOn;
    if (nightOn) PL.instanceMatrix.needsUpdate = true;
    // taxi roof signs, bus bands and destination signs
    const TS = tsign.current;
    if (TS) {
      const a = TS.instanceMatrix.array as Float32Array;
      for (let k = 0; k < ids.taxis.length; k++) {
        const i = ids.taxis[k], hx = sim.hx[i], hz = sim.hz[i];
        writeYaw(a, k * 16, hx, hz, 0.62, 0.2, 0.3, sim.cx[i] + hx * -0.3, 1.67, sim.cz[i] + hz * -0.3);
      }
      TS.instanceMatrix.needsUpdate = true;
    }
    const BA = band.current;
    if (BA) {
      const a = BA.instanceMatrix.array as Float32Array;
      for (let k = 0; k < ids.allBuses.length; k++) { const i = ids.allBuses[k]; writeYaw(a, k * 16, sim.hx[i], sim.hz[i], 2.6, 0.34, 11.96, sim.cx[i], 1.05, sim.cz[i]); }
      BA.instanceMatrix.needsUpdate = true;
    }
    for (let l = 0; l < ids.buses.length; l++) {
      const M = bsigns.current[l];
      if (!M) continue;
      const a = M.instanceMatrix.array as Float32Array, list = ids.buses[l];
      for (let k = 0; k < list.length; k++) {
        const i = list[k], hx = sim.hx[i], hz = sim.hz[i], cx = sim.cx[i], cz = sim.cz[i];
        writeYaw(a, k * 48, hx, hz, 1.9, 0.34, 1, cx + hx * 6.02, 2.86, cz + hz * 6.02);              // front
        writeYaw(a, k * 48 + 16, hz, -hx, 1.7, 0.3, 1, cx + hx * 3.3 + hz * 1.31, 2.82, cz + hz * 3.3 - hx * 1.31);  // sides
        writeYaw(a, k * 48 + 32, -hz, hx, 1.7, 0.3, 1, cx + hx * 3.3 - hz * 1.31, 2.82, cz + hz * 3.3 + hx * 1.31);
      }
      M.instanceMatrix.needsUpdate = true;
    }
    // night look
    if (Math.abs(night - lastNight.current) > 0.01) {
      lastNight.current = night;
      res.head.color.copy(lampCol.headDay).lerp(lampCol.headNight, night);
      res.pool.opacity = night * 0.85;
      res.taxiSign.emissiveIntensity = night * 1.1;
      for (let k = 0; k < res.signs.length; k++) res.signs[k].emissiveIntensity = 0.55 + night * 0.7;
    }
    // traffic lights
    const LM = lights.current;
    if (LM && LM.instanceColor && heads.length) {
      const arr = LM.instanceColor.array as Float32Array;
      for (let h = 0; h < heads.length; h++) {
        const st = lightState(heads[h].offset, heads[h].group, sim.time);
        for (let k = 0; k < 3; k++) {
          const c = k === 0 ? lampCol.r[st === 0 ? 1 : 0] : k === 1 ? lampCol.a[st === 1 ? 1 : 0] : lampCol.g[st === 2 ? 1 : 0];
          arr[(h * 3 + k) * 3] = c.r; arr[(h * 3 + k) * 3 + 1] = c.g; arr[(h * 3 + k) * 3 + 2] = c.b;
        }
      }
      LM.instanceColor.needsUpdate = true;
    }
    sim.stats.frameMs = sim.stats.frameMs * 0.95 + (performance.now() - tStart) * 0.05; // traffic JS cost per frame (sim + matrices)
  });

  return (
    <group ref={group}>
      <instancedMesh ref={body} args={[res.rbox, res.paint, N]} castShadow />
      <instancedMesh ref={roof} args={[res.box, res.paint, N]} />
      <instancedMesh ref={glass} args={[res.box, res.glass, N]} />
      <instancedMesh ref={wheels} args={[res.wheel, res.tyre, N * 4]} />
      <instancedMesh ref={headM} args={[res.lamps, res.head, N]} />
      <instancedMesh ref={tailM} args={[res.lamps, res.tail, N]} />
      <instancedMesh ref={pools} args={[res.flat, res.pool, N]} renderOrder={2} />
      {ids.taxis.length > 0 && <instancedMesh ref={tsign} args={[res.box, res.taxiSign, ids.taxis.length]} />}
      {ids.allBuses.length > 0 && <instancedMesh ref={band} args={[res.box, res.band, ids.allBuses.length]} />}
      {ids.buses.map((l, k) => l.length > 0 && <instancedMesh key={k} ref={(r) => { bsigns.current[k] = r; }} args={[res.plane, res.signs[k], l.length * 3]} />)}
      {heads.length > 0 && (
        <>
          <instancedMesh ref={poleRef} args={[res.pole, res.dark, heads.length]} castShadow />
          <instancedMesh ref={headRef} args={[res.box, res.dark, heads.length]} castShadow />
          <instancedMesh ref={lights} args={[res.box, res.lampOn, heads.length * 3]} />
        </>
      )}
      <instancedMesh ref={frameRef} args={[res.box, res.shelterFrame, furniture.frames.length]} castShadow receiveShadow />
      <instancedMesh ref={glassRef} args={[res.box, res.shelterGlass, furniture.glassMs.length]} />
      <instancedMesh ref={flagRef} args={[res.box, res.flag, furniture.flags.length]} />
    </group>
  );
}
