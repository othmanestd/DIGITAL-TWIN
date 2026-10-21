// Walk mode: the hospital interior props of components/scenes/hospital/props/** (another engineer's folder) as colliders.
// Their modules export `propSolids` (hospital-local coordinates per building and floor, see that folder's header).
// The folder may not exist yet: a require.context rooted at the existing hospital folder and filtered to the folder's
// entry module — props/index.ts (or solids.ts / propSolids.ts / colliders.ts) — is simply empty until that file appears,
// and Turbopack picks it up live (no import that could break the build, and no half-written generator pulled in).
// The adapter accepts the usual shapes; adjust `toBox` if their header documents something else.
//   · an array of solids carrying { building | b, floor | f, … }
//   · a record keyed "main:0" (or nested { main: { 0: [...] } }) of solids
//   · a solid: { x0, x1, z0, z1 } or { x, z, w | sx, d | sz, yaw? }, heights { y0, y1 }, { y, sy } or { h (top), y0? (bottom) },
//     optional `yr` year mask (bit 0 = 2026 …), as in hospital/props/kit.ts `Solid`
// Coordinates are taken as floor-local building coordinates (origin = building centre, y from the floor surface),
// the frame of layout.ts parts; they are converted here to the campus frame used by the walk colliders.
import { FLOOR_H } from "@/lib/hospital";
import { BLD, type BId } from "./plan";

export type PropBox = { building: BId; floor: number; cx: number; cz: number; hx: number; hz: number; yaw: number; y0: number; y1: number; yr: number };

type Ctx = { keys(): string[]; (id: string): Record<string, unknown> };
let ctx: Ctx | null = null;
try {
  // only the folder's entry / solids module: never every file (a half-written generator must not break the page)
  ctx = (require as unknown as { context: (d: string, r: boolean, re: RegExp) => Ctx }).context("../hospital", true, /^\.\/props\/(index|solids|propSolids|colliders)\.tsx?$/);
} catch { ctx = null; }

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function toBox(o: Record<string, unknown>, building: BId, floor: number): PropBox | null {
  const B = BLD[building];
  if (!B) return null;
  let cx: number, cz: number, hx: number, hz: number;
  const x0 = num(o.x0), x1 = num(o.x1), z0 = num(o.z0), z1 = num(o.z1);
  if (x0 !== undefined && x1 !== undefined && z0 !== undefined && z1 !== undefined) {
    cx = (x0 + x1) / 2; cz = (z0 + z1) / 2; hx = Math.abs(x1 - x0) / 2; hz = Math.abs(z1 - z0) / 2;
  } else {
    const x = num(o.x), z = num(o.z), w = num(o.w) ?? num(o.sx), d = num(o.d) ?? num(o.sz);
    if (x === undefined || z === undefined || w === undefined || d === undefined) return null;
    cx = x; cz = z; hx = w / 2; hz = d / 2;
  }
  let y0 = num(o.y0), y1 = num(o.y1);
  if (y0 === undefined || y1 === undefined) {
    const y = num(o.y), sy = num(o.sy), h = num(o.h);
    if (y !== undefined && sy !== undefined) { y0 = y - sy / 2; y1 = y + sy / 2; }
    else { y0 = num(o.y0) ?? 0; y1 = h ?? 1.2; }
  }
  const base = floor * FLOOR_H;
  return { building, floor, cx: B.x + cx, cz: B.z + cz, hx, hz, yaw: num(o.yaw) ?? 0, y0: base + y0, y1: base + y1, yr: num(o.yr) ?? 0 };
}

function collect(v: unknown, out: PropBox[], building?: BId, floor?: number) {
  if (!v) return;
  if (Array.isArray(v)) {
    for (const o of v) {
      if (!o || typeof o !== "object") continue;
      const r = o as Record<string, unknown>;
      const b = (r.building ?? r.b ?? building) as BId | undefined;
      const f = num(r.floor) ?? num(r.f) ?? floor;
      if (Array.isArray(r.solids)) { collect(r.solids, out, b, f); continue; }
      if (b && f !== undefined) { const box = toBox(r, b, f); if (box) out.push(box); }
    }
    return;
  }
  if (typeof v === "object") {
    for (const [k, sub] of Object.entries(v as Record<string, unknown>)) {
      const m = /^(main|annex):(-?\d+)$/.exec(k);
      if (m) collect(sub, out, m[1] as BId, Number(m[2]));
      else if (k === "main" || k === "annex") collect(sub, out, k, floor);
      else if (/^-?\d+$/.test(k)) collect(sub, out, building, Number(k));
    }
  }
}

let last: unknown[] = [];
let cache: PropBox[] = [];
/** Current prop solids (campus frame); `changed` tells the caller to rebuild its grid. */
export function hospitalPropSolids(): { boxes: PropBox[]; changed: boolean } {
  if (!ctx) return { boxes: cache, changed: false };
  const keys = ctx.keys();
  const srcs: unknown[] = [];
  for (const k of keys) {
    try { const m = ctx(k); if (m && "propSolids" in m) srcs.push(m.propSolids); } catch { /* a module still compiling */ }
  }
  const lens = srcs.map((s) => (Array.isArray(s) ? s.length : s && typeof s === "object" ? Object.keys(s).length : 0));
  const sig = [...srcs, ...lens];
  if (sig.length === last.length && sig.every((s, i) => s === last[i])) return { boxes: cache, changed: false };
  last = sig;
  const out: PropBox[] = [];
  for (const s of srcs) collect(s, out);
  cache = out;
  return { boxes: cache, changed: true };
}
