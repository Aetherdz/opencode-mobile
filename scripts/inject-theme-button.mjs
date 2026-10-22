#!/usr/bin/env node
// Inject theme-toggle button into every page that doesn't have it yet.
import fs from "node:fs";
import path from "node:path";

const buttonHTML = `
        <button class="theme-toggle" type="button" aria-pressed="false" aria-label="Toggle dark mode">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle class="sun" cx="8" cy="8" r="2" />
            <path class="moon" d="M12 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM4.93 4.93l1.41 1.41a1 1 0 0 1 0 1.41 1 1 0 0 1-1.41 0 1 1 0 0 1 0-1.41zM8 13v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H9a1 1 0 0 1-1 1v1zM12 12a1 1 0 0 1-1 1H9a1 1 0 0 1 0-2h1a1 1 0 0 1 1 1zM4.93 11.07l-1.41 1.41a1 1 0 0 1-1.41-1.41 1 1 0 0 1 1.41 1.41zM16 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM3 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM11.17 4.93l1.41 1.41a1 1 0 0 1 0 1.41 1 1 0 0 1-1.41 0 1 1 0 0 1 0-1.41zM4.93 11.07l1.41-1.41a1 1 0 0 1 1.41 1.41l-1.41-1.41a1 1 0 0 1-1.41-1.41zM12 4a1 1 0 1 1 0-2V2a1 1 0 0 1-2 0v2a1 1 0 0 1 2 0zM3 12a1 1 0 1 1 0-2V9a1 1 0 0 1-2 0v3a1 1 0 0 1 2 0zM10.2 10.2l-1.41 1.41a1 1 0 0 1-1.41-1.41 1 1 0 0 1 1.41 1.41zM5.8 5.8l-1.41 1.41a1 1 0 0 1-1.41-1.41 1 1 0 0 1 1.41 1.41zM12 10v1a1 1 0 0 1-1 1h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 1 1zM4 4a1 1 0 1 1 0 2H3a1 1 0 0 1 0-2zM11 11a1 1 0 1 1 0-2h-1a1 1 0 0 1 2 0zM6.62 4.98l-1.41-1.41a1 1 0 0 1 0-1.41 1 1 0 0 1 1.41 0 1 1 0 0 1 0 1.41zM9.39 7.07l-1.41-1.41a1 1 0 0 1 0-1.41 1 1 0 0 1 1.41 0 1 1 0 0 1 0 1.41z" />
          </svg>
        </button>`;

const files = [
  "website/features/index.html",
  "website/guide/index.html",
  "website/security/index.html",
  "website/faq/index.html",
  "website/docs/index.html",
  ...[
    "website/ar/features/index.html", "website/ar/guide/index.html", "website/ar/security/index.html", "website/ar/faq/index.html", "website/ar/docs/index.html",
    "website/fr/features/index.html", "website/fr/guide/index.html", "website/fr/security/index.html", "website/fr/faq/index.html", "website/fr/docs/index.html",
    "website/es/features/index.html", "website/es/guide/index.html", "website/es/security/index.html", "website/es/faq/index.html", "website/es/docs/index.html",
  ],
];

for (const rel of files) {
  const p = path.join("/home/zaikabdou1/opencode-mobile-repo", rel);
  if (!fs.existsSync(p)) continue;
  let html = fs.readFileSync(p, "utf8");
  if (html.includes("theme-toggle")) continue; // Already has it
  // Insert before the menu-toggle button inside header-tools
  html = html.replace(
    /(<button\s+class="menu-toggle")/g,
    buttonHTML.trim() + "\n        <button class=\"menu-toggle\"",
  );
  fs.writeFileSync(p, html);
  console.log("Updated:", rel);
}
