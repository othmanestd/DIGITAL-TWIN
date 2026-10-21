// The shared human kit of the atlas: one stylised, properly proportioned person (≈ 7.3 heads, 1.75 m for a man) used by
// every figure of the platform (hospital staff and patients, the crowd, corridor porters, city pedestrians, the guided
// visit's cast, the walking visitor).
//
//  · Geometry: ONE merged mesh of 12 rigid bones (pelvis, chest + neck, head, upper arms, forearms + hands, thighs, shins +
//    shoes, a hem for coats / djellabas / skirts). Every vertex carries its bone, a colour zone (skin, top, bottom, hair,
//    shoes, accent, sleeve, accent 2, or a fixed grey) and up to two style bits; garment and hair variants (collar, V-neck,
//    open jacket, tie, badge, scarf, belt, hijab, cap, curls, bun, beard…) are all in the mesh and switched per person.
//  · Rendering: a HumanCrowd is ONE InstancedMesh (one draw call + one shadow pass for any head count). Per person a row
//    of a float texture holds the 12 bone matrices, the 8 zone colours, the style mask and an opacity; the vertex shader
//    skins rigidly, collapses the styles a person does not wear and passes the colour on. instanceMatrix = root transform.
//  · Poses: a Pose is a flat set of joint angles (forward-positive) written by helpers — walk, idle, seated (exact seat
//    height, thighs level, feet on the floor), push (hands on a handle, IK), typing, kneel, lying in bed, sitting on the
//    floor — and mixable. crowd.write() turns it into bone matrices without allocating.
//  · Wardrobes: dress(garb, seed) → a look (Moroccan hospital realism, calm colours; varied casual for visitors).
import * as THREE from "three";

// ================================================================= skeleton, zones, styles
export const BONE = { pelvis: 0, chest: 1, head: 2, uarmL: 3, farmL: 4, uarmR: 5, farmR: 6, thighL: 7, shinL: 8, thighR: 9, shinR: 10, skirt: 11 } as const;
const NB = 12;
/** Body dimensions (metres, man of 1.75 m; women are scaled by their height factor). L = the +x side. */
export const DIM = { thigh: 0.43, shin: 0.42, foot: 0.07, hip: 0.92, uarm: 0.29, farm: 0.25, hand: 0.068, waist: 0.1, neck: 0.5, sitHip: 0.095, back: 0.115 };
export const ZONE = { skin: 0, top: 1, bottom: 2, hair: 3, shoe: 4, accent: 5, sleeve: 6, accent2: 7 } as const;
const FIX = 8;                 // fixed grey (tone = grey level)
const PAL = NB * 4;            // first palette texel of a row
const INFO = PAL + 8;          // style mask lo, hi, opacity
const TW = 64;                 // texture width (texels)

export const STY = {
  male: 1, female: 2, collar: 3, vneck: 4, open: 5, tie: 6, badge: 7, scarf: 8, belt: 9, pouches: 10, drape: 11, hood: 12, pocket: 13,
  coat: 14, robe: 15, skirt: 16, short: 17, curly: 18, long: 19, bun: 20, hijab: 21, cap: 22, beard: 23, kufi: 24,
  buttons: 25, stripe: 26, hair: 27,
} as const;
export type Style = keyof typeof STY;

// ================================================================= geometry
type Ring = [number, number, number, number, number?]; // y, rx, z front, z back, z centre
type Acc = { pos: number[]; nor: number[]; bone: number[]; zone: number[]; sty: number[]; idx: number[] };
const _gm = new THREE.Matrix4(), _gq = new THREE.Quaternion(), _ge = new THREE.Euler(), _gp = new THREE.Vector3(), _gs = new THREE.Vector3();
function xf<T extends THREE.BufferGeometry>(g: T, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1): T {
  _gq.setFromEuler(_ge.set(rx, ry, rz)); _gm.compose(_gp.set(x, y, z), _gq, _gs.set(sx, sy, sz)); g.applyMatrix4(_gm); return g;
}
function geo(pos: number[], idx: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
/** A lofted tube along +y through superelliptic rings (bottom → top); a0/a1 = an open sector (coat fronts). */
function loft(rings: Ring[], seg: number, o: { p?: number; capB?: boolean; capT?: boolean; a0?: number; a1?: number } = {}) {
  const ex = 2 / (o.p ?? 2), open = o.a0 !== undefined, a0 = o.a0 ?? 0, a1 = o.a1 ?? Math.PI * 2, nv = open ? seg + 1 : seg;
  const pos: number[] = [], idx: number[] = [];
  for (const [y, rx, zf, zb, cz = 0] of rings) for (let j = 0; j < nv; j++) {
    const a = a0 + (a1 - a0) * (j / seg), s = Math.sin(a), c = Math.cos(a);
    pos.push(rx * Math.sign(s) * Math.abs(s) ** ex, y, cz + (c >= 0 ? zf : zb) * Math.sign(c) * Math.abs(c) ** ex);
  }
  const R = rings.length;
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < seg; j++) {
    const j1 = open ? j + 1 : (j + 1) % seg, a = i * nv + j, b = i * nv + j1, c = (i + 1) * nv + j, d = (i + 1) * nv + j1;
    idx.push(a, b, d, a, d, c);
  }
  if (!open && o.capB !== false) { const ci = pos.length / 3; pos.push(0, rings[0][0], rings[0][4] ?? 0); for (let j = 0; j < seg; j++) idx.push(ci, (j + 1) % seg, j); }
  if (!open && o.capT !== false) { const ci = pos.length / 3, b0 = (R - 1) * nv; pos.push(0, rings[R - 1][0], rings[R - 1][4] ?? 0); for (let j = 0; j < seg; j++) idx.push(ci, b0 + j, b0 + ((j + 1) % seg)); }
  return geo(pos, idx);
}
/** Front (or back, side −1) surface depth of a loft (p = 2) at (x, y). */
function surf(rings: Ring[], x: number, y: number, side = 1) {
  let i = 0;
  while (i < rings.length - 2 && rings[i + 1][0] < y) i++;
  const A = rings[i], B = rings[i + 1], t = Math.min(1, Math.max(0, (y - A[0]) / (B[0] - A[0])));
  const rx = A[1] + (B[1] - A[1]) * t, zz = side > 0 ? A[2] + (B[2] - A[2]) * t : A[3] + (B[3] - A[3]) * t, cz = (A[4] ?? 0) + ((B[4] ?? 0) - (A[4] ?? 0)) * t;
  const u = Math.min(0.995, Math.abs(x) / rx);
  return cz + side * zz * Math.sqrt(1 - u * u);
}
/** A patch conforming to a loft's front: rows y0 → y1, each row from xl(y) to xr(y). */
function decal(rings: Ring[], y0: number, y1: number, xl: (y: number) => number, xr: (y: number) => number, off: number, nx = 4, ny = 6, side = 1) {
  const pos: number[] = [], idx: number[] = [];
  for (let r = 0; r <= ny; r++) {
    const y = y0 + ((y1 - y0) * r) / ny, a = xl(y), b = xr(y);
    for (let c = 0; c <= nx; c++) { const x = a + ((b - a) * c) / nx; pos.push(x, y, surf(rings, x, y, side) + side * off); }
  }
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    const a = r * (nx + 1) + c, b = a + 1, d = a + nx + 1, e = d + 1;
    if (side > 0) idx.push(a, b, e, a, e, d); else idx.push(a, e, b, a, d, e);
  }
  return geo(pos, idx);
}
const sph = (w = 10, h = 7, t0 = 0, tl = Math.PI, p0 = 0, pl = Math.PI * 2) => new THREE.SphereGeometry(1, w, h, p0, pl, t0, tl);
const box = (x: number, y: number, z: number) => new THREE.BoxGeometry(x, y, z);

function add(A: Acc, g: THREE.BufferGeometry, bone: number, zone: number, tone = 1, s1 = 0, s2 = 0, shell = false) {
  const p = g.getAttribute("position"), n = g.getAttribute("normal"), base = A.pos.length / 3, k = shell ? -1 : 1;
  for (let i = 0; i < p.count; i++) {
    A.pos.push(p.getX(i), p.getY(i), p.getZ(i)); A.nor.push(n.getX(i) * k, n.getY(i) * k, n.getZ(i) * k);
    A.bone.push(bone); A.zone.push(zone, tone); A.sty.push(s1, s2);
  }
  const ix = g.getIndex();
  const tri = (a: number, b: number, c: number) => { if (shell) A.idx.push(base + a, base + c, base + b); else A.idx.push(base + a, base + b, base + c); };
  if (ix) for (let i = 0; i < ix.count; i += 3) tri(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
  else for (let i = 0; i < p.count; i += 3) tri(i, i + 1, i + 2);
  g.dispose();
}
/** Same loft, slightly inside and facing in (the lining seen through a coat's front or under a hem). */
function lining(rings: Ring[], seg: number, o: Parameters<typeof loft>[2], k = 0.965) {
  return loft(rings.map(([y, rx, zf, zb, cz]) => [y, rx * k, zf * k, zb * k, cz] as Ring), seg, { ...o, capB: false, capT: false });
}

// torso rings (chest bone, origin = waist), male and female
const CM: Ring[] = [[-0.02, 0.14, 0.09, 0.09], [-0.006, 0.172, 0.118, 0.114], [0.06, 0.156, 0.108, 0.103], [0.16, 0.166, 0.117, 0.108], [0.26, 0.182, 0.124, 0.112], [0.33, 0.19, 0.118, 0.108], [0.383, 0.183, 0.103, 0.097], [0.412, 0.136, 0.078, 0.078], [0.438, 0.076, 0.062, 0.062], [0.452, 0.05, 0.05, 0.05]];
const CF: Ring[] = [[-0.02, 0.142, 0.088, 0.088], [-0.006, 0.172, 0.116, 0.114], [0.08, 0.141, 0.098, 0.095], [0.165, 0.147, 0.113, 0.099], [0.225, 0.157, 0.132, 0.099], [0.285, 0.163, 0.119, 0.097], [0.35, 0.162, 0.1, 0.09], [0.385, 0.126, 0.076, 0.07], [0.41, 0.07, 0.056, 0.056], [0.42, 0.05, 0.048, 0.048]];
const SHOULDER = { m: [0.178, 0.352], f: [0.155, 0.33] };
const PELVIS: Ring[] = [[-0.088, 0.05, 0.03, 0.06, -0.01], [-0.066, 0.12, 0.068, 0.1, -0.008], [-0.02, 0.168, 0.094, 0.118, -0.01], [0.03, 0.168, 0.1, 0.113, -0.008], [0.08, 0.156, 0.1, 0.102, -0.004], [0.13, 0.149, 0.099, 0.099, 0]];
const HEADR: Ring[] = [[-0.036, 0.028, 0.018, 0.01, 0.052], [-0.026, 0.05, 0.042, 0.03, 0.038], [0, 0.068, 0.074, 0.056, 0.022], [0.04, 0.08, 0.09, 0.084, 0.012], [0.085, 0.088, 0.098, 0.1, 0.004], [0.13, 0.088, 0.095, 0.104, 0], [0.165, 0.075, 0.08, 0.09, 0], [0.19, 0.05, 0.052, 0.06, 0], [0.204, 0.02, 0.02, 0.026, 0]];
/** Chest-local front surface (for things worn on the chest by other modules: pocket squares, ties…). */
export function chestFront(x: number, y: number, female = false) { return surf(female ? CF : CM, x, y); }

function buildGeometry() {
  const A: Acc = { pos: [], nor: [], bone: [], zone: [], sty: [], idx: [] };
  const Z = ZONE, S = STY, B = BONE;
  // ---------------------------------------------------------------- pelvis (trousers), belt, tool pouches
  add(A, loft(PELVIS, 12, { capT: false }), B.pelvis, Z.bottom);
  add(A, loft([[0.07, 0.159, 0.106, 0.108, -0.004], [0.108, 0.156, 0.104, 0.105, -0.002]], 14, { capB: false, capT: false }), B.pelvis, Z.accent2, 1, S.belt);
  add(A, xf(box(0.042, 0.03, 0.012), 0, 0.089, 0.104), B.pelvis, FIX, 0.72, S.belt);
  for (const s of [-1, 1]) {
    add(A, xf(box(0.055, 0.085, 0.05), s * 0.158, 0.035, 0.04, 0, s * 0.55, 0), B.pelvis, FIX, 0.26, S.pouches);
    add(A, xf(box(0.03, 0.05, 0.03), s * 0.163, 0.0, -0.045, 0, s * 0.9, 0), B.pelvis, FIX, 0.34, S.pouches);
  }
  // ---------------------------------------------------------------- chest (top), neck, garment details per build
  const BUILDS: { R: Ring[]; g: number; shx: number }[] = [{ R: CM, g: S.male, shx: SHOULDER.m[0] }, { R: CF, g: S.female, shx: SHOULDER.f[0] }];
  for (const { R, g, shx } of BUILDS) {
    const fem = g === S.female, top = R[R.length - 3][0];
    add(A, loft(R, 12, { capB: false }), B.chest, Z.top, 1, g);
    // V-neck (scrubs, tunics): the undershirt or the skin
    add(A, decal(R, top - 0.105, top + 0.008, (y) => -0.062 * (y - (top - 0.105)) / 0.113, (y) => 0.062 * (y - (top - 0.105)) / 0.113, 0.004, 4, 5), B.chest, Z.accent, 1, S.vneck, g);
    // shirt collar band + its points
    add(A, loft([[top - 0.005, fem ? 0.08 : 0.088, fem ? 0.072 : 0.08, fem ? 0.072 : 0.08, 0.004], [top + 0.036, fem ? 0.064 : 0.07, fem ? 0.06 : 0.066, fem ? 0.062 : 0.068, 0.008]], 12, { capB: false, capT: false }), B.chest, Z.accent, 1, S.collar, g);
    add(A, decal(R, top - 0.1, top - 0.004, () => -0.011, () => 0.011, 0.0045, 1, 3), B.chest, Z.accent, 0.9, S.collar, g);
    for (const y of [top - 0.035, top - 0.075]) add(A, xf(sph(6, 4), 0, y, surf(R, 0, y) + 0.006, 0, 0, 0, 0.006, 0.006, 0.004), B.chest, FIX, 0.85, S.collar, g);
    // open front (jacket, white coat, cardigan): the shirt in the V, lapels, button line, buttons
    const vy0 = 0.15, vy1 = top + 0.01, vw = (y: number) => 0.072 * Math.max(0, (y - vy0) / (vy1 - vy0));
    add(A, decal(R, vy0, vy1, (y) => -vw(y), vw, 0.004, 4, 7), B.chest, Z.accent, 1, S.open, g);
    for (const s of [-1, 1]) {
      add(A, decal(R, vy0 + 0.05, vy1 - 0.005, (y) => (s > 0 ? vw(y) : -vw(y) - 0.04 * Math.min(1, (y - vy0) / 0.15)), (y) => (s > 0 ? vw(y) + 0.04 * Math.min(1, (y - vy0) / 0.15) : -vw(y)), 0.008, 2, 7), B.chest, Z.top, 0.86, S.open, g);
    }
    add(A, decal(R, -0.03, vy0 + 0.004, () => -0.004, () => 0.004, 0.0045, 1, 3), B.chest, Z.top, 0.72, S.open, g);
    for (const y of [0.115, 0.04]) add(A, xf(sph(6, 4), 0, y, surf(R, 0, y) + 0.004, 0, 0, 0, 0.009, 0.009, 0.005), B.chest, FIX, 0.22, S.buttons, g);
    // tie over the shirt
    const tw = (y: number) => (y < 0.205 ? 0.026 * Math.max(0, (y - 0.175) / 0.03) : 0.016 + 0.01 * Math.min(1, Math.max(0, (vy1 - 0.03 - y) / (vy1 - 0.235))));
    add(A, decal(R, 0.175, vy1 - 0.005, (y) => -tw(y), tw, 0.0075, 2, 7), B.chest, Z.accent2, 1, S.tie, g);
    add(A, xf(box(0.032, 0.026, 0.016), 0, vy1 - 0.018, surf(R, 0, vy1 - 0.018) + 0.01, -0.25), B.chest, Z.accent2, 0.9, S.tie, g);
    // badge on the right chest, coat pocket and pen on the left chest
    add(A, decal(R, 0.245, 0.31, () => -0.12, () => -0.074, 0.0065, 1, 1), B.chest, FIX, 0.96, S.badge, g);
    add(A, decal(R, 0.295, 0.31, () => -0.12, () => -0.074, 0.0075, 1, 1), B.chest, FIX, 0.42, S.badge, g);
    add(A, decal(R, 0.205, 0.275, () => 0.07, () => 0.125, 0.0065, 2, 2), B.chest, Z.top, 0.9, S.pocket, g);
    add(A, decal(R, 0.255, 0.3, () => 0.082, () => 0.09, 0.009, 1, 2), B.chest, FIX, 0.28, S.pocket, g);
    // horizontal stripes (sport tops, some pyjamas)
    for (const y of [0.12, 0.2, 0.28]) add(A, loft([y, y + 0.03].map((yy) => { const k = ringAt(R, yy); return [yy, k[1] + 0.003, k[2] + 0.003, k[3] + 0.003, k[4]] as Ring; }), 14, { capB: false, capT: false }), B.chest, Z.accent2, 1, S.stripe, g);
    // neck scarf (accent 2): a soft ring and its hanging end
    add(A, xf(new THREE.TorusGeometry(0.07, 0.028, 6, 14), 0, top - 0.002, 0.008, Math.PI / 2, 0, 0, 1.12, 1.05, 1), B.chest, Z.accent2, 1, S.scarf, g);
    add(A, xf(box(0.055, 0.17, 0.02), 0.035, top - 0.11, surf(R, 0.035, top - 0.11) + 0.018, -0.12, 0, 0.12), B.chest, Z.accent2, 0.94, S.scarf, g);
    // djellaba hood on the back
    add(A, xf(sph(8, 6), 0, top - 0.13, surf(R, 0, top - 0.13, -1) - 0.018, 0.15, 0, 0, 0.085, 0.12, 0.026), B.chest, Z.top, 0.93, S.hood, g);
    add(A, xf(new THREE.ConeGeometry(0.03, 0.07, 6), 0, top - 0.27, surf(R, 0, top - 0.25, -1) - 0.02, Math.PI, 0, 0, 1, 1, 0.5), B.chest, Z.top, 0.93, S.hood, g);
    // hijab drape (hair zone = the scarf's colour) over the neck and shoulders
    const dr = (y: number, ex: number, ez: number): Ring => { const k = ringAt(R, y); return [y, Math.max(k[1] + ex, shx + 0.03), k[2] + ez, k[3] + ez, k[4]]; };
    {
      const d = loft([dr(top - 0.12, 0.02, 0.014), dr(top - 0.08, 0.021, 0.016), dr(top - 0.04, 0.02, 0.018), [top - 0.008, 0.125, 0.096, 0.09, 0.006], [top + 0.035, 0.085, 0.08, 0.072, 0.012], [top + 0.09, 0.07, 0.072, 0.064, 0.02]], 18, { capB: false, capT: false });
      const q = d.getAttribute("position");
      for (let v = 0; v < q.count; v++) {
        const x = q.getX(v), y = q.getY(v), z = q.getZ(v), c = Math.max(0, z) / Math.hypot(x, z || 1e-6);
        const lowness = Math.max(0, Math.min(1, (top - 0.02 - y) / 0.1));
        q.setY(v, y - 0.07 * lowness * c ** 2);
        q.setZ(v, z + 0.01 * lowness * c ** 2);
      }
      d.computeVertexNormals();
      add(A, d, B.chest, Z.hair, 1, S.drape, g);
    }
  }
  add(A, loft([[0.405, 0.053, 0.055, 0.052, 0.008], [0.54, 0.05, 0.051, 0.049, 0.012]], 10, { capB: false, capT: false }), B.chest, Z.skin, 1, S.male);
  add(A, loft([[0.39, 0.045, 0.047, 0.044, 0.008], [0.53, 0.043, 0.044, 0.042, 0.012]], 10, { capB: false, capT: false }), B.chest, Z.skin, 1, S.female);
  // ---------------------------------------------------------------- hem: white coat (open front), djellaba, skirt — with linings
  const COAT: Ring[] = [[-0.43, 0.215, 0.14, 0.16], [-0.2, 0.2, 0.132, 0.148], [0, 0.176, 0.118, 0.128], [0.1, 0.158, 0.106, 0.108]];
  add(A, loft(COAT, 18, { a0: 0.3, a1: Math.PI * 2 - 0.3 }), B.skirt, Z.top, 1, S.coat);
  add(A, lining(COAT, 18, { a0: 0.3, a1: Math.PI * 2 - 0.3 }), B.skirt, Z.top, 0.8, S.coat, 0, true);
  for (const s of [-1, 1]) add(A, xf(box(0.085, 0.07, 0.008), s * 0.2 * Math.sin(0.85), -0.16, 0.135 * Math.cos(0.85) + 0.004, 0, s * 0.85, 0), B.skirt, Z.top, 0.88, S.coat);
  const ROBE: Ring[] = [[-0.84, 0.26, 0.2, 0.2], [-0.6, 0.235, 0.175, 0.18], [-0.3, 0.21, 0.15, 0.16], [0, 0.178, 0.12, 0.13], [0.1, 0.158, 0.106, 0.108]];
  add(A, loft(ROBE, 18, { capB: false, capT: false }), B.skirt, Z.top, 1, S.robe);
  add(A, lining(ROBE, 18, {}), B.skirt, Z.top, 0.78, S.robe, 0, true);
  add(A, decal(ROBE, -0.82, 0.05, () => -0.006, () => 0.006, 0.003, 1, 8), B.skirt, Z.top, 0.8, S.robe);
  const SKIRT: Ring[] = [[-0.66, 0.22, 0.17, 0.17], [-0.35, 0.2, 0.15, 0.16], [0, 0.172, 0.114, 0.128], [0.1, 0.158, 0.106, 0.108]];
  add(A, loft(SKIRT, 18, { capB: false, capT: false }), B.skirt, Z.bottom, 1, S.skirt);
  add(A, lining(SKIRT, 18, {}), B.skirt, Z.bottom, 0.8, S.skirt, 0, true);
  // ---------------------------------------------------------------- head: face, nose, ears, eyes, brows, mouth
  add(A, loft(HEADR, 12), B.head, Z.skin);
  add(A, xf(new THREE.ConeGeometry(0.016, 0.034, 6), 0, 0.058, 0.1, Math.PI / 2 - 0.25, 0, 0, 0.9, 1, 1), B.head, Z.skin, 0.97);
  for (const s of [-1, 1]) {
    add(A, xf(sph(5, 4), s * 0.087, 0.072, -0.005, 0, 0, 0, 0.012, 0.028, 0.02), B.head, Z.skin, 0.94);
    add(A, xf(sph(5, 4), s * 0.032, 0.088, 0.094, 0, 0, 0, 0.0115, 0.0125, 0.006), B.head, FIX, 0.09);
    add(A, xf(box(0.03, 0.0065, 0.008), s * 0.033, 0.108, 0.097, 0, 0, -s * 0.08), B.head, Z.hair, 0.9);
  }
  add(A, xf(box(0.026, 0.005, 0.006), 0, 0.03, 0.098), B.head, Z.skin, 0.7);
  // ---------------------------------------------------------------- hair styles (head bone)
  // a hair shell clipped along a hairline: high on the forehead, over the top of the ears, low on the nape
  const LINE: [number, number][] = [[0, 0.152], [0.6, 0.145], [1.0, 0.125], [1.45, 0.1], [1.9, 0.07], [2.5, 0.036], [Math.PI, 0.03]];
  const hairline = (az: number, back = 0) => {
    const a = Math.abs(az);
    for (let i = 1; i < LINE.length; i++) if (a <= LINE[i][0]) { const [a0, h0] = LINE[i - 1], [a1, h1] = LINE[i]; return h0 + ((h1 - h0) * (a - a0)) / (a1 - a0) - back * Math.max(0, (a - 1.4) / 1.7); }
    return 0.03 - back;
  };
  const shell = (k = 1, back = 0) => {
    const h = xf(sph(18, 12, 0, Math.PI * 0.82), 0, 0.095, -0.006, 0, 0, 0, 0.1 * k, 0.123 * k, 0.114 * k);
    const p = h.getAttribute("position"), ix = h.getIndex()!, keep: number[] = [];
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v), d = hairline(Math.atan2(x, z + 0.006), back) - y;
      if (d <= 0) continue;
      const k = 1 - 0.16 * Math.min(1, d / 0.022);
      p.setXYZ(v, x * k, 0.095 + (y - 0.095) * k, -0.006 + (z + 0.006) * k);
    }
    for (let i = 0; i < ix.count; i += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let q = 0; q < 3; q++) { const v = ix.getX(i + q); cx += p.getX(v) / 3; cy += p.getY(v) / 3; cz += p.getZ(v) / 3; }
      if (cy < hairline(Math.atan2(cx, cz + 0.006), back) - 0.03) continue;
      keep.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
    }
    h.setIndex(keep);
    h.computeVertexNormals();
    return h;
  };
  add(A, shell(), B.head, Z.hair, 1, S.hair);
  add(A, shell(1.04), B.head, Z.hair, 1, S.curly);
  {
    let sd = 11;
    const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const th = 0.1 + r() * 1.2, ph = r() * Math.PI * 2, x = Math.sin(th) * Math.cos(ph), y = Math.cos(th), z = Math.sin(th) * Math.sin(ph);
      if (z > 0.45 && y < 0.8) continue;
      const rr = 0.028 + r() * 0.01, ico = new THREE.IcosahedronGeometry(1, 0), pa = ico.getAttribute("position");
      const na = new THREE.Float32BufferAttribute(pa.count * 3, 3);
      for (let v = 0; v < pa.count; v++) { _gp.set(pa.getX(v), pa.getY(v), pa.getZ(v)).normalize(); na.setXYZ(v, _gp.x, _gp.y, _gp.z); }
      ico.setAttribute("normal", na);
      add(A, xf(ico, x * 0.102, 0.1 + y * 0.118, -0.01 + z * 0.112, r() * 3, r() * 3, 0, rr, rr * 0.85, rr), B.head, Z.hair, 0.92 + r() * 0.1, S.curly);
    }
  }
  add(A, loft([[-0.13, 0.085, 0.02, 0.06, -0.05], [-0.05, 0.1, 0.02, 0.085, -0.035], [0.04, 0.104, 0.04, 0.106, -0.02], [0.13, 0.098, 0.05, 0.112, -0.01]], 12, { capT: false }), B.head, Z.hair, 0.97, S.long);
  add(A, xf(sph(10, 7), 0, 0.15, -0.118, 0, 0, 0, 0.052, 0.05, 0.05), B.head, Z.hair, 0.95, S.bun);
  {
    const h = xf(sph(16, 11), 0, 0.087, -0.008, 0, 0, 0, 0.103, 0.13, 0.115);
    const p = h.getAttribute("position"), ix = h.getIndex()!, keep: number[] = [];
    for (let i = 0; i < ix.count; i += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { const v = ix.getX(i + k); cx += p.getX(v) / 3; cy += p.getY(v) / 3; cz += p.getZ(v) / 3; }
      if (cz > 0 && (cx / 0.072) ** 2 + ((cy - 0.062) / 0.098) ** 2 < 1) continue;
      keep.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
    }
    h.setIndex(keep);
    add(A, h, B.head, Z.hair, 1, S.hijab);
  }
  add(A, xf(sph(14, 6, 0, Math.PI / 2), 0, 0.14, -0.005, -0.12, 0, 0, 0.104, 0.077, 0.116), B.head, Z.accent, 1, S.cap);
  add(A, xf(box(0.15, 0.012, 0.085), 0, 0.148, 0.115, 0.14, 0, 0), B.head, Z.accent, 0.92, S.cap);
  {
    const rings: Ring[] = [[-0.046, 0.03, 0.02, 0.01, 0.05], ...[-0.032, -0.015, 0, 0.02, 0.04, 0.06, 0.08].map((y) => { const k = ringAt(HEADR, y); return [y, k[1] + 0.006, k[2] + 0.007, k[3] + 0.005, k[4]] as Ring; })];
    const b = loft(rings, 18, { a0: -2.0, a1: 2.0 });
    const p = b.getAttribute("position"), ix = b.getIndex()!, keep: number[] = [];
    const line = (az: number) => { const a = Math.abs(az); return a < 0.35 ? 0.022 : a < 1.1 ? 0.022 + (0.05 * (a - 0.35)) / 0.75 : 0.085; };
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), y = p.getY(v), z = p.getZ(v), d = y - line(Math.atan2(x, z - 0.01));
      if (d <= 0) continue;
      const k = 1 - 0.18 * Math.min(1, d / 0.01);
      p.setXYZ(v, x * k, y, 0.01 + (z - 0.01) * k);
    }
    for (let i = 0; i < ix.count; i += 3) {
      let cx = 0, cy = 0, cz = 0;
      for (let q = 0; q < 3; q++) { const v = ix.getX(i + q); cx += p.getX(v) / 3; cy += p.getY(v) / 3; cz += p.getZ(v) / 3; }
      if (cy > line(Math.atan2(cx, cz - 0.01)) + 0.022) continue;
      keep.push(ix.getX(i), ix.getX(i + 1), ix.getX(i + 2));
    }
    b.setIndex(keep);
    b.computeVertexNormals();
    add(A, b, B.head, Z.hair, 1.08, S.beard);
  }
  add(A, xf(sph(8, 4), 0, 0.043, 0.098, 0, 0, 0, 0.03, 0.007, 0.01), B.head, Z.hair, 1.04, S.beard);
  add(A, xf(new THREE.CylinderGeometry(0.082, 0.088, 0.05, 14), 0, 0.182, -0.012, -0.16, 0, 0), B.head, FIX, 0.92, S.kufi);
  // ---------------------------------------------------------------- arms (upper: top, then sleeve; forearm: sleeve; hand: skin)
  for (const [ua, fa, side] of [[B.uarmL, B.farmL, 1], [B.uarmR, B.farmR, -1]] as const) {
    add(A, loft([[-0.13, 0.049, 0.05, 0.047], [-0.06, 0.052, 0.053, 0.05], [0, 0.049, 0.049, 0.048], [0.02, 0.038, 0.038, 0.038], [0.032, 0.016, 0.016, 0.016]], 8, { capB: false }), ua, Z.top);
    add(A, loft([[-0.31, 0.02, 0.02, 0.02], [-0.295, 0.035, 0.036, 0.035], [-0.2, 0.043, 0.044, 0.042], [-0.135, 0.046, 0.047, 0.044], [-0.118, 0.045, 0.046, 0.043]], 8, { capT: false }), ua, Z.sleeve);
    add(A, loft([[-0.255, 0.022, 0.024, 0.024], [-0.24, 0.031, 0.033, 0.032], [-0.07, 0.041, 0.046, 0.044], [0, 0.04, 0.042, 0.042], [0.03, 0.026, 0.028, 0.028]], 8), fa, Z.sleeve);
    add(A, loft([[-0.37, 0.01, 0.016, 0.016, 0.004], [-0.345, 0.016, 0.034, 0.03, 0.003], [-0.3, 0.02, 0.041, 0.035, 0.002], [-0.265, 0.021, 0.036, 0.031, 0], [-0.238, 0.023, 0.03, 0.028, 0]], 7, { p: 2.2 }), fa, Z.skin);
    add(A, xf(sph(5, 3), -side * 0.012, -0.29, 0.032, 0.5, 0, side * 0.2, 0.012, 0.032, 0.013), fa, Z.skin, 0.97);
  }
  // ---------------------------------------------------------------- legs (trousers) and shoes
  for (const [th, sh] of [[B.thighL, B.shinL], [B.thighR, B.shinR]] as const) {
    add(A, loft([[-0.47, 0.045, 0.045, 0.045], [-0.42, 0.058, 0.061, 0.057], [-0.25, 0.072, 0.075, 0.07], [-0.1, 0.083, 0.087, 0.085], [0, 0.089, 0.09, 0.092], [0.05, 0.078, 0.076, 0.08]], 9), th, Z.bottom);
    add(A, loft([[-0.405, 0.047, 0.047, 0.047], [-0.25, 0.047, 0.046, 0.051], [-0.1, 0.054, 0.052, 0.062], [0, 0.056, 0.058, 0.056], [0.04, 0.046, 0.048, 0.046]], 9), sh, Z.bottom);
    add(A, xf(loft([[-0.07, 0.03, 0.025, 0.03], [-0.05, 0.042, 0.035, 0.044], [0.03, 0.047, 0.036, 0.042], [0.13, 0.046, 0.036, 0.024], [0.185, 0.036, 0.034, 0.015], [0.2, 0.015, 0.02, 0.008]], 8, { p: 2.4 }), 0, -0.455, 0, Math.PI / 2), sh, Z.shoe);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(A.nor, 3));
  g.setAttribute("hBone", new THREE.Float32BufferAttribute(A.bone, 1));
  g.setAttribute("hZone", new THREE.Float32BufferAttribute(A.zone, 2));
  g.setAttribute("hSty", new THREE.Float32BufferAttribute(A.sty, 2));
  g.setIndex(A.idx);
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2.5);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(-1, -0.2, -1), new THREE.Vector3(1, 2.2, 1));
  return g;
}
function ringAt(R: Ring[], y: number): Ring {
  let i = 0;
  while (i < R.length - 2 && R[i + 1][0] < y) i++;
  const a = R[i], b = R[i + 1], t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0])));
  return [y, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, (a[4] ?? 0) + ((b[4] ?? 0) - (a[4] ?? 0)) * t];
}

let GEO: THREE.BufferGeometry | null = null;
/** The merged person (shared by every crowd; never disposed). */
export function humanGeometry() { return (GEO ??= buildGeometry()); }
/** Triangles in the merged mesh (all variants) — a person draws only the styles they wear. */
export function humanTriangles() { return humanGeometry().index!.count / 3; }

// ================================================================= material (rigid skinning from the crowd texture)
const VHEAD = /* glsl */ `
uniform highp sampler2D hTex;
attribute float hBone;
attribute vec2 hZone;
attribute vec2 hSty;
varying vec3 vHCol;
varying float vHA;
mat4 hMat(int b) { int x = b * 4; int y = gl_InstanceID; return mat4(texelFetch(hTex, ivec2(x, y), 0), texelFetch(hTex, ivec2(x + 1, y), 0), texelFetch(hTex, ivec2(x + 2, y), 0), texelFetch(hTex, ivec2(x + 3, y), 0)); }
float hBit(vec4 inf, float s) { if (s < 0.5) return 1.0; float w = s > 24.5 ? inf.y : inf.x; float b = s > 24.5 ? s - 25.0 : s - 1.0; return mod(floor(w / exp2(b) + 0.0001), 2.0); }
`;
const VBODY = /* glsl */ `
  vec4 hInf = texelFetch(hTex, ivec2(${INFO}, gl_InstanceID), 0);
  transformed = (hM * vec4(transformed, 1.0)).xyz * (hBit(hInf, hSty.x) * hBit(hInf, hSty.y));
`;
function patch(shader: THREE.WebGLProgramParametersWithUniforms, tex: { value: THREE.Texture }, color: boolean) {
  shader.uniforms.hTex = tex;
  let vs = shader.vertexShader.replace("#include <common>", "#include <common>\n" + VHEAD);
  if (color) {
    vs = vs.replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n  mat4 hM = hMat(int(hBone + 0.5));\n  objectNormal = normalize(mat3(hM) * objectNormal);")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + VBODY + `
  { int hz = int(hZone.x + 0.5); vHA = hInf.z; vHCol = hz >= ${FIX} ? vec3(hZone.y) : texelFetch(hTex, ivec2(${PAL} + hz, gl_InstanceID), 0).rgb * hZone.y; }`);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vHCol;\nvarying float vHA;")
      .replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.rgb *= vHCol;\n  diffuseColor.a *= vHA;");
  } else {
    vs = vs.replace("#include <begin_vertex>", "#include <begin_vertex>\n  mat4 hM = hMat(int(hBone + 0.5));\n" + VBODY);
  }
  shader.vertexShader = vs;
}

// ================================================================= poses
/** Joint angles of a person (radians, forward-positive; L = the person's +x side). */
export type Pose = {
  hipY: number; ground: number; dx: number; dz: number;  // pelvis height (body units), 1 = drop the pelvis so the lowest sole is on the floor
  pp: number; py: number; pr: number;                      // pelvis pitch (forward), yaw, roll
  sp: number; sy: number; sr: number;                      // chest relative to the pelvis
  hp: number; hy: number; hr: number;                      // head (pitch down, yaw, roll)
  afL: number; aoL: number; aeL: number; afR: number; aoR: number; aeR: number;   // shoulder forward, outward, elbow flex
  lfL: number; loL: number; lkL: number; lfR: number; loR: number; lkR: number;   // hip forward, outward, knee flex
  skP: number; skL: number;                                // hem pitch (forward, seated) and length
  lie: number;                                             // 1 = lying on the back (bed), feet at the root, head toward −z
  ikL: number; ikR: number; txL: number; tyL: number; tzL: number; txR: number; tyR: number; tzR: number; // hand targets (root frame, body units)
};
export function newPose(): Pose {
  const P = {} as Pose;
  poseNeutral(P);
  return P;
}
const KEYS = ["hipY", "ground", "dx", "dz", "pp", "py", "pr", "sp", "sy", "sr", "hp", "hy", "hr", "afL", "aoL", "aeL", "afR", "aoR", "aeR", "lfL", "loL", "lkL", "lfR", "loR", "lkR", "skP", "skL", "lie", "ikL", "ikR", "txL", "tyL", "tzL", "txR", "tyR", "tzR"] as const;
export function poseNeutral(P: Pose) {
  P.hipY = DIM.hip; P.ground = 1; P.dx = P.dz = 0;
  P.pp = P.py = P.pr = 0; P.sp = 0.02; P.sy = P.sr = 0; P.hp = 0.03; P.hy = P.hr = 0;
  P.afL = P.afR = 0.05; P.aoL = P.aoR = 0.1; P.aeL = P.aeR = 0.16;
  P.lfL = P.lfR = 0; P.loL = P.loR = 0.025; P.lkL = P.lkR = 0.03;
  P.skP = 0; P.skL = 1; P.lie = 0; P.ikL = P.ikR = 0;
  P.txL = P.tyL = P.tzL = P.txR = P.tyR = P.tzR = 0;
  return P;
}
export function copyPose(out: Pose, a: Pose) { for (const k of KEYS) out[k] = a[k]; return out; }
/** out = a + (b − a) k (hand targets blend too; an IK hand blends with the other pose's FK angles through its weight). */
export function mixPose(out: Pose, a: Pose, b: Pose, k: number) { for (const key of KEYS) out[key] = a[key] + (b[key] - a[key]) * k; return out; }

/** Calm look-around + breathing + weight shift (standing). */
export function poseIdle(P: Pose, t: number, sd: number) {
  poseNeutral(P);
  const w = Math.sin(0.23 * t + sd) * Math.sin(0.071 * t + sd * 1.7);
  P.pr = 0.025 * w; P.dx = 0.012 * w; P.sr = -0.03 * w;
  P.lkL = 0.03 + 0.09 * Math.max(0, -w); P.lkR = 0.03 + 0.09 * Math.max(0, w);
  P.lfL = 0.03 * Math.max(0, -w); P.lfR = 0.03 * Math.max(0, w);
  P.sp = 0.02 + 0.012 * Math.sin(1.55 * t + sd);
  P.hy = 0.42 * Math.sin(0.21 * t + sd) * Math.sin(0.083 * t + sd * 2.3); P.hp = 0.04 + 0.05 * Math.sin(0.31 * t + sd);
  P.afL = 0.05 + 0.03 * Math.sin(1.55 * t + sd); P.afR = 0.05 - 0.03 * Math.sin(1.55 * t + sd);
  return P;
}
/** Walking: ph = gait phase (2π per stride of ~1.75 m), amp 0…1. A long robe shortens the stride. */
export function poseWalk(P: Pose, ph: number, amp: number, robe = false) {
  poseNeutral(P);
  const A = amp * (robe ? 0.62 : 1), s = Math.sin(ph);
  const knee = (q: number) => A * (0.08 + 0.7 * Math.max(0, Math.cos(q + 0.35)) ** 1.4);
  P.lfL = 0.42 * A * s; P.lfR = -0.42 * A * s; P.lkL = knee(ph); P.lkR = knee(ph + Math.PI);
  P.afL = 0.05 - 0.34 * A * s; P.afR = 0.05 + 0.34 * A * s;
  P.aeL = 0.18 + 0.18 * A + 0.2 * A * Math.max(0, -s); P.aeR = 0.18 + 0.18 * A + 0.2 * A * Math.max(0, s);
  P.py = -0.07 * A * s; P.sy = 0.11 * A * s; P.hy = -0.04 * A * s; P.pr = 0.025 * A * Math.cos(ph * 2);
  P.sp = 0.03 + 0.04 * A; P.skP = 0.03 * A * Math.sin(ph * 2);
  return P;
}
/** Seated on a seat whose top is `seat` metres above the root (sc = the person's scale; feet support at `foot` metres). */
export function poseSit(P: Pose, seat: number, sc: number, t: number, sd: number, foot = 0) {
  poseNeutral(P);
  P.ground = 0; P.hipY = seat / sc + DIM.sitHip; P.dz = -0.03; P.pp = -0.07; P.sp = 0.09;
  const h = P.hipY - foot / sc, Ls = DIM.shin + DIM.foot;
  let beta = 0, gam = 0;
  if (h > Ls) beta = Math.asin(Math.min(0.62, (h - Ls) / DIM.thigh)); else gam = Math.acos(Math.max(0.25, h / Ls));
  const kneeH = h - DIM.thigh * Math.sin(beta);
  if (kneeH < Ls && beta > 0) gam = Math.acos(Math.max(0.25, kneeH / Ls));
  const a = Math.PI / 2 - beta;               // thigh, absolute forward angle from straight down
  const spread = 0.012 * Math.sin(0.13 * t + sd);
  P.lfL = P.lfR = a + P.pp; P.lkL = a - gam - 0.04 + spread; P.lkR = a - gam - 0.04 - spread; P.loL = P.loR = 0.07;
  P.skP = 1.42; P.skL = 0.62;
  // hands resting on the thighs
  P.ikL = P.ikR = 1;
  P.txL = 0.12; P.txR = -0.12; P.tyL = P.tyR = P.hipY + 0.08 - 0.25 * Math.tan(beta); P.tzL = P.tzR = 0.27;
  P.hy = 0.35 * Math.sin(0.19 * t + sd) * Math.sin(0.07 * t + sd * 2); P.hp = 0.06 + 0.04 * Math.sin(0.27 * t + sd);
  P.sp += 0.012 * Math.sin(1.55 * t + sd);
  return P;
}
/** Seated at a desk, typing on a keyboard `reach` metres ahead at `deskY` metres high. */
export function poseType(P: Pose, seat: number, sc: number, t: number, sd: number, deskY = 0.78, reach = 0.52) {
  poseSit(P, seat, sc, t, sd);
  P.sp = 0.2; P.hp = 0.1 + 0.04 * Math.sin(0.3 * t + sd); P.hy = 0.12 * Math.sin(0.17 * t + sd) * Math.max(0, Math.sin(0.05 * t + sd));
  const y = deskY / sc + 0.035, z = reach / sc;
  P.txL = 0.13; P.txR = -0.13;
  P.tyL = y + 0.012 * Math.max(0, Math.sin(13 * t + sd)); P.tyR = y + 0.012 * Math.max(0, Math.sin(13 * t + sd + 1.9));
  P.tzL = z + 0.01 * Math.sin(2.1 * t + sd); P.tzR = z + 0.01 * Math.sin(1.7 * t + sd + 1);
  return P;
}
/** Standing and typing / writing at a counter or a cart (hands `y` metres high, `reach` ahead). */
export function poseCounter(P: Pose, t: number, sd: number, y = 1.02, reach = 0.36, sc = 1) {
  poseIdle(P, t, sd);
  P.sp = 0.12; P.hp = 0.3; P.hy *= 0.25; P.ikL = P.ikR = 1;
  P.txL = 0.13; P.txR = -0.13; P.tyL = y / sc + 0.01 * Math.max(0, Math.sin(11 * t + sd)); P.tyR = y / sc + 0.01 * Math.max(0, Math.sin(11 * t + sd + 2)); P.tzL = P.tzR = reach / sc;
  return P;
}
/** Holding a tablet at chest height, looking at it. */
export function poseTablet(P: Pose, t: number, sd: number) {
  poseIdle(P, t, sd);
  P.hp = 0.42; P.hy *= 0.2; P.sp = 0.04; P.ikL = P.ikR = 1;
  P.txL = 0.07; P.txR = -0.09; P.tyL = 1.08; P.tyR = 1.06 + 0.02 * Math.sin(3.1 * t + sd); P.tzL = P.tzR = 0.3;
  return P;
}
/** Holding a phone in front of the face (hand R), looking at it. */
export function posePhone(P: Pose, t: number, sd: number, y = 1.17) {
  P.ikR = 1; P.txR = -0.07; P.tyR = y + 0.01 * Math.sin(2 * t + sd); P.tzR = 0.27; P.hp = 0.38; P.hy *= 0.2;
  return P;
}
/** Walking behind something, both hands on its handle at (±hw, hy, hz) metres in the root frame. */
export function posePush(P: Pose, ph: number, amp: number, hw: number, hy: number, hz: number, sc = 1) {
  poseWalk(P, ph, amp * 0.85);
  P.sp = 0.13; P.hp = 0.06; P.sy *= 0.3; P.py *= 0.5; P.ikL = P.ikR = 1;
  P.txL = hw / sc; P.txR = -hw / sc; P.tyL = P.tyR = hy / sc; P.tzL = P.tzR = hz / sc;
  return P;
}
/** Kneeling on the right knee next to someone on the floor, hands toward them. */
export function poseKneel(P: Pose, t: number) {
  poseNeutral(P);
  P.ground = 0; P.hipY = 0.5; P.pp = 0.12; P.sp = 0.32; P.hp = 0.38;
  P.lfR = P.pp; P.lkR = Math.PI / 2 + 0.25; P.lfL = Math.PI / 2 + P.pp - 0.05; P.lkL = Math.PI / 2 - 0.05; P.loL = 0.12; P.loR = 0.04;
  P.ikL = P.ikR = 1;
  P.txL = 0.14; P.tyL = 0.46; P.tzL = 0.5; P.txR = -0.12; P.tyR = 0.36 + 0.03 * Math.sin(2 * t); P.tzR = 0.46;
  P.skP = 0.9; P.skL = 0.7;
  return P;
}
/** Lying on the back in a bed: the root is on the mattress at the feet, the head toward −z. */
export function poseLie(P: Pose, t: number, sd: number) {
  poseNeutral(P);
  P.ground = 0; P.lie = 1; P.hp = 0.26; P.hy = 0.25 * Math.sin(0.13 * t + sd); P.sp = 0.012 * Math.sin(1.4 * t + sd);
  P.afL = P.afR = -0.08; P.aoL = P.aoR = 0.15; P.aeL = P.aeR = 0.22; P.lfL = P.lfR = -0.1; P.lkL = P.lkR = 0.08; P.loL = P.loR = 0.05;
  return P;
}
/** Sitting on the floor after a fall: legs forward, one knee up, a hand on the floor behind. */
export function poseFloor(P: Pose) {
  poseNeutral(P);
  P.ground = 0; P.hipY = 0.13; P.pp = -0.25; P.sp = 0.1; P.hp = -0.05; P.hy = 0.25;
  P.lfL = 1.45 + P.pp; P.lkL = -0.1; P.loL = 0.1;
  P.lfR = 2.2 + P.pp; P.lkR = 1.39; P.loR = 0.12;
  P.ikL = P.ikR = 1; P.txL = 0.14; P.tyL = 0.42; P.tzL = 0.3; P.txR = -0.26; P.tyR = 0.03; P.tzR = -0.24;
  P.skP = 1.2; P.skL = 0.7;
  return P;
}

// ================================================================= the crowd
export type HumanLook = {
  fem: boolean; skin: number; top: number; bottom: number; hair: number; shoe: number; accent: number; sleeve: number; accent2: number;
  styles: Style[]; girth?: number; height?: number; head?: number;
};
const _c = new THREE.Color(), _c2 = new THREE.Color();
const F = Array.from({ length: NB }, () => new THREE.Matrix4());
const _a = new THREE.Matrix4(), _b = new THREE.Matrix4(), _inv = new THREE.Matrix4(), _root = new THREE.Matrix4(), _lie = new THREE.Matrix4();
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _Y = new THREE.Vector3(0, 1, 0);
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
_lie.makeRotationX(-Math.PI / 2).premultiply(new THREE.Matrix4().makeTranslation(0, DIM.back, 0));
function frame(out: THREE.Matrix4, parent: THREE.Matrix4 | null, tx: number, ty: number, tz: number, rx: number, ry: number, rz: number, order: THREE.EulerOrder) {
  _e.set(rx, ry, rz, order); _a.makeRotationFromEuler(_e); _a.setPosition(tx, ty, tz);
  if (parent) out.multiplyMatrices(parent, _a); else out.copy(_a);
}
const UA = DIM.uarm, FB = DIM.farm + DIM.hand;
// 2-bone arm IK in the chest frame: D = target − shoulder → [θ forward, φ outward(+x), elbow]
const _ik = [0, 0, 0];
function solveArm(dx: number, dy: number, dz: number) {
  const d = Math.min(UA + FB - 1e-3, Math.max(0.1, Math.hypot(dx, dy, dz)));
  const n = Math.hypot(dx, dy, dz) || 1;
  const thD = Math.atan2(dz, -dy), phi = Math.asin(Math.max(-1, Math.min(1, dx / n)));
  const e = Math.PI - Math.acos(Math.max(-1, Math.min(1, (UA * UA + FB * FB - d * d) / (2 * UA * FB))));
  const al = Math.acos(Math.max(-1, Math.min(1, (UA * UA + d * d - FB * FB) / (2 * UA * d))));
  _ik[0] = thD - al; _ik[1] = phi; _ik[2] = e;
}
// hand position (chest frame) of an arm with R = Rx(−θ)·Rz(φ), elbow Rx(−e)
function armHand(sx: number, sy: number, th: number, ph: number, e: number, out: THREE.Vector3) {
  const sp = Math.sin(ph), cp = Math.cos(ph), st = Math.sin(th), ct = Math.cos(th), se = Math.sin(e), ce = Math.cos(e);
  out.set(sx + UA * sp + FB * ce * sp, sy - UA * cp * ct + FB * (-ce * cp * ct + se * st), UA * cp * st + FB * (ce * cp * st + se * ct));
  return out;
}

export type CrowdOpts = { transparent?: boolean; shadow?: boolean; roughness?: number };
export class HumanCrowd {
  readonly mesh: THREE.InstancedMesh;
  readonly n: number;
  readonly material: THREE.MeshStandardMaterial;
  /** per person: long robe (shorter stride), female, height factor */
  readonly robe: Uint8Array; readonly fem: Uint8Array; readonly height: Float32Array;
  private girth: Float32Array; private headS: Float32Array;
  private data: Float32Array; private tex: THREE.DataTexture; private base: Float32Array;
  private depth: THREE.MeshDepthMaterial;
  private last = -1;

  constructor(n: number, o: CrowdOpts = {}) {
    this.n = n = Math.max(1, n);
    this.data = new Float32Array(TW * n * 4);
    this.tex = new THREE.DataTexture(this.data, TW, n, THREE.RGBAFormat, THREE.FloatType);
    this.tex.needsUpdate = true;
    this.base = new Float32Array(n * 8 * 3);
    this.robe = new Uint8Array(n); this.fem = new Uint8Array(n); this.height = new Float32Array(n).fill(1);
    this.girth = new Float32Array(n).fill(1); this.headS = new Float32Array(n).fill(1);
    const u = { value: this.tex as THREE.Texture };
    this.material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: o.roughness ?? 0.8, metalness: 0, transparent: !!o.transparent });
    this.material.onBeforeCompile = (s) => patch(s, u, true);
    this.material.customProgramCacheKey = () => "human-kit-1";
    this.depth = new THREE.MeshDepthMaterial();
    this.depth.onBeforeCompile = (s) => patch(s, u, false);
    this.depth.customProgramCacheKey = () => "human-kit-depth-1";
    this.mesh = new THREE.InstancedMesh(humanGeometry(), this.material, n);
    this.mesh.customDepthMaterial = this.depth;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = o.shadow !== false; this.mesh.receiveShadow = true;
    this.mesh.raycast = () => {};
    for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, ZERO); this.data[(i * TW + INFO) * 4 + 2] = 1; }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  /** Dress person i. */
  setLook(i: number, L: HumanLook) {
    const cols = [L.skin, L.top, L.bottom, L.hair, L.shoe, L.accent, L.sleeve, L.accent2];
    for (let z = 0; z < 8; z++) { _c.setHex(cols[z]); this.base.set([_c.r, _c.g, _c.b], (i * 8 + z) * 3); }
    let lo = 0, hi = 0;
    for (const s of L.styles) { const b = STY[s]; if (b <= 24) lo += 2 ** (b - 1); else hi += 2 ** (b - 25); }
    if (!L.styles.includes(L.fem ? "female" : "male")) lo += 2 ** ((L.fem ? STY.female : STY.male) - 1);
    if (L.styles.some((x) => x === "short" || x === "long" || x === "bun")) hi += 2 ** (STY.hair - 25);
    const o = (i * TW + INFO) * 4;
    this.data[o] = lo; this.data[o + 1] = hi;
    this.robe[i] = L.styles.includes("robe") ? 1 : 0; this.fem[i] = L.fem ? 1 : 0;
    this.girth[i] = L.girth ?? 1; this.height[i] = L.height ?? 1; this.headS[i] = L.head ?? 1;
    this.tint(i, null, 0);
  }
  /** Highlight (hover / selection): the clothes blend toward `col` by k; null restores. */
  tint(i: number, col: THREE.Color | null, k: number) {
    for (let z = 0; z < 8; z++) {
      const b = (i * 8 + z) * 3, o = (i * TW + PAL + z) * 4;
      _c2.setRGB(this.base[b], this.base[b + 1], this.base[b + 2]);
      if (col && k > 0 && (z === ZONE.top || z === ZONE.sleeve || z === ZONE.bottom || z === ZONE.accent)) _c2.lerp(col, k);
      this.data[o] = _c2.r; this.data[o + 1] = _c2.g; this.data[o + 2] = _c2.b; this.data[o + 3] = 1;
    }
    this.tex.needsUpdate = true;
  }
  /** Opacity of person i (needs a transparent crowd). */
  alpha(i: number, a: number) { this.data[(i * TW + INFO) * 4 + 2] = a; }
  hide(i: number) { this.mesh.setMatrixAt(i, ZERO); this.mesh.instanceMatrix.needsUpdate = true; }

  /** Pose person i: root on the floor at (x, y, z) facing yaw (+z forward when yaw = 0), uniform scale s (× the person's height). */
  write(i: number, x: number, y: number, z: number, yaw: number, s: number, P: Pose) {
    const hs = s * this.height[i];
    _q.setFromAxisAngle(_Y, yaw);
    _root.compose(_v.set(x, y, z), _q, _w.set(hs, hs, hs));
    this.mesh.setMatrixAt(i, s <= 1e-4 ? ZERO : _root);
    this.last = i;
    const g = this.girth[i], fem = this.fem[i] === 1, [shx0, shy] = fem ? SHOULDER.f : SHOULDER.m, shx = shx0 * (0.9 + 0.1 * g);
    frame(F[0], null, P.dx, P.hipY, P.dz, P.pp, P.py, P.pr, "YXZ");
    frame(F[1], F[0], 0, DIM.waist, 0, P.sp, P.sy, P.sr, "YXZ");
    frame(F[2], F[1], 0, fem ? DIM.neck - 0.012 : DIM.neck, 0.012, P.hp, P.hy, P.hr, "YXZ");
    // arms (IK toward the hand targets when asked, blended by the weight)
    for (const side of [1, -1]) {
      const L = side > 0;
      let th = L ? P.afL : P.afR, ph = side * (L ? P.aoL : P.aoR), el = L ? P.aeL : P.aeR;
      const w = L ? P.ikL : P.ikR;
      if (w > 0.001) {
        _inv.copy(F[1]).invert();
        const tx = L ? P.txL : P.txR, ty = L ? P.tyL : P.tyR, tz = L ? P.tzL : P.tzR;
        _v.set(tx, ty, tz).applyMatrix4(_inv);
        const gx = _v.x, gy = _v.y, gz = _v.z;
        let ax = gx, ay = gy, az = gz;
        for (let it = 0; it < 3; it++) {
          solveArm(ax - side * shx, ay - shy, az);
          armHand(side * shx, shy, _ik[0], _ik[1], _ik[2], _w);
          ax += gx - _w.x; ay += gy - _w.y; az += gz - _w.z;
        }
        th += (_ik[0] - th) * w; ph += (_ik[1] - ph) * w; el += (_ik[2] - el) * w;
      }
      const ua = L ? BONE.uarmL : BONE.uarmR, fa = L ? BONE.farmL : BONE.farmR;
      frame(F[ua], F[1], side * shx, shy, 0, -th, 0, ph, "XZY");
      frame(F[fa], F[ua], 0, -DIM.uarm, 0, -el, 0, 0, "XYZ");
    }
    const hx = 0.09 * g * (fem ? 1.05 : 1);
    frame(F[BONE.thighL], F[0], hx, 0, 0, -P.lfL, 0, P.loL, "XZY");
    frame(F[BONE.shinL], F[BONE.thighL], 0, -DIM.thigh, 0, P.lkL, 0, 0, "XYZ");
    frame(F[BONE.thighR], F[0], -hx, 0, 0, -P.lfR, 0, -P.loR, "XZY");
    frame(F[BONE.shinR], F[BONE.thighR], 0, -DIM.thigh, 0, P.lkR, 0, 0, "XYZ");
    frame(F[BONE.skirt], F[0], 0, 0, 0, -P.skP, 0, 0, "XYZ");
    // feet on the floor: drop (or lift) the whole body so the lowest sole point is at y = 0
    if (P.ground > 0.001) {
      let lo = Infinity;
      for (const b of [BONE.shinL, BONE.shinR]) {
        const e = F[b].elements;
        for (const pz of [-0.065, 0.19]) lo = Math.min(lo, e[1] * 0 + e[5] * -0.492 + e[9] * pz + e[13]);
      }
      const d = -lo * P.ground;
      for (let b = 0; b < NB; b++) F[b].elements[13] += d;
    }
    if (P.lie > 0.5) for (let b = 0; b < NB; b++) F[b].premultiply(_lie);
    // bone matrices (frames × the person's build) → texture row
    const row = i * TW * 4, d = this.data, fw = fem ? 1.07 : 1, lg = 0.93 + 0.07 * g, ag = 0.92 + 0.08 * g;
    for (let b = 0; b < NB; b++) {
      _b.copy(F[b]);
      if (b === BONE.pelvis) _b.scale(_w.set(g * fw, 1, g));
      else if (b === BONE.chest) _b.scale(_w.set(g, 1, g * 0.97 + 0.03));
      else if (b === BONE.head) { const k = this.headS[i]; if (k !== 1) _b.scale(_w.set(k, k, k)); }
      else if (b === BONE.skirt) _b.scale(_w.set(g * fw, P.skL, g));
      else if (b >= BONE.thighL) _b.scale(_w.set(lg, 1, lg));
      else _b.scale(_w.set(ag, 1, ag));
      _b.toArray(d, row + b * 16);
    }
    this.tex.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  /** A point given in a bone's frame of the LAST written person → the crowd's parent space (mesh space). */
  point(out: THREE.Vector3, bone: number, lx: number, ly: number, lz: number) {
    return out.set(lx, ly, lz).applyMatrix4(F[bone]).applyMatrix4(_root);
  }
  /** A matrix in a bone's frame of the LAST written person (accessories: phone in hand, tablet, glasses…) → mesh space. */
  attach(out: THREE.Matrix4, bone: number, lx = 0, ly = 0, lz = 0, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz); _a.makeRotationFromEuler(_e); _a.setPosition(lx, ly, lz);
    return out.multiplyMatrices(_root, _b.multiplyMatrices(F[bone], _a));
  }
  /** Follow a floor material's fade (opacity, transparency, depth write). */
  sync(m: THREE.Material) {
    const t = this.material;
    if (t.transparent !== m.transparent) { t.transparent = m.transparent; t.needsUpdate = true; }
    t.opacity = m.opacity; t.depthWrite = m.depthWrite; t.visible = m.visible;
  }
  get lastWritten() { return this.last; }
  dispose() { this.tex.dispose(); this.material.dispose(); this.depth.dispose(); this.mesh.dispose(); }
}

// ================================================================= wardrobes
export type Garb = "patient" | "medecin" | "infirmier" | "aide" | "admin" | "technique" | "cadre" | "direction" | "cleaning" | "porter" | "visitor" | "office";
export const SKINS = [0xefd3bb, 0xe7c3a4, 0xdcb08f, 0xd2a07c, 0xc48d69, 0xb07a57, 0x9a6546, 0x7e5137, 0x64412d];
const HAIRS = [0x1b1614, 0x231b17, 0x2c211b, 0x382a21, 0x4a3829, 0x5b4636];
const GREY = [0x7d746c, 0xa29a91, 0xbdb6ad];
// headscarf colours: clearly fabric (no skin-like beige, no pale grey that reads as a bald head)
const HIJABS = [0x8a9bb5, 0x6f5d6d, 0x2e3548, 0x7b2f3b, 0x3f6e66, 0xb7774e, 0x26272c, 0x9a7f9e, 0x5d6b8a, 0x4f6f8f, 0x8c3b4a, 0x5e6b45, 0xa45a52, 0x34495e];
const CASUAL = [0xd9773a, 0x2f5da8, 0xefefeb, 0x8d9096, 0xb9bcc2, 0xb8433b, 0x3f7f55, 0x27324a, 0xcdbb9a, 0x6b6e45, 0x7a2e36, 0xc99a3b, 0x2e7a7a, 0x7fa7cf, 0x2a2b2f, 0xd69aa0, 0x5b4a6e, 0xe9e4da];
const JEANS = [0x3b5578, 0x2e4463, 0x4c6b92, 0x5d7ca3, 0x24262b, 0xbda985, 0xa8946e, 0x5c6068, 0x2b2d33, 0x5e4a3a];
const SHOES = [0xededea, 0x1e1f22, 0x5a3e2b, 0x7d8087, 0x9c7a55, 0x2a2c31, 0xe3e1dc];
const DJELLABA = [0xe9e3d6, 0xc9bda6, 0x8d8a7a, 0x5b6376, 0x7d6a58, 0xb9b2a5, 0x6f7f77, 0x3e4a63, 0x8e6e8c, 0x5e7d6a, 0xd7c9b0];

function rng(seed: number) { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length) % a.length];
export function shade(c: number, k: number) { _c.setHex(c); _c.multiplyScalar(k); return _c.getHex(); }
export function hex(c: string) { return parseInt(c.replace("#", ""), 16); }

export type DressOpts = { fem?: boolean; skin?: number; hair?: number | null; hijab?: boolean; robe?: boolean; gown?: boolean; kid?: boolean; old?: boolean };
/** A complete look for a garb (role) and a seed: Moroccan hospital realism, calm colours; varied casual for visitors. */
export function dress(garb: Garb, seed: number, o: DressOpts = {}): HumanLook {
  const r = rng(seed + 17);
  const nurseLike = garb === "infirmier" || garb === "aide" || garb === "cleaning";
  const fem = o.fem ?? (o.hijab ? true : r() < (nurseLike ? 0.66 : garb === "technique" || garb === "porter" ? 0.18 : garb === "direction" || garb === "cadre" ? 0.4 : 0.5));
  const old = o.old ?? (garb === "visitor" || garb === "patient" ? r() < 0.22 : r() < 0.06);
  const skin = o.skin ?? pick(SKINS.slice(0, 7), r);
  const hairC = o.hair === null ? pick(HAIRS, r) : o.hair ?? (old ? pick(GREY, r) : pick(HAIRS, r));
  const styles: Style[] = [];
  const hijab = o.hijab ?? (fem && !o.kid && r() < (garb === "visitor" || garb === "patient" ? 0.5 : garb === "cleaning" || garb === "aide" ? 0.55 : 0.36));
  let hair = hairC;
  // hair / head
  if (hijab) { styles.push("hijab", "drape"); hair = pick(HIJABS, r); }
  else if (fem) styles.push(o.kid ? (r() < 0.5 ? "long" : "bun") : pick<Style>(["long", "long", "bun", "bun", "short", "curly"], r));
  else {
    if (!(old && r() < 0.25)) styles.push(r() < 0.24 ? "curly" : "short"); else styles.push("short");
    if (!o.kid && r() < (old ? 0.55 : 0.3)) styles.push("beard");
  }
  let top = 0, bottom = 0, shoe = pick(SHOES, r), accent = skin, accent2 = 0x2e3240, sleeve = 0;
  let longSleeve = true;
  const casual = () => {
    const robe = o.robe ?? (!o.kid && r() < (fem ? 0.16 : 0.11));
    if (robe) {
      top = bottom = pick(DJELLABA, r); styles.push("robe"); if (r() < 0.6) styles.push("hood");
      if (!fem && old && r() < 0.5 && styles.includes("short")) { styles.splice(styles.indexOf("short"), 1); styles.push("kufi"); }
      shoe = pick([0xd8c49a, 0xe9e3d6, 0x5a3e2b, 0x8c6b48], r); return;
    }
    top = pick(CASUAL, r); bottom = pick(JEANS, r);
    const k = r();
    if (k < 0.3) { styles.push("vneck"); accent = skin; longSleeve = fem || r() < 0.3; }                       // t-shirt
    else if (k < 0.48) { styles.push("collar"); accent = shade(top, 0.92); longSleeve = r() < 0.4; }          // polo
    else if (k < 0.68) { styles.push("collar"); accent = top; }                                               // shirt
    else if (k < 0.85) { styles.push("open", "buttons"); accent = pick([0xefefeb, 0x8d9096, 0x2a2b2f, 0xcdbb9a], r); } // jacket / cardigan
    else { styles.push("stripe"); accent2 = pick([0xefefeb, 0x2a2b2f, 0xc99a3b], r); longSleeve = r() < 0.5; } // sport top
    if (fem && !o.kid && r() < (hijab ? 0.45 : 0.25)) styles.push("skirt");
    if (fem && hijab) longSleeve = true;
  };
  switch (garb) {
    case "medecin":
      top = 0xf3f4f6; accent = pick([0xbfd0e6, 0xe8eaee, 0xc9d6cf, 0xdccfe0, 0x9fb6d6], r); bottom = pick([0x3e465a, 0x2f3447, 0x5c6068, 0x4a5368], r);
      styles.push("open", "coat", "pocket"); if (!fem && r() < 0.5) { styles.push("tie"); accent2 = pick([0x3a4a6b, 0x6b3b3b, 0x2e3a4e, 0x4d5a40], r); }
      if (r() < 0.6) styles.push("badge"); shoe = pick([0x1e1f22, 0x5a3e2b, 0x2a2c31, 0xededea], r);
      if (fem && r() < 0.15) styles.push("skirt");
      break;
    case "infirmier": case "aide": case "cleaning": case "porter": {
      const pal = garb === "infirmier" ? [0x3e9a92, 0x4fa79e, 0x2f7f7a, 0x2f4a75, 0x33496e] : garb === "aide" ? [0x9cc9a5, 0xa9cbe0, 0xbfd8c4, 0xb8c9e8]
        : garb === "cleaning" ? [0x8fb6d6, 0xa7adb5, 0x9db7cf] : [0x7f9bb5, 0x9aa6b4, 0x6e8aa6];
      top = pick(pal, r); bottom = garb === "porter" || (garb === "cleaning" && r() < 0.4) ? pick([0x2f3a52, 0x3b465e], r) : shade(top, 0.9);
      styles.push("vneck"); accent = hijab ? 0xe8eaee : r() < 0.25 ? 0xeef0f2 : skin; longSleeve = hijab;
      if (r() < 0.55 && garb !== "cleaning") styles.push("badge");
      shoe = pick([0xf0f1f3, 0xe3e5e8, 0xa9b0b8, 0x3a3f4a], r);
      break;
    }
    case "admin":
      if (fem && r() < 0.3) { top = pick([0x7c93d6, 0x5d6b8a, 0xb9a8d8, 0xcdbb9a, 0x8d9096], r); accent = pick([0xefefeb, 0xe3d6cf, 0xc9d3e6], r); styles.push("open", "buttons"); }
      else { top = pick([0x7c93d6, 0xa9bce0, 0xefefeb, 0xd8d2c4, 0xc9d3e6, 0xb7c4d9, 0xe3d6cf, 0x5f79c4], r); accent = top; styles.push("collar"); longSleeve = r() < 0.75; }
      bottom = pick([0x2f3447, 0x3e465a, 0x5c6068, 0x8e8572, 0x24262b], r); if (r() < 0.6) styles.push("badge");
      if (fem && r() < 0.3) styles.push("skirt"); shoe = pick([0x1e1f22, 0x5a3e2b, 0x2a2c31], r);
      break;
    case "technique":
      top = pick([0xd6b47c, 0xc9a46a, 0xb89a68, 0x2f3b66, 0x5e6b57, 0x8c8f96], r); accent = shade(top, 0.9); styles.push("collar", "belt");
      longSleeve = r() < 0.3; bottom = pick([0x3b3a36, 0x5c5a52, 0x2f3447, 0x6e675b], r); accent2 = 0x2e2f35; shoe = pick([0x2a2c31, 0x5a3e2b, 0x3a3836], r);
      if (!fem && !hijab && r() < 0.15) { styles.push("cap"); accent = pick([0x3e4556, 0x2f3b66, 0x5e6b57], r); }
      break;
    case "cadre": case "direction": case "office": {
      const suit = garb === "direction" ? pick([0x262c3d, 0x2d2f36, 0x34394a], r) : pick([0x3a3f4e, 0x4a4f5e, 0x2e3548, 0x5a4e44, 0x3f4a5a], r);
      top = suit; bottom = garb === "office" && r() < 0.4 ? pick(JEANS.slice(4), r) : suit; styles.push("open", "buttons");
      accent = garb === "cadre" ? pick([0xb9a8d8, 0xefefeb, 0xc9d6e8, 0xd9d0e6], r) : pick([0xf3f4f7, 0xc9d6e8, 0xefefeb], r);
      if (!fem && r() < (garb === "office" ? 0.4 : 0.65)) { styles.push("tie"); accent2 = garb === "direction" ? pick([0xc9a85a, 0x2e3a4e, 0x6b3b3b], r) : pick([0x5a4a7a, 0x2e3a4e, 0x7a3b3b, 0x4d5a40], r); }
      if (fem && !hijab && r() < 0.4) { styles.push("scarf"); accent2 = garb === "direction" ? 0xc9a85a : pick([0xa88fd0, 0xb38d7e, 0x8a9bb5], r); }
      if (garb !== "office" && r() < 0.4) styles.push("badge");
      if (fem && r() < 0.3) styles.push("skirt"); shoe = pick([0x1e1f22, 0x3a2a20, 0x2a2c31], r);
      break;
    }
    case "patient":
      if (o.gown ?? r() < 0.6) { top = pick([0xbacde1, 0xb5c7da, 0xc3d2e2], r); bottom = shade(top, 0.95); styles.push("vneck"); accent = skin; longSleeve = false; }
      else { top = pick([0xb5bbc8, 0x9fb4c9, 0xc8c2b5, 0xa9b7a6, 0xc9b8c4], r); bottom = top; styles.push("collar"); accent = shade(top, 1.08); if (r() < 0.5) { styles.push("stripe"); accent2 = shade(top, 0.82); } }
      shoe = pick([0xc9cbd0, 0xd8d2c8, 0x8f96a3], r);
      break;
    default: casual();
  }
  if (o.robe && garb !== "visitor") { if (!styles.includes("robe")) styles.push("robe"); top = bottom = o.gown ? top : pick(DJELLABA, r); }
  sleeve = longSleeve ? top : skin;
  const girth = o.kid ? 0.9 : 0.94 + r() * 0.12 + (old ? 0.04 : 0);
  const height = o.kid ? 1 : (fem ? 0.94 : 1) * (0.97 + r() * 0.06);
  return { fem, skin, top, bottom, hair, shoe, accent, sleeve, accent2, styles, girth, height, head: o.kid ? 1.28 : 1 };
}
