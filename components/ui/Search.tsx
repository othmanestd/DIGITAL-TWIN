"use client";
// Liquid-glass search (macOS Tahoe style): departments, use cases, roles, floors, cities/sites and sections.
// Questions (or no good match) are handed to Jabby through the "atlas:ask" event; the mic opens the voice mode ("atlas:voice").
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useApp, type Section, type Sel } from "@/lib/store";
import { CASES, META, BENCH, CASE as CASE_BY_ID, fr } from "@/lib/model";
import { DEPTS, DEPT, FLOORS, floorKey, ROLE_LABEL, CASE_DEPT, EXPERIENCES, type Role } from "@/lib/hospital";
import { SITES, CITIES, INTERNATIONAL } from "@/lib/geo/network";
import { DeptIcon, I } from "./icons";
import { FAM_COLOR, floorShort, norm } from "@/lib/ui/fmt";
import s from "./styles";

export const SECTIONS: { id: Section; label: string; short: string; hint: string }[] = [
  { id: "explorer", label: "Explorer", short: "Explorer", hint: "Le jumeau numérique : monde, Maroc, hôpital type" },
  { id: "synthese", label: "Synthèse", short: "Synthèse", hint: "Les chiffres du programme en un écran" },
  { id: "cas", label: "Cas d'usage", short: "Cas d'usage", hint: `Les ${CASES.length} cas, carte de marché et liste` },
  { id: "preuves" as Section, label: "Preuves", short: "Preuves", hint: "Ce qui a marché ailleurs : résultats mesurés et sources" },
  { id: "gouvernance", label: "Gouvernance et risques", short: "Gouvernance", hint: "Instances, règle d'or, risques et parades, données" },
  { id: "emplois", label: "Emplois", short: "Emplois", hint: "Zéro licenciement : départs, mobilités, ouvertures" },
  { id: "deploiement", label: "Déploiement", short: "Déploiement", hint: "Cadrage, vagues V1 à V4, montée en charge" },
  { id: "sources", label: "Sources", short: "Sources", hint: "D'où vient chaque chiffre, et ce qui reste à confirmer" },
];

type Kind = "dept" | "xp" | "case" | "bench" | "role" | "floor" | "city" | "site" | "country" | "section";
type Item = { kind: Kind; key: string; label: string; sub: string; hay: string; prim: string; id?: string; icon: ReactNode; run: () => void };

const GROUP_LABEL: Record<Kind, string> = { bench: "Ça a marché ailleurs", xp: "Expériences IA", dept: "Services", case: "Cas d'usage", role: "Métiers", floor: "Étages", city: "Villes", site: "Établissements", country: "Pays", section: "Rubriques" };
const QUESTION = /^(comment|pourquoi|combien|quel|quelle|quels|quelles|est-ce|qui|où|ou|quand|que|qu'|peut|peux|explique|montre|dis|donne|compare|what|how|why)\b/i;

function buildIndex(select: (s: Sel) => void, setSection: (s: Section) => void): Item[] {
  const items: Item[] = [];
  for (const d of DEPTS) {
    const txt = [d.name, d.short, ...d.staff.map((x) => x.label), ...d.cases].join(" ");
    items.push({ kind: "dept", key: "d:" + d.id, id: d.id, label: d.name, sub: `${floorShort(d.building, d.floor)}${d.cases.length ? ` · ${d.cases.length} cas` : " · soin humain"}`,
      hay: norm(txt), prim: norm(d.name + " " + d.short), icon: <DeptIcon k={d.icon} size={17} />, run: () => select({ kind: "dept", id: d.id }) });
    const seen = new Set<string>();
    const count: Partial<Record<Role, number>> = {};
    for (const st of d.staff) {
      const idx = count[st.role] ?? 0;
      count[st.role] = idx + st.n;
      if (st.role === "patient" || seen.has(st.label)) continue;
      seen.add(st.label);
      items.push({ kind: "role", key: `r:${d.id}:${st.label}`, label: st.label, sub: `${d.short} · ${ROLE_LABEL[st.role]}`,
        hay: norm(st.label + " " + d.name + " " + ROLE_LABEL[st.role]), prim: norm(st.label), icon: <I.person size={17} />,
        run: () => select({ kind: "person", id: `${d.id}/${st.role}/${idx}` }) });
    }
  }
  for (const x of EXPERIENCES) {
    const dep = DEPT[x.dept];
    items.push({ kind: "xp", key: "x:" + x.id, id: x.id, label: x.name, sub: `Expérience IA · ${dep ? dep.short : x.dept} · cas ${x.cases.join(", ")}`,
      hay: norm([x.name, x.short, x.what, "experience ia", dep?.name ?? ""].join(" ")), prim: norm(x.name + " " + x.short), icon: <DeptIcon k={x.icon} size={17} />, run: () => select({ kind: "xp", id: x.id }) });
  }
  for (const c of CASES) {
    const txt = [c.id, c.id.replace("-", ""), c.titre, c.domaine, c.metier_libere, ...c.systemes, c.brique].join(" ");
    const dep = DEPT[CASE_DEPT[c.id]];
    items.push({ kind: "case", key: "c:" + c.id, id: c.id, label: c.titre, sub: `${dep ? dep.short : c.domaine}${c.mdh ? ` · ${fr(c.mdh, 1)} MDH` : " · levier"}`,
      hay: norm(txt), prim: norm(c.id + " " + c.titre),
      icon: <span className="num text-[11px] font-bold" style={{ color: FAM_COLOR[c.id[0]] }}>{c.id}</span>, run: () => select({ kind: "case", id: c.id }) });
  }
  for (const b of BENCH) {
    if (!b.measured) continue;
    const target = [...b.v13, ...b.app].find((id) => CASE_BY_ID[id]);
    if (!target) continue;
    items.push({ kind: "bench", key: "b:" + b.id, id: b.id, label: b.who, sub: `${b.country}${b.year ? " · " + b.year : ""} · ${b.result}`,
      hay: norm([b.who, b.country, b.what, b.metric].join(" ")), prim: norm(b.who), icon: <I.check size={17} />, run: () => select({ kind: "case", id: target }) });
  }
  for (const f of FLOORS) {
    const k = floorKey(f.building, f.floor);
    const short = f.building === "annex" ? f.name : floorShort(f.building, f.floor);
    items.push({ kind: "floor", key: "f:" + k, label: short, sub: f.name.split(" · ").slice(1).join(" · "), hay: norm(f.name + " " + short + (f.floor === 0 && f.building === "main" ? " rdc" : "")), prim: norm(short),
      icon: <I.layers size={17} />, run: () => select({ kind: "floor", id: k }) });
  }
  for (const c of CITIES) {
    items.push({ kind: "city", key: "ci:" + c.slug, label: c.name, sub: `${c.region} · ${c.operational} en service${c.sites.length > c.operational ? ` · ${c.sites.length - c.operational} à venir` : ""}`, hay: norm(c.name + " " + c.region), prim: norm(c.name),
      icon: <I.pin size={17} />, run: () => select({ kind: "city", id: c.slug }) });
  }
  for (const x of SITES) {
    items.push({ kind: "site", key: "si:" + x.slug, label: x.name, sub: `${x.city} · ${x.brand} · ${x.status}`, hay: norm([x.name, x.city, x.brand, x.type, ...x.specialties].join(" ")), prim: norm(x.name),
      icon: <I.hospital size={17} />, run: () => select({ kind: "site", id: x.slug }) });
  }
  const countries = [{ iso: "MA", country: "Maroc", sub: `Réseau Akdital · programme de ${fr(META.eco, 0)} MDH` }, ...[...new Map(INTERNATIONAL.filter((x) => x.iso).map((x) => [x.iso, x])).values()].map((x) => ({ iso: x.iso, country: x.country, sub: `International · ${INTERNATIONAL.filter((y) => y.iso === x.iso).length} projets` }))];
  for (const c of countries) {
    items.push({ kind: "country", key: "co:" + c.iso, id: c.iso, label: c.country, sub: c.sub, hay: norm(c.country + " " + c.iso), prim: norm(c.country), icon: <I.globe size={17} />, run: () => select({ kind: "country", id: c.iso }) });
  }
  for (const sct of SECTIONS) {
    items.push({ kind: "section", key: "s:" + sct.id, label: sct.label, sub: sct.hint, hay: norm(sct.label + " " + sct.hint), prim: norm(sct.label), icon: <I.grid size={17} />, run: () => setSection(sct.id) });
  }
  return items;
}

function score(it: Item, toks: string[], raw: string): number {
  let sc = 0;
  if (it.id && (norm(it.id) === raw || norm(it.id).replace("-", "") === raw.replace("-", ""))) sc += 40;
  for (const t of toks) {
    if (it.prim.startsWith(t)) sc += 7;
    else if (it.prim.includes(" " + t)) sc += 5;
    else if (it.prim.includes(t)) sc += 3;
    else if (it.hay.includes(t)) sc += 1;
    else return 0;
  }
  return sc;
}

const STOP = new Set(["le", "la", "les", "de", "des", "du", "d", "l", "un", "une", "et", "a", "au", "aux", "en", "pour", "par", "sur"]);

export default function Search({ width, wide }: { width: number; wide: number }) {
  const select = useApp((st) => st.select);
  const setSection = useApp((st) => st.setSection);
  const setSearchOpen = useApp((st) => st.setSearchOpen);
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [act, setAct] = useState(0);
  const inp = useRef<HTMLInputElement | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const index = useMemo(() => buildIndex((x) => select(x), (x) => setSection(x)), [select, setSection]);

  const { groups, flat, ask } = useMemo(() => {
    const raw = norm(q.trim());
    if (!raw) return { groups: [] as { kind: Kind; items: Item[] }[], flat: [] as Item[], ask: false };
    const toks = raw.split(/[\s'’,;:.!?()-]+/).filter((t) => t && !STOP.has(t));
    const scored = toks.length ? index.map((it) => ({ it, sc: score(it, toks, raw) })).filter((x) => x.sc > 0) : [];
    scored.sort((a, b) => b.sc - a.sc);
    const by = new Map<Kind, { it: Item; sc: number }[]>();
    for (const x of scored) { const a = by.get(x.it.kind) ?? []; if (a.length < (x.it.kind === "case" ? 6 : 4)) a.push(x); by.set(x.it.kind, a); }
    const gs = [...by.entries()].sort((a, b) => b[1][0].sc - a[1][0].sc).map(([kind, arr]) => ({ kind, items: arr.map((x) => x.it) }));
    const best = scored[0]?.sc ?? 0;
    const words = q.trim().split(/\s+/).length;
    const isQ = /\?\s*$/.test(q) || QUESTION.test(q.trim()) || words >= 5 || best < Math.max(3, toks.length * 2);
    const fl = gs.flatMap((g) => g.items);
    return { groups: gs, flat: fl, ask: isQ };
  }, [q, index]);

  const total = flat.length + 1; // + "Demander à Jabby"
  const askIndex = ask ? 0 : flat.length;
  const itemIndex = (i: number) => (ask ? i + 1 : i);

  useEffect(() => { setAct(0); }, [q]);
  useEffect(() => { setSearchOpen(focus); }, [focus, setSearchOpen]);

  // Ctrl+K / "/" focus the search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement | null)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); inp.current?.focus(); inp.current?.select(); }
      else if (e.key === "/" && !typing) { e.preventDefault(); inp.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // click outside closes
  useEffect(() => {
    if (!focus) return;
    const onDown = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setFocus(false); inp.current?.blur(); } };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [focus]);

  const close = () => { setFocus(false); setQ(""); inp.current?.blur(); };
  const doAsk = () => { const text = q.trim(); if (!text) return; window.dispatchEvent(new CustomEvent("atlas:ask", { detail: { text } })); close(); };
  const run = (i: number) => {
    if (i === askIndex) return doAsk();
    const it = flat[ask ? i - 1 : i];
    if (it) { it.run(); close(); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAct((a) => (a + 1) % total); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setAct((a) => (a - 1 + total) % total); }
    else if (e.key === "Enter") { e.preventDefault(); if (q.trim()) run(act); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };

  const open = focus && q.trim().length > 0;
  const w = focus ? wide : width;

  const AskRow = (
    <button type="button" key="ask" onMouseEnter={() => setAct(askIndex)} onClick={doAsk}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${act === askIndex ? "bg-[rgba(91,124,255,.18)]" : "hover:bg-white/[0.05]"}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(91,124,255,.18)", color: "#AFC0FF" }}><I.spark size={17} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-[var(--txt)]">Demander à Jabby</span>
        <span className="block truncate text-[12px] text-[var(--mut)]">« {q.trim()} »</span>
      </span>
      <I.enter size={15} className="text-[var(--mut)]" />
    </button>
  );

  return (
    <div ref={box} className="relative h-11" style={{ width }} data-anchor="search">
      <motion.div
        className={`${s.lg} ${focus ? s.lgFocus : ""} absolute left-1/2 top-0 flex h-11 -translate-x-1/2 items-center gap-2.5 pl-4 pr-1.5`}
        initial={false} animate={{ width: w }} transition={{ type: "spring", stiffness: 380, damping: 34 }}
        onPointerMove={onMove} onClick={() => inp.current?.focus()}
      >
        <span className={s.lgRefract} /><span className={s.lgDark} /><span className={s.lgRim} /><span className={s.lgGlow} />
        <I.search size={18} className="shrink-0 text-[var(--txt-2)]" />
        <input
          ref={inp} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onKeyDown={onKeyDown}
          placeholder="Rechercher ou demander à Jabby"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] font-medium text-[var(--txt)] outline-none placeholder:font-normal placeholder:text-[rgba(195,202,217,.62)]"
          spellCheck={false} autoComplete="off" aria-label="Rechercher"
        />
        {!focus && width >= 380 && <span className={s.kbd}>Ctrl K</span>}
        <button type="button" title="Parler à Jabby (Ctrl + Espace)" onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("atlas:voice")); }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--txt-2)] transition-colors hover:bg-white/10 hover:text-white" data-anchor="search:mic">
          <I.mic size={17} />
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: -6, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.18 }}
            className={`${s.menu} absolute left-1/2 top-[52px] -translate-x-1/2 overflow-hidden rounded-[20px] p-2`}
            style={{ width: wide }}
          >
            <div className={`${s.thinScroll} max-h-[min(560px,calc(100vh-140px))] overflow-y-auto`}>
              {ask && AskRow}
              {groups.map((g) => (
                <div key={g.kind} className="mt-1 first:mt-0">
                  <div className="eyebrow px-3 pb-1 pt-2 !text-[10px]">{GROUP_LABEL[g.kind]}</div>
                  {g.items.map((it) => {
                    const i = itemIndex(flat.indexOf(it));
                    const on = act === i;
                    return (
                      <button type="button" key={it.key} onMouseEnter={() => setAct(i)} onClick={() => run(i)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${on ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"}`}>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-[var(--txt-2)] ring-1 ring-white/[0.06]">{it.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-[var(--txt)]">{it.label}</span>
                          <span className="block truncate text-[12px] text-[var(--mut)]">{it.sub}</span>
                        </span>
                        {on && <I.enter size={15} className="shrink-0 text-[var(--mut)]" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {!ask && (
                <div className="mt-1 border-t border-white/[0.06] pt-1">{AskRow}</div>
              )}
              {!flat.length && !ask && <div className="px-3 py-3 text-[13px] text-[var(--mut)]">Aucun résultat.</div>}
            </div>
            <div className="mt-1 flex items-center gap-3 border-t border-white/[0.06] px-3 pb-1 pt-2 text-[11px] text-[var(--mut)]">
              <span><span className={s.kbd}>↑</span> <span className={s.kbd}>↓</span> naviguer</span>
              <span><span className={s.kbd}>Entrée</span> ouvrir</span>
              <span><span className={s.kbd}>Échap</span> fermer</span>
              <span className="ml-auto">{CASES.length} cas · {DEPTS.length} services{CITIES.length ? ` · ${CITIES.length} villes` : ""}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
