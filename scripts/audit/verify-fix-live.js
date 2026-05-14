// Verify the BUG A fix is live: claim modal should show name field but NOT email field by default
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text()); });

    // Use a known memorial slug (from earlier test)
    await page.goto("https://lzecher.com/he/memorial/memorial-31bo5y", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "verify-01-memorial.png") });

    // Click the first expand-able sedar
    const expandable = await page.$$('button.p-4');
    if (expandable.length > 0) await expandable[0].click();
    await page.waitForTimeout(500);

    // Look for any claim button
    const buttons = await page.$$('button');
    let clicked = false;
    for (const b of buttons) {
      const text = (await b.textContent() || "").trim();
      if (/אני לוקח|אני מקבל|claim|take this|join/i.test(text) && text.length < 80) {
        try { await b.click({ timeout: 3000 }); clicked = true; break; } catch {}
      }
    }
    if (!clicked) {
      // Try expanding masechta level
      const expandable2 = await page.$$('button.p-3');
      if (expandable2.length > 0) await expandable2[0].click();
      await page.waitForTimeout(500);
      const buttons2 = await page.$$('button');
      for (const b of buttons2) {
        const text = (await b.textContent() || "").trim();
        if (/אני לוקח|אני מקבל|claim|take this|join/i.test(text) && text.length < 80) {
          try { await b.click({ timeout: 3000 }); clicked = true; break; } catch {}
        }
      }
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "verify-02-soft-login-modal.png") });

    // Should be on SoftLoginModal — click "or claim anonymously"
    const anonymousLink = await page.$('button:has-text("anonym"), button:has-text("בלי")') ;
    if (anonymousLink) {
      console.log("Clicking 'or anonymous' link");
      await anonymousLink.click();
    } else {
      // Find by underline class hint
      const links = await page.$$('button.underline');
      for (const l of links) {
        const text = (await l.textContent() || "").trim();
        console.log("underline button found:", text);
        if (/anonym|בעילום|sin cuenta|anonyme|anonymously|en cuenta|sans compte/i.test(text)) {
          console.log("  → clicking this one");
          await l.click();
          break;
        }
      }
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "verify-03-claim-modal-anon.png") });

    // INSPECT: is email field hidden by default?
    const dialogs = await page.$$('[role="dialog"]');
    if (dialogs.length === 0) {
      console.log("RESULT: NO_DIALOG — could not reach claim dialog");
      return;
    }
    const inputs = await dialogs[0].$$('input');
    let emailVisible = false;
    for (const i of inputs) {
      const type = await i.getAttribute("type") || "text";
      if (type === "email") {
        emailVisible = await i.isVisible();
      }
    }
    console.log(`RESULT: dialog has ${inputs.length} input(s); email field visible by default: ${emailVisible}`);
    console.log(emailVisible ? "❌ BUG A NOT FIXED on live (email still showing)" : "✅ BUG A FIXED — email hidden by default");

    // Look for the "Add email" link
    const addEmailLink = await dialogs[0].$('button:has-text("Add email"), button:has-text("הוסף אימייל"), button:has-text("Añadir correo"), button:has-text("Ajouter")');
    console.log(`Add-email-reminders link visible: ${addEmailLink ? "✅ YES" : "❌ NO"}`);
  } catch (err) {
    console.error("Verification failed:", err.message);
  } finally {
    await browser.close();
  }
})();
