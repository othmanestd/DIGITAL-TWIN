"use client";
// Time travel: each time the year changes, a quick, calm day → night → day time-lapse (~2.8 s). It only drives rt.day
// (1 day … 0 night), shared with the lights, the lit windows and the sky (components/scenes/city/Sky.tsx draws the
// atmosphere, sun, moon and stars from it), so the whole scene goes through dusk, night and dawn together.
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useApp } from "@/lib/store";
import { rt } from "./mats";

const DURATION = 2.8;
const SUN_REST = Math.PI * 0.64;

export default function TimeTravel() {
  const year = useApp((s) => s.year);
  const start = useRef<number | null>(null);
  const prevYear = useRef(year);
  const clock = useRef(0);
  const over = useRef({ day: 1, w: 0 });
  useEffect(() => {
    if (prevYear.current !== year) { start.current = clock.current; prevYear.current = year; }
  }, [year]);

  useFrame((_, dt) => {
    clock.current += Math.min(dt, 0.25);
    const p = start.current === null ? 1 : Math.min(1, (clock.current - start.current) / DURATION);
    if (p >= 1) start.current = null;
    const ease = p < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * p) : 1;
    const phi = SUN_REST + ease * Math.PI * 2; // one full turn: sunset, night, sunrise
    const lapse = Math.min(1, Math.max(0, Math.sin(phi) * 2.2 + 0.25));
    // guided visit: the scene's clock (rt.dayTarget, set by components/scenes/story while a visit plays), eased in and
    // out over ~2 s and never brighter than the time-lapse, so a year change still sweeps through the night
    const o = over.current, k = 1 - Math.exp(-Math.min(dt, 0.25) * 1.6);
    o.w += ((rt.dayTarget === null ? 0 : 1) - o.w) * k;
    if (rt.dayTarget !== null) o.day += (rt.dayTarget - o.day) * k;
    else if (o.w < 0.01) o.day = 1;
    rt.day = Math.min(lapse, 1 - o.w * (1 - o.day));
  });

  return null;
}
