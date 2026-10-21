"use client";
// Glazed stair towers adjoining the +x façade of both buildings (walk/plan.ts): a switchback stair per storey with
// open-riser warm treads on slim white stringers, glass balustrades and handrails along the well, white landings, a clear
// glass curtain with white mullions and a white band at every floor level (the buildings' ribbon language), a white roof.
// The tower is cut by a horizontal clipping plane: in walk mode above the visitor (third person), in the exploded view at
// the open floor. Campus frame (rendered inside HospitalContent's campus group).
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FLOOR_H } from "@/lib/hospital";
import { ST, TOWERS, towerTopY, towerZ, type Tower } from "../walk/plan";
import { W } from "../walk/state";

type Kind = "white" | "tread" | "glass" | "bal" | "rail" | "sign";
const R = ST.half / ST.risers;              // riser height
const TREAD = ST.run / (ST.risers - 1);     // tread depth (12 treads per flight)
const SLOPE = Math.atan2(R * (ST.risers - 1), ST.run);

function buildTower(t: Tower) {
  const parts: Record<Exclude<Kind, "sign">, THREE.BufferGeometry[]> = { white: [], tread: [], glass: [], bal: [], rail: [] };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  /** box in tower-local coordinates (x' outward, z' along the flights), y campus; pitch > 0 rises toward +z' */
  const box = (k: Exclude<Kind, "sign">, xa: number, xb: number, za: number, zb: number, y0: number, y1: number, pitch = 0) => {
    const g = new THREE.BoxGeometry(Math.abs(xb - xa), Math.abs(y1 - y0), Math.abs(zb - za));
    const zc = towerZ(t, (za + zb) / 2);
    e.set(-pitch * t.dir, 0, 0);
    q.setFromEuler(e);
    m.compose(v.set(t.xF + (xa + xb) / 2, (y0 + y1) / 2, zc), q, one);
    g.applyMatrix4(m);
    parts[k].push(g);
  };
  /** a sloped member along a flight: from z' = za (height ha) to z' = zb (height hb), x' ∈ [xa, xb], thickness th, top offset `up` */
  const sloped = (k: Exclude<Kind, "sign">, xa: number, xb: number, za: number, ha: number, zb: number, hb: number, th: number, up: number) => {
    const L = Math.hypot(zb - za, hb - ha);
    const rise = Math.atan2(hb - ha, zb - za); // angle around x' (+ = rising toward +z')
    const g = new THREE.BoxGeometry(xb - xa, th, L);
    e.set(-rise * t.dir, 0, 0);
    q.setFromEuler(e);
    const zc = (za + zb) / 2, hc = (ha + hb) / 2 + up;
    m.compose(v.set(t.xF + (xa + xb) / 2, hc, towerZ(t, zc)), q, one);
    g.applyMatrix4(m);
    parts[k].push(g);
  };

  const top = t.top, roof = towerTopY(t);
  // base slab (covers the gap between the slab edge and the plinth)
  box("white", -0.02, ST.glass + 0.06, ST.endA - 0.06, ST.endB + 0.06, -0.32, 0.0);
  box("tread", ST.x0, ST.x1, ST.endA + 0.02, ST.endB - 0.02, 0.0, 0.012);
  // closed space under the first flights (white volume)
  box("white", ST.x0, ST.laneB1, ST.land, ST.mid0, 0, 1.95);
  box("white", ST.x0, ST.x1, ST.mid0, ST.mid1, 0, 1.95);
  for (let f = 0; f <= top; f++) {
    const y = f * FLOOR_H;
    if (f > 0) {
      // floor landing + white band around the tower at the floor level
      box("white", ST.x0, ST.x1, ST.endA + 0.03, ST.land, y - 0.3, y - 0.012);
      box("tread", ST.x0, ST.x1, ST.endA + 0.03, ST.land, y - 0.012, y);
      box("white", ST.glass - 0.02, ST.glass + 0.07, ST.endA - 0.05, ST.endB + 0.05, y - 0.42, y + 0.02);
      box("white", 0.02, ST.glass + 0.07, ST.endA - 0.07, ST.endA + 0.02, y - 0.42, y + 0.02);
      box("white", 0.02, ST.glass + 0.07, ST.endB - 0.02, ST.endB + 0.07, y - 0.42, y + 0.02);
    }
    if (f === top) {
      // guard over the void of the last flight
      box("bal", ST.laneA0, ST.x1, ST.land + 0.03, ST.land + 0.05, y, y + 1.0);
      box("rail", ST.laneA0, ST.x1, ST.land + 0.01, ST.land + 0.07, y + 1.0, y + 1.05);
      continue;
    }
    // mid landing
    const ym = y + ST.half;
    box("white", ST.x0, ST.x1, ST.mid0, ST.mid1 + 0.03, ym - 0.26, ym - 0.012);
    box("tread", ST.x0, ST.x1, ST.mid0, ST.mid1 + 0.03, ym - 0.012, ym);
    // flights: lane A rises toward +z' from the floor landing, lane B rises back toward the door
    for (const lane of ["A", "B"] as const) {
      const [xa, xb] = lane === "A" ? [ST.laneA0, ST.x1] : [ST.x0, ST.laneB1];
      const base = lane === "A" ? y : ym;
      for (let k = 0; k < ST.risers - 1; k++) {
        const h = base + (k + 1) * R;
        // lane A: tread k at z' ∈ [land + k·g, land + (k+1)·g]; lane B: mirrored toward the door
        const z0 = lane === "A" ? ST.land + k * TREAD : ST.mid0 - (k + 1) * TREAD;
        box("tread", xa + 0.03, xb - 0.03, lane === "A" ? z0 - 0.02 : z0, lane === "A" ? z0 + TREAD : z0 + TREAD + 0.02, h - 0.055, h);
      }
      // stringers (both sides) under the line through the back corners of the treads
      const top12 = R * (ST.risers - 1);
      const [za, ha, zb, hb] = lane === "A" ? [ST.land, base, ST.mid0, base + top12] : [ST.mid0, base, ST.land, base + top12];
      const sv = 0.13 / Math.cos(SLOPE);
      sloped("white", xa, xa + 0.09, za, ha, zb, hb, 0.26, -0.055 - sv);
      sloped("white", xb - 0.09, xb, za, ha, zb, hb, 0.26, -0.055 - sv);
      // glass balustrade + handrail on the well side, wall rail on the other side
      const well = lane === "A" ? xa : xb;
      sloped("bal", well - 0.012, well + 0.012, za, ha, zb, hb, 1.0, 0.55);
      sloped("rail", well - 0.03, well + 0.03, za, ha, zb, hb, 0.05, 1.05);
      const wall = lane === "A" ? xb - 0.06 : xa + 0.06;
      sloped("rail", wall - 0.025, wall + 0.025, za, ha, zb, hb, 0.045, 0.92);
    }
  }
  // glass curtain (outer face and both ends) + white mullions + roof
  box("glass", ST.glass - 0.01, ST.glass + 0.01, ST.endA, ST.endB, 0, roof);
  box("glass", 0.02, ST.glass, ST.endA - 0.01, ST.endA + 0.01, 0, roof);
  box("glass", 0.02, ST.glass, ST.endB - 0.01, ST.endB + 0.01, 0, roof);
  const zs = [ST.endA, ...[1, 2, 3, 4].map((i) => ST.endA + ((ST.endB - ST.endA) * i) / 4)];
  for (const z of zs) box("white", ST.glass - 0.04, ST.glass + 0.06, z - 0.05, z + 0.05, 0, roof);
  for (const x of [0.06, ST.glass / 2]) for (const z of [ST.endA, ST.endB]) box("white", x - 0.05, x + 0.05, z - 0.05, z + 0.05, 0, roof);
  box("white", -0.04, ST.glass + 0.14, ST.endA - 0.14, ST.endB + 0.14, roof - 0.38, roof);
  box("white", ST.glass - 0.02, ST.glass + 0.07, ST.endA - 0.05, ST.endB + 0.05, roof - 0.9, roof - 0.38);

  const out = {} as Record<Exclude<Kind, "sign">, THREE.BufferGeometry>;
  for (const k of Object.keys(parts) as Exclude<Kind, "sign">[]) {
    out[k] = mergeGeometries(parts[k], false)!;
    parts[k].forEach((g) => g.dispose());
  }
  return out;
}

/** Floor label plates on each landing, beside the door ("RDC", "1er étage"…). */
function signTexture(text: string) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#F6F7FA"; g.fillRect(0, 0, 512, 160);
  g.fillStyle = "#22305E";
  g.font = "600 74px 'Segoe UI', system-ui, sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 256, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const floorLabel = (f: number) => (f === 0 ? "RDC" : f === 1 ? "1er étage" : `${f}e étage`);

export function StairTowers({ openKey }: { openKey: string | null }) {
  const gl = useThree((s) => s.gl);
  const res = useMemo(() => {
    const planes = { main: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6), annex: new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6) };
    const mats = (plane: THREE.Plane) => {
      const c = { clippingPlanes: [plane], clipShadows: true };
      return {
        white: new THREE.MeshStandardMaterial({ color: "#F3F4F7", roughness: 0.6, ...c }),
        tread: new THREE.MeshStandardMaterial({ color: "#E4DBCD", roughness: 0.72, ...c }),
        glass: new THREE.MeshStandardMaterial({ color: "#D8E4FF", roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.4, ...c }),
        bal: new THREE.MeshStandardMaterial({ color: "#CFE0EC", roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, ...c }),
        rail: new THREE.MeshStandardMaterial({ color: "#B9C0CC", roughness: 0.35, metalness: 0.45, ...c }),
      };
    };
    const towers = TOWERS.map((t) => {
      const geo = buildTower(t);
      const m = mats(planes[t.building]);
      const signs = t.floors.map((f) => {
        const tex = signTexture(floorLabel(f));
        return { f, tex, mat: new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, clippingPlanes: [planes[t.building]] }) };
      });
      return { t, geo, m, signs };
    });
    return { planes, towers };
  }, []);
  useEffect(() => {
    gl.localClippingEnabled = true;
    return () => {
      for (const { geo, m, signs } of res.towers) {
        Object.values(geo).forEach((g) => g.dispose()); Object.values(m).forEach((x) => x.dispose());
        signs.forEach((s) => { s.tex.dispose(); s.mat.dispose(); });
      }
    };
  }, [gl, res]);

  // clip height: walk mode cut-away, or the exploded view (open floor), eased
  const clip = useRef({ main: 1e6, annex: 1e6 });
  const open = useMemo(() => (openKey ? { b: openKey.split(":")[0], f: Number(openKey.split(":")[1]) } : null), [openKey]);
  const openRef = useRef(open);
  openRef.current = open;
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.25) * 6);
    for (let i = 0; i < 2; i++) {
      const b = i ? "annex" : "main";
      let want = 1e6;
      if (W.phase === "on") { if ((W.cutB === b || (W.bridge && W.cutB)) && W.clipY < 1e5) want = W.clipY; }
      else if (openRef.current && openRef.current.b === b) want = (openRef.current.f + 1) * FLOOR_H - 0.5;
      const cur = clip.current[b];
      // snap when far (no slow sweep through the whole tower), ease when close
      clip.current[b] = Math.abs(want - cur) > 40 ? want : cur + (want - cur) * (W.phase === "on" ? 1 : k);
      res.planes[b].constant = clip.current[b];
    }
  });

  return (
    <group>
      {res.towers.map(({ t, geo, m, signs }) => (
        <group key={t.id}>
          <mesh geometry={geo.white} material={m.white} castShadow receiveShadow />
          <mesh geometry={geo.tread} material={m.tread} castShadow receiveShadow />
          <mesh geometry={geo.rail} material={m.rail} castShadow />
          <mesh geometry={geo.bal} material={m.bal} renderOrder={2} />
          <mesh geometry={geo.glass} material={m.glass} renderOrder={3} />
          {signs.map((s) => (
            // above the door of each landing, on the transom, facing into the tower
            <mesh key={s.f} material={s.mat} position={[t.xF + 0.035, s.f * FLOOR_H + 2.68, towerZ(t, 0)]} rotation-y={Math.PI / 2}>
              <planeGeometry args={[0.62, 0.19]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export { SLOPE };
