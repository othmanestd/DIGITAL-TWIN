# Casablanca Finance City / Casa Anfa: building brief and OSM layout

Research date: 2026-10-23. Full machine-readable data is in `cfc-district.json`, in the same folder.
Figures marked **(?)** are uncertain or conflict between sources. "unknown" means no source was found. No figure here is estimated by me.

## 1. Coordinate frame

- **Origin**: area centroid of OSM way 871612907 "Tour CFC First" (the CFC Tower), lat 33.5635842, lon -7.6609624.
- **Axes**: x = metres **east**, z = metres **south** (z = -north offset), y up.
- **Projection**: equirectangular at the origin latitude (R = 6,371,008.8 m). All coordinates are rounded to 0.5 m.
- **Bearings** are degrees clockwise from true north for the long side of the minimum-area bounding rectangle ("OBB").
- **Street grid**: the grid around the CFC Tower is rotated about **20-23° clockwise from north**. Most building long axes are at about 20° or about 110°.

## 2. Inventory: buildings to model (Casa Anfa / CFC)

The local (x, z) value is the centroid of the OSM footprint. The footprint is the OSM OBB, long side x short side. Height is the preferred value; alternatives are listed under each building.

| # | Building | Status / year | Height (m) | Floors | OSM footprint (m) | Local (x, z) | Façade (one line) |
|---|---|---|---|---|---|---|---|
| 1 | **CFC Tower** (Morphosis) | done 2019 | **122** (?) | 25 + mezz. (?) | 35.4 × 30.1, 23° | (0, 0) | white aluminium angled brise-soleil lattice over fritted low-E glass; tapered glass crown and canted base |
| 2 | **BCP Tower** (G3A + R. Andaloussi) | done 2023-25 (?) | **105.4** (?) | 27 + 5-storey podium | 49.3 × 22.5, 110° | (65.5, 241.5) | north: glass double skin (2.70 × 3.6 m modules); south: GRC mashrabiya screen of 1.80 m panels; solid GRC gables |
| 3 | **AWB Tower / Borj Attijariwafa** (Viguier + Uni Archi) | delivery 2025-26 | **114** (?) | 25 (?) | unknown, not in OSM | unknown | stone façade with mouldings, openable window every other bay, solar shading (GRC also reported (?)) |
| 4 | **Tour CIMR** (DL2A) | done 2022 | **60** | about R+16 (?) + 4 basements | 31.2 × 24.0, curved 18-vertex | (-58.5, 212) | white perforated aluminium veil (perforations show the CIMR logo) 85 cm in front of full-height glazing; three interlocking curved towers |
| 5a | **Casa Business Towers: "Tour Mainstreet"** (IRG) | done 2023 | 90 (?) | 22 | 41.9 × 24.7, 21° | (122.5, -32) | unknown ("modern") |
| 5b | **Casa Business Towers: "Tour Casa Anfa"** | done 2023 | 90 (?) | 22 | 38.9 × 23.0, 20° | (159.5, -4) | unknown |
| 5c | **Casa Business Towers: "Le Métropolitain"** | done 2023 | 30 (OSM) | 6 (site) / 8 (OSM) (?) | 21.3 × 15.7, 111° | (139, -11.5) | unknown |
| 6 | **M Tower** (Mfadel + Red Med) | under construction, 2027 (?) | **131** | 32 | unknown, not in OSM | unknown (Bd de l'Aéropostale, next to La Palmeraie) | "dynamic spiral" tower on a 3-level retail podium; panoramic lift to a rooftop restaurant |
| 7 | **Walili Tower** | under construction, 2026 (?) | 147+ (?) | 32 (?) | 83.7 × 80.3 (likely the plot/podium) | (50, 358) | unknown |
| 8 | **Shift Tower** | under construction, 2026 (?) | 130+ (?) | 35 (?) | 48.6 × 44.6 | (-72.5, 521.5) | unknown |
| 9 | **Cross Tower** (OSM name only) | unknown | unknown | unknown | 74.0 × 66.7 (likely the plot) | (-129.5, 303) | unknown |
| 10 | **Capital Tower** (OSM only) | unknown | 80 (OSM) | 21 (OSM) | 50.1 × 29.3, 58° | (156, -265.5) | unknown |
| 11 | **BO 52** (Linkcity; Bouhaya, El Kabbaj, Kettani, Siana) | done 2021 | 60 (OSM, taller block) | 16 and 13 | 50.9 × 23.3 and 51.6 × 32.7 | (5, -64) and (32.5, -51.5) | light/white treatment inspired by 20th-century Casablanca architecture |
| 12 | **Luxuria Tower** (CGI) | sold from 2019; status (?) | unknown | R+15 and R+4 | 69.2 × 18.5 (tall part 33.2 × 18.5) | (180.5, 82.5); tall part (186.5, 65.5) | unknown; faces Anfa Park |
| 13 | **CFC Bridge** (probably lots 57-58, AWM) | unknown | unknown | R+6 (design) | 74.9 × 67.6 L-shape wrapping the tower | (-22.5, 17.5) | unknown; two bodies linked by a footbridge, open ground floor |
| 14 | **Les Tours Végétales / Gardens of Anfa** (Edouard François) | completion not verified | unknown | 16 (OSM; design 3 × R+16 + R+12) | about 41×28, 35×28, 27×19, 34×24 | (622.5, 366), (700.5, 403.5), (648.5, 434), (734.5, 471.5) | façades planted with white jasmine or bougainvillea |
| 15 | **Anfa Aerocity** (apartments) | mapped | unknown | 12 (OSM) | 101.7 × 86.6 (block) | (-122.5, -236) | unknown |
| 16 | **Aeria Mall** | open | unknown | 4 (OSM) | 164 × 115 | (-214, 35.5) | unknown |
| 17 | **Radisson Blu / RED / aparthotel** (Mfadel) | planned H1 2028 | unknown | unknown | not in OSM | unknown | unknown |

### 2.1 Building details

#### CFC Tower (Tour CFC; "Tour CFC First" in OSM and FR Wikipedia)

- **Client and occupants**
  - Client: Casablanca Finance City Authority.
  - A 2018 report says CFCA takes the top two floors and Bank Al-Maghrib banking supervision the next four.
  - OSM places an "Orange Middle East and Africa" office node inside the footprint.
- **Dates**: construction 2015/16 to 2019; handover Feb 2019 (Bymaro) or April 2019 (Morphosis via WA). LEED Gold.
- **Height (?)**
  - 122 m (≈400 ft): Morphosis / Architectural Record, FR Wikipedia, Bymaro, OSM `height=122`.
  - 121 m: WorldArchitecture, Yabiladi.
  - **136 m**: CTBUH and EN Wikipedia. This may include the crown armature; unverified.
- **Floors (?)**: 25 + mezzanine + 6 basement levels (Arch Record, FR Wikipedia structure section, Doka); 27 (CTBUH); 28 (Bymaro); 22 (OSM).
- **Area**: GFA 21,000 m².
- **Team**
  - Architects: Morphosis (Thom Mayne) with Omar Alaoui Architectes.
  - Structure: Thornton Tomasetti and Tractebel; reinforced concrete with post-tensioned slabs (VSL).
  - Façade consultant: VS-A. Brise-soleil and curtain wall: Simeon. Glass: Guardian. Contractor: Bouygues / Bymaro.
- **Plan**
  - Text sources do not describe it.
  - OSM has a 4-vertex near-square quad, about **35 × 30 m**, about 1,070 m², rotated about 23°.
  - Footprint: `[[21,-10],[7,22.5],[-20.5,11],[-7,-21.5]]` (x, z).
- **Massing**
  - Tapers at **both top and base**, which Morphosis calls a "double crown".
  - The top is a shard-like tapered crown with a glass top and mesh armature. It holds an open-air event space with green walls.
  - The base is prismatic, with canted walls forming the lobby, and "touches the ground lightly".
  - No podium. The low CFC Bridge building wraps its west and north sides.
- **Façade**
  - **White** fixed, angled, textured brise-soleil, inspired by Moroccan mosaics and wooden latticework (mashrabiya).
  - Designed in concrete but **built in aluminium**. Prefabricated modules are set at varying depths.
  - Behind it: low-E insulated glazing with a frit pattern.
  - The upper floors reportedly have glazing with integrated PV and a double-skin "thermal chimney" (BD+C, via search summary).
- **Orientation**: not documented beyond the grid alignment (faces at about 23°, 113°, 203° and 293°).
- **Lighting and signage**: exterior lighting by Erco. No sources on night scheme or signage.

#### BCP Tower

- **Owner**: Banque Centrale Populaire HQ, Anfa **Lot 64**.
- **Height (?)**: 105.4 m (CTBUH, OSM, Wikipedia list); 120 m roof (EN Wikipedia infobox, TESS); about 100 m (Medias24).
- **Floors (?)**: 27-storey tower + 5-storey podium (TESS). Yabiladi instead gives a 4-storey podium + 19 office + 2 management floors.
- **Area**: about 24,000 m².
- **Architects**: Groupe 3 Architectes + Cabinet Rachid Andaloussi. TESS for structure, glass and GRC.
- **Massing**: two simple parallelepipeds, a slab tower attached to a podium. The slab is about 20 m thick (Medias24); OSM has the tower at 49.3 × 22.5 m with its long axis at about 110°.
- **Orientation**: main façades face **north and south**.
- **Façades**
  - North: glass double skin. Modules are 2.70 m × 3.6 m, each outer skin one large pane, with a ventilated joint per floor. Inner skin: glazed frames over opaque/glazed fire-barrier sills.
  - South: GRC mashrabiya screen of **1.80 m square panels** with varying solid/void density. Set-back inner glazing in full-height frames 1.35 m wide.
  - Blind gables (short E/W ends): the same GRC pattern, all solid.
- **Other features**: suspended gardens; BCP logo on the façade (position not stated). GRC colour is not stated.
- **Dates (?)**: construction 2022-2023 (Wikipedia); "ready, move imminent" in June 2025 (Medias24). Architectural Record Awards 2025.

#### AWB Tower / Borj Attijariwafa

- **Owner**: Attijariwafa bank.
- **Programme**
  - A 25-storey tower (Viguier, Figueras) or 27 storeys (Omteq, Le360, Wikipedia) **(?)**.
  - Plus four office buildings: R+6 or 8 storeys in Viguier's own page, R+7 per Omteq **(?)**.
  - Floor area: 61,000 m² (tower about 30,000 m², offices about 31,000 m²).
- **Height (?)**: 114 m (Wikipedia list); about 113 m roof (SkyscraperPage via search snippet); "110 m" (SkyscraperCity thread title).
- **Team**
  - Architects: VIGUIER (lead) + Uni Archi.
  - Façades: Ferrès Arquitectos. Engineering: Omteq and Ingerop. Contractors: Sogea Maroc (structure) and CMS (general).
- **Façade**
  - **Stone** with mouldings; openable windows in every other bay; solar shading.
  - A façade-conference bio says the Viguier project manager "designed the GRC façade" **(?)**, possibly GRC with a stone look.
  - A non-authoritative forum post mentions white cladding with glass on the upper floors.
- **Landscape**: central garden onto terraces and loggias; sheltered shared roof terrace on the top floor.
- **Location**: "near Anfa Park, offices open onto Parc Anfa". **No OSM object** carries this name in the downloaded data, so the position is unknown. Do not place it from this brief alone.

#### Tour CIMR

- **Owner**: CIMR pension fund HQ, occupied from 4 April 2022.
- **Size**: 60 m. Ground floor + 14 floors + 2 executive floors (about R+16; OSM 16) **(?)** + 4 basements. Area 14,500 m² on a 1,450 m² plot at the corner of two avenues.
- **Architect**: D.L.2.A (Didier Lefort).
- **Form**: **three interlocking curved towers of different heights**. OSM footprint is a rounded 18-vertex polygon, about 31 × 24 m.
- **Façade**
  - Double skin of **white perforated aluminium** from the ground up. The perforations draw the CIMR logo and cut solar gain by about 60%.
  - Full-height double glazing sits 85 cm behind.
- **Other**: landscaped roof terrace. HQE Excellent.

#### Casa Business Towers (CBT)

- **Programme**: two 22-floor towers + one 6-floor building, 28,000 m² offices, delivered 2023. "Projet signé IRG"; IRG's role is not stated.
- **Height (?)**: the site shows "90 m" without saying what it measures; OSM tags 90 m on each tower.
- **OSM names**: the towers are "Tour mainstreet" and "Tour Casa Anfa"; the low block is "Le Métropolitain" (8 levels / 30 m).
- **Location**: just east of the CFC Tower, across **Main Street**.
- **Conflict (?)**: CTBUH lists "Casa Anfa Tower 1/2" as an estimated 51 m, 15 floors, residential, with renderings credited to Hamonic+Masson. That does not match CBT and may be the Walili lot 65-2 residential scheme (about 50 m, Hamonic+Masson). Unresolved.

#### M Tower

- **Developers**: Mfadel Group + Red Med Real Estate. Works launched around Dec 2024.
- **Size**: 131 m, 32 floors.
- **Design**: "dynamic spiral"; 3-level commercial base; rooftop restaurant reached by a panoramic lift; two lobbies.
- **Location**: Bd de l'Aéropostale, next to La Palmeraie. The OSM node "La Palmeraie" is at about (-319, 336.5), given as context only.
- **Unknown**: architect, façade and footprint. It is not in OSM.

#### Walili, Shift and Cross towers

- **Walili and Shift**
  - The only source for heights and floors is the Wikipedia "tallest buildings in Morocco" list: Walili +147 m / 32 floors / 2026; Shift +130 m / 35 floors / 2026.
  - OSM has named polygons but no height. The large polygons (Walili 84 × 80 m, Cross 74 × 67 m) look like plot or podium outlines, not tower shafts.
- **Cross Tower**: no web source found.
- **Unknown for all three**: architect, façade and shape.

#### Others

- **BO 52** (Linkcity, 2021): two residential blocks of 16 and 13 floors, white or light treatment, just south of the CFC Tower.
- **Luxuria Tower** (CGI): R+15 + R+4 residential facing Anfa Park.
- **CFC Bridge**: an OSM office building wrapping the CFC Tower. It is probably the AWM lots 57/58 building (R+6, two bodies plus footbridge, open ground floor). The "Lot 57-58, CFC Bridge Tower" address is used by IBIS, and PwC is at "CFC Lot 57".
- **Gardens of Anfa / Tours Végétales** (Maison Edouard François + Groupe 3, client Yasmine Signature): planted façades. Tour Jasmin is the related Yasmine office tower (organic form, about 70% glazed, 8 floors (?)).
- **Aeria Mall**: 4 levels.
  - A 2018 article says a leisure/shopping centre was planned on the old terminal site, keeping the terminal and the first control tower.
  - OSM has a small concrete `man_made=tower` (watchtower, about 9 × 8 m, way 1308152369) at about (-205.5, 148.5). It may be the preserved old control tower; unverified.

## 3. Checked and NOT in Casa Anfa / not found

- **ANP Tower**: **not in Casa Anfa**. It stands opposite the Casa-Port station, near the port (105 m, 25 floors, 2017-2020/21).
- **Africa50**: HQ inaugurated Sept 2018; the report places it at the **Casablanca Marina**. No Africa50 building was found in Casa Anfa.
- **CDG**: no CDG tower. CDG works through its subsidiaries AUDA (the Casa Anfa developer) and CGI (Luxuria Tower).
- **Hyatt**: none found in Casa Anfa. The Hyatt Regency is downtown; this is general knowledge, not re-verified.
- **Barceló Anfa**: on Bd d'Anfa, not in CFC.
- **"Ivoire" towers**: no source found.
- **Lot 57**: an address (CFC Lot 57 / 57-58, "CFC Bridge Tower"), not a separate tower.
- **BMCE / Bank of Africa tower**: planned, then abandoned.
- **Radisson complex** (Mfadel, 383 keys): planned for H1 2028; location within CFC unknown.

## 4. OSM layout (data © OpenStreetMap contributors, ODbL 1.0)

**How the data was retrieved**

- The Overpass API (overpass-api.de and its mirrors) was overloaded (HTTP 502/406 and timeouts).
- Raw OSM XML was downloaded from the OSM main API (`/api/0.6/map`) for bbox lon -7.668 to -7.637, lat 33.553 to 33.577, on 2026-10-23.
- The requested filters were applied locally.

**What the JSON contains** (key `osm`):

- `buildings` (129):
  - `tall_or_inventory`: levels ≥ 8, or height ≥ 30 m, or a name matching the inventory.
  - `named_context`: other named buildings within 900 m.
  - `unnamed_context_near_cfc`: large unnamed offices and building parts within 450 m.
  - Each entry has the full footprint polygon (x, z), centroid, area, OBB, height/levels, OSM id and name.
  - 36 buildings more than 1 km away (mostly 8-level apartment blocks 1.2-1.7 km to the SE (CIL / Beauséjour)) are flagged `beyond_1km_probably_outside_casa_anfa`.
- `streets`: simplified polylines per OSM way, at 1.5 m tolerance, clipped to ±1.5 km.
- `tram` (T2), `transit_stops`, `areas` (parks, reflecting pools, grass) and `places`.

### Key footprints (x east, z south; m)

| OSM id | Name | Height / levels (OSM) | Polygon |
|---|---|---|---|
| 871612907 | Tour CFC First | 122 m / 22 | [21,-10] [7,22.5] [-20.5,11] [-7,-21.5] |
| 871612905 | BCP TOWER | 105.4 m / 27 | [46,224] [92.5,239.5] [85,261] [38.5,244] |
| 871612914 | CIMR TOWER | 60 m / 16 | 18-pt ellipse-like ring, x -71 to -46.5, z 197 to 228.5 (see JSON) |
| 1056146783 | Tour mainstreet | 90 m / 22 | [118.5,-55.5] [141.5,-46.5] [132,-22] [126.5,-7.5] [123.5,-8.5] [105.5,-15.5] [103.5,-16.5] |
| 1056146785 | Tour Casa Anfa | 90 m / 22 | [155.5,-25.5] [177,-18] [164,19] [142.5,11] [146,0.5] [151.5,-14.5] |
| 1056146786 | CAPITAL TOWER | 80 m / 21 | [127.5,-263.5] [168.5,-289.5] [185,-265] [140.5,-241] |
| 871612908 | BO52 | 60 m / 16 | [26.5,-81] [11,-52] [4.5,-39] [-18,-47] [8.5,-90] |
| 1308110828 | Walili Tower | none | [102,333] [73,411.5] [-2.5,383.5] [26.5,305] |
| 1308110887 | Cross Tower | none | [-85,280.5] [-110.5,350] [-173.5,327] [-147.5,257.5] |
| 1308151969 | Shift Tower | none | [-42.5,510] [-57,550] [-102,535] [-88,493] |
| 586649061 | CFC Bridge | none | [-24,12.5] [19.5,30.5] [8.5,56.5] [-60.5,28] [-28.5,-32] [-9.5,-24] |

### Streets and transit around the CFC Tower

These are approximate descriptions; the exact polylines are in the JSON.

- **Main Street** (residential/secondary, the CFC spine): runs NNE-SSW about 70 m east of the tower, from about (-4, 212.5) to (125, -147.5). It continues SW as a dual carriageway towards (-390, 1184).
- **Bd Moulay Abdellah Cherif**: runs WNW-ESE about 135 m north of the tower, from (-306.5, 6.5) to (132.5, -197.5), then on to (354.5, -348.5).
- **Bd de l'Aéropostale** (secondary, dual one-way 2 lanes): passes south of BCP and CIMR, from (-316.5, 22.5) to (357.5, 471). It turns NE towards (946, 859) and also runs NW-SE on the west side, (-325, 27) to (-611, -446).
- **Bd des Musées**, **Bd Sidi Abderrahmane** (SE edge, Anfa Park side), **Bd d'Oued Oum Rabia** (W), **Bd du Grand Théâtre** and **Bd des Clubs** (E, Anfa Clubs) are also in the JSON.
- **Boulevard Al Massira**: not present in this bbox.
- **Tram T2 stops**: "Place Financière" at about (4, 141), about 141 m south of the tower; "Abdellah Ben Cherif" at (62, -255.5); "Anfa Park" at (323.5, 424.5); "Anfa Clubs" at (737.5, 256.5); "Cité de l'Air" at (-298.5, -516).
- **Busway BW2 stops**: "Les Musées" at (47, -158.5), "Oued Oum Rabia" at (-374.5, 36), "C.I.L." at (440.5, -419.5).
- **Anfa Park** (OSM way 586647221): about 16.3 ha polygon east of the tower (extent x 126 to 605.5, z -342.5 to 384), with reflecting pools and a skatepark. Phase 1 opened in March 2020 at 18 ha, with 50 ha planned.
- **Aeria Palmeraie** park: about 2.3 ha, immediately west of the tower (extent x -210 to 11, z -130 to 194.5), next to Aeria Mall.

## 5. Sources

- Wikipedia (EN/FR): [List of tallest buildings in Morocco](https://en.wikipedia.org/wiki/List_of_tallest_buildings_in_Morocco), [CFC Tower](https://en.wikipedia.org/wiki/Casablanca_Finance_City_Tower), [Tour CFC First](https://fr.wikipedia.org/wiki/Tour_CFC_First), [BCP Tower](https://en.wikipedia.org/wiki/BCP_Tower)
- CTBUH: [CFC Tower](https://www.skyscrapercenter.com/building/casablanca-finance-city-tower/20302), [Casablanca](https://www.skyscrapercenter.com/city/casablanca), [Casa Anfa complex](https://www.skyscrapercenter.com/complex/2877)
- CFC Tower: [Architectural Record](https://www.architecturalrecord.com/articles/14475-casablanca-finance-city-tower-by-morphosis), [WorldArchitecture](https://worldarchitecture.org/article-links/egmme/morphosis-casablanca-finance-tower-featuring-patterned-mosaics-addresses-to-moroccan-architecture.html), [Metalocus](https://www.metalocus.es/en/news/new-project-morphosis-casablanca), [Bymaro](https://www.bymaro.com/en/reference/1670/), [VSL](https://vsl.com/projects/casablanca-finance-citys-cfc-tower), [Doka](https://www.doka.com/me/references/europe/tour-cfc)
- BCP: [TESS](https://tess.fr/en/node/578), [Medias24 2025](https://medias24.com/2025/06/17/la-tour-bcp-est-prete-demenagement-imminent/), [Yabiladi](https://en.yabiladi.com/articles/details/192376/morocco-s-tallest-skyscrapers-from-twin.html)
- AWB: [Viguier](https://viguier.com/fr/projet/borj-attijariwafa-casablanca/), [Omteq](https://omteq.com/en/projects/borj-attijari/), [Figueras](https://figueras.com/project/borj-attijariwafa/), [Le360 2018](https://fr.le360.ma/economie/casablanca-finance-city-une-tour-de-27-etages-pour-attijariwafa-bankmais-pas-de-siege-158695/)
- CIMR: [DL2A](https://dl2a.fr/en/node/831), [Le360](https://fr.le360.ma/economie/la-cimr-quitte-enfin-son-siege-historique-et-sinstalle-a-cfc-avec-deux-ans-de-retard-257534/)
- M Tower: [FNH](https://www.fnh.ma/article/actualites-marocaines/m-tower-cfc), [Le360](https://fr.le360.ma/societe/lancement-des-travaux-de-la-plus-grande-tour-de-casablanca_XHR7O2RDHZBJXF4QV4QSZJ7AA4/)
- Others: [Casa Business Towers](https://www.casabusinesstowers.ma/), [AWM lots 58/65-1](https://www.awmountassir.com/awm_projet/immeuble-de-bureaux-cfc-casa-anfa/), [BO 52 ArchDaily](https://www.archdaily.com/970931/bo-52-apartment-building-yachar-bouhaya-architecte-plus-saad-el-kabbaj-plus-driss-kettani-plus-mohamed-amine-siana), [Gardens of Anfa, designboom](https://www.designboom.com/architecture/edouard-francois-the-gardens-of-anfa-morocco-03-18-2014/), [Tour Jasmin, FNH](https://fnh.ma/article/actualite-entreprises/yasmine-signature-se-lance-dans-l-immobilier-de-bureau-haut-de-gamme), [Luxuria, TelQuel](https://telquel.ma/2020/01/06/la-cgi-lance-a-casa-anfa-la-commercialisation-de-son-nouveau-projet-luxuria-tower_1663577), [Hamonic+Masson](https://hamonic-masson.com/?p=7909), [Radisson, FNH](https://www.fnh.ma/article/actualites-marocaines/casa-anfa-radisson), [Casa Anfa overview](https://www.voyages-d-affaires.com/en/anfa-nouveau-est-casablanca), [Anfa Park](https://www.bladi.net/anfa-park-casablanca,65912.html), [Africa50](https://www.africa50.com/news-events/africa50-inaugurates-its-headquarters-in-casablanca-235/)
- Map data: © OpenStreetMap contributors, ODbL. <https://www.openstreetmap.org/copyright>
