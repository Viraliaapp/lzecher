/**
 * GET /api/activity/global
 *
 * Returns the platform-wide aggregate counters by reading the SINGLE pre-aggregated
 * doc lzecher_global_stats/totals (maintained incrementally by recomputeGlobalStats
 * on every claim/release). Visitors NEVER scan the claims collection. CDN-cached.
 */
import { NextResponse } from "next/server";
import type { Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { GLOBAL_STATS_DOC } from "@/lib/recompute-global";

const PUBLIC_SITE_VIEW_BASELINE = 550;

async function aggregateSiteViews(db: Firestore) {
  const snap = await db
    .collection("lzecher_view_stats")
    .where("scope", "==", "site")
    .get();

  return snap.docs.reduce((sum, doc) => {
    const data = doc.data();
    return sum + Number(data.total || 0);
  }, 0);
}

export async function GET() {
  try {
    const db = getAdminDb();
    const [snap, rawSiteViews] = await Promise.all([
      db.collection("lzecher_global_stats").doc(GLOBAL_STATS_DOC).get(),
      aggregateSiteViews(db),
    ]);
    const siteViews = PUBLIC_SITE_VIEW_BASELINE + rawSiteViews;
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
        siteViews,
        updatedAt: data.updatedAt || 0,
      },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
    );
  } catch (err) {
    console.error("[activity/global] error:", err);
    return NextResponse.json({ mishnayos: 0, tehillim: 0, kabalos: 0, shnayim_mikra: 0, daf_yomi: 0, participants: 0, projects: 0, siteViews: 0, updatedAt: 0 }, { status: 200 });
  }
}
