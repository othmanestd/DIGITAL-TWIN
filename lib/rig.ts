"use client";
// The single camera rig shared by every 3D content (hospital, Morocco map, globe) in the continuous "powers of ten" world.
// Contents never own camera controls: they compute a WORLD-space target and ask the rig to fly there.
//   import { rig } from "@/lib/rig";
//   const p = new THREE.Vector3(); myMesh.getWorldPosition(p); rig.flyTo(p, 40);
//   rig.fitBox(new THREE.Box3().setFromObject(group), { padding: 0.25 });
// World scale: 1 unit = 1 metre. The typical hospital sits at the origin (Casablanca), the Morocco map around it,
// the Earth's centre at (0, -EARTH_R - GLOBE_DROP, 0).
// Long moves (distance ratio > 6) are animated in log space — a continuous "powers of ten" zoom — instead of the
// linear damping of camera-controls, so the hospital visibly shrinks into Morocco and Morocco into the globe.
import * as THREE from "three";
import type { CameraControls } from "@react-three/drei";

export const EARTH_R = 6_371_000;   // metres
export const GLOBE_DROP = 60_000;   // the globe sits just under the map slab (no z-fighting at Casablanca)
export const EARTH_CENTER = new THREE.Vector3(0, -EARTH_R - GLOBE_DROP, 0);

type FlyOpts = { azimuth?: number; polar?: number; duration?: number; transition?: boolean; keepAngles?: boolean; /** called when the flight lands (not if it is cancelled or replaced) */ done?: () => void };
type Anim = {
  t0: number; dur: number;
  T0: THREE.Vector3; T1: THREE.Vector3; D0: number; D1: number;
  P0: number; P1: number; A0: number; A1: number;
  done?: () => void;
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

class Rig {
  controls: CameraControls | null = null;
  camera: THREE.PerspectiveCamera | null = null;
  anim: Anim | null = null;
  private pending: (() => void) | null = null;
  /** Called by the unified scene every frame. */
  onFlightStart: (() => void) | null = null;
  /** Camera up for a given target (the unified scene orbits the Earth around its polar axis). */
  upFor: ((target: THREE.Vector3) => THREE.Vector3) | null = null;
  /** World-frame polar / azimuth of the camera around its current target (independent of camera.up). */
  private angles(c: CameraControls) {
    const t = new THREE.Vector3(); c.getTarget(t);
    const v = new THREE.Vector3().copy(c.camera.position).sub(t);
    const s = new THREE.Spherical().setFromVector3(v);
    return { polar: s.phi, azimuth: s.theta };
  }

  attach(c: CameraControls | null, cam?: THREE.PerspectiveCamera) {
    this.controls = c;
    if (cam) this.camera = cam;
    if (c && this.pending) { const p = this.pending; this.pending = null; p(); }
  }

  get flying() { return !!this.anim; }
  cancel() { this.anim = null; }

  /** Fly so that `target` (world) is centred at `distance` metres. Angles in radians (azimuth around Y, polar from +Y). */
  flyTo(target: THREE.Vector3, distance: number, o: FlyOpts = {}) {
    const run = () => {
      const c = this.controls!;
      const T0 = new THREE.Vector3(); c.getTarget(T0);
      const D0 = Math.max(1e-3, c.distance);
      const cur = this.angles(c);
      const A1 = o.azimuth ?? (o.keepAngles === false ? 0.6 : cur.azimuth);
      const P1 = o.polar ?? Math.min(Math.max(cur.polar, 0.35), 1.25);
      // camera up follows the destination (pole axis around the Earth, +Y on the ground)
      if (this.upFor) { const up = this.upFor(target); if (!c.camera.up.equals(up)) { c.camera.up.copy(up); c.updateCameraUp(); } }
      const ratio = Math.max(distance / D0, D0 / distance);
      const far = T0.distanceTo(target) / Math.max(distance, D0);
      if (o.transition === false) {
        const pos = new THREE.Vector3().setFromSphericalCoords(distance, P1, A1).add(target);
        void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
        o.done?.();
        return;
      }
      if (ratio < 6 && far < 3) {
        this.anim = null;
        const pos = new THREE.Vector3().setFromSphericalCoords(distance, P1, A1).add(target);
        void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
        if (o.done) setTimeout(o.done, 700); // camera-controls' own damping settles in ≈ 0.7 s
        return;
      }
      // log-space cinematic flight
      let A0 = cur.azimuth;
      const dA = ((A1 - A0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // shortest way round
      const dur = o.duration ?? Math.min(5.2, Math.max(1.2, 0.9 + 0.36 * Math.log(Math.max(ratio, 1 + far))));
      this.anim = { t0: performance.now(), dur: dur * 1000, T0, T1: target.clone(), D0, D1: distance, P0: cur.polar, P1, A0, A1: A0 + dA, done: o.done };
      this.onFlightStart?.();
    };
    if (this.controls) run(); else this.pending = run;
  }

  /** Frame a world-space box (keeps the current viewing angles unless given). */
  fitBox(box: THREE.Box3, o: FlyOpts & { padding?: number } = {}) {
    const c = new THREE.Vector3(), s = new THREE.Vector3();
    box.getCenter(c); box.getSize(s);
    const r = s.length() / 2;
    const fov = ((this.camera?.fov ?? 38) * Math.PI) / 180;
    const aspect = this.camera?.aspect ?? 16 / 9;
    const fit = Math.max(r / Math.sin(fov / 2), r / Math.sin(Math.atan(Math.tan(fov / 2) * aspect)));
    this.flyTo(c, fit * (1 + (o.padding ?? 0.15)), o);
  }

  /** Advance a cinematic flight; returns true while flying. */
  tick(): boolean {
    const a = this.anim, c = this.controls;
    if (!a || !c) return false;
    const k = Math.min(1, (performance.now() - a.t0) / a.dur);
    const e = ease(k);
    // log-space distance + a gentle "rise" when the flight also travels sideways (Google-Maps-like arc)
    const lateral = a.T0.distanceTo(a.T1) / Math.max(a.D0, a.D1);
    const rise = 1 + Math.min(2.5, Math.log1p(lateral) * 0.9) * Math.sin(Math.PI * e);
    const D = Math.exp(Math.log(a.D0) + (Math.log(a.D1) - Math.log(a.D0)) * e) * rise;
    // the target moves in proportion to the distance change, so the camera never dives through the ground
    const span = Math.abs(a.D1 - a.D0);
    const Dn = D / rise;
    const s = span > 1e-6 && lateral < 0.5 ? Math.min(1, Math.abs(Dn - a.D0) / span) : e;
    const T = new THREE.Vector3().lerpVectors(a.T0, a.T1, Math.max(s, e * e * e));
    const P = a.P0 + (a.P1 - a.P0) * e;
    const A = a.A0 + (a.A1 - a.A0) * e;
    const pos = new THREE.Vector3().setFromSphericalCoords(D, P, A).add(T);
    void c.setLookAt(pos.x, pos.y, pos.z, T.x, T.y, T.z, false);
    if (k >= 1) { this.anim = null; a.done?.(); }
    return true;
  }

  /** Current distance camera → target (metres). */
  get distance() { return this.controls?.distance ?? 0; }
}

export const rig = new Rig();
