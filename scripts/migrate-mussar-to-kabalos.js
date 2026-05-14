/**
 * Migration: Merge Mussar track into Kabalos
 *
 * For each project where tracks[] includes 'mussar':
 *   - Remove 'mussar' from tracks
 *   - Add 'kabalos' if not already present
 *
 * Delete all portions where trackType === 'mussar'
 *
 * Run: node -e "require('dotenv').config({path:'.env.local'})" -e "" && node --require dotenv/config scripts/migrate-mussar-to-kabalos.js
 * Or:  node scripts/migrate-mussar-to-kabalos.js  (if env vars are already set)
 */

require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");

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

      await doc.ref.update({ tracks: newTracks });
      console.log(`  Project ${doc.id} (${data.nameHebrew}): removed 'mussar', tracks now: [${newTracks.join(", ")}]`);
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
    batch.delete(doc.ref);
    portionsDeleted++;
  }

  if (portionsDeleted > 0) {
    await batch.commit();
  }
  console.log(`${portionsDeleted} mussar portions deleted.\n`);

  // 3. Delete mussar inclusive claims
  let claimsDeleted = 0;
  const claimsSnap = await db
    .collection("lzecher_inclusive_claims")
    .where("trackType", "==", "mussar")
    .get();

  if (!claimsSnap.empty) {
    const claimsBatch = db.batch();
    for (const doc of claimsSnap.docs) {
      claimsBatch.delete(doc.ref);
      claimsDeleted++;
    }
    await claimsBatch.commit();
  }
  console.log(`${claimsDeleted} mussar inclusive claims deleted.\n`);

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
