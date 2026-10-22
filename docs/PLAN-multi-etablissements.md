# Plan : moteur multi-établissements (Anfa Prime d'abord, puis le réseau Akdital)

Branche : `feat/anfa-prime-hospital` (partie de `wip/humans-casablanca-bridge`). Rien n'est fusionné dans `main` ni dans
`wip/…` sans l'accord de Mounsef. Rédigé le 22/10/2026.

## Objectif
Donner à Anfa Prime Hospital **exactement** l'expérience de l'hôpital type : étages et repères de services, intérieurs meublés
et peuplés (kit `human.ts`), vols de caméra, panneau service avec ses cas d'usage, mode « À pied » (même avatar, mêmes portes,
escaliers, collisions, touche E). Ensuite, ajouter les autres établissements de Casablanca par **données** (une fiche chacun).

## Décisions validées (Othmane, 22/10)
1. **Moteur multi-établissements** (pas de copie) : chaque établissement = une fiche `Facility`.
2. **Étages provisoires « illustratif »** : services réels d'Anfa Prime (network.json) répartis sur des étages plausibles,
   marqués hypothèse, remplacés dès réception des plans (demande prête pour Akdital / ATP).
3. **Chiffres** : chaque service reprend les cas d'usage du service équivalent de l'hôpital type, affichés comme
   « estimation · hôpital type » (même règle que la fiche réseau : groupe ÷ établissements, `agg(…, perSite)`). Aucun chiffre inventé.
4. **Casablanca d'abord** ; les autres villes plus tard.

## Principe : rétrocompatibilité totale de l'hôpital type
- L'hôpital type garde tous ses identifiants : bâtiments `main` / `annex`, étages `main:0`, services `admissions`,
  personnes `admissions/admin/0`, cas `A-02`. Visites guidées, IA, données et `CASE_DEPT` continuent de fonctionner.
- Un nouvel établissement préfixe ses jetons avec `.` (jamais `/` ni `:` en plus, que le code découpe déjà) :
  bâtiments `ap.w`, `ap.e` → étages `ap.w:0` ; services `ap.urgences` → personnes `ap.urgences/infirmier/0`.
- `DEPTS` reste la liste de l'hôpital type (rail, recherche, connaissances IA inchangés) ; `DEPT` (recherche par id) couvre
  tous les établissements ; `ALL_DEPTS` en plus. Les cas restent globaux ; `caseDept(cas, fac)` remplace `CASE_DEPT`
  là où l'établissement courant compte.
- Le store gagne `fac` (établissement courant, `"type"` par défaut), déduit de la sélection.

## Modèle de données (nouveau `lib/facility.ts`)
`Facility { id, prefix, name, origin {x,z,yaw}, offset, buildings: BuildingSpec[], floors: FloorSpec[], depts, walk {…}, overview }`
- `BuildingSpec { id, label, x, z, w, d, floors, facade: "main"|"annex"|"shell", roof, tower? }`
  (`shell` = l'extérieur est dessiné par le monument de la ville, ex. `landmarks/AnfaPrime`).
- `Dept` gagne `fac` et `tpl` (service de l'hôpital type dont on reprend l'aménageur de mobilier, les cas et l'effectif).

## Anfa Prime (fiche provisoire, « illustratif »)
- 2 volumes : ouest ≈ 20 × 32 m utiles, est ≈ 18 × 20 m utiles, 3 niveaux chacun (RDC, 1er, 2e ; pas de sous-sol, le sol
  de la ville est opaque hors du campus de l'hôpital type).
- Services réels (network.json) : urgences 24/7, imagerie (IRM 3T, scanner, radiologie interventionnelle), laboratoire,
  blocs (14 dont 1 robotique), réanimation (21 boxes dont 7 néonat), soins intensifs (54 lits), maternité & PMA,
  Onco Prime, Cardio Prime (+ accueil/admissions).
- Les aménageurs larges de l'hôpital type (bloc, réa, maternité…, 25 m) ne rentrent pas dans les plateaux d'Anfa :
  aménageurs compacts dédiés (bloc robotique, réa néonat, salle de cathétérisme, radiothérapie, ~50 lignes chacun).

## Étapes
**Jalon A : étages, repères, panneau** (≈ 18-20 fichiers, ~1 000 lignes)
0. Données : `lib/facility.ts`, `lib/hospital.ts` (`DEPT` global, `caseDept`, `floorKey(b: string)`), fiche Anfa.
1. Aménagement : `layout.ts` `build(fac)` (plateaux depuis la fiche, seuils d'agents calculés par établissement).
2. Navigation : `nav.ts` (`toWorld(v, fac)` avec `"type"` par défaut), `mats.ts` (`rt.roots`), `Focus.tsx`,
   `HospitalContent.tsx` → `<FacilityContent fac>`, `UnifiedWorld.tsx`.
3. Rendu : `Floor.tsx` (façade `shell` = dalle + intérieur + zone cliquable), `StairTower`, `Overlay` (repères depuis la
   fiche), `FloorProps` / `Crowd` (plateau depuis l'étage), `AnfaPrime.tsx` (la résille s'efface quand on ouvre un étage).
4. Panneaux : `Sidebar.tsx` (rail des étages de l'établissement courant), `views.tsx` (fil d'Ariane, vues étage/service,
   mention « estimation · hôpital type »), `fmt.ts`, `Search.tsx`, `Shortcuts.tsx`.
5. Routage des cas : `store.ts` (`fac`), `caseDept()` dans `nav`, `actions`, `Sidebar`, `views`.

**Jalon B : mode « À pied »** (≈ 9 fichiers, ~700 lignes)
6. `plan.ts` → plan par établissement (tours d'escalier, portes, point d'apparition devant le portail) ;
   `colliders.ts` → fabrique par établissement ; `WalkWorld.tsx` (`enter(fac)`, E → service + cas) ; `Visitor`, `WalkHud` ;
   `anfaPrimeSolids` : murs avec portes au lieu de blocs pleins.

**Jalon C : finitions** (~300 lignes) : déambulations dans les couloirs, détails des salles, ombres qui suivent l'établissement actif.

## Risques et parades
| Risque | Parade |
|---|---|
| Conflits avec le travail en cours de Mounsef sur `wip/…` | Le prévenir avant le jalon A ; commits petits et lisibles ; rebase régulier |
| Singletons construits à l'import (`FLOOR_LAYOUTS`, collisions, `DESK_ID`, `rt.root`) | Construction par établissement, mise en cache ; l'hôpital type construit en premier (mêmes ids, mêmes seuils) |
| `CASE_DEPT` qui renvoie tout vers l'hôpital type | `caseDept(cas, fac)` partout où l'établissement courant compte |
| Résille et noyau opaques qui cachent l'intérieur | Fondu du monument quand un étage est ouvert ou la caméra proche |
| Performance (ville déjà lourde) | Étages d'Anfa montés seulement quand on est sélectionné ou proche |
| Ombres limitées à ±80 m autour de l'origine | Jalon C : la lumière suit l'établissement actif |

## Vérification à chaque jalon
`npx tsc --noEmit -p .` ; parcours manuel de l'hôpital type (visite express, sélection de services, mode à pied, touche E)
pour prouver qu'il n'a pas bougé ; captures d'Anfa Prime (étages ouverts, panneau, mode à pied).
