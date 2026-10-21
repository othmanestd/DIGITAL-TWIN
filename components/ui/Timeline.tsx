"use client";
// Timeline (explorer, bottom of the stage): one slim glass row — Groupe / Hôpital type toggle, a slider snapping to the dataset's
// years (v13: 2026 → 2029; v23: 2026 → 2031), and the year's value, cost, net and cumulative values (count-up).
// It never enters the bottom-left AI dock zone (x < 392 px) nor the right edge of the stage (zoom slider).
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { YEARS, CASES, agg, yearTotals, etabIn, V23, type Year } from "@/lib/model";
import { Num, Segmented, Tip } from "./kit";
import { money } from "@/lib/ui/fmt";
import s from "./styles";

const ALL = CASES.map((c) => c.id);
const SUB: Record<Year, string> = V23
  ? { 2026: "Aujourd'hui", 2027: "Vagues V1 et V2 : construction", 2028: "Vagues V3 et V4 lancées", 2029: "Montée en charge", 2030: "Presque tous les cas au plein effet", 2031: "Horizon du business case" }
  : { 2026: "Aujourd'hui", 2027: "Vagues V1 à V3", 2028: "Généralisation", 2029: "Plein régime", 2030: "", 2031: "" };
const DOCK = 392, RIGHT_FREE = 88, MAX_W = 760;

function useYearValues(year: Year, perSite: boolean) {
  return useMemo(() => {
    if (!perSite) { const t = yearTotals(year); return { eco: t.eco, cout: t.cout, net: t.net, cumul: t.cumul }; }
    const a = agg(ALL, year, true);
    let cumul = 0;
    for (const y of YEARS) { if (y > year) break; cumul += agg(ALL, y, true).net; }
    return { eco: a.mdh, cout: a.cout, net: a.net, cumul };
  }, [year, perSite]);
}

export default function Timeline() {
  const year = useApp((st) => st.year);
  const setYear = useApp((st) => st.setYear);
  const perSite = useApp((st) => st.perSite);
  const setPerSite = useApp((st) => st.setPerSite);
  const track = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState(false);
  // six years (v23) on a narrow slider: short labels ('27 … '31) so they never collide
  const [tw, setTw] = useState(0);
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setTw(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const short = tw > 0 && tw / (YEARS.length - 1) < 46;
  const v = useYearValues(year, perSite);
  const i = YEARS.indexOf(year);
  const pos = (k: number) => `${(k / (YEARS.length - 1)) * 100}%`;

  const pick = (clientX: number) => {
    const r = track.current?.getBoundingClientRect(); if (!r) return;
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const y = YEARS[Math.round(t * (YEARS.length - 1))];
    if (y !== useApp.getState().year) setYear(y);
  };

  const sites = etabIn(year);
  const vals = V23
    ? [
        { k: "eco", label: "Gains bruts", v: v.eco, color: "var(--green)", tip: "Économies réalisées (masse salariale et hors masse salariale : achats, énergie, maintenance…) plus la marge sur le CA additionnel, sur l'année.", cls: "hidden @[400px]:block" },
        { k: "cout", label: perSite ? "Coût des agents" : "Coût programme", v: v.cout, color: "var(--txt-2)", tip: perSite ? "Coût des agents et des plateformes rattachés aux cas, sur l'année (les coûts transverses ne se répartissent pas par établissement)." : "Coût du programme sur l'année : agents et plateformes, coûts transverses (infrastructure, connecteurs, PMO, changement) et contingence.", cls: "hidden @[620px]:block" },
        { k: "net", label: "Valeur nette", v: v.net, color: "#fff", tip: "Gains bruts moins coût, sur l'année.", cls: "" },
        { k: "cumul", label: "Cumul net", v: v.cumul, color: "#9FB3FF", tip: "Somme des valeurs nettes depuis 2027.", cls: "hidden @[700px]:block" },
      ]
    : [
        { k: "eco", label: "Économie", v: v.eco, color: "var(--green)", tip: "Masse salariale économisée sur l'année.", cls: "hidden @[400px]:block" },
        { k: "cout", label: "Coût agents", v: v.cout, color: "var(--txt-2)", tip: "Coût de fonctionnement des agents IA sur l'année : licences, calcul, supervision.", cls: "hidden @[620px]:block" },
        { k: "net", label: "Gain net", v: v.net, color: "#fff", tip: "Économie moins coût des agents, sur l'année.", cls: "" },
        { k: "cumul", label: "Cumul net", v: v.cumul, color: "#9FB3FF", tip: "Somme des gains nets depuis 2027.", cls: "hidden @[700px]:block" },
      ];
  const width = `min(${MAX_W}px, calc(100% - ${DOCK + RIGHT_FREE}px))`;

  return (
    <div className="pointer-events-none absolute bottom-4 z-20" style={{ width, left: `max(${DOCK}px, calc((100% - ${width}) / 2))` }}>
      <div className={`${s.lg} pointer-events-auto w-full !rounded-[20px] @container`} data-anchor="timeline">
        <span className={s.lgDark} /><span className={s.lgRim} />
        <div className="flex h-[66px] items-center gap-[clamp(10px,1.2vw,18px)] pl-2.5 pr-4">
          {/* toggle */}
          <div className="hidden shrink-0 flex-col items-start gap-0.5 @[460px]:flex">
            <Segmented<"g" | "s"> size="sm" layoutId="atlas-persite-thumb" value={perSite ? "s" : "g"} onChange={(x) => setPerSite(x === "s")} className="!h-7 [&>button]:!h-[22px] [&>button]:!px-2 [&>button]:!text-[11px]"
              options={[{ id: "g", label: "Groupe", title: "Tout le groupe Akdital" }, { id: "s", label: "Hôpital type", title: `Moyenne des ${sites} établissements (groupe ÷ ${sites}, hors siège)` }]} anchorPrefix="persite:" />
            <Tip content={`Hôpital type : moyenne des ${sites} établissements${V23 ? ` du groupe en ${year}` : ""} (groupe ÷ ${sites}). Les cas du siège ne sont pas répartis par établissement.`}>
              <span className="cursor-help pl-1 text-[9.5px] text-[var(--mut)]">{perSite ? `moyenne des ${sites} établissements` : "tout le groupe"}</span>
            </Tip>
          </div>

          {/* slider */}
          <div className="min-w-[150px] flex-1 px-2">
            <div
              ref={track} role="slider" tabIndex={0} aria-label="Année" aria-valuemin={YEARS[0]} aria-valuemax={YEARS[YEARS.length - 1]} aria-valuenow={year}
              className="relative h-5 cursor-pointer touch-none select-none outline-none"
              onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); setDrag(true); pick(e.clientX); }}
              onPointerMove={(e) => { if (drag) pick(e.clientX); }}
              onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight") setYear(YEARS[Math.min(YEARS.length - 1, i + 1)]);
                if (e.key === "ArrowLeft") setYear(YEARS[Math.max(0, i - 1)]);
              }}
            >
              <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-white/[0.12]" />
              <motion.div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ background: "linear-gradient(90deg, rgba(76,199,154,.45), var(--green))" }}
                initial={false} animate={{ width: pos(i) }} transition={{ type: "spring", stiffness: 300, damping: 32 }} />
              {YEARS.map((y, k) => (
                <span key={y} data-anchor={`year:${y}`} className="absolute top-1/2 h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors"
                  style={{ left: pos(k), background: k <= i ? "var(--green)" : "rgba(255,255,255,.28)" }} />
              ))}
              <motion.div className="pointer-events-none absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "radial-gradient(circle at 35% 30%, #fff, #DDE4F5 60%, #B8C3DE)", boxShadow: "0 0 0 3px rgba(76,199,154,.25), 0 4px 12px -3px rgba(0,0,0,.6)" }}
                initial={false} animate={{ left: pos(i), scale: drag ? 1.15 : 1 }} transition={{ type: "spring", stiffness: 420, damping: 30 }} />
            </div>
            <div className="relative mt-[3px] h-[14px]">
              {YEARS.map((y, k) => (
                <Tip key={y} content={SUB[y] || String(y)} side="top" className="absolute top-0" style={{ left: pos(k), transform: `translateX(${k === 0 ? "-12%" : k === YEARS.length - 1 ? "-88%" : "-50%"})` }}>
                  <button type="button" onClick={() => setYear(y)} className={`num block whitespace-nowrap text-[11px] leading-none ${y === year ? "text-white" : "text-[var(--mut)] hover:text-[var(--txt-2)]"}`}>
                    {y === 2026 ? "Auj." : short ? `’${String(y).slice(2)}` : y}
                  </button>
                </Tip>
              ))}
            </div>
          </div>

          {/* values */}
          <div className="flex shrink-0 items-center gap-[clamp(10px,1.1vw,18px)] border-l border-white/[0.09] pl-[clamp(10px,1.1vw,18px)]">
            {vals.map((x) => {
              const m = money(x.v);
              return (
                <Tip key={x.k} className={x.cls} content={<><b className="text-[var(--txt)]">{x.label}</b> — {x.tip} En {m.unit} ({m.unit === "MDH" ? "millions" : "milliers"} de dirhams){perSite ? ", moyenne par établissement" : ""}.</>}>
                  <div className="cursor-default whitespace-nowrap">
                    <div className="text-[9px] font-semibold uppercase leading-none tracking-[0.09em] text-[var(--mut)]">{x.label}</div>
                    <div className="mt-[5px] flex items-baseline gap-[3px] leading-none">
                      <Num value={m.v} d={m.unit === "MDH" ? (perSite ? 1 : 0) : 0} className="text-[clamp(16px,1.15vw,20px)] font-[800]" style={{ color: x.color }} />
                      <span className="text-[9.5px] font-semibold text-[var(--mut)]">{m.unit}</span>
                    </div>
                  </div>
                </Tip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
