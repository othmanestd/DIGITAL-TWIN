// Traffic simulation (pure TS, allocation-free per frame): cars, red petits taxis and Casa Bus city buses on the
// network of roads.ts. Car-following = IDM (intelligent driver model) on per-segment buckets sorted by position;
// junctions = conflict mutex (+ traffic lights, minor-road yield, anti-starvation claim, "don't block the box");
// roundabouts = yield to the ring + zipper merge. Buses follow fixed clockwise loops and dwell at their stops;
// taxis pull over at kerbs and at the hospital drop-off. Vehicles always brake for the walking player (frame.player).
import { frame } from "@/lib/world";
import { evalSeg as evalSegImport, findLane, P as PImport, type Net } from "./roads";
// local bindings: bundlers turn imported bindings into getter calls, too slow in the per-vehicle hot loops
const evalSeg = evalSegImport, P = PImport;

export const CAR = 0, TAXI = 1, BUS = 2;
/** Overall dimensions per type (length, width, wheel radius, half wheelbase front / rear, half track). */
export const DIM = [
  { len: 4.3, w: 1.8, wr: 0.32, af: 1.32, ar: 1.32, tr: 0.78 },
  { len: 3.85, w: 1.66, wr: 0.3, af: 1.18, ar: 1.18, tr: 0.72 },
  { len: 12.0, w: 2.55, wr: 0.5, af: 3.55, ar: 2.7, tr: 1.02 },
];
const IDM = [
  { A: 1.5, B: 2.6, s0: 2.0, T: 1.1, mul: 1.0 },
  { A: 1.8, B: 2.8, s0: 1.8, T: 0.9, mul: 1.08 },
  { A: 0.95, B: 1.9, s0: 2.4, T: 1.4, mul: 0.82 },
];
export type BusLine = { label: string; corners: [number, number][]; stops: { x: number; z: number }[]; n: number };

let seed = 0x2f6e2b1;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };

// signal plan (s): group 0 (east–west, the boulevards) green 15, amber 3, all-red 1.5; group 1 green 12, amber 3, all-red 1.5
const CYCLE = 36;
export function lightState(offset: number, group: number, time: number): 0 | 1 | 2 {
  const t = (((time + offset) % CYCLE) + CYCLE) % CYCLE;
  if (group === 0) return t < 15 ? 2 : t < 18 ? 1 : 0;
  return t >= 19.5 && t < 31.5 ? 2 : t >= 31.5 && t < 34.5 ? 1 : 0;
}

export class Traffic {
  net: Net; N: number; lines: BusLine[];
  type: Uint8Array; seg: Int32Array; h1: Int32Array; h2: Int32Array; s: Float32Array; v: Float32Array; len: Float32Array;
  next: Int32Array; held: Int32Array; heldIn: Uint8Array; held2: Int32Array; target: Int32Array;
  stopAt: Float32Array; dwell: Float32Array; dwellT: Float32Array; pull: Float32Array; lat: Float32Array; wait: Float32Array;
  homeR: Float32Array; hosp: Uint8Array; line: Int8Array; leg: Int16Array; brake: Uint8Array; wheel: Float32Array; acc: Float32Array; hard: Float32Array;
  // render outputs (centre, heading unit vector, front point)
  cx: Float32Array; cz: Float32Array; hx: Float32Array; hz: Float32Array; fx: Float32Array; fz: Float32Array;
  // buckets
  private bStart: Int32Array; private bCur: Int32Array; private eV: Int32Array; private eK: Float32Array; private eOwn: Uint8Array; private my: Int32Array;
  occ: Int32Array;
  time = 0;
  stats = { ms: 0, frames: 0, frameMs: 0 };

  constructor(net: Net, counts: { cars: number; taxis: number }, lines: BusLine[]) {
    this.net = net; this.lines = lines;
    const nb = lines.reduce((a, l) => a + l.n, 0);
    const N = (this.N = counts.cars + counts.taxis + nb);
    const S = net.segs.length;
    this.type = new Uint8Array(N); this.seg = new Int32Array(N); this.h1 = new Int32Array(N).fill(-1); this.h2 = new Int32Array(N).fill(-1);
    this.s = new Float32Array(N); this.v = new Float32Array(N); this.len = new Float32Array(N);
    this.next = new Int32Array(N).fill(-1); this.held = new Int32Array(N).fill(-1); this.heldIn = new Uint8Array(N); this.held2 = new Int32Array(N).fill(-1); this.target = new Int32Array(N).fill(-1);
    this.stopAt = new Float32Array(N).fill(-1); this.dwell = new Float32Array(N); this.dwellT = new Float32Array(N); this.pull = new Float32Array(N);
    this.lat = new Float32Array(N); this.wait = new Float32Array(N); this.homeR = new Float32Array(N); this.hosp = new Uint8Array(N); this.line = new Int8Array(N).fill(-1);
    this.leg = new Int16Array(N); this.brake = new Uint8Array(N); this.wheel = new Float32Array(N); this.acc = new Float32Array(N); this.hard = new Float32Array(N);
    this.cx = new Float32Array(N); this.cz = new Float32Array(N); this.hx = new Float32Array(N); this.hz = new Float32Array(N); this.fx = new Float32Array(N); this.fz = new Float32Array(N);
    this.bStart = new Int32Array(S + 1); this.bCur = new Int32Array(S + 1);
    this.eV = new Int32Array(N * 3); this.eK = new Float32Array(N * 3); this.eOwn = new Uint8Array(N * 3); this.my = new Int32Array(N);
    this.occ = new Int32Array(S);
    this.spawn(counts, lines);
    this.bucket();
    this.render(0);
  }

  // ---------------------------------------------------------------- spawning
  private spawn(counts: { cars: number; taxis: number }, lines: BusLine[]) {
    const { segs } = this.net;
    const placed = new Map<number, { s: number; len: number }[]>();
    const free = (g: number, s: number, len: number) => {
      const l = placed.get(g) ?? [];
      for (const o of l) if (Math.abs(o.s - s) < Math.max(len, o.len) + 4) return false;
      return true;
    };
    const put = (i: number, g: number, s: number) => {
      const l = placed.get(g) ?? []; l.push({ s, len: this.len[i] }); placed.set(g, l);
      this.seg[i] = g; this.s[i] = s; this.v[i] = segs[g].vmax * 0.55;
      this.enter(i, g);
      if (this.stopAt[i] >= 0 && this.stopAt[i] < s + 2) this.stopAt[i] = -1;
    };
    let i = 0;
    // buses: evenly spread along each loop
    lines.forEach((L, li) => {
      const C = L.corners, legs: number[] = [];
      let total = 0;
      for (let k = 0; k < C.length; k++) { const a = C[k], b = C[(k + 1) % C.length]; legs.push(Math.hypot(b[0] - a[0], b[1] - a[1])); total += legs[k]; }
      for (let b = 0; b < L.n; b++, i++) {
        this.type[i] = BUS; this.len[i] = DIM[BUS].len; this.line[i] = li; this.homeR[i] = 1e9;
        for (let tries = 0; tries < 40; tries++) {
          let d = ((b + 0.13) / L.n) * total + tries * 17, k = 0;
          d %= total;
          while (d > legs[k]) { d -= legs[k]; k++; }
          const a = C[k], c = C[(k + 1) % C.length];
          const hx = (c[0] - a[0]) / legs[k], hz = (c[1] - a[1]) / legs[k];
          const f = findLane(this.net, a[0] + hx * d, a[1] + hz * d, hx, hz);
          if (!f || f.s < this.len[i] + 1 || f.s > segs[f.seg].len - 1 || !free(f.seg, f.s, this.len[i])) continue;
          this.leg[i] = k;
          put(i, f.seg, f.s);
          break;
        }
      }
    });
    // cars and taxis: weighted towards the hospital
    const cand: number[] = [], cw: number[] = [];
    let tw = 0;
    for (const g of segs) {
      if (g.kind !== 0 || g.campus || g.len < 14) continue;
      const mx = g.ax + g.ux * g.len * 0.5, mz = g.az + g.uz * g.len * 0.5;
      const w = g.len * (Math.exp(-Math.hypot(mx, mz) / 420) * 3 + 0.2);
      cand.push(g.id); cw.push(w); tw += w;
    }
    const pick = () => { let r = rnd() * tw; for (let k = 0; k < cand.length; k++) { r -= cw[k]; if (r <= 0) return cand[k]; } return cand[cand.length - 1]; };
    for (let k = 0; k < counts.cars + counts.taxis; k++, i++) {
      const t = k < counts.taxis ? TAXI : CAR;
      this.type[i] = t; this.len[i] = DIM[t].len;
      const r = rnd();
      this.homeR[i] = r < (t === TAXI ? 0.7 : 0.55) ? 300 + rnd() * 160 : r < 0.85 ? 700 + rnd() * 200 : 1300;
      if (t === TAXI && k < 22) { this.hosp[i] = 1; this.homeR[i] = 140 + rnd() * 60; } // taxis serving the hospital (drop-off loop)
      for (let tries = 0; tries < 40; tries++) {
        const g = pick(), L = segs[g].len;
        const s = this.len[i] + 0.5 + rnd() * Math.max(0, L - this.len[i] - 1);
        if (!free(g, s, this.len[i])) continue;
        put(i, g, s);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- route choice (called when a vehicle enters segment g)
  private enter(i: number, g: number) {
    const { segs, nodes, roads } = this.net;
    const G = segs[g];
    this.stopAt[i] = -1;
    if (G.kind === 1) { this.next[i] = G.succ[0] ?? -1; return; }
    if (G.kind === 2) {
      if (G.succ.length > 1 && G.exitRoad === this.target[i]) {
        const k = this.type[i] === BUS ? G.succ.length - 1 : 1 + Math.floor(rnd() * (G.succ.length - 1));
        this.next[i] = G.succ[k];
      } else this.next[i] = G.succ[0] ?? -1;
      return;
    }
    // a lane: stops on it, then the movement at its end
    const t = this.type[i];
    if (t === BUS) {
      for (let k = 0; k < G.stops.length; k++) if (G.stops[k].line === this.line[i]) { this.stopAt[i] = G.stops[k].s; this.dwell[i] = 4 + rnd() * 2; this.pull[i] = Math.min(3, G.kerb); }
    } else if (G.drop >= 0 && rnd() < 0.9) { this.stopAt[i] = G.drop; this.dwell[i] = 3 + rnd() * 2; this.pull[i] = 0; }
    else if (t === TAXI && G.kerb > 0.8 && G.len > 50 && rnd() < 0.12) { this.stopAt[i] = 18 + rnd() * (G.len - 36); this.dwell[i] = 2 + rnd() * 1.6; this.pull[i] = Math.min(2.8, G.kerb); }
    if (!G.succ.length) { this.next[i] = -1; return; }
    const n = nodes[G.node];
    if (t === BUS) {
      const L = this.lines[this.line[i]], C = L.corners, nc = C.length;
      const c1 = C[(this.leg[i] + 1) % nc];
      if (Math.hypot(n.x - c1[0], n.z - c1[1]) < 4) this.leg[i] = (this.leg[i] + 1) % nc;
      const a = C[this.leg[i]], b = C[(this.leg[i] + 1) % nc];
      const dl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, dx = (b[0] - a[0]) / dl, dz = (b[1] - a[1]) / dl;
      if (n.rb) {
        let best = -1, bd = -2;
        for (let q = 0; q < n.ends.length; q++) { const e = n.ends[q]; const d = e.ux * dx + e.uz * dz; if (d > bd && roads[e.road].lanes[e.end === 0 ? 0 : 1].length) { bd = d; best = e.road; } }
        this.target[i] = best; this.next[i] = G.succ[0]; return;
      }
      let best = G.succ[0], bd = -2;
      for (let q = 0; q < G.succ.length; q++) { const c = G.succ[q]; const O = segs[segs[c].succ[0]]; const d = O.ux * dx + O.uz * dz + O.lane * 0.01; if (d > bd) { bd = d; best = c; } }
      this.next[i] = best; return;
    }
    const dNow = Math.hypot(n.x, n.z), far = dNow > this.homeR[i];
    if (n.rb) {
      // pick the exit road of the roundabout now; the ring arcs read target[i]
      let tw = 0;
      const ix = G.ux, iz = G.uz;
      for (let pass = 0; pass < 2; pass++) {
        let r = rnd() * tw;
        for (let q = 0; q < n.ends.length; q++) {
          const e = n.ends[q], R = roads[e.road];
          if (!R.lanes[e.end === 0 ? 0 : 1].length) continue;
          const dot = ix * e.ux + iz * e.uz, cross = ix * e.uz - iz * e.ux;
          let w = R.id === G.road ? 0.04 : dot > 0.7 ? 1 : cross > 0 ? 0.6 : 0.5;
          if (far) { const fn = nodes[R.a === n.id ? R.b : R.a]; w *= Math.hypot(fn.x, fn.z) < dNow - 1 ? 3 : 0.35; }
          if (pass === 0) tw += w; else { r -= w; if (r <= 0) { this.target[i] = R.id; break; } }
        }
      }
      this.next[i] = G.succ[0]; return;
    }
    if (G.succ.length === 1) { this.next[i] = G.succ[0]; return; }
    let tw = 0;
    for (let pass = 0; pass < 2; pass++) {
      let r = rnd() * tw;
      for (let q = 0; q < G.succ.length; q++) {
        const c = G.succ[q], C = segs[c], R = roads[C.outRoad];
        let w = C.turn === 0 ? 1 : C.turn === 1 ? 0.55 : C.turn === 2 ? (n.signal >= 0 ? 0.18 : 0.45) : 0.04;
        // taxis serving the hospital circle the campus clockwise (right turns) back to its right-in entrance
        if (this.hosp[i] && dNow < 220) w = C.turn === 1 ? 3 : C.turn === 0 ? 0.6 : 0.2;
        if (R.campus && !G.campus) w = t === TAXI ? (this.hosp[i] ? 25 : 0.7) : 0.05;
        else if (G.campus) w = C.turn === 1 ? 1 : 0.12;
        else if (far) { const fn = nodes[R.a === n.id ? R.b : R.a]; w *= Math.hypot(fn.x, fn.z) < dNow - 1 ? 3 : 0.35; }
        if (pass === 0) tw += w; else { r -= w; if (r <= 0) { this.next[i] = c; return; } }
      }
    }
    this.next[i] = G.succ[G.succ.length - 1];
  }

  // ---------------------------------------------------------------- buckets: vehicles (and the overhanging rear of long ones) per segment, sorted by position
  private bucket() {
    const { segs } = this.net, N = this.N, S = segs.length;
    const st = this.bStart, cur = this.bCur;
    st.fill(0);
    for (let i = 0; i < N; i++) {
      st[this.seg[i] + 1]++;
      const r = this.s[i] - this.len[i];
      if (r < 0 && this.h1[i] >= 0) { st[this.h1[i] + 1]++; if (r + segs[this.h1[i]].len < 0 && this.h2[i] >= 0) st[this.h2[i] + 1]++; }
    }
    for (let g = 1; g <= S; g++) st[g] += st[g - 1];
    cur.set(st);
    const eV = this.eV, eK = this.eK, eO = this.eOwn;
    for (let i = 0; i < N; i++) {
      let k = cur[this.seg[i]]++; eV[k] = i; eK[k] = this.s[i]; eO[k] = 1;
      const r = this.s[i] - this.len[i];
      if (r < 0 && this.h1[i] >= 0) {
        const L1 = segs[this.h1[i]].len;
        k = cur[this.h1[i]]++; eV[k] = i; eK[k] = L1 + this.s[i]; eO[k] = 0;
        if (r + L1 < 0 && this.h2[i] >= 0) { k = cur[this.h2[i]]++; eV[k] = i; eK[k] = segs[this.h2[i]].len + L1 + this.s[i]; eO[k] = 0; }
      }
    }
    // insertion sort inside each bucket (nearly sorted frame to frame)
    for (let g = 0; g < S; g++) {
      const a = st[g], b = st[g + 1];
      if (b - a < 2) continue;
      for (let p = a + 1; p < b; p++) {
        const kv = eV[p], kk = eK[p], ko = eO[p];
        let q = p - 1;
        while (q >= a && eK[q] > kk) { eV[q + 1] = eV[q]; eK[q + 1] = eK[q]; eO[q + 1] = eO[q]; q--; }
        eV[q + 1] = kv; eK[q + 1] = kk; eO[q + 1] = ko;
      }
    }
    for (let i = 0; i < N; i++) {
      const g = this.seg[i];
      for (let k = st[g]; k < st[g + 1]; k++) if (eV[k] === i && eO[k]) { this.my[i] = k; break; }
    }
  }
  /** Front-most vehicle still before the end of lane g (−1 if none). */
  private frontmost(g: number) {
    const L = this.net.segs[g].len;
    for (let k = this.bStart[g + 1] - 1; k >= this.bStart[g]; k--) if (this.eOwn[k] && this.eK[k] <= L + 1e-3) return this.eV[k];
    return -1;
  }
  /** Free length from the start of segment g up to the first rear found (searching up to `need` metres). */
  private room(g: number, need: number) {
    const { segs } = this.net;
    let off = 0;
    for (let hop = 0; hop < 4 && g >= 0; hop++) {
      const a = this.bStart[g], b = this.bStart[g + 1];
      if (b > a) return off + this.eK[a] - this.len[this.eV[a]] >= need;
      off += segs[g].len;
      if (off >= need) return true;
      const G = segs[g];
      g = G.kind !== 0 && G.succ.length === 1 ? G.succ[0] : -1;
    }
    return true;
  }

  private grant(i: number, c: number, dLine: number) {
    const { segs, nodes } = this.net;
    const C = segs[c], n = nodes[C.node];
    if (C.gate === 1) {
      if (n.signal >= 0) {
        const stl = lightState(n.signal, C.group, this.time);
        if (stl === 0 || (stl === 1 && dLine > 6)) return false;
      }
      const m = n.conns.length, cm = n.cm!, li = C.local * m;
      for (let k = 0; k < m; k++) if (cm[li + k] && this.occ[n.conns[k]] > 0) return false;
      if (n.claim >= 0 && n.claim !== c) {
        if (this.time - n.claimT > 25) n.claim = -1;
        else if (cm[li + segs[n.claim].local]) return false;
      }
      // minor arm: yield to the major road (unless this movement holds the junction's anti-starvation claim)
      if (C.minor && n.claim !== c) for (let q = 0; q < n.majorIn.length; q++) {
        const ml = n.majorIn[q], f = this.frontmost(ml);
        if (f < 0) continue;
        const fn = this.next[f];
        if (fn < 0 || segs[fn].local < 0 || segs[fn].node !== n.id || !cm[li + segs[fn].local]) continue;
        const d = segs[ml].len - this.s[f];
        if (d < 32 && (this.v[f] > 0.5 || d < 10)) return false;
      }
    } else {
      for (let k = 0; k < C.siblings.length; k++) if (this.occ[C.siblings[k]] > 0) return false;
      for (let k = 0; k < C.upstream.length; k++) {
        const a = C.upstream[k], off = C.upOff[k], La = segs[a].len;
        for (let e = this.bStart[a]; e < this.bStart[a + 1]; e++) {
          if (!this.eOwn[e]) continue;
          const d = La - this.eK[e] + off, j = this.eV[e];
          if (d < 21 && (this.v[j] > 0.3 || d < 7)) return false;
        }
      }
    }
    if (!this.room(C.succ[0], this.len[i] + 2.5)) return false;
    return true;
  }

  /** Is any part of vehicle i (front to rear) still on segment g? */
  private onSeg(i: number, g: number) {
    const s = this.s[i], len = this.len[i], h1 = this.h1[i];
    return this.seg[i] === g || (h1 === g && s < len) || (this.h2[i] === g && h1 >= 0 && s + this.net.segs[h1].len < len);
  }
  /** Before holding a new connector: the one still under the vehicle's rear moves to the second slot. */
  private keep(i: number) {
    if (this.held[i] < 0) return;
    if (!this.heldIn[i]) { this.occ[this.held[i]]--; this.held[i] = -1; return; }
    if (this.held2[i] >= 0) this.occ[this.held2[i]]--;
    this.held2[i] = this.held[i]; this.held[i] = -1; this.heldIn[i] = 0;
  }

  // IDM interaction term of one obstacle (gap in metres, obstacle speed); keeps the most restrictive. No closures.
  private _M = 0; private _v = 0; private _worst = 0;
  private inter = (gap: number, lv: number) => {
    const M = IDM[this._M], v = this._v;
    const ss = M.s0 + Math.max(0, v * M.T + (v * (v - lv)) / (2 * Math.sqrt(M.A * M.B)));
    const k = ss / Math.max(gap, 0.05);
    const x = k * k; if (x > this._worst) this._worst = x;
  };

  // ---------------------------------------------------------------- one simulation step
  step(dtIn: number) {
    const t0 = performance.now();
    const dt = Math.min(dtIn, 0.1);
    if (dt <= 0) return;
    this.time += dt;
    const { segs, nodes } = this.net;
    const N = this.N, pl = frame.player, pa = pl.active && Math.abs(pl.y) < 3;
    this.bucket();
    // 1. accelerations from the start-of-frame state
    for (let i = 0; i < N; i++) {
      const t = this.type[i], M = IDM[t], g = this.seg[i], G = segs[g], L = G.len, s = this.s[i], v = this.v[i];
      const nx = this.next[i];
      // free speed: segment limit, slowing in advance for the next curve
      let v0 = G.vmax * M.mul;
      const vn = nx >= 0 ? segs[nx].vmax * M.mul : 0;
      v0 = Math.min(v0, Math.sqrt(vn * vn + 3.2 * Math.max(0, L - s)));
      if (v0 < 0.5) v0 = 0.5;
      let hard = 1e9;
      this._M = t; this._v = v; this._worst = 0;
      const inter = this.inter;
      // leader on the same segment, else along the chain ahead
      const k = this.my[i], b1 = this.bStart[g + 1];
      if (k + 1 < b1) {
        const j = this.eV[k + 1], gap = this.eK[k + 1] - this.len[j] - s;
        inter(gap, this.v[j]); if (gap < hard) hard = gap;
      } else {
        let off = L - s, q = nx, hops = 0;
        while (q >= 0 && hops < 3 && off < 80) {
          const a = this.bStart[q], b = this.bStart[q + 1];
          if (b > a) { const j = this.eV[a]; if (j !== i) { const gap = off + this.eK[a] - this.len[j]; inter(gap, this.v[j]); if (gap < hard) hard = gap; } break; }
          off += segs[q].len;
          const Q = segs[q];
          q = Q.kind === 1 ? Q.succ[0] : -1;
          hops++;
        }
      }
      // diverge: a vehicle that just took another branch of this segment's end may still be in the way
      if (L - s < 16) for (let q = 0; q < G.succ.length; q++) {
        const o = G.succ[q];
        if (o === nx) continue;
        const a0 = this.bStart[o];
        if (this.bStart[o + 1] > a0) {
          const j = this.eV[a0], rear = this.eK[a0] - this.len[j];
          if (rear < 3.5) { const gap = L - s + rear; inter(gap, this.v[j]); if (gap < hard) hard = gap; }
        }
      }
      // zipper merge onto a roundabout ring (both the ring vehicle and the entering one)
      if (nx >= 0 && L - s < 30) {
        const NX = segs[nx], dv = L - s;
        if (NX.merge.length) for (let m = 0; m < NX.merge.length; m++) {
          const mg = NX.merge[m]; if (mg === g) continue;
          const Lm = segs[mg].len;
          for (let e = this.bStart[mg]; e < this.bStart[mg + 1]; e++) {
            if (!this.eOwn[e]) continue;
            const dw = Lm - this.eK[e];
            if (dw < dv) { const j = this.eV[e]; const gap = Math.max(0.2, dv - dw - this.len[j]); inter(gap, this.v[j]); }
          }
        }
        if (G.gate === 2 && G.upstream.length) {
          const a = G.upstream[0], La = segs[a].len;
          for (let e = this.bStart[a]; e < this.bStart[a + 1]; e++) {
            if (!this.eOwn[e]) continue;
            const dw = La - this.eK[e];
            if (dw < dv) { const j = this.eV[e]; const gap = Math.max(0.2, dv - dw - this.len[j]); inter(gap, this.v[j]); }
          }
        }
      }
      // a grant taken far from a signal that has turned red since is given back (unless too close to stop)
      if (nx >= 0 && this.held[i] === nx && !this.heldIn[i] && segs[nx].gate === 1) {
        const n = nodes[segs[nx].node];
        if (n.signal >= 0) {
          const stl = lightState(n.signal, segs[nx].group, this.time), dLine = L - s;
          if ((stl === 0 && dLine > 2 + (v * v) / 8) || (stl === 1 && dLine > 3 + (v * v) / 6)) { this.occ[nx]--; this.held[i] = -1; }
        }
      }
      // junction gate: stop line until granted
      if (nx >= 0 && segs[nx].gate && this.held[i] !== nx) {
        const dLine = L - s;
        inter(dLine + M.s0 - 0.6, 0);
        if (dLine - 0.3 < hard) hard = Math.max(0, dLine - 0.3);
        const front = k + 1 >= b1 || this.eK[k + 1] > L;
        if (front && dLine < Math.max(10, (v * v) / 4 + 6)) {
          if (this.grant(i, nx, dLine)) {
            this.keep(i);
            this.held[i] = nx; this.heldIn[i] = 0; this.occ[nx]++; this.wait[i] = 0;
            const n = nodes[segs[nx].node];
            if (n.claim === nx) n.claim = -1;
          } else if (v < 0.3) {
            this.wait[i] += dt;
            const n = nodes[segs[nx].node];
            if (this.wait[i] > 6 && n.claim < 0 && segs[nx].gate === 1) { n.claim = nx; n.claimT = this.time; }
          }
        }
      }
      // planned stop (bus stop, drop-off, taxi at the kerb)
      const sa = this.stopAt[i];
      if (sa >= 0) {
        const d = sa - s;
        if (d > -0.5) { inter(d + M.s0 - 0.25, 0); if (d < hard) hard = Math.max(0, d); }
        if (d < 0.9 && v < 0.25) {
          if (this.dwellT[i] <= 0) this.dwellT[i] = this.dwell[i];
          this.dwellT[i] -= dt;
          if (this.dwellT[i] <= 0) { this.stopAt[i] = -1; this.dwellT[i] = 0; }
        }
      }
      // the walking player standing ahead in the lane
      if (pa) {
        const dx = pl.x - this.fx[i], dz = pl.z - this.fz[i];
        const along = dx * this.hx[i] + dz * this.hz[i], lat = -dx * this.hz[i] + dz * this.hx[i];
        // corridor: half the vehicle width + the player's radius (~0.4 m) + 1 m margin
        if (along > -1.5 && along < 45 && Math.abs(lat) < DIM[t].w / 2 + 1.4) { const gap = along - 1.5; inter(gap, 0); if (gap < hard) hard = Math.max(0, gap); }
      }
      const vr = v / v0;
      let a = M.A * (1 - vr * vr * vr * vr) - M.A * this._worst;
      if (a < -9) a = -9;
      this.acc[i] = a;
      this.hard[i] = hard;
    }
    // 2. integrate, transitions
    for (let i = 0; i < N; i++) {
      const hard = this.hard[i];
      const v = this.v[i];
      let vn = v + this.acc[i] * dt;
      if (vn < 0) vn = 0;
      let ds = 0.5 * (v + vn) * dt;
      const lim = Math.max(0, hard - 0.25);
      if (ds > lim) { ds = lim; vn = Math.min(vn, ds / dt); }
      this.v[i] = vn;
      this.s[i] += ds;
      this.wheel[i] = (this.wheel[i] + ds / DIM[this.type[i]].wr) % (Math.PI * 2);
      this.brake[i] = this.acc[i] < -0.7 || (vn < 0.2 && this.stopAt[i] < 0) || this.dwellT[i] > 0 ? 1 : 0;
      // segment transitions
      let guard = 0;
      while (this.s[i] > segs[this.seg[i]].len && guard++ < 4) {
        const nx = this.next[i];
        if (nx < 0) { this.s[i] = segs[this.seg[i]].len; this.v[i] = 0; break; }
        this.s[i] -= segs[this.seg[i]].len;
        this.h2[i] = this.h1[i]; this.h1[i] = this.seg[i]; this.seg[i] = nx;
        if (this.held[i] === nx) this.heldIn[i] = 1;
        else if (segs[nx].gate) { this.keep(i); this.occ[nx]++; this.held[i] = nx; this.heldIn[i] = 1; } // entered without a grant (spawn edge case)
        this.enter(i, nx);
      }
      // release held connectors once the rear has left them
      const hd = this.held[i];
      if (hd >= 0 && this.heldIn[i] && !this.onSeg(i, hd)) { this.occ[hd]--; this.held[i] = -1; this.heldIn[i] = 0; }
      const h2 = this.held2[i];
      if (h2 >= 0 && !this.onSeg(i, h2)) { this.occ[h2]--; this.held2[i] = -1; }
      // lateral pull-over towards the kerb when stopping
      const want = this.stopAt[i] >= 0 && this.stopAt[i] - this.s[i] < 24 ? this.pull[i] : 0;
      const dl = want - this.lat[i];
      this.lat[i] += Math.max(-dt * 1.1, Math.min(dt * 1.1, dl));
    }
    this.render(dt);
    this.stats.ms = this.stats.ms * 0.95 + (performance.now() - t0) * 0.05;
    this.stats.frames++;
  }

  // ---------------------------------------------------------------- pose (centre, heading, front point) from the front and rear points on the path
  private pt(i: number, off: number) {
    const { segs } = this.net;
    let s = this.s[i] + off, g = this.seg[i];
    if (s < 0 && this.h1[i] >= 0) {
      s += segs[this.h1[i]].len; g = this.h1[i];
      if (s < 0 && this.h2[i] >= 0) { s += segs[this.h2[i]].len; g = this.h2[i]; }
    }
    evalSeg(segs[g], s < 0 ? 0 : s);
  }
  render(dt: number) {
    for (let i = 0; i < this.N; i++) {
      this.pt(i, 0);
      const fx = P.x, fz = P.z;
      this.pt(i, -this.len[i]);
      let hx = fx - P.x, hz = fz - P.z;
      const hl = Math.hypot(hx, hz);
      if (hl > 1e-3) { hx /= hl; hz /= hl; } else { hx = this.hx[i] || 1; hz = this.hz[i]; }
      const la = this.lat[i];
      this.hx[i] = hx; this.hz[i] = hz;
      this.cx[i] = (fx + P.x) / 2 - hz * la; this.cz[i] = (fz + P.z) / 2 + hx * la;
      this.fx[i] = fx - hz * la; this.fz[i] = fz + hx * la;
    }
    void dt;
  }
}
