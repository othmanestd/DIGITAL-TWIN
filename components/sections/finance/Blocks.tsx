"use client";
// Finance · Par brique et par famille: 2031 values, cumul and VAN per block, the composition bar (cost left, gains right),
// and the net value per year as small multiples on one shared scale. Click a block to filter the case list.
import { FINROW } from "@/lib/model";
import { Segmented } from "@/components/ui/kit";
import { SplitBar, MiniYears } from "./charts";
import { Panel, Legend, Derived, Source, Th, FOCUS, tdNum } from "./ui";
import { COL, Y5, BRIQUES, FAMILLES, VAGUES, TOTAL_CASES, OVERHEAD, mdh, minus, v, type Block } from "./data";
import { WAVES_PDF, WAVES_REF, WAVES_NOTE, FAMILY_SERIES_PDF } from "./sources";
import { useFin, type BlocBy } from "./state";

export function Blocks() {
  const by = useFin((st) => st.blocBy);
  const setBy = useFin((st) => st.setBlocBy);
  const setFilter = useFin((st) => st.setFilter);
  const setTab = useFin((st) => st.setTab);
  const setVague = useFin((st) => st.setVague);
  const blocks = by === "brique" ? BRIQUES : by === "famille" ? FAMILLES : VAGUES;
  const max = Math.max(...blocks.map((b) => Math.max(b.block.gains ?? 0, b.block.cout ?? 0)));
  const all = blocks.flatMap((b) => Y5.map((y) => b.netYears[y] ?? 0));
  const lo = Math.min(0, ...all), hi = Math.max(...all);
  const go = (b: Block) => {
    if (by === "vague") { setFilter(null); setVague(b.key); }
    else { setVague("all"); setFilter({ kind: by, key: b.key, label: by === "brique" ? b.name : `${b.key} · ${b.name}` }); }
    setTab("cas");
  };
  const label = (b: Block) => (by === "famille" ? `${b.key} · ${b.name}` : b.name);
  const best = [...blocks].sort((a, b) => (b.block.net ?? 0) - (a.block.net ?? 0))[0];
  const ov = v("cout_transverse") + v("contingence");
  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[clamp(13.5px,0.95vw,16px)] leading-snug text-[var(--txt-2)]">
          <b className="text-white">{best.name}</b> porte <b className="num text-white">{mdh(best.block.net)}</b> MDH des <span className="num">{mdh(TOTAL_CASES.net)}</span> MDH de valeur nette des cas en 2031 ; les coûts transverses et la contingence (<span className="num">{mdh(ov)}</span> MDH) restent au niveau du programme.
        </p>
        <Segmented<BlocBy> size="sm" layoutId="fin-blocby" value={by} onChange={setBy} options={[{ id: "brique", label: "Par brique de solution" }, { id: "famille", label: "Par famille de cas" }, { id: "vague", label: "Par vague" }]} />
      </div>

      <Panel title={by === "brique" ? "Par brique : qui crée la valeur" : by === "famille" ? "Par famille de cas" : "Par vague de déploiement"} sub="2031, MDH · cliquez une ligne pour voir ses cas">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse">
            <thead><tr className="border-b border-white/[0.09]">
              <Th align="left">{by === "brique" ? "Brique" : by === "famille" ? "Famille" : "Vague"}</Th>
              <Th tip="Nombre de cas chiffrés (les 4 cas fusionnés en v2.1 sont comptés dans leur cas d'accueil).">Cas</Th>
              <Th align="center" tip="Coût à gauche de l'axe ; économies et marge sur CA à droite. Même échelle pour toutes les lignes.">Composition 2031</Th>
              <Th tip="① Économies réalisées : masse salariale + hors masse salariale.">① Économies</Th>
              <Th tip="② Marge sur le CA additionnel.">② Marge CA</Th>
              <Th tip="CA additionnel, pour mémoire (non additionné).">(CA add.)</Th>
              <Th>Gains bruts</Th>
              <Th tip="③ Coût des agents et des plateformes rattachés aux cas.">③ Coût</Th>
              <Th>Valeur nette</Th>
              <Th tip="Valeur nette cumulée 2027-2031.">Cumul 27-31</Th>
              <Th tip="Valeur actuelle nette à 10 % de la valeur nette 2027-2031.">VAN 10 %</Th>
            </tr></thead>
            <tbody>
              {blocks.map((b) => (
                <tr key={b.key} tabIndex={0} role="button" aria-label={`Voir les cas de ${label(b)}`} onClick={() => go(b)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(b); } }}
                  className={`cursor-pointer border-b border-white/[0.045] transition-colors hover:bg-white/[0.05] ${FOCUS}`}>
                  <td className="px-2 py-[8px]"><span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: b.color }} /><span className="min-w-0"><span className="block truncate text-[13px] font-medium text-white">{by === "famille" && <span className="num mr-1.5 text-[var(--mut)]">{b.key}</span>}{b.name}</span>{by === "vague" && WAVES_PDF[b.key] && <span className="block truncate text-[11px] text-[var(--mut)]">{WAVES_PDF[b.key].dates} · {WAVES_PDF[b.key].scope} · dossier : {WAVES_PDF[b.key].n} cas, {WAVES_PDF[b.key].net}</span>}</span></span></td>
                  <td className={`${tdNum} text-[var(--txt-2)]`}>{b.block.n}</td>
                  <td className="w-[200px] px-3 py-[8px]"><SplitBar ms={b.ms} hms={b.hms} marge={b.block.marge ?? 0} cout={b.block.cout ?? 0} max={max} /></td>
                  <td className={tdNum}>{mdh(b.block.eco)}</td>
                  <td className={tdNum}>{mdh(b.block.marge)}</td>
                  <td className={`${tdNum} italic text-[var(--mut)]`}>{mdh(b.block.ca)}</td>
                  <td className={tdNum}>{mdh(b.block.gains)}</td>
                  <td className={`${tdNum} text-[var(--txt-2)]`}>{minus(b.block.cout)}</td>
                  <td className={`${tdNum} font-bold text-white`}>{mdh(b.block.net)}</td>
                  <td className={tdNum}>{mdh(b.block.cumul)}</td>
                  <td className={tdNum}>{mdh(b.block.van)}</td>
                </tr>
              ))}
              <tr className="border-b border-white/[0.06] bg-white/[0.03]">
                <td className="px-2 py-[8px] text-[13px] font-semibold text-white">Total des cas <span className="font-normal text-[var(--mut)]">(hors coûts transverses et contingence)</span></td>
                <td className={`${tdNum} text-[var(--txt-2)]`}>{TOTAL_CASES.n}</td><td />
                <td className={`${tdNum} font-semibold text-white`}>{mdh(TOTAL_CASES.eco)}</td><td className={`${tdNum} font-semibold text-white`}>{mdh(TOTAL_CASES.marge)}</td>
                <td className={`${tdNum} italic text-[var(--mut)]`}>{mdh(TOTAL_CASES.ca)}</td><td className={`${tdNum} font-semibold text-white`}>{mdh(TOTAL_CASES.gains)}</td>
                <td className={`${tdNum} text-[var(--txt-2)]`}>{minus(TOTAL_CASES.cout)}</td><td className={`${tdNum} font-bold text-white`}>{mdh(TOTAL_CASES.net)}</td>
                <td className={`${tdNum} font-semibold text-white`}>{mdh(TOTAL_CASES.cumul)}</td><td className={`${tdNum} font-semibold text-white`}>{mdh(TOTAL_CASES.van)}</td>
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="px-2 py-[8px] text-[13px] text-[var(--txt-2)]">Coûts transverses et contingence <Derived how="Lignes « coûts transverses » + « contingence » de la Synthèse (2031, cumul et VAN). Elles ne sont rattachées à aucun cas." /></td>
                <td /><td /><td /><td /><td /><td />
                <td className={`${tdNum} text-[var(--txt-2)]`}>{minus(OVERHEAD.values["2031"])}</td><td className={`${tdNum} text-[var(--txt-2)]`}>{minus(OVERHEAD.values["2031"])}</td>
                <td className={`${tdNum} text-[var(--txt-2)]`}>{minus(OVERHEAD.cumul)}</td><td className={`${tdNum} text-[var(--txt-2)]`}>{minus(OVERHEAD.van)}</td>
              </tr>
              <tr className="bg-white/[0.06]">
                <td className="px-2 py-[9px] text-[13.5px] font-bold text-white">Programme</td><td /><td />
                <td className={`${tdNum} font-semibold text-white`}>{mdh(v("eco"))}</td><td className={`${tdNum} font-semibold text-white`}>{mdh(v("marge"))}</td>
                <td className={`${tdNum} italic text-[var(--mut)]`}>{mdh(v("ca"))}</td><td className={`${tdNum} font-semibold text-white`}>{mdh(v("gains"))}</td>
                <td className={`${tdNum} text-[var(--txt-2)]`}>{minus(v("cout"))}</td><td className={`${tdNum} !text-[14px] font-bold text-white`}>{mdh(v("net"))}</td>
                <td className={`${tdNum} font-semibold text-white`}>{mdh(FINROW.net.cumul)}</td><td className={`${tdNum} font-semibold text-white`}>{mdh(FINROW.net.van)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Legend className="mt-3" items={[{ label: "Masse salariale", color: COL.ms }, { label: "Hors masse salariale", color: COL.hms }, { label: "Marge sur CA", color: COL.marge }, { label: "Coût des agents", color: COL.cout }]} />
        <Source>
          {by === "vague"
            ? <>Pas de tableau par vague dans le classeur 04 : chaque ligne est la somme des cas de la vague <Derived how="Somme des valeurs 2031, du cumul et de la VAN des cas de la vague (onglet Projections). Les valeurs nettes 2031 retrouvent celles imprimées dans le dossier v2.3 (PDF 02 p. 27)." /> ; dates, périmètres et valeurs du dossier : {WAVES_REF}. {WAVES_NOTE}</>
            : <>Source : classeur 04, Synthèse « par {by} » (coûts propres aux cas ; les coûts transverses et la contingence sont au global).</>}
          {" "}Répartition masse salariale / hors masse salariale de la barre : somme des projections des cas <Derived how="Somme, par bloc, des économies de masse salariale et hors masse salariale 2031 des cas (onglet Projections) ; leur total égale la colonne ① Économies." />.
        </Source>
      </Panel>

      <Panel title="Valeur nette par année" sub={`MDH, coûts propres aux cas · une échelle commune de ${mdh(lo)} à ${mdh(hi)}`}
        right={by === "brique" ? <span className="text-[11px] text-[var(--mut)]">Synthèse, « par brique et par année »</span> : <Derived how={by === "famille" ? `Somme des valeurs nettes annuelles des cas de la famille (onglet Projections) ; identique à la série imprimée dans le ${FAMILY_SERIES_PDF?.ref ?? "dossier v2.3, PDF 05 p. 7"}.` : "Somme des valeurs nettes annuelles des cas de la vague (onglet Projections)."} label="somme des cas" />}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-[clamp(8px,0.6vw,12px)]">
          {blocks.map((b) => (
            <button key={b.key} type="button" onClick={() => go(b)} className={`flex min-w-0 flex-col rounded-[14px] bg-white/[0.03] px-3 py-2.5 text-left ring-1 ring-white/[0.06] transition-colors hover:bg-white/[0.06] ${FOCUS}`}>
              <span className="flex min-w-0 items-center gap-1.5"><span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ background: b.color }} /><span className="truncate text-[12px] font-medium text-[var(--txt)]">{label(b)}</span></span>
              <span className="mt-1 flex items-baseline gap-1"><span className="num text-[18px] font-[800] text-white">{mdh(b.netYears["2031"])}</span><span className="text-[11px] text-[var(--mut)]">en 2031</span></span>
              <div className="mt-1.5 h-[64px]"><MiniYears series={b.netYears} lo={lo} hi={hi} /></div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
