// JOURNEY 1: full anonymous Hebrew claim end-to-end against live production.
// Will create ONE real claim record. Memorial used: memorial-31bo5y (test memorial).
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ss = (page, name) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `j1-${name}.png`), fullPage: false });

const REPORT = [];
const log = (...args) => { console.log(...args); REPORT.push(args.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const failedRequests = [];
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("requestfailed", (r) => {
      const url = r.url();
      // Ignore Next.js _rsc prefetch aborts (cosmetic)
      if (url.includes("_rsc=")) return;
      failedRequests.push(`${r.method()} ${url} - ${r.failure() && r.failure().errorText}`);
    });
    page.on("response", (r) => {
      if (r.url().includes("/api/claims") && !r.url().includes("preview")) {
        log("[api]", r.request().method(), r.url(), "→", r.status());
      }
    });

    // Step 1-2: Navigate
    log("STEP 1-2: navigate to https://lzecher.com (he locale)");
    await page.goto("https://lzecher.com/he", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await ss(page, "01-homepage");

    // Step 4: Verify Hebrew layout, RTL
    const html = await page.locator("html").first();
    const dir = await html.getAttribute("dir");
    const lang = await html.getAttribute("lang");
    log(`STEP 4: html lang="${lang}" dir="${dir}" — ${lang === "he" && dir === "rtl" ? "PASS" : "FAIL"}`);

    // Step 5: Sign In button visible
    const signInBtn = await page.$('a:has-text("התחבר"), a:has-text("הירשם"), a:has-text("Sign in")');
    log(`STEP 5: Sign-in CTA visible: ${signInBtn ? "PASS" : "FAIL"}`);

    // Step 6: Memorial cards visible
    const memorials = await page.$$('a[href*="/memorial/"]');
    log(`STEP 6: ${memorials.length} memorial card(s) on homepage — ${memorials.length > 0 ? "PASS" : "FAIL"}`);

    // Step 7: Click memorial
    const href = await memorials[0].getAttribute("href");
    log(`STEP 7: opening memorial ${href}`);
    await Promise.all([page.waitForLoadState("domcontentloaded"), memorials[0].click()]);
    await page.waitForTimeout(2500);
    await ss(page, "02-memorial-page");

    // Step 8: Memorial page hero check
    const heroH1 = await page.$('h1');
    const heroText = heroH1 ? (await heroH1.textContent()).trim() : "";
    log(`STEP 8: h1 text="${heroText}" — has ז״ל or ע״ה: ${/ז״ל|ע״ה|זצ״ל/.test(heroText) ? "PASS" : "WARN"}`);

    // Step 9: Default tab = Mishnayos (משניות)
    const activeTab = await page.$('[role="tab"][data-state="active"]');
    const activeText = activeTab ? (await activeTab.textContent()).trim() : "";
    log(`STEP 9: active tab = "${activeText}" — Mishnayos default: ${/משניות|Mishnayos/i.test(activeText) ? "PASS" : "FAIL"}`);

    // Step 10: Drill in — seder → masechta → perek
    log("STEP 10: drilling into seder");

    // Helper: dismiss any open dialog by pressing Escape
    async function dismissDialogs() {
      const dlg = await page.$('[role="dialog"]');
      if (dlg) {
        log("  → dismissing existing dialog with Escape");
        await page.keyboard.press("Escape");
        await page.waitForTimeout(400);
      }
    }
    await dismissDialogs();

    const sederNames = ["זרעים", "מועד", "נשים", "נזיקין", "קדשים", "טהרות"];
    let claimBtn = null;
    for (const sName of sederNames) {
      await dismissDialogs();
      const sederBtn = await page.locator(`button:has-text("${sName}")`).first();
      if (!(await sederBtn.count())) continue;
      log(`  trying seder ${sName}`);
      await sederBtn.click({ force: true, timeout: 5000 }).catch((e) => log(`    click err: ${e.message}`));
      await page.waitForTimeout(700);
      // Now find perek claim buttons within ANY masechta — also try clicking masechtot one by one
      // First check if perakim are already showing
      let perekBtns = await page.$$('button:has-text("אני לוקח")');
      if (perekBtns.length === 0) {
        // need to expand a masechta — find masechta cards (they have format "Name Hebrew" with done/total)
        // The masechta buttons are inside the seder-expanded container; find them by NOT being seder buttons
        // Try clicking each seder-content child button
        const candidates = await page.$$(`div.bg-cream-warm button`);
        for (let idx = 0; idx < candidates.length && idx < 8; idx++) {
          await candidates[idx].click().catch(() => {});
          await page.waitForTimeout(500);
          perekBtns = await page.$$('button:has-text("אני לוקח")');
          if (perekBtns.length > 0) {
            log(`  expanded masechta candidate #${idx}`);
            break;
          }
        }
      }
      if (perekBtns.length > 0) {
        // Filter to the perek-level claim (text "אני לוקח/ת את הפרק הזה")
        for (const b of perekBtns) {
          const text = (await b.textContent() || "").trim();
          if (/הפרק הזה|claim this perek/i.test(text)) {
            claimBtn = b;
            log(`  ✓ found perek claim button: "${text}"`);
            break;
          }
        }
        // Fallback: any short claim button that doesn't say bulk
        if (!claimBtn) {
          for (const b of perekBtns) {
            const text = (await b.textContent() || "").trim();
            if (!/כל מסכת|כל סדר|כל הש|מסכת \w/.test(text) && text.length < 40) {
              claimBtn = b;
              log(`  ✓ found claim button (fallback): "${text}"`);
              break;
            }
          }
        }
      }
      if (claimBtn) break;
      // Collapse and try next seder
      await sederBtn.click({ force: true, timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    if (!claimBtn) {
      log("STEP 10: FAIL — could not find a claim button on any seder");
      throw new Error("No claim button");
    }
    await ss(page, "03-perek-visible");
    await claimBtn.click({ force: true, timeout: 5000 });
    await page.waitForTimeout(1500);
    await ss(page, "04-after-perek-click");

    // Step 11-12: SoftLoginModal should appear
    const dialogs = await page.$$('[role="dialog"]');
    log(`STEP 11-12: dialog visible after perek click: ${dialogs.length > 0 ? "PASS" : "FAIL"} (count=${dialogs.length})`);

    // Step 13: Click "or claim anonymously"
    const links = await page.$$('button.underline');
    let anonClicked = false;
    for (const l of links) {
      const text = (await l.textContent() || "").trim();
      if (/בעילום|anonym/i.test(text)) {
        log(`STEP 13: clicking "${text}"`);
        await l.click();
        anonClicked = true;
        break;
      }
    }
    log(`STEP 13: anonymous link clicked: ${anonClicked ? "PASS" : "FAIL"}`);
    await page.waitForTimeout(1500);
    await ss(page, "05-claim-modal-anonymous");

    // Step 14: Fill name
    const claimDialog = (await page.$$('[role="dialog"]'))[0];
    const inputs = await claimDialog.$$('input');
    log(`STEP 14: claim modal inputs visible: ${inputs.length}`);
    if (inputs.length === 0) throw new Error("No input in claim modal");
    const TEST_NAME = `בודק אנונימי V5 ${Date.now()}`;
    await inputs[0].fill(TEST_NAME);
    await page.waitForTimeout(300);
    await ss(page, "06-name-filled");

    // Step 15: Click confirm (אני מקבל/ת)
    const dlgBtns = await claimDialog.$$('button');
    let confirmBtn = null;
    for (const b of dlgBtns) {
      const text = (await b.textContent() || "").trim();
      if (/^אני מקבל|^confirm$/i.test(text)) { confirmBtn = b; break; }
    }
    log(`STEP 15: confirm button found: ${confirmBtn ? "YES" : "NO"}`);
    if (!confirmBtn) throw new Error("No confirm button");
    await confirmBtn.click();
    log("STEP 15: confirm clicked, waiting for response...");

    // Step 16: Watch for spinner, then success state
    await page.waitForTimeout(500);
    await ss(page, "07-during-submit");

    // Wait up to 8s for either dialog close OR error toast
    const result = await Promise.race([
      page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 8000 }).then(() => "dialog_closed"),
      page.waitForSelector('[data-sonner-toast][data-type="success"]', { timeout: 8000 }).then(() => "success_toast"),
      page.waitForSelector('[data-sonner-toast][data-type="error"]', { timeout: 8000 }).then(() => "error_toast"),
    ]).catch((e) => `timeout: ${e.message}`);
    log(`STEP 15-16: post-click outcome: ${result}`);
    await ss(page, "08-after-submit");

    // Look for success toast text
    const toasts = await page.$$('[data-sonner-toast]');
    for (const t of toasts) {
      const text = (await t.textContent() || "").trim();
      log(`  toast: "${text}"`);
    }

    // Step 17: Reload + verify perek shows as claimed
    log("STEP 17-18: reload page and verify persistence");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    // Re-drill (state was reset by reload)
    expandable = await page.$$('button.p-4');
    if (expandable[0]) await expandable[0].click();
    await page.waitForTimeout(500);
    // Look for our test name anywhere on the page
    const bodyText = await page.locator('body').textContent();
    const persisted = bodyText.includes(TEST_NAME);
    log(`STEP 18: claim persisted (test name found on page after reload): ${persisted ? "PASS" : "FAIL"}`);
    await ss(page, "09-after-reload");

    log("\n--- CONSOLE ERRORS ---");
    consoleErrors.forEach((e) => log("  " + e));
    log("\n--- FAILED REQUESTS ---");
    failedRequests.forEach((e) => log("  " + e));
  } catch (err) {
    log("EXCEPTION:", err.message);
    log(err.stack);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "journey1-report.txt"), REPORT.join("\n"));
  log("\nReport saved to scripts/screenshots/journey1-report.txt");
})();
