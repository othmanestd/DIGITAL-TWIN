"use client";
// Shared UI kit: animated numbers, tooltips, market-ticker tiles, sparklines, 10-people pictograms, segmented controls.
import { useEffect, useId, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { fr, YEARS } from "@/lib/model";
import { useCountUp } from "@/lib/ui/hooks";
import { I } from "./icons";
import s from "./styles";

/* ---------------------------------------------------------------- numbers */
export function Num({ value, d = 1, from, duration, className, style }: { value: number; d?: number; from?: number; duration?: number; className?: string; style?: CSSProperties }) {
  const v = useCountUp(value, { from, duration });
  return <span className={`num ${className ?? ""}`} style={style}>{fr(v, d)}</span>;
}

/* ---------------------------------------------------------------- tooltip (portal, never clipped) */
export function Tip({ content, children, side = "top", className, style, delay = 120 }: { content: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" | "left"; className?: string; style?: CSSProperties; delay?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => {
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const x = side === "right" ? r.right + 10 : side === "left" ? r.left - 10 : r.left + r.width / 2;
      const y = side === "top" ? r.top - 8 : side === "bottom" ? r.bottom + 8 : r.top + r.height / 2;
      setPos({ x, y });
    }, delay);
  };
  const hide = () => { if (t.current) clearTimeout(t.current); setPos(null); };
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const tr = side === "top" ? "translate(-50%, -100%)" : side === "bottom" ? "translate(-50%, 0)" : side === "right" ? "translate(0, -50%)" : "translate(-100%, -50%)";
  return (
    <span ref={ref} className={className} style={style} onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {pos && content && typeof document !== "undefined" && createPortal(
        <div className={`${s.menu} pointer-events-none fixed z-[90] max-w-[340px] rounded-xl px-3 py-2 text-[12.5px] leading-snug text-[var(--txt-2)]`}
          style={{ left: Math.min(pos.x, window.innerWidth - 12), top: pos.y, transform: tr }}>
          {content}
        </div>,
        document.body,
      )}
    </span>
  );
}

/* ---------------------------------------------------------------- sparkline */
export function Sparkline({ series, active, color = "var(--green)", height = 34, className, fill = true }: { series: number[]; active: number; color?: string; height?: number; className?: string; fill?: boolean }) {
  const gid = useId().replace(/:/g, "");
  const W = 100, H = 30, pad = 3;
  const min = Math.min(0, ...series), max = Math.max(...series, 1e-9);
  const pts = series.map((v, i) => [ (i / (series.length - 1)) * W, H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2) ] as const);
  const line = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2)).join(" ");
  const area = line + ` L ${W} ${H} L 0 ${H} Z`;
  const ap = pts[Math.max(0, Math.min(active, pts.length - 1))];
  return (
    <div className={`relative ${className ?? ""}`} style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.2" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${gid}c`}>
            <motion.rect x={-2} y={-10} height={H + 20} initial={false} animate={{ width: ap[0] + 2 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
          </clipPath>
        </defs>
        <path d={line} fill="none" stroke={color} strokeOpacity={0.28} strokeWidth={1.4} vectorEffect="non-scaling-stroke" strokeDasharray="2 3" />
        <g clipPath={`url(#${gid}c)`}>
          {fill && <path d={area} fill={`url(#${gid})`} />}
          <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <motion.span className="absolute h-[7px] w-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent)` }}
        initial={false} animate={{ left: `${ap[0]}%`, top: `${(ap[1] / H) * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  );
}

/* ---------------------------------------------------------------- delta chip */
export function Delta({ text, tone = "pos" }: { text: string | null; tone?: "pos" | "neutral" | "warn" }) {
  if (!text) return null;
  const c = tone === "pos" ? { bg: "rgba(76,199,154,.14)", fg: "#6FD8AE" } : tone === "warn" ? { bg: "rgba(226,176,90,.14)", fg: "#E9C27F" } : { bg: "rgba(255,255,255,.07)", fg: "var(--txt-2)" };
  const up = text.startsWith("+");
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[3px] text-[11px] font-semibold tabular-nums" style={{ background: c.bg, color: c.fg }}>
      {up && <I.arrowUp size={11} strokeWidth={2.4} />}
      {text}
    </span>
  );
}

/* ---------------------------------------------------------------- market ticker tile */
export type TileProps = {
  label: string; value: number; d?: number; unit?: string; unitTip?: ReactNode; prefix?: string;
  explain?: ReactNode; series?: number[]; active?: number; delta?: string | null; tone?: "pos" | "neutral" | "warn";
  color?: string; size?: "xl" | "lg" | "md" | "sm" | "xs"; className?: string; from?: number; anchor?: string; footer?: ReactNode;
};
export function MarketTile({ label, value, d = 1, unit, unitTip, prefix, explain, series, active = YEARS.length - 1, delta, tone = "pos", color = "var(--green)", size = "md", className, from, anchor, footer }: TileProps) {
  const vs = size === "xl" ? "text-[clamp(40px,3.6vw,64px)]" : size === "lg" ? "text-[clamp(28px,2.3vw,40px)]" : size === "md" ? "text-[clamp(22px,1.6vw,30px)]" : size === "sm" ? "text-[20px]" : "text-[17px]";
  const us = size === "xl" ? "text-[clamp(15px,1.1vw,19px)]" : size === "lg" ? "text-[14px]" : size === "xs" ? "text-[10px]" : "text-[12.5px]";
  const pad = size === "xl" ? "p-[clamp(14px,1.2vw,22px)]" : size === "lg" ? "p-3.5" : size === "xs" ? "px-2.5 py-2" : "px-3.5 py-3";
  const inlineDelta = size === "xl";
  return (
    <div className={`${s.tile} flex min-w-0 flex-col rounded-[16px] ${pad} ${className ?? ""}`} data-anchor={anchor}>
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow truncate !text-[10px] !tracking-[0.1em]" style={{ color: "var(--txt-2)" }}>{label}</span>
        {inlineDelta && <Delta text={delta ?? null} tone={tone} />}
      </div>
      <div className={`flex items-baseline ${size === "xs" ? "gap-1" : "gap-1.5"} whitespace-nowrap ${size === "xl" ? "mt-2" : "mt-1.5"}`}>
        {prefix && <span className={`${vs} num font-[800] text-[var(--txt)]`}>{prefix}</span>}
        <Num value={value} d={d} from={from} className={`${vs} font-[800] leading-none text-[var(--txt)]`} />
        {unit && (unitTip ? <Tip content={unitTip}><span className={`${us} cursor-help font-semibold text-[var(--txt-2)]/70 underline decoration-dotted decoration-white/25 underline-offset-4`}>{unit}</span></Tip>
          : <span className={`${us} font-semibold text-[var(--txt-2)]/70`}>{unit}</span>)}
      </div>
      {!inlineDelta && size !== "sm" && size !== "xs" && delta && (
        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold tabular-nums" style={{ color: tone === "pos" ? "#6FD8AE" : tone === "warn" ? "#E9C27F" : "var(--txt-2)" }}>
          {delta.startsWith("+") && <I.arrowUp size={11} strokeWidth={2.4} />}{delta}
        </div>
      )}
      {series && <Sparkline series={series} active={active} color={color} height={size === "xl" ? 44 : size === "lg" ? 38 : size === "md" ? 24 : 22} className={size === "xl" ? "mt-3" : "mt-2"} />}
      {explain && size !== "xs" && <div className={`mt-2 leading-snug text-[var(--mut)] ${size === "xl" ? "text-[13px]" : "text-[11.5px]"}`}>{explain}</div>}
      {footer}
    </div>
  );
}

/* ---------------------------------------------------------------- 10-people pictogram */
const PERSON = "M3.6 40.5V21.8C3.6 17.6 6.5 14.3 10 14.3s6.4 3.3 6.4 7.5v18.7a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8z";
export function Pictogram({ value, color = "var(--blue)", size = 34, gap = 6, className }: { value: number; color?: string; size?: number; gap?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const w = (size * 20) / 44;
  return (
    <div className={`flex items-end ${className ?? ""}`} style={{ gap }} role="img" aria-label={`${fr(value, 1)} sur 10`}>
      {Array.from({ length: 10 }, (_, i) => {
        const f = Math.max(0, Math.min(1, value - i));
        return (
          <svg key={i} width={w} height={size} viewBox="0 0 20 44" className="shrink-0 overflow-visible">
            <defs>
              <clipPath id={`${id}-${i}`}>
                <motion.rect x={0} y={0} height={44} initial={{ width: 0 }} animate={{ width: 20 * f }} transition={{ duration: 0.7, delay: 0.05 * i, ease: [0.2, 0.8, 0.2, 1] }} />
              </clipPath>
            </defs>
            <g fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.16)" strokeWidth={0.8}>
              <circle cx="10" cy="6.6" r="5" />
              <path d={PERSON} />
            </g>
            <g clipPath={`url(#${id}-${i})`} fill={color}>
              <circle cx="10" cy="6.6" r="5" />
              <path d={PERSON} />
            </g>
          </svg>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- mini bar */
export function MiniBar({ value, max, color = "var(--green)", className, h = 4 }: { value: number; max: number; color?: string; className?: string; h?: number }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`relative overflow-hidden rounded-full bg-white/[0.07] ${className ?? ""}`} style={{ height: h }}>
      <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: color }} initial={false} animate={{ width: `${p * 100}%` }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }} />
    </div>
  );
}

/* ---------------------------------------------------------------- segmented control */
export function Segmented<T extends string>({ value, options, onChange, size = "md", className, layoutId, anchorPrefix }: {
  value: T; options: { id: T; label: ReactNode; title?: string; icon?: ReactNode }[]; onChange: (v: T) => void; size?: "sm" | "md"; className?: string; layoutId: string; anchorPrefix?: string;
}) {
  const h = size === "sm" ? "h-7 text-[12px] px-2.5" : "h-8 text-[13px] px-3";
  return (
    <div className={`relative flex items-center gap-0.5 rounded-full bg-white/[0.05] p-[3px] ring-1 ring-white/[0.08] ${className ?? ""}`}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" title={o.title} onClick={() => onChange(o.id)} data-anchor={anchorPrefix ? `${anchorPrefix}${o.id}` : undefined}
            className={`relative z-0 flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium transition-colors ${h} ${on ? "text-white" : "text-[var(--mut)] hover:text-[var(--txt)]"}`}>
            {on && (
              <motion.span layoutId={layoutId} className="absolute inset-0 -z-10 rounded-full"
                style={{ background: "linear-gradient(180deg, rgba(255,255,255,.2), rgba(255,255,255,.1))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 4px 14px -6px rgba(0,0,0,.6)" }}
                transition={{ type: "spring", stiffness: 420, damping: 36 }} />
            )}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- SVG filter for refraction (rendered once in the top bar) */
export function GlassDefs() {
  return (
    <svg width="0" height="0" className="pointer-events-none absolute" aria-hidden>
      <filter id="atlas-lg-displace" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.02" numOctaves="2" seed="7" result="noise" />
        <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
        <feDisplacementMap in="SourceGraphic" in2="soft" scale="26" xChannelSelector="R" yChannelSelector="G" />
      </filter>
    </svg>
  );
}

/* ---------------------------------------------------------------- unit with explanation */
export function UnitNote({ k, children }: { k: string; children?: ReactNode }) {
  return <span className="text-[var(--mut)]">{children ?? k}</span>;
}

/* ---------------------------------------------------------------- small helpers */
export function Eyebrow({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`eyebrow ${className ?? ""}`} style={style}>{children}</div>;
}
export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />;
}
