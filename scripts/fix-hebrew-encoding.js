#!/usr/bin/env node
"use strict";

/**
 * fix-hebrew-encoding.js
 *
 * Scans Firestore collections that may contain Hebrew text for U+FFFD
 * (Unicode replacement character) corruption and attempts to fix them using
 * known-good values from seed-data.ts mappings.
 *
 * Collections scanned:
 *   lzecher_projects, lzecher_portions, lzecher_mitzvot_templates, lzecher_mussar_structure
 *
 * Known corruption:
 *   "תהילים נו\uFFFDפים"  →  "תהילים נוספים"
 *   (titleHebrew for the "Extra Tehillim" mitzvah template, id: tefillah-extra-tehillim)
 */

require("dotenv").config({ path: ".env.local" });

const admin = require("firebase-admin");

// ── Firebase Admin init ──────────────────────────────────────────────────────

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
  : undefined;

if (!projectId) {
  console.error(
    "[ERROR] FIREBASE_ADMIN_PROJECT_ID or FIREBASE_PROJECT_ID is required."
  );
  process.exit(1);
}

const appConfig = { projectId };
if (clientEmail && privateKey) {
  appConfig.credential = admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  });
}

admin.initializeApp(appConfig);
const db = admin.firestore();

// ── Seed-data correction map ─────────────────────────────────────────────────
//
// Maps a corrupted string → correct string, keyed by field for clarity.
// Source of truth: src/lib/seed-data.ts  (MITZVAH_TEMPLATES array).
//
// Add additional known corruptions here if discovered.

const CORRECTIONS = [
  // tefillah-extra-tehillim: titleHebrew
  {
    corrupted: "תהילים נו\uFFFDפים",
    correct: "תהילים נוספים",
    note: "titleHebrew for Extra Tehillim (tefillah-extra-tehillim)",
  },
];

/**
 * Build a lookup: corrupted string → correct string.
 */
const CORRECTION_MAP = new Map(
  CORRECTIONS.map((c) => [c.corrupted, c.correct])
);

// ── Mitzvah Templates: full known-good data from seed-data.ts ────────────────
// Used as a fallback: if a document's `id` matches a template we know, we can
// restore every Hebrew field from here.

const MITZVAH_TEMPLATES = [
  { id: "chesed-visit-sick",         titleHebrew: "ביקור חולים",               descriptionHebrew: "לבקר חולה ולהביא לו נחמה ותמיכה" },
  { id: "chesed-hachnasas-orchim",   titleHebrew: "הכנסת אורחים",              descriptionHebrew: "לארח אורחים לסעודת שבת או יום טוב" },
  { id: "tefillah-daven-minyan",     titleHebrew: "תפילה במניין",              descriptionHebrew: "להתחייב להתפלל במניין לתקופה מסוימת" },
  { id: "tefillah-extra-tehillim",   titleHebrew: "תהילים נוספים",             descriptionHebrew: "לומר פרקי תהילים נוספים כל יום" },
  { id: "tzedakah-daily",            titleHebrew: "צדקה יומית",                descriptionHebrew: "לתת צדקה בכל יום חול לתקופה מסוימת" },
  { id: "tzedakah-maaser",           titleHebrew: "התחייבות מעשר",             descriptionHebrew: "להתחייב לתת מעשר מהכנסות לתקופה מסוימת" },
  { id: "limud-daf-yomi",            titleHebrew: "דף יומי",                   descriptionHebrew: "ללמוד דף גמרא ביום לעילוי נשמת הנפטר" },
  { id: "limud-mishnah-yomis",       titleHebrew: "משנה יומית",                descriptionHebrew: "ללמוד משנה יומית לעילוי נשמת הנפטר" },
  { id: "middot-shemiras-halashon",  titleHebrew: "שמירת הלשון",               descriptionHebrew: "התחזקות בשמירת הלשון לעילוי נשמתם. הימנעות מלשון הרע, רכילות ומוציא שם רע. רבים מקבלים על עצמם שעות מסוימות ביום או לימוד יומי מספר חפץ חיים." },
  { id: "middot-ahavas-yisrael",     titleHebrew: "אהבת ישראל",                descriptionHebrew: "לעשות מעשי חסד יומיים כלפי יהודים אחרים" },
  { id: "middot-hakaras-hatov",      titleHebrew: "הכרת הטוב יומית להשם",      descriptionHebrew: "מדי יום, להודות להשם בכוונה על דבר אחד ספציפי בחיים. ההכרה בברכות היומיומיות — בריאות, משפחה, פרנסה, החסדים הקטנים — מעלה את הנשמה." },
];

const MITZVAH_BY_ID = new Map(MITZVAH_TEMPLATES.map((t) => [t.id, t]));

// ── Helpers ──────────────────────────────────────────────────────────────────

const REPLACEMENT_CHAR = "\uFFFD";

/**
 * Returns true if any string field in an object (shallowly) contains U+FFFD.
 */
function objectHasCorruption(data) {
  for (const val of Object.values(data)) {
    if (typeof val === "string" && val.includes(REPLACEMENT_CHAR)) return true;
  }
  return false;
}

/**
 * Attempt to produce a corrected value for a corrupted field.
 * Strategy:
 *   1. Direct lookup in CORRECTION_MAP.
 *   2. If the document has an `id` matching a known mitzvah template,
 *      use the seed-data Hebrew value for the matching field.
 *   3. Otherwise fall back to a generic U+FFFD strip (lossy but better than nothing).
 *
 * Returns the corrected string, or null if no fix could be found.
 */
function attemptFix(fieldName, corruptedValue, docData) {
  // 1. Direct correction map hit
  if (CORRECTION_MAP.has(corruptedValue)) {
    return CORRECTION_MAP.get(corruptedValue);
  }

  // 2. Template-based correction
  const templateId = docData.id || docData.templateId;
  if (templateId && MITZVAH_BY_ID.has(templateId)) {
    const template = MITZVAH_BY_ID.get(templateId);
    if (template[fieldName] !== undefined) {
      return template[fieldName];
    }
  }

  // 3. Lossy fallback: strip replacement chars
  const stripped = corruptedValue.replace(/\uFFFD/g, "");
  console.warn(
    `    [WARN] No exact fix found for field "${fieldName}". Stripped U+FFFD → "${stripped}"`
  );
  return stripped || null;
}

// ── Collection scanner ────────────────────────────────────────────────────────

/**
 * Scan a single Firestore collection for corrupted documents.
 * Returns a summary object.
 */
async function scanCollection(collectionName) {
  console.log(`\n── Scanning collection: ${collectionName} ──`);

  const summary = {
    collection: collectionName,
    docsScanned: 0,
    docsCorrupted: 0,
    fieldsFixed: 0,
    fieldsFailed: 0,
    errors: [],
  };

  let snapshot;
  try {
    snapshot = await db.collection(collectionName).get();
  } catch (err) {
    const msg = `Failed to read collection ${collectionName}: ${err.message}`;
    console.error(`  [ERROR] ${msg}`);
    summary.errors.push(msg);
    return summary;
  }

  if (snapshot.empty) {
    console.log("  (empty collection — nothing to scan)");
    return summary;
  }

  for (const doc of snapshot.docs) {
    summary.docsScanned++;
    const data = doc.data();

    if (!objectHasCorruption(data)) continue;

    summary.docsCorrupted++;
    console.log(`\n  [CORRUPTED] doc id: ${doc.id}`);

    const updates = {};

    for (const [field, value] of Object.entries(data)) {
      if (typeof value !== "string" || !value.includes(REPLACEMENT_CHAR)) {
        continue;
      }

      console.log(`    Field: "${field}"`);
      console.log(`      Corrupted: ${value}`);

      const fixed = attemptFix(field, value, data);

      if (fixed !== null && fixed !== value) {
        console.log(`      Fixed:     ${fixed}`);
        updates[field] = fixed;
        summary.fieldsFixed++;
      } else if (fixed === null) {
        console.error(`      [FAIL] Could not determine correct value. Skipping field.`);
        summary.fieldsFailed++;
      } else {
        // fixed === value means the "fix" is identical (shouldn't normally happen
        // unless the correction map entry is wrong)
        console.warn(`      [WARN] Fixed value is same as corrupted value. Skipping.`);
        summary.fieldsFailed++;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await doc.ref.update(updates);
        console.log(`    → Updated ${Object.keys(updates).length} field(s) in doc ${doc.id}`);
      } catch (err) {
        const msg = `Failed to update doc ${doc.id}: ${err.message}`;
        console.error(`    [ERROR] ${msg}`);
        summary.errors.push(msg);
        // Reverse the counted fixes for this doc since the update failed
        summary.fieldsFixed -= Object.keys(updates).length;
        summary.fieldsFailed += Object.keys(updates).length;
      }
    }
  }

  if (summary.docsCorrupted === 0) {
    console.log("  ✓ No corruption found.");
  }

  return summary;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const COLLECTIONS = [
  "lzecher_projects",
  "lzecher_portions",
  "lzecher_mitzvot_templates",
  "lzecher_mussar_structure",
];

async function main() {
  console.log("=== fix-hebrew-encoding.js ===");
  console.log(`Project: ${projectId}`);
  console.log(`Scanning ${COLLECTIONS.length} collection(s) for U+FFFD corruption...\n`);

  const summaries = [];

  for (const col of COLLECTIONS) {
    const summary = await scanCollection(col);
    summaries.push(summary);
  }

  // ── Print summary ────────────────────────────────────────────────────────
  console.log("\n\n══════════════════════════════════════");
  console.log("SUMMARY");
  console.log("══════════════════════════════════════");

  let totalScanned = 0;
  let totalCorrupted = 0;
  let totalFixed = 0;
  let totalFailed = 0;

  for (const s of summaries) {
    console.log(`\n  ${s.collection}`);
    console.log(`    Docs scanned:   ${s.docsScanned}`);
    console.log(`    Docs corrupted: ${s.docsCorrupted}`);
    console.log(`    Fields fixed:   ${s.fieldsFixed}`);
    if (s.fieldsFailed > 0) {
      console.log(`    Fields failed:  ${s.fieldsFailed}`);
    }
    if (s.errors.length > 0) {
      console.log(`    Errors:`);
      for (const e of s.errors) console.log(`      - ${e}`);
    }
    totalScanned   += s.docsScanned;
    totalCorrupted += s.docsCorrupted;
    totalFixed     += s.fieldsFixed;
    totalFailed    += s.fieldsFailed;
  }

  console.log("\n──────────────────────────────────────");
  console.log(`  Total docs scanned:   ${totalScanned}`);
  console.log(`  Total docs corrupted: ${totalCorrupted}`);
  console.log(`  Total fields fixed:   ${totalFixed}`);
  if (totalFailed > 0) {
    console.log(`  Total fields failed:  ${totalFailed}`);
  }
  console.log("══════════════════════════════════════");

  if (totalCorrupted === 0) {
    console.log("\n✓ No corruption found. Database is clean.");
  } else if (totalFailed === 0) {
    console.log(`\n✓ All ${totalFixed} corrupted field(s) fixed successfully.`);
  } else {
    console.log(
      `\n⚠ Fixed ${totalFixed} field(s), but ${totalFailed} field(s) could not be fixed automatically.`
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("\n[FATAL]", err);
  process.exit(1);
});
