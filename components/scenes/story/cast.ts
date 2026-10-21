// The six fictional characters of the guided visit: who they are (chips) and how they look, built on the shared human
// kit (components/scenes/people/human.ts). Calm, natural colours; one accent each (light pool, chip dot). Never "avatar" / "hôte".
import type { CastId } from "@/lib/ai/story";
import { hex, type HumanLook, type Style } from "../people/human";

export type Look = {
  name: string; role: string; line: string; accent: string;
  skin: string; hair: string | null; torso: string; legs: string; arms?: string;
  /** silhouette details */
  hijab?: string; skirt?: string; cap?: string; scarf?: string; bun?: boolean; longHair?: boolean; collar?: string; belt?: string; badge?: boolean; coat?: boolean;
  /** kit wardrobe: build, extra styles, shoes, inner layer (V of a cardigan / sweater) */
  fem: boolean; styles: Style[]; shoe: string; inner?: string; sleeveSkin?: boolean; height?: number; girth?: number;
};

export const LOOKS: Record<CastId, Look> = {
  // a patient arriving for her knee: hijab, cardigan open on a cream blouse, long skirt
  amina: { name: "Amina", role: "54 ans · patiente", line: "attend une prothèse du genou", accent: "#E5A57A",
    skin: "#D6AE8E", hair: null, torso: "#C99A6E", legs: "#6E5848", hijab: "#B8735C", skirt: "#8C6F5B", inner: "#EFE6D8",
    fem: true, styles: ["hijab", "drape", "open", "buttons", "skirt"], shoe: "#4A3A30", girth: 1.08, height: 0.98 },
  // admissions: navy sweater over a white shirt, staff badge
  youssef: { name: "Youssef", role: "chargé d'admission", line: "deviendra pilote d'agents", accent: "#7C93FF",
    skin: "#C08F6E", hair: "#2A2320", torso: "#2F3B66", legs: "#262B3A", collar: "#EEF0F5", badge: true,
    fem: false, styles: ["short", "collar", "vneck", "badge"], shoe: "#1E1F22", inner: "#EEF0F5" },
  // the nurse: teal scrubs, bun
  salma: { name: "Salma", role: "infirmière · 3e étage", line: "le temps de la paperasse revient au soin", accent: "#5FB3A8",
    skin: "#E7CBB2", hair: "#3A2C24", torso: "#4FA79E", legs: "#43968D", bun: true, collar: "#3E7F77", inner: "#3E7F77",
    fem: true, styles: ["bun", "vneck", "badge"], shoe: "#F0F1F3", sleeveSkin: true },
  // the biomedical technician: khaki polo, cap, tool belt
  karim: { name: "Karim", role: "technicien biomédical · 4e étage", line: "veille sur les machines avec le JABB Twin", accent: "#D6B47C",
    skin: "#A47658", hair: "#1E1A19", torso: "#C9A15F", legs: "#3B3A36", cap: "#3E4556", belt: "#2E2F35",
    fem: false, styles: ["short", "cap", "collar", "belt", "pouches"], shoe: "#2A2C31", sleeveSkin: true, girth: 1.06 },
  // billing: grey-blue sweater over a white shirt, short beard
  hicham: { name: "Hicham", role: "facturier · 1er étage", line: "transforme les soins en recettes", accent: "#CDAA62",
    skin: "#CFA382", hair: "#4B3A2D", torso: "#8C94A8", legs: "#353A48", collar: "#F3F4F7", inner: "#F3F4F7",
    fem: false, styles: ["curly", "beard", "collar", "vneck"], shoe: "#3A2A20" },
  // social controlling at head office: dark jacket, violet scarf, long hair
  leila: { name: "Leïla", role: "contrôleuse de gestion sociale · siège", line: "tient les comptes de la masse salariale", accent: "#9B8CE0",
    skin: "#EBD3BD", hair: "#2A2320", torso: "#3A3F50", legs: "#2B2F3C", scarf: "#9B8CE0", longHair: true, inner: "#E9E6EF",
    fem: true, styles: ["long", "open", "buttons", "scarf"], shoe: "#1E1F22" },
};

/** The kit look of a character (same identity, accessories and colours as LOOKS). */
export function castHuman(id: CastId): HumanLook {
  const L = LOOKS[id];
  const skin = hex(L.skin), top = hex(L.torso);
  const accent = L.cap ? hex(L.cap) : L.inner ? hex(L.inner) : L.collar ? hex(L.collar) : top;
  return {
    fem: L.fem, skin, top, bottom: hex(L.skirt ?? L.legs), hair: hex(L.hijab ?? L.hair ?? "#222222"), shoe: hex(L.shoe),
    accent, sleeve: L.sleeveSkin ? skin : top, accent2: hex(L.scarf ?? L.belt ?? "#2E2F35"), styles: L.styles,
    height: L.height ?? (L.fem ? 0.95 : 1), girth: L.girth ?? 1,
  };
}
