"use client";
// The walking personnage, on the shared human kit (components/scenes/people/human.ts): a slim man in a navy suit, white
// shirt, grey and gold patterned tie, gold-beige pocket square, short dark curly hair with volume, short full beard and
// moustache, blue rectangular glasses, silver watch on the left wrist, dark shoes. Procedural walk / run / idle / jump:
// stride from the distance travelled, opposite arm swing, the feet kept on the ground, a forward lean when running,
// breathing at rest, the head turning toward where the camera looks. World frame; the walk controller calls `pose()`
// right after the physics step.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BONE, chestFront, newPose, poseWalk, type HumanLook } from "../people/human";
import { useHumanCrowd } from "../people/useHumans";
import { W } from "./state";

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

/** The founder's look, in kit terms. */
const LOOK: HumanLook = {
  fem: false, skin: 0xb07c57, top: 0x26365f, bottom: 0x26365f, hair: 0x16110e, shoe: 0x141518,
  accent: 0xf5f6f8, sleeve: 0x26365f, accent2: 0x8d8a86, styles: ["curly", "beard", "open", "collar", "buttons"], girth: 0.95, height: 1.0,
};

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, rx: number, ry: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 4;
  return t;
}
/** grey tie with small gold diamonds */
const tieTex = () => canvasTex(32, 32, (g) => {
  g.fillStyle = "#8D8A86"; g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#B99A5C";
  for (const [cx, cy] of [[8, 8], [24, 24]]) { g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 5, cy); g.fill(); }
  g.fillStyle = "#6F6C69"; g.fillRect(0, 15, 32, 2);
}, 1, 5);
function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(10,14,30,0.42)"); gr.addColorStop(0.55, "rgba(10,14,30,0.18)"); gr.addColorStop(1, "rgba(10,14,30,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** The accessories the kit does not draw, in their bone's frame: glasses (head), watch (left forearm), tie and pocket square (chest). */
function buildGeo() {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    q.setFromEuler(e.set(rx, ry, rz)); m.compose(v.set(x, y, z), q, s.set(1, 1, 1)); return g.applyMatrix4(m);
  };
  // glasses: blue rectangular frames, bridge and temples; clear lenses (head frame: eyes at y 0.088, face at z ≈ 0.095)
  const fr: THREE.BufferGeometry[] = [], lens: THREE.BufferGeometry[] = [];
  const cy = 0.09, cz = 0.108;
  for (const sx of [-1, 1]) {
    const cx = sx * 0.034;
    fr.push(place(new THREE.BoxGeometry(0.046, 0.006, 0.005), cx, cy + 0.016, cz));
    fr.push(place(new THREE.BoxGeometry(0.046, 0.0042, 0.005), cx, cy - 0.015, cz));
    fr.push(place(new THREE.BoxGeometry(0.0045, 0.034, 0.005), cx + 0.0225, cy, cz));
    fr.push(place(new THREE.BoxGeometry(0.0045, 0.034, 0.005), cx - 0.0225, cy, cz));
    lens.push(place(new THREE.PlaneGeometry(0.042, 0.029), cx, cy, cz + 0.001));
    const ax = sx * 0.058, az = cz - 0.004, bx = sx * 0.09, bz = -0.002;
    fr.push(place(new THREE.BoxGeometry(0.004, 0.004, Math.hypot(bx - ax, bz - az)), (ax + bx) / 2, cy + 0.01, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0));
  }
  fr.push(place(new THREE.BoxGeometry(0.02, 0.004, 0.005), 0, cy + 0.006, cz + 0.002));
  const frames = mergeGeometries(fr, false)!, lenses = mergeGeometries(lens, false)!;
  fr.forEach((g) => g.dispose()); lens.forEach((g) => g.dispose());
  // tie (textured, over the kit's shirt V) and its knot; pocket square
  const ty = 0.3, tz = chestFront(0, ty) + 0.008;
  const tie = place(new THREE.BoxGeometry(0.038, 0.2, 0.006), 0, ty - 0.01, tz, -0.22);
  const knot = place(new THREE.BoxGeometry(0.03, 0.026, 0.016), 0, 0.408, chestFront(0, 0.408) + 0.012, -0.3);
  const square = place(new THREE.BoxGeometry(0.056, 0.026, 0.01), 0.095, 0.3, chestFront(0.095, 0.3) + 0.01, -0.25, 0, 0.2);
  return {
    frames, lenses, tie, knot, square,
    band: new THREE.CylinderGeometry(0.036, 0.036, 0.02, 16).translate(0, -0.232, 0),
    dial: new THREE.CylinderGeometry(0.017, 0.017, 0.008, 16).rotateZ(Math.PI / 2).translate(0.036, -0.232, 0),
  };
}

export type VisitorApi = { pose: (dt: number, t: number, lookYaw: number) => void; root: THREE.Group | null };

export default function Visitor({ api }: { api: React.MutableRefObject<VisitorApi | null> }) {
  const root = useRef<THREE.Group>(null);
  const crowd = useHumanCrowd(1);
  const geo = useMemo(buildGeo, []);
  const mats = useMemo(() => {
    const st = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
    return {
      tie: st("#FFFFFF", { map: tieTex(), roughness: 0.5 }),
      gold: st("#CDAE72", { roughness: 0.55 }),
      frame: st("#2D5BA6", { roughness: 0.35, metalness: 0.3 }),
      lens: new THREE.MeshStandardMaterial({ color: "#C9DDF5", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      silver: st("#CDD1D7", { roughness: 0.22, metalness: 0.85 }),
      dial: st("#E9ECF1", { roughness: 0.3, metalness: 0.2 }),
      blob: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    };
  }, []);
  // accessory meshes, placed every frame from the bones (matrices written directly)
  const acc = useMemo(() => {
    const mk = (g: THREE.BufferGeometry, m: THREE.Material, bone: number, order = 0) => {
      const o = new THREE.Mesh(g, m); o.matrixAutoUpdate = false; o.castShadow = m !== mats.lens; o.renderOrder = order; o.raycast = () => {}; return { o, bone };
    };
    return [
      mk(geo.frames, mats.frame, BONE.head), mk(geo.lenses, mats.lens, BONE.head, 2),
      mk(geo.tie, mats.tie, BONE.chest), mk(geo.knot, mats.tie, BONE.chest), mk(geo.square, mats.gold, BONE.chest),
      mk(geo.band, mats.silver, BONE.farmL), mk(geo.dial, mats.dial, BONE.farmL),
    ];
  }, [geo, mats]);
  useEffect(() => { crowd.setLook(0, LOOK); }, [crowd]);
  useEffect(() => () => {
    Object.values(mats).forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); });
    Object.values(geo).forEach((g) => g.dispose());
  }, [mats, geo]);

  const s = useRef({ phase: 0, y: 0, lean: 0, head: 0, air: 0, amp: 0, run: 0, first: true, P: newPose() });
  useEffect(() => {
    api.current = {
      root: root.current,
      pose: (dt, t, lookYaw) => {
        const g = root.current;
        if (!g) return;
        const st = s.current, P = st.P;
        const sp = W.speed;
        // visual height follows the feet with a short damp (hides the small steps at the ends of the flights)
        if (st.first) { st.y = W.y; st.first = false; }
        st.y += (W.y - st.y) * (W.grounded ? 1 - Math.exp(-dt * 22) : 1);
        g.position.set(W.x + W.ox, st.y, W.z + W.oz);
        g.rotation.y = W.heading;
        const k = 1 - Math.exp(-dt * 10);
        st.run += (smooth((sp - 2.2) / 1.8) - st.run) * k;
        st.amp += (Math.min(1, sp / 1.1) - st.amp) * k;
        st.air += ((W.grounded ? 0 : 1) - st.air) * (1 - Math.exp(-dt * 14));
        const stride = THREE.MathUtils.lerp(1.6, 2.3, st.run);
        st.phase += (sp * dt * Math.PI * 2) / stride;
        const a = st.amp * (1 - st.air);
        poseWalk(P, st.phase, a * THREE.MathUtils.lerp(1, 1.75, st.run));
        P.aeL += 0.85 * st.run * a; P.aeR += 0.85 * st.run * a;
        // a jump: knees up, arms a little forward; the root follows the body in the air
        P.ground = 1 - st.air;
        P.lfL += 0.45 * st.air; P.lkL += 0.7 * st.air; P.lfR += 0.15 * st.air; P.lkR += 0.35 * st.air;
        P.afL += 0.35 * st.air; P.afR += 0.35 * st.air;
        st.lean += (0.14 * st.run * a + 0.035 * a - st.lean) * k;
        P.sp += st.lean + 0.012 * Math.sin(t * 1.6) * (1 - a);
        // the head turns toward where the camera looks, within a comfortable range (straight ahead when looked at from the front)
        const rel = wrap(lookYaw - W.heading);
        const want = Math.abs(rel) > 1.9 ? 0 : THREE.MathUtils.clamp(rel, -0.7, 0.7) * (1 - 0.6 * st.run);
        st.head += (want - st.head) * (1 - Math.exp(-dt * 5));
        P.hy = st.head + 0.05 * Math.sin(t * 0.4) * (1 - a); P.hp = 0.03 * Math.sin(t * 0.7) * (1 - a) + 0.02;
        crowd.write(0, 0, 0, 0, 0, 0.97, P);
        for (const { o, bone } of acc) crowd.attach(o.matrix, bone);
      },
    };
    return () => { api.current = null; };
  }, [api, crowd, acc]);

  return (
    <group ref={root} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} material={mats.blob} renderOrder={1}>
        <planeGeometry args={[0.95, 0.95]} />
      </mesh>
      <primitive object={crowd.mesh} />
      {acc.map(({ o }, i) => <primitive key={i} object={o} />)}
    </group>
  );
}
