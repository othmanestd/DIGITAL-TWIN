// Reusable prop builders (pure). Each one draws an item in the frame it is given: x right, z forward (the side you face
// the item from), y up from the floor. Proportions are real-world metres; low poly, calm materials.
import { C, BINDERS, rng, type Frame, type Seat } from "./kit";
import { P, S, SIGN_UV, type UV } from "./atlas";

const PI = Math.PI;

// ================================================================= greenery
export function plant(f: Frame, s = 1, kind: "round" | "tall" | "snake" | "olive" = "round", pot = C.pot) {
  f.add("cone", "satin", pot, 0, 0.2 * s, 0, 0.42 * s, 0.4 * s, 0.42 * s, { t: 1.22 });
  f.cyl("matte", C.soil, 0, 0.395 * s, 0, 0.48 * s, 0.015);
  if (kind === "round") {
    f.sph("matte", C.leaf, 0, 0.78 * s, 0, 0.78 * s, 0.66 * s, 0.78 * s);
    f.sph("matte", C.leafDark, 0.16 * s, 0.98 * s, -0.08 * s, 0.5 * s, 0.46 * s, 0.5 * s);
    f.sph("matte", C.leafLight, -0.15 * s, 0.92 * s, 0.13 * s, 0.44 * s, 0.4 * s, 0.44 * s);
  } else if (kind === "tall" || kind === "olive") {
    const leaf = kind === "olive" ? 0x9fb08f : C.leaf, dark = kind === "olive" ? 0x84987a : C.leafDark;
    f.cyl("matte", C.teak, 0, 0.85 * s, 0, 0.05 * s, 1.0 * s);
    f.sph("matte", leaf, 0, 1.45 * s, 0, 0.75 * s, 0.6 * s, 0.75 * s);
    f.sph("matte", dark, 0.2 * s, 1.75 * s, 0.05 * s, 0.55 * s, 0.5 * s, 0.55 * s);
    f.sph("matte", leaf, -0.18 * s, 1.95 * s, -0.06 * s, 0.45 * s, 0.4 * s, 0.45 * s);
    f.sph("matte", dark, -0.12 * s, 1.25 * s, 0.2 * s, 0.4 * s, 0.32 * s, 0.4 * s);
  } else {
    const r = rng(Math.round(f.x * 97 + f.z * 13));
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * PI * 2, h = (0.55 + r() * 0.45) * s;
      f.box("matte", i % 3 ? C.leafDark : C.leaf, Math.sin(a) * 0.07 * s, 0.4 * s + h / 2, Math.cos(a) * 0.07 * s, 0.075 * s, h, 0.018, { yaw: a, pitch: 0.12 * Math.cos(a * 2) });
    }
  }
}
/** small desk plant */
export function deskPlant(f: Frame, lx: number, y: number, lz: number) {
  f.cyl("satin", C.white, lx, y + 0.05, lz, 0.1, 0.1);
  f.sph("matte", C.leaf, lx, y + 0.15, lz, 0.17, 0.13, 0.17);
}

// ================================================================= bins, hygiene, safety
/** pedal bin for household waste (grey) */
export function pedalBin(f: Frame, lx = 0, lz = 0, col: number = C.light) {
  f.cyl("satin", col, lx, 0.21, lz, 0.3, 0.42);
  f.cyl("satin", C.grey, lx, 0.435, lz, 0.31, 0.03);
  f.box("satin", C.dark, lx, 0.03, lz + 0.16, 0.12, 0.025, 0.06);
}
/** medical waste bin (DASRI, yellow) */
export function wasteBin(f: Frame, lx = 0, lz = 0) {
  f.rbox("satin", C.yellow, lx, 0.27, lz, 0.38, 0.54, 0.38);
  f.box("satin", 0xc9a84a, lx, 0.555, lz, 0.4, 0.035, 0.4);
  f.box("satin", C.dark, lx, 0.03, lz + 0.2, 0.12, 0.025, 0.06);
}
/** sharps container (yellow body, coral lid) */
export function sharps(f: Frame, lx: number, y: number, lz: number, s = 1) {
  f.box("satin", C.yellow, lx, y + 0.1 * s, lz, 0.16 * s, 0.2 * s, 0.12 * s);
  f.box("satin", C.coral, lx, y + 0.215 * s, lz, 0.165 * s, 0.03 * s, 0.125 * s);
}
/** wall hand sanitiser (dispenser y = centre height) */
export function sanitiser(f: Frame, lx: number, y: number, lz = 0.05) {
  f.rbox("satin", C.white, lx, y, lz, 0.11, 0.22, 0.09);
  f.box("satin", C.medBlue, lx, y - 0.07, lz + 0.046, 0.06, 0.03, 0.01);
}
/** wall glove-box holder with three boxes (S, M, L) */
export function gloveBoxes(f: Frame, lx: number, y: number, lz = 0.06) {
  f.box("metal", C.steel, lx, y, lz - 0.01, 0.4, 0.3, 0.02);
  const cols = [0x9fb3d9, 0xb3a3d0, 0xa9cdbf];
  for (let i = 0; i < 3; i++) {
    f.box("satin", C.white, lx + (i - 1) * 0.13, y, lz + 0.05, 0.12, 0.26, 0.09);
    f.box("satin", cols[i], lx + (i - 1) * 0.13, y + 0.05, lz + 0.096, 0.1, 0.1, 0.004);
  }
}
/** paper towel dispenser */
export function towelDispenser(f: Frame, lx: number, y: number, lz = 0.06) {
  f.rbox("satin", C.white, lx, y, lz, 0.28, 0.34, 0.12);
  f.box("matte", C.paper, lx, y - 0.18, lz + 0.03, 0.18, 0.04, 0.01);
}
/** wall-mounted fire extinguisher (top under 1 m, visible in every view) */
export function extinguisher(f: Frame, lx = 0, lz = 0.11) {
  f.box("metal", C.dark, lx, 0.6, lz - 0.08, 0.08, 0.36, 0.02);
  f.cyl("satin", C.red, lx, 0.62, lz, 0.16, 0.5);
  f.sph("satin", C.red, lx, 0.87, lz, 0.16, 0.1, 0.16);
  f.box("metal", C.dark, lx, 0.94, lz, 0.05, 0.07, 0.05);
  f.box("metal", C.dark, lx + 0.04, 0.98, lz, 0.12, 0.02, 0.03);
  f.box("satin", C.ink, lx - 0.07, 0.75, lz + 0.03, 0.02, 0.3, 0.02, { roll: 0.25 });
  f.box("matte", C.white, lx, 0.6, lz + 0.081, 0.09, 0.12, 0.002);
}
/** AED cabinet (pictogram only) */
export function aed(f: Frame, lx = 0, y = 1.35, lz = 0.09) {
  f.box("satin", C.white, lx, y, lz, 0.42, 0.48, 0.17);
  f.box("satin", C.aed, lx, y, lz + 0.086, 0.36, 0.42, 0.004);
  f.quad("print", P.aed, lx, y + 0.04, lz + 0.09, 0.22, 0.22);
}
/** wall clock: ticks only, no numerals */
export function clock(f: Frame, lx = 0, y = 2.35, lz = 0.03, d = 0.34) {
  f.cylZ("satin", C.dark, lx, y, lz, d, 0.05);
  f.quad("print", P.clock, lx, y, lz + 0.027, d * 0.9, d * 0.9);
  f.box("matte", C.ink, lx - 0.03, y + 0.035, lz + 0.03, 0.012, 0.1, 0.004, { roll: 0.95 });
  f.box("matte", C.ink, lx + 0.04, y + 0.05, lz + 0.032, 0.01, 0.13, 0.004, { roll: -0.7 });
}
/** department sign plate on a wall (name from lib/hospital) */
export function signPlate(f: Frame, dept: string, lx = 0, y = 2.05, lz = 0.02, w = 0.92) {
  f.box("satin", C.navy, lx, y, lz, w + 0.02, w * 0.2 + 0.02, 0.02);
  f.quad("print", SIGN_UV(dept), lx, y, lz + 0.012, w, w * 0.219);
}
/** projecting double-sided sign perpendicular to the wall (the frame's x axis runs along the corridor) */
export function flagSign(f: Frame, dept: string, lz = 0.36, y = 2.45) {
  const w = 0.72, h = w * 0.219;
  f.box("metal", C.steel, 0, y + h / 2 + 0.05, lz / 2, 0.03, 0.03, lz + 0.02);
  f.box("satin", C.navy, 0, y, lz, 0.03, h + 0.02, w + 0.02, {});
  f.quad("print", SIGN_UV(dept), 0.017, y, lz, w, h, { yaw: PI / 2 });
  f.quad("print", SIGN_UV(dept), -0.017, y, lz, w, h, { yaw: -PI / 2 });
}
/** emergency exit pictogram box (ceiling-hung, double sided) */
export function exitSign(f: Frame, y = 2.55) {
  f.box("satin", C.white, 0, y, 0, 0.42, 0.2, 0.05);
  f.quad("print", P.exit, 0, y, 0.027, 0.4, 0.19);
  f.quad("print", P.exit, 0, y, -0.027, 0.4, 0.19, { yaw: PI });
  f.box("metal", C.steel, 0, y + 0.2, 0, 0.02, 0.2, 0.02);
}
/** handrail running along local x from x0 to x1, against a wall at lz = 0 (rail sits 7 cm out) */
export function handrail(f: Frame, x0: number, x1: number, col = C.oak) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  if (len < 0.4) return;
  f.cylX("satin", col, cx, 0.9, 0.075, 0.05, len);
  f.box("satin", C.light, cx, 0.32, 0.012, len, 0.18, 0.02); // bumper guard
  const n = Math.max(2, Math.round(len / 1.3) + 1);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.08 + ((len - 0.16) * i) / (n - 1);
    f.box("metal", C.steel, x, 0.88, 0.035, 0.03, 0.06, 0.07);
  }
  f.cylX("satin", col, x0 + 0.02, 0.9, 0.05, 0.05, 0.04);
}
/** finished corridor wall along local x (x0 → x1), wall face at lz = 0: skirting, a soft wainscot panel; the
 *  wayfinding stripe in the department colour goes to the first-person layer */
export function wallFinish(f: Frame, x0: number, x1: number, stripe: number, hi: (fn: () => void) => void) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  if (len < 0.3) return;
  f.box("satin", C.mid, cx, 0.05, 0.009, len, 0.1, 0.018);
  f.box("matte", 0xe3e8ef, cx, 0.55, 0.004, len, 0.9, 0.008);
  hi(() => f.box("matte", stripe, cx, 1.36, 0.005, len, 0.045, 0.01));
}
/** door frame (jambs, head) and the transom up to the dropped ceiling, for a gap of width w centred on the frame;
 *  first-person layer (the maquette walls are 1 m high). leaf: an open door leaf hinged at −x, swung toward +z. */
export function doorFrame(f: Frame, w: number, leaf = false, col: number = C.light) {
  f.box("matte", C.wall, 0, 2.58, 0, w + 0.02, 0.8, 0.12);
  for (const s of [-1, 1]) f.box("satin", col, s * (w / 2 - 0.03), 1.08, 0, 0.06, 2.16, 0.17);
  f.box("satin", col, 0, 2.17, 0, w, 0.06, 0.17);
  if (leaf) {
    const lw = w - 0.08;
    f.box("satin", C.oak, -w / 2 + 0.05, 1.05, 0.09 + lw / 2, 0.045, 2.08, lw);
    f.box("glass", C.glass, -w / 2 + 0.05, 1.45, 0.09 + lw * 0.7, 0.05, 0.6, 0.14);
    f.box("metal", C.chrome, -w / 2 + 0.1, 1.0, 0.09 + lw - 0.08, 0.03, 0.03, 0.14);
    f.box("metal", C.steel, -w / 2 + 0.05, 0.12, 0.09 + lw / 2, 0.05, 0.22, lw);
  }
}
/** notice board with pinned sheets */
export function noticeBoard(f: Frame, lx = 0, y = 1.55, lz = 0.02, w = 1.1, h = 0.8) {
  f.box("satin", C.oak, lx, y, lz, w + 0.05, h + 0.05, 0.03);
  f.quad("print", P.notice, lx, y, lz + 0.017, w, h);
}
export function poster(f: Frame, uv: UV, lx: number, y: number, lz: number, w: number, h: number, frame = C.white) {
  f.box("satin", frame, lx, y, lz, w + 0.03, h + 0.03, 0.015);
  f.quad("print", uv, lx, y, lz + 0.009, w, h);
}

// ================================================================= patient rooms
/** technical headwall behind a bed head (frame centred behind the head, facing the bed): stands on the floor */
export function headwall(f: Frame, icu = false) {
  f.box("satin", C.mist, 0, 0.9, 0, 1.6, 1.8, 0.07);
  f.box("satin", C.white, 0, 1.47, 0.06, 1.58, 0.24, 0.06);           // trunking (the existing panel sits just in front)
  const outlets: [number, number][] = [[-0.62, C.white], [-0.5, C.light], [-0.38, C.yellow], [0.38, C.white], [0.5, C.light]];
  for (const [x, col] of outlets) {
    f.cylZ("metal", C.chrome, x, 1.25, 0.06, 0.06, 0.05);
    f.cylZ("satin", col, x, 1.25, 0.09, 0.045, 0.015);
  }
  for (const x of [-0.18, -0.06, 0.06, 0.18]) f.box("satin", C.white, x, 1.12, 0.045, 0.08, 0.08, 0.025);
  f.box("glow", C.ledGreen, 0.68, 1.6, 0.095, 0.03, 0.03, 0.01);
  // oxygen flowmeter with humidifier jar, suction canister
  f.box("metal", C.chrome, -0.5, 1.12, 0.12, 0.05, 0.1, 0.05);
  f.cyl("glass", C.water, -0.5, 0.98, 0.13, 0.07, 0.14);
  if (icu) { f.cyl("glass", C.glass, 0.5, 1.05, 0.13, 0.13, 0.2); f.cyl("satin", C.medBlue, 0.5, 1.17, 0.13, 0.14, 0.03); }
  // reading lamp on an arm
  f.box("metal", C.steel, 0.6, 1.72, 0.12, 0.03, 0.03, 0.22);
  f.add("cone", "satin", C.white, 0.6, 1.66, 0.24, 0.12, 0.08, 0.12, { t: 0.45 });
  f.box("glow", C.ledWhite, 0.6, 1.619, 0.24, 0.09, 0.004, 0.09);
}
/** nurse-call handset lying on the mattress edge, its cord running to the headwall */
export function nurseCall(f: Frame, side: number) {
  f.rbox("satin", C.light, 0.38 * side, 0.63, -0.5, 0.05, 0.03, 0.16);
  f.box("glow", C.ledAmber, 0.38 * side, 0.647, -0.55, 0.02, 0.004, 0.02);
  f.box("matte", C.grey, 0.42 * side, 0.64, -0.88, 0.008, 0.008, 0.62);
}
/** over-bed table beside the bed (frame at the column, top cantilevered toward +x), with water and a cup */
export function overbedTable(f: Frame, dir = 1) {
  f.box("metal", C.steel, 0, 0.04, 0, 0.12, 0.04, 0.42);
  f.box("metal", C.steel, dir * 0.25, 0.04, 0.18, 0.5, 0.04, 0.06);
  f.box("metal", C.steel, dir * 0.25, 0.04, -0.18, 0.5, 0.04, 0.06);
  f.box("metal", C.chrome, 0, 0.5, 0, 0.05, 0.9, 0.05);
  f.rbox("satin", C.wood, dir * 0.33, 0.96, 0, 0.82, 0.035, 0.42);
  // bottle, glass, tissues
  f.cyl("glass", C.bottle, dir * 0.12, 1.1, 0.08, 0.075, 0.24);
  f.cyl("satin", C.medBlue, dir * 0.12, 1.235, 0.08, 0.035, 0.03);
  f.cyl("glass", C.glass, dir * 0.27, 1.025, 0.1, 0.07, 0.095);
  f.box("matte", C.white, dir * 0.5, 1.02, -0.06, 0.22, 0.09, 0.12);
  f.box("matte", C.mint, dir * 0.5, 1.065, -0.06, 0.08, 0.004, 0.04);
}
/** wardrobe (frame at the front face centre, against a wall behind) */
export function wardrobe(f: Frame, w = 0.9, col = C.wood) {
  f.rbox("satin", col, 0, 1.0, -0.29, w, 2.0, 0.58);
  f.box("matte", 0xcfc4b3, 0, 1.0, 0.004, 0.012, 1.9, 0.01);
  f.box("metal", C.steel, -0.06, 1.05, 0.02, 0.02, 0.22, 0.02);
  f.box("metal", C.steel, 0.06, 1.05, 0.02, 0.02, 0.22, 0.02);
}
/** washbasin vanity with tap and soap; mirror, towel and soap dispensers above go to the high layer */
export function sinkUnit(f: Frame, hiPart?: (fn: () => void) => void) {
  f.rbox("satin", C.white, 0, 0.4, -0.24, 0.72, 0.8, 0.48);
  f.box("satin", C.light, 0, 0.82, -0.24, 0.76, 0.04, 0.5);
  f.cyl("satin", C.white, 0, 0.85, -0.22, 0.44, 0.05);
  f.cyl("matte", C.steel, 0, 0.876, -0.22, 0.36, 0.004);
  f.cyl("metal", C.chrome, 0, 0.92, -0.43, 0.04, 0.16);
  f.box("metal", C.chrome, 0, 0.99, -0.37, 0.025, 0.025, 0.14);
  f.cyl("satin", C.white, 0.27, 0.92, -0.42, 0.06, 0.16);
  f.cyl("metal", C.chrome, 0.27, 1.01, -0.42, 0.018, 0.03);
  const hi = () => {
    f.box("glass", C.glass, 0, 1.45, -0.475, 0.55, 0.65, 0.01);
    f.box("metal", C.chrome, 0, 1.45, -0.48, 0.58, 0.68, 0.006);
    towelDispenser(f, 0.55, 1.3, -0.43);
    sanitiser(f, -0.5, 1.15, -0.44);
  };
  if (hiPart) hiPart(hi); else hi();
}
/** upright visitor chair; registers its seat */
export function visitorChair(f: Frame, col: number = C.fabric) {
  for (const [x, z] of [[-0.2, -0.19], [0.2, -0.19], [-0.2, 0.19], [0.2, 0.19]] as const) f.box("satin", C.teak, x, 0.22, z, 0.035, 0.44, 0.035);
  f.rbox("matte", col, 0, 0.46, 0, 0.46, 0.06, 0.44);
  f.box("satin", C.teak, 0, 0.72, -0.21, 0.44, 0.04, 0.03);
  f.rbox("matte", col, 0, 0.68, -0.205, 0.42, 0.3, 0.05, { pitch: -0.08 });
  f.seat(0, 0.03, 0.49, "chair");
}
/** chart holder on the foot of a bed (bed frame: foot at +z) */
export function chartHolder(f: Frame) {
  f.box("satin", C.blueGrey, 0.22, 0.6, 1.105, 0.24, 0.3, 0.015);
  f.box("matte", C.paper, 0.22, 0.6, 1.114, 0.2, 0.25, 0.003);
  f.box("metal", C.chrome, 0.22, 0.73, 1.115, 0.08, 0.02, 0.01);
}
/** privacy curtain gathered on a ceiling rail, L-shaped around one side of the bed (bed frame) */
export function privacyCurtain(f: Frame, side: number) {
  const x = side * 1.2, rail = 2.62;
  f.box("metal", C.steel, x, rail, 0, 0.03, 0.025, 2.5);
  f.box("metal", C.steel, x / 2, rail, 1.25, Math.abs(x), 0.025, 0.03);
  f.box("metal", C.steel, x, rail + 0.2, -1.2, 0.015, 0.4, 0.015);
  for (let i = 0; i < 5; i++) {
    const z = -1.1 + i * 0.09;
    f.box("matte", i % 2 ? C.curtain : 0xbfcfd9, x + (i % 2 ? 0.03 : -0.03), 1.42, z, 0.06, 2.3, 0.1);
  }
  f.box("matte", 0xd7e3ea, x, 2.5, -0.92, 0.08, 0.12, 0.5);
}

// ================================================================= corridor equipment
export function linenCart(f: Frame) {
  for (const x of [-0.36, 0.36]) for (const z of [-0.22, 0.22]) {
    f.box("metal", C.steel, x, 0.55, z, 0.025, 1.0, 0.025);
    f.cyl("satin", C.dark, x, 0.04, z, 0.07, 0.05);
  }
  f.box("metal", C.steel, 0, 0.12, 0, 0.75, 0.025, 0.46);
  for (let k = 0; k < 3; k++) {
    f.box("metal", C.steel, 0, 0.42 + k * 0.32, 0, 0.75, 0.02, 0.46);
    for (let i = 0; i < 3; i++) f.rbox("matte", k === 1 && i === 1 ? C.medBlue : C.linen, -0.24 + i * 0.24, 0.48 + k * 0.32, 0, 0.22, 0.1 + (i % 2) * 0.04, 0.38);
  }
  f.rbox("matte", C.medBlue, 0, 0.66, 0.235, 0.74, 0.86, 0.015);
}
/** wheelchair (frame: facing +z, seat centre at the origin) */
export function wheelchair(f: Frame, col: number = C.navy) {
  for (const s of [-1, 1]) {
    f.add("torus", "satin", C.dark, s * 0.3, 0.3, -0.05, 0.6, 0.6, 0.6, { yaw: PI / 2, t: 0.07 });
    f.add("torus", "metal", C.chrome, s * 0.33, 0.3, -0.05, 0.5, 0.5, 0.5, { yaw: PI / 2, t: 0.03 });
    f.cyl("satin", C.dark, s * 0.2, 0.07, 0.28, 0.12, 0.04, { roll: PI / 2 });
    f.box("metal", C.chrome, s * 0.22, 0.32, 0.12, 0.025, 0.5, 0.025, { pitch: 0.3 });
    f.box("metal", C.chrome, s * 0.24, 0.92, -0.25, 0.025, 0.5, 0.025, { pitch: -0.1 });
    f.cylZ("satin", C.dark, s * 0.24, 1.0, -0.33, 0.035, 0.12);
    f.box("satin", col, s * 0.25, 0.68, -0.02, 0.05, 0.03, 0.36);
    f.box("satin", C.dark, s * 0.12, 0.08, 0.36, 0.14, 0.015, 0.1);
  }
  f.box("matte", col, 0, 0.5, 0, 0.44, 0.04, 0.42);
  f.box("matte", col, 0, 0.76, -0.22, 0.44, 0.42, 0.025, { pitch: -0.1 });
}
export function waterDispenser(f: Frame) {
  f.rbox("satin", C.white, 0, 0.5, 0, 0.32, 1.0, 0.32);
  f.cyl("glass", C.water, 0, 1.22, 0, 0.27, 0.42);
  f.cyl("satin", C.medBlue, 0, 1.0, 0, 0.12, 0.04);
  f.box("satin", C.light, 0, 0.82, 0.17, 0.2, 0.12, 0.04);
  f.box("satin", C.medBlue, -0.05, 0.8, 0.195, 0.03, 0.03, 0.02);
  f.box("satin", C.coral, 0.05, 0.8, 0.195, 0.03, 0.03, 0.02);
  f.cyl("satin", C.white, 0.21, 0.82, 0, 0.08, 0.3);
}
/** parking of wheelchairs side by side along local x */
export function wheelchairPark(f: Frame, n = 3) {
  for (let i = 0; i < n; i++) wheelchair(f.sub((i - (n - 1) / 2) * 0.66, 0), i === 1 ? C.blueGrey : C.navy);
}

// ================================================================= clinical
export function oxygenCylinders(f: Frame, n = 2) {
  f.box("metal", C.steel, 0, 0.05, 0, 0.18 * n + 0.1, 0.03, 0.24);
  f.box("metal", C.steel, 0, 0.55, -0.1, 0.18 * n + 0.1, 0.03, 0.03);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.19;
    f.cyl("satin", C.white, x, 0.52, 0, 0.15, 0.86);
    f.sph("satin", C.white, x, 0.95, 0, 0.15, 0.1, 0.15);
    f.cyl("metal", 0x8fa79a, x, 1.03, 0, 0.07, 0.1);
    f.cyl("metal", C.chrome, x, 1.1, 0, 0.04, 0.05);
  }
  for (const x of [-0.12 * n, 0.12 * n]) f.cyl("satin", C.dark, x, 0.04, 0.08, 0.07, 0.05, { roll: PI / 2 });
}
/** X-ray light box (negatoscope): wall-mounted or on a desk */
export function lightBox(f: Frame, lx: number, y: number, lz: number, w = 0.75) {
  f.box("satin", C.white, lx, y, lz, w, 0.5, 0.07);
  f.quad("screen", S.xray, lx - w / 4 + 0.02, y, lz + 0.037, w / 2 - 0.06, 0.42);
  f.quad("screen", S.xray, lx + w / 4 - 0.02, y, lz + 0.037, w / 2 - 0.06, 0.42);
}
/** wire shelving with consumables in boxes */
export function consumableShelf(f: Frame, w = 1.2, h = 1.8, seed = 1) {
  const r = rng(seed);
  for (const x of [-w / 2, w / 2]) for (const z of [-0.2, 0.2]) f.box("metal", C.chrome, x, h / 2, z, 0.025, h, 0.025);
  const cols = [C.white, C.medBlue, C.mint, C.white, 0xe8e1d4, C.gown];
  for (let k = 0; k < 5; k++) {
    const y = 0.12 + (k * (h - 0.2)) / 4;
    f.box("metal", C.chrome, 0, y, 0, w, 0.015, 0.42);
    if (k === 4) continue;
    let x = -w / 2 + 0.05;
    while (x < w / 2 - 0.15) {
      const bw = 0.16 + r() * 0.2, bh = 0.12 + r() * 0.16;
      if (x + bw > w / 2 - 0.04) break;
      if (r() > 0.15) f.box("satin", cols[Math.floor(r() * cols.length)], x + bw / 2, y + 0.008 + bh / 2, 0.02 - r() * 0.04, bw - 0.02, bh, 0.3);
      x += bw;
    }
  }
}
/** sterile instrument tray with instruments */
export function instrumentTray(f: Frame, lx: number, y: number, lz: number) {
  f.box("matte", C.medGreen, lx, y + 0.003, lz, 0.6, 0.006, 0.42);
  f.box("metal", C.chrome, lx, y + 0.015, lz, 0.42, 0.02, 0.28);
  for (let i = 0; i < 6; i++) f.box("metal", C.chrome, lx - 0.15 + i * 0.06, y + 0.03, lz + 0.02 * (i % 2), 0.012, 0.008, 0.18);
  f.cyl("metal", C.chrome, lx + 0.24, y + 0.03, lz - 0.12, 0.09, 0.04);
}
/** scrub sink: stainless trough with tall taps */
export function scrubSink(f: Frame, w = 1.5) {
  f.box("metal", C.chrome, 0, 0.88, -0.22, w, 0.24, 0.44);
  f.box("metal", C.steel, 0, 0.98, -0.22, w - 0.06, 0.02, 0.38);
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) f.box("metal", C.steel, x, 0.38, -0.3, 0.05, 0.76, 0.05);
  for (const x of [-w / 4, w / 4]) {
    f.cyl("metal", C.chrome, x, 1.2, -0.4, 0.035, 0.42);
    f.box("metal", C.chrome, x, 1.4, -0.3, 0.03, 0.03, 0.22);
    f.box("glow", C.ledBlue, x, 1.1, -0.42, 0.03, 0.03, 0.01);
  }
}
/** cap / mask / overshoe dispensers on a low cabinet */
export function scrubSupplies(f: Frame) {
  f.rbox("satin", C.white, 0, 0.45, 0, 0.9, 0.9, 0.45);
  const cols = [C.medBlue, C.medGreen, C.white, 0xb3a3d0];
  cols.forEach((c, i) => {
    f.box("satin", C.white, -0.32 + i * 0.21, 1.0, 0, 0.18, 0.18, 0.28);
    f.box("matte", c, -0.32 + i * 0.21, 1.03, 0.141, 0.12, 0.08, 0.002);
    f.sph("matte", c, -0.32 + i * 0.21, 1.11, 0.02, 0.11, 0.04, 0.11);
  });
}
/** folded surgical textiles stacked on a trolley top */
export function textiles(f: Frame, lx: number, y: number, lz: number) {
  for (let i = 0; i < 4; i++) f.rbox("matte", i % 2 ? C.medBlue : C.medGreen, lx + (i % 2) * 0.02, y + 0.04 + i * 0.075, lz, 0.4, 0.07, 0.3);
}
/** column patient scale */
export function scale(f: Frame) {
  f.box("satin", C.white, 0, 0.05, 0, 0.36, 0.1, 0.4);
  f.box("metal", C.chrome, 0, 0.75, -0.17, 0.05, 1.3, 0.05);
  f.box("satin", C.white, 0, 1.38, -0.12, 0.16, 0.1, 0.08);
  f.box("metal", C.chrome, 0, 1.95, -0.08, 0.03, 0.03, 0.18);
}
/** blood-pressure monitor on a rolling stand */
export function bpMonitor(f: Frame) {
  f.cyl("satin", C.dark, 0, 0.04, 0, 0.42, 0.05);
  f.box("metal", C.chrome, 0, 0.6, 0, 0.035, 1.1, 0.035);
  f.rbox("satin", C.white, 0, 1.2, 0.04, 0.22, 0.18, 0.12);
  f.box("screen", C.white, 0, 1.22, 0.101, 0.14, 0.08, 0.004);
  f.add("torus", "matte", C.dark, 0.14, 1.06, 0.02, 0.18, 0.18, 0.18, { t: 0.1 });
}
/** examination lamp on a stand */
export function examLamp(f: Frame) {
  f.cyl("satin", C.white, 0, 0.04, 0, 0.5, 0.05);
  f.box("metal", C.chrome, 0, 0.7, 0, 0.035, 1.3, 0.035);
  f.box("metal", C.chrome, 0, 1.4, 0.2, 0.03, 0.03, 0.42, { pitch: -0.3 });
  f.add("cone", "satin", C.white, 0, 1.47, 0.42, 0.2, 0.08, 0.2, { t: 0.55 });
  f.box("glow", C.ledWhite, 0, 1.428, 0.42, 0.13, 0.004, 0.13);
}

// ================================================================= nurse station
/** nurse station kit along a counter (counter frame: forward = the nurses' side) */
export function stationKit(f: Frame, len: number) {
  // patient files rack, phone, label printer, sharps, gloves, files
  f.box("metal", C.steel, -len / 2 + 0.4, 1.17, -0.05, 0.42, 0.14, 0.3);
  for (let i = 0; i < 6; i++) f.box("satin", BINDERS[i % BINDERS.length], -len / 2 + 0.24 + i * 0.065, 1.27, -0.05, 0.04, 0.26, 0.26);
  f.rbox("satin", C.dark, len / 2 - 0.5, 1.14, 0.08, 0.2, 0.06, 0.22);
  f.box("satin", C.ink, len / 2 - 0.45, 1.18, 0.05, 0.05, 0.03, 0.2, { yaw: 0.2 });
  f.rbox("satin", C.white, len / 2 - 0.9, 1.17, 0.12, 0.18, 0.12, 0.22);
  f.box("matte", C.paper, len / 2 - 0.9, 1.18, 0.235, 0.08, 0.002, 0.05);
  sharps(f, len / 2 - 0.2, 1.105, 0.1, 0.9);
  f.box("satin", C.white, -0.3, 1.16, 0.1, 0.24, 0.1, 0.13);
  f.box("matte", 0x9fb3d9, -0.3, 1.17, 0.168, 0.12, 0.04, 0.002);
  for (let i = 0; i < 3; i++) f.box("matte", i === 1 ? C.mint : C.paper, 0.35 + i * 0.03, 1.115 + i * 0.012, 0.15, 0.23, 0.01, 0.31, { yaw: 0.06 * i });
  f.cyl("satin", C.white, 0.9, 1.15, 0.2, 0.08, 0.1);
}
/** under-counter medication fridge (glass door, small LED) */
export function medFridge(f: Frame, tall = false) {
  const h = tall ? 1.8 : 0.85;
  f.rbox("satin", C.white, 0, h / 2, 0, 0.6, h, 0.6);
  f.box("glass", C.glass, 0, h / 2 + 0.03, 0.302, 0.48, h - 0.2, 0.01);
  for (let k = 1; k < (tall ? 5 : 3); k++) f.box("matte", C.light, 0, (k * h) / (tall ? 5 : 3), 0.15, 0.48, 0.01, 0.36);
  for (let k = 0; k < (tall ? 8 : 3); k++) f.box("satin", k % 2 ? C.white : C.mint, -0.15 + (k % 3) * 0.15, 0.13 + Math.floor(k / 3) * (h / (tall ? 5 : 3)), 0.12, 0.1, 0.08, 0.14);
  f.box("glow", C.ledBlue, 0.2, h - 0.06, 0.305, 0.08, 0.02, 0.005);
}

// ================================================================= offices
export function mouse(f: Frame, lx: number, y: number, lz: number) { f.rbox("satin", C.dark, lx, y + 0.015, lz, 0.06, 0.03, 0.1); }
export function mug(f: Frame, lx: number, y: number, lz: number, col: number = C.white) {
  f.cyl("satin", col, lx, y + 0.048, lz, 0.08, 0.095);
  f.add("torus", "satin", col, lx + 0.05, y + 0.05, lz, 0.05, 0.05, 0.05, { t: 0.25, yaw: PI / 2 });
  f.cyl("matte", 0x6b4a33, lx, y + 0.09, lz, 0.068, 0.005);
}
export function penPot(f: Frame, lx: number, y: number, lz: number) {
  f.cyl("satin", C.dark, lx, y + 0.05, lz, 0.07, 0.1);
  f.box("satin", C.medBlue, lx + 0.01, y + 0.12, lz, 0.008, 0.1, 0.008, { roll: 0.15 });
  f.box("satin", C.coral, lx - 0.01, y + 0.12, lz + 0.01, 0.008, 0.1, 0.008, { roll: -0.12 });
}
export function notepad(f: Frame, lx: number, y: number, lz: number, yaw = 0) {
  f.box("matte", C.paper, lx, y + 0.005, lz, 0.15, 0.01, 0.21, { yaw });
  f.box("satin", C.navy, lx + 0.1, y + 0.012, lz, 0.008, 0.008, 0.14, { yaw: yaw + 0.2 });
}
export function binderStack(f: Frame, lx: number, y: number, lz: number, n = 3, seed = 0) {
  for (let i = 0; i < n; i++) f.box("satin", BINDERS[(seed + i) % BINDERS.length], lx + (i % 2) * 0.01, y + 0.03 + i * 0.06, lz, 0.29, 0.055, 0.33, { yaw: (i - 1) * 0.05 });
}
export function deskLamp(f: Frame, lx: number, y: number, lz: number, col = C.dark) {
  f.cyl("satin", col, lx, y + 0.012, lz, 0.14, 0.024);
  f.box("metal", col, lx, y + 0.2, lz - 0.02, 0.018, 0.38, 0.018, { pitch: 0.18 });
  f.box("metal", col, lx, y + 0.4, lz + 0.08, 0.018, 0.018, 0.24, { pitch: 0.35 });
  f.add("cone", "satin", col, lx, y + 0.34, lz + 0.18, 0.13, 0.1, 0.13, { t: 0.4 });
  f.box("glow", 0xfff4e2, lx, y + 0.289, lz + 0.18, 0.08, 0.004, 0.08);
}
/** multifunction printer on its cabinet */
export function printer(f: Frame) {
  f.rbox("satin", C.light, 0, 0.3, 0, 0.6, 0.6, 0.55);
  f.rbox("satin", C.white, 0, 0.83, 0, 0.6, 0.46, 0.55);
  f.box("satin", C.grey, 0, 1.08, 0, 0.58, 0.04, 0.5);
  f.box("satin", C.dark, 0.18, 1.06, 0.26, 0.16, 0.08, 0.06, { pitch: -0.5 });
  f.box("screen", C.white, 0.18, 1.07, 0.29, 0.12, 0.05, 0.004, { pitch: -0.5 });
  f.box("matte", C.paper, -0.05, 0.98, 0.3, 0.3, 0.012, 0.18);
  for (let i = 0; i < 3; i++) f.box("matte", C.grey, 0, 0.13 + i * 0.16, 0.278, 0.5, 0.005, 0.005);
}
/** task chair like layout.ts chairs (facing +z) */
export function officeChair(f: Frame, col: number = C.fabric) {
  f.box("satin", col, 0, 0.46, 0, 0.52, 0.08, 0.5);
  f.box("satin", col, 0, 0.82, -0.25, 0.5, 0.56, 0.07);
  f.box("metal", C.grey, 0, 0.22, 0, 0.07, 0.42, 0.07);
  f.cyl("metal", C.grey, 0, 0.025, 0, 0.56, 0.05);
}
export function coatStand(f: Frame, coat: number = C.blueGrey) {
  f.cyl("satin", C.dark, 0, 0.02, 0, 0.42, 0.04);
  f.cyl("metal", C.dark, 0, 0.9, 0, 0.04, 1.76);
  for (let i = 0; i < 4; i++) f.box("metal", C.dark, Math.sin(i * 1.57) * 0.1, 1.68, Math.cos(i * 1.57) * 0.1, 0.02, 0.02, 0.18, { yaw: i * 1.57, pitch: -0.5 });
  f.rbox("matte", coat, 0.12, 1.25, 0.02, 0.1, 0.8, 0.34, { roll: 0.08 });
  f.rbox("matte", C.cognac, -0.12, 1.42, -0.03, 0.08, 0.28, 0.26, { roll: -0.1 });
}
/** mobile whiteboard with abstract marker strokes */
export function whiteboard(f: Frame, uv: UV = P.boardA, w = 1.5) {
  for (const x of [-w / 2 - 0.03, w / 2 + 0.03]) {
    f.box("metal", C.steel, x, 0.95, 0, 0.04, 1.9, 0.04);
    f.box("metal", C.steel, x, 0.04, 0, 0.05, 0.04, 0.55);
    for (const z of [-0.25, 0.25]) f.cyl("satin", C.dark, x, 0.035, z, 0.06, 0.05, { roll: PI / 2 });
  }
  f.box("satin", C.chrome, 0, 1.35, 0, w + 0.04, 0.98, 0.035);
  f.quad("print", uv, 0, 1.35, 0.019, w, 0.94);
  f.box("metal", C.steel, 0, 0.84, 0.05, w * 0.6, 0.02, 0.07);
  for (let i = 0; i < 3; i++) f.box("satin", [C.navy, C.coral, C.aed][i], -0.2 + i * 0.1, 0.86, 0.05, 0.1, 0.018, 0.018);
}
/** tall document cabinet with binders on open shelves (frame: front face) */
export function binderCabinet(f: Frame, w = 1.2, h = 1.95, seed = 0, fill = 1) {
  f.box("satin", C.white, 0, h / 2, -0.38, w, h, 0.02);
  for (const x of [-w / 2, w / 2]) f.box("satin", C.white, x, h / 2, -0.2, 0.025, h, 0.4);
  for (let k = 0; k < 5; k++) f.box("satin", C.white, 0, 0.04 + (k * (h - 0.06)) / 4, -0.2, w, 0.025, 0.4);
  const r = rng(seed * 31 + 7);
  for (let k = 0; k < 4; k++) {
    const y = 0.055 + (k * (h - 0.06)) / 4;
    const n = Math.floor((w - 0.06) / 0.075);
    for (let i = 0; i < n; i++) {
      if (r() > fill) continue;
      const col = BINDERS[Math.floor(r() * BINDERS.length)];
      f.box("satin", col, -w / 2 + 0.06 + i * 0.075, y + 0.16, -0.2, 0.065, 0.31, 0.3);
      f.box("matte", C.paper, -w / 2 + 0.06 + i * 0.075, y + 0.24, -0.048, 0.04, 0.07, 0.003);
    }
  }
}
/** two- or four-drawer metal filing cabinet */
export function filingCabinet(f: Frame, drawers = 4) {
  const h = drawers * 0.33;
  f.rbox("metal", C.light, 0, h / 2, -0.3, 0.47, h, 0.6);
  for (let i = 0; i < drawers; i++) {
    f.box("matte", C.grey, 0, 0.33 * i + 0.33, 0.004, 0.44, 0.006, 0.006);
    f.box("metal", C.chrome, 0, 0.33 * i + 0.24, 0.01, 0.14, 0.025, 0.02);
    f.box("matte", C.paper, 0, 0.33 * i + 0.2, 0.004, 0.08, 0.04, 0.003);
  }
}

// ================================================================= executive / lounge
export function execDesk(f: Frame) {
  // frame: forward = toward the visitor (the director sits at -z)
  f.box("satin", C.walnut, 0, 0.745, 0, 2.0, 0.045, 0.92);
  f.box("matte", C.leather, 0, 0.77, -0.1, 1.1, 0.006, 0.5);
  f.box("satin", C.walnut, -0.82, 0.37, 0, 0.36, 0.72, 0.86);
  f.box("satin", C.walnut, 0.82, 0.37, 0, 0.36, 0.72, 0.86);
  f.box("satin", C.walnut, 0, 0.45, 0.38, 1.3, 0.55, 0.03);
  for (let i = 0; i < 3; i++) f.box("metal", C.brass, -0.82, 0.18 + i * 0.22, 0.435, 0.14, 0.015, 0.012);
  // laptop, lamp, pen, documents, small plant, phone
  f.box("satin", C.dark, 0.1, 0.778, -0.18, 0.34, 0.02, 0.24);
  f.box("screen", C.white, 0.1, 0.9, -0.31, 0.32, 0.22, 0.012, { pitch: 0.25, uv: S.doc });
  f.box("satin", C.dark, 0.1, 0.9, -0.317, 0.34, 0.24, 0.008, { pitch: 0.25 });
  deskLamp(f, -0.78, 0.768, -0.25, C.brass);
  f.box("matte", C.paper, 0.6, 0.772, 0.05, 0.22, 0.01, 0.3, { yaw: 0.15 });
  f.box("satin", C.navy, 0.6, 0.782, 0.05, 0.01, 0.01, 0.15, { yaw: 0.4 });
  binderStack(f, -0.45, 0.768, 0.12, 2, 3);
  f.rbox("satin", C.dark, 0.78, 0.79, -0.25, 0.18, 0.05, 0.2);
  f.box("satin", C.brass, -0.25, 0.79, 0.25, 0.14, 0.04, 0.02);
}
/** high-back leather executive chair (facing +z) */
export function leatherChair(f: Frame, col: number = C.leather, high = true) {
  f.cyl("metal", C.chrome, 0, 0.02, 0, 0.6, 0.04);
  for (let i = 0; i < 5; i++) f.box("metal", C.chrome, Math.sin(i * 1.2566) * 0.15, 0.05, Math.cos(i * 1.2566) * 0.15, 0.04, 0.03, 0.3, { yaw: i * 1.2566 });
  f.cyl("metal", C.chrome, 0, 0.28, 0, 0.06, 0.4);
  f.rbox("satin", col, 0, 0.48, 0.02, 0.56, 0.12, 0.54);
  f.rbox("satin", col, 0, high ? 0.98 : 0.82, -0.26, 0.54, high ? 0.88 : 0.56, 0.1, { pitch: -0.08 });
  for (const x of [-0.3, 0.3]) { f.box("metal", C.chrome, x, 0.58, 0.02, 0.03, 0.18, 0.03); f.rbox("satin", col, x, 0.68, 0.02, 0.07, 0.04, 0.38); }
}
/** cantilever guest chair with leather seat; registers its seat */
export function guestChair(f: Frame, col: number = C.cognac) {
  f.box("metal", C.chrome, 0, 0.01, 0.05, 0.5, 0.02, 0.5);
  for (const x of [-0.23, 0.23]) { f.box("metal", C.chrome, x, 0.22, 0.22, 0.025, 0.42, 0.025); f.box("metal", C.chrome, x, 0.66, -0.2, 0.025, 0.42, 0.025); }
  f.rbox("satin", col, 0, 0.46, 0.02, 0.5, 0.07, 0.48);
  f.rbox("satin", col, 0, 0.75, -0.21, 0.5, 0.44, 0.06, { pitch: -0.1 });
  f.seat(0, 0.04, 0.495, "chair");
}
/** three-seat sofa (frame facing +z); registers its seats */
export function sofa(f: Frame, w = 2.1, col: number = C.sand) {
  f.rbox("matte", col, 0, 0.22, 0, w, 0.3, 0.88);
  f.rbox("matte", col, 0, 0.62, -0.36, w, 0.56, 0.18);
  for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) f.rbox("matte", col, x, 0.5, 0.02, 0.18, 0.32, 0.86);
  const n = w > 1.8 ? 3 : 2, cw = (w - 0.2) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.1 + cw * (i + 0.5);
    f.rbox("matte", 0xe6dccb, x, 0.42, 0.05, cw - 0.03, 0.12, 0.66);
    f.rbox("matte", 0xe6dccb, x, 0.66, -0.24, cw - 0.04, 0.4, 0.14, { pitch: -0.15 });
    f.seat(x, 0.08, 0.48, "sofa");
  }
  f.rbox("matte", C.terracotta, -w / 2 + 0.38, 0.62, -0.14, 0.38, 0.32, 0.1, { pitch: -0.2, yaw: 0.2 });
  f.rbox("matte", C.navy, w / 2 - 0.38, 0.62, -0.14, 0.38, 0.32, 0.1, { pitch: -0.2, yaw: -0.2 });
  for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) for (const z of [-0.36, 0.36]) f.cyl("satin", C.walnut, x, 0.03, z, 0.05, 0.06);
}
export function lounge(f: Frame, col: number = C.sand) {
  f.rbox("matte", col, 0, 0.22, 0, 0.82, 0.3, 0.8);
  f.rbox("matte", 0xe6dccb, 0, 0.42, 0.06, 0.66, 0.12, 0.6);
  f.rbox("matte", col, 0, 0.62, -0.32, 0.82, 0.5, 0.16, { pitch: -0.15 });
  for (const x of [-0.37, 0.37]) f.rbox("matte", col, x, 0.48, 0.02, 0.1, 0.28, 0.76);
  f.seat(0, 0.1, 0.48, "sofa");
}
/** low coffee table with a Moroccan tea set on a brass tray */
export function coffeeTable(f: Frame, w = 1.15, d = 0.62) {
  f.rbox("satin", C.walnut, 0, 0.4, 0, w, 0.05, d);
  for (const x of [-w / 2 + 0.07, w / 2 - 0.07]) for (const z of [-d / 2 + 0.07, d / 2 - 0.07]) f.box("metal", C.brass, x, 0.19, z, 0.03, 0.38, 0.03);
  f.cyl("metal", C.brass, 0.12, 0.432, 0, 0.42, 0.015);
  // teapot (théière) and tea glasses
  f.sph("metal", C.chrome, 0.12, 0.5, 0, 0.13, 0.12, 0.13);
  f.add("cone", "metal", C.chrome, 0.12, 0.585, 0, 0.07, 0.07, 0.07, { t: 0.3 });
  f.box("metal", C.chrome, 0.2, 0.52, 0, 0.12, 0.015, 0.015, { roll: 0.5 });
  for (let i = 0; i < 4; i++) f.cyl("glass", 0xd9b78a, 0.12 + Math.sin(i * 1.57 + 0.6) * 0.15, 0.475, Math.cos(i * 1.57 + 0.6) * 0.15, 0.05, 0.08);
  f.box("satin", C.navy, -0.32, 0.44, 0.05, 0.24, 0.03, 0.32, { yaw: 0.1 });
  f.box("satin", C.cream, -0.32, 0.47, 0.05, 0.22, 0.025, 0.3, { yaw: 0.18 });
}
/** walnut bookcase with books and objects (frame: front face, against a wall behind) */
export function bookcase(f: Frame, w = 1.6, h = 2.0) {
  f.box("satin", C.walnut, 0, h / 2, -0.36, w, h, 0.03);
  for (const x of [-w / 2, w / 2]) f.box("satin", C.walnut, x, h / 2, -0.19, 0.035, h, 0.38);
  for (let k = 0; k < 5; k++) f.box("satin", C.walnut, 0, 0.03 + (k * (h - 0.05)) / 4, -0.19, w, 0.03, 0.38);
  for (let k = 0; k < 4; k++) {
    const y = 0.045 + (k * (h - 0.05)) / 4;
    const bw = k % 2 ? w * 0.55 : w * 0.7;
    const off = k % 2 ? 0.2 : -0.12;
    f.quad("print", P.books, off, y + 0.15, -0.06, bw, 0.3);
    f.box("matte", 0x5a4d40, off, y + 0.15, -0.2, bw, 0.29, 0.27);
    if (k % 2) f.sph("satin", C.terracotta, -w / 2 + 0.25, y + 0.11, -0.18, 0.16, 0.22, 0.16);
    else f.box("satin", C.cream, w / 2 - 0.2, y + 0.05, -0.18, 0.22, 0.1, 0.22);
  }
}
/** framed art (y = centre) */
export function art(f: Frame, uv: UV, lx: number, y: number, lz: number, w: number, h: number, frame: number = C.ink) {
  f.box("satin", frame, lx, y, lz, w + 0.06, h + 0.06, 0.03);
  f.box("matte", C.cream, lx, y, lz + 0.016, w + 0.01, h + 0.01, 0.002);
  f.quad("print", uv, lx, y, lz + 0.019, w * 0.86, h * 0.88);
}
/** rug on the floor */
export function rug(f: Frame, w: number, d: number, uv: UV = P.rug) {
  f.box("matte", 0xe8e0d0, 0, 0.011, 0, w + 0.04, 0.012, d + 0.04);
  f.add("quad", "print", 0xffffff, 0, 0.018, 0, w, d, 1, { pitch: -PI / 2, uv });
}
export function credenza(f: Frame, w = 1.8, col: number = C.walnut) {
  f.rbox("satin", col, 0, 0.4, -0.23, w, 0.68, 0.46);
  for (const x of [-0.23, 0.04, 0.31].map((v) => v * w)) f.box("satin", col, x, 0.4, 0.003, 0.005, 0.6, 0.005);
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) f.box("metal", C.brass, x, 0.03, -0.23, 0.03, 0.06, 0.4);
}
/** conference speaker puck */
export function confSpeaker(f: Frame, lx: number, y: number, lz: number) {
  f.cyl("satin", C.dark, lx, y + 0.02, lz, 0.26, 0.04);
  f.add("torus", "glow", C.ledBlue, lx, y + 0.042, lz, 0.2, 0.2, 0.2, { t: 0.03, pitch: PI / 2 });
  f.cyl("matte", C.ink, lx, y + 0.042, lz, 0.14, 0.004);
}
/** notepad, pen, water bottle and glass in front of a seat (frame: the seat, facing the table) */
export function placeSetting(f: Frame, y: number, lz: number) {
  notepad(f, -0.05, y, lz, 0.05);
  f.cyl("glass", C.bottle, 0.2, y + 0.11, lz + 0.08, 0.065, 0.22);
  f.cyl("satin", C.medBlue, 0.2, y + 0.23, lz + 0.08, 0.032, 0.025);
  f.cyl("glass", C.glass, 0.27, y + 0.045, lz - 0.02, 0.065, 0.09);
}
/** wall screen on a mobile stand */
export function screenStand(f: Frame, uv: UV, w = 1.9, h = 1.1, y = 1.45, mat: "screen" = "screen") {
  f.box("satin", C.dark, 0, 0.04, 0, 0.9, 0.05, 0.6);
  for (const x of [-0.38, 0.38]) for (const z of [-0.24, 0.24]) f.cyl("satin", C.dark, x, 0.035, z, 0.06, 0.05, { roll: PI / 2 });
  for (const x of [-0.25, 0.25]) f.box("metal", C.steel, x, (y + 0.05) / 2, -0.04, 0.06, y, 0.04);
  f.box("satin", C.black, 0, y, 0, w + 0.04, h + 0.04, 0.06);
  f.quad(mat, uv, 0, y, 0.031, w, h);
}

// ================================================================= command center, technical
/** operator console: desk, two screens, keyboard, headset on its hook, task chair (frame: operator side at -z) */
export function consoleDesk(f: Frame, uvA: UV, uvB: UV) {
  f.rbox("satin", C.white, 0, 0.74, 0, 1.7, 0.05, 0.8);
  f.box("satin", C.light, 0, 0.4, 0.33, 1.6, 0.66, 0.04);
  for (const x of [-0.82, 0.82]) f.box("satin", C.light, x, 0.37, 0, 0.04, 0.72, 0.76);
  f.box("glow", C.ledBlue, 0, 0.72, -0.401, 1.5, 0.012, 0.004);
  for (const s of [-1, 1]) {
    f.box("metal", C.steel, s * 0.36, 0.95, 0.24, 0.05, 0.36, 0.05);
    f.box("satin", C.black, s * 0.38, 1.13, 0.2, 0.66, 0.4, 0.03, { yaw: -s * 0.18 });
    const [px, pz] = [s * 0.38 - Math.sin(-s * 0.18) * 0.0, 0.2 - 0.017];
    f.quad("screen", s < 0 ? uvA : uvB, px, 1.13, pz, 0.62, 0.36, { yaw: -s * 0.18 });
  }
  f.box("satin", C.light, 0, 0.775, -0.1, 0.46, 0.02, 0.15);
  mouse(f, 0.34, 0.765, -0.1);
  // headset resting on the desk + its hook
  f.add("torus", "satin", C.dark, -0.62, 0.86, -0.05, 0.18, 0.18, 0.18, { t: 0.08 });
  for (const x of [-0.7, -0.54]) f.cylX("satin", C.dark, x, 0.79, -0.05, 0.07, 0.04);
  f.box("satin", C.dark, -0.5, 0.79, -0.12, 0.012, 0.012, 0.12);
  mug(f, 0.62, 0.765, -0.12, C.navy);
  // ergonomic chair with mesh back and headrest
  f.cyl("metal", C.dark, 0, 0.02, -0.75, 0.6, 0.04);
  f.cyl("metal", C.dark, 0, 0.27, -0.75, 0.06, 0.4);
  f.rbox("matte", C.ink, 0, 0.47, -0.75, 0.5, 0.08, 0.5);
  f.rbox("matte", C.blueGrey, 0, 0.86, -1.0, 0.48, 0.6, 0.05, { pitch: -0.1 });
  f.rbox("matte", C.ink, 0, 1.24, -1.04, 0.3, 0.14, 0.05, { pitch: -0.1 });
  for (const x of [-0.27, 0.27]) f.box("satin", C.ink, x, 0.66, -0.75, 0.05, 0.03, 0.3);
  f.seat(0, -0.73, 0.51, "chair");
}
/** red rolling tool chest with a toolbox on top */
export function toolChest(f: Frame) {
  f.rbox("satin", C.red, 0, 0.52, 0, 0.72, 0.92, 0.46);
  for (let i = 0; i < 6; i++) f.box("metal", C.chrome, 0, 0.18 + i * 0.13, 0.236, 0.6, 0.018, 0.012);
  for (const x of [-0.3, 0.3]) for (const z of [-0.18, 0.18]) f.cyl("satin", C.dark, x, 0.035, z, 0.07, 0.05, { roll: PI / 2 });
  f.box("metal", C.chrome, 0.39, 0.85, 0, 0.03, 0.03, 0.4);
  f.rbox("satin", C.dark, -0.1, 1.06, 0, 0.42, 0.16, 0.22);
  f.box("satin", C.red, -0.1, 1.15, 0, 0.3, 0.03, 0.04);
  f.cyl("satin", C.amber, 0.22, 1.02, 0.05, 0.16, 0.08);
}
/** metal rack of small parts bins (frame: front, against a wall behind) */
export function partsRack(f: Frame, w = 1.8, h = 2.0, seed = 3) {
  for (const x of [-w / 2, w / 2]) for (const z of [-0.42, -0.02]) f.box("metal", C.steel, x, h / 2, z, 0.04, h, 0.04);
  const r = rng(seed);
  const cols = [C.medBlueDark, C.grey, C.amber, C.medBlue, C.light];
  for (let k = 0; k < 5; k++) {
    const y = 0.1 + (k * (h - 0.25)) / 4;
    f.box("metal", C.light, 0, y, -0.22, w, 0.025, 0.44);
    if (k === 4) { for (let i = 0; i < 3; i++) f.box("matte", C.carton, -w / 2 + 0.35 + i * 0.55, y + 0.15, -0.22, 0.45, 0.28, 0.38); continue; }
    const n = Math.floor(w / 0.2);
    for (let i = 0; i < n; i++) {
      const col = cols[Math.floor(r() * cols.length)];
      const x = -w / 2 + 0.11 + i * 0.2;
      f.box("satin", col, x, y + 0.08, -0.2, 0.17, 0.13, 0.36);
      f.box("matte", C.paper, x, y + 0.11, -0.019, 0.08, 0.035, 0.003);
    }
  }
}
/** antistatic mat, an opened infusion pump, its cover, a circuit board, screwdrivers, a multimeter and a magnifier lamp */
export function dismantledDevice(f: Frame, y: number) {
  f.box("matte", 0x3c4a66, 0, y + 0.003, 0, 1.0, 0.006, 0.55);
  f.box("satin", C.white, -0.1, y + 0.04, 0, 0.32, 0.07, 0.22);
  f.box("satin", C.light, -0.1, y + 0.1, -0.1, 0.32, 0.1, 0.012);
  f.box("matte", 0x4e7d5b, -0.1, y + 0.08, 0.02, 0.26, 0.008, 0.16);
  for (let i = 0; i < 4; i++) f.box("satin", C.dark, -0.18 + i * 0.05, y + 0.09, 0.03, 0.03, 0.015, 0.04);
  f.box("satin", C.white, 0.25, y + 0.012, 0.08, 0.32, 0.018, 0.22, { yaw: 0.35 });
  f.box("screen", C.white, 0.27, y + 0.024, 0.06, 0.12, 0.004, 0.08, { yaw: 0.35 });
  for (let i = 0; i < 4; i++) f.cylX("satin", [C.red, C.medBlue, C.amber, C.dark][i], 0.32, y + 0.012, -0.18 + i * 0.035, 0.018, 0.17);
  f.rbox("satin", C.amber, -0.38, y + 0.025, 0.12, 0.09, 0.04, 0.16);
  f.box("screen", C.white, -0.38, y + 0.047, 0.09, 0.06, 0.002, 0.04);
  f.box("matte", C.dark, -0.38, y + 0.03, -0.02, 0.01, 0.01, 0.2, { yaw: 0.4 });
  // magnifier lamp clamped to the bench back
  f.box("metal", C.white, 0.0, y + 0.25, -0.24, 0.03, 0.5, 0.03);
  f.box("metal", C.white, 0.0, y + 0.5, -0.1, 0.025, 0.025, 0.3, { pitch: 0.4 });
  f.add("torus", "satin", C.white, 0.0, y + 0.44, 0.06, 0.2, 0.2, 0.2, { t: 0.14, pitch: PI / 2 - 0.4 });
  f.add("disc", "glass", C.glass, 0.0, y + 0.44, 0.06, 0.17, 0.17, 0.17, { pitch: -0.4 });
  f.cyl("matte", C.steel, 0.15, y + 0.01, -0.15, 0.08, 0.02);
  for (let i = 0; i < 5; i++) f.cyl("metal", C.chrome, 0.13 + (i % 3) * 0.02, y + 0.024, -0.15 + Math.floor(i / 3) * 0.02, 0.008, 0.006);
}
/** old boxy monitor (2026) */
export function crtMonitor(f: Frame, lx: number, y: number, lz: number, yaw = 0) {
  f.box("satin", 0xd8d0c0, lx, y + 0.03, lz, 0.24, 0.06, 0.2, { yaw });
  f.rbox("satin", 0xd8d0c0, lx, y + 0.25, lz - 0.05, 0.42, 0.36, 0.4, { yaw });
  const c = Math.cos(yaw), s = Math.sin(yaw);
  f.quad("screen", S.crt, lx + 0.152 * s, y + 0.26, lz - 0.05 + 0.152 * c, 0.32, 0.25, { yaw });
}
/** small wall/desk sensor node: white puck with a soft LED */
export function sensorNode(f: Frame, lx: number, y: number, lz: number, led: number = C.ledGreen) {
  f.rbox("satin", C.white, lx, y, lz, 0.1, 0.1, 0.035);
  f.box("glow", led, lx + 0.025, y + 0.025, lz + 0.019, 0.016, 0.016, 0.004);
  f.box("matte", C.light, lx, y - 0.015, lz + 0.018, 0.05, 0.004, 0.002);
}
export function kettleSet(f: Frame, y: number) {
  f.cyl("satin", C.dark, -0.15, y + 0.01, 0, 0.17, 0.02);
  f.add("cone", "metal", C.chrome, -0.15, y + 0.13, 0, 0.17, 0.22, 0.17, { t: 0.78 });
  f.box("satin", C.dark, -0.24, y + 0.15, 0, 0.03, 0.17, 0.05);
  f.box("metal", C.chrome, -0.06, y + 0.2, 0, 0.06, 0.02, 0.02, { roll: 0.5 });
  mug(f, 0.08, y, 0.05, C.white); mug(f, 0.18, y, -0.04, C.coral); mug(f, 0.28, y, 0.06, C.navy);
  f.cyl("satin", C.cream, 0.38, y + 0.07, -0.06, 0.1, 0.14);
}
export function espressoMachine(f: Frame, y: number) {
  f.rbox("metal", C.chrome, 0, y + 0.19, -0.05, 0.36, 0.38, 0.38);
  f.box("satin", C.black, 0, y + 0.22, 0.142, 0.3, 0.2, 0.01);
  f.quad("screen", S.coffee, 0.08, y + 0.29, 0.148, 0.09, 0.06);
  f.box("metal", C.steel, 0, y + 0.02, 0.1, 0.3, 0.02, 0.12);
  f.cyl("satin", C.white, -0.05, y + 0.07, 0.1, 0.07, 0.07);
  for (let i = 0; i < 4; i++) f.cyl("satin", C.white, -0.12 + (i % 2) * 0.09, y + 0.41 + Math.floor(i / 2) * 0.07, -0.08, 0.07, 0.065);
}

export type SeatList = Seat[];
