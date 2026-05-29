#!/usr/bin/env node
/**
 * test-repeating-sets.mjs
 *
 * BEHAVIORAL TEST: Repeating sets open at the right time.
 *
 * SAFETY: Creates ONE lzecher_projects + lzecher_portions + lzecher_claims
 * scoped to TEST_PROJECT_ID. Deletes them all on cleanup.
 * Does NOT touch any other collections or projects.
 *
 * Usage: npx dotenv-cli -e .env.local -- node scripts/audit/test-repeating-sets.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, "browser-verify");
const BASE = "http://localhost:3001";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* env vars");
  process.exit(1);
}

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();
fs.mkdirSync(SS_DIR, { recursive: true });

let TEST_PROJECT_ID = null;
const createdPortionIds = [];
const createdClaimIds = [];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function ss(page, name) {
  const p = path.join(SS_DIR, name + ".png");
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

async function claimViaApi(portionId, claimerName) {
  const res = await fetch(`${BASE}/api/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      portionId,
      projectId: TEST_PROJECT_ID,
      claimerName,
      locale: "en",
      duration: "oneTime",
      reminderPreferences: [],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claim failed: ${JSON.stringify(data)}`);
  if (data.claimId) createdClaimIds.push(data.claimId);
  return data;
}

// ── Setup: create minimal test project ───────────────────────────────────────
async function setupTestProject() {
  const now = Date.now();
  const slug = `test-repeating-sets-${now.toString(36)}`;

  const projRef = db.collection("lzecher_projects").doc();
  TEST_PROJECT_ID = projRef.id;

  // SAFETY: only lzecher_projects
  await projRef.set({
    id: TEST_PROJECT_ID,
    nameHebrew: "בדיקת סטים",
    nameEnglish: "Repeating Sets Test",
    familyNameHebrew: "אוטומטי",
    honorific: "ז״ל",
    gender: "male",
    tracks: ["mishnayos"],
    slug,
    isPublic: true,
    allowAnonymous: true,
    repeatingSetEnabled: true,
    status: "active",
    claimedPortions: 0,
    totalPortions: 2,
    totalSets: 1,
    participantCount: 0,
    createdBy: "test-script",
    createdAt: now,
    updatedAt: now,
  });
  console.log(`  Created test project: ${TEST_PROJECT_ID} / ${slug}`);

  // Seed exactly 2 portions (set 1) — small enough to claim quickly
  const batch = db.batch();
  for (let i = 1; i <= 2; i++) {
    const ref = db.collection("lzecher_portions").doc();
    batch.set(ref, {
      id: ref.id,
      projectId: TEST_PROJECT_ID,
      trackType: "mishnayos",
      claimMode: "exclusive",
      reference: `Test Perek ${i}`,
      displayName: `Test Chapter ${i}`,
      displayNameHebrew: `פרק בדיקה ${i}`,
      order: i,
      status: "available",
      seder: "מועד",
      masechet: "ברכות",
      perek: i,
      setNumber: 1,
    });
    createdPortionIds.push(ref.id);
  }
  await batch.commit();
  console.log(`  Seeded 2 test portions (set 1)`);
  return slug;
}

// ── Verify Firestore state ────────────────────────────────────────────────────
async function getPortionCount(setNumber) {
  const snap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .where("setNumber", "==", setNumber)
    .get();
  return snap.size;
}

async function getAvailableCount(setNumber) {
  const snap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .where("setNumber", "==", setNumber)
    .where("status", "==", "available")
    .get();
  return snap.size;
}

async function getProjectData() {
  const snap = await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).get();
  return snap.data();
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup() {
  console.log("\n[Cleanup] Deleting test data...");
  console.log(`  SAFETY: Scoping all deletes to projectId=${TEST_PROJECT_ID}`);

  // Delete all portions for this project
  const portionsSnap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .get();
  const portionBatch = db.batch();
  portionsSnap.docs.forEach(d => portionBatch.delete(d.ref));
  await portionBatch.commit();
  console.log(`  Deleted ${portionsSnap.size} portions`);

  // Delete all claims for this project
  const claimsSnap = await db.collection("lzecher_claims")
    .where("projectId", "==", TEST_PROJECT_ID)
    .get();
  const claimBatch = db.batch();
  claimsSnap.docs.forEach(d => claimBatch.delete(d.ref));
  await claimBatch.commit();
  console.log(`  Deleted ${claimsSnap.size} claims`);

  // Delete the project
  await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).delete();
  console.log(`  Deleted project ${TEST_PROJECT_ID}`);

  // Verify cleanup
  const verifyProj = await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).get();
  const verifyPortions = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .get();
  if (!verifyProj.exists && verifyPortions.empty) {
    console.log("  ✅ Cleanup verified — no test data remains");
  } else {
    console.error("  ❌ Cleanup incomplete!");
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔁 REPEATING SETS BEHAVIORAL TEST");
  console.log(`   Dev server: ${BASE}\n`);

  // Verify dev server
  const vr = await fetch(`${BASE}/api/version`);
  if (!vr.ok) { console.error("Dev server not running"); process.exit(1); }

  const slug = await setupTestProject();
  const memorialUrl = `${BASE}/en/memorial/${slug}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: "en-US" });
  // No auth injection needed — memorial pages are public

  try {
    // ── Step 1: Load memorial — verify set 1 shows, set 2 absent ──────────────
    console.log("\n[Step 1] Load memorial — set 1 should show, set 2 absent");
    const page1 = await context.newPage();
    await page1.goto(memorialUrl, { waitUntil: "load", timeout: 30000 });
    await page1.waitForTimeout(2500);
    await ss(page1, "07-repeating-set1-initial");
    const set2Count = await getPortionCount(2);
    if (set2Count > 0) {
      console.error(`  ❌ FAIL: Set 2 already exists before any claims! (${set2Count} portions)`);
    } else {
      console.log("  ✅ Set 2 does NOT exist before any claims");
    }
    await page1.close();

    // ── Step 2: Claim portion 1 — set 2 must NOT open ─────────────────────────
    console.log("\n[Step 2] Claim portion 1 of 2 — set 2 must NOT open");
    const r1 = await claimViaApi(createdPortionIds[0], "Test Claimer 1");
    console.log(`  Claim result: ${JSON.stringify(r1)}`);
    if (r1.newSetOpened) {
      console.error("  ❌ FAIL: Set 2 opened after only 1 of 2 portions claimed (BUG-01 regression!)");
    } else {
      console.log("  ✅ Set 2 did NOT open after claiming 1 of 2 — correct");
    }
    const set2AfterFirst = await getPortionCount(2);
    console.log(`  Set 2 portion count: ${set2AfterFirst} (expected 0)`);
    if (set2AfterFirst > 0) {
      console.error("  ❌ FAIL: Set 2 seeded prematurely");
    }

    // ── Step 3: Claim portion 2 (last) — set 2 MUST open ─────────────────────
    console.log("\n[Step 3] Claim portion 2 of 2 (last) — set 2 MUST open");
    const r2 = await claimViaApi(createdPortionIds[1], "Test Claimer 2");
    console.log(`  Claim result: ${JSON.stringify(r2)}`);
    if (!r2.newSetOpened) {
      console.error("  ❌ FAIL: Set 2 did NOT open after last portion was claimed");
    } else {
      console.log(`  ✅ Set 2 opened! newSetNumber=${r2.newSetNumber}`);
    }

    // Wait a moment for Firestore to settle
    await new Promise(r => setTimeout(r, 1500));

    const set2AfterLast = await getPortionCount(2);
    const projData = await getProjectData();
    console.log(`  Set 2 portion count: ${set2AfterLast}`);
    console.log(`  Project totalSets: ${projData?.totalSets}`);
    console.log(`  Project totalPortions: ${projData?.totalPortions}`);

    if (set2AfterLast === 0) {
      console.error("  ❌ FAIL: Set 2 not in Firestore despite API saying newSetOpened=true");
    } else {
      console.log(`  ✅ Set 2 has ${set2AfterLast} portions in Firestore`);
    }

    // ── Step 4: Screenshot memorial with stacked sets ─────────────────────────
    console.log("\n[Step 4] Screenshot memorial showing stacked set layout");
    const page2 = await context.newPage();
    await page2.goto(memorialUrl, { waitUntil: "load", timeout: 30000 });
    await page2.waitForTimeout(3000);
    await ss(page2, "07-repeating-sets-stacked");

    // Check progress bar / percentage
    const bodyText = await page2.evaluate(() => document.body.innerText);
    const has100 = /100%|100 %/.test(bodyText);
    const hasSet2 = /set 2|round 2|סט 2|סבב 2/i.test(bodyText);
    const hasTaken = /taken/i.test(bodyText);
    console.log(`  Body contains 100%: ${has100}`);
    console.log(`  Body mentions Set 2: ${hasSet2}`);
    console.log(`  Body mentions Taken: ${hasTaken}`);

    await page2.close();

  } finally {
    await browser.close();
    await cleanup();
  }

  console.log("\n✅ Repeating sets test complete\n");
}

main().catch(async err => {
  console.error("Script error:", err);
  if (TEST_PROJECT_ID) {
    console.log("Attempting cleanup after error...");
    try { await cleanup(); } catch (e) { console.error("Cleanup failed:", e.message); }
  }
  process.exit(1);
});
