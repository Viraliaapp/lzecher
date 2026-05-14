// JOURNEY 6: mobile viewport (iPhone 13 = 375x812)
const { chromium, devices } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
const ss = (page, n) => page.screenshot({ path: path.join(SCREENSHOT_DIR, `j6-${n}.png`), fullPage: false });
const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "he-IL" });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") log("[err]", m.text()); });

    // Step 1-2: Homepage at mobile viewport
    log("→ mobile homepage");
    await page.goto("https://lzecher.com/he", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await ss(page, "01-homepage-mobile");

    // Step 3-4: Verify hamburger or mobile nav
    const hamburgerCandidates = await page.$$('button[aria-label*="menu" i], button[aria-label*="תפריט"]');
    log(`hamburger button candidates: ${hamburgerCandidates.length}`);
    // Or check viewport-specific nav
    const navItems = await page.$$('nav a, header a');
    log(`nav links visible: ${navItems.length}`);

    // Sign-in CTA
    const signInTexts = ["כניסה", "התחבר", "Sign in", "Sign In"];
    let signInFound = false;
    for (const txt of signInTexts) {
      if ((await page.locator(`a:has-text("${txt}"), button:has-text("${txt}")`).count()) > 0) {
        signInFound = true; log(`  sign-in CTA "${txt}" present`); break;
      }
    }
    log(`sign-in accessible on mobile: ${signInFound ? "PASS" : "FAIL"}`);

    // Step 7: Click memorial card
    const memorial = await page.locator('a[href*="/memorial/"]').first();
    if (await memorial.count()) {
      const href = await memorial.getAttribute("href");
      log(`→ open memorial ${href}`);
      await memorial.click({ force: true });
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2500);
      await ss(page, "02-memorial-mobile");
    }

    // Step 8-9: Drill into perek and check claim modal fits screen
    let p4 = await page.$$('button.p-4');
    log(`p-4 buttons (mobile): ${p4.length}`);
    if (p4[1]) await p4[1].click({ force: true }); // skip bulk shas
    await page.waitForTimeout(700);
    await ss(page, "03-seder-expanded-mobile");

    const masechtot = await page.$$('div.bg-cream-warm button');
    if (masechtot[2]) await masechtot[2].click({ force: true });
    await page.waitForTimeout(500);

    const allBtns = await page.$$('button');
    let claimBtn = null;
    for (const b of allBtns) {
      const t = (await b.textContent() || "").trim();
      if (/^אני לוקח/.test(t) && t.length < 50 && !/כל מסכת|כל סדר|כל הש/.test(t)) {
        claimBtn = b; break;
      }
    }
    if (claimBtn) {
      await claimBtn.click({ force: true });
      await page.waitForTimeout(1500);
      await ss(page, "04-soft-login-mobile");

      // Verify modal fits viewport
      const dlg = (await page.$$('[role="dialog"]'))[0];
      if (dlg) {
        const box = await dlg.boundingBox();
        log(`SoftLogin modal bbox: ${JSON.stringify(box)}`);
        log(`fits viewport (375 wide)? ${box && box.width <= 375 ? "PASS" : "WARN: width=" + (box && box.width)}`);
      }

      // Click anonymous
      const links = await page.$$('button.underline');
      for (const l of links) {
        const t = (await l.textContent() || "").trim();
        if (/בעילום/.test(t)) { await l.click({ force: true }); break; }
      }
      await page.waitForTimeout(1500);
      await ss(page, "05-claim-modal-mobile");

      const dlg2 = (await page.$$('[role="dialog"]'))[0];
      if (dlg2) {
        const box = await dlg2.boundingBox();
        log(`Claim modal bbox: ${JSON.stringify(box)}`);
        log(`fits viewport? ${box && box.width <= 375 ? "PASS" : "WARN"}`);
        const inputs = await dlg2.$$('input');
        log(`inputs accessible: ${inputs.length}`);
        // Cancel — don't submit on mobile journey
        const dlgBtns = await dlg2.$$('button');
        for (const b of dlgBtns) {
          const t = (await b.textContent() || "").trim();
          if (/^ביטול|^Cancel/i.test(t)) { await b.click({ force: true }); break; }
        }
      }
    } else {
      log("WARN: could not find perek claim btn on mobile");
    }
  } catch (err) {
    log("EXCEPTION:", err.message);
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "journey6-report.txt"), REPORT.join("\n"));
})();
