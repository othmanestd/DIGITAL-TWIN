// Which dataset the model runs on, chosen after sign-in (app/choisir) and kept in the `atlas_ds` cookie.
//   v13 · données d'origine : 302 MDH of payroll saved, 160 MDH of agent cost, 2026 → 2029 (estimation descendante)
//   v23 · chiffres actualisés : case-by-case business case, savings + margin on additional revenue − programme cost, 2026 → 2031
// The atlas renders only in the browser (components/AtlasClient.tsx), so this is read once, before any module uses the data.
export type DatasetId = "v13" | "v23";
export const DS_COOKIE = "atlas_ds";
export const DATASET_LABEL: Record<DatasetId, { name: string; short: string }> = {
  v13: { name: "Données d'origine", short: "v1.3" },
  v23: { name: "Chiffres actualisés", short: "v2.3" },
};

function read(): DatasetId {
  if (typeof document === "undefined") return "v13";
  const m = document.cookie.match(/(?:^|;\s*)atlas_ds=(v13|v23)(?:;|$)/);
  return (m?.[1] as DatasetId) ?? "v13";
}

export const DATASET: DatasetId = read();
export const V23 = DATASET === "v23";
