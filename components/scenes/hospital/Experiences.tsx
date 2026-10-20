"use client";
// "Expériences IA" at the front desk and in the waiting areas (ground floor), from lib/hospital EXPERIENCES:
// the conversational guide on a large portrait screen, the wayfinding kiosk with its mini floor plan, the waiting-room
// information screens (queue + "temps d'attente" ticker), the self pre-admission kiosks, the voice assistant of the
// switchboard and the quote/payment screen at the cashier's. They appear with the programme (from 2027); each is clickable.
// Naming rule for any visible text: "Expériences IA" / "guide" — never "avatar" nor "hôte".
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { XP } from "@/lib/hospital";
import { useApp } from "@/lib/store";
import { registerAnchor } from "@/lib/anchors";
import { FLOOR_BY_KEY } from "./layout";
import { haloTexture, rt, type FloorMats } from "./mats";
import { THREE_STATE } from "./People";

/** Where each experience stands (building frame of lib/hospital, ground floor), and which way it faces (yaw). */
export const XP_POS: Record<string, { x: number; z: number; yaw: number; y?: number }> = {
  "xp-guide": { x: 4.3, z: 10.3, yaw: -0.45 },
  "xp-plan": { x: -4.3, z: 10.4, yaw: 0.45 },
  "xp-ecrans": { x: -5.8, z: 4.4, yaw: 0 },
  "xp-borne": { x: -11.0, z: 3.8, yaw: 0 },
  "xp-vocal": { x: -5.2, z: -3.9, yaw: 0 },
  "xp-devis": { x: -18.9, z: -5.15, yaw: 0 },
};

// ---------------------------------------------------------------- animated screen contents (canvas, ~8 fps)
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
const FONT = (s: number, wgt = 600) => `${wgt} ${s}px 'Segoe UI', system-ui, sans-serif`;
const BG = (g: CanvasRenderingContext2D, w: number, h: number) => {
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, "#14204A"); gr.addColorStop(1, "#0A1230");
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
};

/** The conversational guide: a soft, stylised figure that breathes, blinks and speaks (waveform). */
const guidePaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  BG(g, w, h);
  const cx = w / 2, cy = h * 0.42;
  const glow = g.createRadialGradient(cx, cy, 10, cx, cy, w * 0.62);
  glow.addColorStop(0, "rgba(120,150,255,0.55)"); glow.addColorStop(1, "rgba(120,150,255,0)");
  g.fillStyle = glow; g.fillRect(0, 0, w, h);
  const br = 1 + 0.015 * Math.sin(t * 1.8);
  // shoulders
  g.fillStyle = "#9DB2FF";
  g.beginPath(); g.ellipse(cx, cy + 150 * br, 118, 84, 0, Math.PI, 0); g.fill();
  // head
  const hg = g.createLinearGradient(cx, cy - 90, cx, cy + 60);
  hg.addColorStop(0, "#D9E2FF"); hg.addColorStop(1, "#A9BBFF");
  g.fillStyle = hg;
  g.beginPath(); g.ellipse(cx, cy - 10, 66 * br, 76 * br, 0, 0, Math.PI * 2); g.fill();
  // eyes (blink every ~4 s) and a gentle smile
  const blink = (t % 4.2) < 0.14 ? 0.15 : 1;
  g.fillStyle = "#24346E";
  for (const dx of [-22, 22]) { g.beginPath(); g.ellipse(cx + dx, cy - 18, 6.5, 8 * blink, 0, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = "#24346E"; g.lineWidth = 4; g.lineCap = "round";
  const talk = 0.5 + 0.5 * Math.sin(t * 9);
  g.beginPath(); g.ellipse(cx, cy + 16, 16, 4 + 6 * talk, 0, 0, Math.PI); g.stroke();
  // caption + waveform
  g.fillStyle = "#EDF0F7"; g.font = FONT(30); g.textAlign = "center";
  g.fillText("Bonjour, je vous oriente", cx, h * 0.8);
  g.fillStyle = "#8D97B0"; g.font = FONT(22, 500);
  g.fillText("Guide IA · darija · français · العربية", cx, h * 0.8 + 34);
  g.fillStyle = "#7D97FF";
  for (let i = 0; i < 24; i++) {
    const a = Math.abs(Math.sin(t * 6 + i * 0.7)) * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.3 + t)));
    const bh = 6 + a * 34;
    g.fillRect(cx - 24 * 7 + i * 14, h * 0.92 - bh / 2, 8, bh);
  }
  g.fillStyle = "#9CB0FF"; g.font = FONT(20, 700); g.fillText("EXPÉRIENCES IA", cx, 40);
};

/** Wayfinding kiosk: mini floor plan with a highlighted path. */
const planPaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  BG(g, w, h);
  g.fillStyle = "#EDF0F7"; g.font = FONT(24); g.textAlign = "left";
  g.fillText("Où allez-vous ?", 22, 38);
  const x0 = 22, y0 = 58, W = w - 44, H = h - 80;
  const cells = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
  cells.forEach(([c, r], i) => {
    g.fillStyle = i === 2 ? "rgba(91,124,255,0.45)" : "rgba(255,255,255,0.10)";
    g.fillRect(x0 + (c * W) / 3 + 4, y0 + (r * H) / 2 + 4, W / 3 - 8, H / 2 - 8);
  });
  // path: entrance (bottom centre) → corridor → imaging (top right)
  const pts: [number, number][] = [[x0 + W / 2, y0 + H], [x0 + W / 2, y0 + H / 2], [x0 + (5 * W) / 6, y0 + H / 2], [x0 + (5 * W) / 6, y0 + H / 4]];
  g.strokeStyle = "#4CC79A"; g.lineWidth = 7; g.lineJoin = "round"; g.setLineDash([16, 12]); g.lineDashOffset = -t * 40;
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
  g.fillStyle = "#4CC79A"; g.beginPath(); g.arc(pts[3][0], pts[3][1], 10 + 2 * Math.sin(t * 4), 0, Math.PI * 2); g.fill();
  g.fillStyle = "#EDF0F7"; g.beginPath(); g.arc(pts[0][0], pts[0][1] - 6, 8, 0, Math.PI * 2); g.fill();
};

/** Waiting-room screen: queue + estimated wait + ticker. */
const queuePaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  BG(g, w, h);
  g.textAlign = "left";
  g.fillStyle = "#9CB0FF"; g.font = FONT(22, 700); g.fillText("FILE D'ATTENTE", 24, 38);
  g.fillStyle = "#EDF0F7"; g.font = FONT(22, 500); g.textAlign = "right"; g.fillText("Temps d'attente estimé", w - 24, 38);
  g.textAlign = "left";
  const rows = [["A-041", "Admissions · guichet 2"], ["C-017", "Consultation · salle 4"], ["A-042", "Admissions · guichet 1"], ["I-008", "Imagerie"]];
  const hl = Math.floor(t / 2.5) % rows.length;
  rows.forEach(([n, where], i) => {
    const y = 64 + i * 44;
    g.fillStyle = i === hl ? "rgba(76,199,154,0.22)" : "rgba(255,255,255,0.06)";
    g.fillRect(18, y, w - 36, 36);
    g.fillStyle = i === hl ? "#4CC79A" : "#EDF0F7"; g.font = FONT(24, 700); g.fillText(n, 30, y + 26);
    g.fillStyle = "#C3CAD9"; g.font = FONT(22, 500); g.fillText(where, 140, y + 26);
  });
  g.fillStyle = "rgba(91,124,255,0.25)"; g.fillRect(0, h - 40, w, 40);
  g.fillStyle = "#EDF0F7"; g.font = FONT(20, 500);
  const msg = "Pensez à préparer votre carte AMO · Le guide IA vous répond à l'entrée · Pharmacie : sous-sol, ascenseur B · ";
  const tw = g.measureText(msg).width;
  const off = (t * 70) % tw;
  g.fillText(msg + msg, 12 - off, h - 13);
};

const bornePaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  BG(g, w, h);
  g.textAlign = "center";
  g.fillStyle = "#9CB0FF"; g.font = FONT(22, 700); g.fillText("PRÉ-ADMISSION", w / 2, 44);
  g.fillStyle = "#EDF0F7"; g.font = FONT(24, 500); g.fillText("Scannez votre carte", w / 2, 84);
  const p = (Math.sin(t * 2.5) + 1) / 2;
  g.strokeStyle = `rgba(76,199,154,${0.5 + 0.5 * p})`; g.lineWidth = 5;
  g.strokeRect(w / 2 - 90, 120, 180, 112);
  g.fillStyle = "rgba(255,255,255,0.14)"; g.fillRect(w / 2 - 78, 132, 156, 88);
  g.fillStyle = "#4CC79A"; g.fillRect(w / 2 - 90, 120 + p * 108, 180, 4);
  g.fillStyle = "#C3CAD9"; g.font = FONT(20, 500); g.fillText("CIN · carte AMO", w / 2, 270);
  g.fillStyle = "#4CC79A"; g.font = FONT(20, 600); g.fillText("Dossier prêt avant le guichet", w / 2, 310);
};

const devisPaint = (g: CanvasRenderingContext2D, t: number, w: number, h: number) => {
  BG(g, w, h);
  g.textAlign = "left";
  g.fillStyle = "#9CB0FF"; g.font = FONT(22, 700); g.fillText("DEVIS · INTERVENTION", 22, 38);
  // labels only — amounts are shown as neutral bars (no invented figures)
  const lines: [string, number][] = [["Séjour et bloc", 0.7], ["Honoraires", 0.45], ["Prise en charge AMO", 0.6]];
  lines.forEach(([a, k], i) => {
    g.fillStyle = "#C3CAD9"; g.font = FONT(21, 500); g.fillText(a, 22, 82 + i * 36);
    g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(w - 22 - 150, 68 + i * 36, 150, 12);
    g.fillStyle = "rgba(156,176,255,0.55)"; g.fillRect(w - 22 - 150, 68 + i * 36, 150 * k, 12);
  });
  g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(22, 186, w - 44, 2);
  g.fillStyle = "#EDF0F7"; g.font = FONT(24, 700); g.fillText("Reste à payer", 22, 222);
  g.textAlign = "right"; g.fillStyle = "#4CC79A"; g.font = FONT(20, 600); g.fillText("expliqué à l'écran", w - 22, 222);
  g.textAlign = "left"; g.fillStyle = `rgba(76,199,154,${0.6 + 0.4 * Math.sin(t * 3)})`; g.fillRect(22, 240, (w - 44) * ((t * 0.25) % 1), 6);
};

// ---------------------------------------------------------------- component
export default function Experiences({ mats }: { mats: FloorMats }) {
  const sel = useApp((s) => s.sel);
  const select = useApp((s) => s.select);
  const setHover = useApp((s) => s.setHover);
  const selXp = sel?.kind === "xp" ? sel.id : null;
  const selRef = useRef(selXp);
  selRef.current = selXp;

  const P = useMemo(() => ({
    guide: painter(384, 640, guidePaint), plan: painter(448, 320, planPaint),
    q1: painter(512, 300, queuePaint), q2: painter(512, 300, queuePaint), q3: painter(512, 300, queuePaint),
    borne: painter(320, 340, bornePaint), devis: painter(448, 270, devisPaint),
  }), []);
  const screenMats = useMemo(() => Object.fromEntries(Object.entries(P).map(([k, p]) => [k,
    new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#FFFFFF", emissiveMap: p.tex, emissiveIntensity: 0.95, roughness: 0.35 })])) as Record<keyof typeof P, THREE.MeshStandardMaterial>, [P]);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ map: haloTexture(), color: "#7D97FF", transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), []);
  const wave = useMemo(() => new THREE.MeshBasicMaterial({ color: "#7D97FF", transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), []);
  useEffect(() => () => {
    Object.values(P).forEach((p) => p.tex.dispose());
    Object.values(screenMats).forEach((m) => m.dispose());
    glow.dispose(); wave.dispose();
  }, [P, screenMats, glow, wave]);

  // phones of the switchboard (voice assistant): blue waves above them
  const phones = useMemo(() => (FLOOR_BY_KEY["main:0"]?.parts ?? []).filter((p) => p.dept === "standard" && p.m === "dark" && Math.abs(p.sy - 0.06) < 1e-3), []);
  const waveMats = useMemo(() => phones.flatMap(() => [wave.clone(), wave.clone()]), [phones, wave]);
  useEffect(() => () => waveMats.forEach((m) => m.dispose()), [waveMats]);

  const groups = useRef<Record<string, THREE.Group | null>>({});
  const waves = useRef<THREE.Group>(null);
  const last = useRef(0);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 5);
    if (t - last.current > 0.12) {
      last.current = t;
      for (const p of Object.values(P)) p.draw(t);
    }
    // the experiences arrive with the programme (2027 →); a selected one is always shown
    const base = Math.min(1, Math.max(0, rt.eco / 0.2));
    for (const [id, g] of Object.entries(groups.current)) {
      if (!g) continue;
      const key = id.split("#")[0];
      const target = selRef.current === key ? 1 : base;
      const s = g.scale.x + (target - g.scale.x) * k;
      g.scale.setScalar(s < 0.005 ? 0.0001 : s);
      g.visible = s > 0.01;
    }
    if (waves.current) {
      waves.current.visible = base > 0.01;
      waves.current.children.forEach((m, i) => {
        const ph = (t * 0.8 + i * 0.27) % 1;
        m.scale.setScalar(0.4 + ph * 1.1);
        ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - ph) * base;
      });
    }
  });

  // anchors "xp:<id>"
  useEffect(() => {
    const v = new THREE.Vector3();
    const offs = Object.keys(XP_POS).map((id) => registerAnchor("xp:" + id, () => {
      const g = groups.current[id];
      if (!g || !THREE_STATE.get) return null;
      const { camera, gl } = THREE_STATE.get();
      g.getWorldPosition(v); v.y += 1.3; v.project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: g.visible && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
    }));
    return () => offs.forEach((o) => o());
  }, []);

  const handlers = (id: string) => ({
    onClick: (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); rt.clickHandled = true; select({ kind: "xp", id }); },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover("xp:" + id); document.body.style.cursor = "pointer"; },
    onPointerOut: () => { if (useApp.getState().hover === "xp:" + id) setHover(null); document.body.style.cursor = ""; },
  });
  const at = (id: string, key = id) => {
    const p = XP_POS[id];
    return { ref: (g: THREE.Group | null) => { groups.current[key] = g; }, position: [p.x, p.y ?? 0, p.z] as [number, number, number], "rotation-y": p.yaw, scale: 0.0001 };
  };
  const dark = mats.parts.dark, white = mats.parts.white, steel = mats.parts.steel;

  return (
    <group>
      {/* conversational guide on a large portrait screen */}
      <group {...at("xp-guide")} {...handlers("xp-guide")}>
        <mesh position={[0, 0.04, 0]} material={steel} castShadow><cylinderGeometry args={[0.55, 0.6, 0.08, 32]} /></mesh>
        <mesh position={[0, 1.45, -0.02]} material={dark} castShadow><boxGeometry args={[1.32, 2.5, 0.1]} /></mesh>
        <mesh position={[0, 1.45, 0.035]} material={screenMats.guide}><planeGeometry args={[1.2, 2.0]} /></mesh>
        <mesh position={[0, 1.45, -0.09]} material={glow}><planeGeometry args={[2.4, 3.2]} /></mesh>
      </group>
      {/* wayfinding kiosk */}
      <group {...at("xp-plan")} {...handlers("xp-plan")}>
        <mesh position={[0, 0.5, 0]} material={white} castShadow><boxGeometry args={[0.55, 1.0, 0.42]} /></mesh>
        <group position={[0, 1.12, 0.05]} rotation-x={-0.6}>
          <mesh material={dark} castShadow><boxGeometry args={[1.0, 0.72, 0.06]} /></mesh>
          <mesh position={[0, 0, 0.035]} material={screenMats.plan}><planeGeometry args={[0.92, 0.65]} /></mesh>
        </group>
      </group>
      {/* waiting-room information screens (accueil × 2, admissions × 1) */}
      {([["xp-ecrans", "q1", 0, 0, 0], ["xp-ecrans", "q2", 11.6, 0, 0], ["xp-ecrans", "q3", -6.8, 0, -2.6]] as const).map(([id, k, dx, , dz], i) => (
        <group key={k} ref={(g) => { groups.current[i ? `${id}#${i}` : id] = g; }} position={[XP_POS[id].x + dx, 0, XP_POS[id].z + dz]} scale={0.0001} {...handlers(id)}>
          <mesh position={[0, 1.05, -0.1]} material={steel} castShadow><boxGeometry args={[0.12, 2.1, 0.12]} /></mesh>
          <mesh position={[0, 2.15, 0]} material={dark} castShadow><boxGeometry args={[1.5, 0.9, 0.07]} /></mesh>
          <mesh position={[0, 2.15, 0.04]} material={screenMats[k]}><planeGeometry args={[1.42, 0.83]} /></mesh>
        </group>
      ))}
      {/* self pre-admission kiosks */}
      {[0, 1.25].map((dx, i) => (
        <group key={dx} ref={(g) => { groups.current[i ? "xp-borne#1" : "xp-borne"] = g; }} position={[XP_POS["xp-borne"].x + dx - 0.6, 0, XP_POS["xp-borne"].z]} scale={0.0001} {...handlers("xp-borne")}>
          <mesh position={[0, 0.8, 0]} material={white} castShadow><boxGeometry args={[0.6, 1.6, 0.36]} /></mesh>
          <mesh position={[0, 1.22, 0.185]} material={screenMats.borne}><planeGeometry args={[0.48, 0.52]} /></mesh>
          <mesh position={[0, 0.82, 0.2]} material={glow}><boxGeometry args={[0.36, 0.05, 0.06]} /></mesh>
        </group>
      ))}
      {/* voice assistant console of the switchboard + blue waves above the phones */}
      <group {...at("xp-vocal")} {...handlers("xp-vocal")}>
        <mesh position={[0, 0.82, 0]} material={dark} castShadow><cylinderGeometry args={[0.22, 0.26, 0.1, 32]} /></mesh>
        <mesh position={[0, 0.88, 0]} rotation-x={-Math.PI / 2} material={wave}><ringGeometry args={[0.1, 0.16, 40]} /></mesh>
      </group>
      <group ref={waves}>
        {phones.flatMap((p, i) => [0, 1].map((k) => (
          <mesh key={`${i}-${k}`} position={[p.x, p.y + 0.06, p.z]} rotation-x={-Math.PI / 2} material={waveMats[i * 2 + k]}>
            <ringGeometry args={[0.16, 0.2, 32]} />
          </mesh>
        )))}
      </group>
      {/* quote / payment screen at the cashier's */}
      <group {...at("xp-devis")} {...handlers("xp-devis")}>
        <mesh position={[0, 1.66, 0]} material={dark} castShadow><boxGeometry args={[0.98, 0.62, 0.06]} /></mesh>
        <mesh position={[0, 1.66, 0.035]} material={screenMats.devis}><planeGeometry args={[0.92, 0.56]} /></mesh>
      </group>
    </group>
  );
}
