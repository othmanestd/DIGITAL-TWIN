"use client";
// Small shared pieces of the dossier and of the sources views: focus ring, glossary text, case chips, glyphs.
import type { ReactNode, SVGProps } from "react";
import { useApp } from "@/lib/store";
import { CASE } from "@/lib/model";
import { FAM_COLOR, norm } from "@/lib/ui/fmt";
import { Tip } from "@/components/ui/kit";
import { I } from "@/components/ui/icons";
import s from "@/components/ui/styles";
import "./dossier.css";

/** Soft focus ring for every interactive element of the dossier. */
export const FOCUS = "dz-focus";

/** Text with "(explanation)" markers from annotateAll(), the explanation rendered muted. */
export function Rich({ t }: { t: string }) {
  const parts = t.split(/\u0001([^\u0002]*)\u0002/);
  return <>{parts.map((p, i) => (i % 2 ? <span key={i} className="text-[var(--mut)]">{p}</span> : p))}</>;
}

/** Highlights the search words inside a text (accent-insensitive). */
export function Hl({ text, q }: { text: string; q?: string }) {
  const w = (q ?? "").trim() ? norm(q ?? "").split(/\s+/).filter(Boolean) : [];
  if (!w.length) return <>{text}</>;
  const n = norm(text);
  if (n.length !== text.length) return <>{text}</>;
  const spans: [number, number][] = [];
  for (const k of w) { let i = n.indexOf(k); while (i >= 0) { spans.push([i, i + k.length]); i = n.indexOf(k, i + k.length); } }
  if (!spans.length) return <>{text}</>;
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const s of spans) { const l = merged[merged.length - 1]; if (l && s[0] <= l[1]) l[1] = Math.max(l[1], s[1]); else merged.push([...s]); }
  const out: ReactNode[] = []; let at = 0;
  merged.forEach(([a, b], i) => { if (a > at) out.push(text.slice(at, a)); out.push(<mark key={i} className="dz-mark">{text.slice(a, b)}</mark>); at = b; });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

/** A case id as a chip: click opens that case and flies the 3D camera to its department. */
export function CaseChip({ id, current = false, className = "" }: { id: string; current?: boolean; className?: string }) {
  const select = useApp((st) => st.select);
  const c = CASE[id];
  if (!c) return null;
  const col = FAM_COLOR[c.fam || id[0]];
  const base = `num inline-flex h-[24px] items-center rounded-[7px] px-2 text-[11.5px] ring-1 ring-white/[0.08] ${className}`;
  if (current) {
    return (
      <Tip content={<>{c.titre}<br /><span className="text-[var(--mut)]">Vous êtes sur ce cas.</span></>}>
        <span aria-current="true" className={`${base} gap-1 bg-white/[0.12]`} style={{ color: col }}>{id}<span className="text-[10px] font-medium text-[var(--mut)]">ce cas</span></span>
      </Tip>
    );
  }
  return (
    <Tip content={c.titre}>
      <button type="button" onClick={() => select({ kind: "case", id })} data-anchor={`case-chip:${id}`} aria-label={`Ouvrir le cas ${id} : ${c.titre}`}
        className={`${base} bg-white/[0.05] transition-colors hover:bg-white/[0.14] ${FOCUS}`} style={{ color: col }}>{id}</button>
    </Tip>
  );
}

export const TONES = {
  green: { bg: "linear-gradient(90deg, rgba(76,199,154,.12), rgba(76,199,154,.03))", bar: "var(--green)", fg: "#7FD9B5" },
  blue: { bg: "linear-gradient(90deg, rgba(91,124,255,.13), rgba(91,124,255,.03))", bar: "#9FB3FF", fg: "#AFC0FF" },
  amber: { bg: "linear-gradient(90deg, rgba(226,176,90,.12), rgba(226,176,90,.03))", bar: "#E2B05A", fg: "#E9C27F" },
  neutral: { bg: "linear-gradient(90deg, rgba(255,255,255,.05), rgba(255,255,255,.02))", bar: "rgba(255,255,255,.28)", fg: "var(--txt-2)" },
} as const;
export function Callout({ icon, label, tone = "neutral", children, anchor }: { icon: ReactNode; label: string; tone?: keyof typeof TONES; children: ReactNode; anchor?: string }) {
  const t = TONES[tone];
  return (
    <div className="rounded-[14px] px-3.5 py-3" style={{ background: t.bg, boxShadow: `inset 3px 0 0 ${t.bar}` }} data-anchor={anchor}>
      <div className="flex items-center gap-1.5" style={{ color: t.fg }}>{icon}<span className="eyebrow !text-[9.5px] ![color:inherit]">{label}</span></div>
      <div className="mt-1.5 text-[13.5px] leading-snug text-[var(--txt)]">{children}</div>
    </div>
  );
}
export const Sub = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="flex items-center gap-3"><span className="eyebrow !text-[10px] text-[var(--txt-2)]">{children}</span><span className="h-px flex-1 bg-white/[0.07]" />{right}</div>
);
export const Body = ({ children }: { children: ReactNode }) => <p className="text-[14px] leading-[1.55] text-[var(--txt)]">{children}</p>;
export const Pill = ({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "blue" }) => (
  <span className={tone === "blue" ? "rounded-full bg-[rgba(91,124,255,.16)] px-2.5 py-[3px] text-[12px] font-medium text-[#C9D4FF] ring-1 ring-[rgba(91,124,255,.3)]" : "rounded-full bg-white/[0.06] px-2.5 py-[3px] text-[12px] text-[var(--txt-2)] ring-1 ring-white/[0.06]"}>{children}</span>
);

export function CaseLink({ id, note }: { id: string; note?: ReactNode }) {
  const select = useApp((st) => st.select);
  const c = CASE[id];
  if (!c) return null;
  return (
    <button type="button" onClick={() => select({ kind: "case", id })} data-anchor={`case-link:${id}`} aria-label={`Ouvrir le cas ${id} : ${c.titre}`}
      className={`${s.card} group flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-white/[0.07] ${FOCUS}`}>
      <span className="num w-[38px] shrink-0 text-[12.5px] font-bold" style={{ color: FAM_COLOR[c.fam || id[0]] }}>{id}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--txt)] group-hover:text-white">{c.titre}</span>
      {note && <span className="max-w-[40%] shrink-0 truncate text-[11px] text-[var(--mut)]">{note}</span>}
      <I.chevron size={13} className="shrink-0 text-[var(--mut)] opacity-60 transition-opacity group-hover:opacity-100" />
    </button>
  );
}


/* ---------------------------------------------------------------- glyphs (same family as components/ui/icons.tsx) */
type P = SVGProps<SVGSVGElement> & { size?: number };
const Svg = ({ size = 14, children, ...rest }: P & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>{children}</svg>
);
export const G = {
  ext: (p: P) => <Svg {...p}><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" /></Svg>,
  down: (p: P) => <Svg {...p}><path d="M5.5 9.5L12 16l6.5-6.5" /></Svg>,
  left: (p: P) => <Svg {...p}><path d="M14.5 5.5L8 12l6.5 6.5" /></Svg>,
  right: (p: P) => <Svg {...p}><path d="M9.5 5.5L16 12l-6.5 6.5" /></Svg>,
  alert: (p: P) => <Svg {...p}><path d="M12 4l9 15.5H3z" /><path d="M12 10v4.2M12 17v.01" /></Svg>,
  lock: (p: P) => <Svg {...p}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></Svg>,
  clock: (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>,
  target: (p: P) => <Svg {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></Svg>,
  tool: (p: P) => <Svg {...p}><path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5L15.5 12 12 8.5z" /></Svg>,
};
