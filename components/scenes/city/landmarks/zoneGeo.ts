// Geometry of an OpenStreetMap district (zone-local metres, x east, z south, origin = the zone's origin), from its zone data
// (zones/*Data.ts) and the illustrative fillers of osmZonePlan; the district-specific parts (buildings drawn elsewhere, hero
// buildings, ground overrides, extra labels) come from its ZoneSpec (MaarifDistrict, AnfaPrimeDistrict). Fidelity levels
// (docs/research/maarif-pilote.md, anfa-prime-pilote.md):
//   A  documented: hero buildings of the spec (e.g. the Twin Center podium);
//   B  footprint + storeys from OSM: every mapped building on its outline, its height from `height` or `building:levels`;
//      façades are typologies of the district (not surveyed per building), shopfronts where OSM has a shop inside;
//   C  footprint only, or no footprint at all: storeys estimated (mapped) or illustrative frontage volumes (fillers),
//      both reported as estimates.
// Merged per material in two sets: `core` (walls, roofs, ground) and `detail` (rooftop plant, cornices, contact shadows,
// kerbs, zebra crossings, bus shelters, signals), the detail set being hidden from afar. Street lamps are instances.
import type { PlacedZone, Filler } from "../osmZonePlan";
import { onOtherRoad, zoneFillers } from "../osmZonePlan";
import type { OsmZone, ZoneArea, ZoneBuilding } from "./zones/types";
import {
  Buckets, at, box, cap, ccw, contactRing, hash, inPoly, inset, lvH, pts, roofOf, site, strip, walls, type CfcKey, type Footprint, type Pt,
} from "./zoneKit";

export type ZoneLabel = { name: string; sub: string; x: number; y: number; z: number; hero?: boolean };
export type ZoneStats = { osm: number; levels: number; height: number; estimated: number; fillers: number; shops: number; skipped: number; replaced: number };
/** what a district adds to the generic build */
export type ZoneSpec = {
  /** buildings drawn by another component (e.g. the Twin Center towers) */
  elsewhere?: ReadonlySet<number>;
  /** buildings replaced by a model standing there (counted as `replaced`) */
  replaced?: (b: ZoneBuilding) => boolean;
  /** a hero building: draw it and return its height, or return undefined to let the generic build do it */
  hero?: (b: ZoneBuilding, P: Pt[], kit: { core: Buckets; detail: Buckets }) => number | undefined;
  /** ground material of an open space (null = not drawn), undefined = the default */
  ground?: (a: ZoneArea, i: number) => CfcKey | null | undefined;
  /** labels of the district (local) */
  labels?: (Z: OsmZone) => ZoneLabel[];
  /** extra text under the label of a named place */
  poiSub?: (name: string) => string | undefined;
  /** district rule for a building whose storeys OSM does not give: estimated storeys and typology (undefined = default) */
  estimate?: (b: ZoneBuilding) => { lv: number; villa: boolean } | undefined;
};


const segDist = (ax: number, az: number, bx: number, bz: number, x: number, z: number) => {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
};

export function buildZone(Pz: PlacedZone, spec: ZoneSpec = {}) {
  const Z = Pz.zone, core = new Buckets(), detail = new Buckets(), labels: ZoneLabel[] = [];
  const solids: { o: Footprint["o"]; h: number }[] = [];
  const lamps: [number, number, number][] = [];
  const stats: ZoneStats = { osm: 0, levels: 0, height: 0, estimated: 0, fillers: 0, shops: 0, skipped: 0, replaced: 0 };
  const inCorr = (z: number, m = 0) => Pz.corridors.some((c) => z > c.z0 - m && z < c.z1 + m);
  const main = Z.roads.filter((r) => ["primary", "secondary", "trunk"].includes(r.k));
  const nearMain = (x: number, z: number, m: number) => main.some((r) => { for (let i = 0; i + 3 < r.p.length; i += 2) if (segDist(r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], x, z) < r.w / 2 + m) return true; return false; });

  /** a residence / office / shop building on a footprint (fidelity B or C) */
  const building = (f: Footprint, P: Pt[], holes: Pt[][], h: number, kind: "res" | "office" | "villa" | "low", shopFront: boolean, y0 = 0) => {
    const r = hash(f.id, 3), tint = hash(f.id, 5) < 0.62 ? 0 : 1, style = Math.floor(hash(f.id, 7) * 4);
    const fac: CfcKey = kind === "villa" ? "villa" : kind === "low" ? "panel" : kind === "office" && r < 0.4 ? (r < 0.2 ? "glass.silver" : "glass.sage") : (`res.${style * 2 + tint}` as CfcKey);
    const base: CfcKey = shopFront ? "shopAwn" : kind === "villa" ? "villa" : tint ? "base.c" : "base.w";
    const g = y0 > 0 ? 0 : shopFront ? 4.2 : kind === "villa" || kind === "low" ? 0 : 3.6;
    if (g > 0 && h > g + 2) {
      walls(core, P, 0, g, base);
      for (const hl of holes) walls(core, hl, 0, g, base, true);
      // the slab over the ground floor, a little proud of the façade; an awning over the shopfronts facing a street
      const O = inset(P, -0.3);
      walls(detail, O, g, g + 0.35, "parapet"); cap(detail, "parapet", O, g + 0.35, [P]); cap(detail, "parapet", O, g, [P], true);
      if (shopFront) for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 4) continue;
        const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2, nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
        if (!Z.roads.some((rd) => { for (let k = 0; k + 3 < rd.p.length; k += 2) if (segDist(rd.p[k], rd.p[k + 1], rd.p[k + 2], rd.p[k + 3], mx + nx * 6, mz + nz * 6) < rd.w / 2 + 4) return true; return false; })) continue;
        box(detail, "awning", mx + nx * 0.7, mz + nz * 0.7, Math.atan2(-(b[1] - a[1]), b[0] - a[0]), L * 0.92, 1.4, g - 0.9, 0.12);
      }
    }
    walls(core, P, Math.max(g, y0), h, fac);
    for (const hl of holes) walls(core, hl, Math.max(g, y0), h, fac, true);
    if (y0 > 0) cap(core, "concrete", P, y0, holes, true);
    // the roof: parapet, terrace; on the residences a stair cage, dishes and a water heater or two
    if (holes.length) {
      walls(core, P, h, h + 1.1, "parapet"); walls(core, inset(P, 0.35), h, h + 1.1, "parapet", true);
      cap(core, "parapet", P, h + 1.1, [inset(P, 0.35)]); cap(core, "roof", inset(P, 0.35), h + 0.02, holes);
      for (const hl of holes) walls(core, hl, h, h + 1.1, "parapet", true);
    } else roofOf(core, P, h, "parapet", kind === "villa" ? 0.9 : 1.1);
    if (kind === "res" || kind === "office") {
      const O = inset(P, -0.25);                                                     // cornice
      if (style === 3 || kind === "office") { walls(detail, O, h - 0.7, h - 0.15, "parapet"); cap(detail, "parapet", O, h - 0.7, [P], true); }
      const I = inset(P, 2.4);
      const spot = (k: number): Pt | null => {
        for (let t = 0; t < 4; t++) { const q = at(f.o, (hash(f.id, k * 4 + t) - 0.5) * f.o[3] * 0.55, (hash(f.id, k * 4 + t + 40) - 0.5) * f.o[4] * 0.55); if (inPoly(I, q[0], q[1]) && !holes.some((hl) => inPoly(inset(hl, -2), q[0], q[1]))) return q; }
        return null;
      };
      const c = spot(1); if (c && f.o[3] * f.o[4] > 120) box(detail, "cage", c[0], c[1], f.o[2], 3.2, 4.4, h, 2.7);
      const nd = Math.floor(hash(f.id, 9) * 3);
      for (let k = 0; k < nd; k++) { const q = spot(2 + k); if (q) { box(detail, "steel", q[0], q[1], 0, 0.08, 0.08, h, 1.1); box(detail, "dish", q[0], q[1], f.o[2] + k, 0.9, 0.12, h + 0.9, 0.8); } }
      if (hash(f.id, 11) < 0.5) { const q = spot(6); if (q) box(detail, "unit", q[0], q[1], f.o[2], 1.6, 0.7, h, 0.75); }
    }
    contactRing(detail, P, 2.2);
    solids.push({ o: f.o, h });
  };

  for (const b of Z.buildings) {
    if (spec.elsewhere?.has(b.id)) continue;
    if (spec.replaced?.(b)) { stats.replaced++; continue; }
    const P = ccw(pts(b.p)), holes = b.holes.map((h) => ccw(pts(h)).reverse());
    if (P.some(([, z]) => inCorr(z, 1))) { stats.skipped++; continue; }                 // under the plan's tram boulevard
    stats.osm++;
    if (b.lv != null) stats.levels++;
    if (b.h != null) stats.height++;
    const hh = spec.hero?.(b, P, { core, detail });
    if (hh !== undefined) { contactRing(detail, P, 2.2); solids.push({ o: b.o, h: hh }); continue; }
    const t = b.type;
    if (t === "construction") { site(core, P); continue; }
    if (t === "roof") {                                                                     // a shelter roof on posts
      cap(core, "concrete", P, 3.2); cap(core, "concrete", P, 3.0, [], true); walls(core, P, 3.0, 3.2, "concrete");
      for (let i = 0; i < P.length; i += 2) box(core, "steel", P[i][0], P[i][1], 0, 0.2, 0.2, 0, 3.0);
      continue;
    }
    const estLv = (v: ZoneBuilding) => {
      if (v.type === "house") return 2;
      if (v.type === "yes") return 4;
      if (v.type === "school" || v.type === "garage" || v.type === "retail" || v.type === "commercial") return 2;
      return 6;                                                                             // apartments, hotels, offices: the mode of the mapped storeys
    };
    const est = b.lv == null ? spec.estimate?.(b) : undefined;
    const lv = b.lv ?? est?.lv ?? estLv(b);
    if (b.lv == null && b.h == null) stats.estimated++;
    const kind = t === "house" || est?.villa ? "villa" : (t === "retail" || t === "commercial" || t === "garage") && lv <= 3 ? "low" : t === "office" || t === "commercial" || t === "university" ? "office" : "res";
    const h = b.h ?? (kind === "villa" ? lvH(lv) - 1 : lvH(lv));
    const y0 = b.minLv ? lvH(b.minLv) : 0;
    const shopFront = kind !== "villa" && lv >= 3 && (b.shop === 1 || (nearMain(b.o[0], b.o[1], b.o[4] / 2 + 10) && hash(b.id, 13) < 0.55));
    if (shopFront) stats.shops++;
    building(b, P, holes, h, kind, shopFront, y0);
  }
  // illustrative frontage volumes where OSM has no footprint (fidelity C)
  const F: Filler[] = zoneFillers(Pz);
  for (const f of F) {
    const P = ccw(pts(f.p));
    building(f, P, [], lvH(f.lv), "res", f.shop === 1);
    stats.fillers++;
  }

  // ------------------------------------------------------------ ground: open spaces, footpaths, kerbs, zebras
  const Y: Record<string, number> = { park: 0.03, garden: 0.034, grass: 0.034, scrub: 0.036, site: 0.04, sport: 0.036, parking: 0.04, plaza: 0.042, pitch: 0.046, play: 0.048, water: 0.05, pool: 0.052 };
  Z.areas.forEach((a, ai) => {
    const P = ccw(pts(a.p)), over = spec.ground?.(a, ai);
    if (over === null) return;
    const key: CfcKey = over ?? (a.k === "park" || a.k === "garden" || a.k === "grass" || a.k === "sport" ? "lawn" : a.k === "scrub" ? "scrub"
      : a.k === "pitch" ? "turf" : a.k === "play" ? "rubber" : a.k === "water" || a.k === "pool" ? "water" : a.k === "site" ? "sand" : a.k === "parking" ? "asphalt" : "plaza");
    try { cap(core, key, P, Y[a.k] ?? 0.04); } catch { /* degenerate outline */ }
    if (a.k === "water" || a.k === "pool") { walls(core, inset(P, -0.35), 0, 0.4, "parapet"); cap(core, "parapet", inset(P, -0.35), 0.4, [P]); }
  });
  for (const p of Z.paths) strip(core, "path", p.p, p.w, 0.055, 0.4);
  // kerbs along every carriageway edge, cut where they would cross another street
  const others = (x: number, z: number, self: number) => onOtherRoad(Z, x, z, self, 0.6);
  Z.roads.forEach((r, k) => {
    if (r.k === "busway") return;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], dx = r.p[i + 2] - ax, dz = r.p[i + 3] - az, L = Math.hypot(dx, dz);
      if (L < 1) continue;
      const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
      for (const s of [-1, 1]) {
        const off = (r.w / 2 + 0.15) * s;
        let run: number[] = [];
        const flush = () => { if (run.length >= 4) { walls(detail, [[run[0], run[1]], [run[run.length - 2], run[run.length - 1]]].map((q) => q as Pt), 0.06, 0.18, "kerb"); strip(detail, "kerb", run, 0.3, 0.18); } run = []; };
        for (let t = 0; t <= L; t += Math.min(2, L)) {
          const x = ax + ux * t + nx * off, z = az + uz * t + nz * off;
          if (others(x, z, k) || inCorr(z, 4)) flush(); else run.push(x, z);
        }
        flush();
      }
    }
  });
  // zebra crossings at the mapped crossings, across the nearest carriageway
  for (const [x, z] of Z.crossings) {
    let best = { d: 1e9, ux: 1, uz: 0, w: 7 };
    for (const r of Z.roads) for (let i = 0; i + 3 < r.p.length; i += 2) {
      const d = segDist(r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], x, z);
      if (d < best.d) { const dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz) || 1; best = { d, ux: dx / L, uz: dz / L, w: r.w }; }
    }
    if (best.d > 3 || inCorr(z, 2)) continue;
    const nx = -best.uz, nz = best.ux;
    for (let o = -best.w / 2 + 0.5; o <= best.w / 2 - 0.4; o += 1.0) {
      const cx = x + nx * o, cz = z + nz * o;
      strip(detail, "zebra", [cx - best.ux * 1.6, cz - best.uz * 1.6, cx + best.ux * 1.6, cz + best.uz * 1.6], 0.5, 0.1);
    }
  }
  // centre lines of the two-way main streets
  for (const r of Z.roads) if (!r.o && ["primary", "secondary", "tertiary"].includes(r.k)) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz);
      for (let t = 2; t + 3 < L; t += 9) strip(detail, "mark", [r.p[i] + (dx * t) / L, r.p[i + 1] + (dz * t) / L, r.p[i] + (dx * (t + 3)) / L, r.p[i + 1] + (dz * (t + 3)) / L], 0.15, 0.095);
    }
  }
  // bus shelters at the mapped stops, facing the nearest street; traffic signals at the mapped ones
  const facing = (x: number, z: number) => {
    let best = { d: 1e9, yaw: 0, nx: 0, nz: 1 };
    for (const r of Z.roads) for (let i = 0; i + 3 < r.p.length; i += 2) {
      const d = segDist(r.p[i], r.p[i + 1], r.p[i + 2], r.p[i + 3], x, z);
      if (d < best.d) { const dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz) || 1; best = { d, yaw: Math.atan2(-dz, dx), nx: -dz / L, nz: dx / L }; }
    }
    return best;
  };
  for (const s of Z.bus) {
    if (inCorr(s.z, 3)) continue;
    const f = facing(s.x, s.z), c = Math.cos(f.yaw), sn = Math.sin(f.yaw);
    box(detail, "steel", s.x, s.z, f.yaw, 4.2, 1.8, 2.5, 0.12);                                // roof
    box(detail, "glass.silver", s.x + sn * 0.85, s.z + c * 0.85, f.yaw, 4.0, 0.06, 0.1, 2.3);  // back panel
    for (const e of [-2, 2]) box(detail, "steel", s.x + c * e, s.z - sn * e, f.yaw, 0.08, 1.6, 0, 2.5);
  }
  for (const [x, z] of Z.signals) {
    if (inCorr(z, 3)) continue;
    box(detail, "steel", x, z, 0, 0.14, 0.14, 0, 3.4);
    box(detail, "asphalt", x, z, facing(x, z).yaw, 0.35, 0.3, 3.0, 1.0);
  }
  // street lamps (illustrative: OSM maps none here): along the main streets every 30 m, alternating sides
  for (const r of Z.roads) {
    if (!["primary", "secondary", "tertiary"].includes(r.k)) continue;
    let acc = hash(r.p[0], r.p[1]) * 30, side = 1;
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const ax = r.p[i], az = r.p[i + 1], dx = r.p[i + 2] - ax, dz = r.p[i + 3] - az, L = Math.hypot(dx, dz);
      if (L < 0.5) continue;
      const ux = dx / L, uz = dz / L;
      for (; acc < L; acc += 30, side = -side) {
        const off = (r.w / 2 + 0.7) * side, x = ax + ux * acc - uz * off, z = az + uz * acc + ux * off;
        if (inCorr(z, 3) || Z.roads.some((q) => q !== r && (() => { for (let k = 0; k + 3 < q.p.length; k += 2) if (segDist(q.p[k], q.p[k + 1], q.p[k + 2], q.p[k + 3], x, z) < q.w / 2 + 1) return true; return false; })())) continue;
        lamps.push([x, z, Math.atan2(ux * side, uz * side)]);                         // the arm reaches over the street
      }
      acc -= L;
    }
  }

  // ------------------------------------------------------------ labels: the district's own, its named places, its boulevards
  labels.push(...(spec.labels?.(Z) ?? []));
  const seen = new Set<string>();
  for (const p of Z.pois) {
    if (p.kind === "hotel" || seen.has(p.name) || inCorr(p.z, 0)) continue;
    seen.add(p.name);
    const name = p.name.replace(/\s+[\u0600-\u06FF].*$/, "").split(" ").slice(0, 3).join(" ");
    labels.push({ name, sub: spec.poiSub?.(name) ?? (p.kind === "worship" ? "mosquée" : ""), x: p.x, y: 30, z: p.z });
  }
  // one label per named main street, at the middle of its longest run
  const longest = new Map<string, { L: number; x: number; z: number }>();
  for (const r of Z.roads) {
    if (!r.name || !["primary", "secondary", "trunk"].includes(r.k)) continue;
    let L = 0; for (let i = 0; i + 3 < r.p.length; i += 2) L += Math.hypot(r.p[i + 2] - r.p[i], r.p[i + 3] - r.p[i + 1]);
    const name = r.name.replace(/\s+[\u0600-\u06FF].*$/, "");
    if ((longest.get(name)?.L ?? 0) >= L) continue;
    let acc = 0, mx = r.p[0], mz = r.p[1];
    for (let i = 0; i + 3 < r.p.length; i += 2) { const l = Math.hypot(r.p[i + 2] - r.p[i], r.p[i + 3] - r.p[i + 1]); if (acc + l >= L / 2) { const t = (L / 2 - acc) / (l || 1); mx = r.p[i] + (r.p[i + 2] - r.p[i]) * t; mz = r.p[i + 1] + (r.p[i + 3] - r.p[i + 1]) * t; break; } acc += l; }
    longest.set(name, { L, x: mx, z: mz });
  }
  for (const [name, v] of longest) if (v.L > 120) labels.push({ name, sub: "", x: v.x, y: 3, z: v.z });
  return { core: core.build(), detail: detail.build(), labels, solids, lamps, stats };
}
