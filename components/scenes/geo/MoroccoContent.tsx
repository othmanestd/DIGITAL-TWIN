"use client";
// MoroccoContent — the Morocco network map as pure content (no camera controls, no lights, no background).
// Map-local units (see lib/geo/projection): x = east, z = south (north = −Z), land top = plane y = 0 (MAP_TOP_Y),
// Casablanca at the origin. A parent group may scale it to metres (1000 / MAP_UNITS_PER_KM) and translate it.
// Camera flights for city / site selections go through the shared rig (world coordinates); "overview" flights are
// owned by the host scene. `opacity` multiplies every material (map ↔ globe cross-fade).
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useApp } from "@/lib/store";
import { rig } from "@/lib/rig";
import { MAP_UNITS_PER_KM } from "@/lib/geo/projection";
import { MoroccoLand, Neighbours, Ocean, PlaceLabels, LAND_TOP, MAP_CENTER, MAP_SIZE, CASA } from "./MoroccoBase";
import MoroccoNetwork, { LAYOUT, cityNode, siteNode, cityFocus, type MapCam } from "./MoroccoNetwork";
import { applyOpacity, GEO_FADE } from "./shared";

export { mapProject, MAP_UNITS_PER_KM, CASA_LONLAT } from "@/lib/geo/projection";
export { MOROCCO_CENTER_LONLAT } from "@/lib/geo/geometry";
/** Top of the Morocco landmass in map-local units (the hospital's ground). */
export const MAP_TOP_Y = LAND_TOP;
export { MAP_CENTER, MAP_SIZE };

export type MapShot = { target: THREE.Vector3; dist: number; polar: number; azimuth: number };

/** Map-local camera shot for a selection (city / site). Distances in map-local units. */
export function moroccoShot(sel: { kind: string; id: string } | null): MapShot | null {
  if (sel?.kind === "city") {
    const n = cityNode(sel.id);
    if (n) return { target: cityFocus(n), dist: 40 + n.sz * 4, polar: 0.9, azimuth: 0.12 };
  }
  if (sel?.kind === "site") {
    const n = siteNode(sel.id);
    if (n) return { target: n.pos.clone().setY(n.pos.y + 0.4), dist: 24, polar: 0.98, azimuth: 0.18 };
  }
  return null;
}

/** Map-local overview of the whole country (southern provinces included), fitted to a viewport aspect.
 *  Used by the standalone MoroccoScene; the unified scene frames MOROCCO_CENTER_LONLAT itself. */
export function moroccoOverviewShot(aspect: number, fovDeg = 38): MapShot {
  const polar = 0.74;
  const vt = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2));
  const dV = (MAP_SIZE.d * Math.cos(polar) + 24) / (2 * vt) / 0.8;
  const dH = (MAP_SIZE.w + 30) / (2 * vt * aspect) / 0.86;
  const dist = Math.max(dV, dH);
  return { target: MAP_CENTER.clone().add(new THREE.Vector3(-dist * 0.035, 0, dist * 0.025)), dist, polar, azimuth: 0.1 };
}

/** Fly the shared rig to a map-local shot, converting to world space through `root`. */
export function flyMapShot(root: THREE.Object3D, shot: MapShot) {
  const t = root.localToWorld(shot.target.clone());
  const s = new THREE.Vector3();
  root.getWorldScale(s);
  rig.flyTo(t, shot.dist * s.x, { polar: shot.polar, azimuth: shot.azimuth });
}

export function MoroccoContent({ opacity = 1 }: { opacity?: number }) {
  const root = useRef<THREE.Group>(null);
  const cam = useRef<MapCam>({ dist: 400, altKm: 3000, focus: new THREE.Vector3() });
  const altKm = useMemo(() => ({ current: 3000 }), []);
  const [activeCity, setActiveCity] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const focusNonce = useApp((s) => s.focusNonce);
  const lastOpacity = useRef(-1);

  // camera relative to the map (local units): distance to the ground point under the view centre, altitude in km
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Vector3(), inv: new THREE.Matrix4() }), []);
  useFrame(({ camera }) => {
    const g = root.current;
    if (!g) return;
    // opacity (only when it changes)
    GEO_FADE.map = opacity;
    if (Math.abs(opacity - lastOpacity.current) > 0.002) { applyOpacity(g, opacity); lastOpacity.current = opacity; g.visible = opacity > 0.005; }

    tmp.inv.copy(g.matrixWorld).invert();
    const pL = tmp.p.copy(camera.position).applyMatrix4(tmp.inv);
    camera.getWorldDirection(tmp.d);
    const qL = tmp.q.copy(camera.position).add(tmp.d).applyMatrix4(tmp.inv).sub(pL).normalize();
    const c = cam.current;
    if (qL.y < -1e-4 && pL.y > 0) {
      const t = -pL.y / qL.y;
      c.focus.copy(pL).addScaledVector(qL, t);
      c.dist = t;
    } else {
      c.focus.set(pL.x, 0, pL.z);
      c.dist = Math.max(0.001, Math.abs(pL.y)) * 2;
    }
    c.altKm = Math.max(0, pL.y) / MAP_UNITS_PER_KM;
    altKm.current = c.altKm;
    // below ~40 km the map opens around Casablanca for the virtual city / hospital ground (fully open below ~15 km)
    CASA.v = 1 - THREE.MathUtils.smoothstep(c.altKm, 15, 40);

    // which city is the camera "on"? (shows establishment satellites + labels)
    let best: string | null = null;
    const cur = useApp.getState().sel;
    const selNode = cur?.kind === "site" ? siteNode(cur.id)?.city : cur?.kind === "city" ? cityNode(cur.id) : undefined;
    if (c.dist < 95 && selNode && Math.hypot(selNode.base.x - c.focus.x, selNode.base.z - c.focus.z) < 24) best = selNode.city.slug;
    else if (c.dist < 95) {
      let bd = 16;
      for (const n of LAYOUT.cities) {
        const d = Math.hypot(n.base.x - c.focus.x, n.base.z - c.focus.z);
        if (d < bd) { bd = d; best = n.city.slug; }
      }
    }
    if (best !== activeRef.current) { activeRef.current = best; setActiveCity(best); }
  });

  // city / site selections -> camera flight through the shared rig (overview flights belong to the host scene)
  const firstNonce = useRef(focusNonce);
  useEffect(() => {
    if (focusNonce === firstNonce.current) return;
    const shot = moroccoShot(useApp.getState().sel);
    if (shot && root.current) flyMapShot(root.current, shot);
  }, [focusNonce]);

  return (
    <group ref={root}>
      <Ocean />
      <Neighbours />
      <MoroccoLand />
      <PlaceLabels visible={!activeCity} altKm={altKm} />
      <MoroccoNetwork activeCity={activeCity} cam={cam} root={root} />
    </group>
  );
}
