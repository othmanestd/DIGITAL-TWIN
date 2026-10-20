"use client";
// Global keyboard navigation + the "?" help overlay listing every gesture and shortcut.
import { useEffect } from "react";
import { useApp, type Section } from "@/lib/store";
import { DEPTS, DEPT, FLOORS, CASE_DEPT, floorKey } from "@/lib/hospital";
import { YEARS, type Year } from "@/lib/model";

const SECTIONS: Section[] = ["explorer", "synthese", "cas", "preuves", "gouvernance", "emplois", "deploiement", "sources"];
const orbit = (detail: { az?: number; pol?: number; panX?: number; panY?: number }) => window.dispatchEvent(new CustomEvent("atlas:orbit", { detail }));

/** Current floor key from the selection (floor, dept, person or case). */
function currentFloor(): string | null {
  const { sel } = useApp.getState();
  if (!sel) return null;
  if (sel.kind === "floor") return sel.id;
  const deptId = sel.kind === "dept" ? sel.id : sel.kind === "person" ? sel.id.split("/")[0] : sel.kind === "case" ? CASE_DEPT[sel.id] : null;
  const d = deptId ? DEPT[deptId] : null;
  return d ? floorKey(d.building, d.floor) : null;
}
function currentDept(): string | null {
  const { sel } = useApp.getState();
  if (!sel) return null;
  if (sel.kind === "dept") return sel.id;
  if (sel.kind === "person") return sel.id.split("/")[0];
  if (sel.kind === "case") return CASE_DEPT[sel.id] ?? null;
  return null;
}

/** Esc / Backspace: one step up (use case → department → floor → overview). */
export function goUp() {
  const s = useApp.getState();
  const sel = s.sel;
  if (!sel || sel.kind === "overview") return;
  if (s.caseId && sel.kind === "dept") { s.openCase(null); return; }
  if (sel.kind === "case" || sel.kind === "person") { const d = currentDept(); if (d) return s.select({ kind: "dept", id: d }); }
  if (sel.kind === "dept") { const f = currentFloor(); if (f) return s.select({ kind: "floor", id: f }); }
  if (sel.kind === "site") return s.select({ kind: "overview", id: "morocco" });
  s.select({ kind: "overview", id: s.level });
}

export default function Shortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey) return; // Ctrl+Space (voice), Ctrl+K (search) are handled by their owners
      const s = useApp.getState();
      const k = e.key;

      if (k === "?" || (k === "/" && e.shiftKey)) { e.preventDefault(); s.setHelpOpen(!s.helpOpen); return; }
      if (s.helpOpen) { if (k === "Escape") { e.preventDefault(); s.setHelpOpen(false); } return; }

      // sections: Alt+1…7
      if (e.altKey && /^[1-8]$/.test(k)) { e.preventDefault(); s.setSection(SECTIONS[Number(k) - 1]); return; }
      if (e.altKey) return;

      // overlays owned by the assistant handle Esc themselves
      const busy = s.chatOpen || s.tour.playing || s.voice !== "idle" || s.searchOpen;
      if ((k === "Escape" || k === "Backspace") && !busy) {
        e.preventDefault();
        if (s.section !== "explorer") s.setSection("explorer"); else goUp();
        return;
      }

      const step = e.shiftKey ? 0.05 : 0.14;
      switch (k) {
        case "+": case "=": e.preventDefault(); s.requestZoom({ delta: -step }); return;
        case "-": case "_": e.preventDefault(); s.requestZoom({ delta: step }); return;
        case "0": e.preventDefault(); s.select({ kind: "overview", id: s.level }); return;
        case "h": case "H": s.setLevel("hospital"); return;
        case "m": case "M": s.setLevel("morocco"); return;
        case "w": case "W": case "g": case "G": if (k.toLowerCase() === "g") { s.setPerSite(!s.perSite); return; } s.setLevel("world"); return;
        case "p": case "P": s.setPanelOpen(!s.panelOpen); return;
        case "t": case "T": window.dispatchEvent(new CustomEvent("atlas:tour")); return;
        case "q": case "Q": orbit({ az: -Math.PI / 10 }); return;
        case "e": case "E": orbit({ az: Math.PI / 10 }); return;
        case "r": case "R": orbit({ pol: -Math.PI / 18 }); return;
        case "f": case "F": orbit({ pol: Math.PI / 18 }); return;
        case "a": case "A": orbit({ panX: -1 }); return;
        case "d": case "D": orbit({ panX: 1 }); return;
        case "z": case "Z": orbit({ panY: 1 }); return;
        case "s": case "S": orbit({ panY: -1 }); return;
        case "[": case "]": {
          const i = YEARS.indexOf(s.year) + (k === "]" ? 1 : -1);
          if (i >= 0 && i < YEARS.length) s.setYear(YEARS[i] as Year);
          return;
        }
        case "ArrowUp": case "ArrowDown": case "PageUp": case "PageDown": {
          if (s.level !== "hospital") return;
          e.preventDefault();
          const keys = FLOORS.map((f) => floorKey(f.building, f.floor));
          const cur = currentFloor();
          const up = k === "ArrowUp" || k === "PageUp";
          const i = cur ? keys.indexOf(cur) + (up ? 1 : -1) : up ? 1 : 0;
          if (i >= 0 && i < keys.length) s.select({ kind: "floor", id: keys[i] });
          return;
        }
        case "ArrowLeft": case "ArrowRight": {
          if (s.level !== "hospital") { orbit({ az: (k === "ArrowLeft" ? -1 : 1) * Math.PI / 12 }); return; }
          e.preventDefault();
          const cur = currentDept();
          const fk = currentFloor();
          const pool = fk ? DEPTS.filter((d) => floorKey(d.building, d.floor) === fk) : DEPTS;
          const i = cur ? pool.findIndex((d) => d.id === cur) : -1;
          const n = pool.length;
          const j = i < 0 ? 0 : (i + (k === "ArrowRight" ? 1 : -1) + n) % n;
          s.select({ kind: "dept", id: pool[j].id });
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <HelpOverlay />;
}

const ROWS: [string, [string, string][]][] = [
  ["Zoom et caméra", [
    ["Molette · deux doigts", "Zoomer vers le curseur (rapide)"],
    ["Maj + molette", "Zoom fin"],
    ["Pincer (trackpad)", "Zoomer"],
    ["Glisser", "Tourner autour"],
    ["Clic droit + glisser", "Déplacer la vue"],
    ["+ / −", "Zoomer / dézoomer"],
    ["Q / E", "Tourner à gauche / à droite"],
    ["R / F", "Incliner haut / bas"],
    ["A D Z S", "Déplacer la vue"],
    ["0", "Recadrer la vue d'ensemble"],
    ["Continuer à dézoomer", "Hôpital → Maroc → Monde"],
  ]],
  ["Navigation", [
    ["H / M / W", "Hôpital / Maroc / Monde"],
    ["↑ / ↓", "Étage supérieur / inférieur"],
    ["← / →", "Service précédent / suivant"],
    ["Échap · Retour", "Remonter d'un niveau"],
    ["[ / ]", "Année précédente / suivante"],
    ["G", "Groupe ⇄ hôpital type"],
    ["P", "Afficher / masquer le panneau"],
    ["Alt + 1 … 8", "Sections : Explorer … Sources"],
  ]],
  ["Assistant", [
    ["Ctrl + K  ou  /", "Rechercher"],
    ["Ctrl + Espace", "Poser une question à la voix"],
    ["J", "Ouvrir Jabby"],
    ["T", "Lancer / arrêter la visite guidée"],
    ["?", "Afficher cette aide"],
  ]],
];

function HelpOverlay() {
  const open = useApp((s) => s.helpOpen);
  const setOpen = useApp((s) => s.setHelpOpen);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="glass-read w-[min(1040px,94vw)] max-h-[88dvh] overflow-hidden rounded-[22px] p-[clamp(18px,2.4vw,32px)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="eyebrow">Raccourcis</div>
            <h2 className="h-display mt-1 text-[clamp(20px,2vw,28px)]">Naviguer au clavier et au trackpad</h2>
          </div>
          <button className="rounded-full px-3 py-1.5 text-sm text-[var(--mut)] hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)}>Fermer · Échap</button>
        </div>
        <div className="grid gap-x-8 gap-y-2 md:grid-cols-3">
          {ROWS.map(([title, rows]) => (
            <div key={title}>
              <div className="eyebrow mb-2 text-[var(--blue)]">{title}</div>
              {rows.map(([keys, what]) => (
                <div key={keys} className="flex items-baseline justify-between gap-3 border-b border-white/[.06] py-[7px] text-[clamp(12px,0.85vw,14px)]">
                  <span className="text-[var(--txt-2)]">{what}</span>
                  <kbd className="whitespace-nowrap rounded-md border border-white/15 bg-white/[.06] px-1.5 py-0.5 font-mono text-[11.5px] text-white">{keys}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
