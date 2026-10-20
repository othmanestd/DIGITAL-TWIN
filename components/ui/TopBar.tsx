"use client";
// Top bar: Mibtech × JABB × AKDITAL, live KPI ticker for the selected year, liquid-glass search (centre), section menu (right).
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp, type Section } from "@/lib/store";
import { yearTotals, YEAR_LABEL } from "@/lib/model";
import { Num, Segmented, Tip, GlassDefs } from "./kit";
import { I } from "./icons";
import AkditalLogo from "./AkditalLogo";
import { useViewport } from "@/lib/ui/hooks";
import Search, { SECTIONS } from "./Search";
import s from "./styles";

if (typeof window !== "undefined") (window as unknown as { __atlas: typeof useApp }).__atlas = useApp;

export function JabbMark({ size = 18, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 196 291" height={size} width={(size * 196) / 291} fill={color} aria-hidden>
      <path d="M151.5,193.8c0,18.4-3.8,33-11.5,43.9c-7.6,10.9-21.6,16.4-41.8,16.4c-10.9,0-19.9-1.6-26.9-4.9s-12.5-7.9-16.4-13.8c-3.9-5.9-6.6-12.9-8.2-21c-1.6-8.1-2.3-17-2.3-26.6v-14H0v20.6c0,31.8,8.4,55.9,25.2,72.2c16.8,16.4,40.8,24.5,72,24.5c18.7,0,34.4-2.6,47-7.7c12.6-5.1,22.7-12,30.4-20.6c7.6-8.6,13.1-18.3,16.4-29.2c3.3-10.9,4.9-22,4.9-33.2v-27.1h-44.4V193.8z" />
      <polygon points="151.5,27 151.5,149.3 195.9,149.3 195.9,0" />
      <circle cx="32.7" cy="52" r="25" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3.5 text-white" aria-label="JABB × Akdital × Mibtech">
      <span className="flex items-end gap-[2px] leading-none">
        <JabbMark size={compact ? 16 : 18} />
        <span className={`font-[800] italic leading-[0.8] tracking-[-0.02em] ${compact ? "text-[15px]" : "text-[17px]"}`}>ABB</span>
      </span>
      <span className="text-[13px] font-light text-white/35">×</span>
      <AkditalLogo size={compact ? 17 : 19} />
      <span className="text-[13px] font-light text-white/35">×</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mibtech-reverse.svg" alt="Mibtech" className={compact ? "h-[12px] w-auto" : "h-[14px] w-auto"} />
    </div>
  );
}

function Ticker({ mode }: { mode: "full" | "compact" }) {
  const year = useApp((st) => st.year);
  const t = yearTotals(year);
  const all = [
    { v: t.eco, label: "économisés", tip: "Masse salariale économisée sur l'année, en MDH (millions de dirhams).", color: "var(--green)" },
    { v: t.cout, label: "d'agents", tip: "Coût de fonctionnement des agents IA sur l'année (licences, calcul, supervision), en MDH (millions de dirhams).", color: "var(--txt-2)" },
    { v: t.net, label: "nets", tip: "Gain net : économie moins coût des agents, en MDH (millions de dirhams).", color: "#fff" },
  ];
  const items = mode === "full" ? all : [all[2]];
  return (
    <div className="flex shrink-0 items-center gap-2.5" data-anchor="ticker">
      <Tip content={`Valeurs de l'année ${YEAR_LABEL[year].toLowerCase()}, en MDH (millions de dirhams). Faites glisser la frise en bas pour changer d'année.`} side="bottom">
        <span className="rounded-full bg-white/[0.07] px-2 py-[3px] text-[10.5px] font-semibold tabular-nums text-[var(--txt-2)] ring-1 ring-white/[0.07]">{year === 2026 ? "Auj." : year}</span>
      </Tip>
      {items.map((it, i) => (
        <Tip key={i} content={it.tip} side="bottom">
          <span className="flex cursor-default items-baseline gap-[3px] whitespace-nowrap">
            <Num value={it.v} d={0} className="text-[15px] font-[800]" style={{ color: it.color }} />
            {(i === 0 || mode === "compact") && <span className="text-[10.5px] font-semibold text-[var(--mut)]">MDH</span>}
            <span className="text-[11px] text-[var(--mut)]">{it.label}</span>
          </span>
        </Tip>
      ))}
    </div>
  );
}

function SectionDropdown({ section, setSection }: { section: Section; setSection: (s: Section) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener("pointerdown", f);
    return () => window.removeEventListener("pointerdown", f);
  }, [open]);
  const cur = SECTIONS.find((x) => x.id === section) ?? SECTIONS[0];
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} data-anchor="section:menu" aria-expanded={open}
        className={`${s.lg} flex h-10 items-center gap-2 pl-4 pr-3 text-[13px] font-semibold text-white`}>
        <span className={s.lgDark} /><span className={s.lgRim} />
        <I.grid size={15} className="text-[var(--txt-2)]" />{cur.label}<I.chevronDown size={14} className={`text-[var(--mut)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className={`${s.menu} absolute right-0 top-12 w-[300px] rounded-[18px] p-1.5`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
            {SECTIONS.map((x) => (
              <button key={x.id} type="button" data-anchor={`section:${x.id}`} onClick={() => { setSection(x.id); setOpen(false); }}
                className={`flex w-full flex-col rounded-[12px] px-3 py-2 text-left transition-colors ${x.id === section ? "bg-white/[0.1]" : "hover:bg-white/[0.06]"}`}>
                <span className="text-[13px] font-semibold text-white">{x.label}</span>
                <span className="text-[11.5px] text-[var(--mut)]">{x.hint}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TopBar() {
  const section = useApp((st) => st.section);
  const setSection = useApp((st) => st.setSection);
  const searchOpen = useApp((st) => st.searchOpen);
  const { w: vw } = useViewport();
  const width = Math.round(Math.max(304, Math.min(400, vw * 0.2)));
  const wide = Math.round(Math.max(400, Math.min(660, vw * 0.36)));
  const compactBrand = vw < 1500;
  const dropdown = vw < 1720;
  const fullLabels = vw >= 2100;
  // room left of the centred search: half the free width, minus the brand
  const side = (vw - 40 - 40 - width) / 2;
  const brandW = compactBrand ? 290 : 335;
  const tickerMode: "full" | "compact" | null = side - brandW - 40 >= 320 ? "full" : side - brandW - 40 >= 150 ? "compact" : null;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 h-16">
      <GlassDefs />
      <div className="absolute inset-0 border-b border-white/[0.06]" style={{ background: "linear-gradient(180deg, rgba(8,12,27,.86) 0%, rgba(8,12,27,.74) 100%)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)" }} />
      <div className="relative grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-5 px-5">
        <div className={`pointer-events-auto flex min-w-0 items-center gap-5 overflow-hidden transition-opacity duration-300 ${searchOpen ? "opacity-30" : ""}`}>
          <button type="button" className="shrink-0" onClick={() => useApp.getState().home()} title="Retour à l'hôpital type" data-anchor="home"><Brand compact={compactBrand} /></button>
          {tickerMode && <span className="h-6 w-px shrink-0 bg-white/10" />}
          {tickerMode && <Ticker mode={tickerMode} />}
        </div>
        <div className="pointer-events-auto relative z-10 flex justify-center">
          <Search width={width} wide={wide} />
        </div>
        <nav className={`pointer-events-auto flex min-w-0 justify-end transition-opacity duration-300 ${searchOpen ? "opacity-30" : ""}`} aria-label="Rubriques">
          {dropdown ? <SectionDropdown section={section} setSection={setSection} /> : (
            <div className={`${s.lg} p-[3px]`}>
              <span className={s.lgDark} /><span className={s.lgRim} />
              <Segmented<Section>
                value={section} onChange={setSection} layoutId="atlas-section-thumb" anchorPrefix="section:" size={vw < 1700 ? "sm" : "md"}
                className="!bg-transparent !ring-0 !p-0"
                options={SECTIONS.map((x) => ({ id: x.id, label: fullLabels ? x.label : x.short, title: x.hint }))}
              />
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
