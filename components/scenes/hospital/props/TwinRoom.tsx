"use client";
// The digital-twin pilot room on the top floor, animated parts (the staged furniture is in twinStages.ts):
// States follow lib/model visualStage(year): "2026" = stage 0 (today), "2027" = 1, "2028" = 2, "2029" = 3 (full).
//  · 2028 →  the two large screens of the pilot desk (building view, flow curves)
//  · 2029    the hologram above the twin table — both buildings with their floors stacked, a soft status glow per
//            floor, pulsing flow lines with moving dots, a slowly rotating scan ring — the five panels of the curved
//            screen wall (energy, maintenance, twin, patient flows, fluids), calm blue ambient light (halos, haze)
//  · the year gate: Twin.tsx draws a twin screen, a miniature, an energy screen, location tags and data flows in every
//    year; here they follow the timeline instead (no twin technology in 2026: tags from 2027, flows in 2029, and the
//    screens / miniature are replaced by this room's own, richer versions).
// Floor-local frame of the main building (mounted inside the floor's props group: lift, fade and LOD come with it).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEPT, FLOOR_H } from "@/lib/hospital";
import { haloTexture, rt } from "../mats";
import { TWIN_POS } from "../Twin";
import { ARC, TABLE, arcPanel, pilotScreen } from "./twinStages";
import { paintPanel, paintPilot } from "./twinPaint";
import { SNAP, type PropMats, type YearClock } from "./FloorProps";

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- Twin.tsx gate
const TECH_X = DEPT.technique?.rect[0] ?? 13;
type Gate = { root: THREE.Object3D; hide: THREE.Object3D[]; tags: THREE.Object3D[]; flow: THREE.Object3D[] };
const near = (o: THREE.Object3D, x: number, z: number) => Math.abs(o.position.x - x) < 0.05 && Math.abs(o.position.z - z) < 0.05 && Math.abs(o.position.y) < 0.05;
/** Find Twin.tsx's FourthFloor group (its children: quality screen, kiosk, twin screen, miniature, energy screen,
 *  bench equipment, the tag instances, the data-flow points). Null if Twin.tsx has changed shape. */
function findGate(scene: THREE.Object3D | null): Gate | null {
  if (!scene) return null;
  let found: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (found || !o.children.length) return;
    const kids = o.children;
    if (kids.some((c) => near(c, TWIN_POS.x, TWIN_POS.z)) && kids.some((c) => near(c, TECH_X - 3, -12.15))) found = o;
  });
  const root = found as THREE.Object3D | null;
  if (!root) return null;
  const hide: THREE.Object3D[] = [], tags: THREE.Object3D[] = [], flow: THREE.Object3D[] = [];
  for (const c of root.children) {
    if (near(c, TECH_X - 3, -12.15) || near(c, TWIN_POS.x, TWIN_POS.z) || near(c, TECH_X + 8.5, -12.15)) hide.push(c);
    else if ((c as THREE.InstancedMesh).isInstancedMesh) tags.push(c);
    else if ((c as THREE.Points).isPoints) flow.push(c);
  }
  return { root, hide, tags, flow };
}
const attached = (o: THREE.Object3D) => { let p: THREE.Object3D | null = o; while (p.parent) p = p.parent; return (p as THREE.Scene).isScene === true; };

// ---------------------------------------------------------------- canvas helper
function canvasTex(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { c, g, tex };
}
function gradientTex(stops: [number, string][], vertical = true) {
  const c = document.createElement("canvas");
  c.width = vertical ? 4 : 256; c.height = vertical ? 256 : 4;
  const g = c.getContext("2d")!;
  const gr = vertical ? g.createLinearGradient(0, 0, 0, 256) : g.createLinearGradient(0, 0, 256, 0);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function gridTex() {
  const { g, tex } = canvasTex(512, 512);
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = "rgba(156,176,255,0.55)"; g.lineWidth = 2;
  for (let r = 60; r < 256; r += 48) { g.beginPath(); g.arc(256, 256, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = "rgba(156,176,255,0.25)"; g.lineWidth = 1.5;
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; g.beginPath(); g.moveTo(256 + Math.cos(a) * 40, 256 + Math.sin(a) * 40); g.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); g.stroke(); }
  g.strokeStyle = "rgba(156,176,255,0.9)"; g.lineWidth = 4; g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); g.stroke();
  tex.needsUpdate = true;
  return tex;
}
function labelTex(text: string) {
  const { g, tex } = canvasTex(512, 96);
  g.clearRect(0, 0, 512, 96);
  g.font = "600 44px 'Segoe UI', system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillStyle = "rgba(190,205,255,0.95)"; g.fillText(text, 256, 50);
  tex.needsUpdate = true;
  return tex;
}

// ---------------------------------------------------------------- hologram geometry (miniature of both buildings)
const S = 1 / 46, FH = 0.118, BASE = 1.0;               // model scale, floor spacing (exaggerated), first slab height
const MX = -15.5 * S;                                    // centre the pair of buildings over the table
type Slab = { x: number; z: number; w: number; d: number; y: number; status: number };
function holoModel() {
  const slabs: Slab[] = [];
  const add = (bx: number, bz: number, w: number, d: number, f0: number, f1: number) => {
    for (let f = f0; f <= f1; f++) slabs.push({ x: MX + bx * S, z: bz * S, w: w * S, d: d * S, y: BASE + (f + 1) * FH, status: 0 });
  };
  add(0, 0, 52, 26, -1, 4);   // main building, basement to 4th floor
  add(46, -2, 22, 18, 0, 3);  // head office annex
  // status of a few floors (calm): green = good, amber = attention (slow pulse)
  slabs[2].status = 1; slabs[4].status = 1; slabs[3].status = 2; slabs[8].status = 1;
  // outlines: slab rectangles + corner verticals
  const seg: number[] = [];
  const rect = (s: Slab) => {
    const x0 = s.x - s.w / 2, x1 = s.x + s.w / 2, z0 = s.z - s.d / 2, z1 = s.z + s.d / 2;
    seg.push(x0, s.y, z0, x1, s.y, z0, x1, s.y, z0, x1, s.y, z1, x1, s.y, z1, x0, s.y, z1, x0, s.y, z1, x0, s.y, z0);
  };
  slabs.forEach(rect);
  const vert = (x: number, z: number, y0: number, y1: number) => seg.push(x, y0, z, x, y1, z);
  for (const [bx, bz, w, d, f0, f1] of [[0, 0, 52, 26, -1, 4], [46, -2, 22, 18, 0, 3]] as const) {
    const x = MX + bx * S, z = bz * S, hw = (w * S) / 2, hd = (d * S) / 2;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vert(x + sx * hw, z + sz * hd, BASE + (f0 + 1) * FH, BASE + (f1 + 1) * FH + 0.06);
  }
  // skybridge at floor 1
  const yb = BASE + 2 * FH;
  const bx0 = MX + 26 * S, bx1 = MX + 35 * S, bz0 = -5.4 * S, bz1 = -1.6 * S;
  seg.push(bx0, yb, bz0, bx1, yb, bz0, bx0, yb, bz1, bx1, yb, bz1);
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
  // flows (patient paths, data toward the technical floor): quadratic arcs between departments (building frame)
  const P = (bx: number, bz: number, f: number) => new THREE.Vector3(MX + bx * S, BASE + (f + 1) * FH + 0.02, bz * S);
  const D = (id: string) => { const d = DEPT[id]; const ox = d.building === "annex" ? 46 : 0, oz = d.building === "annex" ? -2 : 0; return P(ox + d.rect[0], oz + d.rect[1], d.floor); };
  const pairs: [THREE.Vector3, THREE.Vector3, number][] = [
    [D("urgences"), D("imagerie"), 0.12], [D("urgences"), D("bloc"), 0.25], [D("bloc"), D("reanimation"), 0.1],
    [D("reanimation"), D("hospitalisation"), 0.18], [D("hospitalisation"), D("accueil"), 0.3], [D("admissions"), D("consultations"), 0.15],
    [D("facturation"), D("siege-finance"), 0.2], [D("laboratoire"), D("technique"), 0.3], [D("logistique"), D("technique"), 0.4], [D("siege-pilotage"), D("technique"), 0.25],
  ];
  const curves = pairs.map(([a, b, lift]) => { const m = a.clone().lerp(b, 0.5); m.y = Math.max(a.y, b.y) + lift; return new THREE.QuadraticBezierCurve3(a, m, b); });
  const flowLines = new THREE.BufferGeometry();
  const fl: number[] = [];
  for (const c of curves) { const pts = c.getPoints(24); for (let i = 0; i < pts.length - 1; i++) fl.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z); }
  flowLines.setAttribute("position", new THREE.Float32BufferAttribute(fl, 3));
  const nDots = curves.length * 5;
  const dots = new THREE.BufferGeometry();
  dots.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nDots * 3), 3));
  // sensor dots on each slab
  const sens: number[] = [], sensCol: number[] = [];
  const r = (() => { let a = 99; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  const cols = [new THREE.Color("#7D97FF"), new THREE.Color("#4CC79A"), new THREE.Color("#E2B05A")];
  for (const s of slabs) for (let i = 0; i < 7; i++) { sens.push(s.x + (r() - 0.5) * s.w * 0.9, s.y + 0.012, s.z + (r() - 0.5) * s.d * 0.9); const c = cols[i === 0 && s.status === 2 ? 2 : i % 3 === 0 ? 1 : 0]; sensCol.push(c.r, c.g, c.b); }
  const sensors = new THREE.BufferGeometry();
  sensors.setAttribute("position", new THREE.Float32BufferAttribute(sens, 3));
  sensors.setAttribute("color", new THREE.Float32BufferAttribute(sensCol, 3));
  return { slabs, lines, curves, flowLines, dots, sensors, sensBase: Float32Array.from(sensCol), top: BASE + 7 * FH };
}

export default function TwinRoom({ mats, clock }: { mats: PropMats; clock: YearClock }) {
  // ---------- resources
  const res = useMemo(() => {
    const model = holoModel();
    const add = (o: THREE.MaterialParameters & { color?: THREE.ColorRepresentation; map?: THREE.Texture | null }) =>
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, ...o });
    const slabMat = add({ color: "#FFFFFF", opacity: 0.2 });
    const lineMat = new THREE.LineBasicMaterial({ color: "#A9BCFF", transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const flowLineMat = new THREE.LineBasicMaterial({ color: "#7D97FF", transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const dotMat = new THREE.PointsMaterial({ size: 0.05, map: haloTexture(), color: "#BFF0DA", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const sensMat = new THREE.PointsMaterial({ size: 0.035, map: haloTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const ringMat = add({ color: "#9FB6FF", opacity: 0.55 });
    const sweepMat = add({ color: "#D8E2FF", opacity: 0.9 });
    const haze = gradientTex([[0, "rgba(140,165,255,0.0)"], [0.25, "rgba(140,165,255,0.35)"], [1, "rgba(140,165,255,0.9)"]]);
    const hazeMat = add({ map: haze, opacity: 0.16, side: THREE.DoubleSide });
    const grid = gridTex();
    const gridMat = add({ map: grid, opacity: 0.8, color: "#B9C8FF" });
    const haloMat = add({ map: haloTexture(), color: "#7F98FF", opacity: 0.3 });
    const wallMat = add({ map: haloTexture(), color: "#6E88F0", opacity: 0.16 });
    const labels = [labelTex("Bâtiment principal"), labelTex("Siège")];
    const labelMats = labels.map((t) => add({ map: t, opacity: 0.85 }));
    // screens: five panels of the curved wall, two pilot screens
    const panels = Array.from({ length: ARC.n }, () => canvasTex(560, 382));
    const pilots = [canvasTex(512, 292), canvasTex(512, 292)];
    const scr = (t: THREE.Texture) => new THREE.MeshBasicMaterial({ map: t, toneMapped: false, color: "#000000" });
    const panelMats = panels.map((p) => scr(p.tex)), pilotMats = pilots.map((p) => scr(p.tex));
    const slabGeo = new THREE.BoxGeometry(1, 1, 1);
    const ringGeo = new THREE.TorusGeometry(1.08, 0.004, 4, 96);
    const sweepGeo = new THREE.TorusGeometry(1.08, 0.009, 4, 48, Math.PI / 3);
    const bandGeo = new THREE.RingGeometry(1.0, 1.1, 96);
    const hazeGeo = new THREE.CylinderGeometry(0.98, 0.96, 1.0, 64, 1, true);
    const quad = new THREE.PlaneGeometry(1, 1);
    const disc = new THREE.CircleGeometry(0.94, 64);
    return { model, slabMat, lineMat, flowLineMat, dotMat, sensMat, ringMat, sweepMat, haze, hazeMat, grid, gridMat, haloMat, wallMat, labels, labelMats, panels, pilots, panelMats, pilotMats, slabGeo, ringGeo, sweepGeo, bandGeo, hazeGeo, quad, disc };
  }, []);
  useEffect(() => () => {
    const r = res;
    [r.model.lines, r.model.flowLines, r.model.dots, r.model.sensors, r.slabGeo, r.ringGeo, r.sweepGeo, r.bandGeo, r.hazeGeo, r.quad, r.disc].forEach((g) => g.dispose());
    [r.slabMat, r.lineMat, r.flowLineMat, r.dotMat, r.sensMat, r.ringMat, r.sweepMat, r.hazeMat, r.gridMat, r.haloMat, r.wallMat, ...r.labelMats, ...r.panelMats, ...r.pilotMats].forEach((m) => m.dispose());
    [r.haze, r.grid, ...r.labels, ...r.panels.map((p) => p.tex), ...r.pilots.map((p) => p.tex)].forEach((t) => t.dispose());
  }, [res]);

  const slabRef = useRef<THREE.InstancedMesh>(null);
  const holo = useRef<THREE.Group>(null), ring = useRef<THREE.Group>(null), sweep = useRef<THREE.Mesh>(null), screens = useRef<THREE.Group>(null), pilotsRef = useRef<THREE.Group>(null);
  const st = useMemo(() => ({ p28: clock.stage >= 2 ? 1 : 0, p29: clock.stage === 3 ? 1 : 0, p27: clock.stage >= 1 ? 1 : 0, gate: null as Gate | null, gateAt: -10, snap: SNAP.n, paintAt: 0, rr: 0, slabC: new THREE.Color(), m: new THREE.Matrix4(), v: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() }), [clock]);

  useEffect(() => {
    const m = slabRef.current;
    if (!m) return;
    res.model.slabs.forEach((s, i) => { st.m.compose(st.v.set(s.x, s.y, s.z), st.q.identity(), st.s.set(s.w, 0.01, s.d)); m.setMatrixAt(i, st.m); m.setColorAt(i, st.slabC.set("#7D97FF")); });
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [res, st]);

  useFrame((state, dt) => {
    const t = clock.t, d = Math.min(dt, 0.1);
    const snap = st.snap !== SNAP.n;
    st.snap = SNAP.n;
    const sg = clock.stage, since = snap ? 99 : t - clock.at;
    // presence of each stage (smooth, ≈1.4 s), the hologram waits for its pedestal
    const step = (cur: number, on: boolean, delay = 0) => (snap ? (on ? 1 : 0) : since < delay ? cur : on ? Math.min(1, cur + d / 1.4) : Math.max(0, cur - d / 1.0));
    st.p27 = step(st.p27, sg >= 1); st.p28 = step(st.p28, sg >= 2, 0.2); st.p29 = step(st.p29, sg === 3, sg === 3 ? 0.6 : 0);
    // ---------- gate Twin.tsx's always-on technique displays
    if ((!st.gate || !attached(st.gate.root)) && t - st.gateAt > 1) { st.gateAt = t; st.gate = findGate(rt.root); }
    if (st.gate) {
      for (const o of st.gate.hide) o.visible = false;
      for (const o of st.gate.tags) o.visible = st.p27 > 0.5;
      for (const o of st.gate.flow) o.visible = st.p29 > 0.5;
    }
    const fop = mats.matte.opacity;                       // the floor's fade (exploded view, cut-away)
    const h29 = smooth((st.p29 - 0.2) / 0.8) * fop;
    // ---------- hologram
    if (holo.current) holo.current.visible = h29 > 0.01;
    if (h29 > 0.01 && slabRef.current) {
      const m = slabRef.current;
      res.model.slabs.forEach((s, i) => {
        const fi = smooth(h29 * 1.6 - i * 0.06);          // floors appear one after the other
        const pulse = s.status === 2 ? 0.55 + 0.45 * Math.sin(t * 1.6) : 1;
        st.slabC.set(s.status === 1 ? "#4CC79A" : s.status === 2 ? "#E2B05A" : "#7D97FF").multiplyScalar(fi * pulse * (0.75 + 0.25 * Math.sin(t * 0.9 + i)));
        m.setColorAt(i, st.slabC);
      });
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      res.lineMat.opacity = 0.7 * h29; res.flowLineMat.opacity = 0.32 * h29 * (0.75 + 0.25 * Math.sin(t * 1.3));
      res.sensMat.opacity = h29; res.dotMat.opacity = h29; res.hazeMat.opacity = 0.14 * h29; res.gridMat.opacity = 0.75 * h29;
      res.labelMats.forEach((mm) => (mm.opacity = 0.85 * h29));
      // moving dots along the flows
      const pos = res.model.dots.attributes.position as THREE.BufferAttribute;
      res.model.curves.forEach((c, ci) => {
        for (let k = 0; k < 5; k++) { c.getPoint(((t * 0.16 + k / 5 + ci * 0.11) % 1), st.v); pos.setXYZ(ci * 5 + k, st.v.x, st.v.y, st.v.z); }
      });
      pos.needsUpdate = true;
      // blinking sensors
      const sc = res.model.sensors.attributes.color as THREE.BufferAttribute, base = res.model.sensBase;
      for (let i = 0; i < sc.count; i++) { const k = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.3 + i * 1.7)); sc.setXYZ(i, base[i * 3] * k, base[i * 3 + 1] * k, base[i * 3 + 2] * k); }
      sc.needsUpdate = true;
      // scan ring: rises and falls through the model, its bright arc turning slowly
      if (ring.current) {
        const u = 0.5 - 0.5 * Math.cos(t * 0.55);
        ring.current.position.y = 0.98 + u * (res.model.top - 0.9);
        res.ringMat.opacity = 0.45 * h29; res.sweepMat.opacity = 0.85 * h29;
      }
      if (sweep.current) sweep.current.rotation.z = t * 0.5;
    }
    res.haloMat.opacity = 0.3 * h29 + 0.08 * smooth(st.p28) * fop;
    res.wallMat.opacity = 0.16 * h29;
    // ---------- screens: power on with a short delay each, redraw one canvas per tick (~6 fps overall)
    if (screens.current) screens.current.visible = st.p29 > 0.01;
    if (pilotsRef.current) pilotsRef.current.visible = st.p28 > 0.01;
    for (let i = 0; i < res.panelMats.length; i++) res.panelMats[i].color.setScalar(smooth(st.p29 * 1.6 - i * 0.12) * fop * 0.95);
    for (let i = 0; i < res.pilotMats.length; i++) res.pilotMats[i].color.setScalar(smooth(st.p28 * 1.5 - i * 0.2) * fop * 0.95);
    // redraw one canvas per tick, round robin (only while the room is drawn)
    let o: THREE.Object3D | null = holo.current?.parent ?? null, shown = true;
    while (o) { if (!o.visible) { shown = false; break; } o = o.parent; }
    const n29 = st.p29 > 0.01 ? ARC.n : 0, n = n29 + (st.p28 > 0.01 ? 2 : 0);
    // ≈14 canvas uploads per second at most, and only when the camera is close enough to read them
    let near = false;
    if (shown && n && holo.current) { holo.current.getWorldPosition(st.v); near = state.camera.position.distanceTo(st.v) < 45; }
    if (near && t - st.paintAt > 0.07) {
      st.paintAt = t;
      st.rr = (st.rr + 1) % n;
      const p = st.rr < n29 ? res.panels[st.rr] : res.pilots[st.rr - n29];
      if (st.rr < n29) paintPanel(st.rr, p.g, t, p.c.width, p.c.height); else paintPilot(st.rr - n29, p.g, t, p.c.width, p.c.height);
      p.tex.needsUpdate = true;
    }
  });

  const P0 = useMemo(() => Array.from({ length: ARC.n }, (_, i) => arcPanel(i)), []);
  const PS = useMemo(() => [pilotScreen(0), pilotScreen(1)], []);
  const H = ARC.h, Wp = ARC.w;
  return (
    <group>
      {/* curved screen wall: the picture of each panel, 4 mm in front of its bezel */}
      <group ref={screens} visible={false}>
        {P0.map((p, i) => (
          <mesh key={i} geometry={res.quad} material={res.panelMats[i]} position={[p.x + Math.sin(p.yaw) * -0.004, ARC.y, p.z + Math.cos(p.yaw) * -0.004]} rotation-y={p.yaw} scale={[Wp, H, 1]} />
        ))}
        {/* soft blue wash on the floor in front of the wall */}
        <mesh geometry={res.quad} material={res.wallMat} position={[ARC.cx, 0.03, ARC.cz - ARC.r + 1.2]} rotation-x={-Math.PI / 2} scale={[12, 4.5, 1]} />
      </group>
      <group ref={pilotsRef} visible={false}>
        {PS.map((p, i) => <mesh key={i} geometry={res.quad} material={res.pilotMats[i]} position={[p.x, p.y, p.z]} rotation-y={p.yaw} scale={[p.w, p.h, 1]} />)}
      </group>
      {/* floor halo under the table (2028 faint, 2029 full) */}
      <mesh geometry={res.quad} material={res.haloMat} position={[TABLE.x, 0.025, TABLE.z]} rotation-x={-Math.PI / 2} scale={[4.6, 4.6, 1]} />
      {/* the hologram */}
      <group ref={holo} position={[TABLE.x, 0, TABLE.z]} visible={false}>
        <mesh geometry={res.disc} material={res.gridMat} position={[0, 0.934, 0]} rotation-x={-Math.PI / 2} />
        <mesh geometry={res.hazeGeo} material={res.hazeMat} position={[0, 1.43, 0]} />
        <instancedMesh ref={slabRef} args={[res.slabGeo, res.slabMat, res.model.slabs.length]} frustumCulled={false} />
        <lineSegments geometry={res.model.lines} material={res.lineMat} />
        <lineSegments geometry={res.model.flowLines} material={res.flowLineMat} />
        <points geometry={res.model.dots} material={res.dotMat} frustumCulled={false} />
        <points geometry={res.model.sensors} material={res.sensMat} />
        <group ref={ring}>
          <mesh geometry={res.ringGeo} material={res.ringMat} rotation-x={Math.PI / 2} />
          <mesh geometry={res.bandGeo} material={res.ringMat} rotation-x={-Math.PI / 2} scale={[1, 1, 1]} visible={false} />
          <mesh ref={sweep} geometry={res.sweepGeo} material={res.sweepMat} rotation-x={Math.PI / 2} />
        </group>
        {/* labels facing the pilots */}
        <mesh geometry={res.quad} material={res.labelMats[0]} position={[MX, res.model.top + 0.16, 0.05]} scale={[0.62, 0.115, 1]} />
        <mesh geometry={res.quad} material={res.labelMats[1]} position={[MX + 46 * S, BASE + 5 * FH + 0.16, -2 * S + 0.05]} scale={[0.36, 0.068, 1]} />
      </group>
    </group>
  );
}
export const TWIN_FLOOR_Y = (DEPT.technique?.floor ?? 4) * FLOOR_H;
