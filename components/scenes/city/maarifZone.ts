// The Maârif pilot zone placed in the city: the OSM data (landmarks/zones/maarifData) at its world offset, with the plan's
// tram boulevard (z = MAARIF_DISTRICT.tramZ, a 30 m boulevard and its pavements) kept free of zone buildings.
import { MAARIF_DISTRICT as M } from "./geography";
import { MAARIF } from "./landmarks/zones/maarifData";
import type { PlacedZone } from "./osmZonePlan";

export const MAARIF_ZONE: PlacedZone = { zone: MAARIF, ox: M.ox, oz: M.oz, corridors: [{ z0: M.tramZ - M.oz - 21, z1: M.tramZ - M.oz + 21 }] };
