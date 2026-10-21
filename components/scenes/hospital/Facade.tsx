"use client";
// Realistic exteriors from the client's photos.
// Main building (Hôpital Privé Ibn Yassine style): fluid white ribbons at every slab with rounded corners that step/wave
// as they wrap the façade, anthracite horizontal louvres over dark tinted glazing, a few dark-glass vertical strips,
// glazed ground-floor shopfront with a terracotta accent wall.
// Head office (siège photo): white stone grid with staggered vertical piers, sky-blue reflective glass, planted balconies.
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GEO, type FloorMats } from "./mats";
import { inCuts, sideCuts, subtract, type Side } from "../walk/plan";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
type Box = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number };

export function Boxes({ geo = GEO.box, mat, items, shadow = true }: { geo?: THREE.BufferGeometry; mat: THREE.Material; items: Box[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, b.yaw ?? 0);
      _m.compose(_v.set(b.x, b.y, b.z), _q, _s.set(b.sx, b.sy, b.sz));
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={shadow} receiveShadow />;
}

// ---------------------------------------------------------------- ribbon geometry
/** Outline of a rounded rectangle (half sizes hw, hd, corner radius r) pushed outward by off(θ) (θ = angle around). */
function contour(hw: number, hd: number, r: number, off: (theta: number) => number, n = 22) {
  const pts: THREE.Vector2[] = [];
  const push = (x: number, z: number, nx: number, nz: number) => {
    const o = off(Math.atan2(z / hd, x / hw));
    pts.push(new THREE.Vector2(x + nx * o, -(z + nz * o)));
  };
  const seg = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number) => {
    for (let i = 0; i < n; i++) { const t = i / n; push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz); }
  };
  const arc = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i < 8; i++) { const a = a0 - (i / 8) * (Math.PI / 2); push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  };
  seg(-hw + r, hd, hw - r, hd, 0, 1); arc(hw - r, hd - r, Math.PI / 2);
  seg(hw, hd - r, hw, -hd + r, 1, 0); arc(hw - r, -hd + r, 0);
  seg(hw - r, -hd, -hw + r, -hd, 0, -1); arc(-hw + r, -hd + r, -Math.PI / 2);
  seg(-hw, -hd + r, -hw, hd - r, -1, 0); arc(-hw + r, hd - r, Math.PI);
  return pts;
}

/** The ribbon as a "C": open on the +x side over z in [za, zb] (where a stair tower meets the façade). */
function notchedShape(hw: number, hd: number, r: number, off: (theta: number) => number, za: number, zb: number, n = 22) {
  const pts: THREE.Vector2[] = [];
  const push = (x: number, z: number, nx: number, nz: number) => {
    const o = off(Math.atan2(z / hd, x / hw));
    pts.push(new THREE.Vector2(x + nx * o, -(z + nz * o)));
  };
  const side = (z0: number, z1: number, last: boolean) => {
    const k = Math.max(2, Math.ceil((Math.abs(z1 - z0) / (2 * hd)) * n));
    for (let i = 0; i < k + (last ? 1 : 0); i++) push(hw, z0 + ((z1 - z0) * i) / k, 1, 0);
  };
  const seg = (x0: number, z0: number, x1: number, z1: number, nx: number, nz: number) => {
    for (let i = 0; i < n; i++) { const t = i / n; push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, nx, nz); }
  };
  const arc = (cx: number, cz: number, a0: number) => {
    for (let i = 0; i < 8; i++) { const a = a0 - (i / 8) * (Math.PI / 2); push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  };
  side(za, -hd + r, false); arc(hw - r, -hd + r, 0);
  seg(hw - r, -hd, -hw + r, -hd, 0, -1); arc(-hw + r, -hd + r, -Math.PI / 2);
  seg(-hw, -hd + r, -hw, hd - r, -1, 0); arc(-hw + r, hd - r, Math.PI);
  seg(-hw + r, hd, hw - r, hd, 0, 1); arc(hw - r, hd - r, Math.PI / 2);
  side(hd - r, zb, true);
  // back along the inner edge (0.25 m inside the façade line), the other way round
  const iw = hw - 0.25, idd = hd - 0.25;
  for (const [x, z] of [[iw, zb], [iw, idd], [-iw, idd], [-iw, -idd], [iw, -idd], [iw, za]]) pts.push(new THREE.Vector2(x, -z));
  return new THREE.Shape(pts);
}

/** A white ribbon (ring) around a plate: inner edge at the façade line, outer edge = waving rounded rectangle.
 *  `notch` opens the ring on the +x side over that z range (building-local), where a stair tower adjoins the façade. */
export function ribbonGeometry(w: number, d: number, o: { base: number; r: number; height: number; wave?: number; phase?: number; notch?: [number, number] }) {
  const hw = w / 2, hd = d / 2;
  // the ribbon swells out and back as it wraps the building (fluid, like the Ibn Yassine bands); continuous all around
  const off = (theta: number) => o.base + (o.wave ? o.wave * (0.5 + 0.5 * Math.cos(2 * theta + (o.phase ?? 0))) : 0);
  let shape: THREE.Shape;
  if (o.notch) shape = notchedShape(hw, hd, o.r, off, o.notch[0], o.notch[1]);
  else {
    shape = new THREE.Shape(contour(hw, hd, o.r, off));
    const ih = new THREE.Path();
    const iw = hw - 0.25, idd = hd - 0.25;
    ih.moveTo(-iw, -idd); ih.lineTo(iw, -idd); ih.lineTo(iw, idd); ih.lineTo(-iw, idd); ih.lineTo(-iw, -idd);
    shape.holes.push(ih);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: o.height, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------- per-floor façade
export type FacadeKind = "main" | "annex";

/** Louvres (horizontal slats) for a main-building floor, with a few vertical dark-glass strips left free
 *  (and none where a stair tower or an entrance meets the façade: `cut` per side, building-local). */
function louvres(w: number, d: number, top: number, cut: (side: Side) => [number, number][] = () => []): Box[] {
  const out: Box[] = [];
  const gx = w / 2 + 0.42, gz = d / 2 + 0.42;
  const ys: number[] = [];
  for (let y = 0.55; y < top - 0.15; y += 0.4) ys.push(y);
  // façade runs split by vertical strips (gaps)
  const runs = (L: number, gaps: number[]) => {
    const r: [number, number][] = [];
    let a = -L / 2 + 0.4;
    for (const g of gaps) { r.push([a, g - 1.3]); a = g + 1.3; }
    r.push([a, L / 2 - 0.4]);
    return r;
  };
  const front = runs(w, [-14.5, 9.5]), side = runs(d, [2.5]);
  const cuts = { "+z": cut("+z"), "-z": cut("-z"), "+x": cut("+x"), "-x": cut("-x") };
  for (const y of ys) {
    for (const [a0, b0] of front) {
      for (const [a, b] of subtract(a0, b0, cuts["+z"])) out.push({ x: (a + b) / 2, y, z: gz, sx: b - a, sy: 0.07, sz: 0.2 });
      for (const [a, b] of subtract(a0, b0, cuts["-z"])) out.push({ x: (a + b) / 2, y, z: -gz, sx: b - a, sy: 0.07, sz: 0.2 });
    }
    for (const [a0, b0] of side) {
      for (const [a, b] of subtract(a0, b0, cuts["+x"])) out.push({ x: gx, y, z: (a + b) / 2, sx: 0.2, sy: 0.07, sz: b - a });
      for (const [a, b] of subtract(a0, b0, cuts["-x"])) out.push({ x: -gx, y, z: (a + b) / 2, sx: 0.2, sy: 0.07, sz: b - a });
    }
  }
  return out;
}

/** Staggered vertical piers (fins) of the head office + planters on some bays. */
function piers(w: number, d: number, h: number, floor: number, cut: (side: Side) => [number, number][] = () => []): { piers: Box[]; planters: Box[]; plants: Box[] } {
  const P: Box[] = [], pl: Box[] = [], pt: Box[] = [];
  const step = 2.2, stag = floor % 2 ? step / 2 : 0;
  const gx = w / 2 + 0.3, gz = d / 2 + 0.3;
  const cuts = { "+z": cut("+z"), "-z": cut("-z"), "+x": cut("+x"), "-x": cut("-x") };
  for (let x = -w / 2 + 0.6 + stag; x <= w / 2 - 0.5; x += step) {
    if (!inCuts(x, cuts["+z"])) P.push({ x, y: h / 2, z: gz, sx: 0.42, sy: h, sz: 0.75 });
    if (!inCuts(x, cuts["-z"])) P.push({ x, y: h / 2, z: -gz, sx: 0.42, sy: h, sz: 0.75 });
  }
  for (let z = -d / 2 + 0.6 + stag; z <= d / 2 - 0.5; z += step) {
    if (!inCuts(z, cuts["+x"])) P.push({ x: gx, y: h / 2, z, sx: 0.75, sy: h, sz: 0.42 });
    if (!inCuts(z, cuts["-x"])) P.push({ x: -gx, y: h / 2, z, sx: 0.75, sy: h, sz: 0.42 });
  }
  if (floor > 0) {
    // planted balconies: a few bays on the front and on the right side
    const bays = floor === 1 ? [-6.6, 2.2] : floor === 2 ? [-2.2, 6.6] : [-8.8, 0, 8.8];
    for (const x of bays) {
      pl.push({ x: x + 1.1 - stag, y: 0.32, z: gz + 0.1, sx: 1.5, sy: 0.45, sz: 0.5 });
      pt.push({ x: x + 0.8 - stag, y: 0.72, z: gz + 0.1, sx: 0.55, sy: 0.6, sz: 0.5 });
      pt.push({ x: x + 1.4 - stag, y: 0.68, z: gz + 0.1, sx: 0.45, sy: 0.5, sz: 0.45 });
    }
  }
  return { piers: P, planters: pl, plants: pt };
}

export function FloorFacade({ kind, floor, w, d, H, mats }: { kind: FacadeKind; floor: number; w: number; d: number; H: number; mats: FloorMats }) {
  const res = useMemo(() => {
    // stair tower on the +x façade: the ribbons stop against it, louvres / piers make room (walk/plan.ts)
    const cut = (side: Side) => sideCuts(kind, floor, side);
    const tz = cut("+x");
    const notch = tz.length ? ([Math.min(...tz.map((c) => c[0])) - 0.03, Math.max(...tz.map((c) => c[1])) + 0.03] as [number, number]) : undefined;
    if (kind === "main") {
      const band = floor >= 1
        ? ribbonGeometry(w, d, { base: 0.5 + 0.2 * (floor % 2), r: 4.2, height: 0.88, wave: 1.1, phase: [0, -0.9, 1.0, 2.6, -2.2][floor] ?? floor, notch })
        : null;
      return { band, louv: floor >= 1 ? louvres(w, d, H - 0.6, cut) : [], piers: null };
    }
    const band = floor >= 1 ? ribbonGeometry(w, d, { base: 0.75, r: 0.5, height: 0.75, notch }) : null;
    return { band, louv: [] as Box[], piers: piers(w, d, H, floor, cut) };
  }, [kind, floor, w, d, H]);
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: "#C8734C", roughness: 0.85 }), []);
  useLayoutEffect(() => () => { res.band?.dispose(); accent.dispose(); }, [res, accent]);
  return (
    <group>
      {res.band && <mesh geometry={res.band} material={mats.band} position={[0, -0.6, 0]} castShadow receiveShadow />}
      {kind === "main" && floor === 0 && (
        // warm terracotta accent wall at the entrance + a slim portal frame (ground-floor shopfront)
        <>
          <mesh position={[-6.2, 1.95, d / 2 + 0.32]} material={accent} castShadow receiveShadow><boxGeometry args={[4.2, 3.9, 0.4]} /></mesh>
          <mesh position={[-1.0, 3.75, d / 2 + 0.3]} material={mats.band} castShadow><boxGeometry args={[6.4, 0.5, 0.5]} /></mesh>
        </>
      )}
      <Boxes mat={mats.louvre} items={res.louv} shadow={false} />
      {res.piers && (
        <>
          <Boxes mat={mats.band} items={res.piers.piers} />
          <Boxes mat={mats.parts.light} items={res.piers.planters} />
          <Boxes geo={GEO.sph} mat={mats.parts.green} items={res.piers.plants} shadow={false} />
        </>
      )}
    </group>
  );
}

// ---------------------------------------------------------------- brand signage (canvas textures)
const FONT = "800 {s}px Nunito, 'Arial Rounded MT Bold', 'Segoe UI', system-ui, sans-serif";

function withMark(draw: (g: CanvasRenderingContext2D, mark: HTMLImageElement | null) => void, w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  draw(g, null);
  const img = new Image();
  img.onload = () => { g.clearRect(0, 0, w, h); draw(g, img); tex.needsUpdate = true; };
  img.src = "/brand/akdital-mark.svg";
  return tex;
}

/** "mark + AKDITAL" (row) or mark above AKDITAL (stack); transparent background unless bg given. */
export function logoTexture(layout: "row" | "stack", bg?: string) {
  const W = layout === "row" ? 1600 : 900, Hh = layout === "row" ? 400 : 760;
  return withMark((g, mark) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, W, Hh, 48); g.fill(); }
    g.fillStyle = "#1E2A5E";
    g.textBaseline = "middle";
    if (layout === "row") {
      if (mark) g.drawImage(mark, 60, 50, 300, 300);
      g.font = FONT.replace("{s}", "230");
      g.letterSpacing = "12px";
      g.fillText("AKDITAL", 420, 214);
    } else {
      if (mark) g.drawImage(mark, W / 2 - 200, 40, 400, 400);
      g.font = FONT.replace("{s}", "190");
      g.letterSpacing = "10px";
      g.textAlign = "center";
      g.fillText("AKDITAL", W / 2, 590);
    }
  }, W, Hh);
}

/** Long blue lettering band "Hôpital Privé Akdital". */
export function letteringTexture() {
  const c = document.createElement("canvas");
  c.width = 2400; c.height = 220;
  const g = c.getContext("2d")!;
  g.fillStyle = "#1A6FB8";
  g.font = FONT.replace("{s}", "150");
  g.textBaseline = "middle";
  g.textAlign = "center";
  g.letterSpacing = "6px";
  g.fillText("Hôpital Privé Akdital", 1200, 118);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
