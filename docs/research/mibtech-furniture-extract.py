#!/usr/bin/env python3
"""MIBTECH furniture of the 1er, 2e and 3e étage from the architect's electrical plans (MB Interior Architects, « PLAN ELEC »,
APS, 20/10/2024, ArchiCAD / GSPublisher PDF exports) → components/scenes/city/landmarks/mibtech/mibtechFurnitureData.ts

The electrical sheets are the dimensioned plans (« plan cotation », 16/10/2024, read by mibtech-plan-extract.py) with two layers
added: furniture (grey 0.67 outlines over white fills) and electrical (blue floor boxes and sockets). Walls, cores and hatching are
at the same sheet coordinates (checked: identical drawings), so the building frame of the dimensioned plan is reused as is.
Furniture = the white fills of the electrical sheet that the dimensioned sheet does not have, classified by shape:
  · chair: seat (two halves ≈ 0.6 × 0.3 m, 29 path items each, 0.3 m apart); its back (≈ 0.2 × 0.1 m, 14 items) gives the direction it faces
  · desk: 1.2 × 0.7 m top (workstations); monitor: ≈ 0.4 × 0.1 m (14 items); screen: thin desk dividers (< 6 cm)
  · chair (other symbol): one outline ≈ 0.5–0.7 m, 14 items
  · every chair within 1 m of a desk or table top faces the nearest point of that top
  · plant: ≈ 1 m, ≥ 80 items; WC pan: ≈ 0.5 × 0.4 m, 20 items; armchair / sofa: 8 items (sofa when longer than 1.2 m)
  · round table: ≈ 0.6 m, 18 items; lounge chair: ≈ 0.6 m square next to a round table (terrace)
  · other rectangles: rug when it holds ≥ 2 chair seats, table when a chair seat is within 0.7 m, else cabinet (≤ 0.65 m deep)
    or low table
  · not kept: armrests, keyboards, phones, scale figures (people drawn on the plan), electrical symbols
Usage:  python3 docs/research/mibtech-furniture-extract.py <dir with the 3 cotation PDFs> <dir with the 3 PLAN ELEC PDFs> <out .ts>
"""
import glob, importlib.util, json, math, os, sys
import fitz

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("plan", os.path.join(HERE, "mibtech-plan-extract.py"))
plan = importlib.util.module_from_spec(spec); spec.loader.exec_module(plan)

ELEC = [(1, "1er etg"), (2, "2eme etg"), (3, "3eme etg")]
KINDS = ["desk", "chair", "monitor", "screen", "table", "round", "lounge", "armchair", "sofa", "cabinet", "low", "plant", "wc", "rug"]


def white_fills(page):
    return [d for d in page.get_drawings() if d["type"] == "f" and plan.rgb(d.get("fill")) == (1.0, 1.0, 1.0) and d["rect"].x0 < plan.PLAN_X_MAX]


def rect_of(P):
    """centre, long side, short side, angle of the long side (sheet points) of the minimum rectangle"""
    L, T, ang = plan.min_rect(P)
    ux, uy = math.cos(ang), math.sin(ang)
    us = [q[0] * ux + q[1] * uy for q in P]; vs = [-q[0] * uy + q[1] * ux for q in P]
    cu, cv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
    return (cu * ux - cv * uy, cu * uy + cv * ux), L, T, ang


def floor(cot_pdf, elec_pdf):
    _, meta, (page, K, loc, _) = plan.extract(cot_pdf)
    old = {(round(d["rect"].x0, 1), round(d["rect"].y0, 1), round(d["rect"].x1, 1), round(d["rect"].y1, 1)) for d in white_fills(page)}
    epage = fitz.open(elec_pdf)[0]
    items = []
    for d in white_fills(epage):
        r = d["rect"]
        if (round(r.x0, 1), round(r.y0, 1), round(r.x1, 1), round(r.y1, 1)) in old:
            continue
        P = plan.poly_of(d)
        if len(P) < 3:
            continue
        c, L, T, ang = rect_of(P)
        n = len(d["items"])
        items.append(dict(c=c, L=L * K, T=T * K, ang=ang, n=n))

    def to_frame(c, ang):
        a = loc(c); b = loc((c[0] + math.cos(ang), c[1] + math.sin(ang)))
        return a, math.atan2(b[1] - a[1], b[0] - a[0])

    def near(a, b):
        return math.hypot(a["c"][0] - b["c"][0], a["c"][1] - b["c"][1]) * K

    seats = [i for i in items if i["n"] == 29 and 0.5 <= i["L"] <= 0.8]
    backs = [i for i in items if i["n"] == 14 and 0.15 <= i["L"] <= 0.3 and i["T"] <= 0.15]
    rounds = [i for i in items if i["n"] == 18 and 0.5 <= i["L"] <= 0.9]
    out = []

    def put(kind, i, a=None, L=None, T=None):
        (x, z), aa = to_frame(i["c"], i["ang"])
        out.append([KINDS.index(kind), x, z, round(L if L is not None else i["L"], 3), round(T if T is not None else i["T"], 3), round(a if a is not None else aa, 3)])

    def facing(s):
        b = min(backs, key=lambda b: near(s, b), default=None)
        (x, z), _ = to_frame(s["c"], 0)
        if b is not None and near(s, b) < 0.5:
            (bx, bz), _ = to_frame(b["c"], 0)
            return math.atan2(z - bz, x - bx)
        return to_frame(s["c"], s["ang"])[1] + math.pi / 2
    # every seat is drawn as two halves ≈ 0.3 m apart: one chair per pair (centre between them, facing averaged)
    left = list(seats)
    while left:
        s = left.pop()
        m = min(left, key=lambda o: near(s, o), default=None)
        if m is not None and near(s, m) < 0.36:
            left.remove(m)
            fa, fb = facing(s), facing(m)
            face = math.atan2(math.sin(fa) + math.sin(fb), math.cos(fa) + math.cos(fb))
            c = ((s["c"][0] + m["c"][0]) / 2, (s["c"][1] + m["c"][1]) / 2)
            put("chair", dict(s, c=c), a=face, L=0.6, T=0.6)
        else:
            put("chair", s, a=facing(s))
    tops = [i for i in items if i["n"] == 4 and i["L"] >= 0.7 and i["T"] >= 0.5]
    # every chair symbol (seat halves and single outlines), for the table / rug tests
    sitters = seats + [i for i in items if i["n"] == 14 and 0.45 <= i["L"] <= 0.7 and i["T"] >= 0.35]
    for i in items:
        if i in seats or i in backs:
            continue
        L, T, n = i["L"], i["T"], i["n"]
        if n >= 80 and 0.6 <= L <= 1.6 and n != 177:
            put("plant", i)
        elif i in rounds:
            put("round", i)
        elif n == 14 and 0.3 <= L <= 0.5 and T <= 0.15:
            put("monitor", i)
        elif n == 14 and 0.45 <= L <= 0.7 and T >= 0.35:
            # meeting / visitor chair drawn as a single outline: facing the nearest table or desk top
            t = min(tops, key=lambda t: near(i, t), default=None)
            (x, z), _ = to_frame(i["c"], 0)
            (tx, tz), _ = to_frame(t["c"], 0) if t is not None else ((x + 1, z), 0)
            put("chair", i, a=math.atan2(tz - z, tx - x), L=0.55, T=0.55)
        elif n == 20 and 0.4 <= L <= 0.6:
            put("wc", i)
        elif n == 8 and L >= 0.6:
            put("sofa" if L > 1.2 else "armchair", i)
        elif n in (4, 6) and T < 0.06 and L >= 0.5:
            put("screen", i)
        elif n == 4 and 1.1 <= L <= 1.3 and 0.6 <= T <= 0.8:
            put("desk", i)
        elif n == 4 and T >= 0.3 and L >= 0.45:
            # chair seats inside / around the rectangle (in its own axes)
            ux, uy = math.cos(i["ang"]), math.sin(i["ang"])
            def rel(s):
                dx, dy = (s["c"][0] - i["c"][0]) * K, (s["c"][1] - i["c"][1]) * K
                return abs(dx * ux + dy * uy) - L / 2, abs(-dx * uy + dy * ux) - T / 2
            inner = sum(1 for s in sitters if max(rel(s)) < 0)
            close = any(max(rel(s)) < 0.7 for s in sitters)
            if inner >= 2:
                put("rug", i)
            elif T <= 0.7 and L <= 0.7 and any(near(i, r) < 0.9 for r in rounds):
                put("lounge", i)
            elif close and L >= 0.7:
                put("table", i)
            elif T <= 0.65:
                put("cabinet", i)
            else:
                put("low", i)
    # a chair faces its desk or table: the nearest point of the nearest top within 1 m (the drawn symbols' own direction
    # is not reliable for every chair family); chairs away from any top keep the direction read from the symbol
    tops_out = [o for o in out if o[0] in (KINDS.index("desk"), KINDS.index("table"))]
    for o in out:
        if o[0] != KINDS.index("chair"):
            continue
        best = None
        for t in tops_out:
            ux, uz = math.cos(t[5]), math.sin(t[5])
            dx, dz = o[1] - t[1], o[2] - t[2]
            u, v = dx * ux + dz * uz, -dx * uz + dz * ux
            cu, cv = max(-t[3] / 2, min(t[3] / 2, u)), max(-t[4] / 2, min(t[4] / 2, v))
            px, pz = t[1] + cu * ux - cv * uz, t[2] + cu * uz + cv * ux
            d = math.hypot(px - o[1], pz - o[2])
            if d < 1.0 and (best is None or d < best[0]):
                best = (d, px, pz)
        if best and best[0] > 0.02:
            o[5] = round(math.atan2(best[2] - o[2], best[1] - o[1]), 3)
    count = {k: sum(1 for o in out if o[0] == j) for j, k in enumerate(KINDS)}
    return out, count, meta["scale_cm_per_pt"]


def main():
    cot_dir, elec_dir, dst = sys.argv[1], sys.argv[2], sys.argv[3]
    data, counts = {}, {}
    for n, tag in ELEC:
        cot = next(f for f in glob.glob(os.path.join(cot_dir, "*.pdf")) if plan.FLOORS[n - 1][1] in f)
        elec = next(f for f in glob.glob(os.path.join(elec_dir, "*.pdf")) if tag.lower() in os.path.basename(f).lower() or f"e{n}.pdf" == os.path.basename(f))
        data[n], counts[n], k = floor(cot, elec)
        print(f"étage {n} ({k} cm/pt): {json.dumps(counts[n])}")
    with open(dst, "w") as f:
        f.write("// GENERATED by docs/research/mibtech-furniture-extract.py from the architect's electrical plans (MB Interior Architects,\n")
        f.write("// « PLAN ELEC » APS 20/10/2024, 1er / 2e / 3e étage): the furniture as drawn. Do not edit by hand: re-run the extractor.\n")
        f.write("// Building frame of mibtechPlanData.ts. Item = [kind, x, z, length, width, angle]: centre (m), footprint (m), angle (rad) of the\n")
        f.write("// long side in the x/z plane (atan2(dz, dx)); for a chair, the direction it faces.\n")
        f.write(f"export const FURN_KINDS = {json.dumps(KINDS)} as const;\n")
        f.write("export type FurnKind = (typeof FURN_KINDS)[number];\n")
        f.write("export type FurnItem = [number, number, number, number, number, number];\n")
        f.write(f"export const FURN_COUNTS = {json.dumps(counts)} as const;\n")
        f.write(f"export const MIBTECH_FURNITURE: Record<1 | 2 | 3, FurnItem[]> = {json.dumps(data, separators=(',', ':'))};\n")
    print("written", dst)


if __name__ == "__main__":
    main()
