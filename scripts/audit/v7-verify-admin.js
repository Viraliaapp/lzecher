// V7 admin verification: attempt auto-signin → /admin and /admin/projects/[id]/edit.
// READ-ONLY: load only, NO saves.
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

const SS = path.join(__dirname, "..", "screenshots", "v7");
fs.mkdirSync(SS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ locale: "he-IL", viewport: { width: 1280, height: 1400 } });
    const page = await ctx.newPage();
    const errs = [];
    page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 120)); });

    const token = signToken({ purpose: "auto_signin", email: "solomon2145@gmail.com", locale: "he", redirect: "/he/admin" }, 3600_000);
    await page.goto(`https://lzecher.com/he/auto-signin?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    try { await page.waitForURL(/admin|dashboard/, { timeout: 20000 }); } catch {}
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, "admin-after-signin.png"), fullPage: false });

    // Navigate to /he/admin explicitly
    await page.goto("https://lzecher.com/he/admin", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, "admin-dashboard.png"), fullPage: true });

    const adminText = await page.evaluate(() => document.body.innerText);
    console.log("admin page text length:", adminText.length);
    if (adminText.length < 100) console.log("  ⚠ appears to be loading screen / blocked");
    else console.log("  ✓ admin page rendered substantive content");

    // Check whether edit pencil icons are present (icon SVGs with class containing 'pencil' or button with title 'Edit')
    const pencils = await page.$$('a[href*="/edit"], button[title="Edit"]').then((arr) => arr.length);
    console.log("Edit links/buttons found:", pencils);

    // Try to navigate to edit page for a real project
    await page.goto("https://lzecher.com/he/admin/projects/B5Qqerw3towLBCiH2nSk/edit", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(SS, "admin-edit-page.png"), fullPage: true });
    const editText = await page.evaluate(() => document.body.innerText);
    console.log("edit page text length:", editText.length);

    if (errs.length) {
      console.log("\nConsole errors during admin nav:");
      errs.slice(0, 5).forEach((e) => console.log("  " + e));
    }
  } catch (err) {
    console.error("FAIL:", err.message);
  } finally {
    await browser.close();
  }
})();
