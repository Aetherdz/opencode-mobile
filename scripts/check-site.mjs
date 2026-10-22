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
  if (heroStart < 0) {
    errors.push(`${relative}: homepage hero section is missing`);
    continue;
  }
  const heroEndTag = html.indexOf('<section class="ticker"', heroStart);
  if (heroStart < 0 || heroEndTag < 0) {
    errors.push(`${relative}: homepage hero section is missing`);
    continue;
  }
  const hero = html.slice(heroStart, heroEndTag);
  for (const selector of ['class="eyebrow"', "<h1", 'class="lede"', 'class="hero-release"', 'class="hero-command"', 'class="actions"']) {
    if (!hero.includes(selector)) errors.push(`${relative}: homepage hero is missing ${selector}`);
  }
  const artIndex = hero.indexOf('class="hero-art"');
  const copyIndex = hero.indexOf('class="hero-copy"');
  const actionsIndex = hero.indexOf('class="actions"');
  const ledeIndex = hero.indexOf('class="lede"');
  const releaseIndex = hero.indexOf('class="hero-release"');
  const commandIndex = hero.indexOf('class="hero-command"');
  const releaseEndIndex = hero.indexOf('</div>', releaseIndex);
  const commandEndIndex = hero.indexOf('</div>', commandIndex);
  const firstCloseAfterActions = hero.indexOf('</div>', actionsIndex);
  const secondCloseAfterActions = hero.indexOf('</div>', firstCloseAfterActions + 6);
  if (!(artIndex >= 0 && copyIndex > artIndex && ledeIndex > copyIndex && releaseIndex > ledeIndex && commandIndex > releaseEndIndex && actionsIndex > commandEndIndex && firstCloseAfterActions > actionsIndex && secondCloseAfterActions > firstCloseAfterActions)) {
    errors.push(`${relative}: hero must place the APK card, setup command, then action links after the intro`);
  }
  const commandText = hero.slice(commandIndex, commandEndIndex);
  if (!commandText.includes('curl -fsSL https://raw.githubusercontent.com/Aetherdz/opencode-mobile-dist/main/install.sh | bash -s -- setup')) {
    errors.push(`${relative}: hero setup command is missing or incorrect`);
  }
  for (const id of ["install", "download", "next", "requirements"]) {
    if ((html.match(new RegExp(`id="${id}"`, "g")) ?? []).length !== 1) {
      errors.push(`${relative}: expected exactly one #${id} section`);
    }
  }
  const sectionOrder = ["install", "requirements", "next", "download"].map((id) => html.indexOf(`id="${id}"`));
  if (sectionOrder.some((index) => index < 0) || !sectionOrder.every((index, i) => i === 0 || sectionOrder[i - 1] < index)) {
    errors.push(`${relative}: after the hero, install commands must precede prerequisites, other content, and download links`);
  }
  const installIndex = html.indexOf('id="install"');
  const nextIndex = html.indexOf('id="next"');
  const downloadIndex = html.indexOf('id="download"');
  const requirementsIndex = html.indexOf('id="requirements"');
  const footerIndex = html.indexOf('<footer class="site-footer">');
  if (!(installIndex >= 0 && installIndex < requirementsIndex && requirementsIndex < nextIndex && nextIndex < downloadIndex && downloadIndex < footerIndex)) {
    errors.push(`${relative}: sections must be ordered install, prerequisites, remaining content, download, footer`);
  }
  const apkHero = hero.indexOf('class="hero-release"');
  const commandSection = html.indexOf('id="install"');
  if (!(apkHero >= 0 && apkHero < commandSection)) {
    errors.push(`${relative}: APK download card must appear before the install command section`);
  }
  if ((html.match(/class="hero-facts"/g) ?? []).length !== 1 || html.indexOf('class="hero-facts"') < footerIndex) {
    errors.push(`${relative}: transport, license, and telemetry facts must appear once in the footer`);
  }
  const command = html.match(/<pre id="cmd-bridge"><code>([\s\S]*?)<\/code><\/pre>/)?.[1] ?? "";
  const copyTarget = html.includes('data-copy-target="cmd-bridge"');
  if (!command || command.includes("term-comment") || command.includes("\n")) {
    errors.push(`${relative}: install panel must show only the single copyable setup command`);
  }
  if (!copyTarget) errors.push(`${relative}: install command copy button is missing`);
  const setupNote = html.slice(html.indexOf('class="cmd-note"'), html.indexOf('</p>', html.indexOf('class="cmd-note"')));
  if (!setupNote.includes("opencode-mobile")) errors.push(`${relative}: follow-up pairing command note is missing`);
  if (relative === "index.html" && !hero.includes('class="hero-release"')) errors.push(`${relative}: Android release download panel is missing`);
  if (hero.includes('aria-haspopup="true"')) errors.push(`${relative}: non-popup hero content declares aria-haspopup`);
  if (!html.includes('rel="icon"') || !html.includes("assets/favicon.svg")) errors.push(`${relative}: favicon link is missing`);
  if (relative !== "index.html" && !hero.includes('class="hero-release"')) errors.push(`${relative}: localized Android release panel is missing`);
}

if (errors.length > 0) {
  console.error("check-site: broken local references");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check-site: ${htmlFiles.length} HTML files, local links and fragments OK`);
