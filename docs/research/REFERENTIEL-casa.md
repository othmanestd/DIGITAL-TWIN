# Référentiel « Casa réel » : diagnostic, inventaire et premier lot

Branche `feat/anfa-prime-hospital`, 24/10/2026. Rien n'est poussé, mergé ni déployé.

**Légende des statuts** : **vérifié** (source réutilisable citée) · **observé** (référence visuelle) · **estimé** (méthode donnée) · **inconnu**.

## 1. Diagnostic

- **Branche, conventions et références** :
  - branche active `feat/anfa-prime-hospital` (vérifié) ;
  - `AGENTS.md` lu (Next 16 : lire `node_modules/next/dist/docs`) ;
  - références lues : `casablanca-monuments-references` (13 lieux, 31 captures, `SOURCES.json`, chaque `REFERENCES.md`) et `sat-casa` (9 captures). Toutes servent d'**observation uniquement** : ni texture, ni traçage.
- **Repère de la scène** (observé dans le code) :
  - mètres, x vers l'est, z vers le sud, nord vers −z ;
  - origine = hôpital type ;
  - l'origine GPS est **déjà définie** : `lib/geo/projection.ts` → `CASA_LONLAT = (33.5731, −7.5898)`, utilisée par la carte du Maroc (Mercator d3) et le globe.
  - Il n'y a pas d'altitude : le sol est à y = 0.
  - Groupes tournés : aucun au niveau ville. Anfa Prime est tourné de −31,7° (vérifié, OSM).
- **Grille de 120 m** (observé) : elle **impose** les rues et les îlots de la ville procédurale (`plan.ts`). Elle ne déplace pas les empreintes OSM : seuls les bords des quartiers OSM (mode par défaut) sont calés sur ses lignes.
- **Écart démontré en mode par défaut** (mesuré le 23/10) : la ville procédurale place les monuments à **2,8–5,1 km** de leur position relative réelle. Exemple : la CFC Tower est à 5,1 km de sa place, alors que Casa-Port n'est décalé que de 0,6 km. Les quartiers OSM y sont justes en eux-mêmes, mais pas entre eux.

## 2. Chaîne géographique unique (lot réalisé)

- **`lib/geo/casaFrame.ts`** fournit `geoToScene(lat, lon)` et `sceneToGeo(x, z)` :
  - plan tangent local, équirectangulaire à la latitude de `CASA_LONLAT`, R = 6 371 008,8 m ;
  - par rapport au Mercator de la carte, l'écart est d'environ 0,05 % à 10 km (≈ 5 m).
- **Points de contrôle indépendants** (`__casa.check()`, exécuté) :
  - 33 paires de lieux du référentiel, distance dans la scène comparée à la distance géodésique (haversine) : **erreur max 0,044 %** (5 m sur 11,5 km), médiane < 0,02 % ;
  - la Villa des Arts (Nominatim, way 1388403773) tombe **dans** un bâtiment du quartier Maârif placé : vrai ;
  - le centre d'Anfa Park (Nominatim) tombe **dans** le polygone du parc du quartier CFC placé : vrai ;
  - Clinique Longchamps : la position du référentiel et le point OSM du quartier Anfa Prime placé coïncident (0 m).
- **Projections locales des quartiers** : chaque extraction OSM projette à la latitude de sa propre origine. L'écart d'échelle avec la chaîne est ≤ 0,01 % (0,1 m par km), donc négligeable.
- **Mode « Casa réel »** : adresse `?casa=reel` (retour avec `?casa=generee`, mémorisé dans le navigateur).
  - Les quartiers OSM (CFC, Maârif, Anfa Prime) et la mosquée Hassan II passent par la chaîne, sans translation manuelle.
  - La ville procédurale, ses piétons, sa mosquée générique et sa ligne de tram ne sont pas dessinés dans ce mode. Ils ne sont pas supprimés : le **mode par défaut est inchangé** (vérifié visuellement).

## 3. Inventaire par quartier

| Secteur | Données réelles dans la scène | Généré | Statut |
|---|---|---|---|
| Maârif / Racine / Gauthier (partie) | 957 empreintes OSM, rues, arbres, passages piétons (zone 1,2 × 1,1 km) | 422 volumes illustratifs au sud-ouest (OSM sans empreintes) | vérifié + estimé |
| CFC / Casa Anfa | 136 bâtiments OSM, rues, Anfa Park, T2 | — | vérifié |
| Anfa Supérieur (autour d'Anfa Prime) | 242 bâtiments OSM (villas), piscines, rues | arbres de jardin illustratifs | vérifié + estimé |
| Littoral : Hassan II, El Hank | Hassan II : volumes OSM (mode Casa réel) ; côte OSM | — | vérifié |
| Aïn Diab / Corniche | côte OSM seulement (mode Casa réel) | — | partiel |
| Centre-ville / Sidi Belyout | repères : place Mohammed V, Nations Unies, Sacré-Cœur, Marché central, Rialto, Casa Port | — | repères seulement |
| Habous | repère Mahkama du Pacha | — | repère seulement |
| Belvédère | repère Casa Voyageurs | — | repère seulement |
| Oasis | repères Akdital : Jerrada, Atfal, CIOC | — | repères seulement |
| Sidi Maârouf | repère Panorama (fiche, non vérifié dans OSM) | — | repère seulement |
| Aïn Sebaâ | repère Hôpital Privé Casablanca | — | repère seulement |
| Bourgogne, ancienne médina, Roches Noires, Californie, Hay Mohammadi, Derb Ghallef, Beauséjour, CIL, Hay Hassani, Oulfa, Mers Sultan, Derb Sultan | aucune | ville procédurale (mode par défaut) | absent |

## 4. Monuments

| Lieu | OSM | Dans la scène |
|---|---|---|
| Twin Center | node 770235536 ; tours ways 97667268 et 75698627 | modélisé sur les empreintes OSM ; sans publicité |
| CFC Tower | way 871612907 | modélisé (122 m, source architecte ; 136 m CTBUH) |
| Mosquée Hassan II | relation 12679400 et ses building:part | mode Casa réel : volumes OSM. **Minaret 172 m dans OSM contre 200–210 m ailleurs : non tranché.** Mode par défaut : mosquée générique de Moncef |
| Phare d'El Hank | way 491755179 | repère (hauteur non vérifiée) |
| Sacré-Cœur | way 417111236 | repère |
| Parc de la Ligue Arabe | way 572383035 | repère |
| Place Mohammed V | node 12842747272 | repère |
| Place des Nations Unies | node 12844672795 | repère |
| Casa Port | node 2429582026 | repère |
| Casa Voyageurs | node 7055155496 | repère |
| Mahkama du Pacha | node 2778538969 | repère |
| Morocco Mall | way 174580197 | repère. Le « ballon » publicitaire des références n'est pas modélisé |
| Stade Mohammed V, Villa des Arts, Notre-Dame de Lourdes, Marché central, Cinéma Rialto | OSM (voir `lib/geo/casaReferential.ts`) | repères |

## 5. Les huit établissements Akdital

| Établissement | Fiche Google | OSM | Statut |
|---|---|---|---|
| Anfa Prime Hospital | 33.5816471, −7.6595984 | parcelle way 1432538704 (chantier), à ~44 m | modélisé (pilote du 23/10) ; OSM probable |
| Clinique Longchamps | 33.5817269, −7.6605984 | node 12915145679, `operator=Akdital`, à 25 m ; bâtiment way 1395302686 (2 niveaux) | vérifié, distinct d'Anfa Prime (135 m) |
| Clinique Jerrada Oasis | 33.5565154, −7.6327082 | way 1001376627 « Clinique jerrada oasis », à 34 m | vérifié |
| Clinique Aïn Borja | 33.585169, −7.5966154 | node 6418215089 « Akdital Clinique Ain Berja », à 28 m | vérifié |
| Clinique Panorama Sidi Maârouf | 33.5260041, −7.6497257 | aucune entité à moins de 250 m | fiche seule |
| Clinique pédiatrique Atfal | 33.5586352, −7.6375946 | bâtiment way 419567550 (hospital) contenant la fiche ; nœud nommé « Clinique Attal » | probable, nom à confirmer |
| Hôpital Privé Casablanca Aïn Sebaâ | 33.6126268, −7.5302628 | node 13261125353, à 29 m, sans empreinte | vérifié (point) |
| Centre International d'Oncologie | 33.5568574, −7.6309231 | aucune entité correspondante | fiche seule |

- Le dossier de photos des hôpitaux (« akdital-casa-32-references ») n'était pas joint. **Aucune façade de clinique n'est donc modélisée** dans ce lot.
- Les 6 établissements non modélisés apparaissent en mode Casa réel comme **repères** : leur statut est affiché, et aucun bâtiment n'est inventé.

## 6. Architecture de correction

1. **Une seule chaîne** (`casaFrame`) pour tout ce qui est géoréférencé : quartiers OSM, côte, monuments, établissements.
2. **Couches** :
   - sol et mer (côte OSM) ;
   - quartiers OSM (moteur générique `zoneGeo` / `OsmZoneDistrict`) ;
   - monuments à partir de leurs building:part OSM, ou modèles dédiés ;
   - repères pour ce qui n'est pas encore modélisé.
3. **Extension par quartiers** validés, chacun avec ses sources (`osm-zone-extract.py`), son niveau de détail et son découpage spatial. La grille de 120 m ne servira qu'au chargement.
4. **La ville procédurale** reste le mode par défaut tant que Mounsef n'a pas validé la bascule. En mode Casa réel, elle pourra revenir plus tard comme remplissage, découpée par la côte réelle et hors des quartiers OSM.

## 7. Lot réalisé

**Fichiers ajoutés** :
- `lib/geo/casaFrame.ts`, `lib/geo/casaReferential.ts` ;
- `components/scenes/city/CasaReel.tsx` (sol, mer, côte, repères, vérification) ;
- `components/scenes/city/hassanZone.ts` et `landmarks/HassanDistrict.tsx` ;
- données `landmarks/zones/coastData.ts` et `landmarks/zones/hassan2Data.ts`.

**Fichiers modifiés** :
- `geography.ts` : placement des quartiers par la chaîne en mode Casa réel ;
- `UnifiedWorld.tsx` et `landmarks/index.tsx` : interrupteurs du mode ;
- `zoneGeo.ts` (`min_height`), `zoneKit.ts` et `zoneMaterials.ts` (matériaux de monument) ;
- `osm-zone-extract.py` (`min_height`, `roof:shape`, `building:architecture`, places).

**Mesures** (navigateur intégré, panneau 672 × 942, DPR non contrôlé ; les triangles incluent la passe d'ombre) :

| Vue (mode Casa réel) | Appels de dessin | Triangles | Géométries / textures |
|---|---|---|---|
| Vue d'ensemble 13 km | 770 | 0,43 M | 344 / 163 |
| Hassan II 650 m | 580 | 0,24 M | 357 / 165 |
| Maârif 900 m | 582 | 0,74 M | 372 / 167 |
| Hôpital type 250 m | 1 278 | 0,23 M | 372 / 167 |

- En mode par défaut, la vue Twin Center était à 854 appels de dessin et 9,95 M triangles.
- Le temps de frame n'est pas mesuré de façon fiable : le panneau ralentit le rendu en arrière-plan.

**Autres vérifications** :
- `npx tsc --noEmit` passe (sauf l'erreur connue `app/layout.tsx`) ;
- build : voir le commit.

## 8. Limites et inconnues

- **Hors de la ville**, au-delà des extrémités de la côte OSM (Dar Bouazza, Aïn Sebaâ), le rivage est prolongé en ligne droite : c'est une simplification.
- **Mode Casa réel** :
  - il n'y a encore ni rues ni bâtiments entre les quartiers modélisés ;
  - le sol est uni, sans plages ni rochers différenciés.
- **Hassan II** : les détails (arcades, zellige) sont une typologie de textures, pas un relevé. Le conflit de hauteur du minaret reste ouvert.
- **L'hôpital type**, fictif, reste à `CASA_LONLAT`, dans un quartier réel : à décider avec Mounsef.
- **Panorama et CIOC** n'ont pas de trace dans OSM. Atfal reste à confirmer.

## 9. Lots suivants proposés

1. Rues réelles de toute la ville en mode Casa réel : OSM `trunk`, `primary`, `secondary`, tram T1/T2, rail. Il faudra l'API Overpass, saturée les 23 et 24/10, ou des tuiles de l'API principale.
2. Centre et patrimoine : place Mohammed V, Sacré-Cœur, parc de la Ligue Arabe, Nations Unies, en quartier OSM.
3. Littoral et port : bassins, Casa Port, El Hank, Corniche.
4. Établissements Akdital, avec leurs photos : Longchamps et Jerrada (empreintes OSM disponibles), Aïn Borja, HPC.
5. Décision Mounsef : passer le mode Casa réel en mode par défaut, et y réintroduire un remplissage procédural découpé par la côte.
