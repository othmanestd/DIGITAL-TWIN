"use client";
// Finance · Arbitrages et leviers: the 25 cases with a nil or negative value in v2.0, their cause, correction and decision (v2.1),
// and the value the T levers protect (model simulation; the effects overlap and do not add up).
import { FIN, fr } from "@/lib/model";
import { Panel, Derived, Source, Th, FOCUS } from "./ui";
import { ROW, mdh } from "./data";
import { ARBITRAGE_PDF } from "./sources";
import { useFin } from "./state";

const td = "num whitespace-nowrap px-2 py-[7px] text-right text-[12.5px] text-[var(--txt)] align-top";

export function Arbitrage() {
  const openCase = useFin((st) => st.openCase);
  const rows = FIN.arbitrage;
  const sumV20 = rows.reduce((a, r) => a + (r.v20 ?? 0), 0);
  // the three outcomes printed in PDF 02 p. 26, counted from the decisions of 04 · Arbitrage
  const outcome = (d: string | null) => (d?.startsWith("Fusionner") ? "Fusionnés" : /levier|obligation/.test(d ?? "") ? "Gardés sans gain propre" : "Corrigés");
  const decisions = rows.reduce<Record<string, number>>((acc, r) => { const k = outcome(r.decision); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {});
  const notes = FIN.arbitrage_notes;
  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      <p className="text-[clamp(13.5px,0.95vw,16px)] leading-snug text-[var(--txt-2)]">
        <b className="text-white">{rows.length} cas avaient une valeur nette nulle ou négative en v2.0</b> (<span className="num">{mdh(sumV20)}</span> MDH au total en 2031 <Derived how={<>Somme des valeurs v2.0 des {rows.length} lignes de l&apos;onglet Arbitrage. {ARBITRAGE_PDF ? <>Le dossier imprime : « {ARBITRAGE_PDF.total} » ({ARBITRAGE_PDF.ref}).</> : null}</>} />). Deux causes venaient de la méthode de calcul et sont corrigées en v2.1 ; la troisième relève de leviers qui ne créent pas de valeur par eux-mêmes mais la rendent possible.
      </p>

      <div className="grid grid-cols-3 gap-[clamp(10px,0.8vw,16px)]">
        {(ARBITRAGE_PDF?.causes ?? []).map((c, i) => (
          <div key={c.t} className="rounded-[16px] bg-white/[0.035] px-4 py-3 ring-1 ring-white/[0.07]">
            <div className="flex items-center gap-2"><span className="num grid h-6 w-6 place-items-center rounded-full bg-white/[0.08] text-[11.5px] font-bold text-white">{i + 1}</span><span className="text-[13px] font-semibold text-white">{c.t}</span></div>
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--txt-2)]">{c.d}</p>
          </div>
        ))}
      </div>

      <Panel title="Les 25 cas à valeur nulle ou négative en v2.0" sub="MDH en 2031, scénario central · cliquez un identifiant pour la fiche du cas"
        right={<div className="flex flex-wrap gap-1.5">{Object.entries(decisions).map(([k, n]) => <span key={k} className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[11px] text-[var(--txt-2)] ring-1 ring-white/[0.07]">{k} · <span className="num">{n}</span></span>)}</div>}>
        <table className="w-full table-fixed border-collapse">
          <colgroup><col className="w-[64px]" /><col /><col className="w-[96px]" /><col /><col className="w-[96px]" /><col className="w-[92px]" /><col className="w-[150px]" /></colgroup>
          <thead><tr className="border-b border-white/[0.09]">
            <Th align="left">ID</Th><Th align="left">Cas (v2.0)</Th><Th tip="Valeur nette 2031 en v2.0, avant correction.">Valeur v2.0</Th>
            <Th align="left">Cause et correction</Th>
            <Th tip="Valeur nette 2031 en v2.1 ; pour un cas fusionné, valeur du cas d'accueil.">Valeur v2.1</Th>
            <Th tip="Ce que le programme perd si l'on retire le cas (valeur brute − coût propre, plateformes partagées exclues).">Marginale</Th>
            <Th align="left">Décision</Th>
          </tr></thead>
          <tbody>{rows.map((r) => {
            const merged = ROW[r.id]?.merged;
            return (
              <tr key={r.id} className="border-b border-white/[0.045] align-top">
                <td className="px-2 py-[7px]">
                  <button type="button" onClick={() => openCase(r.id, "arbitrages")} className={`num rounded text-[12.5px] font-bold text-white underline decoration-white/25 underline-offset-4 hover:decoration-white ${FOCUS}`}>{r.id}</button>
                </td>
                <td className="px-2 py-[7px] text-[12.5px] leading-snug text-[var(--txt)]">{r.cas}</td>
                <td className={td}>{mdh(r.v20)}</td>
                <td className="px-2 py-[7px]"><div className="text-[12px] font-semibold leading-snug text-white">{r.cause}</div><div className="mt-0.5 text-[11.5px] leading-snug text-[var(--txt-2)]">{r.correction}</div></td>
                <td className={`${td} font-semibold text-white`}>{mdh(r.v21)}{merged && <span className="block text-[10.5px] font-normal text-[var(--mut)]">({merged})</span>}</td>
                <td className={td}>{mdh(r.marginal)}</td>
                <td className="px-2 py-[7px] text-[12px] text-[var(--txt-2)]">{r.decision ?? "—"}</td>
              </tr>
            );
          })}</tbody>
        </table>
        <Source>{notes[1]}{ARBITRAGE_PDF && ARBITRAGE_PDF.split.length > 0 && <> Répartition ({ARBITRAGE_PDF.split[0].ref}) : {ARBITRAGE_PDF.split.map((s) => `${s.k.toLowerCase()} : ${s.v}`).join(" ; ")}. Trois causes : {ARBITRAGE_PDF.ref}.</>}</Source>
      </Panel>

      <Panel title="Les leviers : la valeur qu'ils déverrouillent" sub={notes[2]}>
        {ARBITRAGE_PDF?.levers && <p className="text-[12.5px] leading-snug text-[var(--txt-2)]">{ARBITRAGE_PDF.levers} <span className="text-[var(--mut)]">(dossier v2.3, PDF 05 p. 9)</span></p>}
        <div className="mt-3 grid grid-cols-2 gap-[clamp(8px,0.6vw,12px)] min-[1700px]:grid-cols-4">
          {FIN.levers.map((l) => {
            const [title, ...rest] = l.what.split(" · ");
            return (
              <div key={l.levers} className="flex min-w-0 flex-col rounded-[14px] bg-white/[0.035] px-3.5 py-3 ring-1 ring-white/[0.07]">
                <div className="flex flex-wrap items-center gap-1.5">
                  {l.levers.split("+").map((id) => <button key={id} type="button" onClick={() => openCase(id.trim(), "arbitrages")} className={`num rounded-[6px] bg-white/[0.08] px-1.5 py-[1px] text-[11.5px] font-bold text-white hover:bg-white/[0.16] ${FOCUS}`}>{id.trim()}</button>)}
                  <span className="text-[12.5px] font-semibold text-white">{title}</span>
                </div>
                <p className="mt-1.5 flex-1 text-[12px] leading-snug text-[var(--txt-2)]">{rest.join(" · ")}</p>
                <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-2">
                  <div><div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Perdu cumulé</div><div className="num text-[17px] font-[800] text-white">{mdh(l.lostCumul)}</div><div className="text-[10.5px] text-[var(--mut)]">2031 : <span className="num">{mdh(l.lost2031)}</span></div></div>
                  <div><div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Coût cumulé</div><div className="num text-[17px] font-[800] text-[var(--txt-2)]">{mdh(l.cost)}</div></div>
                  <div><div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Protégé / 1 DH</div><div className="num text-[17px] font-[800] text-white">{l.ratio !== null ? `${fr(l.ratio, 0)} ×` : "—"}</div></div>
                </div>
              </div>
            );
          })}
        </div>
        <Source><b className="text-[var(--txt-2)]">À lire avec prudence (classeur 04).</b> {notes[3]}</Source>
      </Panel>
    </div>
  );
}
