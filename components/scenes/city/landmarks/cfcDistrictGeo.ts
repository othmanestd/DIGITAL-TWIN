// Geometry of the Casablanca Finance City district (Casa Anfa), built from the OpenStreetMap footprints of cfcData.ts in
// district-local metres (x east, z south, origin = the CFC Tower), merged per material. Every building stands on its real
// outline; the towers that are documented get their own massing and façade (sources: docs/research/cfc-district.md):
//   CFC Tower (Morphosis, 122 m): canted glass base, straight shaft wrapped in the white brise-soleil, tapered glass crown;
//   BCP Tower (105.4 m): slab with a glass double skin to the north, a GRC moucharabieh to the south, blind GRC gables;
//   CIMR Tower (60 m): three rounded volumes stepping in height, wrapped in a white perforated aluminium veil;
//   Tour Mainstreet and Tour Casa Anfa (90 m, 22 floors), Le Métropolitain (30 m), Capital Tower (80 m);
//   BO52 (16 and 13 floors, Casablanca modernist white), Luxuria Tower (16 + 5 floors), CFC Bridge (R+6);
//   the four Tours Végétales (16 floors, planted façades); Aeria Mall (4 floors) and the old airport control tower;
//   Walili Tower (147 m) and Shift Tower (130 m), shown with their last floors still in bare concrete and a crane;
//   the Cross Tower plot and the other construction sites behind site hoardings.
// Façades whose material is not documented get the district's curtain wall or white render; storeys not tagged in OSM are
// estimates (marked `est` below). Ground: Anfa Park, the Aeria palm grove, lawns, pools, pitches, alleys, the T2 tramway.
import { chamfered, loft, tube, type Ring } from "./geo";
import { OSM_AREAS, OSM_BUILDINGS, OSM_PATHS, OSM_ROADS, OSM_TRAM, OSM_TRAM_STOPS, type OsmBuilding } from "./cfcData";
import {
  Buckets, GT, at, block, box, cap, ccw, crane, glassOf, hash, inset, lvH, pts, roofOf, site, strip, walls, FL, type CfcKey, type Pt,
} from "./zoneKit";

export type { CfcKey } from "./zoneKit";

// ---------------------------------------------------------------- building catalogue
export type Label = { name: string; sub: string; x: number; y: number; z: number; hero?: boolean };
export type CfcSolid = { o: OsmBuilding["o"]; h: number };
/** CFC Tower (Morphosis): the real footprint as its oriented box (30.25 × 35.5 m, ~23° off north), 122 m. */
function cfcTower(B: Buckets, b: OsmBuilding): number {
  const o = b.o, H = 122, hx = o[3] / 2, hz = o[4] / 2;
  const ring = (y: number, sx: number, sz: number, c: number, ox = 0, oz = 0): Ring => {
    const p = chamfered(hx * sx, hz * sz, c, ox, oz).map(([lx, lz]) => at(o, lx, lz));
    return { y, p };
  };
  // the canted glass lobby (narrower at the ground), the flare up to the shaft, all under the white screen
  B.geo("glass.silver", loft([ring(0, 0.74, 0.74, 2.4), ring(9, 0.86, 0.86, 3)], GT, [0, 0, 0], { snap: true }));
  B.geo("parapet", loft([ring(9, 0.86, 0.86, 3), ring(10, 0.88, 0.88, 3.1)], [6, 6]));
  B.geo("screen", loft([ring(10, 0.88, 0.88, 3.1), ring(22, 1, 1, 3.8)], [12, 12], [0, 0, 0], { snap: true }));
  // the shaft wrapped in the brise-soleil
  B.geo("screen", loft([ring(22, 1, 1, 3.8), ring(104, 1, 1, 3.8)], [12, 12], [0, 0, 0], { snap: true }));
  // the shard crown: the screen folds in and leans to one corner, the glass top above it
  B.geo("screen", loft([ring(104, 1, 1, 3.8), ring(111, 0.9, 0.86, 4, 0.8, -0.6), ring(116, 0.72, 0.66, 3.8, 2.4, -2)], [12, 12], [0, 0, 0], { snap: true }));
  B.geo("glass.silver", loft([ring(116, 0.72, 0.66, 3.8, 2.4, -2), ring(H, 0.42, 0.36, 2.2, 5, -4.2)], GT, [0, 0, 0], { snap: true, cap: true }));
  return H;
}

/** BCP Tower: north glass double skin, south GRC moucharabieh, blind GRC gables, recessed lobby, 105.4 m. */
function bcpTower(B: Buckets, P: Pt[], h: number) {
  const face = (nx: number, nz: number, L: number): CfcKey => (L > 30 ? (nz < 0 ? "bcpGlass" : "grc") : "gable");
  walls(B, inset(P, 1.4), 0, 6.4, "shop");
  cap(B, "concrete", P, 6.4, [], true);
  walls(B, P, 6.4, h, face);
  roofOf(B, P, h, "gable", 2.2);
}

/** Build the whole district. Returns the merged parts, the labels, the colliders and the towers (for the pedestrians). */
export function buildCfcDistrict() {
  const B = new Buckets(), labels: Label[] = [], solids: CfcSolid[] = [];
  const towers: { id: number; o: OsmBuilding["o"]; h: number }[] = [];
  const lab = (b: OsmBuilding, name: string, sub: string, y: number, hero = false) => labels.push({ name, sub, x: b.o[0], y, z: b.o[1], hero });
  const named = new Set<string>();
  for (const b of OSM_BUILDINGS) {
    const P = ccw(pts(b.p)), o = b.o, est = hash(b.id, 2);
    let h = 0;
    switch (b.id) {
      case 871612907: h = cfcTower(B, b); lab(b, "CFC Tower", "Morphosis · 122 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 871612905: h = 105.4; bcpTower(B, P, h); lab(b, "Tour BCP", "Banque Centrale Populaire · 105 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 1242476327: h = 5 * FL + 3; block(B, b, P, h, "panel", { shop: true, plant: 3 }); break;          // probably the BCP podium (5 storeys)
      case 871612914: h = 60; block(B, b, P, h, "veil", { lobby: true }); cap(B, "lawn", inset(P, 1.5), h + 0.06); lab(b, "Tour CIMR", "60 m · voile d'aluminium perforé", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 871612913: h = 52; block(B, b, P, h, "veil", { lobby: true }); cap(B, "lawn", inset(P, 1.5), h + 0.06); break;   // est: the two lower CIMR volumes
      case 871612915: h = 44; block(B, b, P, h, "veil", { lobby: true }); cap(B, "lawn", inset(P, 1.5), h + 0.06); break;
      case 1056146783: h = 90; block(B, b, P, h - 4.5, "glass.silver", { lobby: true, crown: true, plant: 0 }); lab(b, "Tour Mainstreet", "Casa Business Towers · 90 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 1056146785: h = 90; block(B, b, P, h - 4.5, "glass.sage", { lobby: true, crown: true }); lab(b, "Tour Casa Anfa", "Casa Business Towers · 90 m", h + 8, true); towers.push({ id: b.id, o, h }); break;
      case 1056146784: h = 30; block(B, b, P, h, "glass.green", { lobby: true, plant: 2 }); break;
      case 1056146786: h = 80; block(B, b, P, h - 4.5, "glass.cool", { lobby: true, crown: true }); lab(b, "Capital Tower", "80 m", h + 8, true); break;
      case 871612908: h = 60; block(B, b, P, h, "deco", { shop: true, plant: 3 }); lab(b, "BO52", "résidences · 16 et 13 étages", h + 6); break;
      case 1308753446: h = lvH(13); block(B, b, P, h, "deco", { shop: true, plant: 3 }); break;
      case 1242476329: h = lvH(16); block(B, b, P, h, "apart.white", { plant: 2 }); lab(b, "Luxuria Tower", "R+15", h + 6); break;
      case 1242476330: h = lvH(5); block(B, b, P, h, "apart.white", { plant: 1 }); break;
      case 586649061: h = 7 * 3.6; block(B, b, P, h, "glass.silver", { lobby: true, plant: 4 }); break; // CFC Bridge, R+6
      case 1056146770: case 1056146771: case 1056146772: case 1056146773:
        h = lvH(16); block(B, b, P, h, "green", { shop: false, plant: 1 }); if (b.id === 1056146771) lab(b, "Tours Végétales", "Édouard François · R+16", h + 6); break;
      case 871612919: h = 4 * 4.2; block(B, b, P, h, "panel", { shop: true, plant: 9 }); lab(b, "Aeria Mall", "ancien aéroport d'Anfa", h + 6); break;
      case 1308152369: {                                                                                 // the old control tower (est.)
        h = 14; walls(B, P, 0, h, "gable"); const I = inset(P, -0.8); walls(B, I, h, h + 3, "glass.cool"); cap(B, "roof", I, h + 3); cap(B, "concrete", I, h, [], true); h += 3; break;
      }
      case 1308110828: {                                                                                 // Walili Tower: plot podium + tower (shaft size est.)
        const plot = inset(P, 2), hp = 14; block(B, b, plot, hp, "panel", { shop: true });
        h = 147; const s = 19, T: Pt[] = [at(o, -s, -s), at(o, s, -s), at(o, s, s), at(o, -s, s)];
        block(B, b, ccw(T), h, "glass.silver", { frameTop: 14 }); crane(B, o[0], o[1], h, 26, o[2] + 0.6, 50);
        lab(b, "Walili Tower", "147 m · en construction", h + 30, true); break;
      }
      case 1308151969: h = 130; block(B, b, P, h, "glass.bronze", { lobby: true, frameTop: 12 }); crane(B, o[0], o[1], h, 24, o[2] - 0.9, 48); lab(b, "Shift Tower", "130 m · en construction", h + 30, true); break;
      case 1308110887: case 871612916: {                                                                 // Cross Tower plot / building site
        site(B, P); const I = inset(P, 9); walls(B, I, 0, 7.2, "frame"); cap(B, "concrete", I, 7.2); h = 7.2;
        const [cx, cz] = at(o, o[3] * 0.18, -o[4] * 0.2); crane(B, cx, cz, 0, b.id === 1308110887 ? 52 : 38, o[2] + 2.1, 45);
        if (b.id === 1308110887) lab(b, "Cross Tower", "chantier", 64); break;
      }
      default: {
        const t = b.type;
        if (t === "house") { h = lvH(2) - 1; block(B, b, P, h, "villa", { plant: 1 }); break; }
        if (t === "construction") { site(B, P); break; }
        if (t === "civic" || t === "public" || t === "pavilion" || (b.lv ?? 9) <= 1) { h = 4.6; block(B, b, P, h, "panel", { shop: true }); break; }
        if (t === "retail" || t === "commercial") { h = lvH(b.lv ?? 2 + Math.round(est)); block(B, b, P, h, "panel", { shop: true, plant: 2 }); break; }
        const office = t === "office" || (t === "yes" && est < 0.45);
        const lv = b.lv ?? (office ? 6 + Math.round(est * 2) : 5 + Math.round(est * 2)); // est: storeys not in OSM
        h = b.h ?? lvH(lv);
        const fac: CfcKey = office ? glassOf(b.id) : hash(b.id, 4) < 0.7 ? "apart.white" : "apart.cream";
        const rect = P.length === 4 && b.a > 0.92 * o[3] * o[4];
        const court = rect && b.a > 2800 && Math.min(o[3], o[4]) > 40;
        const hole = court ? ccw(inset(P, 14)) : undefined;
        if (hole) cap(B, "lawn", hole, 0.06);
        block(B, b, P, h, fac, { lobby: office, shop: !office && b.a > 600 && hash(b.id, 6) < 0.5, plant: hole ? 0 : Math.min(6, 1 + Math.floor(b.a / 500)), hole });
        if (b.name && b.name !== "BO52" && b.a > 900 && !named.has(b.name)) { named.add(b.name); lab(b, b.name.split(" ").slice(0, 4).join(" "), `${b.lv ? b.lv : "~" + lv} niveaux`, h + 5); }
      }
    }
    if (h > 0) solids.push({ o, h });
  }

  // ------------------------------------------------------------ ground: parks, lawns, pools, pitches, sites, plazas
  const Y: Record<string, number> = { park: 0.03, garden: 0.034, grass: 0.034, scrub: 0.036, site: 0.04, sport: 0.036, parking: 0.04, plaza: 0.042, pitch: 0.046, play: 0.048, water: 0.05, pool: 0.052 };
  for (const a of OSM_AREAS) {
    const P = ccw(pts(a.p));
    const key: CfcKey = a.k === "park" || a.k === "garden" || a.k === "grass" || a.k === "sport" ? "lawn" : a.k === "scrub" ? "scrub"
      : a.k === "pitch" ? (a.name.includes("Skate") ? "skate" : "turf") : a.k === "play" ? "rubber" : a.k === "water" || a.k === "pool" ? "water"
      : a.k === "site" ? "sand" : a.k === "parking" ? "asphalt" : "plaza";
    try { cap(B, key, P, Y[a.k] ?? 0.04); } catch { /* degenerate outline */ }
    if (a.k === "water" || a.k === "pool") { walls(B, inset(P, -0.35), 0, 0.35, "parapet"); cap(B, "parapet", inset(P, -0.35), 0.35, [P]); }
  }
  for (const p of OSM_PATHS) strip(B, "path", p.p, p.w, 0.055, 0.4);
  // centre lines of the two-way streets
  for (const r of OSM_ROADS) if (!r.o && r.w >= 6.5) {
    for (let i = 0; i + 3 < r.p.length; i += 2) {
      const dx = r.p[i + 2] - r.p[i], dz = r.p[i + 3] - r.p[i + 1], L = Math.hypot(dx, dz);
      for (let t = 2; t + 3 < L; t += 9) strip(B, "mark", [r.p[i] + (dx * t) / L, r.p[i + 1] + (dz * t) / L, r.p[i] + (dx * (t + 3)) / L, r.p[i + 1] + (dz * (t + 3)) / L], 0.15, 0.095);
    }
  }
  // the T2 tramway: a concrete bed and two rails per track, catenary poles along the outer track
  OSM_TRAM.forEach((p, k) => {
    strip(B, "bed", p, 3.1, 0.075, 0.6);
    for (const off of [-0.72, 0.72]) {
      const q: number[] = [];
      for (let i = 0; i < p.length; i += 2) {
        const j = Math.min(i, p.length - 4), dx = p[j + 2] - p[j], dz = p[j + 3] - p[j + 1], L = Math.hypot(dx, dz) || 1;
        q.push(p[i] - (dz / L) * off, p[i + 1] + (dx / L) * off);
      }
      strip(B, "rail", q, 0.12, 0.095, 0.3);
    }
    if (k === 0) for (let i = 0; i + 3 < p.length; i += 2) {
      const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], L = Math.hypot(dx, dz), nx = -dz / L, nz = dx / L;
      for (let t = 0; t < L; t += 34) {
        const x = p[i] + (dx * t) / L - nx * 2.6, z = p[i + 1] + (dz * t) / L - nz * 2.6;
        B.geo("steel", tube(0.12, 0.16, 7.2, 8, [1, 1], [x, 0, z]));
        box(B, "steel", x + nx * 2.4, z + nz * 2.4, Math.atan2(-nz, nx), 4.8, 0.12, 6.6, 0.12);
      }
    }
  });
  for (const s of OSM_TRAM_STOPS) {
    // the nearest point of each track; the stop stands between them, its platforms on either side
    const near = OSM_TRAM.map((p) => {
      let best = { d: 1e9, x: s.x, z: s.z, yaw: 0 };
      for (let i = 0; i + 3 < p.length; i += 2) {
        const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((s.x - ax) * dx + (s.z - az) * dz) / L2)), qx = ax + dx * t, qz = az + dz * t, d = Math.hypot(s.x - qx, s.z - qz);
        if (d < best.d) best = { d, x: qx, z: qz, yaw: Math.atan2(-dz, dx) };
      }
      return best;
    }).filter((q) => q.d < 12);
    if (!near.length) continue;
    const px = near.reduce((a, q) => a + q.x, 0) / near.length, pz = near.reduce((a, q) => a + q.z, 0) / near.length, yaw = near[0].yaw;
    const c = Math.cos(yaw), sn = Math.sin(yaw), off = (near.length > 1 ? Math.hypot(near[0].x - near[1].x, near[0].z - near[1].z) / 2 : 0) + 3.1;
    for (const side of [-1, 1]) {
      const x = px + sn * side * off, z = pz + c * side * off;
      box(B, "plaza", x, z, yaw, 32, 2.6, 0, 0.32);
      box(B, "glass.cool", x + sn * side * 0.95, z + c * side * 0.95, yaw, 8, 0.08, 0.32, 2.3);
      box(B, "steel", x, z, yaw, 9, 2.2, 2.62, 0.14);
    }
    labels.push({ name: `Tram T2 · ${s.name}`, sub: "", x: px, y: 6, z: pz });
  }
  labels.push({ name: "Anfa Park", sub: "parc urbain · ~16 ha", x: 300, y: 10, z: 80 });
  labels.push({ name: "Aeria Palmeraie", sub: "", x: -110, y: 10, z: 70 });
  return { parts: B.build(), labels, solids, towers };
}
