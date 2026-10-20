"use client";
// Shared zoom engine for the three scenes (hospital, Morocco, globe) — Figma-like: fast, smooth, toward the cursor.
// Usage inside a scene (within <Canvas>):
//   const ref = useRef<CameraControls>(null);
//   useSceneZoom(ref, { level: "hospital", min: 14, max: 260, outer: "morocco" });
//   <CameraControls ref={ref} />
// It takes over the wheel / trackpad (camera-controls' own wheel is disabled), reports the zoom (0 close … 1 far) to the
// store for the zoom slider, applies slider/shortcut requests (store.zoomCmd), and switches level when the user keeps
// zooming past the limits (out → `outer`, in → `inner`).
import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { CameraControls } from "@react-three/drei";
import { useApp, type Level } from "./store";

type Opts = { level: Level; min: number; max: number; outer?: Level; inner?: Level; enabled?: boolean };

const SPEED = 0.0032;            // log-scale zoom per normalised wheel pixel (mouse notch ≈ +38 %)
const PINCH = 6;                 // trackpad pinch deltas are tiny: amplify
const OVERSCROLL = 0.55;         // accumulated log-zoom past a limit before switching level (≈ 2 mouse notches)
const LN095 = Math.log(0.95);

export const zoomToDistance = (z: number, min: number, max: number) => min * Math.pow(max / min, Math.min(1, Math.max(0, z)));
export const distanceToZoom = (d: number, min: number, max: number) => Math.min(1, Math.max(0, Math.log(d / min) / Math.log(max / min)));

let lastApplied = 0; // nonce of the last zoom command applied (module-level: survives scene swaps)

export function useSceneZoom(ref: RefObject<CameraControls | null>, o: Opts) {
  const gl = useThree((s) => s.gl);
  const over = useRef({ v: 0, t: 0 });
  const lastReport = useRef(0);

  // configure camera-controls once it exists
  useEffect(() => {
    const id = setInterval(() => {
      const c = ref.current;
      if (!c) return;
      clearInterval(id);
      c.minDistance = o.min; c.maxDistance = o.max;
      c.smoothTime = 0.16; c.draggingSmoothTime = 0.06;
      c.dollySpeed = 1; c.dollyToCursor = true; c.infinityDolly = false;
      // wheel handled below; keep drag-rotate (left), pan (right / two fingers), touch pinch
      c.mouseButtons.wheel = 0; // ACTION.NONE
    }, 30);
    return () => clearInterval(id);
  }, [ref, o.min, o.max]);

  // wheel + trackpad
  useEffect(() => {
    if (o.enabled === false) return;
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      const c = ref.current as unknown as (CameraControls & { _sphericalEnd: { radius: number }; _dollyInternal: (d: number, x: number, y: number) => void }) | null;
      if (!c) return;
      e.preventDefault();
      // horizontal two-finger swipe → orbit
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2 && !e.ctrlKey) {
        c.rotate((-e.deltaX * Math.PI) / 1800, 0, true);
        return;
      }
      let dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (e.ctrlKey) dy *= PINCH;
      dy = Math.max(-240, Math.min(240, dy));
      const lnS = dy * SPEED * (e.shiftKey ? 0.35 : 1); // shift = fine zoom
      const r = c._sphericalEnd.radius;
      // overscroll → change level
      const atMax = r >= o.max * 0.985 && lnS > 0, atMin = r <= o.min * 1.015 && lnS < 0;
      const now = performance.now();
      if (now - over.current.t > 650) over.current.v = 0;
      over.current.t = now;
      if ((atMax && o.outer) || (atMin && o.inner)) {
        over.current.v += Math.abs(lnS);
        if (over.current.v > OVERSCROLL) {
          over.current.v = 0;
          useApp.getState().setLevel(atMax ? o.outer! : o.inner!);
        }
        return;
      }
      over.current.v = 0;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      c._dollyInternal(lnS / -LN095, x, y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, ref, o.min, o.max, o.outer, o.inner, o.enabled]);

  // keyboard orbit / tilt / pan (events dispatched by components/nav/Shortcuts.tsx)
  useEffect(() => {
    const onOrbit = (e: Event) => {
      const c = ref.current; if (!c) return;
      const d = (e as CustomEvent<{ az?: number; pol?: number; panX?: number; panY?: number }>).detail || {};
      if (d.az || d.pol) c.rotate(d.az ?? 0, d.pol ?? 0, true);
      if (d.panX || d.panY) { const k = c.distance * 0.08; c.truck((d.panX ?? 0) * k, (d.panY ?? 0) * k, true); }
    };
    window.addEventListener("atlas:orbit", onOrbit);
    return () => window.removeEventListener("atlas:orbit", onOrbit);
  }, [ref]);

  // apply slider / shortcut commands addressed to this level
  useEffect(() => {
    const apply = () => {
      const cmd = useApp.getState().zoomCmd;
      const c = ref.current;
      if (!cmd || !c || cmd.level !== o.level || cmd.nonce <= lastApplied) return;
      lastApplied = cmd.nonce;
      const cur = distanceToZoom((c as unknown as { _sphericalEnd: { radius: number } })._sphericalEnd.radius, o.min, o.max);
      const z = cmd.value !== undefined ? cmd.value : cur + (cmd.delta ?? 0);
      if (cmd.delta && ((z > 1.02 && o.outer) || (z < -0.02 && o.inner))) { useApp.getState().setLevel(z > 1 ? o.outer! : o.inner!); return; }
      c.dollyTo(zoomToDistance(z, o.min, o.max), true);
    };
    // the scene may mount after the command (level switch from the slider): retry briefly
    const t1 = setTimeout(apply, 60), t2 = setTimeout(apply, 900);
    const unsub = useApp.subscribe((s, p) => { if (s.zoomCmd !== p.zoomCmd) apply(); });
    return () => { clearTimeout(t1); clearTimeout(t2); unsub(); };
  }, [ref, o.level, o.min, o.max, o.outer, o.inner]);

  // report the current zoom for the slider (throttled)
  useFrame(() => {
    const c = ref.current;
    if (!c) return;
    const now = performance.now();
    if (now - lastReport.current < 90) return;
    lastReport.current = now;
    useApp.getState().setZoom(distanceToZoom(c.distance, o.min, o.max));
  });
}
