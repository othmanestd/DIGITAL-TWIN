"use client";
// Finance · Projections 2027-2031: the full tableau de passage (every line, cumul, VAN), gains vs cost per year,
// the cumulated net value with its break-even, the gains-per-dirham ratio. MDH or derived % of group revenue / payroll.
import { FINROW, fr } from "@/lib/model";
import { Segmented } from "@/components/ui/kit";
import { YearStack, LineChart, programmeYears, PROGRAMME_LEGEND } from "./charts";
import { Panel, Legend, Derived, Source, Th } from "./ui";
import { COL, Y5, LINES, NET_CUMUL, BREAKEVEN, CA_GROUPE, MS_GROUPE, mdh, minus, ratio, etp, total, pct2, type Line, type Yr } from "./data";
import { useFin, type Unit } from "./state";

export function Projections() {
  const unit = useFin((st) => st.unit);
  const setUnit = useFin((st) => st.setUnit);
  const denom = unit === "ca" ? CA_GROUPE?.[1].values : unit === "ms" ? MS_GROUPE?.[1].values : null;
  const denomTotal = denom ? total(denom) : 0;
  const cell = (l: Line, y: Yr) => {
    const r = FINROW[l.key], x = r.values[y];
    if (l.kind === "ratio") return ratio(x);
    if (l.kind === "info") return etp(x);
    if (denom) return l.kind === "cumul" ? "—" : pct2((l.deduct ? -x : x) / denom[y]);
    return l.deduct ? minus(x) : mdh(x);
  };
  const cumCell = (l: Line) => {
    const r = FINROW[l.key];
    if (l.kind === "ratio") return ratio(r.cumul);
    if (r.cumul === null) return "";
    if (denom) return pct2((l.deduct ? -r.cumul : r.cumul) / denomTotal);
    return l.deduct ? minus(r.cumul) : mdh(r.cumul);
  };
  const vanCell = (l: Line) => {
    const r = FINROW[l.key];
    if (r.van === null || denom) return r.van === null ? "" : "—";
    return l.deduct ? minus(r.van) : mdh(r.van);
  };
  const row = (l: Line) => {
    const strong = ["eco", "marge", "gains", "cost", "net"].includes(l.kind);
    const memo = l.kind.startsWith("memo");
    const indent = l.kind === "sub" || l.kind === "costSub" || l.kind === "memoSub" || l.kind === "memoMinus";
    const bg = l.kind === "net" ? "bg-white/[0.06]" : l.kind === "gains" ? "bg-white/[0.03]" : "";
    const text = strong ? "text-white font-semibold" : memo ? "text-[var(--mut)] italic" : l.kind === "cumul" || l.kind === "ratio" ? "text-[var(--txt)]" : "text-[var(--txt-2)]";
    return (
      <tr key={l.key} className={`border-b border-white/[0.045] ${bg}`}>
        <th scope="row" className={`px-2 py-[7px] text-left text-[12.5px] font-normal leading-snug ${text} ${indent ? "pl-6" : ""}`}>
          {l.label}{l.kind === "info" && <span className="ml-1 text-[var(--mut)]">(ETP-éq. : équivalents temps plein)</span>}
        </th>
        {Y5.map((y) => <td key={y} className={`num whitespace-nowrap px-2 py-[7px] text-right text-[13px] ${text} ${l.kind === "net" ? "!font-bold" : ""}`}>{cell(l, y)}</td>)}
        <td className={`num whitespace-nowrap border-l border-white/[0.06] px-2 py-[7px] text-right text-[13px] ${text}`}>{cumCell(l)}</td>
        <td className={`num whitespace-nowrap px-2 py-[7px] text-right text-[13px] ${text}`}>{vanCell(l)}</td>
      </tr>
    );
  };
  const refRow = (t: typeof CA_GROUPE) => t && (
    <tr key={t[0]} className="border-b border-white/[0.045]">
      <th scope="row" className="px-2 py-[6px] text-left text-[12px] font-normal text-[var(--mut)]">{t[0]}</th>
      {Y5.map((y) => <td key={y} className="num px-2 py-[6px] text-right text-[12.5px] text-[var(--mut)]">{fr(t[1].values[y], 1)}</td>)}
      <td className="num border-l border-white/[0.06] px-2 py-[6px] text-right text-[12.5px] text-[var(--mut)]">{fr(total(t[1].values), 1)}</td><td />
    </tr>
  );
  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      <p className="text-[clamp(13.5px,0.95vw,16px)] leading-snug text-[var(--txt-2)]">
        <b className="text-white">{Y5[0]} est une année d&apos;investissement</b> (<span className="num">{mdh(FINROW.net.values[Y5[0]])}</span> MDH) ; la valeur nette croît ensuite chaque année jusqu&apos;à <b className="num text-white">{mdh(FINROW.net.values["2031"])}</b> MDH en 2031, et le cumul est positif dès {BREAKEVEN}.
      </p>
      <div className="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <Panel title="Par année : gains au-dessus de l'axe, coût en dessous, valeur nette à droite" sub="MDH" bodyClass="flex flex-col">
          <div className="h-[clamp(280px,40vh,440px)] min-h-0"><YearStack data={programmeYears()} /></div>
          <Legend className="mt-3 border-t border-white/[0.07] pt-2.5" items={PROGRAMME_LEGEND} />
        </Panel>
        <div className="flex min-w-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
          <Panel title="Valeur nette cumulée" sub="MDH, depuis 2027" bodyClass="flex flex-col">
            <div className="h-[clamp(130px,17vh,200px)] min-h-0">
              <LineChart series={NET_CUMUL} color={COL.cumul} bars={FINROW.net.values} barsLabel="Valeur nette de l'année" label="Valeur nette cumulée" mark={BREAKEVEN ? { y: BREAKEVEN, text: `cumul positif dès ${BREAKEVEN}` } : null} />
            </div>
            <Legend className="mt-2" items={[{ label: "Cumul", color: COL.cumul, kind: "line" }, { label: "Valeur nette de l'année", color: "rgba(232,236,246,.35)" }]} />
          </Panel>
          <Panel title="Gains bruts pour 1 dirham de coût" sub={<>2027-2031 : <span className="num">{ratio(FINROW.ratio.cumul)}</span></>} bodyClass="flex flex-col">
            <div className="h-[clamp(120px,15vh,180px)] min-h-0">
              <LineChart series={FINROW.ratio.values} color="#E2B05A" fmt={ratio} ref0={1} ref0Label="seuil : 1 dirham de gains pour 1 dirham de coût" label="Gains bruts pour 1 dirham de coût" />
            </div>
          </Panel>
        </div>
      </div>
      <Panel title="Le tableau de passage, 2027-2031" sub={unit === "mdh" ? "MDH courants" : unit === "ca" ? "en % du CA du groupe sans le programme" : "en % de la masse salariale du groupe sans le programme"}
        right={<div className="flex items-center gap-2">
          {unit !== "mdh" && <Derived how={<>Chaque montant ÷ {unit === "ca" ? "le CA du groupe" : "la masse salariale du groupe"} sans le programme de la même année (Hypothèses, trajectoire). Cumul : cumul ÷ somme 2027-2031. La VAN n&apos;a pas d&apos;équivalent en %.</>} label="% dérivés" />}
          <Segmented<Unit> size="sm" layoutId="fin-unit" value={unit} onChange={setUnit} options={[{ id: "mdh", label: "MDH" }, { id: "ca", label: "% du CA du groupe" }, { id: "ms", label: "% de la masse salariale" }]} />
        </div>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead><tr className="border-b border-white/[0.09]">
              <Th align="left">{unit === "mdh" ? "MDH (millions de dirhams)" : "Part dérivée"}</Th>
              {Y5.map((y) => <Th key={y}>{y}</Th>)}
              <Th className="border-l border-white/[0.06]" tip="Somme des cinq années ; pour le ratio, gains bruts cumulés ÷ coût cumulé.">Cumul 27-31</Th>
              <Th tip="Valeur actuelle nette à 10 % : flux 2027 à 2031 actualisés à 10 % par an, ramenés à fin 2026 (méthode du classeur).">VAN 10 %</Th>
            </tr></thead>
            <tbody>
              {LINES.map(row)}
              <tr><td colSpan={8} className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Pour situer · trajectoire du groupe sans le programme (MDH)</td></tr>
              {refRow(CA_GROUPE)}{refRow(MS_GROUPE)}
            </tbody>
          </table>
        </div>
        <Source>
          Source : classeur 04, onglet Synthèse (scénario central, montants courants, croissance du groupe et inflation comprises). Les économies (①) et la marge sur CA additionnel (②) s&apos;additionnent ; seul le coût du programme (③) vient en déduction. Le CA additionnel est un chiffre d&apos;affaires, rappelé pour mémoire : seule sa marge entre dans la valeur.
          {unit !== "mdh" && <> Les parts en % sont calculées à l&apos;écran à partir des montants et de la trajectoire du groupe ; elles ne figurent pas dans les documents.</>}
        </Source>
      </Panel>
    </div>
  );
}
