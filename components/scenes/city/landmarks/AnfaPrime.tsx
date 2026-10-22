"use client";
// <AnfaPrime/>: the real Anfa Prime Hospital (Akdital) in the generated Casablanca. The model is in anfaPrimeGeo.ts, where it
// stands (and why there) in geography.ts (ANFA_PRIME). It fades out with the other landmarks, lights up at night (lattice
// backlight, signage, medallion), a click or its label opens its panel (selection { kind: "facility" }), selecting it flies
// the camera to it, and a few people of the shared human kit come and go at the entrance. Every fact shown comes from
// lib/data/network.json (lib/facilities.ts).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { GeoHtml } from "../../geo/GeoHtml";
import { frame } from "@/lib/world";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import { siteBySlug } from "@/lib/geo/network";
import { dress, newPose, poseIdle, poseWalk, type Garb } from "../../people/human";
import { useHumanCrowd } from "../../people/useHumans";
import { ANFA_PRIME } from "../geography";
import type { Solid } from "../collide";
import { rt } from "../../hospital/mats";
import { ENV } from "./env";
import { aabbSolid, lmOpacity, setFade } from "./shared";
import { AP_ENTRANCE, AP_SIGN_Y, AP_SIGN_Z, AP_VOLUMES, buildAnfaPrime, glowTexture, latticeTexture, letterTexture, medalTexture, panelTexture, type ApKey } from "./anfaPrimeGeo";

export const ANFA_PRIME_ID = "anfa-prime-hospital";
const O = ANFA_PRIME;
const LABEL_ALT = 3000, PEOPLE_ALT = 2000;

/** Walk-mode solids (world metres): the two volumes, the entrance block, the fence (the gate stays open). */
export function anfaPrimeSolids(): Solid[] {
  const out = AP_VOLUMES.map((v) => aabbSolid(O.x + v.x, O.z + v.z, v.w, v.d, 16));
  out.push({ x0: O.x + AP_ENTRANCE.x0, x1: O.x + AP_ENTRANCE.x1, z0: O.z + AP_ENTRANCE.z0, z1: O.z + AP_ENTRANCE.z1, h: 12 });
  out.push({ x0: O.x - 48, x1: O.x - 6, z0: O.z + 28.8, z1: O.z + 29.2, h: 2 }, { x0: O.x + 9, x1: O.x + 48, z0: O.z + 28.8, z1: O.z + 29.2, h: 2 });
  return out;
}

function build() {
  const parts = buildAnfaPrime();
  const lattice = latticeTexture(), glow = glowTexture();
  const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const flat = { polygonOffset: true, polygonOffsetFactor: -3 };
  const M: Record<ApKey, THREE.MeshStandardMaterial | THREE.MeshBasicMaterial> = {
    skin: std({ color: "#FFFFFF", roughness: 0.6, alphaMap: lattice, alphaTest: 0.5, side: THREE.DoubleSide, emissive: "#FFFFFF", emissiveIntensity: 0.14 }),
    glow: new THREE.MeshBasicMaterial({ map: glow, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false }),
    core: std({ color: "#5A616B", roughness: 0.5, metalness: 0.2 }),
    joint: std({ color: "#15181D", roughness: 0.7, side: THREE.DoubleSide }),
    roof: std({ color: "#7A7458", roughness: 1 }),     // planted roof: soil and dry grass
    grass: std({ color: "#A3A25E", roughness: 1 }),
    glass: std({ color: "#1C2A38", roughness: 0.15, metalness: 0.5, emissive: "#FFC27A", emissiveIntensity: 0 }),
    canopy: std({ color: "#3A3F47", roughness: 0.35, metalness: 0.6 }),
    white: std({ color: "#E9ECEF", roughness: 0.35, metalness: 0.3, emissive: "#C9CED6", emissiveIntensity: 0 }),
    fence: std({ color: "#2B2F36", roughness: 0.6 }),
    plaza: std({ color: "#CFC8BA", roughness: 0.95, ...flat }),
    lawn: std({ color: "#5F8F4E", roughness: 1, ...flat }),
    leaf: std({ color: "#45683A", roughness: 1, flatShading: true }),
    trunk: std({ color: "#8A7458", roughness: 1 }),
    frond: std({ color: "#3F6A3A", roughness: 1, side: THREE.DoubleSide }),
  };
  const plate = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  const P = {
    akdital: plate(letterTexture("AKDITAL", "#eef3fa", 800, 176, 1024)),
    name: plate(letterTexture("Anfa Prime Hospital", "#45bdf5", 700, 150, 2048)),
    medal: new THREE.MeshBasicMaterial({ map: medalTexture(), transparent: true }),
    halo: new THREE.MeshBasicMaterial({ color: "#45c1ff", transparent: true }),
    panel: new THREE.MeshBasicMaterial({ map: panelTexture(), transparent: true }),
  };
  const disc = std({ color: "#0b1830", roughness: 0.4, metalness: 0.5 });
  const hit = new THREE.MeshBasicMaterial({ visible: false });
  const fades = [...(Object.keys(M) as ApKey[]).filter((k) => k !== "glow").map((k) => M[k]), disc];
  return { parts, M, P, disc, hit, fades, tex: [lattice, glow] };
}

// people coming and going at the entrance (local polylines, ping-pong), plus two waiting at the gate
type Walker = { garb: Garb; fem?: boolean; hijab?: boolean; pts: [number, number][]; speed: number; ph: number };
const WALKERS: Walker[] = [
  { garb: "visitor", fem: true, hijab: true, pts: [[1.5, 33.5], [1.5, 27], [-0.5, 18], [-0.5, 14.3]], speed: 1.1, ph: 0 },
  { garb: "visitor", pts: [[-0.5, 14.6], [0.5, 22], [3, 27.5], [5, 33.5], [26, 33.5]], speed: 1.25, ph: 0.4 },
  { garb: "medecin", pts: [[-4, 15], [-9, 18.5], [-4, 21]], speed: 1.0, ph: 0.2 },
  { garb: "infirmier", fem: true, pts: [[5, 16], [9, 18], [5, 20.5]], speed: 1.05, ph: 0.7 },
  { garb: "visitor", fem: true, pts: [[-40, 32.2], [40, 32.2]], speed: 1.2, ph: 0.1 },
  { garb: "visitor", pts: [[45, 33], [-45, 33]], speed: 1.35, ph: 0.55 },
  { garb: "porter", pts: [[6, 14.6], [-6, 14.6]], speed: 0.9, ph: 0.3 },
  { garb: "visitor", fem: true, hijab: true, pts: [[-30, 33.4], [12, 33.4]], speed: 1.0, ph: 0.85 },
];
const STANDING: { garb: Garb; x: number; z: number; yaw: number }[] = [
  { garb: "admin", x: 9.8, z: 27.6, yaw: Math.PI * 0.85 },
  { garb: "medecin", x: -3, z: 15.2, yaw: 0.4 },
];

function EntrancePeople() {
  const root = useRef<THREE.Group>(null);
  const crowd = useHumanCrowd(WALKERS.length + STANDING.length);
  const st = useMemo(() => WALKERS.map((w) => {
    const seg: number[] = [0];
    for (let i = 1; i < w.pts.length; i++) seg.push(seg[i - 1] + Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1]));
    return { seg, L: seg[seg.length - 1] || 1, yaw: 0, dist: 0, px: NaN, pz: 0 };
  }), []);
  const P = useMemo(() => newPose(), []);
  useEffect(() => {
    WALKERS.forEach((w, i) => crowd.setLook(i, dress(w.garb, 411 + i * 17, { fem: w.fem, hijab: w.hijab })));
    STANDING.forEach((s, k) => crowd.setLook(WALKERS.length + k, dress(s.garb, 733 + k * 11)));
  }, [crowd]);
  useFrame(({ clock, camera }, dt0) => {
    const g = root.current;
    if (!g) return;
    g.visible = frame.alt < PEOPLE_ALT && Math.hypot(camera.position.x - O.x, camera.position.z - O.z) < 900;
    if (!g.visible) return;
    const t = clock.elapsedTime, dt = Math.min(dt0, 0.1);
    WALKERS.forEach((w, i) => {
      const s = st[i], ph = t * ((2 * w.speed) / s.L) + w.ph * Math.PI * 2;
      const a = ((1 - Math.cos(ph)) / 2) * s.L, vel = Math.sin(ph);
      let k = 1; while (k < s.seg.length - 1 && s.seg[k] < a) k++;
      const f = (a - s.seg[k - 1]) / Math.max(1e-6, s.seg[k] - s.seg[k - 1]);
      const [x0, z0] = w.pts[k - 1], [x1, z1] = w.pts[k];
      const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; // local: the crowd sits in the clinic's group
      let d = Math.atan2(x1 - x0, z1 - z0) + (vel >= 0 ? 0 : Math.PI) - s.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      s.yaw += d * Math.min(1, dt * 4.8);
      if (!Number.isNaN(s.px)) s.dist += Math.hypot(x - s.px, z - s.pz);
      s.px = x; s.pz = z;
      poseWalk(P, (s.dist * 3.6) / crowd.height[i], Math.min(1, Math.abs(vel) * 2));
      crowd.write(i, x, 0, z, s.yaw, 1, P);
    });
    STANDING.forEach((p, k) => { poseIdle(P, t, k * 2.3); crowd.write(WALKERS.length + k, p.x, 0, p.z, p.yaw, 1, P); });
  });
  return <group ref={root}><primitive object={crowd.mesh} /></group>;
}

export function AnfaPrime() {
  const res = useMemo(build, []);
  const root = useRef<THREE.Group>(null);
  const label = useRef<HTMLButtonElement>(null);
  const fade = useRef({ v: -1 });
  const select = useApp((s) => s.select);
  const nonce = useApp((s) => s.focusNonce);
  const site = siteBySlug(ANFA_PRIME_ID);

  useEffect(() => () => {
    res.parts.forEach((p) => p.geo.dispose());
    [...Object.values(res.M), ...Object.values(res.P), res.disc, res.hit].forEach((m) => m.dispose());
    res.tex.forEach((t) => t.dispose());
  }, [res]);

  // selecting the clinic (its label, its panel, the search) flies the camera to its forecourt
  useEffect(() => {
    const sel = useApp.getState().sel;
    if (sel?.kind !== "facility" || sel.id !== ANFA_PRIME_ID) return;
    rig.flyTo(new THREE.Vector3(O.x + 2, 6, O.z + 4), 140, { azimuth: 0.55, polar: 1.12 });
    rt.userMoved = false;
  }, [nonce]);

  useFrame(({ camera }) => {
    const g = root.current;
    if (!g) return;
    const op = lmOpacity(frame.alt);
    g.visible = op > 0.004;
    if (label.current) {
      const show = g.visible && frame.alt < LABEL_ALT && Math.hypot(camera.position.x - O.x, camera.position.z - O.z) < 2600;
      label.current.style.opacity = show ? "1" : "0";
      label.current.style.pointerEvents = show ? "auto" : "none";
    }
    if (!g.visible) return;
    setFade(res.fades, op, fade.current);
    const n = ENV.night;
    // white lattice by day (a little self-light so it stays white in the shade), lit gold from behind at night
    const skin = res.M.skin as THREE.MeshStandardMaterial;
    skin.emissive.setRGB(1, 1 - n * 0.3, 1 - n * 0.64);
    skin.emissiveIntensity = 0.14 + n * 0.08;
    (res.M.glass as THREE.MeshStandardMaterial).emissiveIntensity = n * 0.55;
    (res.M.white as THREE.MeshStandardMaterial).emissiveIntensity = n * 0.25;
    res.M.glow.opacity = n * op;
    res.M.glow.visible = n > 0.02;
    for (const m of Object.values(res.P)) m.opacity = op;
  });

  const open = () => { rt.clickHandled = true; select({ kind: "facility", id: ANFA_PRIME_ID }); };
  const onClick = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); open(); };

  return (
    <group ref={root} position={[O.x, 0, O.z]} rotation={[0, O.yaw, 0]}>
      {res.parts.map((p) => <mesh key={p.key} geometry={p.geo} material={res.M[p.key]} raycast={() => null} />)}
      <mesh position={[-1.5, AP_SIGN_Y, AP_SIGN_Z]} material={res.P.akdital} raycast={() => null}><planeGeometry args={[5.6, 1.4]} /></mesh>
      <mesh position={[15.8, AP_SIGN_Y, AP_SIGN_Z]} material={res.P.name} raycast={() => null}><planeGeometry args={[10, 1.25]} /></mesh>
      <group position={[6.8, AP_SIGN_Y, AP_SIGN_Z + 0.13]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={res.disc} raycast={() => null}><cylinderGeometry args={[1.3, 1.3, 0.3, 48]} /></mesh>
        <mesh position={[0, 0, 0.16]} material={res.P.medal} raycast={() => null}><circleGeometry args={[1.15, 48]} /></mesh>
        <mesh position={[0, 0, 0.12]} material={res.P.halo} raycast={() => null}><torusGeometry args={[1.24, 0.07, 10, 64]} /></mesh>
      </group>
      <mesh position={[9.6, 2.3, 8.05]} rotation={[0, -0.876, 0]} material={res.P.panel} raycast={() => null}><planeGeometry args={[2.2, 1.375]} /></mesh>
      {/* click target: the whole building */}
      <mesh position={[-1.5, 8.5, -4]} material={res.hit} onClick={onClick}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <boxGeometry args={[66, 17, 56]} />
      </mesh>
      <GeoHtml position={[4, 19, 14]} center zIndex={6}>
        <button ref={label} type="button" onClick={open} data-anchor={`facility:${ANFA_PRIME_ID}`}
          className="whitespace-nowrap rounded-full bg-[#0B1020]/85 px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(0,0,0,.6)] ring-1 ring-[#45bdf5]/60 backdrop-blur transition-opacity duration-300 hover:bg-[#1DB4EA] hover:text-[#04121c]"
          style={{ opacity: 0 }}>
          {site?.name ?? "Anfa Prime Hospital"}{site?.beds ? <span className="ml-1.5 font-normal opacity-75">· {site.beds} lits</span> : null}
        </button>
      </GeoHtml>
      <EntrancePeople />
    </group>
  );
}
