"use client";
// Easter egg: zoom out past the Earth and the planet becomes the TOP DROP of the Akdital mark. One line:
//   JABB  ×  (Akdital mark, its top drop = the Earth) AKDITAL  ×  mibtech
// The Earth stays at the centre of the screen: zooming in or out always grows from / dives into that drop.
// Units: the Akdital mark is 620 × 620 (lib: public/brand/akdital-mark.svg); its top drop's round head is r 82 at (310, 186).
import { useEffect, useRef } from "react";
import { frame } from "@/lib/world";

const J_PATH = "M151.5,193.8c0,18.4-3.8,33-11.5,43.9c-7.6,10.9-21.6,16.4-41.8,16.4c-10.9,0-19.9-1.6-26.9-4.9s-12.5-7.9-16.4-13.8c-3.9-5.9-6.6-12.9-8.2-21c-1.6-8.1-2.3-17-2.3-26.6v-14H0v20.6c0,31.8,8.4,55.9,25.2,72.2c16.8,16.4,40.8,24.5,72,24.5c18.7,0,34.4-2.6,47-7.7c12.6-5.1,22.7-12,30.4-20.6c7.6-8.6,13.1-18.3,16.4-29.2c3.3-10.9,4.9-22,4.9-33.2v-27.1h-44.4V193.8z";
const J_BAR = "151.5,27 151.5,149.3 195.9,149.3 195.9,0";
const H = 620;                      // Akdital mark height (lockup unit)
const DROP = { x: 310, y: 186, r: 82 };
const X = { fontSize: H * 0.5, fontWeight: 300, lineHeight: 1 } as const;

/** Akdital mark without the round head of its top drop (the Earth takes its place); the drop's tail stays. */
function MarkWithEarthDrop() {
  return (
    <svg viewBox="0 0 620 620" width={H} height={H} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id="egg-ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1DB4EA" /><stop offset="1" stopColor="#0057A3" /></linearGradient>
        <linearGradient id="egg-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1DA9E2" /><stop offset="1" stopColor="#0066B0" /></linearGradient>
      </defs>
      <circle cx="310" cy="310" r="296" fill="none" stroke="url(#egg-ring)" strokeWidth="27" />
      <g fill="url(#egg-drop)">
        {/* tail of the top drop, between its sides and the lower arc of its head (the head is the Earth) */}
        <path d="M228 186 C 228 236, 292 288, 310 314 C 328 288, 392 236, 392 186 A 82 82 0 0 1 228 186 Z" />
        <path d="M208 252 C 226 278, 291 330, 291 380 A 83 83 0 1 1 125 380 C 125 330, 190 278, 208 252 Z" />
        <path d="M412 252 C 430 278, 495 330, 495 380 A 83 83 0 1 1 329 380 C 329 330, 394 278, 412 252 Z" />
      </g>
      {/* thin rim so the Earth reads as the drop's head */}
      <circle cx={DROP.x} cy={DROP.y} r={DROP.r + 3} fill="none" stroke="#1DA9E2" strokeOpacity="0.55" strokeWidth="5" />
    </svg>
  );
}

export default function JabbEgg() {
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLDivElement[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = box.current, m = mark.current;
      if (!el || !m) return;
      // position of the drop inside the line, in unscaled units (measured once the layout exists)
      const scale = el.getBoundingClientRect().width / Math.max(1, el.offsetWidth) || 1;
      const mr = m.getBoundingClientRect(), br = el.getBoundingClientRect();
      const dx = (mr.left - br.left) / scale + DROP.x, dy = (mr.top - br.top) / scale + DROP.y;
      frame.eggW = el.offsetWidth;
      frame.eggDot = dx;
      const o = frame.egg;
      if (o <= 0.001 || !frame.earth.visible) { el.style.opacity = "0"; return; }
      const k = frame.earth.r / DROP.r; // px per unit: the Earth exactly fills the drop's head
      el.style.opacity = String(Math.min(1, o * 1.5));
      el.style.transform = `translate(${frame.earth.x - dx * k}px, ${frame.earth.y - dy * k}px) scale(${k})`;
      const s2 = Math.max(0, Math.min(1, (o - 0.25) / 0.45));
      side.current.forEach((s) => s && (s.style.opacity = String(s2)));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const keep = (i: number) => (n: HTMLDivElement | null) => { if (n) side.current[i] = n; };
  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden>
      <div ref={box} className="absolute left-0 top-0 flex origin-top-left items-center whitespace-nowrap" style={{ height: H, width: "max-content", opacity: 0 }}>
        {/* JABB, same visual size as the two other logos */}
        <div ref={keep(0)} className="flex items-center" style={{ gap: H * 0.32, marginRight: H * 0.32, opacity: 0 }}>
          <span className="flex items-end text-white" style={{ gap: H * 0.02 }}>
            <svg viewBox="0 0 196 291" height={H * 0.6} width={(H * 0.6 * 196) / 291} fill="#FFFFFF" className="shrink-0">
              <path d={J_PATH} /><polygon points={J_BAR} /><circle cx="32.7" cy="52" r="25" />
            </svg>
            <span style={{ fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 700, fontStyle: "italic", fontSize: H * 0.5, lineHeight: 0.74, letterSpacing: "-0.01em", marginBottom: H * 0.035 }}>ABB</span>
          </span>
          <span className="text-white/45" style={X}>×</span>
        </div>
        {/* Akdital: the Earth is the top drop */}
        <div ref={mark} className="shrink-0"><MarkWithEarthDrop /></div>
        <div ref={keep(1)} className="flex items-center" style={{ gap: H * 0.26, marginLeft: H * 0.14, opacity: 0 }}>
          <span className="text-white" style={{ fontSize: H * 0.5, fontWeight: 800, letterSpacing: "0.06em", lineHeight: 1 }}>AKDITAL</span>
          <span className="text-white/45" style={X}>×</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mibtech-reverse.svg" alt="" style={{ height: H * 0.36, width: H * 0.36 * 7.55 }} />
        </div>
      </div>
    </div>
  );
}
