// Custom line icons — 24 × 24 grid, stroke 1.6, rounded caps. One consistent family, no icon font.
import type { ReactNode, SVGProps } from "react";
import type { IconKey } from "@/lib/hospital";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 20, children, ...rest }: P & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden {...rest}>
      {children}
    </svg>
  );
}

const DEPT_PATHS: Record<IconKey, ReactNode> = {
  hall: <><path d="M4 21V10a8 8 0 0 1 16 0v11" /><path d="M3 21h18" /><path d="M9.5 21v-4.5a2.5 2.5 0 0 1 5 0V21" /><path d="M12 6.5v2" /></>,
  id: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="9" cy="11" r="2" /><path d="M6.3 16.2c.6-1.3 1.6-2 2.7-2s2.1.7 2.7 2" /><path d="M14.5 10h4M14.5 13.5h3" /></>,
  ambulance: <><path d="M2.5 16.5V7.5a1 1 0 0 1 1-1H14v10" /><path d="M14 10h3.5l3 3.2v3.3H14" /><circle cx="6.5" cy="17.5" r="1.7" /><circle cx="16.8" cy="17.5" r="1.7" /><path d="M8.2 9v4M6.2 11h4" /></>,
  cash: <><rect x="2.5" y="6" width="19" height="12" rx="2.5" /><circle cx="12" cy="12" r="2.6" /><path d="M6 9.5v.01M18 14.5v.01" /></>,
  phone: <path d="M5.5 3.5h3l1.8 4.6-2.3 1.4a11.5 11.5 0 0 0 6.5 6.5l1.4-2.3 4.6 1.8v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 3.5 5.5a2 2 0 0 1 2-2z" />,
  scan: <><path d="M4 8.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3M15.5 4h3A1.5 1.5 0 0 1 20 5.5v3M20 15.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M8.5 20h-3A1.5 1.5 0 0 1 4 18.5v-3" /><circle cx="12" cy="12" r="3.5" /></>,
  stethoscope: <><path d="M5.5 3.5H5a1 1 0 0 0-1 1V8a4.5 4.5 0 0 0 9 0V4.5a1 1 0 0 0-1-1h-.5" /><path d="M8.5 12.5v1.5a5 5 0 0 0 10 0v-2" /><circle cx="18.5" cy="10" r="2" /></>,
  folder: <path d="M3 7.5A2 2 0 0 1 5 5.5h4l2 2.2h8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  shield: <><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z" /><path d="M9 12l2.2 2.2L15.2 10" /></>,
  invoice: <><path d="M6 3h12v18l-3-1.8-3 1.8-3-1.8L6 21z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>,
  code: <><path d="M8 8l-4 4 4 4M16 8l4 4-4 4" /><path d="M13.5 5.5l-3 13" /></>,
  flask: <><path d="M9 3h6M10 3v6.2L5.2 17.8A2 2 0 0 0 7 21h10a2 2 0 0 0 1.8-3.2L14 9.2V3" /><path d="M7.4 14.5h9.2" /></>,
  scalpel: <><path d="M3.5 20.5l7-7" /><path d="M10.5 13.5l1.8 1.8" /><path d="M10.5 13.5C13 8.7 16.6 5.4 20.5 3.5c-1.2 4.2-4.3 8-8.2 11.8" /></>,
  heartbeat: <path d="M3 12.5h4l2.2-5.5 4 11 2.3-5.5H21" />,
  baby: <><circle cx="12" cy="12.5" r="8" /><path d="M9.3 15a3.6 3.6 0 0 0 5.4 0" /><path d="M9 11v.01M15 11v.01" /><path d="M12 4.5c-1.2.8-1.3 2.2 0 3" /></>,
  box: <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>,
  bed: <><path d="M3 18.5V6.5M3 13.5h18v5" /><path d="M21 13.5a3 3 0 0 0-3-3h-6.5v3" /><circle cx="7" cy="10.5" r="1.7" /></>,
  beds: <><path d="M3 19V9M3 14.5h18V19" /><path d="M21 14.5a3 3 0 0 0-3-3h-6.5v3" /><circle cx="7" cy="11.5" r="1.6" /><path d="M17.5 3.5v4M15.5 5.5h4" /></>,
  clipboard: <><rect x="8.5" y="3" width="7" height="3.5" rx="1" /><path d="M8.5 5H6.5a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5h-2" /><path d="M9 12h6M9 15.5h4" /></>,
  pill: <><path d="M10.6 19.9a5 5 0 0 1-7-7l5.8-5.8a5 5 0 0 1 7 7z" /><path d="M7.2 9.6l7.2 7.2" /><path d="M17.5 3.5l3 3" /></>,
  truck: <><path d="M2.5 7h11v9.5h-11z" /><path d="M13.5 10H17l3.5 3.5v3h-7" /><circle cx="6.5" cy="17.5" r="1.7" /><circle cx="17" cy="17.5" r="1.7" /></>,
  sparkle: <><path d="M10.5 3.5l1.7 4.4 4.3 1.6-4.3 1.7-1.7 4.3-1.6-4.3L4.5 9.5l4.4-1.6z" /><path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>,
  shirt: <path d="M8.5 3.5L3 6.5l2 4.2 2.2-1.1V20.5h9.6V9.6l2.2 1.1 2-4.2-5.5-3a3.5 3.5 0 0 1-7 0z" />,
  archive: <><rect x="3" y="4.5" width="18" height="4.5" rx="1" /><path d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9" /><path d="M10 13h4" /></>,
  stretcher: <><path d="M2.5 13h19M4.5 13v4.5M19.5 13v4.5" /><circle cx="4.5" cy="19" r="1.2" /><circle cx="19.5" cy="19" r="1.2" /><circle cx="6.5" cy="9.3" r="1.8" /><path d="M9.5 11h8a2 2 0 0 1 2 2" /></>,
  building: <><path d="M4.5 21V4.5A1 1 0 0 1 5.5 3.5h8.5a1 1 0 0 1 1 1V21" /><path d="M15 9h3.5a1 1 0 0 1 1 1v11" /><path d="M3 21h18M8 8h3.5M8 12h3.5M8 16h3.5" /></>,
  coins: <><ellipse cx="9" cy="6.5" rx="5.5" ry="2.5" /><path d="M3.5 6.5v4c0 1.4 2.5 2.5 5.5 2.5 1 0 1.9-.1 2.7-.3" /><ellipse cx="15" cy="13" rx="5.5" ry="2.5" /><path d="M9.5 13v4.5c0 1.4 2.5 2.5 5.5 2.5s5.5-1.1 5.5-2.5V13" /></>,
  users: <><circle cx="9" cy="8" r="3.3" /><path d="M2.8 20a6.2 6.2 0 0 1 12.4 0" /><path d="M15.5 4.8a3.2 3.2 0 0 1 0 6.3M17.5 14a5.5 5.5 0 0 1 3.7 6" /></>,
  scale: <><path d="M12 4v16M7.5 20h9M5 7h14" /><path d="M5 7l-2.7 6a2.9 2.9 0 0 0 5.4 0zM19 7l-2.7 6a2.9 2.9 0 0 0 5.4 0z" /></>,
  compass: <><circle cx="12" cy="12" r="9" /><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z" /></>,
};

export function DeptIcon({ k, ...p }: P & { k: IconKey }) {
  return <Svg {...p}>{DEPT_PATHS[k]}</Svg>;
}

export const I = {
  search: (p: P) => <Svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.3-4.3" /></Svg>,
  mic: (p: P) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></Svg>,
  close: (p: P) => <Svg {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Svg>,
  back: (p: P) => <Svg {...p}><path d="M14.5 5.5L8 12l6.5 6.5" /></Svg>,
  chevron: (p: P) => <Svg {...p}><path d="M9.5 5.5L16 12l-6.5 6.5" /></Svg>,
  chevronDown: (p: P) => <Svg {...p}><path d="M5.5 9.5L12 16l6.5-6.5" /></Svg>,
  arrowUp: (p: P) => <Svg {...p}><path d="M12 19V5M6 11l6-6 6 6" /></Svg>,
  arrowRight: (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>,
  globe: (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.5 3.9 5.5 3.9 9s-1.3 6.5-3.9 9c-2.6-2.5-3.9-5.5-3.9-9S9.4 5.5 12 3z" /></Svg>,
  pin: (p: P) => <Svg {...p}><path d="M12 21s7-6.1 7-11.2A7 7 0 0 0 5 9.8C5 14.9 12 21 12 21z" /><circle cx="12" cy="9.8" r="2.5" /></Svg>,
  city: (p: P) => <Svg {...p}><path d="M3 20.5h18" /><path d="M4.5 20.5v-8l4-2.5v10.5" /><path d="M8.5 20.5V5.5l6-2.5v17.5" /><path d="M14.5 20.5V9.5l5 2.5v8.5" /><path d="M11 8h1M11 11h1M11 14h1M16.8 14h.5M6.3 14.5h.5" /></Svg>,
  hospital: (p: P) => <Svg {...p}><rect x="4" y="3.5" width="16" height="17.5" rx="1.5" /><path d="M12 7.5v5M9.5 10h5M9.5 21v-4h5v4" /></Svg>,
  layers: (p: P) => <Svg {...p}><path d="M12 3.5l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></Svg>,
  person: (p: P) => <Svg {...p}><circle cx="12" cy="8" r="3.6" /><path d="M5 20.5a7 7 0 0 1 14 0" /></Svg>,
  bolt: (p: P) => <Svg {...p}><path d="M13 3L5 13.5h6L10.5 21 19 10.5h-6z" /></Svg>,
  grid: (p: P) => <Svg {...p}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></Svg>,
  spark: (p: P) => <Svg {...p}><path d="M12 3.5l1.9 5 5 1.9-5 1.9-1.9 5-1.9-5-5-1.9 5-1.9z" /><path d="M19 3.5v3M17.5 5h3" /></Svg>,
  info: (p: P) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.01" /></Svg>,
  check: (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>,
  enter: (p: P) => <Svg {...p}><path d="M19 5v6a3 3 0 0 1-3 3H5" /><path d="M9 10l-4 4 4 4" /></Svg>,
  shieldCheck: (p: P) => <Svg {...p}><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z" /><path d="M9 12l2.2 2.2L15.2 10" /></Svg>,
  flag: (p: P) => <Svg {...p}><path d="M5 21V4M5 4.5h11l-2 4 2 4H5" /></Svg>,
  sort: (p: P) => <Svg {...p}><path d="M8 5v14M4.5 15.5L8 19l3.5-3.5M16 19V5M12.5 8.5L16 5l3.5 3.5" /></Svg>,
  doc: (p: P) => <Svg {...p}><path d="M6.5 3h7.5l4.5 4.5v12a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5 19.5v-15A1.5 1.5 0 0 1 6.5 3z" /><path d="M13.5 3v5h5M8.5 13h7M8.5 16.5h5" /></Svg>,
  link: (p: P) => <Svg {...p}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Svg>,
};
