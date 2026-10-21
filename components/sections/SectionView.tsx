"use client";
// Full-screen sections (under the top bar): Synthèse, Cas d'usage, Gouvernance et risques, Emplois, Déploiement, Sources.
// Verdict first, every unit explained, no page scrolling. The bottom-left corner stays free for the AI dock.
import type { ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp, type Section } from "@/lib/store";
import { META, HEAD, V23, FIN, FINAL_YEAR, CASES, DATA, BENCH, benchFor, fr, pct } from "@/lib/model";
import { I } from "@/components/ui/icons";
import { AkditalMark } from "@/components/ui/AkditalLogo";
import { Tip } from "@/components/ui/kit";
import { Synthese, Cas, Gouvernance, Emplois, Deploiement, Sources, Preuves } from "./pages";
import { Finances } from "./finance";
import s from "@/components/ui/styles";

const HEADS: Record<string, { title: string; verdict: () => ReactNode; foot: () => ReactNode }> = {
  preuves: {
    title: "Preuves",
    verdict: () => { const m = BENCH.filter((b) => b.measured).length; const n = CASES.filter((c) => benchFor(c.id).length > 0).length; return <><b className="text-white">Ça a marché ailleurs</b> : {m} résultats mesurés et publiés, qui couvrent {n} des {CASES.length} cas.</>; },
    foot: () => <>Niveaux de preuve : A publication scientifique · B publié par l&apos;hôpital · C éditeur avec client nommé. Survolez une carte pour la lecture Akdital.</>,
  },
  synthese: {
    title: "Synthèse",
    verdict: () => V23
      ? <>Le programme crée <b className="text-white">{fr(HEAD.net, 0)} MDH de valeur nette par an</b> en {HEAD.year} : {fr(HEAD.gains, 0)} MDH de gains bruts (économies {fr(HEAD.eco, 0)} + marge sur le CA additionnel {fr(HEAD.marge, 0)}) pour {fr(HEAD.cout, 0)} MDH de coût, sans licenciement.</>
      : <>Le programme rend <b className="text-white">{fr(META.net, 0)} MDH nets par an</b> au plein régime : {fr(META.eco, 0)} MDH de masse salariale économisés pour {fr(META.budget, 0)} MDH d&apos;agents, sans licenciement.</>,
    foot: () => V23
      ? <>MDH = millions de dirhams · ETP-éq. = équivalents temps plein libérés · gains bruts = ① économies + ② marge sur le CA additionnel · valeur nette = gains bruts − ③ coût · modèle {FIN.meta.version}</>
      : <>MDH = millions de dirhams · ETP-éq. = équivalents temps plein libérés · ROI = dirhams économisés pour 1 dirham d&apos;agents · modèle du {META.date}</>,
  },
  finances: {
    title: "Finances",
    verdict: () => <>Business case {FIN.meta.years[0]}-{FINAL_YEAR}, cas par cas : <b className="text-white">{fr(HEAD.cumul, 0)} MDH de valeur nette cumulée</b>{HEAD.van === null ? "" : <>, VAN de {fr(HEAD.van, 0)} MDH</>}.</>,
    foot: () => <>① économies + ② marge sur le CA additionnel − ③ coût du programme = valeur nette · MDH = millions de dirhams · VAN : valeur actuelle nette</>,
  },
  cas: {
    title: "Cas d'usage",
    verdict: () => {
      const top = [...CASES].sort((a, b) => b.mdh - a.mdh).slice(0, 5); const sum = top.reduce((a, c) => a + c.mdh, 0); const inN = CASES.filter((c) => c.in302 && c.mdh > 0).length;
      if (V23) { const merged = CASES.filter((c) => c.merged_into).length, costed = CASES.filter((c) => c.in302).length; return <><b className="text-white">{CASES.length} cas</b> : {costed} sont chiffrés ; les 5 premiers portent {fr(sum, 0)} MDH ({pct(sum / HEAD.gains, 0)}) des {fr(HEAD.gains, 0)} MDH de gains bruts ; {merged} sont fusionnés dans un autre cas.</>; }
      return <><b className="text-white">{CASES.length} cas</b> : {inN} portent les {fr(META.eco, 0)} MDH de masse salariale, dont {fr(sum, 0)} MDH ({pct(sum / META.eco, 0)}) pour les 5 premiers ; les autres créent une valeur d&apos;un autre type.</>;
    },
    foot: () => <>Cliquez une tuile ou une ligne pour voir où l&apos;agent intervient dans le jumeau numérique.</>,
  },
  gouvernance: {
    title: "Gouvernance et risques",
    verdict: () => <>Aucun acte irréversible sans humain, aucune donnée de santé hors du Maroc, <b className="text-white">{DATA.risks.length} risques</b> suivis avec leur parade.</>,
    foot: () => <>Données N0 à N3+ : niveaux de sensibilité, du public au très sensible (santé). CNDP : autorité marocaine de protection des données.</>,
  },
  emplois: {
    title: "Emplois",
    verdict: () => <><b className="text-white">Zéro licenciement</b> : les postes repris se résorbent par les départs naturels, la mobilité vers les ouvertures et les recrutements évités.</>,
    foot: () => <>ETP = équivalent temps plein · ETP-éq. = travail repris par les agents, exprimé en postes à plein temps.</>,
  },
  deploiement: {
    title: "Déploiement",
    verdict: () => V23
      ? <>Cadrage en novembre 2026, première vague sans contact patient, décision CODIR en avril 2027, <b className="text-white">horizon du business case : {FINAL_YEAR}</b>.</>
      : <>Cadrage en novembre 2026, première vague sans contact patient, décision CODIR en avril 2027, <b className="text-white">plein régime fin 2029</b>.</>,
    foot: () => <>V1 à V4 : vagues de déploiement · CODIR : comité de direction d&apos;Akdital · MDH = millions de dirhams.</>,
  },
  sources: {
    title: "Sources",
    verdict: () => <>Chaque chiffre a une source publique ou interne identifiée ; <b className="text-white">ce qui reste à confirmer est dit</b>.</>,
    foot: () => <>AMMC : Autorité marocaine du marché des capitaux · S1 : premier semestre.</>,
  },
};

export default function SectionView() {
  const section = useApp((st) => st.section);
  const setSection = useApp((st) => st.setSection);
  if (section === "explorer") return null;
  const h = HEADS[section];
  if (!h) return null;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={section}
        className={`${s.read} fixed bottom-4 left-4 right-4 top-[76px] z-[25] flex flex-col overflow-hidden rounded-[22px]`}
        style={{ background: "linear-gradient(160deg, rgba(17,24,50,.985), rgba(9,13,29,.99))" }}
        initial={{ opacity: 0, y: 14, scale: 0.992 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
        data-anchor={`view:${section}`}
      >
        <header className="flex shrink-0 items-end gap-6 px-[clamp(18px,1.6vw,30px)] pb-[clamp(10px,1.4vh,16px)] pt-[clamp(14px,2vh,22px)]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">{section === "synthese" && <AkditalMark size={14} />}<span className="eyebrow !text-[10px]">Akdital augmenté · programme agents IA</span></div>
            <div className="mt-1 flex items-baseline gap-5">
              <h1 className="h-display shrink-0 text-[clamp(26px,2.1vw,38px)] text-white">{h.title}</h1>
              <p className="min-w-0 text-[clamp(13.5px,0.95vw,17px)] leading-snug text-[var(--txt-2)]">{h.verdict()}</p>
            </div>
          </div>
          <button type="button" onClick={() => setSection("explorer")} data-anchor="section:close"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white/[0.07] pl-3 pr-3.5 text-[12.5px] font-medium text-[var(--txt-2)] ring-1 ring-white/[0.09] transition-colors hover:bg-white/[0.14] hover:text-white">
            <I.hospital size={15} />Retour au jumeau numérique
          </button>
        </header>
        <div className="min-h-0 flex-1 px-[clamp(18px,1.6vw,30px)]">
          {section === "synthese" && <Synthese />}
          {section === "finances" && <Finances />}
          {section === "cas" && <Cas />}
          {section === "gouvernance" && <Gouvernance />}
          {section === "emplois" && <Emplois />}
          {section === "deploiement" && <Deploiement />}
          {section === "sources" && <Sources />}
          {(section as string) === "preuves" && <Preuves />}
        </div>
        {/* footer: left part kept free for the AI dock */}
        <footer className="flex h-[52px] shrink-0 items-center justify-end gap-4 pl-[400px] pr-[clamp(18px,1.6vw,30px)] text-[11.5px] text-[var(--mut)]">
          <span className="truncate">{h.foot()}</span>
          {V23 ? (
            <Tip content={FIN.meta.notes[1]} side="top"><span className="flex shrink-0 cursor-help items-center gap-1.5 whitespace-nowrap text-[var(--txt-2)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />business case {FIN.meta.version} · scénario {FIN.meta.scenario.toLowerCase()}</span></Tip>
          ) : (
            <Tip content={META.flag_160} side="top"><span className="flex shrink-0 cursor-help items-center gap-1.5 whitespace-nowrap text-[#E9C27F]"><span className="h-1.5 w-1.5 rounded-full bg-[#E2B05A]" />lecture des {fr(META.budget, 0)} MDH à confirmer</span></Tip>
          )}
        </footer>
      </motion.div>
    </AnimatePresence>
  );
}
