// Icons of the AI layer (hand-drawn SVG, 1.6 px strokes, round caps — consistent with the rest of the UI).
import type { ReactNode } from "react";
type P = { size?: number; className?: string };

/** JABB's "J" mark (same geometry as the JABB logo). */
export function JMark({ size = 20, color = "currentColor" }: { size?: number; color?: string }) {
  const w = Math.round(size * 0.6729);
  return (
    <svg viewBox="252 196.9 195.9 291.1" width={w} height={size} fill={color} aria-hidden style={{ flexShrink: 0 }}>
      <path d="M403.5,390.7c0,18.4-3.8,33-11.5,43.9c-7.6,10.9-21.6,16.4-41.8,16.4c-10.9,0-19.9-1.6-26.9-4.9s-12.5-7.9-16.4-13.8c-3.9-5.9-6.6-12.9-8.2-21c-1.6-8.1-2.3-17-2.3-26.6v-14h-44.4v20.6c0,31.8,8.4,55.9,25.2,72.2c16.8,16.4,40.8,24.5,72,24.5c18.7,0,34.4-2.6,47-7.7c12.6-5.1,22.7-12,30.4-20.6c7.6-8.6,13.1-18.3,16.4-29.2c3.3-10.9,4.9-22,4.9-33.2v-27.1h-44.4V390.7z" />
      <polygon points="403.5,223.9 403.5,346.2 447.9,346.2 447.9,196.9" />
      <circle cx="284.7" cy="248.9" r="25" />
    </svg>
  );
}

const S = ({ size = 18, className, children }: P & { children: ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);

export const PlayIcon = (p: P) => <S {...p}><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10-6.4c.6-.4.6-1.4 0-1.8l-10-6.4C8.9 4.3 8 4.8 8 5.6z" fill="currentColor" stroke="none" /></S>;
export const PauseIcon = (p: P) => <S {...p}><rect x="6.5" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" /><rect x="13.9" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none" /></S>;
export const StopIcon = (p: P) => <S {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2.2" fill="currentColor" stroke="none" /></S>;
export const CloseIcon = (p: P) => <S {...p}><path d="M6 6l12 12M18 6L6 18" /></S>;
export const SendIcon = (p: P) => <S {...p}><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" /></S>;
export const MicIcon = (p: P) => (
  <S {...p}>
    <rect x="9" y="3" width="6" height="11.5" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.8 21h6.4" />
  </S>
);
export const ArrowIcon = (p: P) => <S {...p}><path d="M7 17L17 7M9 7h8v8" /></S>;

/** Music: a sound wave rising out of a note — custom, not the ♪ glyph. */
export function MusicIcon({ size = 18, on = false }: P & { on?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 17.5V6.2c0-.5.4-.9.9-1l7-1.6c.6-.1 1.1.3 1.1.9v10.3" />
      <circle cx="6.6" cy="17.6" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="15.4" r="2.4" fill="currentColor" stroke="none" />
      {!on && <path d="M3.5 3.5l17 17" strokeWidth={1.7} />}
    </svg>
  );
}

/** Three small bars that move while the music plays. */
export function EqBars({ on }: { on: boolean }) {
  return (
    <span className="jb-eq" data-on={on} aria-hidden>
      <i /><i /><i /><i />
    </span>
  );
}
