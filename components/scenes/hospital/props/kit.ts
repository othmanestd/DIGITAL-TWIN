// Props kit: a tiny, pure (no three.js) description language for the hospital's detail props.
// Generators place "items" through a frame (position + yaw) and add primitive parts in item-local coordinates
// (x right, z forward = the way the item faces, y up from the floor surface). Everything is expressed in FLOOR-LOCAL
// coordinates (origin = building centre, y = 0 on the floor surface), exactly like layout.ts parts.
// The drawing side (geo.ts) merges static parts per floor and material; parts carrying a year mask or a desk id are
// instanced so they can fold away with the timeline (stages of lib/model visualStage). Seats, walkers and solids are collected for the crowd and walk mode.

/** Primitive shapes (unit sized, centred). quad = 1 × 1 plane facing +z (textured from an atlas). */
export type Prim = "box" | "rbox" | "cyl" | "cone" | "sph" | "hemi" | "quad" | "torus" | "disc";
/** Material classes, one per floor each: matte / satin plastics / brushed metal / clear glass / unlit glow (LEDs,
 *  status strips) / printed (atlas, matte) / screen (atlas, emissive). */
export type Mat = "matte" | "satin" | "metal" | "glass" | "glow" | "print" | "screen";

export type PP = {
  g: Prim; m: Mat; c: number;
  x: number; y: number; z: number;       // centre, floor-local
  yaw: number; pitch: number; roll: number;
  sx: number; sy: number; sz: number;
  t?: number;                            // cone: top radius ratio · torus: tube ratio
  uv?: [number, number, number, number]; // quad / box front face: atlas rect (u0, v0, u1, v1), v up
  hi?: boolean;                          // wall-mounted above the 1 m maquette walls: drawn in first person only
  yr?: number;                           // timeline mask: bit s = visualStage s (0 today … 3 full deployment); absent = always
  desk?: number;                         // layout desk id: folds away with its person (timeline staffing)
  ax: number; az: number;                // item anchor (fold centre)
  item: number;                          // item index (stagger of the year transitions)
};

export type Seat = { x: number; z: number; yaw: number; top: number; kind: "chair" | "row" | "arm" | "sofa" | "stool" | "bench" };
export type Solid = { x0: number; x1: number; z0: number; z1: number; h: number; y0?: number; yr?: number; kind: string };

/** Timeline stage of the 3D (lib/model visualStage): 0 today, 1 first wave, 2 scaling, 3 full deployment. */
export type Stage = 0 | 1 | 2 | 3;
export const STAGES: Stage[] = [0, 1, 2, 3];
export const stageBit = (s: number) => 1 << s;
/** stage mask from a list of stages */
export const stages = (...ss: Stage[]) => ss.reduce((a: number, v) => a | (1 << v), 0);
/** stage mask from `s` to the full deployment included */
export const fromStage = (s: Stage) => stages(...STAGES.filter((v) => v >= s));
/** stage mask from today to `s` included */
export const toStage = (s: Stage) => stages(...STAGES.filter((v) => v <= s));

// ---------------------------------------------------------------- calm palette (muted, never neon)
export const C = {
  white: 0xf3f4f7, wall: 0xf6f7fa, light: 0xdee2ea, mist: 0xe9ecf2, grey: 0x9aa3b4, mid: 0x7d8597, steel: 0xc2c8d3, chrome: 0xd9dde4,
  dark: 0x394155, ink: 0x262c3b, black: 0x1d222d,
  wood: 0xe4dbcd, oak: 0xc8ab86, walnut: 0x76593f, teak: 0x9b7653,
  fabric: 0x7b88a4, sand: 0xd9cdb8, linen: 0xefe9de, cream: 0xf4efe4, leather: 0x5a4436, cognac: 0x8a5a3c,
  carton: 0xd8cab2, curtain: 0xc9d6de, paper: 0xfaf8f3,
  leaf: 0x8fae88, leafDark: 0x6c8f6d, leafLight: 0xa9c19b, soil: 0x6b5a4a, pot: 0xe8e3da, terracotta: 0xc58a6c,
  medBlue: 0x86a9c9, medBlueDark: 0x5f86ad, medGreen: 0x8dbaa8, gown: 0xbacde1, mint: 0xcfe3dc,
  coral: 0xd58b7e, red: 0xb9584c, yellow: 0xe0c060, amber: 0xd9a75a, aed: 0x4f9c80, navy: 0x2e3a59, blueGrey: 0x5d6c8a,
  brass: 0xc2a26a, glass: 0xd3e3ef, water: 0xbcd9ec, bottle: 0xcfe6f2,
  ledGreen: 0x5fd3a6, ledBlue: 0x7d97ff, ledAmber: 0xe2b05a, ledRed: 0xd9776b, ledWhite: 0xeaf0ff, softBlue: 0x9fb6ff,
};
export const BINDERS = [0x5e7ba6, 0x8a97ad, 0x6e9a8a, 0xa8695f, 0xc9a45c, 0x4f5b75, 0xd2cbbd, 0x7f8fb0];
export const CLOTHES = [0x46536e, 0x8a7a64, 0x6f7d63, 0xa66f5f, 0x5d7896, 0xb7a58b, 0x7a5f6e, 0x3f4656, 0xc9b9a0, 0x94a3b8, 0x6b8a8a, 0x9c6b52];

// ---------------------------------------------------------------- builder
export type Extra = { yaw?: number; pitch?: number; roll?: number; t?: number; uv?: [number, number, number, number]; hi?: boolean; yr?: number };

export class Kit {
  parts: PP[] = [];
  seats: Seat[] = [];
  solids: Solid[] = [];
  private item = 0;
  /** defaults applied to every part added (layer, year mask, desk) */
  cur: { hi?: boolean; yr?: number; desk?: number } = {};

  /** An item frame at floor-local (x, z) facing yaw (forward = (sin yaw, cos yaw)); y0 lifts the whole item. */
  at(x: number, z: number, yaw = 0, y0 = 0): Frame {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const kit = this;
    const item = ++this.item;
    const P = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
    const add = (g: Prim, m: Mat, col: number, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, e: Extra = {}) => {
      const [px, pz] = P(lx, lz);
      kit.parts.push({
        g, m, c: col, x: px, y: y0 + ly, z: pz, yaw: yaw + (e.yaw ?? 0), pitch: e.pitch ?? 0, roll: e.roll ?? 0, sx, sy, sz,
        t: e.t, uv: e.uv, hi: e.hi ?? kit.cur.hi, yr: e.yr ?? kit.cur.yr, desk: kit.cur.desk, ax: x, az: z, item,
      });
    };
    const f: Frame = {
      x, z, yaw, y0, P, item,
      add,
      /** a frame nested in this one (offset in local coordinates, extra yaw, extra lift) */
      sub: (lx: number, lz: number, dyaw = 0, dy = 0) => { const [px, pz] = P(lx, lz); return kit.at(px, pz, yaw + dyaw, y0 + dy); },
      box: (m: Mat, col: number, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, e?: Extra) => add("box", m, col, lx, ly, lz, sx, sy, sz, e),
      rbox: (m: Mat, col: number, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, e?: Extra) => add("rbox", m, col, lx, ly, lz, sx, sy, sz, e),
      /** vertical cylinder of diameter d */
      cyl: (m: Mat, col: number, lx: number, ly: number, lz: number, d: number, h: number, e?: Extra) => add("cyl", m, col, lx, ly, lz, d, h, d, e),
      /** horizontal cylinder along local x */
      cylX: (m: Mat, col: number, lx: number, ly: number, lz: number, d: number, len: number, e?: Extra) => add("cyl", m, col, lx, ly, lz, d, len, d, { ...e, roll: Math.PI / 2 }),
      /** horizontal cylinder along local z */
      cylZ: (m: Mat, col: number, lx: number, ly: number, lz: number, d: number, len: number, e?: Extra) => add("cyl", m, col, lx, ly, lz, d, len, d, { ...e, pitch: Math.PI / 2 }),
      sph: (m: Mat, col: number, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, e?: Extra) => add("sph", m, col, lx, ly, lz, sx, sy, sz, e),
      /** textured quad facing the item's forward (+z), uv rect from an atlas */
      quad: (m: Mat, uv: [number, number, number, number], lx: number, ly: number, lz: number, w: number, h: number, e?: Extra) => add("quad", m, 0xffffff, lx, ly, lz, w, h, 1, { ...e, uv }),
      seat: (lx: number, lz: number, top: number, kind: Seat["kind"], dyaw = 0) => { const [px, pz] = P(lx, lz); kit.seats.push({ x: px, z: pz, yaw: yaw + dyaw, top: y0 + top, kind }); },
      /** collider: local box [lx0, lx1] × [lz0, lz1] (any rotation → its axis-aligned bounds), height h */
      solid: (lx0: number, lx1: number, lz0: number, lz1: number, h: number, kind: string, e: { y0?: number; yr?: number } = {}) => {
        const pts = [P(lx0, lz0), P(lx1, lz0), P(lx0, lz1), P(lx1, lz1)];
        kit.solids.push({
          x0: Math.min(...pts.map((p) => p[0])), x1: Math.max(...pts.map((p) => p[0])),
          z0: Math.min(...pts.map((p) => p[1])), z1: Math.max(...pts.map((p) => p[1])),
          h: y0 + h, y0: e.y0 !== undefined ? y0 + e.y0 : y0 > 0 ? y0 : undefined, yr: e.yr ?? kit.cur.yr, kind,
        });
      },
    };
    return f;
  }

  /** run `fn` with defaults (layer / year mask / desk) applied to every part it adds */
  with<T>(d: { hi?: boolean; yr?: number; desk?: number }, fn: () => T): T {
    const prev = this.cur;
    this.cur = { ...prev, ...d };
    try { return fn(); } finally { this.cur = prev; }
  }
}
type Sz = (m: Mat, col: number, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, e?: Extra) => void;
type Cy = (m: Mat, col: number, lx: number, ly: number, lz: number, d: number, h: number, e?: Extra) => void;
/** An item frame: parts are added in item-local coordinates (x right, z forward, y up). */
export interface Frame {
  x: number; z: number; yaw: number; y0: number; item: number;
  P: (lx: number, lz: number) => [number, number];
  add: (g: Prim, m: Mat, col: number, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, e?: Extra) => void;
  sub: (lx: number, lz: number, dyaw?: number, dy?: number) => Frame;
  box: Sz; rbox: Sz; sph: Sz;
  cyl: Cy; cylX: Cy; cylZ: Cy;
  quad: (m: Mat, uv: [number, number, number, number], lx: number, ly: number, lz: number, w: number, h: number, e?: Extra) => void;
  seat: (lx: number, lz: number, top: number, kind: Seat["kind"], dyaw?: number) => void;
  solid: (lx0: number, lx1: number, lz0: number, lz1: number, h: number, kind: string, e?: { y0?: number; yr?: number }) => void;
}

// ---------------------------------------------------------------- deterministic randomness (same as layout.ts)
export function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** direction (du, dv) → yaw, forward = (sin yaw, cos yaw) */
export const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);
