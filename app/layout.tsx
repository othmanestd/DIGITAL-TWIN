import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

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
