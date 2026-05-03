#!/usr/bin/env node
"use strict";

/**
 * fix-hebrew-encoding-v2.js
 * Targeted fix for known corruptions where the first pass only stripped U+FFFD
 * but didn't restore the missing Hebrew letter.
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

// Known patterns that need proper restoration
const FIXES = [
  // "תרומת פרק X" should be "תרומות פרק X"
  { pattern: /^תרומת פרק (\d+)$/, replacement: "תרומות פרק $1" },
  // "עשרות פרק X" should be "מעשרות פרק X"
  { pattern: /^עשרות פרק (\d+)$/, replacement: "מעשרות פרק $1" },
  // "תהילים נופים" should be "תהילים נוספים"
  { pattern: /^תהילים נופים$/, replacement: "תהילים נוספים" },
];

async function main() {
  console.log("=== fix-hebrew-encoding-v2.js (targeted restore) ===\n");

  const snap = await db.collection("lzecher_portions").get();
  let fixed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const displayNameHebrew = data.displayNameHebrew;
    if (!displayNameHebrew) continue;

    for (const { pattern, replacement } of FIXES) {
      if (pattern.test(displayNameHebrew)) {
        const corrected = displayNameHebrew.replace(pattern, replacement);
        console.log(`  [FIX] ${doc.id}: "${displayNameHebrew}" → "${corrected}"`);
        await doc.ref.update({ displayNameHebrew: corrected });
        fixed++;
        break;
      }
    }
  }

  console.log(`\n✓ Fixed ${fixed} document(s) with proper Hebrew letters restored.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
