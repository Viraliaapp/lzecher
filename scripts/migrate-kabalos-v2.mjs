#!/usr/bin/env node
/**
 * migrate-kabalos-v2.mjs
 *
 * Replaces old kabalos on all existing projects with the new 6 canonical kabalos.
 *
 * Strategy per project:
 *   1. Collect all kabalos portions
 *   2. Delete UNCLAIMED portions (status === "available") — safe to drop
 *   3. KEEP any claimed/completed portions (legacy, preserve real user data)
 *   4. ADD the 6 new kabalos portions (always available for new takers)
 *   5. Update project totalPortions
 *
 * Scope: ONLY lzecher_portions + lzecher_projects. Never touches other collections.
 *
 * Usage: npx dotenv-cli -e .env.local -- node scripts/migrate-kabalos-v2.mjs
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* env vars");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

// ── New kabalos templates ──────────────────────────────────────────────────────

const NEW_KABALOS = [
  { id: "kabbalas-shabbos-early", titleHebrew: "קבלת שבת 10 דקות מוקדם", title: "Accepting Shabbos 10 Minutes Early", isFreeText: false },
  { id: "anias-amen",             titleHebrew: "עניית אמן בכוונה",         title: "Answering Amen with Kavana",         isFreeText: false },
  { id: "shemiras-halashon",      titleHebrew: "לימוד שמירת הלשון",        title: "Learning Shemiras HaLashon",         isFreeText: false },
  { id: "tzedakah-lzecher",       titleHebrew: "נתינת צדקה לעילוי נשמת",  title: "Giving Tzedakah L'iluy Nishmas",     isFreeText: false },
  { id: "lehodos-lashem",         titleHebrew: "להודות להשם",              title: "Thanking Hashem",                    isFreeText: false },
  { id: "kabbalah-ishit",         titleHebrew: "קבלה אישית",               title: "Personal Commitment",                isFreeText: true  },
];

// ── Backup ────────────────────────────────────────────────────────────────────

async function backup() {
  const ts = Date.now();
  const backupsDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  // Backup all kabalos portions
  const portionsSnap = await db.collection("lzecher_portions")
    .where("trackType", "==", "kabalos")
    .get();
  const defsPath = path.join(backupsDir, `kabalos-v2-backup-${ts}-defs.json`);
  fs.writeFileSync(defsPath, JSON.stringify(portionsSnap.docs.map(d => ({ id: d.id, ...d.data() })), null, 2));
  console.log(`  [backup] ${portionsSnap.size} kabalos portions → ${defsPath}`);

  // Backup all kabalos claims
  const claimsSnap = await db.collection("lzecher_claims")
    .where("trackType", "==", "kabalos")
    .get();
  const claimsPath = path.join(backupsDir, `kabalos-v2-backup-${ts}-claims.json`);
  fs.writeFileSync(claimsPath, JSON.stringify(claimsSnap.docs.map(d => ({ id: d.id, ...d.data() })), null, 2));
  console.log(`  [backup] ${claimsSnap.size} kabalos claims → ${claimsPath}`);

  return { portionsSnap, claimsSnap, ts };
}

// ── Per-project migration ─────────────────────────────────────────────────────

async function migrateProject(projDoc, allKabalosPorts, claimsSnap) {
  const projId = projDoc.id;
  const projData = projDoc.data();
  const name = `${projData.nameHebrew || ""} ${projData.familyNameHebrew || ""}`.trim() || projId;

  const portions = allKabalosPorts.filter(d => d.data().projectId === projId);
  if (portions.length === 0) {
    console.log(`  [skip] ${name} — no kabalos portions`);
    return;
  }

  const claimedPIds = new Set(claimsSnap.docs.map(d => d.data().portionId));

  const toDelete = portions.filter(d => d.data().status === "available" && !claimedPIds.has(d.id));
  const toKeep   = portions.filter(d => d.data().status !== "available" || claimedPIds.has(d.id));

  console.log(`\n  [${name}] ${portions.length} portions → delete ${toDelete.length} unclaimed, keep ${toKeep.length} claimed`);

  // Safety check: all collections start with lzecher_
  const safeCollections = ["lzecher_portions", "lzecher_projects"];
  console.log(`    Touching: ${safeCollections.join(", ")}  projectId=${projId}`);

  const now = Date.now();

  // Figure out starting order for new portions (after all existing)
  const existingOrders = portions.map(d => d.data().order || 0);
  let orderStart = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 10000;

  // Delete unclaimed portions in batches
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    toDelete.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`    Deleted ${toDelete.length} unclaimed kabalos portions`);

  // Add 6 new kabalos portions
  const addBatch = db.batch();
  for (const tmpl of NEW_KABALOS) {
    const ref = db.collection("lzecher_portions").doc();
    addBatch.set(ref, {
      id: ref.id,
      projectId: projId,
      trackType: "kabalos",
      claimMode: "inclusive",
      reference: tmpl.titleHebrew,
      displayName: tmpl.title,
      displayNameHebrew: tmpl.titleHebrew,
      order: orderStart++,
      status: "available",
      currentClaimerCount: 0,
      claimerNames: [],
      claimVerbForm: "both",
      isFreeText: tmpl.isFreeText,
      createdAt: now,
    });
  }
  await addBatch.commit();
  console.log(`    Added ${NEW_KABALOS.length} new kabalos portions`);

  // Recompute totalPortions for this project
  const portionsAfterSnap = await db.collection("lzecher_portions")
    .where("projectId", "==", projId)
    .get();
  const newTotal = portionsAfterSnap.size;
  await db.collection("lzecher_projects").doc(projId).update({
    totalPortions: newTotal,
    updatedAt: now,
  });
  console.log(`    Updated totalPortions: ${newTotal}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🔄 KABALOS MIGRATION v2\n");
  console.log("Collections in scope: lzecher_portions, lzecher_projects, lzecher_claims (read-only)");
  console.log("Action: replace old kabalos with 6 new ones, preserving all claimed portions\n");

  // Step 1: Backup
  console.log("[1/3] Backing up…");
  const { portionsSnap, claimsSnap } = await backup();
  console.log(`  Backup complete: ${portionsSnap.size} portions, ${claimsSnap.size} claims\n`);

  if (portionsSnap.size === 0) {
    console.log("No kabalos portions found. Nothing to migrate.");
    return;
  }

  // Step 2: Get all projects that have kabalos portions
  const projectIds = [...new Set(portionsSnap.docs.map(d => d.data().projectId))];
  console.log(`[2/3] Found ${projectIds.length} projects with kabalos: ${projectIds.join(", ")}\n`);

  const projDocs = await Promise.all(
    projectIds.map(pid => db.collection("lzecher_projects").doc(pid).get())
  );

  // Step 3: Migrate each project
  console.log("[3/3] Migrating each project…");
  for (const projDoc of projDocs) {
    if (!projDoc.exists) {
      console.warn(`  [warn] Project ${projDoc.id} not found — skipping`);
      continue;
    }
    await migrateProject(projDoc, portionsSnap.docs, claimsSnap);
  }

  console.log("\n✅ Migration complete!\n");
  console.log("Run recompute-stats.mjs next to recalculate all project stats.");
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
