/**
 * backup-kabalos.mjs
 *
 * Run with:
 *   dotenv -e .env.local -- node scripts/backup-kabalos.mjs
 *
 * What this script does (READ-ONLY):
 *   1. Fetches ALL docs from lzecher_claims   WHERE trackType == "kabalos"
 *   2. Fetches ALL docs from lzecher_portions WHERE trackType == "kabalos"
 *   3. Writes both sets to scripts/backups/kabalos-backup-<timestamp>.json
 *
 * No data is modified. This is a pure read + local file write.
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── SAFETY GUARD ─────────────────────────────────────────────────────────────
console.log("=".repeat(60));
console.log("BACKUP-KABALOS — READ-ONLY backup script");
console.log("Collections touched (READ ONLY):");
console.log("  lzecher_claims   (WHERE trackType == 'kabalos')");
console.log("  lzecher_portions (WHERE trackType == 'kabalos')");
console.log("Output: scripts/backups/kabalos-backup-<timestamp>.json");
console.log("NO DATA WILL BE MODIFIED.");
console.log("=".repeat(60));
console.log();

// ─── ENV VALIDATION ───────────────────────────────────────────────────────────
const REQUIRED_VARS = [
  "FIREBASE_ADMIN_PROJECT_ID",
  "FIREBASE_ADMIN_CLIENT_EMAIL",
  "FIREBASE_ADMIN_PRIVATE_KEY",
];

const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error("ERROR: Missing required environment variables:");
  missing.forEach((v) => console.error(`  - ${v}`));
  console.error(
    "\nRun this script with:  dotenv -e .env.local -- node scripts/backup-kabalos.mjs"
  );
  process.exit(1);
}

// ─── FIREBASE INIT ────────────────────────────────────────────────────────────
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n");

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Serialize a Firestore document to a plain JS object.
 * Converts Timestamps to ISO strings and DocumentReferences to path strings.
 */
function serializeDoc(doc) {
  const raw = doc.data();
  return { id: doc.id, ...serializeValue(raw) };
}

function serializeValue(val) {
  if (val === null || val === undefined) return val;

  // Firestore Timestamp
  if (typeof val.toDate === "function") {
    return val.toDate().toISOString();
  }

  // Firestore DocumentReference
  if (val.path && val.firestore) {
    return `ref:${val.path}`;
  }

  if (Array.isArray(val)) {
    return val.map(serializeValue);
  }

  if (typeof val === "object") {
    const out = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = serializeValue(v);
    }
    return out;
  }

  return val;
}

/**
 * Fetch ALL documents from a collection matching a single field filter.
 * Uses a simple .get() (no cursor pagination needed — kabalos are rare).
 * Falls back to offset-based batching for very large result sets (>500).
 */
async function fetchAll(collectionName, field, value) {
  console.log(`  Querying ${collectionName} WHERE ${field} == "${value}" ...`);

  const col = db.collection(collectionName);
  const BATCH_SIZE = 500;
  const allDocs = [];
  let offset = 0;

  while (true) {
    const snap = await col
      .where(field, "==", value)
      .limit(BATCH_SIZE)
      .offset(offset)
      .get();

    if (snap.empty) break;

    snap.docs.forEach((doc) => allDocs.push(serializeDoc(doc)));
    console.log(
      `    Fetched batch: ${snap.size} docs (running total: ${allDocs.length})`
    );

    if (snap.size < BATCH_SIZE) break; // Last batch — no more pages
    offset += snap.size;
  }

  console.log(`  Done — ${allDocs.length} total docs from ${collectionName}`);
  return allDocs;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  try {
    // 1. Fetch kabalos claims
    console.log("─".repeat(60));
    console.log("Step 1: Fetching lzecher_claims (kabalos)");
    console.log("─".repeat(60));
    const claims = await fetchAll("lzecher_claims", "trackType", "kabalos");

    // 2. Fetch kabalos portions
    console.log();
    console.log("─".repeat(60));
    console.log("Step 2: Fetching lzecher_portions (kabalos)");
    console.log("─".repeat(60));
    const portions = await fetchAll("lzecher_portions", "trackType", "kabalos");

    // 3. Build backup payload
    const backup = {
      meta: {
        createdAt: new Date().toISOString(),
        projectId,
        filter: { field: "trackType", value: "kabalos" },
        totalClaims: claims.length,
        totalPortions: portions.length,
        scriptVersion: "1.0.0",
      },
      claims,
      portions,
    };

    // 4. Write to disk
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const backupsDir = join(__dirname, "backups");
    mkdirSync(backupsDir, { recursive: true });

    const filename = `kabalos-backup-${Date.now()}.json`;
    const outPath = join(backupsDir, filename);

    writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf8");

    // 5. Summary
    console.log();
    console.log("─".repeat(60));
    console.log("Backup complete.");
    console.log("─".repeat(60));
    console.log(`  Total claims backed up:   ${claims.length}`);
    console.log(`  Total portions backed up: ${portions.length}`);
    console.log(`  Backup file:              ${outPath}`);
    console.log("─".repeat(60));
  } catch (err) {
    console.error("\nFATAL ERROR:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
