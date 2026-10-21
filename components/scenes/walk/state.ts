// Walk mode runtime state, mutated every frame by the walk controller (WalkWorld.tsx) and read by the hospital
// drawing (floor cut-away, LOD, sliding doors, people pausing) without React re-renders. Campus frame (see plan.ts).
import { FLOOR_H } from "@/lib/hospital";
import type { BId } from "./plan";

export type WalkPhase = "off" | "enter" | "on" | "exit";

export const W = {
  phase: "off" as WalkPhase,
  third: true,                       // third person (false = first person)
  // the visitor: feet position, velocity, facing (yaw around +y, 0 = facing +z)
  x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, heading: 0, grounded: true, speed: 0,
  where: null as BId | null,         // building whose plate (or stair tower) contains the visitor
  tower: false,                      // inside a stair tower
  level: 0,                          // floor index under the feet (0 outdoors)
  // camera (third person): yaw around the visitor (0 = camera on the +z side), pitch (+ = looking down), distance
  yaw: 0, pitch: 0.3, dist: 4.2,
  // cut-away: floors of `cutB` whose slab is above `cutY` are hidden; stair tower geometry above `clipY` is clipped
  cutB: null as BId | null, cutY: Infinity, clipY: Infinity,
};

/** The visitor is being driven (not during the entry / exit flights). */
export const walkOn = () => W.phase === "on";
/** Walk mode owns the camera (entry flight, walking, exit). */
export const walkBusy = () => W.phase !== "off";

/** Floor (building, index) hidden by the third-person cut-away. */
export function floorCut(building: BId, floor: number) {
  return W.phase === "on" && W.cutB === building && floor * FLOOR_H > W.cutY;
}

/** Ask the walk controller to enter / leave / toggle walk mode (handled by WalkWorld). */
export function walkRequest(what: "enter" | "exit" | "toggle") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("atlas:walk", { detail: what }));
}

/** Touch joystick (WalkHud): x right, y forward, −1…1. */
export const TOUCH = { x: 0, y: 0 };

/** Set by the mounted walk controller: enter (fly down to the visitor), exit (back to the overview), stop (hand the
 *  camera back right away, e.g. when another flight takes over). No-ops until WalkWorld is mounted. */
export const WALK_API = { enter: () => {}, exit: () => {}, stop: () => {} };
