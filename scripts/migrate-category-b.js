#!/usr/bin/env node
"use strict";

/**
 * migrate-category-b.js
 * Migration script for Category B architectural changes:
 * 1. Rename 'mitzvot' → 'kabalos' in project tracks arrays
 * 2. Rename trackType 'mitzvot' → 'kabalos' in portions and claims
 * 3. Add claimMode field to all existing portions
 * 4. Add default duration fields to existing claims
 */

require("dotenv").config({ path: ".env.local" });

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
});
const db = getFirestore(app);

// Track claim modes
const CLAIM_MODES = {
  mishnayos: "exclusive",
  tehillim: "exclusive",
  shnayim_mikra: "inclusive",
  mussar: "inclusive",
  kabalos: "inclusive",
  mitzvot: "inclusive", // old name, same mode
  daf_yomi: "inclusive",
};

async function main() {
  console.log("=== Category B Migration ===\n");
  let projectsUpdated = 0;
  let portionsUpdated = 0;
  let claimsUpdated = 0;

  // 1. Update projects: rename 'mitzvot' → 'kabalos' in tracks array
  console.log("── Phase 1: Update project tracks ──");
  const projectsSnap = await db.collection("lzecher_projects").get();
  for (const doc of projectsSnap.docs) {
    const data = doc.data();
    if (data.tracks && data.tracks.includes("mitzvot")) {
      const newTracks = data.tracks.map((t) => (t === "mitzvot" ? "kabalos" : t));
      await doc.ref.update({ tracks: newTracks });
      console.log(`  [PROJECT] ${doc.id}: tracks updated (mitzvot → kabalos)`);
      projectsUpdated++;
    }
  }
  console.log(`  Updated ${projectsUpdated} project(s).\n`);

  // 2. Update portions: rename trackType + add claimMode
  console.log("── Phase 2: Update portions ──");
  const portionsSnap = await db.collection("lzecher_portions").get();
  for (const doc of portionsSnap.docs) {
    const data = doc.data();
    const updates = {};

    // Rename trackType
    if (data.trackType === "mitzvot") {
      updates.trackType = "kabalos";
    }

    // Add claimMode if missing
    if (!data.claimMode) {
      const trackType = updates.trackType || data.trackType;
      updates.claimMode = CLAIM_MODES[trackType] || "exclusive";
    }

    // Add currentClaimerCount for inclusive portions
    const effectiveMode = updates.claimMode || data.claimMode;
    if (effectiveMode === "inclusive" && data.currentClaimerCount === undefined) {
      updates.currentClaimerCount = 0;
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      portionsUpdated++;
    }
  }
  console.log(`  Updated ${portionsUpdated} portion(s).\n`);

  // 3. Update claims: rename trackType + add duration defaults
  console.log("── Phase 3: Update claims ──");
  const claimsSnap = await db.collection("lzecher_claims").get();
  for (const doc of claimsSnap.docs) {
    const data = doc.data();
    const updates = {};

    if (data.trackType === "mitzvot") {
      updates.trackType = "kabalos";
    }

    // Add duration fields if missing (default to oneTime for old claims)
    if (!data.duration) {
      updates.duration = "oneTime";
    }

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
      claimsUpdated++;
    }
  }
  console.log(`  Updated ${claimsUpdated} claim(s).\n`);

  console.log("══════════════════════════════════════");
  console.log("MIGRATION SUMMARY");
  console.log("══════════════════════════════════════");
  console.log(`  Projects updated:  ${projectsUpdated}`);
  console.log(`  Portions updated:  ${portionsUpdated}`);
  console.log(`  Claims updated:    ${claimsUpdated}`);
  console.log("══════════════════════════════════════");
  console.log("\n✓ Migration complete.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
