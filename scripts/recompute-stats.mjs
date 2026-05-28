/**
 * Recomputes claimedPortions, completedPortions, totalPortions, progressPercent,
 * participantCount, and claimedByTrack for all lzecher_projects.
 *
 * participantCount = unique claimers per project (deduped by userId or name+email).
 *
 * Scope: lzecher_projects + lzecher_portions + lzecher_claims (read-only on claims).
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

  // Pre-load all claims once — used for participantCount deduplication
  console.log("Loading all lzecher_claims…");
  const allClaimsSnap = await db.collection("lzecher_claims").get();
  console.log(`  ${allClaimsSnap.size} claims loaded`);

  // Group claims by projectId
  const claimsByProject = new Map();
  for (const cd of allClaimsSnap.docs) {
    const pid = cd.data().projectId;
    if (!pid) continue;
    if (!claimsByProject.has(pid)) claimsByProject.set(pid, []);
    claimsByProject.get(pid).push(cd.data());
  }

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

      // Per-track claimed counts
      const claimedByTrack = {};
      for (const pd of portionsSnap.docs) {
        const d = pd.data();
        const tt = d.trackType || "unknown";
        if (!claimedByTrack[tt]) claimedByTrack[tt] = 0;
        if (d.claimMode === "inclusive") {
          claimedByTrack[tt] += (d.currentClaimerCount || 0);
        } else if (d.status !== "available") {
          claimedByTrack[tt] += 1;
        }
      }

      // Unique participant count — dedupe by userId (if not anonymous) or name+email
      const claims = claimsByProject.get(projId) || [];
      const participantKeys = new Set();
      for (const c of claims) {
        const key = (c.userId && c.userId !== "anonymous")
          ? c.userId
          : `${c.userName || ""}__${c.userEmail || ""}`;
        participantKeys.add(key);
      }
      const participantCount = participantKeys.size;

      const before = {
        totalPortions: projData.totalPortions,
        claimedPortions: projData.claimedPortions,
        completedPortions: projData.completedPortions,
        progressPercent: projData.progressPercent,
        participantCount: projData.participantCount,
      };
      const after = { totalPortions, claimedPortions, completedPortions, progressPercent, participantCount };

      const changed = JSON.stringify(before) !== JSON.stringify(after);
      const nameStr = `${projData.nameHebrew || ""} ${projData.familyNameHebrew || ""}`.trim() || projId;

      if (changed) {
        await projDoc.ref.update({ totalPortions, claimedPortions, completedPortions, progressPercent, participantCount, claimedByTrack, updatedAt: Date.now() });
        console.log(`  [UPDATED] ${nameStr} (${projId})`);
        console.log(`    before: total=${before.totalPortions} claimed=${before.claimedPortions} pct=${before.progressPercent}% participants=${before.participantCount}`);
        console.log(`    after:  total=${after.totalPortions}  claimed=${after.claimedPortions}  pct=${after.progressPercent}%  participants=${after.participantCount}`);
        updated++;
      } else {
        await projDoc.ref.update({ claimedByTrack, updatedAt: Date.now() });
        console.log(`  [ok] ${nameStr} — stats unchanged`);
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
