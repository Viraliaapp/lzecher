/**
 * SERVER-ONLY. Authoritative recompute of the platform-wide aggregate counters by
 * summing each project's denormalized `claimedByTrack` across ALL lzecher_projects.
 * Writes a SINGLE aggregate doc (lzecher_global_stats/totals) that the live counter
 * polls — so visitors read ONE doc, never the whole claims collection.
 *
 * Reading ~10 project docs per claim is cheap, and summing the already-maintained
 * claimedByTrack means the aggregate can't drift (same philosophy as the per-project
 * recompute). Includes ONLY lzecher_ data — never other apps' collections.
 *
 * Designed to be wrapped in try/catch by callers so a failure never breaks a claim.
 */
export const GLOBAL_STATS_DOC = "totals";

export interface GlobalStats {
  mishnayos: number;
  tehillim: number;
  kabalos: number;
  shnayim_mikra: number;
  daf_yomi: number;
  participants: number;
  projects: number;
  updatedAt: number;
}

export async function recomputeGlobalStats(db: FirebaseFirestore.Firestore): Promise<GlobalStats> {
  const snap = await db.collection("lzecher_projects").get();

  const totals: Record<string, number> = {
    mishnayos: 0, tehillim: 0, kabalos: 0, shnayim_mikra: 0, daf_yomi: 0,
  };
  let participants = 0;
  let projects = 0;

  for (const doc of snap.docs) {
    const p = doc.data();
    // Only count active/completed memorials toward the public tally.
    if (p.status && !["active", "completed"].includes(p.status)) continue;
    projects++;
    participants += (p.participantCount as number) || 0;
    const byTrack = (p.claimedByTrack as Record<string, number> | undefined) || {};
    for (const k of Object.keys(totals)) {
      totals[k] += byTrack[k] || 0;
    }
  }

  const stats: GlobalStats = {
    mishnayos: totals.mishnayos,
    tehillim: totals.tehillim,
    kabalos: totals.kabalos,
    shnayim_mikra: totals.shnayim_mikra,
    daf_yomi: totals.daf_yomi,
    participants,
    projects,
    updatedAt: Date.now(),
  };

  await db.collection("lzecher_global_stats").doc(GLOBAL_STATS_DOC).set(stats, { merge: true });
  return stats;
}
