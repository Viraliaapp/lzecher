// Simpler verification that takes one screenshot per bug.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SS = path.join(__dirname, "..", "screenshots");
const ss = (page, n) => page.screenshot({ path: path.join(SS, `fixv2-${n}.png`), fullPage: false });
const log = (...a) => console.log(...a);

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    // Use the kabalos-bearing memorial
    await page.goto("https://lzecher.com/he/memorial/memorial-blf1d9", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    // BUG 1: Kabalos tab
    log("\n--- BUG 1: Kabalos tab ---");
    const tabs = await page.$$('[role="tab"]');
    const tabTexts = await Promise.all(tabs.map((t) => t.textContent()));
    log("Tabs:", tabTexts.join(" | "));
    const hasKab = tabTexts.some((t) => /קבלות/.test(t || ""));
    log("BUG 1:", hasKab ? "FIXED ✓" : "NOT FIXED ✗");

    // BUG 5: Sedarim order — scroll to mishnayos area and capture
    log("\n--- BUG 5: Sedarim order ---");
    // Scroll past hero
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await ss(page, "1-sedarim-grid");
    // Read seder buttons (those with the seder Hebrew names)
    const all = await page.$$('button');
    const orderedSedarim = [];
    for (const b of all) {
      const txt = ((await b.textContent()) || "").trim();
      const m = txt.match(/^(זרעים|מועד|נשים|נזיקין|קדשים|טהרות)/);
      if (m && !orderedSedarim.includes(m[1])) orderedSedarim.push(m[1]);
    }
    log("Sedarim DOM order:", orderedSedarim.join(" → "));
    const expected = ["זרעים", "מועד", "נשים", "נזיקין", "קדשים", "טהרות"];
    const ok = expected.every((e, i) => orderedSedarim[i] === e);
    log("BUG 5:", ok ? "FIXED ✓" : "NOT FIXED ✗");

    // BUG 4: Slash-form removed from claim button
    log("\n--- BUG 4: Masculine form ---");
    const claimBtns = await page.$$('button:has-text("אני לוקח")');
    if (claimBtns.length > 0) {
      const txt = ((await claimBtns[0].textContent()) || "").trim();
      log("First claim button text:", txt);
      const hasSlash = /\/[א-ת]/.test(txt);
      log("BUG 4 (no /י slash):", !hasSlash ? "FIXED ✓" : "NOT FIXED ✗");
    } else {
      log("BUG 4: no claim button visible to test (not at perek level yet)");
    }

    // BUG 2 + BUG 3: switch to Tehillim tab, drill into book 1
    log("\n--- BUG 2 + 3: Tehillim cards ---");
    // Click the Tehillim tab specifically
    await page.click('[role="tab"]:has-text("תהלים"), [role="tab"]:has-text("תהילים")', { force: true }).catch((e) => log("tab click failed:", e.message));
    await page.waitForTimeout(800);
    await ss(page, "2-tehillim-tab");

    // Find the FIRST תהילים book button (NOT the bulk button)
    const bookButtons = await page.$$('button:has-text("ספר")');
    log("found", bookButtons.length, "book buttons");
    if (bookButtons[0]) await bookButtons[0].click({ force: true });
    await page.waitForTimeout(800);
    await ss(page, "3-tehillim-book1-expanded");

    // Now read perek titles within the expanded book
    const perekCards = await page.$$('div.bg-cream-warm p.font-medium');
    const titles = [];
    for (let i = 0; i < Math.min(perekCards.length, 5); i++) {
      titles.push(((await perekCards[i].textContent()) || "").trim());
    }
    log("First Tehillim perek titles:", titles.join(" | "));
    const hasGematria = titles.some((t) => /[א-ת]׳|[א-ת]״[א-ת]/.test(t));
    const hasArabic = titles.some((t) => /\d/.test(t));
    log("BUG 3 (gematria, no Arabic):", hasGematria && !hasArabic ? "FIXED ✓" : `${hasGematria ? "PARTIAL" : "NOT FIXED"} (g=${hasGematria}, ar=${hasArabic})`);

    // BUG 2: button text not corrupt
    const insideBookBtns = await page.$$('div.bg-cream-warm button');
    let claimText = null;
    for (const b of insideBookBtns) {
      const t = ((await b.textContent()) || "").trim();
      if (/אני לוקח/.test(t)) { claimText = t; break; }
    }
    log("Tehillim claim button text:", claimText);
    const hasSlash2 = claimText && /\/[א-ת]/.test(claimText);
    log("BUG 2 (clean text, no slash):", claimText && !hasSlash2 ? "FIXED ✓" : "NOT FIXED ✗");
  } catch (err) {
    log("EXCEPTION:", err.message, err.stack);
  } finally {
    await browser.close();
  }
})();
