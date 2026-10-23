import { chromium } from "playwright";
const browser = await chromium.launch();
const errors = [];
const failures = (process.env.INTERACTION_ROUTES || "/,/ar/,/fr/,/es/").split(",");
for (const route of failures) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4180${route}`, { waitUntil: "domcontentloaded" });
  const tabs = page.locator(".cmd-tabs label");
  await tabs.nth(1).click();
  const shownAfterWindows = await page.locator(".cmd-panel:visible").count();
  if (shownAfterWindows !== 1 || !(await page.locator("#cmd-bridge-win").isVisible())) errors.push(`${route}: windows tab does not select its command`);
  await tabs.nth(0).click();
  if (!(await page.locator("#cmd-bridge").isVisible())) errors.push(`${route}: POSIX tab does not select its command`);
  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  if (!(await page.locator("#cmd-bridge-win").isVisible())) errors.push(`${route}: keyboard arrow did not switch platform tab`);
  await page.keyboard.press("ArrowLeft");
  if (!(await page.locator("#cmd-bridge").isVisible())) errors.push(`${route}: reverse keyboard arrow did not switch platform tab`);
  const copyButton = page.locator('.copy-button[data-copy-target="cmd-bridge"]');
  await copyButton.click();
  if (!(await copyButton.getAttribute("aria-label")) || !(await copyButton.textContent()).trim()) errors.push(`${route}: copy feedback is not available`);
  const menu = page.locator(".menu-toggle");
  await menu.click();
  const menuOpens = await page.locator("#site-nav").evaluate((el) => el.classList.contains("is-open"));
  await page.keyboard.press("Escape");
  const menuCloses = !(await page.locator("#site-nav").evaluate((el) => el.classList.contains("is-open")));
  if (!menuOpens || !menuCloses) errors.push(`${route}: mobile menu open/Escape close failed`);
  await context.close();
}
for (const route of ["/features/", "/guide/", "/security/", "/faq/", "/docs/", "/ar/features/", "/ar/guide/", "/ar/security/", "/ar/faq/", "/ar/docs/", "/fr/features/", "/fr/guide/", "/fr/security/", "/fr/faq/", "/fr/docs/", "/es/features/", "/es/guide/", "/es/security/", "/es/faq/", "/es/docs/"]) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:4180${route}`, { waitUntil: "domcontentloaded" });
  const navLinks = page.locator("#site-nav a");
  if (!(await navLinks.count())) errors.push(`${route}: primary navigation is missing`);
  await context.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "localized command switchers and mobile menu interactions pass");
if (errors.length) process.exitCode = 1;
