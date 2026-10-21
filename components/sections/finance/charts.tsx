"use client";
// Finance view · charts, hand-made SVG sized to their container (one axis each, hairline grid, 2px gaps, labels in ink colours).
import { useState, type ReactNode } from "react";
import { FINROW, fr, type Series } from "@/lib/model";
import { useSize } from "@/lib/ui/hooks";
import s from "@/components/ui/styles";
import { COL, Y5, mdh, minus, signed, v, caSplit, type Yr } from "./data";

/* ---------------------------------------------------------------- helpers */
function nice(min: number, max: number, n = 4) {
  const span = Math.max(1e-9, max - min);
  const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((x) => x >= raw) ?? 10 * p;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Math.abs(t) < step / 1e6 ? 0 : t);
  return { lo, hi, ticks, step };
}
const tickFmt = (t: number, step: number) => fr(t, Number.isInteger(step) ? 0 : step >= 0.1 ? 1 : 2);

function Tooltip({ x, y, w, children }: { x: number; y: number; w: number; children: ReactNode }) {
  const tw = 250;
  return (
    <div className={`${s.menu} pointer-events-none absolute z-20 rounded-[12px] px-3 py-2.5 text-[12px] leading-snug text-[var(--txt-2)]`}
      style={{ width: tw, left: Math.max(0, Math.min(x + 14, w - tw - 4)), top: Math.max(0, y) }}>
      {children}
    </div>
  );
}
function TipRow({ color, label, value, strong, kind = "bar" }: { color?: string; label: ReactNode; value: ReactNode; strong?: boolean; kind?: "bar" | "line" }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${strong ? "mt-1 border-t border-white/[0.08] pt-1 text-white" : ""}`}>
      <span className="flex min-w-0 items-center gap-1.5">{color && <span className={kind === "line" ? "h-[2px] w-3 rounded-full" : "h-2 w-2 rounded-[2px]"} style={{ background: color }} />}<span className="truncate">{label}</span></span>
      <span className={`num shrink-0 ${strong ? "font-bold text-white" : "text-[var(--txt)]"}`}>{value}</span>
    </div>
  );
}
/** Rounded data end (4px), square at the baseline. */
function barPath(x: number, w: number, yBase: number, yEnd: number, r = 4) {
  const up = yEnd < yBase, h = Math.abs(yBase - yEnd), rr = Math.min(r, h / 2, w / 2);
  if (h < 0.5) return "";
  if (up) return `M${x},${yBase} V${yEnd + rr} Q${x},${yEnd} ${x + rr},${yEnd} H${x + w - rr} Q${x + w},${yEnd} ${x + w},${yEnd + rr} V${yBase} Z`;
  return `M${x},${yBase} V${yEnd - rr} Q${x},${yEnd} ${x + rr},${yEnd} H${x + w - rr} Q${x + w},${yEnd} ${x + w},${yEnd - rr} V${yBase} Z`;
}
type Seg = { v: number; color: string; label: string; op?: number };
/** A stack of segments from a baseline, 2px surface gap between segments, only the outer end rounded. */
function Stack({ x, w, y, base, segs, dir, delay = 0 }: { x: number; w: number; y: (v: number) => number; base: number; segs: Seg[]; dir: 1 | -1; delay?: number }) {
  let acc = base;
  const live = segs.filter((sg) => Math.abs(sg.v) > 1e-9);
  return (
    <g className={dir === 1 ? "ag-grow" : "ag-grow-down"} style={{ animationDelay: `${delay}s` }}>
      {live.map((sg, i) => {
        const a = acc, b = acc + dir * Math.abs(sg.v);
        acc = b;
        const last = i === live.length - 1;
        const ya = y(a), yb = y(b);
        const gap = i > 0 ? 1 : 0; // half of the 2px gap on each side
        const y0 = dir === 1 ? ya - gap : ya + gap, y1 = dir === 1 ? yb + (last ? 0 : 1) : yb - (last ? 0 : 1);
        if (Math.abs(y1 - y0) < 0.6) return null;
        return last
          ? <path key={i} d={barPath(x, w, y0, y1)} fill={sg.color} fillOpacity={sg.op ?? 1} />
          : <rect key={i} x={x} width={w} y={Math.min(y0, y1)} height={Math.abs(y1 - y0)} fill={sg.color} fillOpacity={sg.op ?? 1} />;
      })}
    </g>
  );
}
function Grid({ ticks, y, x0, x1, step, label = true }: { ticks: number[]; y: (v: number) => number; x0: number; x1: number; step: number; label?: boolean }) {
  return (
    <g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke={t === 0 ? COL.axis : COL.grid} />
          {label && <text x={x0 - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10.5} fill={COL.mut} className="num">{tickFmt(t, step)}</text>}
        </g>
      ))}
    </g>
  );
}

/* ================================================================ 2031 cascade: ① → ② → gains bruts → −③ → valeur nette (+ CA aside) */
export function Cascade2031() {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ms = v("ms"), hms = v("hms"), eco = v("eco"), marge = v("marge"), gains = v("gains"), cout = v("cout"), net = v("net");
  const cc = v("cout_cases"), ct = v("cout_transverse"), cg = v("contingence"), ca = v("ca");
  const split = caSplit();
  type Col = { k: string; name: string; sub: string; from: number; to: number; segs: Seg[]; label: string; tip: ReactNode; big?: boolean; aside?: boolean };
  const cols: Col[] = [
    { k: "ms", name: "Masse salariale", sub: "postes non remplacés", from: 0, to: ms, segs: [{ v: ms, color: COL.ms, label: "Masse salariale" }], label: signed(ms),
      tip: <><TipRow color={COL.ms} label="Économie de masse salariale" value={mdh(ms)} /><p className="mt-1.5 text-[11.5px] text-[var(--mut)]">{FINROW.ms.label.replace(/^dont /, "")}.</p></> },
    { k: "hms", name: "Hors masse salariale", sub: "achats, énergie…", from: ms, to: eco, segs: [{ v: hms, color: COL.hms, label: "Hors masse salariale" }], label: signed(hms),
      tip: <><TipRow color={COL.hms} label="Économies hors masse salariale" value={mdh(hms)} /><TipRow label="① Économies réalisées" value={mdh(eco)} strong /></> },
    { k: "marge", name: "② Marge sur CA", sub: `sur ${mdh(ca)} de CA`, from: eco, to: gains, segs: [{ v: marge, color: COL.marge, label: "Marge" }], label: signed(marge),
      tip: <><TipRow label="CA additionnel (pour mémoire)" value={mdh(ca)} /><TipRow label="moins coûts directs" value={minus(v("ca_costs"))} /><TipRow color={COL.marge} label="② Marge sur CA additionnel" value={mdh(marge)} strong /></> },
    { k: "gains", name: "Gains bruts", sub: "① + ②", from: 0, to: gains, segs: [{ v: ms, color: COL.ms, label: "" }, { v: hms, color: COL.hms, label: "" }, { v: marge, color: COL.marge, label: "" }], label: mdh(gains),
      tip: <><TipRow color={COL.ms} label="Masse salariale" value={mdh(ms)} /><TipRow color={COL.hms} label="Hors masse salariale" value={mdh(hms)} /><TipRow color={COL.marge} label="Marge sur CA" value={mdh(marge)} /><TipRow label="Gains bruts" value={mdh(gains)} strong /></> },
    { k: "cout", name: "③ Coût", sub: "du programme", from: gains, to: net, segs: [{ v: cc, color: COL.cout, label: "" }, { v: ct, color: COL.coutT, label: "" }, { v: cg, color: COL.coutC, label: "" }], label: minus(cout),
      tip: <><TipRow color={COL.cout} label="Agents et plateformes des cas" value={minus(cc)} /><TipRow color={COL.coutT} label="Coûts transverses" value={minus(ct)} /><TipRow color={COL.coutC} label="Contingence" value={minus(cg)} /><TipRow label="③ Coût du programme" value={minus(cout)} strong /></> },
    { k: "net", name: "Valeur nette", sub: "① + ② − ③", from: 0, to: net, segs: [{ v: net, color: COL.net, label: "", op: 0.92 }], label: mdh(net), big: true,
      tip: <><TipRow label="Gains bruts" value={mdh(gains)} /><TipRow label="③ Coût du programme" value={minus(cout)} /><TipRow label="Valeur nette 2031" value={mdh(net)} strong /></> },
    { k: "ca", name: "CA additionnel", sub: "pour mémoire", from: 0, to: ca, segs: [], label: mdh(ca), aside: true,
      tip: <><TipRow label="CA récupéré" value={mdh(split.rows[0].ca)} /><TipRow label="CA de nouvelle activité" value={mdh(split.rows[1].ca)} /><TipRow label="CA additionnel" value={mdh(ca)} strong /><TipRow color={COL.marge} label="dont marge" value={mdh(marge)} /><TipRow label="dont coûts directs" value={mdh(v("ca_costs"))} /><p className="mt-1.5 text-[11.5px] text-[var(--mut)]">Un chiffre d&apos;affaires n&apos;est pas une valeur : seule sa marge entre dans les gains.</p></> },
  ];
  const top = 46, bottom = 56, left = 40, right = 6;
  const iw = Math.max(10, w - left - right), ih = Math.max(10, h - top - bottom);
  const sc = nice(0, gains, 5);
  const y = (val: number) => top + ih - (val / sc.hi) * ih;
  const asideGap = 26;
  const slot = (iw - asideGap) / cols.length;
  const bw = Math.max(16, Math.min(58, slot * 0.5));
  const cx = (i: number) => left + slot * (i + 0.5) + (cols[i].aside ? asideGap : 0);
  return (
    <div ref={ref} className="relative h-full w-full" onMouseLeave={() => setHover(null)}>
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="overflow-visible" role="img" aria-label={`Cascade 2031 : ${mdh(eco)} d'économies plus ${mdh(marge)} de marge font ${mdh(gains)} de gains bruts ; moins ${mdh(cout)} de coût, ${mdh(net)} MDH de valeur nette.`}>
          <Grid ticks={sc.ticks} y={y} x0={left} x1={left + slot * 6} step={sc.step} />
          {/* aside separator */}
          <line x1={left + slot * 6 + asideGap / 2} x2={left + slot * 6 + asideGap / 2} y1={top - 30} y2={y(0) + 4} stroke="rgba(255,255,255,.12)" />
          <line x1={left + slot * 6 + asideGap / 2 + 6} x2={w - right} y1={y(0)} y2={y(0)} stroke={COL.axis} />
          {/* connectors */}
          {[ms, eco, gains, gains, net].map((lvl, i) => (
            <line key={"k" + i} x1={cx(i) + bw / 2 + 2} x2={cx(i + 1) - bw / 2 - 2} y1={y(lvl)} y2={y(lvl)} stroke="rgba(255,255,255,.3)" />
          ))}
          {/* bracket ① over ms + hms */}
          <g>
            <path d={`M${cx(0) - bw / 2},${y(eco) - 26} v-5 H${cx(1) + bw / 2} v5`} fill="none" stroke="rgba(255,255,255,.35)" />
            <text x={(cx(0) + cx(1)) / 2} y={y(eco) - 37} textAnchor="middle" fontSize={12} fill="#EDF0F7" fontWeight={600}>① Économies <tspan className="num" fontWeight={800}>{mdh(eco)}</tspan></text>
          </g>
          {cols.map((c, i) => {
            const x = cx(i) - bw / 2;
            const on = hover === i;
            if (c.aside) {
              const yTop = y(ca), yM = y(marge);
              return (
                <g key={c.k} opacity={hover === null || on ? 1 : 0.55}>
                  <path d={barPath(x, bw, y(0), yM)} fill={COL.marge} fillOpacity={0.3} />
                  <path d={barPath(x, bw, yM - 2, yTop)} fill="none" stroke="rgba(255,255,255,.35)" strokeDasharray="3 3" />
                  <text x={cx(i)} y={yTop - 8} textAnchor="middle" fontSize={13} fontWeight={700} fill="#C3CAD9" className="num">{c.label}</text>
                  {yM - yTop > 18 && <text x={cx(i)} y={(yM + yTop) / 2 + 3.5} textAnchor="middle" fontSize={10} fill={COL.mut} className="num">{mdh(v("ca_costs"))}</text>}
                  {y(0) - yM > 18 && <text x={cx(i)} y={(y(0) + yM) / 2 + 3.5} textAnchor="middle" fontSize={10} fill="#EDF0F7" className="num">{mdh(marge)}</text>}
                </g>
              );
            }
            const dir: 1 | -1 = c.to >= c.from ? 1 : -1;
            return (
              <g key={c.k} opacity={hover === null || on ? 1 : 0.55} style={{ transition: "opacity .2s" }}>
                <Stack x={x} w={bw} y={y} base={c.from} segs={c.segs} dir={dir} delay={0.1 + i * 0.12} />
                <text x={cx(i)} y={y(Math.max(c.from, c.to)) - (c.big ? 10 : 8)} textAnchor="middle" fontSize={c.big ? 22 : 13.5} fontWeight={800} fill={c.big ? "#fff" : "#EDF0F7"} className="num">{c.label}</text>
              </g>
            );
          })}
          {/* hit areas */}
          {cols.map((c, i) => <rect key={"h" + c.k} x={cx(i) - slot / 2} y={top - 30} width={slot} height={ih + 30 + bottom} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        </svg>
      )}
      {w > 0 && cols.map((c, i) => (
        <div key={"l" + c.k} className="pointer-events-none absolute text-center" style={{ left: cx(i) - slot / 2, width: slot, top: h - bottom + 8 }}>
          <div className={`text-[12px] font-semibold leading-[1.1] ${c.aside ? "text-[var(--txt-2)]" : "text-white"}`}>{c.name}</div>
          <div className="truncate px-1 text-[10.5px] leading-tight text-[var(--mut)]">{c.sub}</div>
        </div>
      ))}
      {w > 0 && <div className="pointer-events-none absolute text-center text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--mut)]" style={{ left: cx(6) - slot / 2, width: slot, top: 0 }}>pour mémoire</div>}
      {hover !== null && w > 0 && <Tooltip x={cx(hover)} y={Math.max(0, y(Math.max(cols[hover].from, cols[hover].to)) - 20)} w={w}>{cols[hover].tip}</Tooltip>}
    </div>
  );
}

/* ================================================================ gains above the axis, cost below, net value beside (per year) */
export type YearData = { y: Yr; up: Seg[]; down: Seg[]; net: number; extra?: ReactNode };
export function YearStack({ data, netLabel = "Valeur nette", compact = false }: { data: YearData[]; netLabel?: string; compact?: boolean }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const ups = data.map((d) => d.up.reduce((a, x) => a + x.v, 0)), downs = data.map((d) => d.down.reduce((a, x) => a + x.v, 0));
  const lo = Math.min(0, ...downs.map((x) => -x), ...data.map((d) => d.net)), hi = Math.max(...ups, ...data.map((d) => d.net), 1e-9);
  const sc = nice(lo, hi, 4);
  const top = 22, bottom = 26, left = 40, right = 4;
  const iw = Math.max(10, w - left - right), ih = Math.max(10, h - top - bottom);
  const y = (val: number) => top + ((sc.hi - val) / (sc.hi - sc.lo)) * ih;
  const gw = iw / data.length;
  const bw = Math.max(10, Math.min(compact ? 22 : 30, gw * 0.24));
  const gx = (i: number) => left + gw * (i + 0.5);
  const fs = compact ? 10.5 : 11.5;
  return (
    <div ref={ref} className="relative h-full w-full" onMouseLeave={() => setHover(null)}>
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="overflow-visible">
          <Grid ticks={sc.ticks} y={y} x0={left} x1={w - right} step={sc.step} />
          {data.map((d, i) => {
            const xa = gx(i) - bw - 2, xb = gx(i) + 2;
            const up = ups[i], dn = downs[i];
            const dim = hover !== null && hover !== i;
            return (
              <g key={d.y} opacity={dim ? 0.5 : 1} style={{ transition: "opacity .2s" }}>
                <Stack x={xa} w={bw} y={y} base={0} segs={d.up} dir={1} delay={0.05 + i * 0.08} />
                <Stack x={xa} w={bw} y={y} base={0} segs={d.down} dir={-1} delay={0.1 + i * 0.08} />
                <path d={barPath(xb, bw, y(0), y(d.net))} fill={COL.net} fillOpacity={0.9} className={d.net >= 0 ? "ag-grow" : "ag-grow-down"} style={{ animationDelay: `${0.2 + i * 0.08}s` }} />
                {up > 0 && <text x={xa + bw / 2} y={y(up) - 6} textAnchor="middle" fontSize={fs} fontWeight={700} fill="#EDF0F7" className="num">{mdh(up)}</text>}
                {dn > 0 && <text x={xa + bw / 2} y={y(-dn) + 13} textAnchor="middle" fontSize={fs} fontWeight={600} fill="#C3CAD9" className="num">{minus(dn)}</text>}
                <text x={xb + bw / 2} y={d.net >= 0 ? y(d.net) - 6 : y(d.net) + 13} textAnchor="middle" fontSize={fs} fontWeight={800} fill="#fff" className="num">{mdh(d.net)}</text>
                <text x={gx(i)} y={h - 6} textAnchor="middle" fontSize={12} fontWeight={700} fill="#EDF0F7" className="num">{d.y}</text>
                <rect x={gx(i) - gw / 2} y={top} width={gw} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip x={gx(hover)} y={8} w={w}>
          <div className="mb-1 text-[12.5px] font-semibold text-white">{data[hover].y}</div>
          {data[hover].up.map((sg) => <TipRow key={sg.label} color={sg.color} label={sg.label} value={mdh(sg.v)} />)}
          <TipRow label="Gains bruts" value={mdh(ups[hover])} strong />
          {data[hover].down.map((sg) => <TipRow key={sg.label} color={sg.color} label={sg.label} value={minus(sg.v)} />)}
          <TipRow color={COL.net} label={netLabel} value={mdh(data[hover].net)} strong />
          {data[hover].extra}
        </Tooltip>
      )}
    </div>
  );
}

/* ================================================================ a line over the years (cumul, ratio), with optional context bars */
export function LineChart({ series, color, bars, ref0, ref0Label, mark, fmt = mdh, label, barsLabel, height }: {
  series: Series; color: string; bars?: Series; ref0?: number; ref0Label?: string; mark?: { y: Yr; text: string } | null;
  fmt?: (x: number) => string; label: string; barsLabel?: string; height?: number;
}) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = Y5.map((y) => series[y] ?? 0), bv = bars ? Y5.map((y) => bars[y] ?? 0) : [];
  const lo = Math.min(0, ...pts, ...bv, ref0 ?? 0), hi = Math.max(...pts, ...bv, ref0 ?? 0, 1e-9);
  const sc = nice(lo, hi, 4);
  const top = 26, bottom = 24, left = 40, right = 14;
  const iw = Math.max(10, w - left - right), ih = Math.max(10, h - top - bottom);
  const y = (val: number) => top + ((sc.hi - val) / (sc.hi - sc.lo)) * ih;
  const gw = iw / Y5.length;
  const gx = (i: number) => left + gw * (i + 0.5);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${gx(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const markI = mark ? Y5.indexOf(mark.y) : -1;
  const labelled = new Set([0, pts.length - 1, markI].filter((i) => i >= 0));
  return (
    <div ref={ref} className="relative h-full w-full" style={height ? { height } : undefined} onMouseLeave={() => setHover(null)}>
      {w > 0 && h > 0 && (
        <svg width={w} height={h} className="overflow-visible" role="img" aria-label={`${label} : ${Y5.map((yy, i) => `${yy} ${fmt(pts[i])}`).join(", ")}`}>
          <Grid ticks={sc.ticks} y={y} x0={left} x1={w - right} step={sc.step} />
          {ref0 !== undefined && ref0 !== 0 && (
            <g>
              <line x1={left} x2={w - right} y1={y(ref0)} y2={y(ref0)} stroke="rgba(255,255,255,.32)" />
              {ref0Label && <text x={w - right} y={y(ref0) - 5} textAnchor="end" fontSize={10.5} fill={COL.mut}>{ref0Label}</text>}
            </g>
          )}
          {bars && bv.map((b, i) => {
            const bw = Math.min(22, gw * 0.3);
            return <path key={"b" + i} d={barPath(gx(i) - bw / 2, bw, y(0), y(b))} fill={COL.net} fillOpacity={0.16} className={b >= 0 ? "ag-grow" : "ag-grow-down"} style={{ animationDelay: `${0.05 + i * 0.06}s` }} />;
          })}
          {markI >= 0 && <line x1={gx(markI)} x2={gx(markI)} y1={top - 4} y2={y(sc.lo)} stroke="rgba(255,255,255,.18)" />}
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={gx(i)} cy={y(p)} r={i === markI || hover === i ? 6 : 4.5} fill={color} stroke="#0E1530" strokeWidth={2} />
              {labelled.has(i) && <text x={gx(i)} y={p >= (ref0 ?? 0) || i === markI ? y(p) - 10 : y(p) + 17} textAnchor={i === pts.length - 1 ? "end" : i === 0 ? "start" : "middle"} dx={i === pts.length - 1 ? 6 : i === 0 ? -6 : 0}
                fontSize={12} fontWeight={800} fill="#fff" className="num">{fmt(p)}</text>}
              <text x={gx(i)} y={h - 5} textAnchor="middle" fontSize={11.5} fontWeight={600} fill="#C3CAD9" className="num">{Y5[i]}</text>
              <rect x={gx(i) - gw / 2} y={top - 10} width={gw} height={ih + 10} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          ))}
          {mark && markI >= 0 && <text x={gx(markI) + 8} y={top + 2} fontSize={11} fontWeight={600} fill="#EDF0F7">{mark.text}</text>}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <Tooltip x={gx(hover)} y={Math.max(0, y(pts[hover]) - 70)} w={w}>
          <div className="mb-1 text-[12.5px] font-semibold text-white">{Y5[hover]}</div>
          {bars && <TipRow color={COL.net} label={barsLabel ?? "Valeur de l'année"} value={mdh(bv[hover])} />}
          <TipRow color={color} kind="line" label={label} value={fmt(pts[hover])} strong={!!bars} />
        </Tooltip>
      )}
    </div>
  );
}

/* ================================================================ small multiple: net value per year, shared scale */
export function MiniYears({ series, lo, hi, color = COL.net, onHoverYear }: { series: Series; lo: number; hi: number; color?: string; onHoverYear?: (y: Yr | null) => void }) {
  const [ref, { w, h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pts = Y5.map((yy) => series[yy] ?? 0);
  const top = 4, bottom = 14;
  const ih = Math.max(10, h - top - bottom);
  const y = (val: number) => top + ((hi - val) / (hi - lo || 1)) * ih;
  const gw = w / Y5.length, bw = Math.max(6, Math.min(16, gw * 0.5));
  const gx = (i: number) => gw * (i + 0.5);
  return (
    <div ref={ref} className="relative h-full w-full" onMouseLeave={() => { setHover(null); onHoverYear?.(null); }}>
      {w > 0 && h > 0 && (
        <svg width={w} height={h}>
          <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={COL.axis} />
          {pts.map((p, i) => (
            <g key={i}>
              <path d={barPath(gx(i) - bw / 2, bw, y(0), y(p), 3)} fill={color} fillOpacity={hover === null || hover === i ? 0.85 : 0.4} />
              <text x={gx(i)} y={h - 2} textAnchor="middle" fontSize={9} fill={COL.mut} className="num">{Y5[i].slice(2)}</text>
              <rect x={i * gw} y={0} width={gw} height={h} fill="transparent" onMouseEnter={() => { setHover(i); onHoverYear?.(Y5[i]); }} />
            </g>
          ))}
        </svg>
      )}
      {hover !== null && <div className="num pointer-events-none absolute -top-5 rounded bg-black/60 px-1 text-[10.5px] text-white" style={{ left: Math.max(0, Math.min(gx(hover) - 14, w - 40)) }}>{Y5[hover]} · {mdh(pts[hover])}</div>}
    </div>
  );
}

/* ================================================================ composition bar (cost left of the axis, gains right), shared scale */
export function SplitBar({ ms, hms, marge, cout, max, h = 10 }: { ms: number; hms: number; marge: number; cout: number; max: number; h?: number }) {
  const pc = (x: number) => `${(Math.max(0, x) / max) * 50}%`;
  const parts = [{ v: ms, c: COL.ms }, { v: hms, c: COL.hms }, { v: marge, c: COL.marge }].filter((p) => p.v > 1e-9);
  return (
    <div className="relative w-full" style={{ height: h }}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-white/25" />
      <div className="absolute inset-y-0 rounded-l-[3px]" style={{ right: "50%", width: pc(cout), background: COL.cout, marginRight: 1 }} />
      <div className="absolute inset-y-0 flex gap-[2px]" style={{ left: "50%", marginLeft: 1, width: pc(ms + hms + marge) }}>
        {parts.map((p, i) => <div key={i} className={i === parts.length - 1 ? "rounded-r-[3px]" : ""} style={{ flex: `${p.v} 0 0`, background: p.c, minWidth: 1 }} />)}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- programme series used by several tabs */
export function programmeYears(): YearData[] {
  return Y5.map((y) => ({
    y,
    up: [
      { v: FINROW.ms.values[y], color: COL.ms, label: "Masse salariale" },
      { v: FINROW.hms.values[y], color: COL.hms, label: "Hors masse salariale" },
      { v: FINROW.marge.values[y], color: COL.marge, label: "Marge sur CA additionnel" },
    ],
    down: [
      { v: FINROW.cout_cases.values[y], color: COL.cout, label: "Agents et plateformes des cas" },
      { v: FINROW.cout_transverse.values[y], color: COL.coutT, label: "Coûts transverses" },
      { v: FINROW.contingence.values[y], color: COL.coutC, label: "Contingence" },
    ],
    net: FINROW.net.values[y],
  }));
}
export const PROGRAMME_LEGEND = [
  { label: "Masse salariale", color: COL.ms }, { label: "Hors masse salariale", color: COL.hms }, { label: "Marge sur CA additionnel", color: COL.marge },
  { label: "Agents et plateformes", color: COL.cout }, { label: "Transverses", color: COL.coutT }, { label: "Contingence", color: COL.coutC },
  { label: "Valeur nette", color: COL.net },
];
