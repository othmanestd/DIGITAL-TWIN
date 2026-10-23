#!/usr/bin/env python3
"""Extract the Casablanca Finance City / Casa Anfa district from a raw OpenStreetMap XML file into
components/scenes/city/landmarks/cfcData.ts (data © OpenStreetMap contributors, ODbL 1.0).

Usage:
  curl -o map.osm "https://api.openstreetmap.org/api/0.6/map?bbox=-7.66485,33.55837,-7.65168,33.56727"
  python3 docs/research/cfc-osm-extract.py map.osm components/scenes/city/landmarks/cfcData.ts

Frame: local metres from the centroid of the CFC Tower footprint (way 871612907), x east, z south (map north = -z), the
same orientation as the procedural city. The box BOX (local) is chosen so that its edges fall on the city's 120 m street
grid lines once the tower is placed at geography.CFC (-1750, -500).
"""
import math, sys, json, xml.etree.ElementTree as ET

R = 6371008.8
LAT0, LON0 = 33.5635842, -7.6609624
BOX = (-350.0, 850.0, -400.0, 560.0)  # x0, x1, z0, z1 (local)


def xz(lat, lon):
    return ((lon - LON0) * math.pi / 180 * R * math.cos(math.radians(LAT0)), -(lat - LAT0) * math.pi / 180 * R)


def inside(p, m=0.0):
    return BOX[0] + m < p[0] < BOX[1] - m and BOX[2] + m < p[1] < BOX[3] - m


def area(p):
    a = 0.0
    for i in range(len(p)):
        q, r = p[i], p[(i + 1) % len(p)]
        a += q[0] * r[1] - r[0] * q[1]
    return a / 2


def centroid(p):
    a = area(p)
    if abs(a) < 1e-6:
        return (sum(q[0] for q in p) / len(p), sum(q[1] for q in p) / len(p))
    cx = cz = 0.0
    for i in range(len(p)):
        q, r = p[i], p[(i + 1) % len(p)]
        f = q[0] * r[1] - r[0] * q[1]
        cx += (q[0] + r[0]) * f
        cz += (q[1] + r[1]) * f
    return (cx / (6 * a), cz / (6 * a))


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
    if best > eps:
        return rdp(pts[: k + 1], eps)[:-1] + rdp(pts[k:], eps)
    return [a, b]


def rdp_ring(p, eps):
    """simplify a closed ring: split it at the vertex farthest from the first one, simplify both halves."""
    if len(p) < 4:
        return p
    k = max(range(len(p)), key=lambda i: math.hypot(p[i][0] - p[0][0], p[i][1] - p[0][1]))
    a = rdp(p[: k + 1], eps)
    b = rdp(p[k:] + [p[0]], eps)
    return a[:-1] + b[:-1]


def obb(p):
    """minimum-area bounding rectangle: (cx, cz, yaw, w, d) with yaw about +y (three.js), w along the local x axis."""
    best = None
    for i in range(len(p)):
        q, r = p[i], p[(i + 1) % len(p)]
        ang = math.atan2(r[1] - q[1], r[0] - q[0])
        c, s = math.cos(ang), math.sin(ang)
        us = [x * c + z * s for x, z in p]
        vs = [-x * s + z * c for x, z in p]
        A = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or A < best[0]:
            mu, mv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            best = (A, mu * c - mv * s, mu * s + mv * c, ang, max(us) - min(us), max(vs) - min(vs))
    _, cx, cz, ang, w, d = best
    # three.js yaw: local +x maps to (cos yaw, -sin yaw) in (x, z), so yaw = -ang
    return (cx, cz, -ang, w, d)


def clip_poly(p, m):
    """Sutherland-Hodgman against the box inset by m."""
    x0, x1, z0, z1 = BOX[0] + m, BOX[1] - m, BOX[2] + m, BOX[3] - m
    edges = [(lambda q: q[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
             (lambda q: q[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
             (lambda q: q[1] >= z0, lambda a, b: (a[0] + (b[0] - a[0]) * (z0 - a[1]) / (b[1] - a[1]), z0)),
             (lambda q: q[1] <= z1, lambda a, b: (a[0] + (b[0] - a[0]) * (z1 - a[1]) / (b[1] - a[1]), z1))]
    out = p
    for ins, cut in edges:
        src, out = out, []
        if not src:
            break
        for i in range(len(src)):
            a, b = src[i - 1], src[i]
            if ins(b):
                if not ins(a):
                    out.append(cut(a, b))
                out.append(b)
            elif ins(a):
                out.append(cut(a, b))
    return out


def clip_line(pts, m):
    """split a polyline into the runs inside the box inset by m (Liang-Barsky per segment)."""
    x0, x1, z0, z1 = BOX[0] + m, BOX[1] - m, BOX[2] + m, BOX[3] - m
    runs, cur = [], []
    for i in range(len(pts) - 1):
        a, b = pts[i], pts[i + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]
        t0, t1, ok = 0.0, 1.0, True
        for pp, qq in ((-dx, a[0] - x0), (dx, x1 - a[0]), (-dz, a[1] - z0), (dz, z1 - a[1])):
            if pp == 0:
                if qq < 0:
                    ok = False
            else:
                t = qq / pp
                if pp < 0:
                    t0 = max(t0, t)
                else:
                    t1 = min(t1, t)
        if not ok or t0 > t1:
            if cur:
                runs.append(cur); cur = []
            continue
        A = (a[0] + dx * t0, a[1] + dz * t0)
        B = (a[0] + dx * t1, a[1] + dz * t1)
        if not cur:
            cur = [A]
        elif math.hypot(cur[-1][0] - A[0], cur[-1][1] - A[1]) > 0.01:
            runs.append(cur); cur = [A]
        cur.append(B)
        if t1 < 1.0:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) > 1 and sum(math.hypot(r[k + 1][0] - r[k][0], r[k + 1][1] - r[k][1]) for k in range(len(r) - 1)) > 4]


rd = lambda v: round(v * 4) / 4
flat = lambda p: [rd(c) for q in p for c in q]

root = ET.parse(sys.argv[1]).getroot()
nodes, ntag = {}, {}
for n in root.iter("node"):
    nodes[n.get("id")] = xz(float(n.get("lat")), float(n.get("lon")))
    t = {k.get("k"): k.get("v") for k in n.findall("tag")}
    if t:
        ntag[n.get("id")] = t
ways = {}
for w in root.iter("way"):
    ways[w.get("id")] = ([nd.get("ref") for nd in w.findall("nd")], {k.get("k"): k.get("v") for k in w.findall("tag")})

# the origin: centroid of the CFC Tower footprint
cfc = [nodes[r] for r in ways["871612907"][0][:-1]]
ox, oz = centroid(cfc)
nodes = {k: (v[0] - ox, v[1] - oz) for k, v in nodes.items()}


def ring(refs):
    p = [nodes[r] for r in refs if r in nodes]
    if len(p) > 1 and p[0] == p[-1]:
        p = p[:-1]
    if area(p) < 0:
        p = p[::-1]  # counter-clockwise in (x, z)
    return p


# ------------------------------------------------------------------ buildings
parts_of = set()  # outlines replaced by their building:part children (Luxuria Tower)
SKIP = {"1423480239"}
blds = []
for wid, (refs, t) in ways.items():
    if "building" not in t and "building:part" not in t:
        continue
    if wid in SKIP or refs[0] != refs[-1]:
        continue
    p = ring(refs)
    if len(p) < 3 or not all(inside(q, 2) for q in p):
        continue
    p = rdp_ring(p, 0.35)
    if len(p) < 3:
        continue
    cx, cz, yaw, w, d = obb(p)
    lv = t.get("building:levels")
    h = t.get("height")
    blds.append({
        "id": int(wid), "type": t.get("building") or "part", "name": t.get("name") or t.get("addr:housename") or "",
        "lv": float(lv) if lv else None, "h": float(h) if h else None, "a": round(abs(area(p))),
        "p": flat(p), "o": [rd(cx), rd(cz), round(yaw, 4), rd(w), rd(d)],
    })
blds.sort(key=lambda b: b["id"])

# ------------------------------------------------------------------ streets, paths, tram
DRIVE = {"primary": 3, "secondary": 2, "tertiary": 2, "residential": 1, "unclassified": 1, "service": 1, "secondary_link": 1, "busway": 1, "living_street": 1}
roads, paths, tram = [], [], []
for wid, (refs, t) in ways.items():
    hw, rw = t.get("highway"), t.get("railway")
    pts = [nodes[r] for r in refs if r in nodes]
    if hw in DRIVE:
        one = t.get("oneway") == "yes" or hw == "busway"
        lanes = int(t.get("lanes", "0").split(";")[0] or 0) or (DRIVE[hw] if one else 2 * DRIVE[hw])
        w = 6.0 if hw == "service" else max(6.5, lanes * 3.3)
        if hw == "busway":
            w = 7.0
        for r in clip_line(rdp(pts, 0.6), 7):
            roads.append({"w": w, "k": hw, "o": 1 if one else 0, "p": flat(r)})
    elif hw in ("footway", "pedestrian", "path", "cycleway", "steps"):
        for r in clip_line(rdp(pts, 0.4), 2):
            paths.append({"w": 5.0 if hw == "pedestrian" else 2.4, "p": flat(r)})
    elif rw == "tram":
        for r in clip_line(rdp(pts, 0.5), 2):
            tram.append(flat(r))

# ------------------------------------------------------------------ areas
AREA = [("leisure", "park", "park"), ("leisure", "garden", "garden"), ("landuse", "grass", "grass"), ("natural", "grassland", "grass"),
        ("natural", "scrub", "scrub"), ("leisure", "pitch", "pitch"), ("leisure", "playground", "play"), ("natural", "water", "water"),
        ("leisure", "swimming_pool", "pool"), ("landuse", "construction", "site"), ("landuse", "brownfield", "site"),
        ("leisure", "sports_centre", "sport"), ("highway", "pedestrian", "plaza"), ("amenity", "parking", "parking")]
areas = []
for wid, (refs, t) in ways.items():
    if refs[0] != refs[-1]:
        continue
    kind = next((k for key, val, k in AREA if t.get(key) == val and (key != "highway" or t.get("area") == "yes")), None)
    if not kind:
        continue
    p = clip_poly(ring(refs), 1)
    if len(p) < 3 or abs(area(p)) < 20:
        continue
    p = rdp_ring(p, 0.4)
    areas.append({"k": kind, "name": t.get("name") or "", "p": flat(p)})
ORDER = ["park", "grass", "garden", "scrub", "site", "sport", "parking", "plaza", "pitch", "play", "water", "pool"]
areas.sort(key=lambda a: ORDER.index(a["k"]))

# ------------------------------------------------------------------ point features
rows = []
for wid, (refs, t) in ways.items():
    if t.get("natural") == "tree_row":
        for r in clip_line([nodes[x] for x in refs if x in nodes], 2):
            rows.append(flat(r))
stops, trees = [], []
for nid, t in ntag.items():
    p = nodes[nid]
    if not inside(p, 2):
        continue
    if t.get("railway") == "tram_stop":
        stops.append({"name": t.get("name", ""), "x": rd(p[0]), "z": rd(p[1])})
    elif t.get("natural") in ("tree", "shrub"):
        trees.append([rd(p[0]), rd(p[1])])
# merge the two platforms of a stop
st = []
for s in stops:
    if not any(q["name"] == s["name"] and math.hypot(q["x"] - s["x"], q["z"] - s["z"]) < 60 for q in st):
        st.append(s)

j = lambda v: json.dumps(v, ensure_ascii=False, separators=(",", ":"))
out = []
out.append("// GENERATED by docs/research/cfc-osm-extract.py from OpenStreetMap: do not edit by hand.")
out.append("// Data © OpenStreetMap contributors, Open Database Licence 1.0 (https://www.openstreetmap.org/copyright).")
out.append("// Casablanca Finance City / Casa Anfa, local metres from the CFC Tower footprint centroid: x east, z south.")
out.append("// p = flat [x0, z0, x1, z1, …] polygon (counter-clockwise in x, z) or polyline; o = oriented box [cx, cz, yaw, w, d].")
out.append("/* eslint-disable */")
out.append("export type OsmBuilding = { id: number; type: string; name: string; lv: number | null; h: number | null; a: number; p: number[]; o: [number, number, number, number, number] };")
out.append("export type OsmRoad = { w: number; k: string; o: number; p: number[] };")
out.append("export type OsmArea = { k: string; name: string; p: number[] };")
out.append(f"export const CFC_BOX = {{ x0: {BOX[0]}, x1: {BOX[1]}, z0: {BOX[2]}, z1: {BOX[3]} }};")
out.append("export const OSM_BUILDINGS: OsmBuilding[] = " + j(blds) + ";")
out.append("export const OSM_ROADS: OsmRoad[] = " + j(roads) + ";")
out.append("export const OSM_PATHS: { w: number; p: number[] }[] = " + j(paths) + ";")
out.append("export const OSM_TRAM: number[][] = " + j(tram) + ";")
out.append("export const OSM_AREAS: OsmArea[] = " + j(areas) + ";")
out.append("export const OSM_TREE_ROWS: number[][] = " + j(rows) + ";")
out.append("export const OSM_TREES: number[][] = " + j(trees) + ";")
out.append("export const OSM_TRAM_STOPS: { name: string; x: number; z: number }[] = " + j(st) + ";")
open(sys.argv[2], "w").write("\n".join(out) + "\n")
print(f"origin shift {ox:.2f},{oz:.2f}; {len(blds)} buildings, {len(roads)} roads, {len(paths)} paths, {len(tram)} tram, {len(areas)} areas, {len(rows)} tree rows, {len(trees)} trees, {len(st)} stops")
