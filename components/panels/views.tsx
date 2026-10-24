"use client";
// Side panel contents, one per selection kind. Verdict first, every unit explained. Departments, people and places fit the panel;
// a use case opens as a scrollable dossier (dossier.tsx).
import type { ReactNode } from "react";
import * as THREE from "three";
import { useApp } from "@/lib/store";
import { agg, fr, verdict, MODE_LABEL, CASE, CASES, DATA, FAM, META, YEAR_LABEL, YEARS, FINAL_YEAR, HEAD, V23, etabIn, share, yearTotals, type UseCase } from "@/lib/model";
import { DEPT, DEPTS, ALL_DEPTS, AP_FAC, AP_FLOORS, CASE_DEPT, ROLE_LABEL, ROLE_COLOR, KIND_COLOR, EXPERIENCES, XP, type Dept, type Role } from "@/lib/hospital";
import { SITES, CITIES, INTERNATIONAL, GROUP } from "@/lib/geo/network";
import { facilityBySlug, facilitySites } from "@/lib/facilities";
import { placeById, REFERENTIAL_CHECKED } from "@/lib/geo/casaReferential";
import { CASA_REEL, geoToScene } from "@/lib/geo/casaFrame";
import { rig } from "@/lib/rig";
import { DeptIcon, I } from "@/components/ui/icons";
import { AkditalMark } from "@/components/ui/AkditalLogo";
import { MiniBar, Tip, Dot, MarketTile } from "@/components/ui/kit";
import { visibleStaff } from "@/components/scenes/hospital/staffing";
import { FAM_COLOR, famOfDept, famName, floorShort, deptsOfFloor, floorName, floorTitle, money, norm, yearPhrase, groupSeries, in302, benchOf } from "@/lib/ui/fmt";
import { useViewport } from "@/lib/ui/hooks";
import { KpiStrip, PeopleBlock, CaseRows, CaseListSplit, SectionTitle, useCompact, useTight } from "./parts";
import { CaseDossier } from "./dossier";
import s from "@/components/ui/styles";

const KIND_LABEL: Record<Dept["kind"], string> = { admin: "Service administratif", care: "Service de soins", support: "Hôtellerie et logistique", hq: "Siège" };
const firstSentence = (t: string) => { const m = t.match(/^.*?[.!?](\s|$)/); return (m ? m[0] : t).trim(); };
const modeCode = (c: UseCase) => c.mode.split(" ")[0];

function Title({ eyebrow, title, sub, icon, color }: { eyebrow: ReactNode; title: ReactNode; sub?: ReactNode; icon?: ReactNode; color?: string }) {
  return (
    <div className="flex items-start gap-3.5">
      {icon && (
        <span className="mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-[13px] ring-1 ring-white/10" style={{ background: `color-mix(in srgb, ${color ?? "#7C93D6"} 18%, transparent)`, color: color ?? "#fff" }}>{icon}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="eyebrow !text-[10px]">{eyebrow}</div>
        <h2 className="h-display mt-1 text-[clamp(22px,1.7vw,30px)] text-white">{title}</h2>
        {sub && <p className="mt-1.5 text-[13.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{sub}</p>}
      </div>
    </div>
  );
}

function Verdict({ children }: { children: ReactNode }) {
  const tight = useTight();
  return (
    <div className={`relative rounded-[16px] px-4 ${tight ? "py-2" : "py-3"}`} style={{ background: "linear-gradient(90deg, rgba(76,199,154,.12), rgba(76,199,154,.03))", boxShadow: "inset 3px 0 0 var(--green)" }}>
      <div className={`eyebrow !text-[9.5px] ${tight ? "mb-0.5" : "mb-1"}`} style={{ color: "#7FD9B5" }}>Verdict</div>
      <p className={`font-semibold leading-snug text-white ${tight ? "text-[13.5px]" : "text-[clamp(15px,1.05vw,18px)]"}`}>{children}</p>
    </div>
  );
}

function Team({ d }: { d: Dept }) {
  const select = useApp((st) => st.select);
  const count: Partial<Record<Role, number>> = {};
  const rows = d.staff.map((x) => { const idx = count[x.role] ?? 0; count[x.role] = idx + x.n; return { ...x, idx }; }).filter((x) => x.role !== "patient");
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((x) => (
        <button key={x.label} type="button" onClick={() => select({ kind: "person", id: `${d.id}/${x.role}/${x.idx}` })} data-anchor={`person-chip:${d.id}/${x.role}/${x.idx}`}
          className="flex items-center gap-1.5 rounded-full bg-white/[0.05] px-2.5 py-1 text-[12px] text-[var(--txt-2)] ring-1 ring-white/[0.07] transition-colors hover:bg-white/[0.1] hover:text-white">
          <Dot color={ROLE_COLOR[x.role]} size={7} />{x.label}
        </button>
      ))}
    </div>
  );
}

function familyPeople(fam: string, year: ReturnType<typeof useApp.getState>["year"]) {
  const f = FAM[fam];
  // v13: the family share assumed by the top-down estimate; v23: the FTE freed that year by the family's cases, over its workforce
  const v = V23 ? (f.etp ? (agg(CASES.filter((c) => c.fam === fam).map((c) => c.id), year).etp / f.etp) * 10 : 0) : f.part * 10 * share(year).eco;
  const n = fr(v, v % 1 ? 1 : 0);
  const verb = year === 2026 ? "ne sont pas encore repris (le programme démarre fin 2026)" : `${Number(n.replace(",", ".")) <= 1 ? "est repris" : "sont repris"} par les agents ${yearPhrase(year)}`;
  return { v, text: <>Sur 10 temps pleins de la famille <b className="font-semibold text-white">{f.name.toLowerCase()}</b>, {year === 2026 ? "aucun" : n} {verb}. Sans licenciement : départs non remplacés et mobilités.</> };
}

/* ================================================================ department */
/** Department whose cases all create value outside the payroll: what kind of value, indicative and non-additive. */
function BeyondCard({ cases }: { cases: UseCase[] }) {
  const types = [...new Set(cases.flatMap((c) => (c.value_levers ?? []).map((v) => v.type)).filter(Boolean))];
  const sols = [...new Set(cases.flatMap((c) => c.solutions ?? []))];
  const proofs = benchOf(cases.map((c) => c.id)).length;
  return (
    <div className="rounded-[16px] px-4 py-3" style={{ background: "linear-gradient(90deg, rgba(91,124,255,.13), rgba(91,124,255,.03))", boxShadow: "inset 3px 0 0 #9FB3FF" }}>
      <div className="flex items-center gap-2"><span className="eyebrow !text-[9.5px] !text-[#AFC0FF]">{V23 ? "Verdict · fusionné dans un autre cas" : "Verdict · au-delà de la masse salariale"}</span>{!V23 && <span className="ml-auto rounded-full bg-white/[0.07] px-2 py-[2px] text-[10.5px] text-[var(--txt-2)]">indicatif, non additif aux {fr(META.eco, 0)} MDH</span>}</div>
      <p className="mt-1 text-[clamp(15px,1.05vw,18px)] font-semibold leading-snug text-white">{V23 ? `${cases.length} cas sans chiffrage propre : leur valeur est comptée dans ${[...new Set(cases.map((c) => c.merged_into).filter(Boolean))].join(", ") || "un autre cas"}.` : `${cases.length} cas créent une valeur d'un autre type que la masse salariale${proofs ? `, dont des résultats déjà mesurés ailleurs (${proofs})` : ""}.`}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {types.slice(0, 8).map((x) => <span key={x} className="rounded-full bg-white/[0.06] px-2 py-[2px] text-[11px] text-[var(--txt-2)]">{x}</span>)}
        {sols.length > 0 && <span className="ml-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)]">Solutions</span>}
        {sols.slice(0, 6).map((x) => <span key={x} className="rounded-full bg-[rgba(91,124,255,.16)] px-2 py-[2px] text-[11px] font-medium text-[#C9D4FF] ring-1 ring-[rgba(91,124,255,.3)]">{x}</span>)}
      </div>
    </div>
  );
}

export function DeptView({ id }: { id: string }) {
  const d = DEPT[id];
  const year = useApp((st) => st.year);
  const perSiteStore = useApp((st) => st.perSite);
  const openCase = useApp((st) => st.openCase);
  const compact = useCompact();
  const tight = useTight();
  if (!d) return <Missing what="Service" id={id} />;
  // a real facility's department shows the hôpital type's figures (one establishment = the group ÷ its establishments)
  const perSite = d.fac ? true : perSiteStore;
  const fam = famOfDept(d);
  const top = d.cases.map((c) => CASE[c]).filter(Boolean).sort((a, b) => b.mdh - a.mdh)[0];
  const desc = top ? firstSentence(top.aujourdhui) : d.note;
  const a = agg(d.cases, year, perSite);
  const where = d.building === "annex" ? "Siège · annexe" : floorShort(d.building, d.floor);
  const inIds = d.cases.filter((x) => CASE[x] && in302(CASE[x]) && CASE[x].mdh > 0);
  const outCases = d.cases.map((x) => CASE[x]).filter((x) => x && !in302(x));
  return (
    <div className={`flex h-full flex-col ${compact ? "gap-3.5" : "gap-5"}`}>
      <Title eyebrow={<>{d.fac ? `${facilitySites(d.fac).main?.name ?? "Établissement"} · ` : ""}{where} · {KIND_LABEL[d.kind]}</>} title={d.name} sub={tight && d.cases.length ? undefined : desc} icon={<DeptIcon k={d.icon} size={22} />} color={KIND_COLOR[d.kind]} />
      {d.fac && (
        <div className="rounded-[12px] px-3.5 py-2.5 text-[12px] leading-snug text-[var(--txt-2)]" style={{ background: "rgba(29,180,234,.08)", boxShadow: "inset 0 0 0 1px rgba(29,180,234,.22)" }} data-anchor={`estimate:${d.id}`}>
          <b className="text-white">Estimation · hôpital type.</b> {d.cases.length ? <>Les cas d&apos;usage et les chiffres sont ceux du service équivalent de l&apos;hôpital type, pour un établissement (groupe ÷ {etabIn(year)}). </> : null}Pas de chiffre propre à cet établissement ; répartition des services illustrative (plans non publiés).
        </div>
      )}
      {inIds.length > 0 && top && top.mdh > 0 && (
        <Verdict>
          {year === 2026 ? <>Aujourd&apos;hui, rien n&apos;est encore engagé. {V23 ? `En ${FINAL_YEAR}` : "Au plein régime"} : {fr(agg(d.cases, FINAL_YEAR, perSite).mdh, 1)} MDH {V23 ? "de gains bruts" : "économisés"} par an{perSite ? " par établissement" : ""}.</>
            : V23 ? <>{fr(money(a.mdh).v, money(a.mdh).d)} {money(a.mdh).unit} de gains bruts {yearPhrase(year)}{perSite ? " par établissement" : ""}, pour {fr(money(a.cout).v, money(a.cout).d)} {money(a.cout).unit} de coût : {fr(a.roi, 1)} dirhams de gains pour 1 dirham dépensé.</>
            : <>{fr(money(a.mdh).v, money(a.mdh).d)} {money(a.mdh).unit} économisés {yearPhrase(year)}{perSite ? " par établissement" : ""}, pour {fr(money(a.cout).v, money(a.cout).d)} {money(a.cout).unit} d&apos;agents : {fr(a.roi, 2)} dirhams rendus pour 1 dirham dépensé.</>}
        </Verdict>
      )}
      {d.cases.length > 0 ? (
        <>
          {inIds.length > 0 ? <KpiStrip ids={d.cases} year={year} perSite={perSite} note={perSite && d.kind === "hq" ? "Le siège n'est pas réparti par établissement : basculez sur « Groupe » pour voir ses chiffres." : undefined} /> : <BeyondCard cases={outCases} />}
          {fam && FAM[fam]?.etp > 0 && (V23 || FAM[fam]?.part > 0) && (() => { const p = familyPeople(fam, year); return <PeopleBlock value={p.v} color={FAM_COLOR[fam]} title={`famille ${famName(fam).toLowerCase()}`} text={p.text} />; })()}
          {(() => { const v = visibleStaff(d.id, year); const v29 = visibleStaff(d.id, FINAL_YEAR); if (!v.shrinks) return null; return (
            <Tip content={<>Dans l&apos;hôpital représenté (figures illustratives) : départs non remplacés et mobilités vers les ouvertures, zéro licenciement.</>}>
              <span className="-mt-1 inline-flex w-fit cursor-help items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12.5px] leading-none text-[var(--txt-2)]" data-anchor={`staff:${d.id}`}><b className="num text-white">{v.n2026}</b> personnes en 2026 → <b className="num text-white">{year === 2026 ? v29.n : v.n}</b> pilote{(year === 2026 ? v29.n : v.n) > 1 ? "s" : ""} {year === 2026 ? `en ${FINAL_YEAR}` : `en ${year}`} · zéro licenciement</span>
            </Tip>); })()}
          <CaseListSplit key={d.id} layoutId={`dept-split-${d.id}`} ids={d.cases} year={year} perSite={perSite} onOpen={(cid) => openCase(cid)} max={tight ? 4 : compact ? 5 : 6} />
          <XpStrip deptId={d.id} />
          <div className={tight ? "hidden" : "min-h-0 overflow-hidden"}>
            <SectionTitle>Équipe représentée · cliquez sur un métier</SectionTitle>
            <Team d={d} />
          </div>
        </>
      ) : (
        <>
          <div className="rounded-[18px] px-5 py-5" style={{ background: "linear-gradient(135deg, rgba(95,179,168,.16), rgba(95,179,168,.04))", boxShadow: "inset 0 0 0 1px rgba(95,179,168,.25)" }}>
            <div className="flex items-center gap-2 text-[#8FD1C7]"><I.shieldCheck size={18} /><span className="eyebrow !text-[10px] !text-[#8FD1C7]">Le soin reste humain</span></div>
            <p className="mt-2 text-[clamp(17px,1.2vw,21px)] font-semibold leading-snug text-white">Aucun agent ne touche à l&apos;acte de soin dans ce service.</p>
            {d.note && <p className="mt-2 text-[13.5px] leading-snug text-[var(--txt-2)]">{d.note}</p>}
          </div>
          <div>
            <SectionTitle>Équipe représentée</SectionTitle>
            <Team d={d} />
          </div>
          <RelatedCases note={d.note} />
        </>
      )}
    </div>
  );
}

function RelatedCases({ note }: { note?: string }) {
  const select = useApp((st) => st.select);
  const ids = [...new Set((note ?? "").match(/[ASPHT]-\d{2}/g) ?? [])].filter((x) => CASE[x]);
  if (!ids.length) return null;
  return (
    <div>
      <SectionTitle>Cas d&apos;usage voisins</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {ids.map((cid) => (
          <button key={cid} type="button" onClick={() => select({ kind: "case", id: cid })} data-anchor={`case-row:${cid}`}
            className={`${s.card} flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.07]`}>
            <span className="num text-[12.5px] font-bold" style={{ color: FAM_COLOR[cid[0]] }}>{cid}</span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--txt)]">{CASE[cid].titre}</span>
            <span className="text-[12px] text-[var(--mut)]">{DEPT[CASE_DEPT[cid]]?.short}</span>
            <I.chevron size={14} className="text-[var(--mut)]" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ================================================================ use case: the full, scrollable dossier lives in dossier.tsx */
export function CaseView({ id }: { id: string }) {
  return <CaseDossier id={id} />;
}

/* ================================================================ person */
export function PersonView({ id }: { id: string }) {
  const [deptId, role, idxS] = id.split("/");
  const d = DEPT[deptId];
  const year = useApp((st) => st.year);
  const perSite = useApp((st) => st.perSite);
  const openCase = useApp((st) => st.openCase);
  const compact = useCompact();
  const tight = useTight();
  if (!d) return <Missing what="Personne" id={id} />;
  // index counts the figures of that role across the department's staff entries, in order
  let acc = 0; const idx = Number(idxS) || 0;
  const sameRole = d.staff.filter((x) => x.role === role);
  const entry = sameRole.find((x) => { const hit = idx < acc + x.n; acc += x.n; return hit; }) ?? sameRole[sameRole.length - 1] ?? d.staff[0];
  const r = (entry?.role ?? role) as Role;
  const label = entry?.label ?? ROLE_LABEL[r];
  const key = norm(label).replace(/\(.*?\)/g, "").split(/\s+/)[0];
  const matched = d.cases.map((c) => CASE[c]).filter((c) => c && (norm(c.metier_libere) === norm(label) || norm(c.metier_libere).startsWith(key)));
  const main = (matched[0] ?? d.cases.map((c) => CASE[c]).sort((a, b) => b.mdh - a.mdh)[0]) as UseCase | undefined;
  const fam = famOfDept(d);
  const isCare = r === "medecin" || r === "infirmier" || r === "aide";
  const roleRow = DATA.roles.find((x) => norm(x.metier) === norm(label));
  let change: ReactNode;
  if (r === "patient") change = <>Le patient garde un interlocuteur humain. L&apos;agent prépare son dossier en amont : moins de ressaisie, moins d&apos;attente au guichet.</>;
  else if (!d.cases.length || (isCare && !matched.length && d.kind === "care" && !d.cases.length)) change = <>Rien ne change dans l&apos;acte de soin. {d.note}</>;
  else if (main) change = <>Devient <b className="font-semibold text-white">pilote d&apos;agents</b> : {(MODE_LABEL[modeCode(main)] ?? "").toLowerCase()}. {main.validation_humaine}</>;
  return (
    <div className={`flex h-full flex-col ${compact ? "gap-3.5" : "gap-5"}`}>
      <Title eyebrow={<>{d.short} · {ROLE_LABEL[r]}</>} title={label} sub={<>Une personne de l&apos;équipe {d.name.toLowerCase()} — {d.building === "annex" ? "siège" : floorShort(d.building, d.floor).toLowerCase()}.</>}
        icon={<I.person size={22} />} color={ROLE_COLOR[r]} />
      {main && main.mdh > 0 && r !== "patient" && <Verdict>{verdict(main)}</Verdict>}
      <div className="rounded-[18px] px-5 py-4" style={{ background: "linear-gradient(135deg, rgba(91,124,255,.14), rgba(91,124,255,.03))", boxShadow: "inset 0 0 0 1px rgba(91,124,255,.22)" }}>
        <div className="eyebrow !text-[10px] !text-[#AFC0FF]">Ce qui change pour cette personne</div>
        <p className="mt-2 text-[14.5px] leading-snug text-[var(--txt)]">{change}</p>
        {r !== "patient" && (
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
            <span className="rounded-full bg-[rgba(76,199,154,.14)] px-2.5 py-1 font-semibold text-[#7FD9B5]">0 licenciement</span>
            {d.cases.length > 0 && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[var(--txt-2)]">formée à l&apos;académie des pilotes (T-04)</span>}
            {d.cases.length > 0 && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[var(--txt-2)]">mobilité possible vers les ouvertures (T-05)</span>}
            {roleRow && <Tip content={`Équivalents temps plein libérés pour ce métier dans tout le groupe, ${V23 ? `en ${FINAL_YEAR}` : "au plein régime"}.`}><span className="cursor-help rounded-full bg-white/[0.06] px-2.5 py-1 text-[var(--txt-2)]">{fr(roleRow.etp, 0)} ETP-éq. libérés dans le groupe</span></Tip>}
          </div>
        )}
      </div>
      {fam && FAM[fam]?.part > 0 && r !== "patient" && (() => { const p = familyPeople(fam, year); return <PeopleBlock value={p.v} color={FAM_COLOR[fam]} title={`famille ${famName(fam).toLowerCase()}`} text={p.text} />; })()}
      {d.cases.length > 0 && (
        <div className="min-h-0">
          <SectionTitle>Cas d&apos;usage de son service · {d.cases.length}</SectionTitle>
          <CaseRows ids={d.cases} year={year} perSite={perSite} onOpen={(cid) => openCase(cid)} highlight={matched.map((c) => c.id)} max={tight ? 3 : compact ? 4 : 6} />
        </div>
      )}
    </div>
  );
}

/* ================================================================ floor */
function floorCounts(ids: string[]) {
  const n302 = ids.filter((x) => CASE[x] && in302(CASE[x])).length, nOut = ids.length - n302, proofs = benchOf(ids).length;
  return [n302 ? `${n302} ${V23 ? "chiffrés" : "masse salariale"}` : null, nOut ? `${nOut} ${V23 ? "fusionné" + (nOut > 1 ? "s" : "") : "au-delà"}` : null, proofs ? `${proofs} preuve${proofs > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ");
}
export function FloorView({ id }: { id: string }) {
  const year = useApp((st) => st.year);
  const perSiteStore = useApp((st) => st.perSite);
  const select = useApp((st) => st.select);
  const annex = id.startsWith("annex");
  const real = id.startsWith("ap."); // a floor of Anfa Prime: one establishment, the hôpital type's figures
  const perSite = real ? true : perSiteStore;
  const depts = annex ? DEPTS.filter((d) => d.building === "annex").sort((a, b) => a.floor - b.floor) : deptsOfFloor(id);
  const ids = depts.flatMap((d) => d.cases);
  const rows = depts.map((d) => ({ d, a: agg(d.cases, year, perSite) })).sort((x, y) => y.a.mdh - x.a.mdh);
  const top = Math.max(...rows.map((r) => r.a.mdh), 1e-9);
  return (
    <div className="flex h-full flex-col gap-5">
      <Title eyebrow={annex ? "Siège · annexe administrative" : real ? "Anfa Prime Hospital · étage (illustratif)" : "Hôpital type · étage"} title={annex ? "Siège du groupe" : floorTitle(id)} sub={annex ? "Achats, juridique, informatique, finance, ressources humaines et pilotage : quatre plateaux." : floorName(id).split(" · ").slice(1).join(" · ")} icon={<I.layers size={22} />} color="#9FB3FF" />
      {ids.length > 0 && <KpiStrip ids={ids} year={year} perSite={perSite} note={perSite && annex ? "Le siège n'est pas réparti par établissement : basculez sur « Groupe »." : undefined} />}
      <div>
        <SectionTitle>Services de l&apos;étage · {depts.length}</SectionTitle>
        <div className="flex flex-col gap-1">
          {rows.map(({ d, a }) => {
            const m = money(a.mdh);
            return (
              <button key={d.id} type="button" onClick={() => select({ kind: "dept", id: d.id })} data-anchor={`floor-row:${d.id}`}
                className={`group grid grid-cols-[36px_minmax(0,1fr)_96px_110px] items-center gap-3 rounded-[13px] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] ${id === `annex:${d.floor}` && annex ? "bg-white/[0.04]" : ""}`}>
                <span className="grid h-9 w-9 place-items-center rounded-[11px] ring-1 ring-white/10" style={{ background: `color-mix(in srgb, ${KIND_COLOR[d.kind]} 16%, transparent)`, color: KIND_COLOR[d.kind] }}><DeptIcon k={d.icon} size={18} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-[var(--txt)] group-hover:text-white">{d.name}</span>
                  <span className="block text-[12px] text-[var(--mut)]">{d.cases.length ? floorCounts(d.cases) : "soin humain, pas de cas propre"}{annex ? ` · ${d.floor === 0 ? "RDC" : d.floor + (d.floor === 1 ? "er" : "e")}` : ""}</span>
                </span>
                <span className="text-right">{d.cases.length && a.mdh ? <><span className="num text-[15px] text-white">{fr(m.v, m.d)}</span> <span className="text-[11px] font-semibold text-[var(--mut)]">{m.unit}</span></> : <span className="text-[12px] text-[var(--mut)]">—</span>}</span>
                <MiniBar value={a.mdh} max={top} color={KIND_COLOR[d.kind]} />
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-3 text-[11.5px] text-[var(--mut)]">{V23 ? "Gains bruts annuels" : "Économie annuelle"} {yearPhrase(year)}, en {perSite ? "MDH (millions de dirhams) ou kMAD (milliers de dirhams) par établissement" : "MDH (millions de dirhams)"}.</p>
      </div>
    </div>
  );
}

/* ================================================================ city / site / country */
const ST_COLOR = (st?: string) => (st?.startsWith("opérationnel") ? "var(--green)" : st?.startsWith("en construction") ? "var(--amber)" : "var(--mut)");
const ST_LABEL = (st?: string) => (st === "opérationnel" ? "en service" : st === "en construction" ? "en construction" : st === "projet annoncé" ? "projet annoncé" : st ?? "");
const domain = (u?: string | null) => { if (!u) return null; try { return new URL(u.split(" ; ")[0].trim()).hostname.replace(/^www\./, ""); } catch { return null; } };

export function PlaceView({ kind, id }: { kind: "city" | "site" | "country"; id: string }) {
  const year = useApp((st) => st.year);
  const setLevel = useApp((st) => st.setLevel);
  const select = useApp((st) => st.select);
  const site = kind === "site" ? SITES.find((x) => x.slug === id) : undefined;
  const city = kind === "city" ? CITIES.find((x) => x.slug === id) : undefined;
  const isMA = kind === "country" && (id === "MA" || norm(id) === "maroc");
  const intl = kind === "country" && !isMA ? INTERNATIONAL.filter((x) => x.iso === id || norm(x.country) === norm(id)) : [];
  const pretty = id.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const ALL = CASES.map((c) => c.id);
  const t = yearTotals(year);
  const typ = agg(ALL, year, true);
  const nOps = city ? city.operational : 0;
  const showKpi = !!site && site.status === "opérationnel" || !!city && nOps > 0 || isMA;
  let title = pretty, eyebrow: ReactNode = "Réseau Akdital", sub: ReactNode = null;
  if (site) { title = site.name; eyebrow = <>{site.city} · {site.brand}</>; sub = <>{site.type}{site.beds ? ` · ${fr(site.beds, 0)} lits` : " · lits non publiés"}{site.opening_year ? ` · ouverture ${site.opening_year}` : ""}</>; }
  else if (city) {
    title = city.name; eyebrow = <>Ville · {city.region}</>;
    sub = <>{city.operational} établissement{city.operational > 1 ? "s" : ""} en service{city.construction ? `, ${city.construction} en construction` : ""}{city.announced ? `, ${city.announced} annoncé${city.announced > 1 ? "s" : ""}` : ""}{city.beds ? ` · ${fr(city.beds, 0)} lits renseignés${city.bedsKnownFor && city.bedsKnownFor < city.sites.length ? ` (pour ${city.bedsKnownFor} établissements sur ${city.sites.length})` : ""}` : ""}</>;
  }
  else if (isMA) { title = "Maroc"; eyebrow = "Pays · réseau Akdital"; sub = <>{GROUP.establishments} établissements, {fr(GROUP.beds, 0)} lits, {GROUP.cities} villes ({GROUP.source}).</>; }
  else if (intl.length) { title = intl[0].country; eyebrow = "International · hors programme"; sub = <>{intl.length} projet{intl.length > 1 ? "s" : ""} recensé{intl.length > 1 ? "s" : ""} par la recherche, avec leur statut.</>; }
  return (
    <div className="flex h-full flex-col gap-5">
      <Title eyebrow={eyebrow} title={title} sub={sub} icon={site || city || isMA ? <AkditalMark size={26} /> : <I.globe size={22} />} color={site || city || isMA ? "#1DB4EA" : "#9FB3FF"} />
      {!site && !city && !isMA && !intl.length && (
        <div className={`${s.card} rounded-[14px] px-4 py-3 text-[13px] text-[var(--txt-2)]`}>Ce lieu n&apos;est pas dans les données du réseau.</div>
      )}
      {site && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-[var(--txt)]"><Dot color={ST_COLOR(site.status)} size={7} />{ST_LABEL(site.status)}</span>
          {site.premium && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-[var(--txt-2)]">premium</span>}
          {site.specialties.slice(0, compactList(site.specialties.length)).map((x) => <span key={x} className="rounded-full bg-white/[0.04] px-2.5 py-1 text-[12px] text-[var(--mut)] ring-1 ring-white/[0.06]">{x}</span>)}
          {site.specialties.length > 9 && <span className="px-1 text-[12px] text-[var(--mut)]">+ {site.specialties.length - 9}</span>}
        </div>
      )}
      {site?.notes && <p className="text-[12.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{site.notes}</p>}
      {site && facilityBySlug(site.slug) && (
        <button type="button" onClick={() => select({ kind: "facility", id: site.slug })} data-anchor={`panel:facility:${site.slug}`}
          className={`${s.card} flex items-center gap-2 self-start rounded-full px-4 py-2 text-[13px] font-semibold text-white ring-1 ring-[#1DB4EA]/50 hover:bg-white/[0.08]`}>
          <I.hospital size={16} /> Voir le bâtiment dans Casablanca <I.arrowRight size={14} />
        </button>
      )}
      {city && city.sites.length > 0 && (
        <div>
          <SectionTitle>Établissements · {city.sites.length}</SectionTitle>
          <div className="grid grid-cols-2 gap-1.5">
            {city.sites.slice(0, 12).map((slug) => { const x = SITES.find((y) => y.slug === slug); if (!x) return null; return (
              <button key={slug} type="button" onClick={() => select({ kind: "site", id: slug })} data-anchor={`site-row:${slug}`} className={`${s.card} flex items-center gap-2 rounded-[12px] px-3 py-2 text-left hover:bg-white/[0.07]`}>
                <Dot color={ST_COLOR(x.status)} size={7} /><span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--txt)]">{x.name}</span>
                {x.beds ? <span className="num shrink-0 text-[11px] text-[var(--mut)]">{fr(x.beds, 0)} lits</span> : null}
              </button>); })}
          </div>
          {city.sites.length > 12 && <p className="mt-1.5 text-[11.5px] text-[var(--mut)]">+ {city.sites.length - 12} autres</p>}
        </div>
      )}
      {intl.length > 0 && (
        <>
          <div className="flex flex-col gap-1.5">
            {intl.map((x, k) => (
              <div key={k} className={`${s.card} rounded-[14px] px-4 py-3`}>
                <div className="flex items-center gap-2"><Dot color={ST_COLOR(x.statusKey)} size={8} /><span className="text-[13.5px] font-semibold text-white">{x.city}</span>
                  <span className="ml-auto rounded-full bg-white/[0.06] px-2 py-[2px] text-[11px] text-[var(--txt-2)]">{x.statusKey ?? "projet"}</span></div>
                <p className="mt-1 text-[12.5px] leading-snug text-[var(--txt)]">{x.project}</p>
                <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--mut)]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{x.status}</p>
              </div>
            ))}
          </div>
          <div className="rounded-[16px] px-4 py-3.5" style={{ background: "linear-gradient(135deg, rgba(91,124,255,.14), rgba(91,124,255,.03))", boxShadow: "inset 0 0 0 1px rgba(91,124,255,.22)" }}>
            <p className="text-[13.5px] leading-snug text-[var(--txt)]">Le programme de <b className="text-white">{fr(META_ECO, 0)} MDH</b> (millions de dirhams){V23 ? " de gains bruts par an" : ""} porte sur le Maroc. Le même modèle d&apos;agents peut être répliqué ici une fois le réseau marocain {V23 ? `déployé (horizon ${FINAL_YEAR})` : "au plein régime"} ; aucun chiffre n&apos;est estimé pour ce pays.</p>
          </div>
        </>
      )}
      {showKpi && (
        <div>
          <SectionTitle>{site ? `Hôpital type · moyenne des ${etabIn(year)} établissements` : city ? `Ordre de grandeur · ${nOps} × hôpital type` : "Groupe Akdital au Maroc"} · {YEAR_LABEL[year].toLowerCase()}</SectionTitle>
          <div className="grid grid-cols-3 gap-2">
            {(site ? [typ.mdh, typ.cout, typ.net] : city ? [typ.mdh * nOps, typ.cout * nOps, typ.net * nOps] : [t.eco, t.cout, t.net]).map((v, k) => {
              const m = money(v);
              return <MarketTile key={k} size="md" label={(V23 ? ["Gains bruts", "Coût des cas", "Valeur nette"] : ["Économie", "Coût des agents", "Gain net"])[k]} value={m.v} d={m.d} unit={m.unit}
                explain={<>{m.unit === "MDH" ? "MDH (millions de dirhams)" : "kMAD (milliers de dirhams)"} par an</>}
                series={site || city ? undefined : groupSeries((["eco", "cout", "net"] as const)[k])} active={YEARS.indexOf(year)} color={["var(--green)", "#B9C1D6", "#E6EAF5"][k]} tone={k === 1 ? "neutral" : "pos"} />;
            })}
          </div>
          {(site || city) && <p className="mt-2 text-[11.5px] text-[var(--mut)]">Estimation : l&apos;hôpital type vaut le groupe divisé par {etabIn(year)} établissements{V23 ? " (le réseau grandit chaque année)" : ""}, hors siège. Pas de chiffre propre à {site ? "cet établissement" : "cette ville"}.</p>}
        </div>
      )}
      {site && site.status !== "opérationnel" && <p className="text-[12.5px] text-[var(--txt-2)]">Établissement pas encore en service : il entrera dans le programme avec la vague V4 (« ouvertures comprises »), sans chiffre propre ici.</p>}
      {!intl.length && (
        <button type="button" onClick={() => setLevel("hospital")} data-anchor="panel:enter-hospital"
          className="mt-auto flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#0B1020] shadow-[0_10px_30px_-10px_rgba(255,255,255,.4)] transition-transform hover:scale-[1.01]">
          <I.hospital size={18} /> Entrer dans l&apos;hôpital type <I.arrowRight size={16} />
        </button>
      )}
      {site?.source && <p className={`flex items-center gap-1.5 text-[11px] text-[var(--mut)] ${intl.length ? "mt-auto" : ""}`}><I.link size={12} />Source : {domain(site.source) ?? site.source.slice(0, 80)}{(site.sources?.length ?? 0) > 1 ? ` + ${(site.sources?.length ?? 1) - 1} autres` : ""}</p>}
      {intl.length > 0 && <p className="mt-auto flex items-center gap-1.5 text-[11px] text-[var(--mut)]"><I.link size={12} />Sources : {[...new Set(intl.map((x) => domain(x.source)).filter(Boolean))].join(" · ")}</p>}
    </div>
  );
}
/** A real establishment drawn in the city (lib/facilities.ts): its services and poles, all from the network data. */
export function FacilityView({ id }: { id: string }) {
  const select = useApp((st) => st.select);
  const { main, poles } = facilitySites(id);
  const floors = AP_FLOORS.map((f) => ({ ...f, key: `${f.building}:${f.floor}`, depts: ALL_DEPTS.filter((d) => d.fac === id && d.building === f.building && d.floor === f.floor) })).filter((f) => f.depts.length);
  if (!main) return <div className={`${s.card} rounded-[14px] px-4 py-3 text-[13px] text-[var(--txt-2)]`}>Cet établissement n&apos;est pas dans les données du réseau.</div>;
  return (
    <div className="flex h-full flex-col gap-5">
      <Title eyebrow={<>{main.city} · {main.brand} · réseau Akdital</>} title={main.name} icon={<AkditalMark size={26} />} color="#1DB4EA"
        sub={<>{main.type}{main.beds ? ` · ${fr(main.beds, 0)} lits` : " · lits non publiés"}{main.opening_year ? ` · ouverture ${main.opening_year}` : ""}</>} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] font-medium text-[var(--txt)]"><Dot color={ST_COLOR(main.status)} size={7} />{ST_LABEL(main.status)}</span>
        {main.premium && <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-[var(--txt-2)]">premium</span>}
      </div>
      {floors.length > 0 && (
        <div>
          <SectionTitle>Étages · cliquez sur un service pour y entrer</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {floors.map((f) => (
              <div key={f.key} className={`${s.card} rounded-[12px] px-3 py-2`}>
                <button type="button" onClick={() => select({ kind: "floor", id: f.key })} data-anchor={`floor:${f.key}`} className="text-left text-[11.5px] font-medium uppercase tracking-[0.06em] text-[var(--mut)] hover:text-white">{floorShort(f.building, f.floor)}</button>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {f.depts.map((d) => (
                    <button key={d.id} type="button" onClick={() => select({ kind: "dept", id: d.id })} data-anchor={`dept-row:${d.id}`}
                      className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-[var(--txt)] ring-1 ring-white/[0.08] hover:bg-[#1DB4EA] hover:text-[#04121c]">
                      <DeptIcon k={d.icon} size={13} />{d.short}{d.cases.length ? <span className="num text-[11px] opacity-70">{d.cases.length}</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-[var(--mut)]">Répartition illustrative : les plans de l&apos;établissement ne sont pas publiés.</p>
        </div>
      )}
      {main.specialties.length > 0 && (
        <div>
          <SectionTitle>Services · {main.specialties.length}</SectionTitle>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {main.specialties.map((x) => (
              <div key={x} data-anchor={`facility-service:${id}:${norm(x)}`} className={`${s.card} flex items-start gap-2 rounded-[12px] px-3 py-2`}>
                <Dot color="#1DB4EA" size={7} /><span className="min-w-0 flex-1 text-[12.5px] leading-snug text-[var(--txt)]">{x}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {poles.length > 0 && (
        <div>
          <SectionTitle>Pôles du complexe · {poles.length}</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {poles.map((p) => (
              <div key={p.slug} className={`${s.card} rounded-[14px] px-4 py-3`}>
                <div className="flex items-center gap-2"><Dot color={ST_COLOR(p.status)} size={8} /><span className="text-[13.5px] font-semibold text-white">{p.name}</span>
                  <span className="ml-auto truncate text-[11px] text-[var(--mut)]">{p.type}</span></div>
                <div className="mt-1.5 flex flex-wrap gap-1">{p.specialties.map((x) => <span key={x} className="rounded-full bg-white/[0.04] px-2 py-[3px] text-[11.5px] text-[var(--txt-2)] ring-1 ring-white/[0.06]">{x}</span>)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {main.notes && <p className="text-[12.5px] leading-snug text-[var(--txt-2)]" style={{ display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{main.notes}</p>}
      <div className={`${s.card} rounded-[14px] px-4 py-3 text-[12px] leading-snug text-[var(--mut)]`}>
        Bâtiment modélisé d&apos;après les photos publiées par l&apos;architecte (ATP Architectes) ; plans intérieurs non publiés. La ville 3D n&apos;étant pas géoréférencée, la clinique y est placée par rapport à l&apos;hippodrome d&apos;Anfa, comme dans la réalité. Le programme ne publie pas de chiffre propre à cet établissement.
      </div>
      <button type="button" onClick={() => select({ kind: "site", id })} data-anchor="panel:facility-network"
        className="mt-auto flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-white text-[14px] font-semibold text-[#0B1020] shadow-[0_10px_30px_-10px_rgba(255,255,255,.4)] transition-transform hover:scale-[1.01]">
        <I.globe size={18} /> Voir sur la carte du réseau <I.arrowRight size={16} />
      </button>
      {main.source && <p className="flex items-center gap-1.5 text-[11px] text-[var(--mut)]"><I.link size={12} />Source : {domain(main.source) ?? main.source.slice(0, 80)}</p>}
    </div>
  );
}

const compactList = (n: number) => Math.min(n, 9);
const META_ECO = V23 ? HEAD.gains : DATA.meta.eco;

/* ================================================================ front-desk AI experience ("Expériences IA") */
const listFr = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}`);

export function XpStrip({ deptId }: { deptId: string }) {
  const select = useApp((st) => st.select);
  const list = EXPERIENCES.filter((x) => x.dept === deptId);
  if (!list.length) return null;
  return (
    <div>
      <SectionTitle right={<span className="text-[11.5px] text-[var(--mut)]">face visible des cas, sans chiffre ajouté</span>}>Expériences IA · {list.length}</SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        {list.map((x) => (
          <button key={x.id} type="button" onClick={() => select({ kind: "xp", id: x.id })} data-anchor={`xp-chip:${x.id}`}
            className="flex items-center gap-1.5 rounded-full bg-[rgba(91,124,255,.12)] py-1 pl-1.5 pr-3 text-[12px] font-medium text-[#C9D4FF] ring-1 ring-[rgba(91,124,255,.28)] transition-colors hover:bg-[rgba(91,124,255,.24)] hover:text-white">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[rgba(91,124,255,.25)]"><DeptIcon k={x.icon} size={12} /></span>{x.short}
          </button>
        ))}
      </div>
    </div>
  );
}

export function XpView({ id }: { id: string }) {
  const x = XP[id];
  const year = useApp((st) => st.year);
  const perSite = useApp((st) => st.perSite);
  const openCase = useApp((st) => st.openCase);
  const select = useApp((st) => st.select);
  const tight = useTight();
  if (!x) return <Missing what="Expérience IA" id={id} />;
  const d = DEPT[x.dept];
  const others = EXPERIENCES.filter((y) => y.dept === x.dept && y.id !== x.id);
  const blocks = [
    { k: "Ce que fait l'IA", v: x.what, c: "#AFC0FF", bg: "rgba(91,124,255,.12)", icon: <I.spark size={14} /> },
    { k: "Pour le patient", v: x.patient, c: "#E9B892", bg: "rgba(229,165,122,.10)", icon: <I.person size={14} /> },
    { k: "Pour l'équipe", v: x.staff, c: "#8FD1C7", bg: "rgba(95,179,168,.11)", icon: <DeptIcon k="users" size={14} /> },
  ];
  return (
    <div className={`flex h-full flex-col ${tight ? "gap-3" : "gap-5"}`}>
      <Title eyebrow={<>Expérience IA · {d ? d.short : x.dept}</>} title={x.name} icon={<DeptIcon k={x.icon} size={22} />} color="#7C93FF" />
      <div className="flex flex-col gap-2">
        {blocks.map((b) => (
          <div key={b.k} className="rounded-[16px] px-4 py-3" style={{ background: b.bg, boxShadow: `inset 3px 0 0 ${b.c}` }}>
            <div className="flex items-center gap-1.5" style={{ color: b.c }}>{b.icon}<span className="eyebrow !text-[9.5px] ![color:inherit]">{b.k}</span></div>
            <p className={`mt-1 leading-snug text-white ${tight ? "text-[13.5px]" : "text-[15px]"}`}>{b.v}</p>
          </div>
        ))}
      </div>
      <div>
        <SectionTitle>Cas d&apos;usage liés · {x.cases.length}</SectionTitle>
        <CaseRows ids={x.cases} year={year} perSite={perSite} onOpen={(cid) => openCase(cid)} />
        <p className="mt-2 flex items-start gap-1.5 px-3 text-[12px] leading-snug text-[var(--mut)]"><I.info size={14} className="mt-[1px] shrink-0" />Ses gains sont comptés dans les cas {listFr(x.cases)} du business case : aucun chiffre ajouté.</p>
      </div>
      {others.length > 0 && (
        <div className="mt-auto">
          <SectionTitle>Autres expériences IA · {d?.short}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {others.map((y) => (
              <button key={y.id} type="button" onClick={() => select({ kind: "xp", id: y.id })} data-anchor={`xp-chip:${y.id}`}
                className="flex items-center gap-1.5 rounded-full bg-white/[0.05] py-1 pl-1.5 pr-3 text-[12px] text-[var(--txt-2)] ring-1 ring-white/[0.07] hover:bg-white/[0.1] hover:text-white">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.07]"><DeptIcon k={y.icon} size={12} /></span>{y.short}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Missing({ what, id }: { what: string; id: string }) {
  return <div className="text-[14px] text-[var(--mut)]">{what} introuvable : {id}</div>;
}

/* ---------------------------------------------------------------- breadcrumb */
export function crumbs(kind: string, id: string, caseId: string | null): { label: string; go?: () => void }[] {
  const st = useApp.getState();
  // inside a real facility (Anfa Prime) the root is that facility, not the hôpital type
  const facOf = kind === "dept" || kind === "person" ? DEPT[kind === "dept" ? id : id.split("/")[0]]?.fac : kind === "floor" && id.startsWith("ap.") ? AP_FAC : undefined;
  const hosp = facOf
    ? { label: facilitySites(facOf).main?.name ?? "Établissement", go: () => st.select({ kind: "facility", id: facOf }) }
    : { label: "Hôpital type", go: () => st.home() };
  const floorOf = (d: Dept) => ({ label: d.building === "annex" ? "Siège" : floorShort(d.building, d.floor), go: () => st.select({ kind: "floor", id: d.building === "annex" ? `annex:${d.floor}` : `${d.building}:${d.floor}` }) });
  const deptC = (d: Dept) => ({ label: d.short, go: () => st.select({ kind: "dept", id: d.id }) });
  let out: { label: string; go?: () => void }[] = [];
  if (kind === "dept" && DEPT[id]) out = [hosp, floorOf(DEPT[id]), { label: DEPT[id].short }];
  else if (kind === "case") { const d = DEPT[CASE_DEPT[id]]; out = d ? [hosp, floorOf(d), deptC(d), { label: id }] : [hosp, { label: id }]; }
  else if (kind === "person") { const d = DEPT[id.split("/")[0]]; out = d ? [hosp, floorOf(d), deptC(d), { label: "Personne" }] : [hosp]; }
  else if (kind === "floor") out = [hosp, { label: id.startsWith("annex") ? "Siège" : floorTitle(id) }];
  else if (kind === "xp") { const x = XP[id]; const d = x ? DEPT[x.dept] : undefined; out = d && x ? [hosp, floorOf(d), deptC(d), { label: x.short }] : [hosp, { label: "Expérience IA" }]; }
  else if (kind === "city") out = [{ label: "Maroc", go: () => st.setLevel("morocco") }, { label: CITIES.find((x) => x.slug === id)?.name ?? id }];
  else if (kind === "site") { const x = SITES.find((y) => y.slug === id); out = [{ label: "Maroc", go: () => st.setLevel("morocco") }, ...(x ? [{ label: x.city, go: () => st.select({ kind: "city", id: x.citySlug }) }] : []), { label: x?.name ?? id }]; }
  else if (kind === "country") out = [{ label: "Monde", go: () => st.setLevel("world") }, { label: id === "MA" ? "Maroc" : INTERNATIONAL.find((x) => x.iso === id)?.country ?? id }];
  else if (kind === "facility") { const x = SITES.find((y) => y.slug === id); out = [{ label: x?.city ?? "Casablanca", go: () => st.setLevel("city") }, { label: x?.name ?? id }]; }
  else if (kind === "landmark") out = [{ label: "Casablanca", go: () => st.setLevel("city") }, { label: placeById(id)?.name ?? id }];
  if (caseId && kind !== "case") {
    const d = DEPT[CASE_DEPT[caseId]];
    if (kind === "dept" || kind === "person") { const last = out[out.length - 1]; if (kind === "dept" && d) out[out.length - 1] = { ...last, go: () => st.openCase(null) }; if (kind === "person") out[out.length - 1] = { ...last, go: () => st.openCase(null) }; }
    out.push({ label: caseId });
  }
  return out;
}
void CASES; void MiniBar;

const POS_LABEL = { osm: "position OpenStreetMap", "osm-probable": "OpenStreetMap, identité probable", fiche: "repère de fiche, non vérifié" } as const;
const SCENE_LABEL = {
  modelled: "Modélisé d'après les volumes OpenStreetMap.",
  district: "Dans un quartier reconstitué d'après OpenStreetMap.",
  marker: "Repère seulement : pas encore modélisé en 3D.",
} as const;

/** Card of a place of Casablanca (monument, public place, Akdital establishment): only what the referential documents
 *  (lib/geo/casaReferential.ts) — nothing is added that it does not source. */
export function LandmarkView({ id }: { id: string }) {
  const select = useApp((st) => st.select);
  const p = placeById(id);
  if (!p) return <div className={`${s.card} rounded-[14px] px-4 py-3 text-[13px] text-[var(--txt-2)]`}>Ce lieu n&apos;est pas dans le référentiel de Casablanca.</div>;
  const ak = p.type === "Établissement de santé Akdital";
  const osmUrl = p.osm ? `https://www.openstreetmap.org/${p.osm}` : null;
  const row = (k: string, v: ReactNode) => (
    <div className="flex gap-3 py-1.5 text-[12.5px] leading-snug"><span className="w-[118px] shrink-0 text-[var(--mut)]">{k}</span><span className="min-w-0 flex-1 text-[var(--txt)]">{v}</span></div>
  );
  return (
    <div className="flex h-full flex-col gap-5">
      <Title eyebrow={<>Casablanca · {p.type ?? "lieu"}</>} title={p.name} color={ak ? "#1DB4EA" : "#7C93D6"}
        icon={ak ? <AkditalMark size={26} /> : <I.city size={22} />} />
      <div className="flex flex-wrap gap-2">
        {CASA_REEL && (
          <button type="button" data-anchor={`landmark-fly:${id}`}
            onClick={() => { const q = geoToScene(p.lat, p.lon); rig.flyTo(new THREE.Vector3(q.x, 0, q.z), (p.r ?? 1200) * 0.45, { polar: 0.95, duration: 2.2 }); }}
            className="rounded-full bg-white/[0.08] px-3 py-1.5 text-[12.5px] font-medium text-white ring-1 ring-white/[0.12] hover:bg-white/[0.16]">Voir de plus près</button>
        )}
        {id === "anfa-prime-hospital" && (
          <button type="button" onClick={() => select({ kind: "facility", id })} data-anchor="landmark-facility"
            className="rounded-full bg-[#1DB4EA] px-3 py-1.5 text-[12.5px] font-semibold text-[#04121c] hover:brightness-110">Étages et services</button>
        )}
      </div>
      <div className={`${s.card} rounded-[14px] px-4 py-2`}>
        {row("Type de lieu", p.type ?? "non renseigné")}
        {row("Position", <>{p.lat.toFixed(5)}, {p.lon.toFixed(5)} · {POS_LABEL[p.status]}</>)}
        {row("Maquette 3D", SCENE_LABEL[p.scene])}
        {ak && id !== "anfa-prime-hospital" && row("Étages et services", "non modélisés : aucun plan publié")}
        {p.note && row("Remarque", p.note)}
        {row("Architecte, date", "non renseignés dans le référentiel")}
      </div>
      <div className="text-[11.5px] leading-snug text-[var(--mut)]">
        Position vérifiée le {REFERENTIAL_CHECKED} (Nominatim / OpenStreetMap){osmUrl ? <> · <a href={osmUrl} target="_blank" rel="noreferrer" className="underline hover:text-white">objet {p.osm}</a></> : null}
        {" · "}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-white">© contributeurs OpenStreetMap (ODbL)</a>
      </div>
    </div>
  );
}
