// Smoke test: verify Playwright works against lzecher.com
const { chromium } = require("playwright");
const path = require("path");

(async () => {
  let browser;
  try {
    console.log("[smoke] launching chromium...");
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    console.log("[smoke] navigating to https://lzecher.com ...");
    const resp = await page.goto("https://lzecher.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    console.log("[smoke] status:", resp && resp.status());
    const out = path.join(__dirname, "..", "screenshots", "homepage.png");
    await page.screenshot({ path: out, fullPage: false });
    console.log("[smoke] screenshot saved to:", out);
    const title = await page.title();
    console.log("[smoke] page title:", title);
    process.exitCode = 0;
  } catch (err) {
    console.error("[smoke] FAILED:", err.message);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
})();
