/**
 * PROMPT A migration. Scope: lzecher_projects + lzecher_portions (read) ONLY.
 * Touches NOTHING outside lzecher_. Writes only to lzecher_projects docs.
 *
 *  1. Backfills the canonical progress fields used by BOTH the card and the hero
 *     (progressPct, completedProgressPct, completedCycles) using the EXACT same
 *     definition as src/lib/progress.ts — fixes the recurring card-vs-hero drift.
 *     Also refreshes totalPortions/claimedPortions/completedPortions/totalSets/claimedByTrack.
 *  2. Sets safe defaults for the new optional fields (password/startedBy/lock/etc.)
 *     ONLY when absent — never overwrites existing values.
 *  3. Reports any project that was previously "private" (isPublic === false) so
 *     Solomon can decide whether to set a password (they are left OPEN by default,
 *     never silently exposed beyond card-level info).
 *
 * DRY-RUN by default (reads + prints, writes nothing). Pass --apply to write.
 * Backs up all lzecher_projects docs to scripts/backups/ before any write.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- node scripts/migrate-prompt-a.mjs           (dry-run)
 *   npx dotenv-cli -e .env.local -- node scripts/migrate-prompt-a.mjs --apply   (writes)
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdirSync, writeFileSync } from "fs";

const APPLY = process.argv.includes("--apply");
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing creds. Run with: npx dotenv-cli -e .env.local -- node scripts/migrate-prompt-a.mjs");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

// ── EXACT port of src/lib/recompute-progress.ts computeTopMatmidim() ─────────
function computeTopMatmidim(portions) {
  const counts = new Map();
  const bump = (raw) => {
    const name = (raw || "").trim();
    if (!name || name.toLowerCase() === "anonymous") return;
    counts.set(name, (counts.get(name) || 0) + 1);
  };
  for (const p of portions) {
    if (p.claimMode === "inclusive") for (const n of p.claimerNames || []) bump(n);
    else if (p.status !== "available") bump(p.claimedByName);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
}

// ── EXACT port of src/lib/progress.ts computeProgress() ──────────────────────
function computeProgress(portions) {
  const isTM = (t) => t === "mishnayos" || t === "tehillim";
  const setOf = (p) => (p.setNumber === undefined || p.setNumber === null ? 1 : p.setNumber);
  const tm = portions.filter((p) => isTM(p.trackType));
  if (tm.length === 0) return { pct: 0, completedPct: 0, cycles: 0 };
  const maxSet = Math.max(...tm.map(setOf));
  let fullSets = 0, currentSet = maxSet, foundActive = false;
  for (let s = 1; s <= maxSet; s++) {
    const sp = tm.filter((p) => setOf(p) === s);
    if (sp.length === 0) continue;
    const taken = sp.filter((p) => p.status !== "available").length;
    if (taken === sp.length) fullSets++;
    else if (!foundActive) { currentSet = s; foundActive = true; }
  }
  const cycles = foundActive ? fullSets : Math.max(0, fullSets - 1);
  const cs = tm.filter((p) => setOf(p) === currentSet);
  const csLen = cs.length;
  const csTaken = cs.filter((p) => p.status !== "available").length;
  const csCompleted = cs.filter((p) => p.status === "completed").length;
  return {
    pct: csLen > 0 ? Math.round((csTaken / csLen) * 100) : 0,
    completedPct: csLen > 0 ? Math.round((csCompleted / csLen) * 100) : 0,
    cycles,
  };
}

async function run() {
  console.log(`=== migrate-prompt-a: ${APPLY ? "APPLY (writing)" : "DRY-RUN (no writes)"} ===`);
  console.log("Project:", projectId, "\nScope: lzecher_projects, lzecher_portions (read)\n");

  const projSnap = await db.collection("lzecher_projects").get();
  console.log(`Found ${projSnap.size} lzecher_projects\n`);

  // Pre-load all claims once for authoritative participantCount (dedup by uid or name+email).
  const allClaims = await db.collection("lzecher_claims").get();
  const participantsByProject = new Map();
  for (const cd of allClaims.docs) {
    const c = cd.data();
    if (!c.projectId || c.isParent === true) continue;
    const key = c.userId && c.userId !== "anonymous" ? `u:${c.userId}` : `n:${(c.userName || "").trim()}__${(c.userEmail || "").trim()}`;
    if (key === "n:__") continue;
    if (!participantsByProject.has(c.projectId)) participantsByProject.set(c.projectId, new Set());
    participantsByProject.get(c.projectId).add(key);
  }

  // Backup (always, even dry-run, so we have a snapshot)
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  mkdirSync("scripts/backups", { recursive: true });
  const backupPath = `scripts/backups/lzecher_projects-${ts}.json`;
  writeFileSync(backupPath, JSON.stringify(projSnap.docs.map((d) => ({ id: d.id, ...d.data() })), null, 2), "utf8");
  console.log(`Backup written: ${backupPath} (${projSnap.size} docs)\n`);

  const wasPrivate = [];
  let changed = 0;
  // Accumulate platform-wide totals for lzecher_global_stats/totals (Prompt B).
  const globalTotals = { mishnayos: 0, tehillim: 0, kabalos: 0, shnayim_mikra: 0, daf_yomi: 0 };
  let globalParticipants = 0;
  let globalProjects = 0;

  for (const doc of projSnap.docs) {
    const p = doc.data();
    const name = `${p.nameHebrew || ""} ${p.familyNameHebrew || ""}`.trim() || doc.id;

    const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", doc.id).get();
    const portions = portionsSnap.docs.map((d) => d.data());

    const totalPortions = portions.length;
    const claimedPortions = portions.filter((x) => x.status !== "available").length;
    const completedPortions = portions.filter((x) => x.status === "completed").length;
    const claimedByTrack = {};
    for (const d of portions) {
      const tt = d.trackType || "unknown";
      if (!claimedByTrack[tt]) claimedByTrack[tt] = 0;
      if (d.claimMode === "inclusive") claimedByTrack[tt] += d.currentClaimerCount || 0;
      else if (d.status !== "available") claimedByTrack[tt] += 1;
    }
    const tmSetNums = portions.filter((x) => x.trackType === "mishnayos" || x.trackType === "tehillim").map((x) => (x.setNumber == null ? 1 : x.setNumber));
    const totalSets = tmSetNums.length ? Math.max(...tmSetNums) : 1;
    const prog = computeProgress(portions);
    const topMatmidim = computeTopMatmidim(portions);
    const participantCount = (participantsByProject.get(doc.id) || new Set()).size;

    const update = {
      totalPortions, claimedPortions, completedPortions, totalSets,
      progressPct: prog.pct, completedProgressPct: prog.completedPct, completedCycles: prog.cycles,
      claimedByTrack, topMatmidim, participantCount,
    };
    if (participantCount !== (p.participantCount || 0)) {
      console.log(`    participantCount: ${p.participantCount ?? "—"} → ${participantCount}`);
    }

    // Accumulate global totals (active/completed only — matches recompute-global).
    if (!p.status || ["active", "completed"].includes(p.status)) {
      globalProjects++;
      globalParticipants += participantCount;
      for (const k of Object.keys(globalTotals)) globalTotals[k] += claimedByTrack[k] || 0;
    }
    // Safe defaults — only when field is absent.
    if (p.passwordHash === undefined) update.passwordHash = null;
    if (p.passwordSalt === undefined) update.passwordSalt = null;
    if (p.startedByText === undefined) update.startedByText = null;
    if (p.startedByVisible === undefined) update.startedByVisible = false;
    if (p.locked === undefined) update.locked = false;
    if (p.announcement === undefined) update.announcement = null;
    if (p.customDedication === undefined) update.customDedication = null;

    if (p.isPublic === false) wasPrivate.push({ id: doc.id, name, slug: p.slug });

    console.log(`• ${name} [${p.slug}]`);
    console.log(`    progressPct: ${p.progressPct ?? "—"} → ${prog.pct}   cycles: ${p.completedCycles ?? "—"} → ${prog.cycles}   completedPct: ${prog.completedPct}   sets: ${totalSets}`);
    if (topMatmidim.length) console.log(`    יישר כח: ${topMatmidim.slice(0, 3).map((m) => `${m.name}(${m.count})`).join(", ")}${topMatmidim.length > 3 ? " …" : ""}`);

    if (APPLY) {
      await doc.ref.update({ ...update, updatedAt: Date.now() });
      changed++;
    }
  }

  // Write the global aggregate doc (Prompt B).
  const globalDoc = { ...globalTotals, participants: globalParticipants, projects: globalProjects, updatedAt: Date.now() };
  console.log(`\n=== Global aggregate (lzecher_global_stats/totals) ===`);
  console.log(`  ${globalTotals.mishnayos} משניות · ${globalTotals.tehillim} פרקי תהילים · ${globalTotals.kabalos} קבלות · ${globalParticipants} משתתפים · ${globalProjects} פרויקטים`);
  if (APPLY) {
    await db.collection("lzecher_global_stats").doc("totals").set(globalDoc, { merge: true });
    console.log("  [written]");
  }

  console.log(`\n=== Previously "private" projects (isPublic === false) — left OPEN; set a password if desired ===`);
  if (wasPrivate.length === 0) console.log("  (none)");
  else wasPrivate.forEach((w) => console.log(`  ⚑ ${w.name} [${w.slug}] (${w.id})`));

  console.log(`\n=== SUMMARY ===`);
  console.log(`${APPLY ? `Updated ${changed} projects.` : "DRY-RUN — no writes. Re-run with --apply to write."}`);
  console.log(`Backup: ${backupPath}`);
  console.log("=== done ===");
}
run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
