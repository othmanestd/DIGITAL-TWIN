// The non-staff crowd (pure description): patients, visitors and families. Staff are never added here — staff counts
// follow staffing.ts. Drawn with the shared human kit (components/scenes/people/human.ts): `humanOf` turns a look into
// a full wardrobe (varied casual in lively but natural colours, djellabas, hijabs, gowns, children).
// Seated people sit exactly on a seat recognised in layout.ts or registered by a prop: root at the seat centre on the
// floor, hip at the seat top, facing the seat's way.
import { dress, type HumanLook } from "../../people/human";

export type Look = {
  torso: number; legs: number; skin: number; hair: number | null;
  long: boolean;   // djellaba / long robe
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

const SKIN = [0xefd3bb, 0xe7c3a4, 0xdcb08f, 0xd2a07c, 0xc48d69, 0xb07a57, 0x9a6546, 0x7e5137];
const HAIR = [0x2a2320, 0x3a2c24, 0x4b3a2d, 0x1e1a19, 0x6e625a, 0x5a4334];
const TOPS = [0x46536e, 0x8a7a64, 0x6f7d63, 0xa66f5f, 0x5d7896, 0xb7a58b, 0x7a5f6e, 0x3f4656, 0xc9b9a0, 0x94a3b8, 0x6b8a8a, 0x9c6b52, 0xd8cfc0];
const BOTTOMS = [0x2f3447, 0x3e465a, 0x5b5148, 0x6e675b, 0x41455a, 0x8b8272, 0x2a2e38];
const ROBES = [0xe9e3d6, 0xc9bda6, 0x8d8a7a, 0x5b6376, 0x7d6a58, 0xb9b2a5, 0x6f7f77];
const SCARVES = [0x8a9bb5, 0x6f5d6d, 0x5e7d6a, 0x4c5670, 0x7b2f3b, 0x3f6e66, 0xb7774e, 0x26272c, 0x9a7f9e, 0x8c3b4a, 0x34495e];

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

/** The kit wardrobe of a crowd look: the person's skin and hair, a headscarf in its colour, a djellaba, a gown or a child. */
export function humanOf(l: Look, seed: number): HumanLook {
  const h = dress(l.gown ? "patient" : "visitor", seed, { hijab: l.scarf || undefined, robe: l.long, gown: l.gown || undefined, kid: l.kid, skin: l.skin, hair: l.hair });
  if (l.scarf) h.hair = l.scarfCol;
  if (l.long && !l.gown) { h.top = h.bottom = h.sleeve = l.torso; }
  return h;
}
