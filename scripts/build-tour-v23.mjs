// Builds the two guided visits of the v2.3 dataset ("chiffres actualisés") as ONE STORY, from the data:
//   lib/ai/tour-v23-express.json   → "Visite express"  (≈ 4 min 30)
//   lib/ai/tour-v23-complete.json  → "Visite complète" (≈ 12 min)
// The spine: the same Tuesday, lived twice — in 2026 and in 2031 — in the typical Akdital hospital, through six fictional
// people (announced as such): Amina (patient), Youssef (admissions), Salma (nurse), Karim (biomedical technician, JABB Twin),
// Hicham (billing) and Leïla (social controlling, Agentic Command Center). Each value stream gets a human scene, a
// 2026 → 2031 before / after, and a figure; as it is told, its contribution flows into a value ledger that builds the
// client's own bridge live: ① savings (payroll + other opex) + ② margin on additional revenue − ③ programme cost = net.
// Every figure said or shown is computed HERE from lib/data/v23/*.json (+ published facts of lib/data/base.json): the
// ledger increments of a scene are the 2031 values of the use cases it tells (each case is told exactly once), so the
// increments add up, to the decimal, to the programme totals. Data checks below fail the build if anything drifts.
// Beat: text (captions), speech (said; units spelled out), actions (cursor ops + story cues {do:"cue"}), story0 (the
// story state at the start of the beat, so a chapter jump restores cast, props and ledger), lead (silent seconds first).
//   node scripts/build-tour-v23.mjs && node scripts/gen-narration.mjs --set v23 --uniform
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const FIN = rd("lib/data/v23/finance.json");
const V = rd("lib/data/v23/cases.json");
const base = rd("lib/data/base.json");
const BENCH = rd("lib/data/benchmarks.json");
const NETWORK = rd("lib/data/network.json");

// ---------------------------------------------------------------- data access + checks
const must = (cond, what) => { if (!cond) throw new Error("data check failed: " + what); };
const near = (a, b, eps = 0.06) => Math.abs(a - b) <= eps;
const G = Object.fromEntries(FIN.global.map((r) => [r.key, r]));
const y = (k, yr = "2031") => G[k].values[yr];
const HYP = Object.fromEntries(FIN.hypotheses.map((h) => [h.label, h]));
const TRAJ = FIN.trajectory;
const counted = Object.entries(V).filter(([, v]) => v.projections && !v.merged_into);
const typeCA = (id) => V[id].assumptions?.["Type de CA"] ?? null;
must(counted.length === 85, `85 cases counted in v2.3 (got ${counted.length})`);

/** 2031 contribution of a set of cases to the four gain lines of the ledger (+ its own agent cost, FTE). */
function sum(ids) {
  const s = { ms: 0, hms: 0, rec: 0, neu: 0, caR: 0, caN: 0, cost: 0, etp: 0 };
  for (const id of ids) {
    const v = V[id];
    must(v && v.projections && !v.merged_into, `case ${id} counted`);
    const w = v.v23;
    s.ms += w.ms ?? 0; s.hms += w.hms ?? 0; s.cost += w.cout ?? 0; s.etp += w.etp ?? 0;
    if (w.ca) {
      const t = typeCA(id);
      must(t === "R" || t === "N", `type of CA for ${id}`);
      if (t === "R") { s.rec += w.marge; s.caR += w.ca; } else { s.neu += w.marge; s.caN += w.ca; }
    }
  }
  s.eco = s.ms + s.hms; s.marge = s.rec + s.neu; s.gains = s.eco + s.marge;
  return s;
}

// each use case is told in exactly ONE scene: the ledger increments of the scenes add up to the programme
const STREAMS = {
  patient: ["A-01", "A-02", "A-04", "A-05", "A-06", "A-07", "A-15", "A-16", "A-17", "A-18", "X-01", "X-02", "X-03", "X-09", "X-10", "X-11", "R-06"],
  soin: ["P-01", "P-02", "P-03", "P-04", "P-05", "P-06", "P-07", "P-08", "X-06", "X-07", "X-08", "C-01", "C-02", "C-04", "H-01", "H-02", "H-03", "H-04", "A-20"],
  actifs: ["I-01", "I-02", "I-03", "I-04", "I-05", "I-06", "I-07", "I-08", "I-09", "I-11", "R-04", "R-05"],
  revenu: ["A-03", "A-08", "A-09", "A-10", "A-11", "A-12", "A-13", "A-14", "A-19", "R-01", "R-02"],
  ouvertures: ["S-16", "T-06", "I-10"],
  siege: ["S-01", "S-02", "S-03", "S-04", "S-05", "S-06", "S-07", "S-08", "S-09", "S-10", "S-11", "S-12", "S-13", "S-14", "S-15", "R-03"],
  leviers: ["T-01", "T-02", "T-03", "T-04", "T-05", "T-07", "T-08"],
};
const told = Object.values(STREAMS).flat();
must(new Set(told).size === told.length, "each case told once");
must(counted.every(([id]) => told.includes(id)), "every counted case told: " + counted.filter(([id]) => !told.includes(id)).map(([id]) => id).join(","));
const S = Object.fromEntries(Object.entries(STREAMS).map(([k, ids]) => [k, sum(ids)]));
const ALL = sum(told);
// the bridge of the v2.3 Synthèse (2031)
must(near(ALL.ms, y("ms")) && near(ALL.hms, y("hms")) && near(ALL.eco, y("eco")), "① savings = Σ cases");
must(near(ALL.caR, y("ca_recup")) && near(ALL.caN, y("ca_new")) && near(ALL.marge, y("marge")), "② margin = Σ cases");
must(near(ALL.rec, ALL.caR * HYP["Marge sur CA récupéré (type R)"].value, 0.1) && near(ALL.neu, ALL.caN * HYP["Marge contributive sur activité nouvelle (type N)"].value, 0.1), "margin rates 95 % / 40 %");
must(near(ALL.gains, y("gains")) && near(y("gains") - y("cout"), y("net")), "gains − cost = net");
must(near(ALL.cost + y("cout_transverse") + y("contingence"), y("cout")), "③ = cases + transverse + contingency");
must(near(ALL.etp, y("etp"), 0.5), "FTE");
must(near(G.net.cumul, 695.48, 0.01) && near(G.net.van, 466.3, 0.01) && near(y("net"), 276.33, 0.01), "headline 276 / 695 / 466");
must(G.net_cumul.values["2027"] < 0 && G.net_cumul.values["2028"] > 0, "cumul positive from 2028");
const ETAB = TRAJ["Établissements"].values, LITS = TRAJ["Lits"].values;
must(ETAB["2026"] === 45 && ETAB["2031"] === 65, "45 → 65 establishments");
const OUV = Object.entries(TRAJ["Ouvertures dans l'année"].values).filter(([k]) => k >= "2027").reduce((a, [, v]) => a + v, 0);
must(OUV === ETAB["2031"] - ETAB["2026"], "openings 2027-2031");
const DEPARTS = HYP["Départs par an (2026)"].value;
must(DEPARTS === 1896 && /19,5 %/.test(HYP["Départs par an (2026)"].note), "1 896 departures a year, turnover 19,5 %");
const LEVER = FIN.levers.find((l) => l.levers === "T-03+T-08");
must(LEVER && LEVER.cost < 10 && /CNDP/.test(LEVER.what), "registry lever");
// zero layoffs, as printed by the client (02 p.6, FIN.pdf_extra): posts not to replace, admin departures a year, years needed
const ZL = (FIN.pdf_extra || []).find((e) => e.kind === "kpi" && /Zéro licenciement/.test(e.title))?.values ?? {};
const zl = (k) => { const e = Object.entries(ZL).find(([key]) => key.startsWith(k)); return e ? String(e[1]) : ""; };
const POSTES = Number((zl("Postes administratifs à ne pas remplacer").match(/^\d[\d  ]*/) || ["0"])[0].replace(/[\s  ]/g, ""));
const DEP_ADM = Number((zl("Départs administratifs par an").match(/\d[\d  ]*/) || ["0"])[0].replace(/[\s  ]/g, ""));
const ANS = zl("Années de départs nécessaires");
must(POSTES === 497 && DEP_ADM === 458 && /1,1/.test(ANS) && POSTES / DEP_ADM > 1 && POSTES / DEP_ADM < 1.2, "zero layoffs: 497 posts, ≈ 458 departures a year, ≈ 1,1 year");
const P = base.meta.pub;
const sq = (x) => String(x).replace(/[\s  ]/g, "");
must(sq(P.pub_ms_growth) === "+28,1%" && sq(P.pub_ca_growth) === "+21%" && sq(P.pub_ratio_s1_26) === "22,5%", "published S1 2026 facts");
const W1 = base.waves.find((w) => w.k === "V1");
const W1n = counted.filter(([, v]) => v.catalogue["Vague"] === "V1").length;
must(W1 && /mi-déc/.test(W1.when) && W1n === 15, "wave 1: 15 cases from mid-December");
// case texts the story relies on (so the narration never says what the dossier does not)
const txt = (id) => `${V[id].catalogue["Titre"]} ${V[id].catalogue["Avec les agents"]}`;
must(/18 secondes/.test(txt("X-08")) && /sans reconnaître personne/.test(txt("X-08")), "X-08: 18 s, nobody recognised");
must(/dix jours avant l'arrêt/.test(txt("I-03")), "I-03: ten days before");
// H-01 (express, Salma's night): Keeps sees the cleaning cart leave the freed room, the twin moves the bed to « prêt »
must(/chariot arriver devant la chambre puis repartir/.test(txt("H-01")) && /statut du lit avance sans appel/.test(txt("H-01")), "H-01: cart seen, bed status without a call");
must(/chariot/.test(V["H-01"].catalogue["Keeps (vision IA)"]) && /jamais de personne/.test(V["H-01"].catalogue["Keeps (vision IA)"]), "H-01: Keeps sees a cart, never a person");
must(/Statut du lit/.test(V["H-01"].catalogue["JABB Twin (jumeau numérique)"]), "H-01: bed status held by the twin");
must(/lit prêt 47 min plus tôt/.test(V["H-01"].v23.hypothese), "H-01: bed ready 47 min earlier (115 → 68)");
must(/bloc en veille la nuit/.test(txt("I-07")) && /journée-patient/.test(txt("I-07")), "I-07: energy per patient-day");
must(/pousse-seringue/.test(txt("I-02")) && /3 secondes/.test(txt("I-02")), "I-02: syringe pump in 3 s");
must(/Octobre Rose/.test(txt("X-11")) && /deux minutes/.test(txt("R-06")), "X-11 / R-06");
must(/pré-clôture/.test(txt("A-11")) && /pose/.test(txt("R-02")), "A-11 / R-02");
must(/darija/.test(txt("A-06")) && /J-7|J-2/.test(V["A-01"].catalogue["Avec les agents"] + V["A-01"].catalogue["Titre"]), "A-06 / A-01");
// measured references said in plain words (no source, journal or year): measured, level A or B
const proof = (id, whoFrag, resultFrag) => {
  const b = BENCH.find((x) => x.measured && /^[AB]/.test(x.level) && (x.v13.includes(id) || x.app.includes(id)) && x.who.includes(whoFrag) && x.result.includes(resultFrag));
  must(b, `measured reference for ${id} (${whoFrag})`);
  return b;
};
proof("A-06", "Rothschild", "75 %");
proof("A-07", "BIDMC", "29,2 % → 22,8 %");
proof("H-01", "MD Anderson", "115 → 68");
proof("I-04", "chinois", "4,8 % contre 7,3 %");
proof("A-11", "Auburn", "−50 %");
proof("S-08", "Jabarian", "+18 %");
const intl = (NETWORK.international || NETWORK.INTERNATIONAL || []).map((i) => `${i.country} ${i.city} ${i.status}`).join(" ");
must(/Riyad|Riyadh/.test(intl) && /Duba/.test(intl), "international presence (network.json)");

// ---------------------------------------------------------------- numbers, French
const NB = " ";
const grp = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, NB);
const fr = (x, d = 0) => { const s = Math.abs(x).toFixed(d).split("."); s[0] = grp(s[0]); return (x < 0 ? "−" : "") + s.join(","); };
const i0 = (x) => fr(Math.round(x), 0);                  // 276
const m1 = (x) => fr(Math.round(x * 10) / 10, 1);        // 276,3
/** Rounds parts so that they add up to the rounded total (largest remainder). */
function parts(total, xs) {
  const T = Math.round(total);
  const fl = xs.map(Math.floor);
  let left = T - fl.reduce((a, b) => a + b, 0);
  const order = xs.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (left <= 0) break; fl[i]++; left--; }
  return { total: T, parts: fl.map((v) => fr(v, 0)) };
}
const ratioSaid = (r) => { const d = Math.floor(r), c = Math.round((r - d) * 100); return `${d} dirhams ${c}`; };
const ratioText = (r) => `${fr(r, 2)} dirhams`;

const F = {
  eco: i0(y("eco")), ms: i0(y("ms")), hms: i0(y("hms")), caR: i0(y("ca_recup")), caN: i0(y("ca_new")), ca: i0(y("ca")),
  rec: i0(ALL.rec), neu: i0(ALL.neu), marge: i0(y("marge")), gains: i0(y("gains")), cout: i0(y("cout")), net: i0(y("net")),
  cumul: i0(G.net.cumul), van: i0(G.net.van), etp: fr(Math.round(y("etp") / 10) * 10, 0),
  y27: i0(Math.abs(y("net", "2027"))), y28: i0(y("net", "2028")), y29: i0(y("net", "2029")), y30: i0(y("net", "2030")), y31: i0(y("net", "2031")),
  departs: fr(Math.round(DEPARTS / 100) * 100, 0), ouv: String(OUV), lever: i0(LEVER.lostCumul), lits31: fr(LITS["2031"], 0),
};
must(F.etp === "1 680" && F.departs === "1 900", "rounded FTE / departures");
// "près de 75": the new-activity margin said so that recovered + new adds up, to the ear, to the rounded total (84 + 75 = 159)
F.neu75 = i0(Math.ceil(ALL.neu));
must(Math.round(ALL.rec) + Math.ceil(ALL.neu) === Math.round(y("marge")) && ALL.neu > Math.ceil(ALL.neu) - 0.6, "84 + près de 75 = 159");
// the Command Center reads the bridge to the decimal, so that every addition said aloud is exact
const D = { eco: m1(y("eco")), ms: m1(y("ms")), marge: m1(y("marge")), gains: m1(y("gains")), cout: m1(y("cout")), net: m1(y("net")) };
must(near(Number(D.eco.replace(",", ".")) + Number(D.marge.replace(",", ".")), Number(D.gains.replace(",", ".")), 0.051) && near(Number(D.gains.replace(",", ".")) - Number(D.cout.replace(",", ".")), Number(D.net.replace(",", ".")), 0.051), "1-decimal bridge adds up");
const half = (x) => { const r = Math.round(x * 2) / 2; return Number.isInteger(r) ? `${fr(r, 0)} millions` : `${fr(Math.floor(r), 0)} millions et demi`; };
const SP = {
  patient: parts(S.patient.gains, [S.patient.eco, S.patient.neu]),
  actifs: parts(S.actifs.gains, [S.actifs.hms, S.actifs.neu]),
};

// ---------------------------------------------------------------- caption → speech
const say = (s) => s
  .replace(/(\d)\s?MDH\b/g, "$1 millions de dirhams")
  .replace(/\bMDH\b/g, "millions de dirhams")
  .replace(/22,5 %/g, "22 et demi pour cent")
  .replace(/JABB × AKDITAL × mibtech/g, "Jabb, Akdital et Mibtech")
  .replace(/\bJABB\b/g, "Jabb")
  .replace(/−(\d)/g, "moins $1")
  .replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- beats, cues, markers
// Markers ‹a› ‹b› … in a text anchor cues to that point of the narration (fraction of the spoken characters).
const MARK = /‹([a-z0-9]+)›/g;
const C = (o) => ({ do: "cue", ...o });
const op = {
  section: (section) => ({ do: "section", section, silent: true }),
  year: (year) => ({ do: "year", year, silent: true }),
  view: () => ({ do: "view", perSite: false, silent: true }),
  zoom: (g) => ({ do: "zoom", g }),
  point: (anchor) => ({ do: "point", anchor }),
  caseOpen: (id) => ({ do: "case", id }),
};
/**
 * beat(id, title, text, cues, o)
 *   cues: [{ ...cue, mark: "a" }]  → placed where ‹a› is said;  { ...cue, at: 0.3 } → fraction;  { pre: true } → before the lead
 *   o.speech: spoken text override (same markers);  o.lead: silent seconds before the voice
 */
function beat(id, title, text, cues = [], o = {}) {
  const spokenRaw = o.speech ?? say(text);
  const marks = {};
  let clean = "";
  let last = 0;
  for (const m of spokenRaw.matchAll(MARK)) { clean += spokenRaw.slice(last, m.index); marks[m[1]] = clean.length; last = m.index + m[0].length; }
  clean += spokenRaw.slice(last);
  const speech = clean.replace(/\s+/g, " ").trim();
  const L = speech.length || 1;
  const actions = cues.map((c) => {
    const { mark, ...rest } = c;
    if (mark !== undefined) { must(mark in marks, `marker ‹${mark}› in ${id}`); return { ...rest, at: Math.max(0.001, Math.round((marks[mark] / L) * 1000) / 1000) }; }
    return rest;
  });
  const b = { id, title, text: text.replace(MARK, "").replace(/\s+/g, " ").trim(), speech, actions };
  if (o.lead) b.lead = o.lead;
  return b;
}

// story vocabulary (components/scenes/story/spots.ts and lib/ai/story.ts share these ids)
const sel = (kind, id) => C({ sel: { kind, id } });
const cam = (shot) => C({ cam: shot });
const cast = (o) => C({ cast: o });
const props = (o) => C({ props: o });
const stamp = (t, yr) => C({ stamp: { t, year: yr } });
const chip = (...ids) => C({ chip: ids });
/** a scene's contribution flows into the ledger (from a character or a spot) */
const flow = (stream, from) => {
  const s = S[stream];
  const r = (x) => Math.round(x * 1e4) / 1e4;
  return C({ ledger: { ms: r(s.ms), hms: r(s.hms), rec: r(s.rec), neu: r(s.neu), from, stream } });
};

const OPEN_PRE = [
  { do: "section", section: "explorer", silent: true, pre: true },
  { do: "view", perSite: false, silent: true, pre: true },
  { do: "year", year: 2026, silent: true, pre: true },
  C({ pre: true, reset: true, fade: 1, letterbox: true, title: true, sfx: "title", sel: { kind: "overview", id: "hospital" } }),
  C({ pre: true, cam: "sky" }),
  C({ pre: true, fade: 0, delay: 0.6 }),
  C({ pre: true, cam: "glide", delay: 1.4 }),
];

// ================================================================ VISITE COMPLÈTE
const complete = { version: 23, dataset: "v23", mode: "complete", chapters: [] };
const X = complete.chapters;

X.push({ id: "ouverture", title: "Le même mardi", beats: [
  beat("o-titre", "Le même mardi",
    `Casablanca, un mardi d'octobre, sept heures et demie. Le jour se lève sur l'hôpital type d'Akdital : tout le groupe, ramené à un seul bâtiment. ‹a›Nous allons vivre ce mardi deux fois. Une fois aujourd'hui, en 2026. Une fois cinq ans plus tard, en 2031, quand chaque collaborateur sera devenu le pilote d'une escouade d'agents IA.`,
    [...OPEN_PRE, { ...C({ title: false }), mark: "a" }, { ...stamp("Mardi · 7 h 30", 2026), mark: "a" }],
    { lead: 6.5 }),
  beat("o-cast", "Six personnes",
    `Six personnes vont nous guider. ‹a›Amina, cinquante-quatre ans, attend une prothèse du genou. ‹b›Youssef, chargé d'admission au rez-de-chaussée. ‹c›Salma, infirmière au troisième étage. ‹d›Karim, technicien biomédical, qui veille sur les machines. ‹e›Hicham, facturier, qui transforme les soins en recettes. ‹f›Et Leïla, au siège, qui tient les comptes de la masse salariale. ‹g›Ils sont fictifs ; les chiffres, eux, sont ceux du business case actualisé, cas par cas.`,
    [cam("cast"),
      { ...C({ intro: "amina", cast: { amina: { at: "fc-1" } } }), mark: "a" },
      { ...C({ intro: "youssef", cast: { youssef: { at: "fc-2" } } }), mark: "b" },
      { ...C({ intro: "salma", cast: { salma: { at: "fc-3" } } }), mark: "c" },
      { ...C({ intro: "karim", cast: { karim: { at: "fc-4" } } }), mark: "d" },
      { ...C({ intro: "hicham", cast: { hicham: { at: "fc-5" } } }), mark: "e" },
      { ...C({ intro: "leila", cast: { leila: { at: "fc-6" } } }), mark: "f" },
      { ...C({ letterbox: false }), mark: "g" }]),
] });

X.push({ id: "constat", title: "2026 : la pression", beats: [
  beat("c-constat", "Personne ne décroche",
    `Sept heures trente-deux. ‹a›Au standard, le téléphone sonne, et personne ne décroche : toutes les lignes sont prises. Au bout du fil, Amina raccrochera, et rappellera. ‹b›Ce n'est la faute de personne. Au premier semestre 2026, les charges de personnel du groupe ont progressé de 28 %, le chiffre d'affaires de 21 % ; elles pèsent désormais 22,5 % des ventes. Chaque clinique qui ouvre ajoute des guichets, des saisies, des appels. ‹c›Rejouons ce même mardi, en 2031.`,
    [C({ cast: { amina: null, youssef: null, salma: null, karim: null, hicham: null, leila: null } }), op.year(2026), sel("dept", "standard"),
      props({ calls: "before" }), stamp("Mardi · 7 h 32", 2026), { ...cam("standard"), mark: "a" }]),
] });

X.push({ id: "patient", title: "Amina : l'attente qui disparaît", beats: [
  beat("c-amina-appel", "L'appel",
    `‹a›2031, même mardi, même heure. Amina appelle ; un agent vocal décroche, en darija, en français ou en arabe, et lui propose un créneau. À Paris, une fondation hospitalière traite déjà ainsi plus de trois appels sur quatre sans personnel. ‹b›Sept jours avant l'opération, Rafiq, son compagnon sur WhatsApp, lui envoie les consignes et recueille ses pièces ; la veille, il confirme. Et quand un patient annule, le créneau est aussitôt proposé au suivant : dans un essai randomisé, ces rappels ciblés ont fait passer les absences de 29 à 23 %.`,
    [sel("dept", "standard"), cam("standard"), op.year(2026), props({ calls: "before" }),
      { ...op.year(2031), mark: "a" }, { ...props({ calls: "after" }), mark: "a" }, { ...stamp("Mardi · 7 h 32", 2031), mark: "a" }]),
  beat("c-amina-hall", "L'arrivée",
    `‹a›Le jour venu, Amina pousse la porte du hall. Les Expériences IA l'accueillent et l'orientent, en darija s'il le faut. ‹b›Pas de file : son dossier est complet depuis l'avant-veille. ‹c›Au guichet, Youssef ne ressaisit plus rien ; il vérifie, repère un doublon éventuel, et fait signer. ‹d›Aux urgences, la salle d'attente ne se fait plus oublier : quand l'attente s'allonge, Keeps le voit, sans identité, et l'infirmière d'accueil est prévenue.`,
    [op.year(2031), sel("dept", "accueil"), stamp("Mardi · 9 h 10", 2031), props({ queue: "before", ydesk: "after", calls: "off" }),
      cast({ amina: { at: "hall-plan", from: "door-in" }, youssef: { at: "adm-pilot", pose: "tablet" } }), cam("hall"), chip("amina"),
      { ...cam("admissions"), mark: "b" }, { ...props({ queue: "after" }), mark: "b" },
      { ...cast({ amina: { at: "adm-front" } }), mark: "b" },
      { ...chip("youssef"), mark: "c" },
      { ...C({ alert: "urg-wait" }), mark: "d" }]),
  beat("c-amina-valeur", "Ce que le parcours rapporte",
    `Ce parcours sans attente n'est pas qu'un confort. Les rappels, la liste d'attente, les médecins de ville qui adressent un patient en deux minutes, les campagnes de dépistage proposées par Rafiq, comme Octobre Rose : autant de patients qui viennent, et qui reviennent. ‹a›En 2031, le parcours d'Amina rapporte ${SP.patient.total} MDH par an : ${SP.patient.parts[0]} d'économies au téléphone, au guichet et au secrétariat, et ${SP.patient.parts[1]} de marge sur l'activité qu'il ramène.`,
    [op.year(2031), sel("dept", "admissions"), cam("admissions"), props({ queue: "after", ydesk: "after" }),
      cast({ amina: { at: "adm-front" }, youssef: { at: "adm-pilot", pose: "tablet" } }),
      { ...C({ hud: true }), mark: "a" }, { ...flow("patient", "amina"), mark: "a" }],
    { speech: say(`Ce parcours sans attente n'est pas qu'un confort. Les rappels, la liste d'attente, les médecins de ville qui adressent un patient en deux minutes, les campagnes de dépistage proposées par Rafiq, comme Octobre Rose : autant de patients qui viennent, et qui reviennent. ‹a›En 2031, le parcours d'Amina rapporte ${SP.patient.total} MDH par an : ${SP.patient.parts[0]} millions d'économies au téléphone, au guichet et au secrétariat, et ${SP.patient.parts[1]} millions de marge sur l'activité qu'il ramène.`) }),
] });

X.push({ id: "soin", title: "Salma : la nuit au troisième étage", beats: [
  beat("c-salma-avant", "2026, la fin de garde",
    `‹a›Troisième étage, en 2026. À la fin de sa garde, Salma ressaisit au poste ce qu'elle a noté sur papier, au lieu d'être auprès de ses patients. À la relève, il faut tout reconstituer, d'écran en écran. ‹b›Et la nuit, une chute dans le couloir n'est découverte qu'au tour suivant.`,
    [cast({ amina: null, youssef: null }), C({ night: 0.12 }), op.year(2026), sel("dept", "hospitalisation"), stamp("Mardi · 23 h 40", 2026),
      props({ npaper: "before", queue: "off", ydesk: "off" }), cast({ salma: { at: "nurse-station", pose: "type" } }), cam("station"), chip("salma"),
      { ...C({ alert: "corridor-fall", dim: true }), mark: "b" }, { ...props({ fall: "before" }), mark: "b" }]),
  beat("c-salma-apres", "2031, au lit d'Amina",
    `‹a›2031. Salma dicte son dossier de soins au chevet d'Amina, opérée dans l'après-midi ; l'agent prépare la relève, elle la complète. Les demandes non médicales ne passent plus par elle. ‹b›Cette nuit, une patiente glisse dans le couloir : Keeps le voit sur la caméra existante, sans reconnaître personne, et Salma est prévenue en dix-huit secondes. ‹c›Elle décide ; l'agent consigne. Le temps de soin, lui, ne bouge pas : c'est le temps de la paperasse qui revient au patient.`,
    [sel("dept", "hospitalisation"), op.year(2026), props({ npaper: "before", fall: "off" }), cast({ salma: { at: "nurse-station", pose: "type" } }),
      { ...op.year(2031), mark: "a" }, { ...stamp("Mardi · 23 h 40", 2031), mark: "a" }, { ...props({ npaper: "after" }), mark: "a" },
      { ...cast({ amina: { at: "room-chair", pose: "sit" }, salma: { at: "room-bedside", from: "nurse-station", via: ["corr-e", "room-door", "room-in"], pose: "tablet" } }), mark: "a" },
      { ...cam("room"), mark: "a" },
      { ...C({ alert: "corridor-fall" }), mark: "b" }, { ...props({ fall: "after" }), mark: "b" },
      { ...cast({ salma: { at: "corridor-fall-help", from: "room-bedside", via: ["room-in", "room-door"], pose: "kneel" } }), mark: "b" },
      { ...cam("corridor"), mark: "b" }]),
  beat("c-salma-valeur", "Ce que la qualité rapporte",
    `Autour d'elle, tout s'enchaîne. La sortie d'un patient déclenche le bionettoyage, sans un seul appel : dans un grand centre américain, la chambre est prête en 68 minutes au lieu de 115. L'hygiène est suivie chaque jour, l'accréditation tenue en continu, et une absence imprévue est comblée par la réserve interne plutôt que par l'intérim. ‹a›Qualité et sécurité pèsent ${i0(S.soin.gains)} MDH par an : du temps soignant rendu, des heures supplémentaires et de l'intérim évités, du linge et des repas au plus juste, et des lits prêts plus tôt.`,
    [op.year(2031), sel("dept", "hospitalisation"), cam("room"), props({ npaper: "after", fall: "off" }),
      cast({ amina: { at: "room-chair", pose: "sit" }, salma: { at: "room-bedside", from: "corridor-fall-help", via: ["room-door", "room-in"], pose: "tablet" } }),
      { ...C({ hud: true }), mark: "a" }, { ...flow("soin", "salma"), mark: "a" }]),
] });

X.push({ id: "actifs", title: "Karim et le jumeau", beats: [
  beat("c-karim-avant", "2026, la panne",
    `‹a›Quatrième étage, en 2026. Karim, technicien biomédical, court après les pannes. La maintenance suit le calendrier, avec du retard ; ‹b›un groupe froid tombe sans prévenir ; un pousse-seringue introuvable se cherche d'étage en étage ; et la ventilation du bloc tourne toute la nuit, salle vide.`,
    [cast({ amina: null, salma: null }), C({ night: null }), op.year(2026), sel("dept", "technique"), stamp("Mardi · 14 h 05", 2026),
      props({ npaper: "off", fall: "off", machine: "before" }), cast({ karim: { at: "machine-fix", pose: "kneel" } }), cam("machine"), chip("karim"),
      { ...C({ alert: "machine" }), mark: "b" }]),
  beat("c-karim-apres", "2031, la salle du JABB Twin",
    `‹a›2031, la salle de contrôle du JABB Twin. Le jumeau numérique a appris la signature de chaque machine : il voit la dérive dix jours avant l'arrêt, crée l'ordre de travail, et prépare la tournée de Karim. ‹b›Dans un hôpital universitaire chinois, cette maintenance priorisée coûte un tiers de moins. ‹c›Le pousse-seringue libre est localisé en trois secondes ; la chaîne du froid et l'oxygène sont surveillés en continu ; et l'énergie de chaque journée-patient est comparée entre les sites, bloc en veille la nuit.`,
    [sel("dept", "technique"), op.year(2026), props({ machine: "before" }), cast({ karim: { at: "machine-fix", pose: "kneel" } }),
      { ...op.year(2031), mark: "a" }, { ...stamp("Mardi · 14 h 05", 2031), mark: "a" }, { ...props({ machine: "after" }), mark: "a" },
      { ...cast({ karim: { at: "twin-console", from: "machine-fix", via: ["tech-mid"], pose: "tablet" } }), mark: "a" }, { ...cam("twin"), mark: "a" },
      { ...C({ ping: "pump" }), mark: "c" }]),
  beat("c-karim-valeur", "Ce que les actifs rapportent",
    `Des IRM, des scanners et des salles de bloc réellement disponibles, ce sont aussi des examens et des opérations en plus. ‹a›Les actifs et l'énergie rapportent ainsi ${i0(S.actifs.gains)} MDH par an : pour l'essentiel, de l'énergie, de la maintenance, des équipements et des stocks économisés ; et ${i0(S.actifs.neu)} MDH de marge sur l'activité rendue possible.`,
    [op.year(2031), sel("dept", "technique"), cam("twin"), props({ machine: "after" }), cast({ karim: { at: "twin-console", pose: "tablet" } }),
      { ...C({ hud: true }), mark: "a" }, { ...flow("actifs", "karim"), mark: "a" }],
    { speech: say(`Des IRM, des scanners et des salles de bloc réellement disponibles, ce sont aussi des examens et des opérations en plus. ‹a›Les actifs et l'énergie rapportent ainsi ${i0(S.actifs.gains)} MDH par an : pour l'essentiel, de l'énergie, de la maintenance, des équipements et des stocks économisés ; et ${i0(S.actifs.neu)} millions de marge sur l'activité rendue possible.`) }),
] });

X.push({ id: "revenu", title: "Hicham : les soins enfin facturés", beats: [
  beat("c-hicham", "La facture d'Amina",
    `‹a›Premier étage, la facturation. En 2026, Hicham clôture les dossiers après la sortie, quand tout est déjà loin : une pièce manque, un accord est incomplet, un implant posé au bloc n'est pas facturé, et la mutuelle rejette. ‹b›En 2031, la facture d'Amina est pré-clôturée avant sa sortie : l'agent a réclamé la pièce manquante, préparé un dossier complet pour le codeur, tracé sa prothèse de la pose à la facture, et prévenu le rejet avant l'envoi. ‹c›Dans un hôpital américain, les factures bloquées après la sortie ont été divisées par deux.`,
    [cast({ karim: null }), op.year(2026), sel("dept", "facturation"), stamp("Mardi · 16 h 20", 2026),
      props({ machine: "off", invoices: "before" }), cast({ hicham: { at: "billing-desk", pose: "type" } }), cam("billing"), chip("hicham"),
      { ...op.year(2031), mark: "b" }, { ...stamp("Mardi · 16 h 20", 2031), mark: "b" }, { ...props({ invoices: "after" }), mark: "b" },
      { ...cast({ hicham: { at: "billing-stand", from: "billing-desk", pose: "tablet" } }), mark: "b" }]),
  beat("c-hicham-valeur", "Le revenu retrouvé",
    `‹a›Ce sont des soins déjà réalisés, qui n'étaient pas facturés, ou qui étaient rejetés : ${F.caR} MDH par an en 2031. Les récupérer ne coûte presque rien ; leur marge, ${F.rec} MDH, entre presque entière dans la valeur. ‹b›Avec le temps rendu aux équipes de facturation et de prise en charge, ce chapitre pèse ${i0(S.revenu.gains)} MDH par an.`,
    [op.year(2031), sel("dept", "facturation"), cam("billing"), props({ invoices: "after" }), cast({ hicham: { at: "billing-stand", pose: "tablet" } }),
      { ...C({ hud: true }), mark: "a" }, { ...flow("revenu", "hicham"), mark: "a" }],
    { speech: say(`‹a›Ce sont des soins déjà réalisés, qui n'étaient pas facturés, ou qui étaient rejetés : ${F.caR} MDH par an en 2031. Les récupérer ne coûte presque rien ; leur marge, ${F.rec} millions, entre presque entière dans la valeur. ‹b›Avec le temps rendu aux équipes de facturation et de prise en charge, ce chapitre pèse ${i0(S.revenu.gains)} MDH par an.`) }),
] });

X.push({ id: "nouveau", title: "Ce que tout cela ramène", beats: [
  beat("c-nouveau", "L'activité nouvelle",
    `Additionnons ce que l'expérience, la qualité et les équipements ramènent : des patients qui viennent à leur rendez-vous, des médecins qui adressent, des lits et des IRM disponibles plus tôt, ‹a›et des cliniques qui ouvrent « augmentées par défaut », de ${ETAB["2026"]} aujourd'hui à ${ETAB["2031"]} en 2031. ‹b›Cette activité nouvelle représente ${F.caN} MDH de chiffre d'affaires en 2031. ‹c›Mais nous ne comptons que sa marge : près de ${F.neu75} MDH. Avec les soins récupérés, la marge sur le chiffre d'affaires additionnel atteint ${F.marge} MDH par an.`,
    [cast({ hicham: null }), props({ invoices: "off" }), op.year(2031), sel("overview", "hospital"), cam("campus"), stamp("Le groupe Akdital", 2031),
      { ...C({ hud: true }), mark: "c" }, { ...flow("ouvertures", "spot:campus"), mark: "c" }],
    { speech: say(`Additionnons ce que l'expérience, la qualité et les équipements ramènent : des patients qui viennent à leur rendez-vous, des médecins qui adressent, des lits et des IRM disponibles plus tôt, ‹a›et des cliniques qui ouvrent « augmentées par défaut », de ${ETAB["2026"]} aujourd'hui à ${ETAB["2031"]} en 2031. ‹b›Cette activité nouvelle représente ${F.caN} MDH de chiffre d'affaires en 2031. ‹c›Mais nous ne comptons que sa marge : près de ${F.neu75} millions. Avec les soins récupérés, la marge sur le chiffre d'affaires additionnel atteint ${F.marge} millions de dirhams par an.`) }),
] });

const YOUSSEF_YEARS = (marks) => marks.map(([yr, m]) => ({ ...op.year(yr), mark: m }));
X.push({ id: "temps", title: "Youssef, cinq ans après", beats: [
  beat("c-youssef", "Le temps qui passe",
    `Revenons au guichet de Youssef, et faisons défiler les années. ‹a›2026 : il ressaisit toute la journée. ‹b›2027 : ses premiers agents arrivent ; il vérifie au lieu de taper. ‹c›2028 : il sort de l'académie des pilotes d'agents. ‹d›2029 : une collègue part à la retraite ; son poste n'est pas remplacé. ‹e›2030 : un autre rejoint une clinique qui ouvre. ‹f›2031 : Youssef pilote son escouade, et forme les pilotes des nouvelles cliniques.`,
    [op.year(2026), sel("dept", "admissions"), cam("admissions-wide"), stamp("Guichet des admissions", 2026), props({ queue: "before", ydesk: "before" }),
      cast({ youssef: { at: "adm-desk", pose: "type" }, amina: null }), chip("youssef"),
      ...YOUSSEF_YEARS([[2027, "b"], [2028, "c"], [2029, "d"], [2030, "e"], [2031, "f"]]),
      { ...stamp("Guichet des admissions", 2027), mark: "b" }, { ...props({ ydesk: "mid" }), mark: "b" }, { ...props({ queue: "after" }), mark: "c" },
      { ...stamp("Guichet des admissions", 2028), mark: "c" }, { ...stamp("Guichet des admissions", 2029), mark: "d" }, { ...stamp("Guichet des admissions", 2030), mark: "e" }, { ...stamp("Guichet des admissions", 2031), mark: "f" },
      { ...props({ ydesk: "after" }), mark: "f" }, { ...cast({ youssef: { at: "adm-pilot", from: "adm-desk", pose: "tablet" } }), mark: "f" }]),
  beat("c-siege", "Le siège",
    `‹a›Le même mouvement traverse le siège. À la finance, chaque facture fournisseur est contrôlée par l'agent, la banque rapprochée chaque jour, les créances relancées sans relâche ; aux achats, les appels d'offres se font en jours ; aux ressources humaines, la paie est vérifiée avant le calcul. ‹b›Le recrutement change aussi : sur près de 70 000 candidats, des entretiens vocaux par IA ont augmenté les embauches effectives de 18 %. ‹c›Le siège apporte ${i0(S.siege.gains)} MDH par an, dont plus de la moitié en achats et en trésorerie.`,
    [cast({ youssef: null }), props({ queue: "off", ydesk: "off" }), op.year(2031), sel("dept", "siege-finance"), cam("hq-finance"), stamp("Siège · 2031", 2031),
      { ...C({ hud: true }), mark: "c" }, { ...flow("siege", "spot:hq-finance"), mark: "c" }]),
  beat("c-emplois", "Zéro licenciement",
    `‹a›Le compte du temps rendu est maintenant complet : ${F.etp} équivalents temps plein libérés en 2031, soit ${D.ms} MDH de masse salariale par an. ‹b›Et pas un seul licenciement. Ramené au périmètre d'aujourd'hui, il s'agit de ne pas remplacer ${POSTES} postes administratifs ; or, environ ${DEP_ADM} personnes quittent ces fonctions chaque année, naturellement. Un peu plus d'un an de départs suffit. Le reste du temps rendu devient des recrutements évités dans les ${F.ouv} cliniques qui ouvrent d'ici 2031 ; et une bourse des transitions accompagne chaque mobilité. ‹c›Avec ${F.hms} MDH d'autres dépenses évitées, les économies atteignent ${F.eco} MDH par an.`,
    [op.year(2031), sel("dept", "admissions"), cam("admissions-wide"), props({ ydesk: "after" }), cast({ youssef: { at: "adm-pilot", pose: "tablet" } }),
      { ...C({ hud: true, focus: "ms" }), mark: "a" }, { ...C({ focus: "hms" }), mark: "c" }],
    { speech: say(`‹a›Le compte du temps rendu est maintenant complet : ${F.etp} équivalents temps plein libérés en 2031, soit ${half(y("ms"))} de dirhams de masse salariale par an. ‹b›Et pas un seul licenciement. Ramené au périmètre d'aujourd'hui, il s'agit de ne pas remplacer ${POSTES} postes administratifs ; or, environ ${DEP_ADM} personnes quittent ces fonctions chaque année, naturellement. Un peu plus d'un an de départs suffit. Le reste du temps rendu devient des recrutements évités dans les ${F.ouv} cliniques qui ouvrent d'ici 2031 ; et une bourse des transitions accompagne chaque mobilité. ‹c›Avec ${F.hms} millions d'autres dépenses évitées, les économies atteignent ${F.eco} millions de dirhams par an.`) }),
] });

X.push({ id: "compte", title: "Leïla fait le compte", beats: [
  beat("c-leila", "L'Agentic Command Center",
    `‹a›Au dernier étage du siège, l'Agentic Command Center. En 2026, Leïla rapprochait la paie et la finance sur des tableurs, et le comité décidait sur des chiffres tardifs. ‹b›En 2031, chaque tâche d'agent est journalisée ; la valeur passe de potentielle à constatée en paie, et le directeur financier signe le relevé chaque mois. ‹c›Ce matin, à sept heures, le rapport tombe. ‹d›Économies : ${D.eco} MDH. ‹e›Marge sur le chiffre d'affaires additionnel : ${D.marge} MDH. ‹f›Gains bruts : ${D.gains} MDH.`,
    [cast({ youssef: null }), props({ ydesk: "off" }), op.year(2026), sel("dept", "siege-pilotage"), cam("command"), stamp("Siège · 2026", 2026),
      props({ sheets: "before" }), cast({ leila: { at: "cmd-desk", pose: "type" } }), chip("leila"),
      { ...op.year(2031), mark: "b" }, { ...stamp("Mercredi · 7 h 00", 2031), mark: "b" }, { ...props({ sheets: "after" }), mark: "b" },
      { ...cast({ leila: { at: "cmd-screen", from: "cmd-desk", pose: "stand" } }), mark: "b" },
      { ...C({ hud: true, focus: "eco" }), mark: "d" }, { ...C({ focus: "marge" }), mark: "e" }, { ...C({ focus: "gains" }), mark: "f" }],
    { speech: say(`‹a›Au dernier étage du siège, l'Agentic Command Center. En 2026, Leïla rapprochait la paie et la finance sur des tableurs, et le comité décidait sur des chiffres tardifs. ‹b›En 2031, chaque tâche d'agent est journalisée ; la valeur passe de potentielle à constatée en paie, et le directeur financier signe le relevé chaque mois. ‹c›Ce matin, à sept heures, le rapport tombe. ‹d›Économies : ${D.eco} millions de dirhams. ‹e›Marge sur le chiffre d'affaires additionnel : ${D.marge}. ‹f›Gains bruts : ${D.gains} millions.`) }),
  beat("c-net", "La valeur nette",
    `‹a›Tout cela a un coût, et nous le déduisons entièrement : agents, plateformes, coûts transverses et contingence, ${D.cout} MDH par an en 2031. ‹b›Reste la valeur nette : ${D.net} millions de dirhams par an. ‹c›Chaque dirham investi en rapporte ${ratioText(y("ratio"))}.`,
    [op.year(2031), sel("dept", "siege-pilotage"), cam("command"), props({ sheets: "after" }), cast({ leila: { at: "cmd-screen", pose: "stand" } }),
      { ...C({ hud: true, cost: true, from: "leila" }), mark: "a" }, { ...C({ net: true, sfx: "finale" }), mark: "b" }],
    { speech: say(`‹a›Tout cela a un coût, et nous le déduisons entièrement : agents, plateformes, coûts transverses et contingence, ${D.cout} MDH par an en 2031. ‹b›Reste la valeur nette : ${D.net} millions de dirhams par an. ‹c›Chaque dirham investi en rapporte ${ratioSaid(y("ratio"))}.`) }),
  beat("c-courbe", "Année après année",
    `‹a›Le chemin, année après année. 2027 est une année d'investissement : −${F.y27} MDH. ‹b›Dès 2028, la valeur nette devient positive, et le cumul aussi. ‹c›Puis ${F.y29} MDH en 2029, ${F.y30} en 2030, ${F.y31} en 2031. ‹d›Sur cinq ans, ${F.cumul} MDH cumulés ; actualisés à 10 %, ${F.van} MDH. ‹e›Et le registre des agents, avec la salle de crise, coûte moins de 10 MDH : sans lui, aucun cas touchant des données de santé ne passerait la CNDP, et ${F.lever} MDH de valeur cumulée seraient perdus.`,
    [op.year(2031), sel("dept", "siege-pilotage"), cam("finale"), cast({ leila: { at: "cmd-screen", pose: "stand" } }),
      C({ hud: true, finale: "on" }), { ...C({ chart: 2027 }), mark: "a" }, { ...C({ chart: 2028 }), mark: "b" }, { ...C({ chart: 2031 }), mark: "c" }, { ...C({ chart: "cumul" }), mark: "d" }],
    { speech: say(`‹a›Le chemin, année après année. 2027 est une année d'investissement : moins ${F.y27} millions de dirhams. ‹b›Dès 2028, la valeur nette devient positive, et le cumul aussi. ‹c›Puis ${F.y29} millions en 2029, ${F.y30} en 2030, ${F.y31} en 2031. ‹d›Sur cinq ans, ${F.cumul} millions cumulés ; actualisés à 10 %, ${F.van} millions. ‹e›Et le registre des agents, avec la salle de crise, coûte moins de 10 millions : sans lui, aucun cas touchant des données de santé ne passerait la CNDP, et ${F.lever} millions de valeur cumulée seraient perdus.`) }),
] });

X.push({ id: "reseau", title: "Du bâtiment au monde", beats: [
  beat("c-casa", "Casablanca",
    `‹a›Prenons de la hauteur. Casablanca, la ville du siège. Le jumeau ne s'arrête pas aux murs de l'hôpital d'Amina : chaque clinique devient un nœud du programme.`,
    [cast({ leila: null }), props({ sheets: "off" }), C({ finale: "off", hud: true, stamp: null }), op.section("explorer"), { ...op.zoom(0.31), at: 0.04 }]),
  beat("c-maroc", "Le Maroc",
    `‹a›Le Maroc : ${ETAB["2026"]} établissements aujourd'hui, ${ETAB["2031"]} en 2031, et ${F.lits31} lits. Ce qui est prouvé dans une clinique se déploie dans toutes, vague après vague. C'est sur ce périmètre, et seulement celui-là, que portent les ${F.net} MDH.`,
    [{ ...op.zoom(0.62), at: 0.03 }]),
  beat("c-monde", "Au-delà",
    `‹a›Et au-delà. En Arabie saoudite, Riyad et La Mecque sont en service ; à Dubaï, un hôpital se construit. Le modèle prouvé au Maroc pourra s'y répliquer ; aucun dirham n'en est compté ici.`,
    [{ ...op.zoom(0.79), at: 0.03 }, { ...op.point("country:SA"), at: 0.3 }, { ...op.point("country:AE"), at: 0.62 }]),
] });

X.push({ id: "decision", title: "La décision", beats: [
  beat("c-decision", "La décision",
    `‹a›Le chemin commence petit : une clinique et le siège, sans contact patient, dès la mi-décembre ; quinze cas, mesurés chaque mois. Aucune vague ne s'élargit sur une promesse, seulement sur une économie constatée. ‹b›La décision qui vous revient aujourd'hui : lancer le cadrage en novembre. Deux semaines d'ateliers, deux semaines de mesure du point zéro. ‹c›Pour qu'en 2031, Amina n'attende plus au bout du fil, que Salma garde son temps pour ses patients, et que Youssef pilote, au lieu de ressaisir.`,
    [C({ hud: false }), { ...op.point("stage"), at: 0.3 }]),
  beat("c-ligne", "JABB × AKDITAL × mibtech",
    `‹a›Et la Terre devient la goutte du logo Akdital. JABB × AKDITAL × mibtech, ensemble : ${F.net} MDH de valeur nette par an, sans un seul licenciement.`,
    [{ ...op.zoom(1), at: 0.02 }, { ...C({ letterbox: true, closing: true }), at: 0.45 }]),
] });

// ================================================================ VISITE EXPRESS
const express = { version: 23, dataset: "v23", mode: "express", chapters: [] };
const E = express.chapters;

E.push({ id: "ouverture", title: "Le même mardi", beats: [
  beat("x-titre", "Le même mardi",
    `Casablanca, un mardi d'octobre, sept heures et demie. ‹a›Nous allons vivre ce mardi deux fois : aujourd'hui, en 2026, puis en 2031, quand chaque collaborateur de l'hôpital type d'Akdital pilotera ses agents IA. ‹b›Six personnes nous guident : ‹c›Amina, qui attend une prothèse du genou ; ‹d›Youssef, au guichet des admissions ; ‹e›Salma, infirmière ; ‹f›Karim, technicien biomédical ; ‹g›Hicham, facturier ; ‹h›et Leïla, au siège. ‹i›Ils sont fictifs ; les chiffres, eux, sont ceux du business case actualisé.`,
    [...OPEN_PRE, { ...C({ title: false }), mark: "a" }, { ...stamp("Mardi · 7 h 30", 2026), mark: "a" }, { ...cam("cast"), mark: "b" },
      { ...C({ intro: "amina", cast: { amina: { at: "fc-1" } } }), mark: "c" },
      { ...C({ intro: "youssef", cast: { youssef: { at: "fc-2" } } }), mark: "d" },
      { ...C({ intro: "salma", cast: { salma: { at: "fc-3" } } }), mark: "e" },
      { ...C({ intro: "karim", cast: { karim: { at: "fc-4" } } }), mark: "f" },
      { ...C({ intro: "hicham", cast: { hicham: { at: "fc-5" } } }), mark: "g" },
      { ...C({ intro: "leila", cast: { leila: { at: "fc-6" } } }), mark: "h" },
      { ...C({ letterbox: false }), mark: "i" }],
    { lead: 6.5 }),
  beat("x-constat", "Personne ne décroche",
    `‹a›En 2026, au standard, le téléphone sonne, et personne ne décroche : Amina rappellera. Ce n'est la faute de personne : au premier semestre, les charges de personnel du groupe ont progressé de 28 %, le chiffre d'affaires de 21 %. ‹b›Rejouons ce mardi en 2031.`,
    [C({ cast: { amina: null, youssef: null, salma: null, karim: null, hicham: null, leila: null } }), op.year(2026), sel("dept", "standard"),
      props({ calls: "before" }), stamp("Mardi · 7 h 32", 2026), cam("standard"),
      { ...op.year(2031), mark: "b" }, { ...props({ calls: "after" }), mark: "b" }, { ...stamp("Mardi · 7 h 32", 2031), mark: "b" }]),
] });

E.push({ id: "patient", title: "Amina : l'attente qui disparaît", beats: [
  beat("x-amina", "Le parcours d'Amina",
    `‹a›Un agent vocal décroche, en darija, en français ou en arabe. Sept jours avant l'opération, Rafiq prépare Amina sur WhatsApp ; un créneau annulé est aussitôt proposé au patient suivant : dans un essai randomisé, ces rappels ont fait passer les absences de 29 à 23 %. ‹b›Le jour venu, les Expériences IA l'accueillent ; pas de file : ‹c›au guichet, Youssef vérifie et fait signer. ‹d›Ce parcours rapporte ${SP.patient.total} MDH par an, dont ${SP.patient.parts[1]} de marge sur les patients qu'il ramène.`,
    [op.year(2031), sel("dept", "standard"), cam("standard"), props({ calls: "after" }), stamp("Mardi · 9 h 10", 2031),
      { ...sel("dept", "accueil"), mark: "b" }, { ...props({ calls: "off", queue: "after", ydesk: "after" }), mark: "b" },
      { ...cast({ amina: { at: "hall-plan", from: "door-in" }, youssef: { at: "adm-pilot", pose: "tablet" } }), mark: "b" }, { ...cam("hall"), mark: "b" }, { ...chip("amina"), mark: "b" },
      { ...cast({ amina: { at: "adm-front" } }), mark: "c" }, { ...cam("admissions"), mark: "c" }, { ...chip("youssef"), mark: "c" },
      { ...C({ hud: true }), mark: "d" }, { ...flow("patient", "amina"), mark: "d" }],
    { speech: say(`‹a›Un agent vocal décroche, en darija, en français ou en arabe. Sept jours avant l'opération, Rafiq prépare Amina sur WhatsApp ; un créneau annulé est aussitôt proposé au patient suivant : dans un essai randomisé, ces rappels ont fait passer les absences de 29 à 23 %. ‹b›Le jour venu, les Expériences IA l'accueillent ; pas de file : ‹c›au guichet, Youssef vérifie et fait signer. ‹d›Ce parcours rapporte ${SP.patient.total} MDH par an, dont ${SP.patient.parts[1]} millions de marge sur les patients qu'il ramène.`) }),
] });

E.push({ id: "soin", title: "Salma : la nuit au troisième étage", beats: [
  beat("x-salma", "La nuit de Salma",
    `‹a›Troisième étage, en 2026 : Salma ressaisit au poste, en fin de garde, ce qu'elle a noté sur papier. ‹b›En 2031, elle dicte son dossier au chevet d'Amina, opérée dans l'après-midi. ‹c›Dans la chambre voisine, un patient vient de sortir : Keeps voit, sur la caméra de couloir existante, le chariot de bionettoyage ressortir de la chambre, sans jamais filmer une personne. ‹d›Le JABB Twin passe aussitôt le lit au statut prêt, sans attendre que l'équipe prévienne le service, puis que le service prévienne l'accueil. Dans un grand centre américain, la chambre est ainsi prête en 68 minutes au lieu de 115 : quarante-sept minutes gagnées à chaque sortie, et des lits disponibles plus tôt. ‹e›Qualité et sécurité pèsent ${i0(S.soin.gains)} MDH par an : du temps soignant rendu, de l'intérim évité, des lits prêts plus tôt.`,
    [cast({ amina: null, youssef: null }), C({ night: 0.12 }), props({ queue: "off", ydesk: "off", fall: "off" }), op.year(2026), sel("dept", "hospitalisation"), stamp("Mardi · 23 h 40", 2026),
      props({ npaper: "before", cart: "off" }), cast({ salma: { at: "nurse-station", pose: "type" } }), cam("station"), chip("salma"),
      { ...op.year(2031), mark: "b" }, { ...stamp("Mardi · 23 h 40", 2031), mark: "b" }, { ...props({ npaper: "after" }), mark: "b" },
      { ...cast({ amina: { at: "room-chair", pose: "sit" }, salma: { at: "room-bedside", from: "nurse-station", via: ["corr-e", "room-door", "room-in"], pose: "tablet" } }), mark: "b" }, { ...cam("room"), mark: "b" },
      { ...props({ cart: "after" }), mark: "c" }, { ...cam("cart"), mark: "c" }, { ...C({ alert: "cart-out", delay: 1.6 }), mark: "c" },
      { ...C({ ping: "room2-bed" }), mark: "d" },
      { ...C({ hud: true }), mark: "e" }, { ...flow("soin", "salma"), mark: "e" }]),
] });

E.push({ id: "actifs", title: "Karim et le jumeau", beats: [
  beat("x-karim", "Le jumeau numérique",
    `‹a›Quatrième étage. En 2026, Karim court après les pannes. ‹b›En 2031, le JABB Twin voit la dérive d'une machine dix jours avant l'arrêt, et Karim suit un parc plus grand sans courir ; ‹c›le jumeau localise le pousse-seringue libre en trois secondes, surveille le froid et l'oxygène, et met le bloc en veille la nuit. ‹d›Énergie, maintenance, équipements : les actifs rapportent ${SP.actifs.total} MDH par an.`,
    [cast({ amina: null, salma: null }), C({ night: null }), props({ npaper: "off", fall: "off", cart: "off" }), op.year(2026), sel("dept", "technique"), stamp("Mardi · 14 h 05", 2026),
      props({ machine: "before" }), cast({ karim: { at: "machine-fix", pose: "kneel" } }), cam("machine"), chip("karim"), C({ alert: "machine" }),
      { ...op.year(2031), mark: "b" }, { ...stamp("Mardi · 14 h 05", 2031), mark: "b" }, { ...props({ machine: "after" }), mark: "b" },
      { ...cast({ karim: { at: "twin-console", from: "machine-fix", via: ["tech-mid"], pose: "tablet" } }), mark: "b" }, { ...cam("twin"), mark: "b" },
      { ...C({ ping: "pump" }), mark: "c" },
      { ...C({ hud: true }), mark: "d" }, { ...flow("actifs", "karim"), mark: "d" }]),
] });

E.push({ id: "revenu", title: "Hicham : le revenu retrouvé", beats: [
  beat("x-hicham", "Les soins enfin facturés",
    `‹a›À la facturation, en 2026, Hicham clôture après la sortie, et la mutuelle rejette. ‹b›En 2031, la facture d'Amina est prête avant sa sortie, le rejet prévenu avant l'envoi : dans un hôpital américain, les factures bloquées après la sortie ont été divisées par deux. ‹c›${F.caR} MDH de soins déjà réalisés sont enfin facturés. ‹d›Ajoutez l'activité nouvelle que tout cela ramène, ${F.caN} MDH ; nous n'en comptons que la marge. ‹e›Au total, ${F.marge} MDH de marge par an.`,
    [cast({ karim: null }), props({ machine: "off" }), op.year(2026), sel("dept", "facturation"), stamp("Mardi · 16 h 20", 2026),
      props({ invoices: "before" }), cast({ hicham: { at: "billing-desk", pose: "type" } }), cam("billing"), chip("hicham"),
      { ...op.year(2031), mark: "b" }, { ...stamp("Mardi · 16 h 20", 2031), mark: "b" }, { ...props({ invoices: "after" }), mark: "b" },
      { ...cast({ hicham: { at: "billing-stand", from: "billing-desk", pose: "tablet" } }), mark: "b" },
      { ...C({ hud: true }), mark: "c" }, { ...flow("revenu", "hicham"), mark: "c" },
      { ...flow("ouvertures", "hicham"), mark: "d" }, { ...C({ focus: "marge" }), mark: "e" }],
    { speech: say(`‹a›À la facturation, en 2026, Hicham clôture après la sortie, et la mutuelle rejette. ‹b›En 2031, la facture d'Amina est prête avant sa sortie, le rejet prévenu avant l'envoi : dans un hôpital américain, les factures bloquées après la sortie ont été divisées par deux. ‹c›${F.caR} MDH de soins déjà réalisés sont enfin facturés. ‹d›Ajoutez l'activité nouvelle que tout cela ramène, ${F.caN} millions ; nous n'en comptons que la marge. ‹e›Au total, ${F.marge} millions de dirhams de marge par an.`) }),
] });

E.push({ id: "temps", title: "Youssef, cinq ans après", beats: [
  beat("x-youssef", "Le temps rendu",
    `‹a›Revenons à Youssef, et faisons défiler le temps. ‹b›2027 : ses premiers agents arrivent. ‹c›2029 : une collègue part à la retraite ; son poste n'est pas remplacé. ‹d›2031 : il pilote son escouade. ‹e›${F.etp} équivalents temps plein libérés, ${D.ms} MDH de masse salariale, et pas un seul licenciement : un peu plus d'un an de départs naturels suffit, et les ${F.ouv} ouvertures font le reste. ‹f›Avec le siège et les autres dépenses évitées, les économies atteignent ${F.eco} MDH par an.`,
    [cast({ hicham: null }), props({ invoices: "off" }), op.year(2026), sel("dept", "admissions"), cam("admissions-wide"), stamp("Guichet des admissions", 2026),
      props({ queue: "before", ydesk: "before" }), cast({ youssef: { at: "adm-desk", pose: "type" } }), chip("youssef"),
      { ...op.year(2027), mark: "b" }, { ...stamp("Guichet des admissions", 2027), mark: "b" }, { ...props({ ydesk: "mid" }), mark: "b" },
      { ...op.year(2029), mark: "c" }, { ...stamp("Guichet des admissions", 2029), mark: "c" }, { ...props({ queue: "after" }), mark: "c" },
      { ...op.year(2031), mark: "d" }, { ...stamp("Guichet des admissions", 2031), mark: "d" }, { ...props({ ydesk: "after" }), mark: "d" },
      { ...cast({ youssef: { at: "adm-pilot", from: "adm-desk", pose: "tablet" } }), mark: "d" },
      { ...C({ hud: true, focus: "ms" }), mark: "e" }, { ...flow("siege", "youssef"), mark: "f" }],
    { speech: say(`‹a›Revenons à Youssef, et faisons défiler le temps. ‹b›2027 : ses premiers agents arrivent. ‹c›2029 : une collègue part à la retraite ; son poste n'est pas remplacé. ‹d›2031 : il pilote son escouade. ‹e›${F.etp} équivalents temps plein libérés, ${half(y("ms"))} de dirhams de masse salariale, et pas un seul licenciement : un peu plus d'un an de départs naturels suffit, et les ${F.ouv} ouvertures font le reste. ‹f›Avec le siège et les autres dépenses évitées, les économies atteignent ${F.eco} millions de dirhams par an.`) }),
] });

E.push({ id: "compte", title: "Leïla fait le compte", beats: [
  beat("x-compte", "La valeur nette",
    `‹a›Au siège, dans l'Agentic Command Center, Leïla lit le rapport de sept heures. ‹b›Économies, ${D.eco} MDH ; marge, ${D.marge} ; gains bruts, ${D.gains}. ‹c›Moins le coût complet du programme, ${D.cout} MDH : ‹d›${D.net} MDH de valeur nette par an en 2031. ‹e›Positive dès 2028, ${F.cumul} MDH cumulés sur cinq ans. Chaque dirham investi en rapporte ${ratioText(y("ratio"))}.`,
    [cast({ youssef: null }), props({ queue: "off", ydesk: "off" }), op.year(2031), sel("dept", "siege-pilotage"), cam("command"), stamp("Mercredi · 7 h 00", 2031),
      props({ sheets: "after" }), cast({ leila: { at: "cmd-screen", pose: "stand" } }), chip("leila"),
      { ...C({ hud: true, focus: "gains" }), mark: "b" }, { ...C({ cost: true, from: "leila" }), mark: "c" }, { ...C({ net: true, sfx: "finale" }), mark: "d" },
      { ...C({ finale: "on", chart: "cumul" }), mark: "e" }, { ...cam("finale"), mark: "e" }],
    { speech: say(`‹a›Au siège, dans l'Agentic Command Center, Leïla lit le rapport de sept heures. ‹b›Économies, ${D.eco} millions de dirhams ; marge, ${D.marge} ; gains bruts, ${D.gains}. ‹c›Moins le coût complet du programme, ${D.cout} millions : ‹d›${D.net} millions de dirhams de valeur nette par an en 2031. ‹e›Positive dès 2028, ${F.cumul} millions cumulés sur cinq ans. Chaque dirham investi en rapporte ${ratioSaid(y("ratio"))}.`) }),
] });

E.push({ id: "fin", title: "Le monde et la décision", beats: [
  beat("x-fin", "Le Maroc, le monde, la décision",
    `‹a›Prenons de la hauteur : de Casablanca au Maroc, de ${ETAB["2026"]} établissements à ${ETAB["2031"]}, ‹b›puis au monde. Ce qui est prouvé dans une clinique se déploie dans toutes. ‹c›Le chemin commence petit : une clinique et le siège, dès la mi-décembre. La décision qui vous revient : lancer le cadrage en novembre. ‹d›Pour qu'Amina n'attende plus jamais au bout du fil.`,
    [cast({ leila: null }), props({ sheets: "off" }), C({ finale: "off", hud: true, stamp: null }), op.section("explorer"), { ...op.zoom(0.31), at: 0.02 }, { ...op.zoom(0.62), at: 0.12 }, { ...op.zoom(0.79), mark: "b" }, { ...C({ hud: false }), mark: "c" }]),
  beat("x-ligne", "JABB × AKDITAL × mibtech",
    `‹a›JABB × AKDITAL × mibtech, ensemble : ${F.net} MDH de valeur nette par an, sans un seul licenciement.`,
    [{ ...op.zoom(1), at: 0.02 }, { ...C({ letterbox: true, closing: true }), at: 0.3 }]),
] });

// ---------------------------------------------------------------- story0: the story state at the start of every beat
// (folds the cues in order; a chapter jump restores it at once, sequential play already matches it)
const LEDGER0 = { ms: 0, hms: 0, rec: 0, neu: 0 };
function fold(tour) {
  let st = { cast: {}, props: {}, stamp: null, ledger: { ...LEDGER0 }, hud: false, cost: false, net: false, finale: false, chart: null, letterbox: false, night: null };
  for (const ch of tour.chapters) for (const b of ch.beats) {
    b.story0 = JSON.parse(JSON.stringify(st));
    for (const a of b.actions) {
      if (a.do !== "cue") continue;
      if (a.reset) st = { cast: {}, props: {}, stamp: null, ledger: { ...LEDGER0 }, hud: false, cost: false, net: false, finale: false, chart: null, letterbox: false, night: null };
      if (a.cast) for (const [k, v] of Object.entries(a.cast)) { if (v) st.cast[k] = { at: v.at, ...(v.pose ? { pose: v.pose } : {}) }; else delete st.cast[k]; }
      if (a.props) Object.assign(st.props, a.props);
      if (a.stamp !== undefined) st.stamp = a.stamp;
      if (a.ledger) for (const k of ["ms", "hms", "rec", "neu"]) st.ledger[k] = Math.round((st.ledger[k] + (a.ledger[k] || 0)) * 1e4) / 1e4;
      if (a.hud !== undefined) st.hud = a.hud;
      if (a.cost) st.cost = true;
      if (a.net) st.net = true;
      if (a.finale !== undefined) st.finale = a.finale === "on";
      if (a.chart !== undefined) st.chart = a.chart;
      if (a.letterbox !== undefined) st.letterbox = a.letterbox;
      if (a.night !== undefined) st.night = a.night;
    }
  }
  // the whole story fills the ledger exactly once
  must(near(st.ledger.ms, y("ms"), 0.05) && near(st.ledger.hms, y("hms"), 0.05) && near(st.ledger.rec, ALL.rec, 0.05) && near(st.ledger.neu, ALL.neu, 0.05), `${tour.mode}: ledger complete`);
  must(st.cost && st.net, `${tour.mode}: cost and net told`);
}
fold(complete); fold(express);

// the ledger's fixed figures (the overlay animates the increments towards them)
const LEDGER = {
  year: 2031, unit: "MDH par an",
  final: { ms: y("ms"), hms: y("hms"), rec: ALL.rec, neu: ALL.neu, caR: y("ca_recup"), caN: y("ca_new"), eco: y("eco"), marge: y("marge"), gains: y("gains"), cout: y("cout"), net: y("net") },
  cost: { cases: ALL.cost, transverse: y("cout_transverse"), contingence: y("contingence") },
  series: Object.fromEntries(["2027", "2028", "2029", "2030", "2031"].map((k) => [k, { net: y("net", k), cumul: G.net_cumul.values[k], gains: y("gains", k), cout: y("cout", k) }])),
  cumul: G.net.cumul, van: G.net.van, ratio: y("ratio"), etp: y("etp"), etab: { from: ETAB["2026"], to: ETAB["2031"] },
  streams: Object.fromEntries(Object.entries(S).map(([k, s]) => [k, { ms: s.ms, hms: s.hms, rec: s.rec, neu: s.neu, gains: s.gains, cost: s.cost, etp: s.etp, cases: STREAMS[k] }])),
};

const note = "Generated by scripts/build-tour-v23.mjs from lib/data/v23 — edit the story there. Beat: text (captions), speech (said), actions {do,…, at: fraction} incl. story cues {do:\"cue\"}, story0 (state at the beat start), lead (silent seconds).";
for (const t of [express, complete]) { t.note = note; t.ledger = LEDGER; }
fs.writeFileSync(path.join(ROOT, "lib", "ai", "tour-v23-express.json"), JSON.stringify(express, null, 1) + "\n");
fs.writeFileSync(path.join(ROOT, "lib", "ai", "tour-v23-complete.json"), JSON.stringify(complete, null, 1) + "\n");

// ---------------------------------------------------------------- report
const CPS = 15.3, GAP = 0.6;
for (const t of [express, complete]) {
  const beats = t.chapters.flatMap((c) => c.beats);
  const chars = beats.reduce((s, b) => s + b.speech.length, 0);
  const sec = chars / CPS + beats.length * GAP + beats.reduce((s, b) => s + (b.lead || 0), 0);
  console.log(`${t.mode}: ${t.chapters.length} chapters, ${beats.length} beats, ${chars} characters ≈ ${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, "0")} s at ${CPS} char/s`);
  for (const c of t.chapters) {
    const cs = c.beats.reduce((s, b) => s + b.speech.length / CPS + GAP + (b.lead || 0), 0);
    console.log(`   ${c.title.padEnd(40)} ${c.beats.length} beat(s) ≈ ${Math.round(cs)} s`);
  }
}
console.log(`ledger 2031: ① ${m1(y("eco"))} (MS ${m1(y("ms"))} + hors MS ${m1(y("hms"))}) + ② ${m1(y("marge"))} (récupéré ${m1(ALL.rec)} + nouveau ${m1(ALL.neu)}) − ③ ${m1(y("cout"))} = ${m1(y("net"))}`);
for (const [k, s] of Object.entries(S)) console.log(`   ${k.padEnd(11)} gains ${m1(s.gains).padStart(6)} = MS ${m1(s.ms)} + hors MS ${m1(s.hms)} + récupéré ${m1(s.rec)} + nouveau ${m1(s.neu)}`);
