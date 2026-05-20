/**
 * WIPE TEST PROJECTS — operational maintenance script.
 *
 * Safety rules (READ BEFORE USE):
 *  1. Defaults to --dry-run. You MUST pass --execute to actually delete.
 *  2. --execute requires typing a confirmation phrase via stdin.
 *  3. ONLY touches collections prefixed with `lzecher_`.
 *  4. PRESERVES: lzecher_users, lzecher_mitzvot_templates, lzecher_admin_audit,
 *     lzecher_mussar_structure.
 *  5. NEVER touches Firebase Auth users (those stay; only the user-doc references
 *     to projects are affected by deleting lzecher_projects).
 *  6. Deletes Firebase Storage files under lzecher/photos/* and lzecher/og/*
 *     when --execute is passed; otherwise lists what would be deleted.
 *  7. Writes an audit log to scripts/maintenance/wipe-log-<timestamp>.txt.
 *
 * Usage:
 *   node scripts/maintenance/wipe-test-projects.js --dry-run
 *   node scripts/maintenance/wipe-test-projects.js --execute
 */
const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config({ path: path.join(__dirname, "..", "..", ".env.local") });

const COLLECTIONS_TO_WIPE = [
  "lzecher_projects",
  "lzecher_portions",
  "lzecher_claims",
  "lzecher_reports",
  "lzecher_feedback",
  "lzecher_scheduled_emails",
];

const COLLECTIONS_TO_PRESERVE = [
  "lzecher_users",
  "lzecher_mitzvot_templates",
  "lzecher_admin_audit",
  "lzecher_mussar_structure",
];

const STORAGE_PREFIXES_TO_WIPE = ["lzecher/photos/", "lzecher/og/"];

const CONFIRMATION_PHRASE = "WIPE_ALL_LZECHER_PROJECTS";

function getArg(name) {
  return process.argv.includes(name);
}

const DRY_RUN = !getArg("--execute");
const STARTED_AT = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_PATH = path.join(__dirname, `wipe-log-${STARTED_AT}.txt`);
const logLines = [];
function log(...args) {
  const line = args.join(" ");
  console.log(line);
  logLines.push(line);
}

function flushLog() {
  fs.writeFileSync(LOG_PATH, logLines.join("\n"));
  console.log(`\nAudit log saved to: ${LOG_PATH}`);
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function deleteCollection(db, name) {
  const ref = db.collection(name);
  let totalDeleted = 0;
  while (true) {
    const snap = await ref.limit(400).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    totalDeleted += snap.size;
    log(`    deleted batch of ${snap.size} from ${name} (running total: ${totalDeleted})`);
  }
  return totalDeleted;
}

async function deleteStoragePrefix(bucket, prefix) {
  const [files] = await bucket.getFiles({ prefix });
  if (files.length === 0) return 0;
  let deleted = 0;
  for (const f of files) {
    await f.delete().catch(() => {});
    deleted++;
  }
  return deleted;
}

(async () => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
  const db = admin.firestore();

  log("=".repeat(78));
  log(`LZECHER WIPE TEST PROJECTS — ${STARTED_AT}`);
  log(`Mode: ${DRY_RUN ? "DRY-RUN (no deletions)" : "EXECUTE (will delete)"}`);
  log("=".repeat(78));

  log("\nCollections that WILL be wiped:");
  for (const c of COLLECTIONS_TO_WIPE) log(`  - ${c}`);

  log("\nCollections that will be PRESERVED:");
  for (const c of COLLECTIONS_TO_PRESERVE) log(`  - ${c}`);

  log("\nStorage prefixes that WILL be wiped:");
  for (const p of STORAGE_PREFIXES_TO_WIPE) log(`  - ${p}*`);

  log("\nCounting current contents...");
  const counts = {};
  for (const c of COLLECTIONS_TO_WIPE) {
    try {
      const snap = await db.collection(c).count().get();
      counts[c] = snap.data().count;
      log(`  ${c}: ${counts[c]} documents`);
    } catch (e) {
      log(`  ${c}: ERROR reading count — ${e.message}`);
      counts[c] = "?";
    }
  }

  log("\nPreserved collection counts (for context — NOT deleted):");
  for (const c of COLLECTIONS_TO_PRESERVE) {
    try {
      const snap = await db.collection(c).count().get();
      log(`  ${c}: ${snap.data().count} documents`);
    } catch (e) {
      log(`  ${c}: ERROR — ${e.message}`);
    }
  }

  // Storage
  let bucket = null;
  try {
    bucket = admin.storage().bucket();
    log("\nStorage file counts:");
    for (const p of STORAGE_PREFIXES_TO_WIPE) {
      const [files] = await bucket.getFiles({ prefix: p });
      log(`  ${p}*: ${files.length} files`);
    }
  } catch (e) {
    log(`\nStorage check failed (continuing): ${e.message}`);
  }

  if (DRY_RUN) {
    log("\n" + "=".repeat(78));
    log("DRY-RUN COMPLETE — nothing was deleted.");
    log(`To actually wipe, run: node ${path.relative(process.cwd(), __filename)} --execute`);
    log("=".repeat(78));
    flushLog();
    process.exit(0);
  }

  // Execute path — require typed confirmation
  log("\n" + "!".repeat(78));
  log(`To proceed, type this confirmation phrase exactly: ${CONFIRMATION_PHRASE}`);
  log("!".repeat(78));
  const typed = (await ask("> ")).trim();
  if (typed !== CONFIRMATION_PHRASE) {
    log(`\nABORTED — typed "${typed}" did not match expected phrase. No deletions performed.`);
    flushLog();
    process.exit(2);
  }

  log("\nProceeding with deletion...");
  const deletedCounts = {};
  for (const c of COLLECTIONS_TO_WIPE) {
    log(`\nDeleting collection: ${c}`);
    try {
      deletedCounts[c] = await deleteCollection(db, c);
    } catch (e) {
      log(`  ERROR deleting ${c}: ${e.message}`);
      deletedCounts[c] = `ERROR: ${e.message}`;
    }
  }

  log("\nDeleting storage files...");
  const deletedStorage = {};
  if (bucket) {
    for (const p of STORAGE_PREFIXES_TO_WIPE) {
      try {
        deletedStorage[p] = await deleteStoragePrefix(bucket, p);
        log(`  ${p}*: ${deletedStorage[p]} files deleted`);
      } catch (e) {
        log(`  ${p}: ERROR — ${e.message}`);
      }
    }
  }

  log("\n" + "=".repeat(78));
  log("WIPE COMPLETE");
  log("=".repeat(78));
  log("Final tally:");
  for (const [c, n] of Object.entries(deletedCounts)) log(`  ${c}: ${n}`);
  for (const [p, n] of Object.entries(deletedStorage)) log(`  ${p}*: ${n} files`);

  flushLog();
  process.exit(0);
})().catch((e) => {
  log("\nFATAL ERROR:", e.message);
  console.error(e.stack);
  flushLog();
  process.exit(1);
});
