// node scripts/shot.cjs <url> <out.png> [js to run before the shot] [waitMs=4000] [WxH=1920x1080]
// Headless Chromium with GPU emulation, so WebGL scenes render. Prints console errors.
const { chromium } = require("playwright-core");
const path = require("path");
const os = require("os");
(async () => {
  const [url = "http://localhost:3333", out = "shot.png", js = "", wait = "4000", size = "1920x1080"] = process.argv.slice(2);
  const [w, h] = size.split("x").map(Number);
  const exe = process.env.SHOT_EXE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const b = await chromium.launch({ executablePath: exe, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[" + m.type() + "]", m.text().slice(0, 300)); });
  p.on("pageerror", (e) => console.log("[pageerror]", e.message.slice(0, 400)));
  await p.goto(url, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("[goto]", e.message));
  await p.waitForTimeout(Number(wait));
  if (js) { const r = await p.evaluate(js).catch((e) => "[eval error] " + e.message); if (r !== undefined) console.log("[eval]", JSON.stringify(r).slice(0, 500)); await p.waitForTimeout(Number(wait)); }
  await p.screenshot({ path: out });
  console.log("saved", out);
  await b.close();
})();
