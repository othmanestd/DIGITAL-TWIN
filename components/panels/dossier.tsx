"use client";
// The use-case dossier: a sticky header and section navigation on top, a scrollable page below.
// Ten sections (only those that have data), each opening with one plain sentence; sources attached to the case;
// previous / next case and related cases at the end. Scroll position is remembered per case for the session.
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useIsPresent } from "motion/react";
import { useApp } from "@/lib/store";
import { agg, fr, verdict, peopleOutOf10, CASE, DATA, FIN, META, YEARS, FINAL_YEAR, V23, benchFor, type UseCase } from "@/lib/model";
import { DEPT, CASE_DEPT } from "@/lib/hospital";
import { GLOSSARY, explain } from "@/lib/glossary";
import { I } from "@/components/ui/icons";
import { MarketTile, Tip, Dot } from "@/components/ui/kit";
import { FAM_COLOR, famName, floorShort, money, aggSeries, in302, headline, yearPhrase, LEVEL_COLOR, LEVEL_LABEL, levelCode } from "@/lib/ui/fmt";
import s from "@/components/ui/styles";
import { PeopleBlock, ProofBlock, Steps, ChainLegend, isAgentStep } from "./parts";
import { SourceRow } from "./SourceRow";
import { annotateAll, clean, councilRole, dataClass, memory, neighbours, relatedCases, sourcesIntent, sourcesOfCase, waveOf, type Block, type Src } from "./dossier-data";
import { V23Body, FinanceLink, makeV23Blocks } from "./dossier-v23";
import { CaseChip, CaseLink, Callout, Sub, Body, Pill, TONES, FOCUS, G, Rich } from "./dz-ui";

/* ================================================================ sections */
type SecId = "verdict" | "v23" | "aujourdhui" | "agents" | "valeur" | "leviers" | "solutions" | "preuves" | "gouvernance" | "deploiement" | "sources";
const SEC: Record<SecId, { chip: string; title: string; intro: string }> = {
  verdict: { chip: "Verdict", title: "Verdict", intro: "Le résultat en une phrase, puis la preuve la plus solide trouvée ailleurs." },
  v23: { chip: "Chiffres v2.3", title: "Chiffres actualisés v2.3", intro: `Le chiffrage case par case du business case actualisé : ce que le cas rapporte, ce qu'il coûte, année par année jusqu'en ${FINAL_YEAR}.` },
  aujourdhui: { chip: "Aujourd'hui", title: "Aujourd'hui", intro: "Comment ce travail se fait aujourd'hui, étape par étape, sans agent." },
  agents: { chip: "Avec les agents", title: "Avec les agents", intro: "Ce que font les agents, et ce que l'humain garde en main." },
  valeur: { chip: "Valeur", title: "Valeur", intro: "Ce que ce cas économise chaque année, ce que coûtent les agents, et ce qu'il reste." },
  leviers: { chip: "Leviers", title: "Leviers", intro: V23 ? "Les autres leviers de valeur recensés pour ce cas, avec leurs ordres de grandeur d'origine." : "Les autres valeurs que ce cas peut créer, en dehors de la masse salariale." },
  solutions: { chip: "Solutions", title: "Solutions", intro: "Les produits et les systèmes qui font tourner ce cas." },
  preuves: { chip: "Preuves marché", title: "Preuves marché", intro: "Ce qui a déjà été publié ailleurs : qui, où, quel résultat. Les résultats mesurés passent en premier." },
  gouvernance: { chip: "Gouvernance", title: "Gouvernance et risques", intro: "Quelles données sont touchées, qui valide, et ce qui peut mal tourner." },
  deploiement: { chip: "Déploiement", title: "Déploiement", intro: "Quand ce cas arrive, ce qu'il faut avoir prêt, et comment on le mesure." },
  sources: { chip: "Sources", title: "Sources", intro: "D'où vient chaque preuve. Ouvrez la source, ou allez voir les autres cas qui la citent." },
};

type Plan = { ids: SecId[]; inside: boolean; v23: boolean; levers: NonNullable<UseCase["value_levers"]>; srcs: ReturnType<typeof sourcesOfCase>; measured: Src[] };
type Lever = { type: string; ordre_de_grandeur?: string; unite?: string | null; origine_v09?: string };

function makePlan(c: UseCase): Plan {
  const v23 = V23 && !!c.v23;
  const inside = !v23 && in302(c) && c.mdh > 0;
  const levers = (c.value_levers ?? []) as NonNullable<UseCase["value_levers"]>;
  const srcs = sourcesOfCase(c.id);
  const measured = srcs.own.filter((x) => x.measured);
  const ids: SecId[] = ["verdict"];
  if (v23) ids.push("v23");
  if (clean(c.aujourdhui) || c.avant?.length) ids.push("aujourdhui");
  if (clean(c.solution) || c.apres?.length) ids.push("agents");
  if (inside) ids.push("valeur");
  if (levers.length || clean(c.levier_hors_ms)) ids.push("leviers");
  if ((c.solutions?.length ?? 0) || clean(c.brique) || c.systemes?.length) ids.push("solutions");
  if (srcs.own.length) ids.push("preuves");
  if (clean(c.sensibilite) || clean(c.validation_humaine) || clean(c.garde_fous) || clean(c.risque_principal)) ids.push("gouvernance");
  if (clean(c.vague) || clean(c.maturite) || clean(c.prerequis) || clean(c.mesure_point_zero) || c.kpi?.length || c.depend_de?.length || c.alimente?.length) ids.push("deploiement");
  if (srcs.own.length || srcs.linked.length) ids.push("sources");
  return { ids, inside, v23, levers, srcs, measured };
}

const unitPhrase = (u?: string | null) => (u ? u.replace("/an", " par an") : "");
const leverText = (v: Lever) => `${v.ordre_de_grandeur ?? ""}${v.unite ? ` ${unitPhrase(v.unite)}` : ""}`.trim();

/** Every sentence of the page that may hold an abbreviation, in reading order: the first one gets its explanation in parentheses. */
function makeBlocks(c: UseCase, p: Plan): Block[] {
  const b: Block[] = [];
  const push = (key: string, text?: string | null, seen?: string[]) => { if (text || seen) b.push({ key, text: text ?? "", seen }); };
  push("verdict", verdict(c));
  if (!p.inside && !p.v23) push("out", `indicatif, non additif aux ${fr(META.eco, 0)} MDH de masse salariale`);
  if (p.v23) b.push(...makeV23Blocks(c));
  push("aujourdhui", clean(c.aujourdhui));
  c.avant?.forEach((x, i) => push(`avant.${i}`, x.texte));
  push("solution", clean(c.solution));
  c.apres?.forEach((x, i) => push(`apres.${i}`, x.texte));
  if (p.inside) push("_valeur", "", ["MDH", "kMAD", "ETP-éq.", "ETP", "ROI"]);
  if (p.ids.includes("leviers")) push("leverNote", p.v23 ? "Ordres de grandeur du modèle v0.9, en MDH par an, à titre indicatif. Le chiffrage retenu est celui des chiffres actualisés v2.3, plus haut." : `Ordres de grandeur en MDH par an, indicatifs et non additifs aux ${fr(META.eco, 0)} MDH de masse salariale.`);
  c.systemes?.forEach((x, i) => push(`sys.${i}`, x));
  push("elsewhere", clean(c.elsewhere));
  push("validation", clean(c.validation_humaine));
  push("garde", clean(c.garde_fous));
  push("risque", clean(c.risque_principal));
  push("prerequis", clean(c.prerequis));
  push("point0", clean(c.mesure_point_zero));
  c.kpi?.forEach((x, i) => push(`kpi.${i}`, x));
  return b;
}

/* ================================================================ small building blocks */
function Section({ id, title, intro, right, children, reg }: { id: SecId; title: string; intro: string; right?: ReactNode; children: ReactNode; reg: (id: SecId, el: HTMLElement | null) => void }) {
  const uid = useId();
  return (
    <section ref={(el) => reg(id, el)} data-sec={id} data-anchor={`dossier:${id}`} aria-labelledby={uid}>
      <div className="flex items-center gap-3">
        <h3 id={uid} className="text-[16px] font-semibold tracking-[-0.018em] text-white">{title}</h3>
        <span className="h-px flex-1 bg-white/[0.08]" />
        {right}
      </div>
      <p className="mt-1.5 max-w-[64ch] text-[12.5px] leading-snug text-[var(--mut)]">{intro}</p>
      <div className="mt-3.5 flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/* ================================================================ context */
type Ctx = { c: UseCase; tx: Record<string, string>; plan: Plan; open: Set<string>; toggle: (id: string) => void; reveal: (id: string) => void; fam: string };
const DCtx = createContext<Ctx | null>(null);
const useD = () => useContext(DCtx)!;

/* ================================================================ section bodies */
function VerdictBody() {
  const { c, tx, plan, fam } = useD();
  const lever = c.fam === "T" || (!c.value_out && !c.mdh);
  const p = peopleOutOf10(c);
  // v23: the tone follows the case's own net value; merged cases and levers stay neutral/blue
  const tone = plan.v23 ? (c.merged_into ? TONES.blue : c.fam === "T" ? TONES.neutral : c.net > 0 ? TONES.green : TONES.amber) : TONES.green;
  return (
    <>
      {plan.inside || plan.v23 ? (
        <div className="rounded-[16px] px-4 py-3.5" style={{ background: tone.bg, boxShadow: `inset 3px 0 0 ${tone.bar}` }}>
          <div className="eyebrow !text-[9.5px] mb-1" style={{ color: tone.fg }}>Ce qu&apos;il faut retenir</div>
          <p className="text-[clamp(15px,1.05vw,18px)] font-semibold leading-snug text-white"><Rich t={tx.verdict ?? verdict(c)} /></p>
        </div>
      ) : (
        <div className="rounded-[16px] px-4 py-3.5" style={{ background: TONES.blue.bg, boxShadow: "inset 3px 0 0 #9FB3FF" }} data-anchor="value-out">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="eyebrow !text-[9.5px] !text-[#AFC0FF]">{lever ? "Verdict · levier de réalisation" : "Verdict · valeur hors masse salariale"}</span>
            {!lever && <span className="rounded-full bg-white/[0.07] px-2 py-[2px] text-[10.5px] text-[var(--txt-2)]"><Rich t={tx.out} /></span>}
          </div>
          <p className="mt-1 text-[clamp(15px,1.05vw,18px)] font-semibold leading-snug text-white">
            {lever ? "Sans gain propre : il transforme le temps libéré en économie réelle (décisions de poste, mobilités, mesure)." : c.value_out ?? "Valeur d'un autre type que la masse salariale."}
          </p>
        </div>
      )}
      {(plan.inside ? c.etp > 0 : plan.v23 && !c.merged_into && p >= 0.05) && (
        <PeopleBlock full value={p} color={FAM_COLOR[fam]} title={`famille ${famName(fam).toLowerCase()}`}
          text={<>{V23 ? `En ${FINAL_YEAR}` : "Au plein régime"}, ce cas {V23 ? "libère" : "reprend"} le temps de {fr(p, 1)} personne{p >= 2 ? "s" : ""} sur 10 de la famille {famName(fam).toLowerCase()} ({c.metier_libere}). Sans licenciement : départs non remplacés et mobilités.</>} />
      )}
      <ProofBlock c={c} />
    </>
  );
}

function AujourdhuiBody() {
  const { c, tx } = useD();
  return (
    <>
      {clean(c.aujourdhui) && <Body><Rich t={tx.aujourdhui} /></Body>}
      {c.avant?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Sub right={<ChainLegend />}>Étapes aujourd&apos;hui · {c.avant.length}</Sub>
          <Steps steps={c.avant} after={false} texts={c.avant.map((_, i) => <Rich key={i} t={tx[`avant.${i}`]} />)} />
        </div>
      )}
      {(clean(c.metier_libere) || c.perimetres?.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {clean(c.metier_libere) && <><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Métier concerné</span><Pill>{c.metier_libere}</Pill></>}
          {c.perimetres?.length > 0 && <><span className="ml-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Périmètre</span>{c.perimetres.map((x) => <Pill key={x}>{x}</Pill>)}</>}
        </div>
      )}
    </>
  );
}

const MODES = ["A1", "A2", "A3"] as const;
function AgentsBody() {
  const { c, tx } = useD();
  const mode = c.mode.split(" ")[0];
  const g = GLOSSARY[mode];
  const n = c.apres?.length ?? 0;
  const nAgent = c.apres?.filter((x) => isAgentStep(x.acteur)).length ?? 0;
  const nSys = c.apres?.filter((x) => x.acteur === "systeme").length ?? 0;
  const nHum = c.apres?.filter((x) => x.acteur === "humain").length ?? 0;
  const parts = [nAgent && `${nAgent} par un agent`, nSys && `${nSys} par le système`, nHum && `${nHum} par l'humain`].filter(Boolean).join(", ");
  return (
    <>
      {clean(c.solution) && <Body><Rich t={tx.solution} /></Body>}
      {n > 0 && (
        <div className="flex flex-col gap-2">
          <Sub right={<ChainLegend />}>Étapes avec les agents · {n}</Sub>
          <Steps steps={c.apres} after texts={c.apres.map((_, i) => <Rich key={i} t={tx[`apres.${i}`]} />)} />
          {parts && <p className="text-[12.5px] leading-snug text-[var(--mut)]">Sur {n} étapes : {parts}.</p>}
        </div>
      )}
      {g && (
        <div className="flex flex-col gap-2" data-anchor="dossier:mode">
          <Sub>Mode d&apos;intervention</Sub>
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Les trois modes d'intervention de l'agent">
            {MODES.map((m) => {
              const on = m === mode, gm = GLOSSARY[m];
              return (
                <div key={m} aria-current={on ? "true" : undefined} className="rounded-[12px] px-3 py-2 transition-colors"
                  style={{ background: on ? "linear-gradient(160deg, rgba(91,124,255,.22), rgba(91,124,255,.08))" : "rgba(255,255,255,.03)", boxShadow: on ? "inset 0 0 0 1px rgba(91,124,255,.45)" : "inset 0 0 0 1px rgba(255,255,255,.06)", opacity: on ? 1 : 0.6 }}>
                  <div className="num text-[15px]" style={{ color: on ? "#C9D4FF" : "var(--txt-2)" }}>{m}</div>
                  <div className={`text-[12px] font-semibold ${on ? "text-white" : "text-[var(--txt-2)]"}`}>{gm.term.split(" · ")[1]}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-[var(--mut)]">{gm.short}</div>
                </div>
              );
            })}
          </div>
          <p className="text-[13px] leading-snug text-[var(--txt-2)]"><b className="font-semibold text-white">{explain(mode)}</b> : {g.long}</p>
        </div>
      )}
    </>
  );
}

function ValeurBody() {
  const { c } = useD();
  const setSection = useApp((st) => st.setSection);
  const year = useApp((st) => st.year);
  const perSite = useApp((st) => st.perSite);
  const a = agg([c.id], year, perSite);
  const i = YEARS.indexOf(year);
  const m = money(a.mdh), mc = money(a.cout), mn = money(a.net);
  const sc = (arr: number[], u: string) => (u === "kMAD" ? arr.map((x) => x * 1000) : arr);
  const ser = (k: "mdh" | "etp" | "cout" | "net" | "roi") => aggSeries([c.id], k, perSite);
  const ut = (u: string) => explain(u);
  const note = perSite && (c.id[0] === "S" || c.id[0] === "T") ? "Le siège n'est pas réparti par établissement : basculez sur « Groupe » pour voir ses chiffres."
    : year !== FINAL_YEAR ? `Valeurs ${year === 2026 ? "d'aujourd'hui" : "de " + year} ; le verdict est donné ${yearPhrase(FINAL_YEAR)}.` : null;
  return (
    <>
      <div className="grid grid-cols-3 gap-2" role="group" aria-label="Chiffres du cas">
        <MarketTile size="md" label="Économie" value={m.v} d={m.d} unit={m.unit} series={sc(ser("mdh"), m.unit)} active={i} color="var(--green)" explain={<>{ut(m.unit)} par an</>} />
        <MarketTile size="md" label="Coût des agents" value={mc.v} d={mc.d} unit={mc.unit} series={sc(ser("cout"), mc.unit)} active={i} color="#B9C1D6" tone="neutral" explain={<>{mc.unit} par an : {GLOSSARY["Coût des agents"].short}</>} />
        <MarketTile size="md" label="Gain net" value={mn.v} d={mn.d} unit={mn.unit} series={sc(ser("net"), mn.unit)} active={i} color="#E6EAF5" explain={<>{mn.unit} par an : {GLOSSARY.Net.short}</>} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MarketTile size="md" label="ETP-éq. libérés" value={a.etp} d={a.etp < 10 ? 1 : 0} series={ser("etp")} active={i} color="#9FB3FF" explain={<>{GLOSSARY["ETP-éq."].short} : travail repris, en postes à plein temps</>} />
        <MarketTile size="md" label="ROI" value={a.roi} d={2} series={ser("roi")} active={i} color="var(--amber)" tone="neutral" explain={<>{GLOSSARY.ROI.short} : dirhams économisés pour 1 dirham d&apos;agents</>} />
      </div>
      {note && <p className="text-[12px] leading-snug text-[var(--mut)]">{note}</p>}
      <p className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--mut)]"><I.info size={14} className="mt-[1px] shrink-0" />Sans licenciement : le temps libéré devient une économie quand un départ n&apos;est pas remplacé, qu&apos;une mobilité pourvoit une ouverture ou qu&apos;un recrutement est évité.</p>
      <button type="button" onClick={() => { sourcesIntent.caseId = null; sourcesIntent.tab = "prog"; setSection("sources"); }} data-anchor="dossier:program-sources"
        className={`group -mt-1 flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium text-[#AFC0FF] transition-colors hover:bg-white/[0.07] hover:text-white ${FOCUS}`}>
        D&apos;où viennent ces chiffres ? Voir les sources du programme <I.arrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </>
  );
}

function LeviersBody() {
  const { c, tx, plan } = useD();
  const rows = plan.levers as Lever[];
  const scale = (o?: string) => ({ "<1": 1, "1–5": 2, "5–15": 3, ">15": 4 } as Record<string, number>)[o ?? ""] ?? 0;
  return (
    <>
      <p className="text-[13px] leading-snug text-[var(--txt-2)]"><Rich t={tx.leverNote} /></p>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((v, i) => {
            const k = scale(v.ordre_de_grandeur);
            return (
              <li key={i} className={`${s.card} grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[12px] px-3.5 py-2.5`}>
                <div className="min-w-0">
                  <div className="text-[13.5px] font-semibold text-white">{v.type}</div>
                  {v.origine_v09 && <div className="mt-0.5 text-[11px] text-[var(--mut)]">Origine : <span className="num text-[11px] font-medium">{v.origine_v09}</span> · modèle v0.9</div>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="num text-[14px] text-white">{leverText(v) || "—"}</span>
                  {k > 0 ? (
                    <Tip content={`Tranche : ${v.ordre_de_grandeur} ${unitPhrase(v.unite)}`}>
                      <span className="flex cursor-help items-center gap-[3px]" aria-hidden>{[1, 2, 3, 4].map((n) => <span key={n} className="h-[5px] w-[11px] rounded-full" style={{ background: n <= k ? "var(--green)" : "rgba(255,255,255,.1)" }} />)}</span>
                    </Tip>
                  ) : <span className="text-[10.5px] text-[var(--mut)]">sans chiffre propre</span>}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <Callout icon={<I.layers size={14} />} label={V23 ? "Leviers recensés (modèle v0.9)" : "Leviers hors masse salariale"} tone="blue">{c.levier_hors_ms}</Callout>
      )}
    </>
  );
}

function SolutionsBody() {
  const { c, tx } = useD();
  const brique = DATA.briques.find((b) => b.name === c.brique);
  return (
    <>
      {(c.solutions?.length ?? 0) > 0 && (
        <div className="flex flex-col gap-2">
          <Sub>Produits · {c.solutions!.length}</Sub>
          <div className="flex flex-wrap gap-1.5">{c.solutions!.map((x) => <Pill key={x} tone="blue">{x}</Pill>)}</div>
        </div>
      )}
      {clean(c.brique) && (
        <Callout icon={<I.layers size={14} />} label="Brique technologique" tone="neutral">
          <b className="font-semibold text-white">{c.brique}</b>
          {brique?.desc ? <span className="block text-[13px] text-[var(--txt-2)]">{brique.desc}</span> : null}
        </Callout>
      )}
      {c.systemes?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Sub>Systèmes touchés · {c.systemes.length}</Sub>
          <ul className="flex flex-col gap-1.5">
            {c.systemes.map((x, i) => (
              <li key={i} className={`${s.card} flex items-start gap-2.5 rounded-[11px] px-3 py-2 text-[13px] leading-snug text-[var(--txt)]`}><G.tool size={14} className="mt-[2px] shrink-0 text-[var(--mut)]" /><span><Rich t={tx[`sys.${i}`]} /></span></li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
        {clean(c.chef_de_file) && <><span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Chef de file</span><Pill>{c.chef_de_file}</Pill></>}
        {clean(c.porteur) && <><span className="ml-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Porteur</span><Pill>{c.porteur}</Pill></>}
        {clean(c.famille_ia_twin) && <><span className="ml-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Dans le jumeau</span><Pill>{c.famille_ia_twin}</Pill></>}
      </div>
    </>
  );
}

function PreuvesBody() {
  const { c, tx, plan, reveal } = useD();
  const measured = plan.measured;
  const others = plan.srcs.own.filter((x) => !x.measured);
  return (
    <>
      {clean(c.elsewhere) && <Body><Rich t={tx.elsewhere} /></Body>}
      {measured.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Sub>Résultats mesurés · {measured.length}</Sub>
          {measured.map((x) => {
            const h = headline(x.b.result);
            const col = LEVEL_COLOR[x.code] ?? "#8D97B0";
            const reading = clean(x.b.reading);
            return (
              <article key={x.b.id} className={`${s.card} rounded-[14px] px-3.5 py-3`} data-anchor={`proof-card:${x.b.id}`}>
                <div className="flex items-center gap-2">
                  <span className="num grid h-[20px] w-[20px] place-items-center rounded-[6px] text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${col} 18%, transparent)`, color: col }}>{x.code}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--mut)]">{LEVEL_LABEL[x.code]}{x.b.year ? ` · ${x.b.year}` : ""}</span>
                </div>
                <div className={`mt-2 grid items-start gap-3.5 ${h ? "grid-cols-[auto_minmax(0,1fr)]" : "grid-cols-1"}`}>
                  {h && <div className={`num font-[800] leading-[1.02] tracking-[-0.03em] text-white ${h.big.length <= 14 ? "whitespace-nowrap text-[clamp(22px,1.7vw,30px)]" : "max-w-[190px] text-[clamp(17px,1.25vw,21px)]"}`}>{h.big}</div>}
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-snug text-white">{x.b.who}<span className="font-normal text-[var(--mut)]"> · {x.b.country}</span></div>
                    <p className="mt-0.5 text-[12.5px] leading-snug text-[var(--txt-2)]">{x.b.result}</p>
                  </div>
                </div>
                {reading && <p className="mt-2 border-t border-white/[0.07] pt-2 text-[12px] leading-snug text-[var(--txt-2)]"><span className="font-semibold text-[#AFC0FF]">Lecture Akdital : </span>{reading}</p>}
                <button type="button" onClick={() => reveal(x.b.id)} className={`-mb-1 mt-1.5 -ml-1.5 inline-flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-[#AFC0FF] transition-colors hover:bg-white/[0.07] hover:text-white ${FOCUS}`}>
                  Voir la source <G.down size={13} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <Callout icon={<I.info size={14} />} label="Aucun résultat mesuré" tone="amber">Aucun résultat n&apos;est classé « mesuré » dans le dossier de preuves. Les références ci-dessous sont un point de départ : la preuve sera faite au pilote, avec une mesure au point zéro.</Callout>
      )}
      {others.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Sub>{measured.length ? "Autres références, sans résultat mesuré" : "Références publiées, sans résultat mesuré"} · {others.length}</Sub>
          {others.map((x) => (
            <button key={x.b.id} type="button" onClick={() => reveal(x.b.id)} className={`${s.card} group flex w-full items-start gap-2.5 rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-white/[0.07] ${FOCUS}`}>
              <span className="num mt-[1px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[6px] text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${LEVEL_COLOR[x.code] ?? "#8D97B0"} 18%, transparent)`, color: LEVEL_COLOR[x.code] ?? "#8D97B0" }}>{x.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-[var(--txt)] group-hover:text-white">{x.b.who}</span>
                <span className="block text-[12px] leading-snug text-[var(--mut)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.b.result}</span>
              </span>
              <G.down size={13} className="mt-1 shrink-0 text-[var(--mut)]" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

function GouvernanceBody() {
  const { c, tx } = useD();
  const cls = clean(c.sensibilite) ? dataClass(c.sensibilite) : null;
  const council = councilRole();
  return (
    <>
      {cls && (
        <div className={`${s.card} rounded-[16px] px-4 py-3.5`} data-anchor="dossier:data-class">
          <div className="flex items-center gap-3">
            <span className="num grid h-[40px] min-w-[40px] place-items-center rounded-[11px] px-2 text-[17px]" style={{ background: "rgba(226,176,90,.14)", color: "#E9C27F", boxShadow: "inset 0 0 0 1px rgba(226,176,90,.3)" }}>{cls.code}</span>
            <div className="min-w-0">
              <div className="eyebrow !text-[9.5px]">Classe de données</div>
              <div className="text-[14px] font-semibold text-white">{cls.short ? explain(cls.code) : `${cls.code}${cls.name ? ` · ${cls.name}` : ""}`}{cls.short && cls.name ? <span className="font-normal text-[var(--mut)]"> · {cls.name}</span> : null}</div>
            </div>
            <G.lock size={16} className="ml-auto shrink-0 text-[var(--mut)]" />
          </div>
          {(cls.long || cls.examples || cls.models || cls.access) && (
            <dl className="mt-2.5 divide-y divide-white/[0.05] border-t border-white/[0.07]">
              {cls.examples && <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 py-[7px]"><dt className="text-[10.5px] font-medium uppercase leading-[1.7] tracking-[0.08em] text-[var(--mut)]">Exemples</dt><dd className="text-[12.5px] leading-snug text-[var(--txt-2)]">{cls.examples}</dd></div>}
              {cls.models && <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 py-[7px]"><dt className="text-[10.5px] font-medium uppercase leading-[1.7] tracking-[0.08em] text-[var(--mut)]">Modèles</dt><dd className="text-[12.5px] leading-snug text-[var(--txt-2)]">{cls.models}</dd></div>}
              {cls.access && <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 py-[7px]"><dt className="text-[10.5px] font-medium uppercase leading-[1.7] tracking-[0.08em] text-[var(--mut)]">Accès</dt><dd className="text-[12.5px] leading-snug text-[var(--txt-2)]">{cls.access}</dd></div>}
            </dl>
          )}
        </div>
      )}
      {clean(c.validation_humaine) && <Callout icon={<I.check size={14} />} label="Validation humaine" tone="green" anchor="dossier:validation"><Rich t={tx.validation} /></Callout>}
      {clean(c.garde_fous) && <Callout icon={<I.shieldCheck size={14} />} label="Garde-fous" tone="blue"><Rich t={tx.garde} /></Callout>}
      {clean(c.risque_principal) && <Callout icon={<G.alert size={14} />} label="Risque principal" tone="amber"><Rich t={tx.risque} /></Callout>}
      {council && <p className="flex items-start gap-1.5 text-[12px] leading-snug text-[var(--mut)]"><I.info size={14} className="mt-[1px] shrink-0" /><span><b className="font-semibold text-[var(--txt-2)]">{council.name}</b> : {council.role.replace(/\.$/, "")}.</span></p>}
    </>
  );
}

function DeploiementBody() {
  const { c, tx } = useD();
  const wave = waveOf(c.vague);
  const gw = GLOSSARY[c.vague];
  const adoption = V23 ? c.v23?.projections?.adoption : undefined;
  const fAdopt = V23 ? FIN.adoption.find((x) => x.vague === c.vague) : undefined;
  const status = c.status_v13 === "new" ? "Cas nouveau dans la version 1.3" : c.status_v13 === "changed" ? "Cas modifié dans la version 1.3" : null;
  return (
    <>
      {clean(c.vague) && (
        <div className="flex flex-col gap-2" data-anchor="dossier:wave">
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Les quatre vagues de déploiement">
            {DATA.waves.map((w) => {
              const on = w.k === c.vague;
              return (
                <Tip key={w.k} content={<>{GLOSSARY[w.k]?.short}<br /><span className="text-[var(--mut)]">{w.when}</span></>}>
                  <div aria-current={on ? "true" : undefined} className="rounded-[12px] px-2.5 py-2 transition-colors"
                    style={{ background: on ? "linear-gradient(160deg, rgba(76,199,154,.2), rgba(76,199,154,.07))" : "rgba(255,255,255,.03)", boxShadow: on ? "inset 0 0 0 1px rgba(76,199,154,.45)" : "inset 0 0 0 1px rgba(255,255,255,.06)", opacity: on ? 1 : 0.55 }}>
                    <div className="num text-[14px]" style={{ color: on ? "#7FD9B5" : "var(--txt-2)" }}>{w.k}</div>
                    <div className="mt-0.5 truncate text-[10.5px] text-[var(--mut)]">{w.when.split(" → ")[0]}</div>
                  </div>
                </Tip>
              );
            })}
          </div>
          {wave && gw && !adoption && <p className="text-[13px] leading-snug text-[var(--txt-2)]"><b className="font-semibold text-white">{explain(c.vague)}</b> : {gw.long}</p>}
          {wave && gw && adoption && (
            <p className="text-[13px] leading-snug text-[var(--txt-2)]"><b className="font-semibold text-white">{explain(c.vague)}</b>{fAdopt ? ` : démarrage en ${fAdopt.debut}` : ""}. Adoption : {Object.entries(adoption).map(([y, x]) => `${Math.round(x * 100)} % en ${y}`).join(", ")}.{fAdopt?.note ? ` ${fAdopt.note}.` : ""}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {wave && <Pill>{wave.ids.length} cas dans la vague {c.vague}</Pill>}
            {clean(c.maturite) && <Pill>Maturité : {c.maturite}</Pill>}
            {status && <Pill tone="blue">{status}</Pill>}
          </div>
        </div>
      )}
      {clean(c.prerequis) && <Callout icon={<G.clock size={14} />} label="À avoir prêt avant le lancement" tone="amber"><Rich t={tx.prerequis} /></Callout>}
      {clean(c.mesure_point_zero) && <Callout icon={<G.target size={14} />} label="Mesure au point zéro" tone="blue"><Rich t={tx.point0} /></Callout>}
      {c.kpi?.length > 0 && (
        <div className="flex flex-col gap-2">
          <Sub>Indicateurs suivis · {c.kpi.length}</Sub>
          <ul className="flex flex-col gap-1.5">
            {c.kpi.map((x, i) => <li key={i} className={`${s.card} flex items-start gap-2.5 rounded-[11px] px-3 py-2 text-[13px] leading-snug text-[var(--txt)]`}><Dot color="var(--green)" size={6} /><span className="-mt-[1px]"><Rich t={tx[`kpi.${i}`]} /></span></li>)}
          </ul>
        </div>
      )}
      {(c.depend_de?.length > 0 || c.alimente?.length > 0) && (
        <div className="flex flex-col gap-2">
          {c.depend_de?.length > 0 && <><Sub>Ce cas dépend de · {c.depend_de.length}</Sub><div className="flex flex-col gap-1.5">{c.depend_de.map((x) => <CaseLink key={x} id={x} />)}</div></>}
          {c.alimente?.length > 0 && <><div className={c.depend_de?.length ? "mt-1" : ""}><Sub>Ce cas alimente · {c.alimente.length}</Sub></div><div className="flex flex-col gap-1.5">{c.alimente.map((x) => <CaseLink key={x} id={x} />)}</div></>}
        </div>
      )}
    </>
  );
}

function SourcesBody() {
  const { c, plan, open, toggle } = useD();
  const setSection = useApp((st) => st.setSection);
  const { own, linked, main } = plan.srcs;
  const nMeasured = own.filter((x) => x.measured).length;
  return (
    <>
      <p className="text-[13px] leading-snug text-[var(--txt-2)]">
        <b className="num font-bold text-white">{own.length}</b> source{own.length > 1 ? "s" : ""} rattachée{own.length > 1 ? "s" : ""} à ce cas
        {own.length > 0 ? <> : {nMeasured} avec un résultat mesuré{own.length - nMeasured > 0 ? `, ${own.length - nMeasured} sans` : ""}</> : null}.
        {linked.length > 0 ? ` ${linked.length} référence${linked.length > 1 ? "s" : ""} liée${linked.length > 1 ? "s" : ""} en plus.` : ""}
      </p>
      <div className="flex flex-col gap-2">
        {own.map((x) => <SourceRow key={x.b.id} src={x} current={c.id} main={main === x} open={open.has(x.b.id)} onToggle={() => toggle(x.b.id)} />)}
      </div>
      {linked.length > 0 && (
        <div className="flex flex-col gap-2">
          <Sub>Références liées · {linked.length}</Sub>
          {linked.map((x) => <SourceRow key={x.b.id} src={x} current={c.id} linked open={open.has(x.b.id)} onToggle={() => toggle(x.b.id)} />)}
        </div>
      )}
      <button type="button" onClick={() => { sourcesIntent.caseId = c.id; sourcesIntent.tab = "cas"; setSection("sources"); }} data-anchor="dossier:all-sources"
        className={`group flex h-10 items-center justify-center gap-2 rounded-full bg-white/[0.06] px-4 text-[13px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.09] transition-colors hover:bg-white/[0.12] hover:text-white ${FOCUS}`}>
        Voir toutes les sources, cas par cas <I.arrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
      </button>
    </>
  );
}

/* ================================================================ footer: previous / next / related */
function NavCard({ n, dir }: { n: ReturnType<typeof neighbours>["prev"]; dir: "prev" | "next" }) {
  const select = useApp((st) => st.select);
  const label = dir === "prev" ? "Cas précédent" : "Cas suivant";
  if (!n) {
    return <div className={`${s.card} flex min-h-[88px] flex-col justify-center rounded-[14px] px-3.5 py-3 opacity-50`}><div className="eyebrow !text-[9.5px]">{label}</div><div className="mt-1 text-[12.5px] text-[var(--mut)]">{dir === "prev" ? "C'est le premier cas du catalogue." : "C'est le dernier cas du catalogue."}</div></div>;
  }
  const c = CASE[n.id];
  return (
    <button type="button" onClick={() => select({ kind: "case", id: n.id })} data-anchor={`dossier:${dir}`} aria-label={`${label} : ${n.id}, ${c.titre}`}
      className={`${s.card} group flex min-h-[88px] flex-col rounded-[14px] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.07] ${dir === "next" ? "items-end text-right" : ""} ${FOCUS}`}>
      <div className={`flex items-center gap-1 ${dir === "next" ? "flex-row-reverse" : ""}`}>
        {dir === "prev" ? <G.left size={13} className="text-[var(--mut)] transition-transform group-hover:-translate-x-0.5" /> : <G.right size={13} className="text-[var(--mut)] transition-transform group-hover:translate-x-0.5" />}
        <span className="eyebrow !text-[9.5px]">{label}</span>
      </div>
      <div className="num mt-1 text-[12.5px] font-bold" style={{ color: FAM_COLOR[c.fam || n.id[0]] }}>{n.id}</div>
      <div className="mt-0.5 text-[12.5px] leading-snug text-[var(--txt)] group-hover:text-white" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.titre}</div>
      <div className="mt-auto pt-1.5 text-[11px] text-[var(--mut)]">{n.sameDept ? "Même service" : `${dir === "prev" ? "Service précédent" : "Service suivant"} · ${n.dept?.short ?? ""}`}</div>
    </button>
  );
}

function FooterNav({ c }: { c: UseCase }) {
  const nb = useMemo(() => neighbours(c.id), [c.id]);
  const rel = useMemo(() => relatedCases(c.id), [c.id]);
  const [all, setAll] = useState(false);
  const shared = all ? rel.shared : rel.shared.slice(0, 5);
  return (
    <nav aria-label="Autres cas" className="flex flex-col gap-4 pt-1" data-anchor="dossier:footer">
      <div className="flex items-center gap-3">
        <h3 className="text-[16px] font-semibold tracking-[-0.018em] text-white">Continuer la visite</h3>
        <span className="h-px flex-1 bg-white/[0.08]" />
        {nb.dept && nb.total > 0 && <span className="text-[11.5px] text-[var(--mut)]">Cas {nb.pos} sur {nb.total} · {nb.dept.short}</span>}
      </div>
      <div className="grid grid-cols-2 gap-2"><NavCard n={nb.prev} dir="prev" /><NavCard n={nb.next} dir="next" /></div>
      {(rel.dependsOn.length > 0 || rel.feeds.length > 0 || rel.shared.length > 0) && (
        <div className="flex flex-col gap-2">
          <Sub>Cas liés</Sub>
          <div className="flex flex-col gap-1.5">
            {rel.dependsOn.map((id) => <CaseLink key={`d${id}`} id={id} note="ce cas en dépend" />)}
            {rel.feeds.map((id) => <CaseLink key={`f${id}`} id={id} note="alimenté par ce cas" />)}
            {shared.map((x) => <CaseLink key={`s${x.id}`} id={x.id} note={`même source : ${x.via}`} />)}
          </div>
          {rel.shared.length > 5 && (
            <button type="button" onClick={() => setAll((v) => !v)} className={`self-start rounded-full px-2.5 py-1 text-[12px] font-medium text-[#AFC0FF] hover:bg-white/[0.07] hover:text-white ${FOCUS}`}>
              {all ? "Voir moins" : `Voir les ${rel.shared.length - 5} autres`}
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

/* ================================================================ sticky header + section chips (scroll-spy) */
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Header({ c, plan, scroller, secs, hero, lock, jump, back, backLabel, fam }: {
  c: UseCase; plan: Plan; scroller: MutableRefObject<HTMLDivElement | null>; secs: MutableRefObject<Record<string, HTMLElement | null>>; hero: MutableRefObject<HTMLDivElement | null>;
  lock: MutableRefObject<number>; jump: (id: SecId) => void; back: () => void; backLabel: string; fam: string;
}) {
  const select = useApp((st) => st.select);
  const nb = useMemo(() => neighbours(c.id), [c.id]);
  const [active, setActive] = useState<SecId>("verdict");
  const [titleSeen, setTitleSeen] = useState(false);
  const bar = useRef<HTMLDivElement | null>(null);
  const chipsEl = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const col = FAM_COLOR[fam];
  const lever = c.fam === "T" || (!c.value_out && !c.mdh);
  const chip = plan.v23 ? (c.merged_into ? { txt: "Fusionné", tone: TONES.blue, tip: verdict(c) } : c.fam === "T" ? { txt: "Levier", tone: TONES.neutral, tip: verdict(c) } : c.net > 0 ? { txt: "Rentable", tone: TONES.green, tip: verdict(c) } : { txt: "Net négatif", tone: TONES.amber, tip: verdict(c) })
    : plan.inside ? { txt: "Rentable", tone: TONES.green, tip: verdict(c) } : lever ? { txt: "Levier", tone: TONES.neutral, tip: "Levier de réalisation, sans gain propre." } : { txt: "Hors masse salariale", tone: TONES.blue, tip: c.value_out ?? "Valeur d'un autre type que la masse salariale." };

  // fades on the chip row edges
  const fades = useCallback(() => {
    const el = chipsEl.current; if (!el) return;
    el.style.setProperty("--fl", el.scrollLeft > 2 ? "22px" : "0px");
    el.style.setProperty("--fr", el.scrollLeft + el.clientWidth < el.scrollWidth - 2 ? "22px" : "0px");
  }, []);

  const keepChipVisible = useCallback((id: string) => {
    const wrap = chipsEl.current, b = chipRefs.current[id];
    if (!wrap || !b) return;
    const l = b.offsetLeft - 28, r = b.offsetLeft + b.offsetWidth + 28;
    if (l < wrap.scrollLeft) wrap.scrollTo({ left: Math.max(0, l), behavior: reduceMotion() ? "auto" : "smooth" });
    else if (r > wrap.scrollLeft + wrap.clientWidth) wrap.scrollTo({ left: r - wrap.clientWidth, behavior: reduceMotion() ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const el = scroller.current; if (!el) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const top = el.scrollTop, max = el.scrollHeight - el.clientHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, top / max) : 0})`;
      const h = hero.current;
      const seen = !!h && top > h.offsetTop + h.offsetHeight - 28;
      setTitleSeen((p) => (p === seen ? p : seen));
      if (performance.now() < lock.current) return;
      const base = el.getBoundingClientRect().top;
      let cur: SecId = plan.ids[0];
      for (const id of plan.ids) { const n = secs.current[id]; if (n && n.getBoundingClientRect().top - base <= 64) cur = id; }
      if (max > 0 && top >= max - 2) cur = plan.ids[plan.ids.length - 1];
      setActive((p) => (p === cur ? p : cur));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    const end = () => { lock.current = 0; on(); };
    el.addEventListener("scroll", on, { passive: true });
    el.addEventListener("scrollend", end);
    const ro = new ResizeObserver(on); ro.observe(el); if (el.firstElementChild) ro.observe(el.firstElementChild);
    on();
    return () => { el.removeEventListener("scroll", on); el.removeEventListener("scrollend", end); ro.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [plan, scroller, secs, hero, lock]);

  useEffect(() => { keepChipVisible(active); }, [active, keepChipVisible]);
  useEffect(() => { fades(); const el = chipsEl.current; if (!el) return; const ro = new ResizeObserver(fades); ro.observe(el); return () => ro.disconnect(); }, [fades]);

  const arrow = (dir: "prev" | "next") => {
    const n = dir === "prev" ? nb.prev : nb.next;
    const cc = n ? CASE[n.id] : null;
    const label = dir === "prev" ? "Cas précédent" : "Cas suivant";
    return (
      <Tip side="bottom" content={n && cc ? <><b className="text-[var(--txt)]">{label} · {n.id}</b><br />{cc.titre}{!n.sameDept && n.dept ? <><br /><span className="text-[var(--mut)]">Service : {n.dept.short}</span></> : null}</> : `${label} : aucun`}>
        <button type="button" disabled={!n} onClick={() => n && select({ kind: "case", id: n.id })} aria-label={n && cc ? `${label} : ${n.id}, ${cc.titre}` : `${label} : aucun`} data-anchor={`dossier:head-${dir}`}
          className={`grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-[var(--txt-2)] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.14] hover:text-white disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white/[0.06] ${FOCUS}`}>
          {dir === "prev" ? <G.left size={15} /> : <G.right size={15} />}
        </button>
      </Tip>
    );
  };

  return (
    <header className="relative shrink-0 border-b border-white/[0.07]" style={{ background: "linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.012))" }} data-anchor="dossier:header">
      <div className="flex h-[48px] items-center gap-2 px-4 min-[1500px]:px-5">
        <Tip side="bottom" content={backLabel} className="shrink-0">
          <button type="button" onClick={back} data-anchor="panel:back" aria-label={backLabel}
            className={`flex h-8 min-w-0 max-w-[132px] items-center gap-0.5 rounded-full bg-white/[0.06] pl-1.5 pr-3 text-[12.5px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.12] hover:text-white max-[1499px]:w-8 max-[1499px]:justify-center max-[1499px]:px-0 ${FOCUS}`}>
            <G.left size={15} className="shrink-0" /><span className="truncate max-[1499px]:hidden">{backLabel.replace(/^Retour · /, "")}</span>
          </button>
        </Tip>
        <span className="num shrink-0 rounded-full px-2 py-[3px] text-[11.5px]" style={{ background: `color-mix(in srgb, ${col} 18%, transparent)`, color: col }}>{c.id}</span>
        <div className="relative h-[18px] min-w-0 flex-1">
          <span className={`absolute inset-0 truncate text-[12px] leading-[18px] text-[var(--mut)] transition-opacity duration-300 ${titleSeen ? "opacity-0" : "opacity-100"}`}>{c.famille}</span>
          <span className={`absolute inset-0 truncate text-[12.5px] font-semibold leading-[18px] text-white transition-opacity duration-300 ${titleSeen ? "opacity-100" : "opacity-0"}`} aria-hidden={!titleSeen}>{c.titre}</span>
        </div>
        <Tip side="bottom" content={chip.tip} className="shrink-0">
          <span className="flex cursor-help items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[4px] text-[11.5px] font-semibold" style={{ background: chip.tone.bg, color: chip.tone.fg, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${chip.tone.bar} 35%, transparent)` }} data-anchor="dossier:verdict-chip">
            <Dot color={chip.tone.bar} size={6} />{chip.txt}
          </span>
        </Tip>
        <div className="flex shrink-0 items-center gap-1">{arrow("prev")}{arrow("next")}</div>
      </div>
      <nav aria-label="Sections du dossier" className="px-4 pb-2.5 min-[1500px]:px-5">
        <div ref={chipsEl} onScroll={fades} className="dz-chips dz-fade-x -mx-1 flex items-center gap-1.5 px-1 py-0.5">
          {plan.ids.map((id) => {
            const on = id === active;
            const n = id === "sources" ? plan.srcs.own.length + plan.srcs.linked.length : id === "preuves" ? plan.measured.length : 0;
            return (
              <button key={id} type="button" ref={(el) => { chipRefs.current[id] = el; }} onClick={() => { setActive(id); jump(id); }} aria-current={on ? "true" : undefined} data-anchor={`dossier:nav:${id}`}
                className={`flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] font-medium transition-colors duration-200 ${on ? "bg-white/[0.16] text-white ring-1 ring-white/25" : "bg-white/[0.04] text-[var(--mut)] ring-1 ring-white/[0.06] hover:bg-white/[0.08] hover:text-[var(--txt)]"} ${FOCUS}`}>
                {SEC[id].chip}{n > 0 && <span className={`num text-[11px] ${on ? "text-white/70" : "text-[var(--mut)]"}`}>{n}</span>}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="absolute inset-x-0 -bottom-px h-[2px] overflow-hidden" aria-hidden>
        <div ref={bar} className="h-full origin-left" style={{ transform: "scaleX(0)", background: "linear-gradient(90deg, rgba(91,124,255,.0), rgba(91,124,255,.85) 40%, rgba(76,199,154,.9))" }} />
      </div>
    </header>
  );
}

/* ================================================================ the dossier */
function V23Section() {
  const { c, tx } = useD();
  return <V23Body c={c} tx={tx} />;
}
const BODIES: Record<SecId, () => ReactNode> = {
  verdict: () => <VerdictBody />, v23: () => <V23Section />, aujourdhui: () => <AujourdhuiBody />, agents: () => <AgentsBody />, valeur: () => <ValeurBody />, leviers: () => <LeviersBody />,
  solutions: () => <SolutionsBody />, preuves: () => <PreuvesBody />, gouvernance: () => <GouvernanceBody />, deploiement: () => <DeploiementBody />, sources: () => <SourcesBody />,
};

function Dossier({ c }: { c: UseCase }) {
  const sel = useApp((st) => st.sel);
  const select = useApp((st) => st.select);
  const openCase = useApp((st) => st.openCase);
  const plan = useMemo(() => makePlan(c), [c]);
  const tx = useMemo(() => annotateAll(makeBlocks(c, plan)), [c, plan]);
  const fam = c.fam || c.id[0];
  const dep = DEPT[CASE_DEPT[c.id]];
  const scroller = useRef<HTMLDivElement | null>(null);
  const hero = useRef<HTMLDivElement | null>(null);
  const secs = useRef<Record<string, HTMLElement | null>>({});
  const lock = useRef(0);
  const [open, setOpen] = useState<Set<string>>(() => memory.getOpen(c.id));
  useEffect(() => { memory.setOpen(c.id, open); }, [c.id, open]);
  const toggle = useCallback((id: string) => setOpen((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  // scroll position: restored on arrival, saved while scrolling
  useLayoutEffect(() => { const el = scroller.current; if (el) el.scrollTop = memory.getScroll(c.id); }, [c.id]);
  // (not while the panel animates this dossier out: a detached element reports 0)
  const present = useIsPresent();
  const presentRef = useRef(true);
  presentRef.current = present;
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    const on = () => { if (presentRef.current && el.isConnected) memory.setScroll(c.id, el.scrollTop); };
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [c.id]);

  const jump = useCallback((id: SecId) => {
    const el = scroller.current, sec = secs.current[id];
    if (!el || !sec) return;
    const top = sec.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 4;
    lock.current = performance.now() + 1100;
    el.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? "auto" : "smooth" });
  }, []);
  const reveal = useCallback((srcId: string) => {
    setOpen((p) => (p.has(srcId) ? p : new Set(p).add(srcId)));
    requestAnimationFrame(() => {
      const el = scroller.current, row = el?.querySelector<HTMLElement>(`[data-src="${srcId}"]`);
      if (!el || !row) return;
      const top = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12;
      lock.current = performance.now() + 1100;
      el.scrollTo({ top: Math.max(0, top), behavior: reduceMotion() ? "auto" : "smooth" });
    });
  }, []);
  const reg = useCallback((id: SecId, el: HTMLElement | null) => { secs.current[id] = el; }, []);

  const back = () => {
    if (sel?.kind === "case") { if (dep) select({ kind: "dept", id: dep.id }); else openCase(null); }
    else openCase(null);
  };
  const backLabel = sel?.kind === "person" ? "Retour · la personne" : dep ? `Retour · ${dep.short}` : "Retour";
  const nb = useMemo(() => neighbours(c.id), [c.id]);
  const ctx: Ctx = { c, tx, plan, open, toggle, reveal, fam };

  return (
    <DCtx.Provider value={ctx}>
      <div className="flex h-full min-h-0 flex-col" data-anchor="dossier">
        <Header c={c} plan={plan} scroller={scroller} secs={secs} hero={hero} lock={lock} jump={jump} back={back} backLabel={backLabel} fam={fam} />
        <div ref={scroller} className="dz-scroll dz-edge-y min-h-0 flex-1" tabIndex={0} role="region" aria-label={`Dossier du cas ${c.id} : ${c.titre}`} data-anchor="dossier:scroll">
          <div className="px-4 pb-10 pt-4 min-[1500px]:px-5">
            <div ref={hero} className="mb-6">
              <div className="eyebrow !text-[10px]">{c.id} · {c.famille}{dep ? ` · ${dep.short}` : ""}{dep && dep.building === "main" ? ` · ${floorShort(dep.building, dep.floor)}` : dep ? " · Siège" : ""}</div>
              <h2 className="h-display mt-1.5 text-[clamp(21px,1.55vw,28px)] text-white">{c.titre}</h2>
              {dep && nb.total > 0 && <p className="mt-1.5 text-[12px] text-[var(--mut)]">Cas {nb.pos} sur {nb.total} dans le service {dep.short}.</p>}
            </div>
            <div className="flex flex-col gap-10">
              {plan.ids.map((id) => (
                <Section key={id} id={id} title={SEC[id].title} intro={SEC[id].intro} reg={reg} right={id === "v23" ? <FinanceLink id={c.id} /> : undefined}>{BODIES[id]()}</Section>
              ))}
              <FooterNav c={c} />
            </div>
          </div>
        </div>
      </div>
    </DCtx.Provider>
  );
}

export function CaseDossier({ id }: { id: string }) {
  const c = CASE[id];
  if (!c) return <div className="p-5 text-[14px] text-[var(--mut)]">Cas d&apos;usage introuvable : {id}</div>;
  return <Dossier key={c.id} c={c} />;
}

void CaseChip; void benchFor; void levelCode;
