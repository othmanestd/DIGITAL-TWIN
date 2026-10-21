// Jabby's knowledge pack for the v2.3 dataset ("chiffres actualisés"): the case-by-case business case 2027-2031 —
// ① savings (payroll + other opex) + ② margin on additional revenue − ③ programme cost = net value — built once per
// server process from lib/data/v23/*.json (through lib/model's FIN / FINROW / V23CASE, which are dataset-independent)
// and the case texts of lib/data/base.json. No figure is typed by hand. The v13 pack (knowledge.ts) is untouched;
// app/api/chat picks one or the other from the `atlas_ds` cookie of the request.
import { DATA, CASES, CASE, FIN, FINROW, V23CASE, fr, MODE_LABEL, type UseCase } from "../model";
import { DEPTS, DEPT, CASE_DEPT, FLOORS, ROLE_LABEL, EXPERIENCES, XP } from "../hospital";
import { SITES, CITIES, INTERNATIONAL } from "../geo/network";
import { refsFor, firstClause, benchShort } from "./knowledge";

const r1 = (x: number | null | undefined) => fr(x ?? 0, 1);
const r0 = (x: number | null | undefined) => fr(x ?? 0, 0);
const Y = ["2027", "2028", "2029", "2030", "2031"] as const;
const y31 = (k: string) => FINROW[k]?.values["2031"] ?? 0;
const floorName = (b: string, f: number) => FLOORS.find((x) => x.building === b && x.floor === f)?.name ?? `${b} ${f}`;
const counted = () => CASES.filter((c) => V23CASE[c.id]?.projections && !V23CASE[c.id]?.merged_into);
const hyp = (label: string) => FIN.hypotheses.find((h) => h.label.startsWith(label));
const extra = (kind: string, re: RegExp) => ((FIN as unknown as { pdf_extra?: { kind: string; title: string; page: string; doc: string; values: unknown }[] }).pdf_extra ?? []).find((e) => e.kind === kind && re.test(e.title));

/** Recovered vs new-activity margin (type R / N of each case's revenue). */
function marginSplit() {
  let rec = 0, neu = 0, caR = 0, caN = 0;
  for (const c of counted()) {
    const v = V23CASE[c.id];
    if (!v.v23.ca) continue;
    if (v.assumptions?.["Type de CA"] === "R") { rec += v.v23.marge ?? 0; caR += v.v23.ca; } else { neu += v.v23.marge ?? 0; caN += v.v23.ca; }
  }
  return { rec, neu, caR, caN };
}

function value23(c: UseCase): string {
  const v = V23CASE[c.id];
  if (!v) return "sans chiffrage v2.3";
  if (v.merged_into) return `fusionné dans ${v.merged_into} (arbitrage v2.1), valeur comptée dans ce cas`;
  const w = v.v23;
  if (c.fam === "T") return `levier sans gain propre, coût ${r1(w.cout)} MDH/an en 2031`;
  const parts = [`économies ${r1(w.eco)} (MS ${r1(w.ms)} + hors MS ${r1(w.hms)})`];
  if (w.ca) parts.push(`marge ${r1(w.marge)} sur CA ${r1(w.ca)} (${v.assumptions?.["Type de CA"] === "R" ? "CA récupéré" : "activité nouvelle"})`);
  return `${parts.join(" + ")} − coût ${r1(w.cout)} = net ${r1(w.net)} MDH/an en 2031 ; ${r0(w.etp)} ETP-éq. ; cumul 2027-2031 ${r1(w.cumul)} MDH ; brique ${w.brique ?? "—"}`;
}
function caseLine(id: string) {
  const c = CASE[id];
  const v = V23CASE[id];
  return `${c.id} | ${c.titre} | ${CASE_DEPT[id] ?? "—"} | ${value23(c)} | ${v?.catalogue?.["Vague"] ?? c.vague} | ${c.mode}`;
}
function casePackLine(id: string) {
  const m = refsFor(id).measured[0];
  return caseLine(id) + (m ? ` | MESURÉ : ${m.who}${m.year ? `, ${m.year}` : ""} : ${firstClause(m.result, 110)} [${m.level.slice(0, 1)}]` : " | aucun résultat mesuré");
}

let PACK = "";
export function knowledgePackV23(): string {
  if (PACK) return PACK;
  const L: string[] = [];
  const M = marginSplit();
  const n = counted().length;
  const nT = counted().filter((c) => c.fam === "T").length;
  L.push(`# Programme — business case v2.3 (chiffres actualisés, scénario ${FIN.meta.scenario}), 2027-2031, MDH courants`);
  L.push(`En 2031, par an : ① économies ${r1(y31("eco"))} MDH (masse salariale ${r1(y31("ms"))} : postes non remplacés et recrutements évités ; hors masse salariale ${r1(y31("hms"))} : achats, énergie, maintenance, trésorerie…) + ② marge sur CA additionnel ${r1(y31("marge"))} MDH (CA additionnel ${r1(y31("ca"))} MDH pour mémoire : CA récupéré ${r1(M.caR)} → marge ${r1(M.rec)} à 95 %, soins déjà faits non facturés ou rejetés ; CA de nouvelle activité ${r1(M.caN)} → marge ${r1(M.neu)} à 40 % ; le CA n'est jamais compté tel quel, seule sa marge) = gains bruts ${r1(y31("gains"))} MDH − ③ coût du programme ${r1(y31("cout"))} MDH (agents et plateformes des cas ${r1(y31("cout_cases"))}, coûts transverses ${r1(y31("cout_transverse"))}, contingence ${r1(y31("contingence"))}) = valeur nette ${r1(y31("net"))} MDH par an.`);
  L.push(`Cumul 2027-2031 de la valeur nette : ${r1(FINROW.net.cumul)} MDH ; VAN à 10 % : ${r1(FINROW.net.van)} MDH ; gains bruts pour 1 dirham de coût en 2031 : ${fr(y31("ratio"), 2)}. ETP-équivalents libérés en 2031 : ${r0(y31("etp"))}. Zéro licenciement. ${n} cas d'usage chiffrés (dont ${nT} leviers de réalisation T sans gain propre), 4 cas fusionnés en v2.1 (89 → 85).`);
  L.push(`Par année (gains bruts / coût / valeur nette / cumul) : ` + Y.map((y) => `${y} : ${r1(FINROW.gains.values[y])} / ${r1(FINROW.cout.values[y])} / ${r1(FINROW.net.values[y])} / ${r1(FINROW.net_cumul.values[y])}`).join(" ; ") + `. 2027 est une année d'investissement ; le cumul devient positif en 2028. 2026 = aujourd'hui, aucun agent, 0.`);
  const sc = extra("scenario", /scénarios/i);
  if (sc) L.push(`Scénarios 2031 (document client, ${sc.doc} p.${sc.page}) : ${((sc.values as { lignes?: Record<string, string>[] }).lignes ?? []).map((l) => `${l["scénario"]} : économies ${l["économies"]}, marge ${l["marge_ca"]}, gains ${l["gains_bruts"]}, coût ${l["coût"]}, valeur nette ${l["valeur_nette"]}, cumul ${l["cumul_27_31"]}, rentable en ${l["rentable_en"]}`).join(" ; ")}. Les coûts ne changent pas avec le scénario.`);
  L.push(`Croissance du groupe intégrée : établissements ${Object.entries(FIN.trajectory["Établissements"].values).map(([k, v]) => `${k} ${v}`).join(", ")} (${FIN.trajectory["Établissements"].note}) ; lits ${Object.entries(FIN.trajectory["Lits"].values).map(([k, v]) => `${k} ${r0(v)}`).join(", ")}.`);
  L.push(`Hypothèses clés : ${FIN.hypotheses.filter((h) => typeof h.value === "number").map((h) => `${h.label} ${typeof h.value === "number" && h.value < 1 ? fr(h.value * 100, 1) + " %" : r1(h.value as number)}${h.note ? ` (${h.note})` : ""}`).join(" ; ")}.`);
  L.push(`Partenaires : Mibtech (systèmes Oryon, Humaneo, Sage, GMAO ; agents administratifs « IA Twin ») × JABB (Rafiq, Keeps, JABB Twin, agents vocaux et métiers, Agentic Command Center). Client : groupe Akdital. Personnages de la visite guidée (fictifs) : Amina (patiente, prothèse du genou), Youssef (chargé d'admission devenu pilote d'agents), Salma (infirmière), Karim (technicien biomédical, JABB Twin), Hicham (facturier), Leïla (contrôleuse de gestion sociale, Agentic Command Center).`);

  L.push(`\n# Par brique (2031 : économies + marge = gains − coût propre = net ; cumul ; VAN)`);
  for (const b of FIN.by_brique) L.push(`${b.name} (${b.n ?? "—"} cas) : ${r1(b.eco)} + ${r1(b.marge)} = ${r1(b.gains)} − ${r1(b.cout)} = ${r1(b.net)} ; cumul ${r1(b.cumul)} ; VAN ${r1(b.van)}`);
  L.push(`\n# Par famille (même lecture)`);
  for (const b of FIN.by_famille) L.push(`${b.name} (${b.n ?? "—"} cas) : ${r1(b.eco)} + ${r1(b.marge)} = ${r1(b.gains)} − ${r1(b.cout)} = ${r1(b.net)} ; cumul ${r1(b.cumul)}`);

  L.push(`\n# Zéro licenciement`);
  const zl = extra("kpi", /Zéro licenciement/i);
  if (zl) L.push(Object.entries(zl.values as Record<string, string>).map(([k, v]) => `${k} : ${v}`).join(" ; "));
  L.push(`Départs par an (2026) : ${r0(hyp("Départs par an")?.value as number)} (${hyp("Départs par an")?.note ?? ""}).`);
  L.push(`Leviers qui protègent la valeur (cumul 2027-2031 perdu sans eux / coût) : ${FIN.levers.map((l) => `${l.levers} — ${l.what.split(" · ")[0]} : ${r1(l.lostCumul)} MDH protégés pour ${r1(l.cost)} MDH`).join(" ; ")}.`);

  L.push(`\n# Vagues de déploiement (valeur nette 2031 des cas de la vague)`);
  for (const w of DATA.waves) {
    const ids = counted().filter((c) => V23CASE[c.id].catalogue["Vague"] === w.k).map((c) => c.id);
    const net = ids.reduce((a, id) => a + (V23CASE[id].v23.net ?? 0), 0);
    L.push(`${w.k} (${w.when}) : ${w.what} ; ${ids.length} cas ; ${r1(net)} MDH nets en 2031`);
  }
  const dec = extra("narrative", /Décision attendue/i);
  if (dec) L.push(`Décision attendue du CODIR : ${JSON.stringify(dec.values).slice(0, 700)}`);

  L.push(`\n# Modes`);
  L.push(Object.entries(MODE_LABEL).map(([k, v]) => `${k} ${v}`).join(" ; "));
  L.push(`\n# Cas d'usage v2.3 (id | titre | service | chiffres 2031 | vague | mode | meilleur résultat MESURÉ ailleurs [A publication, B publié par l'hôpital, C publié par l'éditeur])`);
  for (const c of CASES) L.push(casePackLine(c.id));

  L.push(`\n# Hôpital type en 3D (bâtiment principal main : étages -1 à 4, le 4e = qualité et JABB Twin ; annexe du siège annex : 0 à 3)`);
  for (const f of FLOORS) {
    const ds = DEPTS.filter((d) => d.building === f.building && d.floor === f.floor);
    L.push(`${f.building}:${f.floor} ${f.name} → ` + ds.map((d) => `${d.id} (${d.short}${d.cases.length ? " : " + d.cases.join(",") : " : soin humain, non touché"})`).join(" ; "));
  }
  L.push(`Expériences IA de l'accueil (select kind=xp ; leurs gains sont déjà comptés dans les cas liés) : ` + EXPERIENCES.map((x) => `${x.id} ${x.name} (${x.dept} ; ${x.cases.join(",")})`).join(" ; "));
  L.push(`Personnes : id "dept/role/index" ; rôles : ${Object.keys(ROLE_LABEL).join(", ")}.`);
  L.push(`\n# Gouvernance`);
  L.push(DATA.gouv.map((g) => `${g.name}${g.cadence ? ` (${g.cadence})` : ""} : ${g.role}`).join(" ; "));
  L.push(`\n# Réseau Akdital`);
  L.push(`Périmètre chiffré : le Maroc (45 établissements en 2026, 65 en 2031 dans le modèle). L'international n'est pas chiffré (ne jamais inventer de chiffres pour ces pays).`);
  if (CITIES.length) L.push(`Villes : ` + CITIES.map((c) => `${c.name} (${c.slug}) ${c.operational}`).join(" ; "));
  if (SITES.length) L.push(`Établissements : ` + SITES.map((s) => `${s.name} (${s.slug}, ${s.city}, ${s.status})`).join(" ; "));
  if (INTERNATIONAL.length) L.push(`International : ${INTERNATIONAL.map((i) => `${i.country} · ${i.city} — ${i.status.slice(0, 90)}`).join(" ; ")}`);
  PACK = L.join("\n");
  return PACK;
}

/** The persona's headline for v2.3 (figures from the data). */
export function headlineV23(): string {
  return `Le programme (business case v2.3, chiffres actualisés) : en 2031, ${r1(y31("eco"))} MDH d'économies (dont ${r1(y31("ms"))} de masse salariale) + ${r1(y31("marge"))} MDH de marge sur ${r1(y31("ca"))} MDH de CA additionnel = ${r1(y31("gains"))} MDH de gains bruts, − ${r1(y31("cout"))} MDH de coût du programme = ${r1(y31("net"))} MDH de valeur nette par an ; ${r1(FINROW.net.cumul)} MDH cumulés 2027-2031 ; ≈ ${r0(Math.round(y31("etp") / 10) * 10)} ETP-éq. libérés, sans aucun licenciement.`;
}

// ---------------------------------------------------------------- tool results (v2.3)
export function caseDetailV23(id: string): string {
  const c = CASE[id.toUpperCase()];
  if (!c) return `Cas ${id} introuvable. Cas existants : ${CASES.map((x) => x.id).join(", ")}.`;
  const v = V23CASE[c.id];
  const r = refsFor(c.id);
  return [
    `Cas ouvert à l'écran : ${caseLine(c.id)}`,
    v?.v23.hypothese ? `Hypothèse de chiffrage v2.3 : ${v.v23.hypothese}` : "",
    v?.v23.arbitrage ? `Arbitrage : ${v.v23.arbitrage}` : "",
    r.measured.length ? `Déjà mesuré ailleurs (MESURÉ, à citer avec organisation, année et source) : ${r.measured.slice(0, 3).map(benchShort).join(" || ")}` : "Déjà mesuré ailleurs : AUCUN résultat mesuré pour ce cas. Le dire clairement.",
    `Aujourd'hui : ${c.aujourdhui}`,
    `Avec l'agent : ${c.solution}`,
    `Validation humaine : ${c.validation_humaine}`,
    `Garde-fous : ${c.garde_fous}`,
    `Métier libéré : ${c.metier_libere}. Sensibilité données : ${c.sensibilite}.`,
  ].filter(Boolean).join("\n");
}

function sumCases(ids: string[]) {
  let eco = 0, marge = 0, cout = 0, net = 0, etp = 0;
  for (const id of ids) { const v = V23CASE[id]; if (!v?.projections || v.merged_into) continue; eco += v.v23.eco ?? 0; marge += v.v23.marge ?? 0; cout += v.v23.cout ?? 0; net += v.v23.net ?? 0; etp += v.v23.etp ?? 0; }
  return { eco, marge, cout, net, etp };
}
export function deptDetailV23(id: string): string {
  const d = DEPT[id];
  if (!d) return `Service ${id} introuvable. Services : ${DEPTS.map((x) => x.id).join(", ")}.`;
  const s = sumCases(d.cases);
  return [
    `Service ouvert à l'écran : ${d.name} (${floorName(d.building, d.floor)}).`,
    d.cases.length ? `Cas : ${d.cases.map((c) => caseLine(c)).join(" || ")}` : `Aucun cas : ${d.note ?? "le soin reste humain."}`,
    d.cases.length ? `Total service (groupe, 2031) : économies ${r1(s.eco)} + marge ${r1(s.marge)} − coût ${r1(s.cout)} = net ${r1(s.net)} MDH ; ${r0(s.etp)} ETP-éq.` : "",
  ].filter(Boolean).join("\n");
}
export function floorDetailV23(key: string): string {
  const [b, f] = key.split(":");
  const ds = DEPTS.filter((d) => d.building === b && String(d.floor) === f);
  if (!ds.length) return `Étage ${key} introuvable.`;
  const s = sumCases(ds.flatMap((d) => d.cases));
  return `Étage ouvert : ${floorName(b, Number(f))}. Services : ${ds.map((d) => `${d.short} (${d.cases.join(",") || "soin humain"})`).join(" ; ")}. Total 2031 : net ${r1(s.net)} MDH (économies ${r1(s.eco)}, marge ${r1(s.marge)}, coût ${r1(s.cout)}).`;
}
export function xpDetailV23(id: string): string {
  const x = XP[id];
  if (!x) return `Expérience ${id} introuvable.`;
  return `Expérience IA ouverte : ${x.name} (${DEPT[x.dept]?.name ?? x.dept}). ${x.what} Pour le patient : ${x.patient} Ses gains sont comptés dans ${x.cases.join(" et ")} : ne pas les additionner.`;
}
export function sectionDetailV23(s: string): string {
  switch (s) {
    case "synthese": case "finances": return `Section ${s === "finances" ? "Finances" : "Synthèse"} : ${headlineV23()}`;
    case "cas": return `Section Cas d'usage : ${counted().length} cas chiffrés v2.3, par famille : ${FIN.by_famille.filter((b) => !b.name.startsWith("Total")).map((b) => `${b.name.split(" ·")[0]} ${b.n}`).join(", ")}.`;
    case "emplois": { const zl = extra("kpi", /Zéro licenciement/i); return `Section Emplois : ≈ ${r0(y31("etp"))} ETP-éq. libérés en 2031, zéro licenciement. ${zl ? Object.entries(zl.values as Record<string, string>).slice(0, 6).map(([k, v]) => `${k} : ${v}`).join(" ; ") : ""}`; }
    case "deploiement": return `Section Déploiement : ${DATA.waves.map((w) => `${w.k} ${w.when} : ${w.what}`).join(" ; ")}.`;
    case "gouvernance": return `Section Gouvernance : ${DATA.gouv.map((g) => `${g.name} — ${g.role}`).join(" ; ")}.`;
    case "sources": return `Section Sources : ${FIN.meta.source.join(" ; ")}.`;
    default: return "Retour à la vue 3D.";
  }
}
export function yearDetailV23(y: number): string {
  if (y === 2026) return "Année 2026 (aujourd'hui) : aucun agent en production, 0 MDH.";
  const k = String(y);
  if (!FINROW.net.values[k]) return `Année ${y} hors frise (2026-2031).`;
  return `Année ${y} : économies ${r1(FINROW.eco.values[k])} + marge ${r1(FINROW.marge.values[k])} = gains bruts ${r1(FINROW.gains.values[k])} MDH, coût du programme ${r1(FINROW.cout.values[k])}, valeur nette ${r1(FINROW.net.values[k])}, cumul ${r1(FINROW.net_cumul.values[k])} MDH ; ${r0(FINROW.etp.values[k])} ETP-éq. libérés ; ${FIN.trajectory["Établissements"].values[k]} établissements.`;
}
export function levelDetailV23(l: string): string {
  if (l === "world") return "Vue monde : Akdital dans le monde ; l'international n'est pas chiffré dans le business case.";
  if (l === "morocco") return `Vue Maroc : 45 établissements en 2026, ${FIN.trajectory["Établissements"].values["2031"]} en 2031 dans le modèle (59 en 2028 publié).`;
  return `Vue hôpital type. ${headlineV23()}`;
}
