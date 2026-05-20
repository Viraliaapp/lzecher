// V7 read-only verification of BUGS 1 + 2 on production.
// Does NOT submit, modify, or create anything.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SS = path.join(__dirname, "..", "screenshots", "v7");
fs.mkdirSync(SS, { recursive: true });
const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // BUG 2 — find a claimed perek on memorial-ubk0n0 (which has Shabbos 10 claimed)
    log("\n=== BUG 2: 'נלקח על ידי {name}' shows real name ===");
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1100 } });
    const page = await ctx.newPage();
    await page.goto("https://lzecher.com/he/memorial/memorial-ubk0n0", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    // Drill into Moed (Shabbos lives in Moed)
    const p4 = await page.$$('button.p-4');
    // Skip Take whole Shas at index 0; click Moed (index 2 typically — try each seder)
    for (let sIdx = 1; sIdx <= 6 && sIdx < p4.length; sIdx++) {
      await p4[sIdx].click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
      // Look for Shabbos masechta
      const shabbosBtn = await page.locator('div.bg-cream-warm button:has-text("שבת"), div.bg-cream-warm button:has-text("Shabbos")').first();
      if ((await shabbosBtn.count()) > 0) {
        await shabbosBtn.click({ force: true });
        await page.waitForTimeout(700);
        break;
      }
      // collapse and try next
      await p4[sIdx].click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: path.join(SS, "bug2-claimed-perek-he.png"), fullPage: false });
    const text = await page.evaluate(() => document.body.innerText);
    const matches = text.match(/נלקח על ידי [^\n]+/g) || [];
    if (matches.length === 0) {
      log("  ⚠ No 'נלקח על ידי' text visible — may need to drill into different masechta");
    } else {
      log("  ✓ Found " + matches.length + " 'נלקח על ידי ...' instances. Samples:");
      matches.slice(0, 5).forEach((m) => log("    " + m.slice(0, 80)));
      // Verify names are NOT empty
      const empty = matches.filter((m) => /^נלקח על ידי\s*$/.test(m.trim()));
      log("  Empty (BUG 2 still present): " + empty.length + " / " + matches.length);
    }

    // BUG 1 — code-level fix already verified; can't visually load /he/create without
    // a robust auth flow on production. Take screenshot of the LOGIN page in HE to
    // confirm at least the public auth flow is intact and label/placeholder don't
    // collide there.
    log("\n=== BUG 1 — companion public-page check ===");
    const ctx2 = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const p2 = await ctx2.newPage();
    await p2.goto("https://lzecher.com/he/login", { waitUntil: "domcontentloaded" });
    await p2.waitForTimeout(2000);
    await p2.screenshot({ path: path.join(SS, "bug1-login-he.png"), fullPage: false });
    // Check email input has placeholder distinct from label
    const labels = await p2.$$eval("label", (els) => els.map((e) => (e.textContent || "").trim()));
    const placeholders = await p2.$$eval("input[placeholder]", (els) => els.map((e) => e.getAttribute("placeholder") || ""));
    log("  Login page labels: " + JSON.stringify(labels));
    log("  Login page placeholders: " + JSON.stringify(placeholders));
    const dup = labels.find((l) => placeholders.includes(l));
    log("  Duplicate label↔placeholder on login: " + (dup ? "FOUND " + dup : "none"));

    await ctx.close();
    await ctx2.close();
  } catch (err) {
    log("EXCEPTION: " + err.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SS, "v7-bugs-report.txt"), REPORT.join("\n"));
})();
