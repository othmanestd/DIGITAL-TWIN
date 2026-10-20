"use client";
// Time travel: each time the year changes, a quick, calm day → night → day time-lapse (~2.8 s): a sun and a moon travel
// on a large arc behind the campus, a backdrop dome tints the sky (dusk, night, dawn) and the windows light up at night.
// Steady state = daylight with an invisible dome, so the app's navy background shows. The dome fades out above ~1 500 m
// of camera altitude (unified "powers of ten" world). rt.day (1 day … 0 night) is shared with the lights.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useApp } from "@/lib/store";
import { rt } from "./mats";

const DURATION = 2.8;
const ARC = { cx: 0, cy: -40, z: -330, r: 340 };
const SUN_REST = Math.PI * 0.64;

function discTexture(inner: string, outer: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, inner); gr.addColorStop(0.32, inner); gr.addColorStop(0.42, outer); gr.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NIGHT_TOP = new THREE.Color("#04081A"), NIGHT_HOR = new THREE.Color("#16214A");
const DUSK_HOR = new THREE.Color("#C98457"), DUSK_TOP = new THREE.Color("#1B2450");
const _c = new THREE.Color(), _t = new THREE.Color(), _h = new THREE.Color(), _w = new THREE.Vector3();

export default function TimeTravel() {
  const year = useApp((s) => s.year);
  const start = useRef<number | null>(null);
  const prevYear = useRef(year);
  const clock = useRef(0);
  useEffect(() => {
    if (prevYear.current !== year) { start.current = clock.current; prevYear.current = year; }
  }, [year]);

  const res = useMemo(() => {
    const geo = new THREE.SphereGeometry(900, 40, 20);
    const n = geo.attributes.position.count;
    geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
    const dome = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false });
    const sunTex = discTexture("rgba(255,236,196,1)", "rgba(255,190,120,0.35)");
    const moonTex = discTexture("rgba(226,234,255,1)", "rgba(170,190,255,0.25)");
    const sun = new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, fog: false });
    const moon = new THREE.SpriteMaterial({ map: moonTex, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, fog: false });
    return { geo, dome, sun, moon, sunTex, moonTex };
  }, []);
  useEffect(() => () => { res.geo.dispose(); res.dome.dispose(); res.sun.dispose(); res.moon.dispose(); res.sunTex.dispose(); res.moonTex.dispose(); }, [res]);

  const domeRef = useRef<THREE.Mesh>(null), sunRef = useRef<THREE.Sprite>(null), moonRef = useRef<THREE.Sprite>(null);
  useFrame(({ camera }, dt) => {
    clock.current += Math.min(dt, 0.25);
    const p = start.current === null ? 1 : Math.min(1, (clock.current - start.current) / DURATION);
    if (p >= 1) start.current = null;
    const ease = p < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * p) : 1;
    const phi = SUN_REST + ease * Math.PI * 2;      // one full turn: sunset, night, sunrise
    const s = Math.sin(phi);
    rt.day = Math.min(1, Math.max(0, s * 2.2 + 0.25));
    const dusk = Math.max(0, 1 - Math.abs(s) * 3.2) * (p < 1 ? 1 : 0);
    const night = 1 - rt.day;
    // sky dome: invisible by day, dusk → night → dawn tints during the sweep
    camera.getWorldPosition(_w);
    const alt = Math.min(1, Math.max(0, (1500 - _w.y) / 500));
    const op = Math.min(0.92, night * 0.9 + dusk * 0.45) * alt;
    res.dome.opacity = op;
    if (domeRef.current) domeRef.current.visible = op > 0.005;
    if (op > 0.005) {
      _t.copy(NIGHT_TOP).lerp(DUSK_TOP, dusk * 0.6);
      _h.copy(NIGHT_HOR).lerp(DUSK_HOR, dusk);
      const pos = res.geo.attributes.position, col = res.geo.attributes.color;
      for (let i = 0; i < pos.count; i++) {
        const h = pos.getY(i) / 900;
        const k = Math.min(1, Math.max(0, (h + 0.05) / 0.6));
        _c.copy(_h).lerp(_t, k * k * (3 - 2 * k));
        col.setXYZ(i, _c.r, _c.g, _c.b);
      }
      col.needsUpdate = true;
    }
    // sun and moon on the arc (shown during the time-lapse; the sun rests faintly in the sky)
    const place = (sp: THREE.Sprite | null, a: number, size: number) => {
      if (!sp) return;
      sp.position.set(ARC.cx + Math.cos(a) * ARC.r, ARC.cy + Math.sin(a) * ARC.r, ARC.z);
      sp.scale.setScalar(size);
    };
    place(sunRef.current, phi, 64);
    place(moonRef.current, phi + Math.PI, 44);
    const above = (a: number) => Math.min(1, Math.max(0, Math.sin(a) * 4 + 0.15));
    res.sun.opacity = (p < 1 ? 0.95 : 0.38) * above(phi) * alt;
    res.moon.opacity = 0.9 * above(phi + Math.PI) * alt;
  });

  return (
    <group>
      <mesh ref={domeRef} geometry={res.geo} material={res.dome} renderOrder={-10} frustumCulled={false} raycast={() => null} />
      <sprite ref={sunRef} material={res.sun} renderOrder={-9} raycast={() => null} />
      <sprite ref={moonRef} material={res.moon} renderOrder={-9} raycast={() => null} />
    </group>
  );
}
