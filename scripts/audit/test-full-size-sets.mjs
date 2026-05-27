#!/usr/bin/env node
/**
 * test-full-size-sets.mjs
 *
 * Phase 5 verification: the set-completion logic works on a FULL Mishnayos
 * set (525 portions), not just a 2-portion toy.
 *
 * Test A: Claim 524 of 525 — Set 2 must NOT open.
 * Test B: Claim the 525th — Set 2 MUST open exactly once.
 * Test C: On a fresh 525-portion project, claim ~100 perakim across different
 *         sedarim — Set 2 must NOT open. (Regression test for the real bug.)
 *
 * SAFETY: creates ONE lzecher_projects + portions + claims, deletes all on cleanup.
 * ONLY touches lzecher_ collections. Scoped to TEST_PROJECT_ID at all times.
 *
 * Usage: npx dotenv-cli -e .env.local -- node scripts/audit/test-full-size-sets.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3002";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* env vars");
  process.exit(1);
}

if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

let TEST_PROJECT_ID = null;

// ── Helpers ───────────────────────────────────────────────────────────────────
async function claimViaApi(portionId, claimerName = "Test") {
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
  return data;
}

async function claimManyViaApi(portionIds, claimerName = "BulkTester") {
  const res = await fetch(`${BASE}/api/claims/multi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      portionIds,
      projectId: TEST_PROJECT_ID,
      claimerName,
      locale: "en",
      reminderPreferences: [],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Multi-claim failed: ${JSON.stringify(data)}`);
  return data;
}

async function getSet2Count() {
  const snap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .where("setNumber", "==", 2)
    .get();
  return snap.size;
}

async function getProjData() {
  const snap = await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).get();
  return snap.data();
}

async function getAllPortionIds(setNumber) {
  const snap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .get();
  return snap.docs
    .filter(d => {
      const sn = d.data().setNumber;
      const effectiveSN = (sn === undefined || sn === null) ? 1 : sn;
      return effectiveSN === setNumber;
    })
    .map(d => d.id);
}

// ── Setup: seed a full Mishnayos project ─────────────────────────────────────
async function setupTestProject() {
  const now = Date.now();
  const slug = `test-full-sets-${now.toString(36)}`;
  const projRef = db.collection("lzecher_projects").doc();
  TEST_PROJECT_ID = projRef.id;

  await projRef.set({
    id: TEST_PROJECT_ID,
    nameHebrew: "בדיקת גודל מלא",
    nameEnglish: "Full-Size Set Test",
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
    totalPortions: 0,
    totalSets: 1,
    participantCount: 0,
    createdBy: "test-script",
    createdAt: now,
    updatedAt: now,
  });

  const { MASECHTOS } = await import("../../src/lib/seed-data.ts");

  const BATCH_CHUNK = 400;
  let order = 0;
  const items = [];
  for (const m of MASECHTOS) {
    for (let p = 1; p <= m.perakim; p++) {
      order++;
      const ref = db.collection("lzecher_portions").doc();
      // No setNumber field = legacy Set 1 (the exact scenario that caused the real bug)
      items.push({
        ref,
        data: {
          id: ref.id,
          projectId: TEST_PROJECT_ID,
          trackType: "mishnayos",
          claimMode: "exclusive",
          reference: `${m.name} ${p}`,
          displayName: `${m.name} Chapter ${p}`,
          displayNameHebrew: `${m.nameHebrew} פרק ${p}`,
          order,
          status: "available",
          seder: m.seder,
          masechet: m.name,
          perek: p,
          // intentionally NO setNumber — mimics legacy Set 1
        },
      });
    }
  }

  // Write in chunks
  for (let i = 0; i < items.length; i += BATCH_CHUNK) {
    const chunk = items.slice(i, i + BATCH_CHUNK);
    const batch = db.batch();
    for (const { ref, data } of chunk) batch.set(ref, data);
    await batch.commit();
  }

  await projRef.update({ totalPortions: items.length });
  console.log(`  Created test project ${TEST_PROJECT_ID} with ${items.length} portions (no setNumber = legacy Set 1)`);
  return slug;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
async function cleanup() {
  if (!TEST_PROJECT_ID) return;
  console.log("\n[Cleanup]");

  const portionsSnap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID).get();
  for (let i = 0; i < portionsSnap.docs.length; i += 400) {
    const batch = db.batch();
    portionsSnap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`  Deleted ${portionsSnap.size} portions`);

  const claimsSnap = await db.collection("lzecher_claims")
    .where("projectId", "==", TEST_PROJECT_ID).get();
  for (let i = 0; i < claimsSnap.docs.length; i += 400) {
    const batch = db.batch();
    claimsSnap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`  Deleted ${claimsSnap.size} claims`);

  await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).delete();
  console.log(`  Deleted project`);

  const verify = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID).get();
  console.log(verify.empty ? "  ✅ Cleanup verified" : "  ❌ Cleanup incomplete!");
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n🔬 FULL-SIZE SET VERIFICATION (525 portions)\n");

  const vr = await fetch(`${BASE}/api/version`).catch(() => null);
  if (!vr?.ok) { console.error("Dev server not running at", BASE); process.exit(1); }

  let allPassed = true;
  function check(cond, label) {
    if (cond) { console.log(`  ✅ ${label}`); }
    else { console.error(`  ❌ FAIL: ${label}`); allPassed = false; }
  }

  // ══ TEST A: Claim 524 of 525 — Set 2 must NOT open ══════════════════════════
  console.log("═══ TEST A: Claim 524/525 via multi-claim — Set 2 must NOT open ═══");
  await setupTestProject();

  const allIds = await getAllPortionIds(1);
  check(allIds.length === 525, `Found 525 Set-1 portions (got ${allIds.length})`);

  // Claim first 524 in batches of 150 (multi-claim limit)
  const first524 = allIds.slice(0, 524);
  for (let i = 0; i < first524.length; i += 150) {
    const batch = first524.slice(i, i + 150);
    await claimManyViaApi(batch, `Claimer ${i}`);
  }
  await new Promise(r => setTimeout(r, 1000)); // let Firestore settle

  const set2AfterA = await getSet2Count();
  check(set2AfterA === 0, `Set 2 did NOT open after 524/525 (count=${set2AfterA})`);
  console.log(`  Set2 count after 524 claims: ${set2AfterA}`);

  // ══ TEST B: Claim the 525th — Set 2 MUST open ═══════════════════════════════
  console.log("\n═══ TEST B: Claim the 525th — Set 2 MUST open ═══");
  const lastId = allIds[524];
  const r = await claimViaApi(lastId, "LastClaimer");
  check(r.newSetOpened === true, `API returned newSetOpened=true`);
  check(r.newSetNumber === 2, `API returned newSetNumber=2`);

  await new Promise(r => setTimeout(r, 1500));
  const set2AfterB = await getSet2Count();
  check(set2AfterB === 525, `Set 2 has 525 portions after full set 1 (got ${set2AfterB})`);

  const projDataB = await getProjData();
  check(projDataB?.totalSets === 2, `Project totalSets=2 (got ${projDataB?.totalSets})`);
  check(projDataB?.totalPortions === 1050, `Project totalPortions=1050 (got ${projDataB?.totalPortions})`);
  console.log(`  Set2 count: ${set2AfterB}, totalSets: ${projDataB?.totalSets}, totalPortions: ${projDataB?.totalPortions}`);

  // ══ TEST C: Fresh project — claim ~100 across sedarim, Set 2 must NOT open ══
  console.log("\n═══ TEST C: Claim 100 perakim across different sedarim — Set 2 must NOT open ═══");
  await cleanup();
  TEST_PROJECT_ID = null;
  await setupTestProject();

  const allIdsC = await getAllPortionIds(1);
  check(allIdsC.length === 525, `Fresh project: 525 Set-1 portions`);

  // Claim 100 spread across different masechtos (mimics the real bug scenario)
  // Take the first 100 portions (spans Zeraim seder)
  const first100 = allIdsC.slice(0, 100);
  let prematureStop = false;
  for (let i = 0; i < first100.length; i += 50) {
    const batch = first100.slice(i, i + 50);
    console.log(`  [C] Claiming batch ${Math.floor(i/50)+1}: portions ${i+1}–${i+batch.length}`);
    await claimManyViaApi(batch, `Claimer${i}`);
    await new Promise(r => setTimeout(r, 600));
    const midCheck = await getSet2Count();
    if (midCheck > 0) {
      console.error(`\n  ⛔ PREMATURE STOP: Set 2 opened after ${i + batch.length} claims (set2Count=${midCheck})`);
      console.error(`  Batch that triggered it: portions ${i+1}–${i+batch.length}`);
      const proj = await getProjData();
      console.error(`  Project state: totalSets=${proj?.totalSets}, totalPortions=${proj?.totalPortions}, claimedPortions=${proj?.claimedPortions}`);
      prematureStop = true;
      allPassed = false;
      skipCleanup = true;
      break;
    }
    console.log(`    Set2 count after batch: 0 ✓`);
  }

  if (!prematureStop) {
    await new Promise(r => setTimeout(r, 1000));
    const set2AfterC = await getSet2Count();
    check(set2AfterC === 0, `Set 2 did NOT open after 100/525 claims (count=${set2AfterC})`);
    const projDataC = await getProjData();
    check(projDataC?.totalSets === 1, `Project still totalSets=1 (got ${projDataC?.totalSets})`);
    console.log(`  Set2 count: ${set2AfterC}, totalSets: ${projDataC?.totalSets}`);
  }

  // ══ Summary ══════════════════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════");
  if (allPassed) {
    console.log("✅ ALL TESTS PASSED — full-size set logic correct\n");
  } else {
    console.error("❌ SOME TESTS FAILED — review output above\n");
  }
}

let skipCleanup = false;

main()
  .catch(e => { console.error("Script error:", e); skipCleanup = true; })
  .finally(async () => {
    if (skipCleanup) {
      console.error("\n⚠️  Cleanup SKIPPED — data preserved for inspection. Project ID:", TEST_PROJECT_ID);
    } else {
      await cleanup().catch(() => {});
    }
    process.exit(0);
  });
