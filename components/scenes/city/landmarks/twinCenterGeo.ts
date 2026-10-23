// Twin Center (Ricardo Bofill · Taller de Arquitectura with Élie Moyal, 1998-1999; Maârif, boulevards Zerktouni and
// Al Massira Al Khadra): two 28-storey, 115 m towers side by side on a five-level shopping podium. Modelled from photographs:
// square towers in cream stone, each main face framed by two solid pilasters around a stepped blue curtain wall (wide at the
// bottom, narrowing tier by tier, flanked by punched square windows: the "Moorish" composition of the façade), almost solid
// side faces with a slot of windows, stone belts between the tiers, a dark shop arcade at the foot, a crown with a row of
// inverted triangles on one tower and the magenta "inwi" band with telecom masts on the other; a raised plaza and a broad
// stair between the towers, the podium behind. Local frame: origin = centre between the towers, x along the pair, +z = front.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { rng } from "./env";

type G = THREE.BufferGeometry;
export type TcKey = "stone" | "stoneDark" | "arcade" | "podium" | "plaza" | "steel" | "purple" | "dish";

export const TC = { W: 30, H: 115, FLOORS: 28, HALF_GAP: 33.6, CROWN: 4.2 };

// ---------------------------------------------------------------- façade painters (one canvas per face kind)
const PX = 17; // pixels per metre
function canvas(wm: number, hm: number) {
  const c = document.createElement("canvas"); c.width = Math.round(wm * PX); c.height = Math.round(hm * PX);
  return { c, g: c.getContext("2d")! };
}
const m = (v: number) => v * PX;
/** y in metres from the ground → canvas y (top-down) */
const Yc = (yM: number) => m(TC.H - yM);

function stone(g: CanvasRenderingContext2D, w: number, h: number, r: () => number) {
  g.fillStyle = "#E9E3D5"; g.fillRect(0, 0, w, h);
  // per-slab tone and the joint grid (slabs 1.5 × 1.37 m)
  for (let y = 0; y < h; y += m(1.37)) for (let x = 0; x < w; x += m(1.5)) {
    const k = 0.97 + r() * 0.05; g.fillStyle = `rgb(${Math.round(233 * k)},${Math.round(227 * k)},${Math.round(213 * k)})`; g.fillRect(x, y, m(1.5), m(1.37));
  }
  g.fillStyle = "rgba(150,140,120,.35)";
  for (let y = 0; y < h; y += m(1.37)) g.fillRect(0, y, w, 1);
  for (let x = 0; x < w; x += m(1.5)) g.fillRect(x, 0, 1, h);
}
function glassField(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, glow?: CanvasRenderingContext2D, r?: () => number) {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, "#5D93C6"); gr.addColorStop(0.5, "#3F77AE"); gr.addColorStop(1, "#2D5E92");
  g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.fillStyle = "rgba(225,235,245,.75)";
  for (let x = x0; x <= x1 + 0.5; x += m(1.5)) g.fillRect(Math.round(x), y0, 2, y1 - y0);             // mullions
  for (let y = y1; y >= y0; y -= m(TC.H / TC.FLOORS)) g.fillRect(x0, Math.round(y), x1 - x0, 3);     // floor lines
  if (glow && r) for (let y = y1 - m(TC.H / TC.FLOORS); y >= y0 - 1; y -= m(TC.H / TC.FLOORS)) for (let x = x0; x < x1 - 1; x += m(1.5)) {
    if (r() < 0.42) { glow.fillStyle = r() < 0.5 ? "#FFE1A8" : "#FFF3DC"; glow.fillRect(x + 2, y + 3, m(1.5) - 4, m(TC.H / TC.FLOORS) - 6); }
  }
}
function punched(g: CanvasRenderingContext2D, cx: number, cy: number, s: number, glow?: CanvasRenderingContext2D, r?: () => number) {
  g.fillStyle = "#C9C1B0"; g.fillRect(cx - s / 2 - 3, cy - s / 2 - 3, s + 6, s + 6); // reveal
  const gr = g.createLinearGradient(0, cy - s / 2, 0, cy + s / 2); gr.addColorStop(0, "#5B8FC2"); gr.addColorStop(1, "#2F5F92");
  g.fillStyle = gr; g.fillRect(cx - s / 2, cy - s / 2, s, s);
  g.fillStyle = "rgba(230,238,246,.8)"; g.fillRect(cx - 1, cy - s / 2, 2, s);
  if (glow && r && r() < 0.4) { glow.fillStyle = "#FFE6B4"; glow.fillRect(cx - s / 2, cy - s / 2, s, s); }
}

/** Main face (30 × 115 m): pilasters, stepped curtain wall with punched flanks, belts, crown, shop arcade. */
export function paintFront(seed: number, triangles: boolean) {
  const W = TC.W, { c, g } = canvas(W, TC.H), gl = canvas(W, TC.H), r = rng(seed);
  gl.g.fillStyle = "#000"; gl.g.fillRect(0, 0, gl.c.width, gl.c.height);
  stone(g, c.width, c.height, r);
  const fh = TC.H / TC.FLOORS, base = 2 * fh; // two-storey shop arcade
  // tiers of the stepped composition: [top floor, curtain-wall width (m)]
  const tiers: [number, number][] = [[8, 16.5], [14, 13.5], [20, 10.5], [25, 7.5]];
  let f0 = 2;
  for (const [f1, cw] of tiers) {
    const yTop = Yc(f1 * fh), yBot = Yc(f0 * fh) - m(0.5);
    const x0 = m((W - cw) / 2), x1 = m((W + cw) / 2);
    glassField(g, x0, yTop + m(0.6), x1, yBot, gl.g, r);
    // punched windows on the flanks, one per floor and per 2.25 m column, out to the pilasters (6 m from the edges)
    for (let f = f0; f < f1; f++) {
      const cy = Yc((f + 0.55) * fh);
      for (let x = (W - cw) / 2 - 1.4; x > 6.6; x -= 2.25) { punched(g, m(x), cy, m(1.35), gl.g, r); punched(g, m(W - x), cy, m(1.35), gl.g, r); }
    }
    // stone belt above the tier
    g.fillStyle = "#DDD5C4"; g.fillRect(m(6), yTop - m(0.1), m(W - 12), m(0.7));
    f0 = f1;
  }
  // top tier: a grid of punched windows only (six columns), up to the crown
  for (let f = f0; f < TC.FLOORS; f++) for (let k = 0; k < 6; k++) punched(g, m(8.4 + k * 2.64), Yc((f + 0.55) * fh), m(1.4), gl.g, r);
  // crown: a plain band with a row of inverted triangles (or nothing: the "inwi" band covers it)
  if (triangles) {
    g.fillStyle = "#4A5563";
    for (let x = 1.2; x < W - 0.8; x += 1.65) { g.beginPath(); g.moveTo(m(x - 0.5), Yc(TC.H - 0.9)); g.lineTo(m(x + 0.5), Yc(TC.H - 0.9)); g.lineTo(m(x), Yc(TC.H - 1.8)); g.closePath(); g.fill(); }
  }
  // shop arcade: dark glazing between stone piers, lit at night
  g.fillStyle = "#1F262E"; g.fillRect(0, Yc(base), c.width, m(base));
  gl.g.fillStyle = "#FFD9A0";
  for (let x = 0; x < W; x += 3) {
    g.fillStyle = "#E2DBCB"; g.fillRect(m(x), Yc(base), m(0.6), m(base));
    g.fillStyle = "rgba(110,150,190,.35)"; g.fillRect(m(x + 0.8), Yc(base) + m(0.6), m(2), m(base) - m(1.4));
    gl.g.fillRect(m(x + 0.8), Yc(base) + m(1), m(2), m(base) - m(1.8));
  }
  return { map: c, glow: gl.c };
}
/** Side face: solid stone with a single slot of windows and the belts. */
export function paintSide(seed: number, triangles: boolean) {
  const W = TC.W, { c, g } = canvas(W, TC.H), gl = canvas(W, TC.H), r = rng(seed);
  gl.g.fillStyle = "#000"; gl.g.fillRect(0, 0, gl.c.width, gl.c.height);
  stone(g, c.width, c.height, r);
  const fh = TC.H / TC.FLOORS;
  for (let f = 2; f < TC.FLOORS; f++) { punched(g, m(W / 2 - 1.2), Yc((f + 0.55) * fh), m(1.2), gl.g, r); punched(g, m(W / 2 + 1.2), Yc((f + 0.55) * fh), m(1.2), gl.g, r); }
  for (const f of [8, 14, 20, 25]) { g.fillStyle = "#DDD5C4"; g.fillRect(m(6), Yc(f * fh) - m(0.1), m(W - 12), m(0.7)); }
  if (triangles) { g.fillStyle = "#4A5563"; for (let x = 1.2; x < W - 0.8; x += 1.65) { g.beginPath(); g.moveTo(m(x - 0.5), Yc(TC.H - 0.9)); g.lineTo(m(x + 0.5), Yc(TC.H - 0.9)); g.lineTo(m(x), Yc(TC.H - 1.8)); g.closePath(); g.fill(); } }
  g.fillStyle = "#1F262E"; g.fillRect(0, Yc(2 * fh), c.width, m(2 * fh));
  return { map: c, glow: gl.c };
}
/** The magenta "inwi" crown band. */
export function paintInwi() {
  const c = document.createElement("canvas"); c.width = 1024; c.height = 160; const g = c.getContext("2d")!;
  g.fillStyle = "#6E2C8F"; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = "#FFFFFF"; g.font = "800 120px Manrope, Inter, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("inwi", 512, 86);
  return c;
}
/** The podium: five levels of shop glazing and stone bands. */
export function paintPodium(seed: number) {
  const c = document.createElement("canvas"); c.width = 512; c.height = 256; const g = c.getContext("2d")!, r = rng(seed);
  g.fillStyle = "#E4DDCD"; g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 5; k++) {
    const y = 12 + k * 48;
    const gr = g.createLinearGradient(0, y, 0, y + 30); gr.addColorStop(0, "#5A87B0"); gr.addColorStop(1, "#2E4F70");
    g.fillStyle = gr; g.fillRect(0, y, 512, 30);
    g.fillStyle = "rgba(230,236,242,.7)"; for (let x = 0; x < 512; x += 24) g.fillRect(x, y, 2, 30);
    if (k === 4) for (let x = 0; x < 512; x += 64) { g.fillStyle = ["#C8202B", "#2C6FB7", "#E8B32A", "#3B9A5A"][Math.floor(r() * 4)]; g.fillRect(x + 6, y + 4, 40, 8); }
  }
  return c;
}
export function flagCanvas() {
  const c = document.createElement("canvas"); c.width = 300; c.height = 200; const g = c.getContext("2d")!;
  g.fillStyle = "#C1272D"; g.fillRect(0, 0, 300, 200);
  g.strokeStyle = "#006233"; g.lineWidth = 9; g.beginPath();
  for (let i = 0; i <= 5; i++) { const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5; if (i) g.lineTo(150 + 52 * Math.cos(a), 100 + 52 * Math.sin(a)); else g.moveTo(150 + 52 * Math.cos(a), 100 + 52 * Math.sin(a)); }
  g.closePath(); g.stroke();
  return c;
}

// ---------------------------------------------------------------- geometry (merged per material, non-indexed)
const ni = (g: G) => { const o = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") o.deleteAttribute(k); return o; };
const box = (w: number, h: number, d: number, x: number, y: number, z: number) => ni(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z));

/** The four façade planes of a tower, one geometry per face kind (front/back = "front", left/right = "side"). */
export function towerFaces(cx: number) {
  const h = TC.W / 2, front: G[] = [], side: G[] = [];
  for (const [nz, list] of [[1, front], [-1, front]] as const) list.push(ni(new THREE.PlaneGeometry(TC.W, TC.H).rotateY(nz > 0 ? 0 : Math.PI).translate(cx, TC.H / 2, nz * h)));
  for (const nx of [1, -1]) side.push(ni(new THREE.PlaneGeometry(TC.W, TC.H).rotateY(nx * Math.PI / 2).translate(cx + nx * h, TC.H / 2, 0)));
  return { front: mergeGeometries(front, false), side: mergeGeometries(side, false) };
}

/** One tower's relief, arcade and crown at local x = cx (the telecom crown when `inwi`). */
function towerInto(add: (k: TcKey, g: G) => void, cx: number, inwi: boolean, r: () => number) {
  const W = TC.W, fh = TC.H / TC.FLOORS;
  {
    // corner pilasters standing 0.3 m proud of the faces, the full height
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add("stone", box(6.3, TC.H - 2 * fh, 6.3, cx + sx * (W / 2 - 2.85), 2 * fh, sz * (W / 2 - 2.85)));
    // stone belts between the tiers
    for (const f of [8, 14, 20, 25]) add("stone", box(W + 0.5, 0.7, W + 0.5, cx, f * fh - 0.1, 0));
    // shop arcade: recessed dark base with a row of columns on each face
    add("arcade", box(W - 2.4, 2 * fh, W - 2.4, cx, 0, 0));
    for (let k = -4; k <= 4; k++) for (const s of [-1, 1]) {
      add("stone", ni(new THREE.CylinderGeometry(0.42, 0.42, 2 * fh, 10).translate(cx + k * 3.3, fh, s * (W / 2 - 0.4))));
      add("stone", ni(new THREE.CylinderGeometry(0.42, 0.42, 2 * fh, 10).translate(cx + s * (W / 2 - 0.4), fh, k * 3.3)));
    }
    add("stone", box(W + 0.4, 0.9, W + 0.4, cx, 2 * fh - 0.9, 0)); // arcade lintel
    // crown: parapet ring and roof; on the "inwi" tower a magenta band and telecom masts with dishes
    add("stone", box(W + 0.3, 0.5, W + 0.3, cx, TC.H, 0));
    add("stoneDark", box(W - 1.2, 0.3, W - 1.2, cx, TC.H - 0.2, 0));
    if (inwi) {
      add("purple", box(W + 0.5, TC.CROWN, W + 0.5, cx, TC.H + 0.5, 0));
      for (const [mx, mz, mh] of [[-6, -5, 16], [4, 3, 12], [8, -8, 9]] as const) {
        add("steel", box(0.8, mh, 0.8, cx + mx, TC.H + 0.5 + TC.CROWN, mz));
        for (let k = 0; k < 3; k++) add("dish", ni(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 14).rotateX(Math.PI / 2).rotateY(k * 2.1 + r()).translate(cx + mx + Math.sin(k * 2.1) * 0.8, TC.H + 0.5 + TC.CROWN + mh * (0.5 + k * 0.15), mz + Math.cos(k * 2.1) * 0.8)));
      }
    } else {
      add("stone", box(W + 0.3, TC.CROWN - 1.2, W + 0.3, cx, TC.H + 0.5, 0));
      add("steel", box(0.3, 6, 0.3, cx + 9, TC.H + TC.CROWN - 0.7, -6));
    }
  }
}
const merged = (B: Partial<Record<TcKey, G[]>>) => (Object.keys(B) as TcKey[]).map((key) => ({ key, geo: mergeGeometries(B[key]!, false) }));

/** A single tower centred at the local origin (the Maârif district places each one on its OSM footprint). */
export function buildTower(inwi: boolean) {
  const B: Partial<Record<TcKey, G[]>> = {}, add = (k: TcKey, g: G) => { (B[k] ??= []).push(g); };
  towerInto(add, 0, inwi, rng(inwi ? 2001 : 1999));
  return merged(B);
}

/** Both towers, podium, plaza and stair in one local frame (the first, free-standing version; the Maârif district now
 *  draws the real podium). `inwi` = index of the tower with the telecom crown. */
export function buildSite(inwi: number) {
  const B: Partial<Record<TcKey, G[]>> = {}, add = (k: TcKey, g: G) => { (B[k] ??= []).push(g); };
  const r = rng(1999);
  for (const [i, cx] of [-TC.HALF_GAP, TC.HALF_GAP].entries()) towerInto(add, cx, i === inwi, r);
  // the podium behind the towers (five shop levels) and its roof terraces
  add("podium", box(150, 21, 46, 0, 0, -38));
  add("stone", box(151, 1.2, 47, 0, 21, -38));
  add("podium", box(46, 10, 20, 0, 0, -14));
  // raised plaza between the towers and the broad stair down to the boulevard
  add("plaza", box(36, 6, 15, 0, 0, 3.5));
  for (let k = 0; k < 20; k++) add("plaza", box(30, 0.3, 0.6, 0, k * 0.3, 11 + (19 - k) * 0.6));
  for (const sx of [-1, 1]) add("stone", box(1.2, 6.6, 12.6, sx * 15.6, 0, 17.3));
  // flagpole on the plaza
  add("steel", ni(new THREE.CylinderGeometry(0.1, 0.14, 16, 8).translate(9, 14, 8)));
  return merged(B);
}
