"use client";
// Finance view · shared primitives: panels, table cells, legends, tags. Same glass and type scale as the other sections.
import type { CSSProperties, ReactNode } from "react";
import { Tip } from "@/components/ui/kit";
import s from "@/components/ui/styles";

/** Keyboard focus ring used on every interactive element of the view. */
export const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#9FB3FF]/70 focus-visible:ring-offset-0";

export function Panel({ title, sub, right, children, className, bodyClass, id }: { title?: ReactNode; sub?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; id?: string }) {
  return (
    <section id={id} className={`${s.card} flex min-w-0 flex-col rounded-[18px] p-[clamp(14px,1.05vw,20px)] ${className ?? ""}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {title && <h3 className="text-[clamp(13px,0.85vw,15px)] font-semibold tracking-[-0.01em] text-white">{title}{sub && <span className="ml-1.5 text-[11.5px] font-normal text-[var(--mut)]">· {sub}</span>}</h3>}
          <span className="flex-1" />
          {right}
        </div>
      )}
      <div className={`min-h-0 flex-1 ${bodyClass ?? ""}`}>{children}</div>
    </section>
  );
}

export const Sub = ({ children }: { children: ReactNode }) => <span className="text-[11.5px] font-normal text-[var(--mut)]">{children}</span>;

/** Small pill marking a figure computed on screen from source values (with the formula in the tooltip). */
export function Derived({ how, label = "calculé" }: { how: ReactNode; label?: string }) {
  return (
    <Tip content={<><b className="text-white">Valeur dérivée.</b> {how}</>}>
      <span tabIndex={0} className={`inline-flex cursor-help items-center rounded-full bg-white/[0.06] px-1.5 py-[1px] align-middle text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)] ring-1 ring-white/[0.08] ${FOCUS}`}>{label}</span>
    </Tip>
  );
}

/** Source line under a block. */
export function Source({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`mt-2.5 text-[11px] leading-snug text-[var(--mut)] ${className ?? ""}`}>{children}</p>;
}

export function Swatch({ color, kind = "bar", dashed }: { color: string; kind?: "bar" | "line" | "dot"; dashed?: boolean }) {
  if (kind === "line") return <span className="inline-block h-[2px] w-3.5 shrink-0 rounded-full" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 3px, transparent 3px 6px)` : color }} />;
  if (kind === "dot") return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />;
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]" style={dashed ? { boxShadow: `inset 0 0 0 1.2px ${color}` } : { background: color }} />;
}
export function Legend({ items, className }: { items: { label: ReactNode; color: string; kind?: "bar" | "line" | "dot"; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11.5px] text-[var(--txt-2)] ${className ?? ""}`}>
      {items.map((it, i) => <span key={i} className="flex items-center gap-1.5"><Swatch color={it.color} kind={it.kind} dashed={it.dashed} />{it.label}</span>)}
    </div>
  );
}

/** Table header cell with an optional explanation. */
export function Th({ children, tip, align = "right", className, style }: { children?: ReactNode; tip?: ReactNode; align?: "left" | "right" | "center"; className?: string; style?: CSSProperties }) {
  const a = align === "left" ? "text-left" : align === "center" ? "text-center" : "text-right";
  const inner = <span className={tip ? "cursor-help underline decoration-dotted decoration-white/20 underline-offset-4" : ""}>{children}</span>;
  return (
    <th scope="col" className={`whitespace-nowrap px-2 pb-2 pt-1 align-bottom text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--mut)] ${a} ${className ?? ""}`} style={style}>
      {tip ? <Tip content={tip}>{inner}</Tip> : inner}
    </th>
  );
}

export function Chip({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-2 py-[2px] text-[11px] text-[var(--txt-2)] ring-1 ring-white/[0.07] ${className ?? ""}`}>
      {color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}{children}
    </span>
  );
}

/** Small ghost button. */
export function Btn({ children, onClick, title, className, primary }: { children: ReactNode; onClick: () => void; title?: string; className?: string; primary?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors ${FOCUS} ${primary ? "bg-[rgba(91,124,255,.22)] text-white ring-1 ring-[rgba(91,124,255,.45)] hover:bg-[rgba(91,124,255,.32)]" : "bg-white/[0.06] text-[var(--txt-2)] ring-1 ring-white/[0.09] hover:bg-white/[0.12] hover:text-white"} ${className ?? ""}`}>
      {children}
    </button>
  );
}

/** Value cell colour: deductions and negative values are written with "−" and stay in ink colour (no red). */
export const tdNum = "num whitespace-nowrap px-2 py-[7px] text-right text-[13px] tabular-nums";
