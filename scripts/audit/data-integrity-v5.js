// Phase 4.4 + 4.5: Mussar removal + claimMode coverage
const admin = require("firebase-admin");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
  });
}
const db = admin.firestore();

const REPORT = [];
const log = (...a) => { console.log(...a); REPORT.push(a.join(" ")); };

(async () => {
  // 4.4 — Mussar migration verification
  log("\n=== Phase 4.4: Mussar removal ===");
  const projWithMussar = await db.collection("lzecher_projects").where("tracks", "array-contains", "mussar").get();
  log(`Projects with mussar in tracks: ${projWithMussar.size} (expected 0)`);
  if (projWithMussar.size > 0) {
    projWithMussar.forEach((d) => log(`  - ${d.id}: ${JSON.stringify(d.data().tracks)}`));
  }

  const portionsWithMussar = await db.collection("lzecher_portions").where("trackType", "==", "mussar").get();
  log(`Portions with trackType=mussar: ${portionsWithMussar.size} (expected 0)`);

  const mussarTemplates = await db.collection("lzecher_mitzvot_templates").where("id", "==", "mussar_daily").get();
  log(`mussar_daily template exists: ${mussarTemplates.size > 0 ? "YES" : "NO"}`);

  // 4.5 — claimMode coverage
  log("\n=== Phase 4.5: claimMode coverage ===");
  const allPortions = await db.collection("lzecher_portions").select("trackType", "claimMode").limit(2000).get();
  const stats = {};
  let missing = 0;
  allPortions.forEach((d) => {
    const data = d.data();
    const k = `${data.trackType}|${data.claimMode || "MISSING"}`;
    stats[k] = (stats[k] || 0) + 1;
    if (!data.claimMode) missing++;
  });
  log(`Total portions sampled: ${allPortions.size}`);
  log(`Portions missing claimMode: ${missing}`);
  log(`Breakdown by trackType|claimMode:`);
  Object.entries(stats).sort().forEach(([k, v]) => log(`  ${k}: ${v}`));

  // Quick collection counts
  log("\n=== Collection counts ===");
  for (const c of ["lzecher_projects", "lzecher_portions", "lzecher_claims", "lzecher_users", "lzecher_reports", "lzecher_feedback", "lzecher_mitzvot_templates", "lzecher_scheduled_emails"]) {
    try {
      const snap = await db.collection(c).count().get();
      log(`  ${c}: ${snap.data().count}`);
    } catch (e) {
      log(`  ${c}: ERROR ${e.message}`);
    }
  }

  // Sample one project doc to verify schema fields
  log("\n=== Sample lzecher_projects doc ===");
  const projSnap = await db.collection("lzecher_projects").limit(1).get();
  if (!projSnap.empty) {
    const data = projSnap.docs[0].data();
    log(`Fields present: ${Object.keys(data).sort().join(", ")}`);
  }

  fs.writeFileSync(path.join(__dirname, "..", "screenshots", "data-integrity.txt"), REPORT.join("\n"));
  process.exit(0);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
