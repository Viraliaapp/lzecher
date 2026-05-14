// Journey 1 v2 — proven path from verify-fix-live.js, extended to full submission
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const ss = (page, n) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `j1v2-${n}.png`), fullPage: false });

const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    page.on("response", (r) => {
      if (r.url().includes("/api/claims") && !r.url().includes("preview")) {
        log(`[api] ${r.request().method()} ${r.url()} → ${r.status()}`);
      }
    });

    // Navigate
    log("→ Navigate to memorial");
    await page.goto("https://lzecher.com/he/memorial/memorial-31bo5y", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    await ss(page, "01-loaded");

    // p-4[0] is "Take whole Shas" bulk button — opens SoftLogin. Skip it.
    // Try seder p-4[1..6] one by one until we find one with available masechtot
    let claimBtn = null;
    let usedSeder = -1;
    for (let sIdx = 1; sIdx <= 6; sIdx++) {
      const expandable = await page.$$('button.p-4');
      if (sIdx >= expandable.length) break;
      log(`→ trying seder index ${sIdx}`);
      const sederText = (await expandable[sIdx].textContent() || "").slice(0, 40);
      log(`  seder text: "${sederText}"`);
      await expandable[sIdx].click({ force: true }).catch((e) => log(`  err: ${e.message}`));
      await page.waitForTimeout(700);
      // Try each masechta within this seder
      const masechtot = await page.$$('div.bg-cream-warm button');
      log(`  masechta candidates: ${masechtot.length}`);
      for (let mIdx = 0; mIdx < Math.min(masechtot.length, 12); mIdx++) {
        await masechtot[mIdx].click({ force: true }).catch(() => {});
        await page.waitForTimeout(500);
        const allBtns = await page.$$('button');
        for (const b of allBtns) {
          const text = (await b.textContent() || "").trim();
          if (/^אני לוקח|^אני מקבל/.test(text) && text.length < 50 && !/כל מסכת|כל סדר|כל הש/.test(text)) {
            claimBtn = b;
            usedSeder = sIdx;
            log(`  ✓ found claim btn in seder ${sIdx}, masechta ${mIdx}: "${text}"`);
            break;
          }
        }
        if (claimBtn) break;
        // Collapse this masechta to try the next
        await masechtot[mIdx].click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
      if (claimBtn) break;
      // collapse seder
      const expandable2 = await page.$$('button.p-4');
      if (expandable2[sIdx]) await expandable2[sIdx].click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    await ss(page, "03-perek-found");

    if (!claimBtn) {
      log("FAIL: no claim button found across all sedarim");
      const allBtns = await page.$$('button');
      for (let i = 0; i < Math.min(allBtns.length, 20); i++) {
        const t = (await allBtns[i].textContent() || "").trim();
        log(`  btn[${i}]: "${t.slice(0, 50)}"`);
      }
      return;
    }
    await claimBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await ss(page, "04-soft-login");

    // SoftLoginModal — click anonymous link
    const links = await page.$$('button.underline');
    let anonClicked = false;
    for (const l of links) {
      const text = (await l.textContent() || "").trim();
      if (/בעילום|anonym/i.test(text)) {
        log(`  anon link: "${text}"`);
        await l.click({ force: true });
        anonClicked = true;
        break;
      }
    }
    log(`anonymous link clicked: ${anonClicked}`);
    await page.waitForTimeout(1500);
    await ss(page, "05-claim-modal");

    // Claim modal — fill name
    const dialogs = await page.$$('[role="dialog"]');
    log(`dialogs visible: ${dialogs.length}`);
    if (dialogs.length === 0) { log("FAIL: no claim modal"); return; }
    const inputs = await dialogs[0].$$('input');
    log(`inputs in modal: ${inputs.length}`);
    if (inputs.length === 0) { log("FAIL: no inputs"); return; }
    const TEST_NAME = `בודק V5 ${Date.now()}`;
    await inputs[0].fill(TEST_NAME);
    log(`filled name: ${TEST_NAME}`);
    await page.waitForTimeout(300);
    await ss(page, "06-name-filled");

    // Confirm button
    const dlgBtns = await dialogs[0].$$('button');
    let confirmBtn = null;
    for (const b of dlgBtns) {
      const text = (await b.textContent() || "").trim();
      if (/^אני מקבל|^אני לוקח|^Confirm|^I commit/i.test(text) && text.length < 30) {
        confirmBtn = b;
        log(`  confirm btn: "${text}"`);
        break;
      }
    }
    if (!confirmBtn) {
      log("FAIL: no confirm button");
      for (let i = 0; i < dlgBtns.length; i++) {
        log(`  dlgBtn[${i}]: "${(await dlgBtns[i].textContent() || '').trim()}"`);
      }
      return;
    }
    log("→ clicking confirm");
    await confirmBtn.click({ force: true });

    // Wait for outcome
    await page.waitForTimeout(500);
    await ss(page, "07-mid-submit");

    const outcome = await Promise.race([
      page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 8000 }).then(() => "dialog_closed"),
      page.waitForSelector('[data-sonner-toast]', { timeout: 8000 }).then(() => "toast_appeared"),
    ]).catch((e) => `timeout: ${e.message.slice(0, 80)}`);
    log(`OUTCOME: ${outcome}`);
    await page.waitForTimeout(1000);
    await ss(page, "08-after");

    const toasts = await page.$$('[data-sonner-toast]');
    for (const t of toasts) {
      const text = (await t.textContent() || "").trim();
      log(`  toast: "${text}"`);
    }

    // Persistence check
    log("→ reloading to check persistence");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
    const expandable2 = await page.$$('button.p-4');
    if (expandable2[0]) await expandable2[0].click({ force: true });
    await page.waitForTimeout(500);
    const expandable3 = await page.$$('button.p-3');
    if (expandable3[0]) await expandable3[0].click({ force: true });
    await page.waitForTimeout(500);
    const bodyText = await page.locator('body').textContent();
    const persisted = bodyText.includes(TEST_NAME);
    log(`PERSISTENCE: test name "${TEST_NAME}" in body after reload: ${persisted ? "YES (PASS)" : "NO (FAIL — claim was not saved or doesn't display)"}`);
    await ss(page, "09-after-reload");

    log("\n--- console errors ---");
    consoleErrors.forEach((e) => log("  " + e));
  } catch (err) {
    log("EXCEPTION:", err.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "journey1-v2-report.txt"), REPORT.join("\n"));
})();
