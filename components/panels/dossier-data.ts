// Pure data helpers for the use-case dossier and the "Par cas" sources view.
// Nothing here is invented: every row comes from lib/data/base.json (cases) and lib/data/benchmarks.json (sources).
import { CASE, CASES, BENCH, DATA, fr, benchFor, type Benchmark, type UseCase } from "@/lib/model";
import { DISCOUNT } from "./dossier-v23-data";
import { DEPTS, DEPT, CASE_DEPT, type Dept } from "@/lib/hospital";
import { GLOSSARY } from "@/lib/glossary";
import { levelCode, in302, norm } from "@/lib/ui/fmt";

export const LEVEL_RANK: Record<string, number> = { A: 0, B: 1, C: 2, R: 3, N: 4 };

/** Empty string, "—" and null all mean "no data". */
export const clean = (s?: string | null) => { const t = (s ?? "").trim(); return t && t !== "—" ? t : null; };

/* ================================================================ sources */
export type Src = {
  b: Benchmark;
  key: string;            // one publication = one key (its URL, else its label)
  direct: string[];       // cases this entry is attached to (v13 ∪ app)
  related: string[];      // cases it is only "liée" to (the `related` field)
  attached: string[];     // every case that cites this publication (direct ∪ related, over all entries sharing it)
  measured: boolean;
  code: string;           // evidence level A | B | C | R | N
  hay: string;            // normalised text for search
};

const ORDER: Record<string, number> = Object.fromEntries(CASES.map((c, i) => [c.id, i]));
const byOrder = (a: string, b: string) => (ORDER[a] ?? 999) - (ORDER[b] ?? 999);
const pubKey = (b: Benchmark) => (b.url ? b.url.trim().replace(/\/+$/, "").toLowerCase() : `s:${norm(b.source)}`);

const raw = BENCH.map((b) => {
  const direct = [...new Set([...b.v13, ...b.app])].filter((x) => CASE[x]).sort(byOrder);
  const related = [...new Set(b.related)].filter((x) => CASE[x] && !direct.includes(x)).sort(byOrder);
  return { b, key: pubKey(b), direct, related };
});
const groups = new Map<string, typeof raw>();
for (const r of raw) { const g = groups.get(r.key); if (g) g.push(r); else groups.set(r.key, [r]); }

export const SRC: Src[] = raw.map((r) => ({
  ...r,
  attached: [...new Set((groups.get(r.key) ?? [r]).flatMap((g) => [...g.direct, ...g.related]))].sort(byOrder),
  measured: !!r.b.measured,
  code: levelCode(r.b.level),
  hay: norm([r.b.id, r.b.who, r.b.country, r.b.source, r.b.what, r.b.result, r.b.metric, r.b.year, r.b.level, r.b.note, r.b.reading].filter(Boolean).join(" ")),
}));
export const SRC_BY_ID: Record<string, Src> = Object.fromEntries(SRC.map((s) => [s.b.id, s]));

/** Is this source the headline proof written in the case fiche (base.json `proof`)? */
export function isMainProof(c: UseCase, s: Src): boolean {
  const p = c.proof;
  if (!p) return false;
  return p.source_url ? s.b.url === p.source_url : s.b.source === p.source;
}

const srcSort = (a: Src, b: Src) =>
  Number(b.measured) - Number(a.measured) || (LEVEL_RANK[a.code] ?? 9) - (LEVEL_RANK[b.code] ?? 9) || (b.b.year ?? 0) - (a.b.year ?? 0) || a.b.id.localeCompare(b.b.id);

/** Sources of one case: attached ones (bench_ids) first, headline proof on top; then references that are only linked. */
export function sourcesOfCase(id: string): { own: Src[]; linked: Src[]; main: Src | null } {
  const c = CASE[id];
  if (!c) return { own: [], linked: [], main: null };
  const own = SRC.filter((s) => s.direct.includes(id)).sort(srcSort);
  const main = own.find((s) => isMainProof(c, s)) ?? null;
  if (main) own.splice(own.indexOf(main), 1), own.unshift(main);
  const linked = SRC.filter((s) => !s.direct.includes(id) && s.related.includes(id)).sort(srcSort);
  return { own, linked, main };
}

export const typeLabel = (s: Src) => (s.measured ? "Mesuré" : "Non mesuré");

/** Sources in the data that no case cites (neither attached nor linked). */
export const ORPHAN_SOURCES = SRC.filter((s) => !s.attached.length);

/* ================================================================ case order (department, then catalogue) */
const best = (id: string) => { const lv = benchFor(id).map((b) => levelCode(b.level)).sort((a, b) => (LEVEL_RANK[a] ?? 9) - (LEVEL_RANK[b] ?? 9))[0]; return LEVEL_RANK[lv ?? "N"] ?? 9; };
/** Same order as the department list: payroll cases first, by savings, then the others. */
function deptOrder(d: Dept): string[] {
  return d.cases.filter((id) => CASE[id]).sort((x, y) => {
    const a = CASE[x], b = CASE[y];
    return Number(in302(b)) - Number(in302(a)) || b.mdh - a.mdh || best(x) - best(y) || x.localeCompare(y);
  });
}
export const SEQ: string[] = [...new Set(DEPTS.flatMap(deptOrder))];

export type Neighbour = { id: string; sameDept: boolean; dept: Dept | undefined };
export function neighbours(id: string): { prev: Neighbour | null; next: Neighbour | null; dept: Dept | undefined; pos: number; total: number; index: number } {
  const dept = DEPT[CASE_DEPT[id]];
  const i = SEQ.indexOf(id);
  const mk = (j: number): Neighbour | null => (j < 0 || j >= SEQ.length ? null : { id: SEQ[j], sameDept: CASE_DEPT[SEQ[j]] === CASE_DEPT[id], dept: DEPT[CASE_DEPT[SEQ[j]]] });
  const list = dept ? deptOrder(dept) : [];
  return { prev: mk(i - 1), next: mk(i + 1), dept, pos: list.indexOf(id) + 1, total: list.length, index: i + 1 };
}

/** Cases linked to this one: it depends on / it feeds / they cite the same publication. */
export function relatedCases(id: string): { dependsOn: string[]; feeds: string[]; shared: { id: string; via: string }[] } {
  const c = CASE[id];
  if (!c) return { dependsOn: [], feeds: [], shared: [] };
  const dependsOn = (c.depend_de ?? []).filter((x) => CASE[x]);
  const feeds = (c.alimente ?? []).filter((x) => CASE[x]);
  const skip = new Set([id, ...dependsOn, ...feeds]);
  const shared = new Map<string, string>();
  const { own, linked } = sourcesOfCase(id);
  for (const s of [...own, ...linked]) for (const o of s.attached) if (!skip.has(o) && !shared.has(o)) shared.set(o, s.b.source);
  return { dependsOn, feeds, shared: [...shared].map(([cid, via]) => ({ id: cid, via })).sort((a, b) => byOrder(a.id, b.id)) };
}

/* ================================================================ governance and deployment lookups */
/** Data class N0 … N3+ : label and rules from the governance table (DATA.levels), short wording from the glossary. */
export function dataClass(code: string): { code: string; name: string; examples?: string; models?: string; access?: string; short?: string; long?: string } {
  const rows = DATA.levels.slice(1);
  const row = rows.find((r) => r[0].split(" ")[0] === code);
  const g = GLOSSARY[code];
  return { code, name: row ? row[0].split(" ").slice(1).join(" ") : "", examples: row?.[1], models: row?.[2], access: row?.[3], short: g?.short, long: g?.long };
}
export const waveOf = (k: string) => DATA.waves.find((w) => w.k === k);
export const councilRole = () => DATA.gouv.find((g) => g.id === "conseil");

/* ================================================================ glossary annotation (first use of an abbreviation) */
// Marker characters wrap the explanation so that the UI can render it muted: see <Rich>.
const TERM_RE = /(?<![\p{L}\p{N}_-])(ETP-éq\.|MDH|kMAD|MAD|ETP|ROI|VAN|MS|CA|AMO|PEC|CNSS|CNDP|HIS|GMAO|AMMC)(?![\p{L}\p{N}_])/gu;
/** Terms of the v2.3 business case that the shared glossary does not hold (VAN: the discount rate comes from the finance hypotheses). */
const EXTRA_TERMS: Record<string, string> = { VAN: `valeur actuelle nette, actualisée à ${fr(DISCOUNT * 100, 0)} % par an`, MS: "masse salariale" };
const shortOf = (m: string) => EXTRA_TERMS[m] ?? GLOSSARY[m]?.short;
export const OPEN = "\u0001", CLOSE = "\u0002";
export type Block = { key: string; text: string; seen?: string[] };
/** Walks the blocks in reading order and adds "(explanation)" after the first occurrence of each abbreviation. */
export function annotateAll(blocks: Block[]): Record<string, string> {
  const seen = new Set<string>();
  const out: Record<string, string> = {};
  for (const b of blocks) {
    b.seen?.forEach((k) => seen.add(k));
    out[b.key] = b.text.replace(TERM_RE, (m) => {
      if (seen.has(m)) return m;
      seen.add(m);
      const sh = shortOf(m);
      return sh ? `${m}${OPEN} (${sh})${CLOSE}` : m;
    });
  }
  return out;
}

/* ================================================================ one-shot intent: dossier -> Sources page */
export const sourcesIntent: { caseId: string | null; tab: "prog" | "net" | "cas" | null } = { caseId: null, tab: null };

/* ================================================================ session memory */
const KEY = "atlas.dossier.v1";
type Mem = { scroll: Record<string, number>; open: Record<string, string[]> };
let mem: Mem | null = null;
function load(): Mem {
  if (mem) return mem;
  mem = { scroll: {}, open: {} };
  try { const t = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(KEY) : null; if (t) mem = { ...mem, ...JSON.parse(t) }; } catch { /* storage blocked */ }
  return mem!;
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; try { sessionStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* storage blocked */ } }, 400);
}
export const memory = {
  getScroll: (id: string) => load().scroll[id] ?? 0,
  setScroll: (id: string, v: number) => { load().scroll[id] = Math.round(v); persist(); },
  getOpen: (id: string) => new Set(load().open[id] ?? []),
  setOpen: (id: string, s: Set<string>) => { load().open[id] = [...s]; persist(); },
};
