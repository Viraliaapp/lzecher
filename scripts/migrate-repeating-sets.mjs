#!/usr/bin/env node
/**
 * migrate-repeating-sets.mjs
 *
 * Sets repeatingSetEnabled: true on all lzecher_projects that are missing
 * the field or have it set to false.
 *
 * Safety: ONLY touches lzecher_projects. No other collection.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- node scripts/migrate-repeating-sets.mjs
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* env vars. Run via: npx dotenv-cli -e .env.local -- node scripts/migrate-repeating-sets.mjs");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

async function main() {
  console.log("\n[migrate-repeating-sets] Fetching all lzecher_projects...\n");

  const snap = await db.collection("lzecher_projects").get();
  console.log(`Total lzecher_projects docs: ${snap.size}`);

  // Safety check: confirm all docs are in lzecher_projects (they are by definition)
  console.log("Collection: lzecher_projects ✓ (no other collections touched)");

  const toUpdate = snap.docs.filter(d => {
    const data = d.data();
    return data.repeatingSetEnabled === undefined ||
           data.repeatingSetEnabled === null ||
           data.repeatingSetEnabled === false;
  });

  const alreadyEnabled = snap.size - toUpdate.length;
  console.log(`  Already have repeatingSetEnabled: true — ${alreadyEnabled}`);
  console.log(`  Need update (missing or false) — ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log("\n✅ All projects already have repeatingSetEnabled: true. Nothing to do.\n");
    return;
  }

  console.log("\nProjects to update:");
  for (const d of toUpdate) {
    const data = d.data();
    console.log(`  ${d.id}  "${data.nameHebrew || "?"}"  repeatingSetEnabled=${data.repeatingSetEnabled}`);
  }

  // Batch write — max 500 ops per batch
  const BATCH_SIZE = 400;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { repeatingSetEnabled: true });
      updated++;
    }
    await batch.commit();
    console.log(`\n  Batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} docs).`);
  }

  // Verify
  const verifySnap = await db.collection("lzecher_projects").get();
  const stillMissing = verifySnap.docs.filter(d => {
    const data = d.data();
    return data.repeatingSetEnabled !== true;
  });

  if (stillMissing.length === 0) {
    console.log(`\n✅ Done. Updated ${updated} projects. All ${verifySnap.size} lzecher_projects now have repeatingSetEnabled: true.\n`);
  } else {
    console.error(`\n❌ ${stillMissing.length} projects still missing repeatingSetEnabled: true!`);
    for (const d of stillMissing) console.error(`  ${d.id} ${d.data().nameHebrew}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
