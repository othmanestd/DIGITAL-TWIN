import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// fonts shipped with the app (app/fonts, SIL Open Font License): the build never depends on fetching Google Fonts
const geistSans = localFont({ src: "./fonts/Geist-Variable.woff2", variable: "--font-geist-sans", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "./fonts/GeistMono-Variable.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: "Akdital augmenté · jumeau numérique du programme · Mibtech × JABB",
  description: "Jumeau numérique interactif du programme : l'hôpital type Akdital, le réseau marocain et le monde, augmentés par les agents IA.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#070B18" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
