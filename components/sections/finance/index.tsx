"use client";
// Finances (v2.3 only): the full financial picture of the programme from the business case v2.3
// (workbook 04 + PDF 05). Six tabs and a drill-down per business case; every figure from FIN or CASE[id].v23.
import { useEffect, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { V23, FIN } from "@/lib/model";
import s from "@/components/ui/styles";
import { useFin, TABS, type FinTab } from "./state";
import { FOCUS } from "./ui";
import { Overview } from "./Overview";
import { Projections } from "./Projections";
import { Blocks } from "./Blocks";
import { Cases } from "./Cases";
import { CaseDetail } from "./CaseDetail";
import { Hypotheses } from "./Hypotheses";
import { Arbitrage } from "./Arbitrage";

function TabBar() {
  const tab = useFin((st) => st.tab);
  const caseId = useFin((st) => st.caseId);
  const setTab = useFin((st) => st.setTab);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const j = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    setTab(TABS[j].id);
    refs.current[j]?.focus();
  };
  return (
    <div role="tablist" aria-label="Vues financières" onKeyDown={onKey}
      className="relative flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-white/[0.05] p-[3px] ring-1 ring-white/[0.08]">
      {TABS.map((t, i) => {
        const on = t.id === tab;
        return (
          <button key={t.id} ref={(el) => { refs.current[i] = el; }} type="button" role="tab" aria-selected={on} tabIndex={on ? 0 : -1}
            onClick={() => setTab(t.id as FinTab)} data-anchor={`finance:tab:${t.id}`}
            className={`relative z-0 flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition-colors ${FOCUS} ${on ? "text-white" : "text-[var(--mut)] hover:text-[var(--txt)]"}`}>
            {on && (
              <motion.span layoutId="fin-tab" className="absolute inset-0 -z-10 rounded-full"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.1))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 4px 14px -6px rgba(0,0,0,.6)" }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }} />
            )}
            <span className="max-[1440px]:hidden">{t.label}</span><span className="hidden max-[1440px]:inline">{t.short}</span>
            {t.id === "cas" && caseId && <span className="num ml-1.5 rounded-full bg-white/[0.14] px-1.5 text-[11px] text-white">{caseId}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Finances() {
  const tab = useFin((st) => st.tab);
  const caseId = useFin((st) => st.caseId);
  const scroller = useRef<HTMLDivElement | null>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [tab, caseId]);
  if (!V23) return <p className="pt-6 text-[14px] text-[var(--mut)]">La vue Finances existe dans les chiffres actualisés (v2.3).</p>;
  const view = caseId ? <CaseDetail id={caseId} />
    : tab === "overview" ? <Overview /> : tab === "projections" ? <Projections /> : tab === "blocs" ? <Blocks />
    : tab === "cas" ? <Cases /> : tab === "hypotheses" ? <Hypotheses /> : <Arbitrage />;
  return (
    <div className="flex h-full min-h-0 flex-col" data-anchor="finance">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <TabBar />
        <span className="flex-1" />
        <span className="whitespace-nowrap text-[11.5px] text-[var(--mut)]">Scénario {FIN.meta.scenario.toLowerCase()} · MDH courants · business case {FIN.meta.version}</span>
      </div>
      <div ref={scroller} className={`${s.thinScroll} -mr-3 min-h-0 flex-1 overflow-y-auto pr-3`}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={caseId ?? tab} role="tabpanel" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
            {view}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
export { openFinanceCase } from "./state";
