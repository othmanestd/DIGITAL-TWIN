// The Anfa Prime surroundings placed in the city: the OSM data (landmarks/zones/anfaPrimeData) at its world offset. A villa
// district: no illustrative frontage blocks (fill: false), plausible garden trees around the houses (gardens: true).
import { ANFA_DISTRICT as A } from "./geography";
import { ANFA_PRIME_ZONE } from "./landmarks/zones/anfaPrimeData";
import type { PlacedZone } from "./osmZonePlan";

export const ANFA_ZONE: PlacedZone = { zone: ANFA_PRIME_ZONE, ox: A.ox, oz: A.oz, corridors: [], fill: false, gardens: true };
