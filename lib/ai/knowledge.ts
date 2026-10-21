// Jabby's knowledge pack: a compact, text-only digest of the business model, the typical hospital and the network.
// Built once per server process from lib/model.ts, lib/hospital.ts and lib/geo/network.ts (no figure is typed by hand).
// Also builds the detailed "tool results" returned when Jabby opens a case, a department, a section…
import { DATA, CASES, CASE, META, ETAB, fr, verdict, MODE_LABEL, BENCH, type Benchmark } from "../model";
import { DEPTS, DEPT, CASE_DEPT, FLOORS, ROLE_LABEL, EXPERIENCES, XP } from "../hospital";
import { SITES, CITIES, INTERNATIONAL, GROUP } from "../geo/network";

const r1 = (x: number) => fr(x, 1);
const r0 = (x: number) => fr(x, 0);
const floorName = (b: string, f: number) => FLOORS.find((x) => x.building === b && x.floor === f)?.name ?? `${b} ${f}`;

// ---------------------------------------------------------------- evidence ("ça a marché ailleurs")
const lvlRank = (l: string) => (l.startsWith("A") ? 0 : l.startsWith("B") ? 1 : 2);
/** References of a case: measured ones first (best level, most recent). */
export function refsFor(id: string): { measured: Benchmark[]; other: Benchmark[] } {
  const all = BENCH.filter((b) => b.v13.includes(id) || b.app.includes(id));
  const sort = (a: Benchmark, b: Benchmark) => lvlRank(a.level) - lvlRank(b.level) || (b.year || 0) - (a.year || 0);
  const measured = all.filter((b) => b.measured).sort(sort);
  // the reference the v1.3 fiche retained as its proof comes first (it is the one shown in the side panel)
  const pr = CASE[id]?.proof;
  const fi = pr ? measured.findIndex((b) => b.source === pr.source || pr.resultat.includes(b.result.split(" ; ")[0].slice(0, 40))) : -1;
  if (fi > 0) measured.unshift(...measured.splice(fi, 1));
  return { measured, other: all.filter((b) => !b.measured).sort(sort) };
}
export const firstClause = (s: string, max = 150) => { const t = s.split(" ; ")[0].trim(); return t.length > max ? t.slice(0, t.lastIndexOf(" ", max)) + "…" : t; };
export const benchShort = (b: Benchmark) => `${b.who}${b.year ? `, ${b.year}` : ""} : ${firstClause(b.result)} [niveau ${b.level.slice(0, 1)}, ${b.source}]`;

function valueOf(id: string) {
  const c = CASE[id];
  if (c.in302 && c.mdh) return `${r1(c.mdh)} MDH/an dans les 302 | ${r0(c.etp)} ETP | coût ${r1(c.cout)} | ROI ${fr(c.roi, 2)}`;
  if (c.fam === "T") return "levier sans gain propre";
  return `hors masse salariale, non additif : ${c.value_out || "valeur qualitative"}`;
}

function caseLine(id: string) {
  const c = CASE[id];
  return `${c.id} | ${c.titre} | ${CASE_DEPT[id]} | ${valueOf(id)} | ${c.vague} | ${c.mode}`;
}
/** Pack line: the case + its best measured result (if any). */
function casePackLine(id: string) {
  const m = refsFor(id).measured[0];
  return caseLine(id) + (m ? ` | MESURÉ : ${m.who}${m.year ? `, ${m.year}` : ""} : ${firstClause(m.result, 110)} [${m.level.slice(0, 1)}]` : " | aucun résultat mesuré");
}

let PACK = "";
export function knowledgePack(): string {
  if (PACK) return PACK;
  const m = META;
  const L: string[] = [];
  const nIn = CASES.filter((c) => c.in302).length, nT = CASES.filter((c) => c.fam === "T").length, nOut = CASES.length - nIn - nT;
  const nMeas = CASES.filter((c) => refsFor(c.id).measured.length).length;
  L.push(`# Programme (modèle v1.3, ${m.date})`);
  L.push(
    `Au plein régime (2029), par an : économie de masse salariale ${m.eco} MDH ; coût de fonctionnement des agents ${m.budget} MDH ; gain net ${m.net} MDH ; ROI ${fr(m.roi, 2)} (dirhams économisés pour 1 dirham d'agents). ${r0(m.postes)} ETP-éq. libérés. Zéro licenciement. ${CASES.length} cas d'usage : ${nIn} comptés dans les 302 MDH (familles A, S, P, H), ${nOut} à valeur hors masse salariale non additive (X, C, R, I, plus S-15 et S-16), ${nT} leviers de réalisation (T). ${nMeas} cas ont au moins un résultat déjà mesuré ailleurs (${BENCH.filter((b) => b.measured).length} références mesurées sur ${BENCH.length}).`,
  );
  L.push(`Partenaires : Mibtech (éditeur des systèmes, intégration) × JABB (agents IA). Client : groupe Akdital, 1er groupe hospitalier privé du Maroc.`);
  L.push(
    `Akdital (communiqué S1 2026) : ${GROUP.establishments} établissements, ${r0(GROUP.beds)} lits, ${GROUP.cities} villes, ${m.pub.pub_collab} collaborateurs ; objectif 2028 : ${GROUP.target2028.establishments} établissements, ${r0(GROUP.target2028.beds)} lits, ${GROUP.target2028.cities} villes. Charges de personnel S1 2026 : ${m.pub.pub_ms_s1_26} MDH (${m.pub.pub_ms_growth}) ; 2025 : ${m.pub.pub_ms_25} MDH ; annualisé ≈ ${m.pub.pub_ms_annual} MDH. CA S1 2026 ${m.pub.pub_ca_s1_26} MDH ; ratio charges de personnel / CA ${m.pub.pub_ratio_s1_26}. Les 302 MDH ≈ ${m.part_ms} de la masse salariale annualisée.`,
  );
  L.push(`« Hôpital type » = chiffres du groupe ÷ ${ETAB} établissements (les cas du siège S et les leviers T ne se divisent pas).`);
  L.push(`Avertissement chiffres : ${m.flag_160}`);

  L.push(`\n# Familles (ETP payés → part reprise → postes libérés → MDH, coût, net, ROI, nb cas)`);
  for (const f of DATA.fams)
    L.push(f.mdh ? `${f.code} ${f.name} : ${r0(f.etp)} ETP → ${Math.round(f.part * 100)} % → ${r0(f.postes)} postes ; ${r1(f.mdh)} MDH ; coût ${r1(f.cout)} ; net ${r1(f.net)} ; ROI ${fr(f.roi, 2)} ; ${f.n} cas` : `${f.code} ${f.name} : ${f.n} cas — ${(f as { note?: string | null }).note || "hors 302 MDH"}`);

  L.push(`\n# Montée en charge (MDH par an : économie / coût / net / cumul net)`);
  L.push(`2026 aujourd'hui : 0. ` + (["2027", "2028", "2029"] as const).map((y) => `${y} : ${r1(DATA.ramp[y].eco)} / ${r1(DATA.ramp[y].cout)} / ${r1(DATA.ramp[y].net)} / ${r1(DATA.ramp[y].cumul)}`).join(" ; "));
  L.push(`Sensibilité (gain net) : ${Object.entries(DATA.sens).map(([k, v]) => `${k} → ${r1(v)} MDH`).join(" ; ")}`);

  L.push(`\n# Vagues de déploiement`);
  for (const w of DATA.waves) L.push(`${w.k} (${w.when}) : ${w.what}${w.ids.length ? ` ; ${w.ids.length} cas ; ${r1(w.mdh)} MDH ; coût ${r1(w.cout)}` : ""}`);

  L.push(`\n# Zéro licenciement (logique d'absorption)`);
  const a = DATA.abs;
  L.push(
    `Postes administratifs libérés (A+S) : ${r0(a.postes_admin)}. Départs naturels administratifs ≈ ${r0(a.departs_admin_an)} par an (turnover ${fr(m.turnover * 100, 1)} %, ${r0(m.departs_an)} départs/an groupe) → absorbés en ≈ ${fr(a.annees_departs, 1)} ans par non-remplacement. Ouvertures 2026-2028 : ${r0(a.postes_admin_ouvertures)} postes administratifs à pourvoir (mobilité interne), ${r0(a.soignants_ouvertures)} postes soignants. Capacité d'absorption sur 3 ans ≈ ${r0(a.capacite_3ans)} postes. Leviers : non-remplacement des départs, mobilité vers les ouvertures, recrutements évités, académie de pilotes d'agents (T-04), bourse des transitions (T-05). Soignants : le temps rendu retourne au soin (pénurie nationale : 64 000 infirmiers manquants).`,
  );

  L.push(`\n# Modes et briques`);
  L.push(Object.entries(MODE_LABEL).map(([k, v]) => `${k} ${v}`).join(" ; "));
  L.push(DATA.briques.map((b) => `${b.name} : ${r1(b.mdh)} MDH, coût ${r1(b.cout)}`).join(" ; "));

  L.push(`\n# Cas d'usage (id | titre | service | valeur | vague | mode | meilleur résultat MESURÉ ailleurs [niveau de preuve A publication, B publié par l'hôpital, C publié par l'éditeur])`);
  for (const c of CASES) L.push(casePackLine(c.id));

  L.push(`\n# Hôpital type en 3D (bâtiment principal main : étages -1 à 4, le 4e = qualité et JABB Twin ; annexe du siège annex : 0 à 3)`);
  for (const f of FLOORS) {
    const ds = DEPTS.filter((d) => d.building === f.building && d.floor === f.floor);
    L.push(`${f.building}:${f.floor} ${f.name} → ` + ds.map((d) => `${d.id} (${d.short}${d.cases.length ? " : " + d.cases.join(",") : " : soin humain, non touché"})`).join(" ; "));
  }
  L.push(`Expériences IA de l'accueil (select kind=xp ; leurs gains sont déjà comptés dans les cas liés, aucun chiffre propre) : ` + EXPERIENCES.map((x) => `${x.id} ${x.name} (${x.dept} ; ${x.cases.join(",")}) : ${x.what}`).join(" ; "));
  L.push(`Personnes : id "dept/role/index" ; rôles : ${Object.keys(ROLE_LABEL).join(", ")} (ex. admissions/admin/0, hospitalisation/infirmier/0).`);

  L.push(`\n# Gouvernance`);
  L.push(DATA.gouv.map((g) => `${g.name}${g.cadence ? ` (${g.cadence})` : ""} : ${g.role}`).join(" ; "));
  L.push(`Agentic Command Center (T-02, siège annex:3) : ${DATA.warroom.map((w) => `${w.name} — ${w.desc}`).join(" ; ")}`);
  L.push(`Confiance : ${DATA.confiance.map((c) => `${c.name} ${c.desc}`).join(" ; ")}. Données : N2 (paie, RH) modèles hébergés au Maroc ; N3 santé modèles locaux uniquement ; N3+ cloisonné, double validation.`);

  L.push(`\n# Risques (risque → parade)`);
  for (const r of DATA.risks) L.push(`${r.risque} [${r.impact}] → ${r.parade}`);

  L.push(`\n# Sources`);
  for (const s of DATA.sources) L.push(`${s.donnee} — ${s.source}`);

  L.push(`\n# Réseau Akdital`);
  L.push(`Périmètre du programme (302 MDH) : le Maroc uniquement, soit les ${GROUP.establishments} établissements en service et le siège. L'international n'est pas chiffré dans le modèle : le modèle prouvé au Maroc pourra ensuite s'y répliquer (ne jamais inventer de chiffres pour ces pays).`);
  if (CITIES.length) L.push(`Villes (slug : établissements en service) : ` + CITIES.map((c) => `${c.name} (${c.slug}) ${c.operational}`).join(" ; "));
  if (SITES.length) L.push(`Établissements (slug, ville, statut, lits) : ` + SITES.map((s) => `${s.name} (${s.slug}, ${s.city}, ${s.status}${s.opening_year && s.status !== "opérationnel" ? " " + s.opening_year : ""}${s.beds ? `, ${s.beds} lits` : ""})`).join(" ; "));
  if (INTERNATIONAL.length) L.push(`International (statuts réels, sourcés) : ${INTERNATIONAL.map((i) => `${i.country} · ${i.city} : ${i.project.slice(0, 110)} — ${i.status.slice(0, 120)}`).join(" ; ")}`);

  PACK = L.join("\n");
  return PACK;
}

// ---------------------------------------------------------------- tool results (detail on demand)

export function caseDetail(id: string): string {
  const c = CASE[id.toUpperCase()];
  if (!c) return `Cas ${id} introuvable. Cas existants : ${CASES.map((x) => x.id).join(", ")}.`;
  const site = c.id[0] === "S" || c.id[0] === "T" ? "siège, non divisé par établissement" : `${fr(c.etp / ETAB, 1)} ETP et ${fr((c.mdh / ETAB) * 1000, 0)} kMAD par établissement type`;
  return [
    `Cas ouvert à l'écran : ${caseLine(c.id)}`,
    `Verdict : ${verdict(c)}`,
    ...(() => {
      const r = refsFor(c.id);
      const out: string[] = [];
      out.push(r.measured.length
        ? `Déjà mesuré ailleurs (résultats MESURÉS, à citer avec l'organisation, l'année et la source) : ${r.measured.slice(0, 3).map(benchShort).join(" || ")}`
        : "Déjà mesuré ailleurs : AUCUN résultat mesuré pour ce cas. Le dire clairement ; ne rien présenter comme un résultat.");
      if (r.other.length) out.push(`Références NON mesurées (contexte seulement, jamais présentées comme un résultat) : ${r.other.slice(0, 2).map((b) => `${b.who} — ${firstClause(b.result, 90)} [${b.level}]`).join(" || ")}`);
      if (c.proof?.lecture_akdital) out.push(`Lecture pour Akdital : ${c.proof.lecture_akdital}`);
      if (c.value_out) out.push(`Valeur hors masse salariale (indicative, non additive aux 302 MDH) : ${c.value_out}`);
      if (c.solutions?.length) out.push(`Solutions : ${c.solutions.join(", ")}`);
      return out;
    })(),
    c.mdh ? `Par établissement : ${site}. Gain net groupe ${r1(c.net)} MDH/an.` : "",
    `Aujourd'hui : ${c.aujourdhui}`,
    `Avec l'agent : ${c.solution}`,
    `Validation humaine : ${c.validation_humaine}`,
    `Garde-fous : ${c.garde_fous}`,
    `Métier libéré : ${c.metier_libere}. Porteur : ${c.porteur}. Sensibilité données : ${c.sensibilite}. Maturité : ${c.maturite}.`,
    `KPI : ${c.kpi.join(" ; ")}. Risque principal : ${c.risque_principal}`,
  ].filter(Boolean).join("\n");
}

export function deptDetail(id: string): string {
  const d = DEPT[id];
  if (!d) return `Service ${id} introuvable. Services : ${DEPTS.map((x) => x.id).join(", ")}.`;
  let mdh = 0, etp = 0, cout = 0;
  for (const c of d.cases) { mdh += CASE[c].mdh; etp += CASE[c].etp; cout += CASE[c].cout; }
  return [
    `Service ouvert à l'écran : ${d.name} (${floorName(d.building, d.floor)}).`,
    d.cases.length ? `Cas : ${d.cases.map((c) => caseLine(c)).join(" || ")}` : `Aucun cas : ${d.note ?? "le soin reste humain."}`,
    d.cases.length ? `Total service (groupe, plein régime) : ${r1(mdh)} MDH/an, ${r0(etp)} ETP, coût ${r1(cout)} MDH.` : "",
    `Personnel dessiné (illustratif) : ${d.staff.map((s) => `${s.n} ${s.label}`).join(", ")}.`,
    d.note ? `Note : ${d.note}` : "",
  ].filter(Boolean).join("\n");
}

export function floorDetail(key: string): string {
  const [b, f] = key.split(":");
  const ds = DEPTS.filter((d) => d.building === b && String(d.floor) === f);
  if (!ds.length) return `Étage ${key} introuvable.`;
  const ids = ds.flatMap((d) => d.cases);
  const mdh = ids.reduce((s, c) => s + CASE[c].mdh, 0);
  return `Étage ouvert : ${floorName(b, Number(f))}. Services : ${ds.map((d) => `${d.short} (${d.cases.join(",") || "soin humain"})`).join(" ; ")}. Total ${r1(mdh)} MDH/an au plein régime (groupe).`;
}

export function xpDetail(id: string): string {
  const x = XP[id];
  if (!x) return `Expérience ${id} introuvable. Expériences : ${EXPERIENCES.map((e) => e.id).join(", ")}.`;
  return `Expérience IA ouverte à l'écran : ${x.name} (${DEPT[x.dept]?.name ?? x.dept}). Ce qu'elle fait : ${x.what} Pour le patient : ${x.patient} Pour l'équipe : ${x.staff} Ses gains sont déjà comptés dans ${x.cases.map((c) => `${c} (${CASE[c]?.titre ?? ""})`).join(" et ")} : ne pas les additionner.`;
}

export function personDetail(id: string): string {
  const [dept, role] = id.split("/");
  const d = DEPT[dept];
  if (!d) return `Personne ${id} introuvable.`;
  const label = d.staff.find((s) => s.role === role)?.label ?? ROLE_LABEL[role as keyof typeof ROLE_LABEL] ?? role;
  const rel = d.cases.map((c) => `${c} ${CASE[c].titre}`).join(" ; ");
  return `Personne sélectionnée : ${label}, service ${d.name}. Cas qui la concernent : ${rel || "aucun, son métier reste inchangé"}. Ce qui change : l'agent prépare, elle vérifie et signe ; elle devient pilote de ses agents (académie T-04). Zéro licenciement : les postes libérés sont absorbés par les départs naturels non remplacés et la mobilité vers les ouvertures (T-05). Pour les soignants, le temps rendu retourne au patient.`;
}

export function sectionDetail(s: string): string {
  const m = META;
  switch (s) {
    case "synthese": return `Section Synthèse : ${m.eco} MDH d'économie, ${m.budget} MDH de coût des agents, ${m.net} MDH nets par an au plein régime, ROI ${fr(m.roi, 2)}, ${r0(m.postes)} ETP-éq., ${m.n_cases} cas, zéro licenciement.`;
    case "cas": return `Section Cas d'usage : les ${CASES.length} cas, par famille (${DATA.fams.map((f) => `${f.code} ${f.n}`).join(", ")}). Hors 302 MDH : X, C, R, I (valeur non additive) ; T : leviers.`;
    case "gouvernance": return `Section Gouvernance : ${DATA.gouv.map((g) => `${g.name} — ${g.role}`).join(" ; ")}.`;
    case "emplois": { const a = DATA.abs; return `Section Emplois : ${r0(a.postes_admin)} postes administratifs libérés, ≈ ${r0(a.departs_admin_an)} départs naturels par an, absorption en ≈ ${fr(a.annees_departs, 1)} ans, ${r0(a.postes_admin_ouvertures)} postes administratifs à pourvoir dans les ouvertures. Zéro licenciement.`; }
    case "deploiement": return `Section Déploiement : ${DATA.waves.map((w) => `${w.k} ${w.when} : ${w.what}`).join(" ; ")}.`;
    case "sources": return `Section Sources : ${DATA.sources.length} sources publiques et internes. ${m.flag_160}`;
    default: return "Retour à la vue 3D.";
  }
}

export function yearDetail(y: number): string {
  if (y === 2026) return "Année 2026 (aujourd'hui) : aucun agent en production, 0 MDH.";
  const r = DATA.ramp[String(y) as "2027"];
  if (!r) return `Année ${y} hors frise (2026-2029).`;
  return `Année ${y} : économie ${r1(r.eco)} MDH, coût des agents ${r1(r.cout)} MDH, gain net ${r1(r.net)} MDH, cumul net ${r1(r.cumul)} MDH.`;
}

export function levelDetail(l: string): string {
  if (l === "world") return "Vue monde : Akdital dans le monde.";
  if (l === "morocco") return `Vue Maroc : ${GROUP.establishments} établissements, ${r0(GROUP.beds)} lits, ${GROUP.cities} villes ; objectif 2028 : ${GROUP.target2028.establishments} établissements et ${r0(GROUP.target2028.beds)} lits.`;
  return `Vue hôpital type : groupe ÷ ${ETAB}. Le programme : ${META.eco} MDH, coût ${META.budget}, net ${META.net} MDH par an.`;
}
