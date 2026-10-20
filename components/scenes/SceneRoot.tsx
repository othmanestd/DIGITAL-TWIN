"use client";
// One canvas, one continuous world: hospital → Morocco → globe → the Earth as the dot of the JABB "J".
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import UnifiedWorld from "./UnifiedWorld";
import ToneSampler from "./ToneSampler";
import JabbEgg from "@/components/nav/JabbEgg";
import { frame, fadeIn } from "@/lib/world";

/** Deep space behind the canvas: the navy app background darkens as the camera rises above the atmosphere. */
function SpaceBackdrop() {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => { raf = requestAnimationFrame(tick); if (el.current) el.current.style.opacity = String(fadeIn(frame.alt, 2e5, 4e6)); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      ref={el}
      className="pointer-events-none absolute inset-0"
      style={{ opacity: 0, background: "radial-gradient(1400px 900px at 50% 45%, #0B1130 0%, #050817 55%, #02030A 100%)" }}
    />
  );
}

export default function SceneRoot() {
  return (
    <div className="absolute inset-0">
      <SpaceBackdrop />
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance", logarithmicDepthBuffer: true }}
        camera={{ fov: 38, near: 0.5, far: 4e9, position: [0, 3e7, 1e7] }}
        shadows
      >
        <Suspense fallback={null}>
          <UnifiedWorld />
        </Suspense>
        <ToneSampler />
      </Canvas>
      <JabbEgg />
    </div>
  );
}
