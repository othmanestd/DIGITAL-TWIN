// Traffic network (pure data, built once): roads → directed lanes, junction connectors (quadratic Bézier turns),
// roundabout rings (arcs + entry / exit connectors), per-junction conflict matrices, signal groups and yield rules.
// World metres, x east, z south (map north = −Z), right-hand traffic (Morocco): lanes sit to the right of travel.

export type RoadDef = {
  x0: number; z0: number; x1: number; z1: number;
  w: number;          // asphalt width (m)
  fwd: number; bwd: number; // lanes per direction (forward = from (x0, z0) to (x1, z1))
  off: number[];      // lane-centre offsets from the centreline, index 0 = inner lane … last = kerb lane
  vmax: number;       // m/s
  campus?: boolean;   // hospital campus loop (one-way, slow, no kerb stops)
  d?: boolean;        // district street around the hospital (gets kerbs, zebras, stop lines, lane markings)
};
export type NodeDef = {
  x: number; z: number;
  setback?: number;   // stop line distance beyond the crossing road's edge (zebra room)
  signal?: number;    // traffic lights: phase offset in seconds
  rb?: { r: number; outer: number; delta: number }; // roundabout: ring lane radius, asphalt outer radius, entry/exit half-angle
  rightOnly?: boolean; // right-in / right-out access (no left turns across the median)
};

export type Seg = {
  id: number; kind: 0 | 1 | 2; len: number; vmax: number;
  // lane (0): start (ax, az) + unit direction (ux, uz). Bézier (1): p0 = (ax, az), p1 = (bx, bz), p2 = (cx, cz), lut.
  ax: number; az: number; ux: number; uz: number; bx: number; bz: number; cx: number; cz: number; lut: Float32Array | null;
  // arc (2): centre (ox, oz), radius r, start angle th0, signed sweep dth (negative = counter-clockwise seen from above)
  ox: number; oz: number; r: number; th0: number; dth: number;
  succ: number[];
  // lanes
  road: number; fwd: boolean; lane: number; nl: number; kerb: number; node: number; campus: boolean;
  stops: { line: number; s: number }[]; drop: number;
  // connectors
  gate: 0 | 1 | 2; turn: number; local: number; inLane: number; outRoad: number; group: number; minor: boolean;
  // roundabouts
  exitRoad: number; merge: number[]; upstream: number[]; upOff: number[]; siblings: number[];
};
export type Node = {
  id: number; x: number; z: number; setback: number; rightOnly: boolean;
  ends: { road: number; end: 0 | 1; ux: number; uz: number; hw: number; trim: number }[];
  conns: number[]; cm: Uint8Array | null; signal: number; claim: number; claimT: number;
  rb: NodeDef["rb"] | null; majorIn: number[]; inLanes: number[];
};
export type Road = RoadDef & { id: number; a: number; b: number; lanes: [number[], number[]]; ux: number; uz: number; L: number };
export type Net = { segs: Seg[]; nodes: Node[]; roads: Road[] };

const blank = (id: number, kind: 0 | 1 | 2): Seg => ({
  id, kind, len: 1, vmax: 8, ax: 0, az: 0, ux: 1, uz: 0, bx: 0, bz: 0, cx: 0, cz: 0, lut: null, ox: 0, oz: 0, r: 0, th0: 0, dth: 0,
  succ: [], road: -1, fwd: true, lane: 0, nl: 1, kerb: 0, node: -1, campus: false, stops: [], drop: -1,
  gate: 0, turn: 0, local: -1, inLane: -1, outRoad: -1, group: 0, minor: false, exitRoad: -1, merge: [], upstream: [], upOff: [], siblings: [],
});

// ---------------------------------------------------------------- geometry (allocation-free evaluation)
export const P = { x: 0, z: 0 };
/** Point at arc length s on a segment → P. */
export function evalSeg(g: Seg, s: number) {
  if (g.kind === 0) { P.x = g.ax + g.ux * s; P.z = g.az + g.uz * s; return; }
  if (g.kind === 2) { const th = g.th0 + g.dth * Math.min(1, Math.max(0, s / g.len)); P.x = g.ox + g.r * Math.cos(th); P.z = g.oz + g.r * Math.sin(th); return; }
  const lut = g.lut!;
  let t = 1;
  if (s <= 0) t = 0;
  else if (s < g.len) {
    let i = 0;
    while (i < 7 && lut[i + 1] < s) i++;
    const a = lut[i], b = lut[i + 1];
    t = (i + (b > a ? (s - a) / (b - a) : 0)) / 8;
  }
  const u = 1 - t;
  P.x = u * u * g.ax + 2 * u * t * g.bx + t * t * g.cx;
  P.z = u * u * g.az + 2 * u * t * g.bz + t * t * g.cz;
}
function bezier(g: Seg) {
  const lut = new Float32Array(9);
  let px = g.ax, pz = g.az, acc = 0;
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, u = 1 - t;
    const x = u * u * g.ax + 2 * u * t * g.bx + t * t * g.cx, z = u * u * g.az + 2 * u * t * g.bz + t * t * g.cz;
    acc += Math.hypot(x - px, z - pz); lut[i] = acc; px = x; pz = z;
  }
  g.lut = lut; g.len = Math.max(0.3, acc);
}
/** Intersection of p + t·d and q − s·e (t along d). null when parallel. */
function meet(px: number, pz: number, dx: number, dz: number, qx: number, qz: number, ex: number, ez: number): number | null {
  const det = dx * ez - dz * ex;
  if (Math.abs(det) < 0.05) return null;
  return ((qx - px) * ez - (qz - pz) * ex) / det;
}

const keyOf = (x: number, z: number) => `${Math.round(x * 2)}:${Math.round(z * 2)}`;

export function buildNet(defs: RoadDef[], specials: NodeDef[], setbackAt: (x: number, z: number) => number): Net {
  // 1. split every road at the special nodes lying on it (district junctions in the middle of a grid street)
  const split: RoadDef[] = [];
  for (const r of defs) {
    const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0); if (L < 0.5) continue;
    const ux = (r.x1 - r.x0) / L, uz = (r.z1 - r.z0) / L;
    const cuts: number[] = [];
    for (const n of specials) {
      const t = (n.x - r.x0) * ux + (n.z - r.z0) * uz, lat = Math.abs((n.x - r.x0) * uz - (n.z - r.z0) * ux);
      if (lat < 0.5 && t > 0.5 && t < L - 0.5) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    let a = 0;
    for (const t of [...cuts, L]) { split.push({ ...r, x0: r.x0 + ux * a, z0: r.z0 + uz * a, x1: r.x0 + ux * t, z1: r.z0 + uz * t }); a = t; }
  }
  // 2. nodes
  const nodes: Node[] = [], map = new Map<string, number>();
  const spec = new Map<string, NodeDef>();
  for (const n of specials) spec.set(keyOf(n.x, n.z), n);
  const nodeAt = (x: number, z: number) => {
    const k = keyOf(x, z);
    let id = map.get(k);
    if (id === undefined) {
      const s = spec.get(k);
      id = nodes.length; map.set(k, id);
      nodes.push({ id, x: s?.x ?? x, z: s?.z ?? z, setback: s?.setback ?? setbackAt(x, z), rightOnly: !!s?.rightOnly, ends: [], conns: [], cm: null,
        signal: s?.signal ?? -1, claim: -1, claimT: 0, rb: s?.rb ?? null, majorIn: [], inLanes: [] });
    }
    return id;
  };
  const roads: Road[] = [];
  for (const r of split) {
    const a = nodeAt(r.x0, r.z0), b = nodeAt(r.x1, r.z1);
    if (a === b) continue;
    const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0), ux = (r.x1 - r.x0) / L, uz = (r.z1 - r.z0) / L;
    const road: Road = { ...r, id: roads.length, a, b, lanes: [[], []], ux, uz, L };
    roads.push(road);
    nodes[a].ends.push({ road: road.id, end: 0, ux, uz, hw: r.w / 2, trim: 0 });
    nodes[b].ends.push({ road: road.id, end: 1, ux: -ux, uz: -uz, hw: r.w / 2, trim: 0 });
  }
  // 3. trims (stop lines)
  for (const n of nodes) {
    const deg = n.ends.length;
    for (const e of n.ends) {
      if (n.rb) { e.trim = n.rb.outer + n.setback; continue; }
      if (deg === 1) { e.trim = 0.5; continue; }
      if (deg === 2) {
        const o = n.ends[0] === e ? n.ends[1] : n.ends[0];
        if (e.ux * o.ux + e.uz * o.uz < -0.96) { e.trim = 0.5; continue; } // straight pass-through
      }
      // the crossing roads set the stop line (the road's own straight continuation does not)
      let hw = -1;
      for (const o of n.ends) if (o !== e && e.ux * o.ux + e.uz * o.uz > -0.96) hw = Math.max(hw, o.hw);
      e.trim = hw < 0 ? 0.5 : hw + n.setback;
    }
  }
  // 4. lanes
  const segs: Seg[] = [];
  for (const r of roads) {
    const A = nodes[r.a], B = nodes[r.b];
    const trimA = A.ends.find((e) => e.road === r.id && e.end === 0)!.trim, trimB = B.ends.find((e) => e.road === r.id && e.end === 1)!.trim;
    for (const dir of [0, 1] as const) {
      const n = dir === 0 ? r.fwd : r.bwd;
      const from = dir === 0 ? A : B, to = dir === 0 ? B : A;
      const ux = dir === 0 ? r.ux : -r.ux, uz = dir === 0 ? r.uz : -r.uz;
      const t0 = dir === 0 ? trimA : trimB, t1 = dir === 0 ? trimB : trimA;
      const rx = -uz, rz = ux;
      for (let i = 0; i < n; i++) {
        const o = r.fwd + r.bwd === 1 ? 0 : r.off[Math.min(i, r.off.length - 1)];
        const g = blank(segs.length, 0);
        g.ax = from.x + ux * t0 + rx * o; g.az = from.z + uz * t0 + rz * o; g.ux = ux; g.uz = uz;
        g.len = Math.max(0.4, Math.hypot(to.x - from.x, to.z - from.z) - t0 - t1);
        g.vmax = r.vmax; g.road = r.id; g.fwd = dir === 0; g.lane = i; g.nl = n; g.node = to.id; g.campus = !!r.campus;
        g.kerb = !r.campus && i === n - 1 ? Math.max(0, Math.min(3.2, r.w / 2 - o - 1.45)) : 0;
        segs.push(g); r.lanes[dir].push(g.id); to.inLanes.push(g.id);
      }
    }
  }
  const lanesIn = (n: Node, e: Node["ends"][number]) => roads[e.road].lanes[e.end === 1 ? 0 : 1];  // lanes arriving at n
  const lanesOut = (n: Node, e: Node["ends"][number]) => roads[e.road].lanes[e.end === 0 ? 0 : 1]; // lanes leaving n
  const conn = (from: Seg, to: Seg, turn: number, n: Node, gate: 0 | 1) => {
    const g = blank(segs.length, 1);
    g.ax = from.ax + from.ux * from.len; g.az = from.az + from.uz * from.len;
    g.cx = to.ax; g.cz = to.az;
    const t = meet(g.ax, g.az, from.ux, from.uz, g.cx, g.cz, to.ux, to.uz);
    const dist = Math.hypot(g.cx - g.ax, g.cz - g.az);
    if (turn === 3) { g.bx = (g.ax + g.cx) / 2 + from.ux * dist * 0.9; g.bz = (g.az + g.cz) / 2 + from.uz * dist * 0.9; }
    else if (t === null || t < 0 || t > dist * 1.5) { g.bx = (g.ax + g.cx) / 2; g.bz = (g.az + g.cz) / 2; }
    else { g.bx = g.ax + from.ux * t; g.bz = g.az + from.uz * t; }
    bezier(g);
    const leg = Math.min(Math.hypot(g.bx - g.ax, g.bz - g.az), Math.hypot(g.cx - g.bx, g.cz - g.bz));
    g.vmax = turn === 0 ? Math.min(from.vmax, to.vmax) : Math.min(from.vmax, to.vmax, Math.max(2.4, Math.sqrt(2.2 * Math.max(2, leg * 0.75))));
    g.succ = [to.id]; g.turn = turn; g.node = n.id; g.inLane = from.id; g.outRoad = to.road; g.gate = gate;
    g.group = Math.abs(from.ux) > Math.abs(from.uz) ? 0 : 1;
    g.campus = from.campus && to.campus;
    segs.push(g); from.succ.push(g.id);
    if (gate) { g.local = n.conns.length; n.conns.push(g.id); }
    return g;
  };
  // 5. junction connectors
  for (const n of nodes) {
    if (n.rb) continue;
    const deg = n.ends.length;
    const gate: 0 | 1 = deg >= 3 ? 1 : 0;
    for (const ein of n.ends) {
      const ins = lanesIn(n, ein);
      if (!ins.length) continue;
      const dix = -ein.ux, diz = -ein.uz; // travel direction into the node
      for (const eout of n.ends) {
        const outs = lanesOut(n, eout);
        if (!outs.length) continue;
        let turn: number;
        if (eout === ein) { if (deg > 1) continue; turn = 3; }
        else {
          const dot = dix * eout.ux + diz * eout.uz, cross = dix * eout.uz - diz * eout.ux;
          turn = dot > 0.7 ? 0 : cross > 0.3 ? 1 : cross < -0.3 ? 2 : -1;
          if (turn < 0) continue;
          if (turn === 2 && n.rightOnly) continue;
        }
        for (const li of ins) {
          const L = segs[li], i = L.lane, nIn = ins.length, nOut = outs.length;
          let js: number[] = [];
          if (turn === 0) js = nIn === nOut ? [i] : nIn === 1 ? outs.map((_, j) => j) : [Math.min(i, nOut - 1)];
          else if (turn === 1) js = i === nIn - 1 || n.rightOnly ? [nOut - 1] : []; // right-in accesses: from either lane
          else js = i === 0 ? [0] : [];
          for (const j of js) conn(L, segs[outs[j]], turn, n, gate);
        }
      }
    }
    // fallback: every in-lane gets at least one way out (lane constraints relaxed)
    for (const ein of n.ends) for (const li of lanesIn(n, ein)) {
      const L = segs[li];
      if (L.succ.length) continue;
      for (const eout of n.ends) {
        const outs = lanesOut(n, eout);
        if (!outs.length || (eout === ein && deg > 1)) continue;
        const dot = -ein.ux * eout.ux - ein.uz * eout.uz, cross = -ein.ux * eout.uz + ein.uz * eout.ux;
        const turn = eout === ein ? 3 : dot > 0.7 ? 0 : cross > 0 ? 1 : 2;
        if (turn === 2 && n.rightOnly) continue;
        conn(L, segs[outs[Math.min(L.lane, outs.length - 1)]], turn, n, gate);
      }
    }
  }
  // 6. roundabouts: ring arcs between entry / exit key points, travelling counter-clockwise seen from above (θ decreasing)
  const TAU = Math.PI * 2;
  for (const n of nodes) {
    if (!n.rb) continue;
    const { r: R, delta } = n.rb;
    type K = { a: number; kind: "in" | "out"; e: Node["ends"][number] };
    const kp: K[] = [];
    for (const e of n.ends) {
      const phi = Math.atan2(e.uz, e.ux);
      if (lanesIn(n, e).length) kp.push({ a: (((phi - delta) % TAU) + TAU) % TAU, kind: "in", e });
      if (lanesOut(n, e).length) kp.push({ a: (((phi + delta) % TAU) + TAU) % TAU, kind: "out", e });
    }
    if (kp.length < 2) continue;
    kp.sort((p, q) => q.a - p.a);
    const arcs: Seg[] = kp.map((p, k) => {
      const q = kp[(k + 1) % kp.length];
      let sweep = (((p.a - q.a) % TAU) + TAU) % TAU; if (sweep < 1e-3) sweep = TAU;
      const g = blank(segs.length, 2);
      g.ox = n.x; g.oz = n.z; g.r = R; g.th0 = p.a; g.dth = -sweep; g.len = sweep * R; g.vmax = Math.min(9, Math.sqrt(2.1 * R)); g.node = n.id;
      segs.push(g);
      return g;
    });
    kp.forEach((p, k) => {
      const arcIn = arcs[(k - 1 + kp.length) % kp.length], arcOut = arcs[k];
      arcIn.succ.unshift(arcOut.id); // succ[0] = the ring continues
      const ex = n.x + R * Math.cos(p.a), ez = n.z + R * Math.sin(p.a);
      const tx = Math.sin(p.a), tz = -Math.cos(p.a); // travel tangent (θ decreasing)
      if (p.kind === "in") {
        const ids: number[] = [];
        for (const li of lanesIn(n, p.e)) {
          const L = segs[li];
          const g = blank(segs.length, 1);
          g.ax = L.ax + L.ux * L.len; g.az = L.az + L.uz * L.len; g.cx = ex; g.cz = ez;
          const t = meet(g.ax, g.az, L.ux, L.uz, ex, ez, tx, tz);
          const dist = Math.hypot(ex - g.ax, ez - g.az);
          if (t === null || t < 0 || t > dist * 1.4) { g.bx = (g.ax + ex) / 2; g.bz = (g.az + ez) / 2; } else { g.bx = g.ax + L.ux * t; g.bz = g.az + L.uz * t; }
          bezier(g);
          g.vmax = Math.min(L.vmax, arcOut.vmax); g.succ = [arcOut.id]; g.gate = 2; g.node = n.id; g.inLane = L.id; g.turn = 1;
          segs.push(g); L.succ.push(g.id); arcOut.merge.push(g.id); ids.push(g.id);
          // ring arcs to watch before entering (yield to the traffic already on the roundabout)
          let acc = 0, j = (k - 1 + kp.length) % kp.length;
          while (acc < 24 && g.upstream.length < 4) { g.upstream.push(arcs[j].id); g.upOff.push(acc); acc += arcs[j].len; j = (j - 1 + kp.length) % kp.length; }
        }
        for (const id of ids) segs[id].siblings = ids.filter((x) => x !== id);
      } else {
        for (const lo of lanesOut(n, p.e)) {
          const O = segs[lo];
          const g = blank(segs.length, 1);
          g.ax = ex; g.az = ez; g.cx = O.ax; g.cz = O.az;
          const t = meet(ex, ez, tx, tz, O.ax, O.az, O.ux, O.uz);
          const dist = Math.hypot(O.ax - ex, O.az - ez);
          if (t === null || t < 0 || t > dist * 1.4) { g.bx = (ex + O.ax) / 2; g.bz = (ez + O.az) / 2; } else { g.bx = ex + tx * t; g.bz = ez + tz * t; }
          bezier(g);
          g.vmax = Math.min(O.vmax, arcIn.vmax + 1); g.succ = [O.id]; g.node = n.id; g.outRoad = O.road; g.turn = 1;
          segs.push(g); arcIn.succ.push(g.id); arcIn.exitRoad = O.road;
        }
      }
    });
  }
  // 7. conflict matrices (sampled curves closer than a car width + margin), minor approaches
  for (const n of nodes) {
    const m = n.conns.length;
    if (!m) continue;
    const S: Float32Array[] = n.conns.map((id) => {
      const g = segs[id], a = new Float32Array(18);
      for (let i = 0; i <= 8; i++) { evalSeg(g, (g.len * i) / 8); a[i * 2] = P.x; a[i * 2 + 1] = P.z; }
      return a;
    });
    const cm = new Uint8Array(m * m);
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) {
      const gi = segs[n.conns[i]], gj = segs[n.conns[j]];
      if (gi.inLane === gj.inLane) continue;
      let hit = false;
      const A = S[i], B = S[j];
      for (let p = 0; p < 9 && !hit; p++) for (let q = 0; q < 9; q++) {
        const dx = A[p * 2] - B[q * 2], dz = A[p * 2 + 1] - B[q * 2 + 1];
        if (dx * dx + dz * dz < 2.7 * 2.7) { hit = true; break; }
      }
      if (hit) cm[i * m + j] = cm[j * m + i] = 1;
    }
    n.cm = cm;
    if (n.signal < 0) {
      let hw = 0;
      for (const e of n.ends) hw = Math.max(hw, e.hw);
      const minorRoads = new Set(n.ends.filter((e) => e.hw < hw - 1).map((e) => e.road));
      if (minorRoads.size) {
        for (const li of n.inLanes) if (!minorRoads.has(segs[li].road)) n.majorIn.push(li);
        for (const id of n.conns) { const g = segs[id]; g.minor = minorRoads.has(segs[g.inLane].road); }
      }
    }
  }
  return { segs, nodes, roads };
}

/** The lane (kerb lane of its road and direction) passing through (x, z) with heading (hx, hz), and the arc length there. */
export function findLane(net: Net, x: number, z: number, hx: number, hz: number, maxLat = 7): { seg: number; s: number } | null {
  let best: { seg: number; s: number } | null = null, bd = maxLat;
  for (const g of net.segs) {
    if (g.kind !== 0 || g.ux * hx + g.uz * hz < 0.95) continue;
    const s = (x - g.ax) * g.ux + (z - g.az) * g.uz;
    if (s < 0 || s > g.len) continue;
    const lat = Math.abs((x - g.ax) * g.uz - (z - g.az) * g.ux);
    const road = net.roads[g.road];
    const kerbLane = road.lanes[g.fwd ? 0 : 1];
    const pick = net.segs[kerbLane[kerbLane.length - 1]];
    if (lat < bd) { bd = lat; best = { seg: pick.id, s: (x - pick.ax) * pick.ux + (z - pick.az) * pick.uz }; }
  }
  return best;
}
