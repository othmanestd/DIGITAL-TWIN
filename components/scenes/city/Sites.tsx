"use client";
// <CitySites/>: the remarkable places of the procedural Casablanca that are not plain blocks, merged per material:
//  · the port: the long Moulay Youssef jetty on its rubble mound with its harbour light, the quays and five piers, gantry
//    cranes, container stacks, sheds and silos, moored cargo ships, the fishing harbour and its blue boats, the east breakwater;
//  · El Hank lighthouse on its headland (lantern lit at night);
//  · the Anfa racetrack (sand track, white rails, infield lawn, grandstand);
//  · the rail lines into Casa-Port (ballast, rails, catenary poles, a station, a train);
//  · beach clubs with their pools between the corniche and the Aïn Diab sand; the Twin Center crowns.
// Mounted inside CityContent's group (same altitude fade and map blend). World metres, x east, z south, y up.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { frame } from "@/lib/world";
import { registerSolids } from "./collide";
import { Boxes } from "./cityGeo";
import { CU, lawnMaterial, plainMat } from "./cityMats";
import { atCoast, atLine, COAST, wiggle, T, PORT, RACE, RAIL, TWIN, CORNICHE, beachWidth, rng } from "./geography";
import { LIGHTHOUSE } from "./plan";
import { glowTexture } from "./landmarks/shared";

const C = (h: string) => new THREE.Color(h);
const COL = {
  concrete: C("#ADAAA3"), quayTop: C("#8F8D88"), quaySide: C("#6F6D69"), rubble: C("#5E5A54"), rubble2: C("#77716A"),
  shed: C("#C9CBCB"), shedRoof: C("#9EA7AE"), silo: C("#E3E1DA"), white: C("#F1EFE9"), red: C("#B23A2E"),
  hull: C("#3B2A26"), hullTop: C("#24303E"), deck: C("#7D6E5E"), boat: C("#2F6CB0"), boatW: C("#EDEDE8"),
  ballast: C("#8E857A"), rail: C("#3E3C3A"), pole: C("#6B6E70"), sand: C("#A8875E"), lawn: C("#FFFFFF"),
  craneR: C("#B5432F"), craneW: C("#E8E6E0"), craneB: C("#2F5E8E"), pool: C("#3FB2C8"), deckWood: C("#B08C62"), glass: C("#4C6878"),
};
const CONT = ["#2F6DA8", "#B23A2E", "#3F7A4A", "#D27C2C", "#E6E6E1", "#8D9399", "#D8B23A", "#234A7D", "#7A3B5C", "#4E8C8C"].map(C);
/** coast frame → world helpers (straight frame: t along the coast, b distance from the origin towards the sea) */
const L = (t: number, b: number) => atLine(t, b);
const coastB = (t: number) => COAST + wiggle(t);

function buildPort(b: Boxes, solids: { x0: number; x1: number; z0: number; z1: number; h: number }[]) {
  const r = rng(404), yaw = Math.atan2(-T.y, T.x); // box local x along the coast
  const Q = 2.4; // quay deck height
  // quays along the shore (apron) in 100 m pieces following the coast
  for (let t = PORT.t0 - 60; t < PORT.eastT; t += 100) {
    const [x0, z0] = atCoast(t, 60), [x1, z1] = atCoast(t + 100, 60);
    b.beam(x0, z0, x1, z1, -2, Q + 2, 210, COL.quaySide, COL.quayTop);
  }
  // the apron: sheds and container stacks between the pier roots, lorries, painted lanes
  const yellow = C("#D9B23A");
  for (let t = PORT.t0 + 60; t < PORT.eastT - 90; t += 160) {
    if (PORT.piers.some((pt) => Math.abs(pt - t) < 95)) continue;
    if (r() < 0.5) {
      const [x, z] = atCoast(t, 95);
      b.box(x, Q, z, 120, 10 + r() * 5, 44, yaw, COL.shed, r() < 0.5 ? COL.shedRoof : C("#B8B2A6"));
      solids.push({ x0: x - 60, x1: x + 60, z0: z - 60, z1: z + 60, h: 14 });
    } else {
      for (let k = 0; k < 8; k++) for (let row = 0; row < 5; row++) {
        const [px, pz] = atCoast(t - 50 + k * 13, 70 + row * 3);
        const hh = 1 + Math.floor(r() * 3);
        for (let lv = 0; lv < hh; lv++) b.box(px, Q + lv * 2.6, pz, 12.2, 2.55, 2.44, yaw, CONT[Math.floor(r() * CONT.length)]);
      }
    }
    for (let k = 0; k < 5; k++) { const [lx, lz] = atCoast(t - 60 + r() * 120, 140 + r() * 20); b.box(lx, Q, lz, 14, 3.6, 2.5, yaw, k % 2 ? COL.white : C("#2F5E8E")); }
  }
  for (let t = PORT.t0; t < PORT.eastT - 100; t += 100) { const [x0, z0] = atCoast(t, 128), [x1, z1] = atCoast(t + 100, 128); b.flat(x0, z0, x1, z1, 0.3, Q + 0.02, yellow); }
  // piers, straight out to sea, ending short of the jetty
  PORT.piers.forEach((t, k) => {
    const b0 = coastB(t) + 140, b1 = PORT.jettyB - 95, w = k === 0 ? 120 : 150;
    const [x0, z0] = L(t, b0), [x1, z1] = L(t, b1);
    b.beam(x0, z0, x1, z1, -2, Q + 2, w, COL.quaySide, COL.quayTop);
    const len = b1 - b0;
    // bollard line / edge marking
    for (const sd of [-1, 1]) { const [ax, az] = L(t + sd * (w / 2 - 2), b0), [bx, bz] = L(t + sd * (w / 2 - 2), b1); b.flat(ax, az, bx, bz, 0.4, Q + 0.02, COL.white); }
    if (k <= 1) {
      // sheds, and silos on the second pier
      for (let s = 30; s < len - 60; s += 95) {
        const [sx, sz] = L(t + (k === 1 ? -30 : 0), b0 + s + 40);
        b.box(sx, Q, sz, 70, 11 + r() * 3, k === 1 ? 50 : 90, yaw + Math.PI / 2, COL.shed, COL.shedRoof);
        solids.push({ x0: sx - 40, x1: sx + 40, z0: sz - 40, z1: sz + 40, h: 12 });
      }
      if (k === 1) for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) { const [sx, sz] = L(t + 45 + j * 14, b0 + 60 + i * 14); b.cyl(sx, Q, sz, 6.6, 6.6, 34, 12, COL.silo, C("#CFCBC2")); }
    } else {
      // container yard: blocks of stacks, 12.2 × 2.4 × 2.6 m boxes, 1 … 4 high
      for (let s = 40; s < len - 50; s += 34) for (let lane = -1; lane <= 1; lane += 2) for (let row = 0; row < 8; row++) {
        const lat = lane * (14 + row * 2.9);
        if (Math.abs(lat) > w / 2 - 16) continue;
        const [cx, cz] = L(t + lat, b0 + s);
        const hgt = 1 + Math.floor(r() * 4);
        for (let q = 0; q < 2; q++) {
          if (r() < 0.12) continue;
          const [px, pz] = L(t + lat, b0 + s + (q - 0.5) * 12.6);
          for (let lv = 0; lv < hgt; lv++) b.box(px, Q + lv * 2.6, pz, 2.44, 2.55, 12.2, yaw, CONT[Math.floor(r() * CONT.length)]);
        }
        void cx; void cz;
      }
      // gantry cranes along both edges of the pier, booms over the water
      for (const sd of [-1, 1]) for (let s = 70; s < len - 40; s += len / 3) {
        const base = t + sd * (w / 2 - 12), cr = r() < 0.6 ? COL.craneR : COL.craneB;
        for (const lg of [-8, 8]) for (const lt of [-6, 6]) { const [lx, lz] = L(base + lt, b0 + s + lg); b.box(lx, Q, lz, 1.6, 42, 1.6, yaw, cr); }
        const [hx, hz] = L(base, b0 + s);
        b.box(hx, Q + 42, hz, 18, 4, 20, yaw, COL.craneW);                         // portal beam + house
        const [bx0, bz0] = L(base - sd * 30, b0 + s), [bx1, bz1] = L(base + sd * 62, b0 + s);
        b.beam(bx0, bz0, bx1, bz1, Q + 44, 3, 2.6, cr);                                // boom
        const [ax, az] = L(base - sd * 2, b0 + s); b.box(ax, Q + 47, az, 3, 14, 3, yaw, cr); // A-frame
      }
    }
    // a cargo ship moored along the east side of each pier (but the first)
    if (k >= 1) {
      const sd = 1, lat = t + sd * (w / 2 + 16), s0 = b0 + 60 + r() * 60, Ls = 150 + r() * 60;
      const [hx, hz] = L(lat, s0 + Ls / 2);
      b.box(hx, -1.5, hz, 24, 8.5, Ls, yaw, COL.hull, COL.deck);
      b.box(hx, 7, hz, 24.2, 0.8, Ls - 2, yaw, COL.hullTop);
      const [sx, sz] = L(lat, s0 + 14);
      b.box(sx, 7, sz, 20, 15, 16, yaw, COL.white, C("#D8D6CF"));                         // superstructure at the stern
      b.box(sx, 22, sz, 4, 6, 4, yaw, COL.red);                                           // funnel
      for (let q = 30; q < Ls - 20; q += 13) for (let lt = -9; lt <= 9; lt += 2.6) if (r() < 0.75) {
        const [cx, cz] = L(lat + lt, s0 + q), hh = 1 + Math.floor(r() * 3);
        for (let lv = 0; lv < hh; lv++) b.box(cx, 7.8 + lv * 2.6, cz, 2.44, 2.55, 12.2, yaw, CONT[Math.floor(r() * CONT.length)]);
      }
    }
  });
  // the jetty: from the shore by the medina straight out, then along the coast to its harbour light
  const jb = PORT.jettyB, root = PORT.root;
  const pts: [number, number][] = [[root, coastB(root) - 20], [root, jb], [PORT.jettyEnd, jb]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ta, ba] = pts[i], [tb, bb] = pts[i + 1];
    const n = Math.ceil(Math.hypot(tb - ta, bb - ba) / 120);
    for (let k = 0; k < n; k++) {
      const t0 = ta + ((tb - ta) * k) / n, t1 = ta + ((tb - ta) * (k + 1)) / n, b0 = ba + ((bb - ba) * k) / n, b1 = ba + ((bb - ba) * (k + 1)) / n;
      const [x0, z0] = L(t0, b0), [x1, z1] = L(t1, b1);
      b.beam(x0, z0, x1, z1, -3, 3.2, 62, COL.rubble, COL.rubble2);   // rubble mound / tetrapods
      b.beam(x0, z0, x1, z1, -1, 4.6, 24, COL.concrete);                 // deck
      // seaward parapet wall
      const [px0, pz0] = L(t0, b0 + (i === 0 ? 0 : 11)), [px1, pz1] = L(t1, b1 + (i === 0 ? 0 : 11));
      if (i > 0) b.beam(px0, pz0, px1, pz1, 3.6, 2.4, 2.2, COL.quaySide, COL.concrete);
    }
  }
  // tetrapod rubble along the jetty: scattered dark blocks
  for (let t = root + 40; t < PORT.jettyEnd; t += 7) for (const sd of [-1, 1]) {
    const [x, z] = L(t + (r() - 0.5) * 5, jb + sd * (19 + r() * 9));
    b.box(x, -1.5, z, 3 + r() * 2, 3.2 + r() * 1.5, 3 + r() * 2, r() * 3, r() < 0.5 ? COL.rubble : COL.rubble2);
  }
  { const [x, z] = L(PORT.jettyEnd + 10, jb); b.cyl(x, 3.6, z, 2.6, 2.1, 14, 10, COL.white); b.cyl(x, 17.6, z, 1.6, 1.6, 3, 10, COL.red); }
  // east breakwater with its hook
  const e0 = coastB(PORT.eastT) - 20, epts: [number, number][] = [[PORT.eastT, e0], [PORT.eastT, jb - 60], [PORT.jettyEnd + 170, jb - 70]];
  for (let i = 0; i < epts.length - 1; i++) {
    const [ta, ba] = epts[i], [tb, bb] = epts[i + 1];
    const [x0, z0] = L(ta, ba), [x1, z1] = L(tb, bb);
    b.beam(x0, z0, x1, z1, -3, 3, 48, COL.rubble, COL.rubble2);
    b.beam(x0, z0, x1, z1, -1, 4.2, 16, COL.concrete);
  }
  // fishing harbour: rows of small blue boats inside the jetty root, a fish market shed
  for (let row = 0; row < 7; row++) for (let k = 0; k < 26; k++) {
    if (r() < 0.2) continue;
    const t = root + 60 + k * 9.5 + (row % 2) * 4, bb = coastB(root + 60 + k * 9.5) + 40 + row * 18;
    const [x, z] = L(t, bb);
    const big = r() < 0.15;
    b.box(x, -0.2, z, big ? 4.5 : 3, big ? 2.2 : 1.2, big ? 16 : 8, yaw + Math.PI / 2 + (r() - 0.5) * 0.1, COL.boat, COL.boatW);
    if (big) b.box(x, 2, z, 3, 2.4, 4, yaw + Math.PI / 2, COL.boatW);
  }
  { const [x, z] = atCoast(PORT.t0 - 260, 40); b.box(x, Q, z, 80, 9, 30, yaw, COL.white, C("#C8C4BA")); }
}

function buildLighthouse(b: Boxes, solids: { x0: number; x1: number; z0: number; z1: number; h: number }[]) {
  const { x, z } = LIGHTHOUSE, white = COL.white;
  b.box(x + 10, 0, z + 6, 18, 5, 11, Math.PI / 4, white, C("#DAD6CC"));
  b.box(x - 8, 0, z - 10, 9, 4, 7, Math.PI / 4, white, C("#DAD6CC"));
  b.cyl(x, 0, z, 5.2, 5.2, 3, 8, C("#D9D4C8"));
  b.cyl(x, 3, z, 4.2, 3.1, 42, 8, white);
  b.cyl(x, 45, z, 4.2, 4.2, 0.8, 8, C("#3C3F42"));          // gallery
  b.cyl(x, 45.8, z, 2.4, 2.4, 3.6, 8, COL.glass);           // lantern
  b.cyl(x, 49.4, z, 2.6, 0.4, 2.2, 8, C("#2E3A36"));         // dome
  solids.push({ x0: x - 5, x1: x + 5, z0: z - 5, z1: z + 5, h: 51 });
}

function buildRacetrack(b: Boxes, lawn: { pos: number[]; idx: number[] }) {
  const { x, z, a, b: bb, yaw } = RACE, c = Math.cos(yaw), s = Math.sin(yaw);
  const P = (lx: number, lz: number): [number, number] => [x + lx * c + lz * s, z - lx * s + lz * c];
  const n = 96, W = 22;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const o = [Math.cos(a0), Math.sin(a0)], o1 = [Math.cos(a1), Math.sin(a1)];
    const q = (m: number) => P(o[0] * (a - m), o[1] * (bb - m)), q1 = (m: number) => P(o1[0] * (a - m), o1[1] * (bb - m));
    const [ax, az] = q(0), [bx, bz] = q1(0), [cx, cz] = q1(W), [dx, dz] = q(W);
    // track (sand), as two triangles via flat beams would distort: push a quad
    const base = b.pos.length / 3;
    b.pos.push(ax, 0.08, az, bx, 0.08, bz, cx, 0.08, cz, dx, 0.08, dz);
    for (let k = 0; k < 4; k++) { b.nor.push(0, 1, 0); b.col.push(COL.sand.r, COL.sand.g, COL.sand.b); }
    b.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
    // white rails at both edges
    b.flat(ax, az, bx, bz, 0.5, 0.11, COL.white);
    b.flat(dx, dz, cx, cz, 0.5, 0.11, COL.white);
    // infield lawn (fan)
    const l0 = lawn.pos.length / 3, [ix, iz] = q(W), [jx, jz] = q1(W);
    lawn.pos.push(x, 0.07, z, ix, 0.07, iz, jx, 0.07, jz);
    lawn.idx.push(l0, l0 + 2, l0 + 1);
  }
  // grandstand on the long side, facing the track
  const [gx, gz] = P(0, bb + 34);
  b.box(gx, 0, gz, 150, 13, 26, yaw, COL.white, C("#D4D0C6"));
  b.box(gx, 13, gz, 156, 1.2, 34, yaw, C("#E9E6DF"));
}

function buildRail(b: Boxes) {
  const r = rng(55);
  for (let i = 0; i < RAIL.length - 1; i++) {
    const [x0, z0] = RAIL[i], [x1, z1] = RAIL[i + 1], Ls = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / Ls, uz = (z1 - z0) / Ls, nx = -uz, nz = ux;
    b.flat(x0, z0, x1, z1, 14, 0.05, COL.ballast);
    for (const tr of [-2.3, 2.3]) for (const rl of [-0.72, 0.72]) b.flat(x0 + nx * (tr + rl), z0 + nz * (tr + rl), x1 + nx * (tr + rl), z1 + nz * (tr + rl), 0.14, 0.12, COL.rail);
    for (let s = 0; s < Ls; s += 55) {
      const px = x0 + ux * s + nx * 6.2, pz = z0 + uz * s + nz * 6.2;
      b.box(px, 0, pz, 0.3, 7, 0.3, 0, COL.pole);
      b.beam(px, pz, px - nx * 6, pz - nz * 6, 6.8, 0.2, 0.15, COL.pole);
    }
  }
  // Casa-Port station and a train at the platform
  const [x0, z0] = RAIL[0], [x1, z1] = RAIL[1], yaw = Math.atan2(-(z1 - z0), x1 - x0), ux = (x1 - x0) / Math.hypot(x1 - x0, z1 - z0), uz = (z1 - z0) / Math.hypot(x1 - x0, z1 - z0);
  b.box(x0 - ux * 30 - uz * 22, 0, z0 - uz * 30 + ux * 22, 110, 12, 30, yaw, C("#E9EAE6"), C("#B9C3C9"));
  for (let k = 0; k < 8; k++) {
    const s = 40 + k * 26.5, px = x0 + ux * s - uz * 2.3, pz = z0 + uz * s + ux * 2.3;
    b.box(px, 0.4, pz, 26, 3.8, 3, yaw, C("#D9DBDA"), C("#A8ADB0"));
    b.box(px, 2.2, pz, 26.1, 0.5, 3.05, yaw, C("#D8742E"));
  }
  void r;
}

function buildBeachClubs(b: Boxes) {
  const r = rng(77), yaw = Math.atan2(-T.y, T.x);
  for (let t = CORNICHE.t0 + 400; t < -1900; t += 260 + r() * 200) {
    if (beachWidth(t) < 40) continue;
    const [x, z] = atCoast(t, -58);
    b.box(x, 0, z, 46 + r() * 30, 1.2, 26, yaw, COL.deckWood, C("#C9A47A"));
    const [hx, hz] = atCoast(t - 14, -66);
    b.box(hx, 1.2, hz, 18, 4.5, 10, yaw, COL.white, C("#E4E0D6"));
    const [px, pz] = atCoast(t + 8, -55);
    b.box(px, 1.21, pz, 16, 0.02, 8, yaw, COL.pool);
    for (let k = 0; k < 8; k++) { const [ux, uz] = atCoast(t - 20 + k * 6, -28 + (k % 2) * 6); b.cyl(ux, 0, uz, 0.05, 0.05, 2.2, 4, C("#EDEDE6")); b.cyl(ux, 2.2, uz, 1.5, 0.05, 0.4, 8, k % 3 ? C("#E9E4D4") : C("#C96A3A")); }
  }
}

function buildTwinCrowns(b: Boxes) {
  for (const [x, z] of TWIN) {
    b.box(x, 116, z, 26, 5, 26, 0.26, C("#E9EAE8"), C("#CFD3D4"));
    b.box(x, 121, z, 12, 7, 12, 0.26, C("#5E7C8C"), C("#DADDDE"));
    b.box(x, 128, z, 0.8, 16, 0.8, 0.26, C("#C9CCCE"));
  }
}

export function CitySites() {
  const res = useMemo(() => {
    const b = new Boxes(), solids: { x0: number; x1: number; z0: number; z1: number; h: number }[] = [];
    const lawn = { pos: [] as number[], idx: [] as number[] };
    buildPort(b, solids); buildLighthouse(b, solids); buildRacetrack(b, lawn); buildRail(b); buildBeachClubs(b); buildTwinCrowns(b);
    const geo = b.geometry();
    const mat = plainMat({ vertexColors: true, roughness: 0.82, side: THREE.DoubleSide }, "sites");
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(lawn.pos, 3));
    lg.setAttribute("normal", new THREE.Float32BufferAttribute(lawn.pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    lg.setIndex(lawn.idx);
    const lmat = lawnMaterial(); lmat.side = THREE.DoubleSide;
    // lantern glow (night)
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: "#FFE3B0", transparent: true, depthWrite: false, opacity: 0 });
    return { geo, mat, lg, lmat, solids, glowMat };
  }, []);
  useEffect(() => { registerSolids("sites", res.solids); return () => registerSolids("sites", []); }, [res]);
  useEffect(() => () => { res.geo.dispose(); res.lg.dispose(); res.mat.dispose(); res.lmat.dispose(); res.glowMat.dispose(); }, [res]);
  const glow = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    const g = glow.current;
    if (!g) return;
    const n = CU.uNight.value;
    const pulse = 0.65 + 0.35 * Math.max(0, Math.sin(clock.elapsedTime * 1.3));
    res.glowMat.opacity = n * pulse;
    g.visible = n > 0.02;
    const s = 26 + Math.min(400, frame.alt * 0.04);
    g.scale.set(s, s, 1);
  });
  return (
    <group>
      <mesh geometry={res.geo} material={res.mat} receiveShadow raycast={() => null} />
      <mesh geometry={res.lg} material={res.lmat} receiveShadow raycast={() => null} />
      <sprite ref={glow} material={res.glowMat} position={[LIGHTHOUSE.x, 47.6, LIGHTHOUSE.z]} />
    </group>
  );
}
