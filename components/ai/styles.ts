// Styles of the AI layer (scoped "jb-" classes, injected once by Assistant.tsx). Built on the app tokens of globals.css.
export const AI_CSS = `
.jb-cursor { position: fixed; left: 0; top: 0; z-index: 100; pointer-events: none; opacity: 0; transition: opacity .28s ease; will-change: transform; }
.jb-cursor[data-visible="true"] { opacity: 1; }
.jb-arrow { position: absolute; left: -3px; top: -2px; overflow: visible; filter: drop-shadow(0 0 10px rgba(91,124,255,.55)) drop-shadow(0 6px 10px rgba(0,0,0,.45)); transition: transform .16s cubic-bezier(.2,.8,.2,1); transform-origin: 3px 2px; }
.jb-cursor[data-click="1"] .jb-arrow { transform: scale(.86); }
.jb-cursor-pill { position: absolute; left: 20px; top: 24px; display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 9px 0 8px; border-radius: 999px;
  background: linear-gradient(135deg, rgba(91,124,255,.95), rgba(54,81,232,.95)); color: #fff; font-size: 11.5px; font-weight: 600; letter-spacing: .01em; white-space: nowrap;
  box-shadow: 0 6px 18px -6px rgba(60,91,255,.75), inset 0 1px 0 rgba(255,255,255,.35); }
.jb-ripple { position: absolute; left: -22px; top: -22px; width: 44px; height: 44px; border-radius: 50%; border: 2px solid rgba(142,166,255,.9); opacity: 0; transform: scale(.2); }
.jb-ripple.go { animation: jb-ripple .62s cubic-bezier(.2,.8,.2,1); }
@keyframes jb-ripple { 0% { opacity: .9; transform: scale(.2); } 100% { opacity: 0; transform: scale(1.5); } }

.jb-dock { position: fixed; left: 16px; bottom: 16px; z-index: 60; display: flex; gap: 8px; align-items: center; }
.jb-btn { display: inline-flex; align-items: center; gap: 9px; height: 46px; padding: 0 16px 0 7px; border-radius: 999px; color: var(--txt); font-size: 13.5px; font-weight: 600; letter-spacing: -.005em; cursor: pointer; transition: transform .2s cubic-bezier(.2,.8,.2,1), background .2s; }
.jb-btn:hover { transform: translateY(-1px); }
/* the 3D scenes can be bright: the dock uses a darker glass so its labels stay readable on any background */
.jb-btn.glass { background: linear-gradient(140deg, rgba(24,32,64,.74), rgba(10,15,33,.80)); }
.jb-btn:active { transform: translateY(0) scale(.98); }
.jb-btn .ico { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; }
.jb-btn .ico.blue { background: linear-gradient(145deg, #5B7CFF, #3651E8); color: #fff; box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 6px 16px -6px rgba(60,91,255,.8); }
.jb-btn .ico.soft { background: rgba(255,255,255,.08); color: var(--txt); }
.jb-btn.round { width: 46px; padding: 0; justify-content: center; }
.jb-btn[data-active="true"] { background: linear-gradient(140deg, rgba(91,124,255,.26), rgba(91,124,255,.12)); border-color: rgba(142,166,255,.35); }
.jb-dock[data-compact="true"] { gap: 4px; }
.jb-dock[data-compact="true"] .jb-btn { width: 42px; height: 42px; padding: 0; justify-content: center; }
.jb-dock[data-compact="true"] .jb-btn .ico { width: 30px; height: 30px; }
.jb-dock[data-compact="true"] .lbl, .jb-dock[data-compact="true"] .kbd, .jb-dock[data-compact="true"] .jb-kbd, .jb-dock[data-compact="true"] .lbl-t { display: none !important; }
.jb-dock[data-compact="true"] .jb-modes { position: absolute; left: 0; bottom: calc(100% + 10px); width: 380px; border-radius: 18px; padding: 8px; display: grid; gap: 4px; }
.jb-modes button { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; text-align: left; padding: 10px 12px 10px 8px; border-radius: 12px; color: var(--txt); background: transparent; border: 0; cursor: pointer; }
.jb-modes button:hover { background: rgba(255,255,255,.07); }
.jb-modes .ico { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; }
.jb-modes .ico.blue { background: linear-gradient(145deg, #5B7CFF, #3651E8); color: #fff; }
.jb-modes .t { display: grid; gap: 2px; }
.jb-modes b { font-size: 14px; font-weight: 650; }
.jb-modes small { font-size: 12px; color: var(--mut); line-height: 1.35; }
.jb-modes .d { font-family: var(--font-geist-mono), monospace; font-size: 12px; color: #B9C7FF; white-space: nowrap; }
.jb-kbd { display: none; }
.jb-btn .lbl-t { color: #B9C7FF; border-color: rgba(142,166,255,.3); }
.jb-modes { position: absolute; left: 0; bottom: calc(100% + 10px); width: 380px; border-radius: 18px; padding: 8px; display: grid; gap: 4px; }
.jb-modes button { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 10px; text-align: left; padding: 10px 12px 10px 8px; border-radius: 12px; color: var(--txt); background: transparent; border: 0; cursor: pointer; }
.jb-modes button:hover { background: rgba(255,255,255,.07); }
.jb-modes .ico { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; }
.jb-modes .ico.blue { background: linear-gradient(145deg, #5B7CFF, #3651E8); color: #fff; }
.jb-modes .t { display: grid; gap: 2px; }
.jb-modes b { font-size: 14px; font-weight: 650; }
.jb-modes small { font-size: 12px; color: var(--mut); line-height: 1.35; }
.jb-modes .d { font-family: var(--font-geist-mono), monospace; font-size: 12px; color: #B9C7FF; white-space: nowrap; }
.jb-kbd { font-family: var(--font-geist-mono), monospace; font-size: 10.5px; color: var(--mut); border: 1px solid var(--line-2); border-radius: 6px; padding: 1px 5px; margin-left: 2px; font-weight: 500; }

.jb-eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; }
.jb-eq i { width: 2.5px; border-radius: 2px; background: currentColor; height: 4px; transition: height .3s; }
.jb-eq[data-on="true"] i { animation: jb-eq 1.4s ease-in-out infinite; }
.jb-eq[data-on="true"] i:nth-child(2) { animation-delay: -.35s; } .jb-eq[data-on="true"] i:nth-child(3) { animation-delay: -.8s; } .jb-eq[data-on="true"] i:nth-child(4) { animation-delay: -1.1s; }
@keyframes jb-eq { 0%,100% { height: 4px; } 50% { height: 13px; } }

.jb-panel { position: fixed; left: 16px; bottom: 74px; z-index: 60; width: clamp(360px, 25vw, 440px); height: min(620px, calc(100vh - 84px - 74px - 12px)); border-radius: 22px; display: flex; flex-direction: column; overflow: hidden; }
.jb-head { display: flex; align-items: center; gap: 12px; padding: 14px 14px 12px 16px; border-bottom: 1px solid var(--line); }
.jb-av { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: linear-gradient(145deg, #5B7CFF, #3651E8); box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 8px 20px -8px rgba(60,91,255,.9); position: relative; flex-shrink: 0; }
.jb-av::after { content: ""; position: absolute; right: 0; bottom: 0; width: 9px; height: 9px; border-radius: 50%; background: var(--green); border: 2px solid #0E1530; }
.jb-msgs { flex: 1; overflow-y: auto; padding: 18px 16px 10px; display: flex; flex-direction: column; gap: 14px; overscroll-behavior: contain; }
.jb-msg { max-width: 92%; font-size: 14px; line-height: 1.58; color: var(--txt); overflow-wrap: anywhere; }
.jb-msg.me { align-self: flex-end; max-width: 84%; padding: 9px 14px; border-radius: 16px 16px 5px 16px; background: linear-gradient(140deg, rgba(91,124,255,.32), rgba(60,91,255,.22)); border: 1px solid rgba(142,166,255,.28); }
.jb-msg.bot { align-self: flex-start; padding: 11px 14px; border-radius: 16px 16px 16px 5px; background: rgba(255,255,255,.045); border: 1px solid var(--line); }
.jb-msg.bot strong { color: #fff; font-weight: 650; }
.jb-msg.bot ul { margin: 6px 0 0; padding-left: 18px; display: grid; gap: 3px; list-style: disc; }
.jb-msg.bot li::marker { color: #8EA6FF; }
.jb-msg.bot p + p { margin-top: 6px; }
.jb-msg.err { color: var(--coral); }
.jb-acts { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 7px; }
.jb-act { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border-radius: 999px; font-size: 11.5px; font-weight: 600; color: #B9C7FF; background: var(--blue-soft); border: 1px solid rgba(142,166,255,.22); }
.jb-dots { display: inline-flex; gap: 4px; padding: 4px 0; }
.jb-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--mut); animation: jb-dot 1.1s ease-in-out infinite; }
.jb-dots i:nth-child(2) { animation-delay: .15s; } .jb-dots i:nth-child(3) { animation-delay: .3s; }
@keyframes jb-dot { 0%,80%,100% { opacity: .25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
.jb-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.jb-chip { font-size: 12.5px; line-height: 1.3; text-align: left; padding: 7px 11px; border-radius: 12px; color: var(--txt-2); background: rgba(255,255,255,.05); border: 1px solid var(--line); cursor: pointer; transition: background .18s, border-color .18s, color .18s; }
.jb-chip:hover { background: var(--blue-soft); border-color: rgba(142,166,255,.32); color: #fff; }
.jb-input { display: flex; align-items: flex-end; gap: 8px; padding: 10px 10px 12px 14px; border-top: 1px solid var(--line); }
.jb-input textarea { flex: 1; resize: none; background: transparent; border: 0; outline: none; color: var(--txt); font: inherit; font-size: 14px; line-height: 1.5; max-height: 120px; padding: 8px 0; }
.jb-input textarea::placeholder { color: var(--mut); }
.jb-ibtn { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: var(--txt-2); background: rgba(255,255,255,.06); border: 1px solid var(--line); cursor: pointer; transition: background .18s, color .18s; flex-shrink: 0; }
.jb-ibtn:hover { background: rgba(255,255,255,.12); color: #fff; }
.jb-ibtn.send { background: linear-gradient(145deg, #5B7CFF, #3651E8); color: #fff; border-color: transparent; }
.jb-ibtn.send:disabled { opacity: .35; cursor: default; }
.jb-ibtn.live { color: #fff; background: rgba(91,124,255,.35); }

.jb-voice-wrap { position: fixed; inset: 0; z-index: 90; pointer-events: none; }
.jb-voice-scrim { position: absolute; inset: 0; background: radial-gradient(900px 600px at 50% 50%, rgba(7,11,24,.55), rgba(7,11,24,.15)); pointer-events: auto; }
.jb-voice { position: absolute; left: 50%; width: min(620px, calc(100vw - 40px)); border-radius: 26px; padding: 26px 30px 18px; pointer-events: auto; text-align: center; }
.jb-orb { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center; position: relative; background: linear-gradient(145deg, #5B7CFF, #3651E8); box-shadow: inset 0 1px 0 rgba(255,255,255,.35), 0 14px 40px -12px rgba(60,91,255,.9); }
.jb-orb::before, .jb-orb::after { content: ""; position: absolute; inset: -6px; border-radius: 50%; border: 1.5px solid rgba(142,166,255,.45); opacity: 0; }
.jb-voice[data-state="listening"] .jb-orb::before, .jb-voice[data-state="speaking"] .jb-orb::before { animation: jb-ring 2.2s ease-out infinite; }
.jb-voice[data-state="listening"] .jb-orb::after, .jb-voice[data-state="speaking"] .jb-orb::after { animation: jb-ring 2.2s ease-out 1.1s infinite; }
.jb-voice[data-state="thinking"] .jb-orb { animation: jb-breathe 1.6s ease-in-out infinite; }
@keyframes jb-ring { 0% { opacity: .8; transform: scale(.9); } 100% { opacity: 0; transform: scale(1.6); } }
@keyframes jb-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.jb-vstate { font-family: var(--font-geist-mono), monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #9FB2FF; }
.jb-heard { margin-top: 10px; font-size: 24px; line-height: 1.35; font-weight: 600; letter-spacing: -.02em; color: var(--txt); min-height: 32px; }
.jb-heard .interim { color: var(--mut); }
.jb-answer { margin-top: 12px; font-size: 16.5px; line-height: 1.55; color: var(--txt-2); max-height: 30vh; overflow: hidden; }
.jb-answer strong { color: #fff; }
.jb-wave { display: block; width: 100%; height: 64px; margin-top: 12px; }
.jb-vfoot { margin-top: 8px; display: flex; justify-content: center; gap: 16px; font-size: 12px; color: var(--mut); }

.jb-tour { position: fixed; left: 0; z-index: 55; display: flex; justify-content: center; pointer-events: none; padding: 0 24px; transition: right .7s cubic-bezier(.2,.8,.2,1), bottom .5s cubic-bezier(.2,.8,.2,1); }
.jb-tour-card { pointer-events: auto; width: min(1040px, 100%); border-radius: 22px; padding: 14px 18px 20px 26px; position: relative; }
.jb-tour-top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
.jb-tour-top .eyebrow { color: #9FB2FF; white-space: nowrap; }
.jb-tour-top .chap { color: var(--txt); font-size: 13.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jb-tour-top .title { color: var(--mut); font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.jb-tour-top .clock { font-family: var(--font-geist-mono), monospace; font-size: 12px; color: var(--mut); margin-right: 6px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.jb-tour-cap { font-size: clamp(20px, 1.45vw, 28px); line-height: 1.42; font-weight: 500; letter-spacing: -.015em; color: var(--txt); min-height: 2.84em; }
.jb-tour-ctl { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.jb-tour-ctl button { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: var(--txt); background: rgba(255,255,255,.07); border: 1px solid var(--line); cursor: pointer; transition: background .18s; }
.jb-tour-ctl button:hover, .jb-tour-ctl button[data-on="true"] { background: rgba(255,255,255,.14); }
.jb-tour-bar { position: absolute; left: 26px; right: 18px; bottom: 9px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.08); }
.jb-tour-bar i { position: absolute; left: 0; top: 0; display: block; height: 100%; width: 0; background: linear-gradient(90deg, #5B7CFF, #8EA6FF); box-shadow: 0 0 10px rgba(91,124,255,.7); }
.jb-tour-bar .seg { position: absolute; top: -6px; height: 15px; background: transparent; border: 0; padding: 0; cursor: pointer; border-left: 2px solid rgba(7,11,24,.9); }
.jb-tour-bar .seg:first-of-type { border-left: 0; }
.jb-tour-bar .seg:hover { background: linear-gradient(transparent 6px, rgba(142,166,255,.35) 6px, rgba(142,166,255,.35) 9px, transparent 9px); }
.jb-chapters { position: absolute; right: 14px; bottom: calc(100% + 10px); width: min(440px, 90%); max-height: 60vh; overflow: auto; border-radius: 18px; padding: 10px 6px; display: grid; gap: 2px; z-index: 2; }
.jb-chapters button { display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 8px; text-align: left; padding: 8px 10px; border-radius: 10px; color: var(--txt-2); font-size: 13.5px; background: transparent; border: 0; cursor: pointer; }
.jb-chapters button:hover { background: rgba(255,255,255,.07); color: #fff; }
.jb-chapters button[data-now="true"] { background: var(--blue-soft); color: #fff; }
.jb-chapters .n { font-family: var(--font-geist-mono), monospace; font-size: 11px; color: #9FB2FF; }
.jb-chapters .d { font-family: var(--font-geist-mono), monospace; font-size: 11.5px; color: var(--mut); }
.jb-ticks { display: flex; gap: 3px; }
.jb-ticks i { width: 14px; height: 3px; border-radius: 2px; background: rgba(255,255,255,.14); }
.jb-ticks i[data-s="done"] { background: rgba(142,166,255,.65); }
.jb-ticks i[data-s="now"] { background: #8EA6FF; box-shadow: 0 0 8px rgba(91,124,255,.8); }
@media (prefers-reduced-motion: reduce) { .jb-cursor { transition: none; } .jb-ripple.go { animation: none; } }
`;
