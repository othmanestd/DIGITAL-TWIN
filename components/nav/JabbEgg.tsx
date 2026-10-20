"use client";
// Easter egg: zoom out past the Earth and the planet hides inside the TOP DROP of the Akdital mark.
//     [Akdital mark] AKDITAL        ← the client, centred on screen
//        mibtech × JABB             ← smaller, underneath
// Far out you only see the logo: the opaque drop sits in front of the Earth and masks it. Zooming in slides toward the
// drop, the drop opens and the globe appears inside it, then the logo flies past. The scene (UnifiedWorld) shifts the
// view so the Earth sits exactly behind the drop and sets the scale (frame.eggK); this overlay only follows it.
import { useEffect, useRef } from "react";
import { frame, EGG_DROP as DROP } from "@/lib/world";

const J_PATH = "M151.5,193.8c0,18.4-3.8,33-11.5,43.9c-7.6,10.9-21.6,16.4-41.8,16.4c-10.9,0-19.9-1.6-26.9-4.9s-12.5-7.9-16.4-13.8c-3.9-5.9-6.6-12.9-8.2-21c-1.6-8.1-2.3-17-2.3-26.6v-14H0v20.6c0,31.8,8.4,55.9,25.2,72.2c16.8,16.4,40.8,24.5,72,24.5c18.7,0,34.4-2.6,47-7.7c12.6-5.1,22.7-12,30.4-20.6c7.6-8.6,13.1-18.3,16.4-29.2c3.3-10.9,4.9-22,4.9-33.2v-27.1h-44.4V193.8z";
const J_BAR = "151.5,27 151.5,149.3 195.9,149.3 195.9,0";
const H = 620; // Akdital mark height (lockup unit)
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

type Refs = { head: React.RefObject<SVGCircleElement | null>; rim: React.RefObject<SVGCircleElement | null> };

/** The Akdital mark; the head of its top drop is a separate circle so it can open onto the Earth behind it. */
function Mark({ head, rim }: Refs) {
  return (
    <svg viewBox="0 0 620 620" width={H} height={H} className="shrink-0" aria-hidden>
      <defs>
        <linearGradient id="egg-ring" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1DB4EA" /><stop offset="1" stopColor="#0057A3" /></linearGradient>
        <linearGradient id="egg-drop" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1DA9E2" /><stop offset="1" stopColor="#0066B0" /></linearGradient>
        {/* one gradient over the whole top drop (head + tail), as in the original mark */}
        <linearGradient id="egg-top" gradientUnits="userSpaceOnUse" x1="0" y1="104" x2="0" y2="314"><stop offset="0" stopColor="#1DA9E2" /><stop offset="1" stopColor="#0066B0" /></linearGradient>
      </defs>
      <circle cx="310" cy="310" r="296" fill="none" stroke="url(#egg-ring)" strokeWidth="27" />
      <g fill="url(#egg-drop)">
        <path d="M208 252 C 226 278, 291 330, 291 380 A 83 83 0 1 1 125 380 C 125 330, 190 278, 208 252 Z" />
        <path d="M412 252 C 430 278, 495 330, 495 380 A 83 83 0 1 1 329 380 C 329 330, 394 278, 412 252 Z" />
      </g>
      {/* tail of the top drop, below the lower arc of its head */}
      <path d="M228 186 C 228 236, 292 288, 310 314 C 328 288, 392 236, 392 186 A 82 82 0 0 1 228 186 Z" fill="url(#egg-top)" />
      {/* the head: opaque far out (it masks the Earth), it opens as you zoom in */}
      <circle ref={head} cx={DROP.x} cy={DROP.y} r={DROP.r + 0.6} fill="url(#egg-top)" />
      <circle ref={rim} cx={DROP.x} cy={DROP.y} r={DROP.r + 2} fill="none" stroke="#1DA9E2" strokeWidth="4" opacity="0" />
    </svg>
  );
}

function Jabb() {
  return (
    <span className="flex items-end text-white" style={{ gap: H * 0.008 }}>
      <svg viewBox="0 0 196 291" height={H * 0.2} width={(H * 0.2 * 196) / 291} fill="#FFFFFF" className="shrink-0">
        <path d={J_PATH} /><polygon points={J_BAR} /><circle cx="32.7" cy="52" r="25" />
      </svg>
      <span style={{ fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontWeight: 700, fontStyle: "italic", fontSize: H * 0.167, lineHeight: 0.74, letterSpacing: "-0.01em", marginBottom: H * 0.012 }}>ABB</span>
    </span>
  );
}

export default function JabbEgg() {
  const box = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLDivElement>(null);
  const sub = useRef<HTMLDivElement>(null);
  const head = useRef<SVGCircleElement>(null);
  const rim = useRef<SVGCircleElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = box.current, m = mark.current;
      if (!el || !m) return;
      // drop centre inside the lockup, in unscaled units (offsets ignore the CSS transform)
      const dx = m.offsetLeft + DROP.x, dy = m.offsetTop + DROP.y;
      frame.eggW = el.offsetWidth;
      frame.eggDX = dx - el.offsetWidth / 2;
      frame.eggDY = dy - el.offsetHeight / 2;
      const o = frame.egg, k = frame.eggK;
      if (o <= 0.001 || k <= 0 || !frame.earth.visible) { el.style.visibility = "hidden"; return; }
      el.style.visibility = "visible";
      el.style.transform = `translate(${frame.earth.x - dx * k}px, ${frame.earth.y - dy * k}px) scale(${k})`;
      const open = sm(0.3, 0.6, o);                     // 1 = closed drop (Earth hidden), 0 = open onto the globe
      el.style.opacity = String(sm(0.08, 0.32, o));     // the logo flies past as you dive in
      if (head.current) head.current.style.opacity = String(open);
      if (rim.current) rim.current.style.opacity = String((1 - open) * 0.6);
      if (sub.current) sub.current.style.opacity = String(sm(0.5, 0.8, o));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className="pointer-events-none absolute inset-0 z-[6] overflow-hidden" aria-hidden>
      <div ref={box} className="absolute left-0 top-0 flex origin-top-left flex-col items-center whitespace-nowrap" style={{ width: "max-content", visibility: "hidden" }}>
        {/* Akdital, the client: mark + wordmark */}
        <div className="flex items-center">
          <div ref={mark} className="shrink-0"><Mark head={head} rim={rim} /></div>
          <span className="text-white" style={{ marginLeft: H * 0.16, fontSize: H * 0.46, fontWeight: 800, letterSpacing: "0.05em", lineHeight: 1 }}>AKDITAL</span>
        </div>
        {/* partners, smaller: mibtech × JABB */}
        <div ref={sub} className="flex items-center" style={{ marginTop: H * 0.12, gap: H * 0.11, opacity: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mibtech-reverse.svg" alt="" style={{ height: H * 0.15, width: H * 0.15 * 7.55 }} />
          <span className="text-white/45" style={{ fontSize: H * 0.17, fontWeight: 300, lineHeight: 1 }}>×</span>
          <Jabb />
        </div>
      </div>
    </div>
  );
}
