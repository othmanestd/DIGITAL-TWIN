"use client";
// "Explorer les établissements": a compact panel next to the left rail listing the Akdital establishments of Casablanca and
// Bouskoura, Mibtech and the network's establishments elsewhere (lib/geo/places.ts). Search, city and category filters,
// statuses that never claim more than the sources say; "Localiser" flies the shared camera (./locate.ts) and opens the card.
// The selection is the store's: a click on a place in the scene (its "Découvrir") highlights the same row.
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { CASA_REEL } from "@/lib/geo/casaFrame";
import { EXPLORER_PLACES, COORD_LABEL, MODEL_LABEL, hasPoint, explorerPlace, type ExplorerPlace, type PlaceCategory } from "@/lib/geo/places";
import { I } from "@/components/ui/icons";
import { norm } from "@/lib/ui/fmt";
import s from "@/components/ui/styles";
import { locatePlace, openInCasaReel, type LocateResult } from "./locate";

type Cat = "all" | "hopital" | "clinique" | "onco" | "partenaire" | "mibtech";
const CATS: { id: Cat; label: string; test: (p: ExplorerPlace) => boolean }[] = [
  { id: "all", label: "Tous", test: () => true },
  { id: "hopital", label: "Hôpitaux Akdital", test: (p) => p.brand === "Akdital" && p.category === "Hôpital" },
  { id: "clinique", label: "Cliniques Akdital", test: (p) => p.brand === "Akdital" && p.category === "Clinique" },
  { id: "onco", label: "Centres d'oncologie Akdital", test: (p) => p.brand === "Akdital" && p.category === "Centre d'oncologie" },
  { id: "partenaire", label: "Bâtiments partenaires", test: (p) => p.category === "Bâtiment partenaire" },
  { id: "mibtech", label: "Mibtech", test: (p) => p.brand === "Mibtech" },
];
type CityF = "all" | "casablanca" | "bouskoura" | "autres";
const CITY_F: { id: CityF; label: string; test: (p: ExplorerPlace) => boolean }[] = [
  { id: "all", label: "Toutes les villes", test: () => true },
  { id: "casablanca", label: "Casablanca", test: (p) => p.city === "Casablanca" },
  { id: "bouskoura", label: "Bouskoura", test: (p) => p.city === "Bouskoura" },
  { id: "autres", label: "Autres villes", test: (p) => p.city !== "Casablanca" && p.city !== "Bouskoura" },
];
const CAT_SHORT: Record<PlaceCategory, string> = { "Hôpital": "Hôpital", Clinique: "Clinique", "Centre d'oncologie": "Oncologie", "Bâtiment partenaire": "Partenaire", "Établissement": "Établissement" };

/** visual state of a row: what is known, never more */
function tone(p: ExplorerPlace): { dot: string; label: string } {
  if (hasPoint(p) && (p.model3D === "detailed" || p.model3D === "osm-volume")) return { dot: "#3FD49A", label: "Position et volume 3D" };
  if (hasPoint(p) && p.coordinateVerified) return { dot: "#5B9BFF", label: "Position vérifiée, pas de bâtiment 3D" };
  if (hasPoint(p)) return { dot: "#F2B84B", label: "Position à vérifier" };
  return { dot: "#8A94A6", label: p.coordinateStatus === "city" ? "Ville seulement" : "Localisation à vérifier" };
}

const MESSAGE: Record<LocateResult, (p: ExplorerPlace) => string | null> = {
  flying: (p) => (p.model3D === "marker" ? "Modèle 3D pas encore disponible : un marqueur indique la position." : null),
  facility: () => null,
  morocco: () => "Position du bâtiment non disponible : l'établissement est montré sur la carte du Maroc.",
  "needs-reel": () => "Les positions réelles sont dans la vue Casa réel.",
  "no-point": () => "Localisation à vérifier : la caméra ne se déplace pas.",
  unknown: () => null,
};

export default function PlacesExplorer() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Cat>("all");
  const [city, setCity] = useState<CityF>("casablanca");
  const [msg, setMsg] = useState<{ id: string; text: string; reel?: boolean } | null>(null);
  const sel = useApp((st) => st.sel);
  const setLevel = useApp((st) => st.setLevel);
  const selected = sel?.kind === "landmark" || sel?.kind === "facility" ? sel.id : sel?.kind === "site" ? `site:${sel.id}` : null;
  const listRef = useRef<HTMLDivElement>(null);

  const list = useMemo(() => {
    const n = norm(q.trim());
    const c = CATS.find((x) => x.id === cat)!, v = CITY_F.find((x) => x.id === city)!;
    return EXPLORER_PLACES.filter((p) => c.test(p) && v.test(p) && (!n || norm(`${p.name} ${p.officialName} ${p.city} ${p.district ?? ""} ${p.category}`).includes(n)));
  }, [q, cat, city]);

  const locate = (p: ExplorerPlace) => {
    const r = locatePlace(p.id);
    const text = MESSAGE[r](p);
    setMsg(text ? { id: p.id, text, reel: r === "needs-reel" } : null);
    // the card opens on the right: on a narrow screen, fold the list so the map stays visible (the card repeats the message)
    if (window.innerWidth < 1500 && r !== "needs-reel" && r !== "no-point") setOpen(false);
  };

  // ?lieu=<id> (after "Ouvrir en Casa réel"): fly once the opening flight of the scene is over
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("lieu");
    if (!id || !explorerPlace(id)) return;
    setOpen(true);
    const t = setTimeout(() => { locatePlace(id); if (window.innerWidth < 1500) setOpen(false); }, 9200);
    return () => clearTimeout(t);
  }, []);
  // a place selected in the scene: bring its row into view
  useEffect(() => {
    if (!open || !selected) return;
    listRef.current?.querySelector(`[data-place="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, selected]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} data-anchor="places:open" aria-expanded={false}
        className={`${s.rail} fixed left-[136px] top-[84px] z-20 flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px] font-medium text-white`}>
        <I.pin size={15} /> Établissements
      </button>
    );
  }
  return (
    <section aria-label="Explorer les établissements" data-anchor="places"
      className={`${s.rail} fixed left-[136px] top-[84px] z-20 flex max-h-[calc(100dvh-200px)] w-[min(340px,calc(100vw-152px))] flex-col overflow-hidden rounded-[18px] text-[var(--txt)]`}>
      <header className="flex items-start gap-2 px-3.5 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[13.5px] font-semibold text-white">Explorer les établissements</h2>
          <p className="text-[11.5px] text-[var(--mut)]">Akdital · Mibtech · Casablanca</p>
        </div>
        <button type="button" onClick={() => setLevel("city")} data-anchor="places:city" title="Vue générale de Casablanca"
          className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11.5px] text-[var(--txt-2)] ring-1 ring-white/[0.08] hover:bg-white/[0.15] hover:text-white">Vue Casablanca</button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Réduire le panneau" data-anchor="places:close"
          className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.07] text-[var(--txt-2)] hover:bg-white/[0.15] hover:text-white"><I.close size={14} /></button>
      </header>
      <div className="flex flex-col gap-2 px-3.5 pb-2">
        <label className="flex items-center gap-2 rounded-[10px] bg-black/25 px-2.5 py-1.5 ring-1 ring-white/[0.08] focus-within:ring-[#5B7CFF]">
          <I.search size={14} className="text-[var(--mut)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un établissement" aria-label="Rechercher un établissement"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-white outline-none placeholder:text-[var(--mut)]" />
        </label>
        <div className="flex gap-1.5">
          <select value={city} onChange={(e) => setCity(e.target.value as CityF)} aria-label="Ville"
            className="min-w-0 flex-1 rounded-[9px] bg-black/25 px-2 py-1 text-[12px] text-white ring-1 ring-white/[0.08]">
            {CITY_F.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value as Cat)} aria-label="Catégorie"
            className="min-w-0 flex-1 rounded-[9px] bg-black/25 px-2 py-1 text-[12px] text-white ring-1 ring-white/[0.08]">
            {CATS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      </div>
      <div ref={listRef} className={`${s.thinScroll} min-h-0 flex-1 overflow-y-auto px-2 pb-2`} role="list">
        {list.length === 0 && <p className="px-2 py-3 text-[12px] text-[var(--mut)]">Aucun établissement ne correspond.</p>}
        {list.map((p) => {
          const on = selected === p.id, t = tone(p);
          const canFly = p.model3DId || p.coordinateStatus === "city" || hasPoint(p);
          return (
            <div key={p.id} role="listitem" data-place={p.id}
              className={`mb-1 rounded-[12px] px-2.5 py-2 transition-colors ${on ? "bg-[rgba(91,124,255,.24)] ring-1 ring-[rgba(140,165,255,.7)]" : "hover:bg-white/[0.05]"}`}>
              <div className="flex items-start gap-2">
                <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: t.dot }} title={t.label} aria-label={t.label} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-white" title={p.officialName}>{p.name}</div>
                  <div className="truncate text-[11px] text-[var(--mut)]">{p.city}{p.district ? ` · ${p.district}` : ""} · {CAT_SHORT[p.category]}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10.5px]">
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-[1px] text-[var(--txt-2)]">{COORD_LABEL[p.coordinateStatus]}</span>
                    <span className="rounded-full bg-white/[0.06] px-1.5 py-[1px] text-[var(--txt-2)]">{MODEL_LABEL[p.model3D]}</span>
                  </div>
                </div>
                <button type="button" onClick={() => locate(p)} data-anchor={`places:locate:${p.id}`}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-medium ring-1 ${canFly ? "bg-[#5B7CFF]/25 text-white ring-[#8CA5FF]/50 hover:bg-[#5B7CFF]/45" : "bg-white/[0.05] text-[var(--txt-2)] ring-white/[0.08] hover:bg-white/[0.1]"}`}
                  title={canFly ? "Localiser sur la carte" : "Voir la fiche (localisation à vérifier)"}>
                  {canFly ? "Localiser" : "Fiche"}
                </button>
              </div>
              {msg?.id === p.id && (
                <p className="mt-1.5 text-[11px] leading-snug text-[#F2D38B]" role="status">
                  {msg.text}
                  {msg.reel && !CASA_REEL && <> <button type="button" onClick={() => openInCasaReel(p.id)} className="underline hover:text-white">Ouvrir en Casa réel</button></>}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <footer className="border-t border-white/[0.06] px-3.5 py-1.5 text-[10.5px] leading-snug text-[var(--mut)]">
        {list.length} établissement{list.length > 1 ? "s" : ""} · sources : akdital.ma, mibtech.ma,{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-white">© OpenStreetMap (ODbL)</a>
      </footer>
    </section>
  );
}
