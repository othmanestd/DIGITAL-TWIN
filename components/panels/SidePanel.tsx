"use client";
// Split-screen analytics panel (right). Opens when something is selected; content per selection kind.
// Only the use-case dossier scrolls (inside the panel); the app frame never does.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp, type Sel } from "@/lib/store";
import { I } from "@/components/ui/icons";
import { DeptView, CaseView, PersonView, FloorView, PlaceView, XpView, crumbs } from "./views";
import s from "@/components/ui/styles";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function SidePanel() {
  const open = useApp((st) => st.panelOpen && st.section === "explorer" && !!st.sel && st.sel.kind !== "overview");
  const sel = useApp((st) => st.sel);
  const caseId = useApp((st) => st.caseId);
  const level = useApp((st) => st.level);
  const select = useApp((st) => st.select);
  const ref = useRef<HTMLElement | null>(null);
  const [w, setW] = useState(0);
  // keep the last content while the panel slides out
  const [last, setLast] = useState<{ sel: NonNullable<Sel>; caseId: string | null } | null>(null);
  useEffect(() => { if (open && sel) setLast({ sel, caseId }); }, [open, sel, caseId]);
  useIso(() => {
    if (!open || !ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(() => setW(el.offsetWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const cur = open && sel ? { sel, caseId } : last;
  const kind = cur?.sel.kind;
  const key = cur ? `${cur.sel.kind}:${cur.sel.id}:${cur.caseId ?? ""}` : "none";
  const bc = cur ? crumbs(cur.sel.kind, cur.sel.id, cur.caseId) : [];
  // a use case opens as a scrollable dossier that manages its own padding (sticky header, scrolling page)
  const flush = !!cur && (!!cur.caseId || kind === "case");

  let body: React.ReactNode = null;
  if (cur) {
    if (cur.caseId) body = <CaseView id={cur.caseId} />;
    else if (kind === "dept") body = <DeptView id={cur.sel.id} />;
    else if (kind === "person") body = <PersonView id={cur.sel.id} />;
    else if (kind === "floor") body = <FloorView id={cur.sel.id} />;
    else if (kind === "city" || kind === "site" || kind === "country") body = <PlaceView kind={kind} id={cur.sel.id} />;
    else if (kind === "case") body = <CaseView id={cur.sel.id} />;
    else if (kind === "xp") body = <XpView id={cur.sel.id} />;
  }

  return (
    <aside
      ref={ref}
      className={`${s.read} fixed bottom-4 right-4 top-[76px] z-30 flex flex-col overflow-hidden rounded-[22px] transition-[transform,opacity] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]`}
      style={{
        width: open ? "calc(var(--panel-w) - 28px)" : w ? `${w}px` : "calc(clamp(520px, 39vw, 780px) - 28px)",
        transform: open ? "translateX(0)" : "translateX(calc(100% + 32px))",
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      aria-hidden={!open}
      data-anchor="panel"
    >
      {/* header: breadcrumb + close */}
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b border-white/[0.06] pl-5 pr-3">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-[12.5px]" aria-label="Fil d'Ariane">
          {bc.map((b, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1">
              {i > 0 && <I.chevron size={12} className="shrink-0 text-white/25" />}
              {b.go && i < bc.length - 1 ? (
                <button type="button" onClick={b.go} className="truncate rounded-md px-1 py-0.5 text-[var(--mut)] transition-colors hover:bg-white/[0.06] hover:text-white">{b.label}</button>
              ) : (
                <span className={`truncate px-1 ${i === bc.length - 1 ? "font-semibold text-[var(--txt)]" : "text-[var(--mut)]"}`}>{b.label}</span>
              )}
            </span>
          ))}
        </nav>
        <button type="button" onClick={() => select({ kind: "overview", id: level })} data-anchor="panel:close" aria-label="Fermer le panneau"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-[var(--txt-2)] ring-1 ring-white/[0.08] transition-colors hover:bg-white/[0.14] hover:text-white">
          <I.close size={16} />
        </button>
      </div>
      <div className="relative min-h-0 flex-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={key} className={flush ? "absolute inset-0" : "absolute inset-0 px-6 pb-5 pt-5 [@media(max-height:960px)]:px-5 [@media(max-height:960px)]:pt-4"}
            initial={{ opacity: 0, x: 24, filter: "blur(4px)" }} animate={{ opacity: 1, x: 0, filter: "blur(0px)" }} exit={{ opacity: 0, x: -16, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
    </aside>
  );
}
