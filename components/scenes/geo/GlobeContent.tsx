"use client";
// GlobeContent — the world globe as pure content (no camera controls, no lights, no auto-rotation).
// A calm dotted globe of radius GLOBE_RADIUS centred at the local origin. Morocco (ONE country, southern provinces
// included) is the hub: same fine dot grid as the rest of the land, a subtle fill + hairline outline, a gentle pulse on
// Casablanca. Arcs to the international projects listed by the research (never invented) carry slow "data packets".
// Labels are compact chips placed OUTSIDE the globe's silhouette with a hairline leader; details on hover.
// `opacity` multiplies every material (map <-> globe fade).
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { geoEquirectangular, geoPath, geoContains } from "d3-geo";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import { frame, fadeIn } from "@/lib/world";
import { registerAnchor } from "@/lib/anchors";
import { GEO, toSphere } from "@/lib/geo/geometry";
import { GLOBE_RADIUS, globePoint, CASA_LONLAT } from "@/lib/geo/projection";
import { CITIES, INTERNATIONAL, GROUP, HQ_CITY, type Intl, type IntlStatus } from "@/lib/geo/network";
import { GeoHtml } from "./GeoHtml";
import { C, glowTexture, labelCard, applyOpacity, GEO_FADE, LOGDEPTH_FRAG, LOGDEPTH_FRAG_PARS, LOGDEPTH_VERT, LOGDEPTH_VERT_PARS } from "./shared";

export { GLOBE_RADIUS, globePoint };

const R = GLOBE_RADIUS;
const HQ_LL: [number, number] = (() => {
  const c = CITIES.find((x) => x.slug === HQ_CITY && !x.noCoords);
  return c ? [c.lon, c.lat] : CASA_LONLAT;
})();
const INTL = INTERNATIONAL.filter((x) => !x.noCoords);
/** Look-at for the wide world view: centred between Morocco and the Gulf (or on Morocco alone if nothing abroad). */
export const GLOBE_VIEW_LONLAT: [number, number] = INTL.length ? [20, 28] : [-6, 28];

// ------------------------------------------------------------------ international: statuses, destinations, countries
const RANK: Record<IntlStatus, number> = { "opérationnel": 0, "en construction": 1, "projet annoncé": 2, incertain: 3 };
const ST: Record<IntlStatus, { label: string; color: string; solid: boolean }> = {
  "opérationnel": { label: "en service", color: "#B9C6FF", solid: true },
  "en construction": { label: "en construction", color: "#E2B05A", solid: true },
  "projet annoncé": { label: "projet annoncé", color: "#C9A86E", solid: false },
  incertain: { label: "incertain", color: "#8D97B0", solid: false },
};
const stOf = (x: Intl): IntlStatus => x.statusKey ?? "projet annoncé";
const shortName = (x: Intl) => x.project.split(/\s\(|,|:|«/)[0].trim();
type Dest = { key: string; lon: number; lat: number; items: Intl[]; best: IntlStatus; iso: string };
const DESTS: Dest[] = (() => {
  const m = new Map<string, Dest>();
  for (const x of INTL) {
    const key = `${x.lat.toFixed(3)},${x.lon.toFixed(3)}`;
    const d = m.get(key) ?? { key, lon: x.lon, lat: x.lat, items: [], best: "incertain" as IntlStatus, iso: x.iso };
    d.items.push(x);
    if (RANK[stOf(x)] < RANK[d.best]) d.best = stOf(x);
    m.set(key, d);
  }
  return [...m.values()];
})();
type Country = { iso: string; name: string; items: Intl[]; anchor: Dest };
const COUNTRIES: Country[] = (() => {
  const m = new Map<string, Country>();
  for (const d of DESTS) {
    const iso = d.iso || d.items[0].country;
    const c = m.get(iso) ?? { iso, name: d.items[0].country, items: [], anchor: d };
    c.items.push(...d.items);
    if (RANK[d.best] < RANK[c.anchor.best]) c.anchor = d;
    m.set(iso, c);
  }
  for (const c of m.values()) c.items.sort((a, b) => RANK[stOf(a)] - RANK[stOf(b)]);
  return [...m.values()];
})();
const fmt = (n: number) => n.toLocaleString("fr-FR");
const countsOf = (items: Intl[]) =>
  (Object.keys(RANK) as IntlStatus[]).map((k) => [k, items.filter((x) => stOf(x) === k).length] as const).filter(([, n]) => n > 0);

// ------------------------------------------------------------------ land dots (Fibonacci sphere, sampled on a land mask)
const DOT_R = R + 0.12;
function buildDots() {
  const W = 2048, H = 1024;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d", { willReadFrequently: true })!;
  const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
  const path = geoPath(proj, g);
  g.fillStyle = "#00ff00";
  g.beginPath(); path(GEO.land); g.fill();
  g.fillStyle = "#ff0000";
  g.beginPath(); path(GEO.morocco); g.fill();
  const px = g.getImageData(0, 0, W, H).data;
  const at = (xi: number, yi: number) => (Math.min(H - 1, Math.max(0, yi)) * W + ((xi + W) % W)) * 4;
  const N = 52000;
  const land: number[] = [], ma: number[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const lat = Math.asin(y) * (180 / Math.PI);
    const lon = ((((i * golden) * 180) / Math.PI) % 360) - 180;
    const xi = Math.floor(((lon + 180) / 360) * W), yi = Math.floor(((90 - lat) / 180) * H);
    const k = at(xi, yi);
    if (px[k] > 128) {
      // Morocco: keep only dots fully inside the border (no dot overflowing the coast / corners)
      const inside = [[-1, 0], [1, 0], [0, -1], [0, 1]].every(([dx, dy]) => px[at(xi + dx, yi + dy)] > 128);
      if (inside) ma.push(lon, lat);
    } else if (px[k + 1] > 128) land.push(lon, lat);
  }
  return { land, ma };
}

function DotLayer({ lonlat, size, color, opacity }: { lonlat: number[]; size: number; color: string; opacity: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = lonlat.length / 2;
  const geo = useMemo(() => new THREE.CircleGeometry(size, 10), [size]);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }), [color, opacity]);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      toSphere(lonlat[2 * i], lonlat[2 * i + 1], DOT_R, p); // every layer on the SAME radius: no parallax offset
      o.position.copy(p);
      o.lookAt(p.clone().multiplyScalar(2));
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  }, [lonlat, count]);
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} renderOrder={2} />;
}

// ------------------------------------------------------------------ Morocco fill (crisp, on a sphere patch just above the ocean)
const BB = { lon0: -19, lon1: 1, lat0: 19, lat1: 39 };
function moroccoFill() {
  const S = 1024;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  const k = S / (((BB.lon1 - BB.lon0) * Math.PI) / 180);
  const proj = geoEquirectangular().scale(k).translate([(-BB.lon0 * Math.PI / 180) * k, (BB.lat1 * Math.PI / 180) * k]);
  const path = geoPath(proj, g);
  g.fillStyle = "rgba(120,144,250,0.30)";
  g.beginPath(); path(GEO.morocco); g.fill();
  g.strokeStyle = "rgba(205,215,255,0.9)";
  g.lineWidth = 2.2;
  g.lineJoin = "round";
  g.beginPath(); path(GEO.morocco); g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const rad = (d: number) => (d * Math.PI) / 180;

// ------------------------------------------------------------------ shaders
const OCEAN_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vV;
${LOGDEPTH_VERT_PARS}
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  ${LOGDEPTH_VERT}
}`;
const OCEAN_FRAG = /* glsl */ `
uniform vec3 uDeep; uniform vec3 uLit; uniform vec3 uRim; uniform float uMul;
varying vec3 vN; varying vec3 vV;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  float l = clamp(dot(vN, normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0);
  float f = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.6);
  vec3 c = mix(uDeep, uLit, l * 0.55) + uRim * f * 0.55;
  gl_FragColor = vec4(c, uMul);
  #include <colorspace_fragment>
}`;
const ATMO_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uMul;
varying vec3 vN; varying vec3 vV;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  // back faces of a slightly larger sphere: strongest just outside the globe's edge, fading outwards
  float x = clamp(-dot(vN, vV) / 0.41, 0.0, 1.0);
  gl_FragColor = vec4(uColor, pow(x, 3.2) * 0.38 * uMul);
  #include <colorspace_fragment>
}`;
const ARC_VERT = /* glsl */ `varying float vT;
${LOGDEPTH_VERT_PARS}
void main() { vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
${LOGDEPTH_VERT}
}`;
const ARC_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uSolid; uniform float uDashes; uniform float uBase; uniform float uMul;
varying float vT;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  float ends = smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.95, vT);
  if (uSolid < 0.5 && fract(vT * uDashes) > 0.5) discard;
  gl_FragColor = vec4(uColor, uBase * ends * uMul);
  #include <colorspace_fragment>
}`;
// data packets: soft round points travelling along the arcs
const PKT_VERT = /* glsl */ `
attribute float aA; attribute vec3 aC; varying float vA; varying vec3 vC; uniform float uSize; uniform float uPR;
${LOGDEPTH_VERT_PARS}
void main() { vA = aA; vC = aC; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * uPR;
${LOGDEPTH_VERT}
}`;
const PKT_FRAG = /* glsl */ `
uniform float uMul; varying float vA; varying vec3 vC;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  vec2 c = gl_PointCoord - 0.5; float r2 = dot(c, c) * 4.0;
  float a = exp(-r2 * 6.0) * 0.95 + exp(-r2 * 1.8) * 0.3;
  gl_FragColor = vec4(mix(vC, vec3(1.0), 0.35 * exp(-r2 * 10.0)), a * vA * uMul);
  #include <colorspace_fragment>
}`;

function HubPulse({ pos }: { pos: THREE.Vector3 }) {
  const ring = useRef<THREE.Mesh>(null);
  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: C.violetLight, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    m.userData.ownFade = true;
    return m;
  }, []);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime % 3.6) / 3.6;
    const s = 0.5 + t * 4.5;
    ring.current?.scale.set(s, s, s);
    mat.opacity = 0.5 * (1 - t) * Math.min(1, t * 8) * GEO_FADE.globe;
  });
  return (
    <group position={pos} quaternion={q}>
      <mesh ref={ring} material={mat} position-z={0.2}>
        <ringGeometry args={[0.9, 1.0, 64]} />
      </mesh>
      <mesh position-z={0.25}>
        <circleGeometry args={[0.6, 32]} />
        <meshBasicMaterial color="#EEF1FF" transparent toneMapped={false} />
      </mesh>
      <mesh position-z={0.18}>
        <planeGeometry args={[7, 7]} />
        <meshBasicMaterial map={glowTexture()} color={C.violet} transparent opacity={0.45} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </group>
  );
}

function IntlLayer() {
  const dpr = useThree((s) => s.viewport.dpr);
  const arcs = useMemo(() => {
    const a = toSphere(HQ_LL[0], HQ_LL[1], 1);
    return DESTS.map((dst, i) => {
      const b = toSphere(dst.lon, dst.lat, 1);
      const ang = a.angleTo(b);
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 72; k++) {
        const t = k / 72;
        const p = a.clone().multiplyScalar(Math.sin((1 - t) * ang) / Math.sin(ang)).add(b.clone().multiplyScalar(Math.sin(t * ang) / Math.sin(ang)));
        pts.push(p.normalize().multiplyScalar(R + 0.5 + Math.sin(Math.PI * t) * ang * 24));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const st = ST[dst.best];
      const geo = new THREE.TubeGeometry(curve, 120, st.solid ? 0.16 : 0.13, 6, false);
      const mat = new THREE.ShaderMaterial({
        vertexShader: ARC_VERT, fragmentShader: ARC_FRAG, transparent: true, depthWrite: false,
        uniforms: {
          uColor: { value: new THREE.Color(st.color) }, uSolid: { value: st.solid ? 1 : 0 },
          uDashes: { value: Math.max(10, Math.round(ang * 46)) }, uBase: { value: st.solid ? 0.38 : 0.45 }, uMul: { value: 1 },
        },
      });
      // packets: 3 per solid arc, 1 per dashed arc; speed ~ constant on the ground
      const n = st.solid ? 3 : 1;
      const speed = 0.028 / Math.max(0.25, ang);
      return { geo, mat, curve, key: dst.key, n, speed: Math.min(0.09, speed), phase: (i * 0.37) % 1, color: new THREE.Color(st.solid ? (dst.best === "opérationnel" ? "#DCE3FF" : "#F0CB87") : "#AEB6CC"), dim: st.solid ? 1 : 0.55 };
    });
  }, []);
  const packets = useMemo(() => {
    const total = arcs.reduce((a, b) => a + b.n, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    g.setAttribute("aA", new THREE.BufferAttribute(new Float32Array(total), 1));
    const col = new Float32Array(total * 3);
    let k = 0;
    for (const a of arcs) for (let j = 0; j < a.n; j++, k++) col.set([a.color.r, a.color.g, a.color.b], k * 3);
    g.setAttribute("aC", new THREE.BufferAttribute(col, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: PKT_VERT, fragmentShader: PKT_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSize: { value: 7 }, uPR: { value: 1 }, uMul: { value: 1 } },
    });
    return { g, m };
  }, [arcs]);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    packets.m.uniforms.uPR.value = dpr;
    const pa = packets.g.attributes.position as THREE.BufferAttribute, aa = packets.g.attributes.aA as THREE.BufferAttribute;
    let k = 0;
    for (const a of arcs)
      for (let j = 0; j < a.n; j++, k++) {
        const u = (t * a.speed + a.phase + j / a.n) % 1;
        a.curve.getPoint(u, tmp);
        pa.setXYZ(k, tmp.x, tmp.y, tmp.z);
        const ends = Math.min(1, u / 0.06, (1 - u) / 0.06);
        const blink = 0.62 + 0.38 * Math.sin(t * 2.4 + k * 1.7); // soft pulse, like data being sent
        aa.setX(k, ends * blink * a.dim);
      }
    pa.needsUpdate = true;
    aa.needsUpdate = true;
  });
  return (
    <>
      {arcs.map((a) => <mesh key={a.key} geometry={a.geo} material={a.mat} renderOrder={4} />)}
      <points geometry={packets.g} material={packets.m} frustumCulled={false} renderOrder={5} />
      {DESTS.map((d) => <DestMarker key={d.key} d={d} />)}
    </>
  );
}

/** Destination marker: filled dot when in service, ring otherwise (muted status colours). */
function DestMarker({ d }: { d: Dest }) {
  const p = useMemo(() => toSphere(d.lon, d.lat, R + 0.3), [d]);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), p.clone().normalize()), [p]);
  const st = ST[d.best];
  return (
    <group position={p} quaternion={q}>
      {d.best === "opérationnel" ? (
        <>
          <mesh><circleGeometry args={[0.7, 32]} /><meshBasicMaterial color={st.color} transparent toneMapped={false} /></mesh>
          <mesh position-z={-0.05}>
            <planeGeometry args={[6, 6]} />
            <meshBasicMaterial map={glowTexture()} color={C.blue} transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </>
      ) : (
        <mesh>
          <ringGeometry args={[0.55, 0.8, 40]} />
          <meshBasicMaterial color={st.color} transparent opacity={d.best === "incertain" ? 0.75 : 0.95} toneMapped={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ------------------------------------------------------------------ chips outside the globe's silhouette
type ChipDef = { id: string; iso: string; local: THREE.Vector3; pri: number; side?: "left" };
type ChipLive = { el: HTMLDivElement | null; line: SVGLineElement | null; dot: SVGCircleElement | null; x: number; y: number; vis: boolean; w: number; h: number };

const chipBase = {
  ...labelCard, borderRadius: 999, padding: "4px 11px 4px 9px", display: "flex", alignItems: "center", gap: 7,
  fontSize: 12.5, fontWeight: 600, lineHeight: 1.25, cursor: "pointer", pointerEvents: "auto" as const,
};

function StatusDots({ items }: { items: Intl[] }) {
  return (
    <span style={{ display: "inline-flex", gap: 9, fontWeight: 500, color: C.txt, opacity: 0.85 }}>
      {countsOf(items).map(([k, n]) => (
        <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 6, height: 6, borderRadius: 6, background: ST[k].solid ? ST[k].color : "transparent", border: ST[k].solid ? "none" : `1.5px solid ${ST[k].color}` }} />
          {n} {ST[k].label}
        </span>
      ))}
    </span>
  );
}

function ChipLayer({ live, selIso }: { live: Map<string, ChipLive>; selIso: string | null }) {
  const [hover, setHover] = useState<string | null>(null);
  const reg = (id: string) => (el: HTMLDivElement | null) => { const c = live.get(id); if (c) c.el = el; };
  const regLine = (id: string) => (el: SVGLineElement | null) => { const c = live.get(id); if (c) c.line = el; };
  const regDot = (id: string) => (el: SVGCircleElement | null) => { const c = live.get(id); if (c) c.dot = el; };
  const opAbroad = INTERNATIONAL.filter((x) => stOf(x) === "opérationnel");
  const since = opAbroad.map((x) => /mise en service ([^);]+)/.exec(x.status)?.[1]).find(Boolean);
  const unplaced = INTERNATIONAL.filter((x) => x.noCoords);
  const card = (children: ReactNode, side: "left" | "right") => (
    <div style={{ ...labelCard, position: "absolute", top: "calc(100% + 6px)", [side === "left" ? "right" : "left"]: 0, padding: "9px 12px 10px", width: 330, whiteSpace: "normal", fontSize: 11.5, lineHeight: 1.45, pointerEvents: "none" }}>
      {children}
    </div>
  );
  return (
    <>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", pointerEvents: "none" }}>
        {[...live.keys()].map((id) => (
          <g key={id}>
            <line ref={regLine(id)} stroke="rgba(200,212,255,0.42)" strokeWidth={1} x1={0} y1={0} x2={0} y2={0} />
            <circle ref={regDot(id)} r={2.2} fill="rgba(220,228,255,0.85)" cx={0} cy={0} />
          </g>
        ))}
      </svg>
      {/* Morocco */}
      <div ref={reg("MA")} style={{ position: "absolute", left: 0, top: 0, opacity: 0 }} onMouseEnter={() => setHover("MA")} onMouseLeave={() => setHover(null)}>
        <div
          onClick={() => useApp.getState().select({ kind: "country", id: "MA" })}
          onDoubleClick={() => useApp.getState().setLevel("morocco")}
          style={{ ...chipBase, border: selIso === "MA" || hover === "MA" ? "1px solid rgba(155,175,255,0.6)" : labelCard.border }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 7, background: C.violet, boxShadow: "0 0 0 3px rgba(155,140,224,0.18)" }} />
          Maroc
          <span style={{ fontWeight: 500, color: C.txt, opacity: 0.85 }}>· {GROUP.establishments} établissements · {GROUP.cities} villes</span>
        </div>
        {hover === "MA" &&
          card(
            <>
              <div style={{ color: C.txt }}>{fmt(GROUP.beds)} lits · objectif 2028 : {GROUP.target2028.establishments} établissements, {fmt(GROUP.target2028.beds)}+ lits, {GROUP.target2028.cities} villes</div>
              {opAbroad.length > 0 && (
                <div style={{ color: C.blueLight, marginTop: 6 }}>
                  Hors du Maroc : {opAbroad.length} hôpita{opAbroad.length > 1 ? "ux" : "l"} en service{since ? ` depuis ${since}` : ""} ({[...new Set(opAbroad.map((x) => x.country))].join(", ")}).
                </div>
              )}
              {unplaced.length > 0 && <div style={{ color: C.mut, marginTop: 4 }}>Non cartographié : {unplaced.map((x) => `${x.country} (${ST[stOf(x)].label})`).join(", ")}.</div>}
              <div style={{ color: C.mut, marginTop: 6 }}>{GROUP.source} · double-clic : explorer le réseau marocain</div>
            </>,
            "left",
          )}
      </div>
      {COUNTRIES.map((c) => (
        <div key={c.iso} ref={reg(c.iso)} style={{ position: "absolute", left: 0, top: 0, opacity: 0 }} onMouseEnter={() => setHover(c.iso)} onMouseLeave={() => setHover(null)}>
          <div
            onClick={() => useApp.getState().select({ kind: "country", id: c.iso })}
            style={{ ...chipBase, border: selIso === c.iso || hover === c.iso ? "1px solid rgba(155,175,255,0.6)" : labelCard.border }}
          >
            {c.name}
            <StatusDots items={c.items} />
          </div>
          {hover === c.iso &&
            card(
              <div style={{ display: "grid", gap: 2 }}>
                {c.items.map((x, i) => {
                  const st = ST[stOf(x)];
                  const place = x.precision === "pays" ? "" : x.city.replace(/\s*\(.*$/, "");
                  return (
                    <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                      <span style={{ width: 6, height: 6, flex: "none", borderRadius: 6, transform: "translateY(-1px)", background: st.solid ? st.color : "transparent", border: st.solid ? "none" : `1.5px solid ${st.color}` }} />
                      <span>
                        {place ? <b style={{ fontWeight: 600 }}>{place} · </b> : null}
                        {shortName(x)}
                        {x.beds ? ` · ${x.beds} lits` : ""}
                        <span style={{ color: st.color }}> — {st.label}</span>
                      </span>
                    </div>
                  );
                })}
              </div>,
              (live.get(c.iso)?.x ?? 0) < (live.get("MA")?.x ?? 0) ? "left" : "right",
            )}
        </div>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ content
export function GlobeContent({ opacity = 1 }: { opacity?: number }) {
  const root = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const focusNonce = useApp((s) => s.focusNonce);
  const sel = useApp((s) => s.sel);
  const [hoverMA, setHoverMA] = useState(false);
  const lastOpacity = useRef(-1);
  const intl = useRef<THREE.Group>(null);
  const lastIntl = useRef(-1);

  const dots = useMemo(() => buildDots(), []);
  const fill = useMemo(() => moroccoFill(), []);
  const hubPos = useMemo(() => toSphere(HQ_LL[0], HQ_LL[1], R + 0.15), []);

  const oceanMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: OCEAN_VERT, fragmentShader: OCEAN_FRAG, transparent: true,
        uniforms: { uDeep: { value: new THREE.Color("#0A1027") }, uLit: { value: new THREE.Color("#18244F") }, uRim: { value: new THREE.Color("#3D52A8") }, uMul: { value: 1 } },
      }),
    [],
  );
  const atmoMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: OCEAN_VERT, fragmentShader: ATMO_FRAG, transparent: true, depthWrite: false, side: THREE.BackSide,
        blending: THREE.AdditiveBlending, uniforms: { uColor: { value: new THREE.Color("#6E86F0") }, uMul: { value: 1 } },
      }),
    [],
  );
  const fillMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ map: fill, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.9 });
    m.userData.ownFade = true;
    return m;
  }, [fill]);
  const hoverRef = useRef(false);
  hoverRef.current = hoverMA;

  // chips (screen space)
  const chipDefs = useMemo<ChipDef[]>(
    () => [
      { id: "MA", iso: "MA", local: toSphere(-8.6, 29.5, R), pri: 100, side: "left" },
      ...COUNTRIES.map((c, i) => ({ id: c.iso, iso: c.iso, local: toSphere(c.anchor.lon, c.anchor.lat, R), pri: 50 - i })),
    ],
    [],
  );
  const live = useMemo(() => {
    const m = new Map<string, ChipLive>();
    for (const d of chipDefs) m.set(d.id, { el: null, line: null, dot: null, x: 0, y: 0, vis: false, w: 0, h: 0 });
    return m;
  }, [chipDefs]);

  const T = useMemo(() => ({ inv: new THREE.Matrix4(), c: new THREE.Vector3(), p: new THREE.Vector3(), s: new THREE.Vector3(), cam: new THREE.Vector3(), w: new THREE.Vector3() }), []);
  const frameN = useRef(0);
  useFrame(({ camera, size }) => {
    const g = root.current;
    if (!g) return;
    GEO_FADE.globe = opacity;
    if (Math.abs(opacity - lastOpacity.current) > 0.002) { applyOpacity(g, opacity); lastOpacity.current = opacity; g.visible = opacity > 0.005; }
    fillMat.opacity = (hoverRef.current ? 1 : 0.85) * opacity;

    // globe in screen space
    g.getWorldPosition(T.c);
    g.getWorldScale(T.s);
    const Rw = R * T.s.x;
    const d = camera.position.distanceTo(T.c);
    const altKm = Math.max(0, d - Rw) / T.s.x * (6371 / R);
    // international arcs / packets / markers only from high altitude (they rise ~1 000 km above the ground and would
    // cut through the Morocco map during the map -> globe cross-fade)
    const kI = opacity * THREE.MathUtils.smoothstep(altKm, 3500, 6500);
    if (intl.current && Math.abs(kI - lastIntl.current) > 0.003) { applyOpacity(intl.current, kI); lastIntl.current = kI; intl.current.visible = kI > 0.004; }
    T.inv.copy(g.matrixWorld).invert();
    T.cam.copy(camera.position).applyMatrix4(T.inv); // camera in globe-local units
    if (frameN.current++ % 2) return;

    // chips: visible beyond ~2 500 km, hidden when the JABB "J" takes over, follow the globe fade
    const persp = camera as THREE.PerspectiveCamera;
    const k = THREE.MathUtils.smoothstep(altKm, 3500, 5500) * (1 - fadeIn(Math.max(frame.alt, 1), 6e7, 9e7)) * opacity;
    const on = k > 0.02 && d > Rw * 1.02;
    let cx = 0, cy = 0, rpx = 0;
    if (on) {
      T.p.copy(T.c).project(camera);
      cx = ((T.p.x + 1) / 2) * size.width; cy = ((1 - T.p.y) / 2) * size.height;
      rpx = (Rw / Math.sqrt(d * d - Rw * Rw)) / Math.tan(THREE.MathUtils.degToRad(persp.fov / 2)) * (size.height / 2);
    }
    const placed: [number, number, number, number][] = [];
    const ordered = [...chipDefs].sort((a, b) => b.pri - a.pri);
    for (const def of ordered) {
      const L = live.get(def.id)!;
      if (!L.el) continue;
      let vis = on;
      let px = 0, py = 0;
      if (vis) {
        const facing = def.local.clone().normalize().dot(T.w.copy(T.cam).sub(def.local).normalize());
        vis = facing > 0.08;
        T.p.copy(def.local).applyMatrix4(g.matrixWorld).project(camera);
        px = ((T.p.x + 1) / 2) * size.width; py = ((1 - T.p.y) / 2) * size.height;
      }
      if (vis) {
        const w = L.el.offsetWidth || 220, h = L.el.offsetHeight || 26;
        let dx = px - cx, dy = py - cy;
        const len = Math.hypot(dx, dy);
        if (len < 1) { dx = -1; dy = 0; } else { dx /= len; dy /= len; }
        if (def.side === "left" && dx > -0.35) { dx = -0.94; dy = Math.sign(dy || 1) * 0.34; }
        let best: [number, number] | null = null;
        outer: for (const extra of [0, 1, 2, 3, 4]) {
          for (const da of [0, 0.18, -0.18, 0.36, -0.36, 0.6, -0.6, 0.9, -0.9, 1.25, -1.25]) {
            const ca = Math.cos(da), sa = Math.sin(da);
            const ux = dx * ca - dy * sa, uy = dx * sa + dy * ca;
            const half = Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2;
            const rr = rpx * 1.1 + 20 + extra * (h + 10);
            const x = cx + ux * (rr + half), y = cy + uy * (rr + half);
            // safe stage area: below the top bar, above the bottom timeline, clear of the left rail / zoom slider
            const xMin = w / 2 + 150, xMax = size.width - w / 2 - 90, yMin = h / 2 + 72, yMax = size.height - h / 2 - 110;
            if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
            const r: [number, number, number, number] = [x - w / 2 - 6, y - h / 2 - 5, x + w / 2 + 6, y + h / 2 + 5];
            // never over the globe's face, never over another chip
            const nx = Math.max(r[0], Math.min(cx, r[2])), ny = Math.max(r[1], Math.min(cy, r[3]));
            const overGlobe = Math.hypot(nx - cx, ny - cy) < rpx * 1.04;
            if (!overGlobe && !placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) { best = [x, y]; placed.push(r); break outer; }
          }
        }
        if (!best) vis = false;
        else { L.x = best[0]; L.y = best[1]; L.w = w; L.h = h; }
      }
      L.vis = vis;
      const o = vis ? String(Math.round(k * 100) / 100) : "0";
      L.el.style.transform = `translate3d(${(L.x - L.w / 2).toFixed(1)}px, ${(L.y - L.h / 2).toFixed(1)}px, 0)`;
      if (L.el.style.opacity !== o) { L.el.style.opacity = o; L.el.style.pointerEvents = vis ? "auto" : "none"; }
      if (L.line && L.dot) {
        // leader: from the country point to the chip's nearest edge
        const ex = Math.max(L.x - L.w / 2, Math.min(px, L.x + L.w / 2)), ey = Math.max(L.y - L.h / 2, Math.min(py, L.y + L.h / 2));
        L.line.setAttribute("x1", px.toFixed(1)); L.line.setAttribute("y1", py.toFixed(1));
        L.line.setAttribute("x2", ex.toFixed(1)); L.line.setAttribute("y2", ey.toFixed(1));
        L.dot.setAttribute("cx", px.toFixed(1)); L.dot.setAttribute("cy", py.toFixed(1));
        L.line.style.opacity = o; L.dot.style.opacity = o;
      }
    }
  });

  // anchors on the chips (page coordinates) — what the AI cursor clicks
  useEffect(() => {
    const offs = chipDefs.map((d) =>
      registerAnchor(`country:${d.iso}`, () => {
        const L = live.get(d.id);
        const r = gl.domElement.getBoundingClientRect();
        if (!L || !L.vis) return null;
        return { x: r.left + L.x, y: r.top + L.y, visible: true };
      }),
    );
    return () => offs.forEach((f) => f());
  }, [chipDefs, live, gl]);

  const toWorld = (p: THREE.Vector3) => (root.current ? root.current.localToWorld(p.clone()) : p.clone());
  /** Fly the rig above a lon/lat, looking straight down at it from `altR` globe radii. */
  const flyAbove = (lon: number, lat: number, altR: number) => {
    const g = root.current;
    if (!g) return;
    const centre = toWorld(new THREE.Vector3());
    const target = toWorld(globePoint(lon, lat));
    const nrm = target.clone().sub(centre).normalize();
    const sc = new THREE.Vector3();
    g.getWorldScale(sc);
    rig.flyTo(target, altR * R * sc.x, { polar: Math.acos(THREE.MathUtils.clamp(nrm.y, -1, 1)), azimuth: Math.atan2(nrm.x, nrm.z) });
  };

  // store navigation: country focus (overview flights belong to the host scene)
  const firstNonce = useRef(focusNonce);
  useEffect(() => {
    if (focusNonce === firstNonce.current) return;
    const s = useApp.getState().sel;
    if (s?.kind !== "country") return;
    const c = COUNTRIES.find((k) => k.iso === s.id);
    if (c) flyAbove(c.anchor.lon, c.anchor.lat, 2.2);
    else flyAbove(-8, 29, 1.8); // MA
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // Morocco hit test on the ocean sphere (event point is in world space)
  const hitMorocco = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const g = root.current;
    const p = g ? g.worldToLocal(e.point.clone()) : e.point.clone();
    const n = p.normalize();
    const lat = Math.asin(n.y) * (180 / Math.PI);
    let lon = Math.atan2(n.z, -n.x) * (180 / Math.PI) - 180;
    if (lon < -180) lon += 360;
    return geoContains(GEO.morocco, [lon, lat]);
  };

  const selIso = sel?.kind === "country" ? sel.id : null;

  return (
    <group ref={root}>
      <mesh
        material={oceanMat}
        onPointerMove={(e) => { const h = hitMorocco(e); if (h !== hoverMA) { setHoverMA(h); document.body.style.cursor = h ? "pointer" : ""; } }}
        onPointerOut={() => { setHoverMA(false); document.body.style.cursor = ""; }}
        onClick={(e) => { if (hitMorocco(e)) { e.stopPropagation(); useApp.getState().setLevel("morocco"); } }}
      >
        <sphereGeometry args={[R, 128, 96]} />
      </mesh>
      <mesh material={atmoMat} scale={1.09}>
        <sphereGeometry args={[R, 96, 64]} />
      </mesh>
      {/* Morocco fill sits just above the ocean, under the dots (same radius family: no shifted copy) */}
      <mesh material={fillMat} renderOrder={1}>
        <sphereGeometry args={[R + 0.05, 48, 48, rad(BB.lon0 + 180), rad(BB.lon1 - BB.lon0), rad(90 - BB.lat1), rad(BB.lat1 - BB.lat0)]} />
      </mesh>
      <DotLayer lonlat={dots.land} size={0.36} color="#8C9BD0" opacity={0.55} />
      <DotLayer lonlat={dots.ma} size={0.3} color="#E3E8FF" opacity={0.85} />
      <HubPulse pos={hubPos} />
      <group ref={intl} userData={{ skipFade: true }}>
        <IntlLayer />
      </group>
      <GeoHtml fullscreen zIndex={6}>
        <ChipLayer live={live} selIso={selIso} />
      </GeoHtml>
    </group>
  );
}
