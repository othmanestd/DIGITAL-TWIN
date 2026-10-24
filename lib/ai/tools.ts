// Tools Jabby can call to drive the interface. Shared by the server (function definitions sent to the model)
// and the client (execution through the blue cursor).

export type ToolCall =
  | { name: "navigate"; args: { level: "world" | "morocco" | "city" | "hospital" } }
  | { name: "select"; args: { kind: "floor" | "dept" | "person" | "xp" | "city" | "site" | "country"; id: string } }
  | { name: "open_case"; args: { id: string } }
  | { name: "open_section"; args: { section: "explorer" | "synthese" | "cas" | "gouvernance" | "emplois" | "deploiement" | "sources" } }
  | { name: "set_year"; args: { year: 2026 | 2027 | 2028 | 2029 } }
  | { name: "set_view"; args: { perSite: boolean } };

export const TOOL_NAMES = ["navigate", "select", "open_case", "open_section", "set_year", "set_view"] as const;

/** OpenAI-style function definitions. Descriptions are in French, short, so the prompt stays small. */
export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Change de niveau de zoom : world (globe), morocco (réseau des établissements au Maroc), city (la ville de Casablanca en 3D : quartiers, monuments, établissements Akdital), hospital (l'hôpital type en 3D).",
      parameters: { type: "object", properties: { level: { type: "string", enum: ["world", "morocco", "city", "hospital"] } }, required: ["level"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "select",
      description:
        "Sélectionne un élément et ouvre son panneau. kind=dept (id de service, ex. admissions), floor (main:-1..3 ou annex:0..3), person (dept/role/index, ex. hospitalisation/infirmier/0), xp (Expérience IA de l'accueil, ex. xp-guide), city (slug), site (slug d'établissement), country (MA).",
      parameters: {
        type: "object",
        properties: { kind: { type: "string", enum: ["floor", "dept", "person", "xp", "city", "site", "country"] }, id: { type: "string" } },
        required: ["kind", "id"], additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "open_case",
      description: "Ouvre la fiche d'un cas d'usage (ex. A-02) dans son service. Renvoie le détail du cas.",
      parameters: { type: "object", properties: { id: { type: "string", description: "Identifiant du cas, ex. A-02, S-06, P-01, T-02" } }, required: ["id"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "open_section",
      description: "Ouvre une section plein écran : synthese, cas (les 52 cas), gouvernance, emplois (zéro licenciement), deploiement (vagues), sources ; explorer = retour à la vue 3D.",
      parameters: { type: "object", properties: { section: { type: "string", enum: ["explorer", "synthese", "cas", "preuves", "gouvernance", "emplois", "deploiement", "sources"] } }, required: ["section"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_year",
      description: "Place la frise sur une année : 2026 (aujourd'hui), 2027, 2028, 2029 (plein régime).",
      parameters: { type: "object", properties: { year: { type: "integer", enum: [2026, 2027, 2028, 2029] } }, required: ["year"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_view",
      description: "Chiffres de l'hôpital : perSite=true pour un établissement type (groupe ÷ 45), false pour tout le groupe.",
      parameters: { type: "object", properties: { perSite: { type: "boolean" } }, required: ["perSite"], additionalProperties: false },
    },
  },
] as const;

/** The tools for a dataset: v23 has a 2026 → 2031 timeline and a Finances section. */
export function toolDefs(v23: boolean) {
  if (!v23) return TOOL_DEFS;
  return TOOL_DEFS.map((t) => {
    if (t.function.name === "set_year") return { type: "function", function: { name: "set_year", description: "Place la frise sur une année : 2026 (aujourd'hui), 2027 … 2031 (horizon du business case v2.3).", parameters: { type: "object", properties: { year: { type: "integer", enum: [2026, 2027, 2028, 2029, 2030, 2031] } }, required: ["year"], additionalProperties: false } } };
    if (t.function.name === "open_section") return { type: "function", function: { name: "open_section", description: "Ouvre une section plein écran : synthese, finances (le business case v2.3 : pont, années, scénarios), cas (les 85 cas), gouvernance, emplois (zéro licenciement), deploiement (vagues), sources ; explorer = retour à la vue 3D.", parameters: { type: "object", properties: { section: { type: "string", enum: ["explorer", "synthese", "finances", "cas", "preuves", "gouvernance", "emplois", "deploiement", "sources"] } }, required: ["section"], additionalProperties: false } } };
    return t;
  });
}

export function parseToolCall(name: string, raw: string): ToolCall | null {
  if (!(TOOL_NAMES as readonly string[]).includes(name)) return null;
  try {
    const args = raw ? JSON.parse(raw) : {};
    return { name, args } as ToolCall;
  } catch {
    return null;
  }
}
