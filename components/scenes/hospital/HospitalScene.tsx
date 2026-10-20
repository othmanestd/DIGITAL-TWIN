"use client";
// Standalone hospital level (current app): camera controls + shared rig + zoom engine + lights, around <HospitalContent/>.
// In the unified "powers of ten" scene only <HospitalContent/> is used.
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import { useSceneZoom } from "@/lib/zoom";
import { HospitalContent, CAMPUS_OFFSET, HOSPITAL_TIME } from "./HospitalContent";
import { FOV, currentAspect, flyShot, overviewLocal } from "./Focus";

if (typeof window !== "undefined") Object.assign(window as object, { __atlas: useApp, __rig: rig }); // test hooks (screenshots)

const ZOOM_SMOOTH = 0.16; // lib/zoom.ts value
const FLIGHT_SMOOTH = 0.85;

export default function HospitalScene() {
  const ref = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useSceneZoom(ref, { level: "hospital", min: 10, max: 260, outer: "morocco" });
  useFrame(() => { rig.tick(); }); // advance the shared rig's cinematic flights (the unified scene does it there)

  // renderer look: neutral tone mapping keeps the white maquette white (restored on unmount); transparent background
  useEffect(() => {
    const prev = { tm: gl.toneMapping, ex: gl.toneMappingExposure, bg: scene.background };
    gl.toneMapping = THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1.0;
    scene.background = null;
    return () => { gl.toneMapping = prev.tm; gl.toneMappingExposure = prev.ex; scene.background = prev.bg; };
  }, [gl, scene]);

  // controls → shared rig; intro glide from high above; overview flights; long smoothTime for flights only
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    camera.fov = FOV; camera.near = 0.5; camera.far = 4000; camera.updateProjectionMatrix();
    rig.attach(c, camera);
    c.setBoundary(new THREE.Box3(new THREE.Vector3(-90, -8, -65), new THREE.Vector3(90, 45, 65)));
    const o = overviewLocal(1.8).look.add(CAMPUS_OFFSET);
    void c.setLookAt(o.x + 26, 360, o.z + 150, o.x, 0, o.z, false);
    const snappy = () => { c.smoothTime = ZOOM_SMOOTH; };
    const overview = () => flyShot(overviewLocal(currentAspect(gl.domElement)));
    const t = setTimeout(() => {
      c.smoothTime = 1.4;
      const s = useApp.getState().sel;
      if (!s || s.kind === "overview") overview();
    }, 90);
    const unsub = useApp.subscribe((s, p) => {
      if (s.focusNonce === p.focusNonce || s.level !== "hospital") return;
      c.smoothTime = FLIGHT_SMOOTH; // the content's flight (or ours) runs right after with this smoothing
      if (s.sel?.kind === "overview") overview();
    });
    c.addEventListener("rest", snappy);
    c.addEventListener("controlstart", snappy);
    gl.domElement.addEventListener("wheel", snappy, { passive: true, capture: true });
    return () => {
      clearTimeout(t); unsub();
      c.removeEventListener("rest", snappy);
      c.removeEventListener("controlstart", snappy);
      gl.domElement.removeEventListener("wheel", snappy, { capture: true });
      rig.attach(null);
    };
  }, [camera, gl]);

  return (
    <>
      <CameraControls ref={ref} makeDefault minDistance={10} maxDistance={260} maxPolarAngle={Math.PI * 0.46} dollyToCursor />
      <Lights />
      <Environment resolution={128} frames={1} environmentIntensity={0.3}>
        <Lightformer form="rect" intensity={2.2} color="#FFFFFF" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#DCE6FF" position={[-14, 4, 6]} rotation-y={Math.PI / 2} scale={[20, 6, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#FFF3E6" position={[14, 4, -6]} rotation-y={-Math.PI / 2} scale={[20, 6, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#9FB3FF" position={[0, -6, 0]} rotation-x={-Math.PI / 2} scale={[30, 30, 1]} />
      </Environment>
      <HospitalContent standalone />
    </>
  );
}

/** Soft key light with shadows over the campus + hemisphere fill + a faint cool rim. */
function Lights() {
  const tgt = useMemo(() => new THREE.Object3D(), []);
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const warm = useMemo(() => ({ day: new THREE.Color("#FFF8EE"), dusk: new THREE.Color("#FFB07A"), night: new THREE.Color("#9FB2FF") }), []);
  // follow the time-lapse of HospitalContent (day → night → day when the year changes)
  useFrame(() => {
    const d = HOSPITAL_TIME.day;
    if (key.current) {
      key.current.intensity = 2.9 * (0.1 + 0.9 * d);
      key.current.color.copy(warm.night).lerp(warm.dusk, Math.min(1, d * 2)).lerp(warm.day, Math.max(0, d * 2 - 1));
    }
    if (hemi.current) hemi.current.intensity = 0.7 * (0.38 + 0.62 * d);
  });
  useLayoutEffect(() => {
    const l = key.current;
    if (!l) return;
    l.shadow.camera.updateProjectionMatrix();
    l.shadow.needsUpdate = true;
  }, []);
  return (
    <>
      <hemisphereLight ref={hemi} args={["#E9EEFF", "#2B3558", 0.7]} />
      <primitive object={tgt} position={[0, 0, -2]} />
      <directionalLight
        ref={key}
        target={tgt}
        position={[-52, 105, 62]}
        intensity={2.9}
        color="#FFF8EE"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={72}
        shadow-camera-bottom={-72}
        shadow-camera-near={20}
        shadow-camera-far={320}
      />
      <directionalLight position={[70, 40, -52]} intensity={0.3} color="#C9D5FF" />
    </>
  );
}
