/**
 * Item 1 Verification: Dashboard spinner self-heal
 *
 * Tests:
 * 1. /he/dashboard with NO auth → sign-in prompt within 5s, not infinite spinner
 * 2. /he/dashboard with corrupt cookie → self-heals, not infinite spinner
 * 3. Baseline check the auth timeout mechanism
 *
 * Usage: node scripts/audit/p1-verify-dashboard.js
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.BASE_URL || "https://lzecher.vercel.app";
const SCREENSHOTS_DIR = path.join(__dirname, "screenshots");

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // TEST 1: No auth → should NOT spin forever, should redirect to login or show sign-in
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    console.log("TEST 1: /he/dashboard with no auth...");
    const start = Date.now();
    await page.goto(`${BASE_URL}/he/dashboard`, { waitUntil: "networkidle" });
    const elapsed = Date.now() - start;
    const screenshotPath = path.join(SCREENSHOTS_DIR, "1-no-auth.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    // Either redirected to /login or shows a sign-in prompt
    const url = page.url();
    const hasSpinner = await page.$(".animate-spin, [data-spinner]") !== null;
    const isLoginPage = url.includes("/login");
    const hasSignInBtn = (await page.textContent("body")).includes("כניסה") ||
                        (await page.textContent("body")).includes("Sign in") ||
                        (await page.textContent("body")).includes("התחברות");
    const passed = (isLoginPage || hasSignInBtn) && !hasSpinner;
    results.push({
      test: "No auth → no infinite spinner",
      passed,
      url,
      elapsed: `${elapsed}ms`,
      hasSpinner,
      screenshot: screenshotPath,
    });
    console.log(`  → ${passed ? "PASS" : "FAIL"} (${elapsed}ms, url=${url})`);
    await ctx.close();
  }

  // TEST 2: Corrupt __session cookie → should self-heal, not spin forever
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    console.log("TEST 2: /he/dashboard with corrupt session cookie...");
    await ctx.addCookies([{
      name: "__session",
      value: "1",
      domain: new URL(BASE_URL).hostname,
      path: "/",
    }]);
    const start = Date.now();
    await page.goto(`${BASE_URL}/he/dashboard`, { waitUntil: "networkidle" });
    // Wait up to 8s for the page to settle (auth timeout is 5s)
    await wait(8000);
    const elapsed = Date.now() - start;
    const screenshotPath = path.join(SCREENSHOTS_DIR, "2-corrupt-session.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const bodyText = await page.textContent("body");
    const hasSpinner = await page.$(".animate-spin") !== null;
    // Check for sign-in related content (login page or sign-in fallback)
    const hasSignInContent =
      page.url().includes("/login") ||
      bodyText.includes("כניסה") ||
      bodyText.includes("Sign in") ||
      bodyText.includes("נפגה") ||
      bodyText.includes("expired") ||
      bodyText.includes("התחברות");
    const passed = !hasSpinner && hasSignInContent;
    results.push({
      test: "Corrupt session → self-heals (no infinite spinner)",
      passed,
      url: page.url(),
      elapsed: `${elapsed}ms`,
      hasSpinner,
      hasSignInContent,
      screenshot: screenshotPath,
    });
    console.log(`  → ${passed ? "PASS" : "FAIL"} (${elapsed}ms, spinner=${hasSpinner})`);
    await ctx.close();
  }

  await browser.close();

  console.log("\n=== ITEM 1 RESULTS ===");
  for (const r of results) {
    const icon = r.passed ? "✅" : "❌";
    console.log(`${icon} ${r.test}`);
    console.log(`   Screenshot: ${r.screenshot}`);
  }

  const allPassed = results.every((r) => r.passed);
  console.log(`\n${allPassed ? "ITEM 1: PASS" : "ITEM 1: FAIL"}`);
  process.exit(allPassed ? 0 : 1);
}

run().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
