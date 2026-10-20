"use client";
// HTML labels over the 3D hospital: department chips (name + MDH or "soin humain"), floor chips in the overview and the
// hovered person's tooltip. One React DOM root for all labels (no per-label roots), positioned every frame from the
// R3F loop — calm, crisp text in Geist, never above the app's own UI (z-index 1 inside the stage).
import { useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { ANNEX, DEPT, DEPTS, FLOOR_H, KIND_COLOR, MAIN, type Dept } from "@/lib/hospital";
import { CASE, agg, fr } from "@/lib/model";
import { useApp } from "@/lib/store";
import { PERSON_BY_ID } from "./layout";
import { rt } from "./mats";
import { deptCenter, focusOf, toWorld } from "./nav";

type Align = "center" | "left" | "right" | "top";
type Opt = { prio?: number; cull?: boolean; align?: Align };
type Entry = { el: HTMLElement; pos: () => THREE.Vector3 | null; fade?: (dist: number) => number; opt: Opt };
const entries = new Map<string, Entry>();

function useEntry(key: string, on: boolean, pos: () => THREE.Vector3 | null, fade?: (d: number) => number, opt: Opt = {}) {
  const optRef = useRef(opt);
  optRef.current = opt;
  const ref = useRef<HTMLDivElement>(null);
  const posRef = useRef(pos), fadeRef = useRef(fade);
  posRef.current = pos; fadeRef.current = fade;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!on) { el.style.opacity = "0"; el.style.visibility = "hidden"; return; }
    const e: Entry = { el, pos: () => posRef.current(), fade: (d) => (fadeRef.current ? fadeRef.current(d) : 1), opt: optRef.current };
    Object.defineProperty(e, "opt", { get: () => optRef.current });
    entries.set(key, e);
    return () => { if (entries.get(key)?.el === el) entries.delete(key); el.style.opacity = "0"; el.style.visibility = "hidden"; };
  }, [key, on]);
  return ref;
}

const chip: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", userSelect: "none", fontFamily: "inherit",
  color: "#EDF0F7", letterSpacing: "-0.005em", backdropFilter: "blur(10px) saturate(140%)", WebkitBackdropFilter: "blur(10px) saturate(140%)",
  boxShadow: "0 6px 18px -8px rgba(0,0,0,0.6)",
};
const wrap: React.CSSProperties = { position: "absolute", left: 0, top: 0, opacity: 0, visibility: "hidden", transition: "opacity .35s ease, visibility .35s", willChange: "transform" };

// ---------------------------------------------------------------- department chip
function DeptChip({ d, on, focus }: { d: Dept; on: boolean; focus: string | null }) {
  const year = useApp((s) => s.year);
  const perSite = useApp((s) => s.perSite);
  const select = useApp((s) => s.select);
  const isFocus = focus === d.id, dim = !!focus && !isFocus;
  const v = useMemo(() => new THREE.Vector3(), []);
  const ref = useEntry("dept:" + d.id, on, () => {
    deptCenter(d.id, v);
    v.y += 2.1 + (rt.lift[`${d.building}:${d.floor}`] ?? 0) * 11;
    return toWorld(v);
  }, (dist) => (dist > (isFocus ? 150 : 110) ? 0 : dim ? 0.5 : 1), { prio: isFocus ? 3 : 1, cull: true, align: "center" });
  const has = d.cases.length > 0;
  const in302 = d.cases.filter((id) => CASE[id]?.in302 !== false);
  const outN = d.cases.length - in302.length;
  const mdh = in302.length ? agg(in302, year, perSite).mdh : 0;
  return (
    <div ref={ref} style={wrap}>
      <div
        onClick={() => { rt.clickHandled = true; select({ kind: "dept", id: d.id }); }}
        style={{
          ...chip, transform: "translate(-50%, -50%)", pointerEvents: on ? "auto" : "none", cursor: "pointer",
          padding: "4px 10px 4px 8px", borderRadius: 999, fontSize: isFocus ? 13 : 12, lineHeight: "16px", fontWeight: 500,
          background: isFocus ? "rgba(22,30,62,0.8)" : "rgba(12,18,38,0.6)",
          border: `1px solid ${isFocus ? "rgba(142,164,255,0.55)" : "rgba(255,255,255,0.12)"}`,
        }}
      >
        <span style={{ width: 6, height: 6, borderRadius: 6, background: KIND_COLOR[d.kind] }} />
        <span>{d.short}</span>
        {has && <span style={{ color: "#8D97B0", fontSize: 11 }}>{d.cases.length} cas</span>}
        {in302.length > 0 && (
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: mdh > 0 ? "#BFEBD7" : "#8D97B0" }}>{fr(mdh, 1)} MDH</span>
        )}
        {outN > 0 && (
          <span style={{ fontSize: 10.5, color: "#C9C2F0", padding: "1px 6px", borderRadius: 999, background: "rgba(155,140,224,0.18)" }}>
            {in302.length ? `+${outN} hors masse salariale` : "hors masse salariale"}
          </span>
        )}
        {!has && (
          <span style={{ fontSize: 10.5, color: "#A9D6CF", padding: "1px 6px", borderRadius: 999, background: "rgba(95,179,168,0.16)" }}>soin humain</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- floor chips (overview)
const CHIPS: { key: string; n: string; t: string }[] = [
  { key: "main:4", n: "4", t: "Qualité · Jumeau numérique" },
  { key: "main:3", n: "3", t: "Hospitalisation" },
  { key: "main:2", n: "2", t: "Bloc · Réanimation · Maternité" },
  { key: "main:1", n: "1", t: "Consultations · Facturation" },
  { key: "main:0", n: "RDC", t: "Accueil · Admissions · Urgences" },
  { key: "main:-1", n: "−1", t: "Logistique · Pharmacie" },
  { key: "annex:3", n: "3", t: "Agentic Command Center" },
  { key: "annex:2", n: "2", t: "Ressources humaines" },
  { key: "annex:1", n: "1", t: "Finance" },
  { key: "annex:0", n: "0", t: "Services généraux" },
];

function FloorChip({ c, on }: { c: (typeof CHIPS)[number]; on: boolean }) {
  const select = useApp((s) => s.select);
  const [b, fs] = c.key.split(":");
  const fl = Number(fs), main = b === "main";
  const p = useMemo(() => new THREE.Vector3(
    main ? MAIN.x - MAIN.w / 2 - 1.0 : ANNEX.x + ANNEX.w / 2 + 1.0,
    fl * FLOOR_H + (fl < 0 ? 2.6 : 2.0),
    main ? MAIN.z + MAIN.d / 2 + 0.6 : ANNEX.z + ANNEX.d / 2 + 0.6,
  ), [main, fl]);
  const w = useMemo(() => new THREE.Vector3(), []);
  const ref = useEntry("floorchip:" + c.key, on, () => toWorld(w.copy(p)), (d) => (d > 420 ? 0 : 1), { prio: 1, cull: true, align: main ? "right" : "left" });
  return (
    <div ref={ref} style={wrap}>
      <button
        onClick={() => { rt.clickHandled = true; select({ kind: "floor", id: c.key }); }}
        onMouseEnter={() => { rt.hoverFloor = c.key; }}
        onMouseLeave={() => { if (rt.hoverFloor === c.key) rt.hoverFloor = null; }}
        style={{
          ...chip, pointerEvents: on ? "auto" : "none", cursor: "pointer", transform: main ? "translate(-100%, -50%)" : "translate(0, -50%)",
          flexDirection: main ? "row-reverse" : "row", padding: main ? "3px 3px 3px 10px" : "3px 10px 3px 3px", borderRadius: 999,
          fontSize: 11.5, lineHeight: "15px", color: "#DCE2EE", background: "rgba(12,18,38,0.52)", border: "1px solid rgba(255,255,255,0.11)",
        }}
      >
        <span style={{ minWidth: 26, height: 18, borderRadius: 999, display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600, color: "#EDF0F7", background: main ? "rgba(255,255,255,0.13)" : "rgba(155,140,224,0.3)", padding: "0 6px" }}>{c.n}</span>
        <span>{main ? c.t : `Siège · ${c.t}`}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- person tooltip
function PersonTip() {
  const hover = useApp((s) => s.hover);
  const id = hover?.startsWith("person:") ? hover.slice(7) : null;
  const rec = id ? PERSON_BY_ID[id] : null;
  const v = useMemo(() => new THREE.Vector3(), []);
  const ref = useEntry("persontip", !!rec, () => {
    const p = id ? rt.pos.get(id) : null;
    if (!p || !rec) return null;
    return v.copy(p).add(new THREE.Vector3(0, rec.p.slot.pose === "lie" ? 0.75 : 1.1, 0));
  });
  return (
    <div ref={ref} style={{ ...wrap, transition: "opacity .18s ease, visibility .18s" }}>
      {rec && (
        <div style={{
          ...chip, display: "block", transform: "translate(-50%, -100%)", padding: "6px 11px", borderRadius: 11, fontSize: 12, lineHeight: "15px",
          background: "rgba(12,18,38,0.76)", border: "1px solid rgba(255,255,255,0.14)", pointerEvents: "none",
        }}>
          <div style={{ fontWeight: 600 }}>{rec.p.label}</div>
          <div style={{ color: "#8D97B0", fontSize: 11 }}>{DEPT[rec.p.dept]?.short}</div>
        </div>
      )}
    </div>
  );
}

/** Discreet caption near the ground floor when the timeline year changes (fades after 3 s). */
function YearCaption({ on }: { on: boolean }) {
  const year = useApp((s) => s.year);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    rt.yearChangedAt = performance.now();
  }, [year]);
  const p = useMemo(() => new THREE.Vector3(), []);
  const ref = useEntry("year-caption", on, () => {
    if (rt.yearChangedAt < 0) return null;
    const dt = (performance.now() - rt.yearChangedAt) / 1000;
    if (dt > 4) return null;
    return toWorld(p.set(MAIN.x - 1, 7.4, MAIN.z + MAIN.d / 2 + 4.5));
  }, (dist) => {
    const dt = (performance.now() - rt.yearChangedAt) / 1000;
    const a = dt < 0.4 ? dt / 0.4 : dt < 3 ? 1 : Math.max(0, 1 - (dt - 3) / 0.8);
    return dist > 420 ? 0 : a;
  }, { prio: 5, cull: false, align: "center" });
  return (
    <div ref={ref} style={{ ...wrap, transition: "none" }}>
      <div style={{
        ...chip, display: "block", transform: "translate(-50%, -100%)", maxWidth: 440, whiteSpace: "normal", textAlign: "center",
        padding: "7px 13px", borderRadius: 12, fontSize: 12.5, lineHeight: "17px", fontWeight: 500,
        background: "rgba(12,18,38,0.7)", border: "1px solid rgba(142,164,255,0.35)", pointerEvents: "none",
      }}>
        Moins de postes : départs non remplacés et mobilités vers les ouvertures — <span style={{ color: "#BFEBD7", fontWeight: 600 }}>zéro licenciement</span>
      </div>
    </div>
  );
}

function OverlayUI() {
  const sel = useApp((s) => s.sel);
  const level = useApp((s) => s.level);
  const f = focusOf(sel);
  const live = level === "hospital";
  return (
    <>
      {DEPTS.map((d) => <DeptChip key={d.id} d={d} on={live && f.floor === `${d.building}:${d.floor}`} focus={f.dept} />)}
      {CHIPS.map((c) => <FloorChip key={c.key} c={c} on={live && !f.floor} />)}
      <PersonTip />
      <YearCaption on={live} />
    </>
  );
}

/** Mounted inside the R3F scene: owns the DOM layer and positions every label each frame. */
export default function Overlay() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const div = document.createElement("div");
    div.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1;";
    host.appendChild(div);
    const root = createRoot(div);
    root.render(<OverlayUI />);
    return () => { setTimeout(() => { root.unmount(); div.remove(); }, 0); };
  }, [gl]);
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const shown: { e: Entry; x: number; y: number; o: number }[] = [];
    for (const e of entries.values()) {
      const p = e.pos();
      if (!p) { e.el.style.opacity = "0"; e.el.style.visibility = "hidden"; continue; }
      const dist = camera.position.distanceTo(p);
      v.copy(p).project(camera);
      const inFront = v.z < 1 && v.z > -1;
      const o = inFront ? (e.fade ? e.fade(dist) : 1) : 0;
      const x = ((v.x + 1) / 2) * size.width, y = ((1 - v.y) / 2) * size.height;
      e.el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      shown.push({ e, x, y, o });
    }
    // declutter: higher-priority chips first, any chip overlapping an already placed one is hidden
    shown.sort((a, b) => (b.e.opt.prio ?? 0) - (a.e.opt.prio ?? 0));
    const placed: [number, number, number, number][] = [];
    for (const s of shown) {
      let o = s.o;
      if (o > 0.01 && s.e.opt.cull) {
        const c = s.e.el.firstElementChild as HTMLElement | null;
        const w = c?.offsetWidth ?? 0, h = c?.offsetHeight ?? 0;
        const al = s.e.opt.align ?? "center";
        const x0 = al === "center" ? s.x - w / 2 : al === "right" ? s.x - w : s.x;
        const y0 = s.y - h / 2;
        const r: [number, number, number, number] = [x0 - 3, y0 - 2, x0 + w + 3, y0 + h + 2];
        if (placed.some((q) => r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1])) o = 0;
        else placed.push(r);
      }
      s.e.el.style.opacity = String(o);
      s.e.el.style.visibility = o < 0.01 ? "hidden" : "visible";
    }
  });
  return null;
}
