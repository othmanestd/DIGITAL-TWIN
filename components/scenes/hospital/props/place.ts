// Free-spot finder: places an item against a department wall where it overlaps nothing — the furniture of layout.ts,
// the props already added, people (standing spots and walking lanes) and the approach zone of every door.
import { DEPT } from "@/lib/hospital";
import type { FloorLayout } from "../layout";
import { layoutBoxes, features } from "./discover";
import type { Kit, PP } from "./kit";

type Box = [number, number, number, number]; // x0, x1, z0, z1

function partBox(p: PP): Box {
  const c = Math.abs(Math.cos(p.yaw)), s = Math.abs(Math.sin(p.yaw));
  let sx = p.sx, sz = p.sz;
  if (p.g === "quad") sz = 0.01;
  if (p.pitch && Math.abs(Math.abs(p.pitch) - Math.PI / 2) < 0.01) { const t = sz; sz = p.sy; void t; }
  if (p.roll && Math.abs(Math.abs(p.roll) - Math.PI / 2) < 0.01) sx = p.sy;
  const hx = (c * sx + s * sz) / 2, hz = (s * sx + c * sz) / 2;
  return [p.x - hx, p.x + hx, p.z - hz, p.z + hz];
}
const overlap = (a: Box, b: Box, m = 0) => a[0] < b[1] + m && a[1] > b[0] - m && a[2] < b[3] + m && a[3] > b[2] - m;

function segBoxDist(x1: number, z1: number, x2: number, z2: number, b: Box) {
  // distance from a segment to a box (sampled; paths are short)
  let best = Infinity;
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
    const dx = Math.max(b[0] - x, 0, x - b[1]), dz = Math.max(b[2] - z, 0, z - b[3]);
    best = Math.min(best, Math.hypot(dx, dz));
  }
  return best;
}

export class Placer {
  private fixed: Box[] = [];
  private walls: Box[] = [];
  private keep: Box[] = [];                       // zones to keep clear (doors, lanes)
  private lanes: [number, number, number, number, number][] = [];
  private stands: [number, number][] = [];
  private kitFrom = 0;
  private dyn: Box[] = [];
  constructor(public fl: FloorLayout, public kit: Kit) {
    for (const [x0, x1, z0, z1, top, p] of layoutBoxes(fl)) {
      if (top < 0.05) continue;
      if (p.m === "wall" && Math.min(p.sx, p.sz) <= 0.13) { this.walls.push([x0, x1, z0, z1]); continue; }
      this.fixed.push([x0, x1, z0, z1]);
    }
    for (const p of fl.people) {
      if (p.slot.path) { const [a, b, c, d] = p.slot.path; this.lanes.push([a, b, c, d, 0.55]); }
      else this.stands.push([p.slot.x, p.slot.z]);
    }
    for (const d of features(fl).doors) {
      const half = d.w / 2 + 0.25, deep = 1.5;
      // both sides of the door
      if (d.along === "x") this.keep.push([d.x - half, d.x + half, d.z - deep, d.z + deep]);
      else this.keep.push([d.x - deep, d.x + deep, d.z - half, d.z + half]);
    }
  }
  /** keep a walking lane clear (my own walkers) */
  lane(x1: number, z1: number, x2: number, z2: number, r = 0.55) { this.lanes.push([x1, z1, x2, z2, r]); }
  /** keep a zone clear */
  clear(x0: number, x1: number, z0: number, z1: number) { this.keep.push([x0, x1, z0, z1]); }
  private sync() {
    const P = this.kit.parts;
    for (let i = this.kitFrom; i < P.length; i++) {
      const p = P[i];
      if (p.hi || p.y - p.sy / 2 > 1.3) continue;
      if (p.g === "quad" && Math.abs(p.pitch) > 1) continue; // rugs
      this.dyn.push(partBox(p));
    }
    this.kitFrom = P.length;
  }
  /** restrict the tests to a region (set by spot / around for the duration of a search) */
  private region: { fixed: Box[]; walls: Box[]; dyn: Box[]; keep: Box[]; stands: [number, number][]; lanes: [number, number, number, number, number][] } | null = null;
  private focus(b: Box | null) {
    if (!b) { this.region = null; return; }
    this.sync();
    const m = 1.0, inB = (x: Box) => overlap(x, b, m);
    this.region = {
      fixed: this.fixed.filter(inB), walls: this.walls.filter(inB), dyn: this.dyn.filter(inB), keep: this.keep.filter(inB),
      stands: this.stands.filter(([x, z]) => x > b[0] - m && x < b[1] + m && z > b[2] - m && z < b[3] + m),
      lanes: this.lanes.filter(([a, c, d, e, r]) => Math.max(a, d) > b[0] - m - r && Math.min(a, d) < b[1] + m + r && Math.max(c, e) > b[2] - m - r && Math.min(c, e) < b[3] + m + r),
    };
  }
  /** is the axis-aligned footprint free? */
  free(b: Box, m = 0.05) {
    if (!this.region) this.sync();
    const R = this.region ?? { fixed: this.fixed, walls: this.walls, dyn: this.dyn, keep: this.keep, stands: this.stands, lanes: this.lanes };
    for (const f of R.fixed) if (overlap(b, f, m)) return false;
    for (const f of R.walls) if (overlap(b, f, -0.005)) return false;
    for (const f of R.dyn) if (overlap(b, f, m)) return false;
    for (const k of R.keep) if (overlap(b, k, 0)) return false;
    for (const [x, z] of R.stands) if (x > b[0] - 0.45 && x < b[1] + 0.45 && z > b[2] - 0.45 && z < b[3] + 0.45) return false;
    for (const [a, c, d, e, r] of R.lanes) if (segBoxDist(a, c, d, e, b) < r) return false;
    return true;
  }
  /**
   * Find a spot against a wall of `dept` for an item w wide (along the wall) × d deep. Returns the frame of the item's
   * front face centre (facing into the room), or null. sides: preferred wall sides, near: preferred point.
   */
  spot(dept: string, w: number, d: number, o: { sides?: ("inner" | "outer" | "w" | "e")[]; near?: [number, number]; gap?: number; inset?: number } = {}) {
    const D = DEPT[dept];
    if (!D) return null;
    const [cx, cz, W, DD] = D.rect;
    const s = D.building === "annex" || Math.abs(cz) < 0.01 ? 1 : cz < 0 ? 1 : -1;
    const wallOff = 0.07 + (o.gap ?? 0.02);
    const sides = o.sides ?? ["outer", "w", "e", "inner"];
    const cands: { x: number; z: number; yaw: number; box: Box; score: number }[] = [];
    sides.forEach((side, si) => {
      const inset = o.inset ?? 0.6;
      if (side === "inner" || side === "outer") {
        const zw = cz + (side === "inner" ? 1 : -1) * (DD / 2) * s;
        const nz = side === "inner" ? -s : s;                 // into the room
        for (let x = cx - W / 2 + inset + w / 2; x <= cx + W / 2 - inset - w / 2 + 1e-6; x += 0.25) {
          const zf = zw + nz * (wallOff + d);                 // front face
          const box: Box = [x - w / 2, x + w / 2, Math.min(zf, zw + nz * wallOff), Math.max(zf, zw + nz * wallOff)];
          cands.push({ x, z: zf, yaw: Math.atan2(0, nz), box, score: si * 100 + (o.near ? Math.hypot(x - o.near[0], zf - o.near[1]) : 0) });
        }
      } else {
        const xw = cx + (side === "e" ? 1 : -1) * (W / 2);
        const nx = side === "e" ? -1 : 1;
        for (let z = cz - DD / 2 + inset + w / 2; z <= cz + DD / 2 - inset - w / 2 + 1e-6; z += 0.25) {
          const xf = xw + nx * (wallOff + d);
          const box: Box = [Math.min(xf, xw + nx * wallOff), Math.max(xf, xw + nx * wallOff), z - w / 2, z + w / 2];
          cands.push({ x: xf, z, yaw: Math.atan2(nx, 0), box, score: si * 100 + (o.near ? Math.hypot(xf - o.near[0], z - o.near[1]) : 0) });
        }
      }
    });
    cands.sort((a, b) => a.score - b.score);
    this.focus([cx - W / 2, cx + W / 2, cz - DD / 2, cz + DD / 2]);
    try { for (const c of cands) if (this.free(c.box)) return { x: c.x, z: c.z, yaw: c.yaw }; } finally { this.focus(null); }
    return null;
  }
  /** a free-standing spot near a point (searches a small spiral); returns the centre */
  around(x: number, z: number, w: number, d: number, yaw = 0, R = 2.5) {
    const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
    const hx = (c * w + s * d) / 2, hz = (s * w + c * d) / 2;
    for (let r = 0; r <= R; r += 0.25) {
      const n = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 0.35);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (this.free([px - hx, px + hx, pz - hz, pz + hz])) return { x: px, z: pz, yaw };
      }
    }
    return null;
  }
}
