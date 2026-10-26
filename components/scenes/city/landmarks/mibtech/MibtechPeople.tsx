"use client";
// MIBTECH's staff on one floor (illustrative, like the hospital's people): the shared human kit (people/human.ts), one
// instanced draw call per floor. Placed on the furniture of the architect's electrical plans (mibtechFurnitureData.ts):
//  · about 4 workstations in 10 occupied, people typing at their screens;
//  · one meeting going on per floor (people seated round a table, chatting);
//  · a few people standing at the kitchenette counters, a few walking along free aisles (paths found with the walk
//    colliders, back and forth with a pause at each end).
// The number of people, who sits where and their looks are ILLUSTRATIVE (no staffing data). On the 1st floor, two
// colleagues of the team are seated side by side in the first meeting room, dressed as in a photo supplied by the user
// (stylised figures: clothes, hair, glasses; no name).
// Positions are in the building's plan frame (the parent group carries the placement). Walk mode: their positions are
// shared with walk/mibtechWalk.ts (MB_PEOPLE) so the visitor steps round them.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { frame } from "@/lib/world";
import { BONE, dress, newPose, poseCounter, poseIdle, poseSit, poseType, poseWalk, type Garb, type HumanLook, type Pose } from "../../../people/human";
import { useHumanCrowd } from "../../../people/useHumans";
import { FURN_KINDS, MIBTECH_FURNITURE } from "./mibtechFurnitureData";
import { floorY, type MbFloor } from "./mibtechGeo";
import { planVec } from "./mibtechFrame";
import { MB_PEOPLE, mbGroundAt, mbResolveBody } from "../../../walk/mibtechWalk";

type Npc = {
  kind: "type" | "sit" | "stand" | "walk"; x: number; z: number; yaw: number; sd: number; look: HumanLook; glasses?: boolean;
  path?: [number, number, number, number]; // walk: from (x0, z0) to (x1, z1)
};
const K = (k: (typeof FURN_KINDS)[number]) => FURN_KINDS.indexOf(k);
const SEAT = 0.49;          // seat top of the chairs drawn in mibtechGeo
const yawOf = (fx: number, fz: number) => Math.atan2(fx, fz); // the kit: yaw 0 faces +z
function rng(seed: number) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909)), (s >>> 0) / 4294967296); }
const GARBS: Garb[] = ["office", "admin", "visitor", "office", "admin", "cadre"];

/** the two colleagues of the photo (stylised: clothes, hair, glasses) */
const PHOTO: HumanLook[] = [
  { fem: false, skin: 0xd9ad8c, top: 0x7a2c34, bottom: 0x2b2d33, hair: 0x1d1612, shoe: 0x1e1f22, accent: 0x6c2630, sleeve: 0xd9ad8c, accent2: 0x2e3240, styles: ["collar", "buttons", "short"], girth: 1.0, height: 1.0 },
  { fem: false, skin: 0xa36d4e, top: 0x1b1c1f, bottom: 0x24262b, hair: 0x15100d, shoe: 0x1e1f22, accent: 0x1b1c1f, sleeve: 0xa36d4e, accent2: 0x2e3240, styles: ["short"], girth: 1.0, height: 1.02 },
];

/** a free aisle on this floor: a straight run of ≥ 4 m where the walk colliders let a person through */
function aisle(f: MbFloor, r: () => number): [number, number, number, number] | null {
  const y = floorY(f), p = { x: 0, z: 0 }, n = { x: 0, z: 0 };
  const free = (px: number, pz: number) => {
    const [x, z] = planVec(px, pz);
    if (Math.abs(mbGroundAt(x, z, y) - y) > 0.05) return false;
    p.x = x; p.z = z; n.x = 0; n.z = 0;
    return !mbResolveBody(p, y, 0.32, n, false);
  };
  for (let tries = 0; tries < 400; tries++) {
    const x0 = -14 + r() * 28, z0 = -28 + r() * 27;
    if (!free(x0, z0)) continue;
    const ax = r() < 0.5, d = r() < 0.5 ? 1 : -1;
    let L = 0;
    while (L < 12 && free(x0 + (ax ? d * (L + 0.25) : 0), z0 + (ax ? 0 : d * (L + 0.25)))) L += 0.25;
    if (L >= 4) return [x0, z0, x0 + (ax ? d * L : 0), z0 + (ax ? 0 : d * L)];
  }
  return null;
}

function cast(f: MbFloor): Npc[] {
  const items = MIBTECH_FURNITURE[f], r = rng(1000 + f * 77), out: Npc[] = [];
  const look = (i: number) => dress(GARBS[Math.floor(r() * GARBS.length)], f * 1000 + i * 31);
  const desks = items.filter((it) => it[0] === K("desk"));
  const tables = items.filter((it) => it[0] === K("table"));
  const chairs = items.filter((it) => it[0] === K("chair"));
  const meeting = tables.filter((t) => chairs.filter((c) => Math.hypot(c[1] - t[1], c[2] - t[2]) < Math.max(t[3], t[4]) / 2 + 1).length >= 4);
  // the colleagues of the photo: 1st floor, first meeting room, two neighbouring chairs on one side of the table
  const reserved = new Set<number>();
  if (f === 1 && meeting.length) {
    const t = meeting[0], ux = Math.cos(t[5]), uz = Math.sin(t[5]);
    const side = chairs.map((c, i) => ({ c, i, u: (c[1] - t[1]) * ux + (c[2] - t[2]) * uz, v: -(c[1] - t[1]) * uz + (c[2] - t[2]) * ux }))
      .filter((o) => Math.hypot(o.c[1] - t[1], o.c[2] - t[2]) < Math.max(t[3], t[4]) / 2 + 1 && o.v > 0.3).sort((a, b) => a.u - b.u);
    side.slice(0, 2).forEach((o, k) => {
      reserved.add(o.i);
      out.push({ kind: "sit", x: o.c[1], z: o.c[2], yaw: yawOf(Math.cos(o.c[5]), Math.sin(o.c[5])), sd: k * 3.1, look: PHOTO[k], glasses: true });
    });
  }
  // one meeting per floor (another table than the colleagues' one when there is a choice)
  const mt = meeting[f === 1 && meeting.length > 1 ? 1 : 0];
  chairs.forEach((c, i) => {
    if (reserved.has(i)) return;
    const yaw = yawOf(Math.cos(c[5]), Math.sin(c[5]));
    if (mt && Math.hypot(c[1] - mt[1], c[2] - mt[2]) < Math.max(mt[3], mt[4]) / 2 + 1) {
      if (r() < 0.75) out.push({ kind: "sit", x: c[1], z: c[2], yaw, sd: r() * 9, look: look(i) });
      return;
    }
    // workstation: a desk right in front of the chair
    const fx = Math.cos(c[5]), fz = Math.sin(c[5]);
    const atDesk = desks.some((d) => { const dx = d[1] - c[1], dz = d[2] - c[2], l = Math.hypot(dx, dz); return l < 0.95 && (dx * fx + dz * fz) / Math.max(l, 1e-3) > 0.4; });
    if (atDesk && r() < 0.4) out.push({ kind: "type", x: c[1], z: c[2], yaw, sd: r() * 9, look: look(i) });
  });
  // the kitchenette: a counter (long, shallow cabinet) with no WC near it; one or two people standing at it
  for (const cb of items.filter((it) => it[0] === K("cabinet") && it[3] >= 1.5 && it[4] <= 0.75)) {
    if (items.some((w) => w[0] === K("wc") && Math.hypot(w[1] - cb[1], w[2] - cb[2]) < 4)) continue;
    const ux = Math.cos(cb[5]), uz = Math.sin(cb[5]);
    for (const sgn of [1, -1]) {
      const nx = -uz * sgn, nz = ux * sgn, px = cb[1] + nx * (cb[4] / 2 + 0.45), pz = cb[2] + nz * (cb[4] / 2 + 0.45);
      const [wx, wz] = planVec(px, pz);
      if (Math.abs(mbGroundAt(wx, wz, floorY(f)) - floorY(f)) > 0.05 || mbResolveBody({ x: wx, z: wz }, floorY(f), 0.3, { x: 0, z: 0 }, false)) continue;
      out.push({ kind: "stand", x: px, z: pz, yaw: yawOf(-nx, -nz), sd: r() * 9, look: look(900 + out.length) });
      break;
    }
  }
  // walkers along free aisles
  for (let k = 0; k < 4; k++) {
    const a = aisle(f, r);
    if (a) out.push({ kind: "walk", x: a[0], z: a[1], yaw: 0, sd: r() * 20, look: look(500 + k), path: a });
  }
  return out;
}

// glasses: two thin frames and a bridge, in the head bone's frame (eyes at y 0.088, z 0.094 — people/human.ts)
function glassesGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const bar = (w: number, h: number, x: number, y: number, z = 0.106) => parts.push(new THREE.BoxGeometry(w, h, 0.004).translate(x, y, z));
  for (const s of [-1, 1]) {
    const cx = s * 0.033;
    bar(0.04, 0.004, cx, 0.103); bar(0.04, 0.004, cx, 0.079); bar(0.004, 0.028, cx - 0.02, 0.091); bar(0.004, 0.028, cx + 0.02, 0.091);
    parts.push(new THREE.BoxGeometry(0.004, 0.004, 0.1).translate(s * 0.086, 0.1, 0.056)); // temple arm
  }
  bar(0.026, 0.004, 0, 0.098);
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  return g;
}

const P = newPose(), _m = new THREE.Matrix4();
/** Walk mode reads MB_PEOPLE in its own frame (scene offset from the plans' origin), floor height included. */
export default function MibtechPeople({ floor }: { floor: MbFloor }) {
  const npcs = useMemo(() => cast(floor), [floor]);
  const crowd = useHumanCrowd(npcs.length);
  const glasses = useMemo(() => ({ geo: glassesGeo(), mat: new THREE.MeshStandardMaterial({ color: "#121316", roughness: 0.4, metalness: 0.4 }) }), []);
  const nGl = Math.max(1, npcs.filter((n) => n.glasses).length);
  const gl = useRef<THREE.InstancedMesh>(null);
  const st = useRef({ t: 0, base: -1, n: 0 });
  useEffect(() => {
    npcs.forEach((n, i) => crowd.setLook(i, n.look));
    const s = st.current;
    return () => { if (s.base >= 0) for (let i = 0; i < s.n; i++) MB_PEOPLE[s.base + i].on = false; };
  }, [npcs, crowd]);
  useEffect(() => () => { glasses.geo.dispose(); glasses.mat.dispose(); }, [glasses]);
  const y = floorY(floor);
  useFrame((_, dt) => {
    const s = st.current, g = crowd.mesh;
    // only while the floor is shown and the camera is near the building
    let o: THREE.Object3D | null = g, shown = true;
    while (o) { if (!o.visible) { shown = false; break; } o = o.parent; }
    if (s.base < 0 || s.n !== npcs.length) { // slots in the shared list (walk collisions); a new cast gets new slots
      for (let i = 0; i < s.n; i++) MB_PEOPLE[s.base + i].on = false;
      s.base = MB_PEOPLE.length; s.n = npcs.length;
      for (let i = 0; i < npcs.length; i++) MB_PEOPLE.push({ x: 0, z: 0, y, on: false });
    }
    if (!shown || frame.alt > 600) { for (let i = 0; i < npcs.length; i++) MB_PEOPLE[s.base + i].on = false; return; }
    s.t += Math.min(dt, 0.1);
    const t = s.t;
    let gi = 0;
    npcs.forEach((n, i) => {
      const sc = crowd.height[i];
      let x = n.x, z = n.z, yaw = n.yaw;
      if (n.kind === "type") poseType(P, SEAT, sc, t, n.sd, 0.75, 0.46);
      else if (n.kind === "sit") poseSit(P, SEAT, sc, t, n.sd);
      else if (n.kind === "stand") poseCounter(P, t, n.sd, 0.92, 0.32, sc);
      else if (n.path) {
        // back and forth at 1.15 m/s, 1.6 s pause at each end
        const [x0, z0, x1, z1] = n.path, L = Math.hypot(x1 - x0, z1 - z0), leg = L / 1.15, cyc = 2 * (leg + 1.6);
        const u = (t + n.sd) % cyc, back = u > leg + 1.6, w = back ? u - (leg + 1.6) : u;
        const k = Math.min(1, w / leg), moving = w < leg;
        const a = back ? 1 - k : k;
        x = x0 + (x1 - x0) * a; z = z0 + (z1 - z0) * a;
        yaw = back ? yawOf(x0 - x1, z0 - z1) : yawOf(x1 - x0, z1 - z0);
        if (moving) poseWalk(P, ((t + n.sd) * 1.15 * Math.PI * 2) / (1.75 * sc), 1); else poseIdle(P, t, n.sd);
      }
      crowd.write(i, x, y, z, yaw, 1, P);
      if (n.glasses && gl.current) { crowd.attach(_m, BONE.head); gl.current.setMatrixAt(gi++, _m); }
      const [wx, wz] = planVec(x, z), q = MB_PEOPLE[s.base + i];
      q.x = wx; q.z = wz; q.on = true;
    });
    if (gl.current) { gl.current.count = gi; gl.current.instanceMatrix.needsUpdate = true; }
  });
  return (
    <>
      <primitive object={crowd.mesh} />
      <instancedMesh ref={gl} args={[glasses.geo, glasses.mat, nGl]} frustumCulled={false} />
    </>
  );
}
