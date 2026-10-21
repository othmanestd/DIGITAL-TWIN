// Finance view · data layer. Every figure comes from lib/model.ts: FIN (workbook 04 v2.3, Central scenario) and CASE[id].v23.
// Nothing is estimated here: the helpers only select, sum or discount source values with the workbook's own method,
// and every derived figure is labelled as such on screen.
import { FIN, FINROW, CASES, fr, type Series, type FinBlock, type V23Case } from "@/lib/model";
import { FAM_COLOR, BRIQUE_COLOR } from "@/lib/ui/fmt";

export const Y5 = ["2027", "2028", "2029", "2030", "2031"] as const;
export type Yr = (typeof Y5)[number];
export const LAST: Yr = "2031";

/* ---------------------------------------------------------------- hypotheses (04 · Hypothèses) */
export function hyp(prefix: string): number | null {
  const h = FIN.hypotheses.find((x) => x.label.startsWith(prefix));
  return typeof h?.value === "number" ? h.value : null;
}
/** Discount rate of the Synthèse VAN (Hypothèses : « Taux d'actualisation (VAN) »). */
export const RATE = hyp("Taux d'actualisation") ?? 0.1;
export const MARGE_R = hyp("Marge sur CA récupéré");
export const MARGE_N = hyp("Marge contributive");
export const CONTINGENCE = hyp("Contingence");

/* ---------------------------------------------------------------- series maths (same method as the Synthèse) */
/** NPV at the Synthèse rate, 2027 discounted one year (Excel NPV): reproduces every « VAN à 10 % » of the workbook. */
export const npv = (s: Series) => Y5.reduce((a, y, i) => a + (s[y] ?? 0) / Math.pow(1 + RATE, i + 1), 0);
export const total = (s: Series) => Y5.reduce((a, y) => a + (s[y] ?? 0), 0);
export const cumSeries = (s: Series): Series => { let c = 0; return Object.fromEntries(Y5.map((y) => [y, (c += s[y] ?? 0)])); };
export const addS = (...ss: Series[]): Series => Object.fromEntries(Y5.map((y) => [y, ss.reduce((a, s) => a + (s[y] ?? 0), 0)]));
export const negS = (s: Series): Series => Object.fromEntries(Y5.map((y) => [y, -(s[y] ?? 0)]));
/** First year in which a cumulated series is strictly positive. */
export const firstPositive = (cum: Series): Yr | null => Y5.find((y) => (cum[y] ?? 0) > 0) ?? null;
export const vals = (s: Series) => Y5.map((y) => s[y] ?? 0);

/* ---------------------------------------------------------------- formatting (client precision) */
const ZERO = 0.005;
/** MDH: 1 decimal as in the client documents; 2 decimals under 0,1 (as PDF 05 writes 0,03 and 0,05). */
export function mdh(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  if (Math.abs(x) < ZERO) return fr(0, 1);
  return Math.abs(x) < 0.095 ? fr(x, 2) : fr(x, 1);
}
/** A deducted amount (cost) shown as negative, as in the tableau de passage. */
export const minus = (x: number | null | undefined) => (x === null || x === undefined ? "—" : mdh(-x));
export const etp = (x: number | null | undefined, d = 0) => (x === null || x === undefined ? "—" : fr(x, d));
export const ratio = (x: number | null | undefined) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : fr(x, 2));
/** An input value at its own precision (no rounding): 0,0009 → "0,0009", 100000 → "100 000". */
export function exact(x: number, max = 4): string {
  for (let d = 0; d <= max; d++) if (Math.abs(Number(x.toFixed(d)) - x) < 1e-9) return fr(x, d);
  return fr(x, max);
}
export const pctExact = (x: number) => exact(x * 100, 3) + " %";
/** Derived share (e.g. % of group revenue): always 2 decimals. */
export const pct2 = (x: number) => fr(x * 100, 2) + " %";
export const signed = (x: number, f: (v: number) => string = mdh) => (x > 0 ? "+" : "") + f(x);

/* ---------------------------------------------------------------- colours (validated: dark surface, adjacent CVD ≥ 6 with labels) */
export const COL = {
  ms: "#3F7BE0",       // économie de masse salariale
  hms: "#C064A8",      // économies hors masse salariale
  marge: "#1E9E70",    // marge sur CA additionnel
  cout: "#C98500",     // coût (agents et plateformes des cas)
  coutT: "#8E6200",    // coûts transverses (darker step of the same hue)
  coutC: "#E2B65A",    // contingence / quote-part plateforme (lighter step)
  net: "#E8ECF6",      // valeur nette (neutral total)
  cumul: "#9FB3FF",    // valeur nette cumulée
  grid: "rgba(255,255,255,.07)",
  axis: "rgba(255,255,255,.2)",
  mut: "#8D97B0",
} as const;

/* ---------------------------------------------------------------- the tableau de passage (04 · Synthèse) */
export type LineKind = "eco" | "sub" | "memo" | "memoSub" | "memoMinus" | "marge" | "gains" | "cost" | "costSub" | "net" | "cumul" | "ratio" | "info";
export type Line = { key: string; kind: LineKind; label: string; deduct: boolean };
function clean(key: string, label: string): string {
  if (key === "ca_recup" && MARGE_R !== null) return label.replace(/\s*·\s*marge Hypothèses!C\d+\)/, `) · marge ${pctExact(MARGE_R)}`);
  if (key === "ca_new" && MARGE_N !== null) return label.replace(/\(marge contributive Hypothèses!C\d+\)/, `· marge contributive ${pctExact(MARGE_N)}`);
  if (key === "contingence" && CONTINGENCE !== null) return `${label} (${pctExact(CONTINGENCE)} des coûts)`;
  if (key === "cout") return label.replace(/\s*\(à déduire\)/, "");
  return label;
}
const L = (key: string, kind: LineKind, deduct = false): Line => ({ key, kind, deduct, label: clean(key, FINROW[key]?.label ?? key) });
/** PDF 05 reading order (p. 2): ① → CA pour mémoire → ② → gains bruts → ③ → valeur nette, cumul, ratio; ETP for information. */
export const LINES: Line[] = [
  L("eco", "eco"), L("ms", "sub"), L("hms", "sub"),
  L("ca", "memo"), L("ca_recup", "memoSub"), L("ca_new", "memoSub"), L("ca_costs", "memoMinus", true),
  L("marge", "marge"), L("gains", "gains"),
  L("cout", "cost", true), L("cout_cases", "costSub", true), L("cout_transverse", "costSub", true), L("contingence", "costSub", true),
  L("net", "net"), L("net_cumul", "cumul"), L("ratio", "ratio"), L("etp", "info"),
].filter((l) => FINROW[l.key]);
export const v = (key: string, y: Yr = LAST) => FINROW[key]?.values[y] ?? 0;

/* ---------------------------------------------------------------- group trajectory (04 · Hypothèses, « sans le programme ») */
const traj = (prefix: string) => Object.entries(FIN.trajectory).find(([k]) => k.startsWith(prefix)) as [string, { values: Series; note: string | null }] | undefined;
export const CA_GROUPE = traj("CA du groupe");
export const MS_GROUPE = traj("Masse salariale");

/* ---------------------------------------------------------------- bricks and families (04 · Synthèse, par brique / par famille) */
const isTotal = (b: FinBlock) => b.name.startsWith("Total");
export const TOTAL_CASES = FIN.by_brique.find(isTotal)!;
export const TOTAL_FAMS = FIN.by_famille.find(isTotal)!;
/** Short name of a brick: "Rafiq", "Keeps", "Agents administratifs Mibtech"… */
export const briqueShort = (name: string) => name.split(" · ")[0].split(" (")[0];

export type CaseRow = {
  id: string; titre: string; fam: string; famLabel: string; famColor: string;
  brique: string | null; briqueShort: string; briqueColor: string; vague: string;
  merged: string | null; lever: boolean; rec: V23Case | null; proj: V23Case["projections"];
  ms: number | null; hms: number | null; eco: number | null; ca: number | null; marge: number | null; gains: number | null;
  cout: number | null; net: number | null; cumul: number | null; van: number | null; ratio: number | null; ratioP: number | null; etp: number | null;
};
export const FAM_LABEL: Record<string, string> = Object.fromEntries(FIN.by_famille.filter((b) => !isTotal(b)).map((b) => { const [c, ...rest] = b.name.split(" · "); return [c, rest.join(" · ")]; }));

export const ROWS: CaseRow[] = CASES.map((c) => {
  const rec = c.v23 ?? null;
  const p = rec?.projections ?? null;
  const fam = c.id[0];
  const brique = rec?.merged_into ? null : rec?.v23.brique ?? null;
  const at = (s?: Series) => (p && s ? s[LAST] ?? 0 : null);
  const gP = p ? total(p.brut) : 0, cP = p ? total(p.cout) : 0;
  return {
    id: c.id, titre: String(rec?.catalogue?.["Titre"] ?? c.titre), fam, famLabel: FAM_LABEL[fam] ?? c.famille, famColor: FAM_COLOR[fam] ?? "#8D97B0",
    brique, briqueShort: brique ? briqueShort(brique) : "—", briqueColor: (brique && BRIQUE_COLOR[brique]) || "#8D97B0",
    vague: String(rec?.assumptions?.["Vague"] ?? c.vague ?? "—"), merged: rec?.merged_into ?? null, lever: fam === "T", rec, proj: p,
    ms: at(p?.ms), hms: at(p?.hms), eco: p ? p.ms[LAST] + p.hms[LAST] : null, ca: at(p?.ca), marge: at(p?.marge), gains: at(p?.brut),
    cout: at(p?.cout), net: at(p?.net), cumul: p ? p.cumul_net : null, van: p ? p.van_net : null,
    ratio: p && p.cout[LAST] ? p.brut[LAST] / p.cout[LAST] : null, ratioP: p && cP ? gP / cP : null, etp: at(p?.etp),
  };
});
export const ROW: Record<string, CaseRow> = Object.fromEntries(ROWS.map((r) => [r.id, r]));
export const COSTED = ROWS.filter((r) => r.proj);

export type Sums = { n: number; ms: number; hms: number; eco: number; ca: number; marge: number; gains: number; cout: number; net: number; cumul: number; van: number };
export function sumRows(rows: CaseRow[]): Sums {
  const s: Sums = { n: 0, ms: 0, hms: 0, eco: 0, ca: 0, marge: 0, gains: 0, cout: 0, net: 0, cumul: 0, van: 0 };
  for (const r of rows) {
    if (!r.proj) continue;
    s.n++; s.ms += r.ms ?? 0; s.hms += r.hms ?? 0; s.eco += r.eco ?? 0; s.ca += r.ca ?? 0; s.marge += r.marge ?? 0; s.gains += r.gains ?? 0;
    s.cout += r.cout ?? 0; s.net += r.net ?? 0; s.cumul += r.cumul ?? 0; s.van += r.van ?? 0;
  }
  return s;
}
/** Per-year sum of one projection flow over a set of cases (costs specific to the cases only). */
export function sumFlow(rows: CaseRow[], k: keyof NonNullable<V23Case["projections"]>): Series {
  const out: Series = Object.fromEntries(Y5.map((y) => [y, 0]));
  for (const r of rows) { const s = r.proj?.[k]; if (s && typeof s === "object") for (const y of Y5) out[y] += (s as Series)[y] ?? 0; }
  return out;
}

export type Block = { key: string; name: string; short: string; color: string; block: FinBlock; rows: CaseRow[]; ms: number; hms: number; netYears: Series; netYearsSource: "workbook" | "cases" };
export const BRIQUES: Block[] = FIN.by_brique.filter((b) => !isTotal(b)).map((b) => {
  const rows = COSTED.filter((r) => r.brique === b.name);
  const s = sumRows(rows);
  const wb = FIN.net_by_brique_year.find((x) => x.name === b.name);
  return { key: b.name, name: b.name, short: briqueShort(b.name), color: BRIQUE_COLOR[b.name] ?? "#8D97B0", block: b, rows, ms: s.ms, hms: s.hms,
    netYears: wb?.values ?? sumFlow(rows, "net"), netYearsSource: wb ? "workbook" : "cases" };
});
export const FAMILLES: Block[] = FIN.by_famille.filter((b) => !isTotal(b)).map((b) => {
  const code = b.name.split(" · ")[0];
  const rows = COSTED.filter((r) => r.fam === code);
  const s = sumRows(rows);
  return { key: code, name: b.name.split(" · ").slice(1).join(" · "), short: code, color: FAM_COLOR[code] ?? "#8D97B0", block: b, rows, ms: s.ms, hms: s.hms,
    netYears: sumFlow(rows, "net"), netYearsSource: "cases" };
});

/** Waves: no table in workbook 04 — every figure is the sum of the wave's cases (onglet Projections). */
const WAVE_COLOR: Record<string, string> = { V1: "#7C93D6", V2: "#6E8BE8", V3: "#5FB3A8", V4: "#4CC79A" };
export const VAGUES: Block[] = [...new Set(COSTED.map((r) => r.vague))].sort().map((w) => {
  const rows = COSTED.filter((r) => r.vague === w);
  const s = sumRows(rows);
  const block: FinBlock = { name: w, n: s.n, eco: s.eco, marge: s.marge, ca: s.ca, gains: s.gains, cout: s.cout, net: s.net, cumul: s.cumul, van: s.van };
  return { key: w, name: `Vague ${w.slice(1)}`, short: w, color: WAVE_COLOR[w] ?? "#8D97B0", block, rows, ms: s.ms, hms: s.hms, netYears: sumFlow(rows, "net"), netYearsSource: "cases" };
});

/* ---------------------------------------------------------------- programme-level derived figures */
export const NET_CUMUL = FINROW.net_cumul?.values ?? cumSeries(FINROW.net.values);
export const BREAKEVEN = firstPositive(NET_CUMUL);
/** Cross-cutting costs + contingency (not attached to any case), per year, cumul and VAN — as PDF 05 p. 6 shows them. */
export const OVERHEAD = {
  values: addS(FINROW.cout_transverse.values, FINROW.contingence.values),
  cumul: (FINROW.cout_transverse.cumul ?? 0) + (FINROW.contingence.cumul ?? 0),
  van: (FINROW.cout_transverse.van ?? 0) + (FINROW.contingence.van ?? 0),
};
/** CA additionnel 2031 by type: CA, coûts directs (CA − marge), marge (CA × taux de marge des Hypothèses). */
export function caSplit(y: Yr = LAST) {
  const rec = v("ca_recup", y), nw = v("ca_new", y);
  const mR = MARGE_R !== null ? rec * MARGE_R : null, mN = MARGE_N !== null ? nw * MARGE_N : null;
  return {
    rows: [
      { k: "R", label: "CA récupéré", sub: "soins déjà réalisés mais non facturés, rejetés ou mal codés", ca: rec, marge: mR, couts: mR !== null ? rec - mR : null, taux: MARGE_R },
      { k: "N", label: "CA de nouvelle activité", sub: "patients en plus : rappels, standard, devis, capacité libérée, réputation, adressage, ouvertures", ca: nw, marge: mN, couts: mN !== null ? nw - mN : null, taux: MARGE_N },
    ],
    total: { ca: v("ca", y), couts: v("ca_costs", y), marge: v("marge", y), taux: v("ca", y) ? v("marge", y) / v("ca", y) : null },
  };
}

/* ---------------------------------------------------------------- per-case flows (04 · Projections) */
export type FlowKey = "adoption" | "etp" | "ms" | "hms" | "ca" | "marge" | "brut" | "cout_propre" | "plateforme" | "cout" | "net" | "marginal";
export const FLOWS: { k: FlowKey; label: string; unit: "%" | "ETP" | "MDH"; kind: "info" | "plus" | "memo" | "total" | "minus" | "net" | "marginal" }[] = [
  { k: "adoption", label: "Adoption de la vague", unit: "%", kind: "info" },
  { k: "etp", label: "ETP-équivalents libérés", unit: "ETP", kind: "info" },
  { k: "ms", label: "Économie de masse salariale", unit: "MDH", kind: "plus" },
  { k: "hms", label: "Économies hors masse salariale", unit: "MDH", kind: "plus" },
  { k: "ca", label: "CA additionnel (pour mémoire)", unit: "MDH", kind: "memo" },
  { k: "marge", label: "Marge sur CA additionnel", unit: "MDH", kind: "plus" },
  { k: "brut", label: "Valeur brute (gains bruts)", unit: "MDH", kind: "total" },
  { k: "cout_propre", label: "Coût propre du cas", unit: "MDH", kind: "minus" },
  { k: "plateforme", label: "Quote-part des plateformes", unit: "MDH", kind: "minus" },
  { k: "cout", label: "Coût des agents (③)", unit: "MDH", kind: "minus" },
  { k: "net", label: "Valeur nette", unit: "MDH", kind: "net" },
  { k: "marginal", label: "Valeur marginale", unit: "MDH", kind: "marginal" },
];

/** Assumption keys of 04 · Cas, grouped, with their unit and how to print them. */
export type AKind = "pct" | "num" | "mdh" | "kmad" | "mad" | "year" | "text" | "metier" | "assiette" | "typeCA" | "level" | "brique";
export const ASSUMPTIONS: { title: string; items: { k: string; label: string; unit?: string; kind: AKind; help?: string }[] }[] = [
  { title: "Masse salariale", items: [
    { k: "Métier (clé)", label: "Métier concerné", kind: "metier" },
    { k: "ETP du métier", label: "Effectif du métier", unit: "ETP 2026", kind: "num" },
    { k: "Coût chargé (kMAD)", label: "Coût chargé d'un ETP", unit: "kMAD par an", kind: "kmad" },
    { k: "Part du temps du métier", label: "Part du temps du métier sur la tâche", kind: "pct" },
    { k: "Réduction de ce temps", label: "Réduction de ce temps (benchmark)", kind: "pct" },
    { k: "Taux de conversion", label: "Taux de conversion des heures en économie", kind: "pct", help: "Part des heures libérées qui devient un poste non remplacé ou un recrutement évité." },
  ] },
  { title: "Hors masse salariale et CA", items: [
    { k: "Assiette hors MS", label: "Assiette hors masse salariale", kind: "assiette" },
    { k: "Taux hors MS", label: "Effet sur cette assiette", kind: "pct" },
    { k: "Type de CA", label: "Type de CA additionnel", kind: "typeCA" },
    { k: "Assiette CA", label: "Assiette de CA", kind: "assiette" },
    { k: "Taux CA", label: "Effet sur cette assiette de CA", kind: "pct" },
    { k: "Marge sur CA", label: "Marge retenue sur ce CA", kind: "pct" },
  ] },
  { title: "Coût des agents", items: [
    { k: "Volume annuel 2026", label: "Volume annuel traité", unit: "unités en 2026", kind: "num" },
    { k: "Coût unitaire (MAD)", label: "Coût de calcul unitaire", unit: "MAD (dirhams) par unité", kind: "mad" },
    { k: "Licence ou paramétrage (kMAD/site/an)", label: "Licence ou paramétrage", unit: "kMAD par établissement et par an", kind: "kmad" },
    { k: "Licence fixe (MDH/an)", label: "Licence fixe", unit: "MDH par an", kind: "mdh" },
    { k: "Construction (MDH)", label: "Construction", unit: "MDH, 60 % l'année de début, 40 % la suivante", kind: "mdh" },
    { k: "Année de construction", label: "Année de construction", kind: "year" },
  ] },
  { title: "Déploiement et preuve", items: [
    { k: "Brique", label: "Brique de solution", kind: "brique" },
    { k: "Vague", label: "Vague de déploiement", kind: "text" },
    { k: "Niveau de preuve", label: "Niveau de preuve du benchmark", kind: "level" },
  ] },
];
export const FULL_REGIME: { k: string; label: string; kind: "etp" | "mdh" }[] = [
  { k: "ETP libérés · plein régime 2026", label: "ETP-équivalents libérés", kind: "etp" },
  { k: "Économie MS · plein régime 2026", label: "Économie de masse salariale", kind: "mdh" },
  { k: "Hors MS · plein régime 2026", label: "Économies hors masse salariale", kind: "mdh" },
  { k: "CA · plein régime 2026", label: "CA additionnel (pour mémoire)", kind: "mdh" },
  { k: "Coût propre de run · plein régime 2026", label: "Coût propre de fonctionnement", kind: "mdh" },
];
/** Brick code of 04 · Cas → brick name, read from the cases themselves. */
export const BRIQUE_CODE: Record<string, string> = Object.fromEntries(
  COSTED.filter((r) => r.proj?.brique_code && r.brique).map((r) => [r.proj!.brique_code, r.brique!]),
);
export const METIER: Record<string, (typeof FIN.metiers)[number]> = Object.fromEntries(FIN.metiers.map((m) => [m.key, m]));
export const ASSIETTE: Record<string, (typeof FIN.assiettes)[number]> = Object.fromEntries(FIN.assiettes.map((a) => [a.key, a]));
export const LEVEL: Record<string, string> = { A: "A · publication scientifique", B: "B · publié par l'hôpital", C: "C · publié par l'éditeur", R: "R · référence sectorielle (point de départ, pas un effet)", N: "N · aucune preuve mesurée" };

/** Lever groups of 04 · Arbitrage that contain a case. */
export const leversOf = (id: string) => FIN.levers.filter((l) => l.levers.split("+").map((x) => x.trim()).includes(id));
/** Sum of the cumulated net value of a set of rows, plus the matching 2031 figures — used in reconciliation. */
export const RECON = (() => {
  const s = sumRows(COSTED);
  return {
    net: { cases: s.net, total: TOTAL_CASES.net ?? 0 },
    cumul: { cases: s.cumul, total: TOTAL_CASES.cumul ?? 0 },
    van: { cases: s.van, total: TOTAL_CASES.van ?? 0 },
    gains: { cases: s.gains, synth: v("gains") },
    cout: { cases: s.cout, synth: v("cout_cases") },
  };
})();
