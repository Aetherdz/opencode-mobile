import { chromium } from "playwright";
import fs from "node:fs";

const out = "/tmp/opencode/shots";
fs.mkdirSync(out, { recursive: true });

const pages = [
  { name: "home-desktop", url: "http://127.0.0.1:4180/", w: 1440, h: 1000 },
  { name: "home-mobile", url: "http://127.0.0.1:4180/", w: 390, h: 844 },
  { name: "home-ar-mobile", url: "http://127.0.0.1:4180/ar/", w: 390, h: 844 },
  { name: "features-desktop", url: "http://127.0.0.1:4180/features/", w: 1440, h: 1000 },
  { name: "features-mobile", url: "http://127.0.0.1:4180/features/", w: 390, h: 844 },
];

const browser = await chromium.launch();
for (const p of pages) {
  const ctx = await browser.newContext({
    viewport: { width: p.w, height: p.h },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(p.url, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${p.name}-viewport.png` });
  await page.screenshot({ path: `${out}/${p.name}-full.png`, fullPage: true });
  // Header controls geometry
  const geo = await page.evaluate(() => {
    const sel = [".theme-toggle", ".lang-switch summary", ".nav-github", ".menu-toggle", ".brand"];
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
        radius: cs.borderRadius, display: cs.display,
      };
    };
    return Object.fromEntries(sel.map((s) => [s, box(document.querySelector(s))]));
  });
  console.log(p.name, JSON.stringify(geo));
  await ctx.close();
}
await browser.close();
