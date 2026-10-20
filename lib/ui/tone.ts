// Floating controls over the 3D scene adapt their ink to what is behind them: dark on a light backdrop, white on a dark one.
// Elements register with `ref={tone}` and the class `tone-adapt` (or `tone-line`); components/scenes/ToneSampler.tsx reads
// the rendered frame under them and sets data-tone="light" | "dark". Colours live in app/globals.css.
export const toneEls = new Set<HTMLElement | SVGElement>();

/** Ref callback (React 19 cleanup form). */
export const tone = (el: HTMLElement | SVGElement | null) => {
  if (!el) return;
  toneEls.add(el);
  return () => { toneEls.delete(el); };
};
