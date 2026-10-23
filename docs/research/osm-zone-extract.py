#!/usr/bin/env python3
"""Generic OpenStreetMap district extractor for the Casablanca twin (data © OpenStreetMap contributors, ODbL 1.0).

Turns a raw OSM XML extract (main API /api/0.6/map) into a TypeScript data module of one "zone": buildings (ways and
multipolygon relations, with their levels / height / façade colour and whether a shop or office point lies inside),
streets, footpaths, open spaces, trees, crossings, traffic signals and bus stops, in zone-local metres
(x east, z south, origin = the given lat/lon; equirectangular projection at that latitude, R = 6371008.8 m).

Usage (Maârif pilot, origin = the OSM node "Twin Center" 770235536):
  curl -o map.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-7.64050,33.58047,-7.62495,33.59243"
  python3 docs/research/osm-zone-extract.py map.osm components/scenes/city/landmarks/zones/maarifData.ts \
      --name MAARIF --lat 33.5865844 --lon -7.6322923 --box -642.5 557.5 -525 555

The CFC district (cfcData.ts) still comes from its first extractor, cfc-osm-extract.py (same projection).
"""
import argparse, json, math, xml.etree.ElementTree as ET

R = 6371008.8
ap = argparse.ArgumentParser()
ap.add_argument("osm"); ap.add_argument("out")
ap.add_argument("--name", required=True)
ap.add_argument("--lat", type=float, required=True); ap.add_argument("--lon", type=float, required=True)
ap.add_argument("--box", type=float, nargs=4, required=True, metavar=("X0", "X1", "Z0", "Z1"))
A = ap.parse_args()
LAT0, LON0, BOX = A.lat, A.lon, A.box


def xz(lat, lon):
    return ((lon - LON0) * math.pi / 180 * R * math.cos(math.radians(LAT0)), -(lat - LAT0) * math.pi / 180 * R)


def inside(p, m=0.0):
    return BOX[0] + m < p[0] < BOX[1] - m and BOX[2] + m < p[1] < BOX[3] - m


def area(p):
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p))) / 2


def in_poly(p, x, z):
    c, j = False, len(p) - 1
    for i in range(len(p)):
        if (p[i][1] > z) != (p[j][1] > z) and x < (p[j][0] - p[i][0]) * (z - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0]:
            c = not c
        j = i
    return c


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dz = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dz) or 1e-9
    best, k = -1.0, 0
    for i in range(1, len(pts) - 1):
        d = abs((pts[i][0] - a[0]) * dz - (pts[i][1] - a[1]) * dx) / L
        if d > best:
            best, k = d, i
    return rdp(pts[: k + 1], eps)[:-1] + rdp(pts[k:], eps) if best > eps else [a, b]


def rdp_ring(p, eps):
    if len(p) < 4:
        return p
    k = max(range(len(p)), key=lambda i: math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]))
    return rdp(p[: k + 1], eps)[:-1] + rdp(p[k:] + [p[0]], eps)[:-1]


def obb(p):
    best = None
    for i in range(len(p)):
        q, r = p[i], p[(i + 1) % len(p)]
        ang = math.atan2(r[1] - q[1], r[0] - q[0])
        c, s = math.cos(ang), math.sin(ang)
        us = [x * c + z * s for x, z in p]; vs = [-x * s + z * c for x, z in p]
        Ar = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or Ar < best[0]:
            mu, mv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            best = (Ar, mu * c - mv * s, mu * s + mv * c, ang, max(us) - min(us), max(vs) - min(vs))
    _, cx, cz, ang, w, d = best
    return (cx, cz, -ang, w, d)  # three.js yaw: local +x -> (cos yaw, -sin yaw)


def clip_poly(p, m):
    x0, x1, z0, z1 = BOX[0] + m, BOX[1] - m, BOX[2] + m, BOX[3] - m
    edges = [(lambda q: q[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
             (lambda q: q[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
             (lambda q: q[1] >= z0, lambda a, b: (a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0)),
             (lambda q: q[1] <= z1, lambda a, b: (a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1))]
    out = p
    for ins, cut in edges:
        src, out = out, []
        for i in range(len(src)):
            a, b = src[i - 1], src[i]
            if ins(b):
                if not ins(a): out.append(cut(a, b))
                out.append(b)
            elif ins(a):
                out.append(cut(a, b))
        if not out: break
    return out


def clip_line(pts, m):
    x0, x1, z0, z1 = BOX[0] + m, BOX[1] - m, BOX[2] + m, BOX[3] - m
    runs, cur = [], []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        t0, t1, ok = 0.0, 1.0, True
        for pp, qq in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dz, a[1] - z0), (dz, z1 - a[1])):
            if pp == 0:
                if qq < 0: ok = False
            else:
                t = qq / pp
                if pp < 0: t0 = max(t0, t)
                else: t1 = min(t1, t)
        if not ok or t0 > t1:
            if cur: runs.append(cur); cur = []
            continue
        P, Q = (a[0] + dx * t0, a[1] + dz * t0), (a[0] + dx * t1, a[1] + dz * t1)
        if not cur: cur = [P]
        elif math.hypot(cur[-1][0] - P[0], cur[-1][1] - P[1]) > 0.01: runs.append(cur); cur = [P]
        cur.append(Q)
        if t1 < 1.0: runs.append(cur); cur = []
    if cur: runs.append(cur)
    return [r for r in runs if len(r) > 1 and sum(math.hypot(r[k + 1][0] - r[k][0], r[k + 1][1] - r[k][1]) for k in range(len(r) - 1)) > 4]


rd = lambda v: round(v * 4) / 4
flat = lambda p: [rd(c) for q in p for c in q]
num = lambda s: float(s.split(";")[0].replace(",", ".").replace("m", "").strip()) if s else None

root = ET.parse(A.osm).getroot()
nodes, ntag = {}, {}
for n in root.iter("node"):
    nodes[n.get("id")] = xz(float(n.get("lat")), float(n.get("lon")))
    t = {k.get("k"): k.get("v") for k in n.findall("tag")}
    if t: ntag[n.get("id")] = t
ways = {w.get("id"): ([nd.get("ref") for nd in w.findall("nd")], {k.get("k"): k.get("v") for k in w.findall("tag")}) for w in root.iter("way")}
rels = [(r.get("id"), [(m.get("type"), m.get("ref"), m.get("role")) for m in r.findall("member")], {k.get("k"): k.get("v") for k in r.findall("tag")}) for r in root.iter("relation")]


def ccw(p):
    if len(p) > 1 and p[0] == p[-1]: p = p[:-1]
    return p[::-1] if area(p) < 0 else p


def join_rings(way_ids):
    """assemble the member ways of a multipolygon role into closed rings"""
    segs = [[r for r in ways[w][0] if r in nodes] for w in way_ids if w in ways]
    rings = []
    while segs:
        cur = segs.pop(0)
        changed = True
        while cur[0] != cur[-1] and changed:
            changed = False
            for i, s in enumerate(segs):
                if s[0] == cur[-1]: cur += s[1:]
                elif s[-1] == cur[-1]: cur += s[::-1][1:]
                elif s[-1] == cur[0]: cur = s[:-1] + cur
                elif s[0] == cur[0]: cur = s[::-1][:-1] + cur
                else: continue
                segs.pop(i); changed = True; break
        if cur[0] == cur[-1] and len(cur) > 3: rings.append([nodes[r] for r in cur])
    return rings


# points of interest (shops, offices, cafés …): their buildings get shopfronts
POI = [nodes[i] for i, t in ntag.items() if any(k in t for k in ("shop", "office", "craft")) or t.get("amenity") in
       ("restaurant", "cafe", "bank", "fast_food", "pharmacy", "bar", "ice_cream", "money_transfer", "clinic", "doctors", "dentist")]

# ------------------------------------------------------------------ buildings
raw = []  # (id, tags, outer, holes)
for wid, (refs, t) in ways.items():
    if ("building" in t or "building:part" in t) and refs[0] == refs[-1]:
        raw.append((int(wid), t, ccw([nodes[r] for r in refs if r in nodes]), []))
for rid, mem, t in rels:
    if t.get("type") == "multipolygon" and "building" in t:
        outers = join_rings([m[1] for m in mem if m[0] == "way" and m[2] in ("outer", "")])
        inners = join_rings([m[1] for m in mem if m[0] == "way" and m[2] == "inner"])
        for k, o in enumerate(outers):
            o = ccw(o)
            raw.append((-int(rid) * 10 - k, t, o, [ccw(h)[::-1] for h in inners if in_poly(o, *h[0])]))
parts = [b for b in raw if "building:part" in b[1]]
blds = []
for bid, t, p, holes in raw:
    if len(p) < 3 or not all(inside(q, 2) for q in p): continue
    A_ = abs(area(p))
    if "building:part" not in t:
        cover = sum(abs(area(q[2])) for q in parts if in_poly(p, *(sum(v[0] for v in q[2]) / len(q[2]), sum(v[1] for v in q[2]) / len(q[2]))))
        if cover > 0.85 * A_: continue  # drawn by its parts
    p = rdp_ring(p, 0.3)
    if len(p) < 3: continue
    holes = [rdp_ring(h, 0.3) for h in holes]
    cx, cz, yaw, w, d = obb(p)
    shop = any(in_poly(p, x, z) for x, z in POI)
    col = t.get("building:colour") or t.get("building:facade:colour")
    blds.append({
        "id": bid, "type": t.get("building") or "part", "name": t.get("name:fr") or t.get("name") or t.get("addr:housename") or "",
        "lv": num(t.get("building:levels")), "h": num(t.get("height")), "minLv": num(t.get("building:min_level")),
        "col": col or "", "roof": t.get("roof:colour") or "", "shop": 1 if shop else 0, "a": round(A_),
        "p": flat(p), "holes": [flat(h) for h in holes if len(h) > 2], "o": [rd(cx), rd(cz), round(yaw, 4), rd(w), rd(d)],
    })
blds.sort(key=lambda b: b["id"])

# ------------------------------------------------------------------ streets, paths, tram
DRIVE = {"trunk": 3, "primary": 3, "secondary": 2, "tertiary": 2, "residential": 1, "unclassified": 1, "service": 1,
         "primary_link": 1, "secondary_link": 1, "tertiary_link": 1, "busway": 1, "living_street": 1}
roads, paths, tram = [], [], []
for wid, (refs, t) in ways.items():
    hw, rw = t.get("highway"), t.get("railway")
    pts = [nodes[r] for r in refs if r in nodes]
    if hw in DRIVE:
        one = t.get("oneway") == "yes" or hw == "busway"
        lanes = int(num(t.get("lanes")) or 0) or (DRIVE[hw] if one else 2 * DRIVE[hw])
        w = 6.0 if hw == "service" else 7.0 if hw == "busway" else max(6.5, lanes * 3.3)
        for r in clip_line(rdp(pts, 0.5), 7):
            roads.append({"w": w, "k": hw, "o": 1 if one else 0, "name": t.get("name:fr") or t.get("name") or "", "p": flat(r)})
    elif hw in ("footway", "pedestrian", "path", "cycleway", "steps"):
        if t.get("footway") in ("sidewalk", "crossing"): continue  # drawn with the street pavements / zebras
        for r in clip_line(rdp(pts, 0.4), 2):
            paths.append({"w": 5.0 if hw == "pedestrian" else 2.4, "p": flat(r)})
    elif rw == "tram":
        for r in clip_line(rdp(pts, 0.5), 2):
            tram.append(flat(r))

# ------------------------------------------------------------------ areas
AREA = [("leisure", "park", "park"), ("leisure", "garden", "garden"), ("landuse", "grass", "grass"), ("natural", "grassland", "grass"),
        ("landuse", "meadow", "grass"), ("natural", "scrub", "scrub"), ("leisure", "pitch", "pitch"), ("leisure", "playground", "play"),
        ("natural", "water", "water"), ("leisure", "swimming_pool", "pool"), ("amenity", "fountain", "water"),
        ("landuse", "construction", "site"), ("landuse", "brownfield", "site"), ("leisure", "sports_centre", "sport"),
        ("highway", "pedestrian", "plaza"), ("amenity", "parking", "parking")]
areas = []
for wid, (refs, t) in ways.items():
    if refs[0] != refs[-1]: continue
    kind = next((k for key, val, k in AREA if t.get(key) == val and (key != "highway" or t.get("area") == "yes")), None)
    if not kind: continue
    p = clip_poly(ccw([nodes[r] for r in refs if r in nodes]), 1)
    if len(p) < 3 or abs(area(p)) < 12: continue
    areas.append({"k": kind, "name": t.get("name:fr") or t.get("name") or "", "p": flat(rdp_ring(p, 0.4))})
ORDER = ["park", "grass", "garden", "scrub", "site", "sport", "parking", "plaza", "pitch", "play", "water", "pool"]
areas.sort(key=lambda a: ORDER.index(a["k"]))

# ------------------------------------------------------------------ points
rows = [flat(r) for refs, t in ways.values() if t.get("natural") == "tree_row" for r in clip_line([nodes[x] for x in refs if x in nodes], 2)]
pt = lambda kind: [[rd(nodes[i][0]), rd(nodes[i][1])] for i, t in ntag.items() if kind(t) and inside(nodes[i], 2)]
trees = pt(lambda t: t.get("natural") == "tree")
crossings = pt(lambda t: t.get("highway") == "crossing" or t.get("crossing") in ("zebra", "marked", "traffic_signals"))
signals = pt(lambda t: t.get("highway") == "traffic_signals")
bus = [{"name": t.get("name", ""), "x": rd(nodes[i][0]), "z": rd(nodes[i][1])} for i, t in ntag.items() if t.get("highway") == "bus_stop" and inside(nodes[i], 2)]
# named places worth a label: clinics and hospitals, places of worship, hotels (points, or the centre of their outline)
PK = lambda t: "hospital" if t.get("amenity") == "hospital" else "clinic" if t.get("amenity") == "clinic" else "worship" if t.get("amenity") == "place_of_worship" else "hotel" if t.get("tourism") == "hotel" else None
pois = [{"name": t.get("name:fr") or t.get("name"), "kind": PK(t), "x": rd(nodes[i][0]), "z": rd(nodes[i][1])} for i, t in ntag.items() if PK(t) and t.get("name") and inside(nodes[i], 2)]
for wid, (refs, t) in ways.items():
    if PK(t) and t.get("name"):
        p = [nodes[r] for r in refs if r in nodes]
        cx, cz = sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p)
        if inside((cx, cz), 2): pois.append({"name": t.get("name:fr") or t.get("name"), "kind": PK(t), "x": rd(cx), "z": rd(cz)})
for rid, mem, t in rels:
    if PK(t) and t.get("name"):
        ps = [nodes[r] for m in mem if m[0] == "way" and m[1] in ways for r in ways[m[1]][0] if r in nodes]
        if ps:
            cx, cz = sum(q[0] for q in ps) / len(ps), sum(q[1] for q in ps) / len(ps)
            if inside((cx, cz), 2): pois.append({"name": t.get("name:fr") or t.get("name"), "kind": PK(t), "x": rd(cx), "z": rd(cz)})

zone = {"name": A.name, "origin": {"lat": LAT0, "lon": LON0}, "box": {"x0": BOX[0], "x1": BOX[1], "z0": BOX[2], "z1": BOX[3]},
        "buildings": blds, "roads": roads, "paths": paths, "tram": tram, "areas": areas, "treeRows": rows, "trees": trees,
        "crossings": crossings, "signals": signals, "bus": bus, "pois": pois}
with open(A.out, "w") as f:
    f.write("// GENERATED by docs/research/osm-zone-extract.py from OpenStreetMap: do not edit by hand.\n")
    f.write("// Data © OpenStreetMap contributors, Open Database Licence 1.0 (https://www.openstreetmap.org/copyright).\n")
    f.write(f"// Zone {A.name}: local metres from lat {LAT0}, lon {LON0}; x east, z south.\n/* eslint-disable */\n")
    f.write('import type { OsmZone } from "./types";\n')
    f.write(f"export const {A.name}: OsmZone = " + json.dumps(zone, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"{A.name}: {len(blds)} buildings ({sum(1 for b in blds if b['lv'])} with levels, {sum(1 for b in blds if b['shop'])} with shops), "
      f"{len(roads)} roads, {len(paths)} paths, {len(areas)} areas, {len(trees)} trees, {len(rows)} tree rows, {len(crossings)} crossings, "
      f"{len(signals)} signals, {len(bus)} bus stops, {len(tram)} tram, {len(pois)} named places")
