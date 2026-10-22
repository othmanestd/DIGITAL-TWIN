// The "typical Akdital hospital": a representative building that gathers every department touched by the programme,
// plus the care departments the programme does not touch (care stays human), and the head-office annex (siège).
// Figures shown for a department come from its use cases (lib/model.ts). Staff counts drawn in 3D are illustrative.

export type Role = "patient" | "medecin" | "infirmier" | "aide" | "admin" | "technique" | "cadre" | "direction";
export type DeptKind = "admin" | "care" | "support" | "hq";

/** Building ids: the hôpital type ("main", "annex") and the real facilities drawn in the city ("ap.w", "ap.e" = Anfa Prime). */
export type BId = "main" | "annex" | "ap.w" | "ap.e";

export type Dept = {
  id: string;
  name: string;              // full name shown in panels
  short: string;             // label in 3D and sidebar tooltip
  building: BId;
  /** real facility the department belongs to (lib/facilities.ts slug); absent = the hôpital type */
  fac?: string;
  /** hôpital-type department whose furniture builder (and use cases, as an estimate) this one reuses */
  tpl?: string;
  floor: number;             // -1 basement … 3 (main), 0 … 3 (annex)
  kind: DeptKind;
  icon: IconKey;
  cases: string[];           // use cases located in this department ([] = care, not touched)
  staff: { role: Role; label: string; n: number }[]; // figures drawn (illustrative)
  beds?: number;             // beds / stretchers drawn
  rect: [number, number, number, number]; // x, z, w, d on the floor plate (units, origin = building centre)
  note?: string;             // one line shown when the department has no use case
};

export type IconKey =
  | "hall" | "id" | "ambulance" | "cash" | "phone" | "scan" | "stethoscope" | "folder" | "shield" | "invoice" | "code" | "flask"
  | "scalpel" | "heartbeat" | "baby" | "box" | "bed" | "beds" | "clipboard" | "pill" | "truck" | "sparkle" | "shirt" | "archive"
  | "stretcher" | "building" | "coins" | "users" | "scale" | "compass";

export const FLOOR_H = 4.4; // floor height (scene units)
export const MAIN = { w: 52, d: 26, x: 0, z: 0 } as const;   // main building footprint
export const ANNEX = { w: 22, d: 18, x: 46, z: -2 } as const; // head-office annex footprint (centre)

export const FLOORS: { building: "main" | "annex"; floor: number; name: string }[] = [
  { building: "main", floor: -1, name: "Sous-sol · logistique, hôtellerie, pharmacie" },
  { building: "main", floor: 0, name: "Rez-de-chaussée · accueil, admissions, urgences" },
  { building: "main", floor: 1, name: "1er étage · consultations, prises en charge, facturation" },
  { building: "main", floor: 2, name: "2e étage · bloc opératoire, réanimation, maternité" },
  { building: "main", floor: 3, name: "3e étage · hospitalisation et cadres de santé" },
  { building: "main", floor: 4, name: "4e étage · qualité, relations patients, gestion technique (jumeau numérique)" },
  { building: "annex", floor: 0, name: "Siège · services généraux" },
  { building: "annex", floor: 1, name: "Siège · finance" },
  { building: "annex", floor: 2, name: "Siège · ressources humaines" },
  { building: "annex", floor: 3, name: "Siège · pilotage et transformation" },
];

const W = MAIN.w / 2, Dd = MAIN.d / 2; // half sizes
// helper to build rectangles on a 3-column × 2-row grid of the main plate
const cell = (col: number, row: number, cols = 3, rows = 2): [number, number, number, number] => {
  const w = MAIN.w / cols, d = MAIN.d / rows;
  return [-W + w * col + w / 2, -Dd + d * row + d / 2, w - 1, d - 1];
};
const acell = (col: number, row: number, cols = 2, rows = 2): [number, number, number, number] => {
  const w = ANNEX.w / cols, d = ANNEX.d / rows;
  return [-ANNEX.w / 2 + w * col + w / 2, -ANNEX.d / 2 + d * row + d / 2, w - 1, d - 1];
};

export const DEPTS: Dept[] = [
  // ---------------------------------------------------------------- basement
  { id: "pharmacie", name: "Pharmacie et stérilisation", short: "Pharmacie", building: "main", floor: -1, kind: "care", icon: "pill", cases: ["R-04"],
    staff: [{ role: "medecin", label: "Pharmacien(ne)", n: 1 }, { role: "technique", label: "Préparateur(rice)", n: 2 }], rect: cell(0, 0),
    note: "Le circuit du médicament reste humain ; les commandes des unités sont préparées par un agent (P-05, 2e étage)." },
  { id: "logistique", name: "Logistique interne", short: "Logistique", building: "main", floor: -1, kind: "support", icon: "truck", cases: ["H-04"],
    staff: [{ role: "technique", label: "Agent de coordination de l'hébergement", n: 2 }], rect: cell(1, 0) },
  { id: "bionettoyage", name: "Bionettoyage", short: "Bionettoyage", building: "main", floor: -1, kind: "support", icon: "sparkle", cases: ["H-01"],
    staff: [{ role: "technique", label: "Agent de service hospitalier (bionettoyage)", n: 3 }], rect: cell(2, 0) },
  { id: "linge", name: "Linge et restauration", short: "Linge et repas", building: "main", floor: -1, kind: "support", icon: "shirt", cases: ["H-03"],
    staff: [{ role: "technique", label: "Agent de lingerie et de restauration", n: 2 }], rect: cell(0, 1) },
  { id: "brancardage", name: "Brancardage", short: "Brancardage", building: "main", floor: -1, kind: "support", icon: "stretcher", cases: ["H-02"],
    staff: [{ role: "technique", label: "Brancardier(ère) et régulateur(rice)", n: 2 }], beds: 1, rect: cell(1, 1) },
  { id: "archives", name: "Courrier et archives", short: "Archives", building: "main", floor: -1, kind: "admin", icon: "archive", cases: ["A-19"],
    staff: [{ role: "admin", label: "Agent du bureau d'ordre et archiviste", n: 2 }], rect: cell(2, 1) },

  // ---------------------------------------------------------------- ground floor
  { id: "accueil", name: "Hall d'accueil et orientation", short: "Accueil", building: "main", floor: 0, kind: "admin", icon: "hall", cases: ["A-05", "X-04"],
    staff: [{ role: "admin", label: "Agent d'accueil et d'orientation", n: 2 }, { role: "patient", label: "Patient(e) et accompagnant(e)", n: 4 }], rect: cell(1, 1) },
  { id: "admissions", name: "Admissions", short: "Admissions", building: "main", floor: 0, kind: "admin", icon: "id", cases: ["A-01", "A-02", "A-03"],
    staff: [{ role: "admin", label: "Chargé(e) d'admission", n: 4 }, { role: "patient", label: "Patient(e)", n: 3 }], rect: cell(0, 1) },
  { id: "urgences", name: "Urgences", short: "Urgences", building: "main", floor: 0, kind: "admin", icon: "ambulance", cases: ["A-04", "X-09"],
    staff: [{ role: "admin", label: "Chargé(e) d'admission des urgences", n: 1 }, { role: "medecin", label: "Urgentiste", n: 1 }, { role: "infirmier", label: "Infirmier(ère) d'accueil", n: 2 }, { role: "patient", label: "Patient(e)", n: 2 }],
    beds: 3, rect: cell(2, 1) },
  { id: "caisse", name: "Caisse et devis", short: "Caisse", building: "main", floor: 0, kind: "admin", icon: "cash", cases: ["A-12", "A-15"],
    staff: [{ role: "admin", label: "Caissier(ère)", n: 2 }, { role: "admin", label: "Facturier(ère) devis", n: 1 }], rect: cell(0, 0) },
  { id: "standard", name: "Standard et rendez-vous", short: "Standard", building: "main", floor: 0, kind: "admin", icon: "phone", cases: ["A-06", "A-07"],
    staff: [{ role: "admin", label: "Standardiste et secrétaire de rendez-vous", n: 4 }], rect: cell(1, 0) },
  { id: "imagerie", name: "Imagerie médicale", short: "Imagerie", building: "main", floor: 0, kind: "care", icon: "scan", cases: ["X-11"],
    staff: [{ role: "medecin", label: "Radiologue", n: 1 }, { role: "infirmier", label: "Manipulateur(rice) radio", n: 2 }, { role: "patient", label: "Patient(e)", n: 1 }], beds: 1, rect: cell(2, 0),
    note: "L'acte d'imagerie reste humain ; les rendez-vous et comptes rendus passent par le standard et le secrétariat (A-06, A-17)." },

  // ---------------------------------------------------------------- 1st floor
  { id: "consultations", name: "Consultations et secrétariat médical", short: "Consultations", building: "main", floor: 1, kind: "admin", icon: "stethoscope", cases: ["A-16", "A-17", "R-06"],
    staff: [{ role: "admin", label: "Secrétaire médicale", n: 3 }, { role: "medecin", label: "Médecin consultant", n: 2 }, { role: "patient", label: "Patient(e)", n: 3 }], rect: cell(0, 1) },
  { id: "documents", name: "Documents patients", short: "Documents", building: "main", floor: 1, kind: "admin", icon: "folder", cases: ["A-18"],
    staff: [{ role: "admin", label: "Facturier(ère) et archiviste", n: 1 }], rect: cell(1, 1) },
  { id: "pec", name: "Prises en charge AMO", short: "Prises en charge", building: "main", floor: 1, kind: "admin", icon: "shield", cases: ["A-08", "A-09"],
    staff: [{ role: "admin", label: "Gestionnaire de prise en charge", n: 4 }], rect: cell(2, 1) },
  { id: "facturation", name: "Facturation de séjour et recouvrement", short: "Facturation", building: "main", floor: 1, kind: "admin", icon: "invoice", cases: ["A-11", "A-10", "A-13", "R-07"],
    staff: [{ role: "admin", label: "Facturier(ère)", n: 4 }, { role: "admin", label: "Comptable clients", n: 1 }], rect: cell(0, 0) },
  { id: "codage", name: "Codage de l'information médicale", short: "Codage", building: "main", floor: 1, kind: "admin", icon: "code", cases: ["A-14"],
    staff: [{ role: "admin", label: "Codeur(se) de l'information médicale", n: 2 }], rect: cell(1, 0) },
  { id: "laboratoire", name: "Laboratoire", short: "Laboratoire", building: "main", floor: 1, kind: "care", icon: "flask", cases: [],
    staff: [{ role: "medecin", label: "Biologiste", n: 1 }, { role: "technique", label: "Technicien(ne) de laboratoire", n: 2 }], rect: cell(2, 0),
    note: "Les analyses restent humaines ; les résultats reçus sont rattachés au dossier par le secrétariat augmenté (A-16)." },

  // ---------------------------------------------------------------- 2nd floor
  { id: "bloc", name: "Bloc opératoire", short: "Bloc", building: "main", floor: 2, kind: "care", icon: "scalpel", cases: ["P-06", "R-02"],
    staff: [{ role: "medecin", label: "Chirurgien(ne) et anesthésiste", n: 2 }, { role: "infirmier", label: "Infirmier(ère) de bloc", n: 3 }, { role: "patient", label: "Patient(e) opéré(e)", n: 1 }], beds: 1, rect: cell(0, 0, 2, 2) },
  { id: "reanimation", name: "Réanimation et soins intensifs", short: "Réanimation", building: "main", floor: 2, kind: "care", icon: "heartbeat", cases: [],
    staff: [{ role: "medecin", label: "Réanimateur(rice)", n: 1 }, { role: "infirmier", label: "Infirmier(ère)", n: 3 }, { role: "patient", label: "Patient(e)", n: 3 }], beds: 4, rect: cell(1, 0, 2, 2),
    note: "Le soin critique reste entièrement humain ; seule la documentation est allégée (P-01, P-06)." },
  { id: "maternite", name: "Maternité", short: "Maternité", building: "main", floor: 2, kind: "care", icon: "baby", cases: [],
    staff: [{ role: "medecin", label: "Gynécologue-obstétricien(ne)", n: 1 }, { role: "infirmier", label: "Sage-femme", n: 2 }, { role: "patient", label: "Patiente", n: 2 }], beds: 3, rect: cell(0, 1, 2, 2),
    note: "L'accouchement et le suivi restent humains ; l'admission et la facturation du séjour sont augmentées (A-02, A-11)." },
  { id: "reserve", name: "Réserves et commandes d'unité", short: "Réserves", building: "main", floor: 2, kind: "care", icon: "box", cases: ["P-05"],
    staff: [{ role: "infirmier", label: "Infirmier(ère) référent(e) de réserve", n: 1 }], rect: cell(1, 1, 2, 2) },

  // ---------------------------------------------------------------- 3rd floor
  { id: "hospitalisation", name: "Unités d'hospitalisation", short: "Hospitalisation", building: "main", floor: 3, kind: "care", icon: "beds", cases: ["P-01", "P-02", "P-07", "X-08", "X-10"],
    staff: [{ role: "infirmier", label: "Infirmier(ère)", n: 4 }, { role: "aide", label: "Aide-soignant(e)", n: 2 }, { role: "medecin", label: "Médecin", n: 1 }, { role: "patient", label: "Patient(e) hospitalisé(e)", n: 6 }],
    beds: 6, rect: [-W / 2, 0, W - 1, MAIN.d - 1] },
  { id: "lits", name: "Gestion des lits", short: "Gestion des lits", building: "main", floor: 3, kind: "admin", icon: "bed", cases: ["A-20"],
    staff: [{ role: "admin", label: "Gestionnaire des lits", n: 1 }], rect: [W / 2, -Dd / 2, W - 1, Dd - 1] },
  { id: "cadres", name: "Bureau des cadres de santé", short: "Cadres de santé", building: "main", floor: 3, kind: "care", icon: "clipboard", cases: ["P-03", "P-04", "P-08", "C-02", "C-03"],
    staff: [{ role: "cadre", label: "Cadre de santé", n: 2 }], rect: [W / 2, Dd / 2, W - 1, Dd - 1] },

  // ---------------------------------------------------------------- 4th floor (v1.3): quality & patient relations, technical management
  { id: "qualite", name: "Qualité, gestion des risques et relations patients", short: "Qualité et patients", building: "main", floor: 4, kind: "admin", icon: "shield",
    cases: ["X-01", "X-02", "X-03", "X-05", "X-06", "X-07"],
    staff: [{ role: "cadre", label: "Responsable qualité et gestion des risques", n: 1 }, { role: "admin", label: "Chargé(e) des relations patients", n: 2 }],
    rect: [-W / 2, 0, W - 1, MAIN.d - 1] },
  { id: "technique", name: "Gestion technique, maintenance biomédicale et énergie (JABB Twin)", short: "Technique et énergie", building: "main", floor: 4, kind: "support", icon: "box",
    cases: ["I-01", "I-02", "I-03", "I-04", "I-05", "I-06", "I-07", "I-08", "I-09"],
    staff: [{ role: "technique", label: "Technicien(ne) biomédical(e)", n: 2 }, { role: "technique", label: "Responsable énergie et maintenance", n: 1 }],
    rect: [W / 2, 0, W - 1, MAIN.d - 1] },

  // ---------------------------------------------------------------- head-office annex (siège, Casablanca)
  { id: "siege-generaux", name: "Siège · achats, juridique, informatique, courrier", short: "Services généraux", building: "annex", floor: 0, kind: "hq", icon: "building",
    cases: ["S-11", "S-12", "S-13", "S-14", "R-03", "R-05"],
    staff: [{ role: "admin", label: "Assistant(e) achats", n: 1 }, { role: "admin", label: "Assistant(e) juridique", n: 1 }, { role: "technique", label: "Technicien(ne) support", n: 1 }, { role: "admin", label: "Agent(e) de bureau d'ordre", n: 1 }],
    rect: [0, 0, ANNEX.w - 1, ANNEX.d - 1] },
  { id: "siege-finance", name: "Siège · finance et comptabilité", short: "Finance", building: "annex", floor: 1, kind: "hq", icon: "coins",
    cases: ["S-01", "S-02", "S-03", "S-04", "S-05", "S-10", "S-15", "R-01", "I-11"],
    staff: [{ role: "admin", label: "Comptable", n: 4 }, { role: "admin", label: "Chargé(e) de recouvrement", n: 1 }, { role: "cadre", label: "Contrôleur de gestion", n: 1 }],
    rect: [0, 0, ANNEX.w - 1, ANNEX.d - 1] },
  { id: "siege-rh", name: "Siège · ressources humaines", short: "Ressources humaines", building: "annex", floor: 2, kind: "hq", icon: "users",
    cases: ["S-06", "S-07", "S-08", "S-09", "S-16", "C-01", "C-04"],
    staff: [{ role: "admin", label: "Gestionnaire paie", n: 2 }, { role: "admin", label: "Gestionnaire administration du personnel", n: 1 }, { role: "admin", label: "Chargé(e) de recrutement", n: 1 }],
    rect: [0, 0, ANNEX.w - 1, ANNEX.d - 1] },
  { id: "siege-pilotage", name: "Siège · pilotage et transformation (Agentic Command Center)", short: "Agentic Command Center", building: "annex", floor: 3, kind: "hq", icon: "compass",
    cases: ["T-01", "T-02", "T-03", "T-04", "T-05", "T-06", "T-07", "T-08", "I-10"],
    staff: [{ role: "direction", label: "Direction générale et comité de pilotage", n: 2 }, { role: "cadre", label: "Contrôleur(se) de gestion sociale", n: 1 }, { role: "cadre", label: "Chargé(e) de mobilité interne", n: 1 }],
    rect: [0, 0, ANNEX.w - 1, ANNEX.d - 1] },
];
void acell;

// ---------------------------------------------------------------- Anfa Prime Hospital (a real clinic, lib/facilities.ts)
// No plans are published: the real services (lib/data/network.json) are laid out on plausible floors and marked
// illustrative. Each department reuses the furniture of its hôpital-type equivalent (`tpl`) and, where one exists, its use
// cases, shown as an estimate (the hôpital type = the group ÷ its establishments). Plates sit inside the two pill-shaped
// volumes of city/landmarks/anfaPrimeGeo.ts; frame = the clinic's own (origin = ANFA_PRIME in city/geography.ts).
export const AP_FAC = "anfa-prime-hospital";
export const AP_W = { w: 22.8, d: 26, x: -20, z: -8 } as const;  // west volume plate (two rows of departments)
export const AP_E = { w: 16.5, d: 21.8, x: 18, z: -3 } as const; // east volume plate
export const AP_FLOORS: { building: BId; floor: number; name: string }[] = [
  { building: "ap.w", floor: 0, name: "Rez-de-chaussée · accueil, admissions, urgences" },
  { building: "ap.w", floor: 1, name: "1er étage · blocs opératoires, réanimation" },
  { building: "ap.w", floor: 2, name: "2e étage · maternité et PMA, hospitalisation" },
  { building: "ap.e", floor: 0, name: "Rez-de-chaussée · imagerie, laboratoire" },
  { building: "ap.e", floor: 1, name: "1er étage · Cardio Prime, soins intensifs" },
  { building: "ap.e", floor: 2, name: "2e étage · Onco Prime" },
];
const T = (id: string) => DEPTS.find((d) => d.id === id)!;
const ILL = "Répartition illustrative (plans non publiés).";
const wRow = (side: -1 | 1): [number, number, number, number] => [0, side * 6.5, AP_W.w - 0.2, 12.4];
const eRow = (side: -1 | 1): [number, number, number, number] => [0, side * 5.45, AP_E.w - 0.2, 10.3];
const ap = (tpl: string, o: Partial<Dept> & Pick<Dept, "id" | "building" | "floor" | "rect">): Dept =>
  ({ ...T(tpl), tpl, fac: AP_FAC, ...o, note: o.note ? `${ILL} ${o.note}` : ILL });
export const AP_DEPTS: Dept[] = [
  ap("admissions", { id: "ap.admissions", name: "Accueil et admissions", short: "Accueil · Admissions", building: "ap.w", floor: 0, rect: wRow(-1),
    cases: ["A-01", "A-02", "A-03", "A-05", "X-04"] }),
  ap("urgences", { id: "ap.urgences", name: "Urgences 24h/24, 7j/7", building: "ap.w", floor: 0, rect: wRow(1) }),
  ap("bloc", { id: "ap.bloc", name: "Blocs opératoires (14 salles dont 1 robotique)", short: "Blocs opératoires", building: "ap.w", floor: 1, rect: wRow(-1) }),
  ap("reanimation", { id: "ap.reanimation", name: "Réanimation (21 boxes dont 7 néonatalogie)", building: "ap.w", floor: 1, rect: wRow(1) }),
  ap("maternite", { id: "ap.maternite", name: "Maternité et PMA (Anfa Prime Fertility)", short: "Maternité · PMA", building: "ap.w", floor: 2, rect: wRow(-1) }),
  ap("hospitalisation", { id: "ap.hospitalisation", name: "Chambres d'hospitalisation", short: "Hospitalisation", building: "ap.w", floor: 2, rect: wRow(1), tpl: "ap-rooms",
    staff: [{ role: "infirmier", label: "Infirmier(ère)", n: 2 }, { role: "aide", label: "Aide-soignant(e)", n: 1 }, { role: "patient", label: "Patient(e) hospitalisé(e)", n: 3 }], beds: 3 }),
  ap("imagerie", { id: "ap.imagerie", name: "Imagerie (IRM 3 Tesla, scanner, radiologie interventionnelle)", short: "Imagerie", building: "ap.e", floor: 0, rect: eRow(-1) }),
  ap("laboratoire", { id: "ap.laboratoire", name: "Laboratoire", building: "ap.e", floor: 0, rect: eRow(1) }),
  ap("imagerie", { id: "ap.cardio", name: "Cardio Prime · cardiologie interventionnelle, rythmologie (2 salles de cathétérisme)", short: "Cardio Prime", icon: "heartbeat",
    building: "ap.e", floor: 1, rect: eRow(-1), cases: [],
    staff: [{ role: "medecin", label: "Cardiologue interventionnel(le)", n: 1 }, { role: "infirmier", label: "Infirmier(ère) de cathétérisme", n: 2 }, { role: "patient", label: "Patient(e)", n: 1 }],
    note: "Pôle Cardio Prime : pas d'équivalent dans l'hôpital type, donc pas de cas d'usage chiffré." }),
  ap("urgences", { id: "ap.soins-intensifs", name: "Soins intensifs (54 lits)", short: "Soins intensifs", icon: "heartbeat", kind: "care", building: "ap.e", floor: 1, rect: eRow(1), cases: [],
    staff: [{ role: "medecin", label: "Médecin intensiviste", n: 1 }, { role: "infirmier", label: "Infirmier(ère)", n: 2 }, { role: "patient", label: "Patient(e)", n: 2 }],
    note: "Le soin critique reste humain ; pas de cas d'usage propre dans l'hôpital type." }),
  ap("imagerie", { id: "ap.onco", name: "Onco Prime · radiothérapie et chimiothérapie ambulatoire (15 fauteuils)", short: "Onco Prime", icon: "heartbeat",
    building: "ap.e", floor: 2, rect: [0, 0, AP_E.w - 0.2, AP_E.d - 0.8], tpl: "ap-chemo", cases: [],
    staff: [{ role: "medecin", label: "Oncologue", n: 1 }, { role: "infirmier", label: "Infirmier(ère) d'hôpital de jour", n: 2 }, { role: "patient", label: "Patient(e) en séance", n: 4 }],
    note: "Pôle Onco Prime : pas d'équivalent dans l'hôpital type, donc pas de cas d'usage chiffré." }),
];
/** Every department of every facility (DEPTS stays the hôpital type's list: rail, search, AI knowledge). */
export const ALL_DEPTS: Dept[] = [...DEPTS, ...AP_DEPTS];

export const DEPT: Record<string, Dept> = Object.fromEntries(ALL_DEPTS.map((d) => [d.id, d]));

/** Department that hosts a use case (in the hôpital type: a case belongs to one of its departments). */
export const CASE_DEPT: Record<string, string> = Object.fromEntries(DEPTS.flatMap((d) => d.cases.map((c) => [c, d.id])));

/** Floor key used by scenes and the store: "main:0", "annex:2", "ap.w:1". */
export const floorKey = (building: BId, floor: number) => `${building}:${floor}`;
/** Plate (footprint centre and size) of a building, in its facility's frame. */
export const PLATE: Record<BId, { w: number; d: number; x: number; z: number }> = { main: MAIN, annex: ANNEX, "ap.w": AP_W, "ap.e": AP_E };

export const ROLE_LABEL: Record<Role, string> = {
  patient: "Patients et accompagnants", medecin: "Médecins", infirmier: "Infirmiers et sages-femmes", aide: "Aides-soignants",
  admin: "Administratifs", technique: "Personnel technique et hôtelier", cadre: "Cadres", direction: "Direction",
};
/** Muted, non-neon palette for roles (figures in 3D and legends). */
export const ROLE_COLOR: Record<Role, string> = {
  patient: "#C9CED9", medecin: "#F2F4F8", infirmier: "#6FB7AE", aide: "#9CC9A5", admin: "#7C93D6", technique: "#D6B47C", cadre: "#A88FD0", direction: "#E3C66E",
};
export const KIND_COLOR: Record<DeptKind, string> = { admin: "#7C93D6", care: "#6FB7AE", support: "#D6B47C", hq: "#A88FD0" };

// ---------------------------------------------------------------- front-desk AI experiences ("Expériences IA")
// Patient-facing tools at the reception and in the waiting areas. They are the visible face of use cases already in the
// business case (their savings are counted there, never twice). Naming rule: say "Expériences IA" — never "avatar" or "hôte".
export type Experience = {
  id: string; name: string; short: string; dept: string; icon: IconKey;
  what: string;          // what it does, one sentence
  patient: string;       // what the patient gets
  staff: string;         // what changes for the staff
  cases: string[];       // use cases whose figures it belongs to
};
export const EXPERIENCES: Experience[] = [
  { id: "xp-guide", name: "Guide conversationnel sur grand écran", short: "Guide IA", dept: "accueil", icon: "sparkle",
    what: "Accueille chaque visiteur à l'entrée, répond en darija, en français ou en arabe et oriente vers le bon service.",
    patient: "Une réponse immédiate, sans faire la queue pour demander son chemin.",
    staff: "L'agent d'accueil se consacre aux personnes qui ont besoin d'un humain.", cases: ["A-05", "A-06"] },
  { id: "xp-plan", name: "Plan interactif d'orientation", short: "Plan interactif", dept: "accueil", icon: "compass",
    what: "Borne tactile et QR code : l'itinéraire jusqu'au service, à la consultation ou à la chambre, sur l'écran ou sur le téléphone.",
    patient: "Il trouve seul son chemin dans l'hôpital.",
    staff: "Moins de demandes d'orientation au guichet.", cases: ["A-05"] },
  { id: "xp-borne", name: "Borne de pré-admission", short: "Borne d'admission", dept: "admissions", icon: "id",
    what: "Le patient scanne sa carte d'identité et sa carte AMO ; l'agent lit les pièces et prépare le dossier dans Oryon avant le guichet.",
    patient: "Un passage au guichet plus court, un dossier déjà prêt.",
    staff: "Le chargé d'admission vérifie et fait signer au lieu de ressaisir.", cases: ["A-01", "A-02"] },
  { id: "xp-ecrans", name: "Écrans d'information animés par l'IA", short: "Écrans d'attente", dept: "accueil", icon: "scan",
    what: "File d'attente en temps réel, appel des patients, temps d'attente estimé et rappels utiles dans la salle d'attente.",
    patient: "Il sait quand il passe et où aller.",
    staff: "Fin des appels au micro et des questions sur l'attente.", cases: ["A-05", "A-07"] },
  { id: "xp-vocal", name: "Assistant vocal du standard", short: "Assistant vocal", dept: "standard", icon: "phone",
    what: "Prend les rendez-vous, confirme, rappelle et répond 24 h sur 24 au téléphone, en darija, en français et en arabe.",
    patient: "Il obtient un rendez-vous sans attendre au téléphone.",
    staff: "Le standard traite les appels complexes et les urgences.", cases: ["A-06", "A-07"] },
  { id: "xp-devis", name: "Devis et paiement accompagnés", short: "Devis et paiement", dept: "caisse", icon: "cash",
    what: "Le devis d'intervention est préparé par l'agent et expliqué à l'écran ; la caisse est rapprochée en continu.",
    patient: "Un devis clair et rapide, un paiement sans erreur.",
    staff: "Le facturier vérifie et signe ; la clôture de caisse est préparée.", cases: ["A-15", "A-12"] },
];
export const XP: Record<string, Experience> = Object.fromEntries(EXPERIENCES.map((x) => [x.id, x]));
