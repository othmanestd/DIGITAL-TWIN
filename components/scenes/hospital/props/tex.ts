// Canvas textures of the props, painted once in code: the printed atlas (signs, clock faces, boards, posters, art,
// the rug, plans) and the screen atlas (static displays). Rules: French labels only, no figures anywhere, calm colours.
import * as THREE from "three";
import { DEPTS, KIND_COLOR } from "@/lib/hospital";
import { PRINT_W, PRINT_H, SCREEN_W, SCREEN_H, PRINT_PX, SCREEN_PX, SIGN_PX, type Px } from "./atlas";

const FONT = (s: number, w = 600) => `${w} ${s}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
type G = CanvasRenderingContext2D;
function seeded(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function clip(g: G, [x, y, w, h]: Px, fn: (w: number, h: number) => void) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.translate(x, y); fn(w, h); g.restore();
}
function rr(g: G, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fitText(g: G, text: string, max: number, size: number, weight = 600) {
  let s = size;
  g.font = FONT(s, weight);
  while (g.measureText(text).width > max && s > 12) { s -= 1; g.font = FONT(s, weight); }
  return s;
}
const lines = (g: G, x: number, y: number, w: number, n: number, gap: number, col: string, r: () => number, h = 6) => {
  g.fillStyle = col;
  for (let i = 0; i < n; i++) g.fillRect(x, y + i * gap, w * (0.55 + r() * 0.45), h);
};

// ================================================================= printed atlas
function paintPrint(g: G) {
  g.fillStyle = "#EEF0F4"; g.fillRect(0, 0, PRINT_W, PRINT_H);
  // ---------- department sign plates
  DEPTS.forEach((d, i) => clip(g, SIGN_PX(i), (w, h) => {
    g.fillStyle = "#2E3A59"; g.fillRect(0, 0, w, h);
    g.fillStyle = KIND_COLOR[d.kind]; g.fillRect(18, 22, 10, h - 44);
    g.fillStyle = "#FFFFFF"; g.textBaseline = "middle"; g.textAlign = "left";
    fitText(g, d.short, w - 80, 46, 600);
    g.fillText(d.short, 48, h / 2 + 2);
    g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(48, h - 20, w - 96, 2);
  }));
  // ---------- clock face: ticks only
  clip(g, PRINT_PX.clock, (w, h) => {
    const c = w / 2, r = w / 2 - 6;
    g.fillStyle = "#FBFBF9"; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
      g.strokeStyle = big ? "#2B3245" : "#8A93A6"; g.lineWidth = big ? 7 : 2.5;
      g.beginPath(); g.moveTo(c + Math.sin(a) * (r - (big ? 26 : 12)), c - Math.cos(a) * (r - (big ? 26 : 12))); g.lineTo(c + Math.sin(a) * (r - 6), c - Math.cos(a) * (r - 6)); g.stroke();
    }
    g.fillStyle = "#C0574B"; g.beginPath(); g.arc(c, c, 7, 0, Math.PI * 2); g.fill();
    void h;
  });
  // ---------- emergency exit pictogram (running figure toward a door, arrow)
  clip(g, PRINT_PX.exit, (w, h) => {
    g.fillStyle = "#3F8F6B"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FFFFFF";
    g.fillRect(w - 78, 18, 50, h - 36); g.fillStyle = "#3F8F6B"; g.fillRect(w - 70, 26, 34, h - 44);
    g.fillStyle = "#FFFFFF";
    g.beginPath(); g.arc(w - 112, 30, 10, 0, 7); g.fill();
    g.lineWidth = 10; g.lineCap = "round"; g.strokeStyle = "#FFFFFF";
    g.beginPath(); g.moveTo(w - 118, 44); g.lineTo(w - 126, 76); g.lineTo(w - 108, 98); g.stroke();
    g.beginPath(); g.moveTo(w - 126, 76); g.lineTo(w - 146, 100); g.stroke();
    g.beginPath(); g.moveTo(w - 140, 56); g.lineTo(w - 118, 48); g.lineTo(w - 100, 62); g.stroke();
    g.beginPath(); g.moveTo(24, h / 2); g.lineTo(96, h / 2); g.stroke();
    g.beginPath(); g.moveTo(74, h / 2 - 22); g.lineTo(98, h / 2); g.lineTo(74, h / 2 + 22); g.stroke();
  });
  // ---------- AED: heart with a lightning bolt
  clip(g, PRINT_PX.aed, (w, h) => {
    g.fillStyle = "#4F9C80"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FFFFFF";
    g.beginPath(); g.moveTo(w / 2, h * 0.82);
    g.bezierCurveTo(w * 0.05, h * 0.5, w * 0.2, h * 0.12, w / 2, h * 0.32);
    g.bezierCurveTo(w * 0.8, h * 0.12, w * 0.95, h * 0.5, w / 2, h * 0.82); g.fill();
    g.fillStyle = "#4F9C80"; g.beginPath(); g.moveTo(w * 0.55, h * 0.3); g.lineTo(w * 0.4, h * 0.55); g.lineTo(w * 0.52, h * 0.55); g.lineTo(w * 0.45, h * 0.74); g.lineTo(w * 0.62, h * 0.48); g.lineTo(w * 0.5, h * 0.48); g.closePath(); g.fill();
  });
  // ---------- hand hygiene pictogram (small)
  const hands = (w: number, h: number, bg: string) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = "#FFFFFF";
    for (const s of [-1, 1]) {
      g.save(); g.translate(w / 2 + s * w * 0.12, h * 0.58); g.rotate(s * -0.35);
      rr(g, -w * 0.11, -h * 0.22, w * 0.22, h * 0.36, w * 0.08); g.fill();
      for (let k = 0; k < 4; k++) { rr(g, -w * 0.1 + k * w * 0.055, -h * 0.4, w * 0.04, h * 0.22, w * 0.02); g.fill(); }
      g.restore();
    }
    g.fillStyle = "rgba(255,255,255,0.8)";
    for (const [x, y] of [[0.3, 0.22], [0.5, 0.14], [0.7, 0.22]]) { g.beginPath(); g.arc(w * x, h * y, w * 0.03, 0, 7); g.fill(); }
  };
  clip(g, PRINT_PX.hands, (w, h) => hands(w, h, "#5F86AD"));
  // ---------- hand hygiene poster: four pictogram steps
  clip(g, PRINT_PX.poster, (w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#5F86AD"; g.fillRect(0, 0, w, 34);
    g.fillStyle = "#FFFFFF"; g.font = FONT(18, 700); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Hygiène des mains", w / 2, 18);
    for (let i = 0; i < 4; i++) {
      const x = 14 + (i % 2) * (w / 2), y = 48 + Math.floor(i / 2) * 100;
      g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, w / 2 - 22, 88); g.clip();
      hands(w / 2 - 22, 88, ["#86A9C9", "#8DBAA8", "#A9B8D9", "#C9B9A0"][i]); g.restore();
    }
  });
  // ---------- calm information poster (abstract)
  clip(g, PRINT_PX.posterB, (w, h) => {
    g.fillStyle = "#F4EFE4"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#86A9C9"; g.beginPath(); g.arc(w / 2, h * 0.3, w * 0.3, 0, 7); g.fill();
    g.fillStyle = "#C58A6C"; g.fillRect(w * 0.15, h * 0.55, w * 0.7, 10);
    lines(g, w * 0.15, h * 0.65, w * 0.7, 5, 16, "#9AA3B4", seeded(4));
  });
  // ---------- whiteboards: marker strokes, boxes and arrows, never words or figures
  const board = (w: number, h: number, seed: number) => {
    const r = seeded(seed);
    g.fillStyle = "#FBFCFD"; g.fillRect(0, 0, w, h);
    const ink = ["#2E5AA8", "#C0574B", "#3F8F6B", "#2B3245"];
    g.lineCap = "round"; g.lineJoin = "round";
    for (let k = 0; k < 7; k++) {
      g.strokeStyle = ink[k % 4]; g.lineWidth = 3 + r() * 2;
      const x = 20 + r() * (w - 200), y = 20 + r() * (h - 70);
      g.beginPath(); g.moveTo(x, y);
      let cx = x;
      for (let i = 0; i < 6; i++) { cx += 14 + r() * 18; g.quadraticCurveTo(cx - 8, y + (r() - 0.5) * 18, cx, y + (r() - 0.5) * 8); }
      g.stroke();
    }
    g.strokeStyle = "#2E5AA8"; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const x = w * 0.55 + i * 64, y = h * 0.55; g.strokeRect(x, y, 48, 34); if (i < 2) { g.beginPath(); g.moveTo(x + 50, y + 17); g.lineTo(x + 62, y + 17); g.stroke(); } }
    g.strokeStyle = "#C0574B"; g.beginPath(); g.ellipse(w * 0.25, h * 0.7, 46, 22, -0.1, 0, 7); g.stroke();
  };
  clip(g, PRINT_PX.boardA, (w, h) => board(w, h, 11));
  clip(g, PRINT_PX.boardB, (w, h) => board(w, h, 23));
  // ---------- café pictogram
  clip(g, PRINT_PX.cup, (w, h) => {
    g.fillStyle = "#2B3245"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#F4EFE4"; g.lineWidth = 8; g.lineCap = "round";
    rr(g, w * 0.26, h * 0.42, w * 0.4, h * 0.34, 14); g.stroke();
    g.beginPath(); g.arc(w * 0.7, h * 0.56, 16, -Math.PI / 2, Math.PI / 2); g.stroke();
    for (const x of [0.36, 0.46, 0.56]) { g.beginPath(); g.moveTo(w * x, h * 0.34); g.quadraticCurveTo(w * x + 10, h * 0.26, w * x, h * 0.18); g.stroke(); }
    g.beginPath(); g.moveTo(w * 0.2, h * 0.82); g.lineTo(w * 0.78, h * 0.82); g.stroke();
  });
  // ---------- notice board: cork, pinned sheets
  clip(g, PRINT_PX.notice, (w, h) => {
    const r = seeded(7);
    g.fillStyle = "#C9A77C"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2400; i++) { g.fillStyle = r() < 0.5 ? "rgba(120,86,50,0.18)" : "rgba(255,240,210,0.16)"; g.fillRect(r() * w, r() * h, 2, 2); }
    const sheets: [number, number, number, number, string][] = [[30, 30, 130, 170, "#FFFFFF"], [180, 40, 120, 150, "#F7EDB8"], [320, 26, 150, 110, "#FFFFFF"], [40, 220, 160, 130, "#DCE8F3"], [230, 210, 120, 150, "#FFFFFF"], [370, 160, 110, 180, "#E8F1EA"]];
    for (const [x, y, sw, sh, c] of sheets) {
      g.save(); g.translate(x + sw / 2, y + sh / 2); g.rotate((r() - 0.5) * 0.12);
      g.fillStyle = "rgba(0,0,0,0.15)"; g.fillRect(-sw / 2 + 4, -sh / 2 + 5, sw, sh);
      g.fillStyle = c; g.fillRect(-sw / 2, -sh / 2, sw, sh);
      g.fillStyle = "#5F86AD"; g.fillRect(-sw / 2 + 10, -sh / 2 + 12, sw * 0.5, 8);
      lines(g, -sw / 2 + 10, -sh / 2 + 32, sw - 20, Math.floor((sh - 44) / 14), 14, "#A4ACBC", r, 4);
      g.fillStyle = ["#C0574B", "#2E5AA8", "#3F8F6B"][Math.floor(r() * 3)]; g.beginPath(); g.arc(0, -sh / 2 + 6, 6, 0, 7); g.fill();
      g.restore();
    }
  });
  // ---------- Moroccan rug (Beni Ouarain diamonds)
  clip(g, PRINT_PX.rug, (w, h) => {
    const r = seeded(5);
    g.fillStyle = "#EFE7D6"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { g.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.35)" : "rgba(150,130,100,0.12)"; g.fillRect(r() * w, r() * h, 3, 2); }
    g.strokeStyle = "#3A3330"; g.lineWidth = 7; g.lineJoin = "round";
    const cw = 96, ch = 120;
    for (let x = -cw; x < w + cw; x += cw) for (let y = -ch; y < h + ch; y += ch) {
      g.beginPath(); g.moveTo(x + cw / 2, y); g.lineTo(x + cw, y + ch / 2); g.lineTo(x + cw / 2, y + ch); g.lineTo(x, y + ch / 2); g.closePath(); g.stroke();
    }
    g.fillStyle = "#3A3330";
    for (let x = 0; x < w + cw; x += cw) for (let y = 0; y < h + ch; y += ch) { g.beginPath(); g.arc(x + cw / 2, y + ch / 2, 6, 0, 7); g.fill(); }
    g.fillStyle = "#C58A6C"; for (let y = 60; y < h; y += 240) g.fillRect(0, y, w, 4);
  });
  // ---------- wall planner (2026 technical office): weeks × equipment, coloured magnet strips, no figures
  clip(g, PRINT_PX.planner, (w, h) => {
    const r = seeded(17);
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#DDE2EA"; g.fillRect(0, 0, w, 26); g.fillRect(0, 0, 70, h);
    g.strokeStyle = "#C7CDD8"; g.lineWidth = 1.5;
    for (let x = 70; x < w; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 26; y < h; y += 19) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const cols = ["#C0574B", "#2E5AA8", "#3F8F6B", "#D9A75A", "#7A5F8E"];
    for (let row = 0; row < 12; row++) {
      let x = 70 + Math.floor(r() * 4) * 22;
      while (x < w - 30) { const len = (1 + Math.floor(r() * 4)) * 22; if (r() < 0.6) { g.fillStyle = cols[Math.floor(r() * cols.length)]; rr(g, x + 2, 29 + row * 19, len - 4, 13, 4); g.fill(); } x += len + Math.floor(r() * 3) * 22; }
      g.fillStyle = "#8A93A6"; g.fillRect(8, 32 + row * 19, 30 + r() * 26, 6);
    }
    for (let i = 0; i < 8; i++) { g.fillStyle = "#A4ACBC"; g.fillRect(78 + i * 54, 9, 26, 7); }
  });
  // ---------- framed art: arches and zellige / Atlas landscape / wide abstract
  clip(g, PRINT_PX.art1, (w, h) => {
    g.fillStyle = "#F1E7D6"; g.fillRect(0, 0, w, h);
    const arch = (x: number, y: number, aw: number, ah: number, c: string) => { g.fillStyle = c; g.beginPath(); g.moveTo(x, y + ah); g.lineTo(x, y + aw / 2); g.arc(x + aw / 2, y + aw / 2, aw / 2, Math.PI, 0); g.lineTo(x + aw, y + ah); g.closePath(); g.fill(); };
    arch(38, 40, 180, 240, "#C58A6C"); arch(62, 70, 132, 210, "#2E4F7A"); arch(88, 104, 80, 176, "#E8D7BC");
    g.fillStyle = "#3F8F6B"; for (let i = 0; i < 8; i++) { g.save(); g.translate(128, 296 - 8); g.rotate((i / 8) * Math.PI * 2); g.fillRect(-3, -20, 6, 20); g.restore(); }
    g.strokeStyle = "#C2A26A"; g.lineWidth = 3; g.strokeRect(14, 14, w - 28, h - 28);
  });
  clip(g, PRINT_PX.art2, (w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#DCE6F0"); sky.addColorStop(0.6, "#F3E6D4"); sky.addColorStop(1, "#E8D3B8");
    g.fillStyle = sky; g.fillRect(0, 0, w, h);
    g.fillStyle = "#F2D3A6"; g.beginPath(); g.arc(w * 0.68, h * 0.3, 26, 0, 7); g.fill();
    const ridge = (y0: number, amp: number, c: string, seed: number) => { const r = seeded(seed); g.fillStyle = c; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 - Math.sin(x / 40 + seed) * amp - r() * amp * 0.5); g.lineTo(w, h); g.fill(); };
    ridge(h * 0.55, 28, "#9DB0C6", 1); ridge(h * 0.66, 22, "#7B8FA8", 2); ridge(h * 0.78, 16, "#B39274", 3); ridge(h * 0.9, 10, "#8A6A50", 4);
  });
  clip(g, PRINT_PX.art3, (w, h) => {
    g.fillStyle = "#EFE7D9"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#C58A6C"; g.beginPath(); g.arc(w * 0.3, h * 0.55, 80, 0, 7); g.fill();
    g.fillStyle = "#2E3A59"; g.fillRect(w * 0.45, h * 0.2, 90, h * 0.6);
    g.fillStyle = "#D9B27A"; g.beginPath(); g.ellipse(w * 0.75, h * 0.45, 70, 40, 0.3, 0, 7); g.fill();
    g.strokeStyle = "#2E3A59"; g.lineWidth = 4; g.beginPath(); g.moveTo(w * 0.1, h * 0.85); g.bezierCurveTo(w * 0.4, h * 0.6, w * 0.6, h * 0.95, w * 0.92, h * 0.7); g.stroke();
  });
  // ---------- printed page, building plans
  clip(g, PRINT_PX.docs, (w, h) => { g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); lines(g, 20, 20, w - 40, 6, 16, "#9AA3B4", seeded(3), 5); });
  clip(g, PRINT_PX.blueprint, (w, h) => {
    g.fillStyle = "#E4ECF5"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(46,90,168,0.15)"; g.lineWidth = 1;
    for (let i = 0; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    g.strokeStyle = "#2E4F7A"; g.lineWidth = 5; g.strokeRect(40, 60, 430, 220);
    g.lineWidth = 2.5;
    for (const x of [140, 240, 330]) { g.beginPath(); g.moveTo(x, 60); g.lineTo(x, 150); g.stroke(); g.beginPath(); g.moveTo(x, 190); g.lineTo(x, 280); g.stroke(); }
    g.beginPath(); g.moveTo(40, 150); g.lineTo(470, 150); g.moveTo(40, 190); g.lineTo(470, 190); g.stroke();
    g.setLineDash([8, 6]); g.strokeStyle = "#C0574B"; g.beginPath(); g.moveTo(60, 170); g.lineTo(450, 170); g.stroke(); g.setLineDash([]);
    g.strokeStyle = "#2E4F7A"; g.lineWidth = 3; g.strokeRect(60, 330, 260, 120);
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(60, 354 + i * 20); g.lineTo(320, 354 + i * 20); g.stroke(); }
    g.strokeRect(350, 330, 120, 140); g.fillStyle = "rgba(46,79,122,0.3)"; g.fillRect(360, 440, 100, 20);
    g.beginPath(); g.arc(410, 380, 30, 0, 7); g.stroke();
  });
  // ---------- nurse station patient board
  clip(g, PRINT_PX.ward, (w, h) => {
    const r = seeded(31);
    g.fillStyle = "#FBFCFD"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#86A9C9"; g.fillRect(0, 0, w, 22);
    g.strokeStyle = "#C7CDD8"; g.lineWidth = 1.5;
    for (let y = 22; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (const x of [120, 300, 420]) { g.beginPath(); g.moveTo(x, 22); g.lineTo(x, h); g.stroke(); }
    for (let row = 0; row < 9; row++) {
      const y = 26 + row * 26;
      g.strokeStyle = "#2E5AA8"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(10, y + 13); for (let k = 0; k < 5; k++) g.quadraticCurveTo(20 + k * 18, y + 6 + r() * 12, 26 + k * 18, y + 13); g.stroke();
      g.fillStyle = ["#3F8F6B", "#D9A75A", "#5F86AD", "#C0574B"][Math.floor(r() * 4)]; g.beginPath(); g.arc(140, y + 13, 7, 0, 7); g.fill();
      g.fillStyle = "#A4ACBC"; g.fillRect(170, y + 9, 60 + r() * 90, 7);
      if (r() < 0.5) { g.fillStyle = "#E8C06A"; g.fillRect(320, y + 5, 60, 16); }
    }
  });
  // ---------- book spines, binder spines
  clip(g, PRINT_PX.books, (w, h) => {
    const r = seeded(19);
    g.fillStyle = "#5A4D40"; g.fillRect(0, 0, w, h);
    const cols = ["#2E3A59", "#8A5A3C", "#C9B9A0", "#5F7A6A", "#A66F5F", "#E8DFCF", "#3F4656", "#B58E5A"];
    let x = 4;
    while (x < w - 10) {
      const bw = 14 + r() * 26, bh = h * (0.72 + r() * 0.26);
      g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, h - bh, bw - 2, bh);
      g.fillStyle = "rgba(255,255,255,0.25)"; g.fillRect(x + 3, h - bh + 14, bw - 8, 3); g.fillRect(x + 3, h - 22, bw - 8, 3);
      x += bw;
      if (r() < 0.08) x += 30;
    }
  });
  clip(g, PRINT_PX.binders, (w, h) => {
    const r = seeded(29);
    const cols = ["#5E7BA6", "#8A97AD", "#6E9A8A", "#A8695F", "#C9A45C", "#4F5B75"];
    for (let i = 0; i < 16; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(i * 32, 0, 30, h); g.fillStyle = "#FAF8F3"; g.fillRect(i * 32 + 6, 40, 18, 60); g.beginPath(); g.arc(i * 32 + 15, h - 40, 7, 0, 7); g.fill(); }
  });
  // ---------- care poster, evacuation plan, wood grain
  clip(g, PRINT_PX.care, (w, h) => {
    g.fillStyle = "#EAF2F0"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#6FB7AE"; g.fillRect(0, h - 70, w, 70);
    g.fillStyle = "#FFFFFF"; g.fillRect(w / 2 - 14, 60, 28, 90); g.fillRect(w / 2 - 45, 91, 90, 28);
    g.strokeStyle = "#6FB7AE"; g.lineWidth = 6; g.beginPath(); g.arc(w / 2, 105, 70, 0, 7); g.stroke();
    g.fillStyle = "#FFFFFF"; g.font = FONT(24, 600); g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("Prenez soin de vous", w / 2, h - 35);
    lines(g, 40, 200, w - 80, 3, 18, "#8FB0AA", seeded(8));
  });
  clip(g, PRINT_PX.map, (w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#3F8F6B"; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
    g.strokeStyle = "#5D6C8A"; g.lineWidth = 3; g.strokeRect(30, 50, w - 60, h - 110);
    for (const x of [90, 150, 200]) { g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 140); g.stroke(); }
    g.beginPath(); g.moveTo(30, 150); g.lineTo(w - 30, 150); g.stroke();
    g.strokeStyle = "#3F8F6B"; g.lineWidth = 6; g.beginPath(); g.moveTo(70, 180); g.lineTo(200, 180); g.lineTo(200, 230); g.stroke();
    g.beginPath(); g.moveTo(188, 218); g.lineTo(200, 232); g.lineTo(212, 218); g.stroke();
    g.fillStyle = "#C0574B"; g.beginPath(); g.arc(70, 180, 9, 0, 7); g.fill();
    g.fillStyle = "#3F8F6B"; g.fillRect(30, h - 48, w - 60, 22);
  });
  clip(g, PRINT_PX.wood, (w, h) => {
    const r = seeded(37);
    g.fillStyle = "#76593F"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(${r() < 0.5 ? "40,25,15" : "160,120,80"},${0.06 + r() * 0.08})`; g.fillRect(0, y, w, 2); }
  });
}

// ================================================================= screen atlas
const navy = (g: G, w: number, h: number) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#152049"); gr.addColorStop(1, "#0B132F"); g.fillStyle = gr; g.fillRect(0, 0, w, h); };
function paintScreen(g: G) {
  g.fillStyle = "#0B132F"; g.fillRect(0, 0, SCREEN_W, SCREEN_H);
  g.fillStyle = "#26385F"; g.fillRect(992, 992, 32, 32); // plain patch (screens without their own picture)
  // ---------- meeting room display: agenda + calm trend, no figures
  clip(g, SCREEN_PX.meeting, (w, h) => {
    navy(g, w, h); const r = seeded(41);
    g.fillStyle = "#9CB0FF"; g.font = FONT(22, 700); g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("Réunion de service", 24, 40);
    g.fillStyle = "#8D97B0"; g.font = FONT(16, 500); g.fillText("Ordre du jour", 24, 70);
    for (let i = 0; i < 5; i++) { g.fillStyle = i === 1 ? "#4CC79A" : "#5B6B95"; g.beginPath(); g.arc(32, 96 + i * 32, 5, 0, 7); g.fill(); g.fillStyle = "rgba(237,240,247,0.55)"; g.fillRect(46, 92 + i * 32, 120 + r() * 90, 8); }
    g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(270, 60, 220, 200);
    g.strokeStyle = "#4CC79A"; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= 12; i++) { const x = 282 + i * 16, y = 220 - 40 * (0.5 + 0.5 * Math.sin(i * 0.6)) - i * 5; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    g.strokeStyle = "#9CB0FF"; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 12; i++) { const x = 282 + i * 16, y = 236 - 20 * Math.cos(i * 0.5) - i * 2; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
  });
  // ---------- nurse station: patients as coloured rows
  clip(g, SCREEN_PX.nurse, (w, h) => {
    navy(g, w, h); const r = seeded(43);
    g.fillStyle = "#6FB7AE"; g.fillRect(0, 0, w, 18);
    for (let i = 0; i < 6; i++) { const y = 26 + i * 22; g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(8, y, w - 16, 18); g.fillStyle = ["#4CC79A", "#E2B05A", "#9CB0FF"][Math.floor(r() * 3)]; g.beginPath(); g.arc(18, y + 9, 5, 0, 7); g.fill(); g.fillStyle = "rgba(237,240,247,0.6)"; g.fillRect(32, y + 6, 60 + r() * 60, 6); g.fillStyle = "rgba(156,176,255,0.5)"; g.fillRect(180, y + 6, 40 * r() + 20, 6); }
  });
  // ---------- X-ray film
  clip(g, SCREEN_PX.xray, (w, h) => {
    g.fillStyle = "#D9E3EE"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#1A2230"; rr(g, 16, 16, w - 32, h - 32, 8); g.fill();
    g.strokeStyle = "rgba(220,230,240,0.75)"; g.lineWidth = 7; g.lineCap = "round";
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) { g.beginPath(); g.ellipse(w / 2 + s * 10, 70 + i * 24, 70, 18, s * 0.25, s > 0 ? -Math.PI * 0.5 : Math.PI * 0.5, s > 0 ? Math.PI * 0.4 : Math.PI * 1.6); g.stroke(); }
    g.fillStyle = "rgba(230,236,244,0.85)"; g.fillRect(w / 2 - 6, 44, 12, 170);
    g.fillStyle = "rgba(200,210,224,0.25)"; g.beginPath(); g.ellipse(w / 2 - 34, 140, 38, 70, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(w / 2 + 34, 140, 38, 70, 0, 0, 7); g.fill();
  });
  // ---------- command center consoles
  const ops = (w: number, h: number, title: string, seed: number) => {
    navy(g, w, h); const r = seeded(seed);
    g.fillStyle = "#9CB0FF"; g.font = FONT(20, 700); g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText(title, 20, 34);
    for (let i = 0; i < 6; i++) {
      const y = 56 + i * 34;
      g.fillStyle = "rgba(255,255,255,0.05)"; rr(g, 16, y, 220, 26, 6); g.fill();
      g.fillStyle = i === 3 ? "#E2B05A" : "#4CC79A"; g.beginPath(); g.arc(30, y + 13, 5, 0, 7); g.fill();
      g.fillStyle = "rgba(237,240,247,0.6)"; g.fillRect(44, y + 10, 70 + r() * 80, 6);
      g.fillStyle = "rgba(91,124,255,0.5)"; g.fillRect(170, y + 10, 50 * r() + 10, 6);
    }
    const nodes: [number, number][] = [[300, 80], [420, 70], [360, 150], [460, 170], [300, 220], [420, 240]];
    g.strokeStyle = "rgba(156,176,255,0.45)"; g.lineWidth = 2;
    for (const [a, b] of [[0, 2], [1, 2], [2, 3], [2, 4], [3, 5], [4, 5]]) { g.beginPath(); g.moveTo(nodes[a][0], nodes[a][1]); g.lineTo(nodes[b][0], nodes[b][1]); g.stroke(); }
    nodes.forEach(([x, y], i) => { g.fillStyle = i === 2 ? "#7D97FF" : "#2C3D73"; g.beginPath(); g.arc(x, y, i === 2 ? 14 : 9, 0, 7); g.fill(); g.strokeStyle = "#9CB0FF"; g.stroke(); });
  };
  clip(g, SCREEN_PX.ops, (w, h) => ops(w, h, "Agents en activité", 47));
  clip(g, SCREEN_PX.opsB, (w, h) => ops(w, h, "Flux et alertes", 53));
  // ---------- old monitor of 2026: maintenance software, green character lines
  clip(g, SCREEN_PX.crt, (w, h) => {
    const r = seeded(59);
    g.fillStyle = "#0A1A10"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#5BD38A"; g.fillRect(10, 10, w - 20, 12);
    for (let i = 0; i < 9; i++) { let x = 12; while (x < w - 30) { const lw = 6 + Math.floor(r() * 5) * 6; if (r() < 0.8) { g.fillStyle = r() < 0.15 ? "#B9F5CF" : "#3FAE6A"; g.fillRect(x, 34 + i * 16, lw, 7); } x += lw + 6; } }
    g.fillStyle = "rgba(91,211,138,0.08)"; for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  });
  clip(g, SCREEN_PX.doc, (w, h) => { g.fillStyle = "#EEF1F6"; g.fillRect(0, 0, w, h); g.fillStyle = "#3E5A8F"; g.fillRect(0, 0, w, 16); g.fillStyle = "#FFFFFF"; g.fillRect(40, 24, w - 80, h - 24); lines(g, 52, 38, w - 104, 7, 15, "#9AA3B4", seeded(61), 5); });
  clip(g, SCREEN_PX.sheet, (w, h) => {
    g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, w, h); g.fillStyle = "#2F7A55"; g.fillRect(0, 0, w, 14);
    g.strokeStyle = "#D0D6E0"; g.lineWidth = 1; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 14); g.lineTo(x, h); g.stroke(); } for (let y = 14; y < h; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = "#E3EAF6"; g.fillRect(0, 14, w, 12);
  });
  // ---------- vending machine, lit
  clip(g, SCREEN_PX.vending, (w, h) => {
    g.fillStyle = "#E9EEF4"; g.fillRect(0, 0, w, h);
    const r = seeded(67);
    const cols = ["#C0574B", "#2E5AA8", "#3F8F6B", "#E2B05A", "#7A5F8E", "#F4EFE4"];
    for (let row = 0; row < 6; row++) {
      const y = 20 + row * 60;
      g.fillStyle = "#B9C2D0"; g.fillRect(8, y + 48, w - 16, 5);
      for (let i = 0; i < 5; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; rr(g, 16 + i * 46, y + (row % 2 ? 12 : 4), 34, row % 2 ? 36 : 44, 6); g.fill(); g.fillStyle = "rgba(255,255,255,0.45)"; g.fillRect(20 + i * 46, y + 14, 5, 22); }
    }
  });
  // ---------- 2027: the building outline with its first sensors
  clip(g, SCREEN_PX.outline, (w, h) => {
    navy(g, w, h);
    g.fillStyle = "#9CB0FF"; g.font = FONT(20, 700); g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("Bâtiment · premiers capteurs", 20, 34);
    g.strokeStyle = "rgba(156,176,255,0.85)"; g.lineWidth = 2.5;
    const iso = (x: number, y: number, bw: number, bd: number, fl: number, fh: number) => {
      for (let f = 0; f <= fl; f++) {
        const yy = y - f * fh;
        g.beginPath(); g.moveTo(x, yy); g.lineTo(x + bw, yy - bw * 0.35); g.lineTo(x + bw + bd, yy - bw * 0.35 + bd * 0.5); g.lineTo(x + bd, yy + bd * 0.5); g.closePath(); g.stroke();
      }
      for (const [dx, dy] of [[0, 0], [bw, -bw * 0.35], [bd, bd * 0.5], [bw + bd, -bw * 0.35 + bd * 0.5]]) { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx, y + dy - fl * fh); g.stroke(); }
    };
    iso(60, 230, 230, 70, 5, 26); iso(330, 190, 100, 55, 3, 26);
    const dots: [number, number, string][] = [[120, 214, "#4CC79A"], [200, 170, "#4CC79A"], [250, 120, "#7D97FF"], [160, 98, "#4CC79A"], [370, 150, "#E2B05A"], [400, 110, "#7D97FF"]];
    for (const [x, y, c] of dots) { g.fillStyle = c; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.strokeStyle = c; g.globalAlpha = 0.35; g.beginPath(); g.arc(x, y, 13, 0, 7); g.stroke(); g.globalAlpha = 1; }
  });
  // ---------- status strip, espresso display, nurse call, patient TV, 2027 flat monitor
  clip(g, SCREEN_PX.strip, (w, h) => {
    g.fillStyle = "#0B132F"; g.fillRect(0, 0, w, h);
    const cols = ["#4CC79A", "#4CC79A", "#7D97FF", "#4CC79A", "#E2B05A", "#7D97FF", "#4CC79A", "#7D97FF"];
    cols.forEach((c, i) => { g.fillStyle = c; g.globalAlpha = 0.85; rr(g, 6 + i * (w / cols.length), 8, w / cols.length - 12, h - 16, 6); g.fill(); g.globalAlpha = 1; });
  });
  clip(g, SCREEN_PX.coffee, (w, h) => {
    g.fillStyle = "#0B132F"; g.fillRect(0, 0, w, h);
    g.strokeStyle = "#E2B05A"; g.lineWidth = 10; rr(g, w * 0.28, h * 0.4, w * 0.36, h * 0.32, 14); g.stroke();
    g.beginPath(); g.arc(w * 0.68, h * 0.55, 18, -1.5, 1.5); g.stroke();
  });
  clip(g, SCREEN_PX.call, (w, h) => { navy(g, w, h); for (let i = 0; i < 5; i++) { g.fillStyle = i === 2 ? "#E2B05A" : "#4CC79A"; g.beginPath(); g.arc(24, 28 + i * 26, 7, 0, 7); g.fill(); g.fillStyle = "rgba(237,240,247,0.5)"; g.fillRect(42, 24 + i * 26, 120, 7); } });
  clip(g, SCREEN_PX.tv, (w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h); sky.addColorStop(0, "#7FA7D1"); sky.addColorStop(0.6, "#CFE0EE"); sky.addColorStop(1, "#5F86AD");
    g.fillStyle = sky; g.fillRect(0, 0, w, h); g.fillStyle = "#4B76A0"; g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle = "#F4EFE4"; g.fillRect(0, h * 0.86, w, h * 0.14);
  });
  clip(g, SCREEN_PX.flat, (w, h) => {
    navy(g, w, h); const r = seeded(71);
    g.fillStyle = "#9CB0FF"; g.font = FONT(16, 700); g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillText("Maintenance", 14, 24);
    for (let i = 0; i < 5; i++) { const y = 36 + i * 22; g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(10, y, w - 20, 16); g.fillStyle = "rgba(237,240,247,0.55)"; g.fillRect(18, y + 5, 70 + r() * 60, 6); g.fillStyle = ["#4CC79A", "#E2B05A", "#7D97FF"][i % 3]; rr(g, w - 60, y + 3, 40, 10, 5); g.fill(); }
  });
}

// ================================================================= singletons
let printTex: THREE.CanvasTexture | null = null, screenTex: THREE.CanvasTexture | null = null;
function canvasTex(w: number, h: number, paint: (g: G) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  paint(g);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
export function printAtlas() { return (printTex ??= canvasTex(PRINT_W, PRINT_H, paintPrint)); }
export function screenAtlas() { return (screenTex ??= canvasTex(SCREEN_W, SCREEN_H, paintScreen)); }
