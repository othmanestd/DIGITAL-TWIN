"use client";
// The six full-screen sections. Each fits one screen (1920×1080, degrades to 1440×900); only the use-case list scrolls.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { useApp } from "@/lib/store";
import { DATA, META, HEAD, LBL, V23, FIN, FINROW, FINAL_YEAR, etabIn, FAM, CASES, CASE, BENCH, OUT_FAMS, IN302_FAMS, fr, pct, YEARS, ETAB, share, type Benchmark, type UseCase } from "@/lib/model";
import { SITES, GROUP, INTERNATIONAL, NETWORK_META } from "@/lib/geo/network";
import { MarketTile, Pictogram, MiniBar, Tip, Dot, Segmented, Num } from "@/components/ui/kit";
import { LevelBadge } from "@/components/panels/parts";
import { sourcesIntent } from "@/components/panels/dossier-data";
import { SourcesParCas, PAR_CAS_SUMMARY } from "./SourcesParCas";
import { I } from "@/components/ui/icons";
import { FAM_COLOR, FAM_SHORT, BRIQUE_COLOR, famName, groupSeries, deltaText, headline, levelCode, LEVEL_LABEL, LEVEL_COLOR, in302, benchOf } from "@/lib/ui/fmt";
import { Waterfall, RampChart, RampLegend, Sensitivities, MarketMap, type ColorBy } from "./charts";
import s from "@/components/ui/styles";
import { useViewport } from "@/lib/ui/hooks";

const LAST = YEARS.length - 1;
const FAMS = DATA.fams.filter((f) => IN302_FAMS.includes(f.code));
const MDH_TIP = "MDH : millions de dirhams marocains (1 MDH = 1 000 000 MAD).";

// ---------------------------------------------------------------- dataset helpers (v13 · données d'origine / v23 · chiffres actualisés)
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
/** Is the case counted in the programme figures? v13: the payroll families (302 MDH); v23: every case with its own figures (the 4 merged cases have none). */
const counted = (c: UseCase) => (V23 ? c.in302 !== false : in302(c));
const MERGED = CASES.filter((c) => c.merged_into);
/** Hypothesis of the v2.3 business case by label (value and note), e.g. "Taux d'actualisation (VAN)". */
const hyp = (re: RegExp) => FIN.hypotheses.find((h) => re.test(h.label));
/** Programme trajectory of the freed FTE: v13 scales the headline by the ramp, v23 reads the Synthèse line. */
const etpSeries = () => YEARS.map((y) => (y <= 2026 ? 0 : V23 ? FINROW.etp.values[String(y)] ?? 0 : META.postes * share(y).eco));
const serie = (k: "eco" | "cout" | "net" | "cumul" | "roi" | "etp") => (k === "etp" ? etpSeries() : groupSeries(k));

export function Card({ title, right, children, className, bodyClass }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`${s.card} flex min-h-0 min-w-0 flex-col rounded-[18px] p-[clamp(14px,1.1vw,20px)] ${className ?? ""}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center gap-3">
          {title && <h3 className="text-[clamp(13px,0.85vw,15px)] font-semibold tracking-[-0.01em] text-white">{title}</h3>}
          <span className="flex-1" />
          {right}
        </div>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass ?? ""}`}>{children}</div>
    </section>
  );
}
const Sub = ({ children }: { children: ReactNode }) => <span className="text-[11.5px] font-normal text-[var(--mut)]">{children}</span>;

/* ================================================================ Synthèse */
export function Synthese() {
  const { h: vh } = useViewport();
  const ts = vh < 1000 ? "lg" : "xl";
  const ex = (x: string) => (vh < 800 ? undefined : x);
  const split = vh < 1000;
  const [view, setView] = useState<"over" | "fam">("over");
  const eco = serie("eco"), cout = serie("cout"), net = serie("net"), roi = serie("roi"), etp = serie("etp");
  const showOver = !split || view === "over", showFam = !split || view === "fam";
  return (
    <div className={`grid h-full min-h-0 gap-[clamp(10px,1.3vh,18px)] ${split ? (view === "over" ? "grid-rows-[auto_auto_minmax(0,1fr)]" : "grid-rows-[auto_minmax(0,1fr)]") : "grid-rows-[auto_minmax(0,1fr)_auto]"}`}>
      {split && (
        <div className="flex items-center gap-3">
          <Segmented<"over" | "fam"> size="sm" layoutId="synthese-view" value={view} onChange={setView} anchorPrefix="synthese:"
            options={[{ id: "over", label: "Chiffres clés et trajectoire" }, { id: "fam", label: "Familles de métiers" }]} />
        </div>
      )}
      {showOver && <>
      <div className="grid grid-cols-6 gap-[clamp(8px,0.7vw,14px)]">
        {V23 ? <>
          <MarketTile size={ts} from={0} label="Gains bruts" value={HEAD.gains} d={0} unit="MDH" unitTip={MDH_TIP} series={eco} delta={deltaText(eco, LAST, 1)} explain={ex(`MDH (millions de dirhams) par an en ${HEAD.year} : ① économies ${fr(HEAD.eco, 0)} + ② marge ${fr(HEAD.marge, 0)} sur le CA additionnel`)} anchor="kpi:eco" />
          <MarketTile size={ts} from={0} label="Coût du programme" value={HEAD.cout} d={0} unit="MDH" unitTip={MDH_TIP} series={cout} delta={deltaText(cout, LAST, 0)} tone="neutral" color="#C9827A" explain={ex("③ par an : agents et plateformes des cas, coûts transverses, contingence")} anchor="kpi:cout" />
          <MarketTile size={ts} from={0} label="Valeur nette" value={HEAD.net} d={0} unit="MDH" unitTip={MDH_TIP} series={net} delta={deltaText(net, LAST, 1)} color="#E8ECF6" explain={ex("gains bruts moins coût du programme, chaque année")} anchor="kpi:net" />
          <MarketTile size={ts} from={0} label="Gains pour 1 dirham" value={HEAD.ratio} d={2} series={roi} delta={deltaText(roi, LAST, 2)} tone="neutral" color="#E2B05A" explain={ex("dirhams de gains bruts pour 1 dirham de coût du programme")} anchor="kpi:roi" />
          <MarketTile size={ts} from={0} label="ETP-éq. libérés" value={HEAD.etp} d={0} series={etp} delta={deltaText(etp, LAST, 0)} color="#9FB3FF" explain={ex("équivalents temps plein de travail repris par les agents")} anchor="kpi:etp" />
        </> : <>
          <MarketTile size={ts} from={0} label="Économie annuelle" value={META.eco} d={0} unit="MDH" unitTip={MDH_TIP} series={eco} delta={deltaText(eco, LAST, 1)} explain={ex("MDH (millions de dirhams) de masse salariale par an, au plein régime")} anchor="kpi:eco" />
          <MarketTile size={ts} from={0} label="Coût des agents" value={META.budget} d={0} unit="MDH" unitTip={MDH_TIP} series={cout} delta={deltaText(cout, LAST, 0)} tone="neutral" color="#C9827A" explain={ex("par an : licences, calcul des modèles au Maroc, supervision")} anchor="kpi:cout" />
          <MarketTile size={ts} from={0} label="Gain net" value={META.net} d={0} unit="MDH" unitTip={MDH_TIP} series={net} delta={deltaText(net, LAST, 1)} color="#E8ECF6" explain={ex("économie moins coût des agents, chaque année")} anchor="kpi:net" />
          <MarketTile size={ts} from={0} label="ROI" value={META.roi} d={2} series={roi} delta={deltaText(roi, LAST, 2)} tone="neutral" color="#E2B05A" explain={ex("dirhams économisés pour 1 dirham dépensé en agents")} anchor="kpi:roi" />
          <MarketTile size={ts} from={0} label="ETP-éq. libérés" value={META.postes} d={0} series={etp} delta={deltaText(etp, LAST, 0)} color="#9FB3FF" explain={ex("équivalents temps plein de travail repris par les agents")} anchor="kpi:etp" />
        </>}
        <MarketTile size={ts} from={0} label="Licenciement" value={0} d={0} color="#7FD9B5" anchor="kpi:licenciement"
          explain="départs non remplacés, mobilités vers les ouvertures, recrutements évités"
          footer={<div className="mt-auto pt-3"><span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(76,199,154,.14)] px-2.5 py-1 text-[11.5px] font-semibold text-[#7FD9B5]"><I.shieldCheck size={13} />engagement écrit</span></div>} />
      </div>

      <div className="grid min-h-0 grid-cols-[1fr_1.35fr_1fr] gap-[clamp(10px,0.8vw,16px)]">
        <Card title={V23 ? <>Des gains bruts à la valeur nette <Sub>· MDH par an, {HEAD.year}</Sub></> : <>De l&apos;économie au gain net <Sub>· MDH par an, plein régime</Sub></>}>
          <Waterfall />
        </Card>
        <Card title={<>Montée en charge <Sub>· 2027 → {FINAL_YEAR}, MDH (millions de dirhams) par an</Sub></>} bodyClass="flex flex-col">
          <div className="min-h-0 flex-1"><RampChart /></div>
          <div className="mt-2"><RampLegend /></div>
        </Card>
        {V23 ? (
          <Card title={<>Du cas au programme <Sub>· MDH par an, {HEAD.year}</Sub></>}>
            <ProgrammeBridge />
          </Card>
        ) : (
          <Card title={<>Sensibilités <Sub>· gain net en MDH si…</Sub></>} right={<Tip content={DATA.meta.flag_160}><span className="flex cursor-help items-center gap-1 rounded-full bg-[rgba(226,176,90,.12)] px-2 py-[3px] text-[10.5px] font-semibold text-[#E9C27F]"><Dot color="#E2B05A" size={6} />{fr(META.budget, 0)} à confirmer</span></Tip>}>
            <Sensitivities />
          </Card>
        )}
      </div>
      </>}

      {showFam && (
        <div className="grid min-h-0 grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
          <Card title={<>Les quatre familles de métiers <Sub>· effectifs du groupe, part {V23 ? `du temps reprise par les agents en ${HEAD.year}` : "reprise par les agents au plein régime"}</Sub></>} bodyClass="">
            <FamilyTable />
          </Card>
          <section className={`${s.card} min-h-0 min-w-0 rounded-[18px] p-[clamp(14px,1.1vw,20px)]`} data-anchor="synthese:beyond"><BeyondBlock /></section>
        </div>
      )}
    </div>
  );
}

/** v23: from the sum of the cases to the programme. Case values leave out the cross-cutting costs and the contingency; the programme counts them. */
function ProgrammeBridge() {
  const y = String(HEAD.year);
  const n = CASES.filter((c) => c.v23?.projections).length;
  const casesNet = FINROW.gains.values[y] - FINROW.cout_cases.values[y];
  const taux = hyp(/^Taux d'actualisation/), cont = hyp(/^Contingence/);
  const rows = [
    { l: `Valeur nette des ${n} cas`, s: "sans les coûts transverses ni la contingence", v: casesNet, c: "#B9E5D2", total: false },
    { l: "Coûts transverses", s: "infrastructure, connecteurs, pilotage, changement", v: -FINROW.cout_transverse.values[y], c: "#C9827A", total: false },
    { l: "Contingence", s: cont ? `${pct(Number(cont.value), 0)} de contingence sur les coûts` : "marge de sécurité sur les coûts", v: -FINROW.contingence.values[y], c: "#C9827A", total: false },
    { l: "Valeur nette du programme", s: "ce que rend le programme entier", v: HEAD.net, c: "#E8ECF6", total: true },
  ];
  return (
    <div className="flex h-full flex-col gap-[clamp(6px,1vh,12px)]">
      <div className="flex flex-col">
        {rows.map((r) => (
          <div key={r.l} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.05] py-[clamp(4px,0.7vh,8px)] last:border-0 ${r.total ? "pt-[clamp(6px,1vh,10px)]" : ""}`}>
            <div className="min-w-0"><div className={`truncate text-[12.5px] ${r.total ? "font-semibold text-white" : "text-[var(--txt)]"}`}>{r.l}</div><div className="truncate text-[11px] text-[var(--mut)]">{r.s}</div></div>
            <span className="num text-[clamp(15px,1.15vw,19px)]" style={{ color: r.total ? "#fff" : r.c }}>{r.v < 0 ? "−" : ""}{fr(Math.abs(r.v), 1)}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <div className="rounded-[12px] bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
          <div className="eyebrow !text-[9.5px]" style={{ color: "var(--txt-2)" }}>Cumul 2027-{FINAL_YEAR}</div>
          <div className="num mt-0.5 text-[clamp(18px,1.4vw,24px)] text-white">{fr(HEAD.cumul, 0)} <span className="text-[11px] font-semibold text-[var(--mut)]">MDH</span></div>
          <div className="text-[11px] leading-snug text-[var(--mut)]">valeur nette cumulée</div>
        </div>
        <div className="rounded-[12px] bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
          <div className="eyebrow !text-[9.5px]" style={{ color: "var(--txt-2)" }}>VAN{taux ? ` à ${pct(Number(taux.value), 0)}` : ""}</div>
          <div className="num mt-0.5 text-[clamp(18px,1.4vw,24px)] text-white">{HEAD.van === null ? "—" : fr(HEAD.van, 0)} <span className="text-[11px] font-semibold text-[var(--mut)]">MDH</span></div>
          <div className="text-[11px] leading-snug text-[var(--mut)]">valeur actuelle nette</div>
        </div>
      </div>
    </div>
  );
}

function FamilyTable() {
  const maxM = Math.max(...FAMS.map((f) => f.mdh));
  // v13: share taken over = the v1.0 hypothesis; v23: freed FTE of the family's cases over its paid FTE
  const part10 = (f: (typeof FAMS)[number]) => (V23 ? (f.etp ? (f.postes / f.etp) * 10 : 0) : f.part * 10);
  const head = V23 ? [
    ["Famille", ""], ["Effectif", "ETP payés (temps pleins)"], ["Part reprise", "sur 10 temps pleins"], ["ETP-éq. libérés", "postes à plein temps"],
    ["Coût", "MDH (millions de DH) par an"], ["Gains bruts", "MDH (millions de DH) par an"], ["Ratio", "DH de gains pour 1 DH"],
  ] : [
    ["Famille", ""], ["Effectif", "ETP payés (temps pleins)"], ["Part reprise", "sur 10 temps pleins"], ["ETP-éq. libérés", "postes à plein temps"],
    ["Coût moyen", "kMAD (milliers de DH) par an"], ["Économie", "MDH (millions de DH) par an"], ["ROI", "DH pour 1 DH d'agents"],
  ];
  const cols = "grid-cols-[minmax(170px,1.3fr)_0.7fr_minmax(200px,1.5fr)_0.8fr_0.9fr_minmax(160px,1.3fr)_0.6fr]";
  return (
    <div className="flex flex-col">
      <div className={`grid ${cols} items-end gap-4 border-b border-white/[0.07] px-2 pb-2`}>
        {head.map(([h, u]) => (
          <div key={h} className="min-w-0"><div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--txt-2)]">{h}</div>{u && <div className="truncate text-[11px] text-[var(--mut)]">{u}</div>}</div>
        ))}
      </div>
      {FAMS.map((f) => (
        <div key={f.code} className={`grid ${cols} items-center gap-4 border-b border-white/[0.04] px-2 py-[clamp(5px,0.8vh,9px)] last:border-0`}>
          <div className="flex min-w-0 items-center gap-2.5"><Dot color={FAM_COLOR[f.code]} size={9} /><span className="truncate text-[14px] font-medium text-white">{f.name}</span></div>
          <div className="num text-[15px] text-[var(--txt)]">{fr(f.etp, 0)}</div>
          <div className="flex items-center gap-3"><Pictogram value={part10(f)} color={FAM_COLOR[f.code]} size={20} gap={3} /><span className="num text-[13px] text-[var(--txt-2)]">{fr(part10(f), part10(f) % 1 ? 1 : 0)}</span></div>
          <div className="num text-[15px] text-white">{fr(f.postes, 0)}</div>
          <div className="num text-[15px] text-[var(--txt)]">{V23 ? fr(f.cout, 1) : fr(f.cout_mad / 1000, 1)}</div>
          <div className="flex items-center gap-3"><span className="num w-10 text-right text-[16px] text-white">{fr(f.mdh, 0)}</span><MiniBar value={f.mdh} max={maxM} color={FAM_COLOR[f.code]} className="flex-1" h={6} /></div>
          <div className="num text-[15px] text-[#E9C27F]">{fr(f.roi, 2)}</div>
        </div>
      ))}
    </div>
  );
}

/* ================================================================ Cas d'usage */
type Sort = "mdh" | "roi" | "id";
export function Cas() {
  const select = useApp((st) => st.select);
  const [colorBy, setColorBy] = useState<ColorBy>("famille");
  const [hover, setHover] = useState<string | null>(null);
  const [fam, setFam] = useState<string>("all");
  const [brique, setBrique] = useState<string>("all");
  const [vague, setVague] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("mdh");
  const [scope, setScope] = useState<"all" | "in" | "out">("all");
  const open = (id: string) => select({ kind: "case", id });
  const list = useMemo(() => {
    const l = CASES.filter((c) => (fam === "all" || (c.fam || c.id[0]) === fam) && (brique === "all" || c.brique === brique) && (vague === "all" || c.vague === vague) && (scope === "all" || (scope === "in") === counted(c)));
    return [...l].sort((a, b) => (sort === "mdh" ? b.mdh - a.mdh : sort === "roi" ? b.roi - a.roi : a.id.localeCompare(b.id)));
  }, [fam, brique, vague, sort, scope]);
  const mapCases = useMemo(() => CASES.filter((c) => counted(c) && (fam === "all" || (c.fam || c.id[0]) === fam) && (brique === "all" || c.brique === brique) && (vague === "all" || c.vague === vague)), [fam, brique, vague]);
  const levers = CASES.filter((c) => (c.fam || c.id[0]) === "T");
  const outFams = OUT_FAMS.map((code) => ({ code, name: FAM[code]?.name ?? code, n: CASES.filter((c) => (c.fam || c.id[0]) === code).length }));
  const maxM = Math.max(...CASES.map((c) => c.mdh));
  const legend = colorBy === "famille" ? FAMS.map((f) => [f.name, FAM_COLOR[f.code]] as const) : DATA.briques.filter((b) => b.mdh > 0).map((b) => [b.name, BRIQUE_COLOR[b.name]] as const);
  const chip = (on: boolean) => `h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors ${on ? "bg-white/[0.16] text-white ring-1 ring-white/25" : "bg-white/[0.04] text-[var(--mut)] ring-1 ring-white/[0.06] hover:text-[var(--txt)]"}`;
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_clamp(420px,30vw,560px)] gap-[clamp(10px,0.8vw,16px)]">
      <Card title={<>Carte de marché des cas <Sub>· surface = {V23 ? `${LBL.gains} ${HEAD.year}` : "économie annuelle"} en MDH (millions de dirhams), teinte plus dense = ROI plus élevé</Sub></>}
        right={<Segmented<ColorBy> size="sm" layoutId="cas-colorby" value={colorBy} onChange={setColorBy} options={[{ id: "famille", label: "Par famille" }, { id: "brique", label: "Par brique technique" }]} />}
        bodyClass="flex flex-col">
        <div className="min-h-0 flex-1"><MarketMap cases={mapCases} colorBy={colorBy} hover={hover} setHover={setHover} onOpen={open} /></div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-[var(--mut)]">
          {legend.map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><Dot color={c} size={8} />{l}</span>)}
          <span className="ml-auto">{V23 ? `${levers.length} leviers de réalisation (famille T) : ils débloquent la valeur des autres cas.` : `${levers.length} leviers de réalisation sans gain propre ne figurent pas sur la carte.`}</span>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-2.5" data-anchor="cas:beyond">
          {V23 ? (
            <>
              <Tip content="Cas fusionnés en v2.1 : ils n'ont pas de valeur propre, leur valeur est comptée dans le cas hôte.">
                <span className="mr-1 cursor-help text-[11px] font-semibold uppercase tracking-[0.08em] text-[#AFC0FF]">Fusionnés · {MERGED.length}</span>
              </Tip>
              {MERGED.map((c) => (
                <Tip key={c.id} content={c.titre}>
                  <button type="button" onClick={() => open(c.id)} className="flex items-center gap-1.5 rounded-full bg-white/[0.04] px-2.5 py-1 text-[11.5px] text-[var(--txt-2)] ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.08]">
                    <Dot color={FAM_COLOR[c.id[0]]} size={7} /><span className="num">{c.id}</span><span className="text-[var(--mut)]">→ {c.merged_into}</span>
                  </button>
                </Tip>
              ))}
            </>
          ) : (
            <>
            <Tip content={`Valeur d'un autre type que la masse salariale : indicative, non additive aux ${fr(META.eco, 0)} MDH. Elle n'entre pas dans la carte.`}>
              <span className="mr-1 cursor-help text-[11px] font-semibold uppercase tracking-[0.08em] text-[#AFC0FF]">Hors masse salariale</span>
            </Tip>
            {outFams.map((f) => (
              <button key={f.code} type="button" onClick={() => { setScope("out"); setFam(fam === f.code ? "all" : f.code); }}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] ring-1 transition-colors ${fam === f.code ? "bg-white/[0.14] text-white ring-white/25" : "bg-white/[0.04] text-[var(--txt-2)] ring-white/[0.07] hover:bg-white/[0.08]"}`}>
                <Dot color={FAM_COLOR[f.code]} size={7} />{f.name}<span className="num text-[var(--mut)]">{f.n}</span>
              </button>
            ))}
            </>
          )}
        </div>
      </Card>
      <Card title={<>{list.length} cas <Sub>· sur {CASES.length}</Sub></>} right={
        <div className="flex items-center gap-1 text-[11.5px] text-[var(--mut)]"><I.sort size={14} />
          {(["mdh", "roi", "id"] as Sort[]).map((k) => <button key={k} type="button" onClick={() => setSort(k)} className={`rounded-md px-1.5 py-0.5 ${sort === k ? "bg-white/[0.12] text-white" : "hover:text-white"}`}>{k === "mdh" ? (V23 ? "Gains" : "Économie") : k === "roi" ? "ROI" : "N°"}</button>)}
        </div>} bodyClass="flex flex-col">
        <div className="flex flex-col gap-2 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Segmented<"all" | "in" | "out"> size="sm" layoutId="cas-scope" value={scope} onChange={setScope} anchorPrefix="cas:scope:"
              options={V23 ? [{ id: "all", label: "Tous" }, { id: "in", label: "Dans le business case" }, { id: "out", label: `Fusionnés · ${MERGED.length}` }] : [{ id: "all", label: "Tous" }, { id: "in", label: `Dans les ${fr(META.eco, 0)} MDH` }, { id: "out", label: "Hors masse salariale" }]} />
            <div className="relative ml-auto">
              <select value={fam} onChange={(e) => setFam(e.target.value)} className="h-7 max-w-[200px] appearance-none truncate rounded-full bg-white/[0.06] pl-3 pr-7 text-[12px] text-[var(--txt-2)] outline-none ring-1 ring-white/[0.08]">
                <option value="all" className="bg-[#0C1226]">Toutes familles</option>
                {DATA.fams.map((f) => <option key={f.code} value={f.code} className="bg-[#0C1226]">{f.name}</option>)}
              </select>
              <I.chevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", ...[...new Set(CASES.map((c) => c.vague))].sort()].map((v) => <button key={v} type="button" className={chip(vague === v)} onClick={() => setVague(v)}>{v === "all" ? "Toutes vagues" : v}</button>)}
            <div className="relative ml-auto">
              <select value={brique} onChange={(e) => setBrique(e.target.value)} className="h-7 max-w-[230px] appearance-none truncate rounded-full bg-white/[0.06] pl-3 pr-7 text-[12px] text-[var(--txt-2)] outline-none ring-1 ring-white/[0.08]">
                <option value="all" className="bg-[#0C1226]">Toutes briques</option>
                {DATA.briques.map((b) => <option key={b.name} value={b.name} className="bg-[#0C1226]">{b.name}</option>)}
              </select>
              <I.chevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mut)]" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-[46px_minmax(0,1fr)_34px_62px_40px] gap-2.5 border-b border-white/[0.07] px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">
          <span>N°</span><span>Cas</span><span>Vague</span><Tip content={V23 ? `${cap(LBL.gains)} ${HEAD.year}, en MDH (millions de dirhams).` : "Économie annuelle au plein régime, en MDH (millions de dirhams)."}><span className="cursor-help text-right">MDH</span></Tip><Tip content={V23 ? "Dirhams de gains bruts pour 1 dirham de coût." : "Dirhams économisés pour 1 dirham d'agents."}><span className="cursor-help text-right">ROI</span></Tip>
        </div>
        <div className={`${s.thinScroll} -mr-2 min-h-0 flex-1 overflow-y-auto pr-1`}>
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => open(c.id)} onMouseEnter={() => setHover(c.id)} onMouseLeave={() => setHover(null)} data-anchor={`case-row:${c.id}`}
              className={`grid w-full grid-cols-[46px_minmax(0,1fr)_34px_62px_40px] items-center gap-2.5 rounded-[10px] px-2 py-[7px] text-left transition-colors ${hover === c.id ? "bg-white/[0.08]" : "hover:bg-white/[0.05]"}`}>
              <span className="num text-[12px] font-bold" style={{ color: FAM_COLOR[c.id[0]] }}>{c.id}</span>
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] text-[var(--txt)]">{c.titre}</span>
                <span className="mt-1 flex items-center gap-2"><MiniBar value={c.mdh} max={maxM} color={FAM_COLOR[c.id[0]]} className="w-24" h={3} /><span className="truncate text-[10.5px] text-[var(--mut)]"><span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: BRIQUE_COLOR[c.brique] }} />{c.brique}</span></span>
              </span>
              <span className="text-[11.5px] text-[var(--txt-2)]">{c.vague}</span>
              <span className="num text-right text-[13.5px] text-white">{c.mdh ? fr(c.mdh, 1) : V23 ? (c.merged_into ? <Tip content={`Fusionné dans ${c.merged_into} : sa valeur est comptée dans ce cas.`}><span className="cursor-help rounded-full bg-white/[0.07] px-1.5 py-[1px] text-[10px] font-semibold text-[var(--txt-2)]">fusionné</span></Tip> : "—") : !in302(c) && c.value_out ? <Tip content={<>{c.value_out} — indicatif, non additif.</>}><span className="cursor-help rounded-full bg-[rgba(91,124,255,.14)] px-1.5 py-[1px] text-[10px] font-semibold text-[#AFC0FF]">hors MS</span></Tip> : "—"}</span>
              <span className="num text-right text-[12px] text-[var(--txt-2)]">{c.roi ? fr(c.roi, 2) : "—"}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================ Gouvernance et risques */
const IMPACT: Record<string, { bg: string; fg: string }> = {
  Critique: { bg: "rgba(224,122,111,.16)", fg: "#EE9A90" }, "Élevé": { bg: "rgba(226,176,90,.15)", fg: "#E9C27F" }, Moyen: { bg: "rgba(255,255,255,.07)", fg: "var(--txt-2)" },
};
export function Gouvernance() {
  const { h: vh } = useViewport();
  const clampP = vh < 860 ? 1 : 2;
  const lv = DATA.levels.slice(1);
  // v13 risk about the 160 MDH agent budget: in v23 the same cap is quoted at the programme cost of the business case
  const risks = DATA.risks.map((r) => (V23 ? { ...r, risque: r.risque.replace("Coût des agents au-dessus de 160 MDH", `Coût du programme au-dessus de ${fr(HEAD.cout, 0)} MDH`) } : r));
  const lvColor = ["#8D97B0", "#7C93D6", "#A88FD0", "#5FB3A8", "#E07A6F"];
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
      <div className="flex min-h-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
        <div className="rounded-[18px] px-5 py-5" style={{ background: "linear-gradient(140deg, rgba(91,124,255,.20), rgba(91,124,255,.05))", boxShadow: "inset 0 0 0 1px rgba(91,124,255,.28)" }}>
          <div className="eyebrow !text-[10px] !text-[#AFC0FF]">Règle d&apos;or</div>
          <p className="h-display mt-2 text-[clamp(20px,1.55vw,28px)] text-white">L&apos;agent prépare et exécute. L&apos;humain valide les exceptions et signe l&apos;irréversible.</p>
          <p className={`mt-2 text-[12.5px] leading-snug text-[var(--txt-2)] ${vh < 860 ? "hidden" : ""}`}>Paiements, paie, envois aux organismes, données de santé : aucun acte irréversible sans signature humaine. Chaque agent a un responsable, un budget et un arrêt d&apos;urgence.</p>
        </div>
        <Card title={<>Instances <Sub>· qui décide quoi</Sub></>} className="flex-1">
          <div className="flex h-full flex-col justify-between gap-1">
            {DATA.gouv.map((g, i) => (
              <div key={g.id} className="flex items-start gap-3 border-b border-white/[0.05] pb-[clamp(5px,0.8vh,10px)] last:border-0">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[11px] font-bold text-[var(--txt-2)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><span className="text-[13.5px] font-semibold text-white">{g.name}</span>{g.cadence && <span className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[10.5px] text-[var(--txt-2)]">{g.cadence}</span>}</div>
                  <p className="mt-0.5 text-[12px] leading-snug text-[var(--mut)]" style={{ display: "-webkit-box", WebkitLineClamp: clampP, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card title={<>Risques et parades <Sub>· {DATA.risks.length} risques suivis chaque mois</Sub></>} right={
        <div className="flex gap-1.5">{Object.entries(IMPACT).map(([k, v]) => <span key={k} className="rounded-full px-2 py-[2px] text-[10.5px] font-semibold" style={{ background: v.bg, color: v.fg }}>{k} · {DATA.risks.filter((r) => r.impact === k).length}</span>)}</div>}>
        <div className="flex h-full flex-col">
          <div className="grid grid-cols-[minmax(0,0.9fr)_74px_minmax(0,1.6fr)] gap-3 border-b border-white/[0.07] px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]"><span>Risque</span><span>Impact</span><span>Parade</span></div>
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            {risks.map((r) => (
              <div key={r.risque} className="grid grid-cols-[minmax(0,0.9fr)_74px_minmax(0,1.6fr)] items-start gap-3 border-b border-white/[0.04] px-1 py-[clamp(4px,0.6vh,8px)] last:border-0">
                <span className="text-[12.5px] font-medium leading-snug text-white">{r.risque}</span>
                <span><span className="inline-block rounded-full px-2 py-[2px] text-[10.5px] font-semibold" style={{ background: IMPACT[r.impact]?.bg, color: IMPACT[r.impact]?.fg }}>{r.impact}</span></span>
                <Tip content={r.parade}><span className="block text-[12px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: clampP, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.parade}</span></Tip>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="flex min-h-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
        <Card title={<>Sensibilité des données <Sub>· quel modèle a le droit de lire quoi</Sub></>} className="flex-1">
          <div className="flex h-full flex-col justify-between gap-1.5">
            {lv.map((row, i) => {
              const [name, ...rest] = row[0].split(" ");
              return (
                <div key={row[0]} className="flex items-start gap-3">
                  <span className="num mt-0.5 grid h-7 min-w-[38px] place-items-center rounded-[8px] text-[12px]" style={{ background: `color-mix(in srgb, ${lvColor[i]} 22%, transparent)`, color: lvColor[i] }}>{name}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12.5px] font-semibold text-white">{rest.join(" ")} <span className="font-normal text-[var(--mut)]">· {row[3]}</span></div>
                    <Tip content={<><b>Exemples :</b> {row[1]}<br /><b>Modèles :</b> {row[2]}</>}><p className="text-[11.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{row[2]}</p></Tip>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title={<>Socle de confiance</>}>
          <div className="grid grid-cols-2 gap-2">
            {DATA.confiance.map((c) => (
              <div key={c.name} className="rounded-[12px] bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]">
                <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-white"><I.shieldCheck size={14} className="text-[#7FD9B5]" />{c.name}</div>
                <div className="mt-0.5 text-[11.5px] text-[var(--mut)]">{c.desc}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================ Emplois */
/** Share of a family's paid FTE taken over, on a 10-people scale: v13 = the v1.0 hypothesis, v23 = freed FTE of its cases over its paid FTE. */
const part10 = (f: (typeof FAMS)[number]) => (V23 ? (f.etp ? (f.postes / f.etp) * 10 : 0) : f.part * 10);
export function Emplois() {
  const a = DATA.abs;
  const openings = V23 ? etabIn(FINAL_YEAR) - etabIn(2026) : META.etab_2028 - META.etab;
  // v23: the departures per year come from the business-case hypotheses (turnover of the internal HR reporting)
  const dep = hyp(/^Départs par an/);
  const departs = Number(dep?.value ?? 0);
  const ratio = departs ? HEAD.etp / departs : 0;
  const cap = a.capacite_3ans;
  const absorb = V23 ? HEAD.etp : a.postes_admin;
  const capacity = V23 ? departs : cap;
  const max = Math.max(capacity, absorb);
  const pFam = FAM["P"];
  const roles = [...DATA.roles].sort((x, y) => y.etp - x.etp);
  const { h: vh } = useViewport();
  const nRoles = vh < 800 ? 6 : vh < 950 ? 9 : 13;
  const shown = roles.slice(0, nRoles);
  const rest = roles.slice(nRoles);
  const maxR = shown[0]?.etp ?? 1;
  const steps = V23 ? [
    { n: "1", t: "Départs non remplacés", v: fr(departs, 0), u: "départs par an (2026)", d: <>{dep?.note ? `${dep.note}. ` : ""}Les {fr(HEAD.etp, 0)} ETP-éq. libérés en {HEAD.year} représentent {ratio < 1 ? "moins d'une année" : `${fr(ratio, 1)} années`} de départs.</> },
    { n: "2", t: "Mobilité vers les ouvertures", v: fr(openings, 0), u: `nouveaux établissements d'ici ${FINAL_YEAR}`, d: <>Les {openings} nouveaux établissements prévus d&apos;ici {FINAL_YEAR} ({etabIn(2026)} → {etabIn(FINAL_YEAR)}) sont pourvus par mobilité interne, après l&apos;académie des pilotes.</> },
    { n: "3", t: "Recrutements évités", v: fr(pFam.postes, 0), u: `ETP-éq. libérés au paramédical en ${HEAD.year}`, d: <>Ces ETP-éq. (équivalents temps plein) réduisent les recrutements de soignants pour les ouvertures, dans un pays qui manque d&apos;infirmiers.</> },
  ] : [
    { n: "1", t: "Départs non remplacés", v: fr(a.departs_admin_an, 0), u: "départs administratifs par an", d: <>{pct(META.turnover, 1)} de rotation sur {fr(META.admin, 0)} administratifs : {fr(a.annees_departs, 1)} années de départs suffisent à absorber les postes repris.</> },
    { n: "2", t: "Mobilité vers les ouvertures", v: `${fr(a.postes_admin_ouvertures_lits, 0)} à ${fr(a.postes_admin_ouvertures, 0)}`, u: "postes administratifs à pourvoir", d: <>Les {openings} nouveaux établissements prévus d&apos;ici 2028 ({META.etab} → {META.etab_2028}) sont pourvus par mobilité interne, après l&apos;académie des pilotes.</> },
    { n: "3", t: "Recrutements évités", v: fr(a.soignants_ouvertures, 0), u: "soignants à recruter pour les ouvertures", d: <>Les {fr(pFam.postes, 0)} ETP-éq. (équivalents temps plein) libérés au paramédical réduisent ces recrutements, dans un pays qui manque d&apos;infirmiers.</> },
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
      <div className="flex min-h-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-6 rounded-[18px] px-6 py-5" style={{ background: "linear-gradient(140deg, rgba(76,199,154,.16), rgba(76,199,154,.04))", boxShadow: "inset 0 0 0 1px rgba(76,199,154,.25)" }}>
          <div className="flex items-baseline gap-3"><span className="num text-[clamp(64px,5.4vw,104px)] font-[800] leading-[0.85] text-white">0</span><span className="text-[clamp(16px,1.2vw,22px)] font-semibold leading-tight text-[#7FD9B5]">licenciement</span></div>
          <p className="text-[clamp(14px,1vw,17px)] leading-snug text-[var(--txt)]">
            {V23 ? (
              <>Les <b className="num text-white">{fr(HEAD.etp, 0)}</b> ETP-éq. (équivalents temps plein) libérés en {HEAD.year} se résorbent par la vie normale du groupe : {ratio < 1 ? "moins d'une année" : `${fr(ratio, 1)} années`} de départs naturels (<b className="num text-white">{fr(departs, 0)}</b> par an en 2026).</>
            ) : (
              <>Les <b className="num text-white">{fr(a.postes_admin, 0)}</b> postes administratifs repris par les agents se résorbent par la vie normale du groupe : en 3 ans, départs et ouvertures offrent <b className="num text-white">{fr(cap, 0)}</b> places.</>
            )}
          </p>
        </div>
        <Card title={<>La balance <Sub>· en ETP{V23 ? "-éq." : ""} (équivalents temps plein){V23 ? "" : " administratifs"}</Sub></>} className="flex-1" bodyClass="flex flex-col justify-center">
          <div className="flex flex-col gap-[clamp(10px,2vh,22px)]">
            {V23 ? (
              <>
                <Balance label="À absorber" sub={`ETP-éq. libérés en ${HEAD.year}, toutes familles`} parts={[{ v: HEAD.etp, c: "#E5A57A", l: "ETP-éq. libérés" }]} max={max} />
                <Balance label="Départs naturels" sub="en une année, au rythme de 2026" parts={[{ v: departs, c: "#4CC79A", l: "départs en un an" }]} max={max} />
              </>
            ) : (
              <>
                <Balance label="À absorber" sub="postes administratifs repris (administratif des sites + siège)" parts={[{ v: a.postes_admin, c: "#E5A57A", l: "postes repris" }]} max={max} />
                <Balance label="Capacité en 3 ans" sub={`3 années de départs + ouvertures (fourchette basse)`} parts={[{ v: a.departs_admin_an * 3, c: "#4CC79A", l: "départs sur 3 ans" }, { v: cap - a.departs_admin_an * 3, c: "#9FB3FF", l: "postes des ouvertures" }]} max={max} />
              </>
            )}
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-[clamp(10px,0.8vw,16px)]">
          {steps.map((st) => (
            <div key={st.n} className={`${s.card} flex min-h-0 flex-col rounded-[18px] p-[clamp(14px,1.1vw,20px)]`}>
              <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-white/[0.08] text-[11.5px] font-bold text-white">{st.n}</span><span className="text-[13.5px] font-semibold text-white">{st.t}</span></div>
              <div className="num mt-3 text-[clamp(26px,2.1vw,38px)] font-[800] leading-none text-white">{st.v}</div>
              <div className="mt-1 text-[12px] text-[var(--mut)]">{st.u}</div>
              <p className="mt-3 text-[12.5px] leading-snug text-[var(--txt-2)]">{st.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
        <Card title={<>Sur 10 temps pleins, combien sont repris <Sub>· par famille, {V23 ? HEAD.year : "plein régime"}</Sub></>}>
          <div className="flex flex-col gap-[clamp(6px,1vh,12px)]">
            {FAMS.map((f) => (
              <div key={f.code} className="grid grid-cols-[minmax(0,150px)_auto_1fr] items-center gap-4">
                <div className="min-w-0"><div className="truncate text-[13px] font-medium text-white">{f.name}</div><div className="text-[11px] text-[var(--mut)]">{fr(f.etp, 0)} ETP payés</div></div>
                <Pictogram value={part10(f)} color={FAM_COLOR[f.code]} size={26} gap={4} />
                <div className="num text-right text-[18px] text-white">{fr(part10(f), part10(f) % 1 ? 1 : 0)}<span className="text-[12px] font-semibold text-[var(--mut)]"> / 10</span></div>
              </div>
            ))}
          </div>
        </Card>
        <Card title={<>Métiers concernés <Sub>· ETP-éq. libérés dans le groupe</Sub></>} className="flex-1">
          <div className="flex h-full flex-col justify-between">
            {shown.map((r) => (
              <div key={r.metier} className="grid grid-cols-[minmax(0,1fr)_minmax(80px,0.8fr)_44px] items-center gap-3">
                <span className="truncate text-[12.5px] text-[var(--txt)]">{r.metier}</span>
                <MiniBar value={r.etp} max={maxR} color={FAM_COLOR[r.ids[0][0]]} h={5} />
                <span className="num text-right text-[13px] text-white">{fr(r.etp, 0)}</span>
              </div>
            ))}
            <div className="pt-1 text-[11.5px] text-[var(--mut)]">+ {rest.length} autres métiers : {fr(rest.reduce((x, r) => x + r.etp, 0), 0)} ETP-éq.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
function Balance({ label, sub, parts, max }: { label: string; sub: string; parts: { v: number; c: string; l: string }[]; max: number }) {
  const total = parts.reduce((a, p) => a + p.v, 0);
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)_70px] items-center gap-4">
      <div><div className="text-[13px] font-semibold text-white">{label}</div><div className="text-[11px] leading-tight text-[var(--mut)]">{sub}</div></div>
      <div className="relative flex h-7 overflow-hidden rounded-[8px] bg-white/[0.04]">
        {parts.map((p, i) => (
          <Tip key={i} content={`${p.l} : ${fr(p.v, 0)}`} className="block h-full" style={{ width: `${(p.v / max) * 100}%` }}>
            <motion.div className="h-full" style={{ background: p.c, opacity: 0.85 }} initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 0.8, delay: 0.2 + i * 0.3 }} />
          </Tip>
        ))}
      </div>
      <span className="num text-right text-[18px] text-white">{fr(total, 0)}</span>
    </div>
  );
}

/* ================================================================ Déploiement */
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function Deploiement() {
  const select = useApp((st) => st.select);
  // months from Nov 2026 (0) to Dec of the last year: 2029 (v13, full regime) or 2031 (v23, horizon of the business case)
  const endY = V23 ? FINAL_YEAR : 2029;
  const m = (y: number, mo: number) => (y - 2026) * 12 + (mo - 11);
  const span = m(endY, 12) + 1;
  const ticks = Array.from({ length: endY - 2026 }, (_, i) => 2027 + i);
  const W = DATA.waves;
  const adoption = (k: string) => FIN.adoption.find((x) => x.vague === k);
  // V4 runs from its first year to the end of the timeline
  const whenOf = (w: (typeof W)[number]) => (V23 && w.k === "V4" && adoption("V4") ? `${adoption("V4")!.debut} → ${endY}` : w.when);
  const rows: { k: string; label: string; when: string; a: number; b: number; color: string; milestone?: boolean; mdh?: number }[] = [
    { k: "cadrage", label: "Cadrage", when: "nov. 2026", a: m(2026, 11), b: m(2026, 11) + 1, color: "#8D97B0" },
    { k: "V1", label: "V1", when: W[0].when, a: m(2026, 12) + 0.5, b: m(2027, 3) + 0.5, color: "#7C93D6", mdh: W[0].mdh },
    { k: "codir", label: "Décision CODIR", when: "avril 2027", a: m(2027, 4), b: m(2027, 4) + 0.3, color: "#E2B05A", milestone: true },
    { k: "V2", label: "V2", when: W[1].when, a: m(2027, 4), b: m(2027, 7) + 1, color: "#6E8BE8", mdh: W[1].mdh },
    { k: "V3", label: "V3", when: W[2].when, a: m(2027, 9), b: m(2027, 12) + 1, color: "#5FB3A8", mdh: W[2].mdh },
    { k: "V4", label: "V4", when: whenOf(W[3]), a: m(2028, 1), b: m(endY, 12) + 1, color: "#4CC79A" },
  ];
  const pctX = (v: number) => `${(v / span) * 100}%`;
  const chips = (ids: string[]) => (
    <div className="mt-1.5 flex min-h-0 flex-wrap content-start gap-1 overflow-hidden">
      {[...ids].sort((a, b) => Number(!(CASE[a] && counted(CASE[a]))) - Number(!(CASE[b] && counted(CASE[b])))).slice(0, 24).map((id) => (
        <Tip key={id} content={CASE[id]?.titre}>
          <button type="button" onClick={() => select({ kind: "case", id })} className="num rounded-[6px] bg-white/[0.05] px-1.5 py-[3px] text-[11px] ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.14]" style={{ color: FAM_COLOR[CASE[id]?.fam || id[0]] }}>{id}</button>
        </Tip>
      ))}
      {ids.length > 24 && <span className="num rounded-[6px] px-1.5 py-[3px] text-[11px] text-[var(--mut)]">+{ids.length - 24}</span>}
    </div>
  );
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-[clamp(10px,1.3vh,18px)]">
      <Card title={<>Calendrier <Sub>· {V23 ? `de novembre 2026 à l'horizon ${FINAL_YEAR}` : "de novembre 2026 au plein régime fin 2029"}</Sub></>}>
        <div className="relative pl-[150px]">
          <div className="relative h-6 border-b border-white/[0.08]">
            {ticks.map((y) => <div key={y} className="absolute top-0 -translate-x-1/2 text-[12px] font-semibold text-[var(--txt-2)]" style={{ left: pctX(m(y, 1)) }}>{y}</div>)}
          </div>
          {ticks.map((y) => <div key={y} className="absolute bottom-0 top-6 w-px bg-white/[0.06]" style={{ left: `calc(150px + (100% - 150px) * ${m(y, 1) / span})` }} />)}
          <div className="flex flex-col gap-[clamp(3px,0.5vh,6px)] pt-2">
            {rows.map((r, i) => (
              <div key={r.k} className="relative h-[clamp(30px,3.7vh,38px)]">
                <div className="absolute -left-[150px] top-1/2 flex w-[140px] -translate-y-1/2 flex-col">
                  <span className="truncate text-[13px] font-semibold leading-tight text-white">{r.label}</span>
                  <span className="truncate text-[10.5px] leading-tight text-[var(--mut)]">{r.when}</span>
                </div>
                {V23 && r.mdh ? <span className="num absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] text-[var(--txt-2)]" style={{ left: `calc(${pctX(r.b)} + 8px)` }}>{fr(r.mdh, 1)} MDH</span> : null}
                {r.milestone ? (
                  <motion.div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px]" style={{ left: pctX(r.a), background: r.color }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.12 }} />
                ) : (
                  <motion.div className="absolute top-1/2 flex h-full -translate-y-1/2 items-center overflow-hidden rounded-[8px] px-2.5" data-anchor={`wave:${r.k}`}
                    style={{ left: pctX(r.a), background: `color-mix(in srgb, ${r.color} 55%, #0B1124)`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)" }}
                    initial={{ width: 0 }} animate={{ width: pctX(r.b - r.a) }} transition={{ duration: 0.7, delay: 0.2 + i * 0.12, ease: [0.2, 0.8, 0.2, 1] }}>
                    {r.mdh && !V23 ? <span className="num whitespace-nowrap text-[12px] text-white">{fr(r.mdh, 1)} MDH</span> : r.k === "V4" ? <span className="whitespace-nowrap text-[12px] font-medium text-white">tout le groupe, ouvertures comprises</span> : null}
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
      <div className="grid min-h-0 grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <div className="grid min-h-0 grid-cols-4 gap-[clamp(8px,0.7vw,14px)]">
          {W.map((w) => {
            const roi = w.cout ? w.mdh / w.cout : 0;
            const ad = V23 ? adoption(w.k) : undefined;
            const showStats = w.mdh > 0 && !(V23 && w.k === "V4");
            return (
              <div key={w.k} className={`${s.card} flex min-h-0 flex-col rounded-[18px] p-[clamp(12px,1vw,18px)]`} data-anchor={`wave-card:${w.k}`}>
                <div className="flex items-center gap-2"><span className="num rounded-[8px] px-2 py-0.5 text-[14px] text-white" style={{ background: `color-mix(in srgb, ${rows.find((r) => r.k === w.k)?.color ?? "#888"} 45%, transparent)` }}>{w.k}</span><span className="truncate text-[11.5px] text-[var(--mut)]">{whenOf(w)}</span></div>
                <div className="mt-2 text-[14px] font-semibold leading-snug text-white">{w.what}</div>
                {ad && (
                  <div className="mt-1.5 text-[11px] leading-snug text-[var(--mut)]">Adoption {Object.keys(ad.values)[0]} → {FINAL_YEAR} : <span className="num text-[var(--txt-2)]">{Object.values(ad.values).map((v) => pct(v, 0)).join(" · ")}</span></div>
                )}
                {showStats ? (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-2 border-y border-white/[0.06] py-2.5">
                      <div><div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">MDH/an</div><div className="num text-[clamp(17px,1.25vw,22px)] text-[#7FD9B5]">{fr(w.mdh, 1)}</div></div>
                      <div><div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Coût</div><div className="num text-[clamp(17px,1.25vw,22px)] text-[var(--txt-2)]">{fr(w.cout, 1)}</div></div>
                      <div><div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">ROI</div><div className="num text-[clamp(17px,1.25vw,22px)] text-[#E9C27F]">{fr(roi, 2)}</div></div>
                    </div>
                    <div className="mt-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">{w.ids.length} cas · {V23 ? `${w.ids.filter((id) => CASE[id] && counted(CASE[id])).length} chiffrés` : `${w.ids.filter((id) => CASE[id] && counted(CASE[id])).length} dans les ${fr(META.eco, 0)} MDH`}</div>
                    {chips(w.ids)}
                  </>
                ) : (
                  <>
                    <p className="mt-3 text-[12.5px] leading-snug text-[var(--txt-2)]">
                      {V23
                        ? <>Généralisation des cas validés à tous les établissements, y compris les {etabIn(FINAL_YEAR) - etabIn(2026)} ouvertures d&apos;ici {FINAL_YEAR} ({etabIn(2026)} → {etabIn(FINAL_YEAR)}). Les gains bruts atteignent {fr(HEAD.gains, 0)} MDH par an en {HEAD.year}.</>
                        : <>Généralisation des cas validés à tous les établissements, y compris les {META.etab_2028 - META.etab} ouvertures. Le gain atteint {fr(META.eco, 0)} MDH par an fin 2029.</>}
                    </p>
                    {V23 && w.ids.length > 0 && chips(w.ids)}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <Card title={<>Montée en charge <Sub>· MDH par an</Sub></>} bodyClass="flex flex-col">
          <div className="min-h-0 flex-1"><RampChart compact /></div>
          <div className="mt-2"><RampLegend /></div>
          <p className="mt-2 text-[11.5px] leading-snug text-[var(--mut)]">{V23 ? `Part des gains bruts atteinte (rapportée à ${FINAL_YEAR})` : "Part de l'économie atteinte"} : {YEARS.filter((y) => y > 2026).map((y) => `${y} ${pct(share(y).eco, 0)}`).join(" · ")}.</p>
        </Card>
      </div>
    </div>
  );
}

/* ================================================================ Sources */
const gapTitle = (g: string) => { const m = g.match(/^([^:]{3,80}):\s*/); const raw = m ? m[1] : g.split(/[.;]/)[0]; const low = raw.toLowerCase(); return low.charAt(0).toUpperCase() + low.slice(1); };
const gapBody = (g: string) => g.replace(/^([^:]{3,80}):\s*/, "");
const domainOf = (u: string) => { try { return new URL(u.trim()).hostname.replace(/^www\./, ""); } catch { return null; } };

type SourcesTab = "prog" | "net" | "cas";
/** Sources of the programme figures: the v1.3 table, or the v2.3 table of the business case (same financial statements, plus the notes). */
const PROG_ROWS: { donnee: string; source: string; ref: string }[] = V23
  ? FIN.sources_akdital.map((r) => ({ donnee: String(r["Donnée"] ?? ""), source: String(r["Source"] ?? "—"), ref: String(r["Référence"] ?? "—") }))
  : DATA.sources;
export function Sources() {
  // opened from a case dossier ("Voir toutes les sources") -> straight to the per-case view
  const [tab, setTab] = useState<SourcesTab>(() => sourcesIntent.tab ?? (sourcesIntent.caseId ? "cas" : "prog"));
  useEffect(() => { sourcesIntent.tab = null; }, []);
  return (
    <div className="flex h-full min-h-0 flex-col gap-[clamp(8px,1vh,14px)]">
      <div className="flex items-center gap-3">
        <Segmented<SourcesTab> size="sm" layoutId="sources-tab" value={tab} onChange={setTab} anchorPrefix="sources:"
          options={[{ id: "prog", label: "Chiffres du programme" }, { id: "net", label: "Réseau Akdital" }, { id: "cas", label: "Par cas" }]} />
        <span className="text-[12px] text-[var(--mut)]">{tab === "prog" ? `${PROG_ROWS.length} sources pour la masse salariale, les effectifs et le marché` : tab === "net" ? `${SITES.length} établissements et ${INTERNATIONAL.length} projets internationaux, chacun sourcé` : PAR_CAS_SUMMARY}</span>
      </div>
      <div className="min-h-0 flex-1">{tab === "prog" ? <SourcesProgramme /> : tab === "net" ? <SourcesReseau /> : <SourcesParCas />}</div>
    </div>
  );
}

function SourcesProgramme() {
  const rec = hyp(/^Marge sur CA récupéré/), nouv = hyp(/^Marge contributive/);
  const idx = [hyp(/^Hausse annuelle des salaires/), hyp(/^Hausse annuelle des prix/), hyp(/^Taux d'actualisation/), hyp(/^Contingence/)];
  const hx = (h: ReturnType<typeof hyp>) => (h ? pct(Number(h.value), 0) : "—");
  const gaps: { t: string; d: ReactNode }[] = V23 ? [
    { t: "Marges sur le CA additionnel", d: <>Marge de {hx(rec)} sur le CA récupéré ({rec?.note}), de {hx(nouv)} sur l&apos;activité nouvelle ({nouv?.note}). Ces deux taux sont des hypothèses modifiables : seule la marge entre dans la valeur, jamais le CA lui-même.</> },
    { t: "Hypothèses de chiffrage", d: <>Salaires +{hx(idx[0])} par an, prix +{hx(idx[1])}, actualisation (VAN) à {hx(idx[2])}, contingence de {hx(idx[3])} sur les coûts : toutes sont des hypothèses. La part du temps reprise est estimée cas par cas, puis vérifiée par chronométrage au site pilote (point zéro).</> },
    { t: "Effectifs par famille non publiés", d: <>{DATA.sources.find((x) => /Effectifs par famille/.test(x.donnee))?.source ?? "Reporting RH interne"}. À confirmer avec la DRH au point zéro.</> },
    { t: "Hôpital type = moyenne", d: <>Les chiffres « hôpital type » divisent le groupe par le nombre d&apos;établissements de l&apos;année ({etabIn(2026)} en 2026, {etabIn(FINAL_YEAR)} en {FINAL_YEAR}), hors siège. Les effectifs dessinés en 3D sont illustratifs.</> },
  ] : [
    { t: `${fr(META.budget, 0)} MDH : coût ou gain net ?`, d: META.flag_160 },
    { t: "Effectifs par famille non publiés", d: <>{DATA.sources.find((x) => /Effectifs par famille/.test(x.donnee))?.source ?? "Reporting RH interne"}. À confirmer avec la DRH au point zéro.</> },
    { t: "Part reprise par cas = hypothèse", d: <>La répartition du gisement d&apos;une famille entre ses cas est une hypothèse, vérifiée par chronométrage au site pilote (point zéro).</> },
    { t: "Hôpital type = moyenne", d: <>Les chiffres « hôpital type » divisent le groupe par {ETAB} établissements, hors siège. Les effectifs dessinés en 3D sont illustratifs.</> },
  ];
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
      <Card title={<>D&apos;où vient chaque chiffre <Sub>· sources publiques et internes</Sub></>}>
        <div className="flex h-full flex-col">
          <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-4 border-b border-white/[0.07] px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]"><span>Donnée</span><span>Source</span><span>Référence</span></div>
          <div className="flex min-h-0 flex-1 flex-col justify-between">
            {PROG_ROWS.map((r) => (
              <div key={r.donnee} className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-start gap-4 border-b border-white/[0.04] px-1 py-[clamp(3px,0.6vh,8px)] last:border-0">
                <Tip content={r.donnee}><span className="block text-[12.5px] leading-snug text-white" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.donnee}</span></Tip>
                <span className="text-[12px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.source}</span>
                <span className="flex min-w-0 items-start gap-1.5 text-[11.5px] text-[var(--mut)]"><I.link size={13} className="mt-[1px] shrink-0" /><span className="truncate">{r.ref}</span></span>
              </div>
            ))}
          </div>
        </div>
      </Card>
      <Card title={<>Ce qui reste à confirmer <Sub>· en toute transparence</Sub></>}>
        <div className="flex h-full flex-col justify-between gap-2">
          {gaps.map((g, i) => (
            <div key={g.t} className="flex items-start gap-3">
              <span className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold" style={{ background: i === 0 ? "rgba(226,176,90,.18)" : "rgba(255,255,255,.07)", color: i === 0 ? "#E9C27F" : "var(--txt-2)" }}>{i + 1}</span>
              <div className="min-w-0"><div className="text-[13.5px] font-semibold text-white">{g.t}</div><p className="mt-0.5 text-[12.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{g.d}</p></div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SourcesReseau() {
  const ops = SITES.filter((x) => x.status === "opérationnel").length;
  const cons = SITES.filter((x) => x.status === "en construction").length;
  const ann = SITES.filter((x) => x.status === "projet annoncé").length;
  const urls = SITES.flatMap((x) => (x.sources?.length ? x.sources : x.source.split(" ; "))).concat(INTERNATIONAL.flatMap((x) => x.sources ?? [x.source]));
  const dom = new Map<string, number>();
  for (const u of urls) { const d = domainOf(u); if (d) dom.set(d, (dom.get(d) ?? 0) + 1); }
  const domains = [...dom.entries()].sort((a, b) => b[1] - a[1]);
  const gaps = (NETWORK_META.gaps as unknown[]).map((g) => (typeof g === "string" ? g : JSON.stringify(g)));
  const byCountry = [...new Set(INTERNATIONAL.map((x) => x.country))].map((c) => ({ c, items: INTERNATIONAL.filter((x) => x.country === c) }));
  const stColor = (k?: string) => (k === "opérationnel" ? "var(--green)" : k === "en construction" ? "var(--amber)" : "var(--mut)");
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)] gap-[clamp(10px,0.8vw,16px)]">
      <div className="flex min-h-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
        <Card title={<>Le réseau en chiffres <Sub>· {GROUP.source}</Sub></>}>
          <div className="grid grid-cols-3 gap-2">
            {([[GROUP.establishments, "établissements"], [GROUP.beds, "lits"], [GROUP.cities, "villes"]] as const).map(([v, l]) => (
              <div key={l} className="rounded-[12px] bg-white/[0.04] px-3 py-2 ring-1 ring-white/[0.06]"><div className="num text-[22px] text-white">{fr(v, 0)}</div><div className="text-[11.5px] text-[var(--mut)]">{l}</div></div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--txt-2)]">
            <span className="flex items-center gap-1.5"><Dot color="var(--green)" size={7} />{ops} en service</span>
            <span className="flex items-center gap-1.5"><Dot color="var(--amber)" size={7} />{cons} en construction</span>
            <span className="flex items-center gap-1.5"><Dot color="var(--mut)" size={7} />{ann} annoncés</span>
            <span className="text-[var(--mut)]">objectif 2028 : {GROUP.target2028.establishments} établissements, {fr(GROUP.target2028.beds, 0)} lits</span>
          </div>
        </Card>
        <Card title={<>International <Sub>· hors programme : les {fr(HEAD.gains, 0)} MDH{V23 ? " de gains bruts" : ""} portent sur le Maroc</Sub></>} className="flex-1">
          <div className="flex h-full flex-col justify-between gap-1.5 overflow-hidden">
            {byCountry.map(({ c, items }) => (
              <div key={c}>
                <div className="text-[12.5px] font-semibold text-white">{c}</div>
                {items.map((x, k) => (
                  <Tip key={k} content={x.status} className="block"><div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-[var(--txt-2)]"><Dot color={stColor(x.statusKey)} size={6} /><span className="truncate">{x.city} · {x.project}</span></div></Tip>
                ))}
              </div>
            ))}
          </div>
        </Card>
        <Card title={<>Sources du réseau <Sub>· {domains.length} domaines, {urls.length} références</Sub></>}>
          <div className="flex flex-wrap gap-1.5">
            {domains.slice(0, 10).map(([d, n]) => <span key={d} className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[11.5px] text-[var(--txt-2)] ring-1 ring-white/[0.06]">{d} <span className="num text-[var(--mut)]">{n}</span></span>)}
          </div>
        </Card>
      </div>
      <Card title={<>Réserves de la recherche <Sub>· {gaps.length} points que les sources ne permettent pas de confirmer (survol : texte complet)</Sub></>}>
        <div className="grid h-full grid-cols-2 content-between gap-x-5 gap-y-2">
          {gaps.map((g, i) => (
            <Tip key={i} content={<span className="block max-w-[320px]">{g}</span>} className="block min-w-0">
              <div className="flex cursor-help items-start gap-2.5">
                <span className="mt-[2px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[10px] font-bold text-[var(--txt-2)]">{i + 1}</span>
                <div className="min-w-0"><div className="truncate text-[12.5px] font-semibold text-white">{gapTitle(g)}</div><p className="text-[11.5px] leading-snug text-[var(--mut)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{gapBody(g)}</p></div>
              </div>
            </Tip>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ================================================================ Preuves (what worked elsewhere) */
type Scope = "all" | "in" | "out";
const benchCases = (b: Benchmark) => [...new Set([...b.v13, ...b.app])].filter((id) => CASE[id]);
export function Preuves() {
  const select = useApp((st) => st.select);
  const [fam, setFam] = useState("all");
  const [lvl, setLvl] = useState("all");
  const [scope, setScope] = useState<Scope>("all");
  const measured = useMemo(() => BENCH.filter((b) => b.measured), []);
  const byLevel = (k: string) => measured.filter((b) => levelCode(b.level) === k).length;
  const list = useMemo(() => measured.filter((b) => {
    const cs = benchCases(b).map((id) => CASE[id]);
    if (fam !== "all" && !cs.some((c) => (c.fam || c.id[0]) === fam)) return false;
    if (lvl !== "all" && levelCode(b.level) !== lvl) return false;
    if (scope === "in" && !cs.some((c) => counted(c))) return false;
    if (scope === "out" && !cs.some((c) => !counted(c))) return false;
    return true;
  }).sort((a, b) => (LEVELS.indexOf(levelCode(a.level)) - LEVELS.indexOf(levelCode(b.level))) || (b.year ?? 0) - (a.year ?? 0)), [measured, fam, lvl, scope]);
  const fams = DATA.fams.filter((f) => f.code !== "T");
  const chip = (on: boolean) => `h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors ${on ? "bg-white/[0.16] text-white ring-1 ring-white/25" : "bg-white/[0.04] text-[var(--mut)] ring-1 ring-white/[0.06] hover:text-[var(--txt)]"}`;
  const countries = new Set(measured.map((b) => b.country)).size;
  return (
    <div className="flex h-full min-h-0 flex-col gap-[clamp(8px,1.2vh,14px)]">
      <div className="grid grid-cols-[auto_auto_auto_auto_minmax(0,1fr)] items-stretch gap-[clamp(8px,0.7vw,14px)]">
        <div className={`${s.tile} rounded-[16px] px-4 py-3`}>
          <div className="eyebrow !text-[10px]" style={{ color: "var(--txt-2)" }}>Résultats mesurés</div>
          <div className="mt-1 flex items-baseline gap-1.5"><Num value={measured.length} d={0} from={0} className="text-[clamp(26px,2.2vw,38px)] font-[800] leading-none" /><span className="text-[13px] font-semibold text-[var(--mut)]">/ {BENCH.length} références</span></div>
          <div className="mt-1 text-[11.5px] text-[var(--mut)]">{countries} pays · hôpitaux, publications, éditeurs</div>
        </div>
        {LEVELS.map((k) => (
          <button key={k} type="button" onClick={() => setLvl(lvl === k ? "all" : k)} className={`${s.tile} rounded-[16px] px-4 py-3 text-left transition-colors ${lvl === k ? "!bg-white/[0.1] ring-1 ring-white/25" : "hover:!bg-white/[0.07]"}`} data-anchor={`preuves:level:${k}`}>
            <div className="flex items-center gap-2"><LevelBadge code={k} /><span className="text-[11.5px] font-medium text-[var(--txt-2)]">{LEVEL_LABEL[k]}</span></div>
            <div className="num mt-1 text-[clamp(22px,1.8vw,30px)] font-[800] leading-none" style={{ color: LEVEL_COLOR[k] }}>{byLevel(k)}</div>
          </button>
        ))}
        <div className={`${s.card} flex min-w-0 flex-col justify-center gap-2 rounded-[16px] px-4 py-2.5`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" className={chip(fam === "all")} onClick={() => setFam("all")}>Toutes familles</button>
            {fams.map((f) => (
              <Tip key={f.code} content={f.name}><button type="button" className={chip(fam === f.code)} onClick={() => setFam(f.code)}>
                <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: FAM_COLOR[f.code] }} />{FAM_SHORT[f.code] ?? f.code}
              </button></Tip>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!V23 && (
              <Segmented<Scope> size="sm" layoutId="preuves-scope" value={scope} onChange={setScope} anchorPrefix="preuves:scope:"
                options={[{ id: "all", label: "Tous" }, { id: "in", label: `Dans les ${fr(HEAD.gains, 0)} MDH` }, { id: "out", label: "Hors masse salariale" }]} />
            )}
            <span className="ml-auto text-[12px] text-[var(--mut)]">{list.length} résultat{list.length > 1 ? "s" : ""}</span>
          </div>
        </div>
      </div>
      <div className={`${s.thinScroll} -mr-2 min-h-0 flex-1 overflow-y-auto pr-2`}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(280px,21vw,360px),1fr))] gap-[clamp(8px,0.7vw,12px)] pb-1">
          {list.map((b) => {
            const h = headline(b.result);
            const k = levelCode(b.level);
            const cs = benchCases(b);
            return (
              <article key={b.id} className={`${s.card} flex min-w-0 flex-col rounded-[16px] px-4 py-3.5`} data-anchor={`bench:${b.id}`}>
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-white">{b.who}</div>
                    <div className="truncate text-[11.5px] text-[var(--mut)]">{[b.country, b.year].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Tip content={b.level}><span className="cursor-help"><LevelBadge code={k} /></span></Tip>
                </div>
                {h && <div className="num mt-2 text-[clamp(22px,1.6vw,28px)] font-[800] leading-[1.05] tracking-[-0.03em]" style={{ color: LEVEL_COLOR[k] === "#8D97B0" ? "#fff" : "#fff" }}>{h.big}</div>}
                <Tip content={<span className="block max-w-[340px]">{b.result}{b.reading ? <><br /><br /><b className="text-[var(--txt)]">Lecture Akdital :</b> {b.reading}</> : null}</span>} className="block">
                  <p className="mt-1 cursor-help text-[12.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{b.result}</p>
                </Tip>
                <div className="mt-auto flex items-center gap-1.5 pt-2.5">
                  {cs.slice(0, 4).map((id) => (
                    <Tip key={id} content={CASE[id].titre}>
                      <button type="button" onClick={() => select({ kind: "case", id })} className="num rounded-[6px] bg-white/[0.06] px-1.5 py-[2px] text-[11px] ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.14]" style={{ color: FAM_COLOR[CASE[id].fam || id[0]] }}>{id}</button>
                    </Tip>
                  ))}
                  {cs.length > 4 && <span className="text-[11px] text-[var(--mut)]">+{cs.length - 4}</span>}
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noopener noreferrer" className="ml-auto flex min-w-0 items-center gap-1 text-[11px] text-[var(--mut)] hover:text-white"><I.link size={12} className="shrink-0" /><span className="max-w-[140px] truncate">{b.source}</span></a>
                  ) : <span className="ml-auto max-w-[140px] truncate text-[11px] text-[var(--mut)]">{b.source}</span>}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
const LEVELS = ["A", "B", "C"];

/* ================================================================ Synthèse: beyond the 302 MDH (v13) / the other families of the business case (v23) */
export function BeyondBlock({ compact = false }: { compact?: boolean }) {
  const setSection = useApp((st) => st.setSection);
  const codes = V23 ? [...OUT_FAMS, "T"] : OUT_FAMS;
  const fams = codes.map((code) => {
    const cs = CASES.filter((c) => (c.fam || c.id[0]) === code);
    const types = [...new Set(cs.flatMap((c) => (c.value_levers ?? []).map((v) => v.type)).filter(Boolean))];
    return { code, name: FAM[code]?.name ?? code, n: cs.length, types, proofs: benchOf(cs.map((c) => c.id)).length, mdh: FAM[code]?.mdh ?? 0, cout: FAM[code]?.cout ?? 0, net: FAM[code]?.net ?? 0 };
  });
  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-[clamp(13px,0.85vw,15px)] font-semibold text-white">{V23 ? "Les autres familles" : <>Au-delà des {fr(META.eco, 0)} MDH</>}</h3>
        <span className="rounded-full bg-white/[0.07] px-2 py-[2px] text-[10.5px] text-[var(--txt-2)]">{V23 ? "comptées dans le business case" : "indicatif, non additif"}</span>
        <button type="button" onClick={() => setSection("cas")} className="ml-auto text-[11.5px] text-[var(--mut)] hover:text-white">voir les cas →</button>
      </div>
      <div className={`grid min-h-0 flex-1 ${compact ? "grid-cols-4" : "grid-cols-2"} gap-2`}>
        {fams.map((f) => (
          <div key={f.code} className="flex min-w-0 flex-col rounded-[12px] bg-white/[0.035] px-3 py-2 ring-1 ring-white/[0.06]">
            <div className="flex items-center gap-2"><Dot color={FAM_COLOR[f.code]} size={8} /><span className="truncate text-[12.5px] font-semibold text-white">{f.name}</span></div>
            <div className="mt-0.5 text-[11.5px] text-[var(--mut)]"><span className="num text-[13px] text-white">{f.n}</span> cas{f.proofs ? <> · <span className="text-[#7FD9B5]">{f.proofs} preuves mesurées</span></> : null}</div>
            {V23
              ? <div className="mt-1 truncate text-[11px] leading-snug text-[var(--txt-2)]" title={`${fr(f.mdh, 1)} MDH de gains bruts, ${fr(f.cout, 1)} MDH de coût`}>{fr(f.mdh, 0)} MDH de gains · {fr(f.cout, 0)} de coût · <span className={f.net < 0 ? "text-[#E9C27F]" : "text-[#7FD9B5]"}>{f.net < 0 ? "−" : ""}{fr(Math.abs(f.net), 0)} net</span></div>
              : <div className="mt-1 truncate text-[11px] leading-snug text-[var(--txt-2)]" title={f.types.join(" · ")}>{f.types.join(" · ")}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
