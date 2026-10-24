"use client";
// "Découvrir" on a place label of Casablanca: opens its card (components/panels/LandmarkView.tsx) without moving the camera.
// Used by the OSM district labels (Twin Center, CFC Tower, Hassan II, Anfa Park) and by the city labels (city/CasaReel).
import { useApp } from "@/lib/store";

export function DiscoverButton({ id, label = "Découvrir" }: { id: string; label?: string }) {
  return (
    <button type="button" data-anchor={`landmark:${id}`}
      onClick={(e) => { e.stopPropagation(); useApp.getState().select({ kind: "landmark", id }); }}
      className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10.5px] font-semibold text-white ring-1 ring-white/25 transition-colors hover:bg-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#45bdf5]">
      {label}
    </button>
  );
}
