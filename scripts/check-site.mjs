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
  for (const match of html.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*class="brand-mark"[^>]*>/g)) {
    const src = match[1];
    const resolved = src.startsWith("https://") ? null : path.resolve(path.dirname(file), src);
    if (resolved && !fs.existsSync(resolved)) errors.push(`${path.relative(root, file)}: missing brand asset ${src}`);
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
  const command = html.match(/<pre id="cmd-bridge"><code>([\s\S]*?)<\/code><\/pre>/)?.[1] ?? "";
  const copyTarget = html.includes('data-copy-target="cmd-bridge"');
  if (!command || command.includes("term-comment") || command.includes("\n")) {
    errors.push(`${relative}: install panel must show only the single copyable setup command`);
  }
  if (!copyTarget) errors.push(`${relative}: install command copy button is missing`);
  const setupNote = html.slice(html.indexOf('class="cmd-note"'), html.indexOf('</p>', html.indexOf('class="cmd-note"')));
  if (!setupNote.includes("opencode-mobile")) errors.push(`${relative}: follow-up pairing command note is missing`);
  if (!hero.includes('class="hero-release"')) errors.push(`${relative}: Android release download panel is missing from the hero`);
  if (!html.includes('class="hero-facts"')) errors.push(`${relative}: transport/license/telemetry facts panel is missing`);
  if (hero.includes('aria-haspopup="true"')) errors.push(`${relative}: non-popup hero content declares aria-haspopup`);
  if (!html.includes('rel="icon"') || !html.includes("assets/favicon.svg")) errors.push(`${relative}: favicon link is missing`);
  if (html.indexOf('id="download"') > html.indexOf('class="hero-facts"')) errors.push(`${relative}: download section must appear before transport/license/telemetry facts`);
  if (html.indexOf('class="footer-legal"') < html.indexOf('id="download"')) errors.push(`${relative}: legal footer note must follow the full download section`);
  if (html.indexOf('class="hero-facts"') < html.indexOf('id="download"') || html.indexOf('class="hero-facts"') > html.indexOf('class="footer-legal"')) errors.push(`${relative}: transport/license/telemetry facts must follow the full download panel and precede legal footer note`);
  const factsStart = html.indexOf('class="hero-facts"');
  const factsEnd = html.indexOf('</dl>', factsStart);
  const factsSection = html.slice(factsStart, factsEnd < 0 ? html.length : factsEnd);
  const footerLegal = html.slice(html.indexOf('class="footer-legal"'), html.indexOf('</p>', html.indexOf('class="footer-legal"')));
  const localizedFacts = {
    "index.html": ["Transport", "Loopback", "License", "MIT", "Telemetry"],
    "ar/index.html": ["النقل", "Loopback", "الترخيص", "MIT", "التتبّع"],
    "fr/index.html": ["Transport", "Loopback", "Licence", "MIT", "Télémétrie"],
    "es/index.html": ["Transporte", "Loopback", "Licencia", "MIT", "Telemetría"],
  }[relative];
  for (const requiredFact of localizedFacts) {
    if (!factsSection.includes(requiredFact)) errors.push(`${relative}: facts panel must include ${requiredFact}`);
  }
  if (!footerLegal.includes('id="year"')) errors.push(`${relative}: legal footer note year marker is missing`);
  if (hero.indexOf('class="hero-release"') > hero.indexOf('class="hero-art"')) errors.push(`${relative}: hero download CTA must be grouped with the copy before artwork in DOM order`);
  if (!hero.includes('class="actions"') || hero.indexOf('class="actions"') > hero.indexOf('class="hero-release"')) errors.push(`${relative}: primary actions must precede the APK card in hero copy`);
  if (relative === "index.html" && !html.includes('href="#install"')) errors.push(`${relative}: setup link is missing`);
  if (relative === "index.html" && !hero.includes("Install the bridge")) errors.push(`${relative}: primary setup command is not promoted in the hero`);
}

if (errors.length > 0) {
  console.error("check-site: broken local references");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check-site: ${htmlFiles.length} HTML files, local links and fragments OK`);
