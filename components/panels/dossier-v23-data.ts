// v2.3 business case, per case: sizing assumptions (04 · Cas), the catalogue row (03 · Cas d'usage) and the five-year flows.
// Everything comes from lib/data/v23/*.json through lib/model.ts; nothing is computed beyond sums and ratios of those figures.
import { FIN, fr, type UseCase } from "@/lib/model";
import { famName, LEVEL_LABEL } from "@/lib/ui/fmt";

export const hypOf = (re: RegExp) => FIN.hypotheses.find((h) => re.test(h.label));
/** NPV discount rate (hypothesis "Taux d'actualisation (VAN)"). */
export const DISCOUNT = Number(hypOf(/^Taux d.actualisation/)?.value ?? 0.1);

/** A number with as few decimals as it needs (up to `max`). */
export function numT(x: number, max = 2): string {
  const r = Math.round(x * 10 ** max) / 10 ** max; // 95.0000002 -> 95
  for (let d = 0; d <= max; d++) if (Math.abs(r * 10 ** d - Math.round(r * 10 ** d)) < 1e-9) return fr(r, d);
  return fr(r, max);
}
export const pcT = (x: number) => `${numT(x * 100, 2)} %`;

const ASS_GROUPS: [string, string[]][] = [
  ["Métier et temps repris", ["Métier (clé)", "ETP du métier", "Coût chargé (kMAD)", "Part du temps du métier", "Réduction de ce temps", "Taux de conversion"]],
  ["Économies hors masse salariale", ["Assiette hors MS", "Taux hors MS"]],
  ["Chiffre d'affaires additionnel", ["Type de CA", "Assiette CA", "Taux CA", "Marge sur CA"]],
  ["Volumes et coûts des agents", ["Volume annuel 2026", "Coût unitaire (MAD)", "Licence ou paramétrage (kMAD/site/an)", "Licence fixe (MDH/an)", "Construction (MDH)", "Année de construction"]],
  ["Plein régime, périmètre 2026", ["ETP libérés · plein régime 2026", "Économie MS · plein régime 2026", "Hors MS · plein régime 2026", "CA · plein régime 2026", "Coût propre de run · plein régime 2026"]],
  ["Preuve et arbitrage", ["Justification (benchmark v1.3)", "Niveau de preuve", "Arbitrage v2.1", "Raison et correction v2.1"]],
  ["Repères", ["ID", "Titre", "Famille", "Brique", "Vague"]],
];
const labelOf = (k: string) => k.replace(/\s*\((?:kMAD|MAD|MDH)[^)]*\)\s*$/, "").replace(/ · plein régime 2026$/, "");

export type AssRow = { key: string; label: string; text: string; note?: string };
function fmtAss(key: string, v: string | number, a: Record<string, string | number | null>, c: UseCase): { text: string; note?: string } {
  const n = typeof v === "number" ? v : Number(v);
  switch (key) {
    case "Métier (clé)": { const m = FIN.metiers.find((x) => x.key === v); return { text: m ? m.label : String(v), note: m ? `clé ${v}` : undefined }; }
    case "ETP du métier": return { text: `${numT(n, 0)} ETP` };
    case "Coût chargé (kMAD)": return { text: `${numT(n)} kMAD` };
    case "Part du temps du métier": case "Réduction de ce temps": case "Taux hors MS": case "Taux CA": case "Marge sur CA": return { text: pcT(n) };
    case "Taux de conversion": { const cv = FIN.conversion.find((x) => x.fam === a["Famille"]); return { text: pcT(n), note: cv?.note ?? undefined }; }
    case "Assiette hors MS": case "Assiette CA": {
      const x = FIN.assiettes.find((y) => y.key === v);
      if (!x) return { text: String(v) };
      return { text: x.label, note: `clé ${v}${x.part != null ? (x.type === "CA" ? ` · ${pcT(x.part)} du CA` : x.type === "MS" ? ` · ${pcT(x.part)} de la MS` : "") : ""}` };
    }
    case "Type de CA": return { text: v === "R" ? "R · CA récupéré (soins déjà faits, non facturés ou rejetés)" : v === "N" ? "N · CA de nouvelle activité" : String(v) };
    case "Volume annuel 2026": return { text: numT(n, 0) };
    case "Coût unitaire (MAD)": return { text: `${numT(n, 3)} MAD` };
    case "Licence ou paramétrage (kMAD/site/an)": return { text: `${numT(n)} kMAD par site et par an` };
    case "Licence fixe (MDH/an)": return { text: `${numT(n)} MDH par an` };
    case "Construction (MDH)": return { text: `${numT(n)} MDH` };
    case "Année de construction": return { text: String(v) };
    case "ETP libérés · plein régime 2026": return { text: `${numT(n)} ETP-éq.` };
    case "Économie MS · plein régime 2026": case "Hors MS · plein régime 2026": case "CA · plein régime 2026": case "Coût propre de run · plein régime 2026": return { text: `${numT(n, 3)} MDH` };
    case "Niveau de preuve": return { text: `${v}${LEVEL_LABEL[String(v)] ? ` · ${LEVEL_LABEL[String(v)]}` : ""}` };
    case "Famille": return { text: `${v} · ${famName(String(v))}` };
    case "Brique": return { text: c.v23?.v23.brique ? `${v} · ${c.v23.v23.brique}` : String(v) };
    default: return { text: typeof v === "number" ? numT(n, 3) : String(v) };
  }
}

/** Every field of the sizing sheet, grouped, with readable labels and units; `empty` lists the fields this case leaves blank. */
export function assumptionRows(c: UseCase): { groups: { name: string; rows: AssRow[] }[]; empty: string[] } {
  const a = c.v23?.assumptions;
  if (!a) return { groups: [], empty: [] };
  const known = new Set(ASS_GROUPS.flatMap(([, ks]) => ks));
  const groups: [string, string[]][] = [...ASS_GROUPS, ["Autres champs", Object.keys(a).filter((k) => !known.has(k))]];
  const empty: string[] = [];
  const out = groups.map(([name, keys]) => ({
    name,
    rows: keys.filter((k) => k in a).flatMap((k): AssRow[] => {
      const v = a[k];
      if (v === null || v === undefined || v === "") { empty.push(labelOf(k)); return []; }
      return [{ key: k, label: labelOf(k), ...fmtAss(k, v, a, c) }];
    }),
  })).filter((g) => g.rows.length);
  return { groups: out, empty };
}

/** Catalogue columns the dossier already shows elsewhere, so that the full sheet lists only the rest. */
const SHOWN = new Set(["ID", "Famille", "Domaine", "Titre", "Aujourd'hui", "Avec les agents", "Résultat mesuré ailleurs (avant → après)", "Où et comment (organisation, étude)", "Niveau de preuve",
  "Lecture pour Akdital", "Source", "Étapes avant", "Étapes après", "Métier / rôle", "Solutions JABB", "Mode", "Chef de file", "Sensibilité", "Validation humaine", "Garde-fous", "KPI",
  "Maturité", "Vague", "Risque principal", "Ça a marché ailleurs (synopsis du dossier)", "Levier hors masse salariale (v0.9, non additif)", "Arbitrage v2.1 (cas à valeur ≤ 0 en v2.0)"]);
export function ficheRows(c: UseCase): { rows: { label: string; text: string }[]; empty: number } {
  const cat = c.v23?.catalogue;
  if (!cat) return { rows: [], empty: 0 };
  const rows: { label: string; text: string }[] = [];
  let empty = 0;
  for (const [k, v] of Object.entries(cat)) {
    if (SHOWN.has(k) || k.startsWith("Chiffres actualisés v2.3")) continue;
    if (v === null || v === undefined || v === "") { empty++; continue; }
    rows.push({ label: k, text: typeof v === "number" ? (/^Part de la famille/.test(k) ? pcT(v) : numT(v, 3)) : String(v) });
  }
  return { rows, empty };
}
