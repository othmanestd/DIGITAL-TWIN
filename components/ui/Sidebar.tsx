"use client";
// Left glass rail (explorer only): level switch, departments grouped by floor (building order, top floor first), floor shortcuts.
// The rail always ends 88 px above the bottom (AI dock). Button size is computed from the available height;
// when even the smallest size does not fit, the rail switches to a compact list of floors, each opening a flyout of its departments.
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp, type Level } from "@/lib/store";
import { agg, fr } from "@/lib/model";
import { DEPTS, CASE_DEPT, KIND_COLOR, EXPERIENCES, type Dept } from "@/lib/hospital";
import { DeptIcon, I } from "./icons";
import { Tip } from "./kit";
import { money, floorShort } from "@/lib/ui/fmt";
import { useViewport } from "@/lib/ui/hooks";
import s from "./styles";

const TOP = 76, BOTTOM_FREE = 88;

const LEVELS: { id: Level; label: string; icon: (p: { size?: number }) => React.ReactNode }[] = [
  { id: "world", label: "Monde", icon: (p) => <I.globe {...p} /> },
  { id: "morocco", label: "Maroc", icon: (p) => <I.pin {...p} /> },
  { id: "hospital", label: "Hôpital", icon: (p) => <I.hospital {...p} /> },
];

type Group = { key: string; floorId: string; caption: string; label: string; depts: Dept[] };
const GROUPS: Group[] = [
  ...[4, 3, 2, 1, 0, -1].filter((f) => DEPTS.some((d) => d.building === "main" && d.floor === f)).map((f) => ({
    key: `main:${f}`, floorId: `main:${f}`, caption: f === -1 ? "SS" : f === 0 ? "RDC" : `${f}${f === 1 ? "er" : "e"}`,
    label: f === -1 ? "Sous-sol" : f === 0 ? "Rez-de-chaussée" : `${f}${f === 1 ? "er" : "e"} étage`,
    depts: DEPTS.filter((d) => d.building === "main" && d.floor === f),
  })),
  { key: "annex", floorId: "annex:0", caption: "Siège", label: "Siège", depts: DEPTS.filter((d) => d.building === "annex").sort((a, b) => b.floor - a.floor) },
];
const ROWS = GROUPS.reduce((a, g) => a + Math.ceil(g.depts.length / 2), 0);

const FLOOR_BTNS: { label: string; id: string; title: string }[] = [
  { label: "Sous-sol", id: "main:-1", title: "Sous-sol · logistique, hôtellerie, pharmacie" },
  { label: "RDC", id: "main:0", title: "Rez-de-chaussée · accueil, admissions, urgences" },
  { label: "1er", id: "main:1", title: "1er étage · consultations, prises en charge, facturation" },
  { label: "2e", id: "main:2", title: "2e étage · bloc, réanimation, maternité" },
  { label: "3e", id: "main:3", title: "3e étage · hospitalisation, cadres de santé" },
  { label: "4e", id: "main:4", title: "4e étage · qualité, relations patients, gestion technique" },
  { label: "Siège", id: "annex:0", title: "Siège (annexe) · services généraux, finance, RH, pilotage" },
];

/** Height of the full rail for a button size b (matches the markup below). */
function railHeight(b: number, withFloors: boolean, withLabels: boolean) {
  const pad = 16, gap = 4;
  const levels = withLabels ? 3 * (b - 4) + 2 * 2 + 6 : b + 6;
  const groups = ROWS * b + (ROWS - GROUPS.length) * gap + (GROUPS.length - 1) * (Math.round(b * 0.22) * 2 + 1);
  const fr = Math.ceil(FLOOR_BTNS.length / 2);
  const floors = withFloors ? Math.round(b * 0.35) + 9 + 18 + fr * (b - 8) + (fr - 1) * gap : 0;
  return pad + levels + 8 + groups + floors + 6;
}

function useRailLayout() {
  const { h } = useViewport();
  const avail = h - TOP - BOTTOM_FREE;
  for (const [withFloors, withLabels] of [[true, true], [true, false], [false, false]] as const) {
    for (let b = 36; b >= (withFloors ? 28 : 26); b--) if (railHeight(b, withFloors, withLabels) <= avail) return { mode: "full" as const, b, withFloors, withLabels, avail };
  }
  return { mode: "compact" as const, b: 32, withFloors: false, withLabels: false, avail };
}

function useNav() {
  const sel = useApp((st) => st.sel);
  const caseId = useApp((st) => st.caseId);
  const activeDept = sel?.kind === "xp" ? EXPERIENCES.find((x) => x.id === sel.id)?.dept ?? null : sel?.kind === "dept" ? sel.id : sel?.kind === "person" ? sel.id.split("/")[0] : sel?.kind === "case" ? CASE_DEPT[sel.id] : caseId ? CASE_DEPT[caseId] : null;
  const activeFloor = sel?.kind === "floor" ? sel.id : null;
  return { activeDept, activeFloor };
}

function DeptTip({ d }: { d: Dept }) {
  const year = useApp((st) => st.year);
  const perSite = useApp((st) => st.perSite);
  const m = money(agg(d.cases, year, perSite).mdh);
  const nXp = EXPERIENCES.filter((x) => x.dept === d.id).length;
  return (
    <div>
      <div className="text-[13px] font-semibold text-[var(--txt)]">{d.name}</div>
      <div className="mt-0.5 text-[11.5px] text-[var(--mut)]">{d.building === "annex" ? "Siège" : floorShort(d.building, d.floor)}</div>
      <div className="mt-1.5 text-[12.5px]">
        {d.cases.length ? (
          <><span className="num text-[15px] text-[var(--green)]">{fr(m.v, m.d)}</span> <span className="font-semibold">{m.unit}</span> <span className="text-[var(--mut)]">({m.unit === "MDH" ? "millions" : "milliers"} de dirhams) économisés {year === 2029 ? "au plein régime" : year === 2026 ? "aujourd'hui" : `en ${year}`}{perSite ? ", hôpital type" : ""}</span></>
        ) : <span className="text-[var(--mut)]">Soin humain : pas de cas d&apos;usage propre</span>}
      </div>
      {nXp > 0 && <div className="mt-1 text-[11.5px] text-[#AFC0FF]">{nXp} expérience{nXp > 1 ? "s" : ""} IA pour les patients</div>}
    </div>
  );
}

function DeptButton({ d, on, size }: { d: Dept; on: boolean; size: number }) {
  const select = useApp((st) => st.select);
  return (
    <Tip content={<DeptTip d={d} />} side="right" className="block">
      <button type="button" onClick={() => select({ kind: "dept", id: d.id })} data-anchor={`nav:dept:${d.id}`} aria-label={d.name}
        className={`relative grid place-items-center rounded-[10px] transition-all duration-200 ${on
          ? "bg-[rgba(91,124,255,.32)] text-white ring-1 ring-[rgba(140,165,255,.75)] shadow-[0_0_0_3px_rgba(91,124,255,.18)]"
          : d.cases.length ? "bg-white/[0.05] text-[var(--txt-2)] ring-1 ring-white/[0.07] hover:bg-white/[0.12] hover:text-white" : "bg-transparent text-[var(--mut)] ring-1 ring-white/[0.05] hover:bg-white/[0.08] hover:text-[var(--txt-2)]"}`}
        style={{ width: size, height: size }}>
        <DeptIcon k={d.icon} size={Math.round(size * 0.5)} />
        <span className="absolute bottom-[3px] right-[3px] h-[4px] w-[4px] rounded-full" style={{ background: KIND_COLOR[d.kind], opacity: on ? 1 : 0.75 }} />
      </button>
    </Tip>
  );
}

function LevelSwitch({ b, labels }: { b: number; labels: boolean }) {
  const level = useApp((st) => st.level);
  const setLevel = useApp((st) => st.setLevel);
  return (
    <div className={`relative flex ${labels ? "flex-col" : "flex-row justify-between"} gap-0.5 rounded-[14px] bg-black/20 p-[3px] ring-1 ring-white/[0.06]`}>
      {LEVELS.map((l) => {
        const on = level === l.id;
        return (
          <Tip key={l.id} content={labels ? null : l.label} side="right" className={labels ? "block" : "block flex-1"}>
            <button type="button" onClick={() => setLevel(l.id)} data-anchor={`nav:level:${l.id}`} aria-label={l.label}
              className={`relative z-0 flex w-full items-center gap-2 rounded-[11px] text-[12.5px] font-medium transition-colors ${labels ? "px-2.5" : "justify-center"} ${on ? "text-white" : "text-[var(--mut)] hover:text-[var(--txt)]"}`}
              style={{ height: labels ? b - 4 : b }}>
              {on && <motion.span layoutId="atlas-level-thumb" className="absolute inset-0 -z-10 rounded-[11px]" transition={{ type: "spring", stiffness: 420, damping: 36 }}
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.09))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }} />}
              {l.icon({ size: 16 })}
              {labels && l.label}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}

export default function Sidebar() {
  const L = useRailLayout();
  return L.mode === "full" ? <FullRail b={L.b} withFloors={L.withFloors} withLabels={L.withLabels} /> : <CompactRail avail={L.avail} />;
}

function FullRail({ b, withFloors, withLabels }: { b: number; withFloors: boolean; withLabels: boolean }) {
  const select = useApp((st) => st.select);
  const { activeDept, activeFloor } = useNav();
  const sep = Math.round(b * 0.22);
  return (
    <aside className={`${s.rail} fixed left-4 z-20 flex flex-col overflow-hidden rounded-[22px] p-2`}
      style={{ top: TOP, width: 2 * b + 4 + 22 + 16, maxHeight: `calc(100dvh - ${TOP + BOTTOM_FREE}px)` }} aria-label="Navigation de l'hôpital">
      <LevelSwitch b={b} labels={withLabels} />
      <div className="mt-2 flex flex-col">
        {GROUPS.map((g, gi) => {
          const floorOn = activeFloor === g.floorId || (g.key === "annex" && !!activeFloor?.startsWith("annex"));
          return (
            <div key={g.key} className="grid grid-cols-[18px_1fr] items-stretch gap-x-1" style={gi ? { marginTop: sep, paddingTop: sep, borderTop: "1px solid rgba(255,255,255,.07)" } : undefined}>
              <Tip content={<>Voir l&apos;étage : <b className="text-[var(--txt)]">{g.label}</b></>} side="right" className="block">
                <button type="button" onClick={() => select({ kind: "floor", id: g.floorId })} data-anchor={withFloors ? undefined : `nav:floor:${g.floorId}`} aria-label={g.label}
                  className={`flex h-full w-full items-center justify-center rounded-[6px] transition-colors ${floorOn ? "bg-[rgba(91,124,255,.28)] text-white" : "text-[var(--txt-2)]/70 hover:bg-white/[0.07] hover:text-white"}`}>
                  <span className="eyebrow rotate-180 !text-[9px] !font-semibold !tracking-[0.08em] ![color:inherit] [writing-mode:vertical-rl]">{g.caption}</span>
                </button>
              </Tip>
              <div className="grid grid-cols-2 gap-1">
                {g.depts.map((d) => <DeptButton key={d.id} d={d} on={activeDept === d.id} size={b} />)}
              </div>
            </div>
          );
        })}
      </div>
      {withFloors && (
        <div className="border-t border-white/[0.08] pt-2" style={{ marginTop: Math.round(b * 0.35) }}>
          <div className="eyebrow mb-1.5 px-0.5 !text-[9px]">Étages</div>
          <div className="grid grid-cols-2 gap-1">
            {FLOOR_BTNS.map((f) => {
              const on = activeFloor === f.id || (f.id === "annex:0" && !!activeFloor?.startsWith("annex"));
              return (
                <button key={f.id} type="button" title={f.title} onClick={() => select({ kind: "floor", id: f.id })} data-anchor={`nav:floor:${f.id}`}
                  className={`min-w-0 truncate rounded-[8px] text-[10.5px] font-semibold tracking-[-0.01em] transition-colors ${on ? "bg-[rgba(91,124,255,.32)] text-white ring-1 ring-[rgba(140,165,255,.7)]" : "bg-white/[0.05] text-[var(--txt-2)] ring-1 ring-white/[0.06] hover:bg-white/[0.1]"}`}
                  style={{ height: b - 8 }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

function CompactRail({ avail }: { avail: number }) {
  const select = useApp((st) => st.select);
  const { activeDept, activeFloor } = useNav();
  const [open, setOpenRaw] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setOpen = (k: string | null) => {
    if (timer.current) clearTimeout(timer.current);
    if (k) setOpenRaw(k); else timer.current = setTimeout(() => setOpenRaw(null), 240);
  };
  const rowH = Math.max(26, Math.min(38, Math.floor((avail - 16 - 40 - 24) / GROUPS.length) - 4));
  const g = GROUPS.find((x) => x.key === open);
  return (
    <>
      <aside className={`${s.rail} fixed left-4 z-20 flex w-[108px] flex-col overflow-hidden rounded-[20px] p-2`}
        style={{ top: TOP, maxHeight: `calc(100dvh - ${TOP + BOTTOM_FREE}px)` }} aria-label="Navigation de l'hôpital" onMouseLeave={() => setOpen(null)}>
        <LevelSwitch b={32} labels={false} />
        <div className="eyebrow mb-1 mt-2 px-1 !text-[9px]">Étages</div>
        <div className="flex flex-col gap-1">
          {GROUPS.map((gr) => {
            const hasActive = gr.depts.some((d) => d.id === activeDept);
            const on = activeFloor === gr.floorId || (gr.key === "annex" && !!activeFloor?.startsWith("annex")) || hasActive;
            return (
              <button key={gr.key} type="button" data-anchor={`nav:floor:${gr.floorId}`}
                onMouseEnter={() => setOpen(gr.key)} onClick={() => { select({ kind: "floor", id: gr.floorId }); setOpen(gr.key); }}
                className={`flex items-center justify-between rounded-[10px] px-2.5 text-[12px] font-semibold transition-colors ${on ? "bg-[rgba(91,124,255,.3)] text-white ring-1 ring-[rgba(140,165,255,.6)]" : open === gr.key ? "bg-white/[0.12] text-white" : "bg-white/[0.04] text-[var(--txt-2)] hover:bg-white/[0.1]"}`}
                style={{ height: rowH }}>
                <span className="truncate">{gr.caption === "SS" ? "Sous-sol" : gr.caption}</span>
                <span className="num text-[10.5px] text-[var(--mut)]">{gr.depts.length}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <AnimatePresence>
        {g && (
          <motion.div key={g.key} className={`${s.menu} fixed z-[21] overflow-hidden rounded-[16px] p-2`}
            style={{ left: 16 + 108 + 8, top: TOP, maxHeight: `calc(100dvh - ${TOP + BOTTOM_FREE}px)` }}
            initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16 }}
            onMouseEnter={() => setOpen(g.key)} onMouseLeave={() => setOpen(null)}>
            <div className="eyebrow px-2 pb-1.5 pt-1 !text-[9.5px]">{g.label}</div>
            <div className="flex flex-col gap-0.5">
              {g.depts.map((d) => (
                <button key={d.id} type="button" onClick={() => { select({ kind: "dept", id: d.id }); setOpenRaw(null); }} data-anchor={`nav:dept:${d.id}`}
                  className={`flex w-[230px] items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left text-[12.5px] transition-colors ${activeDept === d.id ? "bg-[rgba(91,124,255,.28)] text-white" : "text-[var(--txt-2)] hover:bg-white/[0.08] hover:text-white"}`}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-white/[0.06]" style={{ color: KIND_COLOR[d.kind] }}><DeptIcon k={d.icon} size={15} /></span>
                  <span className="min-w-0 flex-1 truncate">{d.short}</span>
                  {d.cases.length > 0 && <span className="num text-[11px] text-[var(--mut)]">{d.cases.length} cas</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
