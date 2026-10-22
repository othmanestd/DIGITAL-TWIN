// UI helpers: colours, units, trajectories, floor labels. Every figure is computed from lib/model.ts.
import { DATA, FAM, META, YEARS, CASE, share, yearTotals, fr, agg, benchFor, V23, FINROW, FINAL_YEAR, type Year, type UseCase, type Benchmark } from "@/lib/model";
import { ALL_DEPTS, AP_FLOORS, FLOORS, floorKey, type BId, type Dept } from "@/lib/hospital";
import { GLOSSARY } from "@/lib/glossary";

/** Family colours, aligned with the department kinds drawn in 3D (KIND_COLOR). */
export const FAM_COLOR: Record<string, string> = {
  A: "#7C93D6", S: "#A88FD0", P: "#6FB7AE", H: "#D6B47C", T: "#8D97B0",
  // v1.3 families outside the payroll (value of another type, indicative, non-additive)
  X: "#E0918A", C: "#9CC98A", R: "#6FB0E0", I: "#5EC4D1",
};
export const FAM_SHORT: Record<string, string> = { A: "Administratif", S: "Siège", P: "Paramédical", H: "Hébergement", T: "Leviers", X: "Expérience patient", C: "Capital humain", R: "Revenu et achats", I: "Actifs et énergie" };

/** Muted categorical palette for the 7 technology bricks. */
const BRIQUE_PALETTE = ["#6E8BE8", "#5FB3A8", "#D6A86E", "#A88FD0", "#C9827A", "#8FB98A", "#8D97B0", "#6FB0E0", "#E0918A", "#C9B26E", "#9FB3FF"];
export const BRIQUE_COLOR: Record<string, string> = Object.fromEntries(DATA.briques.map((b, i) => [b.name, BRIQUE_PALETTE[i % BRIQUE_PALETTE.length]]));

/** Step colours for before/after chains. */
export const STEP_COLOR = { human: "#E5A57A", agent: "#5B7CFF", validation: "#5FB3A8", tool: "#7D869C", system: "#9AA6C4" };
export const ACTOR_LABEL: Record<string, string> = {
  humain: "Humain", papier: "Papier", telephone: "Téléphone", systeme: "Système", agent: "Agent IA", camera: "Caméra", tableur: "Tableur", mail: "E-mail",
};

/** Glossary short explanation: "millions de dirhams". */
export const unitShort = (k: string) => GLOSSARY[k]?.short ?? "";
export const unitLong = (k: string) => GLOSSARY[k]?.long ?? "";

/** Money in MDH, switched to kMAD under 1 MDH (typical-hospital figures). */
export function money(mdh: number, d = 1): { v: number; d: number; unit: "MDH" | "kMAD" } {
  if (Math.abs(mdh) >= 1 || mdh === 0) return { v: mdh, d, unit: "MDH" };
  return { v: mdh * 1000, d: 0, unit: "kMAD" };
}

/** Value of a metric along the dataset's trajectory, today → final year (group level). */
export function groupSeries(key: "eco" | "cout" | "net" | "cumul" | "roi" | "etp"): number[] {
  return YEARS.map((y) => {
    const t = yearTotals(y);
    if (key === "roi") return t.cout ? t.eco / t.cout : 0;
    if (key === "etp") return V23 ? FINROW.etp.values[String(y)] ?? 0 : META.postes * share(y).eco;
    return t[key];
  });
}

/** Trajectory of an aggregate (department, case…) for one metric. */
export function aggSeries(ids: string[], key: "mdh" | "etp" | "cout" | "net" | "roi", perSite: boolean): number[] {
  return YEARS.map((y) => agg(ids, y, perSite)[key]);
}

export const yearIndex = (y: Year) => YEARS.indexOf(y);

/** Delta chip text vs previous year. */
export function deltaText(series: number[], i: number, d = 1, unit = ""): string | null {
  if (i <= 0) return null;
  const dv = series[i] - series[i - 1];
  if (Math.abs(dv) < 1e-9) return "stable";
  return `${dv > 0 ? "+" : ""}${fr(dv, d)}${unit ? " " + unit : ""} vs ${YEARS[i - 1] === 2026 ? "auj." : YEARS[i - 1]}`;
}

/** Family of a case or department. */
export const famOfCase = (c: UseCase | string) => (typeof c === "string" ? c[0] : c.id[0]);
export function famOfDept(d: Dept): string | null {
  // the payroll family of the department (people pictogram); null when it has no case inside the 302 MDH
  const ids = d.cases.filter((id) => CASE[id]?.in302 && CASE[id]?.mdh > 0);
  if (!ids.length) return null;
  const counts: Record<string, number> = {};
  for (const id of ids) { const f = CASE[id].fam || id[0]; counts[f] = (counts[f] ?? 0) + 1; }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** "Sous-sol", "Rez-de-chaussée", "1er étage", "Siège"; Anfa Prime: "Aile ouest · 1er étage". */
export function floorShort(building: BId, floor: number): string {
  if (building === "annex") return "Siège";
  const lvl = floor === -1 ? "Sous-sol" : floor === 0 ? "Rez-de-chaussée" : floor === 1 ? "1er étage" : `${floor}e étage`;
  if (building === "ap.w") return `Aile ouest · ${lvl}`;
  if (building === "ap.e") return `Aile est · ${lvl}`;
  return lvl;
}
const ANY_FLOORS = [...FLOORS, ...AP_FLOORS];
export function floorName(key: string): string {
  const [b, f] = key.split(":");
  const fl = ANY_FLOORS.find((x) => x.building === b && String(x.floor) === f);
  return fl ? fl.name : key;
}
export function floorTitle(key: string): string {
  const [b, f] = key.split(":");
  const fl = ANY_FLOORS.find((x) => x.building === b && String(x.floor) === f);
  if (!fl) return key;
  return fl.name.split(" · ")[0] === "Siège" ? fl.name : floorShort(fl.building, fl.floor);
}
export const deptsOfFloor = (key: string) => ALL_DEPTS.filter((d) => floorKey(d.building, d.floor) === key);
export const famName = (code: string) => FAM[code]?.name ?? code;

/** Plain verb for the year: "au plein régime" / "en 2028" / "aujourd'hui". */
export const yearPhrase = (y: Year) => (y === FINAL_YEAR ? (V23 ? "en 2031, horizon du business case" : "au plein régime (2029)") : y === 2026 ? "aujourd'hui" : `en ${y}`);

export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** Accent-insensitive lowercase. */
export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------- v1.3: payroll scope and market evidence
/** Is the case's value counted in the headline (v13: the 302 MDH of payroll; v23: the business case, every costed case)? */
export const in302 = (c: UseCase) => c.in302 !== false && (V23 || (c.fam ? ["A", "S", "P", "H"].includes(c.fam) : true));
/** Evidence level code from a label such as "A · Publication scientifique (indirecte)". */
export const levelCode = (level?: string | null) => (level ? level.trim()[0] : "N");
export const LEVEL_LABEL: Record<string, string> = { A: "Publication scientifique", B: "Publié par l'hôpital", C: "Éditeur avec client nommé", R: "Référence sectorielle", N: "Aucune preuve mesurée" };
export const LEVEL_COLOR: Record<string, string> = { A: "#4CC79A", B: "#6FB0E0", C: "#E2B05A", R: "#8D97B0", N: "#8D97B0" };
/** The most quotable figure of a result sentence: "80,5 % → 86 %", "49,9 %", "5 à 8 min", "4 → 2 ou 3"… (null when none). */
export function headline(result?: string | null): { big: string; rest: string } | null {
  if (!result) return null;
  const unit = String.raw`(?:\s?(?:%|points?|pts?|minutes?|min|heures?|h|jours?|semaines?|mois|ans|lits?|ETP|MDH|M€|M\$|k€|€|\$|×|fois|patients?)(?![A-Za-zÀ-ÿ]))?`;
  const num = String.raw`[+−-]?\d+(?:[  .,]\d{3})*(?:[.,]\d+)?`;
  const re = new RegExp(`${num}${unit}(?:\\s?(?:→|->|à)\\s?${num}${unit}(?:\\s?ou\\s?${num})?)?`);
  const m = result.match(re);
  if (!m) return null;
  return { big: m[0].trim(), rest: result };
}
/** Measured benchmarks of a set of cases (deduplicated). */
export function benchOf(ids: string[]): Benchmark[] {
  const seen = new Map<string, Benchmark>();
  for (const id of ids) for (const b of benchFor(id)) seen.set(b.id, b);
  return [...seen.values()];
}
