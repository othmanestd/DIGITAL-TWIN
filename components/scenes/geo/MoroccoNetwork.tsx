"use client";
// Akdital network on the Morocco map.
// • Every city = a small glowing beacon sized by its number of establishments (violet for the head office in Casablanca,
//   hollow amber rings for sites under construction / announced).
// • A light network mesh: every city linked to Casablanca (siège) and to its nearest neighbours, with soft "packets"
//   travelling both ways along the arcs.
// • All city names readable at the overview: compact chips placed around their beacon without overlap (hairline leader
//   when moved away); establishment names when zoomed on a city.
// • Everything fades out near the ground (≈ 40 → 15 km of altitude) so the hospital / virtual Casablanca stands clean.
// Beacons keep a readable size on screen; close cities (Rabat/Salé, Agadir/Inezgane…) are nudged apart with a leader.
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useApp } from "@/lib/store";
import { CITIES, SITES, HQ_CITY, type City, type Site } from "@/lib/geo/network";
import { toXZ } from "@/lib/geo/geometry";
import { LAND_TOP } from "./MoroccoBase";
import { GeoHtml } from "./GeoHtml";
import { C, glowTexture, labelCard, useAnchors, matcapTexture, GEO_FADE, applyOpacity, LOGDEPTH_FRAG, LOGDEPTH_FRAG_PARS, LOGDEPTH_VERT, LOGDEPTH_VERT_PARS } from "./shared";

// ------------------------------------------------------------------ constants
const S_MAX = 2.4; // beacon scale at the overview
const S_MIN = 0.08; // beacon scale near the ground (keeps a constant on-screen size when zooming in)
const S_DIV = 120; // camera distance (map units) / S_DIV = beacon scale (clamped)
const PIN_FADE_KM: [number, number] = [15, 40];
const HEAD_Y = 1.25; // head height (× size)
const LABEL_Y = 1.62; // label anchor height (× size)

export type CityNode = {
  city: City; isHQ: boolean; op: number; pipe: Site["status"][]; sz: number; sites: SiteNode[];
  truePos: THREE.Vector3; p1: THREE.Vector3; pMax: THREE.Vector3;
  /** live (per frame): current beacon base and scale */
  base: THREE.Vector3; s: number;
};
export type SiteNode = { site: Site; pos: THREE.Vector3; city: CityNode };
export type Edge = { a: CityNode; b: CityNode; hub: boolean; curve: THREE.QuadraticBezierCurve3; len: number };
/** Camera relative to the map, in MAP-LOCAL units (updated by MoroccoContent every frame). */
export type MapCam = { dist: number; altKm: number; focus: THREE.Vector3 };

// ------------------------------------------------------------------ layout (static data -> computed once)
function relax(nodes: { x: number; z: number; m: number; r: number }[], k: number, gap: number) {
  const p = nodes.map((n) => ({ ...n }));
  for (let it = 0; it < 140; it++) {
    let moved = false;
    for (let i = 0; i < p.length; i++)
      for (let j = i + 1; j < p.length; j++) {
        const a = p[i], b = p[j];
        const minSep = (a.r + b.r) * k + gap;
        let ex = b.x - a.x, ez = b.z - a.z;
        let d = Math.hypot(ex, ez);
        if (d >= minSep) continue;
        if (d < 1e-4) { ex = 1; ez = 0.3; d = Math.hypot(ex, ez); }
        const push = minSep - d;
        const wa = b.m / (a.m + b.m), wb = a.m / (a.m + b.m);
        a.x -= (ex / d) * push * wa; a.z -= (ez / d) * push * wa;
        b.x += (ex / d) * push * wb; b.z += (ez / d) * push * wb;
        moved = true;
      }
    if (!moved) break;
  }
  return p;
}

function buildLayout() {
  const cities: CityNode[] = [];
  const sites: SiteNode[] = [];
  for (const city of CITIES) {
    if (city.noCoords) continue;
    const [x, z] = toXZ(city.lon, city.lat);
    const list = SITES.filter((s) => s.citySlug === city.slug);
    const op = list.filter((s) => s.status === "opérationnel").length;
    const pipe = list.filter((s) => s.status !== "opérationnel").map((s) => s.status).sort();
    const sz = 0.78 + 0.3 * Math.sqrt(op + pipe.length * 0.5);
    const truePos = new THREE.Vector3(x, LAND_TOP, z);
    const node: CityNode = {
      city, isHQ: city.slug === HQ_CITY, op, pipe, sz, sites: [],
      truePos, p1: truePos.clone(), pMax: truePos.clone(), base: truePos.clone(), s: 1,
    };
    // establishment satellites: real offsets from the city centre, relaxed so they never overlap and orbit the beacon
    const located = list.filter((s) => !s.noCoords);
    const pts = located.map((s, i) => {
      const [sx, sz2] = toXZ(s.lon, s.lat);
      let dx = sx - x, dz = sz2 - z;
      if (Math.hypot(dx, dz) < 0.05) { const a = i * 2.39996 + 0.6; dx = Math.cos(a) * 0.1; dz = Math.sin(a) * 0.1; }
      return { dx, dz };
    });
    const MIN = 2.2, R0 = 2.6;
    for (let it = 0; it < 80; it++) {
      for (let i = 0; i < pts.length; i++)
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j];
          let ex = b.dx - a.dx, ez = b.dz - a.dz;
          let d = Math.hypot(ex, ez);
          if (d < 1e-4) { ex = Math.cos(j * 2.4); ez = Math.sin(j * 2.4); d = 1; }
          if (d < MIN) { const k = (MIN - d) / 2 / d; a.dx -= ex * k; a.dz -= ez * k; b.dx += ex * k; b.dz += ez * k; }
        }
      for (const p of pts) {
        const d = Math.hypot(p.dx, p.dz) || 1;
        if (d < R0) { p.dx *= R0 / d; p.dz *= R0 / d; }
      }
    }
    located.forEach((s, i) => {
      const sn: SiteNode = { site: s, pos: new THREE.Vector3(x + pts[i].dx, LAND_TOP, z + pts[i].dz), city: node };
      node.sites.push(sn);
      sites.push(sn);
    });
    cities.push(node);
  }
  // beacon positions without overlap: at scale 1 (zoomed in) and at the overview scale
  const seeds = cities.map((n) => ({ x: n.truePos.x, z: n.truePos.z, m: n.isHQ ? 1000 : 1 + n.op + n.pipe.length * 0.5, r: 0.5 * n.sz }));
  const r1 = relax(seeds, 1, 0.3);
  const rM = relax(seeds, S_MAX, 0.4);
  cities.forEach((n, i) => {
    n.p1.set(r1[i].x, LAND_TOP, r1[i].z);
    n.pMax.set(rM[i].x, LAND_TOP, rM[i].z);
    n.base.copy(n.p1);
  });
  // network mesh: every city ↔ Casablanca, plus each city ↔ its 2 nearest neighbours (deduplicated)
  const hq = cities.find((c) => c.isHQ);
  const keys = new Set<string>();
  const edges: Edge[] = [];
  const add = (a: CityNode, b: CityNode, hub: boolean) => {
    const key = [a.city.slug, b.city.slug].sort().join("|");
    if (keys.has(key) || a === b) return;
    keys.add(key);
    const A = a.truePos.clone().setY(LAND_TOP + 0.25), B = b.truePos.clone().setY(LAND_TOP + 0.25);
    const len = A.distanceTo(B);
    const mid = A.clone().lerp(B, 0.5).setY(LAND_TOP + Math.max(1.4, len * (hub ? 0.2 : 0.14)));
    edges.push({ a, b, hub, curve: new THREE.QuadraticBezierCurve3(A, mid, B), len });
  };
  if (hq) for (const c of cities) if (c !== hq) add(hq, c, true);
  for (const c of cities) {
    if (c === hq) continue;
    const near = cities.filter((o) => o !== c && o !== hq).sort((p, q) => p.truePos.distanceTo(c.truePos) - q.truePos.distanceTo(c.truePos)).slice(0, 2);
    for (const o of near) add(c, o, false);
  }
  return { cities, sites, edges };
}
export const LAYOUT = buildLayout();
export const cityNode = (slug: string) => LAYOUT.cities.find((c) => c.city.slug === slug);
export const siteNode = (slug: string) => LAYOUT.sites.find((s) => s.site.slug === slug);
/** Camera focus point for a city once zoomed in. */
export const cityFocus = (n: CityNode) => n.p1.clone().setY(LAND_TOP + n.sz * S_MIN * 0.8);

const fmt = (n: number) => n.toLocaleString("fr-FR");
const anchorOf = (n: CityNode, out = new THREE.Vector3()) => out.set(n.base.x, n.base.y + LABEL_Y * n.sz * n.s, n.base.z);
/** Fade shared by the self-animated materials and the labels (pins near the ground + content fade). */
const PINS = { v: 1 };

// ------------------------------------------------------------------ shaders
const NET_VERT = /* glsl */ `attribute float aT; attribute float aK; varying float vT; varying float vK;
${LOGDEPTH_VERT_PARS}
void main() { vT = aT; vK = aK; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
${LOGDEPTH_VERT}
}`;
const NET_FRAG = /* glsl */ `
uniform vec3 uHub; uniform vec3 uNear; uniform float uMul;
varying float vT; varying float vK;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  float ends = smoothstep(0.0, 0.08, vT) * smoothstep(1.0, 0.92, vT);
  vec3 c = mix(uNear, uHub, vK);
  gl_FragColor = vec4(c, mix(0.13, 0.24, vK) * ends * uMul);
  #include <colorspace_fragment>
}`;
const PKT_VERT = /* glsl */ `
attribute float aA; attribute float aS; attribute vec3 aC; varying float vA; varying vec3 vC; uniform float uPR;
${LOGDEPTH_VERT_PARS}
void main() { vA = aA; vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * uPR;
${LOGDEPTH_VERT}
}`;
const PKT_FRAG = /* glsl */ `
uniform float uMul; varying float vA; varying vec3 vC;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord - 0.5; float r2 = dot(c, c) * 4.0;
  float a = exp(-r2 * 6.0) * 0.95 + exp(-r2 * 1.8) * 0.25;
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.3 * exp(-r2 * 10.0)), a * vA * uMul);
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ geometries & materials
const stemGeo = new THREE.CylinderGeometry(0.045, 0.045, HEAD_Y, 10, 1).translate(0, HEAD_Y / 2, 0);
const headGeo = new THREE.SphereGeometry(0.3, 24, 16).translate(0, HEAD_Y, 0);
const headRingGeo = new THREE.TorusGeometry(0.27, 0.065, 10, 36).rotateX(Math.PI / 2).translate(0, HEAD_Y, 0);
const footGeo = new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2).translate(0, 0.03, 0);
const pipeRingGeo = new THREE.TorusGeometry(0.62, 0.05, 8, 48).rotateX(Math.PI / 2).translate(0, 0.05, 0);
const hitGeo = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
const satGeo = new THREE.SphereGeometry(0.2, 20, 12);
const satRingGeo = new THREE.RingGeometry(0.46, 0.54, 40).rotateX(-Math.PI / 2);
const pulseGeo = new THREE.RingGeometry(0.92, 1.0, 64).rotateX(-Math.PI / 2);
const dotGeo = new THREE.CircleGeometry(0.22, 20).rotateX(-Math.PI / 2);
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

type Mats = Record<"city" | "cityHot" | "hq" | "hqHot" | "amber" | "amberDim" | "stem" | "foot" | "footHq", THREE.Material>;
let _M: Mats | null = null;
const getM = (): Mats => {
  if (_M) return _M;
  const mc = (color: THREE.ColorRepresentation, opacity = 1) => new THREE.MeshMatcapMaterial({ color, matcap: matcapTexture(), transparent: true, opacity, toneMapped: false });
  const basic = (color: THREE.ColorRepresentation, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false });
  _M = {
    city: mc("#8EA3F6"), cityHot: mc("#C7D2FF"), hq: mc("#B1A4EE"), hqHot: mc("#DCD4FF"),
    amber: mc(C.amber, 0.95), amberDim: mc(C.amber, 0.5), stem: basic("#AEBBEA", 0.55), foot: basic("#DCE3FF", 0.9), footHq: basic("#E6E0FF", 0.95),
  };
  return _M;
};

function Glow({ color, size, opacity }: { color: string; size: number; opacity: number }) {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.04} renderOrder={4}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={glowTexture()} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  );
}

function HQPulse() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: C.violetLight, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    m.userData.ownFade = true;
    return m;
  }, []);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 4.5) / 4.5;
    const s = 0.5 + t * 2.6;
    ref.current?.scale.set(s, 1, s);
    mat.opacity = 0.45 * (1 - t) * Math.min(1, t * 6) * GEO_FADE.map * PINS.v;
  });
  return <mesh ref={ref} geometry={pulseGeo} material={mat} position-y={0.06} renderOrder={5} />;
}

/** One city: glowing foot, thin stem, matcap head (hollow amber head for project-only cities), amber ring for projects. */
function Beacon({ n, hot, selected, groupRef, onOver, onOut, onClick, onDbl }: {
  n: CityNode; hot: boolean; selected: boolean; groupRef: (g: THREE.Group | null) => void;
  onOver: () => void; onOut: () => void; onClick: () => void; onDbl: () => void;
}) {
  const M = getM();
  const lit = hot || selected;
  const hasOp = n.op > 0;
  const build = n.pipe.includes("en construction");
  return (
    <group ref={groupRef} position={n.base}>
      <group scale={n.sz}>
        <Glow color={hasOp ? (n.isHQ ? C.violet : C.blue) : C.amber} size={n.isHQ ? 4.6 : 3.4} opacity={lit ? 0.5 : n.isHQ ? 0.42 : hasOp ? 0.3 : 0.22} />
        <mesh geometry={footGeo} material={n.isHQ ? M.footHq : M.foot} />
        <mesh geometry={stemGeo} material={M.stem} />
        {hasOp ? (
          <mesh geometry={headGeo} material={n.isHQ ? (lit ? M.hqHot : M.hq) : lit ? M.cityHot : M.city} />
        ) : (
          <mesh geometry={headRingGeo} material={build ? M.amber : M.amberDim} />
        )}
        {n.pipe.length > 0 && <mesh geometry={pipeRingGeo} material={build ? M.amber : M.amberDim} />}
        {n.isHQ && <HQPulse />}
        {selected && (
          <mesh geometry={pulseGeo} position-y={0.07} scale={[0.95, 1, 0.95]} renderOrder={5}>
            <meshBasicMaterial color={C.blueLight} transparent opacity={0.7} depthWrite={false} toneMapped={false} />
          </mesh>
        )}
        <mesh
          geometry={hitGeo}
          material={hitMat}
          scale={[0.8, HEAD_Y + 0.7, 0.8]}
          position-y={(HEAD_Y + 0.7) / 2}
          onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onOver(); }}
          onPointerOut={() => onOut()}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }}
          onDoubleClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onDbl(); }}
        />
      </group>
    </group>
  );
}

/** Hairline from a nudged beacon to its true location (+ a small dot there). */
function Leaders() {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(LAYOUT.cities.length * 6), 3));
    return g;
  }, []);
  const dots = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const a = geo.attributes.position as THREE.BufferAttribute;
    LAYOUT.cities.forEach((n, i) => {
      const off = Math.hypot(n.base.x - n.truePos.x, n.base.z - n.truePos.z);
      const y = LAND_TOP + 0.05;
      if (off > 0.4) a.setXYZ(2 * i, n.truePos.x, y, n.truePos.z), a.setXYZ(2 * i + 1, n.base.x, y, n.base.z);
      else a.setXYZ(2 * i, 0, -50, 0), a.setXYZ(2 * i + 1, 0, -50, 0);
      const d = dots.current[i];
      if (d) { d.visible = off > 0.4; d.scale.setScalar(n.s); }
    });
    a.needsUpdate = true;
  });
  return (
    <group>
      <lineSegments geometry={geo} frustumCulled={false}>
        <lineBasicMaterial color="#AEBBEA" transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </lineSegments>
      {LAYOUT.cities.map((n, i) => (
        <mesh key={n.city.slug} ref={(m) => { dots.current[i] = m; }} geometry={dotGeo} position={[n.truePos.x, LAND_TOP + 0.06, n.truePos.z]}>
          <meshBasicMaterial color="#C9D3F7" transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/** The light network mesh + packets travelling both ways. */
function Network() {
  const dpr = useThree((s) => s.viewport.dpr);
  const lines = useMemo(() => {
    const pos: number[] = [], t: number[] = [], k: number[] = [];
    for (const e of LAYOUT.edges) {
      const N = Math.max(16, Math.round(e.len * 0.9));
      const pts = e.curve.getPoints(N);
      for (let i = 0; i < N; i++) {
        pos.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
        t.push(i / N, (i + 1) / N);
        k.push(e.hub ? 1 : 0, e.hub ? 1 : 0);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute("aK", new THREE.Float32BufferAttribute(k, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: NET_VERT, fragmentShader: NET_FRAG, transparent: true, depthWrite: false,
      uniforms: { uHub: { value: new THREE.Color("#93A6E6") }, uNear: { value: new THREE.Color("#7F8FC8") }, uMul: { value: 1 } },
    });
    return { g, m };
  }, []);
  const packets = useMemo(() => {
    // two packets per edge, one in each direction
    const list = LAYOUT.edges.flatMap((e, i) => [
      { e, dir: 1, phase: (i * 0.618) % 1, speed: THREE.MathUtils.clamp(5 / e.len, 0.035, 0.11) },
      { e, dir: -1, phase: (i * 0.618 + 0.5) % 1, speed: THREE.MathUtils.clamp(5 / e.len, 0.035, 0.11) },
    ]);
    const n = list.length;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(n), 1));
    const sizes = new Float32Array(n), col = new Float32Array(n * 3);
    const hubC = new THREE.Color("#E3E8FF"), nearC = new THREE.Color("#AFC0FF");
    list.forEach((p, i) => { sizes[i] = p.e.hub ? 6.5 : 5; const c = p.e.hub ? hubC : nearC; col.set([c.r, c.g, c.b], i * 3); });
    g.setAttribute("aS", new THREE.BufferAttribute(sizes, 1));
    g.setAttribute("aC", new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: PKT_VERT, fragmentShader: PKT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uPR: { value: 1 }, uMul: { value: 1 } },
    });
    return { list, g, m };
  }, []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    packets.m.uniforms.uPR.value = dpr;
    const pa = packets.g.attributes.position as THREE.BufferAttribute, aa = packets.g.attributes.aA as THREE.BufferAttribute;
    packets.list.forEach((p, i) => {
      const u0 = (t * p.speed + p.phase) % 1;
      const u = p.dir > 0 ? u0 : 1 - u0;
      p.e.curve.getPoint(u, tmp);
      pa.setXYZ(i, tmp.x, tmp.y + 0.05, tmp.z);
      const ends = Math.min(1, u0 / 0.08, (1 - u0) / 0.08);
      const blink = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.3);
      aa.setX(i, ends * blink * (p.e.hub ? 0.9 : 0.65));
    });
    pa.needsUpdate = true;
    aa.needsUpdate = true;
  });
  return (
    <group>
      <lineSegments geometry={lines.g} material={lines.m} frustumCulled={false} renderOrder={6} />
      <points geometry={packets.g} material={packets.m} frustumCulled={false} renderOrder={7} />
    </group>
  );
}

// ------------------------------------------------------------------ establishment labels (zoomed on a city): greedy culling
type LabelItem = { el: HTMLDivElement; pos: () => THREE.Vector3; pri: () => number; gap?: number };
function useSiteLabelCulling(items: RefObject<Map<string, LabelItem>>, toWorld: (v: THREE.Vector3) => THREE.Vector3) {
  const frame = useRef(0);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    if (frame.current++ % 3) return;
    const k = GEO_FADE.map * PINS.v;
    const op = String(Math.round(k * 100) / 100);
    const placed: [number, number, number, number][] = [];
    const list = [...items.current.values()].map((it) => ({ it, p: it.pri() })).sort((a, b) => b.p - a.p);
    for (const { it, p } of list) {
      toWorld(v.copy(it.pos())).project(camera);
      let show = k > 0.05 && p > 0 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      if (show) {
        const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
        const w = it.el.offsetWidth || 120, h = it.el.offsetHeight || 22, g = it.gap ?? 4;
        const r: [number, number, number, number] = [x - w / 2 - g, y - h - 8 - g, x + w / 2 + g, y - 8 + g];
        show = p >= 1000 || !placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        if (show) placed.push(r);
      }
      const o = show ? op : "0";
      if (it.el.style.opacity !== o) { it.el.style.opacity = o; it.el.style.pointerEvents = show ? "auto" : "none"; }
    }
  });
}

// ------------------------------------------------------------------ city chips (all cities, placed around the beacon)
type ChipLive = { el: HTMLDivElement | null; line: SVGLineElement | null; x: number; y: number; w: number; h: number; vis: boolean; cand: number };
const DIRS: [number, number][] = [[0, -1], [1, 0], [-1, 0], [0, 1], [0.75, -0.75], [-0.75, -0.75], [0.75, 0.75], [-0.75, 0.75]];
const DISTS = [5, 20, 38, 60, 88];

function CityChips({ chips, selCity, hoverCity, onHover }: { chips: Map<string, ChipLive>; selCity: string | null; hoverCity: string | null; onHover: (slug: string | null) => void }) {
  const select = useApp((s) => s.select);
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
        {LAYOUT.cities.map((n) => (
          <line key={n.city.slug} ref={(el) => { const c = chips.get(n.city.slug); if (c) c.line = el; }} stroke="rgba(200,212,255,0.4)" strokeWidth={1} x1={0} y1={0} x2={0} y2={0} />
        ))}
      </svg>
      {LAYOUT.cities.map((n) => {
        const slug = n.city.slug;
        const isSel = selCity === slug, isHot = hoverCity === slug;
        const pipeN = n.pipe.length;
        return (
          <div
            key={slug}
            ref={(el) => { const c = chips.get(slug); if (c) c.el = el; }}
            onMouseEnter={() => onHover(slug)}
            onMouseLeave={() => onHover(null)}
            style={{ position: "absolute", left: 0, top: 0, opacity: 0, transition: "opacity .25s" }}
          >
            <div
              onClick={() => select({ kind: "city", id: slug })}
              onDoubleClick={() => useApp.getState().setLevel("hospital")}
              style={{
                ...labelCard, borderRadius: 999, padding: "2px 7px 2px 6px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, lineHeight: 1.3,
                border: isSel || isHot ? "1px solid rgba(155,175,255,0.6)" : labelCard.border,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 6, flex: "none", background: n.isHQ ? C.violet : n.op ? C.blueSoft : "transparent", border: n.op ? "none" : `1.5px solid ${C.amber}` }} />
              {n.city.name}
              {n.op > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: n.isHQ ? "#EAE5FF" : "#E3E8FF", background: n.isHQ ? "rgba(155,140,224,0.32)" : "rgba(125,149,255,0.26)", borderRadius: 7, padding: "0 5px", lineHeight: "15px" }}>
                  {n.op}
                </span>
              )}
            </div>
            {(isSel || isHot) && (
              <div style={{ ...labelCard, marginTop: 5, padding: "8px 10px 9px", fontSize: 11.5, color: C.txt, whiteSpace: "normal", width: 240, pointerEvents: "auto" }}>
                <div style={{ color: C.mut }}>
                  {n.city.region}{n.isHQ ? " · Siège du groupe" : ""}
                </div>
                <div style={{ marginTop: 3 }}>
                  {n.op ? `${n.op} en service` : ""}
                  {pipeN ? `${n.op ? " · " : ""}${pipeN} en projet` : ""}
                  {n.city.beds ? ` · ${fmt(n.city.beds)} lits${(n.city.bedsKnownFor ?? n.op) < n.op ? "*" : ""}` : ""}
                </div>
                {n.sites.slice(0, 5).map((s) => (
                  <div key={s.site.slug} style={{ display: "flex", gap: 6, alignItems: "baseline", opacity: 0.86, lineHeight: 1.45 }}>
                    <span style={{ width: 5, height: 5, borderRadius: 5, flex: "none", background: s.site.status === "opérationnel" ? C.blueSoft : C.amber, transform: "translateY(-1px)" }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.site.name}</span>
                  </div>
                ))}
                {n.sites.length > 5 && <div style={{ color: C.mut }}>+ {n.sites.length - 5} autres</div>}
                {isSel ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); useApp.getState().setLevel("hospital"); }}
                    style={{
                      marginTop: 7, width: "100%", padding: "5px 10px", borderRadius: 8, border: "1px solid rgba(155,175,255,0.4)",
                      background: "linear-gradient(180deg, rgba(91,124,255,0.32), rgba(91,124,255,0.18))", color: "#fff",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Entrer dans l’hôpital →
                  </button>
                ) : (
                  <div style={{ color: C.mut, marginTop: 5, fontSize: 10.5 }}>Cliquer pour explorer · double-clic : entrer dans l’hôpital</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ main layer
export default function MoroccoNetwork({ activeCity, cam, root }: { activeCity: string | null; cam: RefObject<MapCam>; root: RefObject<THREE.Group | null> }) {
  const sel = useApp((s) => s.sel);
  const select = useApp((s) => s.select);
  const setHoverStore = useApp((s) => s.setHover);
  const [hover, setHover] = useState<{ kind: "city" | "site"; id: string } | null>(null);
  const siteLabels = useRef(new Map<string, LabelItem>());
  const groups = useRef(new Map<string, THREE.Group>());
  const net = useRef<THREE.Group>(null);
  const lastK = useRef(-1);
  const sNow = useRef(1);

  const selCity = sel?.kind === "city" ? sel.id : sel?.kind === "site" ? siteNode(sel.id)?.city.city.slug ?? null : null;
  const selSite = sel?.kind === "site" ? sel.id : null;
  const hoverCity = hover?.kind === "city" ? hover.id : null;

  useEffect(() => () => { document.body.style.cursor = ""; }, []);
  const over = (h: { kind: "city" | "site"; id: string }) => { setHover(h); setHoverStore(`${h.kind}:${h.id}`); document.body.style.cursor = "pointer"; };
  const out = () => { setHover(null); setHoverStore(null); document.body.style.cursor = ""; };
  const toWorld = useMemo(() => (v: THREE.Vector3) => (root.current ? root.current.localToWorld(v) : v), [root]);

  // live beacon scale, de-overlap interpolation, pins fade
  useFrame(() => {
    const pins = THREE.MathUtils.smoothstep(cam.current.altKm, PIN_FADE_KM[0], PIN_FADE_KM[1]);
    PINS.v = pins;
    const kk = GEO_FADE.map * pins;
    const ng = net.current;
    if (ng && Math.abs(kk - lastK.current) > 0.003) { applyOpacity(ng, kk); lastK.current = kk; ng.visible = kk > 0.004; }
    const target = THREE.MathUtils.clamp(cam.current.dist / S_DIV, S_MIN, S_MAX);
    sNow.current += (target - sNow.current) * 0.15;
    const s = sNow.current, k = THREE.MathUtils.clamp((s - 1) / (S_MAX - 1), 0, 1);
    for (const n of LAYOUT.cities) {
      n.s = s;
      n.base.lerpVectors(n.p1, n.pMax, k);
      const g = groups.current.get(n.city.slug);
      if (g) { g.position.copy(n.base); g.scale.setScalar(s); }
    }
  });

  // city chips: all cities, priority placement around the beacon, leader when moved away
  const chips = useMemo(() => {
    const m = new Map<string, ChipLive>();
    for (const n of LAYOUT.cities) m.set(n.city.slug, { el: null, line: null, x: 0, y: 0, w: 0, h: 0, vis: false, cand: 0 });
    return m;
  }, []);
  const live = useRef({ selCity, hoverCity });
  live.current = { selCity, hoverCity };
  const fN = useRef(0);
  const T = useMemo(() => ({ v: new THREE.Vector3() }), []);
  useFrame(({ camera, size }) => {
    if (fN.current++ % 2) return;
    const alt = cam.current.altKm;
    const k = GEO_FADE.map * PINS.v * (alt < 3200 ? 1 : 0);
    const op = String(Math.round(k * 100) / 100);
    // screen positions of every beacon head (obstacles + anchors)
    const pts = new Map<string, [number, number, boolean]>();
    for (const n of LAYOUT.cities) {
      toWorld(anchorOf(n, T.v)).project(camera);
      pts.set(n.city.slug, [((T.v.x + 1) / 2) * size.width, ((1 - T.v.y) / 2) * size.height, T.v.z < 1 && Math.abs(T.v.x) < 1.1 && Math.abs(T.v.y) < 1.1]);
    }
    const L = live.current;
    const pri = (n: CityNode) => (L.selCity === n.city.slug ? 3000 : L.hoverCity === n.city.slug ? 2000 : (n.isHQ ? 500 : 0) + n.op * 10 + n.pipe.length * 3 + 1);
    const order = [...LAYOUT.cities].sort((a, b) => pri(b) - pri(a));
    const placed: [number, number, number, number][] = [];
    // beacon heads are obstacles too (a label never sits on another city's beacon)
    const heads: [number, number, number, number][] = [...pts.entries()].filter(([, p]) => p[2]).map(([, p]) => [p[0] - 6, p[1] - 6, p[0] + 6, p[1] + 6]);
    for (const n of order) {
      const c = chips.get(n.city.slug)!;
      if (!c.el) continue;
      const [ax, ay, inView] = pts.get(n.city.slug)!;
      let vis = k > 0.05 && inView;
      if (vis) {
        const w = c.el.offsetWidth || 90, h = c.el.offsetHeight || 20;
        const hit = (r: [number, number, number, number]) =>
          placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) ||
          heads.some((q) => !(Math.abs((q[0] + q[2]) / 2 - ax) < 1 && Math.abs((q[1] + q[3]) / 2 - ay) < 1) && r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]);
        const rectAt = (ci: number): [number, number, number, number] => {
          const dist = DISTS[Math.floor(ci / DIRS.length)], [dx, dy] = DIRS[ci % DIRS.length];
          const x = dx === 0 ? ax : ax + Math.sign(dx) * (Math.abs(dx) * dist + w / 2 + 4);
          const y = dy === 0 ? ay : ay + Math.sign(dy) * (Math.abs(dy) * dist + h / 2 + 3);
          return [x - w / 2 - 3, y - h / 2 - 2, x + w / 2 + 3, y + h / 2 + 2];
        };
        const total = DIRS.length * DISTS.length;
        let chosen = -1;
        if (c.cand < total && !hit(rectAt(c.cand))) chosen = c.cand; // keep the previous slot when still free (no jitter)
        else for (let ci = 0; ci < total; ci++) if (!hit(rectAt(ci))) { chosen = ci; break; }
        if (chosen < 0 && pri(n) >= 2000) chosen = 0;
        if (chosen < 0) vis = false;
        else {
          const r = rectAt(chosen);
          placed.push(r);
          c.cand = chosen;
          c.x = r[0] + 3; c.y = r[1] + 2; c.w = w; c.h = h;
        }
      }
      c.vis = vis;
      const o = vis ? op : "0";
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
      if (c.el.style.opacity !== o) { c.el.style.opacity = o; c.el.style.pointerEvents = vis ? "auto" : "none"; }
      if (c.line) {
        const far = vis && Math.floor(c.cand / DIRS.length) > 0;
        const ex = Math.max(c.x, Math.min(ax, c.x + c.w)), ey = Math.max(c.y, Math.min(ay, c.y + c.h));
        c.line.setAttribute("x1", ax.toFixed(1)); c.line.setAttribute("y1", ay.toFixed(1));
        c.line.setAttribute("x2", ex.toFixed(1)); c.line.setAttribute("y2", ey.toFixed(1));
        c.line.style.opacity = far ? op : "0";
      }
    }
  });

  useSiteLabelCulling(siteLabels, toWorld);

  // anchors (world space)
  const anchorEntries = useMemo(
    () => [
      ...LAYOUT.cities.map((n) => ({ id: `city:${n.city.slug}`, point: () => toWorld(anchorOf(n)), visible: () => GEO_FADE.map * PINS.v > 0.3 })),
      ...LAYOUT.sites.map((s) => ({ id: `site:${s.site.slug}`, point: () => toWorld(s.pos.clone().setY(s.pos.y + 0.55)), visible: () => GEO_FADE.map * PINS.v > 0.3 })),
    ],
    [toWorld],
  );
  useAnchors(anchorEntries);

  // satellites fade in when the camera is close to a city
  const satGroup = useRef<THREE.Group>(null);
  const satItems = useRef(new Map<string, THREE.Group>());
  const satOpacity = useRef(0);
  const satMats = useMemo(() => {
    const o = {
      op: new THREE.MeshBasicMaterial({ color: "#C3CDF5", transparent: true, opacity: 0, toneMapped: false }),
      build: new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0, toneMapped: false }),
      ring: new THREE.MeshBasicMaterial({ color: C.blueLight, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      ringBuild: new THREE.MeshBasicMaterial({ color: C.amber, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    };
    for (const m of Object.values(o)) m.userData.ownFade = true;
    return o;
  }, []);
  useFrame(() => {
    const target = activeCity ? 1 : 0;
    satOpacity.current += (target - satOpacity.current) * 0.08;
    const o = satOpacity.current * GEO_FADE.map * PINS.v;
    satMats.op.opacity = o; satMats.build.opacity = o * 0.95; satMats.ring.opacity = o * 0.55; satMats.ringBuild.opacity = o * 0.55;
    if (satGroup.current) satGroup.current.visible = o > 0.02;
    // establishments keep a roughly constant on-screen size
    const ss = THREE.MathUtils.clamp(cam.current.dist / 50, 0.1, 1);
    for (const g of satItems.current.values()) g.scale.setScalar(ss);
  });

  const hoveredSite = hover?.kind === "site" ? siteNode(hover.id) : null;

  return (
    <group ref={net} userData={{ skipFade: true }}>
      <Network />
      <Leaders />
      {LAYOUT.cities.map((n) => (
        <Beacon
          key={n.city.slug}
          n={n}
          groupRef={(g) => { if (g) groups.current.set(n.city.slug, g); else groups.current.delete(n.city.slug); }}
          hot={hoverCity === n.city.slug}
          selected={selCity === n.city.slug}
          onOver={() => over({ kind: "city", id: n.city.slug })}
          onOut={out}
          onClick={() => select({ kind: "city", id: n.city.slug })}
          onDbl={() => useApp.getState().setLevel("hospital")}
        />
      ))}

      {/* all city chips in one overlay */}
      <GeoHtml fullscreen zIndex={6}>
        <CityChips chips={chips} selCity={selCity} hoverCity={hoverCity} onHover={(slug) => setHover(slug ? { kind: "city", id: slug } : null)} />
      </GeoHtml>

      {/* establishment satellites (visible when zoomed onto a city) */}
      <group ref={satGroup}>
        {LAYOUT.sites.filter((s) => s.city.city.slug === activeCity || s.city.city.slug === selCity).map((s) => {
          const opn = s.site.status === "opérationnel";
          const isSel = selSite === s.site.slug, isHot = hover?.kind === "site" && hover.id === s.site.slug;
          const near = activeCity === s.city.city.slug;
          return (
            <group key={s.site.slug} position={s.pos} ref={(g) => { if (g) satItems.current.set(s.site.slug, g); else satItems.current.delete(s.site.slug); }}>
              <mesh geometry={satGeo} material={opn ? satMats.op : satMats.build} position-y={0.55} scale={isSel || isHot ? 1.5 : 1} />
              <mesh geometry={satRingGeo} material={opn ? satMats.ring : satMats.ringBuild} position-y={0.06} scale={isSel ? 1.6 : 1} />
              {near && (
                <mesh
                  geometry={hitGeo}
                  material={hitMat}
                  scale={[0.9, 3, 0.9]}
                  position-y={1.2}
                  onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); over({ kind: "site", id: s.site.slug }); }}
                  onPointerOut={out}
                  onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); select({ kind: "site", id: s.site.slug }); }}
                  onDoubleClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useApp.getState().setLevel("hospital"); }}
                />
              )}
            </group>
          );
        })}
      </group>

      {/* establishment labels — only around the city the camera is on */}
      {LAYOUT.sites
        .filter((s) => s.city.city.slug === activeCity)
        .map((s) => {
          const slug = s.site.slug;
          const opn = s.site.status === "opérationnel";
          const p = new THREE.Vector3(s.pos.x, s.pos.y + 1.1, s.pos.z);
          return (
            <GeoHtml key={slug} position={p} zIndex={6}>
              <div
                ref={(el) => {
                  if (el)
                    siteLabels.current.set(slug, {
                      el, pos: () => p, gap: 3,
                      pri: () => (selSite === slug ? 1900 : hover?.kind === "site" && hover.id === slug ? 1400 : 100 + (opn ? 20 : 0) + (s.site.beds ?? 0) / 100),
                    });
                  else siteLabels.current.delete(slug);
                }}
                style={{ transform: "translate(-50%, calc(-100% - 7px))", opacity: 0, transition: "opacity .3s ease" }}
              >
                <div
                  onClick={() => select({ kind: "site", id: slug })}
                  style={{
                    ...labelCard, padding: "2px 8px 3px", cursor: "pointer", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                    maxWidth: 210, overflow: "hidden", textOverflow: "ellipsis", color: opn ? C.txt : C.amber,
                    border: selSite === slug ? "1px solid rgba(155,175,255,0.6)" : labelCard.border,
                  }}
                >
                  {s.site.name}
                </div>
                {selSite === slug && (
                  <button
                    onClick={(e) => { e.stopPropagation(); useApp.getState().setLevel("hospital"); }}
                    style={{
                      ...labelCard, display: "block", margin: "5px auto 0", padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600,
                      cursor: "pointer", background: "linear-gradient(180deg, rgba(91,124,255,0.34), rgba(91,124,255,0.2))", border: "1px solid rgba(155,175,255,0.45)",
                    }}
                  >
                    Entrer dans l’hôpital →
                  </button>
                )}
              </div>
            </GeoHtml>
          );
        })}

      {hoveredSite && hoveredSite.site.slug !== selSite && (
        <GeoHtml position={[hoveredSite.pos.x, hoveredSite.pos.y + 0.8, hoveredSite.pos.z]} zIndex={8}>
          <div style={{ ...labelCard, transform: "translate(16px, -50%)", padding: "9px 12px", maxWidth: 300, whiteSpace: "normal" }}>
            <div style={{ fontSize: 13.5, fontWeight: 650 }}>{hoveredSite.site.name}</div>
            <div style={{ fontSize: 11.5, color: C.mut }}>{[hoveredSite.site.brand, hoveredSite.site.type].filter(Boolean).join(" · ")}</div>
            {hoveredSite.site.premium === true && <div style={{ fontSize: 11, color: C.violetLight, marginTop: 3 }}>Format « Prime » · positionnement premium</div>}
            <div style={{ fontSize: 12, marginTop: 5, color: hoveredSite.site.status === "opérationnel" ? C.txt : C.amber }}>
              {hoveredSite.site.status}
              {hoveredSite.site.beds ? ` · ${fmt(hoveredSite.site.beds)} lits` : ""}
              {hoveredSite.site.opening_year ? ` · ${hoveredSite.site.status === "opérationnel" ? "depuis " : ""}${hoveredSite.site.opening_year}` : ""}
            </div>
          </div>
        </GeoHtml>
      )}
    </group>
  );
}
