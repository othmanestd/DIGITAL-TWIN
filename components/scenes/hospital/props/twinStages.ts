// The technical management room on the top floor (main building 4e, department "technique"), staged along the
// timeline. Pure description: every part carries a year mask; the drawing folds parts away / unfolds them smoothly
// when the year changes. The animated pieces (hologram, curved screen wall contents, pilot desk screens, ambient
// light) are drawn by TwinRoom.tsx at the positions exported here.
// The states follow lib/model visualStage(year): stage 0 = "2026", 1 = "2027", 2 = "2028", 3 = "2029" below (the
// timeline may run past 2029 with another dataset; the stages keep the same meaning).
//   2026  an ordinary technical office: paper maintenance binders (GMAO), a wall planner, two old monitors, toolboxes,
//         spare-parts racks, a workbench with a dismantled device, a kettle. No twin technology.
//   2027  the first sensors appear on walls and equipment, one screen shows the building outline, the binders thin out.
//   2028  a pilot desk with two large screens (building, flow curves), sensor nodes on every wall, few binders left.
//   2029  the full digital-twin pilot room: holographic table with a live miniature of both buildings, a curved
//         screen wall (energy, maintenance, patient flows), pilot seats, calm blue ambient light.
// Floor-local coordinates of the main building (x right, z toward the front façade), y from the floor surface.
import { DEPT } from "@/lib/hospital";
import { Kit, C, BINDERS, rng, stages, fromStage, toStage, type Stage } from "./kit";
import { P as PR, S as SC } from "./atlas";
import * as F from "./furniture";

const PI = Math.PI;
const R = DEPT.technique?.rect ?? [13, 0, 25, 25];
/** room bounds (inner faces of the 1 m partitions) */
export const ROOM = { x0: R[0] - R[2] / 2 + 0.06, x1: R[0] + R[2] / 2 - 0.06, z0: R[1] - R[3] / 2 + 0.06, z1: R[1] + R[3] / 2 - 0.06 };
/** the twin table spot (same as Twin.tsx TWIN_POS: x = rect.x − 3, z = −10.9) */
export const TABLE = { x: R[0] - 3, z: -10.9, r: 1.0, top: 0.92 };
/** curved screen wall: arc centred on the pilot desks */
export const ARC = { cx: TABLE.x, cz: -4.35, r: 8.0, n: 5, w: 2.0, h: 1.36, y: 1.66, step: 2.06 / 8.0 };
export function arcPanel(i: number) {
  const th = (i - (ARC.n - 1) / 2) * ARC.step;
  return { x: ARC.cx + ARC.r * Math.sin(th), z: ARC.cz - ARC.r * Math.cos(th), yaw: -th, th };
}
/** pilot desk of 2028 (the layout's two-screen desk), and its two large screens */
export const PILOT = { x: R[0] - 1.6, z: -6.4, yaw: PI, y: 1.62, w: 0.98, h: 0.56, gap: 0.04 };
export function pilotScreen(i: 0 | 1) {
  const s = i === 0 ? -1 : 1;
  const lx = s * (PILOT.w / 2 + PILOT.gap / 2);
  // bezel centre: desk frame yaw π maps local (lx, lz) to world (x − lx, z − lz); bezel yaw = π − s·0.16
  const bx = PILOT.x - lx, bz = PILOT.z - 0.27, by = PILOT.yaw - s * 0.16;
  // the picture faces the pilot (opposite to the desk frame), 1.7 cm in front of the bezel
  const yaw = by + PI;
  return { x: bx + Math.sin(yaw) * 0.017, z: bz + Math.cos(yaw) * 0.017, yaw, w: PILOT.w, h: PILOT.h, y: PILOT.y };
}
/** the 2027 screen on a mobile stand */
export const OUTLINE = { x: R[0] + 0.8, z: -12.0, yaw: 0, y: 1.5, w: 2.0, h: 1.14 };

// masks by timeline stage (lib/model visualStage): S0 today (2026), S1 first wave, S2 scaling, S3 full deployment
const Y26 = stages(0), Y27 = stages(1), Y2627 = toStage(1), Y2628 = toStage(2), Y2728 = stages(1, 2);
const Y28 = fromStage(2), Y29 = stages(3), Y27p = fromStage(1);

/** binder masks: each binder has a value v; it stays while v < keep(year) */
function binderMask(v: number) {
  // kept share by year: 2026 all, 2027 about half, 2028 a fifth, 2029 a few (regulatory records)
  let m = stages(0);
  if (v < 0.5) m |= stages(1);
  if (v < 0.18) m |= stages(2);
  if (v < 0.05) m |= stages(3);
  return m;
}

export function buildTwin(kit: Kit) {
  const r = rng(4242);
  // ------------------------------------------------------------ always: the technical service keeps working
  // spare-parts racks on the back wall (right), tool chests by the benches, the workbench detail
  for (const x of [17.4, 19.35]) { F.partsRack(kit.at(x, ROOM.z0 + 0.46, 0), 1.8, 2.0, Math.round(x)); kit.solids.push({ x0: x - 0.92, x1: x + 0.92, z0: ROOM.z0, z1: ROOM.z0 + 0.48, h: 2.0, kind: "parts rack" }); }
  F.toolChest(kit.at(14.45, 4.4, PI / 2)); kit.solids.push({ x0: 14.2, x1: 14.7, z0: 4.0, z1: 4.8, h: 1.2, kind: "tool chest" });
  F.toolChest(kit.at(22.75, 4.4, -PI / 2)); kit.solids.push({ x0: 22.5, x1: 23.0, z0: 4.0, z1: 4.8, h: 1.2, kind: "tool chest" });
  F.dismantledDevice(kit.at(18.69, 6.6, PI), 0.92);
  {
    // soldering station, parts tray and a laptop on the first bench
    const b = kit.at(18.69, 2.2, PI);
    b.rbox("satin", C.dark, -0.35, 0.97, -0.1, 0.22, 0.1, 0.16); b.box("screen", 0xffffff, -0.35, 0.98, -0.019, 0.08, 0.03, 0.004);
    b.cyl("metal", C.chrome, -0.15, 0.95, -0.15, 0.08, 0.06); b.box("satin", C.amber, -0.15, 1.02, -0.15, 0.02, 0.14, 0.02, { roll: 0.6 });
    b.box("satin", C.grey, 0.2, 0.935, 0.05, 0.3, 0.03, 0.2);
    for (let i = 0; i < 6; i++) b.box("satin", [C.medBlue, C.amber, C.coral][i % 3], 0.1 + (i % 3) * 0.09, 0.955, 0.0 + Math.floor(i / 3) * 0.09, 0.07, 0.012, 0.07);
  }
  // CO2 extinguisher by the front door, first-aid kit, a clock (first person)
  F.extinguisher(kit.at(11.0, ROOM.z1, PI), 0, 0.11);
  kit.with({ hi: true }, () => {
    F.clock(kit.at(R[0] + 6, ROOM.z1, PI), 0, 2.4, 0.03, 0.4);
    const fa = kit.at(ROOM.x0, 3.2, PI / 2);
    fa.box("satin", C.white, 0, 1.45, 0.07, 0.36, 0.3, 0.14); fa.box("satin", C.aed, 0, 1.45, 0.141, 0.12, 0.04, 0.003); fa.box("satin", C.aed, 0, 1.45, 0.141, 0.04, 0.12, 0.003);
  });
  // break corner on the west wall: cabinet (kettle until 2027, espresso machine after), small table and two chairs
  {
    const cb = kit.at(ROOM.x0 + 0.27, 7.6, PI / 2);
    cb.rbox("satin", C.white, 0, 0.45, 0, 1.2, 0.9, 0.5);
    cb.box("satin", C.oak, 0, 0.92, 0, 1.24, 0.04, 0.54);
    kit.solids.push({ x0: ROOM.x0, x1: ROOM.x0 + 0.54, z0: 7.0, z1: 8.2, h: 0.95, kind: "cabinet" });
    kit.with({ yr: Y2627 }, () => F.kettleSet(cb.sub(-0.2, 0), 0.94));
    kit.with({ yr: Y28 }, () => F.espressoMachine(cb.sub(-0.25, 0.02), 0.94));
    kit.with({ yr: Y28 }, () => { F.mug(cb, 0.25, 0.94, 0.05, C.white); F.mug(cb, 0.38, 0.94, -0.06, C.navy); });
    const t = kit.at(2.9, 7.6, 0);
    t.cyl("satin", C.wood, 0, 0.72, 0, 0.8, 0.04); t.cyl("metal", C.grey, 0, 0.36, 0, 0.07, 0.7); t.cyl("metal", C.grey, 0, 0.02, 0, 0.5, 0.03);
    kit.solids.push({ x0: 2.5, x1: 3.3, z0: 7.2, z1: 8.0, h: 0.75, kind: "table" });
    for (const s of [-1, 1]) F.visitorChair(t.sub(s * 0.62, 0, s > 0 ? -PI / 2 : PI / 2), C.blueGrey);
    kit.with({ yr: Y2627 }, () => { F.binderStack(t, 0.1, 0.74, 0.05, 2, 5); F.mug(t, -0.2, 0.74, -0.1, C.coral); });
    F.plant(kit.at(ROOM.x0 + 0.4, 10.2), 1.0, "tall");
  }
  // ------------------------------------------------------------ team table (front left): paper first, tablets at the end
  {
    const t = kit.at(7.4, 4.3, 0);
    t.rbox("satin", C.wood, 0, 0.74, 0, 2.6, 0.05, 1.15);
    for (const x of [-1.15, 1.15]) t.box("metal", C.grey, x, 0.36, 0, 0.08, 0.72, 0.9);
    for (const s of [-1, 1]) for (const x of [-0.85, 0, 0.85]) F.officeChair(t.sub(x, s * 0.82, s > 0 ? PI : 0));
    kit.solids.push({ x0: 6.1, x1: 8.7, z0: 3.72, z1: 4.88, h: 0.78, kind: "team table" });
    kit.with({ yr: Y2627 }, () => {
      F.binderStack(t, -0.8, 0.765, -0.15, 3, 2); F.binderStack(t, 0.9, 0.765, 0.2, 2, 4);
      for (let i = 0; i < 3; i++) t.cylX("matte", i % 2 ? 0xdfe6ee : C.paper, 0.1 + i * 0.05, 0.8, -0.25 + i * 0.12, 0.07, 0.9);
      t.add("quad", "print", 0xffffff, -0.1, 0.767, 0.22, 0.7, 0.5, 1, { pitch: -PI / 2, uv: PR.planner, yaw: 0.1 });
    });
    kit.with({ yr: Y26 }, () => { F.mug(t, 0.5, 0.765, -0.3, C.white); F.notepad(t, -0.35, 0.765, -0.28); });
    kit.with({ yr: stages(2) }, () => { t.box("satin", C.dark, 0.3, 0.775, 0.1, 0.34, 0.02, 0.24); t.box("satin", C.dark, 0.3, 0.88, -0.02, 0.34, 0.22, 0.012, { pitch: 0.3 }); F.binderStack(t, -0.8, 0.765, -0.15, 1, 2); });
    kit.with({ yr: Y29 }, () => {
      for (const [x, z, yaw] of [[-0.7, 0.2, 0.1], [0.6, -0.25, -0.2]] as const) { t.rbox("satin", C.ink, x, 0.775, z, 0.32, 0.02, 0.24, { yaw }); t.add("quad", "screen", 0xffffff, x, 0.787, z, 0.28, 0.2, 1, { pitch: -PI / 2, yaw, uv: SC.outline }); }
      F.confSpeaker(t, 0, 0.765, 0);
    });
  }
  // ------------------------------------------------------------ equipment waiting for repair: paper tags, then sensors
  {
    for (let i = 0; i < 4; i++) {
      const f = kit.at(9.3 + i * 0.85, 10.6, PI);
      f.cyl("satin", C.dark, 0, 0.03, 0, 0.5, 0.05);
      f.box("metal", C.steel, 0, 0.8, 0, 0.04, 1.6, 0.04);
      if (i % 2) { f.rbox("satin", C.white, 0, 1.15, 0.06, 0.3, 0.26, 0.2); f.box("screen", 0xffffff, 0, 1.17, 0.161, 0.2, 0.12, 0.004); }
      else { f.rbox("satin", C.light, 0, 1.1, 0.06, 0.24, 0.3, 0.18); f.rbox("satin", C.light, 0, 1.45, 0.06, 0.24, 0.3, 0.18); }
      kit.with({ yr: Y2627 }, () => { f.box("matte", i % 2 ? C.amber : C.paper, 0.1, 0.95, 0.07, 0.07, 0.1, 0.004, { roll: 0.2 }); f.box("matte", C.grey, 0.06, 1.0, 0.07, 0.004, 0.06, 0.004); });
      kit.with({ yr: Y28 }, () => F.sensorNode(f, 0.13, 0.95, 0.07, C.ledBlue));
    }
    const v = kit.at(12.9, 10.7, PI);
    v.rbox("satin", C.white, 0, 0.55, 0, 0.45, 1.1, 0.45); v.box("screen", 0xffffff, 0, 1.25, 0.05, 0.38, 0.3, 0.04, { pitch: -0.2 });
    for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) v.cyl("satin", C.dark, x, 0.03, z, 0.06, 0.05, { roll: PI / 2 });
    kit.with({ yr: Y2627 }, () => v.box("matte", C.amber, 0.12, 0.9, 0.23, 0.08, 0.1, 0.004));
    kit.with({ yr: Y28 }, () => F.sensorNode(v, 0.12, 0.9, 0.23, C.ledBlue));
    kit.solids.push({ x0: 9.0, x1: 13.2, z0: 10.3, z1: 10.95, h: 1.6, kind: "equipment" });
    // floor marking of the repair zone
    const m = kit.at(10.95, 10.65, 0);
    for (const [x, z, w, d] of [[0, -0.75, 4.6, 0.06], [0, 0.75, 4.6, 0.06], [-2.3, 0, 0.06, 1.56], [2.3, 0, 0.06, 1.56]] as const) m.box("matte", C.yellow, x, 0.016, z, w, 0.004, d);
  }
  // ------------------------------------------------------------ electrical corner (front right): cabinets, ladder, cable reel
  {
    const e = kit.at(ROOM.x1 - 0.3, 9.6, -PI / 2);
    for (const x of [-0.65, 0.65]) {
      e.rbox("satin", C.light, x, 1.0, 0, 1.2, 2.0, 0.5);
      e.box("matte", C.grey, x, 1.0, 0.252, 0.004, 1.9, 0.004);
      e.box("metal", C.chrome, x + 0.45, 1.05, 0.26, 0.03, 0.2, 0.02);
      e.box("satin", C.yellow, x - 0.3, 1.6, 0.252, 0.12, 0.1, 0.004);
    }
    kit.with({ yr: Y26 }, () => { e.box("satin", C.white, 0.65, 1.35, 0.255, 0.4, 0.3, 0.01); for (let i = 0; i < 3; i++) e.cylZ("satin", C.ink, 0.53 + i * 0.12, 1.38, 0.265, 0.07, 0.01); });
    kit.with({ yr: fromStage(1) }, () => { e.box("satin", C.black, 0.65, 1.35, 0.26, 0.42, 0.28, 0.02); e.quad("screen", SC.flat, 0.65, 1.35, 0.272, 0.38, 0.24); });
    kit.solids.push({ x0: ROOM.x1 - 0.55, x1: ROOM.x1, z0: 8.3, z1: 10.9, h: 2.0, kind: "electrical cabinets" });
    const l = kit.at(ROOM.x1 - 0.35, 7.3, -PI / 2);
    for (const x of [-0.22, 0.22]) l.box("metal", C.steel, x, 0.95, 0.15, 0.04, 1.9, 0.05, { pitch: -0.18 });
    for (let i = 0; i < 6; i++) l.box("metal", C.steel, 0, 0.25 + i * 0.3, 0.15 + (0.25 + i * 0.3) * 0.18 - 0.17, 0.44, 0.03, 0.06);
    const r = kit.at(23.2, 10.9, 0);
    r.cylX("satin", C.amber, 0, 0.25, 0, 0.5, 0.06); r.cylX("satin", C.amber, 0, 0.25, 0.0, 0.5, 0.06); r.cylX("matte", C.dark, 0, 0.25, 0, 0.42, 0.3);
    for (const x of [-0.18, 0.18]) r.cylX("satin", C.amber, x, 0.25, 0, 0.5, 0.04);
  }
  // ------------------------------------------------------------ receiving area (back right): table, pallet of cartons
  {
    const t = kit.at(22.4, -8.3, 0);
    t.box("metal", C.steel, 0, 0.9, 0, 1.8, 0.04, 0.8);
    for (const x of [-0.85, 0.85]) for (const z of [-0.35, 0.35]) t.box("metal", C.steel, x, 0.45, z, 0.04, 0.9, 0.04);
    t.box("metal", C.steel, 0, 0.2, 0, 1.75, 0.02, 0.75);
    t.box("matte", C.carton, -0.45, 1.08, 0.05, 0.6, 0.32, 0.45); t.box("matte", C.carton, 0.3, 1.02, -0.1, 0.45, 0.2, 0.35);
    t.box("matte", C.carton, 0.0, 0.32, 0.0, 1.2, 0.22, 0.6);
    kit.with({ yr: Y2627 }, () => { t.box("matte", C.paper, 0.55, 0.925, 0.2, 0.22, 0.01, 0.3); F.penPot(t, 0.75, 0.92, 0.25); });
    kit.with({ yr: Y28 }, () => { t.rbox("satin", C.ink, 0.55, 0.935, 0.2, 0.15, 0.03, 0.08); t.box("glow", C.ledBlue, 0.6, 0.952, 0.2, 0.02, 0.004, 0.02); });
    kit.solids.push({ x0: 21.5, x1: 23.3, z0: -8.7, z1: -7.9, h: 1.3, kind: "receiving table" });
    const p = kit.at(23.9, -10.1, 0.1);
    p.box("satin", C.oak, 0, 0.07, 0, 1.2, 0.14, 0.8);
    for (let i = 0; i < 4; i++) p.box("matte", C.carton, -0.3 + (i % 2) * 0.6, 0.38 + Math.floor(i / 2) * 0.46, 0, 0.56, 0.44, 0.74);
    kit.solids.push({ x0: 23.2, x1: 24.6, z0: -10.6, z1: -9.6, h: 1.1, kind: "pallet" });
  }
  // ------------------------------------------------------------ the GMAO archive: binder cabinets on the west wall
  for (let i = 0; i < 4; i++) {
    const z = -11.25 + i * 1.28;
    const f = kit.at(ROOM.x0 + 0.42, z, PI / 2);
    const w = 1.22, h = 1.95;
    f.box("satin", C.white, 0, h / 2, -0.38, w, h, 0.02);
    for (const x of [-w / 2, w / 2]) f.box("satin", C.white, x, h / 2, -0.2, 0.025, h, 0.4);
    for (let k = 0; k < 5; k++) f.box("satin", C.white, 0, 0.04 + (k * (h - 0.06)) / 4, -0.2, w, 0.025, 0.4);
    for (let k = 0; k < 4; k++) {
      const y = 0.055 + (k * (h - 0.06)) / 4;
      for (let j = 0; j < 15; j++) {
        const v = r(), col = BINDERS[Math.floor(r() * BINDERS.length)];
        kit.with({ yr: binderMask(v) }, () => {
          f.box("satin", col, -w / 2 + 0.065 + j * 0.073, y + 0.16, -0.2, 0.064, 0.31, 0.3);
          f.box("matte", C.paper, -w / 2 + 0.065 + j * 0.073, y + 0.24, -0.048, 0.04, 0.07, 0.003);
        });
      }
    }
    kit.solids.push({ x0: ROOM.x0, x1: ROOM.x0 + 0.42, z0: z - 0.62, z1: z + 0.62, h: 1.95, kind: "binder cabinet" });
  }
  // ------------------------------------------------------------ 2026–2027: the old technical desk, then the gateway
  {
    const f = kit.at(3.55, -6.0, -PI / 2);   // worker side toward +x, facing the west wall
    kit.with({ yr: Y2627 }, () => {
      f.box("satin", 0xcdbfa8, 0, 0.73, 0, 1.4, 0.04, 0.72);
      for (const x of [-0.66, 0.66]) f.box("satin", C.grey, x, 0.36, 0, 0.04, 0.72, 0.68);
      f.box("satin", C.grey, 0, 0.45, 0.32, 1.3, 0.5, 0.02);
      f.box("satin", 0xd8d0c0, 0, 0.765, -0.12, 0.44, 0.03, 0.15);
      f.rbox("satin", C.ink, -0.58, 0.79, -0.05, 0.2, 0.08, 0.22);
      f.box("matte", C.paper, 0.48, 0.77, 0.0, 0.26, 0.06, 0.34);
      F.binderStack(f, 0.48, 0.8, -0.05, 2, 1);
      F.mug(f, -0.4, 0.75, -0.24, C.white);
      F.officeChair(f.sub(0, -0.72));
    });
    kit.with({ yr: Y26 }, () => { F.crtMonitor(f, -0.32, 0.75, 0.14, PI + 0.12); F.crtMonitor(f, 0.3, 0.75, 0.14, PI - 0.25); });
    kit.with({ yr: Y27 }, () => {
      f.box("satin", C.black, 0, 1.05, 0.18, 0.6, 0.36, 0.03); f.quad("screen", SC.flat, 0, 1.05, 0.164, 0.56, 0.32, { yaw: PI }); f.box("metal", C.grey, 0, 0.86, 0.21, 0.05, 0.2, 0.05);
    });
    kit.solids.push({ x0: 3.19, x1: 3.91, z0: -6.7, z1: -5.3, h: 0.8, kind: "old desk", yr: Y2627 });
    // 2028 →: the sensor gateway cabinet stands where the old PC was
    const g = kit.at(ROOM.x0 + 0.33, -5.6, PI / 2);
    kit.with({ yr: Y28 }, () => {
      g.rbox("satin", C.dark, 0, 0.95, 0, 0.6, 1.9, 0.6);
      g.box("glass", C.glass, 0, 0.95, 0.301, 0.5, 1.75, 0.01);
      for (let k = 0; k < 7; k++) { g.box("satin", C.ink, 0, 0.3 + k * 0.22, 0.12, 0.48, 0.12, 0.4); g.box("glow", k % 3 ? C.ledGreen : C.ledBlue, 0.16, 0.3 + k * 0.22, 0.325, 0.03, 0.015, 0.004); }
      g.box("metal", C.steel, 0.2, 2.02, 0, 0.02, 0.24, 0.02);
    });
    kit.solids.push({ x0: ROOM.x0, x1: ROOM.x0 + 0.62, z0: -5.9, z1: -5.3, h: 1.9, kind: "gateway", yr: Y28 });
  }
  // ------------------------------------------------------------ back wall, 2026–2028: boards, archive, plan table
  // wall planner (mobile), maintenance board, low archive cabinets with stacked binders
  kit.with({ yr: Y2627 }, () => { F.whiteboard(kit.at(5.95, -12.05, 0), PR.planner, 1.9); });
  kit.solids.push({ x0: 4.9, x1: 7.0, z0: -12.35, z1: -11.75, h: 1.9, kind: "planner", yr: Y2627 });
  kit.with({ yr: Y26 }, () => { F.whiteboard(kit.at(13.9, -12.05, 0), PR.boardA, 1.7); });
  kit.solids.push({ x0: 12.9, x1: 14.9, z0: -12.35, z1: -11.75, h: 1.9, kind: "board", yr: Y26 });
  for (const x of [8.55, 10.15, 11.75]) {
    const f = kit.at(x, ROOM.z0 + 0.45, 0);
    kit.with({ yr: Y2628 }, () => {
      f.rbox("satin", C.light, 0, 0.42, -0.22, 1.5, 0.84, 0.44);
      f.box("matte", C.grey, 0, 0.42, 0.002, 0.005, 0.76, 0.005);
      for (const s of [-1, 1]) f.box("metal", C.chrome, s * 0.12, 0.62, 0.01, 0.12, 0.02, 0.02);
    });
    for (let k = 0; k < 3; k++) kit.with({ yr: binderMask(0.12 + r() * 0.85) & Y2628 }, () => F.binderStack(f, -0.45 + k * 0.45, 0.84, -0.22, 2 + (k % 2), k + Math.round(x)));
    kit.solids.push({ x0: x - 0.76, x1: x + 0.76, z0: ROOM.z0, z1: ROOM.z0 + 0.45, h: 0.9, kind: "archive", yr: Y2628 });
  }
  // the plan table where the twin table will stand: drawings, rolls, a hard hat, later a tablet
  {
    const f = kit.at(TABLE.x, TABLE.z, 0);
    kit.with({ yr: Y2628 }, () => {
      f.box("satin", C.wood, 0, 0.9, 0, 2.2, 0.045, 1.2);
      for (const [x, z] of [[-1.02, -0.52], [1.02, -0.52], [-1.02, 0.52], [1.02, 0.52]] as const) f.box("metal", C.grey, x, 0.44, z, 0.05, 0.88, 0.05);
      f.box("metal", C.grey, 0, 0.18, 0, 2.0, 0.03, 0.03);
      f.add("quad", "print", 0xffffff, -0.15, 0.925, 0.02, 1.15, 0.9, 1, { pitch: -PI / 2, uv: PR.blueprint, yaw: 0.04 });
    });
    kit.with({ yr: Y2627 }, () => {
      f.add("quad", "print", 0xffffff, 0.55, 0.927, -0.18, 0.7, 0.55, 1, { pitch: -PI / 2, uv: PR.blueprint, yaw: -0.12 });
      for (let i = 0; i < 4; i++) f.cylX("matte", i % 2 ? 0xdfe6ee : C.paper, 0.6 + (i % 2) * 0.05, 0.955 + Math.floor(i / 2) * 0.07, 0.35 + (i % 2) * 0.08, 0.075, 0.95);
      f.add("hemi", "satin", C.white, -0.85, 0.925, -0.38, 0.28, 0.16, 0.3);
      f.cyl("satin", C.white, -0.85, 0.93, -0.38, 0.36, 0.012);
      f.box("satin", C.amber, 0.1, 0.935, -0.42, 0.6, 0.02, 0.045, { yaw: 0.25 });
    });
    kit.with({ yr: Y26 }, () => { F.mug(f, -0.75, 0.922, 0.3, C.white); F.binderStack(f, 0.85, 0.922, -0.2, 3, 2); });
    kit.with({ yr: Y2728 }, () => {
      f.rbox("satin", C.ink, -0.6, 0.935, 0.25, 0.32, 0.02, 0.24, { yaw: 0.2 });
      f.add("quad", "screen", 0xffffff, -0.6, 0.947, 0.25, 0.28, 0.2, 1, { pitch: -PI / 2, yaw: 0.2, uv: SC.outline });
    });
    kit.with({ yr: stages(2) }, () => {
      f.cylX("matte", C.paper, 0.6, 0.955, 0.35, 0.075, 0.95);
      f.rbox("satin", C.ink, 0.45, 0.935, -0.2, 0.32, 0.02, 0.24, { yaw: -0.15 });
      f.add("quad", "screen", 0xffffff, 0.45, 0.947, -0.2, 0.28, 0.2, 1, { pitch: -PI / 2, yaw: -0.15, uv: SC.flat });
    });
    kit.solids.push({ x0: TABLE.x - 1.1, x1: TABLE.x + 1.1, z0: TABLE.z - 0.6, z1: TABLE.z + 0.6, h: 0.95, kind: "plan table", yr: Y2628 });
  }
  // ------------------------------------------------------------ 2027 → 2028: the first screen, on a mobile stand
  kit.with({ yr: Y2728 }, () => {
    const f = kit.at(OUTLINE.x, OUTLINE.z, OUTLINE.yaw);
    f.box("satin", C.dark, 0, 0.04, 0, 0.9, 0.05, 0.6);
    for (const x of [-0.38, 0.38]) for (const z of [-0.24, 0.24]) f.cyl("satin", C.dark, x, 0.035, z, 0.06, 0.05, { roll: PI / 2 });
    for (const x of [-0.25, 0.25]) f.box("metal", C.steel, x, (OUTLINE.y + 0.05) / 2, -0.04, 0.06, OUTLINE.y, 0.04);
    f.box("satin", C.black, 0, OUTLINE.y, 0, OUTLINE.w + 0.05, OUTLINE.h + 0.05, 0.06);
    f.quad("screen", SC.outline, 0, OUTLINE.y, 0.031, OUTLINE.w, OUTLINE.h);
    F.sensorNode(f, 0.7, OUTLINE.y - OUTLINE.h / 2 - 0.12, 0.04, C.ledBlue);
  });
  kit.solids.push({ x0: OUTLINE.x - 1.05, x1: OUTLINE.x + 1.05, z0: OUTLINE.z - 0.3, z1: OUTLINE.z + 0.3, h: 2.1, kind: "screen stand", yr: Y2728 });
  // ------------------------------------------------------------ sensors: 6 at the first wave, 12 when scaling, 18 at full deployment
  const sensors: [number, number, number, number, Stage][] = [
    // x, z, yaw (facing into the room), y, first stage
    [ROOM.x0, -2.4, PI / 2, 0.9, 1], [ROOM.x1, 3.0, -PI / 2, 0.9, 1], [3.0, ROOM.z0, 0, 0.9, 1],
    [21.6, ROOM.z0, 0, 0.92, 1], [18.0, ROOM.z1, PI, 0.9, 1], [8.0, ROOM.z1, PI, 0.9, 1],
    [ROOM.x0, 4.0, PI / 2, 0.9, 2], [ROOM.x1, -5.5, -PI / 2, 0.9, 2], [ROOM.x1, 6.0, -PI / 2, 0.9, 2],
    [23.8, ROOM.z0, 0, 0.92, 2], [4.0, ROOM.z1, PI, 0.9, 2], [22.0, ROOM.z1, PI, 0.9, 2],
    [ROOM.x0, -11.9, PI / 2, 0.9, 3], [ROOM.x1, -10.5, -PI / 2, 0.9, 3], [ROOM.x1, 11.0, -PI / 2, 0.9, 3],
    [14.2, ROOM.z1, PI, 0.9, 3], [ROOM.x0, 11.8, PI / 2, 0.9, 3], [15.4, ROOM.z0, 0, 0.92, 3],
  ];
  for (const [x, z, yaw, y, y0] of sensors) {
    kit.with({ yr: fromStage(y0) }, () => F.sensorNode(kit.at(x, z, yaw), 0, y, 0.02, y0 === 1 ? C.ledGreen : C.ledBlue));
  }
  // sensors on the bench ends and the equipment pool (2027 →)
  kit.with({ yr: Y27p }, () => {
    for (const z of [2.2, 6.6]) F.sensorNode(kit.at(15.08, z, -PI / 2), 0, 0.7, -0.02, C.ledGreen);
    F.sensorNode(kit.at(23.6, -3.0, PI), 0, 1.25, 0.03, C.ledBlue);
  });
  // ceiling sensors (first person), 2028 →
  kit.with({ hi: true, yr: Y28 }, () => {
    for (const [x, z] of [[5, -3], [13, 4], [20, -6], [6, 9], [20, 9], [13, -8]] as const) {
      const f = kit.at(x, z, 0);
      f.cyl("satin", C.white, 0, 2.97, 0, 0.16, 0.05);
      f.box("glow", C.ledBlue, 0, 2.94, 0, 0.03, 0.01, 0.03);
    }
  });
  // ------------------------------------------------------------ 2028 →: the pilot desk gets two large screens
  kit.with({ yr: Y28 }, () => {
    const f = kit.at(PILOT.x, PILOT.z, PILOT.yaw);
    f.box("metal", C.steel, 0, 1.15, 0.32, 0.07, 0.8, 0.07);
    f.box("metal", C.steel, 0, 1.55, 0.3, 1.9, 0.05, 0.05);
    for (const s of [-1, 1]) {
      const lx = s * (PILOT.w / 2 + PILOT.gap / 2);
      f.box("satin", C.black, lx, PILOT.y, 0.27, PILOT.w + 0.03, PILOT.h + 0.03, 0.03, { yaw: -s * 0.16 });
    }
    f.box("glow", C.softBlue, 0, 0.745, -0.376, 1.4, 0.01, 0.004);
  });
  // ------------------------------------------------------------ 2029: curved screen wall, holographic table, seats
  kit.with({ yr: Y29 }, () => {
    for (let i = 0; i < ARC.n; i++) {
      const p = arcPanel(i);
      const f = kit.at(p.x, p.z, p.yaw);
      f.box("satin", C.black, 0, ARC.y, -0.04, ARC.w + 0.04, ARC.h + 0.06, 0.06);
      // posts between panels, top beam with its cove light, low console under the panels
      f.box("satin", C.ink, ARC.w / 2 + 0.03, 1.3, -0.06, 0.06, 2.6, 0.1);
      if (i === 0) f.box("satin", C.ink, -ARC.w / 2 - 0.03, 1.3, -0.06, 0.06, 2.6, 0.1);
      f.box("satin", C.ink, 0, 2.58, -0.02, ARC.w + 0.1, 0.1, 0.2);
      f.box("glow", C.softBlue, 0, 2.52, 0.08, ARC.w + 0.06, 0.012, 0.012);
      f.rbox("satin", C.white, 0, 0.42, 0.05, ARC.w + 0.06, 0.84, 0.36);
      f.box("glow", C.softBlue, 0, 0.83, 0.235, ARC.w, 0.008, 0.006);
      f.box("matte", C.mist, 0, 0.86, 0.06, ARC.w + 0.07, 0.02, 0.38);
      F.sensorNode(f, ARC.w / 2 - 0.15, 0.6, 0.235, C.ledBlue);
    }
    // holographic table pedestal (the hologram itself is drawn by TwinRoom.tsx)
    const t = kit.at(TABLE.x, TABLE.z, 0);
    t.cyl("satin", C.white, 0, 0.04, 0, 2.1, 0.08);
    t.add("cone", "satin", C.white, 0, 0.47, 0, 1.25, 0.78, 1.25, { t: 1.5 });
    t.cyl("satin", C.ink, 0, 0.885, 0, 2.0, 0.07);
    t.cyl("glass", 0x1a2440, 0, 0.925, 0, 1.92, 0.012);
    // pilot seats: armrests, headrests and a mesh back on the two console chairs
    for (const dx of [R[0] - 5, R[0] - 1.6]) {
      const c = kit.at(dx, -6.4 + 0.74, PI);
      c.rbox("matte", C.blueGrey, 0, 0.84, -0.2, 0.52, 0.62, 0.035, { pitch: -0.06 });
      c.rbox("matte", C.ink, 0, 1.27, -0.25, 0.36, 0.16, 0.06, { pitch: -0.1 });
      c.box("metal", C.dark, 0, 1.13, -0.26, 0.04, 0.2, 0.03);
      for (const x of [-0.29, 0.29]) { c.box("satin", C.ink, x, 0.67, 0, 0.06, 0.03, 0.3); c.box("metal", C.dark, x, 0.57, -0.06, 0.03, 0.18, 0.03); }
    }
    // desk edge lights on both consoles, a third sensor on the console
    for (const dx of [R[0] - 5, R[0] - 1.6]) kit.at(dx, -6.4, PI).box("glow", C.softBlue, 0, 0.745, -0.376, 1.4, 0.01, 0.004);
    // ceiling light ring above the table (first person)
    kit.with({ hi: true }, () => { kit.at(TABLE.x, TABLE.z, 0).add("torus", "glow", C.softBlue, 0, 2.96, 0, 2.8, 2.8, 2.8, { t: 0.012, pitch: PI / 2 }); });
  });
  for (let i = 0; i < ARC.n; i++) {
    const p = arcPanel(i);
    const f = kit.at(p.x, p.z, p.yaw);
    f.solid(-ARC.w / 2 - 0.06, ARC.w / 2 + 0.06, -0.12, 0.24, 2.65, "screen wall", { yr: Y29 });
  }
  kit.solids.push({ x0: TABLE.x - 1.05, x1: TABLE.x + 1.05, z0: TABLE.z - 1.05, z1: TABLE.z + 1.05, h: 0.95, kind: "twin table", yr: Y29 });
}
