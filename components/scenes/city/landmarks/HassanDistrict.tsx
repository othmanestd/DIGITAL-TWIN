"use client";
// <HassanDistrict/>: the Hassan II Mosque from its OpenStreetMap building parts (relation 12679400 and its building:part
// ways, with their height / min_height and roof colour), in "Casa réel" mode: the prayer hall and its upper storeys
// (arcade stone, heights 27 / 40 / 50 / 60 m in OSM), the green tiled roofs (roof:colour #306754, quadruple saltbox), the
// silver roof panels, the minaret (172 m in OSM, a value that differs from the 200–210 m quoted elsewhere: kept as mapped
// and flagged), the annexes; the esplanade, streets and promenade of the zone. Silhouette and proportions from data; the
// carved details are a texture typology (Moncef's arcade and zellige painters), not a survey.
import { HASSAN2_PLACED } from "../hassanZone";
import { frustum } from "./geo";
import { OsmZoneDistrict, zoneSolids } from "./OsmZoneDistrict";
import { box, cap, roofOf, walls, type CfcKey } from "./zoneKit";
import type { ZoneSpec } from "./zoneGeo";

const GREEN = "#306754";

const SPEC: ZoneSpec = {
  hero: (b, P, { core }) => {
    if (b.type !== "part") return undefined;
    const y0 = b.minH ?? 0, h = Math.max(y0 + 3, b.h ?? y0 + 6), o = b.o;
    const minaret = h > 100;
    const wall: CfcKey = y0 === 0 && h <= 30 ? "arcade" : "stoneW";
    // the minaret: light stone shaft, its green zellige panels on the upper part (typology, not a survey of the panels)
    if (minaret) { walls(core, P, y0, h * 0.55, "stoneW"); walls(core, P, h * 0.55, h, "zellige"); }
    else walls(core, P, y0, h, wall);
    if (y0 > 0) cap(core, "stoneW", P, y0, [], true);
    if (b.roofShape === "quadruple_saltbox" || b.roof.toUpperCase() === GREEN.toUpperCase()) {
      const hr = Math.min(10, 0.14 * Math.min(o[3], o[4]));
      core.geo("greenTile", frustum(o[3], o[4], o[3] * 0.3, o[4] * 0.3, hr, [6, 6], [0, 0, 0], { cap: true }).rotateY(o[2]).translate(o[0], h, o[1]));
    } else if (b.roof === "silver") cap(core, "steel", P, h);
    else roofOf(core, P, h, "stoneW", minaret ? 1.6 : 0.8);
    if (minaret) {
      // the lantern and its green cap (proportions of the shaft, not a survey)
      box(core, "stoneW", o[0], o[1], o[2], o[3] * 0.42, o[4] * 0.42, h, o[3] * 0.6);
      core.geo("greenTile", frustum(o[3] * 0.46, o[4] * 0.46, 0.6, 0.6, o[3] * 0.25, [3, 3], [0, 0, 0], { cap: true }).rotateY(o[2]).translate(o[0], h + o[3] * 0.6, o[1]));
    }
    return h;
  },
  labels: () => [{ name: "Mosquée Hassan II", sub: "volumes OSM · minaret 172 m (OSM), 200–210 m selon d'autres sources", x: 0, y: 190, z: 0, hero: true }],
};

export const hassanSolids = () => zoneSolids("hassan2", HASSAN2_PLACED, SPEC);
export function HassanDistrict() {
  return <OsmZoneDistrict id="hassan2" zone={HASSAN2_PLACED} spec={SPEC} />;
}
