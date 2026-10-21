"use client";
// <CitySky/>: the real sky of the city. A Preetham-style atmosphere (Rayleigh + Mie single scattering, the approach of three's
// Sky) drawn as ONE full-screen triangle at the far plane before the world, so it follows the camera exactly and needs neither
// a big dome nor the log depth: the pixels the city / map / globe cover are rejected early by the depth test.
//  · the sun follows HOSPITAL_TIME.day: peak at the key light's own direction, the horizon at day = 0.5 (warm sunset / sunrise),
//    below it at night (indigo twilight, deep navy, stars, moon);
//  · a pale lavender horizon haze that matches the soft-blue ground, a few soft clouds with parallax, and a ground haze (a big
//    flat ring around the camera, thickening with the view distance) that melts the far navy ground into that haze;
//  · it deepens to the app's navy with altitude and is gone by ~45 km, where the space backdrop and the globe take over.
// It also publishes the daylight state (landmarks/env.ts: ENV) read by the landmarks. Mount it OUTSIDE the altitude-gated city group.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { HOSPITAL_TIME } from "../hospital/HospitalContent";
import { ENV, lfade, sunDirection, sunElevation } from "./landmarks/env";
import { HAZE_FRAG, HAZE_VERT, SKY_FRAG, SKY_VERT, skyCoefficients } from "./landmarks/skyShader";
import { TEX } from "./landmarks/textures";

/** Altitudes (m) between which the sky dissolves into the space backdrop. */
const SKY_FADE: [number, number] = [14_000, 45_000];
/** Ground haze: thickness of the layer (m), start of the haze along the view ray (m), strength per metre, ceiling. */
const HAZE = { h: 3_500, p0: 2_200, k: 3.6e-5, amp: 0.94 };
const _rot = new THREE.Matrix4(), _q = new THREE.Quaternion();

export function CitySky() {
  const mesh = useRef<THREE.Mesh>(null), hazeG = useRef<THREE.Group>(null);
  const { geo, mat, last, hGeo, hMat } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: SKY_VERT, fragmentShader: SKY_FRAG,
      uniforms: {
        uInvProj: { value: new THREE.Matrix4() }, uCamRot: { value: new THREE.Matrix3() }, uCamPos: { value: new THREE.Vector3() },
        uSun: { value: new THREE.Vector3(0, 1, 0) }, uBetaR: { value: new THREE.Vector3() }, uBetaM: { value: new THREE.Vector3() },
        uSunE: { value: 0 }, uSunFade: { value: 1 }, uMieG: { value: 0.72 }, uDay: { value: 1 }, uAlt: { value: 300 }, uOpacity: { value: 1 },
        uTime: { value: 0 }, uCover: { value: 0.54 }, uExposure: { value: 0.4 }, uNoise: { value: TEX.cloud() },
      },
      transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: true, toneMapped: false, fog: false,
    });
    const hGeo = new THREE.RingGeometry(1_500, 1_500_000, 128, 1);
    hGeo.rotateX(-Math.PI / 2);
    const hMat = new THREE.ShaderMaterial({
      vertexShader: HAZE_VERT, fragmentShader: HAZE_FRAG,
      uniforms: { uSun: { value: mat.uniforms.uSun.value }, uK: { value: HAZE.k }, uP0: { value: HAZE.p0 }, uH: { value: HAZE.h }, uAmp: { value: HAZE.amp } },
      transparent: true, premultipliedAlpha: true, depthWrite: false, depthTest: true, toneMapped: false, fog: false,
    });
    // `last` lives with the material: a Fast Refresh recreates the material and must push the sun uniforms again
    return { geo, mat, last: { day: -1 }, hGeo, hMat };
  }, []);
  useEffect(() => () => { geo.dispose(); mat.dispose(); hGeo.dispose(); hMat.dispose(); }, [geo, mat, hGeo, hMat]);

  const k = useMemo(() => ({ sun: new THREE.Vector3() }), []);
  useFrame(({ clock, camera }) => {
    const alt = frame.alt;
    ENV.alt = alt;
    const d = ENV.dev.day ?? HOSPITAL_TIME.day;
    ENV.day = d; ENV.night = 1 - d;
    sunDirection(d, ENV.sun); ENV.sunEl = sunElevation(d);
    const m = mesh.current;
    if (!m) return;
    const op = 1 - lfade(alt, SKY_FADE[0], SKY_FADE[1]);
    m.visible = op > 0.004;
    if (hazeG.current) {
      const hk = 1 - lfade(alt, 8_000, 40_000);
      hazeG.current.visible = hk > 0.004;
      if (hazeG.current.visible) {
        hazeG.current.position.set(camera.position.x, 0.45, camera.position.z);
        hMat.uniforms.uAmp.value = HAZE.amp * hk;
      }
    }
    if (!m.visible) return;
    const u = mat.uniforms;
    u.uOpacity.value = op; u.uAlt.value = alt; u.uTime.value = clock.elapsedTime; u.uDay.value = d;
    if (Math.abs(last.day - d) > 1e-4) {
      last.day = d;
      k.sun.copy(ENV.sun);
      const c = skyCoefficients(k.sun.y);
      u.uSun.value.copy(k.sun); u.uBetaR.value.set(c.betaR[0], c.betaR[1], c.betaR[2]); u.uBetaM.value.set(c.betaM[0], c.betaM[1], c.betaM[2]);
      u.uSunE.value = c.sunE; u.uSunFade.value = c.sunFade;
    }
  });
  // the view matrices are read at draw time (after the controls and the egg's view offset have moved the camera): no lag
  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    m.onBeforeRender = (_r, _s, camera) => {
      const u = mat.uniforms;
      u.uInvProj.value.copy(camera.projectionMatrixInverse);
      u.uCamRot.value.setFromMatrix4(_rot.makeRotationFromQuaternion(camera.getWorldQuaternion(_q)));
      u.uCamPos.value.setFromMatrixPosition(camera.matrixWorld);
    };
  }, [mat]);

  return (
    <>
      <mesh ref={mesh} geometry={geo} material={mat} frustumCulled={false} renderOrder={-1000} raycast={() => null} />
      <group ref={hazeG}>
        <mesh geometry={hGeo} material={hMat} frustumCulled={false} renderOrder={10} raycast={() => null} />
      </group>
    </>
  );
}
