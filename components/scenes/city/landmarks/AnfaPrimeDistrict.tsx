"use client";
// <AnfaPrimeDistrict/>: the surroundings of Anfa Prime Hospital from OpenStreetMap (OSM zone, see OsmZoneDistrict /
// zoneGeo): boulevard Ghandi, boulevard Abdelkrim El Khattabi and its roundabout, the Anfa villas with their pools, the
// Clinique Longchamps (operator Akdital in OSM) and the Clinique Ghandi. The clinic's parcel is mapped in OSM as a building
// site (way 1432538704, landuse=construction); the hospital model (AnfaPrime.tsx) stands on it, so the parcel is drawn as
// the hospital's paved grounds, and no OSM building stands under the model. No illustrative frontage blocks here (a villa
// district); the garden trees around the houses are illustrative (osmZonePlan, gardens).
import { ANFA_ZONE } from "../anfaZone";
import { ANFA_DISTRICT, ANFA_PRIME } from "../geography";
import { OsmZoneDistrict, zoneBuilt, zoneSolids } from "./OsmZoneDistrict";
import { inPoly } from "./zoneKit";
import type { ZoneSpec } from "./zoneGeo";

/** the model's origin in zone-local metres, and its footprint (buildings + front garden), local to the model */
const MO = { x: ANFA_PRIME.x - ANFA_DISTRICT.ox, z: ANFA_PRIME.z - ANFA_DISTRICT.oz };
const underModel = (x: number, z: number) => {
  const c = Math.cos(ANFA_PRIME.yaw), s = Math.sin(ANFA_PRIME.yaw), dx = x - MO.x, dz = z - MO.z;
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  return Math.abs(lx) < 40 && lz > -34 && lz < 31;
};

const SPEC: ZoneSpec = {
  replaced: (b) => underModel(b.o[0], b.o[1]),
  ground: (a) => (a.k === "site" && inPoly(pts2(a.p), 0, 0) ? "plaza" : undefined),
  poiSub: (name) => (name.startsWith("Clinique Longchamps") ? "opérateur Akdital (OSM)" : undefined),
  // Anfa Supérieur is a villa district: an untyped building (`building=yes`) without storeys is estimated as a two-storey
  // villa when small, three storeys otherwise (estimates, reported as such)
  estimate: (b) => (b.type === "yes" ? (b.a < 700 ? { lv: 2, villa: true } : { lv: 3, villa: false }) : undefined),
};
function pts2(p: number[]) { const o: [number, number][] = []; for (let i = 0; i < p.length; i += 2) o.push([p[i], p[i + 1]]); return o; }

export const anfaDistrictSolids = () => zoneSolids("anfa", ANFA_ZONE, SPEC);
export const anfaDistrictStats = () => zoneBuilt("anfa", ANFA_ZONE, SPEC).stats;
export function AnfaPrimeDistrict() {
  return <OsmZoneDistrict id="anfa" zone={ANFA_ZONE} spec={SPEC} />;
}
