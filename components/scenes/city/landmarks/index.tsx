"use client";
// <CityLandmarks/>: the Hassan II-like mosque, the CFC cluster and the trams, all procedural and textured in code (see texturePaint.ts).
// Mount it next to <CityContent/>; flip LEGACY_LANDMARKS off in CityContent once these are in.
import { useEffect } from "react";
import { registerSolids } from "../collide";
import { Mosque, mosqueSolids } from "./Mosque";
import { Cfc, cfcSolids } from "./Cfc";
import { Trams } from "./Tram";
import { AnfaPrime, anfaPrimeSolids } from "./AnfaPrime";
import { TwinCenter, twinCenterSolids } from "./TwinCenter";

export { MOSQUE_TOP } from "./Mosque";
export { ANFA_PRIME_ID } from "./AnfaPrime";
export { cfcTowers } from "./Cfc";
export { TRAMS, TRAM_STOPS_X, platformZ, TRAM_LEN } from "./Tram";
export { ENV } from "./env";

export function CityLandmarks() {
  // walk-mode solids of the landmarks (the legacy ones in plan.citySolids go away with LEGACY_LANDMARKS)
  useEffect(() => {
    registerSolids("landmarks", [...mosqueSolids(), ...cfcSolids(), ...anfaPrimeSolids(), ...twinCenterSolids()]);
    return () => registerSolids("landmarks", []);
  }, []);
  return (
    <>
      <Mosque />
      <Cfc />
      <Trams />
      <AnfaPrime />
      <TwinCenter />
    </>
  );
}
