"use client";
// Vertical altitude slider over the whole continuous world: Hôpital (top, closest) → Maroc → Monde → JABB (bottom).
// The thumb follows the real camera altitude; dragging glides the camera through the powers of ten.
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { altToG } from "@/lib/world";

type Mark = { key: "hospital" | "morocco" | "world" | "jabb"; label: string; g: number; alt: number };
const MARKS: Mark[] = [
  { key: "hospital", label: "Hôpital", alt: 260, g: altToG(260) },
  { key: "morocco", label: "Maroc", alt: 1.9e6, g: altToG(1.9e6) },
  { key: "world", label: "Monde", alt: 2.1e7, g: altToG(2.1e7) },
  { key: "jabb", label: "JABB", alt: 8e8, g: 1 },
];

function Icon({ k }: { k: Mark["key"] | "plus" | "minus" | "keys" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
      {k === "plus" && <path d="M12 5v14M5 12h14" />}
      {k === "minus" && <path d="M5 12h14" />}
      {k === "hospital" && <><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-5h6v5M12 8v4M10 10h4" /></>}
      {k === "morocco" && <><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>}
      {k === "world" && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18" /></>}
      {k === "jabb" && <><path d="M15 4v9.5a4.5 4.5 0 0 1-9 0V12" /><circle cx="7.5" cy="6" r="2" fill="currentColor" stroke="none" /></>}
      {k === "keys" && <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></>}
    </svg>
  );
}

export default function ZoomSlider() {
  const zoom = useApp((s) => s.zoom); // 0 (closest) … 1 (JABB)
  const requestZoom = useApp((s) => s.requestZoom);
  const setHelpOpen = useApp((s) => s.setHelpOpen);
  const track = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const raf = useRef(0);
  const g = drag ?? zoom;

  const fromEvent = (y: number) => { const r = track.current!.getBoundingClientRect(); return Math.min(1, Math.max(0, (y - r.top) / r.height)); };
  const send = (v: number) => { cancelAnimationFrame(raf.current); raf.current = requestAnimationFrame(() => requestZoom({ g: v })); };
  useEffect(() => {
    if (drag === null) return;
    const move = (e: PointerEvent) => { const v = fromEvent(e.clientY); setDrag(v); send(v); };
    const up = () => setDrag(null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const nearest = MARKS.reduce((a, m) => (Math.abs(m.g - zoom) < Math.abs(a.g - zoom) ? m : a), MARKS[0]);
  const btn = "grid place-items-center rounded-full text-[var(--txt-2)] hover:text-white hover:bg-white/10 transition-colors";
  return (
    <div className="glass pointer-events-auto relative z-20 flex min-h-0 flex-col items-center rounded-full py-2" style={{ width: 44, height: "clamp(190px, 42dvh, 420px)" }} aria-label="Zoom">
      <button className={`${btn} h-8 w-8`} onClick={() => requestZoom({ delta: -0.16 })} data-anchor="zoom:in" title="Zoomer (+)"><Icon k="plus" /></button>
      <div ref={track} className="relative my-2 w-full flex-1 cursor-ns-resize" onPointerDown={(e) => { const v = fromEvent(e.clientY); setDrag(v); send(v); }}>
        <div className="absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full bg-white/10" />
        <div className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full bg-[var(--blue)]/70" style={{ height: `${g * 100}%` }} />
        {MARKS.map((m) => (
          <button
            key={m.key}
            data-anchor={`zoom:level:${m.key}`}
            title={m.label}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => (m.key === "jabb" ? requestZoom({ g: m.g }) : requestZoom({ level: m.key, value: m.key === "hospital" ? 0.62 : m.key === "morocco" ? 0.92 : 0.55 }))}
            className={`${btn} absolute left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 ${nearest.key === m.key ? "!text-white" : "opacity-55"}`}
            style={{ top: `${m.g * 100}%` }}
          >
            <Icon k={m.key} />
          </button>
        ))}
        <div className="pointer-events-none absolute left-1/2 h-[14px] w-[26px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,.5)]"
          style={{ top: `${g * 100}%`, transition: drag === null ? "top .12s linear" : "none" }} />
      </div>
      <button className={`${btn} h-8 w-8`} onClick={() => requestZoom({ delta: 0.16 })} data-anchor="zoom:out" title="Dézoomer (−)"><Icon k="minus" /></button>
      <div className="my-1 h-px w-5 bg-white/15" />
      <button className={`${btn} h-8 w-8`} onClick={() => setHelpOpen(true)} title="Raccourcis clavier (?)" data-anchor="help"><Icon k="keys" /></button>
    </div>
  );
}
