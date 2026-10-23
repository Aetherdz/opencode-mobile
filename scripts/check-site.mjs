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
    if (path.relative(root, file) !== "404.html" && [...footer.matchAll(/class="footer-link-group"/g)].length !== 3) errors.push(`${path.relative(root, file)}: expected three distinct footer navigation groups`);
    if (path.relative(root, file) !== "404.html") {
      for (const group of footer.matchAll(/<nav class="footer-link-group"[^>]*aria-labelledby="([^"]+)"[\s\S]*?<h2 id="([^"]+)"/g)) {
        if (group[1] !== group[2]) errors.push(`${path.relative(root, file)}: footer group navigation label does not resolve`);
      }
    }
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
  if (heroEndTag < 0) {
    errors.push(`${relative}: homepage hero section is missing`);
    continue;
  }
  const hero = html.slice(heroStart, heroEndTag);
  for (const selector of ['class="eyebrow"', "<h1", 'class="lede"', 'class="hero-release"', 'class="actions"']) {
    if (!hero.includes(selector)) errors.push(`${relative}: homepage hero is missing ${selector}`);
  }
  const artIndex = hero.indexOf('class="hero-art"');
  const copyIndex = hero.indexOf('class="hero-copy"');
  const actionsIndex = hero.indexOf('class="actions"');
  const ledeIndex = hero.indexOf('class="lede"');
  const releaseIndex = hero.indexOf('class="hero-release"');
  const releaseEndIndex = hero.indexOf('</div>', releaseIndex);
  if (!(artIndex >= 0 && copyIndex > artIndex && ledeIndex > copyIndex && releaseIndex > ledeIndex && actionsIndex > releaseEndIndex)) {
    errors.push(`${relative}: hero must place APK and install/release actions after the intro`);
  }
  if ((html.match(/id="cmd-bridge"/g) ?? []).length !== 1 || (html.match(/id="cmd-bridge-win"/g) ?? []).length !== 1 || (html.match(/data-copy-target="cmd-bridge"/g) ?? []).length !== 1 || (html.match(/data-copy-target="cmd-bridge-win"/g) ?? []).length !== 1) {
    errors.push(`${relative}: the single moved command switcher must keep exactly one working copy control per OS`);
  }
  const installSwitcherCount = (html.match(/class="cmd-switcher"/g) ?? []).length;
  if (installSwitcherCount !== 1 || html.indexOf('class="cmd-switcher"') < html.indexOf('id="install"')) {
    errors.push(`${relative}: expected one command switcher in the Install section`);
  }
  if ((html.match(/data-copy-target="cmd-bridge"/g) ?? []).length !== 1 || (html.match(/data-copy-target="cmd-bridge-win"/g) ?? []).length !== 1) {
    errors.push(`${relative}: one install switcher must have one copy control for each platform`);
  }
  const stepsStart = html.indexOf('<ol class="steps"');
  const stepsEnd = html.indexOf('</ol>', stepsStart);
  const threeSteps = (html.slice(stepsStart, stepsEnd).match(/<li>/g) ?? []).length;
  if (threeSteps !== 3 || html.indexOf('class="cmd-switcher"') < html.indexOf('</ol>', html.indexOf('<ol class="steps"'))) {
    errors.push(`${relative}: setup commands must follow all three install steps`);
  }
  for (const [radio, panel] of [["install-cmd-os-posix", "install-panel-posix"], ["install-cmd-os-win", "install-panel-win"]]) {
    if (!html.includes(`id="${radio}"`) || !html.includes(`for="${radio}"`) || !html.includes(`id="${panel}"`)) {
      errors.push(`${relative}: platform tab references are broken for ${radio}`);
    }
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
    errors.push(`${relative}: APK download card must appear before the install section`);
  }
  if ((html.match(/class="footer-meta"/g) ?? []).length !== 1 || html.indexOf('class="footer-meta"') < footerIndex) {
    errors.push(`${relative}: transport, license, and telemetry facts must appear once in the footer`);
  }
  const command = html.match(/<pre id="cmd-bridge"><code>([\s\S]*?)<\/code><\/pre>/)?.[1] ?? "";
  const copyTarget = html.includes('data-copy-target="cmd-bridge"');
  if (!command || command.includes("term-comment") || command.includes("\n")) {
    errors.push(`${relative}: install panel must show only the single copyable setup command`);
  }
  if (!copyTarget) errors.push(`${relative}: install command copy button is missing`);
  if ((html.match(/data-copy-target="cmd-bridge"/g) ?? []).length !== 1 || (html.match(/data-copy-target="cmd-bridge-win"/g) ?? []).length !== 1) {
    errors.push(`${relative}: install switcher must have one copy target for each platform`);
  }
  const setupNote = html.slice(html.indexOf('class="cmd-note"'), html.indexOf('</p>', html.indexOf('class="cmd-note"')));
  if (!setupNote.includes("opencode-mobile")) errors.push(`${relative}: follow-up pairing command note is missing`);
  if (relative === "index.html" && !hero.includes('class="hero-release"')) errors.push(`${relative}: Android release download panel is missing`);
  if (hero.includes('aria-haspopup="true"')) errors.push(`${relative}: non-popup hero content declares aria-haspopup`);
  if (!html.includes('rel="icon"') || !html.includes("assets/favicon.svg")) errors.push(`${relative}: favicon link is missing`);
  if (relative !== "index.html" && !hero.includes('class="hero-release"')) errors.push(`${relative}: localized Android release panel is missing`);
}

for (const relative of ["index.html", "ar/index.html", "fr/index.html", "es/index.html"]) {
  const file = path.join(root, relative);
  const html = fs.readFileSync(file, "utf8");
  const command = html.match(/<pre id="cmd-bridge"><code>([\s\S]*?)<\/code><\/pre>/)?.[1] ?? "";
  const win = html.match(/<pre id="cmd-bridge-win"><code>([\s\S]*?)<\/code><\/pre>/)?.[1] ?? "";
  if (!command.includes("curl -fsSL") || !command.includes("install.sh | bash -s -- setup")) errors.push(`${relative}: POSIX install command changed`);
  if (!win.includes("3a493282e252468ed96012cd0019f5252314bfb5c7b810be34476602616a14aa") || !win.includes("7c4ec38b7de7d87e88d7f215721a11bc338e128f") || !win.includes("install.ps1 -OutFile install.ps1")) errors.push(`${relative}: pinned Windows command/checksum changed`);
  if ((html.match(/v1\.0\.0-beta\.3/g) ?? []).length < 2 || !html.includes("opencode-mobile-1.0.0-beta.3.apk")) errors.push(`${relative}: APK version/asset changed`);
}

if (errors.length > 0) {
  console.error("check-site: broken local references");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`check-site: ${htmlFiles.length} HTML files, local links and fragments OK`);
