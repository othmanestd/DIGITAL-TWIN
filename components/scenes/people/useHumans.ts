"use client";
// React glue for the human kit: one HumanCrowd (one instanced draw call) per consumer, disposed on unmount.
import { useEffect, useMemo } from "react";
import { HumanCrowd, type CrowdOpts } from "./human";

export function useHumanCrowd(n: number, o: CrowdOpts = {}) {
  const t = !!o.transparent, sh = o.shadow !== false, r = o.roughness ?? 0.8;
  const crowd = useMemo(() => new HumanCrowd(Math.max(1, n), { transparent: t, shadow: sh, roughness: r }), [n, t, sh, r]);
  useEffect(() => () => crowd.dispose(), [crowd]);
  return crowd;
}
