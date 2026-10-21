// Finance view · what the dossier v2.3 PDFs (01, 02, 05) print and workbook 04 does not: read from FIN.pdf_extra
// (verbatim strings with their page), never retyped. A missing item simply hides its block.
import { FIN, type PdfExtra } from "@/lib/model";

type Dict = Record<string, unknown>;
const find = (doc: string, page: string, kind?: string): PdfExtra | undefined =>
  (FIN.pdf_extra ?? []).find((x) => x.doc === doc && x.page === page && (!kind || x.kind === kind));
const vals = (x?: PdfExtra) => (x?.values ?? {}) as Dict;
const str = (x: unknown) => (typeof x === "string" ? x : "");
/** "dossier v2.3, PDF 05 p. 5" */
export const cite = (x?: PdfExtra) => (x ? `dossier v2.3, PDF ${x.doc} p. ${x.page}` : "dossier v2.3");

/** PDF 05 p. 5: the three scenarios (workbook 04 computes only the Central one). */
const scen = find("05", "5", "scenario");
type ScenRow = { scénario: string; économies: string; marge_ca: string; gains_bruts: string; coût: string; valeur_nette: string; cumul_27_31: string; rentable_en: string };
export const SCENARIOS_PDF = scen ? {
  ref: cite(scen),
  columns: ["Économies", "Marge (CA)", "Gains bruts", "Coût", "Valeur nette", "Cumul 27-31", "Rentable en"],
  rows: ((vals(scen).lignes ?? []) as ScenRow[]).map((r) => {
    const m = r.scénario.match(/^(\S+)\s*\((.*)\)$/);
    return { name: m?.[1] ?? r.scénario, mult: m?.[2] ?? "", values: [r.économies, r.marge_ca, r.gains_bruts, r.coût, r.valeur_nette, r.cumul_27_31, r.rentable_en] };
  }),
  legend: str(vals(scen).unité),
  foot: str(vals(scen).pied_de_page),
} : null;

/** PDF 05 p. 3: where the additional revenue comes from. */
const caX = find("05", "3", "table");
type CaRow = { ligne: string; ca_additionnel: string; coûts_directs: string; marge: string; taux: string; exemples?: string };
export const CA_SPLIT_PDF = caX ? { ref: cite(caX), rows: (vals(caX).lignes ?? []) as CaRow[], comment: str(vals(caX).commentaire) } : null;

/** PDF 05 p. 4: the v1.0 → v2.3 bridge, family by family, at 2026 scope. */
const br = find("05", "4", "table");
type BrRow = { famille: string; etp_v1: string; etp_v2: string; mdh_v1: string; mdh_v2: string; pourquoi: string };
const FAMCODE: Record<string, string> = { "Administratif des sites": "A", "Siège": "S", "Paramédical": "P", "Hébergement": "H" };
export const BRIDGE_FAMILIES_PDF = br ? {
  ref: cite(br),
  intro: str(vals(br).introduction),
  rows: ((vals(br).lignes ?? []) as BrRow[]).map((r) => ({ fam: FAMCODE[r.famille] ?? "", label: r.famille, etpV1: r.etp_v1, etpV2: r.etp_v2, mdhV1: r.mdh_v1, mdhV2: r.mdh_v2, why: r.pourquoi })),
  baisse: str(vals(br).ce_qui_baisse),
  ajoute: str(vals(br).ce_qui_s_ajoute),
  cost: str(vals(br).note_coût),
} : null;

/** PDF 05 p. 7: net value per year per family (strings as printed). */
const famS = find("05", "7", "series");
export const FAMILY_SERIES_PDF = famS ? { ref: cite(famS), series: ((vals(famS).séries ?? {}) as Record<string, string[]>) } : null;

/** PDF 05 p. 5: the method in three blocks and what is not counted. */
const meth = find("05", "5", "narrative");
export const METHOD_PDF = meth ? {
  ref: cite(meth),
  blocks: [
    { title: "Économie de masse salariale", text: str(vals(meth).économie_de_masse_salariale) },
    { title: "Économies hors MS et CA additionnel", text: str(vals(meth).économies_hors_MS_et_CA_additionnel) },
    { title: "Coût des agents", text: str(vals(meth).coût_des_agents) },
  ].filter((b) => b.text),
  notCounted: str(vals(meth).ce_qui_n_est_pas_compté),
} : null;

/** PDF 01 p. 88: what the programme cost covers. */
const cov = find("01", "88", "narrative");
export const COST_COVERS_PDF = cov ? { ref: cite(cov), text: str(vals(cov).texte) } : null;

/** PDF 02 p. 27: dates, scope and 2031 net value of each wave. */
const road = find("02", "27", "table");
type WaveRow = { vague: string; dates: string; cas: string; périmètre: string; valeur_nette_2031: string };
export const WAVES_PDF: Record<string, { dates: string; scope: string; n: string; net: string }> = Object.fromEntries(
  ((vals(road).vagues ?? []) as WaveRow[]).map((w) => [w.vague, { dates: w.dates, scope: w.périmètre, n: w.cas, net: w.valeur_nette_2031 }]),
);
export const WAVES_REF = cite(road);
const MM = FIN.pdf_mismatches ?? [];
const has = (re: RegExp) => MM.some((m) => re.test(m.what));
/** Gaps between the PDFs and the workbook, flagged by the audit (FIN.pdf_mismatches), said in French where they matter. */
export const WAVES_NOTE = has(/wave 3/i) ? "Écart relevé : le dossier place la vague 3 en sept. → déc. 2027 ; le modèle (04 · Hypothèses) la démarre en 2028, avec 0 % d'adoption en 2027." : "";
export const BRIDGE_NOTE = [
  has(/time shares/i) ? "le PDF 05 écrit « 25 à 70 % » de temps outillé par métier ; l'onglet Métiers va de 25 à 80 %" : "",
  has(/loaded costs/i) ? "il écrit « 160 à 320 kMAD » au siège ; l'onglet Métiers va de 120 à 320 kMAD" : "",
].filter(Boolean).join(" ; ");

/** PDF 05 p. 8 (with 02 p. 26): arbitrage v2.1 totals, the three outcomes, the three causes, the levers. */
const arb = find("05", "8", "kpi");
const split = (vals(arb)["répartition_02_p26"] ?? {}) as Record<string, string>;
export const ARBITRAGE_PDF = arb ? {
  ref: cite(arb),
  total: str(vals(arb).total_v2_0),
  split: Object.entries(split).map(([k, v]) => ({ k: k.charAt(0) + k.slice(1).toLowerCase(), v, ref: "dossier v2.3, PDF 02 p. 26" })),
  causes: ((vals(arb).trois_causes_05_p8 ?? []) as string[]).map((c) => {
    const m = c.match(/^\d+\s*·\s*([^:]+?)\s*:\s*([\s\S]*)$/);
    const t = m ? m[1].trim() : c;
    return { t: t.charAt(0) + t.slice(1).toLowerCase(), d: m ? m[2] : "" };
  }),
  levers: str(vals(arb).leviers_texte_05_p9),
} : null;
