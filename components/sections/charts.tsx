"use client";
// Charts for the full-screen sections: waterfall, ramp, sensitivities, squarified "market map" treemap. Sized to their container.
import { useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { DATA, META, fr, type UseCase } from "@/lib/model";
import { useSize } from "@/lib/ui/hooks";
import { FAM_COLOR, BRIQUE_COLOR, famName } from "@/lib/ui/fmt";
import s from "@/components/ui/styles";

const EASE = [0.2, 0.8, 0.2, 1] as const;
const C = { eco: "#4CC79A", cost: "#C9827A", net: "#E8ECF6", cumul: "#9FB3FF", grid: "rgba(255,255,255,.07)", mut: "#8D97B0" };

/* ---------------------------------------------------------------- waterfall 302 → −160 → 142 */
export function Waterfall() {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const bars = [
    { label: "Économie", sub: "masse salariale", v: META.eco, from: 0, to: META.eco, color: C.eco },
    { label: "Coût des agents", sub: "licences, calcul, supervision", v: -META.budget, from: META.eco, to: META.eco - META.budget, color: C.cost },
    { label: "Gain net", sub: "chaque année", v: META.net, from: 0, to: META.net, color: C.net },
  ];
  const top = 26, bottom = 46, max = META.eco;
  const ih = Math.max(10, h - top - bottom);
  const y = (v: number) => top + ih - (v / max) * ih;
  const bw = Math.min(110, (w / bars.length) * 0.5);
  const cx = (i: number) => (w / bars.length) * (i + 0.5);
  return (
    <div ref={ref} className="relative h-full w-full">
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="overflow-visible">
          <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.18)" />
          {bars.map((b, i) => {
            const y1 = y(Math.max(b.from, b.to)), y2 = y(Math.min(b.from, b.to));
            return (
              <g key={b.label}>
                {i < bars.length - 1 && <line x1={cx(i) + bw / 2} x2={cx(i + 1) - bw / 2} y1={y(b.to)} y2={y(b.to)} stroke="rgba(255,255,255,.28)" strokeDasharray="3 4" />}
                <rect key={`${w}x${h}`} x={cx(i) - bw / 2} width={bw} rx={8} fill={b.color} fillOpacity={i === 1 ? 0.75 : 0.92}
                  y={y1} height={Math.max(2, y2 - y1)} className={i === 1 ? "ag-grow-down" : "ag-grow"} style={{ animationDelay: `${0.15 + i * 0.25}s` }} />
                <motion.text x={cx(i)} y={y1 - 9} textAnchor="middle" className="num" fontSize={Math.min(30, Math.max(18, w / 22))} fontWeight={800} fill={i === 2 ? "#fff" : b.color}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 + i * 0.25 }}>
                  {b.v < 0 ? "−" : ""}{fr(Math.abs(b.v), 0)}
                </motion.text>
                <text x={cx(i)} y={h - 26} textAnchor="middle" fontSize={13} fontWeight={600} fill="#EDF0F7">{b.label}</text>
                {w / bars.length > 150 && <text x={cx(i)} y={h - 9} textAnchor="middle" fontSize={11.5} fill={C.mut}>{b.sub}</text>}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- ramp 2027 → 2029 */
export function RampChart({ compact = false }: { compact?: boolean }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const years = ["2027", "2028", "2029"] as const;
  const r = years.map((k) => DATA.ramp[k]);
  const max = Math.max(...r.map((x) => Math.max(x.eco, x.cumul)));
  const top = 22, bottom = 30, left = 4, right = 4;
  const ih = Math.max(10, h - top - bottom), iw = Math.max(10, w - left - right);
  const y = (v: number) => top + ih - (v / max) * ih;
  const gw = iw / years.length;
  const bw = Math.min(compact ? 20 : 28, gw / 6);
  const gx = (i: number) => left + gw * (i + 0.5);
  const series = [
    { k: "eco" as const, color: C.eco, op: 0.92 },
    { k: "cout" as const, color: C.cost, op: 0.7 },
    { k: "net" as const, color: C.net, op: 0.92 },
    { k: "cumul" as const, color: C.cumul, op: 0.22 },
  ];
  return (
    <div ref={ref} className="relative h-full w-full">
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="overflow-visible">
          {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={left} x2={w - right} y1={y(max * t)} y2={y(max * t)} stroke={C.grid} />)}
          <line x1={left} x2={w - right} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.18)" />
          {r.map((x, i) => (
            <g key={years[i]}>
              {series.map((sr, j) => {
                const v = x[sr.k];
                const bx = gx(i) + (j - 1.5) * (bw + 5) - bw / 2;
                return (
                  <g key={sr.k}>
                    <rect x={bx} width={bw} rx={5} fill={sr.color} fillOpacity={sr.op} stroke={sr.k === "cumul" ? sr.color : "none"} strokeDasharray={sr.k === "cumul" ? "4 3" : undefined} strokeWidth={1.4}
                      y={y(v)} height={Math.max(1.5, y(0) - y(v))} className="ag-grow" style={{ animationDelay: `${0.1 + i * 0.15 + j * 0.06}s` }} />
                    <text x={bx + bw / 2} y={y(v) - 6} textAnchor="middle" fontSize={compact ? 10.5 : 11.5} fontWeight={700} fill={sr.color} className="num">{fr(v, v < 10 ? 1 : 0)}</text>
                  </g>
                );
              })}
              <text x={gx(i)} y={h - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#EDF0F7" className="num">{years[i]}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}
export function RampLegend() {
  const items = [["Économie", C.eco], ["Coût des agents", C.cost], ["Gain net", C.net], ["Cumul des gains nets depuis 2027", C.cumul]] as const;
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-[var(--mut)]">
      {items.map(([l, c], i) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="inline-block h-[3px] w-3 rounded-full" style={{ background: c, ...(i === 3 ? { backgroundImage: `repeating-linear-gradient(90deg, ${c} 0 4px, transparent 4px 7px)`, background: "none" } : {}) }} />{l}
        </span>
      ))}
      <span>· en MDH (millions de dirhams) par an</span>
    </div>
  );
}

/* ---------------------------------------------------------------- sensitivities */
export function Sensitivities() {
  const rows = Object.entries(DATA.sens).map(([k, v]) => {
    const b = k.match(/^budget (\d+)/);
    const e = k.match(/(\d+) %/);
    const base = b ? Number(b[1]) === META.budget : false;
    const label = b ? <>Coût des agents à <b className="num text-white">{b[1]}</b> MDH{base ? " (base)" : ""}</> : e ? <>Économie réalisée à <b className="num text-white">{e[1]} %</b></> : k;
    return { k, v, base, label };
  });
  const max = Math.max(...rows.map((r) => r.v));
  return (
    <div className="flex h-full flex-col justify-center gap-[clamp(6px,1vh,12px)]">
      {rows.map((r, i) => (
        <div key={r.k} className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_52px] items-center gap-3">
          <span className="truncate text-[12.5px] text-[var(--txt-2)]">{r.label}</span>
          <div className="relative h-[18px] overflow-hidden rounded-[6px] bg-white/[0.05]">
            <motion.div className="absolute inset-y-0 left-0 rounded-[6px]" style={{ background: r.base ? "#E8ECF6" : r.v >= META.net ? "rgba(76,199,154,.75)" : "rgba(226,176,90,.7)" }}
              initial={{ width: 0 }} animate={{ width: `${(r.v / max) * 100}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.08, ease: EASE }} />
          </div>
          <span className={`num text-right text-[15px] ${r.base ? "text-white" : r.v >= META.net ? "text-[#7FD9B5]" : "text-[#E9C27F]"}`}>{fr(r.v, 0)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- squarified treemap */
type Rect = { x: number; y: number; w: number; h: number };
function worst(row: number[], side: number) {
  const sum = row.reduce((a, b) => a + b, 0), mx = Math.max(...row), mn = Math.min(...row);
  return Math.max((side * side * mx) / (sum * sum), (sum * sum) / (side * side * mn));
}
export function squarify(values: number[], r: Rect): Rect[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total || r.w <= 0 || r.h <= 0) return values.map(() => ({ x: r.x, y: r.y, w: 0, h: 0 }));
  const scale = (r.w * r.h) / total;
  const order = values.map((v, i) => ({ v: v * scale, i })).sort((a, b) => b.v - a.v);
  const out: Rect[] = new Array(values.length);
  let { x, y, w, h } = r;
  let k = 0;
  while (k < order.length) {
    const side = Math.min(w, h);
    const row = [order[k]];
    let j = k + 1;
    while (j < order.length && worst([...row, order[j]].map((o) => o.v), side) <= worst(row.map((o) => o.v), side)) { row.push(order[j]); j++; }
    const sum = row.reduce((a, b) => a + b.v, 0);
    if (w >= h) {
      const cw = sum / h; let cy = y;
      for (const o of row) { const ch = o.v / cw; out[o.i] = { x, y: cy, w: cw, h: ch }; cy += ch; }
      x += cw; w -= cw;
    } else {
      const rh = sum / w; let cx = x;
      for (const o of row) { const cw = o.v / rh; out[o.i] = { x: cx, y, w: cw, h: rh }; cx += cw; }
      y += rh; h -= rh;
    }
    k = j;
  }
  return out;
}

export type ColorBy = "famille" | "brique";
export function MarketMap({ cases, colorBy, hover, setHover, onOpen }: { cases: UseCase[]; colorBy: ColorBy; hover: string | null; setHover: (id: string | null) => void; onOpen: (id: string) => void }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const layout = useMemo(() => {
    const live = cases.filter((c) => c.mdh > 0);
    const keyOf = (c: UseCase) => (colorBy === "famille" ? c.id[0] : c.brique);
    const groups = [...new Set(live.map(keyOf))].map((g) => ({ g, items: live.filter((c) => keyOf(c) === g) }));
    groups.forEach((x) => x.items.sort((a, b) => b.mdh - a.mdh));
    const gRects = squarify(groups.map((x) => x.items.reduce((a, c) => a + c.mdh, 0)), { x: 0, y: 0, w, h });
    const tiles: { c: UseCase; r: Rect; color: string }[] = [];
    const heads: { g: string; r: Rect; mdh: number; color: string }[] = [];
    groups.forEach((gr, gi) => {
      const R = gRects[gi];
      const color = colorBy === "famille" ? FAM_COLOR[gr.g] : BRIQUE_COLOR[gr.g] ?? "#8D97B0";
      const head = R.h > 70 && R.w > 120 ? 22 : 0;
      heads.push({ g: gr.g, r: R, mdh: gr.items.reduce((a, c) => a + c.mdh, 0), color });
      const inner = { x: R.x + 2, y: R.y + 2 + head, w: Math.max(0, R.w - 4), h: Math.max(0, R.h - 4 - head) };
      const rs = squarify(gr.items.map((c) => c.mdh), inner);
      gr.items.forEach((c, i) => tiles.push({ c, r: rs[i], color }));
    });
    return { tiles, heads };
  }, [cases, colorBy, w, h]);
  const hc = layout.tiles.find((t) => t.c.id === hover)?.c;
  const roiMin = 1.4, roiMax = 3.2;
  return (
    <div ref={ref} className="relative h-full w-full" onMouseLeave={() => { setHover(null); setTip(null); }}>
      {layout.heads.map((g) => (
        g.r.h > 70 && g.r.w > 120 ? (
          <div key={"h" + g.g} className="pointer-events-none absolute flex items-center gap-2 truncate px-2 text-[11px] font-semibold uppercase tracking-[0.08em]"
            style={{ left: g.r.x + 2, top: g.r.y + 3, width: g.r.w - 4, height: 20, color: g.color }}>
            <span className="truncate">{colorBy === "famille" ? famName(g.g) : g.g}</span>
            <span className="num ml-auto shrink-0 text-[11.5px] normal-case tracking-normal text-[var(--txt-2)]">{fr(g.mdh, 1)} MDH</span>
          </div>
        ) : null
      ))}
      {layout.tiles.map(({ c, r, color }) => {
        const t = Math.max(0, Math.min(1, (c.roi - roiMin) / (roiMax - roiMin)));
        const pctMix = Math.round(26 + t * 34);
        const on = hover === c.id;
        const big = r.w > 120 && r.h > 70, mid = r.w > 64 && r.h > 40;
        return (
          <motion.button key={c.id} type="button" data-anchor={`tile:${c.id}`}
            onMouseEnter={() => setHover(c.id)} onMouseMove={(e) => { const b = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top }); }}
            onClick={() => onOpen(c.id)}
            className="absolute overflow-hidden rounded-[7px] text-left"
            initial={false}
            animate={{ left: r.x + 1.5, top: r.y + 1.5, width: Math.max(0, r.w - 3), height: Math.max(0, r.h - 3) }}
            transition={{ type: "spring", stiffness: 200, damping: 28 }}
            style={{
              background: `color-mix(in srgb, ${color} ${pctMix}%, #0B1124)`,
              boxShadow: on ? `inset 0 0 0 2px #fff, 0 10px 30px -10px rgba(0,0,0,.7)` : "inset 0 1px 0 rgba(255,255,255,.12), inset 0 0 0 1px rgba(255,255,255,.05)",
              zIndex: on ? 2 : 1,
            }}>
            {mid && (
              <div className="flex h-full flex-col p-[clamp(5px,0.5vw,9px)]">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="num text-[clamp(11px,0.8vw,14px)] font-[800] text-white">{c.id}</span>
                  {big && <span className="num text-[11px] font-semibold text-white/70">ROI {fr(c.roi, 2)}</span>}
                </div>
                {big && r.h > 104 && <div className="mt-1 text-[12px] leading-snug text-white/80" style={{ display: "-webkit-box", WebkitLineClamp: r.h > 170 ? 3 : r.h > 128 ? 2 : 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.titre}</div>}
                <div className="mt-auto flex items-baseline gap-1">
                  <span className={`num font-[800] text-white ${big ? "text-[clamp(16px,1.25vw,24px)]" : "text-[12.5px]"}`}>{fr(c.mdh, 1)}</span>
                  {big && <span className="text-[11px] font-semibold text-white/60">MDH</span>}
                </div>
              </div>
            )}
          </motion.button>
        );
      })}
      {hc && tip && (
        <div className={`${s.menu} pointer-events-none absolute z-10 w-[300px] rounded-[14px] px-3.5 py-3`}
          style={{ left: Math.min(tip.x + 16, w - 310), top: Math.min(tip.y + 16, h - 190) }}>
          <div className="flex items-center gap-2"><span className="num text-[13px] font-bold" style={{ color: FAM_COLOR[hc.id[0]] }}>{hc.id}</span><span className="text-[11.5px] text-[var(--mut)]">{hc.famille} · vague {hc.vague}</span></div>
          <div className="mt-1 text-[13.5px] font-semibold leading-snug text-white">{hc.titre}</div>
          <div className="mt-2 grid grid-cols-4 gap-2 border-t border-white/[0.08] pt-2">
            <Kv k="MDH" v={fr(hc.mdh, 1)} />
            <Kv k="ETP-éq." v={fr(hc.etp, 0)} />
            <Kv k="Coût MDH" v={fr(hc.cout, 1)} />
            <Kv k="ROI" v={fr(hc.roi, 2)} />
          </div>
          <div className="mt-2 text-[11.5px] text-[var(--mut)]">{hc.brique} · cliquez pour ouvrir</div>
        </div>
      )}
    </div>
  );
}
function Kv({ k, v }: { k: string; v: ReactNode }) {
  return <div><div className="text-[9.5px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">{k}</div><div className="num text-[14px] text-white">{v}</div></div>;
}
