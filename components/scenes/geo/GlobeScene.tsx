"use client";
// Level "world" (standalone wrapper until the unified scene lands): camera controls + rig + shared zoom engine around the
// pure <GlobeContent/>. Intro: pull back from Morocco to a calm wide view; a gentle camera drift until the first interaction.
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { useApp } from "@/lib/store";
import { useSceneZoom } from "@/lib/zoom";
import { rig } from "@/lib/rig";
import { GlobeContent, GLOBE_VIEW_LONLAT, globePoint } from "./GlobeContent";

const MIN_D = 150;
const MAX_D = 640;

export default function GlobeScene() {
  const controls = useRef<CameraControls>(null);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const focusNonce = useApp((s) => s.focusNonce);
  const interacted = useRef(false);
  const intro = useRef(true);

  useEffect(() => {
    rig.attach(controls.current, camera as THREE.PerspectiveCamera);
    return () => rig.attach(null);
  }, [camera]);

  useSceneZoom(controls, { level: "world", min: MIN_D, max: MAX_D, inner: "morocco" });

  const lookFrom = (ll: [number, number], dist: number, transition: boolean) => {
    const c = controls.current;
    if (!c) return Promise.resolve();
    const p = globePoint(ll[0], ll[1], dist - 100);
    p.y += dist * 0.04;
    c.smoothTime = 0.9;
    return c.setLookAt(p.x, p.y, p.z, 0, 0, 0, transition);
  };

  // intro: pull back from Morocco and settle on a calm wide view
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    lookFrom([-12, 33], 230, false);
    const t = setTimeout(() => {
      lookFrom(GLOBE_VIEW_LONLAT, 430, true).then(() => { intro.current = false; if (controls.current) controls.current.smoothTime = 0.16; });
      setTimeout(() => (intro.current = false), 3500);
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "overview" requests are the host's job (the content handles country focus)
  const firstNonce = useRef(focusNonce);
  useEffect(() => {
    if (focusNonce === firstNonce.current) return;
    const s = useApp.getState().sel;
    if (s?.kind === "overview" && useApp.getState().level === "world") lookFrom(GLOBE_VIEW_LONLAT, 430, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // any interaction stops the drift
  useEffect(() => {
    const el = gl.domElement;
    const stop = () => (interacted.current = true);
    el.addEventListener("wheel", stop, { passive: true });
    el.addEventListener("pointerdown", stop);
    return () => { el.removeEventListener("wheel", stop); el.removeEventListener("pointerdown", stop); };
  }, [gl]);

  // gentle camera drift around the hub until the first interaction (keeps Morocco in view)
  const t0 = useRef<number | null>(null);
  useFrame(({ clock }, dt) => {
    const c = controls.current;
    if (!c || intro.current || interacted.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    c.rotate(Math.cos(t * 0.09) * 0.012 * dt, 0, false);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <CameraControls
        ref={controls}
        makeDefault
        minDistance={MIN_D}
        maxDistance={MAX_D}
        azimuthRotateSpeed={0.5}
        polarRotateSpeed={0.5}
        truckSpeed={0}
        onStart={() => { interacted.current = true; }}
      />
      <GlobeContent />
    </>
  );
}
