#!/usr/bin/env node
// Expo's single-page export does not emit a PWA manifest link. Keep the patch
// here instead of post-processing HTML by hand, and make it idempotent.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, "app", "dist", "index.html");

if (!fs.existsSync(file)) {
  console.error(`patch-web-export: missing ${file}. Run the web export first.`);
  process.exit(1);
}

let html = fs.readFileSync(file, "utf8");
const additions = [
  ["manifest.webmanifest", '<link rel="manifest" href="/manifest.webmanifest" />'],
  ["apple-touch-icon", '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />'],
  ["apple-mobile-web-app-capable", '<meta name="apple-mobile-web-app-capable" content="yes" />'],
  [
    "apple-mobile-web-app-status-bar-style",
    '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  ],
  ["apple-mobile-web-app-title", '<meta name="apple-mobile-web-app-title" content="OC Mobile" />'],
];

let changed = false;
for (const [needle, tag] of additions) {
  if (html.includes(needle)) continue;
  const headEnd = html.indexOf("</head>");
  if (headEnd === -1) {
    console.error("patch-web-export: exported HTML has no </head>.");
    process.exit(1);
  }
  html = `${html.slice(0, headEnd)}${tag}\n${html.slice(headEnd)}`;
  changed = true;
}

if (changed) {
  fs.writeFileSync(file, html);
  console.log("patch-web-export: added PWA metadata to app/dist/index.html");
} else {
  console.log("patch-web-export: PWA metadata already present");
}

// GitHub Pages serves 404.html for unknown paths. A copy of the SPA shell makes
// client-side routes work there without a custom server.
const notFound = path.join(path.dirname(file), "404.html");
fs.copyFileSync(file, notFound);
console.log("patch-web-export: wrote app/dist/404.html for static hosts");
