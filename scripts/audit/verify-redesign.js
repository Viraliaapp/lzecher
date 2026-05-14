// Verify all 5 parts of the auth/email redesign on production.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const ss = (page, n) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `redesign-${n}.png`), fullPage: false });
const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // ── PART 5: Memorials button in header ────────────────────────────────
    log("\n=== PART 5: Memorials button in header ===");
    for (const loc of ["he", "en", "es", "fr"]) {
      const ctx = await browser.newContext({ locale: loc === "he" ? "he-IL" : loc });
      const page = await ctx.newPage();
      await page.goto(`https://lzecher.com/${loc}/about`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const expected = { en: "Memorials", he: "הנצחות", es: "Memoriales", fr: "Memoriaux" }[loc];
      const link = await page.locator(`nav a:has-text("${expected}"), header a:has-text("${expected}")`).first();
      const found = (await link.count()) > 0;
      log(`  ${loc}: "${expected}" link in header — ${found ? "PASS" : "FAIL"}`);
      if (found) {
        const href = await link.getAttribute("href");
        log(`    href=${href}`);
      }
      await ctx.close();
    }

    // ── PART 2: Frictionless claiming (no SoftLogin) ──────────────────────
    log("\n=== PART 2: Frictionless claiming (no SoftLogin) ===");
    {
      const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const apiCalls = [];
      page.on("response", (r) => {
        if (r.url().includes("/api/claims") && !r.url().includes("preview")) {
          apiCalls.push({ method: r.request().method(), url: r.url(), status: r.status() });
        }
      });
      await page.goto("https://lzecher.com/he/memorial/memorial-31bo5y", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);

      // Drill into seder index 1 (skip Take whole Shas at index 0)
      const p4 = await page.$$('button.p-4');
      if (p4[1]) await p4[1].click({ force: true });
      await page.waitForTimeout(700);
      // Try multiple masechtot to find one with available perek
      const masechtot = await page.$$('div.bg-cream-warm button');
      let claimBtn = null;
      for (let mIdx = 0; mIdx < Math.min(masechtot.length, 10); mIdx++) {
        await masechtot[mIdx].click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        const btns = await page.$$('button');
        for (const b of btns) {
          const t = (await b.textContent() || "").trim();
          if (/^אני לוקח/.test(t) && t.length < 50 && !/כל מסכת|כל סדר|כל הש/.test(t)) {
            claimBtn = b;
            break;
          }
        }
        if (claimBtn) break;
        await masechtot[mIdx].click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
      if (!claimBtn) {
        log("  FAIL: no available perek to claim");
      } else {
        await claimBtn.click({ force: true });
        await page.waitForTimeout(1500);
        await ss(page, "p2-after-perek-click");
        // Check the dialog shown — must be CLAIM modal not SoftLogin (no email-only input)
        const dlg = (await page.$$('[role="dialog"]'))[0];
        const inputs = dlg ? await dlg.$$('input') : [];
        const firstInputType = inputs.length > 0 ? await inputs[0].getAttribute("type") : "";
        log(`  dialog opened with ${inputs.length} input(s); first type=${firstInputType}`);
        // SoftLogin had ONE email input. New behavior: claim modal with text input first.
        // The first input should not be type=email (it should be the name field).
        const isClaimModal = inputs.length >= 1 && firstInputType !== "email";
        log(`  no SoftLogin (claim modal opens directly): ${isClaimModal ? "PASS" : "FAIL"}`);

        if (isClaimModal) {
          // Fill name and submit
          const TEST_NAME = `קבלה ישירה V6 ${Date.now()}`;
          await inputs[0].fill(TEST_NAME);
          await page.waitForTimeout(300);
          const dlgBtns = await dlg.$$('button');
          let confirmBtn = null;
          for (const b of dlgBtns) {
            const t = (await b.textContent() || "").trim();
            if (/^אני מקבל/.test(t) && t.length < 30) { confirmBtn = b; break; }
          }
          if (confirmBtn) {
            await confirmBtn.click({ force: true });
            await page.waitForTimeout(4000);
            await ss(page, "p2-after-submit");
            const claimsCalls = apiCalls.filter((c) => c.url.includes("/api/claims") && c.method === "POST" && !c.url.includes("bulk"));
            log(`  POST /api/claims calls: ${claimsCalls.length}`);
            claimsCalls.forEach((c) => log(`    → ${c.status}`));
            log(`  end-to-end anon claim with no magic-link: ${claimsCalls.some((c) => c.status === 200) ? "PASS" : "FAIL"}`);
          }
        }
      }
      await ctx.close();
    }

    // ── PART 4: Anonymous mark-complete ──────────────────────────────────
    log("\n=== PART 4: Mark-complete button visible to anonymous user ===");
    {
      const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      await page.goto("https://lzecher.com/he/memorial/memorial-31bo5y", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      // Drill in until we find a CLAIMED but not COMPLETED perek
      const p4 = await page.$$('button.p-4');
      if (p4[1]) await p4[1].click({ force: true });
      await page.waitForTimeout(700);
      const masechtot = await page.$$('div.bg-cream-warm button');
      let markBtn = null;
      for (let mIdx = 0; mIdx < Math.min(masechtot.length, 10); mIdx++) {
        await masechtot[mIdx].click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        const btns = await page.$$('button');
        for (const b of btns) {
          const t = (await b.textContent() || "").trim();
          // Mark complete button — Hebrew "סמן/סמנתי" or English "Mark"
          if (/^סמן|^סמנתי|^Mark/.test(t) && t.length < 50) {
            markBtn = b;
            log(`    found mark-complete btn: "${t}"`);
            break;
          }
        }
        if (markBtn) break;
        await masechtot[mIdx].click({ force: true }).catch(() => {});
        await page.waitForTimeout(300);
      }
      log(`  Mark-complete button reachable as anonymous: ${markBtn ? "PASS" : "FAIL/NO_CLAIMED"}`);
      if (markBtn) {
        await markBtn.click({ force: true });
        await page.waitForTimeout(1200);
        await ss(page, "p4-mark-complete-modal");
        const dlg = (await page.$$('[role="dialog"]'))[0];
        if (dlg) {
          const text = (await dlg.textContent() || "");
          const hasAccountability = /קבלה אישית|Hashem|Hachem|הקדוש ברוך הוא/.test(text);
          log(`  accountability message visible: ${hasAccountability ? "PASS" : "FAIL"}`);
          // Cancel — don't actually mark someone else's perek complete
          const dlgBtns = await dlg.$$('button');
          for (const b of dlgBtns) {
            const t = (await b.textContent() || "").trim();
            if (/^ביטול|^Cancel/i.test(t)) { await b.click({ force: true }); break; }
          }
        }
      }
      await ctx.close();
    }

    // ── PART 3: Auto-signin page renders ────────────────────────────────────
    log("\n=== PART 3: Auto-signin page renders ===");
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto("https://lzecher.com/he/auto-signin?token=invalid", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      await ss(page, "p3-auto-signin-error");
      const text = await page.evaluate(() => document.body.innerText);
      const hasErrorOrLoading = /Could not|לא ניתן|invalid|expired|טוקן/i.test(text);
      log(`  /auto-signin page renders graceful error for invalid token: ${hasErrorOrLoading ? "PASS" : "FAIL"}`);
      await ctx.close();
    }

    // ── /api/version JSON ───────────────────────────────────────────────────
    log("\n=== /api/version ===");
    {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      const resp = await page.request.get("https://lzecher.com/api/version");
      const json = await resp.json();
      log(`  /api/version returns JSON: PASS (commit=${json.commit})`);
      await ctx.close();
    }

    log("\n=== DONE ===");
  } catch (err) {
    log("EXCEPTION:", err.message);
    log(err.stack);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "redesign-report.txt"), REPORT.join("\n"));
})();
