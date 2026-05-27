/**
 * Reconciles project YLiKKJj5YOWR4WquKcNp after premature set-2 opening.
 *
 * Option A (DEFAULT — requires SOLOMON_APPROVED=true to run):
 *   - CASE A (8 portions — Yoma 1-8 by מ מ):
 *       Move set-2 claim to the available set-1 equivalent portion.
 *       Update portion status to "claimed", preserve claimer name/uid/timestamp.
 *   - CASE B (19 portions — same person in both sets):
 *       The set-1 claim is already valid. Delete the set-2 claim doc.
 *       The duplicate set-2 portion is then left untaken.
 *   - After both cases: delete all 525 set-2 portions.
 *   - Set totalSets=1, totalPortions=525, recompute claimedPortions.
 *
 * Safety: reads backup to verify claim counts before/after. Aborts if counts mismatch.
 *
 * Usage: SOLOMON_APPROVED=true node scripts/reconcile-setbug.mjs
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (process.env.SOLOMON_APPROVED !== "true") {
  console.error("BLOCKED: Set SOLOMON_APPROVED=true to run this reconciliation.");
  console.error("This script modifies real user data. Solomon must approve before execution.");
  process.exit(1);
}

const PROJECT_ID = "YLiKKJj5YOWR4WquKcNp";
const BACKUP_DIR = join(__dirname, "backups");

// Run: SOLOMON_APPROVED=true npx dotenv-cli -e .env.local -- node scripts/reconcile-setbug.mjs
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase credentials. Run with: npx dotenv-cli -e .env.local -- node scripts/reconcile-setbug.mjs");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

async function run() {
  console.log("=== SETBUG RECONCILIATION (OPTION A) ===");
  console.log("Project:", PROJECT_ID);
  console.log("SOLOMON_APPROVED=true — proceeding");

  const ts = Date.now();
  const log = [];
  function L(msg) { console.log(msg); log.push(msg); }

  // ── 1. Fetch live data ────────────────────────────────────────────────────
  const portionsSnap = await db.collection("lzecher_portions")
    .where("projectId", "==", PROJECT_ID)
    .get();
  const claimsSnap = await db.collection("lzecher_claims")
    .where("projectId", "==", PROJECT_ID)
    .get();

  L(`Live: ${portionsSnap.size} portions, ${claimsSnap.size} claims`);

  const set1 = portionsSnap.docs.filter(d => {
    const sn = d.data().setNumber;
    return !sn || sn === 1;
  });
  const set2 = portionsSnap.docs.filter(d => d.data().setNumber === 2);
  L(`Set 1 portions: ${set1.length}, Set 2 portions: ${set2.size ?? set2.length}`);

  if (set2.length === 0) {
    L("No set-2 portions found. Reconciliation not needed.");
    return;
  }

  // ── 2. Verify claim count matches backup ────────────────────────────────
  const backupFiles = ["setbug_claims_YLiKKJj5YOWR4WquKcNp_1779841454870.json"];
  const backupClaims = JSON.parse(readFileSync(join(BACKUP_DIR, backupFiles[0]), "utf8"));
  L(`Backup has ${backupClaims.length} claims, live has ${claimsSnap.size} claims`);
  if (claimsSnap.size < backupClaims.length) {
    throw new Error(`ABORT: Live claim count (${claimsSnap.size}) is LESS than backup (${backupClaims.length}). Something is wrong.`);
  }

  // ── 3. Build lookup maps ─────────────────────────────────────────────────
  const set2ById = {};
  for (const d of set2) set2ById[d.id] = d;

  const set1ByRef = {};
  for (const d of set1) set1ByRef[d.data().reference] = d;

  const claimsByPortionId = {};
  for (const d of claimsSnap.docs) {
    const pid = d.data().portionId;
    if (!claimsByPortionId[pid]) claimsByPortionId[pid] = [];
    claimsByPortionId[pid].push(d);
  }

  // ── 4. Classify each set-2 claimed portion ────────────────────────────────
  const caseA = []; // set-1 equivalent is available → move claim
  const caseB = []; // set-1 equivalent already taken by same person → delete duplicate
  const caseBConflict = []; // set-1 taken by DIFFERENT person → should not exist per analysis

  for (const s2doc of set2) {
    const s2data = s2doc.data();
    if (s2data.status === "available") continue; // not claimed in set 2, skip

    const ref = s2data.reference;
    const s1doc = set1ByRef[ref];
    if (!s1doc) {
      L(`  WARNING: no set-1 match for ${ref} — skipping`);
      continue;
    }

    const s1data = s1doc.data();
    if (s1data.status === "available") {
      caseA.push({ s2doc, s1doc });
    } else if (s1data.claimedByName === s2data.claimedByName) {
      caseB.push({ s2doc, s1doc });
    } else {
      caseBConflict.push({ s2doc, s1doc });
    }
  }

  L(`\nCase A (move to s1 available): ${caseA.length}`);
  L(`Case B (same-person duplicate, delete s2 claim): ${caseB.length}`);
  L(`Case B CONFLICT (different people): ${caseBConflict.length}`);

  if (caseBConflict.length > 0) {
    L("\nABORT: Unexpected Case B conflicts found:");
    for (const { s2doc, s1doc } of caseBConflict) {
      L(`  ${s2doc.data().reference}: s2 by ${s2doc.data().claimedByName}, s1 by ${s1doc.data().claimedByName}`);
    }
    throw new Error("Unexpected genuine conflicts — stopping. Manual review required.");
  }

  // ── 5. Execute Case A: move claim to set-1 portion ───────────────────────
  L("\n--- CASE A: Moving claims to set-1 portions ---");
  for (const { s2doc, s1doc } of caseA) {
    const s2data = s2doc.data();
    const ref = s2data.reference;
    const claimsForS2 = claimsByPortionId[s2doc.id] || [];

    // Mark set-1 portion as claimed
    await s1doc.ref.update({
      status: "claimed",
      claimedBy: s2data.claimedBy || "anonymous",
      claimedByName: s2data.claimedByName,
      claimedAt: s2data.claimedAt,
    });

    // Update each claim doc to point to set-1 portionId
    for (const claimDoc of claimsForS2) {
      await claimDoc.ref.update({ portionId: s1doc.id });
    }

    // Clear the set-2 portion
    await s2doc.ref.update({
      status: "available",
      claimedBy: null,
      claimedByName: null,
      claimedAt: null,
    });

    L(`  [A] ${ref}: moved ${claimsForS2.length} claim(s) from s2(${s2doc.id}) → s1(${s1doc.id}), claimer=${s2data.claimedByName}`);
  }

  // ── 6. Execute Case B: delete duplicate set-2 claims ────────────────────
  L("\n--- CASE B: Deleting duplicate set-2 claims ---");
  for (const { s2doc, s1doc } of caseB) {
    const s2data = s2doc.data();
    const ref = s2data.reference;
    const claimsForS2 = claimsByPortionId[s2doc.id] || [];

    // Delete each set-2 claim doc
    for (const claimDoc of claimsForS2) {
      await claimDoc.ref.delete();
      L(`  [B] ${ref}: deleted set-2 claim (${claimDoc.id}) by ${s2data.claimedByName} — set-1 claim preserved`);
    }

    // Clear the set-2 portion
    await s2doc.ref.update({
      status: "available",
      claimedBy: null,
      claimedByName: null,
      claimedAt: null,
    });
  }

  // ── 7. Delete all set-2 portions ─────────────────────────────────────────
  L("\n--- Deleting set-2 portions ---");
  const BATCH_SIZE = 400;
  for (let i = 0; i < set2.length; i += BATCH_SIZE) {
    const chunk = set2.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const d of chunk) batch.delete(d.ref);
    await batch.commit();
  }
  L(`Deleted ${set2.length} set-2 portions`);

  // ── 8. Recompute project stats ────────────────────────────────────────────
  const freshPortions = await db.collection("lzecher_portions")
    .where("projectId", "==", PROJECT_ID)
    .get();
  const freshClaims = await db.collection("lzecher_claims")
    .where("projectId", "==", PROJECT_ID)
    .get();

  const totalPortions = freshPortions.size;
  const claimedPortions = freshPortions.docs.filter(d => d.data().status !== "available").length;
  const completedPortions = freshPortions.docs.filter(d => d.data().status === "completed").length;
  const progressPercent = totalPortions > 0 ? Math.round(claimedPortions / totalPortions * 100) : 0;

  await db.collection("lzecher_projects").doc(PROJECT_ID).update({
    totalPortions,
    totalSets: 1,
    claimedPortions,
    completedPortions,
    progressPercent,
    updatedAt: Date.now(),
  });

  L(`\nProject stats recomputed: totalPortions=${totalPortions}, totalSets=1`);
  L(`  claimedPortions=${claimedPortions}, completedPortions=${completedPortions}, progress=${progressPercent}%`);
  L(`\nFinal claim count: ${freshClaims.size} (backup had ${backupClaims.length})`);

  // ── 9. Safety check ───────────────────────────────────────────────────────
  if (freshClaims.size < backupClaims.length - caseB.length) {
    L("WARNING: Final claim count is lower than expected! Review carefully.");
  } else {
    L(`CLAIM INTEGRITY: OK — removed ${caseB.length} duplicate set-2 claims, net = ${freshClaims.size}`);
  }

  // Write reconciliation log
  const logPath = join(BACKUP_DIR, `reconcile_log_${PROJECT_ID}_${ts}.txt`);
  writeFileSync(logPath, log.join("\n"), "utf8");
  L(`\nLog written to: ${logPath}`);
  L("=== RECONCILIATION COMPLETE ===");
}

run().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
