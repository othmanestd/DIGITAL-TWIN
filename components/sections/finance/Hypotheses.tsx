"use client";
// Finance · Hypothèses et méthode: how the business case is computed, every hypothesis of workbook 04, the scenarios
// (only Central is computed; the PDF 05 table is quoted as printed), the group trajectory, adoption, conversion,
// cross-cutting costs, platforms, value bases, jobs, definitions and the v1.0 → v2.3 bridge.
import { FIN, FINROW, fr } from "@/lib/model";
import { FAM_COLOR } from "@/lib/ui/fmt";
import { Panel, Derived, Source, Th, Chip } from "./ui";
import { Y5, COSTED, FAM_LABEL, mdh, etp, exact, pctExact, total, v } from "./data";
import { SCENARIOS_PDF, BRIDGE_FAMILIES_PDF, BRIDGE_NOTE, METHOD_PDF, COST_COVERS_PDF } from "./sources";

const td = "num whitespace-nowrap px-2 py-[6px] text-right text-[12.5px] text-[var(--txt)]";
const tdL = "px-2 py-[6px] text-left text-[12.5px] text-[var(--txt)]";
const PCT = /^(Hausse|Marge|Coût d'opportunité|Taux|Contingence)/;
const Y6 = ["2026", ...Y5] as const;

function hypValue(label: string, value: string | number | null) {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  if (PCT.test(label)) return pctExact(value);
  return exact(value);
}

export function Hypotheses() {
  const traj = Object.entries(FIN.trajectory).filter(([k]) => k !== "years") as [string, { values: Record<string, number>; note: string | null }][];
  const trajFmt = (k: string, x: number) => (k.startsWith("Indice") ? fr(x, 3) : k.includes("(MDH)") ? fr(x, 1) : exact(x));
  // v2.3 side of the family bridge: sums of the « plein régime 2026 » columns of 04 · Cas
  const fam26 = (code: string) => {
    const rows = COSTED.filter((r) => r.fam === code);
    const a = (k: string) => rows.reduce((s, r) => s + (Number(r.rec?.assumptions?.[k]) || 0), 0);
    return { etp: a("ETP libérés · plein régime 2026"), ms: a("Économie MS · plein régime 2026") };
  };
  const centralCheck = [mdh(v("eco")), mdh(v("marge")), mdh(v("gains")), mdh(-v("cout")), mdh(v("net")), mdh(FINROW.net.cumul)];
  const metiers = FIN.metiers;
  const half = Math.ceil(metiers.length / 2);
  const MetierTable = ({ rows }: { rows: typeof metiers }) => (
    <table className="w-full border-collapse">
      <thead><tr className="border-b border-white/[0.09]"><Th align="left">Fam.</Th><Th align="left">Métier</Th><Th tip="Effectif 2026 (hypothèse de répartition).">ETP</Th><Th tip="Coût chargé annuel par ETP, en kMAD (milliers de dirhams).">kMAD/an</Th><Th tip="Part du temps du métier adressée par les cas.">Part adressée</Th></tr></thead>
      <tbody>{rows.map((m) => (
        <tr key={m.key} className="border-b border-white/[0.04]">
          <td className="px-2 py-[5px]"><span className="num inline-flex items-center gap-1.5 text-[12px] text-[var(--txt-2)]"><span className="h-1.5 w-1.5 rounded-full" style={{ background: FAM_COLOR[m.fam] }} />{m.fam}</span></td>
          <td className={`${tdL} !py-[5px]`}>{m.label}</td>
          <td className={`${td} !py-[5px]`}>{m.etp !== null ? exact(m.etp) : "—"}</td>
          <td className={`${td} !py-[5px]`}>{m.cout_kmad !== null ? exact(m.cout_kmad) : "—"}</td>
          <td className={`${td} !py-[5px]`}>{m.part !== null ? pctExact(m.part) : "—"}</td>
        </tr>
      ))}</tbody>
    </table>
  );
  return (
    <div className="flex flex-col gap-[clamp(10px,0.8vw,16px)] pb-4">
      <p className="text-[clamp(13.5px,0.95vw,16px)] leading-snug text-[var(--txt-2)]">
        <b className="text-white">Un calcul bas en haut, cas par cas</b> : métier concerné, part de son temps sur la tâche, réduction mesurée ailleurs, volumes et coûts unitaires des agents. Toutes les hypothèses ci-dessous sont des cellules modifiables du classeur 04.
      </p>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <Panel title="Comment le business case est calculé" sub={METHOD_PDF?.ref ?? "classeur 04, Lisez-moi"}>
          <div className="flex flex-col gap-2">
            {(METHOD_PDF?.blocks ?? []).map((b, i) => (
              <div key={b.title} className="rounded-[12px] bg-white/[0.035] px-3.5 py-2.5 ring-1 ring-white/[0.06]">
                <div className="text-[12.5px] font-semibold text-white"><span className="num mr-1.5 text-[var(--mut)]">{["①", "② ", "③"][i]}</span>{b.title}</div>
                <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--txt-2)]">{b.text}</p>
              </div>
            ))}
            <div className="rounded-[12px] bg-white/[0.035] px-3.5 py-2.5 ring-1 ring-white/[0.06]">
              <div className="text-[12.5px] font-semibold text-white">Valeur nette, cumul et VAN</div>
              <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--txt-2)]">Valeur nette = ① économies + ② marge sur CA additionnel − ③ coût du programme. Cumul = somme 2027 à 2031. VAN (valeur actuelle nette) = flux 2027 à 2031 actualisés au taux de <span className="num">{pctExact(Number(FIN.hypotheses.find((h) => h.label.startsWith("Taux d'actualisation"))?.value ?? 0))}</span>, 2027 compté à un an.</p>
            </div>
          </div>
          {METHOD_PDF?.notCounted && (
            <div className="mt-3 rounded-[12px] px-3.5 py-2.5" style={{ background: "linear-gradient(140deg, rgba(226,176,90,.12), rgba(226,176,90,.03))", boxShadow: "inset 0 0 0 1px rgba(226,176,90,.22)" }}>
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#E9C27F]">Ce qui n&apos;est pas compté, par prudence <span className="normal-case tracking-normal text-[var(--mut)]">· {METHOD_PDF.ref}</span></div>
              <p className="mt-1 text-[12.5px] leading-snug text-[var(--txt)]">{METHOD_PDF.notCounted}</p>
            </div>
          )}
          {COST_COVERS_PDF && <Source>Ce que couvre le coût du programme ({COST_COVERS_PDF.ref}) : {COST_COVERS_PDF.text}</Source>}
        </Panel>

        <Panel title="Hypothèses générales" sub="classeur 04, onglet Hypothèses">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-white/[0.09]"><Th align="left">Hypothèse</Th><Th>Valeur</Th><Th align="left">Source ou justification</Th></tr></thead>
            <tbody>{FIN.hypotheses.map((h) => (
              <tr key={h.label} className="border-b border-white/[0.04] align-top">
                <td className={tdL}>{h.label}</td>
                <td className={`${td} font-semibold text-white`}>{hypValue(h.label, h.value)}</td>
                <td className="px-2 py-[6px] text-[11.5px] leading-snug text-[var(--mut)]">{h.note ?? ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </Panel>
      </div>

      <Panel title="Trois scénarios" sub="seul le scénario central est calculé dans le classeur"
        right={<div className="flex items-center gap-1.5">{Object.entries(FIN.scenarios).map(([k, m]) => <Chip key={k}>{k} × {fr(m, 1)}</Chip>)}</div>}>
        <p className="text-[12.5px] leading-snug text-[var(--txt-2)]">{FIN.readme_04.find((r) => r.k === "Scénarios")?.v} <b className="text-white">Tout ce que montre cette vue est calculé en scénario central.</b> Les résultats Prudent et Ambitieux ne sont pas dans le classeur : {SCENARIOS_PDF ? <>ils sont repris tels qu&apos;imprimés ({SCENARIOS_PDF.ref}), arrondis au MDH ; aucune série annuelle n&apos;en est publiée.</> : <>ils ne sont publiés nulle part.</>}</p>
        {SCENARIOS_PDF && <><table className="mt-3 w-full border-collapse">
          <thead><tr className="border-b border-white/[0.09]"><Th align="left">Scénario · 2031</Th>{SCENARIOS_PDF.columns.map((c) => <Th key={c}>{c}</Th>)}</tr></thead>
          <tbody>{SCENARIOS_PDF.rows.map((r) => (
            <tr key={r.name} className={`border-b border-white/[0.04] ${r.name === "Central" ? "bg-white/[0.05]" : ""}`}>
              <td className={tdL}><span className="font-semibold text-white">{r.name}</span> <span className="num text-[var(--mut)]">({r.mult})</span>{r.name === "Central" && <span className="ml-2"><Chip className="!text-[10.5px]">retenu</Chip></span>}</td>
              {r.values.map((x, i) => <td key={i} className={`${td} ${i === 4 ? "font-bold text-white" : ""}`}>{x}</td>)}
            </tr>
          ))}</tbody>
        </table>
        <Source>{SCENARIOS_PDF.legend}. {SCENARIOS_PDF.foot} Contrôle : la ligne Central recoupe la Synthèse du classeur ({centralCheck.join(" · ")} MDH, « rentable en » {Y5.find((y) => (FINROW.net_cumul.values[y] ?? 0) > 0)}).</Source></>}
      </Panel>

      <div className="grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <Panel title="Le pont avec la v1.0" sub="plein régime à périmètre 2026, comparable aux 302 et 160 MDH">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-white/[0.09]"><Th align="left" /><Th>v1.0 · descendant</Th><Th>v2.3 · bas en haut</Th><Th>Écart</Th></tr></thead>
            <tbody>{FIN.bridge_v10.map((b) => {
              const isEtp = b.label.startsWith("ETP");
              const f = (x: number | null) => (x === null ? "—" : isEtp ? etp(x) : x === 0 ? "non compté" : mdh(x));
              return (
                <tr key={b.label} className="border-b border-white/[0.04]">
                  <td className={tdL}>{b.label}</td><td className={td}>{f(b.v10)}</td><td className={`${td} font-semibold text-white`}>{isEtp ? etp(b.v2) : mdh(b.v2)}</td>
                  <td className={td}>{b.ecart === null ? "—" : (b.ecart > 0 ? "+" : "") + (isEtp ? etp(b.ecart) : mdh(b.ecart))}</td>
                </tr>
              );
            })}</tbody>
          </table>
          {BRIDGE_FAMILIES_PDF ? <>
            <div className="mt-4 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#AFC0FF]">Masse salariale, famille par famille, à périmètre 2026</div>
            <table className="mt-1 w-full border-collapse">
              <thead><tr className="border-b border-white/[0.09]"><Th align="left">Famille</Th><Th>ETP-éq. v1.0</Th><Th>ETP-éq. v2.0</Th><Th>MDH v1.0</Th><Th>MDH v2.0</Th></tr></thead>
              <tbody>{BRIDGE_FAMILIES_PDF.rows.map((r) => (
                <tr key={r.label} className="border-b border-white/[0.04] align-top">
                  <td className="px-2 py-[6px]"><div className="flex items-center gap-1.5 text-[12.5px] font-medium text-white"><span className="h-1.5 w-1.5 rounded-full" style={{ background: FAM_COLOR[r.fam] }} />{r.label}</div><div className="mt-0.5 text-[11px] leading-snug text-[var(--mut)]">{r.why}</div></td>
                  <td className={td}>{r.etpV1}</td><td className={`${td} font-semibold text-white`}>{r.etpV2}</td><td className={td}>{r.mdhV1}</td><td className={`${td} font-semibold text-white`}>{r.mdhV2}</td>
                </tr>
              ))}</tbody>
            </table>
            <Source>Tableau tel qu&apos;imprimé ({BRIDGE_FAMILIES_PDF.ref}) ; le PDF nomme « v2.0 » le calcul bas en haut, inchangé en v2.3. Contrôle <Derived label="recalcul" how={<>Somme des colonnes « plein régime 2026 » des cas de chaque famille (04 · Cas) : {BRIDGE_FAMILIES_PDF.rows.map((r) => { const s = fam26(r.fam); return `${r.fam} ${etp(s.etp, 1)} ETP-éq. et ${mdh(s.ms)} MDH`; }).join(" ; ")}.</>} />. {FIN.meta.notes[4]} {BRIDGE_FAMILIES_PDF.cost}{BRIDGE_NOTE && <> Écarts relevés : {BRIDGE_NOTE}.</>}</Source>
          </> : <Source>{FIN.meta.notes[4]}</Source>}
        </Panel>

        <div className="flex min-w-0 flex-col gap-[clamp(10px,0.8vw,16px)]">
          {BRIDGE_FAMILIES_PDF && (
            <Panel title="Ce qui baisse, ce qui s'ajoute" sub={BRIDGE_FAMILIES_PDF.ref}>
              <p className="text-[12.5px] leading-snug text-[var(--txt-2)]">{BRIDGE_FAMILIES_PDF.intro}</p>
              <p className="mt-2 text-[12.5px] leading-snug text-[var(--txt-2)]"><b className="text-white">Ce qui baisse.</b> {BRIDGE_FAMILIES_PDF.baisse}</p>
              <p className="mt-2 text-[12.5px] leading-snug text-[var(--txt-2)]"><b className="text-white">Ce qui s&apos;ajoute.</b> {BRIDGE_FAMILIES_PDF.ajoute}</p>
            </Panel>
          )}
          <Panel title="Conversion des heures libérées en économie réelle" sub="par famille">
            <table className="w-full border-collapse">
              <tbody>{FIN.conversion.map((c) => (
                <tr key={c.fam} className="border-b border-white/[0.04] align-top last:border-0">
                  <td className="px-2 py-[6px]"><span className="flex items-center gap-1.5 text-[12.5px] text-white"><span className="h-1.5 w-1.5 rounded-full" style={{ background: FAM_COLOR[c.fam] }} />{c.fam} · {FAM_LABEL[c.fam] ?? c.fam}</span></td>
                  <td className={`${td} font-semibold text-white`}>{c.rate !== null ? pctExact(c.rate) : "—"}</td>
                  <td className="px-2 py-[6px] text-[11.5px] leading-snug text-[var(--mut)]">{c.note}</td>
                </tr>
              ))}</tbody>
            </table>
          </Panel>
        </div>
      </div>

      <Panel title="Trajectoire du groupe sans le programme" sub="2026 → 2031 · montants courants">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead><tr className="border-b border-white/[0.09]"><Th align="left" />{Y6.map((y) => <Th key={y}>{y}</Th>)}<Th align="left">Note</Th></tr></thead>
            <tbody>{traj.map(([k, t]) => (
              <tr key={k} className="border-b border-white/[0.04]">
                <td className={tdL}>{k}</td>
                {Y6.map((y) => <td key={y} className={td}>{t.values[y] !== undefined ? trajFmt(k, t.values[y]) : "—"}</td>)}
                <td className="px-2 py-[6px] text-[11.5px] text-[var(--mut)]">{t.note ?? ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-[clamp(10px,0.8vw,16px)]">
        <Panel title="Adoption par vague" sub="part du plein effet atteinte dans l'année">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-white/[0.09]"><Th align="left">Vague</Th><Th tip="Année de construction des cas de la vague.">Début</Th>{Y5.map((y) => <Th key={y}>{y}</Th>)}</tr></thead>
            <tbody>{FIN.adoption.map((a) => (
              <tr key={a.vague} className="border-b border-white/[0.04]">
                <td className={`${tdL} font-semibold text-white`}>{a.vague}</td><td className={td}>{a.debut}</td>
                {Y5.map((y) => <td key={y} className={td}><span className="inline-flex items-center justify-end gap-1.5"><span className="h-1 rounded-full bg-[#9FB3FF]" style={{ width: `${(a.values[y] ?? 0) * 26}px`, opacity: 0.7 }} />{pctExact(a.values[y] ?? 0)}</span></td>)}
              </tr>
            ))}</tbody>
          </table>
          <Source>{FIN.adoption.map((a) => a.note).filter(Boolean).join(" ")}</Source>
        </Panel>
        <Panel title="Coûts transverses" sub="MDH par an, rattachés à aucun cas">
          <table className="w-full border-collapse">
            <thead><tr className="border-b border-white/[0.09]"><Th align="left">Poste</Th>{Y5.map((y) => <Th key={y}>{y}</Th>)}<Th tip="Somme 2027-2031.">Cumul</Th></tr></thead>
            <tbody>{FIN.transverse_costs.map((c) => (
              <tr key={c.label} className={`border-b border-white/[0.04] ${c.total ? "bg-white/[0.04]" : ""}`}>
                <td className={`${tdL} ${c.total ? "font-semibold text-white" : ""}`}>{c.label}</td>
                {Y5.map((y) => <td key={y} className={`${td} ${c.total ? "font-semibold text-white" : ""}`}>{mdh(c.values[y])}</td>)}
                <td className={`${td} ${c.total ? "font-semibold text-white" : ""}`}>{mdh(total(c.values))}</td>
              </tr>
            ))}</tbody>
          </table>
          <Source>Plus la contingence : <span className="num">{pctExact(Number(FIN.hypotheses.find((h) => h.label.startsWith("Contingence"))?.value ?? 0))}</span> des coûts (<span className="num">{mdh(FINROW.contingence.cumul)}</span> MDH sur 2027-2031). Cumul des coûts transverses : Synthèse <span className="num">{mdh(FINROW.cout_transverse.cumul)}</span> MDH.</Source>
        </Panel>
      </div>

      <Panel title="Plateformes partagées" sub="licence par établissement, payée une fois par brique dès qu'un de ses cas est déployé">
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-white/[0.09]"><Th align="left">Brique</Th><Th tip="Licence annuelle par établissement, en kMAD (milliers de dirhams).">kMAD/site/an</Th>{Y5.map((y) => <Th key={y}>{y} · MDH</Th>)}<Th tip="Somme 2027-2031.">Cumul</Th></tr></thead>
          <tbody>{FIN.platforms.map((p) => (
            <tr key={p.label} className={`border-b border-white/[0.04] ${p.total ? "bg-white/[0.04]" : ""}`}>
              <td className={`${tdL} ${p.total ? "font-semibold text-white" : ""}`}>{p.code && <span className="num mr-1.5 text-[var(--mut)]">{p.code}</span>}{p.label}</td>
              <td className={td}>{p.kmad_site !== null ? exact(p.kmad_site) : ""}</td>
              {Y5.map((y) => <td key={y} className={`${td} ${p.total ? "font-semibold text-white" : ""}`}>{mdh(p.values[y])}</td>)}
              <td className={`${td} ${p.total ? "font-semibold text-white" : ""}`}>{mdh(total(p.values))}</td>
            </tr>
          ))}</tbody>
        </table>
        <Source>{FIN.platforms_note}. Ces montants sont déjà compris dans le coût des cas (quote-part des plateformes).</Source>
      </Panel>

      <Panel title="Assiettes de valeur" sub="bases sur lesquelles s'appliquent les effets des cas, MDH">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead><tr className="border-b border-white/[0.09]"><Th align="left">Assiette</Th><Th>Part</Th><Th align="left">De</Th>{Y6.map((y) => <Th key={y}>{y}</Th>)}</tr></thead>
            <tbody>{FIN.assiettes.map((a) => (
              <tr key={a.key} className="border-b border-white/[0.04]">
                <td className={tdL}><span className="num mr-1.5 text-[11px] text-[var(--mut)]">{a.key}</span>{a.label}</td>
                <td className={td}>{a.part !== null ? pctExact(a.part) : "—"}</td>
                <td className="px-2 py-[6px] text-[11.5px] text-[var(--mut)]">{a.type === "CA" ? "CA" : a.type === "MS" ? "masse salariale" : "calculée"}</td>
                {Y6.map((y) => <td key={y} className={td}>{a.values[y] !== undefined ? (a.type === "SITES" ? exact(a.values[y]) : fr(a.values[y], a.values[y] < 10 ? 2 : 1)) : "—"}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
        <Source>Structure du CA et des coûts : hypothèses de cadrage à mesurer au point zéro (extraction Humaneo, Sage, Oryon). « Nombre d&apos;établissements » est un nombre, pas un montant.</Source>
      </Panel>

      <Panel title="Métiers : effectifs et coûts 2026" sub="hypothèse de répartition, classeur 04 · Métiers">
        <div className="grid grid-cols-2 gap-6"><MetierTable rows={metiers.slice(0, half)} /><MetierTable rows={metiers.slice(half)} /></div>
        <Source>ETP = équivalent temps plein · kMAD = milliers de dirhams. Totaux par famille conformes au reporting RH cité par Mibtech ; répartition par métier et coûts à extraire de Humaneo au point zéro.</Source>
      </Panel>

      <Panel title="Lisez-moi du classeur" sub="définitions et règles de lecture, 04">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          {FIN.readme_04.filter((r) => r.k && r.k !== "Contact").map((r) => (
            <div key={r.k} className="min-w-0">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#AFC0FF]">{r.k}</dt>
              <dd className="mt-0.5 text-[12.5px] leading-snug text-[var(--txt-2)]">{r.v}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  );
}
