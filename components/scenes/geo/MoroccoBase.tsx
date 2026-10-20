"use client";
// The Morocco map base: one extruded landmass (Morocco INCLUDING its southern provinces, one feature, no internal
// border), dim neighbouring slabs for context, a bounded calm ocean (±2 500 km, soft radial fade) with a faint
// Mercator graticule and a soft coastal shelf. Map-local units: x east, z south, the land TOP is the plane y = 0
// (the extrusion hangs below it) so the typical hospital can stand on it at Casablanca (the origin).
import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { GeoHtml } from "./GeoHtml";
import { geoPath } from "d3-geo";
import { GEO, shapesOf, graticuleSegments, maProjection, toXZ } from "@/lib/geo/geometry";
import { MAP_UNITS_PER_KM } from "@/lib/geo/projection";
import { FADE_FRAG, WORLD_VERT, GEO_FADE, LOGDEPTH_FRAG, LOGDEPTH_FRAG_PARS, LOGDEPTH_VERT, LOGDEPTH_VERT_PARS } from "./shared";

export const LAND_DEPTH = 5.2;
export const LAND_BEVEL = 0.35;
/** y of Morocco's top surface (pins, arcs and the hospital's ground sit here). */
export const LAND_TOP = 0;
export const LAND_BOTTOM = LAND_TOP - (LAND_DEPTH + LAND_BEVEL * 2);

const [[bx0, by0], [bx1, by1]] = geoPath(maProjection()).bounds(GEO.morocco);
/** Visual centre of Morocco (southern provinces included) in map-local units, and its size. */
export const MAP_CENTER = new THREE.Vector3((bx0 + bx1) / 2, 0, (by0 + by1) / 2);
export const MAP_SIZE = { w: bx1 - bx0, d: by1 - by0 };

const KM = MAP_UNITS_PER_KM;
const OCEAN_R = 2500 * KM; // ocean disc radius (±2 500 km around Morocco)
const FADE = { r0: 1350 * KM, r1: 2450 * KM };
const CLIP: [[number, number], [number, number]] = [
  [MAP_CENTER.x - OCEAN_R, MAP_CENTER.z - OCEAN_R],
  [MAP_CENTER.x + OCEAN_R, MAP_CENTER.z + OCEAN_R],
];
const C2 = new THREE.Vector2(MAP_CENTER.x, MAP_CENTER.z);
/** Near the ground the map opens a soft "hole" around Casablanca (the origin) so the virtual city / hospital ground shows:
 *  CASA.v = 0 (no hole) … 1 (hole fully open), set every frame by MoroccoContent from the altitude. */
export const CASA = { v: 0 };
const HOLE = { r0: 30 * MAP_UNITS_PER_KM, r1: 75 * MAP_UNITS_PER_KM };
const HOLE_GLSL = /* glsl */ `
uniform float uCasa; uniform float uHole0; uniform float uHole1;
float casaKeep(vec2 p) { return 1.0 - uCasa * (1.0 - smoothstep(uHole0, uHole1, length(p))); }`;
const holeUniforms = () => ({ uCasa: { value: 0 }, uHole0: { value: HOLE.r0 }, uHole1: { value: HOLE.r1 } });

// ------------------------------------------------------------------ shaders
const NORMAL_VERT = /* glsl */ `
varying vec3 vW; varying vec3 vN;
${LOGDEPTH_VERT_PARS}
void main() {
  vW = position;
  vN = normalize(normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH_VERT}
}`;
const TOP_FRAG = /* glsl */ `
uniform vec3 uBase; uniform vec3 uHi; uniform vec3 uDot; uniform vec3 uSide; uniform float uBottom; uniform float uMul; uniform vec2 uC;
varying vec3 vW; varying vec3 vN;
${LOGDEPTH_FRAG_PARS}
${HOLE_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; } return s; }
void main() {
  ${LOGDEPTH_FRAG}
  vec2 p = vW.xz;
  vec2 q = p - uC;
  // soft, low-amplitude relief (texture only — no fake topography claims)
  float k = 0.045;
  float h = fbm(p * k);
  float hx = fbm((p + vec2(0.7, 0.0)) * k) - h;
  float hz = fbm((p + vec2(0.0, 0.7)) * k) - h;
  vec3 n = normalize(vec3(-hx * 10.0, 1.0, -hz * 10.0));
  float shade = clamp(dot(n, normalize(vec3(-0.55, 0.75, -0.45))), 0.0, 1.0);
  vec3 col = mix(uBase, uHi, smoothstep(0.62, 1.0, shade) * 0.8);
  // broad light from the north-west
  col *= 0.92 + 0.12 * smoothstep(160.0, -160.0, q.x * 0.6 + q.y * 0.8);
  // fine cartographic dot screen, anti-aliased (fades out when sub-pixel)
  vec2 g = fract(p / 2.2) - 0.5;
  float d = length(g);
  float w = fwidth(d) * 1.2;
  // (fades out when sub-pixel, and when zoomed so close that the dots would become big blobs)
  float dotm = (1.0 - smoothstep(0.075 - w, 0.075 + w, d)) * (1.0 - smoothstep(0.08, 0.3, w)) * smoothstep(0.004, 0.015, w);
  col = mix(col, uDot, dotm * 0.45);
  // walls / bevel: darker, slightly lit from above
  float up = smoothstep(0.6, 0.95, vN.y);
  float lit = clamp(dot(vN, normalize(vec3(-0.35, 0.55, 0.75))), 0.0, 1.0);
  vec3 side = uSide * (0.55 + 0.55 * lit) * (0.55 + 0.6 * smoothstep(uBottom, 0.0, vW.y));
  float keep = casaKeep(vW.xz);
  if (keep < 0.01) discard;
  gl_FragColor = vec4(mix(side, col, up), uMul * keep);
  #include <colorspace_fragment>
}`;
const NEIGH_FRAG = /* glsl */ `
uniform vec3 uTop; uniform vec3 uSide; uniform float uR0; uniform float uR1; uniform float uOpacity; uniform float uMul; uniform vec2 uC;
varying vec3 vW; varying vec3 vN;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  float a = uOpacity * uMul * (1.0 - smoothstep(uR0, uR1, length(vW.xz - uC)));
  vec3 c = mix(uSide, uTop, smoothstep(0.6, 0.95, vN.y));
  gl_FragColor = vec4(c, a);
  #include <colorspace_fragment>
}`;
const OCEAN_FRAG = /* glsl */ `
uniform vec3 uDeep; uniform vec3 uShelfCol; uniform sampler2D uShelf; uniform float uExtent; uniform float uR0; uniform float uR1; uniform float uMul; uniform vec2 uC;
varying vec3 vW;
${LOGDEPTH_FRAG_PARS}
${HOLE_GLSL}
void main() {
  ${LOGDEPTH_FRAG}
  float a = 0.9 * (1.0 - smoothstep(uR0, uR1, length(vW.xz - uC)));
  vec2 uv = (vW.xz - uC) / (2.0 * uExtent) + 0.5;
  float shelf = texture2D(uShelf, vec2(uv.x, 1.0 - uv.y)).g;
  // soft cast shadow of the land towards the south-east (light from the north-west)
  vec2 suv = (vW.xz - uC - vec2(7.0, 9.0)) / (2.0 * uExtent) + 0.5;
  float shadow = texture2D(uShelf, vec2(suv.x, 1.0 - suv.y)).r;
  vec3 c = mix(uDeep, uShelfCol, shelf * 0.6);
  c *= 1.0 - shadow * 0.45;
  gl_FragColor = vec4(c, max(a, a * shadow) * uMul * casaKeep(vW.xz));
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ shelf texture (blurred coastline glow), centred on MAP_CENTER
const SHELF_EXTENT = 300;
function shelfTexture() {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  g.translate(S / 2, S / 2);
  g.scale(S / (2 * SHELF_EXTENT), S / (2 * SHELF_EXTENT));
  g.translate(-MAP_CENTER.x, -MAP_CENTER.z);
  const path = geoPath(maProjection(), g);
  g.globalCompositeOperation = "lighter";
  const draw = (blur: number, alpha: number, color: string, withNeighbours: boolean) => {
    g.filter = `blur(${blur}px)`;
    g.globalAlpha = alpha;
    g.beginPath();
    path(GEO.morocco);
    if (withNeighbours) for (const f of GEO.neighbours.features) path(f);
    g.fillStyle = color;
    g.fill();
  };
  draw(30, 0.5, "#00ff00", true);
  draw(8, 0.5, "#00ff00", true);
  draw(10, 0.9, "#ff0000", false);
  g.filter = "none";
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

const uC = () => ({ value: C2.clone() });

// ------------------------------------------------------------------ components
export function MoroccoLand() {
  const { geom, outlines } = useMemo(() => {
    const { shapes, outlines } = shapesOf(GEO.morocco, undefined, 2);
    const geom = new THREE.ExtrudeGeometry(shapes, {
      depth: LAND_DEPTH, bevelEnabled: true, bevelThickness: LAND_BEVEL, bevelSize: LAND_BEVEL, bevelSegments: 2, curveSegments: 1,
    });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, LAND_BOTTOM + LAND_BEVEL, 0); // top face exactly at y = LAND_TOP (0)
    return { geom, outlines };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NORMAL_VERT,
        fragmentShader: TOP_FRAG,
        transparent: true,
        uniforms: {
          uBase: { value: new THREE.Color("#323F70") },
          uHi: { value: new THREE.Color("#3E4D86") },
          uDot: { value: new THREE.Color("#7486C4") },
          uSide: { value: new THREE.Color("#2A3564") },
          uBottom: { value: LAND_BOTTOM },
          uMul: { value: 1 },
          uC: uC(),
          ...holeUniforms(),
        },
      }),
    [],
  );
  const lineRefs = useRef<({ material: THREE.Material & { opacity: number } } | null)[]>([]);
  useFrame(() => {
    mat.uniforms.uCasa.value = CASA.v;
    for (const l of lineRefs.current) if (l) { l.material.userData.ownFade = true; l.material.opacity = 0.72 * GEO_FADE.map * (1 - CASA.v); }
  });
  return (
    <group>
      <mesh geometry={geom} material={mat} renderOrder={2} />
      {outlines.map((r, i) => (
        <Line
          ref={(l) => { lineRefs.current[i] = l as unknown as { material: THREE.Material & { opacity: number } } | null; }}
          key={i}
          points={r.map(([x, z]) => new THREE.Vector3(x, LAND_TOP + 0.03, z))}
          color="#C9D4FA"
          lineWidth={1.4}
          transparent
          opacity={0.72}
          toneMapped={false}
          renderOrder={3}
        />
      ))}
    </group>
  );
}

export function Neighbours() {
  const NEIGH_TOP = LAND_BOTTOM + 0.7;
  const { geom, outlines } = useMemo(() => {
    const shapes: THREE.Shape[] = [];
    const outlines: [number, number][][] = [];
    for (const f of GEO.neighbours.features) {
      const s = shapesOf(f, CLIP, 0.6);
      shapes.push(...s.shapes);
      outlines.push(...s.outlines);
    }
    const geom = new THREE.ExtrudeGeometry(shapes, { depth: 0.7, bevelEnabled: false, curveSegments: 1 });
    geom.rotateX(-Math.PI / 2);
    geom.translate(0, LAND_BOTTOM, 0);
    return { geom, outlines };
  }, []);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: NORMAL_VERT,
        fragmentShader: NEIGH_FRAG,
        transparent: true,
        uniforms: {
          uTop: { value: new THREE.Color("#1B2445") },
          uSide: { value: new THREE.Color("#10162C") },
          uR0: { value: FADE.r0 * 0.7 }, uR1: { value: FADE.r1 * 0.8 }, uOpacity: { value: 0.95 }, uMul: { value: 1 }, uC: uC(),
        },
      }),
    [],
  );
  const lineMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT, fragmentShader: FADE_FRAG, transparent: true, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color("#4A5A8E") }, uOpacity: { value: 0.2 }, uCenter: uC(), uR0: { value: FADE.r0 * 0.5 }, uR1: { value: FADE.r1 * 0.7 }, uMul: { value: 1 } },
      }),
    [],
  );
  const lineGeom = useMemo(() => {
    const seg: number[] = [];
    for (const r of outlines) for (let i = 0; i < r.length - 1; i++) seg.push(r[i][0], NEIGH_TOP + 0.02, r[i][1], r[i + 1][0], NEIGH_TOP + 0.02, r[i + 1][1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return g;
  }, [outlines, NEIGH_TOP]);
  return (
    <group>
      <mesh geometry={geom} material={mat} renderOrder={1} />
      <lineSegments geometry={lineGeom} material={lineMat} renderOrder={1} />
    </group>
  );
}

export function Ocean() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT, fragmentShader: OCEAN_FRAG, transparent: true, depthWrite: false,
        uniforms: {
          uDeep: { value: new THREE.Color("#070C1F") },
          uShelfCol: { value: new THREE.Color("#1A2856") },
          uShelf: { value: shelfTexture() },
          uExtent: { value: SHELF_EXTENT },
          uR0: { value: FADE.r0 }, uR1: { value: FADE.r1 }, uMul: { value: 1 }, uC: uC(),
          ...holeUniforms(),
        },
      }),
    [],
  );
  useFrame(() => { mat.uniforms.uCasa.value = CASA.v; gridMat.uniforms.uMul.value = GEO_FADE.map * (1 - CASA.v); });
  const oceanGeom = useMemo(() => new THREE.CircleGeometry(OCEAN_R, 96).rotateX(-Math.PI / 2).translate(MAP_CENTER.x, LAND_BOTTOM - 0.05, MAP_CENTER.z), []);
  const gridGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(graticuleSegments(2, [[-40, 0], [25, 55]]), 3));
    g.translate(0, LAND_BOTTOM + 0.02, 0);
    return g;
  }, []);
  const gridMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: WORLD_VERT, fragmentShader: FADE_FRAG, transparent: true, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color("#6F82C2") }, uOpacity: { value: 0.16 }, uCenter: uC(), uR0: { value: 90 }, uR1: { value: FADE.r1 * 0.85 }, uMul: { value: 1 } },
      }),
    [],
  );
  return (
    <group>
      <mesh geometry={oceanGeom} material={mat} renderOrder={0} />
      <lineSegments geometry={gridGeom} material={gridMat} renderOrder={0} />
    </group>
  );
}

const PLACE_LABELS: { t: string; lon: number; lat: number; kind: "sea" | "country" }[] = [
  { t: "Océan Atlantique", lon: -15.6, lat: 31.6, kind: "sea" },
  { t: "Méditerranée", lon: -1.6, lat: 36.75, kind: "sea" },
  { t: "Espagne", lon: -4.2, lat: 38.4, kind: "country" },
  { t: "Portugal", lon: -8.0, lat: 38.7, kind: "country" },
  { t: "Algérie", lon: 1.6, lat: 29.6, kind: "country" },
  { t: "Mauritanie", lon: -9.6, lat: 23.6, kind: "country" },
];

/** Quiet cartographic labels (seas, neighbours) — tracked, uppercase, very low contrast. Shown at map altitudes only. */
export function PlaceLabels({ visible, altKm }: { visible: boolean; altKm: { current: number } }) {
  const els = useRef<(HTMLDivElement | null)[]>([]);
  useFrame(() => {
    const a = altKm.current;
    const on = visible && a > 150 && a < 3200;
    const o = on ? String(Math.round(GEO_FADE.map * 100) / 100) : "0";
    for (const el of els.current) if (el && el.style.opacity !== o) el.style.opacity = o;
  });
  return (
    <group>
      {PLACE_LABELS.map((l, i) => {
        const [x, z] = toXZ(l.lon, l.lat);
        return (
          <GeoHtml key={l.t} position={[x, LAND_BOTTOM + 1, z]} center zIndex={2}>
            <div
              ref={(el) => { els.current[i] = el; }}
              style={{
                opacity: 0,
                transition: "opacity .6s",
                color: l.kind === "sea" ? "rgba(150,170,230,0.38)" : "rgba(190,200,225,0.32)",
                fontSize: l.kind === "sea" ? 12 : 11,
                fontStyle: l.kind === "sea" ? "italic" : "normal",
                letterSpacing: l.kind === "sea" ? "0.12em" : "0.32em",
                textTransform: l.kind === "sea" ? "none" : "uppercase",
                whiteSpace: "nowrap",
                fontWeight: 500,
                userSelect: "none",
              }}
            >
              {l.t}
            </div>
          </GeoHtml>
        );
      })}
    </group>
  );
}
