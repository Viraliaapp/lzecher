import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const base = process.env.AUDIT_BASE_URL || "https://lzecher.com";
const output = path.resolve(process.env.AUDIT_OUTPUT || "../evidence/public");
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } });
// Never submit a form, sign in, or mutate live data during this smoke test.
await context.route("**/*", route => ["GET", "HEAD", "OPTIONS"].includes(route.request().method())
  ? route.continue() : route.abort("blockedbyclient"));
const page = await context.newPage();
const results = [];
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let memorialPath;
try {
  for (const locale of ["en", "he", "es", "fr"]) {
    for (const suffix of ["", "/about", "/halachic-guidance", "/login"]) {
      const url = `${base}/${locale}${suffix}`;
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
      await page.locator("h1, main, input").first().waitFor();
      const info = await page.evaluate(() => ({ title: document.title, dir: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        hasMain: Boolean(document.querySelector("main")),
        searchLabel: (() => { const i = document.querySelector('input[type="search"], input[placeholder]'); return i?.getAttribute("aria-label") || (i?.id && document.querySelector(`label[for="${i.id}"]`)?.textContent) || null; })(),
        singularBug: /\b1 participants\b/.test(document.body.innerText),
      }));
      results.push({ path: `/${locale}${suffix}`, status: response?.status(), ...info });
      if (!suffix) {
        if (locale === "en") {
          memorialPath = await page.locator('a[href*="/memorial/"]').first().getAttribute("href").catch(() => null);
          const search = page.locator('input[placeholder]').first();
          if (await search.count()) {
            await search.fill("no-match-audit-72684");
            results.push({ path: "/en", check: "search empty result", cardsAfterSearch: await page.locator('a[href*="/memorial/"]').count() });
            await search.fill("");
          }
        }
        await page.screenshot({ path: path.join(output, `home-${locale}-desktop.png`), fullPage: true });
        await page.setViewportSize({ width: 375, height: 812 });
        await page.screenshot({ path: path.join(output, `home-${locale}-mobile.png`), fullPage: true });
        results.push({ path: `/${locale}`, check: "mobile overflow", overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2) });
        await page.setViewportSize({ width: 1365, height: 900 });
      }
    }
  }
  if (memorialPath) {
    const response = await page.goto(new URL(memorialPath, base).href, { waitUntil: "networkidle", timeout: 60000 });
    results.push({ path: "public memorial", status: response?.status(), tabs: await page.getByRole("tab").count() });
    for (const tab of await page.getByRole("tab").all()) await tab.click();
    await page.screenshot({ path: path.join(output, "memorial-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    results.push({ path: "public memorial", check: "mobile overflow", overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2) });
    await page.screenshot({ path: path.join(output, "memorial-mobile.png"), fullPage: true });
  }
} finally {
  fs.writeFileSync(path.join(output, "results.json"), JSON.stringify({ base, readOnly: true, results, pageErrors: errors }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pages: results.length, failures: results.filter(r => r.status >= 400 || r.overflow), pageErrors: errors }));
