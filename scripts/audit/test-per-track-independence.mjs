#!/usr/bin/env node
/**
 * test-per-track-independence.mjs
 *
 * Verifies that Tehillim set 2 opens ONLY when Tehillim set 1 is full,
 * independent of Mishnayos state, and vice versa.
 *
 * Test sequence:
 *   A) Create project with BOTH mishnayos + tehillim
 *   B) Claim all 150 Tehillim → Tehillim set 2 must open, Mishnayos set 2 must NOT
 *   C) Claim all 525 Mishnayos → Mishnayos set 2 must open, Tehillim untouched (still 150+150)
 *
 * SAFETY: only touches lzecher_ collections. Scoped to TEST_PROJECT_ID. Cleans up on exit.
 *
 * Usage: npx dotenv-cli -e .env.local -- node scripts/audit/test-per-track-independence.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const BASE = process.env.TEST_BASE_URL || "https://lzecher.com";

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
let allPassed = true;
let skipCleanup = false;

function check(cond, label) {
  if (cond) { console.log(`  ✅ ${label}`); }
  else { console.error(`  ❌ FAIL: ${label}`); allPassed = false; }
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function claimSingle(portionId, name = "Test") {
  const res = await fetch(`${BASE}/api/claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portionId, projectId: TEST_PROJECT_ID, claimerName: name, locale: "en", duration: "oneTime", reminderPreferences: [] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claim failed: ${JSON.stringify(data)}`);
  return data;
}

async function claimMany(portionIds, name = "Bulk") {
  const res = await fetch(`${BASE}/api/claims/multi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portionIds, projectId: TEST_PROJECT_ID, claimerName: name, locale: "en", reminderPreferences: [] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Multi-claim failed: ${JSON.stringify(data)}`);
  return data;
}

// ── Firestore helpers ──────────────────────────────────────────────────────────

async function getPortionsByTrackAndSet(trackType, setNumber) {
  const snap = await db.collection("lzecher_portions")
    .where("projectId", "==", TEST_PROJECT_ID)
    .where("trackType", "==", trackType)
    .get();
  return snap.docs.filter(d => {
    const sn = d.data().setNumber;
    return ((sn === undefined || sn === null) ? 1 : sn) === setNumber;
  });
}

async function getAvailableCount(trackType, setNumber) {
  const docs = await getPortionsByTrackAndSet(trackType, setNumber);
  return docs.filter(d => d.data().status === "available").length;
}

async function getSetCount(trackType, setNumber) {
  const docs = await getPortionsByTrackAndSet(trackType, setNumber);
  return docs.length;
}

async function getProjData() {
  const snap = await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).get();
  return snap.data();
}

// ── Setup ──────────────────────────────────────────────────────────────────────

async function setup() {
  const { MASECHTOS, TEHILLIM } = await import("../../src/lib/seed-data.ts");

  const now = Date.now();
  const projRef = db.collection("lzecher_projects").doc();
  TEST_PROJECT_ID = projRef.id;

  await projRef.set({
    id: TEST_PROJECT_ID,
    nameHebrew: "בדיקת עצמאות מסלולים",
    nameEnglish: "Per-Track Independence Test",
    familyNameHebrew: "אוטו",
    honorific: "ז״ל",
    gender: "male",
    tracks: ["mishnayos", "tehillim"],
    slug: `test-per-track-${now.toString(36)}`,
    isPublic: false,
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

  const BATCH_CHUNK = 400;
  const items = [];

  // Mishnayos set 1 (setNumber=1 explicit)
  let order = 0;
  for (const m of MASECHTOS) {
    for (let p = 1; p <= m.perakim; p++) {
      order++;
      const ref = db.collection("lzecher_portions").doc();
      items.push({ ref, data: { id: ref.id, projectId: TEST_PROJECT_ID, trackType: "mishnayos", claimMode: "exclusive", reference: `${m.name} ${p}`, displayName: `${m.name} Ch${p}`, displayNameHebrew: `${m.nameHebrew} פרק ${p}`, order, status: "available", seder: m.seder, masechet: m.name, perek: p, setNumber: 1 } });
    }
  }

  // Tehillim set 1
  let tOrder = 10000;
  for (const mz of TEHILLIM) {
    tOrder++;
    const ref = db.collection("lzecher_portions").doc();
    items.push({ ref, data: { id: ref.id, projectId: TEST_PROJECT_ID, trackType: "tehillim", claimMode: "exclusive", reference: `Tehillim ${mz.number}`, displayName: `Psalm ${mz.number}`, displayNameHebrew: `תהילים ${mz.number}`, order: tOrder, status: "available", mizmor: mz.number, setNumber: 1 } });
  }

  for (let i = 0; i < items.length; i += BATCH_CHUNK) {
    const chunk = items.slice(i, i + BATCH_CHUNK);
    const batch = db.batch();
    for (const { ref, data } of chunk) batch.set(ref, data);
    await batch.commit();
  }
  await projRef.update({ totalPortions: items.length });
  console.log(`  Created project ${TEST_PROJECT_ID}: ${MASECHTOS.reduce((s,m)=>s+m.perakim,0)} Mishnayos + ${TEHILLIM.length} Tehillim`);
}

// ── Cleanup ────────────────────────────────────────────────────────────────────

async function cleanup() {
  if (!TEST_PROJECT_ID) return;
  console.log("\n[Cleanup] Deleting test project and all its data…");
  let total = 0;
  for (const col of ["lzecher_portions", "lzecher_claims"]) {
    const snap = await db.collection(col).where("projectId", "==", TEST_PROJECT_ID).get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    total += snap.size;
    console.log(`  Deleted ${snap.size} ${col} docs`);
  }
  await db.collection("lzecher_projects").doc(TEST_PROJECT_ID).delete();
  console.log(`  Deleted project doc. Total docs removed: ${total + 1}`);
  const verify = await db.collection("lzecher_portions").where("projectId", "==", TEST_PROJECT_ID).get();
  console.log(verify.empty ? "  ✅ Cleanup verified — no orphaned data" : `  ❌ ${verify.size} orphaned portions remain`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔬 PER-TRACK INDEPENDENCE TEST  (target: ${BASE})\n`);

  // Verify server is reachable
  const vr = await fetch(`${BASE}/api/version`).catch(() => null);
  if (!vr?.ok) { console.error("Cannot reach", BASE); process.exit(1); }
  const ver = await vr.json();
  console.log(`  Server: ${ver.deployment?.url || BASE}  commit=${ver.commit?.slice(0,8)}\n`);

  await setup();
  const { MASECHTOS, TEHILLIM } = await import("../../src/lib/seed-data.ts");

  // Verify initial counts
  const m1Docs = await getPortionsByTrackAndSet("mishnayos", 1);
  const t1Docs = await getPortionsByTrackAndSet("tehillim", 1);
  const expectedMish = MASECHTOS.reduce((s, m) => s + m.perakim, 0);
  check(m1Docs.length === expectedMish, `Mishnayos set 1 has ${expectedMish} portions (got ${m1Docs.length})`);
  check(t1Docs.length === TEHILLIM.length, `Tehillim set 1 has ${TEHILLIM.length} portions (got ${t1Docs.length})`);

  // ══ PHASE 1: Fill ALL 150 Tehillim → Tehillim set 2 opens, Mishnayos untouched ═════

  console.log("\n═══ PHASE 1: Claim all 150 Tehillim (Mishnayos UNTOUCHED) ═══");
  const t1Ids = t1Docs.map(d => d.id);

  // Claim first 149 in batches of 50
  const first149 = t1Ids.slice(0, 149);
  for (let i = 0; i < first149.length; i += 50) {
    await claimMany(first149.slice(i, i + 50), `Testers${i}`);
  }
  await new Promise(r => setTimeout(r, 1200));

  const t2AfterP1a = await getSetCount("tehillim", 2);
  const m2AfterP1a = await getSetCount("mishnayos", 2);
  check(t2AfterP1a === 0, `After 149/150 Tehillim: Tehillim set 2 NOT open (got ${t2AfterP1a})`);
  check(m2AfterP1a === 0, `After 149/150 Tehillim: Mishnayos set 2 NOT open (got ${m2AfterP1a})`);
  console.log(`  Mishnayos set 1 available: ${await getAvailableCount("mishnayos", 1)} (should be ${expectedMish})`);

  // Claim the 150th Tehillim
  console.log(`  Claiming last Tehillim (id=${t1Ids[149].slice(0,8)}…)`);
  const r1 = await claimSingle(t1Ids[149], "LastTehillimClaimer");
  console.log(`  API response: newSetOpened=${r1.newSetOpened} newSetNumber=${r1.newSetNumber}`);
  check(r1.newSetOpened === true, `API newSetOpened=true after 150th Tehillim`);
  check(r1.newSetNumber === 2,    `API newSetNumber=2`);

  await new Promise(r => setTimeout(r, 1500));

  const t2Count = await getSetCount("tehillim", 2);
  const m2AfterP1b = await getSetCount("mishnayos", 2);
  const mishAvail = await getAvailableCount("mishnayos", 1);
  const projP1 = await getProjData();

  check(t2Count === TEHILLIM.length, `Tehillim set 2 seeded with ${TEHILLIM.length} portions (got ${t2Count})`);
  check(m2AfterP1b === 0, `Mishnayos set 2 still NOT open after Tehillim completes (got ${m2AfterP1b})`);
  check(mishAvail === expectedMish, `All ${expectedMish} Mishnayos set 1 still available (got ${mishAvail})`);
  console.log(`  totalSets=${projP1?.totalSets}  totalPortions=${projP1?.totalPortions}`);

  // ══ PHASE 2: Fill ALL 525 Mishnayos → Mishnayos set 2 opens, Tehillim unaffected ════

  console.log("\n═══ PHASE 2: Claim all 525 Mishnayos (Tehillim already done) ═══");
  const m1Ids = m1Docs.map(d => d.id);
  const first524 = m1Ids.slice(0, 524);
  for (let i = 0; i < first524.length; i += 150) {
    await claimMany(first524.slice(i, i + 150), `MishBatch${i}`);
  }
  await new Promise(r => setTimeout(r, 1200));

  const m2After524 = await getSetCount("mishnayos", 2);
  const t2After524 = await getSetCount("tehillim", 2);
  check(m2After524 === 0, `After 524/525 Mishnayos: Mishnayos set 2 NOT open (got ${m2After524})`);
  check(t2After524 === TEHILLIM.length, `Tehillim set 2 still intact (got ${t2After524}, expected ${TEHILLIM.length})`);

  // Claim the 525th
  console.log(`  Claiming last Mishnayos (id=${m1Ids[524].slice(0,8)}…)`);
  const r2 = await claimSingle(m1Ids[524], "LastMishnahClaimer");
  console.log(`  API response: newSetOpened=${r2.newSetOpened} newSetNumber=${r2.newSetNumber}`);
  check(r2.newSetOpened === true, `API newSetOpened=true after 525th Mishnayos`);
  check(r2.newSetNumber === 2,    `API newSetNumber=2`);

  await new Promise(r => setTimeout(r, 1500));

  const m2Final = await getSetCount("mishnayos", 2);
  const t2Final = await getSetCount("tehillim", 2);
  const t3Final = await getSetCount("tehillim", 3);
  const projFinal = await getProjData();

  check(m2Final === expectedMish, `Mishnayos set 2 seeded with ${expectedMish} portions (got ${m2Final})`);
  check(t2Final === TEHILLIM.length, `Tehillim set 2 unchanged (${TEHILLIM.length} portions, got ${t2Final})`);
  check(t3Final === 0, `Tehillim set 3 NOT opened (Mishnayos completing Mishnayos only) (got ${t3Final})`);
  console.log(`  Final: totalSets=${projFinal?.totalSets}  totalPortions=${projFinal?.totalPortions}`);

  // ══ Summary ═══════════════════════════════════════════════════════════════════
  console.log("\n════════════════════════════════════════");
  if (allPassed) {
    console.log("✅ ALL TESTS PASSED — per-track set opening is fully independent\n");
  } else {
    console.error("❌ SOME TESTS FAILED — review output above\n");
    skipCleanup = true;
  }
}

main()
  .catch(e => { console.error("Script error:", e); skipCleanup = true; })
  .finally(async () => {
    if (skipCleanup) {
      console.warn(`\n⚠️  Cleanup SKIPPED. Inspect project: ${TEST_PROJECT_ID}`);
    } else {
      await cleanup().catch(e => console.error("Cleanup error:", e));
    }
    process.exit(allPassed ? 0 : 1);
  });
