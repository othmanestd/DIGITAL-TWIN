"use client";
// Reads the rendered frame under the floating controls (four times a second) and tells each one whether the scene behind it
// is light or dark, so their icons turn dark on light ground and stay white on dark (lib/ui/tone.ts).
import { useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { toneEls } from "@/lib/ui/tone";

const BG_L = 0.04; // the navy backdrop behind the transparent canvas
const GRID = 5;    // samples per side inside each element

export default function ToneSampler() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    let last = 0;
    let buf = new Uint8Array(4);
    const prev = scene.onAfterRender;
    scene.onAfterRender = function (this: THREE.Scene, ...args: Parameters<THREE.Scene["onAfterRender"]>) {
      prev.apply(this, args);
      const now = performance.now();
      if (now - last < 250 || toneEls.size === 0 || gl.getRenderTarget()) return;
      last = now;
      const cv = gl.domElement, cr = cv.getBoundingClientRect();
      if (!cr.width || !cr.height) return;
      const sx = cv.width / cr.width, sy = cv.height / cr.height;
      const items: [HTMLElement | SVGElement, DOMRect][] = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const el of toneEls) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        items.push([el, r]);
        x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
      }
      if (!items.length) return;
      // one read of the union rectangle, in device pixels (GL rows are bottom-up), clamped to the canvas
      const px0 = Math.max(0, Math.floor((x0 - cr.left) * sx)), px1 = Math.min(cv.width, Math.ceil((x1 - cr.left) * sx));
      const py0 = Math.max(0, Math.floor((y0 - cr.top) * sy)), py1 = Math.min(cv.height, Math.ceil((y1 - cr.top) * sy));
      const w = px1 - px0, h = py1 - py0;
      if (w <= 0 || h <= 0) return;
      if (buf.length < w * h * 4) buf = new Uint8Array(w * h * 4);
      const ctx = gl.getContext();
      ctx.readPixels(px0, cv.height - py1, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf);
      for (const [el, r] of items) {
        let sum = 0, n = 0;
        for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
          const cx = Math.floor((r.left - cr.left + (r.width * (i + 0.5)) / GRID) * sx) - px0;
          const cy = Math.floor((r.top - cr.top + (r.height * (j + 0.5)) / GRID) * sy) - py0;
          if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
          const k = ((h - 1 - cy) * w + cx) * 4;
          // premultiplied colour + whatever shows through the transparent canvas
          sum += (0.2126 * buf[k] + 0.7152 * buf[k + 1] + 0.0722 * buf[k + 2]) / 255 + (1 - buf[k + 3] / 255) * BG_L;
          n++;
        }
        if (!n) continue;
        const L = sum / n, cur = el.dataset.tone;
        const next = L > 0.6 ? "light" : L < 0.45 ? "dark" : cur ?? "dark"; // hysteresis: no flicker at the threshold
        if (next !== cur) el.dataset.tone = next;
      }
    };
    return () => { scene.onAfterRender = prev; };
  }, [gl, scene]);
  return null;
}
