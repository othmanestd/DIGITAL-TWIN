// Projections shared by the geo contents and the unified "powers of ten" scene.
// Map (MoroccoContent): d3 Mercator centred on Casablanca -> map-local units, x east, z south, ground (land top) at y = 0.
//   mapProject(CASA_LONLAT) === [0, 0]. Scale the map group by (1000 / MAP_UNITS_PER_KM) to get metres.
// Globe (GlobeContent): sphere of radius GLOBE_RADIUS centred at the local origin; globePoint() gives local coordinates.
import { geoMercator, type GeoProjection } from "d3-geo";
import * as THREE from "three";

/** Casablanca (head office, where the typical hospital sits) — [lon, lat]. */
export const CASA_LONLAT: [number, number] = [-7.5898, 33.5731];

/** Mercator scale: map units per radian of longitude. */
export const MAP_SCALE = 700;
const EARTH_KM = 6371;
/** Map-local units per kilometre at Casablanca's latitude (Mercator scale factor sec φ included). ≈ 0.1319 */
export const MAP_UNITS_PER_KM = (MAP_SCALE / EARTH_KM) / Math.cos((CASA_LONLAT[1] * Math.PI) / 180);

/** A fresh d3 projection (callers may add clipExtent etc.). */
export const mapProjection = (): GeoProjection => geoMercator().center(CASA_LONLAT).scale(MAP_SCALE).translate([0, 0]);
const PROJ = mapProjection();

/** lon/lat -> map-local [x, z] (ground plane y = 0). */
export function mapProject(lon: number, lat: number): [number, number] {
  const p = PROJ([lon, lat]);
  return p ? [p[0], p[1]] : [0, 0];
}

/** Globe radius in globe-local units (scale by EARTH_R / GLOBE_RADIUS for metres). */
export const GLOBE_RADIUS = 100;

/** lon/lat (+ altitude in globe units) -> globe-local point. Same convention as THREE.SphereGeometry, so an
 *  equirectangular texture (top = north, left = lon -180) maps 1:1 onto a sphere patch with matching phi/theta ranges. */
export function globePoint(lon: number, lat: number, alt = 0, out = new THREE.Vector3()) {
  const r = GLOBE_RADIUS + alt;
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return out.set(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Inverse of globePoint (local point on/near the sphere -> [lon, lat]). */
export function globeLonLat(p: THREE.Vector3): [number, number] {
  const n = p.clone().normalize();
  const lat = Math.asin(n.y) * (180 / Math.PI);
  let lon = Math.atan2(n.z, -n.x) * (180 / Math.PI) - 180;
  if (lon < -180) lon += 360;
  return [lon, lat];
}
