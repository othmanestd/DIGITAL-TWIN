"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { animate } from "motion/react";

const useIso = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Animated number that eases to `target` whenever it changes (count-up). */
export function useCountUp(target: number, opts?: { duration?: number; from?: number }) {
  const duration = opts?.duration ?? 0.9;
  const [v, setV] = useState(opts?.from ?? target);
  const cur = useRef(opts?.from ?? target);
  useEffect(() => {
    if (!Number.isFinite(target)) { setV(target); return; }
    const c = animate(cur.current, target, {
      duration,
      ease: [0.2, 0.8, 0.2, 1],
      onUpdate: (x) => { cur.current = x; setV(x); },
    });
    return () => c.stop();
  }, [target, duration]);
  return v;
}

/** Element size (ResizeObserver). */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useIso(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((e) => {
      const r = e[0].contentRect;
      setSize((s) => (Math.abs(s.w - r.width) < 0.5 && Math.abs(s.h - r.height) < 0.5 ? s : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

/** Viewport size (dynamic viewport: follows window.innerWidth / innerHeight). */
export function useViewport() {
  const [v, setV] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    const f = () => setV({ w: window.innerWidth, h: window.innerHeight });
    f(); window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return v;
}
