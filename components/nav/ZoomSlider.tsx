"use client";
// Vertical altitude slider over the whole continuous world, three stops: Casablanca (top) → Monde → Akdital logo (bottom).
// Closer than Casablanca the thumb still follows the camera, but there is no stop: establishments are chosen in the explorer.
// The thumb follows the real camera altitude; dragging glides the camera through the powers of ten.
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { altToG, MAX_ALT } from "@/lib/world";
import { tone } from "@/lib/ui/tone";

type Mark = { key: "hospital" | "city" | "morocco" | "world" | "jabb"; label: string; g: number; alt: number };
const MARKS: Mark[] = [
  { key: "city", label: "Casablanca", alt: 9_000, g: altToG(9_000) },
  { key: "world", label: "Monde", alt: 2.1e7, g: altToG(2.1e7) },
  { key: "jabb", label: "Akdital", alt: MAX_ALT, g: 1 },
];

function Icon({ k }: { k: Mark["key"] | "plus" | "minus" | "keys" }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
      {k === "plus" && <path d="M12 5v14M5 12h14" />}
      {k === "minus" && <path d="M5 12h14" />}
      {k === "hospital" && <><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-5h6v5M12 8v4M10 10h4" /></>}
      {k === "city" && <><path d="M3 20.5h18" /><path d="M4.5 20.5v-8l4-2.5v10.5" /><path d="M8.5 20.5V5.5l6-2.5v17.5" /><path d="M14.5 20.5V9.5l5 2.5v8.5" /></>}
      {k === "morocco" && <><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" /><circle cx="12" cy="10" r="2.2" /></>}
      {k === "world" && <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18" /></>}
      {k === "jabb" && <><circle cx="12" cy="12" r="9.5" /><path d="M12 5.2c-1.6 2-2.4 3.2-2.4 4.4a2.4 2.4 0 0 0 4.8 0c0-1.2-.8-2.4-2.4-4.4zM8.4 10.6c-1.4 1.8-2.1 2.9-2.1 4a2.1 2.1 0 0 0 4.2 0c0-1.1-.7-2.2-2.1-4zM15.6 10.6c-1.4 1.8-2.1 2.9-2.1 4a2.1 2.1 0 0 0 4.2 0c0-1.1-.7-2.2-2.1-4z" fill="currentColor" stroke="none" /></>}
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
  const btn = "tone-adapt grid place-items-center rounded-full";
  return (
    <div className="glass pointer-events-auto relative z-20 flex min-h-0 flex-col items-center rounded-full py-2" style={{ width: 44, height: "clamp(190px, 42dvh, 420px)" }} aria-label="Zoom">
      <button className={`${btn} h-8 w-8`} onClick={() => requestZoom({ delta: -0.16 })} ref={tone} data-anchor="zoom:in" title="Zoomer (+)"><Icon k="plus" /></button>
      <div ref={track} className="relative my-2 w-full flex-1 cursor-ns-resize" onPointerDown={(e) => { const v = fromEvent(e.clientY); setDrag(v); send(v); }}>
        <div ref={tone} className="tone-line absolute left-1/2 top-0 h-full w-[3px] -translate-x-1/2 rounded-full" />
        <div className="absolute left-1/2 top-0 w-[3px] -translate-x-1/2 rounded-full bg-[var(--blue)]/70" style={{ height: `${g * 100}%` }} />
        {MARKS.map((m) => (
          <button
            key={m.key}
            ref={tone} data-anchor={`zoom:level:${m.key}`}
            title={m.label}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={m.label} aria-current={nearest.key === m.key ? "true" : undefined}
            onClick={() => (m.key === "jabb" ? requestZoom({ g: m.g, staged: true }) : m.key === "city" ? requestZoom({ level: "city", staged: true }) : requestZoom({ level: m.key, value: m.key === "hospital" ? 0.62 : m.key === "morocco" ? 0.92 : 0.55, staged: true }))}
            className={`${btn} absolute left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 ${nearest.key === m.key ? "tone-on" : "tone-dim"}`}
            style={{ top: `${m.g * 100}%` }}
          >
            <Icon k={m.key} />
          </button>
        ))}
        <div ref={tone} className="tone-thumb pointer-events-none absolute left-1/2 h-[14px] w-[26px] -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white/90 shadow-[0_2px_10px_rgba(0,0,0,.5)]"
          style={{ top: `${g * 100}%`, transition: drag === null ? "top .12s linear" : "none" }} />
      </div>
      <button className={`${btn} h-8 w-8`} onClick={() => requestZoom({ delta: 0.16 })} ref={tone} data-anchor="zoom:out" title="Dézoomer (−)"><Icon k="minus" /></button>
      <div ref={tone} className="tone-line my-1 h-px w-5" />
      <button className={`${btn} h-8 w-8`} onClick={() => setHelpOpen(true)} title="Raccourcis clavier (?)" ref={tone} data-anchor="help"><Icon k="keys" /></button>
    </div>
  );
}
