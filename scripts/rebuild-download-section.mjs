#!/usr/bin/env node
// Rebuild the homepage "The build" (#download) section without duplicated CTAs.
import fs from "node:fs";

const root = "/home/zaikabdou1/opencode-mobile-repo/website";

const APK =
  "https://github.com/Aetherdz/opencode-mobile/releases/download/v1.0.0-beta.3/opencode-mobile-1.0.0-beta.3.apk";
const REPO = "https://github.com/Aetherdz/opencode-mobile";

const copy = {
  en: {
    eyebrow: "04 / The build",
    title: "Take the beta for a walk.",
    body: "Source, a release-signed Android build, and the bridge and web bundles ship together. Keep the bridge private, and expect sharp edges.",
    chips: ["Android 7.0+", "arm64", "Release-signed", "Not on Google Play"],
    kicker: "Latest public beta",
    meta: "Release APK · arm64",
    download: "Download APK",
    source: "Build from source",
    factsLabel: "Build facts",
    dir: "",
  },
  ar: {
    eyebrow: "04 / الإصدار",
    title: "جرّب النسخة التجريبية بنفسك.",
    body: "يأتي الإصدار كمصدر، وبناء Android موقّع، وحزم للجسر والويب. أبقِ الجسر خاصًا، وتوقّع أن تصادف بعض الزوايا غير المصقولة.",
    chips: ["أندرويد 7.0+", "arm64", "موقّع للإصدار", "ليس عبر Google Play"],
    kicker: "أحدث نسخة تجريبية",
    meta: "حزمة APK · arm64",
    download: "تنزيل APK",
    source: "البناء من المصدر",
    factsLabel: "مواصفات البناء",
    dir: ' dir="rtl"',
  },
  es: {
    eyebrow: "04 / La compilación",
    title: "Pon a prueba la beta.",
    body: "La beta se distribuye como código fuente, una compilación de Android firmada y paquetes del puente y de la web. Mantén el puente en privado y prepárate para encontrar detalles sin pulir.",
    chips: ["Android 7.0+", "arm64", "Firmado", "No está en Google Play"],
    kicker: "Última beta pública",
    meta: "APK de versión · arm64",
    download: "Descargar APK",
    source: "Compilar desde el código fuente",
    factsLabel: "Datos de la compilación",
    dir: "",
  },
  fr: {
    eyebrow: "04 / La version",
    title: "Emmenez la bêta faire un tour.",
    body: "La bêta est livrée sous forme de code source, d’une version Android signée et de paquets pour la passerelle et le web. Gardez la passerelle privée et attendez-vous à quelques aspérités.",
    chips: ["Android 7.0+", "arm64", "Signé", "Pas sur Google Play"],
    kicker: "Dernière bêta publique",
    meta: "APK de version · arm64",
    download: "Télécharger l’APK",
    source: "Compiler depuis les sources",
    factsLabel: "Données de compilation",
    dir: "",
  },
};

function section(lang) {
  const c = copy[lang];
  const chips = c.chips.map((chip) => `              <span class="chip">${chip}</span>`).join("\n");
  return `<section class="section section-download" id="download">
        <div class="download-inner">
          <div class="download-copy">
            <p class="eyebrow">${c.eyebrow}</p>
            <h2 class="display">${c.title}</h2>
            <p>
              ${c.body}
            </p>
            <div class="chip-row" aria-label="${c.factsLabel}">
${chips}
            </div>
          </div>
          <div class="release-panel">
            <p class="release-kicker">${c.kicker}</p>
            <p class="release-version">1.0.0-beta.3</p>
            <p class="release-meta">${c.meta}</p>
            <a
              class="button button-primary release-download"
              href="${APK}"
              rel="noreferrer"
              >${c.download}</a
            >
            <div class="link-row">
              <a href="${REPO}" rel="noreferrer">${c.source}</a>
            </div>
          </div>
        </div>
      </section>`;
}

const files = {
  en: "index.html",
  ar: "ar/index.html",
  es: "es/index.html",
  fr: "fr/index.html",
};

for (const [lang, rel] of Object.entries(files)) {
  const file = `${root}/${rel}`;
  let html = fs.readFileSync(file, "utf8");
  const next = html.replace(
    /<section class="section section-download" id="download">[\s\S]*?<\/section>/,
    section(lang),
  );
  if (next === html) {
    console.log("no change", rel);
    continue;
  }
  fs.writeFileSync(file, next);
  console.log("updated", rel);
}
