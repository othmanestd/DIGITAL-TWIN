# Mibtech — identification du bâtiment (phases A à C)

Date : 26/10/2026. Statut : **identification non confirmée, modélisation suspendue** (ticket « Intégration du bâtiment réel Mibtech », §2 : si le lien ne permet pas d'identifier précisément le bâtiment, demander une capture de la fiche Google Maps ou une photo de façade).

## A. Sources consultées

| Source | Ce qu'elle dit | Statut |
|---|---|---|
| Lien fourni `maps.app.goo.gl/Y2qYWsH8rJ2mDBLz9` (redirection résolue) | fiche « MIBTECH », lieu `/g/11y3h4hlfq`, repère **33.5557132, −7.6435360** | vérifié (redirection) |
| Site officiel `mibtech.ma` (lu le 26/10/2026) | « Siège social : **24 Rue des Papillons**, Casablanca, Maroc » ; son propre lien Maps `maps.app.goo.gl/hR4p4mX4MCgnZEhPA` → même fiche `/g/11y3h4hlfq`, repère **33.5558823, −7.6435464** | vérifié (texte du site) |
| OpenStreetMap, API 0.6 (téléchargé le 26/10/2026) | rue way 590542550 : `name` = Boulevard Mahdi Elmandjra, **`old_name` = Rue des Papillons** ; bâtiments `building=house` autour du repère | vérifié par source |
| Nominatim (reverse) | repère → « 12, Boulevard Mahdi Elmandjra, L'Oasis, Maârif » | vérifié par source |
| Dossier `~/Downloads/Mibtech_References` | liens seulement (Maps, site, LinkedIn, city-info.ma) ; aucune photo ni capture | — |

Aucune photo de façade ni vue satellite n'a pu être examinée : le dossier n'en contient pas, et les photos du site et de LinkedIn n'ont pas été téléchargées (droits non vérifiés).

## B. Ce qui est établi

- **Rue** : « Rue des Papillons » (adresse officielle) et « Boulevard Mahdi Elmandjra » (OSM, Google) sont la **même rue** : OSM porte l'ancien nom en `old_name`. Il n'y a donc pas d'écart de rue entre le site officiel et le lien Google.
- **Quartier** : L'Oasis, arrondissement du Maârif (tissu de villas).
- **Deux repères Google pour la même fiche**, à **18,8 m** l'un de l'autre (le repère du site est au nord de celui du lien fourni).

## C. Incertitudes bloquantes

1. **Aucun des deux repères ne tombe dans une empreinte OSM.**
   - Repère du lien fourni : entre la maison « 12 Rue des Papillons » (OSM way 419748653, 5,4 m) et la maison voisine (way 419748625, 6,7 m), à 7,6 m de la chaussée du boulevard.
   - Repère du site : à 1,3 m du bord de la maison way 419748511.
2. **Numéro** : OSM n'a cartographié que le 12 et le 16 sur ce tronçon (relevé Kaart 2018) ; le site annonce le **24**. Aucun bâtiment n'est numéroté 24 dans OSM. La numérotation a pu changer avec le renommage de la rue.
3. **Âge des empreintes** : 2016 (ways 419748625, 419748511) et 2018 (419748653). Un bâtiment reconstruit ou agrandi depuis n'y serait pas.
4. **Aspect inconnu** : nombre de niveaux, hauteur, toiture, couleurs, matériaux, enseigne : aucune donnée vérifiable.

### Candidats (empreintes OSM, mesures dans le repère de la scène)

| OSM way | Adresse OSM | Emprise | Dimensions | Centroïde | Distance au repère fourni |
|---|---|---|---|---|---|
| 419748653 | 12 Rue des Papillons | 136 m² | 10,8 × 14,4 m | 33.5558220, −7.6436060 | 5,4 m (bord) |
| 419748625 | — | 201 m² | 15,7 × 14,2 m | 33.5556818, −7.6437324 | 6,7 m (bord) |
| 419748511 | — | 100 m² | 13,0 × 8,8 m | 33.5559424, −7.6435308 | 1,3 m du repère du site |

## À fournir pour passer à la phase D

- une capture de la fiche Google Maps « MIBTECH », avec sa photo de façade si elle en a une ;
- ou une photo de la façade (prise par vous, ou dont l'usage comme référence est autorisé) ;
- l'indication du bâtiment : lequel des candidats, ou un bâtiment absent d'OSM.

Les photos servent de référence d'analyse seulement : le modèle sera reconstruit en géométrie et matériaux procéduraux, à la position issue de la chaîne `casaFrame.geoToScene`.
