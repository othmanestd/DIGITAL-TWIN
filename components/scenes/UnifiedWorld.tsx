"use client";
// The continuous "powers of ten" world: one camera from a department (≈ 10 m) to space (≈ 260 000 km).
// Hospital (1 unit = 1 m) at the origin = Casablanca → Morocco map around it → the Earth under the map → the Earth becomes
// the dot of the JABB "J" (DOM overlay JabbEgg). Long moves are log-space flights (lib/rig), the pivot hands over from the
// ground to the Earth's centre above ~3 000 km so the globe spins naturally, and every content fades by altitude.
import * as THREE from "three";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Environment, Lightformer } from "@react-three/drei";
import { useApp } from "@/lib/store";
import { rig, EARTH_R, GLOBE_DROP, EARTH_CENTER } from "@/lib/rig";
import { MAX_ALT, altToG, gToAlt, bandAlt, levelForAlt, fadeIn, frame, EGG_DROP, EGG_IN, EGG_FULL } from "@/lib/world";
import { HospitalContent, HOSPITAL_BOX, HOSPITAL_TIME } from "./hospital/HospitalContent";
import { CityContent } from "./city/CityContent";
import { CitySky } from "./city/Sky";
import { CityLandmarks } from "./city/landmarks";
import { CityPedestrians } from "./city/Pedestrians";
import { MoroccoContent, MAP_UNITS_PER_KM, MOROCCO_CENTER_LONLAT, mapProject } from "./geo/MoroccoContent";
import { GlobeContent, GLOBE_RADIUS, GLOBE_VIEW_LONLAT, globePoint } from "./geo/GlobeContent";
import { CASA_LONLAT } from "@/lib/geo/projection";
import WalkWorld from "./walk/WalkWorld";
import { walkBusy, WALK_API } from "./walk/state";
import { CASA_REEL } from "@/lib/geo/casaFrame";
import { CasaReel } from "./city/CasaReel";

const MAP_SCALE_M = 1000 / MAP_UNITS_PER_KM;          // metres per map unit (≈ 7 580)
const GLOBE_SCALE_M = EARTH_R / GLOBE_RADIUS;          // metres per globe unit (63 710)
const PIVOT_IN = 3.3e6;   // above this altitude the camera orbits the Earth's centre
const PIVOT_OUT = 2.5e6;  // below this it orbits the ground again (hysteresis)
const R_TOP = EARTH_R + GLOBE_DROP;                    // distance centre → ground (y = 0) under Casablanca
const SPEED = 0.0032, PINCH = 6, LN095 = Math.log(0.95);
if (typeof window !== "undefined") Object.assign(window as unknown as Record<string, unknown>, { __rig: rig, __frame: frame });

/** Rotation that puts Casablanca on top of the globe (+Y) with north towards −Z, like the map. */
function globeQuaternion() {
  const up = globePoint(CASA_LONLAT[0], CASA_LONLAT[1]).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(0, 1, 0));
  const north = globePoint(CASA_LONLAT[0], CASA_LONLAT[1] + 0.05).sub(globePoint(CASA_LONLAT[0], CASA_LONLAT[1])).normalize().applyQuaternion(q);
  const a = Math.atan2(north.x, -north.z);
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a).multiply(q);
}

export default function UnifiedWorld() {
  const controls = useRef<CameraControls>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const size = useThree((s) => s.size);
  const hosp = useRef<THREE.Group>(null);
  const [mapOp, setMapOp] = useState(1);
  const [globeOp, setGlobeOp] = useState(0);
  const st = useRef({ dragging: false, lastReport: 0, intro: true, over: 0, overT: 0, offset: false });
  const gq = useMemo(globeQuaternion, []);
  const gpos = useMemo(() => EARTH_CENTER.clone(), []);
  /** the Earth's north-pole axis in world space: camera up while orbiting the Earth, so north stays up on screen */
  const POLE = useMemo(() => new THREE.Vector3(0, 1, 0).applyQuaternion(gq).normalize(), [gq]);
  const tmp = useMemo(() => ({ t: new THREE.Vector3(), d: new THREE.Vector3(), p: new THREE.Vector3(), q: new THREE.Vector3() }), []);

  // world-space anchors of the three overviews
  const shots = useMemo(() => {
    const [mx, mz] = mapProject(MOROCCO_CENTER_LONLAT[0], MOROCCO_CENTER_LONLAT[1]);
    const morocco = new THREE.Vector3(mx * MAP_SCALE_M, 0, mz * MAP_SCALE_M - 170_000); // a little north: the tilt compresses the far side
    // world view: between Morocco and the Gulf, Morocco well inside the disc (not on the limb)
    const VIEW: [number, number] = [GLOBE_VIEW_LONLAT[0] * 0.45, GLOBE_VIEW_LONLAT[1] * 0.85 + 4];
    const n = globePoint(VIEW[0], VIEW[1]).normalize().applyQuaternion(gq);
    return { morocco, worldPolar: Math.acos(THREE.MathUtils.clamp(n.y, -1, 1)), worldAz: Math.atan2(n.x, n.z) };
  }, [gq]);

  // renderer look (neutral tone mapping keeps the white maquette white), transparent background
  useEffect(() => {
    gl.toneMapping = THREE.NeutralToneMapping; gl.toneMappingExposure = 1;
    scene.background = null;
  }, [gl, scene]);

  // controls → rig; drag state
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    camera.fov = 38; camera.near = 0.5; camera.far = 4e9; camera.updateProjectionMatrix();
    rig.attach(c, camera);
    rig.upFor = (t: THREE.Vector3) => (t.distanceTo(EARTH_CENTER) < 2e5 ? POLE : new THREE.Vector3(0, 1, 0));
    rig.polarLimit = (d: number) => THREE.MathUtils.lerp(1.42, 0.06, fadeIn(d, 9e5, 3.4e6)); // spread over a few wheel steps
    c.smoothTime = 0.16; c.draggingSmoothTime = 0.06; c.dollySpeed = 1; c.infinityDolly = false;
    c.mouseButtons.wheel = 0; // handled below
    const s = st.current;
    const on = () => { s.dragging = true; rig.cancel(); s.intro = false; dive.current++; };
    const off = () => { s.dragging = false; };
    c.addEventListener("controlstart", on); c.addEventListener("controlend", off);
    return () => { c.removeEventListener("controlstart", on); c.removeEventListener("controlend", off); rig.attach(null); };
  }, [camera]);

  // overview flights for the three levels (contents handle their own selections)
  const go = (level: "hospital" | "morocco" | "world", o: { duration?: number; done?: () => void } = {}) => {
    if (level === "hospital") rig.fitBox(HOSPITAL_BOX.clone(), { polar: 1.02, azimuth: 0.72, padding: 0.02, ...o });
    else if (level === "morocco") rig.flyTo(shots.morocco, 2.55e6, { polar: 0.5, azimuth: 0.04, ...o });
    else rig.flyTo(EARTH_CENTER, R_TOP + 2.1e7, { polar: shots.worldPolar, azimuth: shots.worldAz, ...o });
  };
  // Staged travel through the powers of ten, both ways: logo → globe → Morocco → Casablanca → hospital (the globe comes out
  // of the logo, Morocco out of the globe, Casablanca out of Morocco, then the hospital), and back up the same ladder.
  // Used when a click skips two rungs or more (a straight flight would land inside Morocco with the pivot still on the
  // Earth). ≈ 2.1 s a rung. Any new command, wheel or drag stops it (dive token).
  const dive = useRef(0);
  const CASA = useMemo(() => new THREE.Vector3(0, 8, 0), []);
  type Rung = "hospital" | "casa" | "morocco" | "world" | "jabb";
  const LADDER: Rung[] = ["hospital", "casa", "morocco", "world", "jabb"];
  const rungOf = (alt: number): number => (alt > 4e7 ? 4 : alt > 3.2e6 ? 3 : alt > 6e4 ? 2 : alt > 2_500 ? 1 : 0);
  const fly = (r: Rung, want: number | undefined, done?: () => void) => {
    if (r === "hospital") go("hospital", { duration: 2.2, done });
    else if (r === "casa") rig.flyTo(CASA, 2.4e4, { polar: 0.78, azimuth: 0.45, duration: 2.0, done });
    else if (r === "morocco") rig.flyTo(shots.morocco, want ?? 2.55e6, { polar: 0.5, azimuth: 0.04, duration: 2.1, done });
    else if (r === "world") rig.flyTo(EARTH_CENTER, R_TOP + (want ?? 2.1e7), { polar: shots.worldPolar, azimuth: shots.worldAz, duration: 2.1, done });
    else rig.flyTo(EARTH_CENTER, R_TOP + MAX_ALT, { duration: 2.3, done });
  };
  /** true when the trip skips two rungs or more (then it is staged); `want` = altitude asked for the last rung */
  const travel = (to: Rung, want?: number) => {
    const from = rungOf(frame.alt), end = LADDER.indexOf(to);
    if (Math.abs(end - from) < 2) return false;
    const my = ++dive.current;
    const step = end > from ? 1 : -1;
    const legs: number[] = [];
    for (let i = from + step; step > 0 ? i <= end : i >= end; i += step) legs.push(i);
    const next = () => {
      if (my !== dive.current) return;
      const i = legs.shift();
      if (i === undefined) return;
      fly(LADDER[i], i === end ? want : undefined, legs.length ? next : undefined);
    };
    next();
    return true;
  };
  const focusNonce = useApp((s) => s.focusNonce);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const sel = useApp.getState().sel;
    if (sel?.kind === "overview") {
      if (walkBusy()) WALK_API.stop();
      st.current.intro = false; dive.current++;
      const id = sel.id as "hospital" | "morocco" | "world";
      if (!travel(id)) go(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNonce]);

  // intro: from space, dive into Morocco, then land on the typical hospital
  useLayoutEffect(() => {
    rig.flyTo(EARTH_CENTER, R_TOP + 2.6e7, { polar: shots.worldPolar, azimuth: shots.worldAz, transition: false });
    const s = st.current;
    const t1 = setTimeout(() => { if (s.intro) go("morocco", { duration: 3.2 }); }, 1200);
    const t2 = setTimeout(() => { if (s.intro) go("hospital", { duration: 3.6 }); }, 4700);
    const t3 = setTimeout(() => { s.intro = false; }, 8600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // wheel / trackpad: fast, smooth, about the point under the cursor (straight to the centre when orbiting the Earth)
  useEffect(() => {
    const el = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      if (walkBusy()) return; // walk mode: the wheel sets the third-person camera distance (walk/WalkWorld.tsx)
      const c = controls.current as unknown as (CameraControls & { _sphericalEnd: { radius: number }; _dollyInternal: (d: number, x: number, y: number) => void }) | null;
      if (!c) return;
      e.preventDefault();
      rig.cancel(); st.current.intro = false; dive.current++;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.2 && !e.ctrlKey) { c.rotate((-e.deltaX * Math.PI) / 1800, 0, true); return; }
      let dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (e.ctrlKey) dy *= PINCH;
      dy = Math.max(-240, Math.min(240, dy));
      const lnS = dy * SPEED * (e.shiftKey ? 0.35 : 1);
      const centre = c.getTarget(tmp.t).distanceTo(EARTH_CENTER) < 2e5;
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      // ground: the point under the cursor stays under it and the target stays on the ground (lib/rig.ts zoomAt);
      // globe: camera-controls' own dolly toward the Earth's centre
      if (centre) {
        c.dollyToCursor = false;
        // zooming in on the globe: turn it so Morocco comes under the camera by the hand-over altitude, where the view
        // lands on the flat map (it only covers Morocco: a hand-over above the Gulf would put the ground target 9 000 km away)
        if (lnS < 0) {
          const P = c.getPosition(tmp.p, true), r = P.distanceTo(EARTH_CENTER), a = r - R_TOP, a1 = a * Math.exp(lnS);
          const HI = 1.5e7, LO = PIVOT_OUT * 0.95, from = Math.min(a, HI);
          if (a1 < HI) {
            const w = from <= LO ? 1 : THREE.MathUtils.clamp(Math.log(from / a1) / Math.log(from / LO), 0, 1);
            const u = P.sub(EARTH_CENTER).normalize();
            const goal = tmp.d.set(shots.morocco.x, R_TOP, shots.morocco.z).normalize();
            const q = new THREE.Quaternion().setFromUnitVectors(u, goal);
            u.applyQuaternion(new THREE.Quaternion().slerp(q, w)).multiplyScalar(r).add(EARTH_CENTER);
            void c.setPosition(u.x, u.y, u.z, true);
            c.normalizeRotations();
          }
        }
        c._dollyInternal(lnS / -LN095, x, y);
      }
      else rig.zoomAt(Math.exp(lnS), x, y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [gl, tmp, shots]);

  // keyboard / nav-pad camera moves: orbit, tilt, pan (orbit the globe when the pivot is the Earth's centre), and "north up"
  useEffect(() => {
    const onOrbit = (e: Event) => {
      const c = controls.current; if (!c || walkBusy()) return;
      rig.cancel(); st.current.intro = false;
      const d = (e as CustomEvent<{ az?: number; pol?: number; panX?: number; panY?: number }>).detail || {};
      const centre = c.getTarget(tmp.t).distanceTo(EARTH_CENTER) < 2e5;
      if (d.az || d.pol) void c.rotate(d.az ?? 0, d.pol ?? 0, true);
      if (d.panX || d.panY) {
        if (centre) void c.rotate((d.panX ?? 0) * -0.18, (d.panY ?? 0) * -0.12, true);
        // ground: slide like a map (up = forward on the ground, not toward the sky)
        else { const k = c.distance * 0.12; void c.truck((d.panX ?? 0) * k, 0, true); void c.forward((d.panY ?? 0) * k, true); }
      }
    };
    const onNorth = () => {
      const c = controls.current; if (!c || walkBusy()) return;
      rig.cancel();
      const centre = c.getTarget(tmp.t).distanceTo(EARTH_CENTER) < 2e5;
      // ground: look north (camera south of the target) with a comfortable tilt; globe: north is already up, so bring Morocco back to the centre
      if (centre) rig.flyTo(EARTH_CENTER, c.distance, { polar: shots.worldPolar, azimuth: shots.worldAz, duration: 1.1 });
      else void c.rotateTo(0, Math.min(Math.max(c.polarAngle, 0.5), 1.05), true);
    };
    window.addEventListener("atlas:orbit", onOrbit);
    window.addEventListener("atlas:north", onNorth);
    return () => { window.removeEventListener("atlas:orbit", onOrbit); window.removeEventListener("atlas:north", onNorth); };
  }, [tmp]);

  // zoom slider / shortcuts / tour requests
  useEffect(() => {
    let last = 0;
    return useApp.subscribe((s) => {
      const cmd = s.zoomCmd, c = controls.current;
      if (!cmd || !c || cmd.nonce === last) return;
      last = cmd.nonce; st.current.intro = false; dive.current++;
      if (walkBusy()) WALK_API.stop();
      // a click on a rung of the zoom rail that skips rungs: staged travel, not a straight dive
      if (cmd.staged) {
        const to: Rung = cmd.g !== undefined ? "jabb" : (cmd.level as Rung);
        const want = cmd.value !== undefined && to !== "hospital" && to !== "jabb" ? bandAlt(cmd.level, cmd.value) : undefined;
        if (travel(to, want)) return;
      }
      // where the camera is going (a flight under way, or the damping's end state), so quick clicks add up and a slider
      // drag steers the flight it started instead of reading a mid-air state
      const a = rig.anim, T = new THREE.Vector3();
      let D: number, centre: boolean, polar: number, endAlt: number;
      if (a) {
        T.copy(a.T1); D = a.D1; centre = T.distanceTo(EARTH_CENTER) < 2e5; polar = a.P1;
        endAlt = centre ? D - R_TOP : T.y + D * Math.max(0.05, Math.cos(polar));
      } else {
        c.getTarget(T, true); const P = c.getPosition(tmp.q, true);
        D = Math.max(1e-3, P.distanceTo(T)); centre = T.distanceTo(EARTH_CENTER) < 2e5;
        polar = Math.acos(THREE.MathUtils.clamp((P.y - T.y) / D, -1, 1));
        endAlt = centre ? P.distanceTo(EARTH_CENTER) - R_TOP : Math.max(1, P.y);
      }
      let want = endAlt;
      let fast = false;
      if (cmd.g !== undefined) { want = gToAlt(cmd.g); fast = true; }
      else if (cmd.value !== undefined) want = bandAlt(cmd.level, cmd.value);
      else if (cmd.delta) want = endAlt * Math.exp(cmd.delta * 4.6);
      want = Math.min(MAX_ALT, Math.max(14, want));
      // slider drag (g): one short flight for a jump (longer for a longer jump), then each move steers it — no restart
      // from rest at every move
      const dur = fast ? Math.min(1.4, 0.5 + 0.1 * Math.abs(Math.log(want / endAlt))) : undefined, retarget = fast;
      // crossing between the ground and the globe is always a log-space flight: damping the target and the position
      // separately swung the view (≈ 50°) or dipped the camera under the ground
      const toCentre = centre ? want > PIVOT_OUT : want > PIVOT_IN;
      if (toCentre) {
        // rising off the map: straight up over where the camera is, so the framing carries on (the rungs of the rail keep
        // their curated world shot)
        const up = c.getPosition(tmp.q, true).sub(EARTH_CENTER).normalize();
        rig.flyTo(EARTH_CENTER, R_TOP + want, centre ? { duration: dur, retarget }
          : { polar: Math.acos(THREE.MathUtils.clamp(up.y, -1, 1)), azimuth: Math.atan2(up.x, up.z), duration: dur, cinematic: true });
      } else if (centre) {
        rig.flyTo(shots.morocco, want, { polar: want < 3000 ? 1.0 : 0.62, azimuth: 0.06, duration: dur, cinematic: true });
      } else {
        // descending from the Morocco view: glide towards Casablanca, like Google Maps homing in. The offset from the city
        // shrinks with the altitude between 600 km and 30 km, so it is gone at city scale — below that, zooming stays on
        // whatever you are looking at (it no longer pulls the view back to the typical hospital).
        const pa = fadeIn(endAlt, 3e4, 6e5);
        const w = want < endAlt && pa > 1e-3 ? 1 - fadeIn(want, 3e4, 6e5) / pa : 0;
        T.lerp(CASA, w);
        const pol = want < 3000 ? Math.max(polar, 0.9) : polar;
        rig.flyTo(T, D * (want / Math.max(endAlt, 1)), { duration: dur, polar: Math.min(pol, 1.2), retarget });
      }
    });
  }, [shots, tmp]);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const flying = rig.tick();
    const s = st.current;
    const cam = camera.position;
    // altitude: above the sphere when orbiting the Earth, above the flat map on the ground (the sphere would add the
    // Earth's curvature, ≈ 900 m at 100 km from Casablanca, and skew the slider and every level-of-detail switch)
    const sphereAlt = Math.max(1, cam.distanceTo(EARTH_CENTER) - R_TOP);
    const alt = c.getTarget(tmp.t).distanceTo(EARTH_CENTER) < 2e5 ? sphereAlt : Math.max(1, Math.min(sphereAlt, cam.y));
    frame.alt = alt;

    // pivot hand-over: ground ⇄ Earth centre (the view direction passes through both, so nothing swings)
    const tgt = c.getTarget(tmp.t);
    const centre = tgt.distanceTo(EARTH_CENTER) < 2e5;
    // only once the damping has settled: switching the pivot mid-glide would drop the rest of the glide (a visible jump)
    const settled = c.getPosition(tmp.q, true).distanceTo(cam) < 0.01 * alt;
    if (!flying && !s.dragging && settled && !walkBusy()) {
      // the up axis changes first, then the camera is re-aimed from where it is: the controls store angles relative to
      // the up axis, so re-aiming first and changing the axis after made the view swing (≈ 60° of tilt) at every hand-over
      if (!centre && alt > PIVOT_IN) {
        const pos = c.getPosition(tmp.p, true);
        camera.up.copy(POLE); c.updateCameraUp();
        void c.setLookAt(pos.x, pos.y, pos.z, EARTH_CENTER.x, EARTH_CENTER.y, EARTH_CENTER.z, false);
      } else if (centre && alt < PIVOT_OUT) {
        const pos = c.getPosition(tmp.p, true);
        const dir = tmp.d.copy(EARTH_CENTER).sub(pos).normalize();
        const k = dir.y < -1e-3 ? pos.y / -dir.y : alt;
        const hx = pos.x + dir.x * k, hz = pos.z + dir.z * k;
        camera.up.set(0, 1, 0); c.updateCameraUp();
        void c.setLookAt(pos.x, pos.y, pos.z, hx, 0, hz, false);
      }
    }
    // limits per pivot mode; at high altitude the ground view straightens up so the map flattens into the globe
    const centreNow = c.getTarget(tmp.t).distanceTo(EARTH_CENTER) < 2e5;
    if (walkBusy()) {
      // walk mode drives the camera itself; limits are restored on the next frame after it hands back
    } else if (centreNow) {
      c.minDistance = R_TOP + 1.8e6; c.maxDistance = R_TOP + MAX_ALT;
      c.minPolarAngle = 0; c.maxPolarAngle = Math.PI;
    } else {
      c.minDistance = 8; c.maxDistance = 4.6e6;
      c.minPolarAngle = 0;
      c.maxPolarAngle = flying ? Math.PI : THREE.MathUtils.lerp(1.42, 0.06, fadeIn(alt, 2.0e6, 3.4e6));
    }

    // contents by altitude
    if (hosp.current) hosp.current.visible = alt < 60_000;
    const m = 1 - fadeIn(alt, 2.5e6, 3.7e6);
    const g = fadeIn(alt, 1.6e6, 3.1e6);
    if (Math.abs(m - mapOp) > 0.02 || (m === 0) !== (mapOp === 0) || (m === 1) !== (mapOp === 1)) setMapOp(m);
    if (Math.abs(g - globeOp) > 0.02 || (g === 0) !== (globeOp === 0) || (g === 1) !== (globeOp === 1)) setGlobeOp(g);

    // Akdital easter egg: the Earth hides inside the top drop of the Akdital mark (components/nav/JabbEgg.tsx).
    // Scale: the Earth fills `fill` of the drop's head, so the opaque drop masks it (and its glow) far out.
    // Placement: far out the whole lockup is centred; zooming in slides the view to the drop, then dives through it.
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const rOnScreen = (d: number) => (Math.tan(Math.asin(Math.min(1, EARTH_R / d))) / tanH) * (size.height / 2);
    frame.earth.r = rOnScreen(cam.distanceTo(EARTH_CENTER));
    frame.egg = fadeIn(alt, EGG_IN, EGG_FULL);
    if (frame.egg > 0.001 && frame.eggW > 0) {
      // whole lockup ≈ half the screen width at the farthest zoom
      const fill = THREE.MathUtils.clamp((rOnScreen(R_TOP + MAX_ALT) * frame.eggW) / (EGG_DROP.r * 0.5 * size.width), 0.55, 0.8);
      const k = frame.earth.r / (EGG_DROP.r * fill);
      const t = Math.min(1, Math.max(0, (frame.egg - 0.35) / 0.6)), w = t * t * (3 - 2 * t);
      camera.setViewOffset(size.width, size.height, -frame.eggDX * k * w, -frame.eggDY * k * w, size.width, size.height);
      s.offset = true;
      frame.eggK = k;
    } else {
      frame.eggK = 0;
      if (s.offset) { camera.clearViewOffset(); s.offset = false; }
    }
    // Earth centre on screen, after the view offset
    const p = tmp.p.copy(EARTH_CENTER).project(camera);
    frame.earth.x = (p.x * 0.5 + 0.5) * size.width;
    frame.earth.y = (-p.y * 0.5 + 0.5) * size.height;
    frame.earth.visible = p.z < 1;

    // report to the store (slider, level-dependent UI, sounds)
    const now = performance.now();
    if (now - s.lastReport > 90) {
      s.lastReport = now;
      const app = useApp.getState();
      app.setZoom(altToG(alt));
      app.syncLevel(levelForAlt(alt), alt);
    }
  });

  return (
    <>
      <CameraControls ref={controls} makeDefault />
      <WalkWorld />
      <Lights />
      <Environment resolution={128} frames={1} environmentIntensity={0.3}>
        <Lightformer form="rect" intensity={2.2} color="#FFFFFF" position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#DCE6FF" position={[-14, 4, 6]} rotation-y={Math.PI / 2} scale={[20, 6, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#FFF3E6" position={[14, 4, -6]} rotation-y={-Math.PI / 2} scale={[20, 6, 1]} />
      </Environment>
      <CitySky />
      <Stars />
      <group ref={hosp}>
        <HospitalContent />
        {/* "Casa réel" (lib/geo/casaFrame): the georeferenced ground and districts instead of the procedural city */}
        {CASA_REEL ? <CasaReel /> : <CityContent />}
        <CityLandmarks />
        {!CASA_REEL && <CityPedestrians />}
      </group>
      {/* the map lies under the campus base (basement pit to −5.9 m) so the plaza never flickers against it */}
      <group position={[0, -6.5, 0]} scale={MAP_SCALE_M}>
        <MoroccoContent opacity={mapOp} />
      </group>
      <group position={gpos} quaternion={gq} scale={GLOBE_SCALE_M}>
        <GlobeContent opacity={globeOp} />
      </group>
    </>
  );
}

/** Key light with shadows over the campus + hemisphere fill, following the hospital's day/night time-lapse. */
function Lights() {
  const tgt = useMemo(() => new THREE.Object3D(), []);
  const key = useRef<THREE.DirectionalLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const warm = useMemo(() => ({ day: new THREE.Color("#FFF8EE"), dusk: new THREE.Color("#FFB07A"), night: new THREE.Color("#9FB2FF") }), []);
  useFrame(() => {
    const d = HOSPITAL_TIME.day;
    if (key.current) {
      key.current.intensity = 2.9 * (0.1 + 0.9 * d);
      key.current.color.copy(warm.night).lerp(warm.dusk, Math.min(1, d * 2)).lerp(warm.day, Math.max(0, d * 2 - 1));
    }
    if (hemi.current) hemi.current.intensity = 0.7 * (0.38 + 0.62 * d);
  });
  useLayoutEffect(() => { const l = key.current; if (l) { l.shadow.camera.updateProjectionMatrix(); l.shadow.needsUpdate = true; } }, []);
  return (
    <>
      <hemisphereLight ref={hemi} args={["#E9EEFF", "#2B3558", 0.7]} />
      <primitive object={tgt} position={[0, 0, -2]} />
      <directionalLight ref={key} target={tgt} position={[-52, 105, 62]} intensity={2.9} color="#FFF8EE" castShadow
        shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04}
        shadow-camera-left={-80} shadow-camera-right={80} shadow-camera-top={72} shadow-camera-bottom={-72} shadow-camera-near={20} shadow-camera-far={320} />
      <directionalLight position={[70, 40, -52]} intensity={0.3} color="#C9D5FF" />
    </>
  );
}

/** Deep-space stars, far beyond the Earth, fading in with altitude. */
function Stars() {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 3200, a = new Float32Array(n * 3), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) { v.randomDirection().multiplyScalar(1.2e9 + Math.random() * 1.2e9); a.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(a, 3)); return g;
  }, []);
  const mat = useMemo(() => new THREE.PointsMaterial({ color: "#C9D6FF", size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame(() => {
    const o = fadeIn(frame.alt, 4e5, 4e6) * 0.75;
    mat.opacity = o;
    if (pts.current) { pts.current.visible = o > 0.01; pts.current.position.copy(EARTH_CENTER); }
  });
  return <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />;
}
