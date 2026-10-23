import { chromium } from "playwright";
const pages = ["/", "/ar/", "/fr/", "/es/", "/features/", "/guide/", "/security/", "/faq/", "/docs/"];
const sizes = [[390, 844], [1440, 900]];
const b = await chromium.launch();
let fail = 0;
for (const [w, h] of sizes) {
  for (const scheme of ["light", "dark"]) {
    for (const u of pages) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, reducedMotion: "reduce" });
      const p = await ctx.newPage();
      const errs = [];
      p.on("console", (m) => {
        const t = m.text();
        if (m.type() === "error" && !t.includes("Failed to load resource")) errs.push(t.slice(0, 120));
      });
      p.on("pageerror", (e) => errs.push("pageerror: " + e.message.slice(0, 120)));
      await p.goto("http://127.0.0.1:4180" + u, { waitUntil: "networkidle" });
      const r = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const hs = document.documentElement.scrollWidth;
        const bad = [...document.querySelectorAll("h1,h2,h3,p,li,a,span")].filter((el) => {
          const rr = el.getBoundingClientRect();
          return rr.width > 0 && rr.right > vw + 1.5;
        }).slice(0, 3).map((el) => el.className || el.tagName);
        return { hs, vw, bad, theme: document.documentElement.getAttribute("data-theme") };
      });
      if (r.hs > r.vw + 1 || r.bad.length || errs.length) {
        fail++;
        console.log(`${w}${scheme} ${u}`, JSON.stringify(r), errs.slice(0, 2));
      }
      await ctx.close();
    }
  }
}
await b.close();
console.log(fail ? `issues: ${fail}` : "all clean");
