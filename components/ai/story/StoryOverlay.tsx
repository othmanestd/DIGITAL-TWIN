"use client";
// The DOM layer of the guided visit's story (lib/ai/story.ts): cinematic letterbox and fade, the title card, the
// "Mardi · 7 h 30 · 2026" stamp, the characters' name chips (anchored to the 3D cast), the value ledger that builds
// the bridge ① + ② − ③ = net live (count-ups in sync with the voice, luminous threads flowing from the scene into its
// rows), and the finale (the bridge in one line, the five years, cumul, NPV). Figures: the `ledger` block of the
// v2.3 tour JSON, computed by scripts/build-tour-v23.mjs from lib/data/v23. Calm palette, no neon.
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useStory, type LedgerKey, type CastId } from "@/lib/ai/story";
import { locate } from "@/lib/anchors";
import { LOOKS } from "@/components/scenes/story/cast";
import tour23 from "@/lib/ai/tour-v23-complete.json";
import { STORY_CSS } from "./css";

type LedgerData = {
  final: { ms: number; hms: number; rec: number; neu: number; caR: number; caN: number; eco: number; marge: number; gains: number; cout: number; net: number };
  series: Record<string, { net: number; cumul: number }>; cumul: number; van: number; ratio: number; etp: number; etab: { from: number; to: number };
};
const L = (tour23 as unknown as { ledger: LedgerData }).ledger;

const NB = " ";
/** French number, rounded half up (153,45 → 153,5: the sums of the ledger must read like the narration). */
const fr = (x: number, d = 1) => { const k = 10 ** d, v = Math.round(Math.abs(x) * k + 1e-6) / k; const s = v.toFixed(d).split("."); s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, NB); return (x < -0.04 ? "−" : "") + s.join(","); };
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const LINE: Record<LedgerKey, { label: string; sub: string; color: string }> = {
  ms: { label: "Masse salariale", sub: "temps rendu, postes non remplacés", color: "#4CC79A" },
  hms: { label: "Énergie, maintenance, achats…", sub: "autres dépenses évitées", color: "#7C93FF" },
  rec: { label: "Soins récupérés", sub: `marge 95 % sur ${fr(L.final.caR)} de CA`, color: "#CDAA62" },
  neu: { label: "Activité nouvelle", sub: `marge 40 % sur ${fr(L.final.caN)} de CA`, color: "#E6CF97" },
};
const COST = "#E07A6F";

// ---------------------------------------------------------------- count-ups (targets from the store)
function useCounts() {
  const ledger = useStory((s) => s.ledger);
  const snap = useStory((s) => s.snap);
  const shown = useRef<Record<LedgerKey, number>>({ ms: 0, hms: 0, rec: 0, neu: 0 });
  const anim = useRef<{ from: Record<LedgerKey, number>; to: Record<LedgerKey, number>; t0: number } | null>(null);
  const [, force] = useState(0);
  const lastSnap = useRef(snap);
  useEffect(() => {
    if (snap !== lastSnap.current) { lastSnap.current = snap; shown.current = { ...ledger }; anim.current = null; force((x) => x + 1); return; }
    // the thread takes ~1.3 s to reach the row: the count-up starts as it arrives
    anim.current = { from: { ...shown.current }, to: { ...ledger }, t0: performance.now() + 900 };
    let raf = 0;
    const tick = () => {
      const a = anim.current;
      if (!a) return;
      const k = Math.min(1, Math.max(0, (performance.now() - a.t0) / 2200));
      const e = ease(k);
      for (const key of Object.keys(a.to) as LedgerKey[]) shown.current[key] = a.from[key] + (a.to[key] - a.from[key]) * e;
      force((x) => x + 1);
      if (k < 1) raf = requestAnimationFrame(tick); else anim.current = null;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ledger, snap]);
  return shown.current;
}

/** A number that eases to its value when it appears (cost, net). */
function Roll({ value, on, d = 1 }: { value: number; on: boolean; d?: number }) {
  const [v, setV] = useState(on ? value : 0);
  useEffect(() => {
    if (!on) { setV(0); return; }
    const t0 = performance.now() + 500;
    let raf = 0;
    const tick = () => { const k = Math.min(1, Math.max(0, (performance.now() - t0) / 1900)); setV(value * ease(k)); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on, value]);
  return <>{fr(v, d)}</>;
}

// ---------------------------------------------------------------- the ledger (side HUD)
function Ledger() {
  const hud = useStory((s) => s.hud);
  const finale = useStory((s) => s.finale);
  const cost = useStory((s) => s.cost);
  const net = useStory((s) => s.net);
  const focus = useStory((s) => s.focus);
  const focusT = useStory((s) => s.focusT);
  const pulses = useStory((s) => s.pulses);
  const v = useCounts();
  const eco = v.ms + v.hms, marge = v.rec + v.neu, gains = eco + marge;
  const hot = (k: string) => {
    const recent = pulses.some((p) => (p.lines as string[]).includes(k) && performance.now() - p.t < 4200);
    const f = focus === k && performance.now() - focusT < 6000;
    return recent || f;
  };
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((x) => x + 1), 500); return () => clearInterval(id); }, []);
  const rows = (["ms", "hms"] as LedgerKey[]);
  const rows2 = (["rec", "neu"] as LedgerKey[]);
  const Row = ({ k }: { k: LedgerKey }) => (
    <div className="st-row" data-hot={hot(k)} data-ledger-row={k}>
      <i style={{ background: LINE[k].color }} />
      <span className="l"><b>{LINE[k].label}</b><small>{LINE[k].sub}</small></span>
      <span className="v" style={{ color: v[k] > 0.05 ? LINE[k].color : undefined }}>{fr(v[k])}</span>
      <span className="bar"><em style={{ width: `${Math.min(100, (v[k] / Math.max(0.01, L.final[k])) * 100)}%`, background: LINE[k].color }} /></span>
    </div>
  );
  return (
    <AnimatePresence>
      {hud && !finale && (
        <motion.aside className="st-ledger glass-read" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} aria-label="Le compte de la valeur">
          <header><span className="eyebrow">Le compte · 2031</span><span className="u">MDH par an</span></header>
          <div className="st-group" data-hot={hot("eco")}><span>① Économies</span><b>{fr(eco)}</b></div>
          {rows.map((k) => <Row key={k} k={k} />)}
          <div className="st-group" data-hot={hot("marge")}><span>② Marge sur CA additionnel</span><b>{fr(marge)}</b></div>
          {rows2.map((k) => <Row key={k} k={k} />)}
          <div className="st-total" data-hot={hot("gains")}><span>Gains bruts <small>① + ②</small></span><b>{fr(gains)}</b></div>
          <AnimatePresence>
            {cost && (
              <motion.div key="c" className="st-cost" data-ledger-row="cost" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.5 }}>
                <span>③ Coût du programme <small>agents, plateformes, transverses, contingence</small></span><b style={{ color: COST }}>−<Roll value={L.final.cout} on={cost} /></b>
              </motion.div>
            )}
            {net && (
              <motion.div key="n" className="st-net" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} transition={{ duration: 0.6 }}>
                <span>Valeur nette <small>① + ② − ③</small></span><b><Roll value={L.final.net} on={net} /></b>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- threads: from the scene into the ledger rows
function Threads() {
  const pulses = useStory((s) => s.pulses);
  const svg = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = svg.current;
      if (el) {
        const now = performance.now();
        el.querySelectorAll<SVGGElement>("g[data-p]").forEach((g) => {
          const t0 = Number(g.dataset.t), from = g.dataset.from!, row = g.dataset.row!, delay = Number(g.dataset.delay);
          const age = (now - t0) / 1000 - delay;
          const src = from === "stage" ? null : locate(from.startsWith("spot:") ? from : "story:" + from);
          const target = document.querySelector<HTMLElement>(`[data-ledger-row="${row}"]`);
          if (!target || age < 0 || age > 2.6) { g.style.opacity = "0"; return; }
          const r = target.getBoundingClientRect();
          const a = src ?? { x: window.innerWidth * 0.45, y: window.innerHeight * 0.5 };
          const b = { x: r.left + 6, y: r.top + r.height / 2 };
          const c1 = { x: a.x + (b.x - a.x) * 0.35, y: Math.min(a.y, b.y) - 140 };
          const c2 = { x: b.x - 120, y: b.y };
          const d = `M${a.x},${a.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${b.x},${b.y}`;
          const path = g.querySelector<SVGPathElement>("path.t")!, glow = g.querySelector<SVGPathElement>("path.g")!, dot = g.querySelector<SVGCircleElement>("circle")!;
          path.setAttribute("d", d); glow.setAttribute("d", d);
          const len = path.getTotalLength();
          const k = ease(Math.min(1, age / 1.3));
          const head = len * k, tail = Math.max(0, head - len * 0.45);
          for (const p of [path, glow]) { p.style.strokeDasharray = `${head - tail} ${len}`; p.style.strokeDashoffset = `${-tail}`; }
          const pt = path.getPointAtLength(head);
          dot.setAttribute("cx", String(pt.x)); dot.setAttribute("cy", String(pt.y));
          g.style.opacity = String(Math.min(1, age / 0.25) * (1 - Math.max(0, (age - 1.6) / 1.0)));
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const items = pulses.flatMap((p) => (p.lines as string[]).map((row, i) => ({ key: `${p.id}-${row}`, p, row, delay: i * 0.18 })));
  return (
    <svg ref={svg} className="st-threads" aria-hidden>
      <defs><filter id="st-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter></defs>
      {items.map(({ key, p, row, delay }) => {
        const col = row === "cost" ? COST : LINE[row as LedgerKey]?.color ?? "#fff";
        return (
          <g key={key} data-p data-t={p.t} data-from={p.from} data-row={row} data-delay={delay} style={{ opacity: 0 }}>
            <path className="g" fill="none" stroke={col} strokeWidth={7} strokeLinecap="round" opacity={0.28} filter="url(#st-blur)" />
            <path className="t" fill="none" stroke={col} strokeWidth={1.6} strokeLinecap="round" opacity={0.9} />
            <circle r={3.6} fill="#fff" stroke={col} strokeWidth={2} />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------- name chips (anchored to the 3D cast)
function Chips() {
  const chips = useStory((s) => s.chips);
  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  const list = useMemo(() => {
    const seen = new Map<CastId, (typeof chips)[number]>();
    for (const c of chips) seen.set(c.id, c);
    return [...seen.values()];
  }, [chips]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      for (const c of list) {
        const el = refs.current[c.id];
        if (!el) continue;
        const p = locate("story:" + c.id);
        const life = c.intro ? 6.5 : 4.6;
        const age = (now - c.t) / 1000;
        const op = p ? Math.min(1, age / 0.45) * (1 - Math.max(0, (age - life + 1.1) / 1.1)) : 0;
        el.style.opacity = String(Math.max(0, op));
        if (p) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%) translateY(${(1 - Math.min(1, age / 0.6)) * 8}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [list]);
  return (
    <>
      {list.map((c) => {
        const look = LOOKS[c.id];
        return (
          <div key={c.id + c.t} ref={(r) => { refs.current[c.id] = r; }} className="st-chip" data-intro={c.intro} style={{ opacity: 0 }}>
            <i style={{ background: look.accent, boxShadow: `0 0 12px ${look.accent}` }} />
            <span><b>{look.name}</b><small>{look.role}</small>{c.intro && <em>{look.line}</em>}</span>
          </div>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------- the stamp: "Mardi · 7 h 30" + the year
function Stamp() {
  const stamp = useStory((s) => s.stamp);
  return (
    <AnimatePresence>
      {stamp && (
        <motion.div className="st-stamp" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
          <AnimatePresence mode="popLayout"><motion.span key={stamp.t} className="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>{stamp.t}</motion.span></AnimatePresence>
          <span className="y">
            <AnimatePresence mode="popLayout">
              <motion.b key={stamp.year} initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -18, filter: "blur(6px)" }} transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}>{stamp.year}</motion.b>
            </AnimatePresence>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- the finale: the bridge in one line, five years
function Finale() {
  const finale = useStory((s) => s.finale);
  const chart = useStory((s) => s.chart);
  const years = ["2027", "2028", "2029", "2030", "2031"];
  const upto = chart === "cumul" ? 2031 : typeof chart === "number" ? chart : 2026;
  const max = Math.max(...years.map((y) => Math.abs(L.series[y].net)), L.cumul / 2.6);
  const H = 150, Z = 46; // chart height, zero line from the bottom (room for the 2027 investment below it)
  const sx = (i: number) => 26 + i * 78;
  const sy = (v: number) => H - Z - (v / max) * (H - Z - 6);
  const cumMax = L.cumul;
  const cy = (v: number) => H - Z - (v / cumMax) * (H - Z - 12);
  const cumPts = years.filter((y) => Number(y) <= upto).map((y, i) => `${sx(i) + 18},${cy(L.series[y].cumul)}`).join(" ");
  const B = [
    { k: "① Économies", v: L.final.eco, c: "#4CC79A" }, { op: "+" },
    { k: "② Marge sur CA", v: L.final.marge, c: "#CDAA62" }, { op: "=" },
    { k: "Gains bruts", v: L.final.gains, c: "#EDF0F7" }, { op: "−" },
    { k: "③ Coût du programme", v: L.final.cout, c: COST }, { op: "=" },
    { k: "Valeur nette", v: L.final.net, c: "#FFFFFF", big: true },
  ] as ({ k: string; v: number; c: string; big?: boolean } | { op: string })[];
  return (
    <AnimatePresence>
      {finale && (
        <motion.section className="st-finale glass-read" initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} aria-label="La valeur nette">
          <div className="eyebrow">2031 · MDH par an · scénario central</div>
          <div className="st-bridge">
            {B.map((x, i) => ("op" in x ? <span key={i} className="op">{x.op}</span> : (
              <div key={i} className="cell" data-big={!!x.big}><b style={{ color: x.c }}>{fr(x.v)}</b><small>{x.k}</small></div>
            )))}
          </div>
          <div className="st-chart">
            <svg viewBox={`0 0 ${26 + 5 * 78 + 70} ${H}`} width="100%" height={H} aria-hidden>
              <line x1="10" x2={26 + 5 * 78 - 6} y1={H - Z} y2={H - Z} stroke="rgba(255,255,255,.18)" />
              {years.map((y, i) => {
                const v = L.series[y].net, on = Number(y) <= upto;
                const top = Math.min(sy(v), H - Z), h = Math.abs(sy(v) - (H - Z));
                return (
                  <g key={y} style={{ opacity: on ? 1 : 0.12, transition: "opacity .8s" }}>
                    <rect x={sx(i)} y={top} width="36" height={Math.max(1, h)} rx="4" fill={v < 0 ? COST : "#4CC79A"} opacity={v < 0 ? 0.75 : 0.85} />
                    <text x={sx(i) + 18} y={v < 0 ? top + h + 13 : top - 6} textAnchor="middle" className="n">{fr(v, 0)}</text>
                    <text x={sx(i) + 18} y={H - 3} textAnchor="middle" className="yl">{y}</text>
                  </g>
                );
              })}
              {upto >= 2028 && <polyline points={cumPts} fill="none" stroke="#E6CF97" strokeWidth="1.6" strokeDasharray="4 4" opacity="0.9" />}
              {upto >= 2031 && <text x={sx(4) + 44} y={cy(L.series["2031"].cumul) + 4} textAnchor="start" className="n" style={{ fill: "#E6CF97" }}>cumul {fr(L.series["2031"].cumul, 0)}</text>}
            </svg>
            <div className="legend"><span><i style={{ background: "#4CC79A" }} />valeur nette de l'année</span><span><i className="dash" />cumul (positif dès 2028)</span></div>
          </div>
          <div className="st-kpis" data-on={chart === "cumul"}>
            <div><b>{fr(L.cumul)}</b><small>MDH cumulés 2027-2031</small></div>
            <div><b>{fr(L.van)}</b><small>VAN à 10 %</small></div>
            <div><b>{fr(L.ratio, 2)}</b><small>dirhams de gains pour 1 dirham de coût</small></div>
            <div><b>≈ {fr(Math.round(L.etp / 10) * 10, 0)}</b><small>ETP-éq. libérés · zéro licenciement</small></div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------- letterbox, fade, title card, closing
function Cinema() {
  const letterbox = useStory((s) => s.letterbox);
  const title = useStory((s) => s.title);
  const fade = useStory((s) => s.fade);
  const closing = useStory((s) => s.closing);
  return (
    <>
      <div className="st-fade" style={{ opacity: fade, transition: `opacity ${fade > 0.5 ? 0.25 : 2.4}s ease` }} />
      <div className="st-bar top" data-on={letterbox}>
        <AnimatePresence>{closing && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1.2, delay: 0.6 }}>Valeur nette 2031 : {fr(L.final.net)} MDH par an · {fr(L.cumul)} MDH cumulés 2027-2031 · zéro licenciement</motion.span>}</AnimatePresence>
      </div>
      <div className="st-bar bottom" data-on={letterbox} />
      <AnimatePresence>
        {title && (
          <motion.div className="st-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, filter: "blur(6px)" }} transition={{ duration: 1.4, ease: [0.2, 0.8, 0.2, 1] }}>
            <motion.div className="eyebrow" initial={{ letterSpacing: "0.5em", opacity: 0 }} animate={{ letterSpacing: "0.32em", opacity: 1 }} transition={{ duration: 2.4, delay: 0.3 }}>Visite guidée · chiffres actualisés</motion.div>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.6, delay: 0.9 }}>Le même mardi</motion.h1>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, delay: 1.9 }}>Akdital augmenté · 2026 <span>→</span> 2031</motion.p>
            <motion.small initial={{ opacity: 0 }} animate={{ opacity: 0.75 }} transition={{ duration: 1.4, delay: 3.0 }}>Personnages fictifs · chiffres du business case v2.3, scénario central</motion.small>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function StoryOverlay() {
  const on = useStory((s) => s.on);
  const lb = useStory((s) => s.letterbox);
  const title = useStory((s) => s.title);
  // the hospital's floor and department labels (Overlay.tsx) stay hidden under the title card and the opening
  useEffect(() => {
    const b = document.body;
    if (on && (title || lb)) b.dataset.storyCinema = "1"; else delete b.dataset.storyCinema;
    return () => { delete b.dataset.storyCinema; };
  }, [on, title, lb]);
  if (!on) return null;
  return (
    <div className="st-root" data-lb={lb}>
      <style>{STORY_CSS}</style>
      <Cinema />
      <Stamp />
      <Chips />
      <Threads />
      <Ledger />
      <Finale />
    </div>
  );
}
