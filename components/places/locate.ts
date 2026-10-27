"use client";
// "Localiser sur la carte": one place of the explorer (lib/geo/places.ts) → selection + camera, through what the scene
// already has: the store's selection (its card opens in the side panel), the shared rig (log-space flight; a new call
// replaces the running one), Anfa Prime's own facility view. Never flies to a place without a building-level point.
import * as THREE from "three";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import { CASA_REEL, geoToScene } from "@/lib/geo/casaFrame";
import { DEMO_ID, explorerPlace, hasPoint } from "@/lib/geo/places";
import { walkBusy, WALK_API } from "@/components/scenes/walk/state";

/** flying: camera on its way · facility: Anfa Prime's floors and services · morocco: shown on the Morocco map (city only)
 *  · needs-reel: real positions exist only in Casa réel · no-point: no position to fly to (card only) · unknown */
export type LocateResult = "flying" | "facility" | "morocco" | "needs-reel" | "no-point" | "unknown";

export function locatePlace(id: string): LocateResult {
  const p = explorerPlace(id);
  if (!p) return "unknown";
  const app = useApp.getState();
  if (walkBusy()) WALK_API.stop(); // walk mode owns the camera: leave it before flying
  if (p.id === DEMO_ID) { app.home(); return "facility"; } // the typical hospital's overview (its own flight)
  if (p.model3DId === "anfa-prime-hospital") { app.select({ kind: "facility", id: p.model3DId }); return "facility"; }
  if (p.coordinateStatus === "city" && p.networkSlug) { app.select({ kind: "site", id: p.networkSlug }); return "morocco"; }
  app.select({ kind: "landmark", id: p.id });
  if (!hasPoint(p)) return "no-point";
  if (!CASA_REEL) return "needs-reel";
  const q = geoToScene(p.latitude!, p.longitude!);
  // a little over the site, looking north at ~55°: the building and its streets in view (closer for a small house)
  // a Google-Maps arc from where the camera is: up so both places are in view, then down on this one
  rig.flyTo(new THREE.Vector3(q.x, 0, q.z), Math.max(260, p.r * 0.38), { polar: 0.95, azimuth: 0.15, cinematic: true, duration: 2.8 });
  return "flying";
}

/** reload in Casa réel and fly to the place once the scene is up (PlacesExplorer reads ?lieu=) */
export function openInCasaReel(id: string) {
  const u = new URL(window.location.href);
  u.searchParams.set("casa", "reel");
  u.searchParams.set("lieu", id);
  window.location.assign(u.toString());
}
