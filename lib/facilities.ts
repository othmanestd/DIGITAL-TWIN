// Real Akdital establishments drawn as buildings in the generated Casablanca (components/scenes/city/landmarks/). Every fact
// shown for them comes from the network data (lib/data/network.json, read through lib/geo/network): no figure of its own here.
// Their place in the city is a modelling choice (the generated city is not georeferenced): see ANFA_PRIME in city/geography.ts.
import { siteBySlug, type Site } from "./geo/network";

export type Facility = {
  /** slug of the main site in network.json (also the selection id: { kind: "facility", id: slug }) */
  slug: string;
  /** slugs of the poles housed in the same complex */
  poles: string[];
};

export const FACILITIES: Facility[] = [
  { slug: "anfa-prime-hospital", poles: ["onco-prime-hospital", "cardio-prime-hospital"] },
];

export const facilityBySlug = (slug: string) => FACILITIES.find((f) => f.slug === slug);

/** The network records of a facility: its main site and its poles (missing records are skipped). */
export function facilitySites(slug: string): { main: Site | undefined; poles: Site[] } {
  const f = facilityBySlug(slug);
  return { main: siteBySlug(slug), poles: (f?.poles ?? []).map(siteBySlug).filter((s): s is Site => !!s) };
}
