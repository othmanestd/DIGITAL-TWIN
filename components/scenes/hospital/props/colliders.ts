// Walk-mode colliders of the hospital interior props (big items only: sofas, desks, cabinets, carts, the twin table,
// the screen wall, glass partitions… never cups or small objects). Read by components/scenes/walk/propSolids.ts.
//
// FRAME — FLOOR-LOCAL building coordinates, the frame of layout.ts parts:
//   · building: "main" | "annex"; floor: the floor index of lib/hospital (main −1 … 4, annex 0 … 3)
//   · x, z in metres from the building centre (main: MAIN.x/z, annex: ANNEX.x/z of lib/hospital), x toward the east
//     façade, z toward the front façade (+z = front, as in lib/hospital rects)
//   · axis-aligned box [x0, x1] × [z0, z1] (rotated items are given by their axis-aligned bounds)
//   · h  = top of the item above the floor surface (m); y0 = its bottom above the floor surface (absent = 0, on the floor)
//   · yr = timeline mask, present only for items of some stages: bit s = lib/model visualStage(year) = s
//          (0 today, 1 first wave, 2 scaling, 3 full deployment — with the 2026–2029 dataset, bit 0 = 2026 … bit 3 = 2029).
//          E.g. the holographic table of the full deployment has yr = 8; the plan table at the same spot yr = 7.
//          Absent = always. Test: !s.yr || (s.yr & (1 << visualStage(year))).
// Campus frame = floor-local + (BLD[building].x, BLD[building].z) (walk/plan.ts); world = campus + CAMPUS_OFFSET.
import { allProps } from "./rooms";

export type PropSolid = {
  building: "main" | "annex"; floor: number;
  x0: number; x1: number; z0: number; z1: number;
  h: number; y0?: number; yr?: number;
  kind: string;
};

function build(): PropSolid[] {
  const out: PropSolid[] = [];
  for (const fp of allProps()) {
    for (const s of fp.kit.solids) {
      const o: PropSolid = { building: fp.building, floor: fp.floor, x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, h: s.h, kind: s.kind };
      if (s.y0 !== undefined && s.y0 > 0) o.y0 = s.y0;
      if (s.yr !== undefined) o.yr = s.yr;
      out.push(o);
    }
  }
  return out;
}

/** All prop colliders (floor-local, see the header). */
export const propSolids: PropSolid[] = build();
