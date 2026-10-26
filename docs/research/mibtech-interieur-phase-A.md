# MIBTECH — intérieur 3D : audit et stratégie (phase A)

Date : 26/10/2026 · branche `feat/anfa-prime-hospital` (propre, 3 commits locaux non poussés) · aucune modification de code dans cette phase.

## 1. Les trois plans (MB Interior Architects, APS, « plan cotation », 16/10/2024, « NO SCALE »)

| | 1er étage | 2e étage | 3e étage |
|---|---|---|---|
| Format | A3 paysage, export ArchiCAD (GSPublisher) | idem | idem |
| Éléments vectoriels | 6 273 | 6 619 | 8 695 |
| Textes (cotes) | 209 | 238 | 317 |

**Unités** : centimètres, avec un exposant pour le demi-centimètre (« 670⁵ » = 670,5 cm) ; le point est un séparateur de milliers (« 2.948 » = 2 948 cm = 29,48 m). Les cotes de 10 cm sont les cloisons.
**Échelle** : « NO SCALE » ; le rapport papier/réel sera calé par moindres carrés sur des dizaines de chaînes de cotes (≈ 4,29 cm réels par point PDF sur la façade de 29,48 m), et l'écart cote par cote sera rapporté.
**Calques exploitables** (vérifié par rendu) : murs maçonnés (contour noir épais + hachures rouges), cloisons (doubles traits noirs), poteaux (aplats noirs, ronds ou rectangulaires), noyau escalier + ascenseur (traits noirs épais), fenêtres (interruptions des murs hachurés), portes (arcs de débattement), cotes (traits orange + textes positionnés).
**Alignement vertical** : même mise en page sur les trois planches (noyau escalier/ascenseur aux mêmes coordonnées) → superposition directe, à confirmer par le recalage de l'escalier et des poteaux.

### Lecture architecturale

- **Orientation** : le bas de la planche est la façade sur le boulevard Mahdi Elmandjra (mur-rideau sur ≈ 29,5 m, angle vitré au sud-ouest), cohérent avec les photos et la vue aérienne ; le haut de la planche est le nord-ouest.
- **Emprise** : un plateau rectangulaire côté rue (29,48 m × ≈ 9,7 m de plateau ouvert + une bande centrale) prolongé vers l'arrière par un volume **irrégulier à murs obliques**, avec fenêtres, deux poteaux ronds et des poteaux rectangulaires. La vue aérienne l'avait sous-estimé (« annexe 11 × 9 m ») : l'emprise du modèle actuel sera **remplacée** par celle des plans.
- **1er étage** : contour extérieur plus grand (pointe au nord-ouest, grand triangle à l'est) dont le tracé devient pointillé aux 2e et 3e étages → **probablement une terrasse** sur la dalle du 1er étage (à confirmer).
- **Noyau** au centre : escalier à volées (marches dessinées) + ascenseur (cage en traits épais), sanitaires (cabines WC répétées : 95 / 93⁵ cm), même position aux trois niveaux.
- **Aménagements différents par étage** : 1er = grand plateau ouvert + salles ; 2e = plateau ouvert + salles en partie arrière + cloison vitrée en angle est ; 3e = rangée de 5 bureaux cloisonnés sur la façade (≈ 4,04 m chacun), salles centrales, bureaux et rangements à l'arrière.

### Ce que les plans ne donnent pas (à ne pas inventer)

| Manque | Traitement proposé |
|---|---|
| Hauteurs d'étage, sous-plafond, dalle | provisoire : 3,8 m entre planchers (estimé d'après les photos), faux plafond 2,8 m — marqué « provisoire » |
| Nom des pièces | désignation neutre : « plateau ouvert », « pièce cloisonnée », « sanitaires », « escalier », « ascenseur » ; fonctions à confirmer |
| Mobilier | aucun sur les plans (hors blocs dessinés le long de certains murs) : mobilier « proposé », signalé comme tel, jamais présenté comme le plan de l'architecte |
| Matériaux intérieurs | aucune photo, rendu ni carnet de finitions : bibliothèque **provisoire** neutre (sol, enduit, vitrage, menuiseries), chaque matériau avec son statut |
| Marches de l'escalier | nombre et giron comptés sur le dessin ; hauteur de marche = hauteur d'étage provisoire / nombre de contremarches |
| Rez-de-chaussée | pas de plan (commerces + entrée des bureaux, d'après les photos) : hall d'entrée provisoire reliant le portail au noyau |

## 2. Audit du dépôt (ce qui sera réutilisé)

| Besoin | Existant |
|---|---|
| Position et repère | `lib/geo/casaFrame.ts` `geoToScene` (x = est, z = sud, nord = −z, mètres) ; bâtiment Mibtech actuel : `city/landmarks/MibtechBuilding.tsx` (façade d'après photos, emprise estimée) |
| Caméra | `lib/rig.ts` (vols log, `zoomAt`), une seule caméra — pas de second système |
| Sélection, fiches, explorateur | `useApp` (`landmark` « mibtech »), `PlacesExplorer`, `LandmarkView` |
| Étages d'un établissement | modèle Anfa Prime : `AnfaPrimeFloors.tsx` (`AP_VIEW` : étage ouvert, étages supérieurs écartés, coque estompée) → même principe pour Mibtech (coupe sans dupliquer la géométrie) |
| Marche à pied | `walk/WalkWorld.tsx` + `walk/colliders.ts` : colliders en boîtes orientées (`Col`, avec lacet), sol par dalles/rampes d'escalier, mais **câblé sur l'hôpital** (`BId` = main / annex, repère campus, tours d'escalier vitrées) |
| Matériaux | textures procédurales canvas (`zoneMaterials`, `texturePaint`), éclairage `ENV.night`, fondu `lmOpacity`/`setFade` |

## 3. Stratégie de reconstruction (phases B à L)

1. **Extraction (script Python, comme les extracteurs OSM du dépôt)** `docs/research/mibtech-plan-extract.py` : lit les PDF, classe les calques, reconstruit murs (polygones), cloisons, poteaux, ouvertures, portes, escalier, et associe chaque cote texte à sa ligne de cote ; cale l'échelle par moindres carrés ; écrit `components/scenes/city/landmarks/mibtech/mibtechPlanData.ts` (données seules) + un rapport d'écarts par cote.
2. **Vérification** : rendu orthographique vu de dessus de chaque étage, superposé au plan PDF à la même orientation ; tableau des écarts mesurés.
3. **Modèle de données** `mibtechData.ts` : bâtiment, étages (élévation provisoire), murs, ouvertures, poteaux, escalier, pièces, statut de chaque élément (« plan » / « provisoire »).
4. **Géométrie** `MibtechArchitecture` : murs extrudés aux vraies épaisseurs avec jonctions, ouvertures percées, dalles, poteaux, noyau et escalier (marches comptées), garde-corps ; géométrie fusionnée par matériau et par étage.
5. **Extérieur** : la coque de `MibtechBuilding` reprend l'emprise des plans (contour du 2e étage pour les étages courants, débord et terrasse du 1er), garde la façade d'après photos (ailettes, mur-rideau, portail).
6. **Intérieur** `MibtechFurniture` (proposé, instancié), `MibtechMaterials` (bibliothèque avec statut), éclairage intérieur intégré au jour/nuit.
7. **Étages et coupe** : sélecteur « 1er · 2e · 3e » dans la fiche Mibtech ; étage ouvert, étages supérieurs écartés, coque estompée (principe Anfa Prime).
8. **À pied** : généraliser le contrôleur (enregistrer un « bâtiment marchable » : colliders orientés, fonction de sol avec dalles + escalier, point d'entrée au portail) sans changer le comportement de l'hôpital ; entrée depuis l'explorateur ou la fiche.
9. **Contrôles** : TypeScript, build, tests navigateur (chargement, étages, marche, collisions, escalier, transitions ville ↔ bâtiment, performances).

Livraison par lots, chacun testé et committé localement : (1) extraction + vérification des trois plans ; (2) coque et étages vides ; (3) escalier, portes, coupe et sélecteur ; (4) marche à pied ; (5) mobilier, matériaux, éclairage.

## 4. Avancement (26/10/2026) et questions ouvertes

| Lot | État |
|---|---|
| 1 · Extraction des 3 plans | fait — échelle 4,346 cm/pt ; 384 cotes sur 387 à moins de 2 cm (médiane 1 mm) ; noyau escalier/ascenseur superposé à ±1 mm ; dalles 837,5 m² (1er) et 660,5 m² (2e, 3e) ; l'emprise coïncide avec le toit vu sur la vue aérienne |
| 2 · Coque et étages | fait — murs, fenêtres, vitrages, cloisons, cabines WC, portes, poteaux, ascenseur, dalles, plafonds, toitures ; façade sur rue d'après photos |
| 3 · Escalier, sélecteur, coupe | fait — escalier tel que dessiné, trémie, sélecteur « Bâtiment · 1er · 2e · 3e » avec coupe |
| 4 · Marche à pied | fait — contrôleur de l'hôpital généralisé à un second site (`walk/mibtechWalk.ts`) : entrée par le portail sur le boulevard, hall provisoire, escalier (montée et descente vérifiées), ascenseur (E), coupe des étages supérieurs et des murs à 2,30 m en 3e personne, bouton « Visiter à pied » sur la fiche ; marche de l'hôpital inchangée |
| 5 · Mobilier, matériaux, éclairage | fait (provisoire pour l'éclairage) — mobilier des plans électriques (20/10/2024, `docs/research/mibtech-furniture-extract.py`) ; finitions d'après les photos de bureau (procédurales, sans marque) |

### Plans électriques (« PLAN ELEC », APS du 20/10/2024)

Même mise en page que les plans cotés (noyaux, murs et hachures aux mêmes coordonnées, vérifié) avec deux calques en plus : mobilier (traits gris + aplats blancs) et électricité (prises de sol RJ45 / HDMI, en bleu). Mobilier lu : 1er étage 140 postes, 168 sièges, 5 tables, 7 tables de terrasse et 21 assises, 9 plantes, 7 WC ; 2e étage 128 postes, 168 sièges, 12 tables ; 3e étage 42 postes, 103 sièges, 23 tables, 11 fauteuils, 1 canapé. Les silhouettes humaines dessinées ne sont pas reprises.
**Terrasse** : la couronne extérieure du 1er étage porte des tables rondes, des assises d'extérieur et des plantes, à l'extérieur du mur fenêtré des bureaux → terrasse sur le toit du rez-de-chaussée (garde-corps 1,10 m provisoire, sans plafond). Aucune porte vers la terrasse n'est identifiée sur les plans : elle n'est pas accessible à pied pour l'instant.

### Finitions (photos de bureau fournies, références seulement)

Sol en grands carreaux gris clair veinés (≈ 60 × 120 cm) ; murs blancs, plinthe gris clair ; faux plafond 60 × 60 avec dalles LED et diffuseurs ; portes en placage bois foncé ; cloisons vitrées à cadre noir fin et film dépoli à lignes ondulées verticales ; postes à plateau grège, piètement noir, écrans de séparation et caissons noirs ; sièges résille noire ; moquette gris-vert dans les salles de réunion (pièce de chaque table entourée d'au moins 4 sièges, calculée sur le plan) ; kitchenette blanc brillant et plan de travail noyer ; terrasse en carrelage gris. Non placés faute de savoir où : marbre et micro-béton des sanitaires, signalétique.
Photos suivantes (26/10/2026) : écran mural à cadre blanc + barre de son dans les salles de réunion ; séparateurs de postes grège, caissons noirs ou blancs ; stores beiges ; escalier en granit sombre et garde-corps à barreaux noirs ; ascenseur inox brossé (portes, voyant) ; **hall d'entrée réel** : sol marbre gris clair poli, lambris bois, marbre noir veiné, mur blanc à bandes LED verticales, plafond blanc à fentes lumineuses, 3 portiques d'accès inox (plateaux verre noir, battants verre, LED bleue), banque d'accueil bois. L'implantation du hall (aucun plan) reste estimée.

**Questions pour l'architecte / le maître d'ouvrage**
1. Hauteurs : rez-de-chaussée, entre planchers, sous plafond (provisoire 4,6 / 3,8 / 2,8 m). L'escalier dessiné (28,2 cm de giron) suggère plutôt ≈ 3,5 m entre planchers.
2. Escalier : 2 volées de 7 marches par étage donnent des contremarches de 23,75 cm avec 3,8 m (21,9 cm avec 3,5 m) : le dessin APS est-il schématique ?
3. 1er étage : la couronne extérieure est une terrasse d'après le mobilier des plans électriques ; par où y accède-t-on (porte-fenêtre) ? Hauteur et type du garde-corps ?
4. Rez-de-chaussée : plan du hall des bureaux (accès depuis le portail jusqu'au noyau) — un hall provisoire est modélisé.
5. Finitions intérieures : photos reçues ; reste à savoir quelles pièces ont quelles finitions (sanitaires, bureaux fermés) et le plan d'éclairage.
6. Usage des pièces (aucun nom sur les plans cotés).
