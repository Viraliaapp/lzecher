// Visual regression: public routes × locales × viewports
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots", "regression");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};
const LOCALES = ["en", "he"];
const ROUTES = ["", "/about", "/halachic-guidance"];

const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  let count = 0;
  for (const [vName, vSize] of Object.entries(VIEWPORTS)) {
    for (const loc of LOCALES) {
      const ctx = await browser.newContext({ viewport: vSize, locale: loc === "he" ? "he-IL" : "en-US" });
      const page = await ctx.newPage();
      const errors = [];
      const failed = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 100)); });
      page.on("requestfailed", (r) => { if (!r.url().includes("_rsc=")) failed.push(`${r.method()} ${r.url().slice(0, 80)}`); });

      for (const route of ROUTES) {
        try {
          await page.goto(`https://lzecher.com/${loc}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(1500);
          const fname = `${loc}${route.replace(/\//g, "_") || "_root"}-${vName}.png`;
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname), fullPage: false });
          count++;
        } catch (e) {
          log(`ERR ${vName}/${loc}${route}: ${e.message.slice(0, 80)}`);
        }
      }
      log(`${vName}/${loc}: ${ROUTES.length} screenshots, console-errors=${errors.length}, req-failed=${failed.length}`);
      if (errors.length) errors.slice(0, 3).forEach((e) => log(`  ce: ${e}`));
      if (failed.length) failed.slice(0, 3).forEach((e) => log(`  rf: ${e}`));
      await ctx.close();
    }
  }
  log(`\nTotal screenshots: ${count} → ${SCREENSHOT_DIR}`);
  await browser.close();
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "..", "regression-report.txt"), REPORT.join("\n"));
})();
