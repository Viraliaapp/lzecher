// Verify BUG B fix: confirm button shows spinner + result toast/state on click
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const consoleLogs = [];
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("console", (m) => consoleLogs.push(`[${m.type()}] ${m.text()}`));
    page.on("response", (r) => {
      if (r.url().includes("/api/claims") && !r.url().includes("preview")) {
        console.log(`[api] ${r.request().method()} ${r.url()} → ${r.status()}`);
      }
    });

    await page.goto("https://lzecher.com/he/memorial/memorial-31bo5y", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Drill down: click first sedar
    let buttons = await page.$$('button.p-4');
    if (buttons[0]) await buttons[0].click();
    await page.waitForTimeout(400);

    // Click first masechta
    buttons = await page.$$('button.p-3');
    if (buttons[0]) await buttons[0].click();
    await page.waitForTimeout(500);

    // Click first available perek claim button
    const allButtons = await page.$$('button');
    let clickedClaim = false;
    for (const b of allButtons) {
      const text = (await b.textContent() || "").trim();
      if (/אני לוקח|אני מקבל|claim|take/i.test(text) && text.length < 60) {
        try {
          await b.click({ timeout: 3000 });
          clickedClaim = true;
          console.log("Clicked perek claim:", text);
          break;
        } catch {}
      }
    }
    if (!clickedClaim) {
      console.log("No perek claim button found");
      return;
    }

    await page.waitForTimeout(1500);
    // We're in SoftLoginModal — click anonymous link
    const links = await page.$$('button.underline');
    for (const l of links) {
      const text = (await l.textContent() || "").trim();
      if (/בעילום|anonym/i.test(text)) {
        console.log("Clicking anonymous link:", text);
        await l.click();
        break;
      }
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bugb-01-claim-dialog.png") });

    // Now in claim modal — type a name
    const dialogs = await page.$$('[role="dialog"]');
    if (dialogs.length === 0) { console.log("FAIL: no dialog"); return; }
    const inputs = await dialogs[0].$$('input');
    console.log(`Dialog inputs: ${inputs.length}`);
    if (inputs.length === 0) { console.log("FAIL: no inputs"); return; }
    await inputs[0].fill("בודק אוטומטי V5");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bugb-02-name-filled.png") });

    // Find confirm button (אני מקבל/ת)
    const dialogButtons = await dialogs[0].$$('button');
    let confirmBtn = null;
    for (const b of dialogButtons) {
      const text = (await b.textContent() || "").trim();
      if (/אני מקבל|confirm/i.test(text) && text.length < 30) {
        confirmBtn = b;
        console.log("Found confirm button:", text);
        break;
      }
    }
    if (!confirmBtn) { console.log("FAIL: no confirm button"); return; }

    // Click and watch for spinner + network request
    console.log("Clicking confirm...");
    await confirmBtn.click();

    // Wait briefly, screenshot to capture spinner state
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bugb-03-clicking.png") });

    // Wait for response (or 5s timeout)
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bugb-04-after.png") });

    // Check if dialog closed (success) or still open with toast
    const dialogsAfter = await page.$$('[role="dialog"]');
    const toasts = await page.$$('[data-sonner-toast], [role="status"]');
    console.log(`After click: ${dialogsAfter.length} dialog(s), ${toasts.length} toast(s)`);

    console.log("\n--- Console logs from page ---");
    consoleLogs.forEach((l) => console.log(l));
  } catch (err) {
    console.error("FAIL:", err.message);
  } finally {
    await browser.close();
  }
})();
