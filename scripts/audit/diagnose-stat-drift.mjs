/**
 * READ-ONLY diagnostic. Touches ONLY lzecher_ collections. Writes nothing.
 *
 * For every lzecher_project, prints the three competing progress percentages so we
 * can prove the card vs hero drift on real data:
 *   - stored:  project.progressPercent  (claimedPortions/totalPortions)
 *   - card:    HomeClient formula (claimedByTrack m+t / hardcoded 525+150, else claimed/total)
 *   - hero:    MemorialPageClient formula (per-set: completedSets*100 + activeSet%)
 *
 * Usage: npx dotenv-cli -e .env.local -- node scripts/audit/diagnose-stat-drift.mjs
 */
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing creds. Run: npx dotenv-cli -e .env.local -- node scripts/audit/diagnose-stat-drift.mjs");
  process.exit(1);
}
if (!getApps().length) initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore();

function cardPct(p) {
  const byTrack = p.claimedByTrack || {};
  const tracks = p.tracks || [];
  const tmHasTracks = tracks.some((t) => t === "mishnayos" || t === "tehillim");
  const hasByTrack = Object.keys(byTrack).length > 0;
  if (tmHasTracks && hasByTrack) {
    const mClaimed = byTrack.mishnayos || 0;
    const tClaimed = byTrack.tehillim || 0;
    const mTotal = tracks.includes("mishnayos") ? 525 : 0;
    const tTotal = tracks.includes("tehillim") ? 150 : 0;
    const tmTotal = mTotal + tTotal;
    return tmTotal > 0 ? Math.min(100, Math.round(((mClaimed + tClaimed) / tmTotal) * 100)) : 0;
  }
  return p.totalPortions > 0 ? Math.round((p.claimedPortions / p.totalPortions) * 100) : 0;
}

function heroPct(portions) {
  const tm = portions.filter((p) => p.trackType === "mishnayos" || p.trackType === "tehillim");
  if (tm.length === 0) return 0;
  const maxSet = Math.max(...tm.map((p) => p.setNumber || 1));
  if (maxSet <= 1) {
    const claimed = tm.filter((p) => p.status !== "available").length;
    return Math.round((claimed / tm.length) * 100);
  }
  let completedSetCount = 0, activeSetPct = 0;
  for (let s = 1; s <= maxSet; s++) {
    const sp = tm.filter((p) => (p.setNumber || 1) === s);
    const sc = sp.filter((p) => p.status !== "available").length;
    if (sp.length > 0 && sc === sp.length) completedSetCount++;
    else if (sp.length > 0) activeSetPct = Math.round((sc / sp.length) * 100);
  }
  return completedSetCount * 100 + activeSetPct;
}

function storedPct(p) {
  if (typeof p.progressPercent === "number") return p.progressPercent;
  return p.totalPortions > 0 ? Math.round((p.claimedPortions / p.totalPortions) * 100) : 0;
}

async function run() {
  const projSnap = await db.collection("lzecher_projects").get();
  console.log(`projects: ${projSnap.size}\n`);
  let drift = 0;
  const rows = [];
  for (const d of projSnap.docs) {
    const p = { id: d.id, ...d.data() };
    const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", d.id).get();
    const portions = portionsSnap.docs.map((x) => x.data());
    const card = cardPct(p);
    const hero = heroPct(portions);
    const stored = storedPct(p);
    const name = `${p.nameHebrew || ""} ${p.familyNameHebrew || ""}`.trim() || p.id;
    const diverge = !(card === hero && hero === stored);
    if (diverge) drift++;
    rows.push({ name, slug: p.slug, status: p.status, tracks: (p.tracks || []).join("+"),
      totalSets: p.totalSets || 1, totalPortions: p.totalPortions, claimedPortions: p.claimedPortions,
      stored, card, hero, diverge });
  }
  rows.sort((a, b) => (b.diverge ? 1 : 0) - (a.diverge ? 1 : 0));
  for (const r of rows) {
    console.log(`${r.diverge ? "⚠ DRIFT" : "  ok   "} | stored=${r.stored}% card=${r.card}% hero=${r.hero}% | sets=${r.totalSets} total=${r.totalPortions} claimed=${r.claimedPortions} | ${r.status} | ${r.tracks} | ${r.name} [${r.slug}]`);
  }
  console.log(`\n${drift}/${projSnap.size} projects have card/hero/stored disagreement.`);
}
run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
