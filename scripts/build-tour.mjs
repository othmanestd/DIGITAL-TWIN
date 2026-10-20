// Builds the two guided visits as STORIES (not lists), from the data (v1.3):
//   lib/ai/tour-script.json   → "Visite express"  (≈ 4–5 min): the story + a handful of highlights
//   lib/ai/tour-complete.json → "Visite complète" (≈ 12–15 min): the same arc, every department, cases grouped in
//                               flowing sentences while the cursor opens 1–2 key cases per department.
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
  .replace(/\bJABB\b/g, "Jabb")
  .replace(/\s+/g, " ").trim();
const beat = (id, title, text, actions, speech) => ({ id, title, text, speech: speech ?? say(text), actions });
const sel = (kind, id, at) => ({ do: "select", kind, id, ...(at !== undefined ? { at } : {}) });
const kase = (id, at) => ({ do: "case", id, ...(at !== undefined ? { at } : {}) });
const zoom = (g, at) => ({ do: "zoom", g, ...(at !== undefined ? { at } : {}) });
const SETUP = [{ do: "section", section: "explorer", silent: true }, { do: "year", year: 2029, silent: true }, { do: "view", perSite: false, silent: true }, { do: "level", level: "hospital" }, { do: "home", silent: true }];
const YEARS = [{ do: "home" }, { do: "year", year: 2026, atSentence: 1 }, { do: "year", year: 2027, atSentence: 2 }, { do: "year", year: 2028, atSentence: 3 }, { do: "year", year: 2029, atSentence: 4 }];

// ---------------------------------------------------------------- shared story beats
const pressure = beat("s-pression", "La pression",
  `Chez Akdital, la croissance a un revers. Au premier semestre 2026, les charges de personnel ont bondi de 28 %, quand le chiffre d'affaires progressait de 21 %. Elles pèsent désormais 22,5 % des ventes, contre 21,2 % un an plus tôt. Chaque nouvelle clinique ajoute des guichets, des saisies, des appels. Notre réponse : des agents IA qui reprennent ce travail répétitif. Au plein régime, 302 MDH de masse salariale libérés chaque année, pour 160 MDH de coût d'agents : 142 MDH nets, sans aucun licenciement.`,
  [...SETUP, { do: "point", anchor: "stage", at: 0.3 }],
  `Chez Akdital, la croissance a un revers. Au premier semestre 2026, les charges de personnel ont bondi de 28 %, quand le chiffre d'affaires progressait de 21 %. Elles pèsent désormais 22 et demi pour cent des ventes, contre 21 pour cent un an plus tôt. Chaque nouvelle clinique ajoute des guichets, des saisies, des appels. Notre réponse : des agents IA qui reprennent ce travail répétitif. Au plein régime, 302 millions de dirhams de masse salariale libérés chaque année, pour 160 millions de coût d'agents : 142 millions nets, sans aucun licenciement.`);

const timelapse = beat("s-temps", "2026 → 2029",
  `Revenons à l'hôpital, et faisons défiler le temps. 2026. 2027. 2028. 2029. Regardez l'hôpital se transformer : moins de guichets, plus de pilotes d'agents. Dès 2027, les premières vagues couvrent leur coût ; en 2028, le gain net dépasse 80 MDH ; en 2029, c'est le plein régime : 142 MDH nets par an, près de deux dirhams économisés pour chaque dirham investi.`,
  YEARS);

const layoffs = beat("s-emplois", "Zéro licenciement",
  `Et personne n'est licencié. Les agents libèrent l'équivalent de 1 410 postes administratifs ; or, chaque année, environ 458 personnes quittent ces fonctions, naturellement. En un peu plus de trois ans, les départs non remplacés et la mobilité vers les nouvelles cliniques absorbent tout. Le déploiement avance par vagues : une clinique et le siège dès la mi-décembre, trois cliniques au printemps, une région à l'automne, puis tout le groupe.`,
  [{ do: "section", section: "emplois", at: 0.02 }, { do: "section", section: "deploiement", at: 0.62 }],
  `Et personne n'est licencié. Les agents libèrent l'équivalent de 1 410 postes administratifs ; or, chaque année, environ 458 personnes quittent ces fonctions, naturellement. En un peu plus de trois ans, les départs non remplacés et la mobilité vers les nouvelles cliniques absorbent tout. Le déploiement avance par vagues : une clinique et le siège dès la mi-décembre, trois cliniques au printemps, une région à l'automne, puis tout le groupe.`);

const casablanca = beat("s-casa", "Casablanca", `Prenons de la hauteur. À trois kilomètres, Casablanca apparaît : la ville du siège et d'Anfa Prime, le vaisseau amiral du groupe. Le jumeau ne s'arrête pas aux murs de l'hôpital : chaque clinique du réseau devient un nœud du programme.`,
  [{ do: "section", section: "explorer", silent: true }, zoom(0.31, 0.05)]);
const morocco = beat("s-maroc", "Le réseau marocain", `Le Maroc, ensuite : 45 établissements en service dans 25 villes, et bientôt 59. Regardez les données circuler entre les cliniques et le siège : ce qui est prouvé dans une clinique se déploie dans toutes. C'est sur ce périmètre que portent les 302 MDH.`,
  [zoom(0.62, 0.03)]);
const world = beat("s-monde", "Au-delà du Maroc", `Et au-delà. En Arabie saoudite, Riyad et La Mecque sont en service depuis septembre, Djeddah suivra ; à Dubaï, un hôpital est en construction. Le modèle prouvé au Maroc pourra s'y répliquer, pays après pays.`,
  [zoom(0.79, 0.03), { do: "point", anchor: "country:SA", at: 0.25 }, { do: "point", anchor: "country:AE", at: 0.6 }]);
const decision = beat("s-decision", "La décision", `Le chemin est tracé, et il commence petit : une clinique et le siège, sans contact patient, mesurés chaque mois dans l'Agentic Command Center. La décision qui vous revient aujourd'hui : lancer le cadrage en novembre.`,
  [{ do: "point", anchor: "stage", at: 0.2 }]);
const line = beat("s-ligne", "JABB × AKDITAL × mibtech", `JABB × AKDITAL × mibtech : 302 MDH libérés chaque année, 142 MDH nets, sans un seul licenciement.`,
  [zoom(0.99, 0.02)]);

// ---------------------------------------------------------------- complete visit: a day in the typical hospital
const complete = { version: 3, mode: "complete", chapters: [
  { id: "pression", title: "La pression, et la réponse", beats: [pressure,
    beat("c-agents", "Ce qu'est un agent", `Un agent IA, c'est un logiciel qui prépare, exécute, vérifie ou relance une tâche dans les systèmes de l'hôpital, toujours sous la responsabilité d'un humain. Selon les cas, il assiste, il automatise sous validation, ou il remplace un tableur et une ressaisie. Il intervient d'abord dans l'administratif des sites, où il reprend six heures de travail sur dix ; puis au siège ; et, pour une petite part seulement, chez les soignants et dans l'hébergement.`,
      [{ do: "point", anchor: "stage", at: 0.3 }])] },
  { id: "journee", title: "Une journée à l'hôpital type", beats: [
    beat("c-entree", "L'hôpital type", `Entrons dans l'hôpital type : tout le groupe, ramené à un seul bâtiment. Chaque jour, plus de trois mille patients franchissent les portes d'une clinique Akdital. Suivons l'une d'entre elles, du hall jusqu'à sa sortie, et regardons ce qui change, pour elle et pour les équipes, étage par étage.`,
      [sel("floor", "main:0", 0.35)]),
    beat("c-hall", "Accueil et admissions", `Au hall, les Expériences IA l'accueillent : un guide lui répond en darija et l'oriente, un référent pilote les files. Son dossier est déjà prêt : avant sa venue, l'agent a rassemblé ses pièces. En Angleterre, deux hôpitaux publics qui le font ont évité à un patient sur deux de se déplacer pour sa consultation préalable. Au guichet, le dossier est pré-rempli : la chargée d'admission vérifie, repère un éventuel doublon et fait signer. Pour le groupe, c'est l'équivalent de 174 postes d'admission, près de quatre par clinique. Et chaque mois, les 45 accueils du groupe sont comparés, comme le ferait un patient mystère.`,
      [sel("dept", "accueil", 0.02), sel("xp", "xp-guide", 0.08), sel("dept", "admissions", 0.3), kase("A-01", 0.36), kase("A-02", 0.66)]),
    beat("c-standard", "Standard, caisse, urgences", `Derrière le hall, le standard ne sonne plus dans le vide : un agent vocal répond jour et nuit, en darija, en français et en arabe, prend et confirme les rendez-vous ; la veille, un rappel part tout seul, et un créneau annulé est aussitôt proposé au patient suivant. À Paris, une fondation hospitalière traite déjà ainsi trois appels sur quatre sans personnel. À la caisse, devis et reste à charge sont préparés, et chaque écart est expliqué avant la clôture. Aux urgences, l'enregistrement se fait en parallèle des soins, et l'attente ne passe plus inaperçue. Même la prévention s'y met : les campagnes de dépistage sont proposées au bon patient.`,
      [sel("dept", "standard", 0.02), kase("A-06", 0.08), sel("dept", "caisse", 0.47), sel("dept", "urgences", 0.62), sel("dept", "imagerie", 0.85)]),
    beat("c-consult", "Consultations", `Premier étage, la consultation. Le secrétariat trouve le dossier prêt et les résultats déjà classés. Le médecin dicte ; l'agent rédige un brouillon structuré ; le médecin relit et signe. Dans deux grands centres universitaires américains, cette documentation assistée a rendu à chaque médecin une vingtaine de minutes de saisie par jour. Les médecins adresseurs sont informés sans avoir à relancer, et après le séjour, duplicatas et copies de dossier partent sans retour au guichet.`,
      [sel("floor", "main:1"), sel("dept", "consultations", 0.04), kase("A-17", 0.2), sel("dept", "documents", 0.82)]),
    beat("c-pec", "Prises en charge et facturation", `Ici se joue la trésorerie. Les agents préparent les prises en charge dès la programmation, réclament les pièces manquantes et suivent chaque accord jusqu'à l'entrée. Dans un hôpital américain, le délai entre la prescription et la programmation est passé de onze jours à un peu plus de deux. La facture est pré-clôturée avant la sortie, les rejets sont prévenus avant l'envoi, les règlements lettrés au fil de l'eau, les honoraires des médecins libéraux calculés et expliqués, et le codeur reçoit un dossier complet. Dans un hôpital communautaire américain, les factures bloquées après la sortie ont été divisées par deux.`,
      [sel("dept", "pec", 0.02), kase("A-08", 0.08), sel("dept", "facturation", 0.47), kase("A-11", 0.55), sel("dept", "codage", 0.86)]),
    beat("c-bloc", "Le bloc", `Deuxième étage, le bloc. Ici, rien ne change dans le geste chirurgical. Ce qui change, c'est autour : registres et check-lists réglementaires pré-remplis, chaque dispositif posé tracé jusqu'à la facture, fiches de préférence des chirurgiens revues, réserves de l'unité commandées par l'agent et validées par l'infirmière référente. La réanimation et la maternité restent entièrement humaines.`,
      [sel("floor", "main:2"), sel("dept", "bloc", 0.05), kase("P-06", 0.25), sel("dept", "reserve", 0.62)]),
    beat("c-chambre", "La chambre", `Troisième étage, la chambre. L'infirmière dicte son dossier de soins au lit du patient : fini, la double saisie. Dans quatorze établissements allemands, elle y a gagné un quart d'heure par poste. La relève est préparée par l'agent et complétée par l'équipe ; les demandes non médicales des patients ne passent plus par la soignante. La nuit, les chutes et les sorties à risque sont repérées, sans reconnaître personne. Et après la sortie, la famille reste en lien, avec un appel dès le lendemain.`,
      [sel("floor", "main:3"), sel("dept", "hospitalisation", 0.04), kase("P-01", 0.1), kase("P-02", 0.45)]),
    beat("c-humain", "Ce qui reste humain", `Ce qui reste humain ? Tout ce qui compte : le soin, l'écoute, la décision. Les agents préparent ; les équipes décident et signent l'irréversible. Pour les soignants, c'est un dixième de leur temps, celui de la paperasse, qui retourne au patient. Les cadres de santé reçoivent un planning proposé, les absences sont anticipées trois semaines à l'avance et remplacées par la réserve interne, et les lits sont tenus à jour, les arbitrages restant humains. Chaque semaine, les équipes, y compris celles de nuit, donnent leur avis à la voix, anonymement ; et le compliment d'un patient retrouve l'équipe qui l'a mérité.`,
      [sel("person", "hospitalisation/infirmier/0", 0.02), sel("dept", "cadres", 0.52), kase("P-03", 0.6), sel("dept", "lits", 0.88)]),
    beat("c-coulisses", "Les coulisses", `Elle sort. En coulisses, au sous-sol, tout s'enchaîne. La chambre libérée déclenche le bionettoyage, sans un seul appel : dans un grand centre américain de cancérologie, la chambre est prête en un peu plus d'une heure au lieu de près de deux. Le brancardage est régulé, le linge et les repas commandés au plus juste, les demandes logistiques dispatchées, le courrier et les archives lus et classés. Et à la pharmacie, un lot qui va périmer change de clinique avant d'être perdu.`,
      [sel("floor", "main:-1"), sel("dept", "bionettoyage", 0.06), kase("H-01", 0.13), sel("dept", "brancardage", 0.56), sel("dept", "linge", 0.64), sel("dept", "logistique", 0.71), sel("dept", "archives", 0.78), sel("dept", "pharmacie", 0.88)]),
    beat("c-twin", "La salle de contrôle JABB Twin", `Montons au quatrième étage, dans la salle de contrôle du JABB Twin, le jumeau numérique de l'hôpital. Il écoute la voix des patients, chambre par chambre ; chaque réclamation reçoit une réponse dans l'heure, un incident se déclare en une minute, à la voix ; l'accréditation est tenue à jour en permanence, et l'hygiène suivie chaque jour. Côté technique, il voit la panne venir avant l'arrêt, retrouve le pousse-seringue libre, surveille l'oxygène et la chaîne du froid, mesure le vrai rendement des IRM et des salles de bloc, et compare l'énergie des 45 sites. Dans un hôpital universitaire chinois, la maintenance priorisée par l'IA coûte un tiers de moins. Toute cette valeur s'ajoute, sans entrer dans les 302 MDH.`,
      [sel("floor", "main:4"), sel("dept", "technique", 0.04), sel("dept", "qualite", 0.14), kase("X-01", 0.18), sel("dept", "technique", 0.5), kase("I-04", 0.7)]),
  ] },
  { id: "siege", title: "Le siège et l'Agentic Command Center", beats: [
    beat("c-siege", "Finance, RH, services généraux", `Traversons vers le siège. À la finance, les factures fournisseurs sont contrôlées par l'agent, la banque rapprochée chaque jour, la clôture du mois préparée, et les créances sur les organismes relancées sans relâche. Aux ressources humaines, la paie est vérifiée avant le calcul, les contrats se signent en ligne, et un assistant répond jour et nuit aux 10 256 collaborateurs. Le recrutement s'accélère : sur près de 70 000 candidats, des entretiens vocaux par IA ont augmenté les embauches de 18 %. Le contrôle de gestion connaît enfin le coût de chaque séjour ; les appels d'offres se bouclent en jours, et les conventions avec les organismes se négocient sur preuves. Achats, juridique et support informatique suivent le même chemin. Le siège, à lui seul, pèse 94 MDH.`,
      [sel("floor", "annex:1"), sel("dept", "siege-finance", 0.03), kase("S-01", 0.08), sel("dept", "siege-rh", 0.38), kase("S-08", 0.62), sel("dept", "siege-generaux", 0.84)]),
    beat("c-warroom", "L'Agentic Command Center", `Au dernier étage, l'Agentic Command Center. Chaque matin à sept heures, la direction reçoit son rapport : effectifs, heures rendues, décisions de poste, coût des agents. Elle ne compte qu'une chose : l'économie constatée en paie. Chaque agent a un responsable, un budget et un bouton d'arrêt ; et une académie forme les administratifs à devenir pilotes d'agents. Une bourse des transitions accompagne chaque mobilité ; les nouvelles cliniques sont conçues augmentées dès le premier jour, leur jumeau numérique existant avant la première pierre ; et une salle de crise numérique se tient prête, pour un afflux massif comme pour une cyberattaque.`,
      [sel("dept", "siege-pilotage", 0.02), kase("T-07", 0.06), kase("T-04", 0.42), kase("T-05", 0.6)]),
    beat("c-bilan", "89 cas d'usage", `Au total, nous venons de traverser ${base.cases.length} cas d'usage. ${nIn} libèrent les 302 MDH de masse salariale. ${nOut} créent une autre valeur, en qualité, en revenu, en énergie, sans jamais s'y additionner. Et ${nT} leviers transforment le temps libéré en économie réelle, constatée en paie.`,
      [{ do: "section", section: "cas", at: 0.08 }]),
  ] },
  { id: "temps", title: "2026 → 2029 : la transformation", beats: [timelapse, layoffs,
    beat("c-confiance", "La confiance", `Et la confiance se construit dès le premier jour. Les données de santé restent au Maroc, dans un coffre souverain. Chaque agent est enregistré, chaque action journalisée, et tout peut être arrêté en un geste. Aucune donnée réelle n'est traitée avant l'autorisation de la CNDP, et chaque élargissement se décide sur le compteur de valeur, pas sur une promesse.`,
      [{ do: "section", section: "gouvernance", at: 0.05 }])] },
  { id: "reseau", title: "Le jumeau et le réseau", beats: [casablanca, morocco, world] },
  { id: "decision", title: "La décision", beats: [decision, line] },
] };

// ---------------------------------------------------------------- express visit: the story + 5–6 highlights
const express = { version: 3, mode: "express", chapters: [
  { id: "pression", title: "La pression d'aujourd'hui", beats: [pressure] },
  { id: "journee", title: "Une journée à l'hôpital type", beats: [
    beat("x-hall", "Accueil et admissions", `Entrons dans l'hôpital type : tout le groupe, ramené à un seul bâtiment. Chaque jour, plus de trois mille patients franchissent les portes d'une clinique Akdital ; suivons l'une d'entre elles. Au hall, les Expériences IA l'accueillent en darija et l'orientent. Au guichet, son dossier est déjà pré-rempli : la chargée d'admission vérifie et fait signer, au lieu de ressaisir. Pour le groupe, c'est l'équivalent de 174 postes d'admission, près de quatre par clinique.`,
      [sel("floor", "main:0", 0.05), sel("xp", "xp-guide", 0.2), sel("dept", "admissions", 0.48), kase("A-02", 0.58)]),
    beat("x-standard", "Le standard", `Au standard, un agent vocal répond jour et nuit, en darija, en français et en arabe, et confirme les rendez-vous. À Paris, une fondation hospitalière traite déjà ainsi trois appels sur quatre sans personnel.`,
      [sel("dept", "standard", 0.03), kase("A-06", 0.15)]),
    beat("x-pec", "Prises en charge et facturation", `Premier étage, là où se joue la trésorerie : les prises en charge sont préparées dès la programmation, les pièces manquantes réclamées par l'agent, la facture pré-clôturée avant la sortie. Dans un hôpital américain, le délai entre la prescription et la programmation est passé de onze jours à un peu plus de deux.`,
      [sel("floor", "main:1"), sel("dept", "pec", 0.06), kase("A-08", 0.14), sel("dept", "facturation", 0.42)]),
    beat("x-chambre", "La chambre", `Troisième étage. L'infirmière dicte son dossier de soins au lit du patient : fini, la double saisie. Dans quatorze établissements allemands, elle y a gagné un quart d'heure par poste. Ce qui reste humain ? Tout ce qui compte : le soin, l'écoute, la décision. Les agents préparent ; les équipes décident et signent. Pour les soignants, c'est un dixième de leur temps, celui de la paperasse, qui retourne au patient.`,
      [sel("floor", "main:3"), sel("dept", "hospitalisation", 0.05), kase("P-01", 0.1), sel("person", "hospitalisation/infirmier/0", 0.62)]),
    beat("x-twin", "Le jumeau et le siège", `Plus haut, la salle de contrôle du JABB Twin, le jumeau numérique de l'hôpital, veille sur les équipements, l'énergie et la voix des patients : il voit la panne venir avant l'arrêt. Au siège, la paie est vérifiée avant le calcul et les factures fournisseurs contrôlées par l'agent. Et dans l'Agentic Command Center, la direction ne compte qu'une chose : l'économie constatée en paie.`,
      [sel("floor", "main:4"), sel("dept", "technique", 0.05), sel("dept", "siege-rh", 0.4), kase("S-06", 0.46), sel("dept", "siege-pilotage", 0.75)]),
  ] },
  { id: "temps", title: "2026 → 2029 : la transformation", beats: [timelapse,
    beat("x-emplois", "Zéro licenciement", `Et personne n'est licencié. Environ 458 départs naturels par an, non remplacés, et la mobilité vers les nouvelles cliniques absorbent les 1 410 postes libérés, en un peu plus de trois ans. Le déploiement avance par vagues : une clinique et le siège dès la mi-décembre, puis trois cliniques, une région, et tout le groupe. Les données de santé, elles, restent au Maroc.`,
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
