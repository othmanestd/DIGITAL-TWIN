"use client";
// <CityLandmarks/>: the Hassan II-like mosque, the Casablanca Finance City district (OSM, CfcDistrict), the Twin Center and the Maârif pilot district (OSM, MaarifDistrict), Anfa Prime and the trams, all procedural and textured in code (see texturePaint.ts).
// Mount it next to <CityContent/>; flip LEGACY_LANDMARKS off in CityContent once these are in.
import { useEffect } from "react";
import { registerSolids } from "../collide";
import { Mosque, mosqueSolids } from "./Mosque";
import { CfcDistrict, cfcDistrictSolids } from "./CfcDistrict";
import { Trams } from "./Tram";
import { AnfaPrime, anfaPrimeSolids } from "./AnfaPrime";
import { MibtechBuilding, mibtechSolids } from "./MibtechBuilding";
import { TwinCenter, twinCenterSolids } from "./TwinCenter";
import { MaarifDistrict, maarifSolids } from "./MaarifDistrict";
import { AnfaPrimeDistrict, anfaDistrictSolids } from "./AnfaPrimeDistrict";
import { OsmCredit } from "./OsmCredit";
import { HassanDistrict, hassanSolids } from "./HassanDistrict";
import { CASA_REEL } from "@/lib/geo/casaFrame";

export { MOSQUE_TOP } from "./Mosque";
export { ANFA_PRIME_ID } from "./AnfaPrime";
export { cfcTowers } from "./Cfc";
export { TRAMS, TRAM_STOPS_X, platformZ, TRAM_LEN } from "./Tram";
export { ENV } from "./env";

export function CityLandmarks() {
  // walk-mode solids of the landmarks (the legacy ones in plan.citySolids go away with LEGACY_LANDMARKS)
  useEffect(() => {
    // "Casa réel" (casaFrame): the OSM Hassan II replaces the procedural mosque, the procedural tram line is not drawn
    const own = CASA_REEL ? hassanSolids() : mosqueSolids();
    registerSolids("landmarks", [...own, ...cfcDistrictSolids(), ...anfaPrimeSolids(), ...twinCenterSolids(), ...maarifSolids(), ...anfaDistrictSolids(), ...(CASA_REEL ? mibtechSolids() : [])]);
    return () => registerSolids("landmarks", []);
  }, []);
  return (
    <>
      {CASA_REEL ? <HassanDistrict /> : <Mosque />}
      <CfcDistrict />
      {!CASA_REEL && <Trams />}
      <AnfaPrime />
      {CASA_REEL && <MibtechBuilding />}
      <TwinCenter />
      <MaarifDistrict />
      <AnfaPrimeDistrict />
      <OsmCredit />
    </>
  );
}
