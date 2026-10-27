// Places of the establishments explorer (components/places/PlacesExplorer.tsx): the Akdital establishments of Casablanca and
// Bouskoura listed on the official directory (https://akdital.ma/fr/nos-etablissements/, read on 26/10/2026), Mibtech, and
// the network's establishments in the other cities (lib/data/network.json) for the Morocco map.
// Positions come only from the Casablanca referential (lib/geo/casaReferential.ts: OpenStreetMap or Google listing points,
// each with its status). network.json places every Casablanca site on the city centre: never used as a building position.
// Districts: the quarter (else the arrondissement) OpenStreetMap / Nominatim gives at the point (26/10/2026).
import { AKDITAL_CASA, PARTNERS_CASA, type Place } from "./casaReferential";
import { SITES } from "./network";

export type PlaceCategory = "Hôpital" | "Clinique" | "Centre d'oncologie" | "Bâtiment partenaire" | "Établissement";
/** osm / osm-probable / fiche: a point (building-level) with its source; city: only the city is known; none: no position;
 *  demo: the twin's own demonstration site (the typical hospital), not a real establishment */
export type CoordStatus = "osm" | "osm-probable" | "fiche" | "city" | "none" | "demo";
/** detailed: a dedicated model; osm-volume: its OpenStreetMap footprint drawn as a volume of the city; marker: a marker only */
export type ModelStatus = "detailed" | "estimated" | "osm-volume" | "marker" | "none";

export type ExplorerPlace = {
  id: string; name: string; officialName: string; brand: "Akdital" | "Mibtech";
  category: PlaceCategory; city: string; district?: string;
  address?: string; addressSource?: string;
  latitude?: number; longitude?: number; coordinateStatus: CoordStatus; coordinateSource?: string;
  /** true only for a position from an OpenStreetMap feature (osm), not for a probable one or a listing point */
  coordinateVerified: boolean;
  officialUrl?: string; mapUrl?: string;
  model3D: ModelStatus; model3DId?: string;
  /** network.json slug (Morocco map, specialties and sources of the establishment) */
  networkSlug?: string;
  description?: string; dataSource: string; lastVerifiedAt: string;
  /** approach radius (m) of the site, from the referential: sets the camera distance */
  r: number;
};

const OFFICIAL = "Répertoire officiel akdital.ma/fr/nos-etablissements (26/10/2026)";
const CHECKED = "26/10/2026";

type Extra = Pick<ExplorerPlace, "officialName" | "category" | "officialUrl" | "model3D" | "district"> & {
  networkSlug: string; model3DId?: string; address?: string; addressSource?: string; city?: string;
};
/** what the referential does not hold: the official directory's name, URL and city, the category from that name, the 3D state */
const AKDITAL: Record<string, Extra> = {
  "anfa-prime-hospital": { officialName: "ANFA PRIME", category: "Hôpital", officialUrl: "https://anfaprime-hospital.ma/", model3D: "detailed", model3DId: "anfa-prime-hospital", networkSlug: "anfa-prime-hospital", district: "Arrondissement du Maârif" },
  "ain-borja": { officialName: "Clinique Ain Borja Casablanca", category: "Clinique", officialUrl: "https://www.cliniqueainborja.ma/", model3D: "marker", networkSlug: "clinique-ain-borja", district: "Roches-Noires" },
  "atfal": { officialName: "Clinique Atfal", category: "Clinique", officialUrl: "https://cliniqueatfal.ma/", model3D: "osm-volume", networkSlug: "clinique-atfal", district: "L'Oasis", address: "Boulevard Abderrahim Bouabid", addressSource: "OpenStreetMap (way 419567550)" },
  "hpc-ain-sebaa": { officialName: "Hôpital Privé Casablanca Ain Sebaa", category: "Hôpital", officialUrl: "https://hpc.ma", model3D: "marker", networkSlug: "hopital-prive-de-casablanca-ain-sebaa", district: "Arrondissement d'Aïn Sebaâ" },
  "cioc": { officialName: "Centre International d’Oncologie Casablanca", category: "Centre d'oncologie", officialUrl: "https://ciocasablanca.ma/", model3D: "marker", networkSlug: "centre-international-doncologie-casablanca", district: "L'Oasis" },
  "longchamps": { officialName: "Clinique Longchamps", category: "Clinique", officialUrl: "https://cliniquelongchamps.ma/", model3D: "osm-volume", networkSlug: "clinique-longchamps", district: "Hay El Hana", address: "4 Boulevard Ghandi", addressSource: "OpenStreetMap (node 12915145679)" },
  "jerrada-oasis": { officialName: "Clinique Jerrada Oasis", category: "Clinique", officialUrl: "https://cliniquejerrada.ma/", model3D: "osm-volume", networkSlug: "clinique-jerrada-oasis", district: "L'Oasis", address: "Boulevard Abderrahim Bouabid", addressSource: "OpenStreetMap (way 1001376627)" },
  "panorama": { officialName: "Clinique Panorama Sidi Maarouf", category: "Clinique", officialUrl: "https://clinique-panorama.ma/", model3D: "marker", networkSlug: "clinique-panorama-sidi-maarouf", district: "Sidi Maârouf" },
};

const SOURCE_LABEL: Record<"osm" | "osm-probable" | "fiche", string> = {
  osm: "OpenStreetMap", "osm-probable": "OpenStreetMap (identité probable)", fiche: "repère de fiche Google, non vérifié",
};
const mapsUrl = (lat: number, lon: number) => `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(7)},${lon.toFixed(7)}`;

function fromReferential(p: Place, x: Extra): ExplorerPlace {
  return {
    id: p.id, name: p.name, officialName: x.officialName, brand: "Akdital", category: x.category, city: "Casablanca", district: x.district,
    address: x.address, addressSource: x.addressSource,
    latitude: p.lat, longitude: p.lon, coordinateStatus: p.status,
    coordinateSource: `${SOURCE_LABEL[p.status]}${p.osm ? ` · ${p.osm}` : ""}`, coordinateVerified: p.status === "osm",
    officialUrl: x.officialUrl, mapUrl: mapsUrl(p.lat, p.lon), model3D: x.model3D, model3DId: x.model3DId, networkSlug: x.networkSlug,
    description: p.note, dataSource: OFFICIAL, lastVerifiedAt: CHECKED, r: p.r ?? 1200,
  };
}

const mib = PARTNERS_CASA.find((p) => p.id === "mibtech")!;
const MIBTECH: ExplorerPlace = {
  id: "mibtech", name: "Mibtech", officialName: "Mibtech", brand: "Mibtech", category: "Bâtiment partenaire", city: "Casablanca", district: "L'Oasis",
  address: "24 Rue des Papillons, Casablanca, Maroc", addressSource: "site officiel mibtech.ma (siège social)",
  latitude: mib.lat, longitude: mib.lon, coordinateStatus: "fiche", coordinateSource: "repère de la fiche Google « MIBTECH » (lien fourni)", coordinateVerified: false,
  officialUrl: "https://mibtech.ma/", mapUrl: "https://maps.app.goo.gl/Y2qYWsH8rJ2mDBLz9", model3D: "detailed", model3DId: "mibtech",
  description: mib.note, dataSource: "Lien Google Maps fourni ; site officiel mibtech.ma ; OpenStreetMap (26/10/2026)", lastVerifiedAt: CHECKED, r: mib.r ?? 900,
};

/** the twin's typical hospital (the clinic modelled by the team, buildings, departments, staff and use cases), listed as
 *  « Clinique démo »: a demonstration site, not an Akdital establishment, and not at a real address */
export const DEMO_ID = "clinique-demo";
const DEMO: ExplorerPlace = {
  id: DEMO_ID, name: "Clinique démo", officialName: "Clinique démo · hôpital type du jumeau numérique", brand: "Akdital",
  category: "Clinique", city: "Casablanca", coordinateStatus: "demo", coordinateVerified: false, model3D: "detailed", model3DId: DEMO_ID,
  description: "L'hôpital type du jumeau numérique : bâtiment principal et siège, services, équipes et cas d'usage IA, visitables à pied. Site de démonstration : ce n'est pas un établissement réel et sa position dans la ville est fictive.",
  dataSource: "Jumeau numérique · hôpital type (modèle de l'équipe)", lastVerifiedAt: "", r: 500,
};

const BOUSKOURA: ExplorerPlace = {
  id: "bien-etre-bouskoura", name: "La Clinique du Bien-Être Bouskoura", officialName: "La Clinique du Bien-Être Bouskoura", brand: "Akdital",
  category: "Clinique", city: "Bouskoura", coordinateStatus: "none", coordinateVerified: false,
  officialUrl: "https://akditalife-bouskoura.ma/", model3D: "none", networkSlug: "akditalife-clinique-du-bien-etre-bouskoura",
  description: "Aucune position de bâtiment vérifiée ; Bouskoura est aussi hors de la couche de ville de Casablanca.",
  dataSource: OFFICIAL, lastVerifiedAt: CHECKED, r: 1200,
};

/** category from the establishment's own name; neutral when the name does not say */
function categoryOf(name: string): PlaceCategory {
  if (/oncolog/i.test(name)) return "Centre d'oncologie";
  if (/^(l['’])?h[oô]pital|hospital/i.test(name)) return "Hôpital";
  if (/clinique|polyclinique/i.test(name)) return "Clinique";
  return "Établissement";
}

const CASA_SLUGS = new Set([...Object.values(AKDITAL).map((x) => x.networkSlug), BOUSKOURA.networkSlug, "onco-prime-hospital", "cardio-prime-hospital"]);
/** the network's establishments elsewhere in Morocco: city only (no building position), shown on the Morocco map */
const ELSEWHERE: ExplorerPlace[] = SITES.filter((s) => !CASA_SLUGS.has(s.slug) && s.citySlug !== "casablanca").map((s) => ({
  id: `site:${s.slug}`, name: s.name, officialName: s.name, brand: "Akdital", category: categoryOf(s.name), city: s.city,
  coordinateStatus: s.noCoords ? "none" : "city", coordinateVerified: false, model3D: "none", networkSlug: s.slug,
  description: s.status !== "opérationnel" ? s.status : undefined,
  dataSource: "Recherche réseau Akdital (lib/data/network.json)", lastVerifiedAt: "", r: 0,
}));

export const EXPLORER_PLACES: ExplorerPlace[] = [
  DEMO,
  ...AKDITAL_CASA.filter((p) => AKDITAL[p.id]).map((p) => fromReferential(p, AKDITAL[p.id])),
  BOUSKOURA,
  MIBTECH,
  ...ELSEWHERE,
];
export const explorerPlace = (id: string) => EXPLORER_PLACES.find((p) => p.id === id);
/** a building-level position the camera can fly to */
export const hasPoint = (p: ExplorerPlace) => p.latitude != null && p.longitude != null && (p.coordinateStatus === "osm" || p.coordinateStatus === "osm-probable" || p.coordinateStatus === "fiche");

export const COORD_LABEL: Record<CoordStatus, string> = {
  osm: "Position vérifiée (OSM)", "osm-probable": "Position probable (OSM)", fiche: "Repère Google · à vérifier", city: "Ville seulement", none: "Localisation à vérifier",
  demo: "Site de démonstration",
};
export const MODEL_LABEL: Record<ModelStatus, string> = {
  detailed: "Modèle 3D détaillé", estimated: "Modèle d'après photos, emprise estimée", "osm-volume": "Volume OSM", marker: "Marqueur", none: "Pas de 3D",
};
