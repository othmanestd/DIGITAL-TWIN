"use client";
// Shared bits for the geo scenes (Morocco map + globe): palette, soft glow texture, screen anchors, label styles.
import * as THREE from "three";
import { useEffect, type CSSProperties } from "react";
import { useThree } from "@react-three/fiber";
import { registerAnchor } from "@/lib/anchors";
import { useApp } from "@/lib/store";

// Expose the store for scripted screenshots / the guided tour debugging.
if (typeof window !== "undefined") (window as unknown as { __atlas: typeof useApp }).__atlas = useApp;

export const C = {
  blue: "#5B7CFF",
  blueSoft: "#7D95FF",
  blueLight: "#B9C6FF",
  green: "#4CC79A",
  amber: "#E2B05A",
  teal: "#5FB3A8",
  violet: "#9B8CE0",
  violetLight: "#C9BFF5",
  txt: "#EDF0F7",
  mut: "#8D97B0",
};

let glowTex: THREE.Texture | null = null;
/** Soft radial gradient (white -> transparent), tinted by the material colour. */
export function glowTexture() {
  if (glowTex) return glowTex;
  const s = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = s;
  const g = cv.getContext("2d")!;
  const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.45)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, s, s);
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

const _v = new THREE.Vector3();
/** Project a world point to page pixels (for the AI cursor / guided tour). */
export function projectToPage(p: THREE.Vector3, camera: THREE.Camera, el: HTMLElement, extraVisible = true) {
  _v.copy(p).project(camera);
  const r = el.getBoundingClientRect();
  const inFront = _v.z < 1 && _v.z > -1;
  const x = r.left + ((_v.x + 1) / 2) * r.width;
  const y = r.top + ((1 - _v.y) / 2) * r.height;
  const visible = extraVisible && inFront && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  return { x, y, visible };
}

/** Register a set of anchors ("city:casablanca" -> world point getter). */
export function useAnchors(entries: { id: string; point: () => THREE.Vector3; visible?: () => boolean }[]) {
  const get = useThree((s) => s.get);
  useEffect(() => {
    const offs = entries.map((e) =>
      registerAnchor(e.id, () => {
        const { camera, gl } = get();
        return projectToPage(e.point(), camera, gl.domElement, e.visible ? e.visible() : true);
      }),
    );
    return () => offs.forEach((f) => f());
  }, [entries, get]);
}

/** Inline styles for HTML labels over the 3D stage (no neon: glass, hairline border, soft shadow). */
export const labelCard: CSSProperties = {
  background: "linear-gradient(160deg, rgba(22,30,58,0.78), rgba(10,15,32,0.72))",
  border: "1px solid rgba(255,255,255,0.13)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px -12px rgba(0,0,0,0.7)",
  backdropFilter: "blur(10px) saturate(140%)",
  WebkitBackdropFilter: "blur(10px) saturate(140%)",
  borderRadius: 10,
  color: C.txt,
  whiteSpace: "nowrap",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  letterSpacing: "-0.005em",
};

// ------------------------------------------------------------------ GLSL helpers
// Every custom shader supports the logarithmic depth buffer of the unified scene and a global opacity multiplier
// (uMul) so the map / globe can cross-fade. Vertex positions are LOCAL (the parent group may scale/translate the content).
// (each chunk sits on its own lines: preprocessor directives must not share a line with code)
export const LOGDEPTH_VERT_PARS = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
`;
export const LOGDEPTH_VERT = /* glsl */ `
#include <logdepthbuf_vertex>
`;
export const LOGDEPTH_FRAG_PARS = /* glsl */ `
#include <logdepthbuf_pars_fragment>
`;
export const LOGDEPTH_FRAG = /* glsl */ `
#include <logdepthbuf_fragment>
`;

/** Fade to transparent with distance from a centre (keeps planes and grids from showing hard edges). */
export const FADE_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; uniform vec2 uCenter; uniform float uR0; uniform float uR1; uniform float uMul;
varying vec3 vW;
${LOGDEPTH_FRAG_PARS}
void main() {
  ${LOGDEPTH_FRAG}
  float d = length(vW.xz - uCenter);
  float a = uOpacity * uMul * (1.0 - smoothstep(uR0, uR1, d));
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`;
/** Passes the LOCAL position as vW (name kept for brevity). */
export const WORLD_VERT = /* glsl */ `
varying vec3 vW;
${LOGDEPTH_VERT_PARS}
void main() {
  vW = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  ${LOGDEPTH_VERT}
}`;

// ------------------------------------------------------------------ matcap (lighting that does not depend on scene lights)
let matcapTex: THREE.Texture | null = null;
/** Soft studio matcap: light from the top-left, gentle rim. Tint with the material colour. */
export function matcapTexture() {
  if (matcapTex) return matcapTex;
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, S, S);
  const base = g.createRadialGradient(S * 0.36, S * 0.3, S * 0.02, S * 0.5, S * 0.5, S * 0.52);
  base.addColorStop(0, "#ffffff");
  base.addColorStop(0.35, "#c9ccd6");
  base.addColorStop(0.8, "#6d7182");
  base.addColorStop(1, "#4a4e5e");
  g.fillStyle = base;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2); g.fill();
  matcapTex = new THREE.CanvasTexture(cv);
  matcapTex.colorSpace = THREE.SRGBColorSpace;
  return matcapTex;
}

// ------------------------------------------------------------------ content opacity (map <-> globe cross-fade)
/** Current opacity of each content (read by animated materials and HTML labels). */
export const GEO_FADE = { map: 1, globe: 1 };
/** Multiply every material's opacity under `root` by `k` (base opacities remembered in userData). Cheap: only runs when k changes. */
export function applyOpacity(root: THREE.Object3D, k: number) {
  const visit = (o: THREE.Object3D, top: boolean) => {
    if (!top && o.userData.skipFade) return; // a sub-tree that manages its own opacity (e.g. the map pins)
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (m) {
      for (const mat of Array.isArray(m) ? m : [m]) {
        if (mat.userData.ownFade) continue; // animated materials multiply by GEO_FADE themselves
        const sm = mat as THREE.ShaderMaterial;
        if (sm.uniforms && sm.uniforms.uMul) { sm.uniforms.uMul.value = k; continue; }
        if (mat.userData.baseOpacity === undefined) mat.userData.baseOpacity = mat.opacity;
        mat.opacity = mat.userData.baseOpacity * k;
        mat.transparent = true;
      }
    }
    for (const c of o.children) visit(c, false);
  };
  visit(root, true);
}
