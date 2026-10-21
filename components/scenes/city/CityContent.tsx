"use client";
// A calm, procedural Casablanca around the typical hospital, in the soft blue of the Morocco map (architectural-model
// style); the hospital square stays white so it reads as the highlighted plot inside the map.
// 1 unit = 1 m, campus at the origin, ground at y = 0, map north = −Z (the Atlantic is to the north-west).
// No controls / lights / background: mounted next to <HospitalContent/> in the unified world.
//  · ground disc (9 km) + a far rim (to 75 km) that blends the city into the Morocco map, with a hole for the plinth
//  · streets / boulevards / diagonal avenues / roundabouts / corniche as one merged geometry; the district around the
//    hospital (district.ts): connected streets, kerbs, zebras, stop lines, median, roundabout, white hospital square
//  · blocks (plan.ts): Haussmann-like perimeter blocks, modern slabs, low-rise outskirts, a Twin-Center-like pair; a
//    procedural façade shader (window rows, balconies, entrances, street-level shops with awnings, lit windows at night)
//  · parks, palms, the ocean, roof props (water tanks, AC units, dishes), the tram tracks
//  · legacy landmarks behind LEGACY_LANDMARKS: the mosque + minaret, the CFC signature towers, the tram vehicles
//  · traffic (Traffic.tsx): cars, red petits taxis, Casa Bus; LOD by camera altitude (lib/world frame.alt)
//  · colliders for the walk mode (collide.ts)
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frame, fadeIn } from "@/lib/world";
import { rt } from "@/components/scenes/hospital/mats";
import { CASA } from "@/components/scenes/geo/MoroccoBase";
import { blockedOutdoors, outdoorSolids, registerSolids } from "./collide";
import { Traffic } from "./Traffic";
import { SQUARE, RB, PLAZA_R } from "./district";
import { cityPlan, citySolids, MOSQUE, R_FAR, R_GROUND, rng, sea, type Bx, type Plan, type Quad, type Seg } from "./plan";

/** Legacy landmarks (mosque + minaret, CFC signature towers, tram vehicles). The landmarks engineer's versions replace
 *  them: flip to false once theirs are in (the tram tracks, poles and wires stay). */
export const LEGACY_LANDMARKS = false; // replaced by components/scenes/city/landmarks (textured mosque, CFC towers, trams)

// ---------------------------------------------------------------- palette (soft tints of the map's blue; the hospital square stays white)
const COL = {
  land: "#BAC6EE", sand: "#C9CEE6", park: "#A9C3D8",
  sidewalk: "#AEBBE6", asphalt: ["#39436C", "#353F66"], paint: "#DDE3FA",
  tree: "#8FA8B6", palm: "#84A3AC", trunk: "#9EA6C2", roofProps: "#D6DEFA", mosque: "#D2DAF6", mosqueRoof: "#8FB2C2",
  kerb: "#C5CFF2", square: "#E4E8EF", squareKerb: "#F4F6FA",
  foam: "#C9D4FA", shallow: "#34477F", deep: "#1E2B5C",
};
/** Multipliers towards the map's navy: by camera altitude (blends into the map) and at night. */
const TINT_MAP = new THREE.Color(0.06, 0.075, 0.15), TINT_NIGHT = new THREE.Color(0.46, 0.52, 0.76);

// decal colours (vertex colours of the markings geometry): paint, rail, parking asphalt, roundabout lawn
const DC = [COL.paint, "#262D4D", "#46507A", COL.park].map((h) => new THREE.Color(h));

/** Dev hook for screenshot QA: pin the time-lapse daylight (null = follow the hospital's time-lapse). */
const DEV: { night: number | null; three?: unknown; blocked: typeof blockedOutdoors; solids: typeof outdoorSolids } = { night: null, blocked: blockedOutdoors, solids: outdoorSolids };
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __city: unknown }).__city = DEV;

// ---------------------------------------------------------------- geometry helpers
/** Flat coloured quads (one merged geometry, vertex colours). */
type QD = { x0: number; z0: number; x1: number; z1: number; w: number; y: number; col: THREE.Color; ext?: number };
function quadGeometry(quads: QD[]) {
  const pos = new Float32Array(quads.length * 4 * 3), col = new Float32Array(quads.length * 4 * 3), idx: number[] = [];
  quads.forEach((s, i) => {
    const dx = s.x1 - s.x0, dz = s.z1 - s.z0, L = Math.hypot(dx, dz) || 1;
    const nx = (-dz / L) * (s.w / 2), nz = (dx / L) * (s.w / 2);
    const e = s.ext ?? 0, ex = (dx / L) * e, ez = (dz / L) * e;
    const P = [
      [s.x0 - ex + nx, s.z0 - ez + nz], [s.x0 - ex - nx, s.z0 - ez - nz],
      [s.x1 + ex - nx, s.z1 + ez - nz], [s.x1 + ex + nx, s.z1 + ez + nz],
    ];
    P.forEach(([x, z], k) => { pos.set([x, s.y, z], (i * 4 + k) * 3); col.set([s.col.r, s.col.g, s.col.b], (i * 4 + k) * 3); });
    const b = i * 4;
    idx.push(b, b + 2, b + 1, b, b + 3, b + 2); // counter-clockwise seen from above (upward-facing)
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the quads may be wound either way: force upward normals
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0);
  return g;
}

const SIDEWALK = new THREE.Color(COL.sidewalk), ASPHALT = COL.asphalt.map((h) => new THREE.Color(h));
/** Streets: soft blue sidewalks under navy-tinted asphalt. */
function streetGeometry(segs: Seg[]) {
  const q: QD[] = [];
  for (const sg of segs) q.push({ ...sg, w: sg.w + (sg.w > 20 ? 9 : 6), y: 0.03, col: SIDEWALK, ext: sg.w * 0.2 });
  for (const sg of segs) q.push({ ...sg, y: 0.06, col: ASPHALT[sg.c], ext: sg.w * 0.12 });
  return quadGeometry(q);
}
function decalGeometry(d: Quad[]) { return quadGeometry(d.map((x) => ({ ...x, col: DC[x.c] }))); }

/** Raised kerb strips (top + both faces) along the district streets. */
function kerbGeometry(list: { x0: number; z0: number; x1: number; z1: number }[], h = 0.13, w = 0.3) {
  const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[]) => {
    const o = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d); for (let k = 0; k < 4; k++) nrm.push(...n);
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (const k of list) {
    const dx = k.x1 - k.x0, dz = k.z1 - k.z0, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, nx = -uz * w / 2, nz = ux * w / 2;
    const A = [k.x0 + nx, k.z0 + nz], B = [k.x1 + nx, k.z1 + nz], Cc = [k.x1 - nx, k.z1 - nz], Dd = [k.x0 - nx, k.z0 - nz];
    // top (counter-clockwise seen from above), then the two vertical faces
    quad([A[0], h, A[1]], [B[0], h, B[1]], [Cc[0], h, Cc[1]], [Dd[0], h, Dd[1]], [0, 1, 0]);
    quad([Dd[0], 0, Dd[1]], [Dd[0], h, Dd[1]], [Cc[0], h, Cc[1]], [Cc[0], 0, Cc[1]], [uz, 0, -ux]);
    quad([B[0], 0, B[1]], [B[0], h, B[1]], [A[0], h, A[1]], [A[0], 0, A[1]], [-uz, 0, ux]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

/** The white hospital square: pavement up to the inner kerbs, with a hole for the plinth (rounded rectangle). */
function squareGeometry() {
  const s = new THREE.Shape();
  // shape in XY with y = −z (rotated −90° about X afterwards)
  s.moveTo(SQUARE.x0, -SQUARE.z0); s.lineTo(SQUARE.x1, -SQUARE.z0); s.lineTo(SQUARE.x1, -(SQUARE.z1 + 3)); s.lineTo(SQUARE.x0, -(SQUARE.z1 + 3)); s.lineTo(SQUARE.x0, -SQUARE.z0);
  const x0 = -74, x1 = 74, z0 = -47, z1 = 47, r = 9;
  const h = new THREE.Path();
  h.moveTo(x0 + r, -z0);
  h.lineTo(x1 - r, -z0); h.quadraticCurveTo(x1, -z0, x1, -z0 - r);
  h.lineTo(x1, -z1 + r); h.quadraticCurveTo(x1, -z1, x1 - r, -z1);
  h.lineTo(x0 + r, -z1); h.quadraticCurveTo(x0, -z1, x0, -z1 + r);
  h.lineTo(x0, -z0 - r); h.quadraticCurveTo(x0, -z0, x0 + r, -z0);
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 12);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0.045, 0);
  return g;
}

/** Ground disc with a hole for the campus plinth; uv = world xz over the disc (for the painted ground texture). */
function worldUV(g: THREE.BufferGeometry) {
  const p = g.attributes.position as THREE.BufferAttribute;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = (p.getX(i) + R_GROUND) / (2 * R_GROUND); uv[i * 2 + 1] = 1 - (p.getZ(i) + R_GROUND) / (2 * R_GROUND); }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
function groundGeometry() {
  const s = new THREE.Shape();
  s.absarc(0, 0, R_GROUND, 0, Math.PI * 2, false);
  const h = new THREE.Path();
  // campus plinth outline (HospitalContent: x −74…74, z −47…47); the plinth and the white square cover it
  h.moveTo(-74, -47); h.lineTo(74, -47); h.lineTo(74, 47); h.lineTo(-74, 47); h.lineTo(-74, -47);
  s.holes.push(h);
  const g = new THREE.ShapeGeometry(s, 128);
  g.rotateX(-Math.PI / 2); // shape y → −z
  worldUV(g);
  return g;
}
/** Far rim (R_GROUND → R_FAR): the city's land / sea colours easing into the map's navy, alpha fading out where the
 *  map (whose hole around Casablanca opens from 30 to 75 km) takes over. Colours are refreshed by `farRimColors`. */
function farRimGeometry() {
  // rings in geometric progression (cells stay roughly square from 9 km to 75 km: no long radial slivers at the coast)
  const A = 384, K = 44, pos: number[] = [], idx: number[] = [];
  for (let k = 0; k <= K; k++) {
    const r = R_GROUND * Math.pow(R_FAR / R_GROUND, k / K);
    for (let a = 0; a <= A; a++) { const t = (a / A) * Math.PI * 2; pos.push(Math.cos(t) * r, 0, Math.sin(t) * r); }
  }
  for (let k = 0; k < K; k++) for (let a = 0; a < A; a++) {
    const i0 = k * (A + 1) + a, i1 = i0 + 1, j0 = i0 + A + 1, j1 = j0 + 1;
    idx.push(i0, i1, j0, i1, j1, j0); // counter-clockwise seen from above (upward-facing)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const n = new Float32Array(pos.length); for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array((pos.length / 3) * 4), 4));
  return g;
}
const _a = new THREE.Color(), _b = new THREE.Color();
const C_LAND = new THREE.Color(COL.land), C_SAND = new THREE.Color(COL.sand), C_FOAM = new THREE.Color(COL.foam), C_SHALLOW = new THREE.Color(COL.shallow), C_DEEP = new THREE.Color(COL.deep);
/** Ground colour at signed coast distance d (> 0 offshore): land, beach, a thin foam line, shallow → deep water. */
function groundColour(d: number, out: THREE.Color) {
  if (d <= -95) return out.copy(C_LAND);
  if (d <= 0) return out.copy(C_SAND);
  if (d < 22) return out.copy(C_FOAM).lerp(C_SHALLOW, d / 22);
  const t = Math.min(1, (d - 22) / 1400);
  return out.copy(C_SHALLOW).lerp(C_DEEP, t * (2 - t));
}
/** inner edge = the city's land / sea × `inner` (same tint as the ground), outer = the map's navy × `outer` (night only). */
function farRimColors(g: THREE.BufferGeometry, inner: THREE.Color, outer: THREE.Color) {
  const p = g.attributes.position as THREE.BufferAttribute, col = g.attributes.color as THREE.BufferAttribute;
  // coast distance per vertex, computed once (this runs while zooming / during the time-lapse)
  const sd = (g.userData.sea as Float32Array | undefined) ?? (g.userData.sea = Float32Array.from({ length: p.count }, (_, i) => sea(p.getX(i), p.getZ(i))));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    const f = Math.min(1, Math.max(0, (r - R_GROUND) / 9000)), e = f * f * (3 - 2 * f);
    groundColour(sd[i], _a);
    _b.copy(_a).multiply(TINT_MAP).multiply(outer); // the fully map-tinted ground: no halo once zoomed out
    _a.multiply(inner);
    _a.lerp(_b, e);
    const t = Math.min(1, Math.max(0, (r - 30000) / (R_FAR - 30000))), alpha = 1 - t * t * (3 - 2 * t);
    col.setXYZW(i, _a.r, _a.g, _a.b, alpha);
  }
  col.needsUpdate = true;
}

function groundTexture(parks: Plan["parks"]) {
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  const cc = new THREE.Color();
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = (px / S) * 2 * R_GROUND - R_GROUND, z = (py / S) * 2 * R_GROUND - R_GROUND;
    groundColour(sea(x, z), cc).convertLinearToSRGB();
    const o = (py * S + px) * 4;
    img.data[o] = cc.r * 255; img.data[o + 1] = cc.g * 255; img.data[o + 2] = cc.b * 255; img.data[o + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = COL.park;
  const k = S / (2 * R_GROUND);
  for (const [x, z, w, d] of parks) g.fillRect((x - w / 2 + R_GROUND) * k, (z - d / 2 + R_GROUND) * k, w * k, d * k);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Block tones: several tints of the map's soft blue (cooler, greyer, a little lilac), plus a few warm painted
 *  façades (sand, soft ochre, terracotta) used sparingly; the walls are a touch darker than the roofs (vertex colours). */
const PALETTE = [
  "#D6DEFA", "#CFD8F6", "#DAE1FA", "#C9D3F3", "#D3DBF7", "#DDE3FB", "#C4CEF0", "#D8DFF9",
  "#CBD5F5", "#D2D7F2", "#C6D2EE", "#DCE1F5", "#BFCBEE", "#D5D9EE", "#CDD9F2", "#D9DDF0",
].map((h) => new THREE.Color(h));
const WARM = ["#E8DCC8", "#E7D2BF", "#EBE0CD", "#DFD0BC", "#E5CDBE"].map((h) => new THREE.Color(h));

/** Procedural façades on the instanced block boxes: window rows (punched, with balconies, or ribbon), an entrance,
 *  a street-level shop band with a muted awning, a soft foot shadow; warm lit windows / shops at night (uNight).
 *  Per-instance style: aStyle = (shop, window style, awning 0…4, seed). Works in metres from the instance scale. */
function facadeMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: "#FFFFFF", vertexColors: true, roughness: 0.88 });
  const uNight = { value: 0 };
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = uNight;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec4 aStyle;\nvarying vec4 vFac;\nvarying float vRoof;\nvarying vec4 vSty;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 fsc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
#else
  vec3 fsc = vec3(1.0);
#endif
  vec3 flp = position + 0.5;
  vec3 fan = abs(normal);
  vFac = vec4(fan.x > 0.5 ? flp.z * fsc.z : flp.x * fsc.x, flp.y * fsc.y, fan.x > 0.5 ? fsc.z : fsc.x, fsc.y);
  vRoof = fan.y > 0.5 ? 1.0 : 0.0;
  vSty = aStyle;`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uNight;\nvarying vec4 vFac;\nvarying float vRoof;\nvarying vec4 vSty;\nfloat fh1(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }")
      .replace("#include <color_fragment>", `#include <color_fragment>
  float lit = 0.0;
  if (vRoof < 0.5) {
    float u = vFac.x, v = vFac.y, L = vFac.z, H = vFac.w;
    float shop = vSty.x, style = vSty.y, acc = vSty.z, seed = vSty.w;
    vec3 wall = diffuseColor.rgb;
    vec3 glass = mix(wall * 0.5, vec3(0.36, 0.42, 0.66), 0.5);
    float g0 = shop > 0.5 ? 4.3 : 3.4;
    if (v > g0 && v < H - 0.9 && L > 3.5) {
      float fy = (v - g0) / 3.1, fi = floor(fy), fv = fract(fy);
      float n = max(1.0, floor((L - 1.6) / 3.1)), cw = (L - 1.6) / n, cu = (u - 0.8) / cw, ci = floor(cu), fu = fract(cu);
      bool inCol = cu > 0.0 && cu < n;
      bool win = style > 1.5 ? (fv > 0.3 && fv < 0.8 && u > 0.7 && u < L - 0.7) : (inCol && fu > 0.24 && fu < 0.76 && fv > 0.3 && fv < 0.82);
      if (style > 0.5 && style < 1.5 && inCol && fu > 0.14 && fu < 0.86 && mod(ci + fi, 2.0) < 1.0) {
        if (fv > 0.18 && fv < 0.29) diffuseColor.rgb = wall * 1.06;           // balcony slab
        else if (fv > 0.13 && fv < 0.18) diffuseColor.rgb = wall * 0.78;      // its shadow
      }
      if (win) {
        diffuseColor.rgb = glass;
        float h = fh1(vec3(style > 1.5 ? floor(u / 3.0) : ci, fi, seed * 97.0 + L));
        lit = h < 0.36 ? 0.6 + 0.4 * fract(h * 7.3) : 0.0;
      }
    } else if (v <= g0 && L > 3.5) {
      if (shop > 0.5) {
        float bay = fract(u / 4.6);
        if (v > 0.3 && v < g0 - 1.15 && bay > 0.07 && bay < 0.95) { diffuseColor.rgb = mix(wall * 0.42, vec3(0.28, 0.32, 0.5), 0.5); lit = 0.55; }
        if (v > g0 - 1.05 && v < g0 - 0.6 && acc > 0.5) {
          vec3 aw = acc < 1.5 ? vec3(0.55, 0.24, 0.17) : acc < 2.5 ? vec3(0.66, 0.45, 0.17) : acc < 3.5 ? vec3(0.2, 0.37, 0.38) : vec3(0.52, 0.2, 0.2);
          diffuseColor.rgb = mix(aw, aw * 1.25, step(0.5, fract(u / 0.9)));
        }
      } else {
        if (L > 8.0 && abs(u - L * 0.5) < 0.95 && v < 2.5) diffuseColor.rgb = wall * 0.48;   // entrance
        else {
          float cu = u / 3.1, fu = fract(cu);
          if (fu > 0.3 && fu < 0.7 && v > 1.1 && v < 2.5 && u > 1.0 && u < L - 1.0) diffuseColor.rgb = glass;
        }
      }
    }
    diffuseColor.rgb *= mix(0.84, 1.0, smoothstep(0.0, 1.8, v));
  }`)
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vec3(1.0, 0.78, 0.5) * lit * uNight;");
  };
  m.userData.uNight = uNight;
  m.customProgramCacheKey = () => "city-facade-v1";
  return m;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);

function Blocks({ items, mat, geo, shadow = false, colors = true, styled = false }: { items: Bx[]; mat: THREE.Material; geo: THREE.BufferGeometry; shadow?: boolean; colors?: boolean; styled?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  // façade styles live on a per-mesh copy of the geometry (instanced attribute)
  const g = useMemo(() => {
    if (!styled) return geo;
    const c = geo.clone();
    const a = new Float32Array(items.length * 4);
    items.forEach((b, i) => a.set([b.shop ?? 0, b.win ?? 0, b.acc ?? 0, (Math.abs(Math.sin(b.x * 12.99 + b.z * 78.23)) * 43758.5) % 1], i * 4));
    c.setAttribute("aStyle", new THREE.InstancedBufferAttribute(a, 4));
    return c;
  }, [geo, items, styled]);
  useEffect(() => () => { if (g !== geo) g.dispose(); }, [g, geo]);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.h / 2, b.z), _q, _s.set(b.w, b.h, b.d));
      m.setMatrixAt(i, _m);
      if (colors) m.setColorAt(i, b.warm ? WARM[Math.floor(b.c * 97) % WARM.length] : PALETTE[Math.floor(b.c * PALETTE.length) % PALETTE.length]);
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, colors, g]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[g, mat, items.length]} castShadow={shadow} receiveShadow={shadow} />;
}

// ---------------------------------------------------------------- component
export function CityContent() {
  const P = cityPlan();
  const three = useThree((s) => s.get);
  useEffect(() => { DEV.three = three; }, [three]);
  const mosque = MOSQUE;
  useEffect(() => { registerSolids("city", citySolids(P, LEGACY_LANDMARKS)); }, [P]);

  const res = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    // walls a touch darker than roofs (vertex colours)
    const bc = new Float32Array(box.attributes.position.count * 3);
    for (let i = 0; i < box.attributes.position.count; i++) { const top = i >= 8 && i < 12; bc.set(top ? [1, 1, 1] : [0.9, 0.915, 0.965], i * 3); }
    box.setAttribute("color", new THREE.BufferAttribute(bc, 3));
    const plainBox = new THREE.BoxGeometry(1, 1, 1);
    const bld = facadeMaterial();
    const sign = new THREE.MeshStandardMaterial({ color: "#3E62C4", emissive: "#3E62C4", emissiveIntensity: 0.25, roughness: 0.4 });
    const streets = streetGeometry(P.segs);
    const street = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    const plaza = new THREE.CircleGeometry(PLAZA_R, 64).rotateX(-Math.PI / 2).translate(RB.x, 0.028, RB.z);
    plaza.setAttribute("color", new THREE.BufferAttribute(new Float32Array(plaza.attributes.position.count * 3).map((_, i) => [SIDEWALK.r, SIDEWALK.g, SIDEWALK.b][i % 3]), 3));
    const ground = groundGeometry();
    const gtex = groundTexture(P.parks);
    const groundMat = new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.97 });
    const far = farRimGeometry();
    const farMat = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, roughness: 0.97, depthWrite: false });
    const tree = new THREE.IcosahedronGeometry(1, 0);
    const treeMat = new THREE.MeshStandardMaterial({ color: COL.tree, roughness: 0.9, flatShading: true });
    const trunk = new THREE.CylinderGeometry(0.22, 0.3, 1, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: COL.trunk, roughness: 0.9 });
    const palmMat = new THREE.MeshStandardMaterial({ color: COL.palm, roughness: 0.85, flatShading: true });
    const car = new THREE.BoxGeometry(1.9, 1.45, 4.4);
    const carMat = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.45, metalness: 0.15 });
    const mosqueMat = new THREE.MeshStandardMaterial({ color: COL.mosque, roughness: 0.8, emissive: "#FFD9A6", emissiveIntensity: 0 });
    const roofGreen = new THREE.MeshStandardMaterial({ color: COL.mosqueRoof, roughness: 0.7 });
    const decals = decalGeometry(P.decals);
    const decalMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 });
    const tank = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 7);
    const unit = new THREE.BoxGeometry(2.2, 1.1, 1.5);
    const dish = new THREE.CylinderGeometry(0.55, 0.3, 0.12, 7);
    const roofMat = new THREE.MeshStandardMaterial({ color: COL.roofProps, roughness: 0.7, metalness: 0.1 });
    const pole = new THREE.CylinderGeometry(0.1, 0.12, 7, 6);
    const tramBody = new THREE.BoxGeometry(32, 2.4, 2.6);
    const tramBand = new THREE.BoxGeometry(31.4, 0.8, 2.64);
    const tramMat = new THREE.MeshStandardMaterial({ color: "#F4F5F7", roughness: 0.4, metalness: 0.1 });
    const tramGlass = new THREE.MeshStandardMaterial({ color: "#2E3646", roughness: 0.2, metalness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: "#3A3F48", roughness: 0.6 });
    // the white hospital square, its kerbs; the district kerbs, the median and the roundabout island
    const square = squareGeometry();
    const squareMat = new THREE.MeshStandardMaterial({ color: COL.square, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1 });
    const kerbW = kerbGeometry(P.kerbs.filter((k) => k.white)), kerbB = kerbGeometry(P.kerbs.filter((k) => !k.white));
    const kerbWMat = new THREE.MeshStandardMaterial({ color: COL.squareKerb, roughness: 0.8 });
    const kerbBMat = new THREE.MeshStandardMaterial({ color: COL.kerb, roughness: 0.85 });
    const parkMat = new THREE.MeshStandardMaterial({ color: COL.park, roughness: 0.95 });
    const island = new THREE.CylinderGeometry(RB.inner, RB.inner, 0.18, 64).translate(RB.x, 0.09, RB.z);
    const islandTop = new THREE.CircleGeometry(RB.inner - 0.45, 64).rotateX(-Math.PI / 2).translate(RB.x, 0.185, RB.z);
    const tinted: THREE.MeshStandardMaterial[] = [bld, street, groundMat, decalMat, treeMat, trunkMat, palmMat, mosqueMat, roofGreen, roofMat, kerbBMat, parkMat];
    for (const m of tinted) m.userData.c0 = m.color.clone();
    const all: THREE.Material[] = [bld, sign, street, decalMat, roofMat, tramMat, tramGlass, darkMat, groundMat, farMat, treeMat, trunkMat, palmMat, carMat, mosqueMat, roofGreen, squareMat, kerbWMat, kerbBMat, parkMat];
    for (const m of all) m.userData.base = m.opacity;
    return { decals, decalMat, tank, unit, dish, roofMat, pole, tramBody, tramBand, tramMat, tramGlass, darkMat, box, plainBox, bld, sign, streets, street, plaza, ground, gtex, groundMat, far, farMat, tree, treeMat, trunk, trunkMat, palmMat, car, carMat, mosqueMat, roofGreen, square, squareMat, kerbW, kerbB, kerbWMat, kerbBMat, parkMat, island, islandTop, tinted, all };
  }, [P]);
  useEffect(() => () => {
    for (const k of ["box", "plainBox", "streets", "plaza", "ground", "far", "tree", "trunk", "car", "decals", "tank", "unit", "dish", "pole", "tramBody", "tramBand", "square", "kerbW", "kerbB", "island", "islandTop"] as const) res[k].dispose();
    res.gtex.dispose(); res.all.forEach((m) => m.dispose());
  }, [res]);

  // trees (parks + roundabouts), palms
  const treeItems = useMemo<Bx[]>(() => P.trees.map(([x, z, s]) => ({ x, z, w: 3.4 * s, d: 3.4 * s, h: 0, yaw: x, c: 0 })), [P]);
  const palmItems = useMemo(() => P.palms, [P]);
  const streetTreeItems = useMemo<Bx[]>(() => P.streetTrees.map(([x, z], i) => ({ x, z, w: 2.6 + (i % 3) * 0.4, d: 2.6 + (i % 3) * 0.4, h: 0, yaw: x, c: 0 })), [P]);
  const roofItems = useMemo(() => [0, 1, 2].map((k) => P.roofs.filter((r) => r.k === k).map((r) => {
    const hh = k === 0 ? 1.5 : k === 1 ? 1.1 : 0.12;
    return { x: r.x, z: r.z, w: r.s, d: r.s, h: hh * r.s, yaw: r.x * 0.7, c: 0, y0: r.y + (k === 2 ? 0.8 : 0) };
  })), [P]);
  const poleItems = useMemo(() => P.poles.map(([x, z]) => ({ x, z })), [P]);
  const medianItems = useMemo(() => P.medians.flatMap((m) => [
    { x: (m.x0 + m.x1) / 2, y: 0.08, z: m.z, w: m.x1 - m.x0, h: 0.16, d: 2.4, k: 0 },
    { x: (m.x0 + m.x1) / 2, y: 0.165, z: m.z, w: m.x1 - m.x0 - 0.5, h: 0.02, d: 1.9, k: 1 },
  ]), [P]);
  const TRAMS = P.tram ? 3 : 0;
  const tramState = useMemo(() => Array.from({ length: TRAMS }, (_, i) => ({ s: i / TRAMS, dir: i % 2 ? -1 : 1 })), [TRAMS]);
  const tramRefs = useRef<(THREE.InstancedMesh | null)[]>([]);

  const group = useRef<THREE.Group>(null), detail = useRef<THREE.Group>(null), trees = useRef<THREE.Group>(null);
  const lastOp = useRef(-1), lastTint = useRef({ k: -1, n: -1, rim: -1 });
  const mul = useMemo(() => ({ c: new THREE.Color(), a: new THREE.Color(), b: new THREE.Color() }), []);
  useFrame((_, dt) => {
    const alt = frame.alt;
    const op = 1 - fadeIn(alt, 25_000, 60_000);
    if (group.current) group.current.visible = op > 0.005;
    if (op <= 0.005) return;
    if (Math.abs(op - lastOp.current) > 0.003) {
      lastOp.current = op;
      for (let q = 0; q < res.all.length; q++) {
        const m = res.all[q], tr = op < 0.999 || m === res.farMat;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = (m.userData.base ?? 1) * op;
      }
    }
    // the far rim gives way to the Morocco map as its hole around Casablanca closes
    res.farMat.opacity = op * CASA.v;
    if (detail.current) detail.current.visible = alt < 2000;
    if (trees.current) trees.current.visible = alt < 4500;
    // night: lit windows follow the hospital's time-lapse; the blue city darkens towards the map's navy, and blends
    // into the map's colours when zooming out
    if (DEV.night !== null) rt.day = 1 - DEV.night; // screenshot QA only (window.__city.night = 0…1), inert otherwise
    const night = 1 - rt.day;
    (res.bld.userData.uNight as { value: number }).value = night * 0.95;
    res.mosqueMat.emissiveIntensity = night * 0.35;
    const k = fadeIn(Math.max(alt, 1), 1800, 22_000), L = lastTint.current;
    if (Math.abs(k - L.k) > 0.004 || Math.abs(night - L.n) > 0.004) {
      L.k = k; L.n = night;
      mul.a.setRGB(1, 1, 1).lerp(TINT_MAP, k);
      mul.b.setRGB(1, 1, 1).lerp(TINT_NIGHT, night);
      mul.c.copy(mul.a).multiply(mul.b);
      for (let q = 0; q < res.tinted.length; q++) { const m = res.tinted[q]; m.color.copy(m.userData.c0 as THREE.Color).multiply(mul.c); }
      if (Math.abs(k + night * 2 - L.rim) > 0.02 || L.rim < 0) { L.rim = k + night * 2; farRimColors(res.far, mul.c, mul.b); }
    }
    // trams (slow, along the main boulevard)
    if (P.tram && alt < 2500) {
      const Lt = Math.hypot(P.tram.x1 - P.tram.x0, P.tram.z1 - P.tram.z0);
      for (let i = 0; i < tramState.length; i++) {
        const tr = tramState[i];
        tr.s = (tr.s + (tr.dir * 5.5 * Math.min(dt, 0.1)) / Lt + 1) % 1;
        const x = P.tram.x0 + (P.tram.x1 - P.tram.x0) * tr.s, z = P.tram.z0 + tr.dir * 1.6;
        _q.setFromAxisAngle(_y, 0);
        _m.compose(_v.set(x, 1.75, z), _q, _s.set(1, 1, 1)); tramRefs.current[0]?.setMatrixAt(i, _m);
        _m.compose(_v.set(x, 2.25, z), _q, _s.set(1, 1, 1)); tramRefs.current[1]?.setMatrixAt(i, _m);
      }
      for (let q = 0; q < tramRefs.current.length; q++) { const mm = tramRefs.current[q]; if (mm) mm.instanceMatrix.needsUpdate = true; }
    }
  });

  return (
    <group ref={group}>
      <mesh geometry={res.ground} material={res.groundMat} position={[0, -0.3, 0]} receiveShadow raycast={() => null} />
      {/* drawn after the Morocco map layers (renderOrder ≤ 3) so their navy never hides it; it fades into them */}
      <mesh geometry={res.far} material={res.farMat} position={[0, -0.3, 0]} renderOrder={8} raycast={() => null} />
      <mesh geometry={res.streets} material={res.street} receiveShadow raycast={() => null} />
      <mesh geometry={res.plaza} material={res.street} receiveShadow raycast={() => null} />
      <mesh geometry={res.decals} material={res.decalMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.square} material={res.squareMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.kerbW} material={res.kerbWMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.kerbB} material={res.kerbBMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.island} material={res.kerbBMat} receiveShadow raycast={() => null} />
      <mesh geometry={res.islandTop} material={res.parkMat} receiveShadow raycast={() => null} />
      <MedianBoxes items={medianItems} geo={res.plainBox} mats={[res.kerbBMat, res.parkMat]} />
      <Blocks items={P.boxes} mat={res.bld} geo={res.box} styled />
      <Blocks items={P.near} mat={res.bld} geo={res.box} shadow styled />
      <Blocks items={P.signs} mat={res.sign} geo={res.plainBox} colors={false} />
      {LEGACY_LANDMARKS && (
        <>
          <Blocks items={P.cfc} mat={res.bld} geo={res.box} styled />
          <Blocks items={P.cfcSigns} mat={res.sign} geo={res.plainBox} colors={false} />
        </>
      )}
      <group ref={trees}>
        <Trees items={treeItems} geo={res.tree} mat={res.treeMat} />
        <Trees items={streetTreeItems} geo={res.tree} mat={res.treeMat} />
      </group>
      <group ref={detail}>
        <Props items={roofItems[0]} geo={res.tank} mat={res.roofMat} />
        <Props items={roofItems[1]} geo={res.unit} mat={res.roofMat} />
        <Props items={roofItems[2]} geo={res.dish} mat={res.roofMat} />
        <Blocks items={P.parked} mat={res.carMat} geo={res.car} colors />
        {poleItems.length > 0 && <Props items={poleItems.map((p) => ({ ...p, w: 1, d: 1, h: 1, yaw: 0, c: 0, y0: 3.5 }))} geo={res.pole} mat={res.darkMat} unit />}
        {P.tram && (
          <>
            {[-1.6, 1.6].map((tz) => (
              <mesh key={tz} material={res.darkMat} position={[(P.tram!.x0 + P.tram!.x1) / 2, 6.1, P.tram!.z0 + tz]}>
                <boxGeometry args={[P.tram!.x1 - P.tram!.x0, 0.04, 0.04]} />
              </mesh>
            ))}
            {LEGACY_LANDMARKS && (
              <>
                <instancedMesh ref={(r) => { tramRefs.current[0] = r; }} args={[res.tramBody, res.tramMat, TRAMS]} frustumCulled={false} />
                <instancedMesh ref={(r) => { tramRefs.current[1] = r; }} args={[res.tramBand, res.tramGlass, TRAMS]} frustumCulled={false} />
              </>
            )}
          </>
        )}
        <Palms items={palmItems} trunk={res.trunk} trunkMat={res.trunkMat} crown={res.tree} crownMat={res.palmMat} />
      </group>
      <Traffic net={P.net} />
      {/* Hassan II-like mosque and minaret by the sea (legacy) */}
      {LEGACY_LANDMARKS && <group position={[mosque.x, 0, mosque.z]} rotation-y={mosque.yaw}>
        <mesh material={res.mosqueMat} position={[0, 2.5, 0]} castShadow><boxGeometry args={[300, 5, 190]} /></mesh>
        <mesh material={res.mosqueMat} position={[30, 16, 10]}><boxGeometry args={[190, 22, 100]} /></mesh>
        <mesh material={res.roofGreen} position={[30, 28.5, 10]}><boxGeometry args={[150, 3, 70]} /></mesh>
        <mesh material={res.mosqueMat} position={[-95, 100, -40]}><boxGeometry args={[25, 200, 25]} /></mesh>
        <mesh material={res.roofGreen} position={[-95, 202, -40]}><boxGeometry args={[25.5, 4, 25.5]} /></mesh>
        <mesh material={res.mosqueMat} position={[-95, 213, -40]}><boxGeometry args={[13, 18, 13]} /></mesh>
        <mesh material={res.roofGreen} position={[-95, 225, -40]}><coneGeometry args={[7, 8, 4]} /></mesh>
      </group>}
    </group>
  );
}

/** Raised median of the front boulevard: kerb body + lawn top (k = material index). */
function MedianBoxes({ items, geo, mats }: { items: { x: number; y: number; z: number; w: number; h: number; d: number; k: number }[]; geo: THREE.BufferGeometry; mats: THREE.Material[] }) {
  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lists = useMemo(() => mats.map((_, k) => items.filter((b) => b.k === k)), [items, mats]);
  useLayoutEffect(() => {
    lists.forEach((l, k) => {
      const m = refs.current[k];
      if (!m) return;
      l.forEach((b, i) => { _q.identity(); _m.compose(_v.set(b.x, b.y, b.z), _q, _s.set(b.w, b.h, b.d)); m.setMatrixAt(i, _m); });
      m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
    });
  }, [lists]);
  return <>{lists.map((l, k) => l.length > 0 && <instancedMesh key={k} ref={(r) => { refs.current[k] = r; }} args={[geo, mats[k], l.length]} receiveShadow castShadow={k === 0} />)}</>;
}

type Prop = { x: number; z: number; w: number; d: number; h: number; yaw: number; c: number; y0: number };
/** Small instanced props sitting at y0 (roof items, poles). `unit` keeps the geometry's own size. */
function Props({ items, geo, mat, unit = false }: { items: Prop[]; geo: THREE.BufferGeometry; mat: THREE.Material; unit?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.y0 + (unit ? 0 : b.h / 2), b.z), _q, unit ? _s.set(1, 1, 1) : _s.set(b.w, b.w, b.d)); // uniform scale (geometry already in metres)
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, unit, geo]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />;
}

function Trees({ items, geo, mat }: { items: Bx[]; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    items.forEach((b, i) => {
      _q.setFromAxisAngle(_y, b.yaw);
      _m.compose(_v.set(b.x, b.w * 0.9, b.z), _q, _s.set(b.w, b.w * 1.1, b.d));
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items]);
  if (!items.length) return null;
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />;
}

function Palms({ items, trunk, trunkMat, crown, crownMat }: { items: [number, number][]; trunk: THREE.BufferGeometry; trunkMat: THREE.Material; crown: THREE.BufferGeometry; crownMat: THREE.Material }) {
  const t = useRef<THREE.InstancedMesh>(null), c = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mt = t.current, mc = c.current;
    if (!mt || !mc) return;
    const r = rng(5);
    items.forEach(([x, z], i) => {
      const h = 7 + r() * 2.5;
      _q.identity();
      _m.compose(_v.set(x, h / 2, z), _q, _s.set(1, h, 1));
      mt.setMatrixAt(i, _m);
      _q.setFromAxisAngle(_y, r() * 6);
      _m.compose(_v.set(x, h + 0.2, z), _q, _s.set(2.6, 0.7, 2.6));
      mc.setMatrixAt(i, _m);
    });
    mt.instanceMatrix.needsUpdate = true; mc.instanceMatrix.needsUpdate = true;
    mt.computeBoundingSphere(); mc.computeBoundingSphere();
  }, [items]);
  return (
    <>
      <instancedMesh ref={t} args={[trunk, trunkMat, items.length]} castShadow />
      <instancedMesh ref={c} args={[crown, crownMat, items.length]} castShadow />
    </>
  );
}
