import { chromium } from "playwright";

const urls = ["/", "/features/", "/guide/", "/security/", "/faq/", "/docs/", "/ar/", "/ar/features/"];
const sizes = [
  [1440, 900],
  [390, 844],
];

const browser = await chromium.launch();
for (const [w, h] of sizes) {
  for (const u of urls) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:4180${u}`, { waitUntil: "networkidle" });
    const res = await page.evaluate(() => {
      const issues = [];
      const vw = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > vw + 1) {
        issues.push(`hscroll ${document.documentElement.scrollWidth}>${vw}`);
      }
      for (const el of document.querySelectorAll("h1, h2, .display")) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const next = el.nextElementSibling;
        if (!next) continue;
        const nr = next.getBoundingClientRect();
        if (!nr.height) continue;
        // vertical overlap only if they share horizontal space
        const hOverlap = Math.min(r.right, nr.right) - Math.max(r.left, nr.left);
        if (hOverlap > 20 && nr.top < r.bottom - 1) {
          issues.push(
            `overlap ${el.tagName} "${el.textContent.trim().slice(0, 24)}" -> ${next.tagName}.${next.className} by ${(r.bottom - nr.top).toFixed(1)}px`,
          );
        }
      }
      return issues;
    });
    if (res.length) console.log(`${w}px ${u}`, res.join(" | "));
    await ctx.close();
  }
}
await browser.close();
console.log("done");
