"use client";
// Minimal replacement for drei <Html> used by the geo labels. drei creates/unmounts one React root per label inside a
// layout effect; under React StrictMode (dev) the double mount races ("synchronously unmount a root…") and a label can end
// up empty. Here each label keeps ONE root for its whole life: the unmount is deferred and cancelled if the effect re-runs.
import * as THREE from "three";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";

type Props = {
  position?: THREE.Vector3 | [number, number, number]; children?: ReactNode; zIndex?: number; center?: boolean;
  /** cover the whole stage (children position themselves in screen pixels) instead of following a 3D point */
  fullscreen?: boolean;
};
type El = HTMLDivElement & { __geoRoot?: Root | null; __geoTimer?: ReturnType<typeof setTimeout> | null };

const _v = new THREE.Vector3();

export function GeoHtml({ position, children, zIndex = 4, center = false, fullscreen = false }: Props) {
  const group = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const [el] = useState(() => {
    const d = document.createElement("div") as El;
    d.style.cssText = fullscreen
      ? `position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:${zIndex};`
      : `position:absolute;top:0;left:0;pointer-events:none;will-change:transform;z-index:${zIndex};`;
    return d;
  });
  const shown = useRef(true);

  useLayoutEffect(() => {
    const target = gl.domElement.parentNode as HTMLElement | null;
    if (!target) return;
    if (el.__geoTimer) { clearTimeout(el.__geoTimer); el.__geoTimer = null; }
    if (el.parentNode !== target) target.appendChild(el);
    if (!el.__geoRoot) el.__geoRoot = createRoot(el);
    return () => {
      el.__geoTimer = setTimeout(() => {
        el.__geoTimer = null;
        el.__geoRoot?.unmount();
        el.__geoRoot = null;
        el.remove();
      }, 0);
    };
  }, [gl, el]);

  useLayoutEffect(() => {
    el.__geoRoot?.render(center ? <div style={{ transform: "translate(-50%, -50%)" }}>{children}</div> : <>{children}</>);
  });

  useFrame(({ camera, size }) => {
    const g = group.current;
    if (!g || fullscreen) return;
    g.getWorldPosition(_v);
    _v.project(camera);
    const vis = _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.3 && Math.abs(_v.y) < 1.3;
    if (vis !== shown.current) { shown.current = vis; el.style.display = vis ? "block" : "none"; }
    if (!vis) return;
    const x = ((_v.x + 1) / 2) * size.width, y = ((1 - _v.y) / 2) * size.height;
    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  });

  return <group ref={group} position={position} />;
}
