"use client";
// The walking personnage: a slim man in a navy suit, low-poly like the hospital's figures but recognisable — short dark
// curly hair with volume, short full beard and moustache, blue rectangular glasses, white shirt, grey and gold patterned
// tie, gold-beige pocket square, silver watch on the left wrist, dark shoes. Procedural walk / run / idle / jump: stride
// from the distance travelled, opposite arm swing, bob, a forward lean when running, breathing at rest, the head turning
// toward where the camera looks. World frame; the walk controller calls `pose()` right after the physics step.
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { FIGURE } from "../hospital/People";
import { CAMPUS_OFFSET } from "../hospital/nav";
import { W } from "./state";

const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const wrap = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

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
/** navy suit cloth with a fine bird's-eye weave */
const suitTex = () => canvasTex(64, 64, (g) => {
  g.fillStyle = "#26365F"; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4) for (let x = 0; x < 64; x += 4) {
    g.fillStyle = (x + y) % 8 ? "#2E4072" : "#1E2B4E"; g.fillRect(x + ((y / 4) % 2) * 2, y, 2, 2);
  }
}, 7, 7);
/** grey tie with small gold diamonds */
const tieTex = () => canvasTex(32, 32, (g) => {
  g.fillStyle = "#8D8A86"; g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#B99A5C";
  for (const [cx, cy] of [[8, 8], [24, 24]]) { g.beginPath(); g.moveTo(cx, cy - 5); g.lineTo(cx + 5, cy); g.lineTo(cx, cy + 5); g.lineTo(cx - 5, cy); g.fill(); }
  g.fillStyle = "#6F6C69"; g.fillRect(0, 15, 32, 2);
}, 2, 7);
function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, "rgba(10,14,30,0.42)"); gr.addColorStop(0.55, "rgba(10,14,30,0.18)"); gr.addColorStop(1, "rgba(10,14,30,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** Geometries built once: curly hair, beard, glasses, shirt V, lapels. */
function buildGeo() {
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  const place = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
    q.setFromEuler(e.set(rx, ry, rz)); m.compose(v.set(x, y, z), q, s.set(sx, sy, sz)); return g.applyMatrix4(m);
  };
  // hair: a cap set slightly back (hairline on the forehead) + curls for volume on top and at the back
  const cap = place(new THREE.SphereGeometry(0.123, 22, 10, 0, Math.PI * 2, 0, 1.3), 0, 0.018, -0.008, -0.3, 0, 0, 0.96, 1.08, 1.05);
  const curls: THREE.BufferGeometry[] = [cap];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const th = rnd() * 1.25, ph = rnd() * Math.PI * 2;
    const x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
    if (z > 0.55 && y < 0.72) continue; // keep the forehead clear
    const r = 0.122 + rnd() * 0.012;
    curls.push(place(new THREE.IcosahedronGeometry(0.026 + rnd() * 0.01, 0), x * r * 0.96, 0.018 + y * r * 1.06, -0.012 + z * r * 1.02, rnd() * 3, rnd() * 3, 0));
  }
  const hair = mergeGeometries(curls.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  curls.forEach((g) => g.dispose());
  hair.computeVertexNormals();
  // beard: lower face from the cheeks to under the chin, sideburns to the ears
  const beardParts = [
    place(new THREE.SphereGeometry(0.121, 24, 12, Math.PI / 2 - 1.45, 2.9, 1.76, 1.04), 0, 0, 0, 0, 0, 0, 0.95, 1.12, 1.05),
    // short sideburns along the jaw up to the ears
    place(new THREE.BoxGeometry(0.018, 0.075, 0.034), 0.1, -0.012, 0.006, 0, 0.12, 0.08),
    place(new THREE.BoxGeometry(0.018, 0.075, 0.034), -0.1, -0.012, 0.006, 0, -0.12, -0.08),
  ];
  const beard = mergeGeometries(beardParts.map((g) => (g.index ? g.toNonIndexed() : g)), false)!;
  beardParts.forEach((g) => g.dispose());
  beard.computeVertexNormals();
  // glasses: blue rectangular frames, bridge and temples; clear lenses
  const fr: THREE.BufferGeometry[] = [], lens: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const cx = sx * 0.04, cy = 0.024, cz = 0.124;
    fr.push(place(new THREE.BoxGeometry(0.05, 0.0065, 0.006), cx, cy + 0.0175, cz));
    fr.push(place(new THREE.BoxGeometry(0.05, 0.0045, 0.006), cx, cy - 0.0165, cz));
    fr.push(place(new THREE.BoxGeometry(0.0048, 0.036, 0.006), cx + 0.0245, cy, cz));
    fr.push(place(new THREE.BoxGeometry(0.0048, 0.036, 0.006), cx - 0.0245, cy, cz));
    lens.push(place(new THREE.PlaneGeometry(0.046, 0.031), cx, cy, cz + 0.001));
    const ax = sx * 0.066, az = 0.121, bx = sx * 0.106, bz = 0.0;
    fr.push(place(new THREE.BoxGeometry(0.0045, 0.0045, Math.hypot(bx - ax, bz - az)), (ax + bx) / 2, cy + 0.01, (az + bz) / 2, 0, Math.atan2(bx - ax, bz - az), 0));
  }
  fr.push(place(new THREE.BoxGeometry(0.02, 0.0045, 0.006), 0, 0.03, 0.126));
  const frames = mergeGeometries(fr, false)!, lenses = mergeGeometries(lens, false)!;
  fr.forEach((g) => g.dispose()); lens.forEach((g) => g.dispose());
  // white shirt in the V of the jacket, lapels on each side
  const tri = new THREE.Shape();
  tri.moveTo(-0.068, 0); tri.lineTo(0.068, 0); tri.lineTo(0, -0.26); tri.closePath();
  const shirt = place(new THREE.ShapeGeometry(tri), 0, 0.705, 0.118, -0.38, 0, 0);
  const lap: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) lap.push(place(new THREE.BoxGeometry(0.05, 0.3, 0.012), sx * 0.068, 0.565, 0.125, -0.32, 0, sx * 0.3));
  const lapels = mergeGeometries(lap, false)!;
  lap.forEach((g) => g.dispose());
  return {
    hair, beard, frames, lenses, shirt, lapels,
    skirt: new THREE.CylinderGeometry(0.165, 0.182, 0.22, 22),
    shoe: new THREE.BoxGeometry(0.1, 0.07, 0.25),
    cuff: new THREE.CylinderGeometry(0.05, 0.05, 0.03, 14),
    band: new THREE.CylinderGeometry(0.054, 0.054, 0.022, 16),
    dial: new THREE.CylinderGeometry(0.021, 0.021, 0.009, 16).rotateZ(Math.PI / 2),
    hand: new THREE.SphereGeometry(0.042, 12, 9),
    neck: new THREE.CylinderGeometry(0.048, 0.052, 0.12, 14),
    shoulder: new THREE.SphereGeometry(0.078, 16, 12),
    collar: new THREE.CylinderGeometry(0.06, 0.068, 0.05, 18, 1, true),
    head: new THREE.SphereGeometry(0.115, 24, 18),
    ear: new THREE.SphereGeometry(0.026, 10, 8),
    nose: new THREE.ConeGeometry(0.017, 0.046, 8).rotateX(Math.PI / 2),
    dot: new THREE.SphereGeometry(0.011, 8, 6),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
}

export type VisitorApi = { pose: (dt: number, t: number, lookYaw: number) => void; root: THREE.Group | null };

export default function Visitor({ api }: { api: React.MutableRefObject<VisitorApi | null> }) {
  const root = useRef<THREE.Group>(null), hips = useRef<THREE.Group>(null), upper = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null), legR = useRef<THREE.Group>(null), armL = useRef<THREE.Group>(null), armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null), torso = useRef<THREE.Mesh>(null);
  const geo = useMemo(buildGeo, []);
  const mats = useMemo(() => {
    const st = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
    return {
      suit: st("#FFFFFF", { map: suitTex(), roughness: 0.82 }),
      lapel: st("#C9D2EA", { map: suitTex(), roughness: 0.7 }),
      shirt: st("#F5F6F8", { roughness: 0.7, side: THREE.DoubleSide }),
      tie: st("#FFFFFF", { map: tieTex(), roughness: 0.5 }),
      gold: st("#CDAE72", { roughness: 0.55 }),
      skin: st("#B07C57", { roughness: 0.66 }),
      hair: st("#16110E", { roughness: 0.95, flatShading: true }),
      beard: st("#231A15", { roughness: 0.95, flatShading: true }),
      dark: st("#221914", { roughness: 0.6 }),
      lips: st("#80503F", { roughness: 0.55 }),
      frame: st("#2D5BA6", { roughness: 0.35, metalness: 0.3 }),
      lens: new THREE.MeshStandardMaterial({ color: "#C9DDF5", roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      silver: st("#CDD1D7", { roughness: 0.22, metalness: 0.85 }),
      dial: st("#E9ECF1", { roughness: 0.3, metalness: 0.2 }),
      shoe: st("#141518", { roughness: 0.35, metalness: 0.1 }),
      blob: new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, toneMapped: false }),
    };
  }, []);
  useEffect(() => () => {
    Object.values(mats).forEach((m) => { (m as THREE.MeshStandardMaterial).map?.dispose(); m.dispose(); });
    Object.values(geo).forEach((g) => g.dispose());
  }, [mats, geo]);

  const s = useRef({ phase: 0, y: 0, lean: 0, head: 0, air: 0, amp: 0, run: 0, first: true });
  useEffect(() => {
    api.current = {
      root: root.current,
      pose: (dt, t, lookYaw) => {
        const g = root.current, h = hips.current, u = upper.current;
        if (!g || !h || !u) return;
        const st = s.current;
        const sp = W.speed;
        // visual height follows the feet with a short damp (hides the small steps at the ends of the flights)
        if (st.first) { st.y = W.y; st.first = false; }
        st.y += (W.y - st.y) * (W.grounded ? 1 - Math.exp(-dt * 22) : 1);
        g.position.set(W.x + CAMPUS_OFFSET.x, st.y, W.z + CAMPUS_OFFSET.z);
        g.rotation.y = W.heading;
        const k = 1 - Math.exp(-dt * 10);
        st.run += (smooth((sp - 2.2) / 1.8) - st.run) * k;
        st.amp += (Math.min(1, sp / 1.1) - st.amp) * k;
        st.air += ((W.grounded ? 0 : 1) - st.air) * (1 - Math.exp(-dt * 14));
        const stride = THREE.MathUtils.lerp(1.3, 2.15, st.run);
        st.phase += (sp * dt * Math.PI * 2) / stride;
        const ph = st.phase, a = st.amp * (1 - st.air);
        const swing = Math.sin(ph);
        const legA = THREE.MathUtils.lerp(0.42, 0.8, st.run) * a, armA = THREE.MathUtils.lerp(0.3, 0.66, st.run) * a;
        const bob = Math.abs(Math.sin(ph)) * THREE.MathUtils.lerp(0.026, 0.065, st.run) * a;
        h.position.y = 0.88 + bob - 0.02 * st.run * a;
        legL.current!.rotation.x = swing * legA - 0.45 * st.air;
        legR.current!.rotation.x = -swing * legA - 0.15 * st.air;
        armL.current!.rotation.x = -swing * armA - 0.35 * st.air - 0.25 * st.run * a;
        armR.current!.rotation.x = swing * armA - 0.35 * st.air - 0.25 * st.run * a;
        st.lean += (0.14 * st.run * a + 0.035 * a - st.lean) * k;
        u.rotation.x = st.lean;
        const br = 1 + 0.012 * Math.sin(t * 1.6) * (1 - a);
        torso.current!.scale.set(0.9, br, 0.64);
        // the head turns toward where the camera looks, within a comfortable range (straight ahead when looked at from the front)
        const rel = wrap(lookYaw - W.heading);
        const want = Math.abs(rel) > 1.9 ? 0 : THREE.MathUtils.clamp(rel, -0.7, 0.7) * (1 - 0.6 * st.run);
        st.head += (want - st.head) * (1 - Math.exp(-dt * 5));
        if (head.current) { head.current.rotation.y = st.head + 0.05 * Math.sin(t * 0.4) * (1 - a); head.current.rotation.x = 0.03 * Math.sin(t * 0.7) * (1 - a); }
      },
    };
    return () => { api.current = null; };
  }, [api]);

  const { legGeo, armGeo, torsoGeo } = FIGURE;
  return (
    <group ref={root} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]} material={mats.blob} renderOrder={1}>
        <planeGeometry args={[0.95, 0.95]} />
      </mesh>
      <group scale={0.97}>
        <group ref={hips} position={[0, 0.88, 0]}>
          {/* legs: suit trousers, dark shoes */}
          {[-1, 1].map((sx) => (
            <group key={sx} ref={sx < 0 ? legR : legL} position={[sx * 0.092, 0, 0]}>
              <mesh geometry={legGeo} material={mats.suit} scale={[0.92, 1, 0.92]} castShadow />
              <mesh geometry={geo.shoe} material={mats.shoe} position={[0, -0.845, 0.045]} castShadow />
            </group>
          ))}
          <group ref={upper}>
            {/* jacket, its skirt over the hips, the white shirt in the V, lapels, tie, pocket square, button */}
            <mesh ref={torso} geometry={torsoGeo} material={mats.suit} position={[0, 0.34, 0]} scale={[0.9, 1, 0.64]} castShadow receiveShadow />
            <mesh geometry={geo.skirt} material={mats.suit} position={[0, 0.07, 0]} scale={[1, 1, 0.7]} castShadow />
            {[-1, 1].map((sx) => <mesh key={sx} geometry={geo.shoulder} material={mats.suit} position={[sx * 0.18, 0.6, 0]} scale={[0.92, 0.58, 0.8]} castShadow />)}
            <mesh geometry={geo.shirt} material={mats.shirt} />
            <mesh geometry={geo.lapels} material={mats.lapel} />
            <mesh geometry={geo.box} material={mats.tie} position={[0, 0.535, 0.131]} rotation-x={-0.18} scale={[0.044, 0.25, 0.008]} />
            <mesh geometry={geo.box} material={mats.tie} position={[0, 0.672, 0.112]} rotation-x={-0.4} scale={[0.05, 0.038, 0.022]} />
            <mesh geometry={geo.box} material={mats.gold} position={[0.098, 0.6, 0.118]} rotation-z={0.22} rotation-x={-0.28} scale={[0.062, 0.028, 0.012]} />
            <mesh geometry={geo.dot} material={mats.dark} position={[0, 0.37, 0.131]} />
            {/* neck and shirt collar */}
            <mesh geometry={geo.neck} material={mats.skin} position={[0, 0.775, 0]} />
            <mesh geometry={geo.collar} material={mats.shirt} position={[0, 0.735, 0.005]} scale={[1, 1, 0.9]} />
            {/* arms: sleeves, white cuffs, hands; silver watch on the left wrist */}
            {[-1, 1].map((sx) => (
              <group key={sx} ref={sx > 0 ? armL : armR} position={[sx * 0.235, 0.6, 0]} rotation-z={sx * 0.07}>
                <mesh geometry={armGeo} material={mats.suit} scale={[0.95, 1, 0.95]} castShadow />
                <mesh geometry={geo.cuff} material={mats.shirt} position={[0, -0.585, 0]} />
                <mesh geometry={geo.hand} material={mats.skin} position={[0, -0.645, 0]} scale={[0.75, 1.15, 0.6]} castShadow />
                {sx > 0 && (
                  <>
                    <mesh geometry={geo.band} material={mats.silver} position={[0, -0.562, 0]} />
                    <mesh geometry={geo.dial} material={mats.dial} position={[0.052, -0.562, 0]} />
                  </>
                )}
              </group>
            ))}
            {/* head: face, ears, nose, eyes, brows, curly hair, beard and moustache, blue glasses */}
            <group ref={head} position={[0, 0.89, 0.006]}>
              <mesh geometry={geo.head} material={mats.skin} scale={[0.92, 1.1, 1]} castShadow />
              {[-1, 1].map((sx) => (
                <group key={sx}>
                  <mesh geometry={geo.ear} material={mats.skin} position={[sx * 0.104, 0.004, -0.004]} scale={[0.45, 1, 0.75]} />
                  <mesh geometry={geo.dot} material={mats.dark} position={[sx * 0.038, 0.022, 0.104]} />
                  <mesh geometry={geo.box} material={mats.hair} position={[sx * 0.038, 0.046, 0.108]} rotation-z={sx * -0.12} scale={[0.034, 0.008, 0.01]} />
                </group>
              ))}
              <mesh geometry={geo.nose} material={mats.skin} position={[0, -0.004, 0.118]} />
              <mesh geometry={geo.hair} material={mats.hair} castShadow />
              <mesh geometry={geo.beard} material={mats.beard} />
              <mesh geometry={geo.box} material={mats.beard} position={[0, -0.03, 0.124]} scale={[0.056, 0.013, 0.014]} />
              <mesh geometry={geo.box} material={mats.lips} position={[0, -0.049, 0.13]} scale={[0.034, 0.012, 0.008]} />
              <mesh geometry={geo.frames} material={mats.frame} />
              <mesh geometry={geo.lenses} material={mats.lens} renderOrder={2} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
