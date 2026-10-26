"use client";
// Dev only (QA): window.__perf() → renderer counters of the last frame (draw calls, triangles), memory (geometries,
// textures) and the frame rate over the last second. Used to measure the level-of-detail work.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

export default function PerfProbe() {
  const gl = useThree((s) => s.gl);
  const st = useRef({ frames: 0, t0: 0, fps: 0, calls: 0, tris: 0 });
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    gl.info.autoReset = false; // count every pass of a frame (shadows included); reset in useFrame
    (window as unknown as { __perf?: () => object }).__perf = () => ({
      fps: st.current.fps, calls: st.current.calls, triangles: st.current.tris,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
    });
    return () => { gl.info.autoReset = true; };
  }, [gl]);
  useFrame(() => {
    if (process.env.NODE_ENV === "production") return;
    const s = st.current, now = performance.now();
    s.calls = gl.info.render.calls; s.tris = gl.info.render.triangles; gl.info.reset();
    s.frames++;
    if (now - s.t0 > 1000) { s.fps = Math.round((s.frames * 1000) / (now - s.t0)); s.frames = 0; s.t0 = now; }
  });
  return null;
}
