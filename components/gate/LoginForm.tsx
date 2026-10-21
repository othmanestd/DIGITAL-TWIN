"use client";
// Password card. Works without JavaScript (plain form POST); with it, errors show in place and the chooser opens on success.
import { useEffect, useRef, useState } from "react";

export default function LoginForm() {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("e")) setErr(true);
    input.current?.focus();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true); setErr(false);
    try {
      const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
      if (r.ok) { window.location.href = "/choisir"; return; }
      setErr(true); setPw(""); input.current?.focus();
    } catch {
      setErr(true);
    }
    setBusy(false);
  }

  return (
    <form action="/api/login" method="post" onSubmit={submit} className="glass-read w-full rounded-[26px] p-7">
      <div className="eyebrow text-[var(--blue)]">Accès réservé</div>
      <h1 className="mt-1.5 text-[22px] font-[750] leading-tight text-white">Akdital augmenté</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--txt-2)]">Le jumeau numérique du programme : l&apos;hôpital type, le réseau et la valeur créée, cas par cas.</p>
      <label htmlFor="pw" className="mt-6 block text-[11.5px] font-semibold text-[var(--txt-2)]">Mot de passe</label>
      <div className={`mt-1.5 flex items-center rounded-[14px] bg-white/[0.06] ring-1 transition-colors focus-within:ring-[var(--blue)] ${err ? "ring-[#E07A6F]" : "ring-white/[0.12]"}`}>
        <input ref={input} id="pw" name="password" type={show ? "text" : "password"} autoComplete="current-password" required value={pw}
          onChange={(e) => { setPw(e.target.value); setErr(false); }}
          className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-[15px] text-white outline-none placeholder:text-[var(--mut)]" placeholder="••••••••" />
        <button type="button" onClick={() => setShow((v) => !v)} className="mr-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--txt-2)] hover:bg-white/[0.08] hover:text-white"
          aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>{show ? "Masquer" : "Afficher"}</button>
      </div>
      <p className="mt-2 h-4 text-[12px] text-[#F0A79E]" role="alert">{err ? "Mot de passe incorrect." : ""}</p>
      <button type="submit" disabled={busy || !pw}
        className="mt-3 h-11 w-full rounded-[14px] bg-[var(--blue)] text-[14px] font-[700] text-white shadow-[0_8px_24px_-8px_rgba(110,134,240,.7)] transition hover:brightness-110 disabled:opacity-50">
        {busy ? "Vérification…" : "Entrer"}
      </button>
    </form>
  );
}
