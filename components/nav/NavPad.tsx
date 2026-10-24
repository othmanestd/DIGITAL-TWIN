"use client";
// Small navigation control centre (top right, above the zoom slider): four arrows to move the view, a compass that turns
// with the camera (click = north up), + / − zoom, and a "?" that shows the navigation shortcuts on hover.
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import * as THREE from "three";
import { rig, EARTH_CENTER } from "@/lib/rig";
import { tone } from "@/lib/ui/tone";
const tgt = new THREE.Vector3();
const NAV_HELP: [string, string][] = [
  ["Molette · 2 doigts", "Zoomer vers le curseur"],
  ["Pincer", "Zoomer (trackpad)"],
  ["Glisser", "Tourner autour"],
  ["Clic droit + glisser", "Déplacer la vue"],
  ["Flèches · A D Z S", "Déplacer la vue"],
  ["Q / E", "Tourner à gauche / à droite"],
  ["R / F", "Incliner haut / bas"],
  ["+ / −", "Zoomer / dézoomer"],
  ["Boussole", "Remettre le nord en haut"],
  ["0", "Recadrer la vue"],
  ["H · C · M · W", "Hôpital · Casablanca · Maroc · Monde"],
  ["Échap", "Remonter d'un niveau"],
];

const send = (detail: { panX?: number; panY?: number; az?: number; pol?: number }) => window.dispatchEvent(new CustomEvent("atlas:orbit", { detail }));

function Arrow({ dir }: { dir: "up" | "down" | "left" | "right" }) {
  const r = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${r}deg)` }}>
      <path d="M6 14l6-6 6 6" />
    </svg>
  );
}

export default function NavPad() {
  const requestZoom = useApp((s) => s.requestZoom);
  const needle = useRef<SVGGElement>(null);
  const [help, setHelp] = useState(false);
  const hold = useRef<ReturnType<typeof setInterval> | null>(null);

  // the compass needle follows the camera azimuth (north = −Z on the map)
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = rig.controls;
      if (!c || !needle.current) return;
      // around the globe the camera's up is the pole axis, so north is always up there
      const globe = c.getTarget(tgt).distanceTo(EARTH_CENTER) < 2e5;
      needle.current.setAttribute("transform", `rotate(${globe ? 0 : (c.azimuthAngle * 180) / Math.PI} 32 32)`);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // press = one step, hold = continuous move
  const press = (d: Parameters<typeof send>[0]) => {
    send(d);
    if (hold.current) clearInterval(hold.current);
    hold.current = setInterval(() => send({ panX: (d.panX ?? 0) * 0.35, panY: (d.panY ?? 0) * 0.35 }), 90);
  };
  const release = () => { if (hold.current) { clearInterval(hold.current); hold.current = null; } };
  useEffect(() => release, []);

  const btn = "tone-adapt absolute grid h-7 w-7 place-items-center rounded-full";
  const pill = "tone-adapt grid h-7 w-7 place-items-center rounded-full text-[15px] font-semibold";
  return (
    <div className="pointer-events-auto relative flex flex-col items-center gap-1.5" aria-label="Navigation">
      {help && (
        <div className="glass-read absolute right-[calc(100%+14px)] top-0 z-50 w-[288px] rounded-2xl p-3 text-left" onMouseEnter={() => setHelp(true)} onMouseLeave={() => setHelp(false)}>
          <div className="eyebrow mb-1.5 text-[var(--blue)]">Se déplacer</div>
          {NAV_HELP.map(([k, what]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/[.06] py-[4px] text-[12px] last:border-0">
              <span className="text-[var(--txt-2)]">{what}</span>
              <kbd className="whitespace-nowrap rounded-md border border-white/15 bg-white/[.06] px-1.5 py-0.5 font-mono text-[10.5px] text-white">{k}</kbd>
            </div>
          ))}
          <div className="mt-1.5 text-[11px] text-[var(--mut)]">Cliquez sur « ? » pour tous les raccourcis.</div>
        </div>
      )}
      {/* direction pad + compass */}
      <div className="glass relative rounded-full" style={{ width: 96, height: 96 }} onPointerUp={release} onPointerLeave={release}>
        <button className={`${btn} left-1/2 top-1 -translate-x-1/2`} onPointerDown={() => press({ panY: 1 })} ref={tone} data-anchor="nav:up" title="Déplacer vers le haut (Z)"><Arrow dir="up" /></button>
        <button className={`${btn} bottom-1 left-1/2 -translate-x-1/2`} onPointerDown={() => press({ panY: -1 })} ref={tone} data-anchor="nav:down" title="Déplacer vers le bas (S)"><Arrow dir="down" /></button>
        <button className={`${btn} left-1 top-1/2 -translate-y-1/2`} onPointerDown={() => press({ panX: -1 })} ref={tone} data-anchor="nav:left" title="Déplacer vers la gauche (A)"><Arrow dir="left" /></button>
        <button className={`${btn} right-1 top-1/2 -translate-y-1/2`} onPointerDown={() => press({ panX: 1 })} ref={tone} data-anchor="nav:right" title="Déplacer vers la droite (D)"><Arrow dir="right" /></button>
        <button
          className="absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[rgba(8,12,30,.55)] ring-1 ring-white/15 transition hover:ring-[var(--blue)]"
          onClick={() => window.dispatchEvent(new Event("atlas:north"))}
          data-anchor="nav:north"
          title="Boussole : remettre le nord en haut"
        >
          <svg viewBox="0 0 64 64" width="34" height="34">
            <circle cx="32" cy="32" r="29" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" />
            <g ref={needle}>
              <path d="M32 8 L38 32 L32 29 L26 32 Z" fill="#E07A6F" />
              <path d="M32 56 L26 32 L32 35 L38 32 Z" fill="rgba(230,236,255,.85)" />
              <text x="32" y="6.5" textAnchor="middle" fontSize="8" fontWeight="700" fill="#E6ECFF" style={{ fontFamily: "var(--font-geist-mono), monospace" }}>N</text>
            </g>
          </svg>
        </button>
      </div>
      {/* zoom + help */}
      <div className="glass flex items-center gap-0.5 rounded-full px-1 py-0.5">
        <button className={pill} onClick={() => requestZoom({ delta: 0.16 })} title="Dézoomer (−)" ref={tone} data-anchor="nav:zoom-out">−</button>
        <button className={pill} onClick={() => requestZoom({ delta: -0.16 })} title="Zoomer (+)" ref={tone} data-anchor="nav:zoom-in">+</button>
        <span onMouseEnter={() => setHelp(true)} onMouseLeave={() => setHelp(false)}>
          <button className={pill} ref={tone} data-anchor="nav:help" aria-label="Raccourcis de navigation" onClick={() => useApp.getState().setHelpOpen(true)}>?</button>
        </span>
      </div>
    </div>
  );
}
