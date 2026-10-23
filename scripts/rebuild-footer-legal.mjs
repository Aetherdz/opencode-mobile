#!/usr/bin/env node
// Turn the footer copyright line into a proper legal bar: © line + disclaimer.
import fs from "node:fs";
import path from "node:path";

const root = "/home/zaikabdou1/opencode-mobile-repo/website";

const legal = {
  en: "MIT licensed · Not affiliated with or endorsed by the OpenCode team.",
  ar: "مرخّص بموجب MIT · غير مرتبط بفريق OpenCode ولا معتمد منه.",
  fr: "Sous licence MIT · Non affilié à l’équipe OpenCode ni approuvé par elle.",
  es: "Con licencia MIT · Sin afiliación ni respaldo del equipo de OpenCode.",
};

function langOf(rel) {
  if (rel.startsWith("ar/")) return "ar";
  if (rel.startsWith("fr/")) return "fr";
  if (rel.startsWith("es/")) return "es";
  return "en";
}

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
  const rel = path.relative(root, file).split(path.sep).join("/");
  const text = legal[langOf(rel)];
  const block = `<div class="footer-legal">
        <p class="footer-copyright">© <span id="year">2026</span> OpenCode Mobile</p>
        <p class="footer-disclaimer">${text}</p>
      </div>`;
  let html = fs.readFileSync(file, "utf8");
  const next = html.replace(/<p class="footer-legal">[\s\S]*?<\/p>/, block);
  if (next === html) {
    console.log("no change", rel);
    continue;
  }
  fs.writeFileSync(file, next);
  changed += 1;
}
console.log(`${changed} files updated`);
