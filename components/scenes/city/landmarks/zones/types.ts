// Shape of a generated OpenStreetMap zone (docs/research/osm-zone-extract.py). Zone-local metres: x east, z south, origin
// = `origin` (lat/lon), equirectangular at that latitude. p = flat [x0, z0, x1, z1, …]; o = oriented box [cx, cz, yaw, w, d].
export type ZoneBuilding = {
  id: number; type: string; name: string; lv: number | null; h: number | null; minLv: number | null;
  /** façade / roof colour tags as mapped ("" when not mapped) */
  col: string; roof: string;
  /** 1 when a shop, office, café, bank … point of OSM lies inside the footprint */
  shop: number; a: number; p: number[]; holes: number[][]; o: [number, number, number, number, number];
};
export type ZoneRoad = { w: number; k: string; o: number; name: string; p: number[] };
export type ZoneArea = { k: string; name: string; p: number[] };
export type OsmZone = {
  name: string; origin: { lat: number; lon: number }; box: { x0: number; x1: number; z0: number; z1: number };
  buildings: ZoneBuilding[]; roads: ZoneRoad[]; paths: { w: number; p: number[] }[]; tram: number[][]; areas: ZoneArea[];
  treeRows: number[][]; trees: number[][]; crossings: number[][]; signals: number[][]; bus: { name: string; x: number; z: number }[];
  pois: { name: string; kind: "hospital" | "clinic" | "worship" | "hotel"; x: number; z: number }[];
};
