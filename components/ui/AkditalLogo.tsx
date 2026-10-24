// Akdital logo: the official mark (gradient ring + three drops) followed by the wordmark in a rounded bold sans (Nunito 800).
import localFont from "next/font/local";

const nunito = localFont({ src: "../../app/fonts/nunito-latin-wght-normal.woff2", weight: "200 1000", display: "swap" }); // shipped font (OFL), no Google Fonts fetch at build

/** Akdital brand colours (accents only). */
export const AKDITAL = { navy: "#1E2A5E", blue: "#1488CC", light: "#1DB4EA" };

export function AkditalMark({ size = 18, white = false, className }: { size?: number; white?: boolean; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={white ? "/brand/akdital-mark-white.svg" : "/brand/akdital-mark.svg"} alt="" width={size} height={size} className={className} style={{ width: size, height: size }} />;
}

export default function AkditalLogo({ size = 18, text = true, className }: { size?: number; text?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`} style={{ gap: Math.round(size * 0.36) }} aria-label="Akdital">
      <AkditalMark size={size} />
      {text && (
        <span className={nunito.className} style={{ fontWeight: 800, fontSize: Math.round(size * 0.82), letterSpacing: "0.06em", lineHeight: 1, color: "#fff" }}>AKDITAL</span>
      )}
    </span>
  );
}
