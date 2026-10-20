// Business model v1.0 (302 MDH of payroll saved, 160 MDH of agent cost, 142 MDH net).
// Every figure comes from lib/data/base.json, generated from the strategy model (_source/organisme3d/gen_data.py).
import base from "./data/base.json";
import bench from "./data/benchmarks.json";

export type Step = { acteur: string; texte: string };
export type UseCase = {
  id: string; famille: string; domaine: string; titre: string; aujourdhui: string; solution: string; brique: string; mode: string;
  porteur: string; chef_de_file: string; famille_ia_twin: string; systemes: string[]; part_famille: number; metier_libere: string;
  perimetres: string[]; avant: Step[]; apres: Step[]; kpi: string[]; mesure_point_zero: string; prerequis: string; sensibilite: string;
  validation_humaine: string; garde_fous: string; maturite: string; vague: string; depend_de: string[]; alimente: string[];
  risque_principal: string; etp: number; mdh: number; cout: number; net: number; roi: number; w: number; intensite: number; sys: string[];
  // v1.3
  fam: string;                       // family code A S P H T (in the 302 MDH) or X C R I (value outside the payroll)
  in302: boolean;                    // its value is counted in the 302 MDH of payroll
  value_out?: string | null;         // value outside the payroll, as written in the v1.3 fiche (indicative, non-additive)
  value_levers?: { type: string; ordre_grandeur?: string; origine_v09?: string }[] | null;
  levier_hors_ms?: string | null;
  solutions?: string[];              // solutions named in v1.3 (Agentic Command Center, Three, Keeps, Rafiq, JABB Twin, Expériences IA, agents)
  proof?: { resultat: string; ou: string; niveau: string; niveau_code: string; lecture_akdital?: string; source?: string; source_url?: string } | null;
  elsewhere?: string | null;         // "ça a marché ailleurs" — what was achieved elsewhere, in plain words
  bench_ids?: string[];
  status_v13?: "same" | "changed" | "new";
};
export type Benchmark = {
  id: string; v13: string[]; app: string[]; related: string[]; who: string; country: string; what: string; result: string;
  metric: string; year: number | null; level: string; source: string; url: string | null; reading: string | null; measured: boolean; note?: string | null;
};
export type Family = { code: string; name: string; etp: number; part: number; postes: number; mdh: number; cout_mad: number; cout: number; net: number; roi: number; n: number; in_302?: boolean; note?: string | null };

export const DATA = base as unknown as {
  meta: {
    eco: number; budget: number; net: number; roi: number; postes: number; n_cases: number; sigma_w: number; intens: Record<string, number>;
    etp_total_teaser: number; autres: number; admin: number; turnover: number; departs_an: number; etab: number; lits: number;
    etab_2028: number; lits_2028: number; pub: Record<string, string>; part_ms: string; flag_160: string; date: string;
  };
  fams: Family[];
  cases: UseCase[];
  domains: { id: string; fam: string; name: string; cases: string[]; mdh: number; etp: number; cout: number; roi: number }[];
  systems: { id: string; name: string; desc: string; cases: string[] }[];
  cross: { titre: string; texte: string; lanes: string[]; cols: string[]; cells: [number, number, string, string, string][]; cells_avant: [number, number, string, string, string][]; avant: string; apres: string; cas: string[]; mdh: number; cout: number }[];
  waves: { k: string; when: string; what: string; ids: string[]; mdh: number; cout: number }[];
  briques: { name: string; desc: string; ids: string[]; mdh: number; cout: number }[];
  roles: { metier: string; etp: number; mdh: number; ids: string[] }[];
  ramp: Record<"2027" | "2028" | "2029", { eco: number; cout: number; net: number; cumul: number }>;
  abs: { postes_admin: number; departs_admin_an: number; postes_admin_ouvertures: number; postes_admin_ouvertures_lits: number; soignants_ouvertures: number; annees_departs: number; capacite_3ans: number };
  sens: Record<string, number>;
  risks: { risque: string; impact: string; parade: string }[];
  sources: { donnee: string; source: string; ref: string }[];
  levels: string[][];
  measure: string[][];
  gouv: { id: string; name: string; cadence: string; role: string }[];
  warroom: { name: string; desc: string }[];
  externes: { id: string; name: string; desc: string }[];
  confiance: { name: string; desc: string }[];
};

export const META = DATA.meta;
export const CASES = DATA.cases;
export const CASE: Record<string, UseCase> = Object.fromEntries(CASES.map((c) => [c.id, c]));
export const FAM: Record<string, Family> = Object.fromEntries(DATA.fams.map((f) => [f.code, f]));
/** Market references from the v1.3 dossier. `measured` = an achieved, measured result (only those are showcased). */
export const BENCH = bench as unknown as Benchmark[];
export const BENCH_BY_ID: Record<string, Benchmark> = Object.fromEntries(BENCH.map((b) => [b.id, b]));
/** Measured results attached to a use case (v1.3 id). */
export function benchFor(caseId: string, measuredOnly = true): Benchmark[] {
  return BENCH.filter((b) => (b.v13.includes(caseId) || b.app.includes(caseId)) && (!measuredOnly || b.measured));
}
/** Families whose value is counted in the 302 MDH, and families outside the payroll (v1.3). */
export const IN302_FAMS = ["A", "S", "P", "H"];
export const OUT_FAMS = ["X", "C", "R", "I"];
export const ETAB = META.etab; // 45 establishments (H1 2026 communiqué) — "typical hospital" = group ÷ 45

// ---------------------------------------------------------------- timeline
export const YEARS = [2026, 2027, 2028, 2029] as const;
export type Year = (typeof YEARS)[number];
export const YEAR_LABEL: Record<Year, string> = { 2026: "Aujourd'hui", 2027: "2027", 2028: "2028", 2029: "2029 · plein régime" };
/** Share of the full-regime saving (eco) and of the agent budget (cost) reached each year (strategy §11 ramp). */
export function share(y: Year) {
  if (y === 2026) return { eco: 0, cost: 0 };
  const r = DATA.ramp[String(y) as "2027"];
  return { eco: r.eco / META.eco, cost: r.cout / META.budget };
}
export function yearTotals(y: Year) {
  if (y === 2026) return { eco: 0, cout: 0, net: 0, cumul: 0 };
  return DATA.ramp[String(y) as "2027"];
}

// ---------------------------------------------------------------- formatting (French)
const NB = " ";
export function fr(x: number | null | undefined, d = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "—";
  const s = Math.abs(x).toFixed(d).split(".");
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  return (x < 0 ? "−" : "") + s.join(",");
}
export const pct = (x: number, d = 0) => fr(x * 100, d) + " %";
/** MDH → readable MAD amount (for per-establishment figures under 1 MDH). */
export function mad(mdh: number): string {
  if (Math.abs(mdh) >= 1) return fr(mdh, 1) + " MDH";
  return fr(mdh * 1000, 0) + " kMAD";
}

// ---------------------------------------------------------------- aggregates
export type Agg = { ids: string[]; mdh: number; etp: number; cout: number; net: number; roi: number };
export function agg(ids: string[], y: Year = 2029, perSite = false): Agg {
  const s = share(y);
  const k = perSite ? 1 / ETAB : 1;
  let mdh = 0, etp = 0, cout = 0;
  for (const id of ids) {
    const c = CASE[id];
    if (!c) continue;
    const site = perSite && c.id[0] !== "S" && c.id[0] !== "T" ? k : perSite ? 0 : 1; // siège cases are not per-site
    mdh += c.mdh * s.eco * site; etp += c.etp * s.eco * site; cout += c.cout * s.cost * site;
  }
  return { ids, mdh, etp, cout, net: mdh - cout, roi: cout ? mdh / cout : 0 };
}

/** Share of a family's paid workforce taken over by one use case, on a "10 people" scale. */
export function peopleOutOf10(c: UseCase): number {
  const f = FAM[c.id[0]];
  if (!f || !f.etp) return 0;
  return (c.etp / f.etp) * 10;
}

export const MODE_LABEL: Record<string, string> = {
  A1: "Assister — l'humain fait, l'agent prépare",
  A2: "Automatiser — l'agent fait, l'humain valide",
  A3: "Absorber — l'agent remplace l'outil intermédiaire",
};

/** One-line verdict for a use case (no calculation shown, only the conclusion). */
export function verdict(c: UseCase): string {
  if (!c.mdh && c.fam === "T") return "Levier sans gain propre : il transforme le temps libéré en économie réelle (décisions de poste, mobilités, mesure).";
  if (!c.mdh) return `Valeur hors masse salariale, non additive aux 302 MDH${c.value_out ? ` : ${c.value_out}` : ""}.${c.proof?.resultat ? ` Déjà mesuré ailleurs : ${c.proof.resultat}` : ""}`;
  const perSite = c.id[0] === "S" ? "" : ` — ${fr(c.etp / ETAB, 1)} par établissement`;
  return `Rentable au plein régime : ${fr(c.roi, 2)} dirhams économisés pour 1 dirham d'agents. ${fr(c.etp, 0)} équivalents temps plein libérés dans le groupe${perSite}.`;
}
