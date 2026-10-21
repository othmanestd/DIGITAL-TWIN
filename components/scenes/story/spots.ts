// Where the story happens: named spots in the BUILDING FRAME of lib/hospital (metres; main building centred on (0, 0),
// head-office annex on (46, −2); y = floor × FLOOR_H), and the camera shots of the guided visit.
// Spot ids are the vocabulary of scripts/build-tour-v23.mjs (cast { at, from, via }, alerts, pings, flows "spot:…").
import { FLOOR_H } from "@/lib/hospital";

export type Spot = { floor: string; x: number; z: number; yaw: number; seat?: boolean };
const S = (floor: string, x: number, z: number, yaw = 0, seat = false): Spot => ({ floor, x, z, yaw, seat });
const PI = Math.PI;

export const SPOTS: Record<string, Spot> = {
  // forecourt, in front of the main entrance (outdoors): the cast is introduced here, facing the camera
  "fc-1": S("out", -4.0, 18.3, 0.12), "fc-2": S("out", -2.4, 17.8, 0.06), "fc-3": S("out", -0.8, 17.5, 0.02),
  "fc-4": S("out", 0.8, 17.5, -0.02), "fc-5": S("out", 2.4, 17.8, -0.06), "fc-6": S("out", 4.0, 18.3, -0.12),
  // ground floor: hall (accueil), admissions, standard, emergency waiting room
  "door-in": S("main:0", 0.2, 14.6, PI),
  "hall-mid": S("main:0", -6.5, 8.2, -2.0),
  "hall-plan": S("main:0", -3.75, 11.45, -2.63),
  "adm-desk": S("main:0", -17.4, 2.55, 0, true),
  "adm-pilot": S("main:0", -16.15, 3.05, -0.4),
  "adm-front": S("main:0", -17.3, 4.45, PI),
  "urg-wait": S("main:0", 17.3, 3.2, 0),
  "std-center": S("main:0", 0, -6.5, 0),
  // 3rd floor: nurse station, Amina's room (bed at x −5.9, armchair at x −3.1), the corridor
  "nurse-station": S("main:3", -12.9, -0.85, 0),
  "corr-e": S("main:3", -6.0, 2.6, 1.2),
  "room-door": S("main:3", -3.2, 4.6, PI),
  "room-in": S("main:3", -3.25, 6.3, PI),
  "room-bedside": S("main:3", -4.35, 8.05, PI / 2),
  "room-chair": S("main:3", -3.07, 8.2, -2.11, true),
  "corridor-fall": S("main:3", -9.2, 2.7, 0),
  "corridor-fall-help": S("main:3", -8.35, 2.95, -PI / 2),
  // 4th floor: technical management and the JABB Twin room
  "machine": S("main:4", 7.8, 4.5, 0),
  "machine-fix": S("main:4", 7.85, 5.75, PI),
  "tech-mid": S("main:4", 10.2, 0.4, PI),
  "twin-console": S("main:4", 12.7, -5.1, PI + 0.18),
  "pump": S("main:4", 23.6, -1.1, 0),
  // 1st floor: billing
  "billing-desk": S("main:1", -15.6, -3.95, 0, true),
  "billing-stand": S("main:1", -14.35, -3.35, -0.45),
  // head office
  "hq-finance": S("annex:1", 46, -2, 0),
  "cmd-desk": S("annex:3", 52.6, -4.4, -PI / 2, true),
  "cmd-screen": S("annex:3", 48.9, -7.35, PI + 0.12),
  "campus": S("out", 0, 6, 0),
};

/** Floor key → floor index (outdoors: ground). */
export const floorY = (key: string) => (key === "out" ? 0 : Number(key.split(":")[1]) * FLOOR_H);

/** A camera shot: look-at point (building frame, y absolute), distance, azimuth (around +Y, 0 = camera on the +z side),
 *  polar (from +Y), duration (s). `far` = a long "powers of ten" flight through the rig; `cut` = instant. */
export type Shot = { look: [number, number, number]; dist: number; az: number; pol: number; dur?: number; far?: boolean; cut?: boolean; group?: string };
const F = (f: number, h = 1.2) => f * FLOOR_H + h;
export const SHOTS: Record<string, Shot> = {
  sky: { look: [0, 1.2, 17.4], dist: 2400, az: 0.32, pol: 0.42, cut: true },
  glide: { look: [0, 1.25, 17.6], dist: 13.5, az: 0.04, pol: 1.34, dur: 10.5, far: true },
  cast: { look: [0, 1.15, 17.9], dist: 10.8, az: 0.02, pol: 1.37, dur: 3.2 },
  standard: { look: [0, F(0, 1.4), -6.6], dist: 15, az: 0.22, pol: 0.92, dur: 3 },
  hall: { look: [-3.5, F(0, 1.3), 11.0], dist: 7.2, az: 0.3, pol: 1.38, dur: 3 },
  admissions: { look: [-17.0, F(0, 1.1), 3.8], dist: 8.6, az: 0.42, pol: 1.0, dur: 3.2, group: "ydesk" },
  "admissions-wide": { look: [-17.2, F(0, 1.0), 4.4], dist: 13.5, az: 0.36, pol: 0.94, dur: 3, group: "ydesk" },
  station: { look: [-12.6, F(3, 1.2), -0.4], dist: 9.5, az: 0.38, pol: 1.0, dur: 3 },
  room: { look: [-4.3, F(3, 1.0), 7.9], dist: 9.0, az: 0.62, pol: 0.94, dur: 3.2 },
  corridor: { look: [-8.8, F(3, 0.6), 2.85], dist: 8, az: 2.5, pol: 1.0, dur: 2.6 },
  machine: { look: [8.1, F(4, 1.0), 4.9], dist: 9.0, az: 0.48, pol: 1.0, dur: 3, group: "machine" },
  twin: { look: [11.4, F(4, 1.6), -7.2], dist: 12.5, az: 0.16, pol: 1.08, dur: 3.2 },
  billing: { look: [-15.1, F(1, 1.1), -3.5], dist: 8.6, az: 0.32, pol: 1.0, dur: 3, group: "billing" },
  "hq-finance": { look: [46, F(1, 1.0), -2], dist: 23, az: 0.52, pol: 0.95, dur: 3.2 },
  command: { look: [48.6, F(3, 1.5), -6.6], dist: 11, az: 0.36, pol: 1.02, dur: 3.2 },
  "command-wide": { look: [47, F(3, 1.2), -3.5], dist: 19, az: 0.42, pol: 0.92, dur: 3.5 },
  // the finale card sits on the left: Leïla and the value wall stay in view on the right
  finale: { look: [46.4, F(3, 1.75), -7.0], dist: 9.2, az: 0.2, pol: 1.3, dur: 3.2 },
  campus: { look: [6, 8, 0], dist: 150, az: 0.62, pol: 1.02, dur: 4 },
};
