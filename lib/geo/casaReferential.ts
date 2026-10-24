// Referential of the georeferenced Casablanca (docs/research/REFERENTIEL-casa.md): control points (monuments and public
// places, OpenStreetMap features found through Nominatim on 24/10/2026) and the eight Akdital establishments of
// Casablanca. Each entry keeps its source and its status:
//   "osm"        position of an OSM feature (centroid of its outline, or its node), verified by source;
//   "osm-probable" an OSM feature whose identity is likely but not certain (name or tag differs);
//   "fiche"      only the Google Maps listing point given in the brief: a search hint, not a surveyed position;
// and what the 3D city does with it today ("modelled", "district" = inside an OSM district, "marker" = a marker only).
// Positions are lat / lon; the scene position always comes from casaFrame.geoToScene.

export type Status = "osm" | "osm-probable" | "fiche";
export type Place = {
  id: string; name: string; lat: number; lon: number; status: Status;
  osm?: string; note?: string; scene: "modelled" | "district" | "marker";
};

/** Monuments and public places (control points of the geographic chain). */
export const CASA_LANDMARKS: Place[] = [
  { id: "twin", name: "Twin Center", lat: 33.5865844, lon: -7.6322923, status: "osm", osm: "node/770235536", scene: "modelled", note: "tours OSM ways 97667268 / 75698627 (115 m, 28 niveaux dans OSM)" },
  { id: "cfc-tower", name: "CFC Tower", lat: 33.5635842, lon: -7.6609624, status: "osm", osm: "way/871612907", scene: "modelled", note: "122 m (architecte / OSM), 136 m (CTBUH) : voir cfc-district.md" },
  { id: "hassan2", name: "Mosquée Hassan II", lat: 33.6082243, lon: -7.6324728, status: "osm", osm: "relation/12679400", scene: "district", note: "volumes OSM (building:part) ; minaret 172 m dans OSM, 200–210 m selon d'autres sources : non tranché" },
  { id: "el-hank", name: "Phare d'El Hank", lat: 33.6099752, lon: -7.6547174, status: "osm", osm: "way/491755179", scene: "marker", note: "hauteur non vérifiée" },
  { id: "sacre-coeur", name: "Cathédrale du Sacré-Cœur", lat: 33.5911809, lon: -7.624501, status: "osm", osm: "way/417111236", scene: "marker" },
  { id: "ligue-arabe", name: "Parc de la Ligue Arabe", lat: 33.5881685, lon: -7.6233416, status: "osm", osm: "way/572383035", scene: "marker" },
  { id: "place-m5", name: "Place Mohammed V", lat: 33.5916377, lon: -7.6198406, status: "osm", osm: "node/12842747272", scene: "marker" },
  { id: "nations-unies", name: "Place des Nations Unies", lat: 33.5949962, lon: -7.6186635, status: "osm", osm: "node/12844672795", scene: "marker" },
  { id: "casa-port", name: "Gare Casa Port", lat: 33.5993825, lon: -7.6123131, status: "osm", osm: "node/2429582026", scene: "marker" },
  { id: "casa-voyageurs", name: "Gare Casa Voyageurs", lat: 33.5903571, lon: -7.5896645, status: "osm", osm: "node/7055155496", scene: "marker" },
  { id: "mahkama", name: "Mahkama du Pacha (Habous)", lat: 33.5789531, lon: -7.6063203, status: "osm", osm: "node/2778538969", scene: "marker" },
  { id: "morocco-mall", name: "Morocco Mall", lat: 33.5756993, lon: -7.7070327, status: "osm", osm: "way/174580197", scene: "marker" },
  { id: "anfa-park", name: "Anfa Park", lat: 33.5630718, lon: -7.6573132, status: "osm", osm: "way/586647221", scene: "district" },
  { id: "stade-m5", name: "Stade Mohammed V", lat: 33.5828249, lon: -7.6468329, status: "osm", osm: "way/1349843482", scene: "marker" },
  { id: "villa-arts", name: "Villa des Arts", lat: 33.5864207, lon: -7.6295534, status: "osm", osm: "way/1388403773", scene: "marker" },
  { id: "nd-lourdes", name: "Notre-Dame de Lourdes", lat: 33.5827016, lon: -7.6157442, status: "osm", osm: "node/13365630026", scene: "marker" },
  { id: "marche-central", name: "Marché central", lat: 33.5948849, lon: -7.6119963, status: "osm", osm: "way/272993158", scene: "marker" },
  { id: "rialto", name: "Cinéma Rialto", lat: 33.5943859, lon: -7.614541, status: "osm", osm: "node/5200595121", scene: "marker" },
];

/** The eight Akdital establishments of Casablanca (brief of 24/10/2026), cross-checked against OSM. */
export const AKDITAL_CASA: Place[] = [
  { id: "anfa-prime-hospital", name: "Anfa Prime Hospital", lat: 33.5820211, lon: -7.6594471, status: "osm-probable", osm: "way/1432538704", scene: "modelled", note: "parcelle OSM (landuse=construction) ; fiche Google à ~44 m" },
  { id: "longchamps", name: "Clinique Longchamps", lat: 33.5817672, lon: -7.6608672, status: "osm", osm: "node/12915145679", scene: "district", note: "operator=Akdital ; bâtiment OSM way 1395302686 (clinic, 2 niveaux)" },
  { id: "jerrada-oasis", name: "Clinique Jerrada Oasis", lat: 33.5565154, lon: -7.6327082, status: "osm", osm: "way/1001376627", scene: "marker", note: "OSM « Clinique jerrada oasis » à 34 m de la fiche (position de fiche conservée)" },
  { id: "ain-borja", name: "Clinique Aïn Borja", lat: 33.585169, lon: -7.5966154, status: "osm", osm: "node/6418215089", scene: "marker", note: "OSM « Akdital Clinique Ain Berja », operator=Akdital, à 28 m de la fiche" },
  { id: "panorama", name: "Clinique Panorama Sidi Maârouf", lat: 33.5260041, lon: -7.6497257, status: "fiche", scene: "marker", note: "aucune entité OSM trouvée à moins de 250 m" },
  { id: "atfal", name: "Clinique pédiatrique Atfal", lat: 33.5586352, lon: -7.6375946, status: "osm-probable", osm: "way/419567550", scene: "marker", note: "bâtiment OSM building=hospital contenant la fiche ; nœud OSM nommé « Clinique Attal » : nom à confirmer" },
  { id: "hpc-ain-sebaa", name: "Hôpital Privé Casablanca Aïn Sebaâ", lat: 33.6126268, lon: -7.5302628, status: "osm", osm: "node/13261125353", scene: "marker", note: "nœud OSM à 29 m de la fiche, sans empreinte de bâtiment" },
  { id: "cioc", name: "Centre International d'Oncologie Casablanca", lat: 33.5568574, lon: -7.6309231, status: "fiche", scene: "marker", note: "aucune entité OSM correspondante ; à 146 m de Jerrada Oasis" },
];
