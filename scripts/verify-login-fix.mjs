#!/usr/bin/env node
/**
 * verify-login-fix.mjs
 *
 * Verifies the login-flicker fix end-to-end:
 *   Phase 7 — valid magic link → lands on dashboard, no bounce
 *   Phase 8 — no auth → redirects to login cleanly, no infinite spinner
 *
 * Usage:
 *   node scripts/verify-login-fix.mjs [base-url]
 *   Default base-url: http://localhost:3000
 *
 * Requires: REMINDER_ACTION_SECRET env var (or CRON_SECRET) to sign tokens.
 * Admin UID / email are taken from the running Firebase project.
 */

import { chromium } from "playwright";
import { signToken } from "../src/lib/signed-tokens.ts";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const BASE = process.argv[2] || "http://localhost:3000";
const SCREENSHOT_DIR = path.join(process.cwd(), "scripts", "audit", "login-fix-screenshots");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ADMIN_EMAIL = "solomon2145@gmail.com";
const LOCALE = "he";

let pass = 0;
let fail = 0;
const log = [];

function ok(msg) { pass++; log.push(`  ✅ ${msg}`); console.log(`  ✅ ${msg}`); }
function ko(msg, detail) { fail++; log.push(`  ❌ ${msg}${detail ? ` — ${detail}` : ""}`); console.error(`  ❌ ${msg}${detail ? ` — ${detail}` : ""}`); }
function info(msg) { log.push(`  ℹ️  ${msg}`); console.log(`  ℹ️  ${msg}`); }

async function screenshot(page, name) {
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  info(`Screenshot: ${file}`);
}

// ── Phase 7: Valid magic link → dashboard ────────────────────────────────────
async function phase7(browser) {
  console.log("\n[Phase 7] Valid magic link → should reach dashboard\n");

  // Generate a real signed token for the admin email
  const token = signToken({
    purpose: "auto_signin",
    email: ADMIN_EMAIL,
    locale: LOCALE,
    redirect: `/${LOCALE}/dashboard`,
  }, 30 * 60 * 1000); // 30 min TTL

  const autoSigninUrl = `${BASE}/${LOCALE}/auto-signin?token=${encodeURIComponent(token)}`;
  info(`Auto-signin URL: ${autoSigninUrl.slice(0, 80)}...`);

  const context = await browser.newContext({
    // Fresh context — no stored auth
  });
  const page = await context.newPage();

  const consoleMessages = [];
  const redirects = [];

  page.on("console", (msg) => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === "error" || text.includes("[auth]") || text.includes("[auto-signin]")) {
      console.log(`   CONSOLE: ${msg.type()}: ${text}`);
    }
  });

  page.on("request", (req) => {
    if (req.isNavigationRequest()) {
      redirects.push({ type: "nav", url: req.url() });
    }
  });

  page.on("response", (res) => {
    if (res.request().isNavigationRequest() && [301, 302, 303, 307, 308].includes(res.status())) {
      redirects.push({ type: "redirect", status: res.status(), url: res.url(), location: res.headers().location });
    }
  });

  try {
    info("Navigating to auto-signin URL...");
    await page.goto(autoSigninUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await screenshot(page, "p7-01-auto-signin-loading");

    // Wait for success state to appear
    try {
      await page.waitForSelector("text=Taking you", { timeout: 15000 });
      ok("Auto-signin page shows success state");
      await screenshot(page, "p7-02-auto-signin-success");
    } catch {
      try {
        await page.waitForSelector("text=Signing you", { timeout: 5000 });
        info("Still showing 'Signing you in...' — waiting more...");
        await page.waitForTimeout(5000);
      } catch {
        const html = await page.content().catch(() => "");
        const hasError = html.includes("Could not sign") || html.includes("sign-in failed");
        if (hasError) {
          ko("Auto-signin page showed error state");
          await screenshot(page, "p7-02-auto-signin-error");
          await context.close();
          return;
        }
      }
    }

    // Wait for navigation to dashboard — should happen within 3 seconds of success
    info("Waiting for navigation to dashboard...");
    try {
      await page.waitForURL(/\/dashboard/, { timeout: 8000 });
      const finalUrl = page.url();
      ok(`Navigated to dashboard: ${finalUrl}`);
      await screenshot(page, "p7-03-dashboard-arrived");
    } catch {
      const currentUrl = page.url();
      if (currentUrl.includes("/login")) {
        ko("Bounced back to login! (the flicker bug)", currentUrl);
        await screenshot(page, "p7-03-bounced-to-login");
      } else if (currentUrl.includes("/auto-signin")) {
        ko("Still on auto-signin page — navigation never happened", currentUrl);
        await screenshot(page, "p7-03-stuck-on-autosignin");
      } else {
        info(`Ended up at: ${currentUrl}`);
        if (currentUrl.includes("/dashboard")) {
          ok(`On dashboard: ${currentUrl}`);
          await screenshot(page, "p7-03-dashboard-arrived");
        } else {
          ko(`Unexpected URL: ${currentUrl}`);
          await screenshot(page, "p7-03-unexpected");
        }
      }
    }

    // Verify we are signed in (not showing login form, not showing infinite spinner)
    await page.waitForTimeout(2000); // Let React settle
    const currentUrl = page.url();
    if (currentUrl.includes("/dashboard")) {
      const isLoginPage = await page.$("input[type=email]").catch(() => null);
      if (isLoginPage) {
        ko("On dashboard URL but showing login form — redirect loop");
      } else {
        ok("Dashboard content present — user is signed in");
      }
      await screenshot(page, "p7-04-dashboard-final");

      // Phase 7b: Reload dashboard — confirm session persists
      info("Reloading dashboard to test session persistence...");
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(3000);
      const afterReloadUrl = page.url();
      if (afterReloadUrl.includes("/dashboard")) {
        ok("After reload: still on dashboard — session persists");
        await screenshot(page, "p7-05-dashboard-reload");
      } else if (afterReloadUrl.includes("/login")) {
        ko("After reload: bounced to login — session NOT persisted");
        await screenshot(page, "p7-05-reload-bounced");
      } else {
        info(`After reload: ${afterReloadUrl}`);
      }
    } else if (currentUrl.includes("/login")) {
      ko("Ended on login page — the flicker-and-bounce bug is NOT fixed", currentUrl);
      await screenshot(page, "p7-04-still-on-login");
    }

    // Print all console errors
    const authErrors = consoleMessages.filter(m => m.includes("[auth]") || m.includes("[auto-signin]"));
    if (authErrors.length > 0) {
      info(`Auth-related console messages:\n${authErrors.map(m => "    " + m).join("\n")}`);
    }

  } catch (err) {
    ko("Phase 7 threw an exception", err.message);
    await screenshot(page, "p7-exception").catch(() => {});
  }

  await context.close();
}

// ── Phase 8: No auth → clean redirect to login (spinner fix) ────────────────
async function phase8(browser) {
  console.log("\n[Phase 8] No auth → should redirect to login (no infinite spinner)\n");

  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  page.on("console", (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
  });

  try {
    info(`Navigating to /${LOCALE}/dashboard with no auth...`);
    const startTime = Date.now();

    // Middleware should block immediately — we'll see a redirect
    const response = await page.goto(`${BASE}/${LOCALE}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    const elapsed = Date.now() - startTime;
    const currentUrl = page.url();
    info(`Landed at: ${currentUrl} (${elapsed}ms)`);

    if (currentUrl.includes("/login")) {
      ok(`Redirected to login in ${elapsed}ms — middleware working`);
      await screenshot(page, "p8-01-redirected-to-login");
    } else if (currentUrl.includes("/dashboard")) {
      // Middleware passed (cookie might be set from earlier). Wait for React guard.
      info("Middleware allowed through — waiting for React auth guard...");
      await screenshot(page, "p8-01-spinner-or-content");

      try {
        await page.waitForURL(/\/login/, { timeout: 12000 });
        const guardElapsed = Date.now() - startTime;
        ok(`Auth guard redirected to login in ${guardElapsed}ms — no infinite spinner`);
        await screenshot(page, "p8-02-guard-redirected");
      } catch {
        const finalUrl = page.url();
        if (finalUrl.includes("/login")) {
          ok("Eventually redirected to login");
        } else {
          ko("Still on dashboard after 12s — possible infinite spinner OR logged in from phase 7", finalUrl);
          await screenshot(page, "p8-02-timeout");
        }
      }
    } else {
      info(`Unexpected URL: ${currentUrl}`);
    }

    // Phase 8b: Inject a corrupt __session cookie and navigate
    info("Testing corrupt session cookie self-heal...");
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    const page2Logs = [];
    page2.on("console", m => page2Logs.push(`[${m.type()}] ${m.text()}`));

    // Set a corrupt __session cookie (value=1 but no real Firebase auth)
    await context2.addCookies([{
      name: "__session",
      value: "1",
      domain: new URL(BASE).hostname,
      path: "/",
    }]);

    info(`Navigating to /${LOCALE}/dashboard with corrupt __session cookie...`);
    const t2 = Date.now();
    await page2.goto(`${BASE}/${LOCALE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 15000 });

    // Wait up to 12 seconds for redirect to login
    try {
      await page2.waitForURL(/\/login/, { timeout: 12000 });
      const el2 = Date.now() - t2;
      ok(`Corrupt session self-healed to login in ${el2}ms`);
      await screenshot(page2, "p8-03-corrupt-selfheal");

      const timeoutLog = page2Logs.find(m => m.includes("timeout") || m.includes("forcing logged-out"));
      if (timeoutLog) info(`Self-heal trigger: ${timeoutLog}`);
    } catch {
      const finalUrl = page2.url();
      if (finalUrl.includes("/login")) {
        ok("Self-healed to login");
      } else {
        ko("Corrupt session did NOT self-heal — possible infinite spinner", `still at ${finalUrl} after 12s`);
        await screenshot(page2, "p8-03-corrupt-no-selfheal");
      }
    }

    await context2.close();

  } catch (err) {
    ko("Phase 8 threw an exception", err.message);
    await screenshot(page, "p8-exception").catch(() => {});
  }

  await context.close();
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🔐 Lzecher Login Fix Verification — ${BASE}\n`);

  const browser = await chromium.launch({ headless: true });

  try {
    await phase7(browser);
    await phase8(browser);
  } finally {
    await browser.close();
  }

  console.log("\n" + log.join("\n"));
  console.log("\n─────────────────────────────────────────");
  console.log(`✅ Passed: ${pass}   ❌ Failed: ${fail}`);
  console.log("");

  if (fail === 0) {
    console.log("LOGIN BUG FIXED — BOTH PATHS VERIFIED");
  } else {
    console.log("⚠️  Some checks failed — see above");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
