// Verify BUG 1 fix is live by signing in and capturing /he/create Step 1.
// Uses the auto-signin token approach with longer waits.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env.local") });

const SECRET = process.env.REMINDER_ACTION_SECRET || process.env.CRON_SECRET || "default-dev-secret-not-for-prod";
function signToken(payload, ttlMs) {
  const full = { ...payload, iat: Date.now(), exp: Date.now() + ttlMs };
  const b64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

const SS = path.join(__dirname, "..", "screenshots");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1400 } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.log("[err]", m.text().slice(0, 120)); });

    // Step 1: visit auto-signin, give it ample time for the signInWithCustomToken
    // and onAuthStateChanged listener to populate before navigating away.
    const token = signToken({ purpose: "auto_signin", email: "solomon2145@gmail.com", locale: "he", redirect: "/he/dashboard" }, 3600_000);
    console.log("→ auto-signin");
    await page.goto(`https://lzecher.com/he/auto-signin?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    // Wait until we either land on /dashboard OR the auto-signin page shows success
    try { await page.waitForURL(/dashboard/, { timeout: 20000 }); console.log("  ✓ redirected to dashboard"); }
    catch { console.log("  no redirect to dashboard within 20s; URL is", page.url()); }
    await page.waitForTimeout(3000);

    // Step 2: from in-page link, navigate to /create (this keeps Firebase auth state)
    console.log("→ navigate via in-page anchor to /he/create");
    await page.evaluate(() => { window.location.href = "/he/create"; });
    // Wait for form elements to appear
    try {
      await page.waitForSelector('input[autofocus], label:has-text("שם פרטי"), label:has-text("First name")', { timeout: 25000 });
      console.log("  ✓ create form rendered");
    } catch (e) {
      console.log("  form did not render within 25s; URL is", page.url());
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SS, "verify-bug1-he-create.png"), fullPage: true });

    // Also EN
    await page.evaluate(() => { window.location.href = "/en/create"; });
    try { await page.waitForSelector('input[autofocus]', { timeout: 25000 }); } catch {}
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SS, "verify-bug1-en-create.png"), fullPage: true });

    console.log("done");
  } catch (err) {
    console.error("FAIL:", err.message);
  } finally {
    await browser.close();
  }
})();
