#!/usr/bin/env node
// Replace the theme-toggle icon with a crisp sun/moon pair.
import fs from "node:fs";
import path from "node:path";

const NEW_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <g class="sun">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.4v2.2M12 19.4v2.2M4.22 4.22l1.56 1.56M18.22 18.22l1.56 1.56M2.4 12h2.2M19.4 12h2.2M4.22 19.78l1.56-1.56M18.22 5.78l1.56-1.56" />
            </g>
            <path class="moon" d="M20.6 14.2A8.6 8.6 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8Z" />
          </svg>`;

const root = "/home/zaikabdou1/opencode-mobile-repo/website";
const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".html")) files.push(p);
  }
})(root);

let changed = 0;
for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  html = html.replace(
    /(<button class="theme-toggle"[^>]*>)\s*<svg[\s\S]*?<\/svg>/g,
    (_m, open) => `${open}\n          ${NEW_SVG}`,
  );
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
    console.log("updated", path.relative(root, file));
  }
}
console.log(`\n${changed} files updated`);
