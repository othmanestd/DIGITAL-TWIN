"use client";
// Door openings in the glass façades (walk/plan.ts OPENINGS): the glass around them as panels with a transom above,
// slim anthracite frames, and at the entrances two glass sliding leaves that open when the visitor walks up to them.
// Floor-local frame (building centre, y = 0 at the floor surface).
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FloorLayout } from "./layout";
import type { FloorMats } from "./mats";
import { BLD, GLASS_OFF, openingsOf, subtract, type BId, type Opening, type Side } from "../walk/plan";
import { W } from "../walk/state";

const SIDES: Side[] = ["+x", "-x", "+z", "-z"];
const alongX = (s: Side) => s === "+z" || s === "-z";
const sign = (s: Side) => (s[0] === "+" ? 1 : -1);

export function openSides(b: BId, floor: number): Record<Side, boolean> {
  return { "+x": openingsOf(b, floor, "+x").length > 0, "-x": openingsOf(b, floor, "-x").length > 0, "+z": openingsOf(b, floor, "+z").length > 0, "-z": openingsOf(b, floor, "-z").length > 0 };
}

/** Glass of the sides that have openings: full-height panels between the openings and transoms above them. */
export function glassPanels(b: BId, floor: number, w: number, d: number, H: number): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  for (const sd of SIDES) {
    const ops = openingsOf(b, floor, sd);
    if (!ops.length) continue;
    const ax = alongX(sd);
    const L = (ax ? w : d) / 2 + GLASS_OFF, off = sign(sd) * ((ax ? d : w) / 2 + GLASS_OFF);
    const put = (a0: number, a1: number, y0: number, y1: number) => {
      const g = new THREE.PlaneGeometry(a1 - a0, y1 - y0);
      if (!ax) g.rotateY(Math.PI / 2);
      const c = (a0 + a1) / 2, y = (y0 + y1) / 2;
      g.translate(ax ? c : off, y, ax ? off : c);
      geos.push(g);
    };
    for (const [a0, a1] of subtract(-L, L, ops.map((o) => [o.c - o.w / 2, o.c + o.w / 2]))) put(a0, a1, 0, H);
    for (const o of ops) put(o.c - o.w / 2, o.c + o.w / 2, o.h, H);
  }
  if (!geos.length) return null;
  const m = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return m;
}

const BAR = new THREE.BoxGeometry(1, 1, 1);
const PANE = new THREE.PlaneGeometry(1, 1);

type Door = { o: Opening; ax: boolean; off: number; cx: number; cz: number; leaves: (THREE.Group | null)[]; a: number };

export function Openings({ fl, mats, H }: { fl: FloorLayout; mats: FloorMats; H: number }) {
  const doors = useMemo<Door[]>(() => SIDES.flatMap((sd) => openingsOf(fl.building, fl.floor, sd).map((o) => {
    const ax = alongX(sd), off = sign(sd) * ((ax ? fl.d : fl.w) / 2 + GLASS_OFF);
    const B = BLD[fl.building];
    return { o, ax, off, cx: B.x + (ax ? o.c : off), cz: B.z + (ax ? off : o.c), leaves: [null, null], a: 0 };
  })), [fl]);

  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 5);
    for (const d of doors) {
      if (d.o.kind !== "slide") continue;
      let want = 0;
      if (W.phase === "on" && W.y < fl.floor * 4.4 + 2) {
        const dx = W.x - d.cx, dz = W.z - d.cz;
        if (dx * dx + dz * dz < 4.2 * 4.2) want = 1;
      }
      d.a += (want - d.a) * k;
      const e = d.a * d.a * (3 - 2 * d.a), slide = e * (d.o.w / 2 - 0.04);
      for (let i = 0; i < 2; i++) {
        const g = d.leaves[i];
        if (!g) continue;
        const along = d.o.c + (i ? 1 : -1) * (d.o.w / 4 + slide);
        if (d.ax) g.position.x = along; else g.position.z = along;
      }
    }
  });

  return (
    <group>
      {doors.map((d, n) => {
        const { o, ax, off } = d;
        const out = sign(o.side);
        // a frame part along the side: along-centre c, width a, height h at y; depth t across the façade
        const bar = (c: number, a: number, y: number, h: number, t = 0.16, o2 = 0) => (
          <mesh geometry={BAR} material={mats.parts.dark} castShadow
            position={ax ? [c, y, off + o2 * out] : [off + o2 * out, y, c]} scale={ax ? [a, h, t] : [t, h, a]} />
        );
        return (
          <group key={n}>
            {bar(o.c - o.w / 2 - 0.035, 0.07, o.h / 2, o.h)}
            {bar(o.c + o.w / 2 + 0.035, 0.07, o.h / 2, o.h)}
            {bar(o.c, o.w + 0.14, o.h + 0.04, 0.08)}
            {o.kind === "slide" && fl.building === "main" && (
              // threshold plate over the gap between the slab edge and the plinth
              <mesh geometry={BAR} material={mats.parts.steel} receiveShadow
                position={ax ? [o.c, -0.012, off + out * 0.33] : [off + out * 0.33, -0.012, o.c]} scale={ax ? [o.w + 0.1, 0.03, 0.78] : [0.78, 0.03, o.w + 0.1]} />
            )}
            {o.kind === "slide" && [0, 1].map((i) => {
              const lw = o.w / 2 + 0.04, lh = o.h - 0.04;
              return (
                <group key={i} ref={(g) => { d.leaves[i] = g; }}
                  position={ax ? [o.c + (i ? 1 : -1) * (o.w / 4), 0, off + out * 0.07] : [off + out * 0.07, 0, o.c + (i ? 1 : -1) * (o.w / 4)]}>
                  <mesh geometry={PANE} material={mats.glass} rotation-y={ax ? 0 : Math.PI / 2} position={[0, lh / 2, 0]} scale={[lw - 0.08, lh - 0.08, 1]} renderOrder={1} />
                  {[-1, 1].map((sx) => (
                    <mesh key={sx} geometry={BAR} material={mats.parts.steel} castShadow
                      position={ax ? [sx * (lw / 2 - 0.025), lh / 2, 0] : [0, lh / 2, sx * (lw / 2 - 0.025)]} scale={ax ? [0.05, lh, 0.05] : [0.05, lh, 0.05]} />
                  ))}
                  {[0.025, lh - 0.025].map((y) => (
                    <mesh key={y} geometry={BAR} material={mats.parts.steel}
                      position={[0, y, 0]} scale={ax ? [lw, 0.05, 0.05] : [0.05, 0.05, lw]} />
                  ))}
                </group>
              );
            })}
          </group>
        );
      })}
      {/* keep H referenced for future transom details */}
      {H < 0 && null}
    </group>
  );
}
