/**
 * GET /api/projects/[id]/leaderboard
 *
 * Top "Yasher Koach" learners for one project, by portions taken, named,
 * anonymous skipped. Reads the denormalized `topMatmidim` on the project doc (1 read,
 * maintained by recomputeProjectProgress). Falls back to computing from portions for
 * not-yet-backfilled projects. The default response is top 5; `?all=1` computes the
 * full ranked list from portions when a visitor asks to see everyone.
 *
 * No extra gating: this lives INSIDE the project, which already enforces its own
 * password gate before the page (and this endpoint) is reached.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { computeTopMatmidim } from "@/lib/recompute-progress";

const LEADERBOARD_LIMIT = 5;
const LEADERBOARD_FULL_LIMIT = 500;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const showAll = request.nextUrl.searchParams.get("all") === "1";
    const db = getAdminDb();
    const projSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projSnap.exists) {
      return NextResponse.json({ matmidim: [] }, { status: 404 });
    }
    const data = projSnap.data()!;

    let matmidim = data.topMatmidim as { name: string; count: number }[] | undefined;
    if (showAll || !Array.isArray(matmidim)) {
      // Full view and not-yet-backfilled projects compute from portions.
      const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", id).get();
      matmidim = computeTopMatmidim(
        portionsSnap.docs.map((d) => d.data()),
        showAll ? LEADERBOARD_FULL_LIMIT : LEADERBOARD_LIMIT
      );
    }

    const responseMatmidim = showAll ? matmidim.slice(0, LEADERBOARD_FULL_LIMIT) : matmidim.slice(0, LEADERBOARD_LIMIT);
    return NextResponse.json(
      {
        matmidim: responseMatmidim,
        hasMore: showAll ? responseMatmidim.length > LEADERBOARD_LIMIT : matmidim.length >= LEADERBOARD_LIMIT,
      },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
    );
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return NextResponse.json({ matmidim: [] }, { status: 200 });
  }
}
