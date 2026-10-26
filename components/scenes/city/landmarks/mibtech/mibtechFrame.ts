// Where MIBTECH's plans sit in the scene (shared by the building drawing and walk mode).
// The plans' frame (x along the street front, z towards the street, origin = middle of the façade glass) is set on the front
// line found from the Google pins and the overhead view, the boulevard's bearing 40° (docs/research/mibtech-identification.md).
import { geoToScene } from "@/lib/geo/casaFrame";

const ROOF_PIN = geoToScene(33.5558823, -7.6435464);
export const THETA = (50 * Math.PI) / 180;                               // plan +x → along the boulevard (bearing 40°)
const U: [number, number] = [Math.cos(THETA), -Math.sin(THETA)];  // plan +x in the scene
const V: [number, number] = [Math.sin(THETA), Math.cos(THETA)];   // plan +z (towards the street) in the scene
/** scene position of the plans' origin (middle of the street façade glass) */
export const ORIGIN: [number, number] = [ROOF_PIN.x + 4.9 + 7 * V[0], ROOF_PIN.z + 1.3 + 7 * V[1]];
/** scene point → plan frame */
export const toPlan = (x: number, z: number): [number, number] => {
  const dx = x - ORIGIN[0], dz = z - ORIGIN[1];
  return [dx * U[0] + dz * U[1], dx * V[0] + dz * V[1]];
};
/** plan frame → scene point */
export const fromPlan = (x: number, z: number): [number, number] => [ORIGIN[0] + x * U[0] + z * V[0], ORIGIN[1] + x * U[1] + z * V[1]];
/** plan frame → scene offset from ORIGIN (no translation: directions, or walk mode's frame centred on ORIGIN) */
export const planVec = (x: number, z: number): [number, number] => [x * U[0] + z * V[0], x * U[1] + z * V[1]];
/** scene position (x, z) of the middle of the building, for the levels of detail */
export const CENTER = fromPlan(0, -14.5);
/** level of detail: the furnished floors within MB_NEAR (m) of the building's middle, the staff within MB_PEOPLE_NEAR */
export const MB_NEAR = 280, MB_PEOPLE_NEAR = 120;
/** Floor view (explore mode): 0 = the whole building; 1 … 3 = that floor open (MibtechBuilding mibtechShowFloor) */
export const MB_VIEW = { floor: 0 as 0 | 1 | 2 | 3 };
/** scene offset from ORIGIN → plan frame */
export const vecPlan = (x: number, z: number): [number, number] => [x * U[0] + z * U[1], x * V[0] + z * V[1]];
