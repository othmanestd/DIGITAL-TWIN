// After sign-in: pick the dataset the atlas runs on. The headline figures are read here, on the server, from the same
// files the model uses, so the cards always match what the atlas shows.
import type { Metadata } from "next";
import GateShell from "@/components/gate/GateShell";
import DatasetChooser, { type Card } from "@/components/gate/DatasetChooser";
import base from "@/lib/data/base.json";
import fin from "@/lib/data/v23/finance.json";

export const metadata: Metadata = { title: "Jeu de données · Akdital augmenté" };

type Row = { key: string; values: Record<string, number>; cumul: number | null; van: number | null };

export default function ChoosePage() {
  const m = (base as unknown as { meta: { eco: number; budget: number; net: number }; ramp: Record<string, { cumul: number }>; cases: unknown[] });
  const g = Object.fromEntries((fin as unknown as { global: Row[] }).global.map((r) => [r.key, r])) as Record<string, Row>;
  const y = (k: string) => g[k].values["2031"];
  const cards: Card[] = [
    {
      id: "v13", tag: "v1.3", name: "Données d'origine",
      line: "L'estimation primaire, descendante : la part du temps de chaque famille de métiers reprise par les agents.",
      kpis: [
        { v: m.meta.eco, label: "MDH de masse salariale économisés par an" },
        { v: m.meta.budget, label: "MDH de coût des agents" },
        { v: m.meta.net, label: "MDH de gain net, plein régime 2029" },
      ],
      bullets: [`${m.cases.length} cas d'usage, de 2026 à 2029`, "Économie de masse salariale seule", "Visites guidées express et complète"],
    },
    {
      id: "v23", tag: "v2.3", name: "Chiffres actualisés",
      line: "Le business case cas par cas, métier par métier, 2027-2031 : économies, CA additionnel et sa marge, coût complet du programme.",
      kpis: [
        { v: y("gains"), label: "MDH de gains bruts en 2031" },
        { v: y("cout"), label: "MDH de coût du programme" },
        { v: y("net"), label: "MDH de valeur nette par an en 2031" },
      ],
      bullets: [
        `${Math.round(g.net.cumul ?? 0)} MDH de valeur nette cumulée 2027-2031 · VAN ${Math.round(g.net.van ?? 0)} MDH`,
        `${Math.round(y("eco"))} MDH d'économies + ${Math.round(y("marge"))} MDH de marge sur ${Math.round(y("ca"))} MDH de CA additionnel`,
        "Vue financière complète et projections de chaque cas",
      ],
    },
  ];
  return (
    <GateShell wide>
      <DatasetChooser cards={cards} />
    </GateShell>
  );
}
