"use client";
// <CityPedestrians/>: ~235 people from the shared human kit (components/scenes/people/human.ts: same figure as the hospital's
// staff, varied casual clothes in lively but natural colours, djellabas, hijabs, office wear), one instanced draw call. They walk the sidewalks of the city grid corner to corner, waiting at the corners for the lights, queue at the
// two bus shelters in front of the hospital, come in and out of the two hospital entrances, stroll on the mosque's esplanade and
// the business plazas, and wait on the tram platforms, board the trams that dwell there and get off them. A walking visitor
// (frame.player) makes them step aside. Visible below 2 km of camera altitude; people farther than 600 m are not drawn, and the
// street walkers move with the camera (they are re-seeded on sidewalks around where you look), so wherever you zoom the street lives.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { dress, newPose, posePhone, poseIdle, poseWalk } from "../people/human";
import { useHumanCrowd } from "../people/useHumans";
import { SHELTERS } from "./district";
import { blockedOutdoors } from "./collide";
import { CELL, MOSQUE, cityPlan, onLand, sidewalkWidth } from "./plan";
import { cfcTowers } from "./landmarks/Cfc";
import { TRAMS, TRAM_STOPS_X, platformZ } from "./landmarks/Tram";
import { rng } from "./landmarks/env";

const MAX_ALT = 2000, DRAW_R = 600, RECYCLE_R = 520;

// ---------------------------------------------------------------- zones (rectangles people wander in)
type Zone = { x0: number; x1: number; z0: number; z1: number; y: number; local?: boolean; trees?: boolean };
const Y_ESP = 2.0;
const ZONES: Zone[] = [
  { x0: -38, x1: 14, z0: 9.8, z1: 14.2, y: 0 },            // 0 forecourt under the canopy
  { x0: -32, x1: 10, z0: 21.5, z1: 30.5, y: 0 },           // 1 plaza island between the ramps
  { x0: -46, x1: 48, z0: 41.2, z1: 44.4, y: 0 },           // 2 front pavement
  { x0: -150, x1: 140, z0: 75.7, z1: 76.7, y: 0 },         // 3 south pavement of the boulevard
  { x0: 0, x1: 58, z0: 84, z1: 130, y: 0, trees: true },   // 4 public garden
  { x0: 133, x1: 146, z0: -88, z1: 88, y: Y_ESP, local: true },   // 5 mosque promenade on the sea side
  { x0: -85, x1: 138, z0: -60, z1: -50, y: Y_ESP, local: true },  // 6 mosque north walk
  { x0: -96, x1: -84, z0: -20, z1: 80, y: Y_ESP, local: true },   // 7 mosque landward side
];
const DOORS: [number, number][] = [[-15, 8.5], [3.5, 8.5]];     // main entrance, emergency entrance (front face of the hospital, z = 8)

// ---------------------------------------------------------------- the pedestrian
const K_GRAPH = 0, K_ZONE = 1, K_DOOR = 2, K_STAND = 3, K_TRAM = 4;
type Ped = {
  kind: number; x: number; z: number; y: number; yaw: number; yawT: number; s: number; ph: number; v: number; vis: number;
  idle: number; phone: boolean; tx: number; tz: number; px: number; pz: number; seed: number; state: number; timer: number;
  // street graph
  orient: number; gi: number; gj: number; side: number; t: number; dir: number; len: number; lat: number; ax: number; az: number; bx: number; bz: number;
  zone: number; door: number; stop: number; plat: 1 | -1; slot: number; office: boolean;
  look: number;
};
function mk(kind: number, r: () => number): Ped {
  return {
    kind, x: 0, z: 0, y: 0, yaw: r() * 6.28, yawT: 0, s: 0.94 + r() * 0.1, ph: r() * 6, v: 0, vis: 1, idle: 0, phone: r() < 0.16, tx: 0, tz: 0, px: 0, pz: 0, seed: r() * 100, state: 0, timer: 0,
    orient: 0, gi: 0, gj: 0, side: 1, t: 0, dir: 1, len: 1, lat: 0, ax: 0, az: 0, bx: 0, bz: 0, zone: 0, door: 0, stop: 0, plat: 1, slot: 0, office: false,
    look: Math.floor(r() * 1e6),
  };
}

// ---------------------------------------------------------------- the sidewalk graph of the city grid
const line = (k: number) => k * CELL + CELL / 2;
const wd = (k: number) => (((k % 6) + 6) % 6 === 0 ? 30 : 12);
const corner = (k: number, s: number) => line(k) + s * (wd(k) / 2 + sidewalkWidth(wd(k)) / 2);
let RBS: [number, number][] | null = null;
function edgeOK(orient: number, i: number, j: number) {
  RBS ??= [...cityPlan().roundabouts, [180, 60]];
  const x0 = line(i), z0 = line(j), x1 = orient === 0 ? x0 : line(i + 1), z1 = orient === 0 ? line(j + 1) : z0;
  if (!onLand(x0, z0, 110) || !onLand(x1, z1, 110)) return false;
  if (Math.abs((x0 + x1) / 2) < 179 && Math.abs((z0 + z1) / 2) < 179) return false;
  for (const [rx, rz] of RBS) if (Math.hypot(x0 - rx, z0 - rz) < 64 || Math.hypot(x1 - rx, z1 - rz) < 64) return false;
  return true;
}
/** Start walking an edge (orient 0 = along z on the vertical street i between lines j, j+1; 1 = along x on the horizontal street j between lines i, i+1). */
function setEdge(p: Ped, orient: number, i: number, j: number, side: number, t: number, dir: number, r: () => number) {
  if (!edgeOK(orient, i, j)) return false;
  p.orient = orient; p.gi = i; p.gj = j; p.side = side; p.t = t; p.dir = dir;
  if (orient === 0) { p.ax = p.bx = corner(i, side); p.az = corner(j, 1); p.bz = corner(j + 1, -1); }
  else { p.az = p.bz = corner(j, side); p.ax = corner(i, 1); p.bx = corner(i + 1, -1); }
  p.len = Math.hypot(p.bx - p.ax, p.bz - p.az);
  const half = sidewalkWidth(wd(orient === 0 ? i : j)) / 2, a = 0.7 + r() * (half - 1.0);   // keep off the palms on the pavement's centre line
  p.lat = (r() < 0.5 ? -1 : 1) * Math.max(0.5, Math.min(a, half - 0.4));
  return true;
}
/** At the end of an edge: turn the corner (the sidewalk of the cross street on the same side) or turn back. Returns a wait time. */
function nextEdge(p: Ped, r: () => number) {
  let ni: number, nj: number, nsx: number, nsz: number;
  if (p.orient === 0) { if (p.dir > 0) { ni = p.gi; nj = p.gj + 1; nsx = p.side; nsz = -1; } else { ni = p.gi; nj = p.gj; nsx = p.side; nsz = 1; } }
  else { if (p.dir > 0) { ni = p.gi + 1; nj = p.gj; nsx = -1; nsz = p.side; } else { ni = p.gi; nj = p.gj; nsx = 1; nsz = p.side; } }
  let ok = false;
  if (r() > 0.28) {
    if (p.orient === 0) ok = nsx > 0 ? setEdge(p, 1, ni, nj, nsz, 0, 1, r) : setEdge(p, 1, ni - 1, nj, nsz, 1, -1, r);
    else ok = nsz > 0 ? setEdge(p, 0, ni, nj, nsx, 0, 1, r) : setEdge(p, 0, ni, nj - 1, nsx, 1, -1, r);
  }
  if (!ok) { p.dir = -p.dir; p.t = p.dir > 0 ? 0 : 1; }
  return r() < 0.5 ? 2 + r() * 7 : 0;     // waits at the corner for the lights half of the time
}

// ---------------------------------------------------------------- small helpers
const _p = new THREE.Vector3(), _f = new THREE.Vector3();
const P = newPose();
type Crowd = ReturnType<typeof useHumanCrowd>;
function dampAngle(a: number, b: number, k: number) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
const MC = Math.cos(MOSQUE.yaw), MS = Math.sin(MOSQUE.yaw);

function pickIn(zn: Zone, p: { tx: number; tz: number }, r: () => number, trees: [number, number, number][]) {
  for (let n = 0; n < 40; n++) {
    const lx = zn.x0 + r() * (zn.x1 - zn.x0), lz = zn.z0 + r() * (zn.z1 - zn.z0);
    const x = zn.local ? MOSQUE.x + lx * MC + lz * MS : lx, z = zn.local ? MOSQUE.z - lx * MS + lz * MC : lz;
    if (zn.trees && trees.some(([tx, tz, ts]) => Math.hypot(tx - x, tz - z) < 3.4 * ts + 0.8)) continue;
    if (!zn.local && blockedOutdoors(x, z, 0.5)) continue;   // benches, posts, palms…
    p.tx = x; p.tz = z; return;
  }
}

export function CityPedestrians() {
  const root = useRef<THREE.Group>(null);
  const R = useMemo(() => rng(4242), []);

  const sim = useMemo(() => {
    const r = R, P = cityPlan(), peds: Ped[] = [];
    const trees = P.trees;
    const towers = cfcTowers();
    // ---- hospital: entrances, forecourt, plaza, pavements, garden, shelters
    for (let k = 0; k < 14; k++) { const p = mk(K_DOOR, r); p.door = k % 4 === 3 ? 1 : 0; p.timer = r() * 40; p.state = 0; p.vis = 0; peds.push(p); }
    const zoned = (zone: number, n: number, extra?: (p: Ped) => void) => { for (let k = 0; k < n; k++) { const p = mk(K_ZONE, r); p.zone = zone; pickIn(ZONES[zone], p, r, trees); p.x = p.tx; p.z = p.tz; p.y = ZONES[zone].y; p.state = 1; p.idle = r() * 8; pickIn(ZONES[zone], p, r, trees); extra?.(p); peds.push(p); } };
    zoned(0, 5); zoned(1, 5); zoned(2, 12); zoned(3, 8); zoned(4, 10);
    SHELTERS.filter((s) => s.hospital).forEach((sh, si) => {
      for (let k = 0; k < (si === 0 ? 4 : 3); k++) {
        const p = mk(K_STAND, r), out = Math.cos(sh.yaw);             // the open side faces the street: +z for yaw 0, −z for yaw π
        p.x = sh.x + (k - 1.4) * 1.25 + (r() - 0.5) * 0.3; p.z = sh.z + out * (0.95 + (k % 2) * 0.35); p.yaw = p.yawT = out > 0 ? 0 : Math.PI;
        p.idle = r() * 6; peds.push(p);
      }
    });
    // ---- the mosque esplanade, the business plazas
    zoned(5, 8); zoned(6, 5); zoned(7, 3);
    for (let k = 0; k < 14; k++) { const p = mk(K_ZONE, r); p.zone = 100 + (k % Math.max(1, towers.length)); p.office = true; cfcPick(p, towers, r); p.x = p.tx; p.z = p.tz; p.y = 0.13; p.state = 1; p.idle = r() * 6; cfcPick(p, towers, r); peds.push(p); }
    // ---- tram platforms (inner stops, both directions)
    [1, 2, 3, 4].forEach((stop) => ([1, -1] as const).forEach((plat) => {
      for (let k = 0; k < 3; k++) {
        const p = mk(K_TRAM, r); p.stop = stop; p.plat = plat; p.slot = k;
        p.x = TRAM_STOPS_X[stop] + (k - 1) * 5.5 + (r() - 0.5) * 1.5; p.z = platformZ(plat) + plat * (0.1 + r() * 0.5); p.y = 0.32; p.yaw = p.yawT = plat > 0 ? Math.PI : 0; p.state = 0; p.idle = r() * 5;
        peds.push(p);
      }
    }));
    // ---- the street pool (re-seeded around the camera)
    const first = peds.length;
    for (let k = 0; k < 120; k++) { const p = mk(K_GRAPH, r); seedGraph(p, 0, 0, 700, r); peds.push(p); }
    return { peds, first };
  }, [R]);
  const N = sim.peds.length;
  const crowd = useHumanCrowd(N);
  const trees = useMemo(() => cityPlan().trees, []);
  const towers = useMemo(() => cfcTowers(), []);
  const frust = useMemo(() => ({ f: new THREE.Frustum(), m: new THREE.Matrix4(), hit: new THREE.Vector3(), acc: 0, last: 0 }), []);

  // wardrobe (fixed per person): casual, djellabas and hijabs; office wear on the business plazas
  useEffect(() => { sim.peds.forEach((p, i) => crowd.setLook(i, dress(p.office ? "office" : "visitor", p.look))); }, [sim, crowd]);

  useFrame(({ camera, clock }, dt0) => {
    const g = root.current;
    if (!g) return;
    const alt = frame.alt;
    g.visible = alt < MAX_ALT;
    if (!g.visible) return;
    const dt = Math.min(dt0, 0.1), t = clock.elapsedTime;
    const cam = camera.position;
    // where the camera looks at the ground: the street walkers are re-seeded around that point
    camera.getWorldDirection(_f);
    const hit = frust.hit;
    if (_f.y < -0.02) hit.copy(cam).addScaledVector(_f, cam.y / -_f.y); else hit.set(cam.x, 0, cam.z);
    if (Math.hypot(hit.x - cam.x, hit.z - cam.z) > 900) hit.set(cam.x, 0, cam.z);
    frust.m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frust.f.setFromProjectionMatrix(frust.m);
    const pl = frame.player, r = R, peds = sim.peds;
    const doRecycle = alt < 900;

    for (let i = 0; i < N; i++) {
      const p = peds[i];
      const dxc = p.x - cam.x, dzc = p.z - cam.z, d2 = dxc * dxc + dzc * dzc;
      const near = d2 < DRAW_R * DRAW_R;
      if (p.kind === K_GRAPH && doRecycle && d2 > RECYCLE_R * RECYCLE_R) { seedGraph(p, hit.x, hit.z, 380, r, frust.f); }
      if (!near && p.kind !== K_GRAPH) continue;                 // far hotspot people just wait where they are
      if (!near && !doRecycle) continue;
      step(p, dt, t, r, trees, towers);
      if (!near) continue;
      // keep clear of the walking visitor
      if (pl.active) {
        const ddx = p.x - pl.x, ddz = p.z - pl.z, dd = Math.hypot(ddx, ddz);
        if (dd < 2.6 && dd > 0.01 && Math.abs(p.y - pl.y) < 3) { const k = Math.min(1.6, (2.6 - dd) * 3) * dt; p.px += (ddx / dd) * k * 3; p.pz += (ddz / dd) * k * 3; p.px = Math.max(-1.8, Math.min(1.8, p.px)); p.pz = Math.max(-1.8, Math.min(1.8, p.pz)); p.v *= 0.5; }
      }
      const dk = Math.exp(-dt * 0.9); p.px *= dk; p.pz *= dk;
      draw(p, i, t, dt, crowd);
    }
  });

  return (
    <group ref={root}>
      <primitive object={crowd.mesh} />
    </group>
  );
}

// ---------------------------------------------------------------- seeding
function cfcPick(p: Ped, towers: ReturnType<typeof cfcTowers>, r: () => number) {
  if (!towers.length) { p.tx = CFC_FALLBACK[0]; p.tz = CFC_FALLBACK[1]; return; }
  const k = p.zone >= 100 ? p.zone - 100 : 0, tw = towers[Math.min(k, towers.length - 1)];
  const hw = tw.fw / 2 + 5, hd = tw.fd / 2 + 5, side = Math.floor(r() * 4), u = r() * 2 - 1, w = 3 + r() * 5;
  const lx = side < 2 ? u * (hw + 8) : (side === 2 ? hw + w * 0.6 : -hw - w * 0.6), lz = side < 2 ? (side === 0 ? hd + w * 0.6 : -hd - w * 0.6) : u * (hd + 8);
  p.tx = tw.x + lx; p.tz = tw.z + lz;
}
const CFC_FALLBACK: [number, number] = [-1750, -500];

/** Put a street walker on a random sidewalk edge near (cx, cz), outside the frustum when one is given. */
function seedGraph(p: Ped, cx: number, cz: number, radius: number, r: () => number, f?: THREE.Frustum) {
  const ci = Math.round((cx - CELL / 2) / CELL), cj = Math.round((cz - CELL / 2) / CELL), span = Math.max(2, Math.round(radius / CELL));
  for (let n = 0; n < 14; n++) {
    const i = ci + Math.round((r() * 2 - 1) * span), j = cj + Math.round((r() * 2 - 1) * span), orient = r() < 0.5 ? 0 : 1, side = r() < 0.5 ? -1 : 1;
    if (!setEdge(p, orient, i, j, side, r(), r() < 0.5 ? 1 : -1, r)) continue;
    const x = p.ax + (p.bx - p.ax) * p.t, z = p.az + (p.bz - p.az) * p.t;
    if (f && f.containsPoint(_p.set(x, 1, z)) && Math.hypot(x - cx, z - cz) < 260) continue;
    p.x = x; p.z = z; p.y = 0.1; p.idle = 0; p.v = 0; p.state = 0;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- per-person behaviour
const WALK = 1.25;
function walkTo(p: Ped, tx: number, tz: number, spd: number, dt: number) {
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  if (d < 0.3) { p.v = 0; return true; }
  const k = Math.min(d, spd * dt) / d;
  p.x += dx * k; p.z += dz * k; p.v = spd; p.yawT = Math.atan2(dx, dz);
  return false;
}
function tramAt(stop: number, dir: number) {
  for (const t of TRAMS) if (t.dwell > 1 && t.stop === stop && t.dir === dir && t.v < 0.05) return t;
  return null;
}
const DOOR_OFF = [0, 1, 2, 3, 4].flatMap((m) => [-28 + 11.2 * m + 1.95, -28 + 11.2 * m + 7.25]);

function step(p: Ped, dt: number, t: number, r: () => number, trees: [number, number, number][], towers: ReturnType<typeof cfcTowers>) {
  p.v = 0;
  if (p.idle > 0) { p.idle -= dt; if (p.kind !== K_GRAPH) return; }
  switch (p.kind) {
    case K_GRAPH: {
      if (p.idle > 0) return;
      const spd = 1.0 + (p.seed % 1) * 0.5;
      p.t += (p.dir * spd * dt) / p.len;
      if (p.t > 1 || p.t < 0) { p.t = Math.min(1, Math.max(0, p.t)); p.idle = nextEdge(p, r); }
      const ix = p.ax + (p.bx - p.ax) * p.t, iz = p.az + (p.bz - p.az) * p.t, nx = -(p.bz - p.az) / p.len, nz = (p.bx - p.ax) / p.len;
      const tx = ix + nx * p.lat, tz = iz + nz * p.lat, k = Math.min(1, dt * 4);
      const mx = tx - p.x, mz = tz - p.z;
      if (Math.abs(mx) + Math.abs(mz) > 30) { p.x = tx; p.z = tz; }
      p.x += mx * k; p.z += mz * k; p.y = 0.1;
      p.v = p.idle > 0 ? 0 : spd; p.yawT = Math.atan2(p.bx - p.ax, p.bz - p.az) + (p.dir > 0 ? 0 : Math.PI);
      break;
    }
    case K_ZONE: {
      if (p.state === 1) {                                            // pause, then pick another spot
        if (p.idle <= 0) { p.idle = 0; p.state = 0; if (p.zone >= 100) cfcPick(p, towers, r); else pickIn(ZONES[p.zone], p, r, trees); }
        break;
      }
      if (walkTo(p, p.tx, p.tz, p.zone >= 5 ? 0.85 : 1.1, dt)) { p.state = 1; p.idle = 2 + r() * 12; }
      break;
    }
    case K_DOOR: {
      const door = DOORS[p.door];
      if (p.state === 0) {                                            // inside the hospital
        p.vis = 0; p.timer -= dt;
        if (p.timer <= 0) {
          p.vis = 1; p.x = door[0] + (r() - 0.5) * 1.4; p.z = door[1]; p.y = 0; p.state = 1;
          const pick = r();
          if (pick < 0.45) pickIn(ZONES[0], p, r, trees); else if (pick < 0.65) pickIn(ZONES[1], p, r, trees); else if (pick < 0.85) pickIn(ZONES[2], p, r, trees);
          else { const sh = SHELTERS[0]; p.tx = sh.x + (r() - 0.5) * 6; p.tz = sh.z + 1.1; }
        }
      } else if (p.state === 1) { if (walkTo(p, p.tx, p.tz, 1.15, dt)) { p.state = 2; p.idle = 3 + r() * 20; } }
      else if (p.state === 2) { p.state = 3; }
      else if (walkTo(p, door[0], door[1], 1.2, dt)) { p.state = 0; p.timer = 12 + r() * 50; p.vis = 0; }
      break;
    }
    case K_STAND: {                                                   // bus shelter: shifts weight, looks at the road
      p.yawT = p.yaw; break;
    }
    case K_TRAM: {
      const spotX = TRAM_STOPS_X[p.stop] + (p.slot - 1) * 5.5, zc = platformZ(p.plat);
      const tr = tramAt(p.stop, p.plat);
      if (p.state === 0) {                                            // waiting on the platform
        p.vis = 1; p.y = 0.32;
        if (tr && tr.dwell > 3) {
          p.timer -= dt;
          if (p.timer <= 0 && r() < dt * 0.5) {
            let best = DOOR_OFF[0], bd = 1e9;
            for (const o of DOOR_OFF) { const dx = Math.abs(tr.x + tr.dir * o - p.x); if (dx < bd) { bd = dx; best = o; } }
            p.tx = tr.x + tr.dir * best; p.tz = zc - p.plat * 1.0; p.state = 1;
          }
        } else p.timer = p.slot * 0.8 + r() * 1.5;
      } else if (p.state === 1) {                                     // walking to a door
        if (walkTo(p, p.tx, p.tz, 1.3, dt) || !tr) { p.state = 2; p.vis = 0; p.timer = 14 + r() * 25; }
      } else if (p.state === 2) {                                     // inside the tram, then somebody gets off
        p.vis = 0; p.timer -= dt;
        if (p.timer <= 0) {
          if (tr && tr.dwell > 4) {
            const o = DOOR_OFF[Math.floor(r() * DOOR_OFF.length)];
            p.x = tr.x + tr.dir * o; p.z = zc - p.plat * 1.0; p.y = 0.32; p.vis = 1; p.tx = p.x + (r() - 0.5) * 10; p.tz = zc + p.plat * 3.4; p.state = 3;
          } else if (!tr && r() < dt * 0.15) {                        // a newcomer reaches the platform from the pavement
            p.x = spotX + (r() - 0.5) * 8; p.z = zc + p.plat * 3.6; p.y = 0.1; p.vis = 1; p.tx = spotX + (r() - 0.5) * 1.2; p.tz = zc + p.plat * (0.1 + r() * 0.5); p.state = 4;
          }
        }
      } else if (p.state === 3) {                                     // got off: leaves across the platform
        if (walkTo(p, p.tx, p.tz, 1.25, dt)) { p.state = 2; p.vis = 0; p.timer = 20 + r() * 60; }
      } else if (walkTo(p, p.tx, p.tz, 1.1, dt)) { p.state = 0; p.y = 0.32; p.yawT = p.plat > 0 ? Math.PI : 0; p.timer = 1; }
      if (p.state === 4 && p.z * p.plat < (zc + p.plat * 1.6) * p.plat) p.y = 0.32;
      break;
    }
  }
  void t;
}

// ---------------------------------------------------------------- pose → the crowd
function draw(p: Ped, i: number, t: number, dt: number, crowd: Crowd) {
  if (p.vis <= 0.01) { crowd.hide(i); return; }
  const sd = p.seed, moving = p.v > 0.05, amp = Math.min(1, p.v / 1.1);
  p.ph += p.v * dt * 3.6;                                          // one gait cycle per ~1.75 m, as in the hospital
  p.yaw = dampAngle(p.yaw, p.yawT, moving ? 0.2 : 0.06);
  if (moving) { poseWalk(P, p.ph, amp, crowd.robe[i] === 1); P.hy += 0.2 * Math.sin(0.21 * t + sd) * (1 - amp); }
  else { poseIdle(P, t, sd); if (p.phone) posePhone(P, t, sd); }
  crowd.write(i, p.x + p.px, p.y, p.z + p.pz, p.yaw, 1, P);
}
