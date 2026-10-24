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

type FlyOpts = {
  azimuth?: number; polar?: number; duration?: number; transition?: boolean; keepAngles?: boolean;
  /** called when the flight lands (not if it is cancelled or replaced) */ done?: () => void;
  /** a continuous input (zoom slider drag): a cinematic flight already under way is steered to the new goal instead of restarting from rest */
  retarget?: boolean;
  /** always the log-space flight, even for a short move (a hand-over between the ground and the Earth's centre) */
  cinematic?: boolean;
};
type Anim = {
  t0: number; dur: number;
  T0: THREE.Vector3; T1: THREE.Vector3; D0: number; D1: number;
  P0: number; P1: number; A0: number; A1: number;
  /** the pivot changes between the ground and the Earth's centre: the target moves with the distance, never ahead of it */
  cross: boolean;
  done?: () => void;
};

const _T = new THREE.Vector3(), _P = new THREE.Vector3(), _A = new THREE.Vector3(), _nT = new THREE.Vector3(), _nP = new THREE.Vector3(), _g = new THREE.Vector3();
const _cam = new THREE.PerspectiveCamera(), _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _sph = new THREE.Spherical();

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
  /** Steepest polar angle allowed at a given ground distance (the view straightens up as it rises toward the globe). */
  polarLimit: ((distance: number) => number) | null = null;
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
      if (o.retarget && this.anim) { this.anim.T1.copy(target); this.anim.D1 = distance; return; }
      const T0 = new THREE.Vector3(); c.getTarget(T0);
      const D0 = Math.max(1e-3, c.distance);
      const cur = this.angles(c);
      const A1 = o.azimuth ?? (o.keepAngles === false ? 0.6 : cur.azimuth);
      const P1 = o.polar ?? Math.min(Math.max(cur.polar, 0.35), 1.25);
      // camera up follows the destination (pole axis around the Earth, +Y on the ground). The controls keep their angles
      // relative to the up axis, so re-aim from the same position after the change, or the view swings for a frame.
      if (this.upFor) {
        const up = this.upFor(target);
        if (!c.camera.up.equals(up)) {
          const pos = c.getPosition(new THREE.Vector3(), true);
          c.camera.up.copy(up); c.updateCameraUp();
          void c.setLookAt(pos.x, pos.y, pos.z, T0.x, T0.y, T0.z, false);
        }
      }
      const ratio = Math.max(distance / D0, D0 / distance);
      const far = T0.distanceTo(target) / Math.max(distance, D0);
      if (o.transition === false) {
        const pos = new THREE.Vector3().setFromSphericalCoords(distance, P1, A1).add(target);
        void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
        o.done?.();
        return;
      }
      if (!o.cinematic && ratio < 6 && far < 3) {
        this.anim = null;
        const pos = new THREE.Vector3().setFromSphericalCoords(distance, P1, A1).add(target);
        void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true);
        c.normalizeRotations(); // the shortest way round, never a full spin after the user has orbited several turns
        if (o.done) setTimeout(o.done, 700); // camera-controls' own damping settles in ≈ 0.7 s
        return;
      }
      // log-space cinematic flight
      let A0 = cur.azimuth;
      const dA = ((A1 - A0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI; // shortest way round
      const dur = o.duration ?? Math.min(5.2, Math.max(1.2, 0.9 + 0.36 * Math.log(Math.max(ratio, 1 + far))));
      const cross = (T0.distanceTo(EARTH_CENTER) < 2e5) !== (target.distanceTo(EARTH_CENTER) < 2e5);
      this.anim = { t0: performance.now(), dur: dur * 1000, T0, T1: target.clone(), D0, D1: distance, P0: cur.polar, P1, A0, A1: A0 + dA, cross, done: o.done };
      this.onFlightStart?.();
    };
    if (this.controls) run(); else this.pending = run;
  }

  /**
   * Wheel / pinch over the ground: scale the view about the point under the cursor (on the horizontal plane through the
   * target), so that point stays under the cursor and the target stays on its plane — no drift into the sky. Computed on
   * the controls' end state, so fast wheel bursts add up exactly while camera-controls' damping keeps the motion smooth.
   * Held at the closest distance, zooming in keeps going as a glide toward the cursor at street level instead of stopping.
   * `scale` < 1 zooms in; x, y = cursor in normalised device coordinates.
   */
  zoomAt(scale: number, x: number, y: number) {
    const c = this.controls, cam = this.camera;
    if (!c || !cam) return;
    this.anim = null;
    const T = c.getTarget(_T, true), P = c.getPosition(_P, true);
    const dist = Math.max(1e-3, P.distanceTo(T));
    // the view as it will be once settled (camera-controls looks straight at its target)
    _cam.fov = cam.fov; _cam.aspect = cam.aspect; _cam.near = cam.near; _cam.far = cam.far; _cam.up.copy(cam.up);
    _cam.position.copy(P); _cam.lookAt(T); _cam.updateMatrixWorld(); _cam.updateProjectionMatrix();
    _ray.setFromCamera(_ndc.set(x, y), _cam);
    const A = _A.copy(T), dir = _ray.ray.direction;
    if (dir.y < -1e-4) {
      const k = (T.y - P.y) / dir.y;
      if (k > 0) {
        _ray.ray.at(k, A);
        // near the horizon the hit runs away: cap the anchor a few view-distances from the target
        const off = A.distanceTo(T), lim = 4 * dist;
        if (off > lim) A.sub(T).multiplyScalar(lim / off).add(T);
      }
    }
    const nd = THREE.MathUtils.clamp(dist * scale, c.minDistance, c.maxDistance), k = nd / dist;
    const nT = _nT.copy(T).sub(A).multiplyScalar(k).add(A);
    const nP = _nP.copy(P).sub(A).multiplyScalar(k).add(A);
    if (scale < 1 && k > scale) {
      const g = _g.set(A.x - P.x, 0, A.z - P.z), L = g.length();
      if (L > 1e-3) { g.multiplyScalar((Math.max(dist, 6) * 1.5 * (1 - scale / k)) / L); nT.add(g); nP.add(g); }
    }
    // camera-controls only enforces maxPolarAngle on rotations: straighten the view here, or a tilted zoom-out would stop
    // at the distance limit below the hand-over altitude and never reach the globe
    const lim = this.polarLimit?.(nd);
    if (lim !== undefined) {
      const v = _g.copy(nP).sub(nT), sp = _sph.setFromVector3(v);
      if (sp.phi > lim) { sp.phi = lim; nP.copy(nT).add(v.setFromSpherical(sp)); }
    }
    void c.setLookAt(nP.x, nP.y, nP.z, nT.x, nT.y, nT.z, true);
    c.normalizeRotations();
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
    const rise = a.cross ? 1 : 1 + Math.min(2.5, Math.log1p(lateral) * 0.9) * Math.sin(Math.PI * e);
    const D = Math.exp(Math.log(a.D0) + (Math.log(a.D1) - Math.log(a.D0)) * e) * rise;
    // the target moves in proportion to the distance change, so the camera never dives through the ground
    const span = Math.abs(a.D1 - a.D0);
    const Dn = D / rise;
    const s = span > 1e-6 && (lateral < 0.5 || a.cross) ? Math.min(1, Math.abs(Dn - a.D0) / span) : e;
    const T = new THREE.Vector3().lerpVectors(a.T0, a.T1, a.cross ? s : Math.max(s, e * e * e));
    const P = a.P0 + (a.P1 - a.P0) * e;
    const A = a.A0 + (a.A1 - a.A0) * e;
    const pos = new THREE.Vector3().setFromSphericalCoords(D, P, A).add(T);
    // landing from the globe: the target rises from the Earth's centre to the map; keep the camera above the map, eased in
    // with the target's progress so the start of the flight (anywhere around the globe) is untouched
    if (a.cross && a.T1.distanceTo(EARTH_CENTER) >= 2e5 && pos.y < 0.15 * D) pos.y += (0.15 * D - pos.y) * s;
    void c.setLookAt(pos.x, pos.y, pos.z, T.x, T.y, T.z, false);
    if (k >= 1) { this.anim = null; a.done?.(); }
    return true;
  }

  /** Current distance camera → target (metres). */
  get distance() { return this.controls?.distance ?? 0; }
}

export const rig = new Rig();
