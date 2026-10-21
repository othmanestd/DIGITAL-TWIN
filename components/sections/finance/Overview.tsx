"use client";
// Finance · Vue d'ensemble: the 2031 cascade, the headline KPIs, where the additional revenue comes from, what to remember, top 10 cases.
import type { ReactNode } from "react";
import { FIN, FINROW, fr } from "@/lib/model";
import { Num, Sparkline } from "@/components/ui/kit";
import s from "@/components/ui/styles";
import { Cascade2031 } from "./charts";
import { Panel, Legend, Derived, Source, FOCUS, Th, tdNum } from "./ui";
import { COL, LAST, Y5, BREAKEVEN, NET_CUMUL, COSTED, caSplit, mdh, minus, ratio, etp, pctExact, v, vals } from "./data";
import { useFin } from "./state";
import { CA_SPLIT_PDF } from "./sources";

function Kpi({ label, value, d = 1, unit, text, explain, series, derived, accent }: {
  label: string; value?: number; d?: number; unit?: string; text?: string; explain: ReactNode; series?: number[]; derived?: ReactNode; accent?: string;
}) {
  return (
    <div className={`${s.tile} flex min-w-0 flex-col rounded-[16px] px-3.5 py-3`}>
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow truncate !text-[10px] !tracking-[0.1em]" style={{ color: "var(--txt-2)" }}>{label}</span>
        {derived}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap">
        {text !== undefined
          ? <span className="text-[clamp(22px,1.65vw,30px)] font-[800] leading-none tracking-[-0.03em] text-white">{text}</span>
          : <Num value={value ?? 0} d={d} from={0} className="text-[clamp(22px,1.65vw,30px)] font-[800] leading-none text-white" />}
        {unit && <span className="text-[12.5px] font-semibold text-[var(--txt-2)]/70">{unit}</span>}
      </div>
      {series && <Sparkline series={series} active={series.length - 1} color={accent ?? COL.net} height={22} className="mt-2" />}
      <div className="mt-2 text-[11.5px] leading-snug text-[var(--mut)]">{explain}</div>
    </div>
  );
}

export function Overview() {
  const openCase = useFin((st) => st.openCase);
  const top10 = [...COSTED].sort((a, b) => (b.net ?? 0) - (a.net ?? 0)).slice(0, 10);
  const split = caSplit();
  const y0 = Y5[0];
  const b = (label: string) => FIN.bridge_v10.find((x) => x.label.startsWith(label));
  const bEtp = b("ETP"), bMs = b("Économie de masse");
  const costShare = v("cout") / v("gains");
  const noteN = FIN.hypotheses.find((h) => h.label.startsWith("Marge contributive"))?.note ?? null;
  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      <div className="grid grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <Panel title="2031 : des économies à la valeur nette" sub="MDH (millions de dirhams) par an, scénario central, montants courants" bodyClass="flex flex-col">
          <div className="min-h-[300px] flex-1"><Cascade2031 /></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-white/[0.07] pt-2.5">
            <Legend items={[
              { label: "Masse salariale", color: COL.ms }, { label: "Hors masse salariale", color: COL.hms }, { label: "Marge sur CA", color: COL.marge },
              { label: <>Agents et plateformes <span className="num text-[var(--mut)]">{mdh(v("cout_cases"))}</span></>, color: COL.cout },
              { label: <>Transverses <span className="num text-[var(--mut)]">{mdh(v("cout_transverse"))}</span></>, color: COL.coutT },
              { label: <>Contingence <span className="num text-[var(--mut)]">{mdh(v("contingence"))}</span></>, color: COL.coutC },
            ]} />
            <span className="text-[11px] text-[var(--mut)]">Survolez une barre pour le détail.</span>
          </div>
        </Panel>
        <div className="grid grid-cols-2 content-start gap-[clamp(8px,0.6vw,12px)]">
          <Kpi label="Valeur nette 2031" value={v("net")} unit="MDH" series={vals(FINROW.net.values)} explain="Gains bruts moins coût du programme, sur l'année 2031." />
          <Kpi label="Cumul 2027-2031" value={FINROW.net.cumul ?? 0} unit="MDH" series={vals(NET_CUMUL)} accent={COL.cumul} explain="Addition des valeurs nettes des cinq années." />
          <Kpi label="VAN à 10 %" value={FINROW.net.van ?? 0} unit="MDH" explain="Valeur actuelle nette : les cinq années ramenées à fin 2026, au taux de 10 % par an." />
          <Kpi label="Gains pour 1 dirham" value={v("ratio")} d={2} unit="DH" series={vals(FINROW.ratio.values)} accent="#E2B05A"
            explain={<>Dirhams de gains bruts pour 1 dirham de coût en 2031 ; <b className="num font-semibold text-[var(--txt-2)]">{ratio(FINROW.ratio.cumul)}</b> sur 2027-2031.</>} />
          <Kpi label="ETP-éq. libérés 2031" value={v("etp")} d={0} series={vals(FINROW.etp.values)} accent={COL.ms} explain="Équivalents temps plein de travail repris par les agents (information)." />
          <Kpi label="Cumul positif dès" text={BREAKEVEN ?? "—"}
            derived={<Derived how={<>Première année où la valeur nette cumulée de la Synthèse dépasse zéro : {Y5.map((y) => `${y} ${mdh(NET_CUMUL[y])}`).join(" · ")}.</>} />}
            explain={<>La valeur nette cumulée passe de <span className="num">{mdh(NET_CUMUL[y0])}</span> en {y0} à <span className="num">+{mdh(BREAKEVEN ? NET_CUMUL[BREAKEVEN] : 0)}</span> en {BREAKEVEN}.</>} />
          <Kpi label="Coût cumulé 2027-2031" value={FINROW.cout.cumul ?? 0} unit="MDH" series={vals(FINROW.cout.values)} accent={COL.cout} explain="Agents, plateformes, coûts transverses et contingence, sur cinq ans." />
          <Kpi label="Gains bruts cumulés" value={FINROW.gains.cumul ?? 0} unit="MDH" series={vals(FINROW.gains.values)} accent={COL.marge} explain="Économies et marge sur CA additionnel, de 2027 à 2031." />
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(0,1.1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <Panel title="D'où vient le CA additionnel" sub={`et ce qu'il laisse en marge, ${LAST}`}>
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-white/[0.07]">
              <Th align="left">MDH</Th><Th tip="Chiffre d'affaires additionnel, pour mémoire : il n'est pas additionné tel quel.">CA add.</Th>
              <Th tip="Soins, consommables, honoraires : ce que coûte la production de ce CA.">Coûts dir.</Th><Th>Marge</Th><Th tip="Taux de marge des Hypothèses du classeur.">Taux</Th>
            </tr></thead>
            <tbody>
              {CA_SPLIT_PDF ? CA_SPLIT_PDF.rows.map((r) => (
                <tr key={r.ligne} className={`align-top ${r.ligne === "Total" ? "" : "border-b border-white/[0.04]"}`}>
                  <td className="px-2 py-2"><div className={`text-[13px] ${r.ligne === "Total" ? "font-semibold" : "font-medium"} text-white`}>{r.ligne}</div>{r.exemples && <div className="text-[11px] leading-snug text-[var(--mut)]">{r.exemples}</div>}</td>
                  <td className={tdNum}>{r.ca_additionnel}</td><td className={`${tdNum} text-[var(--txt-2)]`}>{r.coûts_directs}</td><td className={`${tdNum} font-bold text-white`}>{r.marge}</td>
                  <td className={`${tdNum} text-[var(--txt-2)]`}>{r.taux}</td>
                </tr>
              )) : split.rows.map((r) => (
                <tr key={r.k} className="border-b border-white/[0.04] align-top">
                  <td className="px-2 py-2"><div className="text-[13px] font-medium text-white">{r.label}</div><div className="text-[11px] leading-snug text-[var(--mut)]">{r.sub}</div></td>
                  <td className={tdNum}>{mdh(r.ca)}</td><td className={`${tdNum} text-[var(--txt-2)]`}>{mdh(r.couts)}</td><td className={`${tdNum} font-bold text-white`}>{mdh(r.marge)}</td>
                  <td className={`${tdNum} text-[var(--txt-2)]`}>{r.taux !== null ? pctExact(r.taux) : "—"}</td>
                </tr>
              ))}
              {!CA_SPLIT_PDF && <tr>
                <td className="px-2 py-2 text-[13px] font-semibold text-white">Total</td>
                <td className={`${tdNum} font-semibold text-white`}>{mdh(split.total.ca)}</td><td className={`${tdNum} text-[var(--txt-2)]`}>{mdh(split.total.couts)}</td>
                <td className={`${tdNum} font-bold text-white`}>{mdh(split.total.marge)}</td><td className={`${tdNum} text-[var(--txt-2)]`}>{split.total.taux !== null ? fr(split.total.taux * 100, 0) + " %" : "—"}</td>
              </tr>}
            </tbody>
          </table>
          <Source>{CA_SPLIT_PDF ? <>Tableau tel qu&apos;imprimé ({CA_SPLIT_PDF.ref}). Contrôle <Derived label="recalcul" how={<>Synthèse du classeur 04 : CA récupéré {mdh(split.rows[0].ca)} × {split.rows[0].taux !== null ? pctExact(split.rows[0].taux) : "—"} = {mdh(split.rows[0].marge)} ; nouvelle activité {mdh(split.rows[1].ca)} × {split.rows[1].taux !== null ? pctExact(split.rows[1].taux) : "—"} = {mdh(split.rows[1].marge)} ; total {mdh(split.total.ca)}, coûts directs {mdh(split.total.couts)}, marge {mdh(split.total.marge)}.</>} />. {CA_SPLIT_PDF.comment}</> : <>Totaux : Synthèse du classeur 04. Répartition par type <Derived how="Marge = CA de la ligne × taux de marge des Hypothèses ; coûts directs = CA − marge ; taux total = marge ÷ CA." />. {noteN && <>Marge contributive de la nouvelle activité : {noteN}.</>}</>}</Source>
        </Panel>

        <Panel title="Ce qu'il faut retenir">
          <ol className="flex flex-col gap-2.5 text-[12.5px] leading-snug text-[var(--txt-2)]">
            <li><b className="text-white">Les économies et la marge se cumulent.</b> En {LAST}, <span className="num">{mdh(v("eco"))}</span> MDH d&apos;économies et <span className="num">{mdh(v("marge"))}</span> MDH de marge font <span className="num">{mdh(v("gains"))}</span> MDH de gains bruts. Le coût du programme (<span className="num">{mdh(v("cout"))}</span>) en consomme <span className="num">{fr(costShare * 100, 0)} %</span> <Derived how={`Coût ${mdh(v("cout"))} ÷ gains bruts ${mdh(v("gains"))}.`} /> : il reste <span className="num">{mdh(v("net"))}</span> MDH de valeur nette.</li>
            <li><b className="text-white">La valeur se déplace vers le chiffre d&apos;affaires et les achats.</b> <span className="num">{mdh(v("ca"))}</span> MDH de CA additionnel en {LAST}, dont <span className="num">{mdh(v("ca_recup"))}</span> de CA récupéré ; <span className="num">{mdh(v("hms"))}</span> MDH d&apos;économies hors masse salariale.</li>
            {bEtp && bMs && <li><b className="text-white">La masse salariale économisée est plus faible que prévu.</b> <span className="num">{mdh(v("ms"))}</span> MDH en {LAST}, <span className="num">{mdh(bMs.v2)}</span> MDH à périmètre 2026 contre <span className="num">{fr(bMs.v10 ?? 0, 0)}</span> en v1.0 ; <span className="num">{etp(bEtp.v2)}</span> ETP-équivalents au lieu de <span className="num">{etp(bEtp.v10)}</span>.</li>}
            <li><b className="text-white">Rentable en cumul dès {BREAKEVEN}.</b> {y0} est une année d&apos;investissement : les gains bruts (<span className="num">{mdh(v("gains", y0))}</span>) ne couvrent pas encore le coût (<span className="num">{mdh(v("cout", y0))}</span>).</li>
          </ol>
        </Panel>

        <Panel title="Les dix cas qui créent le plus de valeur" sub={`${LAST}, MDH`}>
          <table className="w-full table-fixed border-collapse">
            <colgroup><col className="w-[46px]" /><col /><col className="w-[44px]" /><col className="w-[48px]" /><col className="w-[48px]" /><col className="w-[54px]" /></colgroup>
            <thead><tr className="border-b border-white/[0.07]"><Th align="left">ID</Th><Th align="left">Cas</Th><Th tip="① Économies réalisées 2031">Éco.</Th><Th tip="② Marge sur CA additionnel 2031">Marge</Th><Th tip="③ Coût des agents du cas 2031 (plateformes comprises)">Coût</Th><Th tip="Valeur nette 2031 du cas">Valeur</Th></tr></thead>
            <tbody>
              {top10.map((r) => (
                <tr key={r.id} tabIndex={0} role="button" aria-label={`Ouvrir ${r.id}`} onClick={() => openCase(r.id, "overview")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCase(r.id, "overview"); } }}
                  className={`cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.05] ${FOCUS}`}>
                  <td className="num px-2 py-[6px] text-[12px] font-bold text-white"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: r.famColor }} />{r.id}</td>
                  <td className="truncate px-2 py-[6px] text-[12.5px] text-[var(--txt)]" title={r.titre}>{r.titre}</td>
                  <td className={`${tdNum} !py-[6px] !text-[12.5px] text-[var(--txt-2)]`}>{mdh(r.eco)}</td>
                  <td className={`${tdNum} !py-[6px] !text-[12.5px] text-[var(--txt-2)]`}>{mdh(r.marge)}</td>
                  <td className={`${tdNum} !py-[6px] !text-[12.5px] text-[var(--txt-2)]`}>{minus(r.cout)}</td>
                  <td className={`${tdNum} !py-[6px] !text-[12.5px] font-bold text-white`}>{mdh(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Source>Cliquez une ligne pour la fiche financière du cas. Coût propre au cas, hors coûts transverses et contingence.</Source>
        </Panel>
      </div>
    </div>
  );
}
