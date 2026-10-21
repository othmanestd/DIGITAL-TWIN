// Room-by-room detail of the hospital (pure): what a visitor walking through the building sees up close.
// Everything is floor-local (origin = building centre, y = 0 on the floor surface), computed once from layout.ts
// (read only, recognised by discover.ts) so the props follow the existing furniture. See furniture.ts for the items.
import { DEPT, KIND_COLOR } from "@/lib/hospital";
import { FLOOR_LAYOUTS, type FloorLayout } from "../layout";
import { Kit, C, rng, hash, yawOf, type Frame } from "./kit";
import { features, type BedF, type DoorF } from "./discover";
import { Placer } from "./place";
import * as F from "./furniture";
import { P as PR, S as SC } from "./atlas";
import { buildTwin } from "./twinStages";
import type { CrowdSpec, Look, Member, Walker } from "./crowdSpec";
import { lookFor } from "./crowdSpec";

const PI = Math.PI;

export type FloorProps = {
  key: string; building: "main" | "annex"; floor: number;
  kit: Kit;
  crowd: CrowdSpec;
};

// ================================================================= helpers
/** frame on the face of a wall line, facing along the normal (nx, nz) into the space where the item hangs */
function wallAt(kit: Kit, x: number, z: number, nx: number, nz: number, off = 0.06) {
  return kit.at(x + nx * off, z + nz * off, Math.atan2(nx, nz));
}
const hiOn = (kit: Kit, fn: () => void) => kit.with({ hi: true }, fn);
/** mix two colours (hex numbers) */
function mixHex(a: number, b: number, t: number) {
  const ch = (v: number, s: number) => (v >> s) & 255;
  const m = (s: number) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t) << s;
  return m(16) | m(8) | m(0);
}
const kindTone = (dept: string) => mixHex(parseInt((KIND_COLOR[DEPT[dept]?.kind ?? "admin"] ?? "#7C93D6").slice(1), 16), 0xf3f4f7, 0.5);

// ================================================================= care: beds and their rooms
function bedRoom(kit: Kit, pl: Placer, fl: FloorLayout, b: BedF, k: number) {
  const f = kit.at(b.x, b.z, b.yaw);
  const icu = b.dept === "reanimation";
  const ward = b.dept === "hospitalisation" || b.dept === "maternite";
  if (!["hospitalisation", "reanimation", "maternite", "urgences"].includes(b.dept)) return; // spare beds, exam couch
  // headwall behind the head (skip in front of an opening)
  const [hx, hz] = f.P(0, -1.25);
  const nearDoor = features(fl).doors.some((d) => Math.hypot(d.x - hx, d.z - hz) < d.w / 2 + 1.4);
  if (!nearDoor) {
    F.headwall(f.sub(0, -1.25), icu);
    f.solid(-0.8, 0.8, -1.3, -1.2, 1.8, "headwall");
  }
  F.chartHolder(f);
  if (b.patient) F.nurseCall(f, k % 2 ? 1 : -1);
  // over-bed table on the free side, with water and a cup
  if (b.patient && (ward || b.dept === "urgences")) {
    F.overbedTable(f.sub(-0.74, 0.42), 1);
    f.solid(-0.86, -0.6, 0.2, 0.64, 1.0, "overbed table");
  }
  // bedside table dressing (non-monitored beds have the layout's bedside table at (0.85, -0.8))
  if (!b.monitor) {
    const top = 0.72;
    if (b.patient) {
      f.cyl("glass", C.glass, 0.78, top + 0.11, -0.92, 0.09, 0.22);
      f.sph("matte", [C.coral, C.yellow, 0xb9a3d0, C.white][k % 4], 0.78, top + 0.27, -0.92, 0.2, 0.14, 0.2);
      f.sph("matte", C.leaf, 0.82, top + 0.22, -0.95, 0.12, 0.08, 0.12);
      f.box("matte", C.white, 0.95, top + 0.04, -0.7, 0.14, 0.08, 0.12);
      F.mug(f, 0.66, top, -0.66, C.white);
    }
  }
  // privacy curtain on its ceiling rail (first person only)
  if (ward) hiOn(kit, () => F.privacyCurtain(f, k % 2 ? 1 : 1));
  // a visitor chair for the family, facing the patient, on a side where no staff member stands
  if (b.patient && b.dept !== "urgences") {
    const cands: [number, number, number][] = [[1.3, 1.55, -2.25], [-1.3, 1.55, 2.25], [1.5, -0.15, -PI / 2], [-1.5, -0.15, PI / 2]];
    for (const [lx, lz, dy] of cands) {
      const [cx, cz] = f.P(lx, lz);
      if (fl.people.some((p) => p.slot.pose !== "lie" && Math.hypot(p.slot.x - cx, p.slot.z - cz) < 0.85)) continue;
      if (!pl.free([cx - 0.27, cx + 0.27, cz - 0.27, cz + 0.27], 0.02)) continue;
      const v = f.sub(lx, lz, dy);
      F.visitorChair(v, k % 3 ? C.fabric : C.medBlueDark);
      v.solid(-0.25, 0.25, -0.25, 0.25, 0.95, "visitor chair");
      break;
    }
  }
  // waste bins near the head on the free side
  if (icu) { F.wasteBin(f.sub(-1.45, -1.0), 0, 0); F.sharps(f, -1.45, 0.56, -1.0, 0.8); }
  void pl;
}

/** furnishing of the 6 single rooms of the ward and of the maternity rooms (walls known from layout.ts) */
function wardRooms(kit: Kit, pl: Placer, fl: FloorLayout) {
  if (fl.key === "main:3") {
    const d = DEPT.hospitalisation;
    const x0 = d.rect[0] - d.rect[2] / 2, rw = d.rect[2] / 3;
    for (const side of [-1, 1]) for (let k = 0; k < 3; k++) {
      const xa = x0 + rw * k, xb = xa + rw;
      const zf = side * 4.6;                 // corridor wall of the room
      const into = -side;                     // from the front wall into the room: toward the façade
      void into;
      const nz = side;                        // normal of the front wall pointing into the room (room at |z| > 4.6)
      // wardrobe in the west corner against the front wall, sink and bins to the east of the door
      F.wardrobe(kit.at(xa + 0.62, zf + nz * (0.06 + 0.6), Math.atan2(0, nz)), 0.9);
      kit.solids.push({ x0: xa + 0.15, x1: xa + 1.1, z0: Math.min(zf, zf + nz * 0.68), z1: Math.max(zf, zf + nz * 0.68), h: 2.0, kind: "wardrobe" });
      const doorX = xa + rw / 2 + 1.5;
      const sx = doorX + 1.35;
      kit.with({}, () => F.sinkUnit(kit.at(sx, zf + nz * (0.06 + 0.5), Math.atan2(0, nz)), (fn) => hiOn(kit, fn)));
      kit.solids.push({ x0: sx - 0.4, x1: sx + 0.4, z0: Math.min(zf, zf + nz * 0.58), z1: Math.max(zf, zf + nz * 0.58), h: 0.86, kind: "washbasin" });
      F.pedalBin(kit.at(sx + 0.72, zf + nz * 0.3, Math.atan2(0, nz)));
      F.wasteBin(kit.at(xa + 1.42, zf + nz * 0.32, Math.atan2(0, nz)));
      // sanitiser next to the door inside, a calm poster, an evacuation plan by the door
      hiOn(kit, () => {
        const w = wallAt(kit, doorX - 0.95, zf, 0, nz);
        F.sanitiser(w, 0, 1.25, 0.05);
        const p = wallAt(kit, xa + 0.06, (zf + side * 12.5) / 2 + side * 0.8, 1, 0);
        F.art(p, k % 2 ? PR.art2 : PR.art1, 0, 1.6, 0.02, 0.5, 0.62, C.white);
        const ev = wallAt(kit, doorX + 0.75, zf, 0, nz);
        F.poster(ev, PR.map, 0, 1.5, 0.01, 0.24, 0.3);
        // TV wall bracket for the existing TV, clock above the door
        F.clock(wallAt(kit, doorX, zf, 0, nz), 0, 2.45, 0.03, 0.28);
      });
    }
  }
  if (fl.key === "main:2") {
    // maternity: rooms between walls at x = -17 and -9, open toward the corridor zone
    const xs: [number, number][] = [[-25.5, -17], [-17, -9], [-9, -0.5]];
    xs.forEach(([xa, xb], k) => {
      F.wardrobe(kit.at(xa + 0.62, 12.44 - 0.6, PI), 0.9);
      kit.solids.push({ x0: xa + 0.15, x1: xa + 1.1, z0: 11.76, z1: 12.44, h: 2.0, kind: "wardrobe" });
      F.sinkUnit(kit.at(xb - 0.62, 12.44 - 0.5, PI), (fn) => hiOn(kit, fn));
      kit.solids.push({ x0: xb - 1.0, x1: xb - 0.24, z0: 11.9, z1: 12.44, h: 0.86, kind: "washbasin" });
      F.pedalBin(kit.at(xb - 1.3, 12.1, PI));
      // baby changing unit next to the wardrobe
      const cg = kit.at(xa + 1.75, 12.44 - 0.33, PI);
      cg.rbox("satin", C.white, 0, 0.45, 0, 0.8, 0.9, 0.6);
      cg.rbox("matte", C.mint, 0, 0.96, 0, 0.74, 0.08, 0.56);
      cg.box("satin", C.white, 0, 1.06, -0.26, 0.8, 0.12, 0.04);
      for (let i = 0; i < 3; i++) cg.rbox("matte", [C.white, C.mint, 0xf0d9d4][i], -0.25 + i * 0.03, 0.08 + 0.13 * i + 0.2, 0.22, 0.25, 0.06, 0.18);
      kit.solids.push({ x0: xa + 1.33, x1: xa + 2.17, z0: 11.8, z1: 12.44, h: 1.0, kind: "changing table" });
      hiOn(kit, () => {
        F.art(wallAt(kit, xa + 0.06, 9.6, 1, 0), k % 2 ? PR.art1 : PR.art2, 0, 1.6, 0.02, 0.5, 0.62, C.white);
        F.sanitiser(wallAt(kit, xb - 0.06, 6.6, -1, 0), 0, 1.25, 0.05);
      });
    });
  }
}

// ================================================================= nurse stations
function stations(kit: Kit, pl: Placer, fl: FloorLayout) {
  for (const c of features(fl).counters) {
    if (c.dept !== "hospitalisation" && c.dept !== "reanimation") continue;
    const f = kit.at(c.x, c.z, c.yaw);
    F.stationKit(f, c.len);
    // nurses' side is local -z: medication fridge, bins, a patient board
    const nurse = c.dept === "hospitalisation" ? -1 : -1;
    const fr = f.sub(-c.len / 2 - 0.55, nurse * 0.9, PI / 2);
    F.medFridge(fr);
    fr.solid(-0.32, 0.32, -0.32, 0.32, 0.9, "medication fridge");
    F.wasteBin(f.sub(c.len / 2 + 0.35, nurse * 0.85));
    F.pedalBin(f.sub(c.len / 2 + 0.35, nurse * 0.35));
    F.sharps(f, c.len / 2 - 0.2, 0.76, nurse * 0.45, 1);
    // clock and notice board on the nearest walls are placed with the corridor kit
  }
  // ward: patient board on a mobile stand facing the station, a linen cart, wheelchairs parked at the west end
  if (fl.key === "main:3") {
    F.whiteboard(kit.at(-16.6, -1.55, 0), PR.ward, 1.3);
    kit.solids.push({ x0: -17.35, x1: -15.85, z0: -1.85, z1: -1.25, h: 1.9, kind: "board" });
    F.linenCart(kit.at(-8.0, 1.25, PI / 2));
    kit.solids.push({ x0: -8.3, x1: -7.7, z0: 0.85, z1: 1.65, h: 1.1, kind: "linen cart" });
    F.wheelchairPark(kit.at(-24.85, 0.0, PI / 2), 2);
    kit.solids.push({ x0: -25.4, x1: -24.3, z0: -0.75, z1: 0.75, h: 1.0, kind: "wheelchairs" });
    F.waterDispenser(kit.at(-25.2, 1.55, PI / 2));
    kit.solids.push({ x0: -25.4, x1: -25.0, z0: 1.35, z1: 1.75, h: 1.5, kind: "water" });
    F.plant(kit.at(-25.0, -1.7), 1.05, "tall");
  }
  if (fl.key === "main:2") {
    F.linenCart(kit.at(22.4, -2.3, 0));
    kit.solids.push({ x0: 22.0, x1: 22.8, z0: -2.6, z1: -2.0, h: 1.1, kind: "linen cart" });
    F.oxygenCylinders(kit.at(24.6, -2.4, -PI / 2), 3);
    kit.solids.push({ x0: 24.4, x1: 24.9, z0: -2.8, z1: -2.0, h: 1.1, kind: "cylinders" });
  }
}

// ================================================================= clinical rooms
function clinical(kit: Kit, pl: Placer, fl: FloorLayout) {
  if (fl.key === "main:2") {
    // operating theatres (bloc): instrument trays, drapes, glove boxes and light boxes on the 2.2 m partition,
    // oxygen by the anaesthesia machines, bins, a scrub sink and scrub supplies by the door
    for (const x of [-18, -6]) {
      F.instrumentTray(kit.at(x + 1.4, -6.8, -PI / 2), 0, 0.935, 0);
      F.oxygenCylinders(kit.at(x - 1.6, -11.35, 0), 2);
      kit.solids.push({ x0: x - 1.9, x1: x - 1.3, z0: -11.5, z1: -11.2, h: 1.1, kind: "cylinders" });
      F.wasteBin(kit.at(x + 2.55, -10.1, 0));
      F.sharps(kit.at(x + 2.55, -10.1, 0), 0.0, 0.58, 0.0, 0.8);
      // kick bucket
      const kb = kit.at(x + 0.95, -9.75, 0);
      kb.cyl("metal", C.steel, 0, 0.05, 0, 0.36, 0.04); kb.cyl("metal", C.chrome, 0, 0.27, 0, 0.36, 0.2); kb.cyl("metal", C.steel, 0, 0.18, 0, 0.04, 0.2);
    }
    // the empty theatre is ready: a green drape folded on its table
    kit.at(-6, -8.3, PI / 2).rbox("matte", C.medGreen, 0, 0.93, 0.6, 0.7, 0.05, 0.6);
    F.textiles(kit.at(-15.5, -10.1, 0), 0, 0.82, 0);
    // on the partition (x = -11.5, 2.2 m high): glove boxes and light boxes on both faces
    for (const s of [-1, 1]) {
      const w = wallAt(kit, -11.5, -9.0, s, 0, 0.06);
      F.gloveBoxes(w, 0, 1.45, 0.06);
      F.lightBox(w, -2.0 * s, 1.55, 0.04, 0.8);
      F.sanitiser(w, 1.3 * s, 1.25, 0.05);
    }
    F.scrubSink(kit.at(-17.5, -1.06, PI), 1.5);
    kit.solids.push({ x0: -18.25, x1: -16.75, z0: -1.06, z1: -0.56, h: 1.1, kind: "scrub sink" });
    F.scrubSupplies(kit.at(-15.7, -0.84, PI));
    kit.solids.push({ x0: -16.15, x1: -15.25, z0: -1.07, z1: -0.6, h: 1.2, kind: "supplies" });
    // ICU: glove boxes and sanitisers on the outer wall per bay (first person)
    hiOn(kit, () => {
      for (const x of [4, 10, 16, 22]) {
        const w = wallAt(kit, x - 1.6, -12.5, 0, 1);
        F.gloveBoxes(w, 0, 1.4, 0.06);
        F.sanitiser(w, 0.45, 1.3, 0.05);
      }
    });
    // reserve: cylinder store and a linen cart
    F.oxygenCylinders(kit.at(2.1, 11.9, PI), 4);
    kit.solids.push({ x0: 1.5, x1: 2.7, z0: 11.65, z1: 12.15, h: 1.1, kind: "cylinders" });
  }
  if (fl.key === "main:1") {
    // consultation A (desk) and B (exam couch), behind the wall at z = 7.1
    hiOn(kit, () => {
      const a = wallAt(kit, -22.6, 12.5, 0, -1);
      F.lightBox(a, 0, 1.55, 0.04, 0.78);
      F.poster(a, PR.care, 1.3, 1.55, 0.01, 0.42, 0.52);
      const b = wallAt(kit, -13.4, 12.5, 0, -1);
      F.gloveBoxes(b, -1.0, 1.4, 0.06);
      F.sanitiser(b, -0.4, 1.3, 0.05);
      F.towelDispenser(b, 1.4, 1.35, 0.06);
      F.poster(wallAt(kit, -17.33, 9.8, 1, 0, 0.06), PR.hands, 0, 1.55, 0.01, 0.3, 0.3);
    });
    F.bpMonitor(kit.at(-24.6, 11.6, PI / 2));
    F.scale(kit.at(-19.0, 12.05, PI));
    kit.solids.push({ x0: -19.2, x1: -18.8, z0: 11.85, z1: 12.25, h: 1.9, kind: "scale" });
    F.sinkUnit(kit.at(-17.33 - 0.06 - 0.5, 11.55, -PI / 2), (fn) => hiOn(kit, fn));
    kit.solids.push({ x0: -17.9, x1: -17.39, z0: 11.15, z1: 11.95, h: 0.86, kind: "washbasin" });
    F.pedalBin(kit.at(-18.0, 10.75, -PI / 2));
    F.plant(kit.at(-24.9, 7.7), 0.85, "snake");
    // exam room: lamp, trolley with sharps and gloves, waste, a folding screen, the couch paper roll, a step
    F.examLamp(kit.at(-14.85, 11.6, PI / 2));
    const tr = kit.at(-10.6, 11.7, PI);
    tr.rbox("satin", C.white, 0, 0.45, 0, 0.6, 0.8, 0.45); tr.box("metal", C.steel, 0, 0.87, 0, 0.64, 0.03, 0.5);
    F.sharps(tr, 0.17, 0.885, 0.05, 0.85); F.instrumentTray(tr, -0.1, 0.885, 0);
    kit.solids.push({ x0: -10.95, x1: -10.25, z0: 11.45, z1: 11.95, h: 1.0, kind: "trolley" });
    F.wasteBin(kit.at(-11.4, 12.0, PI));
    const sc = kit.at(-10.0, 9.7, PI / 2 + 0.25);
    for (let i = 0; i < 3; i++) { sc.box("metal", C.chrome, -0.6 + i * 0.6, 0.9, 0, 0.56, 1.6, 0.03, { yaw: (i - 1) * 0.35 }); sc.box("matte", C.mint, -0.6 + i * 0.6, 0.95, 0.002, 0.5, 1.4, 0.03, { yaw: (i - 1) * 0.35 }); }
    kit.solids.push({ x0: -10.4, x1: -9.6, z0: 8.8, z1: 10.6, h: 1.7, kind: "screen" });
    const cp = kit.at(-13.33, 10.5, PI / 2);
    cp.cylX("matte", C.paper, 0, 0.66, -1.0, 0.12, 0.62);
    const st = kit.at(-12.0, 9.55, 0);
    st.box("metal", C.chrome, 0, 0.12, 0, 0.42, 0.04, 0.32); st.box("metal", C.chrome, 0, 0.25, -0.08, 0.42, 0.04, 0.16);
    for (const x of [-0.19, 0.19]) st.box("metal", C.steel, x, 0.12, 0, 0.02, 0.24, 0.3);
    // laboratory: glove boxes, sharps and tube waste on the benches, lab coats on a stand, a safety cabinet
    for (const z of [-10.1, -6.3]) {
      const b = kit.at(15.93, z, 0);
      F.sharps(b, -4.6, 0.92, 0.1, 0.8);
      for (const x of [-1.6, 2.6]) { const g = b.sub(x, 0.22); g.box("satin", C.white, 0, 0.98, 0, 0.24, 0.11, 0.13); g.box("matte", 0x9fb3d9, 0, 0.99, 0.066, 0.12, 0.05, 0.002); }
      for (const x of [-3.2, 0.6, 4.2]) { const p = b.sub(x, -0.1); p.box("satin", C.white, 0, 0.95, 0, 0.22, 0.04, 0.12); for (let i = 0; i < 3; i++) p.box("satin", C.light, -0.06 + i * 0.06, 1.08, 0, 0.012, 0.24, 0.012, { roll: 0.08 }); }
    }
    F.wasteBin(kit.at(10.4, -4.2, 0));
    F.coatStand(kit.at(24.9, -1.2), C.white);
    hiOn(kit, () => { const w = wallAt(kit, 9.17, -3.0, 1, 0); F.gloveBoxes(w, 0, 1.4, 0.06); F.sanitiser(w, 0.6, 1.3, 0.05); F.poster(w, PR.hands, -0.7, 1.5, 0.01, 0.28, 0.28); });
  }
  if (fl.key === "main:0") {
    // emergencies: oxygen, gloves, sharps, waiting chairs with a family; imaging: lead aprons, light box
    F.oxygenCylinders(kit.at(24.8, 6.2, -PI / 2), 2);
    kit.solids.push({ x0: 24.6, x1: 25.1, z0: 5.9, z1: 6.5, h: 1.1, kind: "cylinders" });
    F.wheelchair(kit.at(24.7, 8.0, -PI / 2), C.navy);
    hiOn(kit, () => {
      for (const x of [13.6, 17.1, 20.7]) {
        const w = wallAt(kit, x, 12.5, 0, -1);
        F.gloveBoxes(w, 0, 1.45, 0.06);
        F.sanitiser(w, 0.45, 1.3, 0.05);
      }
    });
    for (const x of [17.13, 20.73]) F.wasteBin(kit.at(x - 0.4, 11.95, PI));
    const ch = kit.at(10.0, 9.3, PI / 2);
    // a row of three waiting chairs (seats registered for the crowd)
    ch.box("metal", C.grey, 0, 0.22, -0.05, 1.86, 0.05, 0.32);
    for (let i = 0; i < 3; i++) {
      const lx = (i - 1) * 0.62;
      ch.box("satin", C.fabric, lx, 0.46, 0, 0.54, 0.08, 0.5);
      ch.box("satin", C.fabric, lx, 0.76, -0.24, 0.54, 0.5, 0.07);
      ch.box("metal", C.steel, lx - 0.25, 0.22, 0, 0.04, 0.44, 0.04);
      ch.seat(lx, 0.02, 0.5, "row");
    }
    ch.solid(-0.95, 0.95, -0.3, 0.27, 1.0, "waiting chairs");
    // imaging: lead aprons on their rack, a light box, glove boxes
    const ap = kit.at(12.0, -11.4, 0);
    ap.box("metal", C.steel, 0, 0.9, -0.1, 1.2, 0.04, 0.04);
    for (const x of [-0.55, 0.55]) { ap.box("metal", C.steel, x, 0.9, -0.1, 0.04, 1.8, 0.04); ap.box("metal", C.steel, x, 0.02, -0.1, 0.05, 0.04, 0.5); }
    ap.box("metal", C.steel, 0, 1.75, -0.1, 1.2, 0.04, 0.04);
    for (let i = 0; i < 3; i++) ap.rbox("matte", [C.medBlueDark, C.blueGrey, C.medGreen][i], -0.35 + i * 0.35, 1.25, -0.06 + i * 0.01, 0.32, 0.82, 0.05);
    kit.solids.push({ x0: 11.35, x1: 12.65, z0: -11.75, z1: -11.2, h: 1.8, kind: "apron rack" });
    hiOn(kit, () => {
      const w = wallAt(kit, 20.2, -12.5, 0, 1);
      F.lightBox(w, 0, 1.55, 0.04, 0.78);
      F.gloveBoxes(w, 1.1, 1.4, 0.06);
    });
    F.sharps(kit.at(14.73, -6.0, 0), 0, 0.94, 0, 0.8); // on the ultrasound cart
  }
}

/** consumable shelves (gloves, compresses, syringes in boxes) placed against a free wall of clinical departments */
function supplies(kit: Kit, pl: Placer, fl: FloorLayout) {
  const want: Record<string, { n: number; near?: [number, number]; sides?: ("inner" | "outer" | "w" | "e")[] }> = {
    bloc: { n: 2, near: [-12, -12], sides: ["outer", "w"] }, urgences: { n: 1, near: [11, 12], sides: ["outer", "w"] },
    reanimation: { n: 1, near: [24, -3], sides: ["e", "inner"] }, consultations: { n: 1, near: [-10, 12], sides: ["outer", "e"] },
    laboratoire: { n: 1, sides: ["e", "outer"] }, imagerie: { n: 1, near: [24, -11], sides: ["outer", "e"] },
    pharmacie: { n: 1, sides: ["w", "outer"] }, maternite: { n: 1, near: [-1, 6], sides: ["e", "inner"] },
  };
  for (const d of fl.depts) {
    const w = want[d.id];
    if (!w) continue;
    for (let i = 0; i < w.n; i++) {
      const s = pl.spot(d.id, 1.25, 0.46, { near: w.near, sides: w.sides });
      if (!s) continue;
      const f = kit.at(s.x, s.z, s.yaw);
      F.consumableShelf(f.sub(0, -0.23), 1.2, 1.8, hash(d.id + i) % 1000);
      f.solid(-0.62, 0.62, -0.46, 0, 1.8, "consumables shelf");
    }
  }
  // basement services: wheelchairs and a stretcher parked by the porters, laundry bags, a pallet jack, archive boxes
  if (fl.key === "main:-1") {
    const s = pl.spot("brancardage", 2.1, 0.8, { sides: ["outer", "e"] });
    if (s) { F.wheelchairPark(kit.at(s.x, s.z, s.yaw).sub(0, -0.4), 3); kit.at(s.x, s.z, s.yaw).solid(-1.05, 1.05, -0.8, 0, 1.0, "wheelchairs"); }
    const l = pl.spot("linge", 2.2, 0.7, { sides: ["outer", "w"] });
    if (l) {
      const f = kit.at(l.x, l.z, l.yaw);
      for (let i = 0; i < 4; i++) f.sph("matte", [C.linen, C.medBlue, C.linen, C.mint][i], -0.8 + i * 0.52, 0.32, -0.35, 0.55, 0.62, 0.5);
      f.solid(-1.1, 1.1, -0.7, 0, 0.65, "laundry bags");
    }
    const j = pl.spot("logistique", 1.5, 0.7, { sides: ["inner", "e"] });
    if (j) {
      const f = kit.at(j.x, j.z, j.yaw).sub(0, -0.35);
      for (const x of [-0.2, 0.2]) f.box("metal", C.dark, x, 0.06, 0.1, 0.16, 0.08, 1.15);
      f.box("satin", C.red, 0, 0.45, -0.55, 0.5, 0.7, 0.15);
      f.box("metal", C.dark, 0, 1.0, -0.6, 0.05, 0.6, 0.05, { pitch: -0.2 });
      f.box("metal", C.dark, 0, 1.3, -0.66, 0.36, 0.05, 0.05);
      kit.at(j.x, j.z, j.yaw).solid(-0.75, 0.75, -0.7, 0, 1.3, "pallet jack");
    }
    const a = pl.spot("archives", 1.6, 0.5, { sides: ["e", "outer"] });
    if (a) {
      const f = kit.at(a.x, a.z, a.yaw);
      for (let i = 0; i < 6; i++) f.box("matte", C.carton, -0.55 + (i % 3) * 0.55, 0.16 + Math.floor(i / 3) * 0.32, -0.25, 0.5, 0.3, 0.42);
      f.solid(-0.8, 0.8, -0.5, 0, 0.65, "archive boxes");
    }
  }
}

// ================================================================= offices: every desk, plus office kit per department
const OFFICE_KIND = new Set(["admin", "hq"]);
function deskAccessories(kit: Kit, fl: FloorLayout) {
  for (const d of features(fl).desks) {
    if (d.dept === "technique") continue; // the twin room dresses its own desks per year
    const r = rng(hash("desk" + d.desk));
    const f = kit.at(d.x, d.z, d.yaw);
    kit.with({ desk: d.desk }, () => {
      const y = 0.765, hw = d.w / 2;
      F.mouse(f, 0.3, y, -0.12);
      if (r() < 0.75) F.mug(f, -hw + 0.1, y, -0.26, [C.white, C.navy, C.coral, C.cream, C.aed][Math.floor(r() * 5)]);
      F.notepad(f, -0.42, y, -0.25, 1.45);
      if (r() < 0.5) F.penPot(f, hw - 0.08, y, 0.3);
      if (r() < 0.3) F.deskPlant(f, hw - 0.12, y, 0.27);
      else if (r() < 0.3) F.deskLamp(f.sub(-hw + 0.1, 0.27, PI), 0, y, 0, C.dark);
      // PC tower and a paper bin under the desk
      f.rbox("satin", C.dark, hw - 0.3, 0.22, 0.12, 0.19, 0.42, 0.42);
      f.box("glow", C.ledBlue, hw - 0.3, 0.38, -0.092, 0.02, 0.02, 0.004);
      f.cyl("satin", C.grey, -hw + 0.28, 0.15, 0.12, 0.25, 0.3);
      // headsets at the phone desks of the switchboard, the admissions and the call desks
      if (d.phone && (d.dept === "standard" || d.dept === "admissions" || d.dept === "pec")) {
        f.add("torus", "satin", C.dark, -0.5 * (d.w / 1.5) + 0.02, y + 0.1, 0.16, 0.17, 0.17, 0.17, { t: 0.08 });
        f.cylX("satin", C.dark, -0.5 * (d.w / 1.5) + 0.02, y + 0.02, 0.16, 0.07, 0.04);
      }
    });
  }
}
function officeKit(kit: Kit, pl: Placer, fl: FloorLayout) {
  for (const d of fl.depts) {
    if (!OFFICE_KIND.has(d.kind) && d.id !== "laboratoire" && d.id !== "pharmacie" && d.id !== "logistique") continue;
    const desks = features(fl).desks.filter((x) => x.dept === d.id);
    if (!desks.length) continue;
    const r = rng(hash("office" + d.id));
    const near: [number, number] = [desks[0].x, desks[0].z];
    const put = (w: number, dd: number, fn: (f: Frame) => void, h: number, kind: string, sides?: ("inner" | "outer" | "w" | "e")[], n?: [number, number]) => {
      const s = pl.spot(d.id, w, dd, { near: n ?? near, sides });
      if (!s) return false;
      const f = kit.at(s.x, s.z, s.yaw);
      fn(f);
      f.solid(-w / 2, w / 2, -dd, 0, h, kind);
      return true;
    };
    put(0.62, 0.58, (f) => F.printer(f.sub(0, -0.29)), 1.1, "printer");
    if (r() < 0.8) put(1.25, 0.42, (f) => F.binderCabinet(f, 1.2, 1.95, hash(d.id) % 97, 0.9), 2.0, "binder cabinet", ["outer", "w", "e"]);
    put(0.5, 0.5, (f) => F.coatStand(f.sub(0, -0.25), [C.blueGrey, C.sand, C.navy][Math.floor(r() * 3)]), 1.8, "coat stand", ["inner", "w", "e"]);
    if (r() < 0.5) put(0.5, 0.48, (f) => F.filingCabinet(f, 2), 0.7, "filing cabinet", ["outer", "w", "e"]);
    put(0.5, 0.5, (f) => F.plant(f.sub(0, -0.25), 0.95, r() < 0.5 ? "snake" : "round"), 1.1, "plant", ["w", "e", "outer"], [d.rect[0] + d.rect[2] / 2, d.rect[1]]);
    if (desks.length >= 2 && r() < 0.6) put(1.6, 0.6, (f) => F.whiteboard(f.sub(0, -0.3, 0), r() < 0.5 ? PR.boardA : PR.boardB, 1.4), 1.9, "whiteboard", ["w", "e", "outer"]);
    // notice board and clock on a wall (first person)
    hiOn(kit, () => {
      const s = pl.spot(d.id, 1.2, 0.05, { sides: ["w", "e"], near });
      if (s) F.noticeBoard(kit.at(s.x, s.z, s.yaw), 0, 1.55, 0.0, 1.0, 0.72);
      const c = pl.spot(d.id, 0.4, 0.04, { sides: ["outer"], near });
      if (c) F.clock(kit.at(c.x, c.z, c.yaw), 0, 2.35, 0.0);
    });
  }
}

// ================================================================= meeting rooms
function meeting(kit: Kit, fl: FloorLayout) {
  const f = features(fl);
  const seatsAt = (dept: string, tx: number, tz: number, r: number) => f.seats.filter((s) => s.dept === dept && s.kind === "chair" && Math.hypot(s.x - tx, s.z - tz) < r);
  const dress = (dept: string, t: { x: number; z: number; yaw: number; w: number; d: number }, r: number) => {
    for (const s of seatsAt(dept, t.x, t.z, r)) {
      const fr = kit.at(s.x, s.z, s.yaw);
      // place setting on the table edge in front of the seat
      const dist = Math.hypot(t.x - s.x, t.z - s.z);
      const toEdge = Math.min(dist, 0.55) + 0.12;
      F.placeSetting(fr, 0.77, toEdge);
    }
    F.confSpeaker(kit.at(t.x, t.z, t.yaw), 0, 0.77, 0);
  };
  for (const t of f.tables) {
    if (t.dept === "cadres") dress("cadres", t, 2.6);
  }
  if (fl.key === "main:3") {
    // cadres: a screen on a stand at the end of the table, a credenza by the façade
    F.screenStand(kit.at(19.7, 6.3, -PI / 2), SC.meeting, 1.6, 0.92, 1.4);
    kit.solids.push({ x0: 19.4, x1: 20.0, z0: 5.85, z1: 6.75, h: 1.9, kind: "screen" });
    F.credenza(kit.at(21.6, 12.44, PI), 1.8, C.oak);
    kit.solids.push({ x0: 20.7, x1: 22.5, z0: 11.98, z1: 12.44, h: 0.72, kind: "credenza" });
    F.plant(kit.at(21.0, 12.2), 0.55, "round");
    F.coatStand(kit.at(11.2, 1.25), C.navy);
  }
  if (fl.key === "main:4") {
    // quality meeting room: place settings, speaker, a credenza under the screen, a flip chart, a coat stand
    const t = f.tables.find((x) => x.dept === "qualite");
    if (t) dress("qualite", t, 2.0);
    F.credenza(kit.at(-17.5, -12.44 + 0.46 + 0.05, 0), 2.2, C.oak);
    kit.solids.push({ x0: -18.6, x1: -16.4, z0: -12.44, z1: -11.93, h: 0.72, kind: "credenza" });
    const fc = kit.at(-24.3, -9.6, PI / 2 + 0.35);
    for (const [x, z] of [[-0.3, 0.15], [0.3, 0.15], [0, -0.3]] as const) fc.box("metal", C.steel, x, 0.9, z, 0.03, 1.8, 0.03, { pitch: z > 0 ? 0.1 : -0.15 });
    fc.box("satin", C.white, 0, 1.4, 0.2, 0.7, 0.95, 0.02);
    fc.quad("print", PR.boardB, 0, 1.4, 0.212, 0.66, 0.9, {});
    kit.solids.push({ x0: -24.7, x1: -23.9, z0: -10.0, z1: -9.2, h: 1.9, kind: "flip chart" });
    F.coatStand(kit.at(-11.0, -3.6), C.sand);
  }
  if (fl.key === "annex:2") {
    // HR meeting room behind its 2.2 m walls: place settings, speaker, a screen on the wall, a credenza under it
    const t = f.tables.find((x) => x.dept === "siege-rh");
    if (t) dress("siege-rh", t, 2.2);
    const w = kit.at(6.0, 1.94, PI);
    w.box("satin", C.black, 0, 1.45, 0, 1.64, 0.96, 0.05);
    w.quad("screen", SC.meeting, 0, 1.45, 0.026, 1.58, 0.9);
    F.credenza(kit.at(6.0, 1.94 - 0.03, PI), 1.8, C.oak);
    kit.solids.push({ x0: 5.1, x1: 6.9, z0: 1.4, z1: 1.94, h: 0.72, kind: "credenza" });
    F.plant(kit.at(9.9, 1.5), 0.85, "round");
  }
  if (fl.key === "annex:1") {
    // finance: the small meeting table gets its chairs, settings and a speaker
    const t = f.tables.find((x) => x.dept === "siege-finance");
    if (t) {
      const ft = kit.at(t.x, t.z, t.yaw);
      for (const [lx, lz, dy] of [[-0.75, -1.0, 0], [0.75, -1.0, 0], [-0.75, 1.0, PI], [0.75, 1.0, PI]] as const) {
        const c = ft.sub(lx, lz, dy);
        c.box("satin", C.fabric, 0, 0.46, 0, 0.52, 0.08, 0.5); c.box("satin", C.fabric, 0, 0.82, -0.25, 0.5, 0.56, 0.07);
        c.box("metal", C.grey, 0, 0.22, 0, 0.07, 0.42, 0.07); c.cyl("metal", C.grey, 0, 0.025, 0, 0.56, 0.05);
        c.seat(0, 0.02, 0.5, "chair");
        F.placeSetting(c, 0.77, 0.55);
      }
      F.confSpeaker(ft, 0, 0.77, 0);
    }
  }
  if (fl.key === "annex:3") {
    const t = f.tables.find((x) => x.dept === "siege-pilotage");
    if (t) dress("siege-pilotage", t, 2.6);
  }
}

// ================================================================= corridors
function corridors(kit: Kit, pl: Placer, fl: FloorLayout) {
  const ft = features(fl);
  if (fl.building !== "main" || fl.floor < -1) return;
  // inner walls facing a corridor: handrails between doors, sign plates and flag signs at doors
  type Run = { along: "x" | "z"; at: number; n: number; a0: number; a1: number; dept: string };
  const runs: Run[] = [];
  for (const d of fl.depts) {
    const [cx, cz, w, dd] = d.rect;
    const s = Math.abs(cz) < 0.01 ? 1 : cz < 0 ? 1 : -1;
    if (fl.floor === 4) {
      // the corridor runs north-south at x = 0
      const xw = d.id === "qualite" ? cx + w / 2 : cx - w / 2;
      runs.push({ along: "z", at: xw, n: d.id === "qualite" ? 1 : -1, a0: cz - dd / 2, a1: cz + dd / 2, dept: d.id });
      continue;
    }
    if (fl.floor === 3) {
      if (d.id === "hospitalisation") { runs.push({ along: "z", at: cx + w / 2, n: 1, a0: cz - dd / 2, a1: cz + dd / 2, dept: d.id }); continue; }
      runs.push({ along: "x", at: cz + (dd / 2) * s, n: s, a0: cx - w / 2, a1: cx + w / 2, dept: d.id });
      continue;
    }
    runs.push({ along: "x", at: cz + (dd / 2) * s, n: s, a0: cx - w / 2, a1: cx + w / 2, dept: d.id });
  }
  const doorsOn = (r: Run) => ft.doors.filter((d) => d.dept === r.dept && d.along === r.along && Math.abs((r.along === "x" ? d.z : d.x) - r.at) < 0.1);
  for (const r of runs) {
    const doors = doorsOn(r);
    const cuts = doors.map((d) => { const c = r.along === "x" ? d.x : d.z; return [c - d.w / 2 - 0.15, c + d.w / 2 + 0.15] as [number, number]; });
    // handrail runs
    let t = r.a0 + 0.2;
    const segs: [number, number][] = [];
    for (const [a, b] of cuts.sort((p, q) => p[0] - q[0])) { if (a - t > 0.5) segs.push([t, a]); t = b; }
    if (r.a1 - 0.2 - t > 0.5) segs.push([t, r.a1 - 0.2]);
    // the frame's local x runs along the wall: for a wall along x facing −z (yaw π), or along z, it is mirrored
    const local = (a: number, b: number): [number, number] => (r.along === "x" ? (r.n > 0 ? [a, b] : [-b, -a]) : r.n > 0 ? [-b, -a] : [a, b]);
    const wf = r.along === "x" ? wallAt(kit, 0, r.at, 0, r.n) : wallAt(kit, r.at, 0, r.n, 0);
    for (const [a, b] of segs) F.handrail(wf, ...local(a, b));
    // skirting, wainscot and the department's wayfinding stripe on the whole wall (between doors)
    const tone = kindTone(r.dept);
    let u = r.a0 + 0.06;
    const fin: [number, number][] = [];
    for (const [a, b] of cuts.sort((p, q) => p[0] - q[0])) { if (a + 0.15 - u > 0.3) fin.push([u, a + 0.15]); u = b - 0.15; }
    if (r.a1 - 0.06 - u > 0.3) fin.push([u, r.a1 - 0.06]);
    for (const [a, b] of fin) F.wallFinish(wf, ...local(a, b), tone, (fn) => hiOn(kit, fn));
    // signs at each door: plate on the wall beside the door, projecting flag sign above its edge
    hiOn(kit, () => {
      for (const d of doors) {
        const c = r.along === "x" ? d.x : d.z;
        const side = c + d.w / 2 + 0.7 < r.a1 ? 1 : -1;
        const pc = c + side * (d.w / 2 + 0.62);
        const pf = r.along === "x" ? wallAt(kit, pc, r.at, 0, r.n) : wallAt(kit, r.at, pc, r.n, 0);
        F.signPlate(pf, r.dept, 0, 1.75, 0.0, 0.7);
        const ff = r.along === "x" ? kit.at(c - side * (d.w / 2 + 0.05), r.at + r.n * 0.06, 0) : kit.at(r.at + r.n * 0.06, c - side * (d.w / 2 + 0.05), PI / 2);
        // flag sign: double sided, perpendicular to the wall
        if (r.along === "x") F.flagSign(kit.at(c - side * (d.w / 2 + 0.05), r.at + r.n * 0.06, r.n > 0 ? 0 : PI), r.dept, 0.36, 2.45);
        else F.flagSign(kit.at(r.at + r.n * 0.06, c - side * (d.w / 2 + 0.05), r.n > 0 ? PI / 2 : -PI / 2), r.dept, 0.36, 2.45);
        void ff;
      }
    });
  }
  // per floor: extinguishers, AED, clock, notice board, exit signs, a plant at the blind end
  const along = fl.floor === 4 ? "z" : "x";
  const runA = runs.find((r) => r.along === along && r.n > 0 && r.dept !== "hospitalisation");
  const runB = runs.find((r) => r.along === along && r.n < 0);
  const at = (r: Run | undefined, c: number, fn: (f: Frame) => void) => {
    if (!r) return;
    const f = r.along === "x" ? wallAt(kit, c, r.at, 0, r.n) : wallAt(kit, r.at, c, r.n, 0);
    fn(f);
  };
  // choose spots away from doors
  const freeAlong = (r: Run | undefined, prefer: number) => {
    if (!r) return prefer;
    const doors = doorsOn(r).map((d) => (r.along === "x" ? d.x : d.z));
    let best = prefer, bestD = -1;
    for (let c = r.a0 + 1; c <= r.a1 - 1; c += 0.25) {
      const dd = Math.min(...doors.map((x) => Math.abs(x - c)), 99);
      if (dd < 1.9) continue;
      const score = -Math.abs(c - prefer);
      if (bestD < 0 || score > bestD) { bestD = score; best = c; }
    }
    return best;
  };
  if (fl.floor !== 3) {
    at(runA, freeAlong(runA, -12), (f) => F.extinguisher(f, 0, 0.11));
    at(runB, freeAlong(runB, 12), (f) => F.extinguisher(f, 0, 0.11));
  } else {
    // the ward: extinguisher and AED by the station; lits/cadres corridor on the right half
    at(runs.find((r) => r.dept === "lits"), 22.5, (f) => F.extinguisher(f, 0, 0.11));
  }
  hiOn(kit, () => {
    at(runB, freeAlong(runB, -6), (f) => F.aed(f, 0, 1.35, 0.09));
    at(runA, freeAlong(runA, 6), (f) => F.clock(f, 0, 2.35, 0.03));
    at(runB, freeAlong(runB, 20), (f) => F.noticeBoard(f, 0, 1.55, 0.02, 1.0, 0.72));
    at(runA, freeAlong(runA, -20), (f) => F.poster(f, PR.care, 0, 1.55, 0.01, 0.42, 0.52));
    // exit pictograms hung from the ceiling over the corridor, toward the stair tower
    if (fl.floor === 4) { F.exitSign(kit.at(0, 8, 0)); F.exitSign(kit.at(0, -8, 0)); }
    else if (fl.floor !== 3) { for (const x of [-14, 8, 22]) F.exitSign(kit.at(x, 0, PI / 2)); }
    else for (const x of [6, 20]) F.exitSign(kit.at(x, 0, PI / 2));
  });
  // plant at the blind (west) end of the corridor
  if (fl.floor !== 3 && fl.floor !== 4) F.plant(kit.at(-25.55, 0, 0), 0.8, "snake");

  // the ward corridor (floor 3): handrails along the room fronts, signs, clock and notice board above the station
  if (fl.floor === 3) {
    const doors = [-19.83, -11.5, -3.17];
    for (const side of [-1, 1]) {
      const zf = side * 4.6, n = -side; // face of the room wall toward the ward corridor
      let t = -25.3;
      for (const dx of doors) { if (dx - 0.8 - t > 0.5) { const f = wallAt(kit, 0, zf, 0, n); F.handrail(f, n > 0 ? t : -(dx - 0.8), n > 0 ? dx - 0.8 : -t); } t = dx + 0.8; }
      { const f = wallAt(kit, 0, zf, 0, n); F.handrail(f, n > 0 ? t : -0.8, n > 0 ? -0.8 : -t); }
      hiOn(kit, () => {
        for (const dx of doors) {
          const w = wallAt(kit, dx + 1.05, zf, 0, n);
          F.sanitiser(w, 0, 1.25, 0.05);
          w.box("satin", C.navy, 0, 1.75, 0.012, 0.3, 0.12, 0.02);
          w.box("glow", C.ledBlue, 0, 1.75, 0.024, 0.2, 0.025, 0.004);
        }
        // above the doors: the nurse-call corridor light
        for (const dx of doors) { const w = wallAt(kit, dx, zf, 0, n); w.box("satin", C.white, 0, 2.3, 0.04, 0.18, 0.08, 0.06); w.box("glow", C.ledGreen, 0, 2.3, 0.072, 0.12, 0.04, 0.004); }
      });
    }
    hiOn(kit, () => {
      const w = wallAt(kit, -13.0, -4.6, 0, 1);
      F.clock(w, 0, 2.35, 0.03, 0.36);
      F.noticeBoard(w, -3.4, 1.55, 0.02, 1.1, 0.78);
      F.aed(wallAt(kit, -7.0, 4.6, 0, -1), 0, 1.35, 0.09);
      F.signPlate(wallAt(kit, -0.5, 2.3, 1, 0), "hospitalisation", 0, 1.75, 0, 0.8);
      F.extinguisher(wallAt(kit, -0.5, -2.3, 1, 0), 0, 0.11);
    });
    F.extinguisher(wallAt(kit, -24.6, 4.6, 0, -1), 0, 0.11);
    F.plant(kit.at(-1.2, 3.6), 0.85, "round");
  }
}

// ================================================================= door frames (first person): every department door and the inner doors
function doorFrames(kit: Kit, fl: FloorLayout) {
  const put = (x: number, z: number, w: number, along: "x" | "z", leaf = false, into = 1) => hiOn(kit, () => {
    // frame yaw: the leaf swings toward local +z (into the room when `into` points there)
    const yaw = along === "x" ? (into > 0 ? 0 : PI) : into > 0 ? PI / 2 : -PI / 2;
    F.doorFrame(kit.at(x, z, yaw), w, leaf, leaf ? C.oak : C.light);
  });
  for (const d of features(fl).doors) put(d.x, d.z, d.w, d.along);
  if (fl.key === "main:3") for (const side of [-1, 1]) for (const dx of [-19.83, -11.5, -3.17]) put(dx, side * 4.6, 1.3, "x", true, side);
  if (fl.key === "main:1") for (const dx of [-21.9, -12.76]) put(dx, 7.1, 1.6, "x", true, 1);
  if (fl.key === "main:4") put(-13.41, -3.0, 1.6, "x", true, -1);
  if (fl.key === "annex:2") put(1.5, -0.1, 1.4, "z", true, 1);
}

// ================================================================= ground floor: café corner, vending, waiting
function ground(kit: Kit, pl: Placer) {
  // snack machine next to the existing drinks machine
  const v = kit.at(-7.38, 5.05, PI / 2);
  v.rbox("satin", C.dark, 0, 0.95, 0, 0.85, 1.9, 0.75);
  v.box("glass", C.glass, -0.08, 1.12, 0.38, 0.58, 1.35, 0.01);
  v.quad("screen", SC.vending, -0.08, 1.12, 0.376, 0.56, 1.3);
  v.box("satin", C.black, 0.3, 1.25, 0.38, 0.14, 0.3, 0.01);
  v.box("satin", C.ink, -0.08, 0.3, 0.38, 0.5, 0.16, 0.02);
  v.solid(-0.43, 0.43, -0.38, 0.4, 1.9, "vending machine");
  // café counter with espresso machine, pastry display, cups, menu pictogram
  const c = kit.at(-7.72, 9.8, PI / 2);
  c.rbox("satin", C.white, 0, 0.5, 0, 1.7, 1.0, 0.62);
  c.box("satin", C.oak, 0, 1.02, 0.02, 1.76, 0.05, 0.68);
  c.box("satin", C.oak, 0, 0.5, 0.315, 1.7, 0.9, 0.01);
  F.espressoMachine(c.sub(-0.45, -0.05), 1.045);
  const g = c.sub(0.35, 0.05);
  g.box("glass", C.glass, 0, 1.2, 0, 0.6, 0.3, 0.4);
  for (let i = 0; i < 5; i++) g.sph("matte", i % 2 ? C.amber : 0xd9b27a, -0.2 + i * 0.1, 1.09, (i % 2) * 0.08 - 0.04, 0.09, 0.05, 0.07);
  for (let i = 0; i < 6; i++) F.mug(c, 0.75 - (i % 3) * 0.09, 1.045, -0.18 + Math.floor(i / 3) * 0.1, C.white);
  c.solid(-0.88, 0.88, -0.34, 0.36, 1.1, "café counter");
  const m = kit.at(-8.05, 9.8, PI / 2);
  F.poster(m, PR.cup, 0, 1.75, 0.0, 0.42, 0.42, C.oak);
  // bistro tables (two chairs each, seats registered)
  for (const [tx, tz] of [[-6.25, 10.15], [-5.6, 11.75]] as const) {
    const t = kit.at(tx, tz, 0);
    t.cyl("satin", C.oak, 0, 0.74, 0, 0.66, 0.04);
    t.cyl("metal", C.dark, 0, 0.37, 0, 0.06, 0.72);
    t.cyl("metal", C.dark, 0, 0.02, 0, 0.42, 0.03);
    t.solid(-0.35, 0.35, -0.35, 0.35, 0.76, "bistro table");
    for (const s of [-1, 1]) {
      const ch = t.sub(s * 0.58, 0, s > 0 ? -PI / 2 : PI / 2);
      for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]] as const) ch.box("metal", C.dark, x, 0.23, z, 0.025, 0.46, 0.025);
      ch.rbox("satin", C.terracotta, 0, 0.47, 0, 0.42, 0.05, 0.42);
      ch.box("metal", C.dark, 0, 0.75, -0.2, 0.4, 0.42, 0.02);
      ch.seat(0, 0.03, 0.495, "chair");
    }
    F.mug(t, -0.12, 0.76, 0.05, C.white);
  }
  // wheelchairs for visitors by the entrance, a second water fountain, waiting-area magazines, a plant
  F.wheelchairPark(kit.at(7.3, 9.6, -PI / 2), 2);
  kit.solids.push({ x0: 6.8, x1: 7.8, z0: 8.9, z1: 10.3, h: 1.0, kind: "wheelchairs" });
  const mt = kit.at(6.1, 5.45, 0);
  mt.rbox("satin", C.oak, 0, 0.42, 0, 0.6, 0.04, 0.6); mt.box("metal", C.dark, 0, 0.2, 0, 0.05, 0.4, 0.05);
  for (let i = 0; i < 3; i++) mt.box("matte", [C.coral, C.medBlue, C.cream][i], -0.1 + i * 0.08, 0.45 + i * 0.008, 0.05 * i, 0.22, 0.008, 0.3, { yaw: i * 0.3 });
  mt.solid(-0.3, 0.3, -0.3, 0.3, 0.45, "low table");
  hiOn(kit, () => {
    F.clock(wallAt(kit, 0, 0.5, 0, 1), -2.4, 2.4, 0.03, 0.42);
    F.signPlate(wallAt(kit, 1.9, 0.5, 0, 1), "accueil", 0, 1.75, 0, 0.8);
  });
  void pl;
}

// ================================================================= head office annex
function annex(kit: Kit, pl: Placer, fl: FloorLayout) {
  if (fl.key === "annex:3") {
    // ---------- direction office (front-left corner), glazed partitions with a door toward the command center
    const X0 = -10.44, X1 = -4.6, Z0 = 1.6, Z1 = 8.44;
    const glass = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
      const f = kit.at((x0 + x1) / 2, (z0 + z1) / 2, yaw);
      f.box("satin", C.white, 0, 0.05, 0, 0.08, 0.1, len);
      f.box("glass", C.glass, 0, 0.55, 0, 0.03, 0.9, len);
      f.box("satin", C.white, 0, 1.0, 0, 0.07, 0.04, len);
      f.box("matte", 0xe6ebf1, 0, 0.62, 0, 0.034, 0.12, len);
      hiOn(kit, () => { f.box("glass", C.glass, 0, 2.0, 0, 0.03, 1.96, len); f.box("satin", C.white, 0, 2.97, 0, 0.07, 0.05, len); });
      kit.solids.push({ x0: Math.min(x0, x1) - 0.05, x1: Math.max(x0, x1) + 0.05, z0: Math.min(z0, z1) - 0.05, z1: Math.max(z0, z1) + 0.05, h: 3.0, kind: "glass partition" });
    };
    glass(X0, Z0, X1, Z0);
    glass(X1, Z0, X1, 2.3);
    glass(X1, 3.35, X1, Z1);
    // door leaf left ajar
    const dl = kit.at(X1 + 0.02, 2.32, PI / 2 + 0.9);
    dl.box("glass", C.glass, 0, 1.0, 0.5, 0.03, 2.0, 1.0); dl.box("metal", C.chrome, 0.03, 1.0, 0.9, 0.02, 0.4, 0.02);
    // executive desk facing the door (the director's chair against the bookcase)
    const ed = kit.at(-8.35, 4.6, PI / 2);
    F.execDesk(ed);
    ed.solid(-1.0, 1.0, -0.46, 0.46, 0.8, "executive desk");
    F.leatherChair(kit.at(-9.3, 4.6, PI / 2));
    kit.solids.push({ x0: -9.65, x1: -8.95, z0: 4.25, z1: 4.95, h: 1.4, kind: "chair" });
    for (const dz of [-0.55, 0.55]) { const g = kit.at(-7.25, 4.6 + dz, -PI / 2 + dz * 0.25); F.guestChair(g); g.solid(-0.27, 0.27, -0.27, 0.3, 1.0, "guest chair"); }
    F.bookcase(kit.at(X0 + 0.42, 4.6, PI / 2), 1.8, 2.0);
    kit.solids.push({ x0: X0, x1: X0 + 0.42, z0: 3.7, z1: 5.5, h: 2.0, kind: "bookcase" });
    // lounge by the façade: sofa, lounge chair, coffee table with a tea set, Moroccan rug
    F.rug(kit.at(-7.45, 6.95, 0), 2.7, 1.75);
    F.sofa(kit.at(-7.45, 8.44 - 0.5, PI), 2.1, C.sand);
    kit.solids.push({ x0: -8.55, x1: -6.35, z0: 7.5, z1: 8.44, h: 0.9, kind: "sofa" });
    F.coffeeTable(kit.at(-7.45, 6.85, 0));
    kit.solids.push({ x0: -8.05, x1: -6.85, z0: 6.52, z1: 7.18, h: 0.45, kind: "coffee table" });
    F.lounge(kit.at(-5.45, 6.75, -PI / 2 - 0.2), C.cognac);
    kit.solids.push({ x0: -5.9, x1: -5.0, z0: 6.3, z1: 7.2, h: 0.9, kind: "lounge chair" });
    // credenza with art leaning on it, plants
    const cr = kit.at(-7.6, Z0 + 0.52, 0);
    F.credenza(cr, 1.8, C.walnut);
    F.art(cr, PR.art3, -0.25, 1.15, -0.32, 0.9, 0.44, C.ink);
    F.plant(cr.sub(0.6, -0.2, 0, 0.74), 0.45, "round", C.cream);
    kit.solids.push({ x0: -8.5, x1: -6.7, z0: Z0, z1: Z0 + 0.52, h: 0.75, kind: "credenza" });
    F.plant(kit.at(-5.15, 2.15), 1.15, "olive", C.terracotta);
    hiOn(kit, () => {
      F.art(wallAt(kit, -7.45, Z1, 0, -1), PR.art1, -0.6, 1.75, 0.01, 0.55, 0.7, C.ink);
      F.art(wallAt(kit, -7.45, Z1, 0, -1), PR.art2, 0.6, 1.75, 0.01, 0.55, 0.7, C.ink);
      F.clock(wallAt(kit, X0, 6.9, 1, 0), 0, 2.2, 0.03, 0.3);
    });
    // ---------- Agentic Command Center: consoles flanking the wall screen, status strip, plants, coffee corner
    for (const s of [-1, 1]) {
      const f = kit.at(s * 6.0, -4.3, s < 0 ? 2.7 : -2.7);
      F.consoleDesk(f, s < 0 ? SC.ops : SC.opsB, s < 0 ? SC.opsB : SC.ops);
      f.solid(-0.86, 0.86, -1.1, 0.42, 1.3, "console");
    }
    const strip = kit.at(0, -7.98, 0);
    strip.box("satin", C.ink, 0, 0.62, 0, 7.0, 0.07, 0.03);
    strip.quad("screen", SC.strip, 0, 0.62, 0.017, 6.9, 0.045);
    strip.box("glow", C.softBlue, 0, 3.64, 0.02, 7.0, 0.018, 0.01);
    for (const s of [-1, 1]) F.plant(kit.at(s * 4.5, -7.55), 1.2, "tall");
    // coffee corner by the front façade
    const cc = kit.at(7.4, 8.44 - 0.33, PI);
    cc.rbox("satin", C.white, 0, 0.45, 0, 1.8, 0.9, 0.6);
    cc.box("satin", C.oak, 0, 0.92, 0, 1.86, 0.04, 0.64);
    cc.box("matte", C.light, 0.55, 0.45, 0.301, 0.55, 0.8, 0.004);
    F.espressoMachine(cc.sub(-0.5, 0.02), 0.94);
    F.kettleSet(cc.sub(0.35, 0.05), 0.94);
    cc.cyl("satin", C.cream, 0.75, 1.02, 0.1, 0.14, 0.16);
    cc.solid(-0.93, 0.93, -0.32, 0.32, 1.0, "coffee counter");
    F.waterDispenser(kit.at(5.95, 8.1, PI));
    kit.solids.push({ x0: 5.75, x1: 6.15, z0: 7.9, z1: 8.3, h: 1.5, kind: "water" });
    const ht = kit.at(7.4, 6.55, 0);
    ht.cyl("satin", C.oak, 0, 1.05, 0, 0.6, 0.04); ht.cyl("metal", C.dark, 0, 0.53, 0, 0.06, 1.04); ht.cyl("metal", C.dark, 0, 0.02, 0, 0.45, 0.03);
    F.mug(ht, 0.1, 1.07, 0.05, C.white); F.mug(ht, -0.12, 1.07, -0.06, C.navy);
    ht.solid(-0.3, 0.3, -0.3, 0.3, 1.07, "standing table");
    // credenza along the east wall, a notice board, clock
    F.credenza(kit.at(10.44 - 0.46 - 0.02, -1.0, -PI / 2), 2.0, C.oak);
    kit.solids.push({ x0: 9.96, x1: 10.44, z0: -2.0, z1: 0.0, h: 0.72, kind: "credenza" });
    F.plant(kit.at(9.95, -2.6), 0.6, "round");
    hiOn(kit, () => {
      F.clock(wallAt(kit, -10.44, -4.0, 1, 0), 0, 2.4, 0.03, 0.38);
      F.noticeBoard(wallAt(kit, 10.44, 1.8, -1, 0), 0, 1.6, 0.02, 1.1, 0.78);
    });
  }
  if (fl.key === "annex:0") {
    // reception of the head office: a mail trolley, plants, a visitors' bench already there, a notice board
    const mt = kit.at(-8.4, 4.6, PI / 2);
    for (const x of [-0.4, 0.4]) for (const z of [-0.25, 0.25]) mt.cyl("satin", C.dark, x, 0.05, z, 0.08, 0.06);
    mt.box("metal", C.steel, 0, 0.12, 0, 0.9, 0.03, 0.55);
    for (let i = 0; i < 2; i++) mt.box("satin", C.medBlue, 0, 0.35 + i * 0.32, 0, 0.86, 0.26, 0.5);
    for (let i = 0; i < 6; i++) mt.box("matte", C.paper, -0.3 + (i % 3) * 0.3, 0.52 + Math.floor(i / 3) * 0.32, 0, 0.22, 0.012, 0.32);
    kit.solids.push({ x0: -8.7, x1: -8.1, z0: 4.1, z1: 5.1, h: 0.9, kind: "mail trolley" });
  }
  // every annex floor: signs by the doors, extinguisher, AED near the stair door (first person)
  hiOn(kit, () => {
    const id = fl.depts[0]?.id;
    if (!id) return;
    F.signPlate(kit.at(1.9, 8.5 + 0.06, 0), id, 0, 1.75, 0, 0.8);
    F.signPlate(kit.at(-1.9, 8.5 - 0.06, PI), id, 0, 1.75, 0, 0.8);
    F.aed(kit.at(10.44, 2.6, -PI / 2), 0, 1.35, 0.09);
    F.exitSign(kit.at(9.4, 4.5, PI / 2));
  });
  F.extinguisher(kit.at(10.44, 6.0, -PI / 2), 0, 0.11);
  void pl;
}

// ================================================================= the crowd (visitors, families, patients) — never staff
const NOBODY: CrowdSpec = { seated: [], standing: [], walkers: [] };
function crowd(fl: FloorLayout, kit: Kit, pl: Placer): CrowdSpec {
  const ft = features(fl);
  const out: CrowdSpec = { seated: [], standing: [], walkers: [] };
  const lk = (seed: string, o?: Partial<Look>) => lookFor(hash(seed), o);
  const sitOn = (s: { x: number; z: number; yaw: number; top: number }, seed: string, act: CrowdSpec["seated"][number]["act"] = "rest", o?: Partial<Look>) =>
    out.seated.push({ x: s.x, z: s.z, yaw: s.yaw, top: s.top, act, look: lk(seed, o), seed: hash(seed) % 1000 });
  const free = (dept: string, kind?: string) => ft.seats.filter((s) => s.dept === dept && !s.taken && !s.desk && (!kind || s.kind === kind));
  const mine = (pred: (s: { x: number; z: number }) => boolean, kind?: string) => kit.seats.filter((s) => pred(s) && (!kind || s.kind === kind));
  const stand = (x: number, z: number, yaw: number, seed: string, act: CrowdSpec["standing"][number]["act"] = "idle", o?: Partial<Look>) =>
    out.standing.push({ x, z, yaw, act, look: lk(seed, o), seed: hash(seed) % 1000 });
  const walk = (w: Omit<Walker, "members"> & { members: Member[] }) => { out.walkers.push(w); pl.lane(w.path[0], w.path[1], w.path[2], w.path[3], 0.6); };

  if (fl.key === "main:0") {
    // waiting rows of the hall: families next to the waiting patients, a second row filling up
    const a = free("accueil", "row");
    const east = a.filter((s) => s.x > 0), west = a.filter((s) => s.x < 0);
    sitOn(west[0], "acc-w0", "phone", { scarf: true });
    sitOn(east[0], "acc-e0", "rest", { long: true });
    sitOn(east[1], "acc-e1", "talk");
    sitOn(east[3], "acc-e3", "read", { scarf: true, long: true });
    // café: two at a table, one at the other, one buying a coffee, one at the vending machine
    const cafe = mine((s) => s.x < -4.5 && s.z > 9);
    if (cafe[0]) sitOn(cafe[0], "cafe-0", "cup");
    if (cafe[1]) sitOn(cafe[1], "cafe-1", "talk", { scarf: true });
    if (cafe[3]) sitOn(cafe[3], "cafe-3", "phone");
    stand(-6.75, 9.55, -PI / 2, "cafe-buy", "idle");
    stand(-6.65, 5.05, -PI / 2, "vending", "idle", { long: true });
    // the front desk: a couple queuing behind the patient at the counter
    stand(-1.25, 7.35, PI, "queue-0", "idle", { scarf: true });
    stand(-0.6, 7.6, PI + 0.2, "queue-1", "idle");
    stand(1.55, 6.3, PI, "desk-2", "talk", { long: true });
    // admissions waiting row, cashier's waiting row
    const ad = free("admissions", "row");
    sitOn(ad[0], "adm-0", "rest", { scarf: true });
    sitOn(ad[1], "adm-1", "child", { kid: true });
    sitOn(ad[3], "adm-3", "phone");
    const ca = free("caisse", "row");
    sitOn(ca[0], "cai-0", "read");
    sitOn(ca[2], "cai-2", "rest", { long: true, scarf: true });
    // emergencies: a family waiting
    const ur = mine((s) => s.x > 9 && s.x < 11 && s.z > 8);
    if (ur[0]) sitOn(ur[0], "urg-0", "rest", { scarf: true });
    if (ur[1]) sitOn(ur[1], "urg-1", "phone");
    // walking in from the entrance: a family, a visitor pushing a wheelchair
    walk({ path: [2.55, 11.7, 2.25, 7.4], speed: 0.62, phase: 0.1, members: [
      { look: lk("fam-a"), dx: 0, dz: 0, role: "walk" },
      { look: lk("fam-b", { kid: true }), dx: 0.42, dz: -0.05, role: "walk" },
    ] });
    walk({ path: [-2.65, 11.4, -2.65, 7.6], speed: 0.5, phase: 0.55, members: [
      { look: lk("wc-sit", { long: true }), dx: 0, dz: 0, role: "wheel" },
      { look: lk("wc-push"), dx: 0, dz: -0.82, role: "push" },
    ] });
  }
  if (fl.key === "main:1") {
    const c = free("consultations", "row");
    sitOn(c[0], "cons-0", "rest", { scarf: true });
    sitOn(c[1], "cons-1", "read");
  }
  if (fl.key === "main:2") {
    // maternity: the father in the armchair next to each mother; an ICU family member at the bedside
    const arm = free("maternite", "arm");
    if (arm[0]) sitOn(arm[0], "mat-0", "phone");
    if (arm[1]) sitOn(arm[1], "mat-1", "baby", { scarf: true, long: true });
    const icu = mine((s) => s.z < -6 && s.x > 0);
    if (icu[0]) sitOn(icu[0], "icu-0", "rest", { scarf: true, long: true });
    if (icu[2]) sitOn(icu[2], "icu-2", "rest");
    walk({ path: [-21.0, 1.75, -15.2, 1.75], speed: 0.45, phase: 0.3, members: [
      { look: lk("mat-walk", { scarf: true, long: true }), dx: 0, dz: 0, role: "walk" },
      { look: lk("mat-walk-b"), dx: 0.5, dz: 0.05, role: "walk" },
    ] });
  }
  if (fl.key === "main:3") {
    // families at the bedsides (armchairs and visitor chairs), a patient walking with an IV pole, a wheelchair
    const arm = free("hospitalisation", "arm");
    [0, 2, 3, 5].forEach((i, k) => arm[i] && sitOn(arm[i], "ward-arm" + i, (["talk", "rest", "read", "phone"] as const)[k], k % 2 ? { scarf: true, long: true } : {}));
    const vis = mine((s) => s.x < -0.5);
    if (vis[1]) sitOn(vis[1], "ward-vis1", "talk");
    if (vis[4]) sitOn(vis[4], "ward-vis4", "rest", { scarf: true });
    walk({ path: [-22.6, 3.55, -15.6, 3.55], speed: 0.32, phase: 0.2, members: [
      { look: lk("iv-patient", { gown: true }), dx: 0, dz: 0, role: "iv" },
      { look: lk("iv-family", { scarf: true, long: true }), dx: 0.55, dz: -0.05, role: "walk" },
    ] });
    walk({ path: [-10.2, -3.55, -3.6, -3.55], speed: 0.42, phase: 0.65, members: [
      { look: lk("ward-wc", { gown: true }), dx: 0, dz: 0, role: "wheel" },
      { look: lk("ward-wc-push"), dx: 0, dz: -0.82, role: "push" },
    ] });
  }
  if (fl.key === "main:4") {
    const q = free("qualite", "row");
    sitOn(q[0], "qual-0", "rest", { long: true });
    sitOn(q[1], "qual-1", "phone", { scarf: true });
  }
  if (fl.key === "annex:0") {
    const r = free("siege-generaux", "row");
    sitOn(r[1], "siege-0", "read");
  }
  if (fl.key === "annex:3") {
    const sofa = mine((s) => s.x < -4.6 && s.z > 6);
    if (sofa[2]) sitOn(sofa[2], "dir-guest", "read");
    stand(7.05, 6.2, PI * 0.25, "cc-guest-a", "cup");
    stand(7.85, 6.95, -PI * 0.75, "cc-guest-b", "talk", { scarf: true });
  }
  return out;
}

// ================================================================= assembly
function buildFloor(fl: FloorLayout): FloorProps {
  const kit = new Kit();
  const pl = new Placer(fl, kit);
  // lanes and crowd first (so nothing is placed in their way), then the rooms
  const spec = { key: fl.key };
  void spec;
  const ft = features(fl);
  ft.beds.forEach((b, k) => bedRoom(kit, pl, fl, b, k));
  wardRooms(kit, pl, fl);
  stations(kit, pl, fl);
  clinical(kit, pl, fl);
  if (fl.key === "main:0") ground(kit, pl);
  if (fl.building === "annex") annex(kit, pl, fl);
  if (fl.key === "main:4") buildTwin(kit);
  meeting(kit, fl);
  deskAccessories(kit, fl);
  const people = crowd(fl, kit, pl);
  corridors(kit, pl, fl);
  doorFrames(kit, fl);
  supplies(kit, pl, fl);
  officeKit(kit, pl, fl);
  return { key: fl.key, building: fl.building, floor: fl.floor, kit, crowd: people ?? NOBODY };
}

const BUILT = new Map<string, FloorProps>();
/** One floor's props (computed once, on demand). */
export function propsOf(key: string): FloorProps | null {
  const hit = BUILT.get(key);
  if (hit) return hit;
  const fl = FLOOR_LAYOUTS.find((f) => f.key === key);
  if (!fl) return null;
  const fp = buildFloor(fl);
  BUILT.set(key, fp);
  return fp;
}
/** All floors' props. */
export function allProps(): FloorProps[] { return FLOOR_LAYOUTS.map((f) => propsOf(f.key)!); }
export type { DoorF };
void yawOf;
