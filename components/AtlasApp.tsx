"use client";
import dynamic from "next/dynamic";
import { useApp } from "@/lib/store";
import TopBar from "@/components/ui/TopBar";
import PlacesExplorer from "@/components/places/PlacesExplorer";
import Sidebar from "@/components/ui/Sidebar";
import Timeline from "@/components/ui/Timeline";
import SidePanel from "@/components/panels/SidePanel";
import SectionView from "@/components/sections/SectionView";
import Assistant from "@/components/ai/Assistant";
import ZoomSlider from "@/components/nav/ZoomSlider";
import NavPad from "@/components/nav/NavPad";
import Shortcuts from "@/components/nav/Shortcuts";
import WalkHud from "@/components/scenes/walk/WalkHud";

const SceneRoot = dynamic(() => import("@/components/scenes/SceneRoot"), { ssr: false });

/** Layout: the 3D stage fills the screen; when something is selected the screen splits (stage left, details right). */
export default function AtlasApp() {
  const panelOpen = useApp((s) => s.panelOpen && s.section === "explorer" && !!s.sel && s.sel.kind !== "overview");
  const section = useApp((s) => s.section);
  // walk mode ("À pied"): the world camera rail and the floor list would fight the visitor's camera
  const walking = useApp((s) => s.walk.phase !== "off");
  return (
    <main
      className="relative h-dvh w-screen overflow-hidden"
      style={{ ["--panel-w" as string]: panelOpen ? "clamp(520px, 39vw, 780px)" : "0px" }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[right,filter,opacity] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ right: "var(--panel-w)", filter: section !== "explorer" ? "blur(6px) brightness(.55)" : "none" }}
        data-anchor="stage"
      >
        <SceneRoot />
        {section === "explorer" && <Timeline />}
        {section === "explorer" && <WalkHud />}
        {section === "explorer" && !walking && (
          <div className="pointer-events-none absolute bottom-[104px] right-4 top-[84px] z-20 flex flex-col items-center justify-center gap-3">
            <NavPad />
            <ZoomSlider />
          </div>
        )}
      </div>
      {section === "explorer" && !walking && <Sidebar />}
      {section === "explorer" && !walking && <PlacesExplorer />}
      <SidePanel />
      {section !== "explorer" && <SectionView />}
      <TopBar />
      <Assistant />
      <Shortcuts />
    </main>
  );
}
