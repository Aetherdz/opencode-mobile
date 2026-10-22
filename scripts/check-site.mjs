#!/usr/bin/env node
// Check local links and fragment targets in the static website. External URLs
// are intentionally not fetched: the site has no build step and CI should not
// depend on third-party uptime.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "website");

function collectHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectHtml(full));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

const htmlFiles = collectHtml(root);

const idsByFile = new Map();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  idsByFile.set(file, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])));
}

const errors = [];
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  if (html.includes('<footer class="site-footer">')) {
    const footerStart = html.indexOf('<footer class="site-footer">');
    const footerEnd = html.indexOf("</footer>", footerStart);
    const footer = html.slice(footerStart, footerEnd < 0 ? html.length : footerEnd);
    if (!footer.includes("footer-brand-copy")) errors.push(`${path.relative(root, file)}: footer brand copy is missing`);
    const opens = [...footer.matchAll(/<div\b/g)].length;
    const closes = [...footer.matchAll(/<\/div>/g)].length;
    if (opens !== closes) errors.push(`${path.relative(root, file)}: unbalanced footer div markup (${opens} open, ${closes} close)`);
    if (!footer.includes("footer-legal")) errors.push(`${path.relative(root, file)}: footer legal notice is missing`);
  }
  const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const raw of refs) {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(raw)) {
      if (raw.startsWith("#")) {
        const fragment = raw.slice(1);
        if (fragment && !idsByFile.get(file).has(fragment)) {
          errors.push(`${path.relative(root, file)}: missing fragment ${raw}`);
        }
      }
      continue;
    }

    const [beforeHash, fragment = ""] = raw.split("#");
    const clean = beforeHash.split("?")[0];
    if (!clean) continue;

    let target = clean.startsWith("/")
      ? path.join(root, clean.slice(1))
      : path.resolve(path.dirname(file), clean);
    if (clean.endsWith("/")) target = path.join(target, "index.html");
    if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, "index.html");

    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(root, file)}: missing ${raw}`);
      continue;
    }

    if (fragment && target.endsWith(".html")) {
      const ids = idsByFile.get(target);
      if (ids && !ids.has(fragment)) {
        errors.push(`${path.relative(root, file)}: missing fragment ${raw}`);
      }
    }
  }
}

const homePages = ["index.html", "ar/index.html", "fr/index.html", "es/index.html"];
for (const relative of homePages) {
  const file = path.join(root, relative);
  const html = fs.readFileSync(file, "utf8");
  const heroStart = html.indexOf('<section class="hero">');
  const heroEnd = html.indexOf("</section>", heroStart);
  if (heroStart < 0 || heroEnd < 0) {
    errors.push(`${relative}: homepage hero section is missing`);
    continue;
  }
  const hero = html.slice(heroStart, heroEnd);
  for (const selector of ['class="eyebrow"', "<h1", 'class="lede"', 'class="actions"']) {
    if (!hero.includes(selector)) errors.push(`${relative}: homepage hero is missing ${selector}`);
  }
}

if (errors.length > 0) {
  console.error("check-site: broken local references");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check-site: ${htmlFiles.length} HTML files, local links and fragments OK`);
