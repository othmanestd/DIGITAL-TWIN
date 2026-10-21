"use client";
// Finance · Cas par cas: the 89 cases (85 costed + 4 merged in v2.1), searchable and sortable; a click opens the case's financial page.
import { useMemo, type ReactNode } from "react";
import { CASES } from "@/lib/model";
import { I } from "@/components/ui/icons";
import { norm } from "@/lib/ui/fmt";
import { Panel, Th, Chip, FOCUS, Source, tdNum } from "./ui";
import { ROWS, COSTED, TOTAL_CASES, sumRows, mdh, minus, ratio, v, type CaseRow } from "./data";
import { useFin, type SortKey } from "./state";

const WAVES = [...new Set(ROWS.map((r) => r.vague))].filter((x) => x && x !== "—").sort();
const val = (r: CaseRow, k: SortKey): number | string | null => (k === "id" ? r.id : r[k]);
const STICKY = "sticky top-0 z-[1] bg-[#121a37]";

function SortTh({ k, children, tip, align = "right" }: { k: SortKey; children: ReactNode; tip?: ReactNode; align?: "left" | "right" }) {
  const sort = useFin((st) => st.sort);
  const setSort = useFin((st) => st.setSort);
  return (
    <Th align={align} tip={tip} className={STICKY}>
      <button type="button" onClick={() => setSort(k)} aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
        className={`inline-flex items-center gap-1 rounded uppercase tracking-[0.08em] ${FOCUS} ${sort.k === k ? "text-white" : "hover:text-[var(--txt)]"}`}>
        {children}{sort.k === k && <span aria-hidden className="text-[9px]">{sort.dir === 1 ? "▲" : "▼"}</span>}
      </button>
    </Th>
  );
}

export function Cases() {
  const { q, setQ, filter, setFilter, vague, setVague, hideMerged, setHideMerged, sort, openCase } = useFin();
  const list = useMemo(() => {
    const nq = norm(q.trim());
    const l = ROWS.filter((r) =>
      (!nq || norm(`${r.id} ${r.titre} ${r.brique ?? ""} ${r.famLabel}`).includes(nq)) &&
      (!filter || (filter.kind === "brique" ? r.brique === filter.key : r.fam === filter.key)) &&
      (vague === "all" || r.vague === vague) && (!hideMerged || !r.merged));
    return [...l].sort((a, b) => {
      const x = val(a, sort.k), y = val(b, sort.k);
      if (x === null && y === null) return a.id.localeCompare(b.id);
      if (x === null) return 1;
      if (y === null) return -1;
      const c = typeof x === "string" ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return c * sort.dir || a.id.localeCompare(b.id);
    });
  }, [q, filter, vague, hideMerged, sort]);
  const sums = sumRows(list);
  const nMerged = ROWS.filter((r) => r.merged).length;
  const chip = (on: boolean) => `h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors ${FOCUS} ${on ? "bg-white/[0.16] text-white ring-1 ring-white/25" : "bg-white/[0.04] text-[var(--mut)] ring-1 ring-white/[0.06] hover:text-[var(--txt)]"}`;
  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      <p className="text-[clamp(13.5px,0.95vw,16px)] leading-snug text-[var(--txt-2)]">
        <b className="text-white">{CASES.length} cas, {COSTED.length} chiffrés</b> : {nMerged} cas sans valeur propre sont fusionnés dans leur cas d&apos;accueil depuis la v2.1. Cliquez un cas pour ses projections 2027-2031, ses hypothèses et son arbitrage.
      </p>
      <Panel title={<>{list.length} cas affichés</>} sub={`sur ${CASES.length}`} right={
        <div className="flex flex-wrap items-center gap-1.5">
          {filter && (
            <button type="button" onClick={() => setFilter(null)} className={`flex h-7 items-center gap-1.5 rounded-full bg-[rgba(91,124,255,.18)] pl-2.5 pr-2 text-[12px] text-white ring-1 ring-[rgba(91,124,255,.4)] ${FOCUS}`} title="Retirer le filtre">
              {filter.kind === "brique" ? "Brique" : "Famille"} : {filter.label}<I.close size={13} />
            </button>
          )}
          {["all", ...WAVES].map((w) => <button key={w} type="button" className={chip(vague === w)} onClick={() => setVague(w)}>{w === "all" ? "Toutes vagues" : w}</button>)}
          <button type="button" className={chip(hideMerged)} onClick={() => setHideMerged(!hideMerged)} aria-pressed={hideMerged}>Masquer les fusionnés</button>
          <label className="relative ml-1 flex items-center">
            <I.search size={14} className="pointer-events-none absolute left-2.5 text-[var(--mut)]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un cas, une brique…" aria-label="Rechercher un cas"
              className={`h-7 w-[220px] rounded-full bg-white/[0.06] pl-8 pr-3 text-[12.5px] text-white placeholder:text-[var(--mut)] ring-1 ring-white/[0.09] ${FOCUS}`} />
          </label>
        </div>}>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[58px]" /><col /><col className="w-[clamp(120px,11vw,190px)]" /><col className="w-[46px]" /><col className="w-[50px]" />
            <col className="w-[66px]" /><col className="w-[66px]" /><col className="w-[66px]" /><col className="w-[72px]" /><col className="w-[72px]" /><col className="w-[68px]" /><col className="w-[58px]" />
          </colgroup>
          <thead><tr className="border-b border-white/[0.09]">
            <SortTh k="id" align="left">ID</SortTh>
            <Th align="left" className="sticky top-0 z-[1] bg-[#121a37]">Cas</Th>
            <Th align="left" className="sticky top-0 z-[1] bg-[#121a37]">Brique</Th>
            <Th align="left" className="sticky top-0 z-[1] bg-[#121a37]" tip="A administratif · S siège · P paramédical · H hébergement · X expérience, qualité, sécurité · C capital humain · R revenu, achats, médecins · I actifs et énergie · T transverse et pilotage">Fam.</Th>
            <Th align="left" className="sticky top-0 z-[1] bg-[#121a37]" tip="Vague de déploiement : V1 (1 clinique + siège) → V4 (tout le groupe).">Vague</Th>
            <SortTh k="eco" tip="① Économies réalisées 2031 (masse salariale + hors masse salariale), MDH.">① Éco.</SortTh>
            <SortTh k="marge" tip="② Marge sur CA additionnel 2031, MDH.">② Marge</SortTh>
            <SortTh k="cout" tip="③ Coût des agents du cas 2031, quote-part des plateformes comprise, MDH.">③ Coût</SortTh>
            <SortTh k="net" tip="Valeur nette 2031 du cas : ① + ② − ③, MDH.">Net 2031</SortTh>
            <SortTh k="cumul" tip="Valeur nette cumulée 2027-2031, MDH.">Cumul</SortTh>
            <SortTh k="van" tip="Valeur actuelle nette à 10 % de la valeur nette 2027-2031, MDH (même méthode que la Synthèse).">VAN</SortTh>
            <SortTh k="ratio" tip="Gains bruts pour 1 dirham de coût du cas, en 2031 (valeur brute ÷ coût des agents ; calculé).">Ratio</SortTh>
          </tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} tabIndex={0} role="button" aria-label={`Ouvrir la fiche financière de ${r.id}`} onClick={() => openCase(r.id, "cas")}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCase(r.id, "cas"); } }}
                className={`cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.05] ${FOCUS} ${r.merged ? "opacity-70" : ""}`}>
                <td className="num px-2 py-[7px] text-[12.5px] font-bold text-white"><span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: r.famColor }} />{r.id}</td>
                <td className="px-2 py-[7px]">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[12.5px] text-[var(--txt)]" title={r.titre}>{r.titre}</span>
                    {r.merged && <Chip className="!text-[10.5px]">fusionné → {r.merged}</Chip>}
                    {r.lever && <Chip className="!text-[10.5px]">levier</Chip>}
                  </span>
                </td>
                <td className="px-2 py-[7px]"><span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--txt-2)]">{r.brique && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: r.briqueColor }} />}<span className="truncate" title={r.brique ?? undefined}>{r.briqueShort}</span></span></td>
                <td className="num px-2 py-[7px] text-[12px] text-[var(--txt-2)]" title={r.famLabel}>{r.fam}</td>
                <td className="px-2 py-[7px] text-[12px] text-[var(--txt-2)]">{r.vague}</td>
                <td className={`${tdNum} !text-[12.5px] text-[var(--txt-2)]`}>{mdh(r.eco)}</td>
                <td className={`${tdNum} !text-[12.5px] text-[var(--txt-2)]`}>{mdh(r.marge)}</td>
                <td className={`${tdNum} !text-[12.5px] text-[var(--txt-2)]`}>{r.cout === null ? "—" : minus(r.cout)}</td>
                <td className={`${tdNum} !text-[13px] font-bold text-white`}>{mdh(r.net)}</td>
                <td className={`${tdNum} !text-[12.5px]`}>{mdh(r.cumul)}</td>
                <td className={`${tdNum} !text-[12.5px]`}>{mdh(r.van)}</td>
                <td className={`${tdNum} !text-[12.5px] text-[var(--txt-2)]`}>{ratio(r.ratio)}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={12} className="px-2 py-6 text-center text-[13px] text-[var(--mut)]">Aucun cas ne correspond.</td></tr>}
          </tbody>
          {list.length > 0 && (
            <tfoot><tr className="border-t border-white/[0.12] bg-white/[0.04]">
              <td colSpan={5} className="px-2 py-[9px] text-[12.5px] font-semibold text-white">Somme des {sums.n} cas chiffrés affichés <span className="font-normal text-[var(--mut)]">· hors coûts transverses et contingence</span></td>
              <td className={`${tdNum} font-semibold text-white`}>{mdh(sums.eco)}</td>
              <td className={`${tdNum} font-semibold text-white`}>{mdh(sums.marge)}</td>
              <td className={`${tdNum} text-[var(--txt-2)]`}>{minus(sums.cout)}</td>
              <td className={`${tdNum} font-bold text-white`}>{mdh(sums.net)}</td>
              <td className={`${tdNum} font-semibold text-white`}>{mdh(sums.cumul)}</td>
              <td className={`${tdNum} font-semibold text-white`}>{mdh(sums.van)}</td>
              <td className={`${tdNum} text-[var(--txt-2)]`}>{ratio(sums.cout ? sums.gains / sums.cout : null)}</td>
            </tr></tfoot>
          )}
        </table>
        <Source>
          MDH (millions de dirhams), 2031, scénario central. Une somme de cas exclut les coûts transverses et la contingence : les {TOTAL_CASES.n} cas font <span className="num">{mdh(TOTAL_CASES.net)}</span> MDH de valeur nette en 2031, le programme <span className="num">{mdh(v("net"))}</span> MDH.
          Les cas fusionnés n&apos;ont pas de chiffrage propre : leur valeur est dans le cas d&apos;accueil. Les cas T (leviers) n&apos;ont que des coûts ; leur valeur est celle qu&apos;ils déverrouillent (onglet Arbitrages).
        </Source>
      </Panel>
    </div>
  );
}
