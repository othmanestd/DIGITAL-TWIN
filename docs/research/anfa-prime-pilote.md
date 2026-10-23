# Pilote « Casa réel » : Anfa Prime et ses abords

Branche `feat/anfa-prime-hospital`, 23/10/2026. Données OpenStreetMap extraites le même jour. Rien n'est poussé ni déployé.

## 1. Diagnostic de départ (constaté dans le code)

- **Repère** : mètres, x vers l'est, z vers le sud, nord vers −z. L'origine est l'hôpital type, que la carte du Maroc place à `CASA_LONLAT = (33.5731, −7.5898)` (`lib/geo/projection.ts`). Il n'existe pas d'autre conversion GPS → scène.
- **La grille de 120 m n'est pas qu'un outil de chargement** : elle **impose** les rues et les îlots de la ville générée (`plan.ts`). Les quartiers OSM (CFC, Maârif, Anfa Prime) s'y insèrent comme des emprises calées sur les lignes de la grille. Leurs empreintes ne sont **jamais déplacées** pour s'aligner sur la grille : seuls les bords de l'emprise le sont.
- **Inventaire par secteur** :

| Secteur | Données réelles | Généré | Modèles manuels | Hauteurs |
|---|---|---|---|---|
| CFC | 136 bâtiments OSM, rues, parc, T2 | — | 9 tours d'après sources | documentées pour les tours, estimées ailleurs |
| Maârif | 957 bâtiments OSM, rues, arbres, passages | 422 volumes illustratifs | Twin Center | 596 en étages OSM, 354 estimées |
| Anfa Prime (ce pilote) | 242 bâtiments OSM, rues, piscines | arbres de jardin (illustratifs) | Anfa Prime (d'après les photos ATP) | 25 en étages OSM, 216 estimées |
| Reste de la ville | — | tout | mosquée, El Hank, hippodrome, Ligue arabe | — |

- **Positions incertaines** : la ville n'est pas géoréférencée (voir `PROPOSITION-georeferencement.md`). Chaque quartier est juste en lui-même, mais pas sa distance aux autres.

## 2. Validation de la parcelle et de l'orientation (sources réutilisables)

| Élément | Source | Statut |
|---|---|---|
| Boulevard Ghandi | OSM ways 338743767, 103006811… (`primary`, double chaussée) | vérifié par source |
| Rond-point Ghandi / Abdelkrim El Khattabi (R320) | OSM way 411193094 et voisins (`junction=roundabout`) | vérifié par source |
| Parcelle de la clinique | OSM way 1432538704, `landuse=construction`, 4 974 m², triangle bordé par Ghandi au sud-ouest et par deux rues de desserte | vérifié par source : c'est la parcelle **telle que cartographiée**, comme chantier |
| L'hôpital est bien sur cette parcelle | La capture 09 (Google Maps) pointe à environ 35 m du centre de la parcelle ; l'article Akdital donne le boulevard Ghandi | **recoupement, pas une preuve cadastrale** |
| Orientation | Ghandi suit un cap de 121,7° devant la parcelle → façade tournée vers le sud-ouest, rotation −31,7° | calculé depuis OSM |
| Accès | Entrée côté Ghandi (photos ATP, capture 09) | observé, à confirmer |

Le bâtiment livré n'est **pas encore dans OSM** : la parcelle y figure comme chantier. Je la dessine comme le parvis de l'hôpital, et le modèle Anfa Prime s'y pose.

## 3. Ce qui change dans la scène

- **Anfa Prime** :
  - le modèle (inchangé) est **tourné à l'orientation réelle** et posé dans la parcelle. 99 % de l'emprise de ses deux volumes tient dans la parcelle OSM (vérifié numériquement) ;
  - la clôture avant, les pelouses et les plantations du modèle sont **recadrées sur la parcelle**, avec 1,5 m de tolérance ;
  - les collisions « À pied », les vols caméra (sélection de l'établissement, des étages et des services) et l'étiquette suivent la rotation ;
  - la position reste ancrée au même point de la scène (pas de géoréférencement).
- **Abords réels (OSM)** :
  - le boulevard Ghandi, le boulevard Abdelkrim El Khattabi et son rond-point, les rues de desserte ;
  - 242 bâtiments, essentiellement les villas d'Anfa, avec 28 piscines OSM ;
  - 41 passages piétons, 9 feux et 2 arrêts de bus.
- **Établissements nommés** : la **Clinique Longchamps** (OSM : `operator=Akdital`, 4 bd Ghandi) et la Clinique Ghandi sont étiquetées.
- **Typologie** : c'est un quartier de villas. Je n'ajoute aucun volume illustratif. Un bâtiment `building=yes` sans étages est estimé en villa de 2 niveaux (moins de 700 m²), sinon en bâtiment de 3 niveaux.
- **Végétation** :
  - réelle : les 9 alignements d'arbres OSM ;
  - illustrative : 2 à 4 arbres ou palmiers par villa, puisque OSM ne cartographie pas les jardins privés.
- **Lampadaires** : 78, illustratifs (OSM n'en a aucun ici).

## 4. Hors périmètre : publicité

- La couronne « inwi » du Twin Center (bandeau de marque et antennes ajoutés sans source) est retirée. Les deux tours portent la même couronne en pierre neutre ; c'est un traitement **simplifié**, signalé comme tel.
- Aucune autre surface publicitaire n'existe dans les modèles : les vitrines n'ont ni texte ni marque.
- La signalétique AKDITAL d'Anfa Prime (identité utile au parcours) est conservée.

## 5. Simplifications et incertitudes restantes

- **Forme du bâtiment** : le modèle Anfa Prime est une reconstitution d'après les photos ATP. Ses deux volumes, côte à côte, ne suivent pas exactement le triangle de la parcelle, qui s'étire vers l'arrière-gauche. Il faudrait le plan d'implantation réel (Akdital ou ATP).
- **Plans intérieurs** : ils restent illustratifs. Rien n'est déduit des 191 lits.
- **Hauteurs** : 216 des 242 bâtiments ont un nombre d'étages estimé.
- **L'hippodrome réel** est à environ 400 m au nord-est, hors de l'emprise ; celui de Moncef reste à sa place générée. Le géoréférencement le résoudrait.
- **Raccord** : l'emprise (720 × 600 m) s'arrête sur les rues de la grille générée, ce qui donne un raccord net avec la ville générée.

## 6. Vérifications exécutées

- `npx tsc --noEmit -p .` : il passe (sauf l'erreur connue `app/layout.tsx`).
- `npm run build` : voir le récapitulatif du commit.
- **Visuel**, à cadrage identique avant/après (vue à 420 m au-dessus d'Anfa Prime) :
  - avant : 636 appels de dessin, 9,46 M triangles ;
  - après : 682 appels de dessin, 9,45 M triangles (navigateur intégré, ombres comprises).
- **Passage ville → hôpital** : la sélection d'Anfa Prime fait atterrir la caméra face à l'entrée, côté Ghandi. Le panneau et les étages s'ouvrent.
- **Mode « À pied »** : il démarre normalement (parvis de l'hôpital type). Téléporté devant Anfa Prime, le promeneur avance droit vers l'entrée et s'arrête au bloc d'entrée : les collisions tournées fonctionnent.
- **Images par seconde** : non mesurées de façon fiable (le navigateur intégré ralentit le rendu en arrière-plan).

## 7. Régénérer

```bash
curl -o map.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-7.66377,33.57734,-7.65383,33.58472"
python3 docs/research/osm-zone-extract.py map.osm components/scenes/city/landmarks/zones/anfaPrimeData.ts \
  --name ANFA_PRIME_ZONE --lat 33.5820211 --lon -7.6594471 --box -294.5 425.5 -176 424
```

L'origine est le centroïde de la parcelle OSM 1432538704.
