/**
 * GET /api/projects/[id]/leaderboard
 *
 * Top "Yasher Koach" learners for one project, by portions taken, named,
 * anonymous skipped. Reads the denormalized `topMatmidim` on the project doc (1 read,
 * maintained by recomputeProjectProgress). Falls back to computing from portions for
 * not-yet-backfilled projects. CDN-cached so polling collapses to ~1 read / 20s.
 *
 * No extra gating: this lives INSIDE the project, which already enforces its own
 * password gate before the page (and this endpoint) is reached.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { computeTopMatmidim } from "@/lib/recompute-progress";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getAdminDb();
    const projSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projSnap.exists) {
      return NextResponse.json({ matmidim: [] }, { status: 404 });
    }
    const data = projSnap.data()!;

    let matmidim = data.topMatmidim as { name: string; count: number }[] | undefined;
    if (!Array.isArray(matmidim)) {
      // Fallback for not-yet-backfilled projects.
      const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", id).get();
      matmidim = computeTopMatmidim(portionsSnap.docs.map((d) => d.data()));
    }

    return NextResponse.json(
      { matmidim },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
    );
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return NextResponse.json({ matmidim: [] }, { status: 200 });
  }
}
