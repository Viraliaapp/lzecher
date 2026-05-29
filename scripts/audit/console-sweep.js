#!/usr/bin/env node
/**
 * console-sweep.js — Capture console errors and translation leaks on key pages.
 * Run: npx dotenv-cli -e .env.local -- node scripts/audit/console-sweep.js
 */
"use strict";

require("dotenv").config({ path: ".env.local" });
const { chromium } = require("playwright");
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3001";
const SS_DIR = path.join(__dirname, "browser-verify");
const ADMIN_UID = "qslaGC6OnUP6kFHHcqZ6Z27TRch2";
const ADMIN_EMAIL = "solomon2145@gmail.com";
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
const SHNAYIM_SLUG = "memorial-ay5ukw";
const ADMIN_PROJECT_ID = "B9Pa8lLjjyRUKOFz0kgF";

fs.mkdirSync(SS_DIR, { recursive: true });

// ── Firebase auth for admin pages ─────────────────────────────────────────────
let cachedIdToken = null, cachedRefreshToken = null;
async function getAdminIdToken() {
  if (cachedIdToken) return cachedIdToken;
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    })});
  }
  const customToken = await admin.auth().createCustomToken(ADMIN_UID, { isAdmin: true, isSuperAdmin: true });
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }) });
  const data = await res.json();
  if (!data.idToken) throw new Error("Token exchange failed: " + JSON.stringify(data));
  cachedIdToken = data.idToken;
  cachedRefreshToken = data.refreshToken;
  return cachedIdToken;
}

async function injectAuth(context) {
  const idToken = await getAdminIdToken();
  const userPayload = JSON.stringify({
    uid: ADMIN_UID, email: ADMIN_EMAIL, emailVerified: true, displayName: null, isAnonymous: false,
    providerData: [{ providerId: "password", uid: ADMIN_EMAIL, email: ADMIN_EMAIL }],
    stsTokenManager: { refreshToken: cachedRefreshToken || "", accessToken: idToken, expirationTime: Date.now() + 3600000 },
    createdAt: String(Date.now()), lastLoginAt: String(Date.now()), apiKey: API_KEY, appName: "[DEFAULT]",
  });
  await context.addInitScript(({ key, value }) => {
    try { window.localStorage.setItem(key, value); document.cookie = `__session=1; path=/; max-age=2592000; samesite=lax`; } catch(e) {}
  }, { key: `firebase:authUser:${API_KEY}:[DEFAULT]`, value: userPayload });
  await context.addCookies([{ name: "__session", value: "1", domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }]);
}

// ── Raw key leak regex ────────────────────────────────────────────────────────
// Pattern: long dot-path strings like "dashboard.taken" or "admin.hideTitle"
const RAW_KEY_RE = /\b[a-z]+\.[a-zA-Z]+(?:\.[a-zA-Z]+)*\b/g;
// English in right-to-left pages
const OBVIOUS_ENGLISH_WORDS = /\b(dashboard|projects|loading|error|success|filter|search|admin|share|cancel|confirm|delete|hide|unhide)\b/i;

async function checkPage(context, url, label, { expectAuth = false, locale = "en" } = {}) {
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  const consoleWarnings = [];

  page.on("console", m => {
    const t = m.type();
    const txt = m.text();
    if (t === "error" && !txt.includes("404") && !txt.includes("favicon")) errors.push(txt);
    if (t === "warn" && txt.includes("Missing")) consoleWarnings.push(txt); // next-intl missing key warnings
  });
  page.on("requestfailed", req => {
    const url = req.url();
    if (!url.includes("favicon") && !url.includes("analytics")) {
      failedRequests.push(`${req.method()} ${url} — ${req.failure()?.errorText}`);
    }
  });

  await page.goto(url, { waitUntil: "load", timeout: 30000 });
  await page.waitForTimeout(2500);

  const visibleText = await page.evaluate(() => document.body.innerText).catch(() => "");

  // Check for raw i18n key leaks (patterns like "admin.hideTitle" visible on screen)
  const rawKeyMatches = [];
  const lines = visibleText.split("\n");
  for (const line of lines) {
    const matches = line.match(RAW_KEY_RE) || [];
    for (const m of matches) {
      // Must have a dot and look like a translation key (not a URL, version, etc.)
      if (m.includes(".") && m.split(".").every(p => /^[a-zA-Z][a-zA-Z0-9]+$/.test(p)) && m.length > 8) {
        rawKeyMatches.push(m);
      }
    }
  }

  // Check for English in non-English locales
  let englishLeaks = [];
  if (locale !== "en" && locale !== "he") { // he uses unique chars, easy to spot
    // Look for obvious English words in page text on non-English pages
    englishLeaks = visibleText.split("\n").filter(line =>
      OBVIOUS_ENGLISH_WORDS.test(line) && line.length < 60
    ).slice(0, 3);
  }

  const ssPath = path.join(SS_DIR, `sweep-${label}.png`);
  await page.screenshot({ path: ssPath, fullPage: false });

  const result = {
    label, url, locale,
    errors: errors.slice(0, 5),
    failedRequests: failedRequests.slice(0, 5),
    consoleWarnings: consoleWarnings.slice(0, 3),
    rawKeyMatches: rawKeyMatches.slice(0, 5),
    englishLeaks: englishLeaks.slice(0, 3),
    screenshot: ssPath,
  };

  await page.close();
  return result;
}

async function main() {
  console.log("\n🔍 CONSOLE + TRANSLATION SWEEP\n");

  const browser = await chromium.launch({ headless: true });

  // Authenticated context for protected routes
  const authCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
  await injectAuth(authCtx);

  // Anonymous context for public pages
  const anonCtx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });

  const pages = [
    // Public pages
    { ctx: anonCtx, url: `${BASE}/en`, label: "home-en", locale: "en" },
    { ctx: anonCtx, url: `${BASE}/he`, label: "home-he", locale: "he" },
    { ctx: anonCtx, url: `${BASE}/es`, label: "home-es", locale: "es" },
    { ctx: anonCtx, url: `${BASE}/fr`, label: "home-fr", locale: "fr" },
    { ctx: anonCtx, url: `${BASE}/en/memorial/${SHNAYIM_SLUG}`, label: "memorial-en", locale: "en" },
    { ctx: anonCtx, url: `${BASE}/he/memorial/${SHNAYIM_SLUG}`, label: "memorial-he", locale: "he" },
    // Auth pages
    { ctx: authCtx, url: `${BASE}/en/dashboard`, label: "dashboard-en", locale: "en" },
    { ctx: authCtx, url: `${BASE}/he/dashboard`, label: "dashboard-he", locale: "he" },
    { ctx: authCtx, url: `${BASE}/en/admin`, label: "admin-en", locale: "en" },
    { ctx: authCtx, url: `${BASE}/en/edit/${ADMIN_PROJECT_ID}`, label: "edit-en", locale: "en" },
  ];

  const results = [];
  for (const { ctx, url, label, locale } of pages) {
    console.log(`  Checking ${label}...`);
    const r = await checkPage(ctx, url, label, { locale }).catch(e => ({
      label, url, locale, errors: [`LOAD_ERROR: ${e.message}`],
      failedRequests: [], consoleWarnings: [], rawKeyMatches: [], englishLeaks: [], screenshot: null,
    }));
    results.push(r);
  }

  await browser.close();

  // Report
  console.log("\n────────────────────────────────────────────────");
  console.log("SWEEP RESULTS");
  console.log("────────────────────────────────────────────────");
  let issueCount = 0;
  for (const r of results) {
    const issues = [...r.errors, ...r.failedRequests, ...r.rawKeyMatches.map(k => `RAW_KEY: ${k}`), ...r.englishLeaks.map(l => `EN_LEAK: ${l}`)];
    if (issues.length > 0) {
      console.log(`\n  ⚠️  ${r.label} (${r.url})`);
      issues.forEach(i => console.log(`     ${i}`));
      issueCount += issues.length;
    } else {
      console.log(`  ✅ ${r.label} — clean`);
    }
    if (r.consoleWarnings.length > 0) {
      r.consoleWarnings.forEach(w => console.log(`  ℹ️  ${r.label} warning: ${w}`));
    }
  }
  if (issueCount === 0) {
    console.log("\n  All pages clean — no console errors, no translation leaks");
  } else {
    console.log(`\n  ${issueCount} issue(s) found across ${results.length} pages`);
  }
  console.log();
}

main().catch(e => { console.error(e); process.exit(1); });
