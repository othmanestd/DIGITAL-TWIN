// node scripts/build-network.mjs [path/to/akdital_network.json]
// Converts the sourced research file (_source/atlas_research/akdital_network.json) into lib/data/network.json:
// slugs, citySlug, normalised status, and one aggregate per city. Nothing is invented: establishments without
// coordinates are kept in the data but flagged (noCoords) so the map can skip them honestly.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = process.argv[2] || path.join(here, "..", "..", "_source", "atlas_research", "akdital_network.json");
const dest = path.join(here, "..", "lib", "data", "network.json");

const slugify = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/['’`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function normStatus(s) {
  const v = slugify(s);
  if (!v) return "opérationnel";
  if (/(construction|chantier|travaux|under-construction|building)/.test(v)) return "en construction";
  if (/(annonce|projet|planned|pipeline|announced|prevu|programme|future|signed|signe)/.test(v)) return "projet annoncé";
  return "opérationnel";
}
const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const str = (v) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(" ; ") : String(v));
const arr = (v) => (Array.isArray(v) ? v.map(String) : v ? String(v).split(/[,;/]+/).map((x) => x.trim()).filter(Boolean) : []);

// City name canonicalisation (spelling variants seen in press sources -> one display name).
const CITY_ALIASES = {
  fez: "Fès", fes: "Fès", meknes: "Meknès", sale: "Salé", tetouan: "Tétouan", laayoune: "Laâyoune", "el-aaiun": "Laâyoune",
  kenitra: "Kénitra", "beni-mellal": "Béni Mellal", tanger: "Tanger", tangier: "Tanger", casablanca: "Casablanca",
  marrakech: "Marrakech", marrakesh: "Marrakech", "el-jadida": "El Jadida", khouribga: "Khouribga", oujda: "Oujda",
  agadir: "Agadir", rabat: "Rabat", safi: "Safi", nador: "Nador", dakhla: "Dakhla", "ad-dakhla": "Dakhla", errachidia: "Errachidia",
  guelmim: "Guelmim", taza: "Taza", berrechid: "Berrechid", settat: "Settat", mohammedia: "Mohammedia", temara: "Témara",
  ouarzazate: "Ouarzazate", "al-hoceima": "Al Hoceïma", larache: "Larache", essaouira: "Essaouira", khemisset: "Khémisset",
};
const cityName = (c) => CITY_ALIASES[slugify(c)] || String(c || "").trim();
// Localities counted inside a bigger city in Akdital's official "25 villes" (research gap note: Bouskoura -> Casablanca).
// The site keeps its locality; the map aggregates it under the city.
const CITY_OF_LOCALITY = { bouskoura: "Casablanca" };
const srcList = (v) => (Array.isArray(v) ? v.map(String) : v ? String(v).split(/\s*;\s*/).filter(Boolean) : []);

// Country -> ISO 3166-1 alpha-2 (the research gives French country names, no codes).
const ISO = {
  "arabie-saoudite": "SA", "emirats-arabes-unis": "AE", tunisie: "TN", senegal: "SN", "cote-divoire": "CI", mauritanie: "MR",
  mali: "ML", egypte: "EG", qatar: "QA", koweit: "KW", oman: "OM", bahrein: "BH", jordanie: "JO", libye: "LY", algerie: "DZ",
  france: "FR", espagne: "ES", gabon: "GA", cameroun: "CM", nigeria: "NG", kenya: "KE",
};
// Approximate country centroids, used ONLY when a project's country is known but its city is not (shown as country-level).
// Tunisia: the research names the group (Taoufik Hospitals Group, Tunis-based) but not the city -> placed on Tunis, labelled at country level.
const COUNTRY_CENTROID = { TN: [10.1815, 36.8065] };
// Classified on the LEADING words of the research status (later clauses are context, e.g. "ouverture visée 2027").
// opérationnel | en construction | projet annoncé | incertain (negotiation, suspended closing, not officially announced)
function intlStatus(s) {
  const v = slugify(s);
  if (/^(operationnel|ouvert|open|en-service)/.test(v)) return "opérationnel";
  if (/^(negociation|discussion)/.test(v) || /suspendu|veto|non-annonce/.test(v)) return "incertain";
  if (/^(en-construction|en-cours-d-?amenagement|en-cours-de-construction|amenagement|travaux|chantier)/.test(v) || /en-construction-selon/.test(v)) return "en construction";
  return "projet annoncé";
}
const bedsOf = (t) => { const m = /(\d[\d\s]*)\s*lits/.exec(String(t || "")); return m ? Number(m[1].replace(/\s/g, "")) : null; };

if (!existsSync(src)) {
  const empty = { meta: { pending: true, source: path.relative(path.join(here, ".."), src), generated: new Date().toISOString(), counts: { sites: 0, cities: 0, international: 0 } }, group: null, brands: [], sites: [], cities: [], international: [], gaps: [] };
  writeFileSync(dest, JSON.stringify(empty, null, 1));
  console.log("research file not found yet -> wrote empty", dest);
  process.exit(0);
}

const raw = JSON.parse(readFileSync(src, "utf8"));
const estabs = raw.establishments || raw.sites || [];

const used = new Set();
const sites = estabs.map((e) => {
  const locality = cityName(e.city);
  const city = CITY_OF_LOCALITY[slugify(locality)] || locality;
  let slug = slugify(e.name) || slugify(`${e.brand}-${city}`);
  if (used.has(slug)) { let i = 2; while (used.has(`${slug}-${i}`)) i++; slug = `${slug}-${i}`; }
  used.add(slug);
  const lat = num(e.lat), lon = num(e.lon);
  return {
    slug, name: str(e.name).trim(), brand: str(e.brand).trim(), city, citySlug: slugify(city), locality, region: str(e.region).trim(),
    lat: lat ?? 0, lon: lon ?? 0, noCoords: lat === null || lon === null,
    type: str(e.type).trim(), specialties: arr(e.specialties),
    premium: typeof e.premium === "boolean" ? e.premium : null, premium_evidence: e.premium_evidence ? str(e.premium_evidence) : null,
    beds: num(e.beds), status: normStatus(e.status), opening_year: num(e.opening_year), source: str(e.source),
    sources: srcList(e.source), notes: e.notes ? str(e.notes) : null,
  };
});

const byCity = new Map();
for (const s of sites) {
  if (!byCity.has(s.citySlug)) byCity.set(s.citySlug, []);
  byCity.get(s.citySlug).push(s);
}
const cities = [...byCity.entries()].map(([slug, list]) => {
  const located = list.filter((s) => !s.noCoords);
  const ref = located.filter((s) => s.status === "opérationnel").length ? located.filter((s) => s.status === "opérationnel") : located;
  const lat = ref.length ? ref.reduce((a, s) => a + s.lat, 0) / ref.length : 0;
  const lon = ref.length ? ref.reduce((a, s) => a + s.lon, 0) / ref.length : 0;
  const op = list.filter((s) => s.status === "opérationnel");
  const known = op.filter((s) => s.beds !== null);
  return {
    slug, name: list[0].city, region: list.find((s) => s.region)?.region || "",
    lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000, noCoords: !located.length,
    sites: list.map((s) => s.slug), operational: op.length,
    construction: list.filter((s) => s.status === "en construction").length,
    announced: list.filter((s) => s.status === "projet annoncé").length,
    beds: known.length ? known.reduce((a, s) => a + s.beds, 0) : null, bedsKnownFor: known.length,
  };
}).sort((a, b) => b.operational - a.operational || b.sites.length - a.sites.length || a.name.localeCompare(b.name, "fr"));

const international = (raw.international || []).map((x) => {
  const iso = str(x.iso || x.iso2 || x.country_code).trim().toUpperCase() || ISO[slugify(x.country)] || "";
  let lat = num(x.lat), lon = num(x.lon), precision = "ville";
  if ((lat === null || lon === null) && COUNTRY_CENTROID[iso]) { [lon, lat] = COUNTRY_CENTROID[iso]; precision = "pays"; }
  return {
    country: str(x.country).trim(), iso, city: str(x.city).trim(),
    lat: lat ?? 0, lon: lon ?? 0, noCoords: lat === null || lon === null, precision,
    project: str(x.project || x.name || x.description).trim(), status: str(x.status).trim(), statusKey: intlStatus(x.status),
    // beds parsed from the project text, except for multi-hospital groups (one figure would be misleading)
    beds: num(x.beds) ?? (/group|groupe/i.test(str(x.project)) ? null : bedsOf(x.project)),
    details: x.details ? str(x.details) : null, source: str(x.source), sources: srcList(x.sources || x.source),
  };
});
const brands = (raw.brands || []).map((b) =>
  typeof b === "string" ? { name: b, positioning: "", source: "" } : { name: str(b.name).trim(), positioning: str(b.positioning || b.description).trim(), source: str(b.source) });

const out = {
  meta: {
    pending: false, source: "_source/atlas_research/akdital_network.json", generated: new Date().toISOString(),
    counts: { sites: sites.length, operational: sites.filter((s) => s.status === "opérationnel").length, cities: cities.length, international: international.length },
  },
  asOf: raw.as_of ?? null, group: raw.group ?? null, brands, sites, cities, international, gaps: raw.gaps ?? [],
};
writeFileSync(dest, JSON.stringify(out, null, 1));
console.log("wrote", dest, out.meta.counts);
