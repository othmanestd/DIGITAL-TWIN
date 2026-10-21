// Animated canvases of the twin pilot room: the five panels of the curved screen wall (2029) and the two large screens
// of the pilot desk (2028 →). Labels and curves only — no figures. French text.
type G = CanvasRenderingContext2D;
const FONT = (s: number, w = 600) => `${w} ${s}px 'Segoe UI', system-ui, -apple-system, sans-serif`;
const C = { bg0: "#121C42", bg1: "#0A1130", text: "#EDF0F7", soft: "#8D97B0", blue: "#9CB0FF", blue2: "#7D97FF", green: "#4CC79A", amber: "#E2B05A", grid: "rgba(156,176,255,0.10)" };

function frame(g: G, w: number, h: number, title: string, sub?: string) {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, C.bg0); gr.addColorStop(1, C.bg1);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = C.grid; g.lineWidth = 1;
  for (let x = 0; x < w; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let y = 0; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.textAlign = "left"; g.textBaseline = "alphabetic";
  g.fillStyle = C.blue; g.font = FONT(30, 700); g.fillText(title, 28, 48);
  if (sub) { g.fillStyle = C.soft; g.font = FONT(19, 500); g.fillText(sub, 28, 76); }
}
function live(g: G, w: number, t: number) {
  g.fillStyle = `rgba(76,199,154,${0.55 + 0.45 * Math.sin(t * 2)})`; g.beginPath(); g.arc(w - 36, 38, 8, 0, 7); g.fill();
  g.fillStyle = C.soft; g.font = FONT(17, 500); g.textAlign = "right"; g.fillText("en direct", w - 54, 44); g.textAlign = "left";
}
function curve(g: G, x0: number, y0: number, w: number, h: number, f: (u: number) => number, col: string, lw = 4, fill?: string) {
  g.beginPath();
  for (let i = 0; i <= 60; i++) { const u = i / 60, x = x0 + u * w, y = y0 + h - f(u) * h; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
  if (fill) { g.lineTo(x0 + w, y0 + h); g.lineTo(x0, y0 + h); g.closePath(); g.fillStyle = fill; g.fill(); g.beginPath(); for (let i = 0; i <= 60; i++) { const u = i / 60, x = x0 + u * w, y = y0 + h - f(u) * h; if (i) g.lineTo(x, y); else g.moveTo(x, y); } }
  g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = "round"; g.stroke();
}
function chip(g: G, x: number, y: number, col: string, label: string) {
  g.fillStyle = col; g.beginPath(); g.roundRect(x, y - 12, 26, 8, 4); g.fill();
  g.fillStyle = C.text; g.font = FONT(18, 500); g.fillText(label, x + 36, y - 2);
}

/** isometric outline of both buildings, floors stacked, with blinking sensor dots */
function iso(g: G, cx: number, cy: number, k: number, t: number, scan = true) {
  const P = (x: number, y: number, z: number): [number, number] => [cx + (x - z) * 0.87 * k, cy + (x + z) * 0.5 * k - y * k];
  const box = (x: number, z: number, w: number, d: number, floors: number, fh: number, col: string, f0 = 0) => {
    for (let f = f0; f <= floors; f++) {
      const y = f * fh;
      const a = P(x, y, z), b = P(x + w, y, z), c = P(x + w, y, z + d), e = P(x, y, z + d);
      g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...e); g.closePath();
      g.fillStyle = f === floors ? "rgba(125,151,255,0.10)" : "rgba(125,151,255,0.05)"; g.fill();
      g.strokeStyle = col; g.lineWidth = f === f0 || f === floors ? 2.4 : 1.4; g.stroke();
    }
    for (const [px, pz] of [[x, z], [x + w, z], [x + w, z + d], [x, z + d]]) { const a = P(px, f0 * fh, pz), b = P(px, floors * fh, pz); g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
  };
  box(0, 0, 52, 26, 6, 4.4, "rgba(156,176,255,0.85)");
  box(60, 8, 22, 18, 4, 4.4, "rgba(156,176,255,0.7)");
  // skybridge
  const s0 = P(52, 4.4 * 2, 13), s1 = P(60, 4.4 * 2, 13);
  g.strokeStyle = "rgba(156,176,255,0.6)"; g.lineWidth = 3; g.beginPath(); g.moveTo(...s0); g.lineTo(...s1); g.stroke();
  const dots: [number, number, number, string][] = [
    [8, 1, 6, C.green], [20, 1, 18, C.green], [40, 1, 8, C.blue2], [14, 2, 20, C.green], [34, 2, 6, C.amber], [46, 3, 16, C.green],
    [10, 4, 10, C.blue2], [30, 4, 20, C.green], [44, 5, 6, C.green], [24, 5, 14, C.blue2], [66, 1, 14, C.green], [74, 2, 20, C.blue2], [70, 3, 12, C.green],
  ];
  dots.forEach(([x, f, z, col], i) => {
    const [px, py] = P(x, f * 4.4 + 0.4, z);
    const a = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3);
    g.fillStyle = col; g.globalAlpha = 0.45 + 0.55 * a; g.beginPath(); g.arc(px, py, 5, 0, 7); g.fill();
    g.globalAlpha = 0.25 * a; g.beginPath(); g.arc(px, py, 12, 0, 7); g.fill(); g.globalAlpha = 1;
  });
  if (scan) {
    const u = (t * 0.18) % 1, y = u * 6 * 4.4;
    const a = P(-4, y, -4), b = P(56, y, -4), c = P(56, y, 30), e = P(-4, y, 30);
    g.strokeStyle = "rgba(76,199,154,0.5)"; g.lineWidth = 2; g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.lineTo(...c); g.lineTo(...e); g.closePath(); g.stroke();
  }
}

export const PANELS: { title: string; sub: string; paint: (g: G, t: number, w: number, h: number) => void }[] = [
  { title: "Énergie", sub: "consommation mesurée et pilotée", paint: (g, t, w, h) => {
    const x0 = 28, y0 = 110, cw = w - 56, ch = h - 210;
    const day = (u: number) => 0.3 + 0.42 * Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.18) / 0.7))) + 0.04 * Math.sin(u * 30);
    curve(g, x0, y0, cw, ch, (u) => day(u) * 1.0, "rgba(195,202,217,0.75)", 3);
    curve(g, x0, y0, cw, ch, (u) => day(u) * 0.84 - 0.02, C.green, 4, "rgba(76,199,154,0.12)");
    const cu = (t * 0.05) % 1;
    g.fillStyle = C.text; g.fillRect(x0 + cu * cw - 1, y0, 2, ch);
    chip(g, 28, h - 70, "rgba(195,202,217,0.75)", "mesurée"); chip(g, 200, h - 70, C.green, "pilotée");
    const bars: [string, number][] = [["Climatisation", 0.7], ["Éclairage", 0.45], ["Équipements", 0.58]];
    bars.forEach(([l, v], i) => { g.fillStyle = C.soft; g.font = FONT(16, 500); g.fillText(l, 28 + i * 190, h - 26); g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(28 + i * 190, h - 18, 160, 6); g.fillStyle = C.blue2; g.fillRect(28 + i * 190, h - 18, 160 * (v + 0.05 * Math.sin(t + i)), 6); });
  } },
  { title: "Maintenance biomédicale", sub: "préventive et prédictive", paint: (g, t, w, h) => {
    const rows = ["Pompes à perfusion", "Moniteurs", "Ventilateurs", "Échographes", "Lits médicalisés"];
    rows.forEach((r, i) => {
      const y = 112 + i * 46;
      g.fillStyle = "rgba(255,255,255,0.05)"; g.beginPath(); g.roundRect(24, y, w - 48, 36, 8); g.fill();
      const col = i === 2 ? C.amber : C.green;
      g.fillStyle = col; g.globalAlpha = i === 2 ? 0.6 + 0.4 * Math.sin(t * 2) : 1; g.beginPath(); g.arc(44, y + 18, 7, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = C.text; g.font = FONT(19, 500); g.fillText(r, 62, y + 25);
      g.fillStyle = "rgba(255,255,255,0.1)"; g.fillRect(w - 190, y + 15, 150, 7);
      g.fillStyle = col; g.fillRect(w - 190, y + 15, 150 * [0.86, 0.92, 0.55, 0.8, 0.95][i], 7);
    });
    const y = h - 44; g.strokeStyle = "rgba(156,176,255,0.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(28, y); g.lineTo(w - 28, y); g.stroke();
    for (let i = 0; i < 7; i++) { const x = 40 + i * ((w - 80) / 6); g.fillStyle = i === 3 ? C.amber : C.blue2; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillRect(-6, -6, 12, 12); g.restore(); }
    g.fillStyle = C.text; g.fillRect(40 + ((t * 0.04) % 1) * (w - 80), y - 14, 2, 28);
  } },
  { title: "Jumeau numérique", sub: "bâtiment principal et siège", paint: (g, t, w, h) => {
    iso(g, w * 0.36, h * 0.5, 4.2, t);
    g.fillStyle = C.soft; g.font = FONT(17, 500); g.fillText("Bâtiment principal", 40, h - 30); g.textAlign = "right"; g.fillText("Siège", w - 40, h - 30); g.textAlign = "left";
  } },
  { title: "Flux patients", sub: "parcours dans l'hôpital", paint: (g, t, w, h) => {
    const N: [string, number, number][] = [["Urgences", 0.12, 0.35], ["Imagerie", 0.12, 0.72], ["Bloc", 0.45, 0.3], ["Réanimation", 0.45, 0.72], ["Hospitalisation", 0.78, 0.5], ["Sortie", 0.95, 0.85]];
    const pos = N.map(([, x, y]) => [28 + x * (w - 120), 100 + y * (h - 170)] as [number, number]);
    const links: [number, number, number][] = [[0, 2, 5], [0, 1, 3], [1, 2, 2], [2, 3, 3], [2, 4, 4], [3, 4, 3], [4, 5, 5], [0, 4, 2]];
    links.forEach(([a, b, k], li) => {
      const [x1, y1] = pos[a], [x2, y2] = pos[b], mx = (x1 + x2) / 2;
      g.strokeStyle = "rgba(125,151,255,0.35)"; g.lineWidth = 2 + k * 1.6; g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(mx, y1, mx, y2, x2, y2); g.stroke();
      for (let j = 0; j < 3; j++) {
        const u = (t * 0.22 + j / 3 + li * 0.13) % 1, v = 1 - u;
        const x = v * v * v * x1 + 3 * v * v * u * mx + 3 * v * u * u * mx + u * u * u * x2, y = v * v * v * y1 + 3 * v * v * u * y1 + 3 * v * u * u * y2 + u * u * u * y2;
        g.fillStyle = C.green; g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill();
      }
    });
    N.forEach(([l], i) => { const [x, y] = pos[i]; g.font = FONT(17, 600); g.fillStyle = "#1B2758"; g.beginPath(); g.roundRect(x - 8, y - 18, g.measureText(l).width + 40, 36, 18); g.fill(); g.strokeStyle = C.blue; g.lineWidth = 1.5; g.stroke(); g.fillStyle = C.text; g.font = FONT(17, 600); g.fillText(l, x + 10, y + 6); });
  } },
  { title: "Fluides et confort", sub: "air, eau, température", paint: (g, t, w, h) => {
    const x0 = 28, cw = w - 56;
    const rows: [string, string, number][] = [["Air", C.blue2, 0], ["Eau", C.green, 1], ["Température", C.amber, 2]];
    rows.forEach(([l, col, i]) => {
      const y0 = 100 + i * ((h - 120) / 3), ch = (h - 120) / 3 - 26;
      g.fillStyle = C.soft; g.font = FONT(18, 500); g.fillText(l, x0, y0 + 14);
      g.fillStyle = "rgba(255,255,255,0.05)"; g.fillRect(x0, y0 + 22, cw, ch);
      curve(g, x0, y0 + 22, cw, ch, (u) => 0.5 + 0.28 * Math.sin(u * 9 + t * 0.6 + i * 2) * Math.cos(u * 3 + i), col, 3);
      g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(x0, y0 + 22 + ch * 0.3, cw, ch * 0.4);
    });
  } },
];

export function paintPanel(i: number, g: G, t: number, w: number, h: number) {
  const p = PANELS[i];
  frame(g, w, h, p.title, p.sub);
  p.paint(g, t, w, h);
  live(g, w, t);
}

/** pilot desk (2028 →): left = building view, right = flow curves */
export function paintPilot(i: number, g: G, t: number, w: number, h: number) {
  if (i === 0) {
    frame(g, w, h, "Vue bâtiment");
    iso(g, w * 0.34, h * 0.56, 3.0, t, true);
  } else {
    frame(g, w, h, "Courbes de flux");
    const x0 = 24, y0 = 80, cw = w - 48, ch = h - 130;
    curve(g, x0, y0, cw, ch, (u) => 0.35 + 0.3 * Math.sin(u * 6 + t * 0.4), C.green, 4, "rgba(76,199,154,0.10)");
    curve(g, x0, y0, cw, ch, (u) => 0.55 + 0.2 * Math.sin(u * 4 - t * 0.3 + 1), C.blue2, 3);
    chip(g, 24, h - 22, C.green, "Énergie"); chip(g, 200, h - 22, C.blue2, "Flux patients");
  }
  live(g, w, t);
}
