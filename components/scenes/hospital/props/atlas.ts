// Atlas layout of the printed (matte) and screen (emissive) textures of the props — pure rectangles, so the generators
// can bake UVs without touching the DOM. The pixels are painted by tex.ts. UV rects are (u0, v0, u1, v1), v up.
import { DEPTS } from "@/lib/hospital";

export const PRINT_W = 2048, PRINT_H = 2048;
export const SCREEN_W = 2048, SCREEN_H = 1024;
export type Px = [number, number, number, number]; // x, y, w, h (canvas pixels, y down)
export type UV = [number, number, number, number];

// inset by 2 px so mipmaps do not bleed the neighbouring cells
const uvOf = (W: number, H: number) => ([x, y, w, h]: Px): UV => [(x + 2) / W, 1 - (y + h - 2) / H, (x + w - 2) / W, 1 - (y + 2) / H];

// ---------------------------------------------------------------- printed atlas
/** department sign plates: 4 columns × 8 rows of 512 × 112, in DEPTS order */
export const SIGN_PX = (i: number): Px => [(i % 4) * 512, Math.floor(i / 4) * 112, 512, 112];
export const SIGN_INDEX: Record<string, number> = Object.fromEntries(DEPTS.map((d, i) => [d.id, i]));
export const PRINT_PX = {
  clock: [0, 896, 256, 256] as Px,
  exit: [256, 896, 256, 128] as Px,
  aed: [256, 1024, 128, 128] as Px,
  hands: [384, 1024, 128, 128] as Px,
  poster: [512, 896, 192, 256] as Px,         // hand hygiene poster (pictograms only)
  posterB: [704, 896, 128, 256] as Px,        // calm "information" poster (abstract)
  boardA: [832, 896, 512, 256] as Px,         // whiteboard, abstract marker strokes
  boardB: [1344, 896, 512, 256] as Px,
  cup: [1856, 896, 192, 192] as Px,           // café pictogram
  notice: [0, 1152, 512, 384] as Px,          // notice board with pinned sheets
  rug: [512, 1152, 512, 384] as Px,           // Moroccan rug (Beni Ouarain diamonds)
  planner: [1024, 1152, 512, 256] as Px,      // wall planner (2026 technical office), no numbers
  art1: [1536, 1152, 256, 320] as Px,         // framed art: arches and zellige
  art2: [1792, 1152, 256, 320] as Px,         // framed art: Atlas landscape, soft
  docs: [1024, 1408, 512, 128] as Px,         // printed page (text-like grey lines)
  blueprint: [0, 1536, 512, 512] as Px,       // building plans spread on the 2026 table
  art3: [512, 1536, 512, 256] as Px,          // wide abstract (direction office)
  ward: [512, 1792, 512, 256] as Px,          // nurse station patient board (coloured magnets, strokes)
  books: [1024, 1536, 512, 256] as Px,        // book spines
  binders: [1024, 1792, 512, 256] as Px,      // binder spines with label blocks
  care: [1536, 1472, 256, 320] as Px,         // "care" poster: hospital calm pictograms
  map: [1792, 1472, 256, 320] as Px,          // evacuation plan (lines only)
  wood: [1536, 1792, 512, 256] as Px,         // fine wood grain for executive surfaces
};
export const PUV = uvOf(PRINT_W, PRINT_H);
export const SIGN_UV = (id: string): UV => PUV(SIGN_PX(SIGN_INDEX[id] ?? 0));
export const P = Object.fromEntries(Object.entries(PRINT_PX).map(([k, v]) => [k, PUV(v)])) as Record<keyof typeof PRINT_PX, UV>;

// ---------------------------------------------------------------- screen atlas (emissive)
export const SCREEN_PX = {
  meeting: [0, 0, 512, 288] as Px,      // meeting room display: agenda + calm bars, no figures
  nurse: [512, 0, 256, 160] as Px,      // nurse station: patient list as coloured rows
  xray: [768, 0, 256, 256] as Px,       // X-ray film on a light box
  ops: [1024, 0, 512, 288] as Px,       // command center console: agents and flows
  opsB: [1536, 0, 512, 288] as Px,
  crt: [0, 288, 256, 192] as Px,        // old monitor, maintenance software (green lines)
  doc: [256, 288, 256, 160] as Px,      // office screen: a document
  sheet: [512, 288, 256, 160] as Px,    // office screen: a table
  vending: [768, 288, 256, 384] as Px,  // vending machine lit front (bottles)
  outline: [1024, 320, 512, 288] as Px, // 2027: building outline with first sensors
  strip: [1024, 288, 512, 32] as Px,    // status light strip (calm segments)
  coffee: [1536, 288, 256, 256] as Px,  // espresso machine display / menu light (pictogram)
  call: [1792, 288, 256, 160] as Px,    // nurse call panel
  tv: [0, 480, 256, 160] as Px,         // patient room TV: calm landscape
  flat: [256, 480, 256, 160] as Px,     // 2027 flat monitor: maintenance list (bars)
};
export const SUV = uvOf(SCREEN_W, SCREEN_H);
export const S = Object.fromEntries(Object.entries(SCREEN_PX).map(([k, v]) => [k, SUV(v)])) as Record<keyof typeof SCREEN_PX, UV>;
