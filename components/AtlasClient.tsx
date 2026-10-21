"use client";
// The atlas renders in the browser only: the dataset chosen after sign-in (cookie, lib/data/dataset.ts) is read before
// any data module evaluates, so every figure on screen comes from that one dataset.
import dynamic from "next/dynamic";

const AtlasApp = dynamic(() => import("./AtlasApp"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center" style={{ background: "radial-gradient(1200px 800px at 50% 40%, #0D1435 0%, #060A1C 60%, #02030A 100%)" }}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[var(--blue)]" aria-label="Chargement" />
    </div>
  ),
});

export default function AtlasClient() {
  return <AtlasApp />;
}
