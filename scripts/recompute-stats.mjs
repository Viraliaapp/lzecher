/**
 * Recomputes claimedPortions, completedPortions, totalPortions, progressPercent
 * for all lzecher_projects from actual portion data.
 *
 * Scope: lzecher_projects + lzecher_portions only. Read-only on claims.
 * Safe to run multiple times (idempotent).
 *
 * Usage: node scripts/recompute-stats.mjs
 */
// Usage: npx dotenv-cli -e .env.local -- node scripts/recompute-stats.mjs
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase credentials. Run with: npx dotenv-cli -e .env.local -- node scripts/recompute-stats.mjs");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}
const db = getFirestore();

async function run() {
  console.log("=== recompute-stats: START ===");
  console.log("Project:", projectId);

  // Fetch all projects
  const projectsSnap = await db.collection("lzecher_projects").get();
  console.log(`Found ${projectsSnap.size} projects`);

  let updated = 0, skipped = 0, errors = 0;

  for (const projDoc of projectsSnap.docs) {
    const projId = projDoc.id;
    const projData = projDoc.data();

    try {
      // Fetch all portions for this project
      const portionsSnap = await db
        .collection("lzecher_portions")
        .where("projectId", "==", projId)
        .get();

      const totalPortions = portionsSnap.size;
      const claimedPortions = portionsSnap.docs.filter(
        (d) => d.data().status !== "available"
      ).length;
      const completedPortions = portionsSnap.docs.filter(
        (d) => d.data().status === "completed"
      ).length;
      const progressPercent =
        totalPortions > 0 ? Math.round((claimedPortions / totalPortions) * 100) : 0;

      const before = {
        totalPortions: projData.totalPortions,
        claimedPortions: projData.claimedPortions,
        completedPortions: projData.completedPortions,
        progressPercent: projData.progressPercent,
      };
      const after = { totalPortions, claimedPortions, completedPortions, progressPercent };

      const changed = JSON.stringify(before) !== JSON.stringify(after);
      const nameStr = `${projData.nameHebrew || ""} ${projData.familyNameHebrew || ""}`.trim() || projId;

      if (changed) {
        await projDoc.ref.update({ totalPortions, claimedPortions, completedPortions, progressPercent, updatedAt: Date.now() });
        console.log(`  [UPDATED] ${nameStr} (${projId})`);
        console.log(`    before: total=${before.totalPortions} claimed=${before.claimedPortions} pct=${before.progressPercent}%`);
        console.log(`    after:  total=${after.totalPortions}  claimed=${after.claimedPortions}  pct=${after.progressPercent}%`);
        updated++;
      } else {
        console.log(`  [ok] ${nameStr} — no change (claimed=${claimedPortions}/${totalPortions} = ${progressPercent}%)`);
        skipped++;
      }
    } catch (err) {
      console.error(`  [ERROR] ${projId}:`, err.message);
      errors++;
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Updated: ${updated} | Unchanged: ${skipped} | Errors: ${errors}`);
  console.log("=== recompute-stats: DONE ===");
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
