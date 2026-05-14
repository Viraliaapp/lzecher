// Verify all 5 critical bug fixes on production.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
const ss = (page, n) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `fix-${n}.png`), fullPage: false });
const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto("https://lzecher.com/he/memorial/memorial-blf1d9", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    await ss(page, "1-memorial-loaded");

    // ── BUG 1: Kabalos tab present ──────────────────────────────────────────
    log("\n=== BUG 1: Kabalos tab ===");
    const tabs = await page.$$('[role="tab"]');
    const tabTexts = [];
    for (const t of tabs) tabTexts.push(((await t.textContent()) || "").trim());
    log("Tabs found:", tabTexts.join(" | "));
    const hasMishnayos = tabTexts.some((x) => /משניות/.test(x));
    const hasTehillim = tabTexts.some((x) => /תהילים/.test(x));
    const hasKabalos = tabTexts.some((x) => /קבלות|קבלה|מצוות/.test(x));
    log("BUG 1 Kabalos tab present:", hasKabalos ? "FIXED ✓" : "NOT FIXED ✗");

    // ── BUG 5: Sedarim order ─────────────────────────────────────────────────
    log("\n=== BUG 5: Sedarim canonical order ===");
    // Click Mishnayos tab if not already
    const mishTab = await page.$('[role="tab"]:has-text("משניות")');
    if (mishTab) await mishTab.click({ force: true });
    await page.waitForTimeout(800);
    await ss(page, "5-sedarim");
    // Read seder card DOM order
    const sederBtns = await page.$$('button.p-4.rounded-xl');
    const sederTexts = [];
    for (const b of sederBtns) sederTexts.push(((await b.textContent()) || "").trim().slice(0, 30));
    log("DOM order of seder cards:", sederTexts.slice(0, 8).join(" | "));
    // Expected: Take whole Shas (or similar) first, then Zeraim → Tahorot
    // Find sedarim by Hebrew name
    const sederOrder = sederTexts.filter((t) => /זרעים|מועד|נשים|נזיקין|קדשים|טהרות/.test(t));
    log("Just sedarim (in DOM order):", sederOrder.join(" → "));
    const expected = ["זרעים", "מועד", "נשים", "נזיקין", "קדשים", "טהרות"];
    const gotShorts = sederOrder.map((t) => t.match(/זרעים|מועד|נשים|נזיקין|קדשים|טהרות/)[0]);
    const orderMatches = expected.every((e, i) => gotShorts[i] === e);
    log("BUG 5 Sedarim canonical order:", orderMatches ? "FIXED ✓" : `NOT FIXED ✗ — got ${gotShorts.join(",")}`);

    // ── BUG 2 + BUG 3: Tehillim cards (text + Hebrew numerals) ─────────────
    log("\n=== BUG 2 + BUG 3: Tehillim cards ===");
    const tehillimTab = await page.$('[role="tab"]:has-text("תהילים")');
    if (tehillimTab) await tehillimTab.click({ force: true });
    await page.waitForTimeout(800);
    // Expand Book 1
    const bookBtns = await page.$$('button.p-4.rounded-xl');
    if (bookBtns[0]) await bookBtns[0].click({ force: true });
    await page.waitForTimeout(700);
    await ss(page, "2-3-tehillim-cards");

    // Read first 5 Tehillim card titles
    const tCards = await page.$$('.bg-cream-warm .text-xs.text-navy.truncate, .bg-cream-warm p.font-medium');
    const cardTitles = [];
    for (let i = 0; i < Math.min(tCards.length, 8); i++) {
      const txt = ((await tCards[i].textContent()) || "").trim();
      if (txt) cardTitles.push(txt);
    }
    log("First Tehillim card titles:", cardTitles.slice(0, 5).join(" | "));
    // Should contain Hebrew letters (gematria) like א׳, ב׳, ג׳ — not Arabic 1, 2, 3
    const hasGematria = cardTitles.some((t) => /[א-ת]׳|[א-ת]״[א-ת]/.test(t));
    const hasRawDigits = cardTitles.some((t) => /\d/.test(t));
    log("BUG 3 Hebrew numerals on Tehillim cards:", hasGematria && !hasRawDigits ? "FIXED ✓" : `${hasGematria ? "PARTIAL" : "NOT FIXED ✗"} (gematria=${hasGematria}, rawDigits=${hasRawDigits})`);

    // ── BUG 2: Card button text not corrupt ─────────────────────────────────
    // The button text should be clean — let's check by reading button text in cards
    const cardButtons = await page.$$('.bg-cream-warm button[disabled], .bg-cream-warm button:not([disabled])');
    const btnTexts = new Set();
    for (let i = 0; i < Math.min(cardButtons.length, 5); i++) {
      const txt = ((await cardButtons[i].textContent()) || "").trim();
      if (txt && /אני/.test(txt)) btnTexts.add(txt);
    }
    log("Tehillim claim button text(s):", [...btnTexts].join(" / "));
    const hasSlash = [...btnTexts].some((t) => /\/[א-ת]/.test(t));
    log("BUG 2 button text clean (no /י overlap):", !hasSlash && btnTexts.size > 0 ? "FIXED ✓" : "NOT FIXED ✗");

    // ── BUG 4: Masculine form on confirm button ─────────────────────────────
    log("\n=== BUG 4: Masculine form only ===");
    // Click Mishnayos, drill in, click claim
    if (mishTab) await mishTab.click({ force: true });
    await page.waitForTimeout(600);
    const sBtns = await page.$$('button.p-4');
    if (sBtns[1]) await sBtns[1].click({ force: true }); // skip Take whole Shas
    await page.waitForTimeout(500);
    const mBtns = await page.$$('div.bg-cream-warm button');
    let claimBtn = null;
    for (let i = 0; i < Math.min(mBtns.length, 8); i++) {
      await mBtns[i].click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      const all = await page.$$('button');
      for (const b of all) {
        const t = ((await b.textContent()) || "").trim();
        if (/^אני לוקח/.test(t) && t.length < 50 && !/כל מסכת|כל סדר|כל הש/.test(t)) {
          claimBtn = b;
          log("Found claim button text:", t);
          break;
        }
      }
      if (claimBtn) break;
      await mBtns[i].click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    if (claimBtn) {
      const claimText = ((await claimBtn.textContent()) || "").trim();
      const hasSlashClaim = /\/[א-ת]/.test(claimText);
      log("BUG 4 (claim button) masculine form:", !hasSlashClaim ? "FIXED ✓" : `NOT FIXED ✗ (text="${claimText}")`);
      // Also click and check confirm button text
      await claimBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await ss(page, "4-claim-modal-button");
      const dlg = (await page.$$('[role="dialog"]'))[0];
      if (dlg) {
        const dlgBtns = await dlg.$$('button');
        for (const b of dlgBtns) {
          const t = ((await b.textContent()) || "").trim();
          if (/^אני מקבל/.test(t)) {
            const hasSlash = /\/[א-ת]/.test(t);
            log("Confirm button text:", t, "— masculine only:", hasSlash ? "NOT FIXED ✗" : "FIXED ✓");
            break;
          }
        }
      }
    }

    log("\n=== Summary ===");
    log("  Live commit:", await page.evaluate(async () => {
      try { const r = await fetch("/api/version"); const j = await r.json(); return j.commit?.slice(0, 7); } catch { return "?"; }
    }));
  } catch (err) {
    log("EXCEPTION:", err.message);
    log(err.stack);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "five-fixes-report.txt"), REPORT.join("\n"));
})();
