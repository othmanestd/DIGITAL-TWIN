"use client";
// One floor of the maquette: slab, columns, glass façade, department zones with partition walls and furniture,
// people and agents. Floors above an opened floor lift up and fade away (exploded view).
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { KIND_COLOR, FLOOR_H, type Dept } from "@/lib/hospital";
import { META, fr } from "@/lib/model";
import { useApp } from "@/lib/store";
import { registerAnchor } from "@/lib/anchors";
import type { FloorLayout, Part } from "./layout";
import { GEO, PAL, makeFloorMats, rt, setFloorOpacity, type FloorMats, type FacadeStyle } from "./mats";
import { FloorFacade } from "./Facade";
import Experiences from "./Experiences";
import { FourthFloor } from "./Twin";
import People, { THREE_STATE } from "./People";
import { isHidden } from "./nav";

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

function Inst({ geo, mat, parts, shadow = true }: { geo: THREE.BufferGeometry; mat: THREE.Material; parts: Part[]; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    parts.forEach((p, i) => {
      _q.setFromEuler(_e.set(p.pitch ?? 0, p.yaw, 0, "YXZ"));
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(p.sx, p.sy, p.sz));
      m.setMatrixAt(i, _m);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [parts]);
  return <instancedMesh ref={ref} args={[geo, mat, parts.length]} castShadow={shadow} receiveShadow />;
}

const mix = (a: string, b: string, t: number) => new THREE.Color(a).lerp(new THREE.Color(b), t);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
/** desk fold factor from its person's presence: folds while the person walks away */
const deskFold = (pr: number) => { const t = Math.min(1, Math.max(0, (pr - 0.2) / 0.5)); return t * t * (3 - 2 * t); };

/** Façade elements (columns, mullions, rails) for a plate of w × d. */
function shellParts(w: number, d: number, h: number, basement: boolean): { cols: Part[]; mull: Part[] } {
  const cols: Part[] = [], mull: Part[] = [];
  const P = (x: number, y: number, z: number, sx: number, sy: number, sz: number, yaw = 0): Part => ({ g: "box", m: "white", x, y, z, yaw, sx, sy, sz, dept: "" });
  const hx = w / 2 - 0.3, hz = d / 2 - 0.3;
  const nx = Math.max(2, Math.round(w / 6.5)), nz = Math.max(2, Math.round(d / 6.5));
  for (let i = 0; i <= nx; i++) for (const z of [-hz, hz]) cols.push(P(-hx + (2 * hx * i) / nx, h / 2, z, 0.38, h, 0.38));
  for (let j = 1; j < nz; j++) for (const x of [-hx, hx]) cols.push(P(x, h / 2, -hz + (2 * hz * j) / nz, 0.38, h, 0.38));
  if (basement) return { cols, mull };
  const gx = w / 2 + 0.06, gz = d / 2 + 0.06, step = 3.3;
  for (let i = 0, n = Math.round(w / step); i <= n; i++) for (const z of [-gz, gz]) mull.push(P(-w / 2 + (w * i) / n, h / 2, z, 0.07, h, 0.12));
  for (let j = 1, n = Math.round(d / step); j < n; j++) for (const x of [-gx, gx]) mull.push(P(x, h / 2, -d / 2 + (d * j) / n, 0.12, h, 0.07));
  for (const z of [-gz, gz]) mull.push(P(0, 1.0, z, w, 0.035, 0.06));
  for (const x of [-gx, gx]) mull.push(P(x, 1.0, 0, 0.06, 0.035, d));
  return { cols, mull };
}

export default function Floor({ fl, openKey, focusDept }: { fl: FloorLayout; openKey: string | null; focusDept: string | null }) {
  const style: FacadeStyle = fl.floor < 0 ? "basement" : fl.building === "annex" ? "annex" : fl.floor === 0 ? "main-ground" : "main";
  const mats = useMemo<FloorMats>(() => makeFloorMats(style), [style]);
  const xray = useRef(0);
  const group = useRef<THREE.Group>(null);
  const hidden = isHidden(fl.key, openKey);
  const isOpen = openKey === fl.key;
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const openRef = useRef(isOpen);
  openRef.current = isOpen;
  const basement = fl.floor < 0;
  const H = FLOOR_H - 0.36;
  const baseY = fl.floor * FLOOR_H;

  // zone materials (one per department) — tinted floor
  const zones = useMemo(() => fl.depts.map((d) => ({
    d,
    mat: new THREE.MeshStandardMaterial({ color: mix("#F1F2F6", KIND_COLOR[d.kind], 0.2), roughness: 0.95 }),
  })), [fl]);
  const allMats = useMemo(() => [...mats.all, ...zones.map((z) => z.mat)], [mats, zones]);
  for (const z of zones) { z.mat.userData.baseOpacity = 1; z.mat.userData.baseTransparent = false; z.mat.userData.baseDepthWrite = true; }
  useEffect(() => () => { allMats.forEach((m) => m.dispose()); }, [allMats]);

  const deskShrinks = useMemo(() => new Set(fl.people.filter((p) => p.desk >= 0 && p.shrink >= 0).map((p) => p.desk)), [fl]);
  const groups = useMemo(() => {
    const map = new Map<string, Part[]>();
    for (const p of fl.parts) {
      if (p.paper || (p.desk && deskShrinks.has(p.desk))) continue;
      const k = p.g + "|" + p.m;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return [...map.entries()];
  }, [fl, deskShrinks]);
  // desks of posts that are not replaced along the timeline: drawn dynamically so they can fold away
  const deskGroups = useMemo(() => {
    const map = new Map<string, Part[]>();
    for (const p of fl.parts) {
      if (p.paper || !p.desk || !deskShrinks.has(p.desk)) continue;
      const k = p.g + "|" + p.m;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return [...map.entries()];
  }, [fl, deskShrinks]);
  const deskCenter = useMemo(() => {
    const acc = new Map<number, [number, number, number]>();
    for (const p of fl.parts) if (p.desk) { const a = acc.get(p.desk) ?? [0, 0, 0]; a[0] += p.x; a[1] += p.z; a[2]++; acc.set(p.desk, a); }
    return new Map([...acc.entries()].map(([k, [x, z, n]]) => [k, [x / n, z / n] as [number, number]]));
  }, [fl]);
  const papers = useMemo(() => fl.parts.filter((p) => p.paper), [fl]);
  const shell = useMemo(() => shellParts(fl.w, fl.d, H, basement), [fl, H, basement]);
  const paperRef = useRef<THREE.InstancedMesh>(null);
  const deskRefs = useRef<(THREE.InstancedMesh | null)[]>([]);
  const lastDeskVer = useRef(-1);
  const lastEco = useRef(-1);
  const hoverZone = useRef<string | null>(null);
  const content = useRef<THREE.Group>(null);
  useEffect(() => {
    content.current?.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.castShadow = isOpen; });
  }, [isOpen]);
  const hoverGlass = useRef(false);

  const casesOf = useMemo(() => Object.fromEntries(fl.depts.map((d) => [d.id, d.cases.length > 0])), [fl]);
  const tmpC = useMemo(() => new THREE.Color(), []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 4.2);
    const cur = rt.lift[fl.key] ?? (hidden ? 1 : 0);
    const nxt = cur + ((hiddenRef.current ? 1 : 0) - cur) * k;
    rt.lift[fl.key] = Math.abs(nxt - (hiddenRef.current ? 1 : 0)) < 0.002 ? (hiddenRef.current ? 1 : 0) : nxt;
    const h = rt.lift[fl.key];
    const e = h * h * (3 - 2 * h);
    g.position.y = baseY + e * 11;
    g.visible = h < 0.985;
    if (!g.visible) return;
    // X-ray: the realistic façade (tinted glass, louvres) fades when this floor is open or the camera comes close
    g.getWorldPosition(_v);
    const dist = camera.position.distanceTo(_v);
    const xt = openRef.current ? 1 : Math.min(1, Math.max(0, (75 - dist) / 35));
    xray.current += (xt - xray.current) * k;
    const xr = xray.current;
    const hov = hoverGlass.current || rt.hoverFloor === fl.key;
    const gb = THREE.MathUtils.lerp(mats.glassBase * (hov ? 0.62 : 1), 0.035, xr);
    mats.glass.userData.baseOpacity += (gb - mats.glass.userData.baseOpacity) * k;
    mats.louvre.userData.baseOpacity = 1 - xr;
    mats.glass.emissiveIntensity = (1 - rt.day) * 0.55;
    setFloorOpacity(allMats, 1 - e);
    // zone tints
    for (const z of zones) {
      const base = KIND_COLOR[z.d.kind];
      let t = 0.2;
      if (focusDept && openRef.current) t = z.d.id === focusDept ? 0.36 : 0.06;
      if (hoverZone.current === z.d.id) t += 0.1;
      tmpC.set("#F1F2F6").lerp(new THREE.Color(base), t);
      if (focusDept && openRef.current && z.d.id !== focusDept) tmpC.lerp(new THREE.Color("#E3E6EC"), 0.35);
      z.mat.color.lerp(tmpC, k);
    }
    // paper stacks shrink as agents take over the paperwork
    if (paperRef.current && (Math.abs(rt.eco - lastEco.current) > 0.001 || lastDeskVer.current !== rt.deskVer)) {
      lastEco.current = rt.eco;
      const m = paperRef.current;
      papers.forEach((p, i) => {
        const fold = p.desk ? deskFold(rt.desk.get(p.desk) ?? 1) : 1;
        const f = (casesOf[p.dept] ? 1 - 0.9 * rt.eco : 1) * fold;
        const hh = Math.max(0.012, p.sy * f);
        _q.setFromEuler(_e.set(0, p.yaw, 0));
        _m.compose(_v.set(p.x, p.y * fold + hh / 2, p.z), _q, _s.set(p.sx * (fold > 0.02 ? 1 : 0), hh, p.sz));
        m.setMatrixAt(i, _m);
      });
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
    }
    // desks folding away / unfolding with their person (timeline staffing)
    if (lastDeskVer.current !== rt.deskVer) {
      lastDeskVer.current = rt.deskVer;
      deskGroups.forEach(([, parts], gi) => {
        const m = deskRefs.current[gi];
        if (!m) return;
        parts.forEach((p, i) => {
          const f = deskFold(rt.desk.get(p.desk!) ?? 1);
          if (f < 0.01) { m.setMatrixAt(i, ZERO); return; }
          const [cx, cz] = deskCenter.get(p.desk!) ?? [p.x, p.z];
          const k = 0.45 + 0.55 * f;
          _q.setFromEuler(_e.set(p.pitch ?? 0, p.yaw, 0, "YXZ"));
          _m.compose(_v.set(cx + (p.x - cx) * k, p.y * f, cz + (p.z - cz) * k), _q, _s.set(p.sx * k, p.sy * f, p.sz * k));
          m.setMatrixAt(i, _m);
        });
        m.instanceMatrix.needsUpdate = true;
      });
    }
    // screens glow a touch bluer when agents are at work
    mats.parts.screen.emissiveIntensity = 0.3 + 0.35 * rt.eco;
  });

  // anchors: floor + departments
  useEffect(() => {
    const v = new THREE.Vector3();
    const proj = (lx: number, ly: number, lz: number) => {
      if (!THREE_STATE.get || !group.current) return null;
      const { camera, gl } = THREE_STATE.get();
      v.set(lx, ly, lz);
      group.current.localToWorld(v);
      v.project(camera);
      const r = gl.domElement.getBoundingClientRect();
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, visible: !hiddenRef.current && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
    };
    const offs = [
      registerAnchor("floor:" + fl.key, () => proj(0, 1.2, 0)),
      ...fl.depts.map((d) => registerAnchor("dept:" + d.id, () => proj(d.rect[0], 1.0, d.rect[1]))),
    ];
    return () => offs.forEach((o) => o());
  }, [fl]);

  const select = useApp((s) => s.select);
  const setHover = useApp((s) => s.setHover);
  const active = useMemo(() => () => !hiddenRef.current && !!group.current?.visible, []);

  const clickFloor = (e: ThreeEvent<MouseEvent>) => {
    if (!active() || e.delta > 6) return;
    e.stopPropagation();
    rt.clickHandled = true;
    select({ kind: "floor", id: fl.key });
  };
  const glassOver = (e: ThreeEvent<PointerEvent>) => {
    if (!active() || openRef.current) return;
    e.stopPropagation();
    if (!hoverGlass.current) { hoverGlass.current = true; rt.hoverFloor = fl.key; document.body.style.cursor = "pointer"; }
  };
  const glassOut = () => {
    if (!hoverGlass.current) return;
    hoverGlass.current = false;
    if (rt.hoverFloor === fl.key) rt.hoverFloor = null;
    document.body.style.cursor = "";
  };
  const glassClick = (e: ThreeEvent<MouseEvent>) => {
    if (openRef.current) return; // let the click reach the open floor's zones
    clickFloor(e);
  };
  const zoneMove = (d: Dept) => (e: ThreeEvent<PointerEvent>) => {
    if (!active()) return;
    e.stopPropagation();
    if (hoverZone.current !== d.id) {
      hoverZone.current = d.id;
      setHover("dept:" + d.id);
      document.body.style.cursor = "pointer";
    }
  };
  const zoneOut = (d: Dept) => () => {
    if (hoverZone.current !== d.id) return;
    hoverZone.current = null;
    if (useApp.getState().hover === "dept:" + d.id) setHover(null);
    document.body.style.cursor = "";
  };
  const zoneClick = (d: Dept) => (e: ThreeEvent<MouseEvent>) => {
    if (!active() || e.delta > 6) return;
    e.stopPropagation();
    rt.clickHandled = true;
    select({ kind: "dept", id: d.id });
  };

  const camera = useThree((s) => s.camera);
  const slabT = basement ? 0.8 : 0.36;
  const slabMats = useMemo(() => [mats.slabEdge, mats.slabEdge, mats.slabTop, mats.slabTop, mats.slabEdge, mats.slabEdge], [mats]);
  const glassMats = useMemo(() => [mats.glass, mats.glass, mats.hit, mats.hit, mats.glass, mats.glass], [mats]);

  return (
    <group ref={group} position={[fl.ox, baseY, fl.oz]}>
      {/* slab */}
      <mesh position={[0, -slabT / 2, 0]} material={slabMats} castShadow receiveShadow onClick={clickFloor}>
        <boxGeometry args={[fl.w + 0.5, slabT, fl.d + 0.5]} />
      </mesh>
      <Inst geo={GEO.box} mat={mats.parts.white} parts={shell.cols} />
      {!basement && (
        <>
          {style === "main-ground" && <Inst geo={GEO.box} mat={mats.mullion} parts={shell.mull} />}
          <FloorFacade kind={fl.building} floor={fl.floor} w={fl.w} d={fl.d} H={H} mats={mats} />
          <mesh position={[0, H / 2, 0]} material={glassMats} onPointerMove={glassOver} onPointerOut={glassOut} onClick={glassClick} renderOrder={1}>
            <boxGeometry args={[fl.w + 0.12, H, fl.d + 0.12]} />
          </mesh>
        </>
      )}
      {/* department zones */}
      {zones.map(({ d, mat }) => (
        <mesh key={d.id} position={[d.rect[0], 0.012, d.rect[1]]} rotation-x={-Math.PI / 2} material={mat} receiveShadow
          onPointerMove={zoneMove(d)} onPointerOut={zoneOut(d)} onClick={zoneClick(d)}>
          <planeGeometry args={[d.rect[2], d.rect[3]]} />
        </mesh>
      ))}
      {/* furniture + walls (+ people): they only cast shadows when the floor is open — closed floors are shaded by the slab above */}
      <group ref={content}>
      {groups.map(([k, parts]) => {
        const [g, m] = k.split("|") as [Part["g"], Part["m"]];
        return <Inst key={k} geo={GEO[g]} mat={mats.parts[m]} parts={parts} shadow={m !== "lamp"} />;
      })}
      {deskGroups.map(([k, parts], gi) => {
        const [g, m] = k.split("|") as [Part["g"], Part["m"]];
        return (
          <instancedMesh key={"desk-" + k} ref={(r) => { deskRefs.current[gi] = r; if (r) { r.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 40); lastDeskVer.current = -1; } }}
            args={[GEO[g], mats.parts[m], parts.length]} castShadow receiveShadow />
        );
      })}
      {papers.length > 0 && <instancedMesh ref={paperRef} args={[GEO.box, mats.parts.white, papers.length]} castShadow receiveShadow />}
      {fl.key === "annex:3" && <CommandCenterScreen mats={mats} />}
      {fl.key === "main:0" && <Experiences mats={mats} />}
      {fl.key === "main:4" && <FourthFloor mats={mats} />}
      <People fl={fl} mats={mats} group={group} active={active} />
      </group>
      <SelectedOutline fl={fl} focusDept={isOpen ? focusDept : null} />
    </group>
  );
}

/** Soft blue outline drawn on top of the selected department's partition walls. */
function SelectedOutline({ fl, focusDept }: { fl: FloorLayout; focusDept: string | null }) {
  const d = fl.depts.find((x) => x.id === focusDept);
  const ref = useRef<THREE.Group>(null);
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: PAL.select, transparent: true, opacity: 0.85, toneMapped: false }), []);
  useFrame((st) => { mat.opacity = 0.6 + 0.2 * Math.sin(st.clock.elapsedTime * 1.6); });
  if (!d) return null;
  const [x, z, w, dd] = d.rect;
  const t = 0.07, y = 1.04;
  return (
    <group ref={ref} position={[x, y, z]}>
      <mesh position={[0, 0, -dd / 2]} material={mat}><boxGeometry args={[w + t, 0.035, t]} /></mesh>
      <mesh position={[0, 0, dd / 2]} material={mat}><boxGeometry args={[w + t, 0.035, t]} /></mesh>
      <mesh position={[-w / 2, 0, 0]} material={mat}><boxGeometry args={[t, 0.035, dd + t]} /></mesh>
      <mesh position={[w / 2, 0, 0]} material={mat}><boxGeometry args={[t, 0.035, dd + t]} /></mesh>
    </group>
  );
}

/** The Agentic Command Center wall screen: a calm dashboard drawn once on a canvas. */
function CommandCenterScreen({ mats }: { mats: FloorMats }) {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 420;
    const g = c.getContext("2d")!;
    g.fillStyle = "#121A33"; g.fillRect(0, 0, 1024, 420);
    g.fillStyle = "rgba(255,255,255,0.06)";
    for (let i = 0; i < 3; i++) g.fillRect(24 + i * 332, 24, 312, 372);
    // tiles
    g.fillStyle = "#4CC79A"; g.font = "600 46px system-ui, sans-serif"; g.fillText(fr(META.eco, 0), 48, 104);
    g.fillStyle = "#8D97B0"; g.font = "500 18px system-ui, sans-serif"; g.fillText("MDH économisés / an (plein régime)", 48, 134);
    g.fillStyle = "#9CB0FF"; g.font = "600 46px system-ui, sans-serif"; g.fillText(fr(META.budget, 0), 380, 104);
    g.fillStyle = "#8D97B0"; g.font = "500 18px system-ui, sans-serif"; g.fillText("MDH d'agents / an", 380, 134);
    g.fillStyle = "#EDF0F7"; g.font = "600 46px system-ui, sans-serif"; g.fillText(fr(META.net, 0), 712, 104);
    g.fillStyle = "#8D97B0"; g.font = "500 18px system-ui, sans-serif"; g.fillText("MDH net / an", 712, 134);
    // bars + line
    const bars = [0.18, 0.3, 0.42, 0.55, 0.66, 0.78, 0.86, 0.94];
    bars.forEach((b, i) => { g.fillStyle = "rgba(91,124,255,0.65)"; g.fillRect(48 + i * 32, 370 - b * 190, 20, b * 190); });
    g.strokeStyle = "#4CC79A"; g.lineWidth = 4; g.beginPath();
    for (let i = 0; i <= 10; i++) { const x = 380 + i * 27, y = 360 - Math.pow(i / 10, 1.4) * 180; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke();
    for (let i = 0; i < 6; i++) {
      g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(712, 200 + i * 30, 260, 12);
      g.fillStyle = i < 4 ? "#4CC79A" : "#E2B05A"; g.fillRect(712, 200 + i * 30, 260 * (0.45 + i * 0.09), 12);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#FFFFFF", emissiveMap: tex, emissiveIntensity: 0.9, roughness: 0.4 }), [tex]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  return (
    <group position={[0, 0, -8.05]}>
      <mesh position={[0, 2.15, 0]} material={mats.parts.dark} castShadow><boxGeometry args={[7.0, 2.85, 0.1]} /></mesh>
      <mesh position={[0, 2.15, 0.06]} material={mat}><planeGeometry args={[6.8, 2.65]} /></mesh>
    </group>
  );
}
