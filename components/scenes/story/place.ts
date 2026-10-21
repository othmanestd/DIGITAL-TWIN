// Free-space placement of the story's set pieces. The maquette keeps being furnished (layout.ts, props/**), so the
// story never trusts fixed coordinates for its larger groups (Youssef's desk and the queue, the chiller, Hicham's and
// Leïla's desks): each group has an anchor, a footprint and a department; at first use it is slid to the nearest spot
// where its footprint touches no furniture, no wall, no prop and no seated or standing figure. Read-only use of the
// layout and of the prop colliders; computed once per group.
import { DEPT, MAIN, ANNEX } from "@/lib/hospital";
import { FLOOR_BY_KEY } from "../hospital/layout";
import { layoutBoxes } from "../hospital/props/discover";
import { propSolids } from "../hospital/props/colliders";
import { SPOTS, type Spot } from "./spots";

type Box = [number, number, number, number]; // x0, x1, z0, z1 (building frame)
type Group = { floor: string; dept: string; x: number; z: number; foot: Box; members: string[] };

/** Groups: anchor (building frame), footprint relative to the anchor, the spots that move with it. */
export const GROUPS: Record<string, Group> = {
  ydesk: { floor: "main:0", dept: "admissions", x: -17.4, z: 3.25, foot: [-0.85, 1.6, -1.25, 3.85], members: ["adm-desk", "adm-pilot", "adm-front"] },
  machine: { floor: "main:4", dept: "technique", x: 7.8, z: 4.5, foot: [-0.95, 0.95, -0.55, 1.65], members: ["machine", "machine-fix"] },
  billing: { floor: "main:1", dept: "facturation", x: -15.6, z: -3.25, foot: [-1.2, 1.8, -1.3, 0.6], members: ["billing-desk", "billing-stand"] },
  cmd: { floor: "annex:3", dept: "siege-pilotage", x: 51.95, z: -4.4, foot: [-0.55, 1.25, -0.8, 0.8], members: ["cmd-desk"] },
};

const bld = (key: string) => (key.startsWith("annex") ? ANNEX : MAIN);
const hit = (a: Box, b: Box) => a[0] < b[1] && a[1] > b[0] && a[2] < b[3] && a[3] > b[2];

function obstacles(key: string): Box[] {
  const fl = FLOOR_BY_KEY[key];
  if (!fl) return [];
  const B = bld(key);
  const out: Box[] = [];
  for (const [x0, x1, z0, z1, top, p] of layoutBoxes(fl)) {
    if (top < 0.22 || p.paper) continue; // rugs, floor bands, paper
    out.push([B.x + x0, B.x + x1, B.z + z0, B.z + z1]);
  }
  const [b, f] = key.split(":");
  for (const s of propSolids) if (s.building === b && s.floor === Number(f) && (s.y0 ?? 0) < 1.6) out.push([B.x + s.x0, B.x + s.x1, B.z + s.z0, B.z + s.z1]);
  for (const p of fl.people) {
    if (p.slot.pose === "walk") continue;
    out.push([B.x + p.slot.x - 0.35, B.x + p.slot.x + 0.35, B.z + p.slot.z - 0.35, B.z + p.slot.z + 0.35]);
  }
  return out;
}

const cache = new Map<string, { dx: number; dz: number }>();
/** Offset that frees a group's footprint (computed once). */
export function groupOffset(id: string): { dx: number; dz: number } {
  const hitC = cache.get(id);
  if (hitC) return hitC;
  const g = GROUPS[id];
  let res = { dx: 0, dz: 0 };
  if (g) {
    const obs = obstacles(g.floor);
    const d = DEPT[g.dept], B = bld(g.floor);
    const zone: Box = [B.x + d.rect[0] - d.rect[2] / 2 + 0.5, B.x + d.rect[0] + d.rect[2] / 2 - 0.5, B.z + d.rect[1] - d.rect[3] / 2 + 0.5, B.z + d.rect[1] + d.rect[3] / 2 - 0.5];
    const ok = (dx: number, dz: number) => {
      const f: Box = [g.x + dx + g.foot[0], g.x + dx + g.foot[1], g.z + dz + g.foot[2], g.z + dz + g.foot[3]];
      if (f[0] < zone[0] || f[1] > zone[1] || f[2] < zone[2] || f[3] > zone[3]) return false;
      return !obs.some((o) => hit(f, o));
    };
    search: for (let r = 0; r <= 6; r += 0.25) {
      const n = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 0.35);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const dx = Math.round(r * Math.cos(a) * 100) / 100, dz = Math.round(r * Math.sin(a) * 100) / 100;
        if (ok(dx, dz)) { res = { dx, dz }; break search; }
      }
    }
  }
  cache.set(id, res);
  return res;
}

const MEMBER: Record<string, string> = Object.fromEntries(Object.entries(GROUPS).flatMap(([g, v]) => v.members.map((m) => [m, g])));
/** A story spot, slid with its group when the group had to move. */
export function spot(id: string): Spot | undefined {
  const s = SPOTS[id];
  if (!s) return s;
  const g = MEMBER[id];
  if (!g) return s;
  const o = groupOffset(g);
  return o.dx || o.dz ? { ...s, x: s.x + o.dx, z: s.z + o.dz } : s;
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __storyGroups: () => unknown }).__storyGroups = () => Object.keys(GROUPS).map((k) => [k, groupOffset(k)]);
}
