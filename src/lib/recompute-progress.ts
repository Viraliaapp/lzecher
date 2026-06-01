/**
 * SERVER-ONLY. Authoritative recompute of a project's denormalized stats from its
 * portions (the source of truth). Call this after EVERY mutation that changes claim
 * state (claim, release, complete, set-open, reset). Because it derives every field
 * from the live portions each time, the stored stats self-heal and can't drift —
 * this is the real fix for the recurring card-vs-hero percentage bug.
 *
 * Scope: reads lzecher_portions, writes ONLY the one lzecher_projects doc.
 *
 * Safe to call redundantly. Designed to be wrapped in try/catch by callers so a
 * recompute failure never breaks the underlying claim.
 */
import { computeProgress } from "./progress";

export interface Matmid {
  name: string;
  count: number;
}

export interface RecomputedStats {
  totalPortions: number;
  claimedPortions: number;
  completedPortions: number;
  totalSets: number;
  progressPct: number;
  completedProgressPct: number;
  completedCycles: number;
  claimedByTrack: Record<string, number>;
  participantCount: number;
  topMatmidim: Matmid[];
}

/**
 * Unique-participant count for a project from its claim docs: deduped by userId
 * (when not anonymous) else by name+email. Excludes bulk "parent" summary claims.
 * Authoritative (can't drift) — replaces the fragile per-claim increments.
 */
export async function recomputeParticipantCount(
  db: FirebaseFirestore.Firestore,
  projectId: string
): Promise<number> {
  const claimsSnap = await db.collection("lzecher_claims").where("projectId", "==", projectId).get();
  const keys = new Set<string>();
  for (const d of claimsSnap.docs) {
    const c = d.data();
    if (c.isParent === true) continue;
    const key = c.userId && c.userId !== "anonymous" ? `u:${c.userId}` : `n:${(c.userName || "").trim()}__${(c.userEmail || "").trim()}`;
    if (key === "n:__") continue; // no identity at all
    keys.add(key);
  }
  return keys.size;
}

/**
 * Top "matmidim" (most-dedicated takers) for a project, by portions taken — computed
 * from the portions already in hand (no extra reads). Exclusive portions count their
 * claimedByName; inclusive portions count each name in claimerNames. Anonymous /
 * nameless takers are skipped. Returns a sorted list capped by `limit`.
 */
export function computeTopMatmidim(
  portions: { claimMode?: string; status?: string; claimedByName?: string; claimerNames?: string[] }[],
  limit = 5
): Matmid[] {
  const counts = new Map<string, number>();
  const bump = (raw?: string) => {
    const name = (raw || "").trim();
    if (!name || name.toLowerCase() === "anonymous") return;
    counts.set(name, (counts.get(name) || 0) + 1);
  };
  for (const p of portions) {
    if (p.claimMode === "inclusive") {
      for (const n of p.claimerNames || []) bump(n);
    } else if (p.status !== "available") {
      bump(p.claimedByName);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, Number.isFinite(limit) ? Math.max(0, limit) : undefined);
}

export async function recomputeProjectProgress(
  db: FirebaseFirestore.Firestore,
  projectId: string
): Promise<RecomputedStats> {
  const portionsSnap = await db
    .collection("lzecher_portions")
    .where("projectId", "==", projectId)
    .get();
  const portions = portionsSnap.docs.map((d) => d.data());

  const totalPortions = portions.length;
  const claimedPortions = portions.filter((p) => p.status !== "available").length;
  const completedPortions = portions.filter((p) => p.status === "completed").length;

  // Per-track claimed counts (kept for the card's stat line)
  const claimedByTrack: Record<string, number> = {};
  for (const d of portions) {
    const tt = (d.trackType as string) || "unknown";
    if (!claimedByTrack[tt]) claimedByTrack[tt] = 0;
    if (d.claimMode === "inclusive") {
      claimedByTrack[tt] += (d.currentClaimerCount as number) || 0;
    } else if (d.status !== "available") {
      claimedByTrack[tt] += 1;
    }
  }

  // totalSets from TM portions
  const tmSetNums = portions
    .filter((p) => p.trackType === "mishnayos" || p.trackType === "tehillim")
    .map((p) => (p.setNumber == null ? 1 : (p.setNumber as number)));
  const totalSets = tmSetNums.length ? Math.max(...tmSetNums) : 1;

  const prog = computeProgress(portions as { trackType?: string; setNumber?: number | null; status?: string }[]);
  const topMatmidim = computeTopMatmidim(portions as { claimMode?: string; status?: string; claimedByName?: string; claimerNames?: string[] }[]);
  const participantCount = await recomputeParticipantCount(db, projectId);

  const stats: RecomputedStats = {
    totalPortions,
    claimedPortions,
    completedPortions,
    totalSets,
    progressPct: prog.pct,
    completedProgressPct: prog.completedPct,
    completedCycles: prog.cycles,
    claimedByTrack,
    participantCount,
    topMatmidim,
  };

  await db
    .collection("lzecher_projects")
    .doc(projectId)
    .update({ ...stats, updatedAt: Date.now() });

  return stats;
}
