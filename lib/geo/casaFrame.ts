// The single geographic chain of the 3D Casablanca: latitude / longitude → scene metres (x east, z south, map north = −z),
// with its origin at CASA_LONLAT, the point where the Morocco map and the globe already put the typical hospital (scene
// origin). A local tangent plane: equirectangular at the origin latitude, R = 6371008.8 m (IUGG mean radius); against the
// map's Mercator the scale differs by ≈ 0.05 % 10 km north or south of the origin (≈ 5 m), well under a building's size.
// Every georeferenced layer (OSM districts, coast, monuments, Akdital sites) goes through geoToScene; nothing is moved by
// hand. "Casa réel" mode (CASA_REEL) puts the city on this chain; without it the procedural city keeps its own layout.
import { CASA_LONLAT } from "./projection";

export const EARTH_R = 6371008.8;
const [LON0, LAT0] = CASA_LONLAT;
const K = (Math.PI / 180) * EARTH_R, COS0 = Math.cos((LAT0 * Math.PI) / 180);

/** latitude / longitude (degrees) → scene metres */
export const geoToScene = (lat: number, lon: number): { x: number; z: number } => ({ x: (lon - LON0) * K * COS0, z: -(lat - LAT0) * K });
/** scene metres → latitude / longitude (degrees) */
export const sceneToGeo = (x: number, z: number): { lat: number; lon: number } => ({ lat: LAT0 - z / K, lon: LON0 + x / (K * COS0) });
/** great-circle distance (m), to check the chain against independent control points */
export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180, dφ = (lat2 - lat1) * r, dλ = (lon2 - lon1) * r;
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(a));
}

/** "Casa réel": the georeferenced city (URL ?casa=reel, or localStorage "casa-reel" = "1"). Read once at load: the plan
 *  and the districts are built for one mode; switching reloads the page. Off on the server and by default. */
export const CASA_REEL: boolean = (() => {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("casa");
    if (q === "reel") { window.localStorage.setItem("casa-reel", "1"); return true; }
    if (q === "generee") { window.localStorage.removeItem("casa-reel"); return false; }
    return window.localStorage.getItem("casa-reel") === "1";
  } catch { return false; }
})();
