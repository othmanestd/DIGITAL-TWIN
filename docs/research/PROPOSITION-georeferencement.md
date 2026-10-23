# Proposition : géoréférencement de Casablanca dans le jumeau numérique

Statut : **proposition, rien n'est appliqué**. Elle modifierait la géographie de la ville de Moncef ; elle demande l'accord de
Mounsef avant toute mise en œuvre. Auteur : branche `feat/anfa-prime-hospital`, 23/10/2026.

## 1. Constat (mesuré)

L'application a déjà **un** ancrage GPS : `lib/geo/projection.ts` → `CASA_LONLAT = (33.5731, −7.5898)`.

- C'est le point de la carte du Maroc et du globe où se trouve l'hôpital type, soit l'origine (0, 0) de la ville 3D.
- Le repère de la ville est déjà bon en orientation et en échelle : mètres, x vers l'est, z vers le sud, nord vers −z.
- La ville procédurale, en revanche, n'est pas placée à partir de vraies coordonnées. Ses monuments sont posés à la main, d'où les écarts suivants (en mètres, depuis l'origine) :

| Lieu | Position réelle (x, z) | Position dans la scène (x, z) | Écart |
|---|---|---|---|
| CFC Tower | −6593, 1058 | −1750, −500 | 5,1 km |
| Phare d'El Hank | −6014, −4100 | −2892, −941 | 4,4 km |
| Twin Center | −3937, −1499 | −858, 585 | 3,7 km |
| Anfa Prime (≈, à confirmer) | −6133, −1323 | −3000, 11 | 3,4 km |
| Mosquée Hassan II | −3953, −3906 | −2151, −1783 | 2,8 km |
| Parc de la Ligue arabe | −3107, −1676 | −330, −1680 | 2,8 km |
| Casa-Port / médina | −2059, −2879 | −1602, −2450 | 0,6 km |

Positions réelles : base de noms de lieux d'OpenStreetMap et nœuds OSM, consultés le 23/10/2026.

## 2. Principe : un seul repère, calculé depuis la latitude et la longitude

On crée un module `lib/geo/casaFrame.ts` :

```ts
// origine = CASA_LONLAT (déjà utilisée par la carte et le globe, donc le zoom reste cohérent)
const R = 6371008.8, LAT0 = 33.5731, LON0 = -7.5898, K = (Math.PI / 180) * R;
export const geoToScene = (lat: number, lon: number) => ({ x: (lon - LON0) * K * Math.cos(LAT0 * Math.PI / 180), z: -(lat - LAT0) * K });
export const sceneToGeo = (x: number, z: number) => ({ lat: LAT0 - z / K, lon: LON0 + x / (K * Math.cos(LAT0 * Math.PI / 180)) });
```

- **Projection** : un plan tangent local (équirectangulaire à la latitude de Casablanca). Les coordonnées GPS ne sont jamais utilisées directement comme des mètres.
- **Précision** : sur ±10 km, l'écart avec la projection de Mercator de la carte du Maroc est d'environ 0,05 % (≈ 5 m à 10 km). C'est négligeable à l'écran. Pour un raccord parfait au moment du passage ville → carte, on peut aussi utiliser exactement la même projection de Mercator que la carte.
- **Placement des bâtiments** : chaque quartier OSM (CFC, Maârif…) connaît déjà son origine GPS (`zone.origin`). Son décalage se calcule donc automatiquement par `geoToScene(zone.origin)` : il n'y a plus d'ancrage manuel. Un bâtiment isolé se place de la même manière, à partir de son centre GPS.

## 3. Ce que cela changerait, par étapes

Tout passe derrière un interrupteur `GEO_CITY`, désactivé par défaut. La ville actuelle reste celle qu'on voit tant que Mounsef n'a pas validé.

1. **Module `casaFrame` et vérifications** : on contrôle quelques points connus (CFC Tower, Twin Center, Hassan II). Cette étape seule ne change rien à l'écran.
2. **Quartiers OSM placés par le GPS** : CFC et Maârif se retrouvent à leur vraie distance l'un de l'autre (environ 3,8 km au lieu de 1,4 km). Leurs emprises ne tombent alors plus sur la grille de 120 m : il faut généraliser `blocked()` à des rectangles quelconques, et couper proprement les rues générées aux bords.
3. **Monuments replacés** : mosquée Hassan II, phare d'El Hank, parc de la Ligue arabe, hippodrome, Twin Center et Anfa Prime (dont la position réelle reste à confirmer auprès d'Akdital).
4. **Vraie côte** : le trait de côte OSM (`natural=coastline`) remplace la formule `COAST + wiggle`. On remplace aussi la corniche et le port.
5. **Grands axes réels** : les boulevards OSM (`trunk` et `primary`) remplacent `AVENUES`, `RADIALS` et `RINGS`. La grille générée ne sert plus que de remplissage là où OSM n'a pas de rues. Les lignes de tram T1 et T2 d'OSM remplacent la ligne actuelle en z = 780, ce qui rendrait les 86 bâtiments du Maârif retirés aujourd'hui (voir `maarif-pilote.md`).
6. **Hôpital type** : il est fictif et reste à l'origine. Mais `CASA_LONLAT` tombe dans un quartier réel bâti, donc il faut lui réserver un terrain dégagé (360 × 360 m), ou choisir une autre origine (ce qui suppose de mettre à jour la carte).
7. **À revérifier** : la visite guidée, les plans caméra, le trafic (rayon de 1 250 m autour de l'hôpital), les piétons et le mode « À pied ».

## 4. Risques

- **Étendue** : la ville de Moncef serait modifiée en profondeur (côte, avenues, tram, monuments). Le risque de régression visuelle est élevé, d'où l'interrupteur et une validation étape par étape.
- **Performance** : la ville est déjà lourde (8,7 à 10 M triangles par image mesurés). Elle le reste tant que l'allègement selon la distance prévu dans `HANDOFF.md` n'est pas fait. Remplacer la ville générée par OSM n'est pas plus lourd en soi, mais il faut charger les quartiers par zones.
- **Couverture OSM inégale** : par exemple le sud-ouest du Maârif n'a pas d'empreintes. Les volumes illustratifs restent nécessaires et doivent rester signalés.
- **Données à confirmer** : la position d'Anfa Prime, les hauteurs (rarement présentes dans OSM) et les façades (typologies, pas des relevés).

## 5. Décision demandée

1. Mounsef valide-t-il le principe (repère unique depuis `CASA_LONLAT`, derrière `GEO_CITY`) ?
2. Si oui, on commence par les étapes 1 et 2 (CFC et Maârif placés par le GPS), ce qui est visible tout en restant réversible.
