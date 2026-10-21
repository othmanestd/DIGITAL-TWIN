// Runtime values shared by the story stage and its props (mutated every frame, never rendered by React).
import * as THREE from "three";
import type { CastId } from "@/lib/ai/story";
import { rt } from "../hospital/mats";

/** Live feet position (building frame) and visibility of each character; the floor open in the 3D view. */
export const STAGE = { pos: new Map<CastId, THREE.Vector3>(), vis: new Map<CastId, number>(), open: null as string | null };

/** Is this floor drawn and in view (open floor, or the ground floor of the overview, or outdoors)? */
export function floorShown(key: string): boolean {
  if (key === "out") return true;
  if ((rt.lift[key] ?? 0) > 0.05) return false;
  const open = STAGE.open;
  return open === key || (!open && key === "main:0");
}

if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") (window as unknown as { __stage: unknown }).__stage = Object.assign(STAGE, { light: () => ({ day: rt.day, target: rt.dayTarget }) });
