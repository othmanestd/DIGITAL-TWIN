// The Hassan II Mosque and its surroundings (landmarks/zones/hassan2Data, OpenStreetMap) placed through the single
// geographic chain (casaFrame). Drawn in "Casa réel" mode only: the procedural city keeps its own mosque.
import { geoToScene } from "@/lib/geo/casaFrame";
import { HASSAN2_ZONE } from "./landmarks/zones/hassan2Data";
import type { PlacedZone } from "./osmZonePlan";

const O = geoToScene(HASSAN2_ZONE.origin.lat, HASSAN2_ZONE.origin.lon);
export const HASSAN2_PLACED: PlacedZone = { zone: HASSAN2_ZONE, ox: O.x, oz: O.z, corridors: [], fill: false };
