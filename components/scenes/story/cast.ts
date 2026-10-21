// The six fictional characters of the guided visit: who they are (chips) and how they look in the low-poly maquette.
// Calm, muted colours from the atlas palette; one accent each (light pool, chip dot). Never "avatar" / "hôte".
import type { CastId } from "@/lib/ai/story";

export type Look = {
  name: string; role: string; line: string; accent: string;
  skin: string; hair: string | null; torso: string; legs: string; arms?: string;
  /** silhouette details */
  hijab?: string; skirt?: string; cap?: string; scarf?: string; bun?: boolean; longHair?: boolean; collar?: string; belt?: string; badge?: boolean; coat?: boolean;
};

export const LOOKS: Record<CastId, Look> = {
  amina: { name: "Amina", role: "54 ans · patiente", line: "attend une prothèse du genou", accent: "#E5A57A",
    skin: "#D6AE8E", hair: null, torso: "#D8B48E", legs: "#8C6E5A", hijab: "#B8735C", skirt: "#9A7A63" },
  youssef: { name: "Youssef", role: "chargé d'admission", line: "deviendra pilote d'agents", accent: "#7C93FF",
    skin: "#C08F6E", hair: "#2A2320", torso: "#2F3B66", legs: "#262B3A", collar: "#EEF0F5", badge: true },
  salma: { name: "Salma", role: "infirmière · 3e étage", line: "le temps de la paperasse revient au soin", accent: "#5FB3A8",
    skin: "#E7CBB2", hair: "#3A2C24", torso: "#5FB3A8", legs: "#4E9A90", bun: true, collar: "#3E7F77" },
  karim: { name: "Karim", role: "technicien biomédical · 4e étage", line: "veille sur les machines avec le JABB Twin", accent: "#D6B47C",
    skin: "#A47658", hair: "#1E1A19", torso: "#C9A15F", legs: "#3B3A36", cap: "#3E4556", belt: "#2E2F35" },
  hicham: { name: "Hicham", role: "facturier · 1er étage", line: "transforme les soins en recettes", accent: "#CDAA62",
    skin: "#CFA382", hair: "#4B3A2D", torso: "#8C94A8", legs: "#353A48", collar: "#F3F4F7" },
  leila: { name: "Leïla", role: "contrôleuse de gestion sociale · siège", line: "tient les comptes de la masse salariale", accent: "#9B8CE0",
    skin: "#EBD3BD", hair: "#2A2320", torso: "#3A3F50", legs: "#2B2F3C", scarf: "#9B8CE0", longHair: true },
};
