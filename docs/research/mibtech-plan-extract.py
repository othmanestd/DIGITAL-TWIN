#!/usr/bin/env python3
"""MIBTECH office floors (1er, 2e, 3e étage) from the architect's dimensioned plans (MB Interior Architects, « plan cotation »,
APS, 16/10/2024, ArchiCAD / GSPublisher PDF exports, « NO SCALE ») → components/scenes/city/landmarks/mibtech/mibtechPlanData.ts

The plans are vector drawings: the geometry is read from their own coordinates (no image tracing).
  · Scale: every dimension text (centimetres; a smaller superscript « 5 » = +0.5 cm; « 2.948 » = 2 948 cm) is matched with its
    dimension line and the ticks around it; the scale is the median of value / tick distance (≈ 4.346 cm per PDF point),
    and every matched dimension is reported with its residual.
  · Layers (fills): white + red hatching = masonry wall; white, unhatched, 18–50 cm thick = window in a wall; white, unhatched,
    long and ≈ 10 cm = glazed façade (curtain wall); white, unhatched, 6–18 cm = WC cubicle / low partition; white, thin
    (< 6 cm) next to a door arc = door leaf (drawn open); other thin white = glass pane; grey = 10 cm partition; black =
    concrete (columns, stair and lift core); white, thicker than 50 cm, not hatched = built-in unit (cabinets).
  · Frame: x along the street façade (towards the north-east, right on the sheet), z towards the street (down on the sheet),
    metres, origin at the middle of the street façade's glass line; the small rotation of the drawing on the sheet is removed.
  · The three sheets share one layout: the stair / lift core is used to check their vertical alignment.
Usage:  python3 docs/research/mibtech-plan-extract.py <dir with the three PDFs> <out .ts> [<dir for the verification PNGs>]
Needs PyMuPDF (pip install pymupdf) and Pillow for the verification renders.
"""
import glob, json, math, os, statistics, sys
import fitz

FLOORS = [(1, "1er ETG"), (2, "2eme ETG"), (3, "3eme ETG")]
PLAN_X_MAX = 990          # PDF points: the title block starts to the right of this
RED_HATCH = (0.5, 0.0, 0.0)


def rgb(c):
    return tuple(round(v, 2) for v in (c or ()))


def poly_of(d):
    pts = []
    for it in d["items"]:
        if it[0] == "l":
            pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif it[0] == "re":
            r = it[1]; pts += [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
        elif it[0] == "qu":
            q = it[1]; pts += [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]
        elif it[0] == "c":   # bezier: sample it (round columns)
            p0, p1, p2, p3 = it[1], it[2], it[3], it[4]
            for k in range(9):
                t = k / 8; a = (1 - t) ** 3; b = 3 * (1 - t) ** 2 * t; c = 3 * (1 - t) * t * t; e = t ** 3
                pts.append((a * p0.x + b * p1.x + c * p2.x + e * p3.x, a * p0.y + b * p1.y + c * p2.y + e * p3.y))
    out = []
    for q in pts:
        if not out or math.hypot(q[0] - out[-1][0], q[1] - out[-1][1]) > 1e-3:
            out.append(q)
    if len(out) > 1 and math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < 1e-3:
        out.pop()
    return out


def inside(P, x, y):
    c = False; j = len(P) - 1
    for i in range(len(P)):
        if (P[i][1] > y) != (P[j][1] > y) and x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]:
            c = not c
        j = i
    return c


def min_rect(P):
    """(length, thickness, angle of the long side) of the minimum-area rectangle over the polygon's edge directions"""
    best = None
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]; L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 1e-6:
            continue
        ux, uy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        us = [q[0] * ux + q[1] * uy for q in P]; vs = [-q[0] * uy + q[1] * ux for q in P]
        w, h = max(us) - min(us), max(vs) - min(vs)
        if best is None or w * h < best[0]:
            ang = math.atan2(uy, ux) if w >= h else math.atan2(ux, -uy)
            best = (w * h, max(w, h), min(w, h), ang)
    return best[1], best[2], best[3]


def dims_of(page):
    out = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            sp = l["spans"]
            if not sp:
                continue
            main = sp[0]["text"].strip()
            if not main or not all(ch.isdigit() or ch == "." for ch in main):
                continue
            v = float(main.replace(".", "")) if "." in main and len(main.split(".")[-1]) == 3 else float(main)
            if len(sp) > 1 and sp[1]["size"] < 4 and sp[1]["text"].strip().isdigit():
                v += float("0." + sp[1]["text"].strip())
            bb = l["bbox"]
            out.append((v, (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, l["dir"][0], l["dir"][1]))
    return out


def calibrate(page, drawings):
    segs = []
    for d in drawings:
        if rgb(d.get("color")) == (0.0, 0.0, 0.0) and round(d.get("width") or 0, 2) == 0.14:
            for it in d["items"]:
                if it[0] == "l":
                    segs.append((it[1].x, it[1].y, it[2].x, it[2].y))
    lines = [s for s in segs if math.hypot(s[2] - s[0], s[3] - s[1]) > 8]
    ticks = [s for s in segs if 1.0 < math.hypot(s[2] - s[0], s[3] - s[1]) < 4.5]
    found = []
    for v, cx, cy, dx, dy in dims_of(page):
        if v < 20:
            continue
        best = None
        for s in lines:
            ux, uy = s[2] - s[0], s[3] - s[1]; L = math.hypot(ux, uy); ux /= L; uy /= L
            if abs(ux * dx + uy * dy) < 0.999:
                continue
            t = (cx - s[0]) * ux + (cy - s[1]) * uy
            if t < 0 or t > L:
                continue
            dist = abs((cx - s[0]) * uy - (cy - s[1]) * ux)
            if dist < 5 and (best is None or dist < best[0]):
                best = (dist, s, ux, uy, t)
        if not best:
            continue
        _, s, ux, uy, t = best
        pos = sorted({round((((k[0] + k[2]) / 2) - s[0]) * ux + (((k[1] + k[3]) / 2) - s[1]) * uy, 2)
                      for k in ticks if abs((((k[0] + k[2]) / 2) - s[0]) * uy - (((k[1] + k[3]) / 2) - s[1]) * ux) < 1.2})
        lo = [q for q in pos if q < t]; hi = [q for q in pos if q > t]
        if lo and hi:
            found.append((v, min(hi) - max(lo)))
    k = statistics.median(v / L for v, L in found)    # cm per point
    res = [(v, L * k - v) for v, L in found]
    return k, res


def extract(pdf):
    page = fitz.open(pdf)[0]
    drawings = page.get_drawings()
    k_cm, residuals = calibrate(page, drawings)
    K = k_cm / 100.0                                     # metres per point
    hatch = []
    for d in drawings:
        if d["type"] == "s" and rgb(d.get("color")) == RED_HATCH:
            for it in d["items"]:
                if it[0] == "l":
                    hatch.append(((it[1].x + it[2].x) / 2, (it[1].y + it[2].y) / 2))
    # door swings: the arcs are drawn grey, split into bezier pieces (their ends)
    arcs = []
    for d in drawings:
        if d["type"] == "s" and rgb(d.get("color")) in ((0.42, 0.42, 0.42), (0.5, 0.5, 0.5), (0.3, 0.3, 0.3)):
            for it in d["items"]:
                if it[0] == "c":
                    arcs.append(((it[1].x, it[1].y), (it[4].x, it[4].y)))
    # tread lines of the stair (thin black)
    thin = []
    for d in drawings:
        if d["type"] == "s" and rgb(d.get("color")) == (0.0, 0.0, 0.0) and round(d.get("width") or 0, 2) <= 0.3:
            for it in d["items"]:
                if it[0] == "l":
                    thin.append((it[1].x, it[1].y, it[2].x, it[2].y))
    polys = []
    for d in drawings:
        if d["type"] != "f":
            continue
        P = poly_of(d)
        if len(P) < 3:
            continue
        cx = sum(q[0] for q in P) / len(P); cy = sum(q[1] for q in P) / len(P)
        if cx > PLAN_X_MAX:
            continue
        L, T, ang = min_rect(P)
        if L * K < 0.12 and T * K < 0.06:       # dimension dots, ticks
            continue
        xs = [q[0] for q in P]; ys = [q[1] for q in P]
        hc = sum(1 for h in hatch if min(xs) <= h[0] <= max(xs) and min(ys) <= h[1] <= max(ys) and inside(P, *h))
        polys.append(dict(P=P, fill=rgb(d["fill"]), L=L * K, T=T * K, ang=ang, hatch=hc, c=(cx, cy), curved=any(it[0] == "c" for it in d["items"])))
    # street façade: the long, thin, unhatched white element lowest on the sheet → frame (origin, rotation)
    cw = max((p for p in polys if p["fill"] == (1.0, 1.0, 1.0) and not p["hatch"] and p["L"] > 15 and 0.06 < p["T"] < 0.2), key=lambda p: p["c"][1])
    ang = cw["ang"]
    if math.cos(ang) < 0:
        ang += math.pi
    ca, sa = math.cos(-ang), math.sin(-ang)
    ox, oy = cw["c"]

    def loc(q):  # sheet point → building frame (m): x along the façade, z towards the street
        dx, dy = q[0] - ox, q[1] - oy
        return (round((dx * ca - dy * sa) * K, 3), round((dx * sa + dy * ca) * K, 3))

    def unloc(q):  # building frame → sheet point (exact inverse, for the verification renders)
        x, z = q[0] / K, q[1] / K
        return (ox + x * ca + z * sa, oy - x * sa + z * ca)

    # stair and lift: the two biggest concrete outlines of the core; what is drawn inside them belongs to them
    cores = sorted((p for p in polys if p["fill"] == (0.0, 0.0, 0.0)), key=lambda p: -p["L"] * p["T"])[:2]
    def bbox(p):
        xs = [q[0] for q in p["P"]]; ys = [q[1] for q in p["P"]]; return (min(xs), min(ys), max(xs), max(ys))
    stair_bb, lift_bb = sorted((bbox(c) for c in cores), key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
    def within(c, b, m=0.0):
        return b[0] - m <= c[0] <= b[2] + m and b[1] - m <= c[1] <= b[3] + m

    out = {k: [] for k in ("masonry", "window", "curtain", "concrete", "partition", "cubicle", "door", "glass", "unit", "stair", "lift")}
    windows = []
    for p in polys:
        f, T, L = p["fill"], p["T"], p["L"]
        if f == (1.0, 1.0, 1.0) and not p["hatch"] and within(p["c"], stair_bb):
            cls = "stair"
        elif f == (1.0, 1.0, 1.0) and not p["hatch"] and within(p["c"], lift_bb):
            cls = "lift"
        elif f == (0.0, 0.0, 0.0):
            cls = "concrete"
        elif f == (0.42, 0.42, 0.42):
            cls = "partition"
        elif p["hatch"]:
            cls = "masonry"
        elif 0.18 <= T <= 0.5:
            cls = "window"
        elif 0.06 < T <= 0.18:
            cls = "curtain" if L > 3 else "cubicle"
        elif T <= 0.06:
            # a door leaf: 0.6–1.3 m, one of its short ends on a door arc
            is_door = False
            if 0.55 < L < 1.35:
                for a, b in arcs:
                    for e in (a, b):
                        if min(math.hypot(e[0] - q[0], e[1] - q[1]) for q in p["P"]) * K < 0.06:
                            is_door = True
            cls = "door" if is_door else "glass"
        else:
            cls = "unit"
        item = [loc(q) for q in p["P"]]
        if cls == "window":
            windows.append(p)
        out[cls].append(item)
    # glass panes inside windows / the curtain wall are part of them: keep only free-standing glass (glazed partitions)
    def in_any(c, group):
        return any(inside(g["P"], *c) for g in group)
    big = [p for p in polys if p["fill"] == (1.0, 1.0, 1.0) and not p["hatch"] and (0.18 <= p["T"] <= 0.5 or (p["L"] > 3 and 0.06 < p["T"] <= 0.18))
           and not within(p["c"], stair_bb) and not within(p["c"], lift_bb)]
    out["glass"] = [[loc(q) for q in p["P"]] for p in polys
                    if p["fill"] == (1.0, 1.0, 1.0) and not p["hatch"] and p["T"] <= 0.06 and not in_any(p["c"], big)
                    and not within(p["c"], stair_bb) and not within(p["c"], lift_bb)
                    and not any(it == [loc(q) for q in p["P"]] for it in out["door"])]
    # treads: thin black lines inside the stair core, across the flights (one per riser line)
    tread = [(t[0] + t[2]) / 2 for t in thin if within(((t[0] + t[2]) / 2, (t[1] + t[3]) / 2), stair_bb, -1)
             and abs(t[0] - t[2]) < 0.5 and abs(t[3] - t[1]) * K > 0.6]
    tread_x = sorted({round(x, 1) for x in tread})
    out["stair_meta"] = dict(box=[loc((stair_bb[0], stair_bb[1])), loc((stair_bb[2], stair_bb[3]))],
                             lift=[loc((lift_bb[0], lift_bb[1])), loc((lift_bb[2], lift_bb[3]))],
                             tread_lines=len(tread_x),
                             tread_depth_m=round(statistics.median(b - a for a, b in zip(tread_x, tread_x[1:])) * K, 3) if len(tread_x) > 2 else None)
    off = [(v, round(r, 1)) for v, r in residuals if abs(r) > 2]
    meta = dict(scale_cm_per_pt=round(k_cm, 5), dims_matched=len(residuals),
                within_2cm=len(residuals) - len(off), outliers=off,
                max_residual_cm=round(max(abs(r) for _, r in residuals if abs(r) <= 2), 2),
                median_abs_residual_cm=round(statistics.median(abs(r) for _, r in residuals), 2),
                rotation_deg=round(math.degrees(ang), 4), facade_length_m=round(cw["L"], 3),
                counts={k: len(v) for k, v in out.items() if k != "stair_meta"}, stair=out["stair_meta"])
    return out, meta, (page, K, loc, unloc)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    shots = sys.argv[3] if len(sys.argv) > 3 else None
    data, metas = {}, {}
    for n, tag in FLOORS:
        pdf = next(f for f in glob.glob(os.path.join(src, "*.pdf")) if tag in f)
        out, meta, ctx = extract(pdf)
        data[n] = out; metas[n] = meta
        print(f"étage {n}: {json.dumps(meta, ensure_ascii=False)}")
        if shots:
            render(ctx, out, os.path.join(shots, f"mibtech-etage-{n}-verif.png"))
    with open(dst, "w") as f:
        f.write("// GENERATED by docs/research/mibtech-plan-extract.py from the architect's dimensioned plans (MB Interior Architects,\n")
        f.write("// « plan cotation » APS 16/10/2024, 1er / 2e / 3e étage). Do not edit by hand: re-run the extractor.\n")
        f.write("// Building frame: metres, x along the street façade (north-east), z towards the street, origin = middle of the façade glass.\n")
        f.write("// Each class is a list of polygons [[x, z], …] (footprints as drawn; doors are the leaves, drawn open).\n")
        f.write("export type PlanPoly = [number, number][];\n")
        f.write("export type PlanClass = \"masonry\" | \"window\" | \"curtain\" | \"concrete\" | \"partition\" | \"cubicle\" | \"door\" | \"glass\" | \"unit\" | \"stair\" | \"lift\";\n")
        f.write("export type StairMeta = { box: [number, number][]; lift: [number, number][]; tread_lines: number; tread_depth_m: number | null };\n")
        f.write("export type FloorPlan = Record<PlanClass, PlanPoly[]> & { stair_meta: StairMeta };\n")
        f.write(f"export const PLAN_META = {json.dumps(metas)} as const;\n")
        f.write(f"export const MIBTECH_PLANS: Record<1 | 2 | 3, FloorPlan> = {json.dumps(data, separators=(',', ':'))};\n")
    print("written", dst)


def render(ctx, out, path):
    """verification: the extracted classes drawn back over the PDF page (same orientation as the sheet)"""
    from PIL import Image, ImageDraw
    page, K, loc, unloc = ctx
    pix = page.get_pixmap(dpi=144)
    im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples).convert("L").convert("RGB")
    im = Image.blend(im, Image.new("RGB", im.size, "white"), 0.55)
    g = ImageDraw.Draw(im, "RGBA")
    # inverse of loc: rebuild from the class polygons is not needed — draw the source polygons by class instead
    colours = dict(masonry=(200, 60, 60, 160), window=(60, 160, 255, 160), curtain=(0, 90, 255, 200), concrete=(0, 0, 0, 220),
                   partition=(40, 160, 60, 200), cubicle=(220, 0, 200, 160), door=(255, 140, 0, 230), glass=(0, 200, 220, 200), unit=(150, 110, 60, 140),
                   stair=(255, 215, 0, 150), lift=(120, 80, 200, 150))
    s = 2.0
    for cls, items in out.items():
        if cls == "stair_meta":
            continue
        for P in items:
            pts = [unloc(q) for q in P]
            g.polygon([(x * s, y * s) for x, y in pts], fill=colours[cls], outline=colours[cls][:3])
    im.crop((300, 40, 2000, 1760)).save(path)


if __name__ == "__main__":
    main()
