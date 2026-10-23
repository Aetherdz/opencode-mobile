#!/usr/bin/env node
// Rebuild the footer facts as a clean spec strip and drop duplicate licensing text.
import fs from "node:fs";

const root = "/home/zaikabdou1/opencode-mobile-repo/website";

const data = {
  "index.html": {
    facts: [
      ["Transport", "Loopback + temporary link"],
      ["License", "MIT"],
      ["Telemetry", "None in the app"],
    ],
    disclaimer: "Not affiliated with or endorsed by the OpenCode team.",
  },
  "ar/index.html": {
    facts: [
      ["النقل", "Loopback + رابط مؤقت"],
      ["الترخيص", "MIT"],
      ["التتبّع", "لا يوجد في التطبيق"],
    ],
    disclaimer: "غير مرتبط بفريق OpenCode ولا معتمد منه.",
  },
  "fr/index.html": {
    facts: [
      ["Transport", "Loopback + lien temporaire"],
      ["Licence", "MIT"],
      ["Télémétrie", "Aucune dans l’application"],
    ],
    disclaimer: "Non affilié à l’équipe OpenCode ni approuvé par elle.",
  },
  "es/index.html": {
    facts: [
      ["Transporte", "Loopback + enlace temporal"],
      ["Licencia", "MIT"],
      ["Telemetría", "Ninguna en la app"],
    ],
    disclaimer: "Sin afiliación ni respaldo del equipo de OpenCode.",
  },
};

for (const [rel, cfg] of Object.entries(data)) {
  const file = `${root}/${rel}`;
  let html = fs.readFileSync(file, "utf8");

  const cells = cfg.facts
    .map(
      ([dt, dd]) => `        <div>
          <dt>${dt}</dt>
          <dd>${dd}</dd>
        </div>`,
    )
    .join("\n");

  const dl = `<dl class="footer-meta">
${cells}
      </dl>`;

  const before = html;
  html = html.replace(/\n[ \t]*<dl class="(?:hero-facts|footer-meta)">[\s\S]*?<\/dl>/, "\n      " + dl);
  html = html.replace(
    /<p class="footer-disclaimer">[\s\S]*?<\/p>/,
    `<p class="footer-disclaimer">${cfg.disclaimer}</p>`,
  );

  if (html === before) {
    console.log("no change", rel);
    continue;
  }
  fs.writeFileSync(file, html);
  console.log("updated", rel);
}
