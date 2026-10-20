"use client";
// Easter egg: zoom out past the Earth and the planet becomes the dot of the JABB "J". One line, in this order:
//   J(Earth)ABB  ×  (akdital mark) AKDITAL  ×  mibtech
// The 3D scene writes the Earth's screen circle into lib/world `frame` and slides the view so the whole line is centred;
// this overlay lays the line out in "J units" (the J mark is 196 × 291, its dot is r 25 at 32.7, 52) around the Earth.
import { useEffect, useRef } from "react";
import { frame } from "@/lib/world";

const J_PATH = "M151.5,193.8c0,18.4-3.8,33-11.5,43.9c-7.6,10.9-21.6,16.4-41.8,16.4c-10.9,0-19.9-1.6-26.9-4.9s-12.5-7.9-16.4-13.8c-3.9-5.9-6.6-12.9-8.2-21c-1.6-8.1-2.3-17-2.3-26.6v-14H0v20.6c0,31.8,8.4,55.9,25.2,72.2c16.8,16.4,40.8,24.5,72,24.5c18.7,0,34.4-2.6,47-7.7c12.6-5.1,22.7-12,30.4-20.6c7.6-8.6,13.1-18.3,16.4-29.2c3.3-10.9,4.9-22,4.9-33.2v-27.1h-44.4V193.8z";
const J_BAR = "151.5,27 151.5,149.3 195.9,149.3 195.9,0";
const DOT = { x: 32.7, y: 52, r: 25 };
const X = { fontSize: 84, fontWeight: 300, lineHeight: 1, marginBottom: 64 } as const;

export default function JabbEgg() {
  const box = useRef<HTMLDivElement>(null);
  const j = useRef<SVGSVGElement>(null);
  const side = useRef<HTMLDivElement[]>([]);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = box.current, jm = j.current;
      if (!el || !jm) return;
      const jLeft = (jm as unknown as HTMLElement).getBoundingClientRect ? jm.getBoundingClientRect().left - el.getBoundingClientRect().left : 0;
      const k0 = el.getBoundingClientRect().width / Math.max(1, el.offsetWidth) || 1; // current scale (to unscale the measure)
      frame.eggW = el.offsetWidth;
      frame.eggDot = jLeft / k0 + DOT.x; // the dot's x inside the line, in J units
      const o = frame.egg;
      if (o <= 0.001 || !frame.earth.visible) { el.style.opacity = "0"; return; }
      const k = frame.earth.r / DOT.r; // px per J unit
      el.style.opacity = String(Math.min(1, o * 1.5));
      el.style.transform = `translate(${frame.earth.x - frame.eggDot * k}px, ${frame.earth.y - DOT.y * k}px) scale(${k})`;
      const side2 = Math.max(0, Math.min(1, (o - 0.3) / 0.45));
      side.current.forEach((s) => s && (s.style.opacity = String(side2)));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const keep = (i: number) => (n: HTMLDivElement | null) => { if (n) side.current[i] = n; };
  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden>
      <div ref={box} className="absolute left-0 top-0 flex origin-top-left items-end whitespace-nowrap" style={{ height: 291, width: "max-content", opacity: 0 }}>
        {/* J without its dot: the Earth is the dot */}
        <svg ref={j} viewBox="0 0 196 291" width="196" height="291" className="shrink-0" fill="#FFFFFF">
          <path d={J_PATH} />
          <polygon points={J_BAR} />
        </svg>
        <span className="text-white" style={{ marginLeft: 14, marginBottom: 20, fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 700, fontStyle: "italic", fontSize: 227, lineHeight: 0.74, letterSpacing: "-0.01em" }}>
          ABB
        </span>
        <div ref={keep(1)} className="flex items-end" style={{ gap: 44, marginLeft: 52, opacity: 0 }}>
          <span className="text-white/45" style={X}>×</span>
          <span className="flex items-center" style={{ gap: 20, marginBottom: 58 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/akdital-mark.svg" alt="" style={{ height: 84, width: 84 }} />
            <span className="text-white" style={{ fontSize: 80, fontWeight: 800, letterSpacing: "0.07em", lineHeight: 1 }}>AKDITAL</span>
          </span>
          <span className="text-white/45" style={X}>×</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mibtech-reverse.svg" alt="" style={{ height: 66, width: 66 * 7.55, marginBottom: 72 }} />
        </div>
      </div>
    </div>
  );
}
