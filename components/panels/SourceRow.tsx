"use client";
// One source of a use case: title, year, type, result; "Voir plus" opens method, scope and the cases that cite it;
// "Ouvrir la source" opens the publication in a new tab. Shared by the dossier and by the Sources page (view "Par cas").
import { useId } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CASE } from "@/lib/model";
import { useApp } from "@/lib/store";
import { Tip } from "@/components/ui/kit";
import { I } from "@/components/ui/icons";
import { FAM_COLOR, LEVEL_COLOR, LEVEL_LABEL } from "@/lib/ui/fmt";
import { DEPT, CASE_DEPT } from "@/lib/hospital";
import s from "@/components/ui/styles";
import { clean, type Src } from "./dossier-data";
import { CaseChip, FOCUS, G, Hl } from "./dz-ui";

const domainOf = (u?: string | null) => { if (!u) return null; try { return new URL(u.trim()).hostname.replace(/^www\./, ""); } catch { return null; } };
const clamp = (n: number) => ({ display: "-webkit-box", WebkitLineClamp: n, WebkitBoxOrient: "vertical" as const, overflow: "hidden" });

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-0.5 py-[7px]">
      <dt className="text-[10.5px] font-medium uppercase leading-[1.7] tracking-[0.08em] text-[var(--mut)]">{label}</dt>
      <dd className="min-w-0 text-[12.5px] leading-snug text-[var(--txt-2)] [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function SourceRow({ src, current, main = false, linked = false, open, onToggle, q, caseTitles = true }: {
  src: Src; current?: string; main?: boolean; linked?: boolean; open: boolean; onToggle: () => void; q?: string; caseTitles?: boolean;
}) {
  const b = src.b;
  const select = useApp((st) => st.select);
  const uid = useId();
  const col = LEVEL_COLOR[src.code] ?? "#8D97B0";
  const meta = [b.who, b.country, b.year].filter(Boolean).join(" · ");
  const reading = clean(b.reading), note = clean(b.note), what = clean(b.what), metric = clean(b.metric);
  const url = b.url;
  const parts = b.source.split(/\s;\s/).map((x) => x.trim()).filter(Boolean);
  const dom = domainOf(url);
  const chips = src.attached;
  return (
    <article data-src={b.id} data-anchor={`source:${b.id}`} className={`${s.card} rounded-[14px] transition-colors ${open ? "!bg-white/[0.05]" : ""}`}>
      <div className="px-3.5 pt-3">
        <div className="flex items-start gap-2.5">
          <Tip content={<><b className="text-[var(--txt)]">{b.level}</b><br />{LEVEL_LABEL[src.code] ?? ""}</>}>
            <span className="num mt-[1px] grid h-[24px] w-[24px] shrink-0 cursor-help place-items-center rounded-[7px] text-[12px] font-bold"
              style={{ background: `color-mix(in srgb, ${col} 18%, transparent)`, color: col, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${col} 35%, transparent)` }}>{src.code}</span>
          </Tip>
          <div className="min-w-0 flex-1">
            <h4 className="text-[13.5px] font-semibold leading-snug text-white [overflow-wrap:anywhere]" style={open ? undefined : clamp(2)}><Hl text={b.source} q={q} /></h4>
            {meta && <p className="mt-0.5 text-[12px] leading-snug text-[var(--mut)] [overflow-wrap:anywhere]" style={open ? undefined : clamp(1)}><Hl text={meta} q={q} /></p>}
            <p className="mt-0.5 text-[11.5px] font-medium leading-snug" style={{ color: col }}>{b.level.replace(/^[A-Z]s·s/, "")}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {src.measured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(76,199,154,.14)] px-2 py-[2px] text-[11px] font-semibold text-[#7FD9B5]"><I.check size={11} strokeWidth={2.4} />Mesuré</span>
            ) : (
              <Tip content={note ?? "Référence publiée, sans résultat mesuré."}>
                <span className="inline-flex cursor-help items-center rounded-full bg-[rgba(226,176,90,.13)] px-2 py-[2px] text-[11px] font-semibold text-[#E9C27F]">Non mesuré</span>
              </Tip>
            )}
            {main && <span className="rounded-full bg-[rgba(91,124,255,.16)] px-2 py-[2px] text-[10.5px] font-semibold text-[#C9D4FF] ring-1 ring-[rgba(91,124,255,.3)]">Preuve principale</span>}
            {linked && <Tip content="Cette référence est liée à ce cas, sans lui être rattachée directement."><span className="cursor-help rounded-full bg-white/[0.06] px-2 py-[2px] text-[10.5px] text-[var(--txt-2)]">Référence liée</span></Tip>}
          </div>
        </div>
        <p className="mt-2 text-[12.5px] leading-snug text-[var(--txt-2)] [overflow-wrap:anywhere]" style={open ? undefined : clamp(2)}><Hl text={b.result} q={q} /></p>
      </div>

      <div className="mt-1.5 flex items-center gap-3 px-3.5 pb-2.5 pt-0.5">
        <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={uid} data-anchor={`source-toggle:${b.id}`}
          className={`-ml-1.5 flex h-7 items-center gap-1 rounded-full px-2 text-[12px] font-medium text-[#AFC0FF] transition-colors hover:bg-white/[0.07] hover:text-white ${FOCUS}`}>
          {open ? "Voir moins" : "Voir plus"}
          <G.down size={13} className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
        </button>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" data-anchor={`source-open:${b.id}`} aria-label={`Ouvrir la source dans un nouvel onglet : ${b.source}`}
            className={`ml-auto flex h-7 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.1] transition-colors hover:bg-white/[0.08] hover:text-white ${FOCUS}`}>
            <span className="shrink-0">Ouvrir la source</span><G.ext size={12} className="shrink-0" />
          </a>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div id={uid} key="details" className="overflow-hidden" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}>
            <dl className="mx-3.5 divide-y divide-white/[0.05] border-t border-white/[0.07] pb-1 pt-1">
              {metric && <Row label="Indicateur">{metric}</Row>}
              <Row label="Portée">{[b.who, b.country].filter(Boolean).join(", ")}{what ? <> · {what}</> : null}{b.year ? <> · {b.year}</> : <span className="text-[var(--mut)]"> · année non renseignée</span>}</Row>
              {note && <Row label="Méthode et réserves">{note}</Row>}
              {reading && <Row label="Lecture Akdital">{reading}</Row>}
              <Row label="Niveau">{b.level}<span className="text-[var(--mut)]"> · {src.measured ? "résultat mesuré" : "pas un résultat mesuré"}</span></Row>
              <Row label={parts.length > 1 ? "Sources" : "Source"}>
                {parts.length > 1 ? <ul className="list-disc pl-4 marker:text-white/25">{parts.map((p) => <li key={p}>{p}</li>)}</ul> : b.source}
                {dom && <span className="block text-[11.5px] text-[var(--mut)]">{dom}</span>}
                {!url && <span className="block text-[11.5px] text-[var(--mut)]">Pas de lien public dans le dossier.</span>}
              </Row>
              <Row label="Référence"><span className="num text-[12px]">{b.id}</span></Row>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-3.5 border-t border-white/[0.06] pb-3 pt-2.5">
        <div className="eyebrow !text-[9.5px]">Rattaché aux cas{chips.length > 1 ? ` · ${chips.length}` : ""}</div>
        {open && caseTitles ? (
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {chips.map((id) => {
              const c = CASE[id]; if (!c) return null;
              const isCur = id === current;
              return (
                <li key={id}>
                  <button type="button" disabled={isCur} onClick={() => select({ kind: "case", id })} aria-label={isCur ? `${id}, ce cas` : `Ouvrir le cas ${id} : ${c.titre}`}
                    className={`group flex w-full items-center gap-2.5 rounded-[9px] px-1.5 py-1 text-left transition-colors ${isCur ? "cursor-default" : "hover:bg-white/[0.07]"} ${FOCUS}`}>
                    <span className="num w-[40px] shrink-0 text-[12px] font-bold" style={{ color: FAM_COLOR[c.fam || id[0]] }}>{id}</span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--txt)] group-hover:text-white">{c.titre}</span>
                    <span className="shrink-0 text-[11px] text-[var(--mut)]">{isCur ? "ce cas" : DEPT[CASE_DEPT[id]]?.short}</span>
                    {!isCur && <I.chevron size={12} className="shrink-0 text-[var(--mut)] opacity-0 transition-opacity group-hover:opacity-100" />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chips.slice(0, 6).map((id) => <CaseChip key={id} id={id} current={id === current} />)}
            {chips.length > 6 && <button type="button" onClick={onToggle} className={`rounded-md px-1 text-[11.5px] text-[var(--mut)] hover:text-white ${FOCUS}`}>+ {chips.length - 6}</button>}
            {!chips.length && <span className="text-[12px] text-[var(--mut)]">Aucun cas du programme ne cite cette référence.</span>}
          </div>
        )}
      </div>
    </article>
  );
}
