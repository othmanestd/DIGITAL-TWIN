"use client";
// Finance · one business case: its 2027-2031 projections (every flow, cumul, VAN), value vs cost and cumulative net charts,
// every sizing assumption with its unit and proof, the full-regime 2026 equivalents, the v2.1 arbitrage, the 2031 catalogue figures.
import type { ReactNode } from "react";
import { FIN, CASE, fr, type Series } from "@/lib/model";
import { useApp } from "@/lib/store";
import { I } from "@/components/ui/icons";
import { YearStack, LineChart, type YearData } from "./charts";
import { Panel, Legend, Derived, Source, Th, Chip, Btn, FOCUS } from "./ui";
import {
  COL, Y5, LAST, ROW, ROWS, FLOWS, ASSUMPTIONS, FULL_REGIME, BRIQUE_CODE, METIER, ASSIETTE, LEVEL, MARGE_R, MARGE_N,
  mdh, minus, etp, ratio, exact, pctExact, npv, total, cumSeries, firstPositive, leversOf, type AKind, type FlowKey,
} from "./data";
import { useFin, TABS } from "./state";

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function fmtAssumption(kind: AKind, x: string | number | null | undefined): { main: ReactNode; sub?: ReactNode } {
  if (x === null || x === undefined || x === "") return { main: <span className="text-[var(--mut)]">—</span> };
  switch (kind) {
    case "pct": return { main: isNum(x) ? pctExact(x) : String(x) };
    case "num": return { main: isNum(x) ? exact(x) : String(x) };
    case "kmad": return { main: isNum(x) ? `${exact(x)} kMAD` : String(x) };
    case "mad": return { main: isNum(x) ? `${exact(x)} MAD` : String(x) };
    case "mdh": return { main: isNum(x) ? `${exact(x)} MDH` : String(x) };
    case "year": return { main: String(x) };
    case "metier": { const m = METIER[String(x)]; return m ? { main: m.label, sub: <>clé {m.key} · famille {m.fam}{isNum(m.part) ? <> · {pctExact(m.part)} de son temps adressé par les cas</> : null}</> } : { main: String(x) }; }
    case "assiette": { const a = ASSIETTE[String(x)]; return a ? { main: a.label, sub: <>clé {a.key}{isNum(a.part) ? <> · {pctExact(a.part)} {a.type === "MS" ? "de la masse salariale" : "du CA"}</> : null} · 2026 : <span className="num">{fr(a.values["2026"], 1)}</span> · 2031 : <span className="num">{fr(a.values["2031"], 1)}</span>{a.type === "SITES" ? "" : " MDH"}</> } : { main: String(x) }; }
    case "typeCA": return x === "R" ? { main: "R · CA récupéré", sub: <>soins déjà réalisés{MARGE_R !== null ? <> · marge {pctExact(MARGE_R)}</> : null}</> } : x === "N" ? { main: "N · nouvelle activité", sub: <>marge contributive{MARGE_N !== null ? <> {pctExact(MARGE_N)}</> : null}</> } : { main: String(x) };
    case "level": return { main: LEVEL[String(x)] ?? String(x) };
    case "brique": return { main: BRIQUE_CODE[String(x)] ?? String(x), sub: <>code {String(x)}</> };
    default: return { main: String(x) };
  }
}

function Op({ children }: { children: ReactNode }) {
  return <span className="self-center px-0.5 text-[15px] font-semibold text-[var(--mut)]">{children}</span>;
}
function Fig({ label, value, strong, muted, tip }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; tip?: string }) {
  return (
    <div className={`min-w-0 rounded-[12px] px-3 py-2 ${strong ? "bg-white/[0.08] ring-1 ring-white/[0.12]" : "bg-white/[0.03] ring-1 ring-white/[0.05]"}`} title={tip}>
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">{label}</div>
      <div className={`num mt-0.5 whitespace-nowrap text-[clamp(16px,1.15vw,20px)] font-[800] leading-tight ${muted ? "text-[var(--txt-2)]" : "text-white"}`}>{value}</div>
    </div>
  );
}
function Kv({ k, v, sub }: { k: ReactNode; v: ReactNode; sub?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-baseline gap-3 border-b border-white/[0.045] py-[6px] last:border-0">
      <span className="text-[12px] leading-snug text-[var(--txt-2)]">{k}</span>
      <span className="min-w-0 text-right"><span className="text-[12.5px] font-semibold text-white">{v}</span>{sub && <span className="block text-[10.5px] leading-snug text-[var(--mut)]">{sub}</span>}</span>
    </div>
  );
}

export function CaseDetail({ id }: { id: string }) {
  const { from, closeCase, setTab, openCase } = useFin();
  const r = ROW[id], c = CASE[id];
  if (!r || !c) return <div className="p-6 text-[var(--mut)]">Cas inconnu : {id}</div>;
  const rec = r.rec, p = r.proj, a = rec?.assumptions ?? null, cat = rec?.catalogue ?? {};
  const idx = ROWS.findIndex((x) => x.id === id);
  const prev = ROWS[(idx - 1 + ROWS.length) % ROWS.length], next = ROWS[(idx + 1) % ROWS.length];
  const fromLabel = TABS.find((t) => t.id === from)?.short ?? "Cas par cas";
  const twin = () => { const app = useApp.getState(); app.select({ kind: "case", id }); app.setSection("explorer"); };
  const absorbed = ROWS.filter((x) => x.merged === id);
  const lev = leversOf(id);
  const arb = rec?.arbitrage_v21 ?? null;
  const cum = p ? cumSeries(p.net) : null;
  const be = cum ? firstPositive(cum) : null;
  const level = a?.["Niveau de preuve"] ? String(a["Niveau de preuve"]) : null;
  const justification = a?.["Justification (benchmark v1.3)"] ?? rec?.v23.hypothese ?? null;

  const verdict = (() => {
    if (r.merged) return <>Fusionné dans <b className="text-white">{r.merged}</b> lors de l&apos;arbitrage v2.1 : sa valeur est comptée dans ce cas, il n&apos;a plus de chiffrage propre.</>;
    if (!p) return <>Sans chiffrage propre dans le business case v2.3.</>;
    if (r.lever) return <>Levier de réalisation, <b className="text-white">sans gain propre</b> : il coûte <span className="num">{mdh(r.cout)}</span> MDH en {LAST} ({mdh(r.cumul)} MDH cumulés). Sa valeur est celle qu&apos;il protège sur les autres cas{lev.length ? " (ci-dessous)" : ""}.</>;
    const how = (r.marge ?? 0) > 0
      ? <><span className="num">{mdh(r.eco)}</span> MDH d&apos;économies + <span className="num">{mdh(r.marge)}</span> MDH de marge sur <span className="num">{mdh(r.ca)}</span> MDH de CA additionnel</>
      : <><span className="num">{mdh(r.eco)}</span> MDH d&apos;économies</>;
    return <>Valeur nette de <b className="num text-white">{mdh(r.net)}</b> MDH en {LAST} : {how}, pour <span className="num">{mdh(r.cout)}</span> MDH de coût. Cumul 2027-2031 : <b className="num text-white">{mdh(r.cumul)}</b> MDH{be ? <>, positif dès {be}</> : null}.</>;
  })();

  const years: YearData[] = p ? Y5.map((y) => ({
    y,
    up: [{ v: p.ms[y], color: COL.ms, label: "Masse salariale" }, { v: p.hms[y], color: COL.hms, label: "Hors masse salariale" }, { v: p.marge[y], color: COL.marge, label: "Marge sur CA additionnel" }],
    down: [{ v: p.cout_propre[y], color: COL.cout, label: "Coût propre du cas" }, { v: p.plateforme[y], color: COL.coutC, label: "Quote-part des plateformes" }],
    net: p.net[y],
  })) : [];

  const flowCell = (k: FlowKey, x: number, kind: string) => (k === "adoption" ? pctExact(x) : k === "etp" ? etp(x, 1) : kind === "minus" ? minus(x) : mdh(x));
  const flowTotal = (k: FlowKey, s: Series, kind: string) => {
    if (k === "adoption" || k === "etp") return "—";
    if (k === "net") return mdh(p!.cumul_net);
    return kind === "minus" ? minus(total(s)) : mdh(total(s));
  };
  const flowVan = (k: FlowKey, s: Series, kind: string) => {
    if (k === "adoption" || k === "etp") return "—";
    if (k === "net") return mdh(p!.van_net);
    return kind === "minus" ? minus(npv(s)) : mdh(npv(s));
  };

  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      {/* breadcrumbs */}
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={closeCase} className={`flex h-8 items-center gap-1.5 rounded-full bg-white/[0.06] pl-2.5 pr-3 text-[12.5px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.09] hover:bg-white/[0.12] hover:text-white ${FOCUS}`}>
          <I.back size={15} />Retour
        </button>
        <ol className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-[var(--mut)]">
          <li><button type="button" onClick={() => setTab("overview")} className={`rounded hover:text-white ${FOCUS}`}>Finances</button></li>
          <li aria-hidden>›</li>
          <li><button type="button" onClick={closeCase} className={`rounded hover:text-white ${FOCUS}`}>{fromLabel}</button></li>
          <li aria-hidden>›</li>
          <li className="num font-semibold text-white" aria-current="page">{id}</li>
        </ol>
        <span className="flex-1" />
        <Btn onClick={() => openCase(prev.id)} title={`Cas précédent : ${prev.id}`}><I.chevron size={14} className="rotate-180" />{prev.id}</Btn>
        <Btn onClick={() => openCase(next.id)} title={`Cas suivant : ${next.id}`}>{next.id}<I.chevron size={14} /></Btn>
        <Btn onClick={twin} primary><I.hospital size={15} />Voir dans le jumeau</Btn>
      </nav>

      {/* header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="num rounded-[8px] px-2 py-[3px] text-[13px] font-[800] text-white" style={{ background: `color-mix(in srgb, ${r.famColor} 38%, transparent)` }}>{id}</span>
          {r.brique && <Chip color={r.briqueColor}>{r.brique}</Chip>}
          <Chip color={r.famColor}>{r.fam} · {r.famLabel}</Chip>
          {r.vague !== "—" && <Chip>vague {r.vague}</Chip>}
          {level && <Chip>preuve {LEVEL[level] ?? level}</Chip>}
          {r.merged && <Chip>fusionné → {r.merged}</Chip>}
          {r.lever && <Chip>levier de réalisation</Chip>}
          {absorbed.map((x) => <Chip key={x.id}>absorbe {x.id} (v2.1)</Chip>)}
        </div>
        <h2 className="h-display text-[clamp(20px,1.6vw,28px)] text-white">{r.titre}</h2>
        <p className="max-w-[1100px] text-[clamp(13.5px,0.95vw,16px)] leading-snug text-[var(--txt-2)]">{verdict}</p>
        {r.merged && <div><Btn onClick={() => openCase(r.merged!)} primary>Ouvrir {r.merged}<I.arrowRight size={14} /></Btn></div>}
      </div>

      {p && <>
        {/* the PDF 05 case strip: économies + marge = gains − coût = valeur */}
        <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.1fr)] items-stretch gap-1.5">
          <Fig label={`Économies ${LAST}`} value={mdh(r.eco)} />
          <Fig label="+ Marge CA" value={mdh(r.marge)} />
          <Fig label="(CA add.)" value={mdh(r.ca)} muted tip="CA additionnel, pour mémoire : non additionné." />
          <Op>=</Op>
          <Fig label="Gains bruts" value={mdh(r.gains)} />
          <Op>−</Op>
          <Fig label="Coût des agents" value={minus(r.cout)} muted />
          <Op>=</Op>
          <Fig label="Valeur nette" value={mdh(r.net)} strong />
          <Op>·</Op>
          <Fig label="Valeur marginale" value={mdh(p.marginal[LAST])} tip="Ce que le programme perd si l'on retire le cas (valeur brute − coût propre, plateformes partagées exclues)." />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <Fig label="Cumul 2027-2031" value={<>{mdh(p.cumul_net)} <span className="text-[12px] font-semibold text-[var(--mut)]">MDH</span></>} />
          <Fig label="VAN à 10 %" value={<>{mdh(p.van_net)} <span className="text-[12px] font-semibold text-[var(--mut)]">MDH</span></>} tip="Valeur actuelle nette : la valeur nette 2027-2031 actualisée à 10 % par an, ramenée à fin 2026 (méthode de la Synthèse)." />
          <Fig label="Gains pour 1 dirham" value={<>{ratio(r.ratio)} <span className="text-[12px] font-semibold text-[var(--mut)]">en {LAST} · {ratio(r.ratioP)} sur 5 ans</span></>} tip="Valeur brute ÷ coût des agents du cas (calculé)." />
          <Fig label={`ETP-éq. libérés ${LAST}`} value={etp(r.etp, 1)} tip="Équivalents temps plein de travail repris par les agents." />
        </div>

        {/* charts */}
        <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
          <Panel title="Valeur et coût par année" sub="MDH · gains au-dessus de l'axe, coût en dessous, valeur nette à droite" bodyClass="flex flex-col">
            <div className="h-[clamp(220px,32vh,340px)] min-h-0"><YearStack data={years} compact /></div>
            <Legend className="mt-2.5 border-t border-white/[0.07] pt-2" items={[
              { label: "Masse salariale", color: COL.ms }, { label: "Hors masse salariale", color: COL.hms }, { label: "Marge sur CA", color: COL.marge },
              { label: "Coût propre", color: COL.cout }, { label: "Quote-part plateformes", color: COL.coutC }, { label: "Valeur nette", color: COL.net },
            ]} />
          </Panel>
          <Panel title="Valeur nette cumulée du cas" sub="MDH" right={<Derived how="Somme, année après année, de la valeur nette du cas (onglet Projections) ; le total 2031 égale le cumul 2027-2031 du classeur." />} bodyClass="flex flex-col">
            <div className="h-[clamp(220px,32vh,340px)] min-h-0">
              <LineChart series={cum!} color={COL.cumul} bars={p.net} barsLabel="Valeur nette de l'année" label="Valeur nette cumulée" mark={be && be !== Y5[0] ? { y: be, text: `cumul positif dès ${be}` } : null} />
            </div>
            <Legend className="mt-2.5 border-t border-white/[0.07] pt-2" items={[{ label: "Cumul", color: COL.cumul, kind: "line" }, { label: "Valeur nette de l'année", color: "rgba(232,236,246,.35)" }]} />
          </Panel>
        </div>

        {/* projections table */}
        <Panel title="Projections 2027-2031" sub="onglet Projections du classeur 04, scénario central">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead><tr className="border-b border-white/[0.09]">
                <Th align="left">Flux</Th>{Y5.map((y) => <Th key={y}>{y}</Th>)}
                <Th className="border-l border-white/[0.06]" tip="Somme des cinq années.">Cumul 27-31</Th>
                <Th tip="Valeur actuelle nette à 10 % (2027 actualisé d'un an). Pour la valeur nette : valeur du jeu de données ; pour les autres flux : calculée avec la même méthode.">VAN 10 %</Th>
              </tr></thead>
              <tbody>
                {FLOWS.map((f) => {
                  const s = p[f.k] as Series;
                  const strong = f.kind === "total" || f.kind === "net";
                  const text = f.kind === "net" ? "font-bold text-white" : strong ? "font-semibold text-white" : f.kind === "memo" ? "italic text-[var(--mut)]" : f.kind === "info" ? "text-[var(--txt-2)]" : "text-[var(--txt)]";
                  const indent = f.k === "cout_propre" || f.k === "plateforme" ? "pl-6" : "";
                  return (
                    <tr key={f.k} className={`border-b border-white/[0.045] ${f.kind === "net" ? "bg-white/[0.06]" : ""}`}>
                      <th scope="row" className={`px-2 py-[6px] text-left text-[12.5px] font-normal ${text} ${indent}`}>{f.label}{f.k === "plateforme" && <span className="text-[var(--mut)]"> · licence partagée, au prorata de la valeur</span>}</th>
                      {Y5.map((y) => <td key={y} className={`num whitespace-nowrap px-2 py-[6px] text-right text-[13px] ${text}`}>{flowCell(f.k, s[y], f.kind)}</td>)}
                      <td className={`num whitespace-nowrap border-l border-white/[0.06] px-2 py-[6px] text-right text-[13px] ${text}`}>{flowTotal(f.k, s, f.kind)}</td>
                      <td className={`num whitespace-nowrap px-2 py-[6px] text-right text-[13px] ${text}`}>{flowVan(f.k, s, f.kind)}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-white/[0.045]">
                  <th scope="row" className="px-2 py-[6px] text-left text-[12.5px] font-normal text-[var(--txt)]">Valeur nette cumulée <Derived how="Somme des valeurs nettes depuis 2027." /></th>
                  {Y5.map((y) => <td key={y} className="num px-2 py-[6px] text-right text-[13px] text-[var(--txt)]">{mdh(cum![y])}</td>)}
                  <td className="border-l border-white/[0.06]" /><td />
                </tr>
              </tbody>
            </table>
          </div>
          <Source>Coût des agents = coût propre (construction 60 % l&apos;année de début et 40 % la suivante, paramétrage, licence fixe, calcul, supervision) + quote-part des plateformes partagées. Valeur nette = valeur brute − coût des agents. Valeur marginale = valeur brute − coût propre : ce que le programme perd si l&apos;on retire le cas. Coûts transverses et contingence non inclus (portés au niveau du programme).</Source>
        </Panel>
      </>}

      <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        {/* sizing assumptions */}
        <Panel title="Hypothèses de dimensionnement" sub="onglet Cas du classeur 04">
          {a ? (
            <div className="flex flex-col gap-3">
              {justification && (
                <div className="rounded-[12px] bg-white/[0.04] px-3.5 py-2.5 ring-1 ring-white/[0.06]">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Justification (benchmark v1.3){level && <Chip className="!text-[10.5px] normal-case tracking-normal">niveau {LEVEL[level] ?? level}</Chip>}</div>
                  <p className="mt-1 text-[13px] leading-snug text-[var(--txt)]">{String(justification)}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {ASSUMPTIONS.map((g) => (
                  <div key={g.title} className="min-w-0">
                    <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#AFC0FF]">{g.title}</div>
                    {g.items.map((it) => {
                      const f = fmtAssumption(it.kind, a[it.k]);
                      return <Kv key={it.k} k={<>{it.label}{it.unit && <span className="text-[var(--mut)]"> ({it.unit})</span>}</>} v={f.main} sub={f.sub} />;
                    })}
                  </div>
                ))}
              </div>
              <Source className="!mt-0">kMAD = milliers de dirhams · MDH = millions de dirhams · ETP = équivalent temps plein. Hypothèses de cadrage à mesurer au point zéro ; les réductions s&apos;appuient sur le benchmark v1.3.</Source>
            </div>
          ) : <p className="text-[12.5px] text-[var(--mut)]">Pas d&apos;hypothèses propres : {r.merged ? <>le cas est dimensionné dans {r.merged}.</> : <>cas non chiffré.</>}</p>}
        </Panel>

        <div className="flex min-w-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
          {a && (
            <Panel title="Plein régime à périmètre 2026" sub="comparable aux 302 MDH de la v1.0">
              {FULL_REGIME.map((f) => <Kv key={f.k} k={f.label} v={isNum(a[f.k]) ? (f.kind === "etp" ? `${etp(a[f.k] as number, 1)} ETP-éq.` : `${mdh(a[f.k] as number)} MDH`) : "—"} />)}
              <Source>45 établissements, salaires et prix 2026, adoption complète : l&apos;équivalent comparable aux estimations de la v1.0.</Source>
            </Panel>
          )}
          {arb && (
            <Panel title="Arbitrage v2.1" sub="cas à valeur nulle ou négative en v2.0">
              <Kv k="Valeur nette v2.0 (2031)" v={`${mdh(arb.v20)} MDH`} />
              <Kv k="Cause" v={arb.cause} />
              <Kv k={r.merged ? `Valeur v2.1 (cas d'accueil ${r.merged})` : "Valeur nette v2.1 (2031)"} v={`${mdh(arb.v21)} MDH`} />
              <Kv k="Valeur marginale" v={`${mdh(arb.marginal)} MDH`} sub="ce que le programme perd si l'on retire le cas" />
              <Kv k="Décision" v={arb.decision ?? "—"} />
              <p className="mt-2 text-[12.5px] leading-snug text-[var(--txt-2)]"><b className="text-white">Correction.</b> {arb.correction}</p>
            </Panel>
          )}
          {lev.length > 0 && (
            <Panel title="Valeur déverrouillée par le levier" sub="simulation du modèle, 04 · Arbitrage">
              {lev.map((l) => (
                <div key={l.levers} className="flex flex-col gap-1 border-b border-white/[0.05] pb-2 last:border-0">
                  <div className="text-[12.5px] font-semibold text-white">{l.levers}</div>
                  <p className="text-[12px] leading-snug text-[var(--txt-2)]">{l.what}</p>
                  <div className="mt-1 grid grid-cols-4 gap-1.5">
                    <Fig label="Perdu 2031" value={mdh(l.lost2031)} /><Fig label="Perdu cumulé" value={mdh(l.lostCumul)} /><Fig label="Coût cumulé" value={mdh(l.cost)} muted /><Fig label="Protégé / 1 DH" value={`${fr(l.ratio ?? 0, 0)} ×`} />
                  </div>
                </div>
              ))}
              <Source>{FIN.arbitrage_notes[FIN.arbitrage_notes.length - 1]}</Source>
            </Panel>
          )}
          <Panel title={`Catalogue 03 · chiffres ${LAST}`} sub="colonnes AR à BD, arrondies à 4 décimales dans le catalogue">
            {rec?.v23 && (rec.v23.net !== null ? <>
              <Kv k="ETP-équivalents libérés" v={etp(rec.v23.etp, 1)} />
              <Kv k="① Économies (masse salariale + hors MS)" v={`${mdh(rec.v23.eco)} MDH`} sub={<>dont masse salariale {mdh(rec.v23.ms)} · hors MS {mdh(rec.v23.hms)}</>} />
              <Kv k="② Marge sur CA additionnel" v={`${mdh(rec.v23.marge)} MDH`} sub={<>sur {mdh(rec.v23.ca)} MDH de CA additionnel (pour mémoire)</>} />
              <Kv k="Gains bruts (① + ②)" v={`${mdh(rec.v23.gains)} MDH`} />
              <Kv k="③ Coût des agents" v={`${minus(rec.v23.cout)} MDH`} />
              <Kv k="Valeur nette" v={`${mdh(rec.v23.net)} MDH`} />
              <Kv k="Valeur nette cumulée 2027-2031" v={`${mdh(rec.v23.cumul)} MDH`} />
              {rec.v23.hypothese && rec.v23.hypothese !== justification && <Kv k="Hypothèse de chiffrage" v={<span className="font-normal">{rec.v23.hypothese}</span>} />}
            </> : <Kv k="Chiffrage" v={rec.v23.brique ?? "—"} sub={rec.v23.arbitrage ?? undefined} />)}
            {isNum(cat["MDH / an · v1.0 (estimation primaire)"]) && (
              <div className="mt-2 rounded-[10px] bg-white/[0.03] px-3 py-2 text-[11.5px] leading-snug text-[var(--mut)] ring-1 ring-white/[0.05]">
                Pour mémoire, estimation primaire v1.0 : <span className="num text-[var(--txt-2)]">{mdh(cat["MDH / an · v1.0 (estimation primaire)"] as number)}</span> MDH/an,
                {" "}<span className="num text-[var(--txt-2)]">{etp(cat["ETP-éq. · v1.0 (estimation primaire)"] as number, 1)}</span> ETP-éq.,
                {" "}coût <span className="num text-[var(--txt-2)]">{mdh(cat["Coût agents (MDH) · v1.0 (estimation primaire)"] as number)}</span> MDH,
                {" "}ROI <span className="num text-[var(--txt-2)]">{ratio(cat["ROI · v1.0 (estimation primaire)"] as number)}</span>. Remplacée par le dimensionnement cas par cas.
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
