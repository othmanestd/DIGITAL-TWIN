// Styles of the story overlay (guided visit): letterbox, title card, stamp, chips, ledger, threads, finale.
// Calm: the atlas palette (app/globals.css), glass cards, tabular figures, slow easings. No neon.
export const STORY_CSS = `
.st-root { position: fixed; inset: 0; pointer-events: none; z-index: 45; font-feature-settings: "tnum", "ss01"; }
.atlas-labels { transition: opacity .6s ease; }
body[data-story-cinema="1"] .atlas-labels { opacity: 0 !important; }
.st-fade { position: fixed; inset: 0; background: #03050C; z-index: 52; pointer-events: none; }
.st-bar { position: fixed; left: 0; right: 0; height: 0; background: #03050C; z-index: 53; transition: height 1.6s cubic-bezier(.65,0,.35,1);
  display: flex; align-items: center; justify-content: center; overflow: hidden; }
.st-bar.top { top: 0; } .st-bar.bottom { bottom: 0; }
.st-bar[data-on="true"] { height: 11.5vh; }
.st-bar span { color: var(--txt-2); font-size: 13px; letter-spacing: .14em; text-transform: uppercase; }
.st-title { position: fixed; inset: 0; z-index: 54; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
  background: radial-gradient(75% 60% at 50% 48%, rgba(3,5,12,.42) 0%, rgba(3,5,12,.62) 55%, rgba(3,5,12,.9) 100%); }
.st-title .eyebrow { font-size: 12px; text-transform: uppercase; color: #9FB2FF; margin-bottom: 18px; }
.st-title h1 { margin: 0; font-size: clamp(44px, 6.4vw, 92px); font-weight: 250; letter-spacing: -.02em; color: #F4F6FB; text-shadow: 0 10px 50px rgba(0,0,0,.55); }
.st-title p { margin: 14px 0 0; font-size: clamp(16px, 1.6vw, 22px); color: var(--txt-2); font-weight: 400; letter-spacing: .02em; }
.st-title p span { color: #9FB2FF; padding: 0 .3em; }
.st-title small { margin-top: 26px; font-size: 12px; color: var(--mut); letter-spacing: .06em; }
.st-stamp { position: fixed; top: 80px; left: 146px; z-index: 46; transition: top 1.6s cubic-bezier(.65,0,.35,1); display: flex; flex-direction: column; gap: 0; padding: 8px 16px 6px 14px; border-radius: 16px;
  background: rgba(8,12,28,.58); border: 1px solid rgba(255,255,255,.1); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.st-root[data-lb="true"] .st-stamp { top: calc(11.5vh + 16px); z-index: 54; }
.st-stamp .t { font-size: 11px; text-transform: uppercase; letter-spacing: .22em; color: var(--txt-2); }
.st-stamp .y { position: relative; height: 38px; overflow: hidden; }
.st-stamp .y b { display: block; font-size: 30px; line-height: 38px; font-weight: 300; letter-spacing: .02em; color: #F4F6FB; }
.st-chip { position: fixed; left: 0; top: 0; z-index: 47; display: flex; align-items: center; gap: 9px; padding: 7px 13px 7px 10px; border-radius: 999px;
  background: rgba(10,15,32,.72); border: 1px solid rgba(255,255,255,.14); backdrop-filter: blur(14px) saturate(1.2); -webkit-backdrop-filter: blur(14px) saturate(1.2);
  box-shadow: 0 12px 30px -12px rgba(0,0,0,.6); white-space: nowrap; will-change: transform, opacity; }
.st-chip i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.st-chip span { display: flex; flex-direction: column; line-height: 1.15; }
.st-chip b { font-size: 13px; font-weight: 600; color: #F4F6FB; }
.st-chip small { font-size: 11px; color: var(--txt-2); }
.st-chip em { font-size: 11px; color: var(--mut); font-style: normal; margin-top: 2px; }
.st-chip[data-intro="true"] { padding: 9px 15px 9px 12px; }
.st-chip[data-intro="true"] b { font-size: 15px; }
.st-threads { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 49; overflow: visible; }
.st-ledger { position: fixed; top: 80px; right: calc(var(--panel-w, 0px) + 112px); width: 318px; z-index: 50; border-radius: 20px; padding: 14px 16px 12px;
  transition: right .7s cubic-bezier(.2,.8,.2,1); pointer-events: auto; }
.st-ledger header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
.st-ledger header .u { font-size: 11px; color: var(--mut); }
.st-ledger .eyebrow { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #9FB2FF; }
.st-group, .st-total, .st-cost, .st-net { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; transition: background .6s, color .6s; border-radius: 10px; }
.st-group { margin-top: 8px; padding: 2px 6px; font-size: 12px; color: var(--txt-2); letter-spacing: .02em; }
.st-group b { font-size: 13px; font-weight: 600; color: #EDF0F7; }
.st-row { display: grid; grid-template-columns: 8px 1fr auto; grid-template-rows: auto 3px; column-gap: 9px; align-items: center; padding: 5px 6px 6px; border-radius: 10px; transition: background .6s; }
.st-row i { width: 7px; height: 7px; border-radius: 50%; grid-row: 1; }
.st-row .l { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.st-row .l b { font-size: 13px; font-weight: 500; color: #EDF0F7; }
.st-row .l small { font-size: 10.5px; color: var(--mut); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.st-row .v { font-size: 17px; font-weight: 600; color: var(--txt-2); min-width: 54px; text-align: right; transition: color .6s; }
.st-row .bar { grid-column: 2 / 4; grid-row: 2; height: 3px; border-radius: 3px; background: rgba(255,255,255,.07); overflow: hidden; margin-top: 3px; }
.st-row .bar em { display: block; height: 100%; border-radius: 3px; opacity: .8; transition: width .3s linear; }
.st-row[data-hot="true"], .st-group[data-hot="true"], .st-total[data-hot="true"] { background: rgba(255,255,255,.07); }
.st-total { margin-top: 10px; padding: 8px 6px 2px; border-top: 1px solid rgba(255,255,255,.1); border-radius: 0; font-size: 13px; color: #EDF0F7; }
.st-total b { font-size: 19px; font-weight: 600; }
.st-total small, .st-cost small, .st-net small { display: block; font-size: 10.5px; color: var(--mut); font-weight: 400; }
.st-cost { padding: 8px 6px 2px; font-size: 13px; color: #EDF0F7; overflow: hidden; }
.st-cost b { font-size: 19px; font-weight: 600; }
.st-net { margin-top: 8px; padding: 10px 8px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); overflow: hidden; font-size: 14px; color: #F4F6FB; }
.st-net b { font-size: 28px; font-weight: 600; letter-spacing: -.01em; color: #FFFFFF; text-shadow: 0 0 24px rgba(156,176,255,.35); }
.st-finale { position: fixed; top: 152px; left: 146px; width: min(760px, calc(56vw - 60px)); z-index: 51; border-radius: 24px; padding: 18px 26px 18px; }
.st-finale .eyebrow { font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: #9FB2FF; text-align: center; }
.st-bridge { display: flex; align-items: flex-end; justify-content: center; gap: 14px; margin: 12px 0 8px; flex-wrap: wrap; }
.st-bridge .cell { display: flex; flex-direction: column; align-items: center; }
.st-bridge .cell b { font-size: 30px; font-weight: 500; letter-spacing: -.01em; }
.st-bridge .cell[data-big="true"] b { font-size: 46px; font-weight: 600; text-shadow: 0 0 30px rgba(156,176,255,.35); }
.st-bridge .cell small { font-size: 11px; color: var(--mut); margin-top: 2px; }
.st-bridge .op { font-size: 26px; color: var(--mut); font-weight: 300; padding-bottom: 18px; }
.st-chart { margin: 4px auto 0; max-width: 560px; }
.st-chart text.n { font-size: 11px; fill: #EDF0F7; font-weight: 600; }
.st-chart text.yl { font-size: 10.5px; fill: #8D97B0; }
.st-chart .legend { display: flex; gap: 18px; justify-content: center; font-size: 10.5px; color: var(--mut); margin-top: 2px; }
.st-chart .legend i { display: inline-block; width: 10px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
.st-chart .legend i.dash { background: repeating-linear-gradient(90deg, #E6CF97 0 4px, transparent 4px 7px); }
.st-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; opacity: .22; transition: opacity 1s; }
.st-kpis[data-on="true"] { opacity: 1; }
.st-kpis div { text-align: center; padding: 8px 6px; border-radius: 12px; background: rgba(255,255,255,.04); }
.st-kpis b { display: block; font-size: 19px; font-weight: 600; color: #F4F6FB; }
.st-kpis small { font-size: 10.5px; color: var(--mut); }
@media (prefers-reduced-motion: reduce) { .st-bar { transition: none; } }
`;
