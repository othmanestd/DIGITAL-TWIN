#!/usr/bin/env python3
"""Illustrative frontage volumes for the Casablanca city layer (public/casa/tiles), where OpenStreetMap maps the streets
but no building at all. They are NOT real footprints: each one is flagged f = 1 (and e = 1, estimated height) in the tile.

Rules (deterministic):
  · along residential / unclassified / living / tertiary / secondary / primary streets only;
  · only in the urban fabric: at least 900 m of mapped streets within 150 m of the lot (vacant land and fields have few);
  · never within 15 m of an OSM building, never on a street or its pavement (3.2 m), never in a park, garden, wood,
    cemetery, beach, water, pitch, industrial land or parking, never in the sea (OSM coastline);
  · lots of 10 … 18 m along the street, 12 … 16 m deep, 3 … 5 storeys (3.2 m + 1.4 m), set back behind the pavement.
Usage:  python3 docs/research/casa-city-fillers.py public/casa components/scenes/city/landmarks/zones/coastData.ts
"""
import glob, json, math, os, sys

T = 1000.0
LAT0, LON0, R = 33.5731, -7.5898, 6371008.8
K = math.pi / 180 * R; COS0 = math.cos(math.radians(LAT0))
FILL_ROADS = {"residential", "unclassified", "living_street", "tertiary", "secondary", "primary", "tertiary_link", "secondary_link"}
NO_FILL = {"park", "grass", "wood", "cemetery", "beach", "water", "pitch", "industrial", "parking", "plaza"}
C = 25.0  # index cell (m)

out_dir, coast_ts = sys.argv[1], sys.argv[2]
tiles = {}
for f in glob.glob(os.path.join(out_dir, "tiles", "*.json")):
    i, j = map(int, os.path.basename(f)[:-5].split("_"))
    tiles[(i, j)] = json.load(open(f))
    tiles[(i, j)]["b"] = [b for b in tiles[(i, j)]["b"] if not b.get("f")]  # idempotent: drop earlier fillers

def world(p, i, j): return [(i * T + p[k] / 10, j * T + p[k + 1] / 10) for k in range(0, len(p), 2)]
grid_b, grid_r, grid_a = {}, {}, {}
def put(g, x, z, v):
    g.setdefault((math.floor(x / C), math.floor(z / C)), []).append(v)
def near(g, x, z, r):
    out = []
    for a in range(math.floor((x - r) / C), math.floor((x + r) / C) + 1):
        for b in range(math.floor((z - r) / C), math.floor((z + r) / C) + 1): out.extend(g.get((a, b), ()))
    return out
segs = []
for (i, j), t in tiles.items():
    for b in t["b"]:
        for (x, z) in world(b["p"], i, j): put(grid_b, x, z, (x, z))
    for r in t["r"]:
        P = world(r["p"], i, j)
        for k in range(len(P) - 1):
            s = (P[k][0], P[k][1], P[k + 1][0], P[k + 1][1], r["w"], r["c"])
            segs.append(s)
            L = math.hypot(s[2] - s[0], s[3] - s[1]); n = max(1, int(L / C))
            for q in range(n + 1): put(grid_r, s[0] + (s[2] - s[0]) * q / n, s[1] + (s[3] - s[1]) * q / n, s)
    for a in t["a"]:
        if a["k"] in NO_FILL:
            P = world(a["p"], i, j)
            xs = [v[0] for v in P]; zs = [v[1] for v in P]
            rec = (min(xs), max(xs), min(zs), max(zs), P)
            for x in range(math.floor(rec[0] / C), math.floor(rec[1] / C) + 1):
                for z in range(math.floor(rec[2] / C), math.floor(rec[3] / C) + 1): grid_a.setdefault((x, z), []).append(rec)

def in_poly(P, x, z):
    c, jj = False, len(P) - 1
    for ii in range(len(P)):
        if (P[ii][1] > z) != (P[jj][1] > z) and x < (P[jj][0] - P[ii][0]) * (z - P[ii][1]) / (P[jj][1] - P[ii][1]) + P[ii][0]: c = not c
        jj = ii
    return c
def seg_d(s, x, z):
    dx, dz = s[2] - s[0], s[3] - s[1]; L2 = dx * dx + dz * dz or 1
    t = max(0, min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / L2))
    return math.hypot(x - s[0] - dx * t, z - s[1] - dz * t)

# the sea: side of the OSM coastline (land on the left of the line)
src = open(coast_ts).read(); nums = json.loads(src[src.index("COASTLINE: number[] = ") + len("COASTLINE: number[] = "):].rstrip().rstrip(";"))
coast = [((nums[k + 1] - LON0) * K * COS0, -(nums[k] - LAT0) * K) for k in range(0, len(nums), 2)]
def in_sea(x, z):
    best, side = 1e18, 0
    for k in range(len(coast) - 1):
        a, b = coast[k], coast[k + 1]
        dx, dz = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dz * dz or 1
        t = max(0, min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2))
        d = math.hypot(x - a[0] - dx * t, z - a[1] - dz * t)
        if d < best: best, side = d, dx * (z - a[1]) - dz * (x - a[0])
    return side > 0  # right of the line (walking with the land on the left; x east, z south) = sea
sea_cache = {}
def sea_at(x, z):
    k = (math.floor(x / 200), math.floor(z / 200))
    if k not in sea_cache: sea_cache[k] = in_sea(k[0] * 200 + 100, k[1] * 200 + 100)
    return sea_cache[k]

def street_len(x, z, r=150.0):
    seen, L = set(), 0.0
    for s in near(grid_r, x, z, r):
        if id(s) in seen: continue
        seen.add(id(s))
        if seg_d(s, x, z) < r: L += math.hypot(s[2] - s[0], s[3] - s[1])
    return L
dens_cache = {}
def urban(x, z):
    k = (math.floor(x / 100), math.floor(z / 100))
    if k not in dens_cache: dens_cache[k] = street_len(k[0] * 100 + 50, k[1] * 100 + 50) >= 900
    return dens_cache[k]

h01 = lambda x, z: (math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1.0
placed = {}
def clash(cx, cz, q):
    for (px, pz, pq) in near(placed, cx, cz, 30):
        if math.hypot(px - cx, pz - cz) < 25 and overlap(q, pq): return True
    return False
def overlap(a, b):
    for P in (a, b):
        for k in range(4):
            e = (P[(k + 1) % 4][0] - P[k][0], P[(k + 1) % 4][1] - P[k][1]); ax, az = -e[1], e[0]
            pa = [v[0] * ax + v[1] * az for v in a]; pb = [v[0] * ax + v[1] * az for v in b]
            if max(pa) < min(pb) or max(pb) < min(pa): return False
    return True

count = 0
for s in segs:
    if s[5] not in FILL_ROADS: continue
    ax, az, bx, bz, w = s[0], s[1], s[2], s[3], s[4]
    L = math.hypot(bx - ax, bz - az)
    if L < 14: continue
    ux, uz = (bx - ax) / L, (bz - az) / L; nx, nz = -uz, ux
    for side in (-1, 1):
        t = 4.0
        while t < L - 4:
            lw = 10 + int(h01(ax + t, az + side) * 9); D = 12 + int(h01(az - t, ax) * 5); off = w / 2 + 3.6 + D / 2
            cx = ax + ux * (t + lw / 2) + nx * off * side; cz = az + uz * (t + lw / 2) + nz * off * side
            t += lw + 0.3
            hw, hd = lw / 2, D / 2
            q = [(cx + ux * a + nx * b * side, cz + uz * a + nz * b * side) for a, b in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))]
            samples = [(cx, cz)] + q
            if not urban(cx, cz) or sea_at(cx, cz): continue
            if any(math.hypot(px - cx, pz - cz) < 15 + hw for (px, pz) in near(grid_b, cx, cz, 15 + hw)): continue
            if any(seg_d(r, x, z) < r[4] / 2 + 3.2 for (x, z) in samples for r in near(grid_r, x, z, 20)): continue
            if any(rec[0] <= x <= rec[1] and rec[2] <= z <= rec[3] and in_poly(rec[4], x, z)
                   for (x, z) in samples for rec in grid_a.get((math.floor(x / C), math.floor(z / C)), ())): continue
            if clash(cx, cz, q): continue
            put(placed, cx, cz, (cx, cz, q))
            i, j = math.floor(cx / T), math.floor(cz / T)
            t_ = tiles.setdefault((i, j), {"b": [], "r": [], "a": [], "l": []})
            lv = 3 + int(h01(cx, cz) * 3)
            t_["b"].append({"p": [round((v[k] - (i * T if k == 0 else j * T)) * 10) for v in q for k in (0, 1)], "h": round(lv * 3.2 + 1.4, 1), "k": "r", "e": 1, "f": 1})
            count += 1

for (i, j), t in tiles.items():
    with open(os.path.join(out_dir, "tiles", f"{i}_{j}.json"), "w") as f: json.dump(t, f, separators=(",", ":"))
idx = json.load(open(os.path.join(out_dir, "index.json")))
idx["tiles"] = [[i, j, len(t["b"]), len(t["r"])] for (i, j), t in tiles.items() if t["b"] or t["r"] or t["a"] or t["l"]]
idx["fillers"] = count
idx["fillers_note"] = "f = 1: illustrative frontage volume where OSM maps streets but no building (docs/research/casa-city-fillers.py)"
json.dump(idx, open(os.path.join(out_dir, "index.json"), "w"))
print("fillers", count)
