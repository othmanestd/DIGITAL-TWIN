// Procedural façade painters of the Casablanca Finance City district (canvas only, no three.js, no photo, no logo):
// the white rendered residences of Casa Anfa, the modernist bands of BO52, the GRC moucharabieh of the BCP Tower and its
// blind gables, the white perforated aluminium veil of the CIMR Tower, the planted façades of the Tours Végétales, shop
// podiums, bare concrete frames of the towers still being built, villas, lawns. Each returns [colour, night glow] canvases
// (512 px, tileable horizontally and vertically); the tile sizes in metres are given in CFC_TILE.
import { rng } from "./env";
import { mk, shade } from "./texturePaint";

type C2 = CanvasRenderingContext2D;
type Pair = [HTMLCanvasElement, HTMLCanvasElement];

/** world size (m) of one texture tile [u, v] */
export const CFC_TILE = {
  apart: [16, 12.8], deco: [16, 12.8], grc: [14.4, 14.4], gable: [14.4, 14.4], veil: [14.4, 14.4], green: [16, 12.8],
  shop: [16, 4.8], panel: [16, 12.8], frame: [16, 14.4], villa: [12, 6.4], bcpGlass: [21.6, 28.8],
} as const satisfies Record<string, readonly [number, number]>;

const pair = (): [HTMLCanvasElement, C2, HTMLCanvasElement, C2] => {
  const [c, g] = mk(512), [e, ge] = mk(512);
  ge.fillStyle = "#000"; ge.fillRect(0, 0, 512, 512);
  return [c, g, e, ge];
};
const WARM = ["rgba(255,206,140,0.92)", "rgba(255,226,180,0.9)", "rgba(255,240,214,0.85)"];
function grain(g: C2, r: () => number, n: number, a: number) {
  for (let i = 0; i < n; i++) { g.fillStyle = r() < 0.5 ? `rgba(70,60,50,${a * r()})` : `rgba(255,255,255,${a * r()})`; g.fillRect(Math.floor(r() * 512), Math.floor(r() * 512), 1 + Math.floor(r() * 3), 1); }
}
function pane(g: C2, x: number, y: number, w: number, h: number, t: number, top = "#7F93B0", bot = "#34425A") {
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, shade(top, t)); gr.addColorStop(1, shade(bot, t));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
}

/** Casa Anfa residence: white or cream render, 4 bays × 4 floors; windows with roller shutters at random heights, some
 *  balconies with a slab and a glass or railing parapet, now and then an air-conditioning unit. */
export function paintApart(seed: number, wall = "#F1EDE4"): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = wall; g.fillRect(0, 0, 512, 512);
  grain(g, r, 2600, 0.12);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * 128, y = j * 128, t = (r() - 0.5) * 0.12, bal = (i + j * 3 + seed) % 3 === 0;
    const wx = x + 22, ww = 84, wy = y + 26, wh = bal ? 92 : 70;
    g.fillStyle = "rgba(60,54,48,0.25)"; g.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);             // reveal
    pane(g, wx, wy, ww, wh, t);
    g.fillStyle = "rgba(230,236,244,0.55)"; g.fillRect(wx + ww / 2 - 1, wy, 2, wh);              // mullion
    const sh = r() < 0.55 ? Math.floor(r() * wh * 0.8) : 0;                                   // roller shutter
    if (sh) { g.fillStyle = shade("#D9D4CA", (r() - 0.5) * 0.1); g.fillRect(wx, wy, ww, sh); g.fillStyle = "rgba(0,0,0,0.12)"; for (let k = 4; k < sh; k += 5) g.fillRect(wx, wy + k, ww, 1); }
    if (bal) {
      g.fillStyle = "rgba(40,36,32,0.3)"; g.fillRect(x + 8, y + 122, 112, 6);                    // slab shadow
      g.fillStyle = "#FBF9F4"; g.fillRect(x + 8, y + 116, 112, 7);                               // slab
      g.fillStyle = r() < 0.5 ? "rgba(160,190,205,0.45)" : "rgba(70,70,74,0.75)";                 // glass / railing
      if (r() < 0.5) g.fillRect(x + 10, y + 92, 108, 24); else for (let k = x + 12; k < x + 118; k += 5) g.fillRect(k, y + 92, 1.5, 24);
      g.fillRect(x + 10, y + 91, 108, 2);
    } else { g.fillStyle = "#FBF9F4"; g.fillRect(wx - 6, wy + wh + 2, ww + 12, 5); g.fillStyle = "rgba(40,36,32,0.22)"; g.fillRect(wx - 6, wy + wh + 7, ww + 12, 3); }
    if (r() < 0.12) { g.fillStyle = "#E6E6E2"; g.fillRect(x + 100, y + 104, 22, 16); g.fillStyle = "rgba(80,80,80,0.45)"; g.beginPath(); g.arc(x + 111, y + 112, 5, 0, 7); g.fill(); }
    if (r() < 0.3) { ge.fillStyle = WARM[Math.floor(r() * 3)]; ge.fillRect(wx + 2, wy + sh + 2, ww - 4, Math.max(0, wh - sh - 4)); }
  }
  g.fillStyle = "rgba(90,80,70,0.08)"; for (let j = 0; j < 4; j++) g.fillRect(0, j * 128, 512, 2);
  return [c, e];
}

/** BO52: Casablanca modernist white, continuous ribbon windows between deep white floor bands, a pilaster every two bays. */
export function paintDeco(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = "#F4F1EA"; g.fillRect(0, 0, 512, 512);
  grain(g, r, 2000, 0.1);
  for (let j = 0; j < 4; j++) {
    const y = j * 128;
    pane(g, 0, y + 30, 512, 70, (r() - 0.5) * 0.08, "#8EA2BC", "#3A4862");
    for (let k = 0; k < 512; k += 32) { g.fillStyle = "rgba(235,238,242,0.7)"; g.fillRect(k, y + 30, 2, 70); }
    g.fillStyle = "rgba(40,36,32,0.28)"; g.fillRect(0, y + 100, 512, 6);
    g.fillStyle = "#FCFBF7"; g.fillRect(0, y + 100, 512, 4);
    for (let i = 0; i < 16; i++) if (r() < 0.3) { ge.fillStyle = WARM[Math.floor(r() * 3)]; ge.fillRect(i * 32 + 3, y + 33, 27, 64); }
  }
  for (let i = 0; i < 2; i++) { g.fillStyle = "#FBF9F3"; g.fillRect(i * 256 + 124, 0, 14, 512); g.fillStyle = "rgba(40,36,32,0.18)"; g.fillRect(i * 256 + 138, 0, 4, 512); }
  return [c, e];
}

/** BCP Tower, south face: glass-fibre concrete moucharabieh of 1.80 m panels whose openings swell and shrink across the
 *  face (8 × 8 panels), over the set-back glazing. */
export function paintGrc(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed), P = 64, BASE = "#E8E1D2";
  g.fillStyle = "#26303E"; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const x = i * P, y = j * P, f = 0.5 + 0.5 * Math.sin((i / 8) * Math.PI * 2 + seed) * Math.cos((j / 8) * Math.PI * 2), open = 0.12 + 0.55 * f;
    g.fillStyle = shade(BASE, (r() - 0.5) * 0.05); g.fillRect(x + 1, y + 1, P - 2, P - 2);
    // a 3 × 3 grid of square openings, sized by the local density
    const q = P / 3, s = q * Math.sqrt(open);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      const ox = x + a * q + (q - s) / 2, oy = y + b * q + (q - s) / 2;
      g.fillStyle = "#2B3646"; g.fillRect(ox, oy, s, s);
      g.fillStyle = "rgba(120,140,170,0.35)"; g.fillRect(ox, oy, s, s * 0.35);
      g.fillStyle = "rgba(255,255,255,0.4)"; g.fillRect(ox, oy + s, s, 1);
      if (r() < 0.32) { ge.fillStyle = WARM[0]; ge.fillRect(ox, oy, s, s); }
    }
    g.fillStyle = "rgba(60,50,40,0.25)"; g.fillRect(x, y + P - 1, P, 1); g.fillRect(x + P - 1, y, 1, P);
  }
  return [c, e];
}
/** BCP Tower, blind gables: the same GRC panels, all solid. */
export function paintGable(seed: number): Pair {
  const [c, g, e] = pair(), r = rng(seed), P = 64;
  g.fillStyle = "#E8E1D2"; g.fillRect(0, 0, 512, 512);
  grain(g, r, 1800, 0.08);
  g.fillStyle = "rgba(70,60,48,0.3)";
  for (let k = 0; k < 512; k += P) { g.fillRect(k, 0, 1.5, 512); g.fillRect(0, k, 512, 1.5); }
  return [c, e];
}

/** CIMR Tower: white perforated aluminium veil (micro-perforations in soft, drifting densities) with the glazing showing
 *  as a faint grey behind; at night the offices glow through the perforations. 4 floors of 3.6 m. */
export function paintVeil(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = "#F3F3EF"; g.fillRect(0, 0, 512, 512);
  for (let y = 3; y < 512; y += 6) for (let x = 3 + ((y / 6) % 2) * 3; x < 512; x += 6) {
    const f = 0.5 + 0.5 * Math.sin((x / 512) * Math.PI * 4 + seed) * Math.sin((y / 512) * Math.PI * 2 + (x / 512) * 3);
    if (r() > f * 0.95) continue;
    const s = 1 + f * 2.2;
    g.fillStyle = `rgba(70,78,90,${0.35 + 0.3 * f})`; g.fillRect(x - s / 2, y - s / 2, s, s);
    if (f > 0.35) { ge.fillStyle = `rgba(255,214,160,${0.55 * f})`; ge.fillRect(x - s / 2, y - s / 2, s, s); }
  }
  g.fillStyle = "rgba(120,120,120,0.12)"; for (let j = 0; j < 4; j++) g.fillRect(0, j * 128, 512, 2);
  return [c, e];
}

/** Tours Végétales: a white frame of floors and piers with deep planters, foliage spilling over them (jasmine white,
 *  bougainvillea magenta), the glazing behind. */
export function paintGreen(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = "#EFEDE6"; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x = i * 128, y = j * 128;
    pane(g, x + 10, y + 14, 108, 84, (r() - 0.5) * 0.1, "#7D92A6", "#33404F");
    if (r() < 0.3) { ge.fillStyle = WARM[Math.floor(r() * 3)]; ge.fillRect(x + 12, y + 16, 104, 80); }
  }
  for (let j = 0; j < 4; j++) {
    const y = j * 128 + 98;
    g.fillStyle = "#F7F5EF"; g.fillRect(0, y, 512, 30);                                         // planter / slab
    for (let k = 0; k < 220; k++) {                                                             // foliage over the planter
      const x = r() * 512, yy = y - 16 + r() * 34, R = 5 + r() * 11;
      g.fillStyle = shade(r() < 0.5 ? "#3F6B3A" : "#5B8A47", (r() - 0.5) * 0.3); g.beginPath(); g.arc(x, yy, R, 0, 7); g.fill();
    }
    for (let k = 0; k < 40; k++) {                                                              // hanging fronds
      const x = r() * 512, L = 10 + r() * 40;
      g.fillStyle = shade("#4C7A3F", (r() - 0.5) * 0.3); g.fillRect(x, y + 20, 3 + r() * 4, L);
    }
    for (let k = 0; k < 60; k++) { g.fillStyle = r() < 0.6 ? "#C2457E" : "#F7F3EA"; const x = r() * 512, yy = y - 10 + r() * 40; g.fillRect(x, yy, 3, 3); }
  }
  for (let i = 0; i < 4; i++) { g.fillStyle = "#F7F5EF"; g.fillRect(i * 128, 0, 10, 512); }
  return [c, e];
}

/** Shop / mall podium, ground floor: dark shopfronts in white frames, a fascia band, warm-lit at night (1 floor, 4.8 m). */
export function paintShop(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = "#EEEAE2"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) {
    const x = i * 128;
    pane(g, x + 8, 120, 112, 392, (r() - 0.5) * 0.1, "#5C6E86", "#1E2733");
    g.fillStyle = "rgba(230,232,236,0.7)"; g.fillRect(x + 63, 120, 2, 392);
    g.fillStyle = shade("#D8D2C6", (r() - 0.5) * 0.1); g.fillRect(x + 8, 40, 112, 52);           // fascia
    ge.fillStyle = WARM[1]; ge.fillRect(x + 10, 122, 108, 388);
    ge.fillStyle = "rgba(255,244,226,0.7)"; ge.fillRect(x + 14, 52, 100, 28);
  }
  return [c, e];
}
/** Podium / mall upper floors: white composite panels with horizontal strip windows (4 floors of 3.2 m). */
export function paintPanel(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = "#ECEBE6"; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 4; j++) {
    const y = j * 128;
    pane(g, 0, y + 44, 512, 40, (r() - 0.5) * 0.08, "#8899B0", "#3E4B60");
    for (let k = 0; k < 512; k += 64) { g.fillStyle = "rgba(200,204,210,0.8)"; g.fillRect(k, y + 44, 2, 40); }
    g.fillStyle = "rgba(80,80,80,0.15)"; for (let k = 0; k < 512; k += 128) g.fillRect(k, y, 1.5, 128);
    for (let k = 0; k < 8; k++) if (r() < 0.25) { ge.fillStyle = WARM[2]; ge.fillRect(k * 64 + 3, y + 46, 58, 36); }
  }
  return [c, e];
}
/** A tower still being built: bare concrete slabs and columns, dark empty floors, safety netting here and there. */
export function paintFrame(seed: number): Pair {
  const [c, g, e] = pair(), r = rng(seed);
  g.fillStyle = "#2A2E33"; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 4; j++) {
    const y = j * 128;
    g.fillStyle = shade("#B4B0A8", (r() - 0.5) * 0.1); g.fillRect(0, y + 104, 512, 24);         // slab edge
    for (let i = 0; i < 8; i++) { g.fillStyle = shade("#A9A59D", (r() - 0.5) * 0.12); g.fillRect(i * 64 + 26, y, 12, 104); }
    if (r() < 0.5) { g.fillStyle = "rgba(220,120,40,0.55)"; g.fillRect(Math.floor(r() * 4) * 128, y + 60, 128, 44); }
  }
  return [c, e];
}
/** Villa: white lime render, a few windows with green or wood shutters (2 floors of 3.2 m). */
export function paintVilla(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed);
  g.fillStyle = "#F4F0E6"; g.fillRect(0, 0, 512, 512);
  grain(g, r, 2400, 0.12);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) {
    if (r() < 0.35) continue;
    const x = i * 128 + 34, y = j * 256 + 70, w = 60, h = 120, sh = r() < 0.5 ? "#5E7D5A" : "#8C6A4A";
    pane(g, x, y, w, h, (r() - 0.5) * 0.1);
    g.fillStyle = sh; g.fillRect(x - 22, y, 20, h); g.fillRect(x + w + 2, y, 20, h);
    if (r() < 0.3) { ge.fillStyle = WARM[0]; ge.fillRect(x + 2, y + 2, w - 4, h - 4); }
  }
  return [c, e];
}

/** Lawn: mown grass with soft stripes and patches (tile 24 m). */
export function paintLawn(seed: number): HTMLCanvasElement {
  const [c, g] = mk(256), r = rng(seed);
  g.fillStyle = "#7FA05B"; g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? "rgba(255,255,220,0.06)" : "rgba(20,40,10,0.05)"; g.fillRect(k * 32, 0, 32, 256); }
  for (let k = 0; k < 2200; k++) { g.fillStyle = r() < 0.5 ? "rgba(40,70,25,0.18)" : "rgba(200,220,140,0.16)"; g.fillRect(r() * 256, r() * 256, 2, 2); }
  return c;
}

/** CFC Tower brise-soleil (Morphosis): bone-white aluminium modules set at varying angles, a mesh of diamonds split into
 *  triangles, about half of them open on the dark fritted glazing; the solid ones catch the light differently (their
 *  tilt). 4 × 4 diamonds of 3 m (tile 12 m). */
export function paintCfcScreen(seed: number): Pair {
  const [c, g, e, ge] = pair(), r = rng(seed), S = 128, B = 9;
  g.fillStyle = "#F1EEE6"; g.fillRect(0, 0, 512, 512);
  const tri = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, ctx: C2) => { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); };
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
    const x0 = i * S, y0 = j * S, cx = x0 + S / 2, cy = y0 + S / 2;
    // the four triangles of the diamond inscribed in the cell, and the four corner triangles between diamonds
    const T: [number, number, number, number, number, number][] = [
      [cx, y0, x0 + S, cy, cx, cy], [x0 + S, cy, cx, y0 + S, cx, cy], [cx, y0 + S, x0, cy, cx, cy], [x0, cy, cx, y0, cx, cy],
      [x0, y0, cx, y0, x0, cy], [cx, y0, x0 + S, y0, x0 + S, cy], [x0 + S, cy, x0 + S, y0 + S, cx, y0 + S], [cx, y0 + S, x0, y0 + S, x0, cy],
    ];
    T.forEach((t, k) => {
      const open = r() < (k < 4 ? 0.42 : 0.2);
      // shrink towards the centroid to leave the white frame
      const gx = (t[0] + t[2] + t[4]) / 3, gy = (t[1] + t[3] + t[5]) / 3, f = 1 - B / 28;
      const s = (v: number, m: number) => m + (v - m) * f;
      const q = [s(t[0], gx), s(t[1], gy), s(t[2], gx), s(t[3], gy), s(t[4], gx), s(t[5], gy)] as const;
      if (open) {
        const gr = g.createLinearGradient(gx, gy - 30, gx, gy + 30); gr.addColorStop(0, "#5C6E88"); gr.addColorStop(1, "#2E3B52");
        g.fillStyle = gr; tri(...q, g); g.fill();
        g.fillStyle = "rgba(255,255,255,0.10)"; tri(q[0], q[1], q[2], q[3], gx, gy, g); g.fill();
        if (r() < 0.35) { ge.fillStyle = "rgba(255,210,150,0.9)"; tri(...q, ge); ge.fill(); }
      } else {
        g.fillStyle = shade("#F6F3EC", (r() - 0.5) * 0.14 - 0.02); tri(...q, g); g.fill();
        g.strokeStyle = "rgba(120,110,95,0.22)"; g.lineWidth = 1.5; g.stroke();
      }
    });
  }
  return [c, e];
}

/** Esplanade paving: pale limestone slabs in running bond with a few darker ones (tile 8 m). */
export function paintPaving(seed: number): HTMLCanvasElement {
  const [c, g] = mk(256), r = rng(seed);
  g.fillStyle = "#E3DCCD"; g.fillRect(0, 0, 256, 256);
  for (let j = 0; j < 16; j++) for (let i = -1; i < 9; i++) {
    const x = i * 32 + (j % 2) * 16, y = j * 16;
    g.fillStyle = shade("#E6DFD0", (r() - 0.5) * 0.08 - (r() < 0.06 ? 0.12 : 0)); g.fillRect(x + 1, y + 1, 30, 14);
  }
  return c;
}
