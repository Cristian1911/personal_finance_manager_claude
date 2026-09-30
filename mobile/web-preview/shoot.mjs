// Serves a `expo export --platform web` build and screenshots routes in headless Chromium.
// Usage: node web-preview/shoot.mjs <exportDir> <outDir> [route[@Tap text|Other text] ...]
// Each route is loaded, the listed texts are tapped in order, then a full-page screenshot is saved.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [dir, out, ...routes] = process.argv.slice(2);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".png": "image/png", ".ttf": "font/ttf", ".json": "application/json", ".ico": "image/x-icon" };
const server = http.createServer((req, res) => {
  let file = path.join(dir, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dir, "index.html");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Type", TYPES[path.extname(file)] ?? "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
fs.mkdirSync(out, { recursive: true });
// CHROMIUM_PATH wins; Claude Code cloud containers ship one at /opt/pw-browsers/chromium;
// elsewhere Playwright's own (run `npx playwright install chromium` once).
const CLOUD_CHROMIUM = "/opt/pw-browsers/chromium";
const executablePath = process.env.CHROMIUM_PATH ?? (fs.existsSync(CLOUD_CHROMIUM) ? CLOUD_CHROMIUM : undefined);
const browser = await chromium.launch({ executablePath });
// WIDTH/HEIGHT pick the phone size (gallery widths: 360, 390, 430); a tall HEIGHT shows long scroll views whole.
const page = await browser.newPage({ viewport: { width: Number(process.env.WIDTH ?? 390), height: Number(process.env.HEIGHT ?? 844) } });
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && console.log(`[${m.type()}] ${m.text().slice(0, 400)}`));
page.on("pageerror", (e) => console.log(`[pageerror] ${e.message.slice(0, 600)}`));
// Enter demo mode first (local seed data, nothing reaches Supabase).
if (process.env.DEMO !== "0") {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const demo = page.getByText("Probar demo sin cuenta");
  if (await demo.waitFor({ timeout: 15000 }).then(() => true, () => false)) {
    await demo.click();
    await page.waitForTimeout(4000);
    console.log(`demo -> ${page.url()}`);
  }
}
for (const spec of routes.length ? routes : ["/"]) {
  const [route, taps = ""] = spec.split("@");
  // Unload first: the SQLite worker holds OPFS file locks until its page is gone.
  await page.goto("about:blank");
  await page.waitForTimeout(1000);
  await page.goto(base + route, { waitUntil: "networkidle" }).catch((e) => console.log(`[goto] ${e.message}`));
  await page.waitForTimeout(2500);
  for (const text of taps.split("|").filter(Boolean)) {
    await page.getByText(text, { exact: true }).first().click({ timeout: 8000 }).catch((e) => console.log(`[tap] ${text}: ${e.message.split("\n")[0]}`));
    await page.waitForTimeout(1500);
  }
  const name = spec.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 60) || "root";
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
  console.log(`shot ${route} -> ${page.url()}`);
}
await browser.close();
server.close();
