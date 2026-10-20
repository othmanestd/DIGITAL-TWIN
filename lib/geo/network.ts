// Akdital network (establishments, cities, international). Filled from the sourced research file
// _source/atlas_research/akdital_network.json, converted by `node scripts/build-network.mjs` into lib/data/network.json.
// Nothing here is invented: every site comes from the research file with its source.
import raw from "@/lib/data/network.json";

export type SiteStatus = "opérationnel" | "en construction" | "projet annoncé";
export type Site = {
  slug: string; name: string; brand: string; city: string; citySlug: string; region: string; lat: number; lon: number;
  type: string; specialties: string[]; premium: boolean | null; beds: number | null;
  status: SiteStatus; opening_year: number | null; source: string;
  /** added by the geo builder */
  premium_evidence?: string | null;
  /** all source URLs (source = the same list joined with " ; ") and the researcher's notes */
  sources?: string[]; notes?: string | null;
  /** locality as written in the research when it is aggregated under a bigger city (e.g. Bouskoura -> Casablanca) */
  locality?: string;
  /** true when the research gave no coordinates (the site is listed but not placed on the map) */
  noCoords?: boolean;
};
export type City = {
  slug: string; name: string; region: string; lat: number; lon: number; sites: string[]; operational: number; beds: number | null;
  /** added by the geo builder */
  construction?: number; announced?: number; bedsKnownFor?: number; noCoords?: boolean;
};
export type Intl = {
  country: string; iso: string; city: string; lat: number; lon: number; project: string; status: string; source: string;
  /** added by the geo builder: normalised status, beds (parsed from the project text), ISO code is filled (SA, AE, TN),
   *  research details, source list, placement precision ("ville" | "pays": city not given, placed on the capital) */
  statusKey?: IntlStatus; beds?: number | null; details?: string | null; sources?: string[];
  precision?: "ville" | "pays"; noCoords?: boolean;
};
export type IntlStatus = "opérationnel" | "en construction" | "projet annoncé" | "incertain";
export type Brand = { name: string; positioning: string; source: string };

type Raw = {
  meta: { pending: boolean; source: string; generated: string; counts: Record<string, number> };
  asOf?: string | null;
  brands: Brand[]; sites: Site[]; cities: City[]; international: Intl[]; gaps: unknown[];
};
const data = raw as unknown as Raw;

export const SITES: Site[] = data.sites ?? [];
export const CITIES: City[] = data.cities ?? [];
export const INTERNATIONAL: Intl[] = data.international ?? [];
export const BRANDS: Brand[] = data.brands ?? [];
export const GROUP = { establishments: 45, beds: 4864, cities: 25, target2028: { establishments: 59, beds: 6000, cities: 29 }, source: "Communiqué Akdital S1 2026" };

/** Provenance of the network data (pending = research file not converted yet; gaps = what the research could not confirm). */
export const NETWORK_META = { ...data.meta, asOf: data.asOf ?? null, gaps: data.gaps ?? [] };
/** Head office (siège) — Casablanca. */
export const HQ_CITY = "casablanca";
export const siteBySlug = (slug: string) => SITES.find((s) => s.slug === slug);
export const cityBySlug = (slug: string) => CITIES.find((c) => c.slug === slug);
