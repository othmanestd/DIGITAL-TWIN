"use client";
// 4th floor (v1.3): the quality wall screen and patient-feedback kiosk (Qualité et patients), and the JABB Twin control
// room (Technique et énergie): a large twin screen with a miniature of the building and live sensor dots, an energy
// dashboard, biomedical equipment carrying blue location tags, data dots rising from the floors below.
// SensorNet (campus frame): a faint sensor network on the ceilings of every floor, shown when the technique
// department or an I-case is selected, pulsing towards the 4th floor.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEPT, FLOOR_H, FLOORS, MAIN, ANNEX } from "@/lib/hospital";
import { useApp } from "@/lib/store";
import { haloTexture, rt, type FloorMats } from "./mats";
import { focusOf } from "./nav";

type Painter = { tex: THREE.CanvasTexture; draw: (t: number) => void };
function painter(w: number, h: number, fn: (g: CanvasRenderingContext2D, t: number, w: number, h: number) => void): Painter {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const draw = (t: number) => { fn(g, t, w, h); tex.needsUpdate = true; };
  draw(0);
  return { tex, draw };
}
const F = (s: number, w = 600) => `${w} ${s}px 'Segoe UI', system-ui, sans-serif`;
const bg = (g: CanvasRenderingContext2D, w: number, h: number) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#131D44"); gr.addColorStop(1, "#0A112C");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
};

const WORDS: [string, number, string][] = [
  ["accueil", 46, "#9CB0FF"], ["écoute", 38, "#4CC79A"], ["attente", 34, "#E2B05A"], ["propreté", 30, "#C3CAD9"], ["délais", 28, "#E2B05A"],
  ["explications", 26, "#9CB0FF"], ["sourire", 24, "#4CC79A"], ["repas", 20, "#C3CAD9"], ["parking", 18, "#8D97B0"], ["confiance", 30, "#4CC79A"],
];
const qualityPaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  bg(g, w, h);
  g.textAlign = "left"; g.fillStyle = "#9CB0FF"; g.font = F(22, 700); g.fillText("QUALITÉ · VOIX DU PATIENT", 28, 44);
  // indicator tiles: labels + neutral sparklines (no invented values)
  const tiles: [string, string][] = [["Satisfaction", "#4CC79A"], ["Réclamations", "#9CB0FF"], ["Incidents déclarés", "#E2B05A"]];
  tiles.forEach(([l, c], i) => {
    const x = 28 + i * 200;
    g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(x, 64, 184, 104);
    g.fillStyle = "#EDF0F7"; g.font = F(19, 600); g.fillText(l, x + 14, 94);
    g.strokeStyle = c; g.lineWidth = 3; g.beginPath();
    for (let k = 0; k <= 10; k++) { const xx = x + 14 + k * 15.5, yy = 146 - 18 * (0.5 + 0.5 * Math.sin(k * 0.9 + i * 1.7 + t * 0.4)); if (k) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
    g.stroke();
  });
  // word cloud (patient voice), gently breathing
  let x = 660, y = 90;
  WORDS.forEach(([word, size, col], i) => {
    const s = size * (1 + 0.04 * Math.sin(t * 1.3 + i));
    g.font = F(s, 600); g.fillStyle = col;
    const wd = g.measureText(word).width;
    if (x + wd > w - 24) { x = 660; y += 52; }
    g.fillText(word, x, y);
    x += wd + 18;
  });
  // trend line
  g.strokeStyle = "#4CC79A"; g.lineWidth = 3; g.beginPath();
  for (let i = 0; i <= 24; i++) { const xx = 28 + i * 24, yy = 300 - (Math.sin(i * 0.5) * 16 + i * 3.4); if (i) g.lineTo(xx, yy); else g.moveTo(xx, yy); }
  g.stroke();
};
const kioskPaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  bg(g, w, h);
  g.textAlign = "center"; g.fillStyle = "#EDF0F7"; g.font = F(26, 600); g.fillText("Votre avis compte", w / 2, 48);
  const cols = ["#E07A6F", "#E2B05A", "#9CB0FF", "#4CC79A"];
  cols.forEach((c, i) => {
    const cx = 52 + i * 72, cy = 128, hl = Math.floor(t / 1.5) % 4 === i;
    g.fillStyle = c; g.globalAlpha = hl ? 1 : 0.55; g.beginPath(); g.arc(cx, cy, hl ? 28 : 24, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
    g.fillStyle = "#0A112C"; g.beginPath(); g.arc(cx - 8, cy - 6, 3.5, 0, 7); g.arc(cx + 8, cy - 6, 3.5, 0, 7); g.fill();
    g.strokeStyle = "#0A112C"; g.lineWidth = 3; g.beginPath();
    const k = (i - 1.5) * 4; g.moveTo(cx - 10, cy + 8 - k * 0.3); g.quadraticCurveTo(cx, cy + 8 + k, cx + 10, cy + 8 - k * 0.3); g.stroke();
  });
  g.fillStyle = "#8D97B0"; g.font = F(18, 500); g.fillText("Analysé par l'agent, transmis au service", w / 2, 200);
};
const twinPaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  bg(g, w, h);
  g.strokeStyle = "rgba(156,176,255,0.10)"; g.lineWidth = 1;
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.textAlign = "left"; g.fillStyle = "#9CB0FF"; g.font = F(24, 700); g.fillText("JABB TWIN · JUMEAU NUMÉRIQUE", 28, 46);
  // v1.3 JABB Twin targets, labelled "cible" (no live figures are invented)
  const rows: [string, string, string][] = [
    ["Énergie", "−10 à −15 % (cible)", "#4CC79A"],
    ["Recherche des équipements", "temps divisé par 2 (cible)", "#9CB0FF"],
    ["Disponibilité des équipements", "+2 à 3 points (cible)", "#9CB0FF"],
    ["Maintenance", "préventive et prédictive", "#C3CAD9"],
  ];
  rows.forEach(([a, b, c], i) => {
    const y = 96 + i * 44;
    g.fillStyle = "#C3CAD9"; g.font = F(19, 500); g.fillText(a, 28, y);
    g.fillStyle = c; g.font = F(19, 700); g.textAlign = "right"; g.fillText(b, w - 28, y); g.textAlign = "left";
  });
  g.fillStyle = `rgba(76,199,154,${0.5 + 0.5 * Math.sin(t * 2)})`; g.beginPath(); g.arc(w - 40, 38, 7, 0, 7); g.fill();
  g.fillStyle = "#8D97B0"; g.font = F(16, 500); g.textAlign = "right"; g.fillText("temps réel", w - 56, 44);
};
const energyPaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  bg(g, w, h);
  g.textAlign = "left"; g.fillStyle = "#9CB0FF"; g.font = F(20, 700); g.fillText("CONSOMMATION ÉNERGÉTIQUE", 22, 38);
  for (let i = 0; i < 24; i++) {
    const v = 0.35 + 0.4 * Math.sin((i / 24) * Math.PI) + 0.06 * Math.sin(i * 1.7);
    const opt = v * (i > 18 || i < 6 ? 0.78 : 0.9);
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(22 + i * 19, 200 - v * 140, 12, v * 140);
    g.fillStyle = "rgba(76,199,154,0.85)"; g.fillRect(22 + i * 19, 200 - opt * 140, 12, opt * 140);
  }
  const cur = Math.floor((t * 2) % 24);
  g.fillStyle = "#EDF0F7"; g.fillRect(22 + cur * 19 - 2, 54, 2, 150);
  g.fillStyle = "#4CC79A"; g.font = F(18, 600); g.textAlign = "right"; g.fillText("cible : −10 à −15 %", w - 22, 38);
};

// building frame positions (main building, floor 4 local = building frame with y from the floor surface)
const TECH = DEPT.technique ? { x: DEPT.technique.rect[0], z: DEPT.technique.rect[1] } : { x: 13, z: 0 };
const QUAL = DEPT.qualite ? { x: DEPT.qualite.rect[0], z: DEPT.qualite.rect[1] } : { x: -13, z: 0 };
export const TWIN_POS = { x: TECH.x - 3, y: 1.6, z: -10.9 }; // miniature in front of the twin screen

export function FourthFloor({ mats }: { mats: FloorMats }) {
  const P = useMemo(() => ({
    quality: painter(1024, 340, qualityPaint), kiosk: painter(320, 230, kioskPaint),
    twin: painter(768, 300, twinPaint), energy: painter(512, 230, energyPaint),
  }), []);
  const scr = useMemo(() => Object.fromEntries(Object.entries(P).map(([k, p]) => [k,
    new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#FFFFFF", emissiveMap: p.tex, emissiveIntensity: 0.95, roughness: 0.35 })])) as Record<keyof typeof P, THREE.MeshStandardMaterial>, [P]);
  const holo = useMemo(() => new THREE.MeshBasicMaterial({ color: "#BFD0FF", transparent: true, opacity: 0.42, depthWrite: false, toneMapped: false }), []);
  const tagMat = useMemo(() => new THREE.MeshBasicMaterial({ color: "#6F8CFF", toneMapped: false }), []);
  const dotMat = useMemo(() => new THREE.PointsMaterial({ size: 0.16, map: haloTexture(), color: "#FFFFFF", vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }), []);
  const flowMat = useMemo(() => new THREE.PointsMaterial({ size: 0.5, map: haloTexture(), color: "#7D97FF", transparent: true, opacity: 0.8, depthWrite: false, depthTest: false, toneMapped: false }), []);
  useEffect(() => () => {
    Object.values(P).forEach((p) => p.tex.dispose()); Object.values(scr).forEach((m) => m.dispose());
    holo.dispose(); tagMat.dispose(); dotMat.dispose(); flowMat.dispose();
  }, [P, scr, holo, tagMat, dotMat, flowMat]);

  // miniature twin: floor slabs + live sensor dots (blue = equipment, green = energy, amber = temperature)
  const mini = useMemo(() => {
    const n = 90, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), base = new Float32Array(n);
    const C = [new THREE.Color("#7D97FF"), new THREE.Color("#4CC79A"), new THREE.Color("#E2B05A")];
    for (let i = 0; i < n; i++) {
      const fl = i % 6;
      pos.set([(Math.random() - 0.5) * 3.4, fl * 0.32 + 0.05, (Math.random() - 0.5) * 1.6], i * 3);
      const c = C[i % 7 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
      col.set([c.r, c.g, c.b], i * 3); base[i] = Math.random() * 6.28;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return { g, base, col: col.slice() };
  }, []);
  // data dots rising from the floors below to the twin
  const flow = useMemo(() => {
    const n = 46, pos = new Float32Array(n * 3);
    const src = Array.from({ length: n }, (_, i) => ({ x: (Math.random() - 0.5) * 48, z: (Math.random() - 0.5) * 22, f: -1 - (i % 5), ph: Math.random() }));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return { g, src };
  }, []);
  useEffect(() => () => { mini.g.dispose(); flow.g.dispose(); }, [mini, flow]);

  // equipment with blue location tags on the workshop benches and in the equipment pool
  const equip = useMemo(() => {
    const items: { x: number; y: number; z: number; w: number; h: number; d: number; screen?: boolean }[] = [];
    for (const z of [2.2, 6.6]) for (let i = 0; i < 4; i++) {
      const x = TECH.x + 5.6 - 2.6 + i * 1.75;
      items.push(i % 2 ? { x, y: 0.92 + 0.22, z, w: 0.55, h: 0.42, d: 0.12, screen: true } : { x, y: 0.92 + 0.17, z, w: 0.3, h: 0.34, d: 0.24 });
    }
    const tags = items.map((it) => ({ x: it.x + it.w / 2 - 0.05, y: it.y + it.h / 2 + 0.06, z: it.z }));
    for (let i = 0; i < 4; i++) tags.push({ x: TECH.x + 10.6, y: 1.45, z: -2.4 + i * 1.3 + 0.08 });
    return { items, tags };
  }, []);

  const tagRef = useRef<THREE.InstancedMesh>(null);
  const tagGeo = useMemo(() => new THREE.BoxGeometry(0.09, 0.05, 0.09), []);
  useEffect(() => () => tagGeo.dispose(), [tagGeo]);
  useEffect(() => {
    const m = tagRef.current;
    if (!m) return;
    const mm = new THREE.Matrix4();
    equip.tags.forEach((t, i) => { mm.makeTranslation(t.x, t.y, t.z); m.setMatrixAt(i, mm); });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
  }, [equip, tagGeo]);

  const last = useRef(0);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    if (t - last.current > 0.15) { last.current = t; for (const p of Object.values(P)) p.draw(t); }
    // blinking twin dots
    const c = mini.g.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < mini.base.length; i++) {
      const k = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + mini.base[i]));
      c.setXYZ(i, mini.col[i * 3] * k, mini.col[i * 3 + 1] * k, mini.col[i * 3 + 2] * k);
    }
    c.needsUpdate = true;
    // data flow (floors below → twin), subtle; tags pulse
    const p = flow.g.attributes.position as THREE.BufferAttribute;
    flow.src.forEach((s, i) => {
      const u = (t * 0.22 + s.ph) % 1;
      const e = u * u * (3 - 2 * u);
      const sy = s.f * FLOOR_H + 3.6;
      p.setXYZ(i, s.x + (TWIN_POS.x - s.x) * e, sy + (TWIN_POS.y + 0.8 - sy) * e, s.z + (TWIN_POS.z - s.z) * e);
    });
    p.needsUpdate = true;
    flowMat.opacity = 0.55 * (0.6 + 0.4 * Math.sin(t * 1.5));
    tagMat.color.setHSL(0.63, 0.75, 0.62 + 0.12 * Math.sin(t * 3));
  });

  const sw = 8.4, sh = 3.3;
  return (
    <group>
      {/* ---- Qualité: quality wall screen in the meeting room + patient-feedback kiosk */}
      <group position={[QUAL.x - 4.5, 0, -12.15]}>
        <mesh position={[0, 2.05, 0]} material={mats.parts.dark} castShadow><boxGeometry args={[6.4, 2.25, 0.1]} /></mesh>
        <mesh position={[0, 2.05, 0.06]} material={scr.quality}><planeGeometry args={[6.2, 2.06]} /></mesh>
      </group>
      <group position={[QUAL.x - 9.5, 0, 9.4]}>
        <mesh position={[0, 0.8, 0]} material={mats.parts.white} castShadow><boxGeometry args={[0.6, 1.6, 0.36]} /></mesh>
        <mesh position={[0, 1.22, 0.185]} material={scr.kiosk}><planeGeometry args={[0.5, 0.36]} /></mesh>
      </group>
      {/* ---- Technique: twin screen, miniature with live sensors, energy dashboard, tagged equipment */}
      <group position={[TECH.x - 3, 0, -12.15]}>
        <mesh position={[0, 2.25, 0]} material={mats.parts.dark} castShadow><boxGeometry args={[sw + 0.2, sh + 0.2, 0.1]} /></mesh>
        <mesh position={[0, 2.25, 0.06]} material={scr.twin}><planeGeometry args={[sw, sh]} /></mesh>
      </group>
      <group position={[TWIN_POS.x, 0, TWIN_POS.z]}>
        <mesh position={[0, 0.45, 0]} material={mats.parts.white} castShadow><cylinderGeometry args={[1.5, 1.6, 0.9, 40]} /></mesh>
        <mesh position={[0, 0.91, 0]} material={tagMat}><cylinderGeometry args={[1.42, 1.42, 0.02, 40]} /></mesh>
        <group position={[0, 1.0, 0]}>
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <mesh key={k} position={[0, k * 0.32, 0]} material={holo}><boxGeometry args={[3.7, 0.035, 1.85]} /></mesh>
          ))}
          <points geometry={mini.g} material={dotMat} />
        </group>
      </group>
      <group position={[TECH.x + 8.5, 0, -12.15]}>
        <mesh position={[0, 2.0, 0]} material={mats.parts.dark} castShadow><boxGeometry args={[4.4, 2.2, 0.1]} /></mesh>
        <mesh position={[0, 2.0, 0.06]} material={scr.energy}><planeGeometry args={[4.2, 2.0]} /></mesh>
      </group>
      {equip.items.map((it, i) => (
        <mesh key={i} position={[it.x, it.y, it.z]} material={it.screen ? mats.parts.screen : mats.parts.light} castShadow>
          <boxGeometry args={[it.w, it.h, it.d]} />
        </mesh>
      ))}
      <instancedMesh ref={tagRef} args={[tagGeo, tagMat, equip.tags.length]} />
      <points geometry={flow.g} material={flowMat} renderOrder={6} frustumCulled={false} />
    </group>
  );
}

/** Sensor network on the ceilings of every floor (campus frame), shown for the technique department or an I-case. */
export function SensorNet() {
  const sel = useApp((s) => s.sel);
  const f = focusOf(sel);
  const on = f.dept === "technique" || (sel?.kind === "case" && sel.id.startsWith("I-"));
  const onRef = useRef(on);
  onRef.current = on;
  const res = useMemo(() => {
    const pts: { x: number; z: number; key: string; floor: number }[] = [];
    for (const fl of FLOORS) {
      const B = fl.building === "main" ? MAIN : ANNEX;
      const nx = fl.building === "main" ? 7 : 3, nz = fl.building === "main" ? 3 : 3;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        pts.push({ x: B.x - B.w / 2 + (B.w * (i + 0.5)) / nx, z: B.z - B.d / 2 + (B.d * (j + 0.5)) / nz, key: `${fl.building}:${fl.floor}`, floor: fl.floor });
      }
    }
    const n = pts.length;
    const dots = new THREE.BufferGeometry();
    dots.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pulses = new THREE.BufferGeometry();
    pulses.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const dm = new THREE.PointsMaterial({ size: 0.85, map: haloTexture(), color: "#8EA4FF", transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false });
    const pm = new THREE.PointsMaterial({ size: 1.15, map: haloTexture(), color: "#B9C8FF", transparent: true, opacity: 0, depthWrite: false, depthTest: false, toneMapped: false });
    return { pts, dots, pulses, dm, pm, ph: pts.map(() => Math.random()) };
  }, []);
  useEffect(() => () => { res.dots.dispose(); res.pulses.dispose(); res.dm.dispose(); res.pm.dispose(); }, [res]);
  const a = useRef(0);
  const g = useRef<THREE.Group>(null);
  useFrame((st, dt) => {
    a.current += ((onRef.current ? 1 : 0) - a.current) * (1 - Math.exp(-Math.min(dt, 0.25) * 4));
    if (g.current) g.current.visible = a.current > 0.01;
    if (a.current <= 0.01) return;
    const t = st.clock.elapsedTime;
    const dp = res.dots.attributes.position as THREE.BufferAttribute, pp = res.pulses.attributes.position as THREE.BufferAttribute;
    const tx = MAIN.x + TWIN_POS.x, ty = (DEPT.technique?.floor ?? 4) * FLOOR_H + 2.4, tz = MAIN.z + TWIN_POS.z;
    res.pts.forEach((p, i) => {
      const y = p.floor * FLOOR_H + FLOOR_H - 0.6 + (rt.lift[p.key] ?? 0) * 11;
      dp.setXYZ(i, p.x, y, p.z);
      const u = (t * 0.35 + res.ph[i]) % 1, e = u * u;
      pp.setXYZ(i, p.x + (tx - p.x) * e, y + (ty - y) * e, p.z + (tz - p.z) * e);
    });
    dp.needsUpdate = true; pp.needsUpdate = true;
    res.dm.opacity = a.current * (0.65 + 0.25 * Math.sin(t * 2.4));
    res.pm.opacity = a.current * 0.8;
  });
  return (
    <group ref={g} visible={false}>
      <points geometry={res.dots} material={res.dm} renderOrder={7} frustumCulled={false} />
      <points geometry={res.pulses} material={res.pm} renderOrder={7} frustumCulled={false} />
    </group>
  );
}
