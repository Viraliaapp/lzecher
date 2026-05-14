// Render each public route in he/es/fr; grep visible text for English wordlist
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const ss = (page, n) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `leak-${n}.png`), fullPage: false });
const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

const ROUTES = ["", "/about", "/halachic-guidance", "/confirm-complete?status=success", "/login"];
const LOCALES = ["he", "es", "fr"];

// English words that should NOT appear in non-English pages
// Excluded: brand "Lzecher", proper nouns, URLs, dates
const ENGLISH_LEAK_WORDS = [
  "Sign in", "Sign out", "Sign up", "Cancel", "Save", "Delete", "Submit",
  "Back", "Close", "Create", "Loading", "Click here", "Read more",
  "Confirm", "Memorial", " name", " email",
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const loc of LOCALES) {
      for (const route of ROUTES) {
        const url = `https://lzecher.com/${loc}${route}`;
        const page = await browser.newPage();
        const consoleErrors = [];
        page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForTimeout(2000);
          // innerText respects visibility & display:none, unlike textContent
          const text = await page.evaluate(() => document.body.innerText);
          const safeName = `${loc}${route.replace(/[\/?=]/g, "_") || "_root"}`;
          await ss(page, safeName);
          const leaks = [];
          for (const w of ENGLISH_LEAK_WORDS) {
            const re = new RegExp("\\b" + w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
            if (re.test(text)) leaks.push(w);
          }
          log(`${loc} ${route || "/"} → ${leaks.length === 0 ? "CLEAN" : "LEAKS: " + leaks.join(", ")}${consoleErrors.length ? ` console-errors=${consoleErrors.length}` : ""}`);
        } catch (e) {
          log(`${loc} ${route || "/"} → ERROR ${e.message.slice(0, 80)}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "english-leak-report.txt"), REPORT.join("\n"));
})();
