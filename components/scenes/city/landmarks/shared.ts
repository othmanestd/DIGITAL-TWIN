// Shared plumbing of the landmarks: altitude fade of a material list, a soft glow sprite texture, collider helpers.
import * as THREE from "three";
import type { Solid } from "../collide";

/** Landmarks fade out between these altitudes (m) and are gone above the second ("nothing above ~20 km"). */
export const LM_FADE: [number, number] = [11_000, 21_000];

/** Opacity of a landmark for a camera altitude. */
export function lmOpacity(alt: number) {
  const t = Math.min(1, Math.max(0, (alt - LM_FADE[0]) / (LM_FADE[1] - LM_FADE[0])));
  return 1 - t * t * (3 - 2 * t);
}

/** Apply an opacity to a material list, switching `transparent` only while fading (opaque otherwise, so depth sorting stays cheap). */
export function setFade(list: THREE.Material[], op: number, last: { v: number }) {
  if (Math.abs(op - last.v) < 0.004 && !((op >= 0.999) !== (last.v >= 0.999))) return;
  last.v = op;
  const tr = op < 0.999;
  for (const m of list) {
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = op;
    m.depthWrite = true;
  }
}

/** Radial soft disc (white core to transparent) for glows. */
export function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,250,240,0.85)"); gr.addColorStop(0.5, "rgba(255,240,220,0.22)"); gr.addColorStop(1, "rgba(255,240,220,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Walk-mode solids of a yawed rectangle given in a local frame (position px, pz and yaw about +Y, local x = (cos, −sin),
 *  local z = (sin, cos) like THREE's rotation-y): cut into cells of `cell` metres so the axis-aligned boxes stay close to it. */
export function yawedSolids(px: number, pz: number, yaw: number, lx0: number, lx1: number, lz0: number, lz1: number, h: number, cell = 12): Solid[] {
  const out: Solid[] = [], c = Math.cos(yaw), s = Math.sin(yaw);
  const nx = Math.max(1, Math.ceil((lx1 - lx0) / cell)), nz = Math.max(1, Math.ceil((lz1 - lz0) / cell));
  const dx = (lx1 - lx0) / nx, dz = (lz1 - lz0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const cx = lx0 + dx * (i + 0.5), cz = lz0 + dz * (j + 0.5);
    const x = px + cx * c + cz * s, z = pz - cx * s + cz * c;
    const ex = (Math.abs(c) * dx + Math.abs(s) * dz) / 2, ez = (Math.abs(s) * dx + Math.abs(c) * dz) / 2;
    out.push({ x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez, h });
  }
  return out;
}

/** Axis-aligned solid of a box centred at (x, z). */
export const aabbSolid = (x: number, z: number, w: number, d: number, h: number): Solid => ({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, h });
