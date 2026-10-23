"use client";
// <MaarifDistrict/>: the Maârif pilot district around the Twin Center (OSM zone, see OsmZoneDistrict / zoneGeo). The towers
// are TwinCenter.tsx; their podium wings (OSM retail, 4 levels, white) are drawn here with taller mall storeys (4.4 m,
// estimated). The plan's tram boulevard (z = 780) crosses the box: the buildings under it are not drawn.
import { MAARIF_ZONE } from "../maarifZone";
import { OsmZoneDistrict, zoneBuilt, zoneSolids } from "./OsmZoneDistrict";
import { TWIN_TOWER_IDS } from "./TwinCenter";
import { roofOf, walls, lvH } from "./zoneKit";
import type { ZoneSpec } from "./zoneGeo";

const PODIUM = new Set([416499076, 416499077, 416499078]), MALL_FL = 4.4;

const SPEC: ZoneSpec = {
  elsewhere: new Set(TWIN_TOWER_IDS),
  hero: (b, P, { core }) => {
    if (!PODIUM.has(b.id)) return undefined;
    const h = (b.lv ?? 4) * MALL_FL;
    walls(core, P, 0, MALL_FL, "shop");
    walls(core, P, MALL_FL, h, "panel");
    roofOf(core, P, h, "parapet", 1.2);
    return h;
  },
  labels: (Z) => {
    const out = [{ name: "Twin Center", sub: "115 m · 28 niveaux · Bd Zerktouni × Bd Al Massira", x: -3.5, y: 132, z: 0, hero: true }];
    const zk = Z.buildings.find((b) => b.id === 1373134013);
    if (zk) out.push({ name: "Résidence Zerktouni", sub: "17 niveaux", x: zk.o[0], y: lvH(17) + 6, z: zk.o[1], hero: false });
    const lxr = Z.buildings.find((b) => b.id === 1327654567);
    if (lxr) out.push({ name: "LXR by Hilton", sub: "chantier · 17 niveaux", x: lxr.o[0], y: lvH(17) + 6, z: lxr.o[1], hero: false });
    return out;
  },
};

export const maarifSolids = () => zoneSolids("maarif", MAARIF_ZONE, SPEC);
export const maarifStats = () => zoneBuilt("maarif", MAARIF_ZONE, SPEC).stats;
export function MaarifDistrict() {
  return <OsmZoneDistrict id="maarif" zone={MAARIF_ZONE} spec={SPEC} />;
}
