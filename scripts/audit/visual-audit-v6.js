/**
 * Visual audit v6 — render every public route × locale × viewport against
 * production, capture screenshots + console errors + network errors, run
 * automated anomaly detection (text overflow, doubled labels, English leaks,
 * raw translation keys, broken images), and write a report.
 *
 * Authenticated routes (dashboard, create, admin) are visited via the
 * existing auto-signin JWT flow with the admin email.
 *
 * Output:
 *   scripts/screenshots/visual-audit/<route>-<locale>-<viewport>.png
 *   scripts/screenshots/visual-audit/_metadata.json
 *   scripts/screenshots/visual-audit/_anomalies.json
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env.local") });

const SS_DIR = path.join(__dirname, "..", "screenshots", "visual-audit");
fs.mkdirSync(SS_DIR, { recursive: true });

const SECRET = process.env.REMINDER_ACTION_SECRET || process.env.CRON_SECRET || "default-dev-secret-not-for-prod";
function signToken(payload, ttlMs) {
  const full = { ...payload, iat: Date.now(), exp: Date.now() + ttlMs };
  const b64 = Buffer.from(JSON.stringify(full)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(b64).digest("hex");
  return `${b64}.${sig}`;
}

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

const PUBLIC_ROUTES = [
  { name: "home", path: "" },
  { name: "about", path: "/about" },
  { name: "halachic-guidance", path: "/halachic-guidance" },
  { name: "memorial", path: "/memorial/memorial-blf1d9" },
  { name: "confirm-complete-success", path: "/confirm-complete?status=success&name=Test" },
  { name: "auto-signin-invalid", path: "/auto-signin?token=invalid" },
  { name: "login", path: "/login" },
];

const AUTH_ROUTES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "create-step1", path: "/create" },
  { name: "admin", path: "/admin" },
];

const LOCALES = ["en", "he", "es", "fr"];

// English wordlist for non-EN leak detection
const ENGLISH_WORDS = ["Cancel", "Save", "Delete", "Submit", "Back", "Close", "Create", "Loading", "Confirm", "Sign in", "Sign out"];

const metadata = { startedAt: new Date().toISOString(), runs: [] };
const anomalies = [];

async function detectAnomalies(page, label, locale) {
  const issues = [];
  // Raw translation keys (pattern like "namespace.key" appearing as visible text)
  const rawKeys = await page.evaluate(() => {
    const re = /\b[a-z][a-zA-Z]*\.[a-zA-Z_]+\b/;
    const matches = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = (n.textContent || "").trim();
      if (t && t.length < 80 && re.test(t) && !t.includes(" ")) matches.push(t.slice(0, 60));
    }
    return matches.slice(0, 10);
  });
  if (rawKeys.length > 0) issues.push({ kind: "raw_translation_keys", samples: rawKeys });

  // English leaks in non-EN
  if (locale !== "en") {
    const visibleText = await page.evaluate(() => document.body.innerText.slice(0, 50000));
    const found = [];
    for (const w of ENGLISH_WORDS) {
      const re = new RegExp("\\b" + w.replace(/\s+/g, "\\s+") + "\\b", "i");
      if (re.test(visibleText)) found.push(w);
    }
    if (found.length > 0) issues.push({ kind: "english_leak", words: found });
  }

  // Doubled <label> with same htmlFor target
  const doubled = await page.evaluate(() => {
    const seen = new Map();
    const dups = [];
    for (const l of document.querySelectorAll("label[for]")) {
      const f = l.getAttribute("for");
      if (seen.has(f)) dups.push(f);
      else seen.set(f, true);
    }
    return dups;
  });
  if (doubled.length > 0) issues.push({ kind: "doubled_labels", htmlFor: doubled });

  // Broken images
  const broken = await page.evaluate(() => {
    const out = [];
    for (const img of document.querySelectorAll("img")) {
      if (img.naturalWidth === 0 && img.complete) out.push(img.src);
    }
    return out.slice(0, 10);
  });
  if (broken.length > 0) issues.push({ kind: "broken_images", sources: broken });

  // Text overflow on small elements
  const overflow = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, label, h1, h2, h3, p")) {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && el.children.length === 0) {
        const cs = window.getComputedStyle(el);
        if (cs.overflow !== "hidden" && cs.textOverflow !== "ellipsis" && !el.className.includes("truncate")) {
          out.push({ tag: el.tagName.toLowerCase(), text: (el.textContent || "").slice(0, 40), scrollW: el.scrollWidth, clientW: el.clientWidth });
        }
      }
    }
    return out.slice(0, 6);
  });
  if (overflow.length > 0) issues.push({ kind: "text_overflow", samples: overflow });

  if (issues.length > 0) anomalies.push({ label, locale, issues });
  return issues;
}

async function captureOne(browser, locale, route, viewportName, viewport, { authed = false, signinToken = null } = {}) {
  const ctx = await browser.newContext({ viewport, locale: locale === "he" ? "he-IL" : locale });
  const page = await ctx.newPage();
  const consoleErrors = [];
  const failedReqs = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => {
    if (!r.url().includes("_rsc=")) failedReqs.push(`${r.method()} ${r.url().slice(0, 100)}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !r.url().includes("_rsc=")) failedReqs.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 100)}`);
  });

  // If authed: first hit /auto-signin to set the cookie (in same context)
  if (authed && signinToken) {
    try {
      await page.goto(`https://lzecher.com/${locale}/auto-signin?token=${encodeURIComponent(signinToken)}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      // Wait until either redirect happens OR success state shown
      try { await page.waitForURL(/dashboard/, { timeout: 10000 }); } catch {}
      await page.waitForTimeout(2000);
    } catch (e) {
      // Continue — the screenshot will show the failed signin
      consoleErrors.push("auto-signin failed: " + e.message);
    }
  }

  const url = `https://lzecher.com/${locale}${route.path}`;
  const label = `${route.name}-${locale}-${viewportName}`;
  const meta = { label, url, locale, viewport: viewportName, authed };
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(2500);
    const ssPath = path.join(SS_DIR, `${label}.png`);
    await page.screenshot({ path: ssPath, fullPage: false });
    meta.screenshot = ssPath;
    meta.issues = await detectAnomalies(page, label, locale);
  } catch (e) {
    meta.error = e.message;
  }
  meta.consoleErrors = consoleErrors;
  meta.failedReqs = failedReqs;
  metadata.runs.push(meta);
  await ctx.close();
  return meta;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Pre-sign one auto-signin token (good for 30 minutes) reused per locale
    const tokens = {};
    for (const loc of LOCALES) {
      tokens[loc] = signToken({ purpose: "auto_signin", email: "solomon2145@gmail.com", locale: loc, redirect: `/${loc}/dashboard` }, 30 * 60 * 1000);
    }

    let count = 0;
    // Public routes
    for (const loc of LOCALES) {
      for (const route of PUBLIC_ROUTES) {
        for (const [vName, vSize] of Object.entries(VIEWPORTS)) {
          count++;
          const m = await captureOne(browser, loc, route, vName, vSize);
          console.log(`[${count}] ${m.label} — ${m.issues?.length || 0} issues${m.consoleErrors.length ? ", " + m.consoleErrors.length + " console-errors" : ""}`);
        }
      }
    }
    // Auth routes — only desktop + mobile (skip tablet to keep total bounded)
    for (const loc of LOCALES) {
      for (const route of AUTH_ROUTES) {
        for (const vName of ["desktop", "mobile"]) {
          count++;
          const m = await captureOne(browser, loc, route, vName, VIEWPORTS[vName], { authed: true, signinToken: tokens[loc] });
          console.log(`[${count}] ${m.label} (auth) — ${m.issues?.length || 0} issues${m.consoleErrors.length ? ", " + m.consoleErrors.length + " console-errors" : ""}`);
        }
      }
    }
    console.log(`\nTotal screenshots: ${count}`);
    console.log(`Total anomalies found: ${anomalies.length}`);
  } catch (err) {
    console.error("FATAL:", err.message);
  } finally {
    await browser.close();
  }
  metadata.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(SS_DIR, "_metadata.json"), JSON.stringify(metadata, null, 2));
  fs.writeFileSync(path.join(SS_DIR, "_anomalies.json"), JSON.stringify(anomalies, null, 2));
  console.log("\nReports written to", SS_DIR);
})();
