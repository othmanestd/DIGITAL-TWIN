"use client";
// Level "morocco" (standalone wrapper until the unified scene lands): camera controls + rig + shared zoom engine around
// the pure <MoroccoContent/>. Intro: the camera descends from altitude onto the country (or the requested city/site).
// Zoom (lib/zoom.ts): keep zooming out past the max -> world globe; in past the min -> hospital.
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useApp } from "@/lib/store";
import { useSceneZoom } from "@/lib/zoom";
import { rig } from "@/lib/rig";
import { MoroccoContent, moroccoOverviewShot, moroccoShot, MAP_CENTER, type MapShot } from "./MoroccoContent";

const MIN_D = 9;
const MAX_D = 560;

export default function MoroccoScene() {
  const controls = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const focusNonce = useApp((s) => s.focusNonce);

  // the content flies through the shared rig
  useEffect(() => {
    rig.attach(controls.current, camera as THREE.PerspectiveCamera);
    return () => rig.attach(null);
  }, [camera]);

  useSceneZoom(controls, { level: "morocco", min: MIN_D, max: MAX_D, outer: "world", inner: "hospital" });

  const toPos = (s: MapShot) => new THREE.Vector3().setFromSphericalCoords(s.dist, s.polar, s.azimuth).add(s.target);

  // intro: descend from high altitude onto the destination (whole country, or the city/site requested)
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.setBoundary(new THREE.Box3(MAP_CENTER.clone().add(new THREE.Vector3(-170, -8, -170)), MAP_CENTER.clone().add(new THREE.Vector3(170, 60, 170))));
    const shot = moroccoShot(useApp.getState().sel) ?? moroccoOverviewShot(size.width / Math.max(1, size.height));
    const t = shot.target;
    c.setLookAt(t.x + 30, 1700, t.z + 420, t.x, 0, t.z, false);
    const id = setTimeout(() => {
      const p = toPos(shot);
      c.smoothTime = 0.9;
      void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true).then(() => { c.smoothTime = 0.16; });
    }, 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "overview" requests are the host's job (the content only handles city / site)
  const firstNonce = useRef(focusNonce);
  useEffect(() => {
    if (focusNonce === firstNonce.current) return;
    const sel = useApp.getState().sel;
    if (sel?.kind === "overview" && useApp.getState().level === "morocco") {
      const s = moroccoOverviewShot(size.width / Math.max(1, size.height));
      rig.flyTo(s.target, s.dist, { polar: s.polar, azimuth: s.azimuth });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  return (
    <>
      <ambientLight intensity={0.55} color="#B8C3FF" />
      <directionalLight position={[-140, 220, -60]} intensity={1.2} />
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={MIN_D}
        maxDistance={MAX_D}
        minPolarAngle={0.05}
        maxPolarAngle={1.22}
        minAzimuthAngle={-1.0}
        maxAzimuthAngle={1.0}
        boundaryEnclosesCamera={false}
      />
      <MoroccoContent />
    </>
  );
}
