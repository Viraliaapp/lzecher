#!/usr/bin/env node
"use strict";

/**
 * cleanup-mitzvot.js
 * Removes non-approved mitzvot items from existing lzecher_portions documents.
 * Items to REMOVE: דף יומי, משנה יומית, תפילה במניין, אהבת ישראל, תהילים נוספים, התחייבות מעשר
 * Only the 12 approved mitzvot should remain.
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

// IDs of mitzvot templates that should NOT exist (removed from the approved list)
const REMOVED_IDS = [
  "limud-daf-yomi",
  "limud-mishnah-yomis",
  "tefillah-daven-minyan",
  "middot-ahavas-yisrael",
  "tefillah-extra-tehillim",
  "tzedakah-maaser",
];

// Hebrew titles to match against (in case IDs don't match)
const REMOVED_HEBREW_TITLES = [
  "דף יומי",
  "משנה יומית",
  "תפילה במניין",
  "אהבת ישראל",
  "תהילים נוספים",
  "התחייבות מעשר",
];

async function main() {
  console.log("=== cleanup-mitzvot.js ===\n");
  console.log("Removing non-approved mitzvot from lzecher_portions...\n");

  const snap = await db.collection("lzecher_portions")
    .where("trackType", "==", "mitzvot")
    .get();

  console.log(`Found ${snap.size} mitzvot portions total.\n`);

  let deleted = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const ref = data.reference || "";
    const displayHebrew = data.displayNameHebrew || "";

    // Check if this is a removed item
    const shouldRemove =
      REMOVED_IDS.includes(data.reference?.replace(/\s/g, "-").toLowerCase() || "") ||
      REMOVED_HEBREW_TITLES.includes(displayHebrew) ||
      REMOVED_IDS.some((id) => ref.toLowerCase().includes(id.replace(/-/g, " ").replace("limud ", "").replace("tefillah ", "").replace("middot ", "").replace("tzedakah ", "")));

    // More direct check by matching known English titles
    const removedEnglishTitles = [
      "Learn Daf Yomi", "Daf Yomi",
      "Mishnah Yomis",
      "Daven with a Minyan",
      "Ahavas Yisrael",
      "Extra Tehillim",
      "Maaser Commitment",
    ];

    const shouldRemoveByTitle = removedEnglishTitles.some(
      (t) => ref === t || data.displayName === t
    );

    if (shouldRemove || shouldRemoveByTitle || REMOVED_HEBREW_TITLES.includes(displayHebrew)) {
      console.log(`  [DELETE] ${doc.id}: "${data.displayName}" / "${displayHebrew}"`);
      await doc.ref.delete();
      deleted++;
    }
  }

  // Update project totalPortions counts
  console.log("\nUpdating project totalPortions counts...");
  const projects = await db.collection("lzecher_projects").get();
  for (const proj of projects.docs) {
    const portionsSnap = await db.collection("lzecher_portions")
      .where("projectId", "==", proj.id)
      .get();
    const total = portionsSnap.size;
    const claimed = portionsSnap.docs.filter((d) => d.data().status !== "available").length;
    const completed = portionsSnap.docs.filter((d) => d.data().status === "completed").length;

    if (total !== proj.data().totalPortions) {
      await proj.ref.update({ totalPortions: total, claimedPortions: claimed, completedPortions: completed });
      console.log(`  Updated project ${proj.id}: totalPortions ${proj.data().totalPortions} → ${total}`);
    }
  }

  console.log(`\n✓ Deleted ${deleted} non-approved mitzvot portion(s).`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
