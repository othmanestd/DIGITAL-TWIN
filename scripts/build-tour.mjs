// Builds the two guided visits as STORIES (not lists), from the data (v1.3):
//   lib/ai/tour-script.json   → "Visite express"  (≈ 4–5 min): the story + a handful of highlights
//   lib/ai/tour-complete.json → "Visite complète" (≈ 12–15 min): the same arc, every department, cases grouped in
//                               flowing sentences while the cursor opens 1–2 key cases per department.
// Recurring fictional characters (announced as such): Amina, 54, knee surgery; Youssef, admissions; Salma, nurse.
// Arc: the pressure today → a day in the typical hospital (we follow a patient, floor by floor) → what the agents take
// over and what stays human → 2026→2029 (time-lapse, zero layoffs) → the twin and the network → the decision → the line.
// Figures come from lib/data/base.json (rounded, interpreted). "Ça a marché ailleurs" lines: only MEASURED references of
// lib/data/benchmarks.json (level A or B, direct analogue), said in plain words (no source, journal, vendor or year);
// the side panel keeps the full detail and the source. Each beat: text (captions) and speech (said; units spelled out).
//   node scripts/build-tour.mjs && node scripts/gen-narration.mjs     (audio optional: without it the tour speaks live)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));
const base = rd("lib/data/base.json");
const BENCH = rd("lib/data/benchmarks.json");
const CASE = Object.fromEntries(base.cases.map((c) => [c.id, c]));
const M = base.meta, P = M.pub, A = base.abs, R = base.ramp;
const FAM = Object.fromEntries(base.fams.map((f) => [f.code, f]));

// ---------------------------------------------------------------- checks: every figure said is read from the data
const NB = " ";
const fr = (x, d = 1) => { const s = Math.abs(x).toFixed(d).split("."); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB); return (x < 0 ? "−" : "") + s.join(","); };
const must = (cond, what) => { if (!cond) throw new Error("data check failed: " + what); };
must(M.eco === 302 && M.budget === 160 && M.net === 142, "302 / 160 / 142");
const sq = (x) => String(x).replace(/[\s  ]/g, "");
must(sq(P.pub_ms_growth) === "+28,1%" && sq(P.pub_ca_growth) === "+21%" && sq(P.pub_ratio_s1_26) === "22,5%" && sq(P.pub_ratio_s1_25) === "21,2%", "published growth");
must(Math.round(CASE["A-02"].etp) === 174, "A-02 174 ETP");
must(Math.round(FAM.A.part * 10) === 6 && Math.round(FAM.P.part * 100) === 10 && Math.round(FAM.S.mdh) === 94, "families");
must(A.postes_admin === 1410 && Math.round(A.departs_admin_an) === 458 && Math.round(A.annees_departs * 10) === 31, "absorption");
must(Math.round(R["2028"].net) === 83 && R["2029"].net === 142 && R["2027"].net > 0, "ramp");
must(Math.round(M.roi * 10) === 19, "ROI ≈ 1,9");
const nIn = base.cases.filter((c) => c.in302).length, nT = base.cases.filter((c) => c.fam === "T").length, nOut = base.cases.length - nIn - nT;
must(base.cases.length === 89 && nIn === 46 && nOut === 35 && nT === 8, "89 = 46 + 35 + 8");
must(Math.round(FAM.H.part * 100) === 5, "hébergement 5 %");
const perClinic = CASE["A-02"].etp / M.etab; // ≈ 3,9
must(Number(String(P.pub_adm_s1_26).replace(/[^0-9]/g, "")) / 181 > 3000, "more than 3 000 admissions a day (H1 2026)");
must(perClinic > 3.5 && perClinic < 4, "A-02 per clinic ≈ 4");
// measured references used in the voice (plain words) — each must exist, be measured, level A or B, and say this
const proof = (id, whoFrag, resultFrag) => {
  const b = BENCH.find((x) => x.measured && /^[AB]/.test(x.level) && (x.v13.includes(id) || x.app.includes(id)) && x.who.includes(whoFrag) && x.result.includes(resultFrag));
  must(b, `measured reference for ${id} (${whoFrag})`);
  return b;
};
proof("A-01", "RUH Bath", "49,9 %");
proof("A-06", "Rothschild", "75 %");
proof("A-17", "UCLA", "20 min");
proof("A-08", "New England Baptist", "11 → 2,3");
proof("A-11", "Auburn", "−50 %");
proof("P-01", "14 établissements allemands", "15 min");
proof("H-01", "MD Anderson", "115 → 68");
proof("I-04", "chinois", "4,8 % contre 7,3 %");
proof("S-08", "Jabarian", "+18 %");

// ---------------------------------------------------------------- caption → speech (units and symbols said naturally)
const say = (s) => s
  .replace(/(\d)\s?MDH\b/g, "$1 millions de dirhams")
  .replace(/\bMDH\b/g, "millions de dirhams")
  .replace(/JABB × AKDITAL × mibtech/g, "Jabb, Akdital et Mibtech")
  .replace(/AKDITAL/g, "Akdital")
  .replace(/\bJABB\b/g, "Jabb")
  .replace(/\s+/g, " ").trim();
const beat = (id, title, text, actions, speech) => ({ id, title, text, speech: speech ?? say(text), actions });
const sel = (kind, id, at) => ({ do: "select", kind, id, ...(at !== undefined ? { at } : {}) });
const kase = (id, at) => ({ do: "case", id, ...(at !== undefined ? { at } : {}) });
const zoom = (g, at) => ({ do: "zoom", g, ...(at !== undefined ? { at } : {}) });
const SETUP = [{ do: "section", section: "explorer", silent: true }, { do: "year", year: 2029, silent: true }, { do: "view", perSite: false, silent: true }, { do: "level", level: "hospital" }, { do: "home", silent: true }];
const YEARS = [{ do: "home" }, { do: "year", year: 2026, atSentence: 1 }, { do: "year", year: 2027, atSentence: 2 }, { do: "year", year: 2028, atSentence: 3 }, { do: "year", year: 2029, atSentence: 4 }];

// ---------------------------------------------------------------- shared story beats
// Recurring characters, fictional and announced as such: Amina (54, knee surgery), Youssef (admissions), Salma (nurse).
const pressure = beat("s-pression", "La pression",
  `Mardi, sept heures et demie : le téléphone sonne au standard d'une clinique Akdital, et personne ne décroche. Au bout du fil, Amina, 54 ans, qui doit se faire opérer du genou. Ce n'est la faute de personne : la croissance a un revers. Au premier semestre 2026, les charges de personnel ont bondi de 28 %, quand le chiffre d'affaires progressait de 21 % ; elles pèsent désormais 22,5 % des ventes. Chaque nouvelle clinique ajoute des guichets, des saisies, des appels. Notre réponse : des agents IA qui reprennent ce travail répétitif. Au plein régime, 302 MDH de masse salariale libérés chaque année, pour 160 MDH de coût d'agents : 142 MDH nets, sans aucun licenciement.`,
  [...SETUP, sel("dept", "standard", 0.08)],
  `Mardi, sept heures et demie : le téléphone sonne au standard d'une clinique Akdital, et personne ne décroche. Au bout du fil, Amina, 54 ans, qui doit se faire opérer du genou. Ce n'est la faute de personne : la croissance a un revers. Au premier semestre 2026, les charges de personnel ont bondi de 28 %, quand le chiffre d'affaires progressait de 21 % ; elles pèsent désormais 22 et demi pour cent des ventes. Chaque nouvelle clinique ajoute des guichets, des saisies, des appels. Notre réponse : des agents IA qui reprennent ce travail répétitif. Au plein régime, 302 millions de dirhams de masse salariale libérés chaque année, pour 160 millions de coût d'agents : 142 millions nets, sans aucun licenciement.`);

const characters = `Amina, Youssef et Salma sont des personnages fictifs ; les chiffres, eux, sont réels.`;

const timelapse = beat("s-temps", "2026 → 2029",
  `Revenons à l'hôpital, et faisons défiler le temps. 2026 : Youssef ressaisit toute la journée, et la file s'allonge. 2027 : ses premiers agents arrivent ; il vérifie au lieu de taper, et les premières vagues couvrent déjà leur coût. 2028 : Salma retrouve son quart d'heure, et le gain net dépasse 80 MDH. 2029 : Youssef pilote ses agents ; deux guichets ouverts au lieu de quatre, et personne n'a été licencié. Au plein régime, 142 MDH nets par an : près de deux dirhams économisés pour chaque dirham investi.`,
  YEARS);

const layoffs = beat("s-emplois", "Zéro licenciement",
  `Personne n'est licencié, et ce n'est pas une promesse en l'air. Les agents libèrent l'équivalent de 1 410 postes administratifs ; or, chaque année, environ 458 personnes quittent ces fonctions, naturellement. En un peu plus de trois ans, les départs non remplacés et la mobilité absorbent tout : la collègue de Youssef qui part à la retraite n'est pas remplacée, un autre rejoint la clinique qui ouvre à côté. Le déploiement avance par vagues : une clinique et le siège dès la mi-décembre, trois cliniques au printemps, une région à l'automne, puis tout le groupe.`,
  [{ do: "section", section: "emplois", at: 0.02 }, { do: "section", section: "deploiement", at: 0.72 }]);

const casablanca = beat("s-casa", "Casablanca", `Prenons de la hauteur. À trois kilomètres, Casablanca apparaît : la ville du siège et d'Anfa Prime, le vaisseau amiral du groupe. Le jumeau ne s'arrête pas aux murs de l'hôpital d'Amina : chaque clinique du réseau devient un nœud du programme.`,
  [{ do: "section", section: "explorer", silent: true }, zoom(0.31, 0.05)]);
const morocco = beat("s-maroc", "Le réseau marocain", `Le Maroc, ensuite : 45 établissements en service dans 25 villes, et bientôt 59. Regardez les données circuler entre les cliniques et le siège : ce qui est prouvé dans une clinique se déploie dans toutes. C'est sur ce périmètre que portent les 302 MDH.`,
  [zoom(0.62, 0.03)]);
const world = beat("s-monde", "Au-delà du Maroc", `Et au-delà. En Arabie saoudite, Riyad et La Mecque sont en service depuis septembre, Djeddah suivra ; à Dubaï, un hôpital est en construction. Le modèle prouvé au Maroc pourra s'y répliquer, pays après pays.`,
  [zoom(0.79, 0.03), { do: "point", anchor: "country:SA", at: 0.25 }, { do: "point", anchor: "country:AE", at: 0.6 }]);
const decision = beat("s-decision", "La décision", `Le chemin est tracé, et il commence petit : une clinique et le siège, sans contact patient, mesurés chaque mois dans l'Agentic Command Center. Pour qu'Amina n'attende plus jamais au bout du fil, et que Salma garde son temps pour ses patients, la décision qui vous revient aujourd'hui : lancer le cadrage en novembre.`,
  [{ do: "point", anchor: "stage", at: 0.2 }]);
// final easter egg: the Earth becomes the top drop of the Akdital logo, the camera zooms out to the whole line (g = 1)
const line = beat("s-ligne", "JABB × AKDITAL × mibtech", `Et la Terre devient la goutte du logo Akdital : JABB × AKDITAL × mibtech, ensemble. 302 MDH libérés chaque année, 142 MDH nets, sans un seul licenciement.`,
  [zoom(1, 0.02)]);

// ---------------------------------------------------------------- complete visit: Amina's journey, every department
const complete = { version: 4, mode: "complete", chapters: [
  { id: "pression", title: "Un appel sans réponse", beats: [pressure,
    beat("c-agents", "Ce qu'est un agent", `Un agent IA, c'est un logiciel qui prépare, exécute, vérifie ou relance une tâche dans les systèmes de l'hôpital, toujours sous la responsabilité d'un humain. Il assiste, il automatise sous validation, ou il remplace un tableur et une ressaisie. Il intervient d'abord dans l'administratif des sites, où il reprend six heures de travail sur dix ; puis au siège ; et, pour une petite part seulement, chez les soignants.`,
      [{ do: "point", anchor: "stage", at: 0.3 }])] },
  { id: "journee", title: "Le parcours d'Amina", beats: [
    beat("c-entree", "L'hôpital type", `Entrons dans l'hôpital type : tout le groupe, ramené à un seul bâtiment, où plus de trois mille patients entrent chaque jour. Suivons Amina, de son appel jusqu'à sa facture. ${characters}`,
      [sel("floor", "main:0", 0.3)]),
    beat("c-standard", "L'appel", `Reprenons son appel. Cette fois, un agent vocal décroche, jour et nuit, en darija, en français ou en arabe. Il trouve le créneau de consultation et le confirme ; la veille, un rappel part tout seul, et un créneau annulé est aussitôt proposé au patient suivant. À Paris, une fondation hospitalière traite déjà ainsi trois appels sur quatre sans personnel. À la caisse, le devis et le reste à charge d'Amina sont prêts avant qu'elle ne pose la question. Aux urgences, l'enregistrement se fait en parallèle des soins, et l'attente ne passe plus inaperçue ; même le dépistage est proposé au bon patient.`,
      [sel("dept", "standard", 0.02), kase("A-06", 0.06), sel("dept", "caisse", 0.6), sel("dept", "urgences", 0.74), sel("dept", "imagerie", 0.9)]),
    beat("c-hall", "L'arrivée", `Le jour venu, Amina arrive. Au hall, les Expériences IA l'accueillent : un guide lui répond en darija et l'oriente. Avant sa venue, l'agent a rassemblé ses pièces : en Angleterre, deux hôpitaux publics qui le font ont évité à un patient sur deux de se déplacer pour sa consultation préalable. Au guichet, Youssef, chargé d'admission, ne ressaisit plus rien : le dossier est pré-rempli ; il vérifie, repère un éventuel doublon et fait signer. Amina n'attend plus, et Youssef pilote ses agents. Pour le groupe, c'est l'équivalent de 174 postes d'admission, près de quatre par clinique.`,
      [sel("dept", "accueil", 0.02), sel("xp", "xp-guide", 0.07), sel("dept", "admissions", 0.3), kase("A-01", 0.34), kase("A-02", 0.62)]),
    beat("c-consult", "La consultation", `Premier étage, la consultation avec le chirurgien. Le secrétariat trouve le dossier d'Amina prêt et ses radios déjà classées. Le chirurgien dicte ; l'agent rédige un brouillon structuré ; le chirurgien relit et signe. Dans deux grands centres universitaires américains, cette documentation assistée a rendu à chaque médecin une vingtaine de minutes par jour. Et son médecin traitant est informé, sans avoir à relancer.`,
      [sel("floor", "main:1"), sel("dept", "consultations", 0.04), kase("A-17", 0.22)]),
    beat("c-pec", "La prise en charge", `L'opération est décidée. Ici se joue la trésorerie : l'agent prépare la prise en charge dès la programmation, réclame à la mutuelle la pièce manquante, et suit l'accord jusqu'à l'entrée d'Amina. Dans un hôpital américain, le délai entre la prescription et la programmation est passé de onze jours à un peu plus de deux. Les rejets sont prévenus avant l'envoi, les règlements lettrés au fil de l'eau, les honoraires des médecins libéraux calculés et expliqués, et le codeur reçoit un dossier complet.`,
      [sel("dept", "pec", 0.02), kase("A-08", 0.08), sel("dept", "facturation", 0.68), sel("dept", "codage", 0.9)]),
    beat("c-bloc", "L'opération", `Le jour de l'opération, au deuxième étage, rien ne change dans le geste du chirurgien. Ce qui change, c'est autour : registres et check-lists pré-remplis, la prothèse du genou d'Amina tracée de la pose jusqu'à la facture, réserves de l'unité commandées par l'agent et validées par l'infirmière référente. La réanimation et la maternité restent entièrement humaines.`,
      [sel("floor", "main:2"), sel("dept", "bloc", 0.05), kase("R-02", 0.32), sel("dept", "reserve", 0.68)]),
    beat("c-chambre", "La chambre", `Troisième étage, la chambre d'Amina. Salma, son infirmière, dicte son dossier de soins au lit, au lieu de le ressaisir au poste en fin de garde. Dans quatorze établissements allemands, ce geste a rendu un quart d'heure par poste : un quart d'heure que Salma passe avec ses patients. La relève est préparée par l'agent ; les demandes non médicales ne passent plus par elle. Et la nuit, une chute ou une sortie à risque est repérée, sans reconnaître personne.`,
      [sel("floor", "main:3"), sel("dept", "hospitalisation", 0.04), kase("P-01", 0.1), kase("P-02", 0.66)]),
    beat("c-humain", "Ce qui reste humain", `Ce qui reste humain ? Tout ce qui compte : le soin, l'écoute, la décision. Les agents préparent ; Salma et ses collègues décident, et signent l'irréversible. Pour les soignants, c'est un dixième de leur temps, celui de la paperasse, qui retourne au patient. Le cadre de santé reçoit un planning proposé, les absences sont anticipées trois semaines à l'avance, et les lits sont tenus à jour, les arbitrages restant humains. Chaque semaine, les équipes de jour comme de nuit donnent leur avis à la voix, anonymement ; et le merci d'Amina retrouve l'équipe qui l'a mérité.`,
      [sel("person", "hospitalisation/infirmier/0", 0.02), sel("dept", "cadres", 0.45), kase("P-03", 0.52), sel("dept", "lits", 0.68)]),
    beat("c-sortie", "La sortie et la facture", `Trois jours plus tard, Amina rentre chez elle, soulagée. Sa facture est déjà prête : pré-clôturée avant la sortie, complète, sans rejet. Dans un hôpital communautaire américain, les factures bloquées après la sortie ont été divisées par deux. Ses copies de dossier lui parviennent sans retour au guichet, et le lendemain, un appel prend de ses nouvelles.`,
      [sel("floor", "main:1"), kase("A-11", 0.08), sel("dept", "documents", 0.72), kase("X-10", 0.86)]),
    beat("c-coulisses", "Les coulisses", `En coulisses, au sous-sol, tout s'enchaîne. Sa chambre libérée déclenche le bionettoyage, sans un seul appel : dans un grand centre américain de cancérologie, la chambre est prête en un peu plus d'une heure au lieu de près de deux. Brancardage régulé, linge et repas au plus juste, demandes logistiques dispatchées, courrier et archives classés ; et à la pharmacie, un lot qui va périmer change de clinique avant d'être perdu.`,
      [sel("floor", "main:-1"), sel("dept", "bionettoyage", 0.04), kase("H-01", 0.1), sel("dept", "brancardage", 0.55), sel("dept", "linge", 0.62), sel("dept", "logistique", 0.69), sel("dept", "archives", 0.77), sel("dept", "pharmacie", 0.87)]),
    beat("c-twin", "La salle de contrôle JABB Twin", `Montons au quatrième étage, dans la salle de contrôle du JABB Twin, le jumeau numérique de l'hôpital. C'est lui qui a écouté la voix d'Amina, chambre par chambre ; chaque réclamation y reçoit une réponse dans l'heure, un incident se déclare en une minute, à la voix, et l'accréditation est tenue à jour en permanence. Côté technique, il voit la panne venir avant l'arrêt, retrouve le pousse-seringue libre, surveille l'oxygène et la chaîne du froid, et compare l'énergie des 45 sites. Dans un hôpital universitaire chinois, la maintenance priorisée par l'IA coûte un tiers de moins. Toute cette valeur s'ajoute, sans entrer dans les 302 MDH.`,
      [sel("floor", "main:4"), sel("dept", "technique", 0.03), sel("dept", "qualite", 0.12), kase("X-01", 0.16), sel("dept", "technique", 0.52), kase("I-04", 0.74)]),
  ] },
  { id: "siege", title: "Le siège et l'Agentic Command Center", beats: [
    beat("c-siege", "Finance, RH, services généraux", `Traversons vers le siège. À la finance, les factures fournisseurs sont contrôlées par l'agent, la banque rapprochée chaque jour, la clôture du mois préparée, et les créances sur les organismes relancées sans relâche. Aux ressources humaines, la paie est vérifiée avant le calcul, les contrats se signent en ligne, et un assistant répond jour et nuit aux 10 256 collaborateurs. Le recrutement s'accélère : sur près de 70 000 candidats, des entretiens vocaux par IA ont augmenté les embauches de 18 %. Achats, juridique et support informatique suivent le même chemin. Le siège, à lui seul, pèse 94 MDH.`,
      [sel("floor", "annex:1"), sel("dept", "siege-finance", 0.03), kase("S-01", 0.08), sel("dept", "siege-rh", 0.38), kase("S-08", 0.62), sel("dept", "siege-generaux", 0.84)]),
    beat("c-command", "L'Agentic Command Center", `Au dernier étage, l'Agentic Command Center. Chaque matin à sept heures, la direction reçoit son rapport : effectifs, heures rendues, décisions de poste, coût des agents. Elle ne compte qu'une chose : l'économie constatée en paie. Chaque agent a un responsable, un budget et un bouton d'arrêt ; une académie forme des administratifs comme Youssef à devenir pilotes d'agents ; et une bourse des transitions accompagne chaque mobilité.`,
      [sel("dept", "siege-pilotage", 0.02), kase("T-07", 0.06), kase("T-04", 0.6), kase("T-05", 0.84)]),
    beat("c-bilan", "89 cas d'usage", `Au total, Amina vient de traverser ${base.cases.length} cas d'usage. ${nIn} libèrent les 302 MDH de masse salariale. ${nOut} créent une autre valeur, en qualité, en revenu, en énergie, sans jamais s'y additionner. Et ${nT} leviers transforment le temps libéré en économie réelle, constatée en paie.`,
      [{ do: "section", section: "cas", at: 0.08 }]),
  ] },
  { id: "temps", title: "2026 → 2029 : Youssef, Salma, et les autres", beats: [timelapse, layoffs,
    beat("c-confiance", "La confiance", `Et la confiance se construit dès le premier jour. Les données de santé d'Amina restent au Maroc, dans un coffre souverain. Chaque agent est enregistré, chaque action journalisée, et tout peut être arrêté en un geste. Aucune donnée réelle n'est traitée avant l'autorisation de la CNDP, et chaque élargissement se décide sur le compteur de valeur, pas sur une promesse.`,
      [{ do: "section", section: "gouvernance", at: 0.05 }])] },
  { id: "reseau", title: "Le jumeau et le réseau", beats: [casablanca, morocco, world] },
  { id: "decision", title: "La décision", beats: [decision, line] },
] };

// ---------------------------------------------------------------- express visit: the same story, five highlights
const express = { version: 4, mode: "express", chapters: [
  { id: "pression", title: "Un appel sans réponse", beats: [pressure] },
  { id: "journee", title: "Le parcours d'Amina", beats: [
    beat("x-appel", "L'appel et l'arrivée", `Suivons Amina dans l'hôpital type. ${characters} Cette fois, au téléphone, un agent vocal décroche, jour et nuit, en darija, en français ou en arabe : à Paris, une fondation hospitalière traite déjà ainsi trois appels sur quatre sans personnel. Le jour venu, au guichet, Youssef ne ressaisit plus rien : le dossier est pré-rempli, il vérifie et fait signer. Amina n'attend plus ; pour le groupe, c'est l'équivalent de 174 postes d'admission, près de quatre par clinique.`,
      [sel("dept", "standard", 0.05), kase("A-06", 0.22), sel("floor", "main:0", 0.52), sel("dept", "admissions", 0.58), kase("A-02", 0.64)]),
    beat("x-pec", "La prise en charge", `Premier étage, là où se joue la trésorerie : l'agent prépare la prise en charge de son opération du genou et réclame à la mutuelle la pièce manquante. Dans un hôpital américain, le délai entre la prescription et la programmation est passé de onze jours à un peu plus de deux.`,
      [sel("floor", "main:1"), sel("dept", "pec", 0.06), kase("A-08", 0.14)]),
    beat("x-chambre", "La chambre", `Troisième étage. Salma, son infirmière, dicte son dossier de soins au lit d'Amina, au lieu de le ressaisir en fin de garde. Dans quatorze établissements allemands, ce geste a rendu un quart d'heure par poste : un quart d'heure passé avec les patients. Ce qui reste humain ? Tout ce qui compte : le soin, l'écoute, la décision. Les agents préparent ; les équipes décident.`,
      [sel("floor", "main:3"), sel("dept", "hospitalisation", 0.05), kase("P-01", 0.1), sel("person", "hospitalisation/infirmier/0", 0.66)]),
    beat("x-sortie", "La sortie", `Trois jours plus tard, Amina rentre chez elle, soulagée : sa facture était prête avant sa sortie, et le lendemain, un appel prend de ses nouvelles. Plus haut, le JABB Twin veille sur les équipements et l'énergie ; au siège, la paie et les factures sont contrôlées par les agents ; et l'Agentic Command Center ne compte qu'une chose : l'économie constatée en paie.`,
      [sel("floor", "main:1"), kase("A-11", 0.06), sel("dept", "technique", 0.42), sel("dept", "siege-rh", 0.6), sel("dept", "siege-pilotage", 0.8)]),
  ] },
  { id: "temps", title: "2026 → 2029 : Youssef, Salma, et les autres", beats: [timelapse,
    beat("x-emplois", "Zéro licenciement", `Personne n'est licencié. Environ 458 départs naturels par an, non remplacés, et la mobilité vers les nouvelles cliniques absorbent les 1 410 postes libérés, en un peu plus de trois ans. Le déploiement avance par vagues, d'une clinique et du siège jusqu'à tout le groupe ; et les données de santé restent au Maroc.`,
      [{ do: "section", section: "emplois", at: 0.03 }])] },
  { id: "reseau", title: "Le jumeau et le réseau", beats: [
    beat("x-reseau", "Le Maroc et le monde", `Prenons de la hauteur. Au-dessus de Casablanca, la ville du siège, le jumeau relie chaque clinique : ce qui est prouvé dans l'une se déploie dans les 45 du groupe, dans 25 villes. Et au-delà : Riyad et La Mecque sont déjà en service, Dubaï est en construction.`,
      [{ do: "section", section: "explorer", silent: true }, zoom(0.31, 0.02), zoom(0.62, 0.3), zoom(0.79, 0.7)]),
  ] },
  { id: "decision", title: "La décision", beats: [decision, line] },
] };

const note = "Generated by scripts/build-tour.mjs — edit the story there. Beat: text (captions), speech (said), actions {do,…, at: fraction | atSec | atSentence}.";
express.note = note; complete.note = note;
fs.writeFileSync(path.join(ROOT, "lib", "ai", "tour-script.json"), JSON.stringify(express, null, 2) + "\n");
fs.writeFileSync(path.join(ROOT, "lib", "ai", "tour-complete.json"), JSON.stringify(complete, null, 2) + "\n");

// ---------------------------------------------------------------- report
const CPS = 14.5, GAP = 0.6;
for (const t of [express, complete]) {
  const beats = t.chapters.flatMap((c) => c.beats);
  const chars = beats.reduce((s, b) => s + b.speech.length, 0);
  const sec = chars / CPS + beats.length * GAP;
  const opened = new Set(beats.flatMap((b) => b.actions.filter((a) => a.do === "case").map((a) => a.id)));
  const depts = new Set(beats.flatMap((b) => b.actions.filter((a) => a.do === "select" && a.kind === "dept").map((a) => a.id)));
  console.log(`${t.mode}: ${t.chapters.length} chapters, ${beats.length} beats, ${chars} characters ≈ ${Math.floor(sec / 60)} min ${String(Math.round(sec % 60)).padStart(2, "0")} s at ${CPS} char/s · ${depts.size} departments · ${opened.size} cases opened`);
}
