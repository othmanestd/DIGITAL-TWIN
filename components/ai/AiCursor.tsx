"use client";
// The blue AI cursor: an arrow with a soft blue glow and a "Jabby" pill. It follows the target set in the store
// (lib/ai/cursor.ts) along a gentle arc with ease-in-out timing; a ripple marks each click. Visible only while
// Jabby or the guided tour is driving.
import { useEffect, useRef } from "react";
import { useApp } from "@/lib/store";
import { travelMs } from "@/lib/ai/cursor";
import { JMark } from "./icons";

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function AiCursor() {
  const root = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLSpanElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current!;
    const pos = { x: -200, y: -200 };
    let raf = 0;
    const place = (x: number, y: number) => { pos.x = x; pos.y = y; el.style.transform = `translate3d(${x}px, ${y}px, 0)`; };
    const animate = (to: { x: number; y: number }) => {
      cancelAnimationFrame(raf);
      const from = { ...pos };
      const dx = to.x - from.x, dy = to.y - from.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) return;
      // control point: off the straight line, on a consistent side, so the path reads as a hand-drawn arc
      const k = Math.min(0.22, 60 / Math.max(dist, 1) + 0.08);
      const c = { x: from.x + dx / 2 - dy * k, y: from.y + dy / 2 + dx * k };
      const dur = travelMs(from, to);
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / dur);
        const e = ease(t);
        const u = 1 - e;
        place(u * u * from.x + 2 * u * e * c.x + e * e * to.x, u * u * from.y + 2 * u * e * c.y + e * e * to.y);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const apply = (cur: ReturnType<typeof useApp.getState>["cursor"], prev?: ReturnType<typeof useApp.getState>["cursor"]) => {
      el.dataset.visible = String(cur.visible);
      if (label.current) label.current.textContent = cur.label || "Jabby";
      if (cur.visible && (!prev || !prev.visible)) { cancelAnimationFrame(raf); place(cur.x, cur.y); }
      else if (cur.visible && (cur.x !== prev?.x || cur.y !== prev?.y)) animate({ x: cur.x, y: cur.y });
      if (cur.clicking && !prev?.clicking) {
        el.dataset.click = "1";
        const r = ripple.current;
        if (r) { r.classList.remove("go"); void r.offsetWidth; r.classList.add("go"); }
      } else if (!cur.clicking) el.dataset.click = "0";
    };
    apply(useApp.getState().cursor);
    const unsub = useApp.subscribe((s, p) => { if (s.cursor !== p.cursor) apply(s.cursor, p.cursor); });
    return () => { unsub(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div ref={root} className="jb-cursor" data-visible="false" aria-hidden>
      <span ref={ripple} className="jb-ripple" />
      <svg className="jb-arrow" width="26" height="30" viewBox="0 0 26 30">
        <defs>
          <linearGradient id="jb-cur-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8EA6FF" />
            <stop offset="0.55" stopColor="#5B7CFF" />
            <stop offset="1" stopColor="#3651E8" />
          </linearGradient>
        </defs>
        <path d="M3.2 2.4c0-.9 1-1.4 1.7-.8l17.6 14.6c.7.6.3 1.7-.6 1.8l-7.4.6c-.4 0-.7.3-.9.6l-3.6 6.9c-.4.8-1.6.7-1.9-.2L3.2 2.4z"
          fill="url(#jb-cur-g)" stroke="rgba(255,255,255,.92)" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
      <span className="jb-cursor-pill">
        <JMark size={10} color="#fff" />
        <span ref={label}>Jabby</span>
      </span>
    </div>
  );
}
