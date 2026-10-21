// The business model behind every figure on screen, for the dataset chosen after sign-in (lib/data/dataset.ts):
//   v13 · données d'origine — 302 MDH of payroll saved, 160 MDH of agent cost, 142 MDH net (lib/data/base.json)
//   v23 · chiffres actualisés — case-by-case business case 2027-2031: ① savings (payroll + other opex) + ② margin on the
//         additional revenue − ③ programme cost = net value (lib/data/v23/*.json, built by _source/v23/build_v23.py)
// Texts (cases, steps, proofs) are the same in both; v23 replaces the figures and adds the finance.
import base from "./data/base.json";
import bench from "./data/benchmarks.json";
import v23cases from "./data/v23/cases.json";
import v23fin from "./data/v23/finance.json";
import { DATASET, V23 } from "./data/dataset";
export { DATASET, V23 };

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
  value_levers?: { type: string; ordre_grandeur?: string; ordre_de_grandeur?: string; origine_v09?: string }[] | null;
  levier_hors_ms?: string | null;
  solutions?: string[];              // solutions named in v1.3 (Agentic Command Center, Three, Keeps, Rafiq, JABB Twin, Expériences IA, agents)
  proof?: { resultat: string; ou: string; niveau: string; niveau_code: string; lecture_akdital?: string; source?: string; source_url?: string } | null;
  elsewhere?: string | null;         // "ça a marché ailleurs" — what was achieved elsewhere, in plain words
  bench_ids?: string[];
  status_v13?: "same" | "changed" | "new";
  // v23 only (chiffres actualisés): the full case record and, for the 4 cases merged in v2.1, their host case
  v23?: V23Case;
  merged_into?: string | null;
};
export type Benchmark = {
  id: string; v13: string[]; app: string[]; related: string[]; who: string; country: string; what: string; result: string;
  metric: string; year: number | null; level: string; source: string; url: string | null; reading: string | null; measured: boolean; note?: string | null;
};
export type Family = { code: string; name: string; etp: number; part: number; postes: number; mdh: number; cout_mad: number; cout: number; net: number; roi: number; n: number; in_302?: boolean; note?: string | null };

/** Values per year of the business case, keyed "2027" … "2031" (MDH, ETP or a share). */
export type Series = Record<string, number>;
export type V23Case = {
  id: string;
  /** 2031 figures from the catalogue (03, columns AR–BD) */
  v23: { etp: number | null; ms: number | null; hms: number | null; eco: number | null; ca: number | null; marge: number | null; gains: number | null;
    cout: number | null; net: number | null; cumul: number | null; brique: string | null; hypothese: string | null; arbitrage: string | null };
  /** every column of the catalogue row (03 · Cas d'usage), by header */
  catalogue: Record<string, string | number | null>;
  /** sizing assumptions (04 · Cas), by header */
  assumptions: Record<string, string | number | null> | null;
  /** five-year flows (04 · Projections) + NPV at 10 % and cumul computed with the Synthèse method */
  projections: { adoption: Series; etp: Series; ms: Series; hms: Series; ca: Series; marge: Series; brut: Series; cout_propre: Series; plateforme: Series;
    cout: Series; net: Series; marginal: Series; van_net: number; cumul_net: number; brique_code: string } | null;
  merged_into: string | null;
  arbitrage_v21: { id: string; cas: string; v20: number | null; cause: string; correction: string; v21: number | null; marginal: number | null; decision: string | null } | null;
  /** what the v2.3 PDFs (dossier 01, CODIR 02, business case 05) add for this case: merged wording, extra evidence, sources */
  pdf_extra: { page: string; field: string; value: string }[];
  /** merged hosts (X-03, X-06, C-02, R-01) carry their merged title in v2.3 */
  titre_v23: string | null;
  /** wording updated in v2.3 (field, from, to): T-03 no longer quotes the v1.0 budget */
  text_fix: [string, string, string][];
};
/** An item the v2.3 PDFs add to the workbooks (scenarios, roadmap, risks, decisions…), copied verbatim with its page. */
export type PdfExtra = { doc: string; page: string; kind: string; title: string; values: unknown; note?: string | null };
export type FinRow = { key: string; label: string; sub: boolean; values: Series; cumul: number | null; van: number | null };
export type FinBlock = { name: string; n: number | null; eco: number | null; marge: number | null; ca: number | null; gains: number | null; cout: number | null; net: number | null; cumul: number | null; van: number | null };
/** The v2.3 business case (04 · Synthèse, Hypothèses, Assiettes, Métiers, Arbitrage; 03 side tables), copied as is. */
export const FIN = v23fin as unknown as {
  meta: { version: string; scenario: string; years: number[]; unit: string; source: string[]; notes: string[] };
  global: FinRow[];
  bridge_v10: { label: string; v10: number | null; v2: number | null; ecart: number | null }[];
  by_brique: FinBlock[];
  by_famille: FinBlock[];
  net_by_brique_year: { name: string; values: Series }[];
  hypotheses: { label: string; value: string | number | null; note: string | null }[];
  scenarios: Record<string, number>;
  trajectory: { years: number[] } & Record<string, { values: Series; note: string | null }>;
  conversion: { fam: string; rate: number | null; note: string | null }[];
  adoption: { vague: string; debut: number; values: Series; note: string | null }[];
  transverse_costs: { label: string; total: boolean; values: Series }[];
  platforms: { code: string | null; label: string; kmad_site: number | null; total: boolean; values: Series }[];
  platforms_note: string;
  assiettes: { key: string; label: string; part: number | null; type: string; values: Series }[];
  metiers: { key: string; fam: string; label: string; etp: number | null; cout_kmad: number | null; part: number | null; check: string | null }[];
  arbitrage: NonNullable<V23Case["arbitrage_v21"]>[];
  levers: { levers: string; what: string; lost2031: number | null; lostCumul: number | null; cost: number | null; ratio: number | null }[];
  arbitrage_notes: string[];
  readme_04: { k: string | null; v: string }[];
  readme_03: { k: string | null; v: string }[];
  solutions_jabb: Record<string, string | number | null>[];
  sources_akdital: Record<string, string | number | null>[];
  correspondance: Record<string, string | number | null>[];
  /** global items from PDFs 01, 02, 05 not in the workbooks (audit _source/v23/coverage.json) */
  pdf_extra: PdfExtra[];
  pdf_mismatches: { doc: string; page: string; what: string; pdf_value: unknown; workbook_value: unknown; workbook_location: string }[];
  pdf_structure: unknown;
};
/** Global lines of the v2.3 Synthèse by key: etp, eco, ms, hms, ca, ca_recup, ca_new, ca_costs, marge, gains, cout, cout_cases,
 *  cout_transverse, contingence, net, net_cumul, ratio. */
export const FINROW: Record<string, FinRow> = Object.fromEntries(FIN.global.map((r) => [r.key, r]));
export const V23CASE = v23cases as unknown as Record<string, V23Case>;

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
  ramp: Record<string, { eco: number; cout: number; net: number; cumul: number }>;
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

// ---------------------------------------------------------------- v2.3: the revised figures replace v1.3's on the same structure
// A case's `mdh` becomes its gross gains 2031 (① savings + ② margin), `cout` its agent cost (③, platforms included),
// `net` its net value; per-year values come from its projections (agg). Programme totals also carry the cross-cutting
// costs and the contingency, which belong to no case (FINROW.cout_transverse, FINROW.contingence).
const Y5 = ["2027", "2028", "2029", "2030", "2031"] as const;
if (V23) {
  const byId: Record<string, UseCase> = {};
  for (const c of DATA.cases) {
    byId[c.id] = c;
    const v = V23CASE[c.id];
    if (!v) continue;
    c.v23 = v;
    c.merged_into = v.merged_into;
    c.etp = v.v23.etp ?? 0; c.mdh = v.v23.gains ?? 0; c.cout = v.v23.cout ?? 0; c.net = v.v23.net ?? 0;
    c.roi = c.cout ? c.mdh / c.cout : 0;
    c.in302 = !v.merged_into && !!v.projections; // counted in the v2.3 business case
    if (v.v23.brique) c.brique = v.v23.brique;
    if (v.titre_v23) c.titre = v.titre_v23;
    for (const [field, from, to] of v.text_fix ?? []) {
      const r = c as unknown as Record<string, unknown>;
      const cur = r[field];
      if (typeof cur === "string") r[field] = cur.replace(from, to);
      else if (Array.isArray(cur)) r[field] = cur.map((x) => (typeof x === "string" ? x.replace(from, to) : x));
    }
  }
  const sum = (ids: string[], k: "mdh" | "etp" | "cout") => ids.reduce((a, id) => a + (byId[id]?.[k] ?? 0), 0);
  for (const f of DATA.fams) {
    const b = FIN.by_famille.find((x) => x.name.startsWith(f.code + " "));
    if (!b) continue;
    f.mdh = b.gains ?? 0; f.cout = b.cout ?? 0; f.net = b.net ?? 0; f.roi = f.cout ? f.mdh / f.cout : 0; f.n = b.n ?? f.n;
    f.postes = DATA.cases.filter((c) => c.fam === f.code).reduce((a, c) => a + c.etp, 0);
  }
  for (const d of DATA.domains) { d.mdh = sum(d.cases, "mdh"); d.etp = sum(d.cases, "etp"); d.cout = sum(d.cases, "cout"); d.roi = d.cout ? d.mdh / d.cout : 0; }
  for (const w of DATA.waves) { w.mdh = sum(w.ids, "mdh"); w.cout = sum(w.ids, "cout"); }
  DATA.briques = FIN.by_brique.filter((b) => !b.name.startsWith("Total")).map((b) => {
    const ids = DATA.cases.filter((c) => c.v23?.v23.brique === b.name).map((c) => c.id);
    return { name: b.name, desc: "", ids, mdh: b.gains ?? 0, cout: b.cout ?? 0 };
  });
  for (const r of DATA.roles) { r.etp = sum(r.ids, "etp"); r.mdh = sum(r.ids, "mdh"); }
  DATA.ramp = Object.fromEntries(Y5.map((y) => [y, { eco: FINROW.gains.values[y], cout: FINROW.cout.values[y], net: FINROW.net.values[y], cumul: FINROW.net_cumul.values[y] }]));
  Object.assign(DATA.meta, { eco: FINROW.gains.values["2031"], budget: FINROW.cout.values["2031"], net: FINROW.net.values["2031"], roi: FINROW.ratio.values["2031"] });
}

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
export type Year = 2026 | 2027 | 2028 | 2029 | 2030 | 2031;
/** Years on the timeline: today, then the ramp-up (v13: to full regime in 2029; v23: the business case to 2031). */
export const YEARS: readonly Year[] = V23 ? [2026, 2027, 2028, 2029, 2030, 2031] : [2026, 2027, 2028, 2029];
export const FINAL_YEAR: Year = V23 ? 2031 : 2029;
export const YEAR_LABEL: Record<Year, string> = V23
  ? { 2026: "Aujourd'hui", 2027: "2027", 2028: "2028", 2029: "2029", 2030: "2030", 2031: "2031 · horizon" }
  : { 2026: "Aujourd'hui", 2027: "2027", 2028: "2028", 2029: "2029 · plein régime", 2030: "2030", 2031: "2031" };
/** Share of the final-year value (eco) and cost reached in year y (v13: strategy §11 ramp; v23: Synthèse 2027-2031). */
export function share(y: Year) {
  if (y <= 2026) return { eco: 0, cost: 0 };
  const r = DATA.ramp[String(Math.min(y, FINAL_YEAR))], full = DATA.ramp[String(FINAL_YEAR)];
  return { eco: r.eco / full.eco, cost: r.cout / full.cout };
}
/** Programme totals for year y (v23: gains bruts, programme cost incl. cross-cutting costs and contingency, net value, cumul). */
export function yearTotals(y: Year) {
  if (y <= 2026) return { eco: 0, cout: 0, net: 0, cumul: 0 };
  return DATA.ramp[String(Math.min(y, FINAL_YEAR))];
}
/** 0 (today) … 1 (end of the timeline): how far the programme has gone in year y (v23: share of the 2031 FTE freed). */
export function yearProgress(y: number): number {
  if (y <= 2026) return 0;
  if (V23) return Math.min(1, FINROW.etp.values[String(Math.min(y, 2031))] / FINROW.etp.values["2031"]);
  return Math.min(1, share(Math.min(y, 2029) as Year).eco);
}
/** Visual stage for the 3D (staff on site, the top-floor twin room): 0 today, 1 first wave, 2 scaling, 3 full deployment. */
export function visualStage(y: number): 0 | 1 | 2 | 3 {
  const p = yearProgress(y);
  return p < 0.05 ? 0 : p < 0.5 ? 1 : p < 0.9 ? 2 : 3;
}
/** Establishments of the group in year y (v23 trajectory: 45 → 65; v13: 45). */
export function etabIn(y: Year): number {
  if (!V23) return META.etab;
  return FIN.trajectory["Établissements"]?.values[String(Math.min(Math.max(y, 2026), 2031))] ?? META.etab;
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
export function agg(ids: string[], y: Year = FINAL_YEAR, perSite = false): Agg {
  if (V23) {
    let mdh = 0, etp = 0, cout = 0;
    if (y > 2026) {
      const Y = String(Math.min(y, 2031)), k = 1 / etabIn(y);
      for (const id of ids) {
        const p = CASE[id]?.v23?.projections;
        if (!p) continue;
        const site = perSite ? (id[0] !== "S" && id[0] !== "T" ? k : 0) : 1;
        mdh += p.brut[Y] * site; etp += p.etp[Y] * site; cout += p.cout[Y] * site;
      }
    }
    return { ids, mdh, etp, cout, net: mdh - cout, roi: cout ? mdh / cout : 0 };
  }
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

/** Headline of the chosen dataset at the end of its timeline: what the top bar, the panels and the tours quote. */
const f31 = (k: string) => FINROW[k]?.values["2031"] ?? 0;
export const HEAD = V23
  ? { year: 2031 as Year, etp: f31("etp"), eco: f31("eco"), ms: f31("ms"), hms: f31("hms"), ca: f31("ca"), marge: f31("marge"), gains: f31("gains"),
      cout: f31("cout"), net: f31("net"), cumul: FINROW.net.cumul ?? 0, van: FINROW.net.van as number | null, ratio: f31("ratio") }
  : { year: 2029 as Year, etp: CASES.reduce((a, c) => a + c.etp, 0), eco: META.eco, ms: META.eco, hms: 0, ca: 0, marge: 0, gains: META.eco,
      cout: META.budget, net: META.net, cumul: DATA.ramp["2029"].cumul, van: null as number | null, ratio: META.roi };
/** Words for the headline figures (v13 speaks of payroll saved; v23 of gross gains, programme cost and net value). */
export const LBL = V23
  ? { gains: "gains bruts", gainsLong: "gains bruts (économies + marge sur le CA additionnel)", cout: "coût du programme", net: "valeur nette", cumul: "valeur nette cumulée" }
  : { gains: "économie", gainsLong: "masse salariale économisée", cout: "coût des agents", net: "gain net", cumul: "cumul net" };

/** One-line verdict for a use case (no calculation shown, only the conclusion). */
export function verdict(c: UseCase): string {
  if (V23) {
    const v = c.v23;
    if (c.merged_into) return `Fusionné dans ${c.merged_into} (arbitrage v2.1) : sa valeur est comptée dans ce cas.`;
    if (!v?.projections) return "Sans chiffrage propre dans le business case v2.3.";
    if (c.fam === "T") return `Levier de réalisation, sans gain propre : ${v.arbitrage_v21?.correction ?? "il transforme le temps libéré en valeur réelle."}`;
    const m = v.v23.marge ?? 0, e = v.v23.eco ?? 0;
    const how = m > 0 ? `${fr(e, 1)} MDH d'économies + ${fr(m, 1)} MDH de marge sur ${fr(v.v23.ca ?? 0, 1)} MDH de CA additionnel` : `${fr(e, 1)} MDH d'économies`;
    if (c.net <= 0) return `Valeur nette 2031 de ${fr(c.net, 1)} MDH : ${how}, pour ${fr(c.cout, 1)} MDH de coût. ${v.v23.arbitrage ?? ""}`.trim();
    return `Valeur nette ${fr(c.net, 1)} MDH par an en 2031 : ${how}, pour ${fr(c.cout, 1)} MDH de coût, soit ${fr(c.roi, 1)} dirhams de gains pour 1 dirham.${c.etp >= 1 ? ` ${fr(c.etp, 0)} ETP-éq. libérés.` : ""}`;
  }
  if (!c.mdh && c.fam === "T") return "Levier sans gain propre : il transforme le temps libéré en économie réelle (décisions de poste, mobilités, mesure).";
  if (!c.mdh) return `Valeur hors masse salariale, non additive aux 302 MDH${c.value_out ? ` : ${c.value_out}` : ""}.${c.proof?.resultat ? ` Déjà mesuré ailleurs : ${c.proof.resultat}` : ""}`;
  const perSite = c.id[0] === "S" ? "" : ` — ${fr(c.etp / ETAB, 1)} par établissement`;
  return `Rentable au plein régime : ${fr(c.roi, 2)} dirhams économisés pour 1 dirham d'agents. ${fr(c.etp, 0)} équivalents temps plein libérés dans le groupe${perSite}.`;
}
