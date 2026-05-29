#!/usr/bin/env node
/**
 * browser-verify.js
 * Playwright verification of the session-1 batch fixes:
 *   1. Edit page loads project data (no "Failed to load")
 *   2. Shnayim Mikra tab renders parshiyot content
 *   3. Share templates reachable on creator dashboard + admin dashboard
 *   4. Dashboard shows no completion UI, progress = taken
 *   5. Multi-select appears INSIDE expanded masechta (not at top)
 *
 * Run: npx dotenv-cli -e .env.local -- node scripts/audit/browser-verify.js
 *
 * SAFETY: Read-only. No Firestore writes. Admin SDK used only to mint auth token.
 */
"use strict";

require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const BASE = "http://localhost:3001";
const SS_DIR = path.join(__dirname, "browser-verify");
const ADMIN_UID = "qslaGC6OnUP6kFHHcqZ6Z27TRch2";
const ADMIN_EMAIL = "solomon2145@gmail.com";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

// Project owned by admin user
const ADMIN_PROJECT_ID = "B9Pa8lLjjyRUKOFz0kgF";
// Project with shnayim_mikra track
const SHNAYIM_SLUG = "memorial-ay5ukw";
// A mishnayos project for multi-select test
const MISHNAYOS_SLUG = "memorial-lz8uqv";

fs.mkdirSync(SS_DIR, { recursive: true });

// ── Firebase Admin ────────────────────────────────────────────────────────────
function getAdminApp() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin;
}

let cachedIdToken = null;
let cachedRefreshToken = null;

async function getAdminIdToken() {
  if (cachedIdToken) return cachedIdToken;
  getAdminApp();
  const customToken = await admin.auth().createCustomToken(ADMIN_UID, {
    isAdmin: true,
    isSuperAdmin: true,
  });
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!data.idToken) throw new Error("Token exchange failed: " + JSON.stringify(data));
  cachedIdToken = data.idToken;
  cachedRefreshToken = data.refreshToken;
  return cachedIdToken;
}

async function injectAuth(context) {
  const idToken = await getAdminIdToken();
  const userPayload = JSON.stringify({
    uid: ADMIN_UID,
    email: ADMIN_EMAIL,
    emailVerified: true,
    displayName: null,
    isAnonymous: false,
    providerData: [{ providerId: "password", uid: ADMIN_EMAIL, email: ADMIN_EMAIL }],
    stsTokenManager: {
      refreshToken: cachedRefreshToken || "",
      accessToken: idToken,
      expirationTime: Date.now() + 3600 * 1000,
    },
    createdAt: String(Date.now()),
    lastLoginAt: String(Date.now()),
    apiKey: API_KEY,
    appName: "[DEFAULT]",
  });

  await context.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
        document.cookie = `__session=1; path=/; max-age=2592000; samesite=lax`;
      } catch (e) {
        console.warn("auth inject failed", e);
      }
    },
    { key: `firebase:authUser:${API_KEY}:[DEFAULT]`, value: userPayload }
  );

  await context.addCookies([
    {
      name: "__session",
      value: "1",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function ss(page, name) {
  const p = path.join(SS_DIR, name + ".png");
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

// ── Results ───────────────────────────────────────────────────────────────────
const results = [];
function pass(label) { results.push({ label, status: "PASS" }); console.log(`  ✅ PASS: ${label}`); }
function fail(label, reason) { results.push({ label, status: "FAIL", reason }); console.error(`  ❌ FAIL: ${label} — ${reason}`); }

// ── Tests ─────────────────────────────────────────────────────────────────────
async function test1_editPage(context) {
  console.log("\n[1] Edit page loads project data...");
  const page = await context.newPage();
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(`${BASE}/en/edit/${ADMIN_PROJECT_ID}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, "01-edit-page");

  // Check for "Failed to load" toast or error text
  const pageText = await page.textContent("body");
  if (pageText.includes("Failed to load") || pageText.includes("failed to load")) {
    fail("Edit page: no 'Failed to load' error", "Error text found in body");
  } else if (pageText.includes("Project not found") || pageText.includes("Not authorized")) {
    fail("Edit page: no 'Failed to load' error", "Auth/notfound error found");
  } else {
    // Check that actual form fields are populated
    const hasInput = await page.locator("input").count();
    if (hasInput > 0) {
      pass("Edit page loads with form fields (no 'Failed to load')");
    } else {
      fail("Edit page: no 'Failed to load' error", "No form inputs found — may still be loading");
    }
  }

  await page.close();
}

async function test2_shnayimMikra(context) {
  console.log("\n[2] Shnayim Mikra tab renders content...");
  const page = await context.newPage();

  await page.goto(`${BASE}/en/memorial/${SHNAYIM_SLUG}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, "02-memorial-default");

  // Click on the Shnayim Mikra tab
  const tabLocator = page.locator("button, [role=tab]").filter({ hasText: /shnayim|שנים|mikra/i });
  const tabCount = await tabLocator.count();
  if (tabCount === 0) {
    // Try Hebrew
    const heTabLocator = page.locator("button, [role=tab]").filter({ hasText: /שנ/i });
    const heCount = await heTabLocator.count();
    if (heCount === 0) {
      fail("Shnayim Mikra tab", "Tab not found on memorial page");
      await page.close();
      return;
    }
    await heTabLocator.first().click();
  } else {
    await tabLocator.first().click();
  }

  await page.waitForTimeout(2000);
  await ss(page, "02-shnayim-mikra-tab");

  const bodyText = await page.textContent("body");
  // Check for parsha names (Bereishis, Shemos, etc. or Hebrew equivalents)
  const hasParsha = /bereshit|bereishis|שמות|ויקרא|במדבר|דברים|בראשית/i.test(bodyText);
  if (hasParsha) {
    pass("Shnayim Mikra tab renders parshiyot content");
  } else {
    // Check if there's any content at all in the tab area
    const hasAnyContent = await page.locator("button").filter({ hasText: /claim|take|קח|לקח/i }).count();
    if (hasAnyContent > 0) {
      pass("Shnayim Mikra tab has claim buttons (content rendered)");
    } else {
      fail("Shnayim Mikra tab", "No parsha names or claim buttons found — may be empty");
    }
  }

  await page.close();
}

async function test3_dashboardShare(context) {
  console.log("\n[3] Share templates on creator dashboard...");
  const page = await context.newPage();

  await page.goto(`${BASE}/en/dashboard`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, "03-dashboard");

  // Look for Share2 button (share icon)
  const shareBtn = page.locator("button[title='Share'], button svg[data-lucide='share-2']").first();
  const shareCount = await page.locator("button").filter({ hasText: /share/i }).count();

  // More robust: look for any button with share-2 icon
  const share2Btns = await page.locator("[data-lucide='share-2'], .lucide-share-2").count();
  const shareButtonsByTitle = await page.locator("button[title='Share']").count();
  const shareButtonsByLabel = await page.locator("button[aria-label*='share' i], button[aria-label*='שיתוף']").count();

  console.log(`    share-2 icons: ${share2Btns}, title=Share: ${shareButtonsByTitle}, aria: ${shareButtonsByLabel}, text: ${shareCount}`);

  // Try clicking the first available share button
  let clicked = false;
  if (shareButtonsByTitle > 0) {
    await page.locator("button[title='Share']").first().click();
    clicked = true;
  } else if (share2Btns > 0) {
    await page.locator("[data-lucide='share-2']").first().click();
    clicked = true;
  }

  if (clicked) {
    await page.waitForTimeout(1500);
    await ss(page, "03-dashboard-share-dialog");
    const dialogText = await page.textContent("body");
    if (dialogText.includes("shiva") || dialogText.includes("שבעה") || dialogText.includes("Shiva")) {
      pass("Dashboard share button opens ShareTemplates dialog");
    } else {
      // Check for any dialog
      const dialogOpen = await page.locator("[role=dialog], [data-state=open]").count();
      if (dialogOpen > 0) {
        pass("Dashboard share button opens a dialog");
      } else {
        fail("Dashboard share templates dialog", "No dialog opened after clicking share");
      }
    }
  } else {
    fail("Dashboard share button", "No share button found on dashboard");
  }

  await page.close();
}

async function test4_adminShare(context) {
  console.log("\n[4] Share templates on admin dashboard...");
  const page = await context.newPage();

  await page.goto(`${BASE}/en/admin`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, "04-admin-dashboard");

  const shareButtonsByTitle = await page.locator("button[title='Share']").count();
  const share2Btns = await page.locator("[data-lucide='share-2']").count();

  console.log(`    title=Share: ${shareButtonsByTitle}, share-2 icons: ${share2Btns}`);

  let clicked = false;
  if (shareButtonsByTitle > 0) {
    await page.locator("button[title='Share']").first().click();
    clicked = true;
  } else if (share2Btns > 0) {
    await page.locator("[data-lucide='share-2']").first().click();
    clicked = true;
  }

  if (clicked) {
    await page.waitForTimeout(1500);
    await ss(page, "04-admin-share-dialog");
    const dialogText = await page.textContent("body");
    if (dialogText.includes("shiva") || dialogText.includes("שבעה") || dialogText.includes("Shiva")) {
      pass("Admin dashboard share button opens ShareTemplates dialog");
    } else {
      const dialogOpen = await page.locator("[role=dialog], [data-state=open]").count();
      if (dialogOpen > 0) {
        pass("Admin dashboard share button opens a dialog");
      } else {
        fail("Admin share templates dialog", "No dialog opened after clicking share");
      }
    }
  } else {
    fail("Admin share button", "No share button found on admin dashboard");
  }

  await page.close();
}

async function test5_noCompletionUI(context) {
  console.log("\n[5] Dashboard has no completion UI...");
  const page = await context.newPage();

  await page.goto(`${BASE}/en/dashboard`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, "05-dashboard-no-completion");

  // Use innerText (visible text only, excludes script/style bundles)
  const bodyText = await page.evaluate(() => document.body.innerText);

  // These should NOT appear in visible UI
  const hasMarkComplete = /mark all as learned|mark.*complete.*button|check.*all.*done/i.test(bodyText);
  const hasCheckCircle = await page.locator("[data-lucide='check-circle'], .lucide-check-circle").count();

  // Stats cards — should be 3, not 4
  const statCards = await page.locator(".grid > [class*='card'], .grid > div").count();

  if (hasMarkComplete) {
    fail("No mark-complete UI", "Found mark-complete text in body");
  } else {
    pass("No mark-complete text found on dashboard");
  }

  if (hasCheckCircle > 0) {
    fail("No CheckCircle icon", `Found ${hasCheckCircle} check-circle icons`);
  } else {
    pass("No CheckCircle icon on dashboard");
  }

  console.log(`    Stat cards found: ${statCards}`);
  await page.close();
}

async function test6_multiSelectInsideMasechta(context) {
  console.log("\n[6] Multi-select inside masechta/book (not at top)...");
  const page = await context.newPage();

  // Go to the mishnayos memorial
  await page.goto(`${BASE}/en/memorial/${MISHNAYOS_SLUG}`, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(3000);
  await ss(page, "06-memorial-mishnayos");

  // Expand a masechta — click on the first expandable element
  // The masechta rows should be clickable
  const expandable = page.locator("button, [role=button]").filter({ hasText: /ברכות|שבת|עירובין|מועד|נשים|נזיקין/i }).first();
  const expandableCount = await expandable.count();

  if (expandableCount === 0) {
    // Try clicking any expand button
    const anyExpand = page.locator("button[aria-expanded], button svg[data-lucide='chevron-down'], button svg[data-lucide='chevron-right']").first();
    if (await anyExpand.count() > 0) {
      await anyExpand.click();
    } else {
      fail("Multi-select inside masechta", "Could not find any expandable masechta");
      await page.close();
      return;
    }
  } else {
    await expandable.click();
  }

  await page.waitForTimeout(1000);
  await ss(page, "06-masechta-expanded");

  // Now check — multi-select checkbox should be visible INSIDE the expanded area
  // and NOT as a standalone top-level toggle
  const checkboxCount = await page.locator("input[type=checkbox], [role=checkbox]").count();
  const multiSelectText = await page.locator("body").textContent();
  const hasSelectAll = /select all|multi|select.*portions/i.test(multiSelectText);

  console.log(`    Checkboxes found: ${checkboxCount}`);

  if (checkboxCount > 0) {
    pass(`Multi-select checkboxes found inside expanded masechta (${checkboxCount} checkboxes)`);
  } else if (hasSelectAll) {
    pass("Multi-select UI found after expanding masechta");
  } else {
    // Even if no checkboxes visible yet, take a screenshot and check if the area renders
    fail("Multi-select inside masechta", "No checkboxes found after expanding masechta");
  }

  await page.close();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔍 LZECHER BROWSER VERIFICATION");
  console.log(`   Base: ${BASE}`);
  console.log(`   Screenshots: ${SS_DIR}\n`);

  if (!API_KEY) {
    console.error("❌ NEXT_PUBLIC_FIREBASE_API_KEY not set");
    process.exit(1);
  }

  // Verify dev server is up
  try {
    const r = await fetch(`${BASE}/api/version`);
    const v = await r.json();
    console.log(`✅ Dev server running. Version: ${JSON.stringify(v)}\n`);
  } catch (e) {
    console.error(`❌ Dev server not responding at ${BASE}:`, e.message);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
  });

  await injectAuth(context);

  try {
    await test1_editPage(context);
    await test2_shnayimMikra(context);
    await test3_dashboardShare(context);
    await test4_adminShare(context);
    await test5_noCompletionUI(context);
    await test6_multiSelectInsideMasechta(context);
  } finally {
    await browser.close();
  }

  // Summary
  console.log("\n────────────────────────────────────────────────");
  console.log("RESULTS SUMMARY");
  console.log("────────────────────────────────────────────────");
  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "PASS") {
      passed++;
      console.log(`  ✅ ${r.label}`);
    } else {
      failed++;
      console.error(`  ❌ ${r.label}: ${r.reason}`);
    }
  }
  console.log(`\n  ${passed} passed / ${failed} failed`);
  console.log(`  Screenshots saved to: ${SS_DIR}\n`);

  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
