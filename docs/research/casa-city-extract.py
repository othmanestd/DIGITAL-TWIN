#!/usr/bin/env python3
"""Casablanca city layer for "Casa réel" mode: every OpenStreetMap building, street, railway and open space of the city,
projected through the single geographic chain of lib/geo/casaFrame.ts and cut into 1 km tiles (public/casa/tiles/*.json).
Data © OpenStreetMap contributors, ODbL 1.0 (https://www.openstreetmap.org/copyright).

Source: the Geofabrik extract of Morocco (https://download.geofabrik.de/africa/morocco-latest.osm.pbf), read with pyosmium.
Usage:  python3 docs/research/casa-city-extract.py morocco.osm.pbf public/casa

Projection (same as casaFrame.geoToScene): x = (lon − LON0)·K·cos(LAT0), z = −(lat − LAT0)·K, K = π/180 · 6371008.8,
origin (LAT0, LON0) = CASA_LONLAT (33.5731, −7.5898). Coordinates are written relative to the tile corner, in decimetres.
Heights: OSM `height`, else `building:levels` × 3.2 m + 1.4 m, else an estimate by building type (flagged e = 1).
"""
import json, math, os, sys
import osmium

LAT0, LON0, R = 33.5731, -7.5898, 6371008.8
K = math.pi / 180 * R
COS0 = math.cos(math.radians(LAT0))
BBOX = (33.47, -7.80, 33.67, -7.42)  # lat0, lon0, lat1, lon1 — the metropolitan area seen from the city view
T = 1000.0                           # tile size (m)

def xz(lat, lon): return ((lon - LON0) * K * COS0, -(lat - LAT0) * K)
def inside(lat, lon): return BBOX[0] <= lat <= BBOX[2] and BBOX[1] <= lon <= BBOX[3]
def num(s):
    if not s: return None
    try: return float(s.split(";")[0].replace(",", ".").replace("m", "").strip())
    except ValueError: return None

EST = {"house": 2, "detached": 2, "semidetached_house": 2, "villa": 2, "terrace": 2, "residential": 5, "apartments": 5, "yes": 3,
       "commercial": 3, "retail": 2, "office": 6, "industrial": 2, "warehouse": 2, "school": 3, "hospital": 5, "mosque": 2, "garage": 1,
       "roof": 1, "hut": 1, "shed": 1, "construction": 1}
KIND = {"house": "v", "detached": "v", "villa": "v", "semidetached_house": "v", "terrace": "v", "industrial": "i", "warehouse": "i",
        "office": "o", "commercial": "c", "retail": "c", "mosque": "m", "school": "p", "hospital": "p", "university": "p", "public": "p"}
ROAD_W = {"motorway": 2 * 3 * 3.5, "trunk": 2 * 3 * 3.4, "primary": 2 * 2 * 3.4, "secondary": 2 * 2 * 3.3, "tertiary": 2 * 3.3,
          "residential": 6.6, "unclassified": 6.6, "living_street": 5.5, "service": 5.0, "pedestrian": 5.0,
          "motorway_link": 7, "trunk_link": 7, "primary_link": 7, "secondary_link": 6.5, "tertiary_link": 6.5}
AREA = [("leisure", ("park", "garden"), "park"), ("landuse", ("grass", "meadow", "village_green", "recreation_ground"), "grass"),
        ("landuse", ("forest",), "wood"), ("natural", ("wood", "scrub", "grassland"), "wood"), ("landuse", ("cemetery",), "cemetery"),
        ("natural", ("beach", "sand"), "beach"), ("natural", ("water",), "water"), ("leisure", ("pitch", "stadium", "track"), "pitch"),
        ("landuse", ("industrial", "railway"), "industrial"), ("amenity", ("parking",), "parking"), ("highway", ("pedestrian",), "plaza"),
        ("place", ("square",), "plaza"), ("leisure", ("swimming_pool",), "water")]

tiles = {}
def tile(x, z):
    k = (math.floor(x / T), math.floor(z / T))
    t = tiles.get(k)
    if t is None: t = tiles[k] = {"b": [], "r": [], "a": [], "l": []}
    return k, t
q = lambda v, o: round((v - o) * 10)  # decimetres from the tile corner

def ring_xz(ring):
    pts = []
    for n in ring:
        if not n.location.valid(): return None
        pts.append(xz(n.location.lat, n.location.lon))
    return pts

def simplify(p, eps=0.4):
    out = [p[0]]
    for v in p[1:]:
        if math.hypot(v[0] - out[-1][0], v[1] - out[-1][1]) >= eps: out.append(v)
    return out

class H(osmium.SimpleHandler):
    def area(self, a):
        tg = a.tags
        b = tg.get("building")
        kind = None if b else next((k for key, vals, k in AREA if tg.get(key) in vals and (key != "highway" or tg.get("area") == "yes")), None)
        if not b and not kind: return
        for outer in a.outer_rings():
            p = ring_xz(outer)
            if not p or len(p) < 4: continue
            lat, lon = outer[0].location.lat, outer[0].location.lon
            if not inside(lat, lon): continue
            p = simplify(p[:-1] if p[0] == p[-1] else p)
            if len(p) < 3: continue
            cx = sum(v[0] for v in p) / len(p); cz = sum(v[1] for v in p) / len(p)
            (i, j), t = tile(cx, cz)
            ox, oz = i * T, j * T
            flat = [c for v in p for c in (q(v[0], ox), q(v[1], oz))]
            if b:
                if tg.get("building:part"): continue
                h = num(tg.get("height")); lv = num(tg.get("building:levels")); est = 0
                if h is None:
                    if lv is None: lv = EST.get(b, 3); est = 1
                    h = lv * 3.2 + 1.4 if KIND.get(b) != "i" else max(6.0, lv * 4.5)
                rec = {"p": flat, "h": round(h, 1), "k": KIND.get(b, "r")}
                if est: rec["e"] = 1
                mh = num(tg.get("min_height"))
                if mh: rec["m"] = round(mh, 1)
                t["b"].append(rec)
            else:
                t["a"].append({"p": flat, "k": kind})

    def way(self, w):
        tg = w.tags
        hw, rw = tg.get("highway"), tg.get("railway")
        if hw not in ROAD_W and rw not in ("rail", "tram", "light_rail", "subway"): return
        if tg.get("area") == "yes": return
        try: p = [xz(n.lat, n.lon) for n in w.nodes]
        except osmium.InvalidLocationError: return
        if len(p) < 2 or not any(inside(n.lat, n.lon) for n in w.nodes): return
        p = simplify(p, 0.8)
        if len(p) < 2: return
        # cut the polyline at tile borders loosely: assign by midpoint of each 250 m run
        run = [p[0]]; L = 0.0
        def flush(run):
            if len(run) < 2: return
            mx = (run[0][0] + run[-1][0]) / 2; mz = (run[0][1] + run[-1][1]) / 2
            (i, j), t = tile(mx, mz); ox, oz = i * T, j * T
            flat = [c for v in run for c in (q(v[0], ox), q(v[1], oz))]
            if hw:
                one = tg.get("oneway") == "yes"
                lanes = num(tg.get("lanes"))
                wdt = ROAD_W[hw] if not lanes else max(5.0, lanes * 3.3)
                if one and not lanes: wdt = wdt / 2 if hw in ("motorway", "trunk", "primary", "secondary", "tertiary") else wdt
                t["r"].append({"p": flat, "w": round(wdt, 1), "c": hw})
            else:
                t["l"].append({"p": flat, "c": rw})
        for v in p[1:]:
            L += math.hypot(v[0] - run[-1][0], v[1] - run[-1][1]); run.append(v)
            if L > 250: flush(run); run = [v]; L = 0.0
        flush(run)

if __name__ == "__main__":
    src, out = sys.argv[1], sys.argv[2]
    H().apply_file(src, locations=True, idx="flex_mem")
    os.makedirs(os.path.join(out, "tiles"), exist_ok=True)
    index = []
    for (i, j), t in tiles.items():
        if not (t["b"] or t["r"] or t["a"] or t["l"]): continue
        with open(os.path.join(out, "tiles", f"{i}_{j}.json"), "w") as f: json.dump(t, f, separators=(",", ":"))
        index.append([i, j, len(t["b"]), len(t["r"])])
    with open(os.path.join(out, "index.json"), "w") as f:
        json.dump({"tile": T, "origin": [LAT0, LON0], "bbox": BBOX, "tiles": index,
                   "licence": "Data © OpenStreetMap contributors, ODbL 1.0", "source": "Geofabrik morocco extract, read with pyosmium"}, f)
    nb = sum(x[2] for x in index); nr = sum(x[3] for x in index)
    print(f"{len(index)} tiles, {nb} buildings, {nr} street runs")
