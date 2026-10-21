// Shared daylight state of the city layer: written once per frame by <CitySky/>, read by the landmarks, the pedestrians and
// the sky itself. Pure data (no React). 1 unit = 1 m, y up, map north = −Z.
import * as THREE from "three";

/** Direction of the key light of UnifiedWorld (its position (−52, 105, 62) relative to its target (0, 0, −2)). */
export const KEY_DIR = new THREE.Vector3(-52, 105, 64).normalize();
export const KEY_EL = Math.asin(KEY_DIR.y);
export const KEY_AZ = Math.atan2(KEY_DIR.x, KEY_DIR.z);

export const ENV = {
  /** time-lapse daylight, 1 = day … 0 = night (HOSPITAL_TIME.day, or the QA override below) */
  day: 1,
  night: 0,
  /** unit vector towards the sun (world) and its elevation in radians */
  sun: new THREE.Vector3().copy(KEY_DIR),
  sunEl: KEY_EL,
  /** camera altitude above the ground (m) */
  alt: 300,
  /** screenshot QA only: window.__sky.day = 0…1 pins the sky / landmark daylight (null = follow the time-lapse) */
  dev: { day: null as number | null },
};
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __sky: unknown }).__sky = ENV.dev;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
/** smoothstep on log10(altitude): 0 below a, 1 above b (same law as lib/world fadeIn) */
export const lfade = (alt: number, a: number, b: number) => smooth(Math.log10(a), Math.log10(b), Math.log10(Math.max(alt, 1)));

/** Sun elevation (rad) for a daylight value: the day's peak is the key light's elevation, the horizon is crossed at day = 0.5
 *  (where the key light is at its most orange), and the sun is a few degrees below it at night. */
export function sunElevation(day: number) {
  const lo = THREE.MathUtils.degToRad(-15), mid = THREE.MathUtils.degToRad(1.5);
  if (day >= 0.5) return mid + (KEY_EL - mid) * smooth(0, 1, (day - 0.5) / 0.5);
  return lo + (mid - lo) * smooth(0, 1, day / 0.5);
}
/** Sun direction for a daylight value (the azimuth of the key light stays put). */
export function sunDirection(day: number, out: THREE.Vector3) {
  const e = sunElevation(day), c = Math.cos(e);
  return out.set(Math.sin(KEY_AZ) * c, Math.sin(e), Math.cos(KEY_AZ) * c);
}

/** Deterministic random generator (mulberry32). */
export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
