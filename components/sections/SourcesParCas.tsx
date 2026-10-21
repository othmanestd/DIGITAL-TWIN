"use client";
// Sources page, view "Par cas": every source of the programme grouped by use-case id.
// Searchable, filterable by family, department and kind of evidence; each source opens ("Voir plus") with method, scope and the
// cases that cite it; its "Rattaché aux cas" chips open those cases in the digital twin. Scrolls inside; the page frame never does.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { CASES, CASE, DATA, FAM, fr } from "@/lib/model";
import { DEPTS, DEPT, CASE_DEPT } from "@/lib/hospital";
import { I } from "@/components/ui/icons";
import { Segmented, Tip } from "@/components/ui/kit";
import { FAM_COLOR, FAM_SHORT, LEVEL_COLOR, LEVEL_LABEL, floorShort, norm } from "@/lib/ui/fmt";
import s from "@/components/ui/styles";
import { SRC, ORPHAN_SOURCES, sourcesOfCase, sourcesIntent, type Src } from "@/components/panels/dossier-data";
import { SourceRow } from "@/components/panels/SourceRow";
import { FOCUS, G, Hl } from "@/components/panels/dz-ui";

type Ev = "all" | "measured" | "unmeasured";
const LEVELS = ["A", "B", "C", "R"] as const;
// filters survive a switch of tab (module memory, wiped on reload)
const saved: { q: string; fam: string; dept: string; ev: Ev; lv: string[] } = { q: "", fam: "all", dept: "all", ev: "all", lv: [] };

/** Every case with its sources (attached first, then linked); computed once. */
const GROUPS = CASES.map((c) => {
  const { own, linked, main } = sourcesOfCase(c.id);
  const dept = DEPT[CASE_DEPT[c.id]];
  return { c, own, linked, main, dept, text: norm(`${c.id} ${c.titre} ${c.famille} ${c.domaine} ${dept?.name ?? ""}`) };
});
const MEASURED_TOTAL = SRC.filter((x) => x.measured).length;
const CASES_WITH_SOURCE = GROUPS.filter((g) => g.own.length || g.linked.length).length;

export function SourcesParCas() {
  const select = useApp((st) => st.select);
  const [q, setQ] = useState(() => { const id = sourcesIntent.caseId; sourcesIntent.caseId = null; if (id) { saved.q = id; saved.fam = "all"; saved.dept = "all"; saved.ev = "all"; saved.lv = []; } return saved.q; });
  const [fam, setFam] = useState(saved.fam);
  const [dept, setDept] = useState(saved.dept);
  const [ev, setEv] = useState<Ev>(saved.ev);
  const [lv, setLv] = useState<Set<string>>(() => new Set(saved.lv));
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const dq = useDeferredValue(q);
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => { saved.q = q; saved.fam = fam; saved.dept = dept; saved.ev = ev; saved.lv = [...lv]; }, [q, fam, dept, ev, lv]);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [dq, fam, dept, ev, lv]);

  const tokens = useMemo(() => norm(dq).split(/\s+/).filter(Boolean), [dq]);
  const pass = (x: Src, text: string) => {
    if (ev === "measured" && !x.measured) return false;
    if (ev === "unmeasured" && x.measured) return false;
    if (lv.size && !lv.has(x.code)) return false;
    return tokens.every((t) => text.includes(t) || x.hay.includes(t));
  };
  const groups = useMemo(() => GROUPS.map((g) => {
    if (fam !== "all" && (g.c.fam || g.c.id[0]) !== fam) return null;
    if (dept !== "all" && g.dept?.id !== dept) return null;
    const own = g.own.filter((x) => pass(x, g.text)), linked = g.linked.filter((x) => pass(x, g.text));
    return own.length || linked.length ? { ...g, own, linked } : null;
  }).filter((g): g is NonNullable<typeof g> => !!g),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [fam, dept, ev, lv, tokens]);
  const orphans = useMemo(() => (fam === "all" && dept === "all" ? ORPHAN_SOURCES.filter((x) => pass(x, "")) : []),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [fam, dept, ev, lv, tokens]);
  const nRows = new Set([...groups.flatMap((g) => [...g.own, ...g.linked].map((x) => x.b.id)), ...orphans.map((x) => x.b.id)]).size;
  const filtered = !!(tokens.length || fam !== "all" || dept !== "all" || ev !== "all" || lv.size);
  const reset = () => { setQ(""); setFam("all"); setDept("all"); setEv("all"); setLv(new Set()); };
  const toggle = (k: string) => setOpen((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleLv = (k: string) => setLv((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const chip = (on: boolean) => `h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors ${FOCUS} ${on ? "bg-white/[0.16] text-white ring-1 ring-white/25" : "bg-white/[0.04] text-[var(--mut)] ring-1 ring-white/[0.06] hover:text-[var(--txt)]"}`;
  const deptsWithCases = DEPTS.filter((d) => d.cases.length);
  const floors = [...new Set(deptsWithCases.map((d) => (d.building === "annex" ? "Siège" : floorShort(d.building, d.floor))))];

  return (
    <div className="flex h-full min-h-0 flex-col gap-[clamp(8px,1.1vh,12px)]" data-anchor="sources:par-cas">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="dz-focus-in relative flex h-9 min-w-[260px] flex-1 items-center rounded-full bg-white/[0.05] ring-1 ring-white/[0.1] transition-colors focus-within:bg-white/[0.08] max-w-[480px]">
          <span className="sr-only">Rechercher une source ou un cas</span>
          <I.search size={16} className="pointer-events-none absolute left-3.5 text-[var(--mut)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && q) { e.preventDefault(); setQ(""); } }}
            placeholder="Chercher un cas, un éditeur, une revue, un résultat…" data-anchor="sources:search" autoComplete="off" spellCheck={false}
            className="h-full w-full min-w-0 bg-transparent pl-10 pr-9 text-[13px] text-[var(--txt)] outline-none placeholder:text-[var(--mut)]" />
          {q && (
            <button type="button" onClick={() => setQ("")} aria-label="Effacer la recherche" className={`absolute right-1.5 grid h-6 w-6 place-items-center rounded-full text-[var(--mut)] hover:bg-white/[0.1] hover:text-white ${FOCUS}`}><I.close size={13} /></button>
          )}
        </label>
        <label className="relative flex h-9 items-center">
          <span className="sr-only">Filtrer par service</span>
          <select value={dept} onChange={(e) => setDept(e.target.value)} data-anchor="sources:dept"
            className={`dz-select h-9 max-w-[230px] rounded-full bg-white/[0.05] pl-3.5 pr-8 text-[12.5px] text-[var(--txt)] ring-1 ring-white/[0.1] transition-colors hover:bg-white/[0.08] ${FOCUS}`}>
            <option value="all">Tous les services</option>
            {floors.map((f) => (
              <optgroup key={f} label={f}>
                {deptsWithCases.filter((d) => (d.building === "annex" ? "Siège" : floorShort(d.building, d.floor)) === f).map((d) => <option key={d.id} value={d.id}>{d.name} ({d.cases.length})</option>)}
              </optgroup>
            ))}
          </select>
          <G.down size={14} className="pointer-events-none absolute right-3 text-[var(--mut)]" />
        </label>
        <Segmented<Ev> size="sm" layoutId="par-cas-ev" value={ev} onChange={setEv} anchorPrefix="sources:ev:"
          options={[{ id: "all", label: "Tous" }, { id: "measured", label: "Mesurés" }, { id: "unmeasured", label: "Non mesurés" }]} />
        <div className="flex items-center gap-1" role="group" aria-label="Niveau de preuve">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--mut)]">Niveau</span>
          {LEVELS.map((k) => (
            <Tip key={k} content={`${k} · ${LEVEL_LABEL[k]}`}>
              <button type="button" aria-pressed={lv.has(k)} onClick={() => toggleLv(k)} data-anchor={`sources:level:${k}`}
                className={`num grid h-7 w-7 place-items-center rounded-[8px] text-[12px] font-bold transition-colors ${FOCUS} ${lv.has(k) ? "ring-1" : "opacity-60 ring-1 ring-white/[0.08] hover:opacity-100"}`}
                style={{ background: `color-mix(in srgb, ${LEVEL_COLOR[k]} ${lv.has(k) ? 28 : 12}%, transparent)`, color: LEVEL_COLOR[k], ...(lv.has(k) ? { boxShadow: `inset 0 0 0 1px ${LEVEL_COLOR[k]}` } : {}) }}>{k}</button>
            </Tip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 text-[12px] text-[var(--mut)]">
          <span><b className="num text-[13px] text-white">{nRows}</b> source{nRows > 1 ? "s" : ""} · <b className="num text-[13px] text-white">{groups.length}</b> cas</span>
          {filtered && <button type="button" onClick={reset} className={`rounded-full px-2.5 py-1 text-[12px] font-medium text-[#AFC0FF] hover:bg-white/[0.07] hover:text-white ${FOCUS}`}>Tout effacer</button>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" className={chip(fam === "all")} onClick={() => setFam("all")}>Toutes familles</button>
        {DATA.fams.map((f) => (
          <Tip key={f.code} content={f.name}>
            <button type="button" className={chip(fam === f.code)} aria-pressed={fam === f.code} onClick={() => setFam(fam === f.code ? "all" : f.code)} data-anchor={`sources:fam:${f.code}`}>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: FAM_COLOR[f.code] }} />{FAM_SHORT[f.code] ?? f.code}
            </button>
          </Tip>
        ))}
      </div>

      <div ref={scroller} className="dz-scroll dz-edge-y -mr-2 min-h-0 flex-1 pr-1" tabIndex={0} role="region" aria-label="Sources par cas d'usage" data-anchor="sources:list">
        {groups.length === 0 && orphans.length === 0 ? (
          <div className={`${s.card} mx-auto mt-6 flex max-w-[460px] flex-col items-center gap-3 rounded-[18px] px-6 py-8 text-center`}>
            <I.search size={22} className="text-[var(--mut)]" />
            <p className="text-[14px] font-semibold text-white">Aucune source ne correspond.</p>
            <p className="text-[12.5px] leading-snug text-[var(--mut)]">Essayez un autre mot, ou retirez un filtre. Les {SRC.length} références du dossier sont rattachées à {CASES_WITH_SOURCE} cas.</p>
            <button type="button" onClick={reset} className={`h-8 rounded-full bg-white/[0.08] px-4 text-[12.5px] font-medium text-white ring-1 ring-white/[0.12] hover:bg-white/[0.14] ${FOCUS}`}>Tout effacer</button>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,500px),1fr))] items-start gap-x-[clamp(14px,1.4vw,26px)] gap-y-[clamp(18px,2.2vh,28px)] pb-8 pl-0.5 pr-2 pt-4">
            {groups.map((g) => {
              const n = g.own.length, nm = g.own.filter((x) => x.measured).length;
              const fam1 = g.c.fam || g.c.id[0];
              return (
                <section key={g.c.id} aria-labelledby={`pc-${g.c.id}`} data-anchor={`sources:case:${g.c.id}`} className="min-w-0">
                  <header className="mb-2 flex items-start gap-3 px-0.5">
                    <span className="num pt-[1px] text-[15px] font-bold" style={{ color: FAM_COLOR[fam1] }}><Hl text={g.c.id} q={dq} /></span>
                    <div className="min-w-0 flex-1">
                      <h3 id={`pc-${g.c.id}`} className="text-[13.5px] font-semibold leading-snug text-white" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}><Hl text={g.c.titre} q={dq} /></h3>
                      <p className="mt-0.5 text-[11.5px] text-[var(--mut)]">{g.c.famille}{g.dept ? ` · ${g.dept.short}` : ""} · {n} source{n > 1 ? "s" : ""}{n > 0 ? ` dont ${nm} mesurée${nm > 1 ? "s" : ""}` : ""}{g.linked.length ? ` · ${g.linked.length} liée${g.linked.length > 1 ? "s" : ""}` : ""}</p>
                    </div>
                    <button type="button" onClick={() => select({ kind: "case", id: g.c.id })} data-anchor={`sources:open-case:${g.c.id}`} aria-label={`Ouvrir le cas ${g.c.id} dans le jumeau numérique`}
                      className={`flex h-7 shrink-0 items-center gap-1 rounded-full bg-white/[0.06] pl-2.5 pr-2 text-[12px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.09] transition-colors hover:bg-white/[0.13] hover:text-white ${FOCUS}`}>
                      Ouvrir le cas <I.chevron size={13} />
                    </button>
                  </header>
                  <div className="flex flex-col gap-2">
                    {g.own.map((x) => { const k = `${g.c.id}|${x.b.id}`; return <SourceRow key={k} src={x} current={g.c.id} main={g.main === x} q={dq} open={open.has(k)} onToggle={() => toggle(k)} />; })}
                    {g.linked.map((x) => { const k = `${g.c.id}|${x.b.id}`; return <SourceRow key={k} src={x} current={g.c.id} linked q={dq} open={open.has(k)} onToggle={() => toggle(k)} />; })}
                  </div>
                </section>
              );
            })}
            {orphans.length > 0 && (
              <section aria-labelledby="pc-orphans" data-anchor="sources:orphans" className="min-w-0">
                <header className="mb-2 px-0.5">
                  <h3 id="pc-orphans" className="text-[13.5px] font-semibold leading-snug text-white">Sans cas rattaché</h3>
                  <p className="mt-0.5 text-[11.5px] text-[var(--mut)]">{orphans.length} référence{orphans.length > 1 ? "s" : ""} du dossier qu&apos;aucun cas ne cite pour l&apos;instant.</p>
                </header>
                <div className="flex flex-col gap-2">
                  {orphans.map((x) => { const k = `orphan|${x.b.id}`; return <SourceRow key={k} src={x} q={dq} open={open.has(k)} onToggle={() => toggle(k)} />; })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{nRows} sources dans {groups.length} cas</p>
    </div>
  );
}

export const PAR_CAS_SUMMARY = `${SRC.length} références, dont ${MEASURED_TOTAL} résultats mesurés, rattachées à ${CASES_WITH_SOURCE} cas`;
void FAM; void CASE; void fr;
