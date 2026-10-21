// Shared frame of the sign-in and dataset-choice pages: deep-space backdrop, a faint orbit, the Akdital lockup with its
// partners underneath (same order as the atlas), then the page's card. No model data is imported here.
import type { ReactNode } from "react";
import AkditalLogo from "@/components/ui/AkditalLogo";
import { JabbMark } from "@/components/ui/JabbMark";

export default function GateShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10 text-[var(--txt)]"
      style={{ background: "radial-gradient(1200px 800px at 50% 38%, #0D1435 0%, #060A1C 55%, #02030A 100%)" }}>
      {/* stars and a slow orbit, purely decorative */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70"
        style={{ backgroundImage: "radial-gradient(1px 1px at 12% 22%, #fff8, transparent), radial-gradient(1px 1px at 78% 14%, #fff6, transparent), radial-gradient(1.5px 1.5px at 64% 72%, #fff5, transparent), radial-gradient(1px 1px at 30% 80%, #fff6, transparent), radial-gradient(1px 1px at 88% 58%, #fff5, transparent), radial-gradient(1px 1px at 46% 8%, #fff4, transparent), radial-gradient(1px 1px at 6% 62%, #fff5, transparent)" }} />
      <div aria-hidden className="gate-orbit pointer-events-none absolute left-1/2 top-1/2 h-[min(140vw,1100px)] w-[min(140vw,1100px)] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
      <div className={`relative z-10 flex w-full flex-col items-center ${wide ? "max-w-[980px]" : "max-w-[420px]"}`}>
        <div className="mb-8 flex flex-col items-center gap-2.5">
          <AkditalLogo size={34} />
          <span className="flex items-center gap-2 leading-none text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/mibtech-reverse.svg" alt="Mibtech" className="h-[13px] w-auto" />
            <span className="text-[11px] font-light text-white/35">×</span>
            <span className="flex items-end gap-[1px]">
              <JabbMark size={13} />
              <span className="text-[12.5px] font-[800] italic leading-[0.8] tracking-[-0.02em]">ABB</span>
            </span>
          </span>
        </div>
        {children}
        <p className="mt-8 text-center text-[11px] text-[var(--mut)]">Jumeau numérique du programme · document confidentiel, réservé aux équipes Akdital, Mibtech et JABB</p>
      </div>
    </main>
  );
}
