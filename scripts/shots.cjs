// node scripts/shots.cjs <url> <outPrefix> '<json steps: [{"js":"...","wait":ms,"name":"x"}]>' [WxH] [initialWait]
const { chromium } = require("playwright-core");
(async () => {
  const [url, prefix, stepsJson, size = "1600x900", init = "9000"] = process.argv.slice(2);
  const [w, h] = size.split("x").map(Number);
  const b = await chromium.launch({ executablePath: process.env.SHOT_EXE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 300)));
  await p.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("[goto]", e.message));
  await p.waitForTimeout(Number(init));
  for (const s of JSON.parse(stepsJson)) {
    if (s.js) { const r = await p.evaluate(s.js).catch((e) => "[eval error] " + e.message); if (r !== undefined) console.log(`[${s.name}]`, JSON.stringify(r).slice(0, 400)); }
    await p.waitForTimeout(s.wait ?? 4000);
    if (s.name) { await p.screenshot({ path: `${prefix}${s.name}.png` }); console.log("saved", `${prefix}${s.name}.png`); }
  }
  await b.close();
})();
