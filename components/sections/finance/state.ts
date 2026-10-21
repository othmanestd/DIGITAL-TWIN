"use client";
// Finance view · navigation state, kept for the session (tab, open case, list filters, unit).
// The case dossier opens a case here with:  window.dispatchEvent(new CustomEvent("atlas:finance-case", { detail: { id } }))
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useApp } from "@/lib/store";
import { CASE, V23 } from "@/lib/model";

export type FinTab = "overview" | "projections" | "blocs" | "cas" | "hypotheses" | "arbitrages";
export const TABS: { id: FinTab; label: string; short: string }[] = [
  { id: "overview", label: "Vue d'ensemble", short: "Vue d'ensemble" },
  { id: "projections", label: "Projections 2027-2031", short: "Projections" },
  { id: "blocs", label: "Par brique et famille", short: "Briques et familles" },
  { id: "cas", label: "Cas par cas", short: "Cas par cas" },
  { id: "hypotheses", label: "Hypothèses et méthode", short: "Hypothèses" },
  { id: "arbitrages", label: "Arbitrages et leviers", short: "Arbitrages" },
];
export type Unit = "mdh" | "ca" | "ms";
export type SortKey = "id" | "eco" | "marge" | "cout" | "net" | "cumul" | "van" | "ratio";
export type Filter = { kind: "brique" | "famille"; key: string; label: string } | null;
export type BlocBy = "brique" | "famille" | "vague";

type FinState = {
  tab: FinTab;
  caseId: string | null;
  /** tab the case was opened from (the breadcrumb goes back there) */
  from: FinTab;
  q: string;
  filter: Filter;
  vague: string;
  hideMerged: boolean;
  sort: { k: SortKey; dir: 1 | -1 };
  unit: Unit;
  blocBy: BlocBy;
  setTab: (t: FinTab) => void;
  openCase: (id: string, from?: FinTab) => void;
  closeCase: () => void;
  setQ: (q: string) => void;
  setFilter: (f: Filter) => void;
  setVague: (v: string) => void;
  setHideMerged: (v: boolean) => void;
  setSort: (k: SortKey) => void;
  setUnit: (u: Unit) => void;
  setBlocBy: (b: BlocBy) => void;
};

export const useFin = create<FinState>()(
  persist(
    (set, get) => ({
      tab: "overview",
      caseId: null,
      from: "cas",
      q: "",
      filter: null,
      vague: "all",
      hideMerged: false,
      sort: { k: "net", dir: -1 },
      unit: "mdh",
      blocBy: "brique",
      setTab: (tab) => set({ tab, caseId: null }),
      openCase: (id, from) => set({ caseId: id, tab: "cas", from: from ?? (get().caseId ? get().from : get().tab) }),
      closeCase: () => set({ caseId: null, tab: get().from }),
      setQ: (q) => set({ q }),
      setFilter: (filter) => set({ filter }),
      setVague: (vague) => set({ vague }),
      setHideMerged: (hideMerged) => set({ hideMerged }),
      setSort: (k) => { const s = get().sort; set({ sort: s.k === k ? { k, dir: (s.dir === 1 ? -1 : 1) as 1 | -1 } : { k, dir: k === "id" ? 1 : -1 } }); },
      setUnit: (unit) => set({ unit }),
      setBlocBy: (blocBy) => set({ blocBy }),
    }),
    {
      name: "atlas-finance",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({ tab: s.tab, caseId: s.caseId, from: s.from, q: s.q, filter: s.filter, vague: s.vague, hideMerged: s.hideMerged, sort: s.sort, unit: s.unit, blocBy: s.blocBy }),
    },
  ),
);

/** Opens a case of the business case from anywhere (the case dossier panel dispatches `atlas:finance-case`). */
export function openFinanceCase(id: string) {
  if (!V23 || !CASE[id]) return;
  useFin.getState().openCase(id, "cas");
  useApp.getState().setSection("finances");
}

if (typeof window !== "undefined") {
  const w = window as unknown as { __atlasFinanceCase?: (e: Event) => void };
  if (w.__atlasFinanceCase) window.removeEventListener("atlas:finance-case", w.__atlasFinanceCase);
  w.__atlasFinanceCase = (e: Event) => { const id = (e as CustomEvent<{ id?: string }>).detail?.id; if (id) openFinanceCase(id); };
  window.addEventListener("atlas:finance-case", w.__atlasFinanceCase);
}
