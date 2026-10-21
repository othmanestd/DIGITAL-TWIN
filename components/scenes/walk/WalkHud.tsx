"use client";
// Walk mode UI (DOM, French): the dock button "À pied", the controls card (fades after a few seconds), where the visitor
// is (building · floor), the "E" prompt for the department in front of them, and a discreet centre dot in first person.
import { useEffect, useRef, useState } from "react";
import { DEPT } from "@/lib/hospital";
import { CASE } from "@/lib/model";
import { useApp } from "@/lib/store";
import { TOUCH, walkRequest } from "./state";

function WalkIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="13" cy="4.2" r="1.9" />
      <path d="M10.2 21l2.1-6.1 2.6 2.4V21" />
      <path d="M8.2 11.6l2.3-3.3 3.6.4 2.2 3.1 2.4.9" />
      <path d="M12.4 14.9l-1.4-6.4" />
      <path d="M10.5 8.3L7 13.4" />
    </svg>
  );
}

/** Dock button (components/ai/Dock.tsx), next to "Visite guidée" and "Jabby". */
export function WalkButton() {
  const phase = useApp((s) => s.walk.phase);
  const on = phase !== "off";
  return (
    <>
    {/* the dock is shared with the guided tour and Jabby: the label shows only where the bottom bar leaves room */}
    <style>{"@media (max-width: 1499px) { .jb-walk { width: 46px; padding: 0 !important; justify-content: center; } .jb-walk .lbl, .jb-walk .jb-kbd { display: none; } }"}</style>
    <button className="jb-btn glass jb-walk" data-anchor="ai:walk" data-active={on}
      onClick={(e) => { e.currentTarget.blur(); walkRequest("toggle"); }}
      title={on ? "Revenir à la vue d'ensemble (Échap)" : "Se promener à pied (B)"}>
      <span className="ico blue"><WalkIcon size={16} /></span>
      <span className="lbl">{on ? "Vue d'ensemble" : "À pied"}</span>
      <span className="jb-kbd">B</span>
    </button>
    </>
  );
}

const glass: React.CSSProperties = {
  background: "rgba(12,18,38,0.62)", border: "1px solid rgba(255,255,255,0.12)", color: "#EDF0F7",
  backdropFilter: "blur(12px) saturate(140%)", WebkitBackdropFilter: "blur(12px) saturate(140%)",
  boxShadow: "0 10px 30px -14px rgba(0,0,0,0.7)",
};
const kbd: React.CSSProperties = {
  display: "inline-block", minWidth: 20, padding: "1px 6px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.06)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, lineHeight: "17px", textAlign: "center", color: "#fff",
};
const ROWS: [string, string][] = [
  ["Z Q S D · flèches", "marcher"],
  ["Maj", "courir"],
  ["Espace", "petit saut"],
  ["Souris", "regarder (clic pour la capturer)"],
  ["Molette", "rapprocher la caméra"],
  ["V", "vue 1re / 3e personne"],
  ["E", "ouvrir / fermer les cas"],
  ["Échap", "libérer la souris · quitter"],
];
const label = (where: string | null, floor: number, tower: boolean) => {
  if (!where) return "Extérieur · parvis de l'hôpital";
  const b = where === "main" ? "Bâtiment principal" : "Siège";
  const f = floor === 0 ? "rez-de-chaussée" : floor === 1 ? "1er étage" : `${floor}e étage`;
  return tower ? `${b} · escalier, ${f}` : `${b} · ${f}`;
};

/** Left-thumb joystick for touch screens (look around by dragging anywhere on the scene). */
function Joystick() {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null);
  const id = useRef<number | null>(null);
  const R = 46;
  const move = (e: React.PointerEvent) => {
    if (id.current !== e.pointerId || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > R) { dx *= R / l; dy *= R / l; }
    TOUCH.x = dx / R; TOUCH.y = -dy / R;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const end = () => { id.current = null; TOUCH.x = 0; TOUCH.y = 0; if (knob.current) knob.current.style.transform = "none"; };
  useEffect(() => end, []);
  return (
    <div ref={base} className="pointer-events-auto" style={{ ...glass, position: "absolute", left: 26, bottom: 96, width: 128, height: 128, borderRadius: 128, touchAction: "none", display: "grid", placeItems: "center" }}
      onPointerDown={(e) => { id.current = e.pointerId; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e); }}
      onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
      <div ref={knob} style={{ width: 52, height: 52, borderRadius: 52, background: "linear-gradient(145deg, rgba(91,124,255,.75), rgba(54,81,232,.7))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }} />
    </div>
  );
}

/** HUD layer inside the stage (AtlasApp). */
export default function WalkHud() {
  const walk = useApp((s) => s.walk);
  const panel = useApp((s) => s.panelOpen && !!s.sel && s.sel.kind !== "overview");
  const [hint, setHint] = useState(false);
  const [touch, setTouch] = useState(false);
  useEffect(() => { setTouch(typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches); }, []);
  useEffect(() => {
    if (walk.phase !== "on") { setHint(false); return; }
    setHint(true);
    const t = setTimeout(() => setHint(false), 7500);
    return () => clearTimeout(t);
  }, [walk.phase]);
  if (walk.phase === "off") return null;
  const entering = walk.phase === "enter";
  const near = walk.near ? DEPT[walk.near] : null;
  const nc = walk.nearCase ? CASE[walk.nearCase] : null;
  const title = nc?.titre ? (nc.titre.length > 46 ? nc.titre.slice(0, 44).trimEnd() + "…" : nc.titre) : "";
  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-live="polite">
      {/* where the visitor is */}
      <div style={{ ...glass, position: "absolute", top: 84, left: "50%", transform: "translateX(-50%)", padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 500, whiteSpace: "nowrap", transition: "opacity .4s", opacity: entering ? 0 : 1 }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: "#8EA4FF", marginRight: 8, verticalAlign: 1 }} />
        {label(walk.where, walk.floor, walk.tower)}
      </div>
      {entering && (
        <div style={{ ...glass, position: "absolute", top: 84, left: "50%", transform: "translateX(-50%)", padding: "7px 15px", borderRadius: 999, fontSize: 12.5, whiteSpace: "nowrap" }}>
          À pied, devant l&apos;entrée principale…
        </div>
      )}
      {touch && walk.phase === "on" && <Joystick />}
      {/* controls card */}
      <div style={{ ...glass, display: touch ? "none" : "block", position: "absolute", left: 16, bottom: 132, width: 286, padding: "14px 16px 12px", borderRadius: 16, transition: "opacity .8s ease, transform .8s ease", opacity: hint ? 1 : 0, transform: hint ? "none" : "translateY(8px)" }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".12em", textTransform: "uppercase", color: "#9CB0FF", fontWeight: 600, marginBottom: 8 }}>À pied</div>
        {ROWS.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", padding: "3.5px 0", fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ color: "#C9D0DE" }}>{v}</span>
            <span style={kbd}>{k}</span>
          </div>
        ))}
      </div>
      {/* E prompt */}
      {panel && walk.phase === "on" && (
        <div className="pointer-events-auto" role="button" onClick={() => useApp.getState().select({ kind: "overview", id: "hospital" }, { focus: false })}
          style={{ ...glass, cursor: "pointer", position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)", padding: "7px 14px 7px 8px", borderRadius: 999, fontSize: 13, display: "flex", gap: 9, alignItems: "center", whiteSpace: "nowrap" }}>
          <span style={{ ...kbd, minWidth: 24 }}>E</span>
          <span>Fermer le panneau</span>
        </div>
      )}
      {near && walk.phase === "on" && !panel && (
        <div className="pointer-events-auto" role="button" onClick={() => useApp.getState().select(nc ? { kind: "case", id: nc.id } : { kind: "dept", id: near.id }, { focus: false })}
          style={{ ...glass, cursor: "pointer", position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)", padding: "7px 14px 7px 8px", borderRadius: 999, fontSize: 13, display: "flex", gap: 9, alignItems: "center", whiteSpace: "nowrap" }}>
          <span style={{ ...kbd, background: "linear-gradient(145deg, #5B7CFF, #3651E8)", border: "none", minWidth: 24 }}>E</span>
          {nc
            ? <span>Cas <b style={{ fontWeight: 600 }}>{nc.id}</b> · {title}</span>
            : <span>Ouvrir <b style={{ fontWeight: 600 }}>{near.short}</b> · ses cas d&apos;usage</span>}
        </div>
      )}
      {/* first person: centre dot */}
      {walk.view === "first" && walk.phase === "on" && (
        <div style={{ position: "absolute", left: "50%", top: "50%", width: 5, height: 5, marginLeft: -2.5, marginTop: -2.5, borderRadius: 5, background: "rgba(255,255,255,0.75)", boxShadow: "0 0 0 1px rgba(10,14,30,0.35)" }} />
      )}
    </div>
  );
}
