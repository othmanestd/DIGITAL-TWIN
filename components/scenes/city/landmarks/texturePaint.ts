// Procedural 2D painters for the city landmarks (canvas only, no three.js): carved stone, horseshoe arcades, zellige, green
// glazed roof tiles, marble paving, curtain-wall glass with its night glow, the CFC lattice, the tram livery.
// Everything is generated in code (no photo, no logo); every canvas is ≤ 1024 px and tileable where it repeats.
// Palette: the real colours of each landmark, softened (lower saturation, a touch of lavender in the shadows) so they sit
// next to the soft-blue city without shouting.
import { rng } from "./env";

type C2 = CanvasRenderingContext2D;
export function mk(w: number, h = w): [HTMLCanvasElement, C2] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

/** lighten (f > 0) or darken (f < 0) a #rrggbb colour */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function speckle(g: C2, w: number, h: number, r: () => number, n: number, a: number) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.5 ? `rgba(60,45,30,${a * r()})` : `rgba(255,250,240,${a * r()})`;
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1);
  }
}

// ---------------------------------------------------------------- stone
export const STONE = { base: "#D9CCB1", joint: "rgba(112,96,70,0.34)", dark: "#7F6C52", light: "#EADFC6" };

/** warm limestone, 8 courses of 128 px blocks (tile 6 m) */
export function paintStone() {
  const [c, g] = mk(512), r = rng(11);
  g.fillStyle = STONE.base; g.fillRect(0, 0, 512, 512);
  const tones = Array.from({ length: 8 }, () => Array.from({ length: 4 }, () => (r() - 0.5) * 0.09));
  for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) {
    g.fillStyle = shade(STONE.base, tones[j][(i + 4) % 4]);
    g.fillRect(i * 128 + (j % 2) * 64, j * 64, 128, 64);
  }
  g.fillStyle = STONE.joint;
  for (let j = 0; j <= 8; j++) g.fillRect(0, j * 64 - 1, 512, 2);
  for (let j = 0; j < 8; j++) for (let i = -1; i < 5; i++) g.fillRect(i * 128 + (j % 2) * 64 - 1, j * 64, 2, 64);
  speckle(g, 512, 512, r, 9000, 0.1);
  return c;
}

/** horseshoe arch path (circle of radius r at (cx, yc), springing below the centre, straight legs down to yb) */
function horseshoe(g: C2, cx: number, yc: number, r: number, yb: number) {
  const k = 0.25, half = Math.sqrt(1 - k * k) * r, a = Math.asin(k);
  g.beginPath();
  g.arc(cx, yc, r, Math.PI - a, 2 * Math.PI + a, false);
  g.lineTo(cx + half, yb); g.lineTo(cx - half, yb); g.closePath();
}

/** two bays of horseshoe arcade (tile 24 m × 22 m): frieze of zellige under a dentil cornice, colonnettes, rosettes.
 *  glow = true paints the warm interior of the arches on black (emissive map for the night). */
export function paintArcade(glow = false) {
  const [c, g] = mk(512), r = rng(23);
  if (glow) {
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
    for (const cx of [128, 384]) {
      const gr = g.createLinearGradient(0, 200, 0, 500);
      gr.addColorStop(0, "rgba(255,196,128,0.0)"); gr.addColorStop(0.35, "rgba(255,200,134,0.75)"); gr.addColorStop(1, "rgba(255,214,160,0.95)");
      g.fillStyle = gr; horseshoe(g, cx, 236, 46, 468); g.fill();
    }
    return c;
  }
  g.fillStyle = STONE.base; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 16; j++) { g.fillStyle = shade(STONE.base, (r() - 0.5) * 0.05); g.fillRect(0, j * 32, 512, 32); }
  g.fillStyle = "rgba(112,96,70,0.22)"; for (let j = 0; j <= 16; j++) g.fillRect(0, j * 32 - 1, 512, 1.5);
  // cornice with dentils
  g.fillStyle = shade(STONE.base, -0.07); g.fillRect(0, 0, 512, 26);
  g.fillStyle = shade(STONE.base, -0.17); for (let x = 4; x < 512; x += 16) g.fillRect(x, 10, 8, 12);
  g.fillStyle = "rgba(90,74,52,0.55)"; g.fillRect(0, 25, 512, 2);
  // zellige frieze
  g.fillStyle = "#4F8F89"; g.fillRect(0, 27, 512, 46);
  g.fillStyle = "#35736E"; g.fillRect(0, 27, 512, 3); g.fillRect(0, 70, 512, 3);
  for (let x = 0; x < 512; x += 32) {
    g.fillStyle = "#EAE3CF"; g.beginPath(); g.moveTo(x + 16, 38); g.lineTo(x + 26, 50); g.lineTo(x + 16, 62); g.lineTo(x + 6, 50); g.closePath(); g.fill();
    g.fillStyle = "#2F6561"; g.beginPath(); g.arc(x + 16, 50, 3, 0, 7); g.fill();
  }
  for (const cx of [128, 384]) {
    // voussoir band, recess, inner arch
    g.fillStyle = STONE.light; horseshoe(g, cx, 230, 90, 470); g.fill();
    g.strokeStyle = "rgba(112,96,70,0.5)"; g.lineWidth = 2;
    for (let a = 0; a < 17; a++) { // voussoir joints
      const t = Math.PI + 0.25 + (a / 16) * (Math.PI - 0.5);
      g.beginPath(); g.moveTo(cx + Math.cos(t) * 74, 230 + Math.sin(t) * 74); g.lineTo(cx + Math.cos(t) * 90, 230 + Math.sin(t) * 90); g.stroke();
    }
    const gr = g.createLinearGradient(0, 160, 0, 470);
    gr.addColorStop(0, "#74644E"); gr.addColorStop(1, "#9A866A");
    g.fillStyle = gr; horseshoe(g, cx, 232, 72, 470); g.fill();
    g.fillStyle = "#4E6060"; horseshoe(g, cx, 238, 46, 470); g.fill();
    g.strokeStyle = STONE.light; g.lineWidth = 4; horseshoe(g, cx, 238, 50, 470); g.stroke();
    // colonnettes
    for (const s of [-1, 1]) {
      g.fillStyle = "#D3C5A6"; g.fillRect(cx + s * 106 - 6, 250, 12, 220);
      g.fillStyle = "#EADFC6"; g.fillRect(cx + s * 106 - 9, 246, 18, 8); g.fillRect(cx + s * 106 - 9, 462, 18, 8);
    }
  }
  // rosettes in the spandrels
  for (const cx of [0, 256, 512]) {
    g.fillStyle = STONE.light; g.beginPath(); g.arc(cx, 160, 17, 0, 7); g.fill();
    g.fillStyle = "#4F8F89"; g.beginPath(); g.arc(cx, 160, 12, 0, 7); g.fill();
    g.fillStyle = "#EAE3CF"; g.beginPath(); g.arc(cx, 160, 5, 0, 7); g.fill();
  }
  // plinth
  g.fillStyle = shade(STONE.base, -0.14); g.fillRect(0, 470, 512, 42);
  g.fillStyle = "rgba(90,74,52,0.5)"; g.fillRect(0, 470, 512, 2);
  speckle(g, 512, 512, r, 8000, 0.09);
  return c;
}

/** minaret shaft panel (tile 25 m × 25 m): pilasters, a framed panel with a carved diamond lattice (sebka) over a niche */
export function paintPanel(glow = false) {
  const [c, g] = mk(512), r = rng(37);
  if (glow) {
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 512);
    const gr = g.createLinearGradient(0, 300, 0, 460);
    gr.addColorStop(0, "rgba(255,200,134,0.0)"); gr.addColorStop(1, "rgba(255,206,142,0.55)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(186, 460); g.lineTo(186, 350); g.quadraticCurveTo(186, 306, 256, 292); g.quadraticCurveTo(326, 306, 326, 350); g.lineTo(326, 460); g.fill();
    return c;
  }
  g.fillStyle = STONE.base; g.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 16; j++) { g.fillStyle = shade(STONE.base, (r() - 0.5) * 0.05); g.fillRect(0, j * 32, 512, 32); }
  g.fillStyle = "rgba(112,96,70,0.2)"; for (let j = 0; j <= 16; j++) g.fillRect(0, j * 32 - 1, 512, 1.5);
  // pilasters
  for (const x of [0, 488]) { g.fillStyle = shade(STONE.base, 0.1); g.fillRect(x, 0, 24, 512); g.fillStyle = "rgba(90,74,52,0.4)"; g.fillRect(x + (x ? 0 : 22), 0, 2, 512); }
  // framed panel
  g.fillStyle = shade(STONE.base, 0.13); g.fillRect(58, 34, 396, 444);
  g.fillStyle = "#C2B28F"; g.fillRect(72, 48, 368, 416);
  g.strokeStyle = "rgba(90,74,52,0.55)"; g.lineWidth = 2; g.strokeRect(72, 48, 368, 416);
  // sebka lattice
  g.save(); g.beginPath(); g.rect(88, 64, 336, 208); g.clip();
  g.fillStyle = "#AE9D7B"; g.fillRect(88, 64, 336, 208);
  for (const sh of [3, 0]) {
    g.strokeStyle = sh ? "rgba(70,56,38,0.55)" : "#EFE6D0"; g.lineWidth = sh ? 7 : 5;
    for (let k = -8; k < 14; k++) {
      g.beginPath(); g.moveTo(88 + k * 42 + sh, 64 + sh); g.lineTo(88 + k * 42 + 208 + sh, 272 + sh); g.stroke();
      g.beginPath(); g.moveTo(88 + k * 42 + 208 + sh, 64 + sh); g.lineTo(88 + k * 42 + sh, 272 + sh); g.stroke();
    }
  }
  g.fillStyle = "#EFE6D0"; for (let i = 0; i < 9; i++) for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(88 + 21 + i * 42, 64 + 21 + j * 42, 4, 0, 7); g.fill(); }
  g.restore();
  g.strokeStyle = shade(STONE.base, 0.2); g.lineWidth = 6; g.strokeRect(88, 64, 336, 208);
  // niche (pointed arch)
  g.fillStyle = "#EADFC6"; g.beginPath(); g.moveTo(170, 462); g.lineTo(170, 346); g.quadraticCurveTo(170, 296, 256, 276); g.quadraticCurveTo(342, 296, 342, 346); g.lineTo(342, 462); g.fill();
  const gr = g.createLinearGradient(0, 290, 0, 462);
  gr.addColorStop(0, "#5E4E3B"); gr.addColorStop(1, "#8F7B5C");
  g.fillStyle = gr; g.beginPath(); g.moveTo(186, 462); g.lineTo(186, 350); g.quadraticCurveTo(186, 306, 256, 292); g.quadraticCurveTo(326, 306, 326, 350); g.lineTo(326, 462); g.fill();
  speckle(g, 512, 512, r, 8000, 0.09);
  return c;
}

// ---------------------------------------------------------------- zellige
export type ZPal = { bg: string; star: string; mid: string; acc: string; grout: string };
export const ZELLIGE: Record<"green" | "turquoise", ZPal> = {
  green: { bg: "#5CA286", star: "#EFE9D6", mid: "#8CC0B0", acc: "#478068", grout: "rgba(24,52,42,0.6)" },
  turquoise: { bg: "#4A97A0", star: "#EFE9D9", mid: "#3A7392", acc: "#32686F", grout: "rgba(20,48,56,0.6)" },
};
/** eight-pointed star zellige, 8 × 8 cells of 64 px (tile 4.8 m) */
export function paintZellige(p: ZPal) {
  const [c, g] = mk(512), r = rng(5);
  g.fillStyle = p.bg; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    const cx = i * 64 + 32, cy = j * 64 + 32;
    g.fillStyle = shade(p.star, (r() - 0.5) * 0.06);
    g.beginPath();
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8, rr = k % 2 ? 17 : 30; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fill();
    g.strokeStyle = p.grout; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = p.mid; g.beginPath();
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + Math.PI / 4; g.lineTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9); }
    g.closePath(); g.fill();
  }
  for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
    g.fillStyle = p.acc; g.beginPath();
    for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; g.lineTo(i * 64 + Math.cos(a) * 11, j * 64 + Math.sin(a) * 11); }
    g.closePath(); g.fill();
  }
  // glaze sheen
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.03})`; g.fillRect(Math.floor(r() * 512), Math.floor(r() * 512), 6 + Math.floor(r() * 18), 2); }
  return c;
}

// ---------------------------------------------------------------- green glazed roof tiles
/** barrel tiles in 16 columns, joints every 32 px staggered (tile 3 m) */
export function paintGreenRoof() {
  const [c, g] = mk(256), r = rng(71);
  for (let col = 0; col < 16; col++) {
    const x0 = col * 16, tone = (r() - 0.5) * 0.12;
    const gr = g.createLinearGradient(x0, 0, x0 + 16, 0);
    gr.addColorStop(0, shade("#37795F", tone)); gr.addColorStop(0.45, shade("#5EA68B", tone)); gr.addColorStop(0.62, shade("#4F9A7E", tone)); gr.addColorStop(1, shade("#2F6E58", tone));
    g.fillStyle = gr; g.fillRect(x0, 0, 16, 256);
    for (let k = 0; k < 8; k++) {
      const y = k * 32 + (col % 2) * 16;
      g.fillStyle = "rgba(14,44,36,0.5)"; g.fillRect(x0, y, 16, 2);
      g.fillStyle = "rgba(220,245,230,0.18)"; g.fillRect(x0 + 5, y + 3, 6, 2);
    }
  }
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(Math.floor(r() * 256), Math.floor(r() * 256), 1, 3); }
  return c;
}

// ---------------------------------------------------------------- marble paving
/** esplanade: 4 × 4 slabs of 128 px (tile 20 m) with inlaid stars on a chequerboard */
export function paintMarble() {
  const [c, g] = mk(512), r = rng(97);
  g.fillStyle = "#E4DCC9"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    g.fillStyle = shade("#E4DCC9", (r() - 0.5) * 0.05); g.fillRect(i * 128, j * 128, 128, 128);
    g.strokeStyle = "rgba(190,178,150,0.55)"; g.lineWidth = 1.5; g.strokeRect(i * 128 + 7, j * 128 + 7, 114, 114);
    if ((i + j) % 2 === 0) {
      const cx = i * 128 + 64, cy = j * 128 + 64;
      g.fillStyle = "#B6C1A4"; g.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8 + Math.PI / 16, rr = k % 2 ? 22 : 46; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill();
      g.fillStyle = "#D3BF8E"; g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fill();
      g.strokeStyle = "rgba(120,110,86,0.5)"; g.lineWidth = 1; g.stroke();
    }
  }
  g.fillStyle = "rgba(170,158,128,0.7)";
  for (let k = 0; k <= 4; k++) { g.fillRect(k * 128 - 1, 0, 2, 512); g.fillRect(0, k * 128 - 1, 512, 2); }
  g.strokeStyle = "rgba(150,138,112,0.07)"; g.lineWidth = 2;
  for (let i = 0; i < 26; i++) { g.beginPath(); let x = r() * 512, y = r() * 512; g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (r() - 0.3) * 60; y += (r() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  speckle(g, 512, 512, r, 5000, 0.06);
  return c;
}

// ---------------------------------------------------------------- curtain wall
export type GlassVariant = { top: string; bottom: string; spandrel: string; mullion: string; blind: string };
export const GLASS: Record<"cool" | "green" | "bronze", GlassVariant> = {
  cool: { top: "#9DB3D8", bottom: "#566F98", spandrel: "#8796B4", mullion: "#DCE3F0", blind: "#C9D3E6" },
  green: { top: "#93B5B6", bottom: "#4B6F72", spandrel: "#7F9A9B", mullion: "#DCE8E8", blind: "#C4D6D6" },
  bronze: { top: "#B9A98F", bottom: "#6B5C4C", spandrel: "#968674", mullion: "#E8DFD0", blind: "#D6CCBA" },
};
/** 8 bays × 8 floors of 64 px; [colour, night glow] */
export function paintGlass(v: GlassVariant, seed = 3): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, g] = mk(512), [e, ge] = mk(512), r = rng(seed);
  ge.fillStyle = "#000"; ge.fillRect(0, 0, 512, 512);
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) {
    const x = i * 64, y = j * 64, t = (r() - 0.5) * 0.1;
    const gr = g.createLinearGradient(0, y, 0, y + 48);
    gr.addColorStop(0, shade(v.top, t)); gr.addColorStop(1, shade(v.bottom, t));
    g.fillStyle = gr; g.fillRect(x, y, 64, 48);
    g.fillStyle = shade(v.spandrel, t * 0.6); g.fillRect(x, y + 48, 64, 16);
    // a soft sky streak on some panes
    if (r() < 0.35) { const sg = g.createLinearGradient(x, y, x + 64, y + 48); sg.addColorStop(0, "rgba(255,255,255,0.22)"); sg.addColorStop(0.5, "rgba(255,255,255,0.0)"); g.fillStyle = sg; g.fillRect(x, y, 64, 48); }
    if (r() < 0.1) { g.fillStyle = v.blind; g.globalAlpha = 0.55; g.fillRect(x + 2, y + 2, 60, 18 + Math.floor(r() * 22)); g.globalAlpha = 1; }
    if (r() < 0.3) {
      ge.fillStyle = r() < 0.8 ? "rgba(255,206,140,0.9)" : "rgba(255,238,206,0.9)"; ge.fillRect(x + 3, y + 3, 58, 44);
    }
  }
  g.fillStyle = v.mullion; g.globalAlpha = 0.8;
  for (let i = 0; i < 8; i++) g.fillRect(i * 64 - 1, 0, 2.5, 512);
  g.globalAlpha = 1; g.fillStyle = "rgba(40,50,70,0.5)";
  for (let j = 0; j < 8; j++) g.fillRect(0, j * 64 - 1, 512, 2.5);
  g.fillStyle = "rgba(255,255,255,0.35)"; for (let j = 0; j < 8; j++) g.fillRect(0, j * 64 + 48, 512, 1.5);
  return [c, e];
}

/** CFC brise-soleil: a bone-white lattice of nested diamonds, solid panels alternating with open ones, over dark glazing
 *  (4 × 4 modules of 128 px, tile 12 m) */
export function paintLattice(): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, g] = mk(512), [e, ge] = mk(512), r = rng(41);
  g.fillStyle = "#3C4C70"; g.fillRect(0, 0, 512, 512);
  ge.fillStyle = "#000"; ge.fillRect(0, 0, 512, 512);
  const BONE = "#F4F0E5", SH = "rgba(16,24,44,0.55)";
  const diamond = (cx: number, cy: number, R: number) => { g.beginPath(); g.moveTo(cx, cy - R); g.lineTo(cx + R, cy); g.lineTo(cx, cy + R); g.lineTo(cx - R, cy); g.closePath(); };
  for (let i = -1; i < 5; i++) for (let j = -1; j < 5; j++) {
    const cx = i * 128 + 64, cy = j * 128 + 64, solid = ((((i % 4) + 4) % 4) + (((j % 4) + 4) % 4)) % 2 === 0;
    const lit = r() < 0.4;
    for (const sh of [4, 0]) {
      g.save(); g.translate(sh, sh);
      if (solid) {
        g.fillStyle = sh ? SH : BONE; diamond(cx, cy, 66); g.fill();
        if (!sh) { const gg = g.createLinearGradient(cx, cy - 30, cx, cy + 30); gg.addColorStop(0, "#4A5C84"); gg.addColorStop(1, "#2A3858"); g.fillStyle = gg; diamond(cx, cy, 30); g.fill(); g.strokeStyle = "rgba(60,70,90,0.5)"; g.lineWidth = 2; g.stroke(); }
      } else {
        g.strokeStyle = sh ? SH : BONE; g.lineWidth = sh ? 16 : 13; diamond(cx, cy, 58); g.stroke();
        g.lineWidth = sh ? 11 : 8; diamond(cx, cy, 32); g.stroke();
      }
      g.restore();
    }
    g.strokeStyle = BONE; g.lineWidth = 5;
    if (!solid) { g.beginPath(); g.moveTo(cx - 58, cy); g.lineTo(cx - 32, cy); g.moveTo(cx + 32, cy); g.lineTo(cx + 58, cy); g.moveTo(cx, cy - 58); g.lineTo(cx, cy - 32); g.moveTo(cx, cy + 32); g.lineTo(cx, cy + 58); g.stroke(); }
    if (lit) { ge.fillStyle = "rgba(255,204,140,0.9)"; const R = solid ? 26 : 28; ge.beginPath(); ge.moveTo(cx, cy - R); ge.lineTo(cx + R, cy); ge.lineTo(cx, cy + R); ge.lineTo(cx - R, cy); ge.closePath(); ge.fill(); }
  }
  return [c, e];
}

// ---------------------------------------------------------------- tram
export const TRAM_COL = { body: "#C8683A", bodyDark: "#B25A31", stripe: "#E8E3D8", skirt: "#3C3F48", glass: "#1F2733" };
/** one module's side (11.2 m × 3.5 m): burnt-orange body, dark glazed band with two doors, cream waist stripe, dark skirt */
export function paintTram(): [HTMLCanvasElement, HTMLCanvasElement] {
  const [c, g] = mk(1024, 320), [e, ge] = mk(1024, 320);
  g.fillStyle = TRAM_COL.body; g.fillRect(0, 0, 1024, 320);
  const bg = g.createLinearGradient(0, 200, 0, 290); bg.addColorStop(0, TRAM_COL.body); bg.addColorStop(1, TRAM_COL.bodyDark);
  g.fillStyle = bg; g.fillRect(0, 200, 1024, 90);
  // roof edge highlight
  g.fillStyle = "rgba(255,226,196,0.28)"; g.fillRect(0, 6, 1024, 8);
  // glazed band
  const wg = g.createLinearGradient(0, 40, 0, 188); wg.addColorStop(0, "#2B3647"); wg.addColorStop(0.55, TRAM_COL.glass); wg.addColorStop(1, "#171D28");
  g.fillStyle = wg; g.fillRect(16, 40, 992, 148);
  const sk = g.createLinearGradient(0, 40, 1024, 188); sk.addColorStop(0, "rgba(190,212,245,0.0)"); sk.addColorStop(0.35, "rgba(190,212,245,0.26)"); sk.addColorStop(0.5, "rgba(190,212,245,0.0)"); sk.addColorStop(0.8, "rgba(190,212,245,0.16)"); sk.addColorStop(1, "rgba(190,212,245,0)");
  g.fillStyle = sk; g.fillRect(16, 40, 992, 148);
  // window pillars + doors
  g.fillStyle = TRAM_COL.body;
  for (const x of [250, 470, 560, 800, 920]) g.fillRect(x, 36, 12, 156);
  for (const x0 of [120, 600]) {
    g.fillStyle = "#37455A"; g.fillRect(x0, 44, 118, 144);
    g.fillStyle = TRAM_COL.body; g.fillRect(x0 - 8, 40, 8, 150); g.fillRect(x0 + 118, 40, 8, 150); g.fillRect(x0 + 55, 44, 8, 144);
    g.fillStyle = "rgba(210,224,245,0.18)"; g.fillRect(x0 + 6, 52, 44, 130); g.fillRect(x0 + 70, 52, 44, 130);
  }
  // waist stripe and skirt
  g.fillStyle = TRAM_COL.stripe; g.fillRect(0, 192, 1024, 9);
  g.fillStyle = TRAM_COL.skirt; g.fillRect(0, 288, 1024, 32);
  g.fillStyle = "rgba(0,0,0,0.12)"; for (const x of [334, 704]) g.fillRect(x, 204, 3, 84);
  // articulation bellows at both ends
  g.fillStyle = "#2B2E35"; g.fillRect(0, 0, 9, 320); g.fillRect(1015, 0, 9, 320);
  // night glow: the interior behind the windows
  ge.fillStyle = "#000"; ge.fillRect(0, 0, 1024, 320);
  const eg = ge.createLinearGradient(0, 44, 0, 186); eg.addColorStop(0, "rgba(255,236,196,0.5)"); eg.addColorStop(1, "rgba(255,214,150,0.8)");
  ge.fillStyle = eg; ge.fillRect(24, 46, 220, 138); ge.fillRect(268, 46, 196, 138); ge.fillRect(568, 46, 226, 138); ge.fillRect(818, 46, 96, 138); ge.fillRect(930, 46, 70, 138);
  return [c, e];
}

// ---------------------------------------------------------------- misc
/** soft sandy plaza paving with joints (tile 8 m) for the foot of the towers */
export function paintPlaza() {
  const [c, g] = mk(256), r = rng(13);
  g.fillStyle = "#D8D5E2"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = shade("#D8D5E2", (r() - 0.5) * 0.05); g.fillRect(i * 64, j * 64, 64, 64); }
  g.fillStyle = "rgba(120,118,150,0.35)"; for (let k = 0; k <= 4; k++) { g.fillRect(k * 64 - 1, 0, 2, 256); g.fillRect(0, k * 64 - 1, 256, 2); }
  speckle(g, 256, 256, r, 2200, 0.06);
  return c;
}

/** periodic value noise (4 octaves in the 4 channels, periods 4 / 8 / 16 / 32) for the cloud layer of the sky */
export function cloudNoise(size = 256): Uint8Array {
  const out = new Uint8Array(size * size * 4), r = rng(2026);
  const periods = [4, 8, 16, 32];
  periods.forEach((P, ch) => {
    const lat = Float32Array.from({ length: P * P }, () => r());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * P, fy = (y / size) * P, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = lat[(iy % P) * P + (ix % P)], b = lat[(iy % P) * P + ((ix + 1) % P)], c2 = lat[((iy + 1) % P) * P + (ix % P)], d = lat[((iy + 1) % P) * P + ((ix + 1) % P)];
      out[(y * size + x) * 4 + ch] = Math.round(255 * (a + (b - a) * sx + (c2 - a) * sy + (a - b - c2 + d) * sx * sy));
    }
  });
  return out;
}
