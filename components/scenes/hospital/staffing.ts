// Illustrative staffing of each department along the timeline (2026 → 2029): the administrative workforce shrinks in
// proportion to the model — departures not replaced and internal mobility, zero layoffs. Care staff and patients stay.
//   visible(year) = max(1 pilot, round(n2026 × (1 − part_family × share(year).eco)))
// part_family = FAM[code].part of the department's dominant payroll family (A 0.6, S 0.6, P 0.1, H 0.05; others 0).
// Departments whose cases are all outside the 302 MDH, or care-only departments, do not shrink.
import { DEPT, type Role } from "@/lib/hospital";
import { CASE, FAM, share, type Year } from "@/lib/model";

/** Roles whose work the family's agents take over (doctors and care acts are never removed). */
const SHRINK_ROLES: Record<string, Role[]> = {
  A: ["admin"], S: ["admin", "cadre"], H: ["technique"], P: ["infirmier", "aide"], T: ["cadre", "direction"],
};

/** Dominant payroll family of a department (from its in-302 cases), or null. */
export function deptFamily(id: string): string | null {
  const d = DEPT[id];
  if (!d) return null;
  const n: Record<string, number> = {};
  for (const c of d.cases) {
    const uc = CASE[c];
    if (!uc || uc.in302 === false || !uc.mdh) continue;
    n[c[0]] = (n[c[0]] ?? 0) + uc.mdh;
  }
  const best = Object.entries(n).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : null;
}

type Plan = { family: string | null; part: number; roles: Role[]; total: number; shrinkable: number };
const cache: Record<string, Plan> = {};
function plan(id: string): Plan {
  if (cache[id]) return cache[id];
  const d = DEPT[id];
  const family = deptFamily(id);
  const part = family ? FAM[family]?.part ?? 0 : 0;
  const roles = family && part > 0 ? SHRINK_ROLES[family] ?? [] : [];
  let total = 0, shrinkable = 0;
  for (const s of d?.staff ?? []) {
    if (s.role === "patient") continue;
    total += s.n;
    if (roles.includes(s.role)) shrinkable += s.n;
  }
  return (cache[id] = { family, part, roles, total, shrinkable });
}

/** How many of the shrinkable staff are still there in `year` (the first ones, by index, stay — they become pilots). */
export function keptShrinkable(id: string, year: Year) {
  const p = plan(id);
  if (!p.shrinkable) return 0;
  return Math.max(1, Math.round(p.shrinkable * (1 - p.part * share(year).eco)));
}

/** Is this role of this department one that shrinks along the timeline? */
export function isShrinkRole(id: string, role: Role) { return plan(id).roles.includes(role); }

/** For panels: "4 personnes en 2026 → 2 pilotes en 2029 (illustratif)". */
export function visibleStaff(id: string, year: Year) {
  const p = plan(id);
  const kept = keptShrinkable(id, year);
  const removed = p.shrinkable - kept;
  return {
    n2026: p.total,                    // staff drawn today (patients excluded)
    n: p.total - removed,              // staff drawn in `year`
    pilots: p.shrinkable ? kept : 0,   // remaining staff of the shrinking roles (they pilot the agents)
    removed,
    shrinks: p.shrinkable > 0,
    family: p.family,
  };
}
