/**
 * Migration: Merge Mussar track into Kabalos
 *
 * For each project where tracks[] includes 'mussar':
 *   - Remove 'mussar' from tracks
 *   - Add 'kabalos' if not already present
 *
 * Delete all portions where trackType === 'mussar'
 *
 * Defaults to dry-run. To execute:
 *   node scripts/migrate-mussar-to-kabalos.js --execute --confirm=MIGRATE_LZECHER_MUSSAR_TO_KABALOS
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

const CONFIRMATION_PHRASE = "MIGRATE_LZECHER_MUSSAR_TO_KABALOS";
const EXECUTE = process.argv.includes("--execute");
const CONFIRMED = process.argv.includes(`--confirm=${CONFIRMATION_PHRASE}`);
const LZECHER_COLLECTIONS = [
  "lzecher_projects",
  "lzecher_portions",
  "lzecher_inclusive_claims",
];

for (const collection of LZECHER_COLLECTIONS) {
  if (!collection.startsWith("lzecher_")) {
    console.error(`FATAL: collection "${collection}" is not Lzecher-scoped.`);
    process.exit(3);
  }
}

if (EXECUTE && !CONFIRMED) {
  console.error(`Refusing to write without --confirm=${CONFIRMATION_PHRASE}`);
  process.exit(2);
}

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : {
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || "sifttube-416a0",
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

async function migrate() {
  console.log("=== Mussar → Kabalos Migration ===\n");
  console.log(`Mode: ${EXECUTE ? "EXECUTE" : "DRY-RUN (no writes)"}`);
  console.log("Collections: " + LZECHER_COLLECTIONS.join(", ") + "\n");

  // 1. Find projects with 'mussar' in tracks
  let projectsMigrated = 0;
  const projectsSnap = await db.collection("lzecher_projects").get();

  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    const tracks = data.tracks || [];

    if (tracks.includes("mussar")) {
      const newTracks = tracks.filter(t => t !== "mussar");
      if (!newTracks.includes("kabalos")) {
        newTracks.push("kabalos");
      }

      if (EXECUTE) await doc.ref.update({ tracks: newTracks });
      console.log(`  ${EXECUTE ? "Updated" : "[dry-run] Would update"} project ${doc.id} (${data.nameHebrew}): tracks -> [${newTracks.join(", ")}]`);
      projectsMigrated++;
    }
  }

  console.log(`\n${projectsMigrated} projects migrated.\n`);

  // 2. Delete mussar portions
  let portionsDeleted = 0;
  const portionsSnap = await db
    .collection("lzecher_portions")
    .where("trackType", "==", "mussar")
    .get();

  const batch = db.batch();
  for (const doc of portionsSnap.docs) {
    if (EXECUTE) batch.delete(doc.ref);
    portionsDeleted++;
  }

  if (EXECUTE && portionsDeleted > 0) {
    await batch.commit();
  }
  console.log(`${portionsDeleted} mussar portions ${EXECUTE ? "deleted" : "would be deleted"}.\n`);

  // 3. Delete mussar inclusive claims
  let claimsDeleted = 0;
  const claimsSnap = await db
    .collection("lzecher_inclusive_claims")
    .where("trackType", "==", "mussar")
    .get();

  if (!claimsSnap.empty) {
    const claimsBatch = db.batch();
    for (const doc of claimsSnap.docs) {
      if (EXECUTE) claimsBatch.delete(doc.ref);
      claimsDeleted++;
    }
    if (EXECUTE) await claimsBatch.commit();
  }
  console.log(`${claimsDeleted} mussar inclusive claims ${EXECUTE ? "deleted" : "would be deleted"}.\n`);

  // 4. Verify
  const verifyProjects = await db.collection("lzecher_projects").get();
  let stillHasMussar = 0;
  for (const doc of verifyProjects.docs) {
    if ((doc.data().tracks || []).includes("mussar")) {
      stillHasMussar++;
    }
  }

  const verifyPortions = await db
    .collection("lzecher_portions")
    .where("trackType", "==", "mussar")
    .limit(1)
    .get();

  console.log("=== Post-Migration Verification ===");
  console.log(`Projects still with 'mussar': ${stillHasMussar}`);
  console.log(`Mussar portions remaining: ${verifyPortions.size}`);
  console.log(`\n=== Migration Complete ===`);
}

migrate().catch(console.error);
