#!/usr/bin/env node
/**
 * safe-purge-mark-complete.mjs
 *
 * SAFE-PURGE PROTOCOL for mark-complete data in lzecher_claims:
 *   Phase 1 — DRY-RUN: count docs with completed/completedAt/status=completed fields
 *   Phase 2 — BACKUP: export all lzecher_claims to JSON backup file
 *   Phase 3 — PURGE: remove completion-related fields from lzecher_claims only
 *   Phase 4 — VERIFY: re-count, confirm 0 completed fields remain
 *
 * SAFETY: ONLY touches lzecher_claims. No other collection is read or written.
 *
 * Usage:
 *   node scripts/safe-purge-mark-complete.mjs --dry-run   (Phase 1 only)
 *   node scripts/safe-purge-mark-complete.mjs --backup     (Phases 1+2)
 *   node scripts/safe-purge-mark-complete.mjs --purge      (Phases 1+2+3+4, requires backup first)
 *
 * Env: GOOGLE_APPLICATION_CREDENTIALS or ADC
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as fs from "fs";
import * as path from "path";

const mode = process.argv[2] || "--dry-run";
const BACKUP_DIR = path.join(process.cwd(), "scripts", "backups");

if (!getApps().length) {
  initializeApp(); // ADC — service account JSON picked up via env
}
const db = getFirestore();

function ts() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function dryRun() {
  console.log("\n[Phase 1 — DRY-RUN] Scanning lzecher_claims...\n");
  const snap = await db.collection("lzecher_claims").get();
  console.log(`Total lzecher_claims docs: ${snap.size}`);

  let statusCompleted = 0;
  let hasCompletedAt = 0;
  let hasCompletedField = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status === "completed") statusCompleted++;
    if (d.completedAt !== undefined) hasCompletedAt++;
    if (d.completed !== undefined) hasCompletedField++;
  }

  console.log(`  status=completed:        ${statusCompleted}`);
  console.log(`  has completedAt field:   ${hasCompletedAt}`);
  console.log(`  has completed field:     ${hasCompletedField}`);
  const total = new Set([
    ...snap.docs.filter(d => d.data().status === "completed").map(d => d.id),
    ...snap.docs.filter(d => d.data().completedAt !== undefined).map(d => d.id),
    ...snap.docs.filter(d => d.data().completed !== undefined).map(d => d.id),
  ]).size;
  console.log(`  total docs with any completion data: ${total}\n`);
  return { snap, total };
}

async function backup(snap) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = path.join(BACKUP_DIR, `lzecher_claims_backup_${ts()}.json`);
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  fs.writeFileSync(filename, JSON.stringify(docs, null, 2), "utf8");
  console.log(`[Phase 2 — BACKUP] Exported ${docs.length} docs to:\n  ${filename}\n`);
  return { filename, count: docs.length };
}

async function purge(snap) {
  const logFile = path.join(BACKUP_DIR, `purge_log_${ts()}.txt`);
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const logStream = fs.createWriteStream(logFile, { flags: "a" });
  const log = (msg) => { console.log(msg); logStream.write(msg + "\n"); };

  log(`\n[Phase 3 — PURGE] Removing completion fields from lzecher_claims...\n`);

  const toPurge = snap.docs.filter(d => {
    const data = d.data();
    return data.status === "completed" || data.completedAt !== undefined || data.completed !== undefined;
  });

  log(`Docs to purge: ${toPurge.length}`);

  if (toPurge.length === 0) {
    log("Nothing to purge.");
    logStream.end();
    return 0;
  }

  const BATCH_SIZE = 400;
  let purged = 0;

  for (let i = 0; i < toPurge.length; i += BATCH_SIZE) {
    const chunk = toPurge.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const doc of chunk) {
      const updates: Record<string, unknown> = {};
      const data = doc.data();
      if (data.status === "completed") updates.status = "active";
      if (data.completedAt !== undefined) updates.completedAt = FieldValue.delete();
      if (data.completed !== undefined) updates.completed = FieldValue.delete();
      batch.update(doc.ref, updates);
      log(`  PURGED ${doc.id} (${JSON.stringify(updates)})`);
      purged++;
    }
    await batch.commit();
    log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1} committed (${chunk.length} docs).`);
  }

  logStream.end();
  log(`\n[Phase 3] Purged ${purged} docs. Log at: ${logFile}\n`);
  return purged;
}

async function verify() {
  console.log("[Phase 4 — VERIFY] Re-scanning lzecher_claims...\n");
  const snap = await db.collection("lzecher_claims").get();
  let remaining = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.status === "completed" || d.completedAt !== undefined || d.completed !== undefined) {
      remaining++;
      console.log(`  Still has completion data: ${doc.id}`);
    }
  }
  if (remaining === 0) {
    console.log(`✅ VERIFY PASSED — 0 completion-related fields remain. Total claims: ${snap.size}\n`);
  } else {
    console.error(`❌ VERIFY FAILED — ${remaining} docs still have completion data.\n`);
    process.exit(1);
  }
}

async function main() {
  console.log(`\n🛡️  safe-purge-mark-complete — mode: ${mode}\n`);

  if (mode === "--dry-run") {
    await dryRun();
    console.log("DRY-RUN complete. No data modified. Run with --backup to proceed.\n");
    return;
  }

  if (mode === "--backup") {
    const { snap } = await dryRun();
    await backup(snap);
    console.log("BACKUP complete. Run with --purge to proceed.\n");
    return;
  }

  if (mode === "--purge") {
    const { snap } = await dryRun();

    // Require a backup file to exist before purging
    const backupFiles = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("lzecher_claims_backup_"))
      : [];
    if (backupFiles.length === 0) {
      console.error("❌ No backup file found in scripts/backups/. Run --backup first.\n");
      process.exit(1);
    }
    console.log(`Found backup: ${backupFiles[backupFiles.length - 1]}`);

    const purged = await purge(snap);
    if (purged > 0) {
      await verify();
    } else {
      console.log("Nothing was purged — nothing to verify.\n");
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
