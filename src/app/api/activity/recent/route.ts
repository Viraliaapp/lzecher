/**
 * GET /api/activity/recent
 *
 * Returns the ~20 most recent claim "events" across all lzecher_ projects for the
 * live activity bubbles. Efficient by design:
 *   - ONE ordered/limited query (claimedAt desc, limit 80) — never a full scan.
 *   - Groups portions claimed in the same op (bulk/multi) into a single event so a
 *     50-portion bulk shows as one "took 50" bubble, not 50 bubbles.
 *   - Resolves honoree names with a single batched getAll of the distinct projects.
 *   - CDN-cached (s-maxage) so many visitors polling every 20s collapse to ~1 read.
 *
 * Per Solomon's decision, activity from ALL projects (incl. password-protected) is
 * included. Scope: lzecher_claims + lzecher_projects only.
 */
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

export interface ActivityEvent {
  id: string;
  name: string | null; // null = anonymous → client shows "מישהו"
  count: number;
  trackType: string;
  projectId: string;
  honoreeHebrew: string;
  honoreeHonorific: string;
  claimedAt: number;
}

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db
      .collection("lzecher_claims")
      .orderBy("claimedAt", "desc")
      .limit(80)
      .get();

    // Group same-op claims: same taker + project + track + ~second.
    const groups = new Map<string, { name: string | null; count: number; trackType: string; projectId: string; claimedAt: number }>();
    for (const doc of snap.docs) {
      const c = doc.data();
      if (c.isParent === true) continue; // bulk parent is a summary, not an event
      if (!c.projectId || !c.trackType || typeof c.claimedAt !== "number") continue;
      const taker = c.userId && c.userId !== "anonymous" ? `u:${c.userId}` : `n:${(c.userName || "").trim()}`;
      const bucket = Math.round(c.claimedAt / 1000);
      const key = `${taker}|${c.projectId}|${c.trackType}|${bucket}`;
      const g = groups.get(key);
      if (g) {
        g.count++;
        g.claimedAt = Math.max(g.claimedAt, c.claimedAt);
      } else {
        groups.set(key, {
          name: (c.userName || "").trim() || null,
          count: 1,
          trackType: c.trackType,
          projectId: c.projectId,
          claimedAt: c.claimedAt,
        });
      }
    }

    const events = [...groups.entries()]
      .map(([id, g]) => ({ id, ...g }))
      .sort((a, b) => b.claimedAt - a.claimedAt)
      .slice(0, 20);

    // Resolve honoree names in one batched read.
    const projectIds = [...new Set(events.map((e) => e.projectId))];
    const projectMap = new Map<string, { hebrew: string; honorific: string }>();
    if (projectIds.length > 0) {
      const refs = projectIds.map((id) => db.collection("lzecher_projects").doc(id));
      const projSnaps = await db.getAll(...refs);
      for (const ps of projSnaps) {
        if (!ps.exists) continue;
        const p = ps.data()!;
        const hebrew = `${p.nameHebrew || ""} ${p.familyNameHebrew || ""}`.trim();
        const honorific = (p.honorific as string) || (p.gender === "female" ? "ע״ה" : "ז״ל");
        projectMap.set(ps.id, { hebrew, honorific });
      }
    }

    const result: ActivityEvent[] = events
      .filter((e) => projectMap.has(e.projectId)) // drop events whose project is gone
      .map((e) => ({
        id: e.id,
        name: e.name,
        count: e.count,
        trackType: e.trackType,
        projectId: e.projectId,
        honoreeHebrew: projectMap.get(e.projectId)!.hebrew,
        honoreeHonorific: projectMap.get(e.projectId)!.honorific,
        claimedAt: e.claimedAt,
      }));

    return NextResponse.json(
      { events: result },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } }
    );
  } catch (err) {
    console.error("[activity/recent] error:", err);
    return NextResponse.json({ events: [] }, { status: 200 });
  }
}
