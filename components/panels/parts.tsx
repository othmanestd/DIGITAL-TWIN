"use client";
// Building blocks of the side panel: KPI strip (market tiles), people pictogram block, use-case rows, before/after chain.
import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { agg, fr, YEARS, CASE, META, benchFor, type UseCase, type Year } from "@/lib/model";
import { MarketTile, MiniBar, Pictogram, Tip, Dot, Segmented } from "@/components/ui/kit";
import { I } from "@/components/ui/icons";
import { aggSeries, deltaText, money, FAM_COLOR, STEP_COLOR, ACTOR_LABEL, in302, levelCode, LEVEL_LABEL, LEVEL_COLOR, headline, benchOf } from "@/lib/ui/fmt";
import { useSize, useViewport } from "@/lib/ui/hooks";
import s from "@/components/ui/styles";


/** true on short screens (≤ 960 px high): panels drop sparklines and tighten spacing. */
export function useCompact() { return useViewport().h < 960; }
/** true on very short screens (< 820 px high): panels keep only the essentials (verdict, KPIs, pictogram, list). */
export function useTight() { return useViewport().h < 820; }
/** short AND narrow (side panel under ~560 px wide): the chain keeps only the "after" column. */
export function useVeryTight() { const v = useViewport(); return v.h < 820 && v.w < 1500; }

/* ---------------------------------------------------------------- KPI strip */
export function KpiStrip({ ids, year, perSite, note }: { ids: string[]; year: Year; perSite: boolean; note?: ReactNode }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const compact = useCompact();
  const a = agg(ids, year, perSite);
  const i = YEARS.indexOf(year);
  const eco = aggSeries(ids, "mdh", perSite), etp = aggSeries(ids, "etp", perSite), cout = aggSeries(ids, "cout", perSite), net = aggSeries(ids, "net", perSite), roi = aggSeries(ids, "roi", perSite);
  const m = money(a.mdh), mc = money(a.cout), mn = money(a.net);
  const tight = useTight();
  const narrow = size.w > 0 && size.w < 600;
  const tsize: "xs" | "sm" | "md" = narrow ? (size.w < 520 ? "xs" : "sm") : compact ? "sm" : "md";
  const unitTxt = (u: string) => (u === "MDH" ? "MDH (millions de dirhams)" : "kMAD (milliers de dirhams)");
  const scale = (arr: number[], u: string) => (u === "kMAD" ? arr.map((x) => x * 1000) : arr);
  const unitTip = (u: string) => (u === "MDH" ? "MDH : millions de dirhams marocains. 1 MDH = 1 000 000 MAD." : "kMAD : milliers de dirhams marocains. 1 kMAD = 1 000 MAD.");
  const tiles = [
    { label: "Économie", value: m.v, d: m.d, unit: m.unit, unitTip: unitTip(m.unit), series: scale(eco, m.unit), explain: <>{unitTxt(m.unit)} par an</>, color: "var(--green)", tone: "pos" as const },
    { label: tsize === "md" ? "ETP-éq. libérés" : "ETP-éq.", value: a.etp, d: a.etp < 10 ? 1 : 0, unit: "", series: etp, explain: <>équivalents temps plein libérés</>, color: "#9FB3FF", tone: "pos" as const },
    { label: tsize === "md" ? "Coût des agents" : "Coût agents", value: mc.v, d: mc.d, unit: mc.unit, unitTip: unitTip(mc.unit), series: scale(cout, mc.unit), explain: <>{mc.unit} par an, licences et calcul</>, color: "#B9C1D6", tone: "neutral" as const },
    { label: "Gain net", value: mn.v, d: mn.d, unit: mn.unit, unitTip: unitTip(mn.unit), series: scale(net, mn.unit), explain: <>économie moins coût des agents</>, color: "#E6EAF5", tone: "pos" as const },
    { label: "ROI", value: a.roi, d: 2, unit: "", series: roi, explain: <>dirhams rendus pour 1 dirham d&apos;agents</>, color: "var(--amber)", tone: "neutral" as const },
  ];
  return (
    <div ref={ref}>
      <div className={`grid grid-cols-5 ${tsize === "xs" ? "gap-1.5" : "gap-2"}`}>
        {tiles.map((t) => (
          <MarketTile key={t.label} size={tsize} label={t.label} value={t.value} d={t.d} unit={t.unit || undefined} unitTip={t.unitTip}
            series={tsize !== "md" ? undefined : t.series} active={i} color={t.color} tone={t.tone}
            delta={tsize === "sm" || tsize === "xs" ? null : deltaText(t.series, i, t.d, "")} explain={tight ? undefined : t.explain} />
        ))}
      </div>
      {(tight || tsize === "xs") && <div className="mt-1.5 truncate text-[11px] text-[var(--mut)]">{m.unit} = {m.unit === "MDH" ? "millions" : "milliers"} de dirhams, par an · ETP-éq. = équivalents temps plein libérés · ROI = dirhams rendus pour 1 dirham d&apos;agents</div>}
      {note && <div className="mt-1.5 text-[11.5px] text-[var(--mut)]">{note}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- people pictogram block */
export function PeopleBlock({ value, color, title, text, size = 34 }: { value: number; color: string; title: ReactNode; text: ReactNode; size?: number }) {
  const compact = useCompact();
  const tight = useTight();
  const vt = useVeryTight();
  if (vt) return (
    <Tip content={text} className="block">
      <div className={`${s.card} flex cursor-help items-center gap-3 rounded-[14px] px-3 py-2`}>
        <Pictogram value={value} color={color} size={20} gap={3} />
        <span className="num text-[17px] font-[800] leading-none" style={{ color }}>{fr(value, value < 1 && value > 0 ? 1 : value % 1 ? 1 : 0)}</span>
        <span className="text-[12px] font-semibold text-[var(--txt-2)]">sur 10</span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--mut)]">temps pleins repris {title}</span>
      </div>
    </Tip>
  );
  return (
    <div className={`${s.card} flex items-center ${tight ? "gap-4 py-2" : compact ? "gap-5 py-2.5" : "gap-5 py-3.5"} rounded-[16px] px-4`}>
      <Pictogram value={value} color={color} size={tight ? size - 10 : compact ? size - 6 : size} gap={compact ? 4 : 6} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="num text-[26px] font-[800] leading-none" style={{ color }}>{fr(value, value < 1 && value > 0 ? 1 : value % 1 ? 1 : 0)}</span>
          <span className="text-[13px] font-semibold text-[var(--txt-2)]">sur 10</span>
          <span className="ml-1 truncate text-[12.5px] text-[var(--mut)]">{title}</span>
        </div>
        <p className="mt-1 text-[12.5px] leading-snug text-[var(--txt-2)]">{text}</p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- use-case rows */
export function CaseRows({ ids, year, perSite, max, onOpen, highlight }: { ids: string[]; year: Year; perSite: boolean; max?: number; onOpen: (id: string) => void; highlight?: string[] }) {
  const rows = ids.map((id) => CASE[id]).filter(Boolean).map((c) => ({ c, a: agg([c.id], year, perSite), lv: bestLevel(c.id) }))
    .sort((x, y) => y.c.mdh - x.c.mdh || (LEVEL_RANK[x.lv ?? "N"] ?? 9) - (LEVEL_RANK[y.lv ?? "N"] ?? 9) || x.c.id.localeCompare(y.c.id));
  const top = Math.max(...rows.map((r) => r.a.mdh), 1e-9);
  const shown = max ? rows.slice(0, max) : rows;
  const cols = "grid-cols-[48px_minmax(0,1fr)_70px_40px_22px_44px]";
  return (
    <div className="flex flex-col">
      <div className={`grid ${cols} items-center gap-2.5 px-3 pb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]`}>
        <span>Cas</span><span>Ce que fait l&apos;IA</span>
        <Tip content={perSite ? "Économie annuelle par établissement, en MDH (millions de dirhams) ou kMAD (milliers de dirhams). « hors MS » : valeur hors masse salariale." : "Économie annuelle, en MDH (millions de dirhams). « hors MS » : valeur hors masse salariale, non additive."}><span className="cursor-help text-right">Économie</span></Tip>
        <Tip content="ROI : dirhams économisés pour 1 dirham d'agents."><span className="cursor-help text-right">ROI</span></Tip>
        <Tip content="Meilleur niveau de preuve mesurée ailleurs : A publication scientifique, B publié par l'hôpital, C éditeur avec client nommé."><span className="cursor-help text-center">P.</span></Tip><span />
      </div>
      {shown.map(({ c, a, lv }) => {
        const m = money(a.mdh);
        const hi = highlight?.includes(c.id);
        const fam = c.fam || c.id[0];
        const out = !in302(c);
        return (
          <button key={c.id} type="button" onClick={() => onOpen(c.id)} data-anchor={`case-row:${c.id}`}
            className={`group grid ${cols} items-center gap-2.5 rounded-[12px] px-3 py-[8px] text-left transition-colors hover:bg-white/[0.06] ${hi ? "bg-[rgba(91,124,255,.10)] ring-1 ring-[rgba(91,124,255,.28)]" : ""}`}>
            <span className="num text-[12.5px] font-bold" style={{ color: FAM_COLOR[fam] }}>{c.id}</span>
            <span className="truncate text-[13px] text-[var(--txt)] group-hover:text-white">{c.titre}</span>
            <span className="text-right text-[13px]">
              {c.mdh ? <><span className="num font-bold text-[var(--txt)]">{fr(m.v, m.d)}</span> <span className="text-[10.5px] font-semibold text-[var(--mut)]">{m.unit}</span></>
                : out && c.value_out ? <Tip content={<>{c.value_out} — indicatif, non additif aux {fr(META.eco, 0)} MDH.</>}><span className="cursor-help rounded-full bg-[rgba(91,124,255,.14)] px-1.5 py-[1px] text-[10.5px] font-semibold text-[#AFC0FF]">hors MS</span></Tip>
                : <span className="text-[11.5px] text-[var(--mut)]">levier</span>}
            </span>
            <span className="num text-right text-[12.5px] text-[var(--txt-2)]">{c.roi ? fr(a.roi || c.roi, 2) : "—"}</span>
            <span className="flex justify-center">{lv && ["A", "B", "C"].includes(lv) ? <span className="num grid h-[18px] w-[18px] place-items-center rounded-[5px] text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${LEVEL_COLOR[lv]} 20%, transparent)`, color: LEVEL_COLOR[lv] }}>{lv}</span> : <span className="text-[11px] text-white/20">·</span>}</span>
            <span className="flex items-center gap-1">
              {c.mdh ? <MiniBar value={a.mdh} max={top} className="flex-1" color={FAM_COLOR[fam]} /> : <span className="flex-1" />}
              <I.chevron size={13} className="text-[var(--mut)] opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
          </button>
        );
      })}
      {max && rows.length > max && <div className="px-3 pt-1 text-[12px] text-[var(--mut)]">+ {rows.length - max} autre{rows.length - max > 1 ? "s" : ""} cas</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- v1.3: evidence badge, proof block, value outside payroll */
const LEVEL_RANK: Record<string, number> = { A: 0, B: 1, C: 2, R: 3, N: 4 };
/** Best evidence level among the measured results of a case ("A" | "B" | "C"…), or null. */
export function bestLevel(id: string): string | null {
  const bs = benchFor(id);
  if (!bs.length) return null;
  return bs.map((b) => levelCode(b.level)).sort((a, b) => (LEVEL_RANK[a] ?? 9) - (LEVEL_RANK[b] ?? 9))[0];
}
export function LevelBadge({ code, full = false, size = "sm" }: { code: string; full?: boolean; size?: "sm" | "md" }) {
  const c = LEVEL_COLOR[code] ?? "#8D97B0";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-semibold ${size === "md" ? "px-2.5 py-[3px] text-[11.5px]" : "px-2 py-[2px] text-[10.5px]"}`}
      style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c} 35%, transparent)` }}>
      <span className="num">{code}</span>{full && <span className="font-medium">· {LEVEL_LABEL[code] ?? ""}</span>}
    </span>
  );
}

/** "Ça a marché ailleurs": the headline market result for a case (measured benchmarks only). */
export function ProofBlock({ c, compact = false }: { c: UseCase; compact?: boolean }) {
  const measured = benchFor(c.id);
  if (!measured.length) {
    return (
      <div className={`${s.card} flex items-center gap-3 rounded-[16px] px-4 py-3`} data-anchor="proof">
        <span className="eyebrow !text-[9.5px]">Ça a marché ailleurs</span>
        <span className="text-[12.5px] text-[var(--mut)]">Aucun résultat mesuré publié : la preuve sera faite au pilote, mesure au point zéro.</span>
      </div>
    );
  }
  const p = c.proof && ["A", "B", "C"].includes(c.proof.niveau_code) ? c.proof : null;
  const main = p ? measured.find((b) => (p.source_url && b.url === p.source_url) || (p.source && b.source === p.source)) ?? measured[0] : measured[0];
  const result = p?.resultat ?? main.result;
  const who = p?.ou ?? `${main.who} · ${main.country}`;
  const code = p ? p.niveau_code : levelCode(main.level);
  const reading = p?.lecture_akdital ?? main.reading;
  const src = p?.source ?? main.source;
  const url = p?.source_url ?? main.url;
  const year = main.year;
  const h = headline(result);
  const others = measured.filter((b) => b !== main);
  return (
    <div className="relative overflow-hidden rounded-[18px] px-4 py-3.5" data-anchor="proof"
      style={{ background: "linear-gradient(135deg, rgba(76,199,154,.13), rgba(91,124,255,.06) 70%)", boxShadow: "inset 0 0 0 1px rgba(76,199,154,.26)" }}>
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-[#7FD9B5]"><I.check size={14} strokeWidth={2.2} /><span className="eyebrow !text-[10px] ![color:inherit]">Ça a marché ailleurs</span></span>
        <span className="ml-auto"><LevelBadge code={code} full /></span>
      </div>
      <div className={`mt-2 grid items-start gap-4 ${h ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {h && <div className={`num font-[800] leading-[1.02] tracking-[-0.03em] text-white ${h.big.length <= 16 ? "whitespace-nowrap text-[clamp(24px,1.9vw,34px)]" : "max-w-[240px] text-[clamp(20px,1.5vw,26px)]"}`}>{h.big}</div>}
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold leading-snug text-white">{who}{year ? <span className="font-normal text-[var(--mut)]"> · {year}</span> : null}</div>
          <Tip content={c.elsewhere ?? result} className="block">
            <p className="mt-0.5 cursor-help text-[12.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: compact ? 2 : 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{result}</p>
          </Tip>
        </div>
      </div>
      {reading && !compact && (
        <p className="mt-2 border-t border-white/[0.07] pt-2 text-[12px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          <span className="font-semibold text-[#AFC0FF]">Lecture Akdital : </span>{reading}
        </p>
      )}
      <div className="mt-2 flex items-center gap-3 text-[11.5px]">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 items-center gap-1.5 text-[var(--txt-2)] underline decoration-white/20 underline-offset-2 hover:text-white" data-anchor="proof:source">
            <I.link size={12} className="shrink-0" /><span className="truncate">{src}</span>
          </a>
        ) : <span className="truncate text-[var(--mut)]">{src}</span>}
        {others.length > 0 && (
          <Tip content={<span className="block max-w-[320px]">{others.slice(0, 6).map((b) => <span key={b.id} className="mb-1 block"><b className="text-[var(--txt)]">{b.who}</b> ({levelCode(b.level)}) : {b.result}</span>)}</span>}>
            <span className="ml-auto shrink-0 cursor-help rounded-full bg-white/[0.07] px-2 py-[2px] text-[var(--txt-2)]">+ {others.length} autre{others.length > 1 ? "s" : ""} résultat{others.length > 1 ? "s" : ""} mesuré{others.length > 1 ? "s" : ""}</span>
          </Tip>
        )}
      </div>
    </div>
  );
}

/** Value created outside the payroll (v1.3 families X, C, R, I), shown verbatim; levers (T) have no own gain. */
export function ValueOutCard({ c }: { c: UseCase }) {
  const lever = c.fam === "T" || (!c.value_out && !c.mdh);
  const types = [...new Set((c.value_levers ?? []).map((v) => v.type).filter(Boolean))];
  return (
    <div className="rounded-[16px] px-4 py-3" style={{ background: "linear-gradient(90deg, rgba(91,124,255,.13), rgba(91,124,255,.03))", boxShadow: "inset 3px 0 0 #9FB3FF" }} data-anchor="value-out">
      <div className="flex items-center gap-2">
        <span className="eyebrow !text-[9.5px] !text-[#AFC0FF]">{lever ? "Verdict · levier de réalisation" : "Verdict · valeur hors masse salariale"}</span>
        {!lever && <span className="ml-auto rounded-full bg-white/[0.07] px-2 py-[2px] text-[10.5px] text-[var(--txt-2)]">indicatif, non additif aux {fr(META.eco, 0)} MDH</span>}
      </div>
      <p className="mt-1 text-[clamp(15px,1.05vw,18px)] font-semibold leading-snug text-white">
        {lever ? "Sans gain propre : il transforme le temps libéré en économie réelle (décisions de poste, mobilités, mesure)." : c.value_out ?? "Valeur d'un autre type que la masse salariale."}
      </p>
      {(types.length > 0 || (c.solutions?.length ?? 0) > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {types.map((x) => <span key={x} className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[11px] text-[var(--txt-2)]">{x}</span>)}
          {(c.solutions ?? []).length > 0 && <span className="ml-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Solutions</span>}
          {(c.solutions ?? []).map((x) => <span key={x} className="rounded-full bg-[rgba(91,124,255,.16)] px-2 py-[2px] text-[11px] font-medium text-[#C9D4FF] ring-1 ring-[rgba(91,124,255,.3)]">{x}</span>)}
        </div>
      )}
    </div>
  );
}

/** Case list split between the 302 MDH payroll scope and the value beyond it. */
export function CaseListSplit({ ids, year, perSite, onOpen, max, highlight, layoutId }: { ids: string[]; year: Year; perSite: boolean; onOpen: (id: string) => void; max?: number; highlight?: string[]; layoutId: string }) {
  const inIds = ids.filter((id) => CASE[id] && in302(CASE[id]));
  const outIds = ids.filter((id) => CASE[id] && !in302(CASE[id]));
  const [tab, setTab] = useState<"in" | "out">(inIds.length ? "in" : "out");
  const proofs = benchOf(ids).length;
  const cur = tab === "in" ? inIds : outIds;
  return (
    <div className="shrink-0">
      <div className="mb-2 flex items-center gap-3">
        {inIds.length > 0 && outIds.length > 0 ? (
          <Segmented<"in" | "out"> size="sm" layoutId={layoutId} value={tab} onChange={setTab}
            options={[{ id: "in", label: <>Masse salariale ({fr(META.eco, 0)} MDH) · {inIds.length}</> }, { id: "out", label: <>Au-delà de la masse salariale · {outIds.length}</> }]} />
        ) : (
          <span className="eyebrow !text-[10px] text-[var(--txt-2)]">{inIds.length ? `Cas d'usage · masse salariale (${fr(META.eco, 0)} MDH) · ${inIds.length}` : `Cas d'usage · au-delà de la masse salariale · ${outIds.length}`}</span>
        )}
        <span className="h-px flex-1 bg-white/[0.07]" />
        <Tip content="Résultats mesurés et publiés ailleurs (hôpitaux, publications scientifiques, éditeurs avec client nommé) pour les cas de ce périmètre.">
          <span className="flex shrink-0 cursor-help items-center gap-1 text-[11.5px] text-[#7FD9B5]"><I.check size={12} strokeWidth={2.2} />{proofs} preuve{proofs > 1 ? "s" : ""} mesurée{proofs > 1 ? "s" : ""}</span>
        </Tip>
      </div>
      <CaseRows ids={cur} year={year} perSite={perSite} onOpen={onOpen} max={max} highlight={highlight} />
    </div>
  );
}

/* ---------------------------------------------------------------- before / after chain */
function stepColor(actor: string, after: boolean) {
  if (actor === "agent") return STEP_COLOR.agent;
  if (actor === "humain") return after ? STEP_COLOR.validation : STEP_COLOR.human;
  if (actor === "systeme") return STEP_COLOR.system;
  return STEP_COLOR.tool;
}
function stepTag(actor: string, after: boolean) {
  if (actor === "agent") return "Agent IA";
  if (actor === "humain") return after ? "Validation humaine" : "Humain";
  return ACTOR_LABEL[actor] ?? actor;
}
function stepIcon(actor: string, after: boolean) {
  if (actor === "agent") return <I.spark size={12} strokeWidth={2} />;
  if (actor === "humain") return after ? <I.check size={12} strokeWidth={2.2} /> : <I.person size={12} strokeWidth={2} />;
  if (actor === "systeme") return <I.layers size={12} strokeWidth={2} />;
  return <I.doc size={12} strokeWidth={2} />;
}
export function ChainLegend() {
  return (
    <span className="flex items-center gap-2.5 text-[10.5px] text-[var(--mut)]">
      <span className="flex items-center gap-1"><Dot color={STEP_COLOR.human} size={6} />humain</span>
      <span className="flex items-center gap-1"><Dot color={STEP_COLOR.tool} size={6} />outil manuel</span>
      <span className="flex items-center gap-1"><Dot color={STEP_COLOR.agent} size={6} />agent IA</span>
      <span className="flex items-center gap-1"><Dot color={STEP_COLOR.validation} size={6} />validation</span>
    </span>
  );
}
export function Chain({ c, legend = true }: { c: UseCase; legend?: boolean }) {
  const compact = useCompact();
  const vt = useVeryTight();
  const col = (steps: UseCase["avant"], after: boolean) => (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span className="eyebrow !text-[10px]" style={{ color: after ? "#AFC0FF" : "var(--human)" }}>{after ? "Avec les agents" : "Aujourd'hui"}</span>
        <span className="h-px flex-1 bg-white/[0.07]" />
      </div>
      <ol className="relative flex flex-col gap-[5px]">
        {steps.map((st, k) => {
          const color = stepColor(st.acteur, after);
          const isAgent = st.acteur === "agent";
          return (
            <motion.li key={k} initial={{ opacity: 0, x: after ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * k + (after ? 0.15 : 0), duration: 0.35 }}
              className={`relative flex items-center gap-2.5 rounded-[10px] px-2.5 ${vt ? "py-[4px]" : compact ? "py-[5px]" : "py-[6px]"}`}
              style={{ background: isAgent ? "rgba(91,124,255,.14)" : "rgba(255,255,255,.035)", boxShadow: `inset 2px 0 0 ${color}` }}>
              <Tip content={stepTag(st.acteur, after)} side="left">
                <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }}>{stepIcon(st.acteur, after)}</span>
              </Tip>
              <span className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--txt)]">{st.texte}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
  return (
    <div>
      {vt ? (
        <div>
          <Tip content={<>{c.avant.map((st, k) => <span key={k} className="block">{k + 1}. {st.texte}</span>)}</>} className="block">
            <div className="mb-2 flex cursor-help items-center gap-2 rounded-[10px] bg-white/[0.035] px-2.5 py-1.5 text-[11.5px] text-[var(--txt-2)]" style={{ boxShadow: `inset 2px 0 0 ${STEP_COLOR.human}` }}>
              <span className="eyebrow !text-[9.5px]" style={{ color: "var(--human)" }}>Aujourd&apos;hui</span>
              <span className="truncate">{c.avant.length} étapes à la main : {c.avant.map((st) => st.texte.split(" ").slice(0, 2).join(" ").toLowerCase()).join(", ")}…</span>
            </div>
          </Tip>
          {col(c.apres, true)}
        </div>
      ) : (
      <div className="grid grid-cols-[minmax(0,1fr)_18px_minmax(0,1fr)] items-start gap-2">
        {col(c.avant, false)}
        <div className="mt-[34px] grid place-items-center text-[var(--mut)]"><I.arrowRight size={16} /></div>
        {col(c.apres, true)}
      </div>
      )}
      {legend && <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-[var(--mut)]">
        <span className="flex items-center gap-1.5"><Dot color={STEP_COLOR.human} size={7} />travail humain aujourd&apos;hui</span>
        <span className="flex items-center gap-1.5"><Dot color={STEP_COLOR.tool} size={7} />papier, téléphone, tableur</span>
        <span className="flex items-center gap-1.5"><Dot color={STEP_COLOR.agent} size={7} />l&apos;agent IA intervient</span>
        <span className="flex items-center gap-1.5"><Dot color={STEP_COLOR.validation} size={7} />validation humaine</span>
      </div>}
    </div>
  );
}

/* ---------------------------------------------------------------- small fact card */
export function Fact({ icon, label, children, clamp = 3 }: { icon: ReactNode; label: string; children: ReactNode; clamp?: number }) {
  return (
    <div className={`${s.card} min-w-0 rounded-[14px] px-3.5 py-3`}>
      <div className="mb-1 flex items-center gap-1.5 text-[var(--txt-2)]">{icon}<span className="eyebrow !text-[9.5px]">{label}</span></div>
      <p className="text-[12.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: clamp, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{children}</p>
    </div>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-3">
      <span className="eyebrow !text-[10px] text-[var(--txt-2)]">{children}</span>
      <span className="h-px flex-1 bg-white/[0.07]" />
      {right}
    </div>
  );
}

export function useOpen() {
  const openCase = useApp((st) => st.openCase);
  return openCase;
}
