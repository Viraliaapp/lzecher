// Reproduce BUG 1: doubled input field on /he/create Step 1
// Use the existing auto-signin JWT flow with the test admin email
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
fs.mkdirSync(SS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const token = signToken(
      { purpose: "auto_signin", email: "solomon2145@gmail.com", locale: "he", redirect: "/he/create" },
      3600_000
    );

    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1100 } });
    const page = await ctx.newPage();
    page.on("console", (m) => { if (m.type() === "error") console.log("[err]", m.text()); });

    console.log("→ auto-signin via JWT");
    await page.goto(`https://lzecher.com/he/auto-signin?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
    // Wait for redirect to dashboard (means auth state propagated and cookie set)
    try {
      await page.waitForURL(/dashboard/, { timeout: 15000 });
    } catch {
      console.log("  no redirect to dashboard within 15s — URL is now:", page.url());
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SS, "bug1-00-after-signin.png"), fullPage: false });

    console.log("→ navigate /he/create (same context — auth should persist)");
    await page.goto("https://lzecher.com/he/create", { waitUntil: "domcontentloaded" });
    // Wait for the form to render (spinner gone, label visible)
    try {
      await page.waitForSelector('label:has-text("שם פרטי"), label:has-text("First name"), input[autofocus]', { timeout: 15000 });
    } catch {
      console.log("  form did not render — taking screenshot anyway");
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SS, "bug1-01-he-create-step1.png"), fullPage: true });

    console.log("→ navigate /en/create");
    await page.goto("https://lzecher.com/en/create", { waitUntil: "domcontentloaded" });
    try {
      await page.waitForSelector('label, input[autofocus]', { timeout: 15000 });
    } catch {}
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SS, "bug1-02-en-create-step1.png"), fullPage: true });
    console.log("done; screenshots in", SS);
  } catch (err) {
    console.error("FAIL:", err.message);
  } finally {
    await browser.close();
  }
})();
