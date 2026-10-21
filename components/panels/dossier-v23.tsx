"use client";
// "Chiffres actualisés v2.3": the case-by-case business case of the updated dataset, shown right after the verdict.
// ① savings + ② margin on the additional revenue = gross gains; − ③ cost = net value. Nothing of CASE[id].v23 is left out:
// the 2031 ledger and tiles, the 2027-2031 flows, the sizing assumptions, the arbitrage, the PDF additions and the full catalogue row.
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp } from "@/lib/store";
import { FIN, FINAL_YEAR, fr, type UseCase, type V23Case } from "@/lib/model";
import { I } from "@/components/ui/icons";
import { MarketTile, Dot } from "@/components/ui/kit";
import s from "@/components/ui/styles";
import { famName, FAM_COLOR } from "@/lib/ui/fmt";
import { assumptionRows, ficheRows, hypOf, numT, pcT, DISCOUNT } from "./dossier-v23-data";
import type { Block } from "./dossier-data";
import { Callout, CaseLink, Pill, Rich, Sub, FOCUS, G } from "./dz-ui";

type Proj = NonNullable<V23Case["projections"]>;
const d2 = (x: number) => fr(x, 2);
const tileD = (x: number) => (Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2);
const YS = (p: Proj) => Object.keys(p.brut).sort();

/** Sentences and values of the section that may hold an abbreviation, in reading order (see annotateAll). */
export function makeV23Blocks(c: UseCase): Block[] {
  const b: Block[] = [];
  b.push({ key: "v23.note", text: `Montants en MDH par an, scénario ${FIN.meta.scenario.toLowerCase()}. Valeur nette = ① économies (MS et hors MS) + ② marge sur le CA additionnel − ③ coût. Le CA additionnel est donné pour mémoire : seule sa marge compte.` });
  b.push({ key: "_v23seen", text: "", seen: ["ETP-éq.", "ETP", "ROI"] });
  const { groups } = assumptionRows(c);
  for (const g of groups) for (const r of g.rows) { b.push({ key: `ass.${r.key}`, text: r.text }); if (r.note) b.push({ key: `assn.${r.key}`, text: r.note }); }
  return b;
}

/** Opens the Finances view on this case (the finance view listens for "atlas:finance-case"). */
export function openFinanceCase(id: string) {
  useApp.getState().setSection("finances");
  window.dispatchEvent(new CustomEvent("atlas:finance-case", { detail: { id } }));
}
export function FinanceLink({ id }: { id: string }) {
  return (
    <button type="button" onClick={() => openFinanceCase(id)} data-anchor="v23:finance-link"
      className={`flex h-7 items-center gap-1 rounded-full bg-white/[0.06] pl-2.5 pr-2 text-[12px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.09] transition-colors hover:bg-white/[0.13] hover:text-white ${FOCUS}`}>
      Business case <I.chevron size={13} />
    </button>
  );
}

/* ---------------------------------------------------------------- disclosure */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {open && <motion.div key="c" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>{children}</motion.div>}
    </AnimatePresence>
  );
}
function Toggle({ open, onClick, children, anchor }: { open: boolean; onClick: () => void; children: React.ReactNode; anchor?: string }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} data-anchor={anchor}
      className={`flex h-8 w-fit items-center gap-1.5 rounded-full bg-white/[0.05] pl-3 pr-2.5 text-[12.5px] font-medium text-[#C9D4FF] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.1] hover:text-white ${FOCUS}`}>
      {children}<G.down size={13} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
    </button>
  );
}
const Dl = ({ rows }: { rows: { label: string; node: React.ReactNode; note?: React.ReactNode }[] }) => (
  <dl className="divide-y divide-white/[0.05]">
    {rows.map((r, i) => (
      <div key={i} className="grid grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)] gap-x-3 py-[7px]">
        <dt className="text-[12px] leading-snug text-[var(--mut)]">{r.label}</dt>
        <dd className="min-w-0 text-[12.5px] leading-snug text-[var(--txt)] [overflow-wrap:anywhere]">{r.node}{r.note ? <span className="mt-0.5 block text-[11.5px] text-[var(--mut)]">{r.note}</span> : null}</dd>
      </div>
    ))}
  </dl>
);

/* ---------------------------------------------------------------- ledger: ① + ② − ③ = net, 2031 */
function Ledger({ c }: { c: UseCase }) {
  const v = c.v23!.v23;
  const row = (label: React.ReactNode, val: number | null, o?: { sub?: boolean; strong?: boolean; memo?: boolean; neg?: boolean }) => (
    <div className={`flex items-baseline gap-3 ${o?.strong ? "py-2" : "py-[5px]"} ${o?.sub ? "pl-4" : ""}`}>
      <span className={`min-w-0 flex-1 leading-snug ${o?.strong ? "text-[13.5px] font-semibold text-white" : o?.memo ? "text-[12.5px] italic text-[var(--mut)]" : o?.sub ? "text-[12px] text-[var(--mut)]" : "text-[13px] text-[var(--txt)]"}`}>{label}</span>
      <span className={`num shrink-0 ${o?.strong ? "text-[16px]" : "text-[13.5px]"} ${o?.memo ? "text-[var(--mut)]" : o?.strong && (val ?? 0) < 0 ? "text-[#E9C27F]" : o?.strong ? "text-white" : "text-[var(--txt)]"}`}>{val === null ? "—" : `${o?.neg ? "−" : ""}${d2(Math.abs(val))}`}</span>
    </div>
  );
  return (
    <div className={`${s.card} rounded-[16px] px-4 py-2.5`} data-anchor="v23:ledger">
      <div className="flex items-center gap-2 border-b border-white/[0.07] pb-1.5">
        <span className="eyebrow !text-[10px] text-[var(--txt-2)]">{FINAL_YEAR} · MDH par an</span>
        <span className="ml-auto text-[11px] text-[var(--mut)]">scénario {FIN.meta.scenario.toLowerCase()}</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        <div>
          {row("① Économies réalisées", v.eco)}
          {row("dont masse salariale (postes non remplacés, recrutements évités)", v.ms, { sub: true })}
          {row("dont hors masse salariale (achats, énergie, maintenance, trésorerie…)", v.hms, { sub: true })}
        </div>
        <div>
          {row("CA additionnel généré (pour mémoire, non compté)", v.ca, { memo: true })}
          {row("② Marge sur CA additionnel", v.marge)}
        </div>
        {row("Gains bruts (① + ②)", v.gains, { strong: true })}
        {row("③ Coût du cas (agents et plateformes)", v.cout, { neg: true })}
        {row("Valeur nette (① + ② − ③)", v.net, { strong: true })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- 2027 → 2031 chart and table */
function FlowChart({ p }: { p: Proj }) {
  const ys = YS(p);
  const W = 460, H = 150, top = 12, bot = 22, pad = 6;
  const up = Math.max(...ys.map((y) => p.brut[y]), ...ys.map((y) => p.net[y]), 1e-4);
  const down = Math.max(...ys.map((y) => p.cout[y]), ...ys.map((y) => -p.net[y]), 0);
  const sc = (H - top - bot) / (up + down), y0 = top + up * sc;
  const gw = (W - pad * 2) / ys.length, bw = Math.min(20, gw * 0.3);
  const pts = ys.map((y, i) => [pad + gw * (i + 0.5), y0 - p.net[y] * sc] as const);
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--mut)]">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] bg-[rgba(76,199,154,.85)]" />gains bruts</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-[2px] bg-[rgba(185,193,214,.6)]" />coût (vers le bas)</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white" />valeur nette</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Gains bruts, coût et valeur nette de ${ys[0]} à ${ys[ys.length - 1]}`}>
        <line x1={pad} x2={W - pad} y1={y0} y2={y0} stroke="rgba(255,255,255,.18)" strokeWidth="1" />
        {ys.map((y, i) => {
          const cx = pad + gw * (i + 0.5);
          return (
            <g key={y}>
              <rect x={cx - bw - 1} y={y0 - p.brut[y] * sc} width={bw} height={Math.max(0, p.brut[y] * sc)} rx="2.5" fill="rgba(76,199,154,.85)" />
              <rect x={cx + 1} y={y0} width={bw} height={Math.max(0, p.cout[y] * sc)} rx="2.5" fill="rgba(185,193,214,.6)" />
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill="#8D97B0" style={{ fontVariantNumeric: "tabular-nums" }}>{y}</text>
            </g>
          );
        })}
        <polyline points={pts.map((q) => q.join(",")).join(" ")} fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.4" strokeLinejoin="round" />
        {pts.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r="3.6" fill="#fff" stroke="#0B1124" strokeWidth="1.5" />)}
      </svg>
    </div>
  );
}

function FlowTable({ p, all }: { p: Proj; all: boolean }) {
  const ys = YS(p);
  const sum = (a: Record<string, number>, b: Record<string, number>) => Object.fromEntries(ys.map((y) => [y, a[y] + b[y]]));
  type R = { label: string; vals: Record<string, number>; kind?: "pct" | "etp"; strong?: boolean; sub?: boolean; memo?: boolean; more?: boolean };
  const rows: R[] = [
    { label: "Adoption", vals: p.adoption, kind: "pct" },
    { label: "① Économies", vals: sum(p.ms, p.hms) },
    { label: "dont masse salariale", vals: p.ms, sub: true, more: true },
    { label: "dont hors masse salariale", vals: p.hms, sub: true, more: true },
    { label: "CA additionnel (pour mémoire)", vals: p.ca, memo: true, more: true },
    { label: "② Marge sur CA", vals: p.marge },
    { label: "Gains bruts", vals: p.brut, strong: true },
    { label: "Coût propre au cas", vals: p.cout_propre, sub: true, more: true },
    { label: "dont plateformes", vals: p.plateforme, sub: true, more: true },
    { label: "③ Coût", vals: p.cout },
    { label: "Valeur nette", vals: p.net, strong: true },
    { label: "Valeur marginale", vals: p.marginal, more: true },
    { label: "ETP-éq. libérés", vals: p.etp, kind: "etp", more: true },
  ];
  const shown = rows.filter((r) => all || !r.more);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]" data-anchor="v23:flows">
        <thead>
          <tr className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--mut)]">
            <th className="pb-1.5 text-left font-medium"><span className="sr-only">Flux</span></th>
            {ys.map((y) => <th key={y} scope="col" className="num pb-1.5 pl-2 text-right font-medium">{y}</th>)}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.label} className={`border-t border-white/[0.05] ${r.strong ? "bg-white/[0.03]" : ""}`}>
              <th scope="row" className={`py-[5px] pr-2 text-left font-normal leading-snug ${r.sub ? "pl-3 text-[11.5px] text-[var(--mut)]" : r.memo ? "italic text-[var(--mut)]" : r.strong ? "font-semibold text-white" : "text-[var(--txt)]"}`}>{r.label}</th>
              {ys.map((y) => {
                const x = r.vals[y];
                const txt = r.kind === "pct" ? `${Math.round(x * 100)} %` : r.kind === "etp" ? numT(x, 1) : d2(x);
                return <td key={y} className={`num py-[5px] pl-2 text-right ${r.strong ? "text-white" : r.memo || r.sub ? "text-[var(--mut)]" : "text-[var(--txt-2)]"} ${x < 0 ? "!text-[#E9C27F]" : ""}`}>{txt}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- body */
export function V23Body({ c, tx }: { c: UseCase; tx: Record<string, string> }) {
  const v = c.v23!;
  const p = v.projections;
  const [allFlows, setAllFlows] = useState(false);
  const [openAss, setOpenAss] = useState(true);
  const [openFiche, setOpenFiche] = useState(false);
  const { groups, empty } = assumptionRows(c);
  const fiche = ficheRows(c);
  const arb = v.arbitrage_v21;
  const hostCase = c.merged_into;
  const openFinance = () => openFinanceCase(c.id);
  const ca = v.v23.ca ?? 0, marge = v.v23.marge ?? 0;
  const caType = String(v.assumptions?.["Type de CA"] ?? "");
  const hMargin = caType === "N" ? hypOf(/^Marge contributive/) : hypOf(/^Marge sur CA récupéré/);
  const nYears = p ? YS(p).length : 0;
  const cum: number[] = []; if (p) { let a = 0; for (const y of YS(p)) { a += p.net[y]; cum.push(a); } }
  const ratio = p ? YS(p).map((y) => (p.cout[y] ? p.brut[y] / p.cout[y] : 0)) : undefined;

  return (
    <>
      <p className="text-[13px] leading-snug text-[var(--txt-2)]"><Rich t={tx["v23.note"] ?? ""} /></p>

      {hostCase && (
        <Callout icon={<I.layers size={14} />} label={`Fusionné dans ${hostCase}`} tone="blue" anchor="v23:merged">
          <p>{v.v23.arbitrage ?? "Pas de valeur propre : sa valeur est comptée dans le cas qui l'absorbe."}</p>
          <div className="mt-2"><CaseLink id={hostCase} note="cas qui porte la valeur" /></div>
        </Callout>
      )}

      {p && (
        <>
          <Ledger c={c} />
          <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Indicateurs ${FINAL_YEAR}`}>
            <MarketTile size="md" label="Valeur nette cumulée" value={v.v23.cumul ?? p.cumul_net} d={tileD(v.v23.cumul ?? p.cumul_net)} unit="MDH" series={cum} active={cum.length - 1} color="#E6EAF5" explain={<>somme des valeurs nettes de {YS(p)[0]} à {YS(p)[cum.length - 1]}</>} anchor="v23:cumul" />
            <MarketTile size="md" label={`VAN à ${fr(DISCOUNT * 100, 0)} %`} value={p.van_net} d={tileD(p.van_net)} unit="MDH" color="#9FB3FF" explain={<>valeur actuelle nette : ce que valent aujourd&apos;hui les valeurs nettes {YS(p)[0]}-{YS(p)[cum.length - 1]}, actualisées à {fr(DISCOUNT * 100, 0)} % par an</>} anchor="v23:van" />
            <MarketTile size="md" label="Gains pour 1 dirham" value={c.roi} d={1} series={ratio} active={(ratio?.length ?? 1) - 1} color="var(--amber)" tone="neutral" explain={<>dirhams de gains bruts pour 1 dirham de coût du cas</>} anchor="v23:ratio" />
            <MarketTile size="md" label="ETP-éq. libérés" value={v.v23.etp ?? 0} d={(v.v23.etp ?? 0) < 10 ? 1 : 0} series={YS(p).map((y) => p.etp[y])} active={nYears - 1} color="#9FB3FF" explain={<>équivalents temps plein libérés en {FINAL_YEAR} : travail repris, en postes à plein temps</>} anchor="v23:etp" />
          </div>

          {(ca > 0 || marge > 0) && (
            <Callout icon={<I.spark size={14} />} label="Le CA additionnel n'est pas de la valeur" tone="amber" anchor="v23:ca">
              <p>
                Ce cas génère <b className="num font-semibold text-white">{d2(ca)} MDH</b> de CA additionnel en {FINAL_YEAR}. Mais produire ce CA coûte : seule la marge compte.
                {" "}<b className="num font-semibold text-white">{d2(marge)} MDH</b>{ca > 0 ? ` (${pcT(marge / ca)})` : ""} entrent dans les gains bruts.
              </p>
              {hMargin && <p className="mt-1.5 text-[12.5px] text-[var(--txt-2)]">{hMargin.label} : {typeof hMargin.value === "number" ? pcT(hMargin.value) : hMargin.value}{hMargin.note ? `. ${hMargin.note}` : ""}.</p>}
            </Callout>
          )}

          <div className="flex flex-col gap-2.5">
            <Sub right={<span className="text-[11.5px] text-[var(--mut)]">MDH par an</span>}>Flux {YS(p)[0]} → {YS(p)[YS(p).length - 1]}</Sub>
            <div className={`${s.card} rounded-[16px] px-3.5 py-3`}>
              <FlowChart p={p} />
              <div className="mt-2.5"><FlowTable p={p} all={allFlows} /></div>
            </div>
            <Toggle open={allFlows} onClick={() => setAllFlows((x) => !x)} anchor="v23:all-flows">{allFlows ? "Moins de flux" : "Tous les flux"}</Toggle>
          </div>
        </>
      )}

      {(v.v23.brique || p?.brique_code) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Brique</span>
          {v.v23.brique && <Pill tone="blue">{v.v23.brique}</Pill>}
          {p?.brique_code && <Pill>code {p.brique_code}</Pill>}
          <span className="ml-1 flex items-center gap-1.5 text-[11.5px] text-[var(--mut)]"><Dot color={FAM_COLOR[c.fam || c.id[0]]} size={6} />famille {famName(c.fam || c.id[0]).toLowerCase()}</span>
        </div>
      )}

      {v.v23.hypothese && <Callout icon={<G.target size={14} />} label="Hypothèse de chiffrage" tone="blue" anchor="v23:hypothese">{v.v23.hypothese}</Callout>}

      {groups.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <Sub>Hypothèses de dimensionnement · {groups.reduce((a, g) => a + g.rows.length, 0)}</Sub>
          <Toggle open={openAss} onClick={() => setOpenAss((x) => !x)} anchor="v23:assumptions">{openAss ? "Masquer les hypothèses" : "Lire les hypothèses"}</Toggle>
          <Collapse open={openAss}>
            <div className={`${s.card} flex flex-col gap-3 rounded-[16px] px-3.5 py-3`}>
              {groups.map((g) => (
                <div key={g.name}>
                  <div className="eyebrow !text-[9.5px] text-[var(--txt-2)]">{g.name}</div>
                  <Dl rows={g.rows.map((r) => ({ label: r.label, node: <Rich t={tx[`ass.${r.key}`] ?? r.text} />, note: r.note ? <Rich t={tx[`assn.${r.key}`] ?? r.note} /> : undefined }))} />
                </div>
              ))}
              <EmptyLine empty={empty} />
            </div>
          </Collapse>
        </div>
      )}

      {(arb || (v.v23.arbitrage && !hostCase)) && (
        <Callout icon={<G.alert size={14} />} label={`Arbitrage v2.1${arb?.decision ? ` · ${arb.decision}` : ""}`} tone="amber" anchor="v23:arbitrage">
          {v.v23.arbitrage && !hostCase && <p>{v.v23.arbitrage}</p>}
          {arb && (
            <dl className="mt-2 divide-y divide-white/[0.06]">
              {arb.cause && <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 py-1.5"><dt className="text-[11.5px] text-[var(--mut)]">Cause</dt><dd className="text-[12.5px] leading-snug">{arb.cause}</dd></div>}
              {arb.correction && <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 py-1.5"><dt className="text-[11.5px] text-[var(--mut)]">Correction</dt><dd className="text-[12.5px] leading-snug">{arb.correction}</dd></div>}
              {(arb.v20 !== null || arb.v21 !== null) && <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 py-1.5"><dt className="text-[11.5px] text-[var(--mut)]">Valeur</dt><dd className="num text-[12.5px]">{arb.v20 !== null ? `v2.0 : ${d2(arb.v20)}` : ""}{arb.v20 !== null && arb.v21 !== null ? "  →  " : ""}{arb.v21 !== null ? `v2.1 : ${d2(arb.v21)}` : ""} <span className="font-normal text-[var(--mut)]">MDH par an</span></dd></div>}
              {arb.marginal !== null && <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-3 py-1.5"><dt className="text-[11.5px] text-[var(--mut)]">Marginale</dt><dd className="num text-[12.5px]">{d2(arb.marginal)} <span className="font-normal text-[var(--mut)]">MDH par an</span></dd></div>}
            </dl>
          )}
        </Callout>
      )}

      {(v.pdf_extra?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2" data-anchor="v23:pdf-extra">
          <Sub>Compléments du dossier v2.3 · {v.pdf_extra.length}</Sub>
          {v.pdf_extra.map((x, i) => (
            <div key={i} className={`${s.card} rounded-[12px] px-3.5 py-2.5`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="rounded-md bg-white/[0.07] px-1.5 py-[1px] text-[10.5px] text-[var(--txt-2)]">p. {x.page}</span>
                <span className="text-[11.5px] font-medium text-[#AFC0FF]">{x.field}</span>
              </div>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--txt)] [overflow-wrap:anywhere]">{x.value}</p>
            </div>
          ))}
        </div>
      )}

      {fiche.rows.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <Toggle open={openFiche} onClick={() => setOpenFiche((x) => !x)} anchor="v23:fiche">Fiche complète · {fiche.rows.length} champ{fiche.rows.length > 1 ? "s" : ""}</Toggle>
          <Collapse open={openFiche}>
            <div className={`${s.card} rounded-[16px] px-3.5 py-2`}>
              <Dl rows={fiche.rows.map((r) => ({ label: r.label, node: r.text }))} />
              {fiche.empty > 0 && <p className="border-t border-white/[0.05] pt-2 text-[11.5px] text-[var(--mut)]">{fiche.empty} autre{fiche.empty > 1 ? "s" : ""} colonne{fiche.empty > 1 ? "s" : ""} du catalogue sans valeur pour ce cas.</p>}
            </div>
          </Collapse>
        </div>
      )}

      <button type="button" onClick={openFinance} data-anchor="v23:open-finance"
        className={`group flex h-10 items-center justify-center gap-2 rounded-full bg-white/[0.08] px-4 text-[13px] font-semibold text-white ring-1 ring-white/[0.14] transition-colors hover:bg-white/[0.15] ${FOCUS}`}>
        Voir le business case détaillé <I.arrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </>
  );
}

/** The assumptions this case leaves blank, listed so that no field of the sizing sheet goes missing. */
function EmptyLine({ empty }: { empty: string[] }) {
  if (!empty.length) return null;
  return <p className="border-t border-white/[0.05] pt-2 text-[11.5px] leading-snug text-[var(--mut)]">Champs non renseignés pour ce cas : {empty.join(", ")}.</p>;
}

