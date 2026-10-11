// Viewport screenshots down a page via headless Chrome + raw CDP (no extra deps).
// node scripts/shoot.mjs <url> <outPrefix> [width=1440] [height=900] [maxShots=12] [theme]
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";

const [url, prefix, w = "1440", h = "900", max = "12", theme] = process.argv.slice(2);
if (!url || !prefix) {
  console.error("usage: node scripts/shoot.mjs <url> <outPrefix> [width] [height] [maxShots] [theme]");
  process.exit(1);
}
const width = Number(w);
const height = Number(h);
const port = 9400 + Math.floor(Math.random() * 400);
const profile = join(tmpdir(), `shoot-${port}`);
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

const proc = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--no-first-run",
    `--window-size=${width},${height}`,
    "about:blank",
  ],
  { stdio: "ignore" }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function targetWs() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error("Chrome did not start");
}

const ws = new WebSocket(await targetWs());
await new Promise((r) => ws.addEventListener("open", r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result.value;

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 768,
  });
  if (width < 768) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  if (theme) {
    await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try{localStorage.setItem("subspacead-theme","${theme}")}catch(e){}`,
    });
  }
  await send("Page.navigate", { url });
  await sleep(4000);
  if (process.env.SHOOT_ACTION) {
    const out = await evaluate(process.env.SHOOT_ACTION);
    if (out !== undefined) console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
    await sleep(Number(process.env.SHOOT_WAIT ?? 8000));
  }
  const total = await evaluate("document.documentElement.scrollHeight");
  mkdirSync(dirname(prefix), { recursive: true });
  if (process.env.SHOOT_FULL) {
    // Walk the page so scroll-triggered reveals fire, then capture the whole document from the top.
    for (let y = 0; y < total; y += Math.round(height * 0.6)) {
      await evaluate(`window.scrollTo(0, ${y})`);
      await sleep(250);
    }
    await evaluate("window.scrollTo(0, 0)");
    await sleep(1500);
    const full = await evaluate("document.documentElement.scrollHeight");
    const { data } = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height: full, scale: 1 },
    });
    writeFileSync(`${prefix}.png`, Buffer.from(data, "base64"));
    console.log(`${prefix}.png (${full}px)`);
  }
  const shots = process.env.SHOOT_FULL ? 0 : Math.min(Number(max), Math.ceil(total / height));
  for (let i = 0; i < shots; i++) {
    const y = i * height;
    await evaluate(`(window.lenis ? window.lenis.scrollTo(${y}, {immediate:true}) : window.scrollTo(0, ${y}), 0)`);
    await evaluate(`window.scrollTo(0, ${y})`);
    await sleep(1600);
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    const out = `${prefix}-${String(i).padStart(2, "0")}.png`;
    writeFileSync(out, Buffer.from(data, "base64"));
    console.log(out);
  }
  console.log(`page height ${total}px`);
} finally {
  ws.close();
  proc.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {}
}
