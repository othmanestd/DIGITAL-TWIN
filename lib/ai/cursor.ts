"use client";
// Drives the blue AI cursor through the shared store. AiCursor.tsx draws it and animates between targets along a curved
// path; the duration comes from travelMs() on both sides, so the driver knows when the cursor has arrived.
import { useApp } from "../store";
import { locate } from "../anchors";

type P = { x: number; y: number };

export function travelMs(a: P, b: P) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.round(Math.min(820, Math.max(480, 380 + d * 0.32)));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/** Stage centre (or the window centre) when an anchor is not on screen. */
export function stageCentre(): P {
  const p = locate("stage");
  if (p) return p;
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/** Waits for the first of these anchors to be on screen (scenes may still be mounting / the camera still moving). */
export async function findAnchor(ids: string[], timeout = 900): Promise<{ id: string; p: P } | null> {
  const t0 = performance.now();
  for (;;) {
    for (const id of ids) {
      const p = locate(id);
      if (p && p.x > 0 && p.y > 0 && p.x < window.innerWidth && p.y < window.innerHeight) return { id, p };
    }
    if (performance.now() - t0 > timeout) return null;
    await sleep(90);
  }
}

/** Where the cursor appears from: Jabby's button in the dock. */
function origin(): P {
  return locate("ai:jabby") || { x: 60, y: window.innerHeight - 40 };
}

/** Moves the cursor to a point or an anchor (re-aimed on arrival if the anchor moved, e.g. during a camera move). */
export async function cursorTo(target: P | string | string[], label = "Jabby"): Promise<P> {
  const st = useApp.getState();
  let p: P;
  let ids: string[] | null = null;
  if (typeof target === "string" || Array.isArray(target)) {
    ids = Array.isArray(target) ? target : [target];
    p = (await findAnchor(ids))?.p || stageCentre();
  } else p = target;
  const cur = st.cursor;
  let from: P = { x: cur.x, y: cur.y };
  if (!cur.visible) {
    from = origin();
    st.setCursor({ x: from.x, y: from.y, visible: true, clicking: false, label });
    await frame(); await frame();
  }
  useApp.getState().setCursor({ x: p.x, y: p.y, label });
  await sleep(travelMs(from, p) + 30);
  if (ids) {
    const q = (await findAnchor(ids, 0))?.p;
    if (q && Math.hypot(q.x - p.x, q.y - p.y) > 10) {
      useApp.getState().setCursor({ x: q.x, y: q.y });
      await sleep(travelMs(p, q));
      p = q;
    }
  }
  return p;
}

export async function cursorClick() {
  useApp.getState().setCursor({ clicking: true });
  await sleep(170);
  useApp.getState().setCursor({ clicking: false });
}

let hideTimer = 0;
/** Hides the cursor after a short delay (cancelled if it moves again). */
export function cursorRest(ms = 1600) {
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => useApp.getState().setCursor({ visible: false, clicking: false }), ms);
}
export function cursorKeep() { clearTimeout(hideTimer); }
export function cursorHide() { clearTimeout(hideTimer); useApp.getState().setCursor({ visible: false, clicking: false }); }
