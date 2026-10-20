"use client";
// What Jabby (and the guided tour) does on screen: every action travels with the blue cursor to the thing it is about to
// click, ripples, then calls the store. Missing anchors fall back to the stage centre, so nothing depends on other
// components being finished.
import { useApp, type Level, type Section, type SelKind } from "../store";
import { CASE_DEPT, DEPT, XP } from "../hospital";
import { CASE } from "../model";
import type { Year } from "../model";
import { SITES } from "../geo/network";
import { cursorTo, cursorClick, cursorKeep, findAnchor } from "./cursor";
import type { ToolCall } from "./tools";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const S = () => useApp.getState();

export type Op =
  | { do: "level"; level: Level; silent?: boolean }
  | { do: "home"; silent?: boolean }
  | { do: "select"; kind: Exclude<SelKind, "overview" | "case">; id: string; silent?: boolean }
  | { do: "case"; id: string; silent?: boolean }
  | { do: "section"; section: Section; silent?: boolean }
  | { do: "year"; year: Year; silent?: boolean }
  | { do: "view"; perSite: boolean; silent?: boolean }
  | { do: "point"; anchor: string; silent?: boolean }
  | { do: "zoom"; level?: Level; value?: number; delta?: number; g?: number; silent?: boolean };

const LEVEL_OF: Partial<Record<SelKind, Level>> = { floor: "hospital", dept: "hospital", person: "hospital", case: "hospital", xp: "hospital", city: "morocco", site: "morocco", country: "world" };

async function click(anchors: string[], label: string, act: () => void, silent?: boolean) {
  if (!silent) {
    cursorKeep();
    await cursorTo(anchors, label);
    await cursorClick();
  }
  act();
}

async function ensureExplorer(silent?: boolean) {
  if (S().section === "explorer") return;
  await click(["section:explorer", "section:close"], "Jabby", () => S().setSection("explorer"), silent);
  await sleep(silent ? 50 : 650);
}

async function ensureLevel(level: Level, silent?: boolean) {
  await ensureExplorer(silent);
  if (S().level === level) return;
  await click([`nav:level:${level}`], "Jabby", () => S().setLevel(level), silent);
  await sleep(silent ? 300 : 1300); // camera flight
}

function anchorsFor(kind: SelKind, id: string): string[] {
  switch (kind) {
    case "dept": return [`dept:${id}`, `floor-row:${id}`, `nav:dept:${id}`];
    case "floor": return [`floor:${id}`, `nav:floor:${id}`];
    case "person": { const d = id.split("/")[0]; return [`person:${id}`, `person-chip:${id}`, `dept:${d}`, `nav:dept:${d}`]; }
    case "xp": { const d = XP[id]?.dept; return [`xp:${id}`, ...(d ? [`dept:${d}`, `nav:dept:${d}`] : [])]; }
    case "city": return [`city:${id}`];
    case "site": { const s = SITES.find((x) => x.slug === id); return [`site:${id}`, ...(s ? [`city:${s.citySlug}`] : [])]; }
    case "country": return [`country:${id}`];
    default: return [];
  }
}

export async function perform(op: Op): Promise<void> {
  const silent = op.silent;
  switch (op.do) {
    case "level":
      await ensureExplorer(silent);
      if (S().level !== op.level) await ensureLevel(op.level, silent);
      else if (!silent) await cursorTo([`nav:level:${op.level}`]);
      return;
    case "home":
      await ensureExplorer(true);
      if (!silent) { await cursorTo([`nav:level:hospital`]); await cursorClick(); }
      S().home();
      await sleep(silent ? 50 : 900);
      return;
    case "select": {
      const lvl = LEVEL_OF[op.kind];
      if (lvl) await ensureLevel(lvl, silent);
      else await ensureExplorer(silent);
      await click(anchorsFor(op.kind, op.id), "Jabby", () => S().select({ kind: op.kind, id: op.id }), silent);
      await sleep(silent ? 50 : 700);
      return;
    }
    case "case": {
      const id = op.id.toUpperCase();
      if (!CASE[id]) return;
      const dept = CASE_DEPT[id];
      const s = S();
      const inDept = s.section === "explorer" && s.sel?.kind === "dept" && s.sel.id === dept;
      if (dept && !inDept) await perform({ do: "select", kind: "dept", id: dept, silent });
      if (!silent) {
        const row = await findAnchor([`case-row:${id}`], 1300);
        const fallback = { x: window.innerWidth - Math.min(window.innerWidth * 0.2, 390), y: window.innerHeight * 0.42 };
        await cursorTo(row ? [`case-row:${id}`] : fallback);
        await cursorClick();
      }
      S().openCase(id);
      await sleep(silent ? 50 : 500);
      return;
    }
    case "section":
      if (S().section === op.section) { if (!silent) await cursorTo([`section:${op.section}`]); return; }
      await click([`section:${op.section}`], "Jabby", () => S().setSection(op.section), silent);
      await sleep(silent ? 50 : 700);
      return;
    case "year":
      await ensureExplorer(silent);
      await click([`year:${op.year}`], "Jabby", () => S().setYear(op.year), silent);
      await sleep(silent ? 30 : 250);
      return;
    case "view":
      if (S().perSite === op.perSite) return;
      await click([op.perSite ? "persite:s" : "persite:g", "timeline"], "Jabby", () => S().setPerSite(op.perSite), silent);
      return;
    case "point": {
      if (silent) return;
      // pointing is decorative: if the anchor is not on screen, the cursor stays where it is
      const f = await findAnchor([op.anchor], 1200);
      if (f) await cursorTo([op.anchor]);
      return;
    }
    case "zoom": {
      await ensureExplorer(silent);
      const anchors = op.level ? [`zoom:level:${op.level}`, `nav:level:${op.level}`] : op.g !== undefined ? ["zoom:out"] : [(op.delta ?? 0) < 0 ? "zoom:in" : "zoom:out"];
      await click(anchors, "Jabby", () => S().requestZoom({ level: op.level, value: op.value, delta: op.delta, g: op.g }), silent);
      await sleep(silent ? 300 : 1400); // smooth camera move
      return;
    }
  }
}

/** A tool call from /api/chat → an on-screen operation. */
export function opOf(call: ToolCall): Op | null {
  const a = call.args as Record<string, unknown>;
  switch (call.name) {
    case "navigate": return ["world", "morocco", "hospital"].includes(String(a.level)) ? { do: "level", level: a.level as Level } : null;
    case "select": {
      const kind = String(a.kind);
      const id = String(a.id || "");
      if (kind === "dept" && !DEPT[id]) return null;
      if (kind === "xp" && !XP[id]) return null;
      if (!["floor", "dept", "person", "xp", "city", "site", "country"].includes(kind)) return null;
      return { do: "select", kind: kind as Exclude<SelKind, "overview" | "case">, id };
    }
    case "open_case": return CASE[String(a.id || "").toUpperCase()] ? { do: "case", id: String(a.id).toUpperCase() } : null;
    case "open_section": return ["explorer", "synthese", "cas", "preuves", "gouvernance", "emplois", "deploiement", "sources"].includes(String(a.section)) ? { do: "section", section: a.section as Section } : null;
    case "set_year": return [2026, 2027, 2028, 2029].includes(Number(a.year)) ? { do: "year", year: Number(a.year) as Year } : null;
    case "set_view": return { do: "view", perSite: !!a.perSite };
  }
  return null;
}

/** Short French label for the chips under an answer ("Ouvre A-02"). */
export function opLabel(op: Op): string {
  switch (op.do) {
    case "level": return op.level === "world" ? "Vue monde" : op.level === "morocco" ? "Vue Maroc" : "Hôpital type";
    case "home": return "Vue d'ensemble";
    case "select": return op.kind === "dept" ? DEPT[op.id]?.short ?? op.id : op.kind === "xp" ? XP[op.id]?.short ?? op.id : op.kind === "floor" ? `Étage ${op.id.replace("main:", "").replace("annex:", "siège ")}` : op.id;
    case "case": return `Cas ${op.id}`;
    case "section": return ({ explorer: "Vue 3D", synthese: "Synthèse", cas: "Cas d'usage", preuves: "Preuves", gouvernance: "Gouvernance", emplois: "Emplois", deploiement: "Déploiement", sources: "Sources" } as const)[op.section];
    case "year": return String(op.year);
    case "view": return op.perSite ? "Un établissement" : "Tout le groupe";
    case "point": return op.anchor;
    case "zoom": return op.level === "world" ? "Vue monde" : op.level === "morocco" ? "Vue Maroc" : "Zoom";
  }
}

/** Runs operations one after the other (tool calls arrive while the answer streams). */
export class OpQueue {
  private chain: Promise<void> = Promise.resolve();
  private gen = 0;
  push(op: Op) {
    const g = this.gen;
    this.chain = this.chain.then(() => (g === this.gen ? perform(op).catch(() => {}) : undefined));
    return this.chain;
  }
  done() { return this.chain; }
  cancel() { this.gen++; this.chain = Promise.resolve(); }
}
