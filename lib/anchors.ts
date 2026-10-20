"use client";
// Screen anchors: where things are on screen, so the AI cursor and the guided tour can point at them.
// 3D scenes register a function that projects an object to screen pixels; DOM elements just carry data-anchor="…".
type Fn = () => { x: number; y: number; visible: boolean } | null;
const fns = new Map<string, Fn>();

export function registerAnchor(id: string, fn: Fn) {
  fns.set(id, fn);
  return () => { if (fns.get(id) === fn) fns.delete(id); };
}

/** Anchor ids: "dept:admissions", "person:admissions/admin/0", "floor:main:0", "city:casablanca", "country:MA",
 *  or any DOM element with data-anchor (e.g. "nav:dept:admissions", "section:synthese", "case-row:A-02", "year:2028"). */
export function locate(id: string): { x: number; y: number } | null {
  const f = fns.get(id);
  if (f) { const p = f(); if (p && p.visible) return { x: p.x, y: p.y }; }
  if (typeof document !== "undefined") {
    const el = document.querySelector(`[data-anchor="${CSS.escape(id)}"]`) as HTMLElement | null;
    if (el) { const r = el.getBoundingClientRect(); if (r.width || r.height) return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
  }
  return null;
}
export const anchorIds = () => [...fns.keys()];
