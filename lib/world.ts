// Continuous "powers of ten" world: altitude bands, zoom mapping, and the shared per-frame state for DOM overlays.
import type { Level } from "./store";

export const MIN_ALT = 12;        // metres — closest view (inside a department)
export const MAX_ALT = 4e8;       // metres — the Earth hides inside the top drop of the Akdital mark (whole lockup centred)

/** Altitude bands (metres) of each level, used by the zoom slider, shortcuts, level sync and fades. */
export const BANDS: Record<Level | "jabb", [number, number]> = {
  hospital: [MIN_ALT, 2_500],
  // the 3D city of Casablanca: up to 60 km, then the Morocco map takes over (the Morocco band keeps its lower bound for
  // the band values its slider rungs and the assistant already use)
  city: [2_500, 60_000],
  morocco: [2_500, 3_000_000],
  world: [3_000_000, 60_000_000],
  jabb: [60_000_000, MAX_ALT],
};

export const altToG = (a: number) => Math.min(1, Math.max(0, Math.log(a / MIN_ALT) / Math.log(MAX_ALT / MIN_ALT)));
export const gToAlt = (g: number) => MIN_ALT * Math.pow(MAX_ALT / MIN_ALT, Math.min(1, Math.max(0, g)));
/** `nearHospital`: the view is on a hospital (the typical one or a modelled establishment); elsewhere low altitudes are
 *  the city of Casablanca. */
export const levelForAlt = (a: number, nearHospital = true): Level =>
  a < BANDS.hospital[1] && nearHospital ? "hospital" : a < BANDS.city[1] ? "city" : a < BANDS.world[0] ? "morocco" : "world";
/** value 0..1 inside a band → altitude */
export const bandAlt = (b: keyof typeof BANDS, v: number) => { const [lo, hi] = BANDS[b]; return lo * Math.pow(hi / lo, Math.min(1, Math.max(0, v))); };

/** smoothstep on log10(altitude): 0 below a, 1 above b */
export function fadeIn(alt: number, a: number, b: number) {
  const x = (Math.log10(alt) - Math.log10(a)) / (Math.log10(b) - Math.log10(a));
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

/** Written every frame by the 3D scene, read by DOM overlays (no React re-render). */
export const frame = {
  alt: 300,
  earth: { x: 0, y: 0, r: 0, visible: false }, // Earth centre and radius on screen (CSS px, relative to the stage)
  egg: 0,                                       // 0 … 1 progress of the Akdital easter egg (1 = whole logo, Earth hidden)
  eggW: 0,                                      // lockup width, in Akdital-mark units (measured by JabbEgg)
  eggDX: 0, eggDY: 0,                           // top drop centre relative to the lockup centre, in mark units
  eggK: 0,                                      // px per mark unit this frame (set by the scene, 0 = egg off)
  // walking character (walk mode): world metres, written by the walk controller, read by traffic so cars brake for it
  player: { active: false, x: 0, y: 0, z: 0, heading: 0 },
};

/** Akdital mark (620 × 620): its top drop's round head, where the Earth hides. */
export const EGG_DROP = { x: 310, y: 186, r: 82 };
/** Egg progress by altitude: starts just past the world view, whole logo from EGG_FULL. */
export const EGG_IN = 9e7, EGG_FULL = 3e8;
