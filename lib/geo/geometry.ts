// Geo helpers shared by the Morocco map and the globe.
// Morocco map: d3 Mercator centred on Casablanca -> map-local units (x east, z south, y up). 1 unit ≈ 7.6 km at Casablanca.
import { geoPath, geoGraticule, geoBounds } from "d3-geo";
import { mapProjection, mapProject, globePoint, GLOBE_RADIUS } from "./projection";
import * as THREE from "three";
import geodata from "./geodata.json";

type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type GeoFeature = GeoJSON.Feature<Geom, { name?: string }>;

export const GEO = geodata as unknown as {
  morocco: GeoFeature; moroccoLow: GeoFeature; neighbours: GeoJSON.FeatureCollection<Geom, { name: string }>; land: GeoFeature;
};

// Map projection lives in ./projection (centred on Casablanca: mapProject(CASA) = [0, 0]).
export const maProjection = mapProjection;
/** lon/lat -> map plane [x, z] (alias of mapProject) */
export const toXZ = mapProject;

/** Collect projected rings (optionally clipped to an extent) through a d3 path context. */
function projectedRings(feature: GeoJSON.Feature | GeoJSON.Geometry, clip?: [[number, number], [number, number]]) {
  const proj = maProjection();
  if (clip) proj.clipExtent(clip);
  const rings: [number, number][][] = [];
  let cur: [number, number][] | null = null;
  const ctx = {
    moveTo(x: number, y: number) { cur = [[x, y]]; rings.push(cur); },
    lineTo(x: number, y: number) { cur?.push([x, y]); },
    closePath() { cur = null; },
    arc() {}, rect() {},
  };
  geoPath(proj, ctx as unknown as CanvasRenderingContext2D)(feature as GeoJSON.Feature);
  return rings.filter((r) => r.length > 3);
}

const area = (r: [number, number][]) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
};

/** THREE.Shapes in the XY plane with y = -z (so that rotateX(-PI/2) maps them onto the map plane). */
export function shapesOf(feature: GeoJSON.Feature | GeoJSON.Geometry, clip?: [[number, number], [number, number]], minArea = 0.4) {
  const rings = projectedRings(feature, clip);
  if (!rings.length) return { shapes: [] as THREE.Shape[], outlines: [] as [number, number][][] };
  // outer rings share the orientation of the largest ring; the others are holes of the preceding outer ring
  const big = rings.reduce((a, r) => (Math.abs(area(r)) > Math.abs(area(a)) ? r : a), rings[0]);
  const outerSign = Math.sign(area(big));
  const shapes: THREE.Shape[] = [];
  const outlines: [number, number][][] = [];
  for (const r of rings) {
    const a = area(r);
    if (Math.abs(a) < minArea) continue;
    const pts = r.map(([x, y]) => new THREE.Vector2(x, -y));
    if (Math.sign(a) === outerSign || !shapes.length) { shapes.push(new THREE.Shape(pts)); outlines.push(r); }
    else shapes[shapes.length - 1].holes.push(new THREE.Path(pts));
  }
  return { shapes, outlines };
}

/** Graticule as straight segments (Mercator: meridians and parallels are axis-aligned lines). */
export function graticuleSegments(step = 2, extent: [[number, number], [number, number]] = [[-30, 10], [12, 46]]) {
  const g = geoGraticule().step([step, step]).extent(extent);
  const segs: number[] = [];
  for (const line of g.lines()) {
    const c = line.coordinates;
    for (let i = 0; i < c.length - 1; i++) {
      const [ax, az] = toXZ(c[i][0], c[i][1]);
      const [bx, bz] = toXZ(c[i + 1][0], c[i + 1][1]);
      segs.push(ax, 0, az, bx, 0, bz);
    }
  }
  return new Float32Array(segs);
}

/** Globe: lon/lat -> point on a sphere of radius r (see globePoint in ./projection). */
export function toSphere(lon: number, lat: number, r: number, out = new THREE.Vector3()) {
  return globePoint(lon, lat, r - GLOBE_RADIUS, out);
}

/** Visual centre of Morocco INCLUDING the southern provinces (centre of its lon/lat bounding box). */
export const MOROCCO_CENTER_LONLAT: [number, number] = (() => {
  const [[x0, y0], [x1, y1]] = geoBounds(GEO.morocco);
  return [Math.round(((x0 + x1) / 2) * 1000) / 1000, Math.round(((y0 + y1) / 2) * 1000) / 1000];
})();
