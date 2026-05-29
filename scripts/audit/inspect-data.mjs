/** READ-ONLY audit of lzecher_ data for Prompt C sections 1,2,4. */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

const projSnap = await db.collection("lzecher_projects").get();
console.log("=== KABALOS per project (Section 1) ===");
for (const d of projSnap.docs) {
  const p = d.data();
  if (!(p.tracks || []).includes("kabalos")) continue;
  const kab = await db.collection("lzecher_portions").where("projectId", "==", d.id).where("trackType", "==", "kabalos").get();
  const refs = kab.docs.map((x) => x.data().displayNameHebrew || x.data().reference);
  const freeText = kab.docs.filter((x) => x.data().isFreeText).length;
  console.log(`  ${p.nameHebrew} [${p.slug}]: ${kab.size} kabalos, ${freeText} free-text`);
  console.log(`    ${refs.join(" | ")}`);
}

console.log("\n=== Projects with COMPLETED portions (Section 2 green bar) ===");
for (const d of projSnap.docs) {
  const p = d.data();
  if ((p.completedPortions || 0) > 0) console.log(`  ${p.nameHebrew} [${p.slug}]: completed=${p.completedPortions} completedPct=${p.completedProgressPct} progressPct=${p.progressPct}`);
}

console.log("\n=== Stat accuracy spot-check (Section 4): participantCount vs unique claimers ===");
const claimsSnap = await db.collection("lzecher_claims").get();
const byProj = new Map();
for (const c of claimsSnap.docs) {
  const x = c.data();
  if (!x.projectId || x.isParent) continue;
  if (!byProj.has(x.projectId)) byProj.set(x.projectId, new Set());
  const key = x.userId && x.userId !== "anonymous" ? x.userId : `${x.userName || ""}__${x.userEmail || ""}`;
  byProj.get(x.projectId).add(key);
}
for (const d of projSnap.docs) {
  const p = d.data();
  const unique = (byProj.get(d.id) || new Set()).size;
  const stored = p.participantCount || 0;
  const ok = unique === stored ? "ok" : "DIFF";
  if (unique > 0 || stored > 0) console.log(`  [${ok}] ${p.nameHebrew} [${p.slug}]: stored=${stored} unique=${unique}`);
}
process.exit(0);
