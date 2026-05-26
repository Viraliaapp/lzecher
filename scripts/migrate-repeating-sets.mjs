#!/usr/bin/env node
/**
 * migrate-repeating-sets.mjs
 *
 * Sets repeatingSetEnabled: true on all lzecher_projects that are missing the
 * field or have it set to false.
 *
 * Safety: only touches lzecher_projects. No other collections.
 *
 * Usage:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/sa.json node scripts/migrate-repeating-sets.mjs
 *   OR with firebase-admin already configured in the environment.
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!getApps().length) {
  const sa = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (sa) {
    const { default: serviceAccount } = await import(sa, { assert: { type: "json" } }).catch(() => ({ default: null }));
    if (serviceAccount) {
      initializeApp({ credential: cert(serviceAccount) });
    } else {
      initializeApp(); // ADC
    }
  } else {
    initializeApp(); // ADC
  }
}

const db = getFirestore();

async function main() {
  console.log("\n[migrate-repeating-sets] Fetching all lzecher_projects...\n");

  const snap = await db.collection("lzecher_projects").get();
  console.log(`Found ${snap.size} projects total.`);

  const toUpdate = snap.docs.filter(d => {
    const data = d.data();
    return data.repeatingSetEnabled === undefined || data.repeatingSetEnabled === null || data.repeatingSetEnabled === false;
  });

  console.log(`Projects needing update: ${toUpdate.length}`);

  if (toUpdate.length === 0) {
    console.log("\nAll projects already have repeatingSetEnabled: true. Nothing to do.\n");
    return;
  }

  // Batch write — max 500 ops per batch
  const BATCH_SIZE = 400;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      batch.update(doc.ref, { repeatingSetEnabled: true });
      console.log(`  Setting repeatingSetEnabled: true on ${doc.id} (${doc.data().nameHebrew || "unknown"})`);
      updated++;
    }
    await batch.commit();
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} docs).`);
  }

  console.log(`\n✅ Done. Updated ${updated} projects.\n`);
}

main().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
