// Continuous "powers of ten" world: altitude bands, zoom mapping, and the shared per-frame state for DOM overlays.
import type { Level } from "./store";

export const MIN_ALT = 12;        // metres — closest view (inside a department)
export const MAX_ALT = 8e8;       // metres — the Earth is the dot of the JABB "J" (whole lockup fits the screen)

/** Altitude bands (metres) of each level, used by the zoom slider, shortcuts, level sync and fades. */
export const BANDS: Record<Level | "jabb", [number, number]> = {
  hospital: [MIN_ALT, 2_500],
  morocco: [2_500, 3_000_000],
  world: [3_000_000, 60_000_000],
  jabb: [60_000_000, MAX_ALT],
};

export const altToG = (a: number) => Math.min(1, Math.max(0, Math.log(a / MIN_ALT) / Math.log(MAX_ALT / MIN_ALT)));
export const gToAlt = (g: number) => MIN_ALT * Math.pow(MAX_ALT / MIN_ALT, Math.min(1, Math.max(0, g)));
export const levelForAlt = (a: number): Level => (a < BANDS.hospital[1] ? "hospital" : a < BANDS.world[0] ? "morocco" : "world");
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
  egg: 0,                                       // 0 … 1 visibility of the JABB easter egg
  eggW: 0,                                      // width of the one-line lockup, in J-mark units (measured by JabbEgg)
  eggDot: 32.7,                                 // x of the J's dot (= the Earth) inside the lockup, in J units
};
