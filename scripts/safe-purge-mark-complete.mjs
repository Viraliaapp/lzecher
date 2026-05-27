#!/usr/bin/env node
/**
 * safe-purge-mark-complete.mjs
 *
 * SAFE-PURGE PROTOCOL for mark-complete data in lzecher_claims:
 *   Phase 1 — DRY-RUN: count docs with completed/completedAt/status=completed fields
 *   Phase 2 — BACKUP: export all lzecher_claims to JSON backup file
 *   Phase 3 — PURGE: remove completion-related fields from lzecher_claims only
 *   Phase 4 — VERIFY: re-count, confirm 0 completed fields remain, doc count unchanged
 *
 * SAFETY: ONLY touches lzecher_claims. No other collection is read or written.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- node scripts/safe-purge-mark-complete.mjs --dry-run
 *   npx dotenv-cli -e .env.local -- node scripts/safe-purge-mark-complete.mjs --backup
 *   npx dotenv-cli -e .env.local -- node scripts/safe-purge-mark-complete.mjs --purge
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, "backups");

const mode = process.argv[2] || "--dry-run";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* env vars. Run via: npx dotenv-cli -e .env.local -- node scripts/safe-purge-mark-complete.mjs [--dry-run|--backup|--purge]");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore();

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function hasCompletionData(d) {
  return d.status === "completed" || d.completedAt !== undefined || d.completed !== undefined;
}

async function dryRun() {
  console.log("\n[Phase 1 — DRY-RUN] Scanning lzecher_claims...\n");
  const snap = await db.collection("lzecher_claims").get();
  console.log(`Total lzecher_claims docs: ${snap.size}`);
  console.log("Collection: lzecher_claims ✓ (no other collections touched)\n");

  let statusCompleted = 0;
  let hasCompletedAt = 0;
  let hasCompletedField = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status === "completed") statusCompleted++;
    if (d.completedAt !== undefined) hasCompletedAt++;
    if (d.completed !== undefined) hasCompletedField++;
  }

  const toPurgeCount = snap.docs.filter(d => hasCompletionData(d.data())).length;

  console.log(`  status === "completed":   ${statusCompleted}`);
  console.log(`  has completedAt field:    ${hasCompletedAt}`);
  console.log(`  has completed field:      ${hasCompletedField}`);
  console.log(`  total docs to purge:      ${toPurgeCount}\n`);

  return { snap, toPurgeCount };
}

async function backup(snap) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = path.join(BACKUP_DIR, `lzecher_claims_backup_${ts()}.json`);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  fs.writeFileSync(filename, JSON.stringify(docs, null, 2), "utf8");
  const stat = fs.statSync(filename);
  console.log(`[Phase 2 — BACKUP]`);
  console.log(`  File: ${filename}`);
  console.log(`  Size: ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`  Docs: ${docs.length}\n`);
  return { filename, count: docs.length };
}

async function purge(snap) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const logFile = path.join(BACKUP_DIR, `purge_log_${ts()}.txt`);
  const lines = [];
  const log = (msg) => { console.log(msg); lines.push(msg); };

  log(`[Phase 3 — PURGE] Removing completion fields from lzecher_claims...\n`);
  log(`Collection: lzecher_claims ONLY ✓\n`);

  const toPurge = snap.docs.filter(d => hasCompletionData(d.data()));
  log(`Docs to purge: ${toPurge.length}`);

  if (toPurge.length === 0) {
    log("Nothing to purge.");
    fs.writeFileSync(logFile, lines.join("\n"), "utf8");
    return 0;
  }

  const BATCH_SIZE = 400;
  let purged = 0;

  for (let i = 0; i < toPurge.length; i += BATCH_SIZE) {
    const chunk = toPurge.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      const data = doc.data();
      const updates = {};
      if (data.status === "completed") updates.status = "active";
      if (data.completedAt !== undefined) updates.completedAt = FieldValue.delete();
      if (data.completed !== undefined) updates.completed = FieldValue.delete();
      batch.update(doc.ref, updates);
      log(`  PURGE ${doc.id}  ops: ${JSON.stringify(Object.keys(updates))}`);
      purged++;
    }
    await batch.commit();
    log(`\n  ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} docs).`);
  }

  fs.writeFileSync(logFile, lines.join("\n"), "utf8");
  log(`\n[Phase 3] Purged ${purged} docs. Log saved to: ${logFile}\n`);
  return purged;
}

async function verify(expectedCount) {
  console.log("[Phase 4 — VERIFY] Re-scanning lzecher_claims...\n");
  const snap = await db.collection("lzecher_claims").get();

  let remaining = 0;
  for (const doc of snap.docs) {
    if (hasCompletionData(doc.data())) {
      remaining++;
      console.error(`  ❌ Still has completion data: ${doc.id}`);
    }
  }

  const countMatch = snap.size === expectedCount;
  console.log(`  Total docs before: ${expectedCount}`);
  console.log(`  Total docs after:  ${snap.size}  ${countMatch ? "✓ unchanged" : "❌ MISMATCH"}`);
  console.log(`  Completion fields remaining: ${remaining}`);

  if (remaining === 0 && countMatch) {
    console.log(`\n✅ VERIFY PASSED — 0 completion fields remain, doc count unchanged (${snap.size}).\n`);
  } else {
    console.error(`\n❌ VERIFY FAILED.\n`);
    process.exit(1);
  }
}

async function main() {
  console.log(`\n🛡️  safe-purge-mark-complete  mode=${mode}  project=${projectId}\n`);

  if (mode === "--dry-run") {
    await dryRun();
    console.log("DRY-RUN complete. No data modified.\nRun with --backup to proceed.\n");
    return;
  }

  if (mode === "--backup") {
    const { snap } = await dryRun();
    await backup(snap);
    console.log("BACKUP complete. Run with --purge to proceed.\n");
    return;
  }

  if (mode === "--purge") {
    const { snap, toPurgeCount } = await dryRun();
    const totalBefore = snap.size;

    // Require a backup file
    const backupFiles = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("lzecher_claims_backup_"))
      : [];
    if (backupFiles.length === 0) {
      console.error("❌ No backup file found. Run --backup first.\n");
      process.exit(1);
    }
    console.log(`Found backup: ${backupFiles[backupFiles.length - 1]}\n`);

    if (toPurgeCount === 0) {
      console.log("Nothing to purge. Done.\n");
      return;
    }

    const purged = await purge(snap);
    if (purged > 0) {
      await verify(totalBefore);
    }
    return;
  }

  console.error(`Unknown mode: ${mode}\nUsage: node safe-purge-mark-complete.mjs [--dry-run|--backup|--purge]\n`);
  process.exit(1);
}

main().catch(err => {
  console.error("Script error:", err);
  process.exit(1);
});
