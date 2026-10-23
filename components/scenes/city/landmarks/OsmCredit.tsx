"use client";
// <OsmCredit/>: the ODbL attribution of the OpenStreetMap districts, shown while one of them is on screen. A district calls
// `creditNear()` from its frame loop when the camera is close to it; the line stays up for two frames after the last call.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GeoHtml } from "../../geo/GeoHtml";

const CREDIT = { until: -1, frame: 0 };
/** keep the attribution visible (call every frame while a district is in view) */
export const creditNear = () => { CREDIT.until = CREDIT.frame + 2; };

export function OsmCredit() {
  const el = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const show = CREDIT.frame++ < CREDIT.until;
    if (el.current) { el.current.style.opacity = show ? "1" : "0"; el.current.style.pointerEvents = show ? "auto" : "none"; }
  });
  return (
    <GeoHtml fullscreen zIndex={5}>
      <div ref={el} style={{ opacity: 0 }} className="absolute bottom-[86px] right-4 rounded bg-[#0B1020]/55 px-2 py-0.5 text-[10px] text-white/75 transition-opacity duration-300">
        Bâtiments et rues ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline decoration-white/40 hover:text-white">contributeurs OpenStreetMap</a>{" "}
        (ODbL) · volumes estimés signalés dans docs/research
      </div>
    </GeoHtml>
  );
}
