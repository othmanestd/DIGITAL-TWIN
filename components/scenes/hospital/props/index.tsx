"use client";
// <HospitalProps/>: the hospital's detail props, mounted once inside HospitalContent's campus group (building frame of
// lib/hospital). One <FloorProps> per floor — it follows that floor's lift, fade, cut-away and level of detail — plus
// the year-driven twin pilot room on the top floor. Colliders for walk mode: ./colliders.ts (propSolids).
import { FLOOR_LAYOUTS } from "../layout";
import FloorProps, { SNAP } from "./FloorProps";
import TwinRoom from "./TwinRoom";

// dev / QA hook (screenshots): settle the timeline transitions of the props at once
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") Object.assign(window as object, { __props: { snap: () => ++SNAP.n } });

export function HospitalProps() {
  return (
    <group name="hospital-props">
      {FLOOR_LAYOUTS.map((fp) => (
        <FloorProps key={fp.key} fp={fp}>
          {fp.key === "main:4" ? (mats, clock) => <TwinRoom mats={mats} clock={clock} /> : undefined}
        </FloorProps>
      ))}
    </group>
  );
}
export default HospitalProps;
