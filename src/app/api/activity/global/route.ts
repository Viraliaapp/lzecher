/**
 * GET /api/activity/global
 *
 * Returns the platform-wide aggregate counters by reading the SINGLE pre-aggregated
 * doc lzecher_global_stats/totals (maintained incrementally by recomputeGlobalStats
 * on every claim/release). Visitors NEVER scan the claims collection. CDN-cached.
 */
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { GLOBAL_STATS_DOC } from "@/lib/recompute-global";

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("lzecher_global_stats").doc(GLOBAL_STATS_DOC).get();
    const data = snap.exists ? snap.data()! : {};
    return NextResponse.json(
      {
        mishnayos: data.mishnayos || 0,
        tehillim: data.tehillim || 0,
        kabalos: data.kabalos || 0,
        shnayim_mikra: data.shnayim_mikra || 0,
        daf_yomi: data.daf_yomi || 0,
        participants: data.participants || 0,
        projects: data.projects || 0,
        updatedAt: data.updatedAt || 0,
      },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } }
    );
  } catch (err) {
    console.error("[activity/global] error:", err);
    return NextResponse.json({ mishnayos: 0, tehillim: 0, kabalos: 0, shnayim_mikra: 0, daf_yomi: 0, participants: 0, projects: 0, updatedAt: 0 }, { status: 200 });
  }
}
