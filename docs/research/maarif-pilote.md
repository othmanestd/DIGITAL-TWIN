# Pilote Maârif / Twin Center — dossier de données et de fidélité

Branche `feat/anfa-prime-hospital` · 23 octobre 2026 · données OpenStreetMap extraites le même jour.

## 1. Objet

Premier quartier de Casablanca reconstruit à partir de données réelles, autour du Twin Center : Maârif, Racine et Gauthier
(sud et ouest des tours). Le but est double :

- **géographique** : empreintes, rues, orientation et distances réelles ;
- **visuel** : façades, rez-de-chaussée, toits et mobilier urbain plus crédibles.

Tout ce qui n'est pas documenté est signalé comme estimé ou illustratif.

## 2. Sources

| Donnée | Source | Détail |
|---|---|---|
| Bâtiments, rues, espaces verts, arbres, passages piétons, feux, arrêts de bus, lieux nommés | OpenStreetMap, API principale `api/0.6/map` | bbox `-7.64050,33.58047,-7.62495,33.59243`, extraite le 23/10/2026 (Overpass était surchargé) |
| Twin Center | OSM : nœud « Twin Center » 770235536 ; West Tower (way 97667268) ; East Tower (way 75698627) | 115 m, 28 niveaux, façade béton blanc (tags OSM `height`, `building:levels`, `building:facade:*`) |
| Podium du Twin Center | OSM : ways 416499076, 416499077, 416499078 | commerce, 4 niveaux, façade blanche |
| Licence | © contributeurs OpenStreetMap, ODbL 1.0 | mention affichée à l'écran avec lien vers https://www.openstreetmap.org/copyright |

Pour régénérer les données :

```bash
curl -o map.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-7.64050,33.58047,-7.62495,33.59243"
python3 docs/research/osm-zone-extract.py map.osm components/scenes/city/landmarks/zones/maarifData.ts \
  --name MAARIF --lat 33.5865844 --lon -7.6322923 --box -642.5 557.5 -525 555
```

## 3. Placement dans la scène

- **Repère local** : mètres, x vers l'est, z vers le sud. L'origine est le nœud OSM « Twin Center ». La projection est équirectangulaire à la latitude d'origine.
- **Ancrage** : l'origine est posée sur le centre existant du Twin Center de la scène, `(−857,5 ; 585)`. Le reste est une simple translation, puisque le nord de la scène est déjà −z.
- **Emprise** (monde) : x −1500 → −300, z 60 → 1140, soit 1,2 × 1,08 km. Les bords tombent sur les lignes de la grille de 120 m. La ville générée s'arrête donc proprement sur ses rues.
- **Limite connue** : la ville n'est pas géoréférencée (voir `PROPOSITION-georeferencement.md`). Le quartier est donc juste en lui-même, mais sa distance aux autres monuments (CFC, mosquée…) reste fausse.

## 4. Ce qui est dessiné, et à quel niveau de fidélité

| Niveau | Contenu | Nombre |
|---|---|---|
| **A — documenté** | Les 2 tours du Twin Center sur leurs empreintes OSM (position, orientation, 27,2 × 26,5 m et 30,7 × 28 m, 115 m) et le podium en chevron (4 niveaux OSM) | 2 + 3 |
| **B — empreinte + étages OSM** | Bâtiments sur leur contour réel, hauteur = `building:levels` × 3,2 m + 1,4 m | 596 |
| **C — empreinte seule** | Contour réel, étages **estimés** : 6 pour les immeubles (le mode des étages cartographiés), 4 pour `building=yes`, 2 pour villas, écoles et commerces | 354 |
| **C — volume illustratif** | Rues cartographiées **sans aucune empreinte** à moins de 18 m : volumes de façade de 11 à 18 m × 13 à 16 m, 4 à 6 niveaux. **Ce ne sont pas des bâtiments réels.** | 422 |
| Non dessinés | Bâtiments OSM sous le boulevard du tram de la scène (voir §6) | 86 |

Détails urbains :

| Élément | Origine | Statut |
|---|---|---|
| Rues, largeurs | OSM (`highway`, `lanes`, `oneway`) | tracé réel ; largeur estimée à 3,3 m par voie |
| Passages piétons | OSM (`highway=crossing`) | 238, positions réelles |
| Feux tricolores | OSM | 14, positions réelles |
| Arrêts de bus | OSM | 14, positions réelles ; abri illustratif |
| Arbres | OSM (`natural=tree`, `tree_row`) | 281 arbres et 7 alignements réels ; dans les parcs et jardins, arbres semés (illustratif) |
| Vitrines en rez-de-chaussée | point OSM commerce / bureau / café / banque dans l'empreinte | 194 bâtiments au total. Le décompte ne sépare pas ces deux causes : |
| | **et** une partie des immeubles en bord de boulevard sans point OSM | ce second cas est illustratif |
| Lampadaires | aucun dans OSM sur la zone | 207, **illustratifs** (tous les 30 m sur les rues principales) |
| Bordures de trottoir | dérivées des rues | coupées aux carrefours |

Façades : ce sont des **typologies** du quartier, pas des relevés bâtiment par bâtiment :

- balcons ;
- fenêtres en bandeau (années 1950–70) ;
- loggias ;
- hautes baies à balconnets en fer forgé (années 1930–50).

Chaque typologie existe en blanc ou en crème. Le rez-de-chaussée a un soubassement, une porte et des fenêtres à barreaux, ou des vitrines avec stores. Les toits-terrasses ont un parapet, une cage d'escalier, des paraboles et des chauffe-eau. Toutes ces textures sont procédurales ; il n'y a ni photo ni logo.

## 5. Corrections du Twin Center

- **Modèle conservé** : façades peintes, gradins vitrés, couronnes, « inwi ». Chaque tour est désormais posée sur **son** empreinte OSM, mise à l'échelle de celle-ci.
- **Écart corrigé** : le premier modèle espaçait les tours de 67 m entre centres. OSM donne environ 46 m, soit environ 18 m entre les façades.
- **Orientation** : les deux tours sont légèrement tournées l'une par rapport à l'autre (−6° et +8° par rapport au nord).
- **Podium** : l'ancien podium rectangulaire de 150 × 46 m, l'escalier et le mât n'avaient pas de source. Ils sont remplacés par les 3 ailes commerciales d'OSM, avec une hauteur d'étage estimée à 4,4 m.
- **Couronne « inwi »** : **retirée** le 23/10 (règle : aucune publicité dans la ville 3D). Les deux tours portent la même couronne en pierre neutre ; c'est un traitement simplifié.

## 6. Compromis : le boulevard du tram de la scène

Le plan de ville de Moncef a une ligne de tram sur le boulevard z = 780. Elle a ses véhicules, ses arrêts et ses caténaires, et elle traverse l'emprise du pilote. Pour ne rien casser, ce boulevard est gardé. **86 bâtiments OSM qui le chevauchent ne sont pas dessinés.**

Ce tram n'existe pas à cet endroit en réalité. Le géoréférencement (proposition A) le remplacerait par les vraies lignes T1 et T2.

## 7. Lacunes connues
- **Hauteurs** : OSM ne donne une hauteur mesurée que pour les 2 tours. Toutes les autres viennent du nombre d'étages, ou sont estimées.
- **Hôpital Privé International de Casablanca** : il est hors de l'emprise (x < −642 m).
- **Mosquée Al Andalous** : elle est dessinée comme un bâtiment générique, car il n'y a pas de donnée de minaret dans OSM. Elle est étiquetée.
- **Cliniques** : Racine, Les Iris, Al Massira et la Polyclinique Atlas ne sont qu'étiquetées, sans modèle spécifique.

## 8. Mesures de rendu (navigateur intégré, panneau 800 × 1216)

Les triangles incluent la passe d'ombre. Les mêmes points de vue ont été mesurés avant et après le pilote.

| Vue | Appels de dessin avant → après | Triangles avant → après |
|---|---|---|
| Casablanca (6 km) | 1 508 → 1 566 | 1,40 M → 1,57 M |
| Twin Center (300 m) | 766 → 854 | 9,46 M → 9,95 M |
| Hôpital type (250 m) | 1 546 → 1 606 | 9,60 M → 10,07 M |
| CFC (900 m) | 750 → 738 | 10,24 M → 9,89 M |

- **Coût du quartier seul** : environ 267 000 triangles en tout.
- **Répartition** : environ 45 maillages fusionnés par matériau, et 3 maillages instanciés pour les lampadaires.
- **Niveau de détail selon la distance** : les détails (bordures, toits, ombres, lampadaires) disparaissent au-delà de 1,4 km ou de 1,3 km d'altitude.
- **Images par seconde** : non mesurées de façon fiable. Le navigateur intégré ralentit le rendu quand son panneau n'est pas au premier plan.

## 9. Fichiers

- **Données** :
  - `components/scenes/city/landmarks/zones/maarifData.ts` (généré) ;
  - `zones/types.ts` ;
  - `docs/research/osm-zone-extract.py`.
- **Plan** :
  - `components/scenes/city/osmZonePlan.ts` (rues, arbres, volumes illustratifs) ;
  - `maarifZone.ts` ;
  - `geography.ts` (`MAARIF_DISTRICT`, `inMaarif`) ;
  - `plan.ts`.
- **Rendu** :
  - `landmarks/zoneGeo.ts` (générateur générique de zone) ;
  - `landmarks/OsmZoneDistrict.tsx` (composant générique) ;
  - `landmarks/MaarifDistrict.tsx` (configuration du Maârif) ;
  - `landmarks/TwinCenter.tsx` et `twinCenterGeo.ts` (placement OSM) ;
  - `landmarks/OsmCredit.tsx`.
- **Partagés avec le CFC** :
  - `landmarks/zoneKit.ts` (primitives) ;
  - `landmarks/zoneMaterials.ts` (matériaux) ;
  - `landmarks/cfcPaint.ts` (peintres de façades).
