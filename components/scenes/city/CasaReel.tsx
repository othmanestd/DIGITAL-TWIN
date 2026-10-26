"use client";
// <CasaReel/>: the ground of "Casa réel" mode (casaFrame.CASA_REEL), on the single geographic chain: the land and the
// Atlantic split by the real OpenStreetMap coastline (zones/coastData, ~27 km from Dar Bouazza to Aïn Sebaâ, port and
// jetties included), a surf line along it, and markers for the referential places not modelled yet (lib/geo/
// casaReferential: monuments and Akdital establishments, with their status). The procedural city is not drawn in this mode;
// the OSM districts (CFC, Maârif, Anfa Prime, Hassan II) stand at their real positions. Beyond the OSM coastline (east of
// Aïn Sebaâ, west of Dar Bouazza) the shore is extended in a straight line along the regional coast (a simplification, out
// of the city). The ground fades exactly as the Morocco map closes its hole around Casablanca (CASA.v), so the hand-off
// to the map stays seamless.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { CASA } from "@/components/scenes/geo/MoroccoBase";
import { geoToScene } from "@/lib/geo/casaFrame";
import { AKDITAL_CASA, CASA_LANDMARKS, PARTNERS_CASA, placeById, type Place } from "@/lib/geo/casaReferential";
import { explorerPlace } from "@/lib/geo/places";
import { GeoHtml } from "../geo/GeoHtml";
import { useApp } from "@/lib/store";
import { DiscoverButton } from "./landmarks/Discover";
import { COASTLINE } from "./landmarks/zones/coastData";
import { CasaCity } from "./CasaCity";

const _p = new THREE.Vector3();
const FAR = 90_000;   // extent of the land / sea polygons (m): beyond the 30 … 75 km hole of the Morocco map
/** places whose name label is drawn by their OSM district (with its own "Découvrir"), or by the clinic model */
const OWN_LABEL = new Set(["twin", "cfc-tower", "hassan2", "anfa-park", "anfa-prime-hospital"]);
const LABEL_MAX = 8;          // labels shown at once (nearest first, the selected place always)
const LABEL_TOP_ALT = 4500;   // above this altitude the city shows no place label

/** the coastline in scene metres (east → west, land on the left), with straight extensions to FAR at both ends */
function coastScene(): THREE.Vector2[] {
  const P: THREE.Vector2[] = [];
  for (let i = 0; i < COASTLINE.length; i += 2) { const p = geoToScene(COASTLINE[i], COASTLINE[i + 1]); P.push(new THREE.Vector2(p.x, p.z)); }
  // regional direction of the shore from the first / last 3 km of the line
  const ext = (a: THREE.Vector2, b: THREE.Vector2) => { const d = a.clone().sub(b).normalize(); return a.clone().add(d.multiplyScalar(FAR)); };
  const k = Math.min(60, P.length - 1);
  return [ext(P[0], P[k]), ...P, ext(P[P.length - 1], P[P.length - 1 - k])];
}

/** a flat polygon (scene x, z) as a mesh at height y; THREE's shapes live in (x, y) so z is negated and the mesh rotated */
function flat(points: THREE.Vector2[], y: number) {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  return g;
}
function surf(points: THREE.Vector2[], w: number, y: number) {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 1; i < points.length - 2; i++) {
    const a = points[i], b = points[i + 1], d = b.clone().sub(a), L = d.length();
    if (L < 0.1) continue;
    const n = new THREE.Vector2(-d.y, d.x).divideScalar(L).multiplyScalar(w); // seaward: walking with the land on the left, the sea is on the right
    const o = pos.length / 3;
    pos.push(a.x, y, a.y, b.x, y, b.y, b.x + n.x, y, b.y + n.y, a.x + n.x, y, a.y + n.y);
    idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function CasaReel() {
  const res = useMemo(() => {
    const C = coastScene();
    const first = C[0], last = C[C.length - 1];
    // land: the coast (east → west), then round by the south; sea: the coast reversed, then round by the north
    const land = flat([...C, new THREE.Vector2(last.x, FAR), new THREE.Vector2(first.x, FAR)], -0.05);
    const sea = flat([...[...C].reverse(), new THREE.Vector2(first.x, -FAR), new THREE.Vector2(last.x, -FAR)], -0.4);
    const foam = surf(C, 7, -0.3);
    const fade = { transparent: true, depthWrite: true };
    const M = {
      land: new THREE.MeshStandardMaterial({ color: "#CBC3B2", roughness: 1, ...fade }),
      sea: new THREE.MeshStandardMaterial({ color: "#2F6F98", roughness: 0.18, metalness: 0.15, envMapIntensity: 1.2, ...fade }),
      foam: new THREE.MeshBasicMaterial({ color: "#EAF2F5", transparent: true, opacity: 0.8, depthWrite: false }),
      pin: new THREE.MeshStandardMaterial({ color: "#8A94A6", roughness: 0.6 }),
      pinAk: new THREE.MeshStandardMaterial({ color: "#1F7FC9", roughness: 0.5, emissive: "#1F7FC9", emissiveIntensity: 0.2 }),
      pinPartner: new THREE.MeshStandardMaterial({ color: "#8B7BFF", roughness: 0.5, emissive: "#8B7BFF", emissiveIntensity: 0.25 }),
      halo: new THREE.MeshBasicMaterial({ color: "#8CA5FF", transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }),
    };
    const pins: (Place & { x: number; z: number; ak: boolean; partner?: boolean })[] = [
      ...CASA_LANDMARKS.filter((p) => p.scene === "marker").map((p) => ({ ...p, ...geoToScene(p.lat, p.lon), ak: false })),
      ...AKDITAL_CASA.filter((p) => p.scene === "marker").map((p) => ({ ...p, ...geoToScene(p.lat, p.lon), ak: true })),
      ...PARTNERS_CASA.filter((p) => p.scene === "marker").map((p) => ({ ...p, ...geoToScene(p.lat, p.lon), ak: false, partner: true })),
    ];
    // place labels on approach: every referential place without a label of its own
    const tags: (Place & { x: number; z: number; ak: boolean; partner?: boolean })[] = [
      ...CASA_LANDMARKS.filter((p) => !OWN_LABEL.has(p.id)).map((p) => ({ ...p, ...geoToScene(p.lat, p.lon), ak: false })),
      ...AKDITAL_CASA.filter((p) => !OWN_LABEL.has(p.id)).map((p) => ({ ...p, ...geoToScene(p.lat, p.lon), ak: true })),
      ...PARTNERS_CASA.map((p) => ({ ...p, ...geoToScene(p.lat, p.lon), ak: false, partner: true })),
    ];
    const haloGeo = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
    return { land, sea, foam, M, pins, tags, haloGeo, pinGeo: new THREE.CylinderGeometry(1.2, 1.2, 36, 8).translate(0, 18, 0) };
  }, []);
  useEffect(() => () => { [res.land, res.sea, res.foam, res.pinGeo, res.haloGeo].forEach((g) => g.dispose()); Object.values(res.M).forEach((m) => m.dispose()); }, [res]);
  const tags = useRef<(HTMLDivElement | null)[]>([]);
  const lab = useRef({ t: 0, on: new Set<number>() });
  const halo = useRef<THREE.Mesh>(null);
  const root = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  useEffect(() => { if (process.env.NODE_ENV !== "production") ((window as unknown as { __casa?: { gl?: unknown } }).__casa ??= {}).gl = gl; }, [gl]);
  useFrame(({ camera, clock }) => {
    const op = CASA.v; // 1 near the city … 0 once the Morocco map has closed its hole
    if (root.current) root.current.visible = op > 0.003;
    res.M.land.opacity = op; res.M.sea.opacity = op; res.M.foam.opacity = 0.8 * op;
    // halo on the selected place (explorer or "Découvrir"): a ring on the ground, sized with the site, pulsing gently
    const sel = useApp.getState().sel, selId = sel?.kind === "landmark" ? sel.id : null;
    const sp = selId ? placeById(selId) ?? null : null, xp = selId && !sp ? explorerPlace(selId) : undefined;
    const h = halo.current;
    if (h) {
      const lat = sp?.lat ?? xp?.latitude, lon = sp?.lon ?? xp?.longitude;
      h.visible = op > 0.3 && lat != null && lon != null;
      if (h.visible) {
        const g = geoToScene(lat!, lon!), base = Math.max(28, Math.min(90, ((sp?.r ?? xp?.r ?? 1200) / 1200) * 45));
        const k = 1 + 0.12 * Math.sin(clock.elapsedTime * 2.4);
        h.position.set(g.x, 1.2, g.z); h.scale.setScalar(base * k);
        res.M.halo.opacity = 0.75 * op;
      }
    }
    // labels on approach, a few times a second: within each place's radius (larger for a big site, growing with the
    // altitude), on screen, the nearest LABEL_MAX; a margin between showing and hiding so they do not flicker at the edge
    const L = lab.current;
    if (clock.elapsedTime - L.t < 0.15) return;
    L.t = clock.elapsedTime;
    const cand: [number, number][] = [];
    if (op > 0.5 && frame.alt < LABEL_TOP_ALT) {
      res.tags.forEach((p, i) => {
        const d = Math.hypot(camera.position.x - p.x, camera.position.z - p.z);
        const R = (p.r ?? 1200) * THREE.MathUtils.clamp(0.7 + frame.alt / 1500, 0.8, 2) * (L.on.has(i) ? 1.2 : 1);
        if (d > R && p.id !== selId) return;
        _p.set(p.x, 30, p.z).project(camera);
        if (_p.z > 1 || Math.abs(_p.x) > 1.05 || Math.abs(_p.y) > 1.05) return;
        cand.push([i, p.id === selId ? -1 : d / (p.r ?? 1200)]);
      });
    }
    cand.sort((a, b) => a[1] - b[1]);
    const on = new Set(cand.slice(0, LABEL_MAX).map((c) => c[0]));
    L.on = on;
    res.tags.forEach((_, i) => {
      const el = tags.current[i];
      if (!el) return;
      const show = on.has(i);
      el.style.opacity = show ? "1" : "0";
      el.style.pointerEvents = show ? "auto" : "none";
      el.style.visibility = show ? "visible" : "hidden"; // out of the tab order while hidden
    });
  });
  return (
    <group ref={root}>
      <mesh geometry={res.sea} material={res.M.sea} raycast={() => null} renderOrder={-2} />
      <mesh geometry={res.land} material={res.M.land} raycast={() => null} renderOrder={-1} />
      <mesh geometry={res.foam} material={res.M.foam} raycast={() => null} />
      <CasaCity />
      <mesh ref={halo} geometry={res.haloGeo} material={res.M.halo} visible={false} renderOrder={3} raycast={() => null} />
      {res.pins.map((p) => (
        <mesh key={p.id} position={[p.x, 0, p.z]} geometry={res.pinGeo} material={p.partner ? res.M.pinPartner : p.ak ? res.M.pinAk : res.M.pin} raycast={() => null} />
      ))}
      {res.tags.map((p, i) => (
        <GeoHtml key={p.id} position={[p.x, p.partner ? 21 : p.scene === "marker" ? 40 : 30, p.z]} center zIndex={5}>
          <div ref={(e) => { tags.current[i] = e; }} style={{ opacity: 0, pointerEvents: "none", visibility: "hidden", transition: "opacity .3s, visibility .3s" }}
            className={`flex items-center whitespace-nowrap rounded-full py-1 pl-2.5 pr-1 text-[11px] font-semibold text-white shadow-[0_6px_18px_-8px_rgba(0,0,0,.6)] ring-1 backdrop-blur transition-opacity duration-300 motion-reduce:transition-none ${p.ak ? "bg-[#0E3A5C]/85 ring-[#45bdf5]/50" : p.partner ? "bg-[#2A2350]/85 ring-[#8B7BFF]/50" : "bg-[#0B1020]/75 ring-white/15"}`}>
            {p.ak ? "Akdital · " : ""}{p.name}{p.partner ? <span className="ml-1.5 font-normal opacity-75">· d'après photos</span> : null}
            <DiscoverButton id={p.id} />
          </div>
        </GeoHtml>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------- QA (dev only): check the chain against control points
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __casa: unknown }).__casa = {
    /** distances between referential places: scene (chain) vs great circle; and independent features inside the placed
     *  OSM districts (Nominatim position → must fall inside / near the district's own mapped feature) */
    async check() {
      const { haversine } = await import("@/lib/geo/casaFrame");
      const { MAARIF_ZONE } = await import("./maarifZone");
      const { ANFA_ZONE } = await import("./anfaZone");
      const { CFC } = await import("./geography");
      const { OSM_AREAS } = await import("./landmarks/cfcData");
      const { inPoly } = await import("./osmZonePlan");
      const P = [...CASA_LANDMARKS, ...AKDITAL_CASA];
      const pairs: { a: string; b: string; scene: number; geo: number; err: string }[] = [];
      for (let i = 0; i < P.length; i += 3) for (let j = i + 1; j < P.length; j += 4) {
        const A = geoToScene(P[i].lat, P[i].lon), B = geoToScene(P[j].lat, P[j].lon);
        const s = Math.hypot(A.x - B.x, A.z - B.z), g = haversine(P[i].lat, P[i].lon, P[j].lat, P[j].lon);
        pairs.push({ a: P[i].id, b: P[j].id, scene: Math.round(s), geo: Math.round(g), err: ((100 * (s - g)) / g).toFixed(3) + " %" });
      }
      const inside = (Pz: { zone: { buildings: { p: number[] }[] }; ox: number; oz: number }, lat: number, lon: number) => {
        const q = geoToScene(lat, lon), x = q.x - Pz.ox, z = q.z - Pz.oz;
        return Pz.zone.buildings.some((b) => inPoly(b.p, x, z));
      };
      const villa = { lat: 33.5864207, lon: -7.6295534 };                 // Nominatim: Villa des Arts (way 1388403773)
      const park = { lat: 33.5630718, lon: -7.6573132 };                  // Nominatim: Anfa Park (way 586647221)
      const pq = geoToScene(park.lat, park.lon), pk = OSM_AREAS.find((a) => a.name.startsWith("Anfa Park"));
      const lc = AKDITAL_CASA.find((p) => p.id === "longchamps")!, lq = geoToScene(lc.lat, lc.lon);
      const lpoi = ANFA_ZONE.zone.pois.find((p) => p.name.startsWith("Clinique Longchamps"));
      return {
        reel: CASA_REEL_FLAG(),
        pairs,
        controls: {
          villaDesArtsInsideMaarifBuilding: inside(MAARIF_ZONE, villa.lat, villa.lon),
          anfaParkInsideCfcParkPolygon: pk ? inPoly(pk.p, pq.x - CFC.x, pq.z - CFC.y) : null,
          longchampsReferentialVsAnfaZonePoi_m: lpoi ? Math.round(Math.hypot(lq.x - (ANFA_ZONE.ox + lpoi.x), lq.z - (ANFA_ZONE.oz + lpoi.z))) : null,
        },
      };
    },
  };
}
function CASA_REEL_FLAG() { try { return window.localStorage.getItem("casa-reel") === "1"; } catch { return false; } }
