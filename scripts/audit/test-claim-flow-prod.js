// Reproduce BUG A (email column) and BUG B (אישור does nothing) on production lzecher.com
// This runs against the LIVE site BEFORE deploying fixes — it documents the broken state.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SCREENSHOT_DIR = path.join(__dirname, "..", "screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function ss(page, name) {
  return page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

(async () => {
  const log = [];
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();

    // Capture console errors and failed requests
    page.on("console", (m) => {
      if (m.type() === "error") log.push(`[console.error] ${m.text()}`);
    });
    page.on("requestfailed", (r) => log.push(`[reqfailed] ${r.method()} ${r.url()} - ${r.failure() && r.failure().errorText}`));
    page.on("response", (r) => {
      if (r.status() >= 400) log.push(`[resp ${r.status()}] ${r.request().method()} ${r.url()}`);
    });

    console.log("→ Navigate to homepage");
    await page.goto("https://lzecher.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);
    await ss(page, "01-homepage");

    // Find a memorial card link
    const memorialLinks = await page.$$('a[href*="/memorial/"]');
    console.log(`Found ${memorialLinks.length} memorial links`);
    if (memorialLinks.length === 0) {
      log.push("FAIL: No memorial cards found on homepage");
      throw new Error("No memorials");
    }
    const href = await memorialLinks[0].getAttribute("href");
    console.log(`Opening memorial: ${href}`);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      memorialLinks[0].click(),
    ]);
    await page.waitForTimeout(2000);
    await ss(page, "02-memorial-page");

    // Look for any Take/Claim button
    const claimButtons = await page.$$('button');
    let clickedClaim = false;
    for (const b of claimButtons) {
      const text = (await b.textContent() || "").trim();
      if (/אני לוקח|אני מקבל|claim|take this|join/i.test(text) && text.length < 60) {
        console.log(`Clicking button with text: "${text}"`);
        try { await b.click({ timeout: 5000 }); clickedClaim = true; break; } catch {}
      }
    }
    if (!clickedClaim) {
      // Try to expand a seder/masechta first
      const expandable = await page.$$('button.p-4, button.p-3');
      console.log(`No top-level claim button — found ${expandable.length} expandable buttons. Expanding...`);
      if (expandable.length > 0) {
        await expandable[0].click();
        await page.waitForTimeout(800);
        // Now find a masechta
        const next = await page.$$('button');
        for (const b of next) {
          const text = (await b.textContent() || "").trim();
          if (/אני לוקח|אני מקבל|claim|take this|join/i.test(text) && text.length < 60) {
            await b.click({ timeout: 5000 }).catch(() => {});
            clickedClaim = true; break;
          }
        }
      }
    }

    await page.waitForTimeout(2000);
    await ss(page, "03-after-claim-click");

    // Document what's visible: any modal? input fields?
    const dialogs = await page.$$('[role="dialog"]');
    console.log(`Dialogs visible: ${dialogs.length}`);
    if (dialogs.length === 0) {
      log.push("WARN: No dialog appeared after clicking claim. May need to navigate deeper.");
    } else {
      const inputs = await dialogs[0].$$('input');
      console.log(`Inputs in dialog: ${inputs.length}`);
      for (let i = 0; i < inputs.length; i++) {
        const type = await inputs[i].getAttribute("type") || "text";
        const placeholder = await inputs[i].getAttribute("placeholder") || "";
        log.push(`  input[${i}] type=${type} placeholder="${placeholder}"`);
      }
    }

    log.push("=== Test complete ===");
  } catch (err) {
    log.push(`EXCEPTION: ${err.message}\n${err.stack}`);
  } finally {
    if (browser) await browser.close();
  }
  console.log("\n--- LOG ---");
  console.log(log.join("\n"));
  fs.writeFileSync(path.join(SCREENSHOT_DIR, "claim-flow-log.txt"), log.join("\n"));
})();
