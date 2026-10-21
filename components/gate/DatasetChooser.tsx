"use client";
// Two glass cards: the original figures (v1.3) or the revised business case (v2.3). The choice is kept in the `atlas_ds`
// cookie (lib/data/dataset.ts) and the atlas reloads on it.
import { useEffect, useState } from "react";

export type Card = { id: "v13" | "v23"; tag: string; name: string; line: string; kpis: { v: number; label: string }[]; bullets: string[] };

const nf = (x: number) => Math.round(x).toLocaleString("fr-FR").replace(/ | /g, " ");

export default function DatasetChooser({ cards }: { cards: Card[] }) {
  const [cur, setCur] = useState<string | null>(null);
  const [going, setGoing] = useState<string | null>(null);
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)atlas_ds=(v13|v23)/);
    setCur(m?.[1] ?? null);
  }, []);
  const open = (id: string) => {
    setGoing(id);
    document.cookie = `atlas_ds=${id}; path=/; max-age=31536000; samesite=lax`;
    window.location.href = "/";
  };
  return (
    <div className="w-full">
      <div className="mb-5 text-center">
        <div className="eyebrow text-[var(--blue)]">Jeu de données</div>
        <h1 className="mt-1.5 text-[clamp(20px,2.4vw,26px)] font-[750] text-white">Sur quels chiffres ouvrir le modèle ?</h1>
        <p className="mt-1 text-[13px] text-[var(--txt-2)]">Le même hôpital, le même réseau, les mêmes 89 cas d&apos;usage. Vous pourrez changer à tout moment depuis la barre du haut.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const rev = c.id === "v23";
          return (
            <button key={c.id} type="button" onClick={() => open(c.id)} disabled={!!going}
              className={`glass-read group relative flex flex-col rounded-[26px] p-6 text-left transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] ${rev ? "ring-1 ring-[rgba(76,199,154,.35)]" : ""}`}>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-[3px] text-[10.5px] font-bold ring-1 ${rev ? "bg-[rgba(76,199,154,.14)] text-[var(--green)] ring-[rgba(76,199,154,.35)]" : "bg-white/[0.07] text-[var(--txt-2)] ring-white/[0.12]"}`}>{c.tag}</span>
                {cur === c.id && <span className="text-[11px] text-[var(--mut)]">dernier choix</span>}
                {rev && <span className="ml-auto text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--green)]">Nouveau</span>}
              </div>
              <div className="mt-3 text-[19px] font-[750] text-white">{c.name}</div>
              <p className="mt-1 min-h-[40px] text-[12.5px] leading-relaxed text-[var(--txt-2)]">{c.line}</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {c.kpis.map((k, i) => (
                  <div key={i} className="rounded-[14px] bg-white/[0.045] px-3 py-2.5 ring-1 ring-white/[0.06]">
                    <div className={`num text-[22px] font-[800] leading-none ${i === 2 ? "text-white" : i === 0 ? "text-[var(--green)]" : "text-[var(--txt-2)]"}`}>{nf(k.v)}</div>
                    <div className="mt-1.5 text-[10.5px] leading-snug text-[var(--mut)]">{k.label}</div>
                  </div>
                ))}
              </div>
              <ul className="mb-5 mt-4 space-y-1.5">
                {c.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-[var(--txt-2)]"><span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--blue)]" />{b}</li>
                ))}
              </ul>
              <span className={`mt-auto inline-flex h-10 items-center justify-center rounded-[13px] text-[13.5px] font-[700] transition ${rev ? "bg-[var(--green)] text-[#04120C] group-hover:brightness-110" : "bg-white/[0.1] text-white group-hover:bg-white/[0.16]"}`}>
                {going === c.id ? "Ouverture…" : `Ouvrir avec les ${c.name.toLowerCase()}`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-5 text-center">
        <a href="/api/logout" className="text-[12px] text-[var(--mut)] underline-offset-4 hover:text-[var(--txt-2)] hover:underline">Se déconnecter</a>
      </div>
    </div>
  );
}
