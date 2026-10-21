// The non-staff crowd (pure description): patients, visitors and families. Staff are never added here — staff counts
// follow staffing.ts. Same figure proportions and palette family as People.tsx (calm, muted clothing).
// Seated people sit exactly on a seat recognised in layout.ts or registered by a prop: root at the seat centre,
// hip at the seat top, facing the seat's way.

export type Look = {
  torso: number; legs: number; skin: number; hair: number | null;
  long: boolean;   // djellaba / long robe (coat-like torso to the knees)
  scarf: boolean;  // headscarf (covers the hair and the neck)
  scarfCol: number;
  gown: boolean;   // patient gown
  kid: boolean;    // a child (scaled down)
};
export type Member = { look: Look; dx: number; dz: number; role: "walk" | "wheel" | "push" | "iv" };
export type Walker = { path: [number, number, number, number]; speed: number; phase: number; members: Member[] };
export type Seated = { x: number; z: number; yaw: number; top: number; act: "rest" | "phone" | "talk" | "read" | "cup" | "baby" | "child"; look: Look; seed: number };
export type Standing = { x: number; z: number; yaw: number; act: "idle" | "talk" | "cup" | "phone"; look: Look; seed: number };
export type CrowdSpec = { seated: Seated[]; standing: Standing[]; walkers: Walker[] };

const SKIN = [0xe7cbb2, 0xd6ae8e, 0xc08f6e, 0xa47658, 0xebd3bd, 0xcfa382];
const HAIR = [0x2a2320, 0x3a2c24, 0x4b3a2d, 0x1e1a19, 0x6e625a, 0x5a4334];
const TOPS = [0x46536e, 0x8a7a64, 0x6f7d63, 0xa66f5f, 0x5d7896, 0xb7a58b, 0x7a5f6e, 0x3f4656, 0xc9b9a0, 0x94a3b8, 0x6b8a8a, 0x9c6b52, 0xd8cfc0];
const BOTTOMS = [0x2f3447, 0x3e465a, 0x5b5148, 0x6e675b, 0x41455a, 0x8b8272, 0x2a2e38];
const ROBES = [0xe9e3d6, 0xc9bda6, 0x8d8a7a, 0x5b6376, 0x7d6a58, 0xb9b2a5, 0x6f7f77];
const SCARVES = [0xc8b6a6, 0x8a9bb5, 0x6f5d6d, 0xb38d7e, 0x9fae9a, 0xd9cfc2, 0x4c5670];

function pick<T>(a: T[], v: number) { return a[Math.floor(v * a.length) % a.length]; }
function mix(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function lookFor(seed: number, o: Partial<Look> = {}): Look {
  const r = mix(seed);
  const long = o.long ?? false, gown = o.gown ?? false;
  const torso = gown ? 0xbacde1 : long ? pick(ROBES, r()) : pick(TOPS, r());
  const legs = gown ? 0xc9d3e0 : long ? torso : pick(BOTTOMS, r());
  return {
    torso, legs, skin: pick(SKIN, r()), hair: r() < 0.9 ? pick(HAIR, r()) : null,
    long, scarf: o.scarf ?? false, scarfCol: pick(SCARVES, r()), gown, kid: o.kid ?? false,
  };
}
