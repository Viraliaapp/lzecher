import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = getAdminDb();

    // ── 1. User's created projects ──────────────────────────────────────────
    const projSnap = await db
      .collection("lzecher_projects")
      .where("createdBy", "==", uid)
      .get();

    const projects = projSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.createdAt as number) || 0) - ((a.createdAt as number) || 0)
      );

    // Build project lookup + stat 1 (totalClaimedPortions from project docs)
    const projectIds = projSnap.docs.map((d) => d.id);
    const projLookup = new Map<string, { slug?: string; honoree?: string }>();
    let totalClaimedPortions = 0;
    for (const d of projSnap.docs) {
      const pd = d.data();
      totalClaimedPortions += (pd.claimedPortions as number) || 0;
      projLookup.set(d.id, {
        slug: pd.slug as string | undefined,
        honoree: `${pd.nameHebrew || ""} ${pd.familyNameHebrew || ""}`.trim() +
          " " + ((pd.honorific as string) || "ז״ל"),
      });
    }

    // ── 2. Claims on user's projects (stats 2+3, activity feed) ────────────
    let allProjectClaims: Record<string, unknown>[] = [];
    if (projectIds.length > 0) {
      for (let i = 0; i < projectIds.length; i += 30) {
        const chunk = projectIds.slice(i, i + 30);
        const snap = await db
          .collection("lzecher_claims")
          .where("projectId", "in", chunk)
          .get();
        allProjectClaims.push(...snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    }

    // Stat 2: unique participants across all projects
    const participantKeys = new Set<string>();
    for (const c of allProjectClaims) {
      const key = (c.claimerUid as string) ||
        `${c.claimerName as string}__${c.claimerEmail as string}`;
      if (key && key !== "__") participantKeys.add(key);
    }

    // Stat 3: claims in the last 7 days
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const claimsThisWeek = allProjectClaims.filter(
      (c) => ((c.claimedAt as number) || 0) >= weekAgo
    ).length;

    // Recent activity: newest 10 claims on user's projects
    const recentActivity = [...allProjectClaims]
      .sort((a, b) => ((b.claimedAt as number) || 0) - ((a.claimedAt as number) || 0))
      .slice(0, 10)
      .map((c) => ({
        id: c.id as string,
        claimerName: (c.claimerName as string) || "אנונימי",
        reference: c.reference as string | undefined,
        trackType: c.trackType as string | undefined,
        projectId: c.projectId as string,
        claimedAt: (c.claimedAt as number) || 0,
        projectHonoree: projLookup.get(c.projectId as string)?.honoree,
        projectSlug: projLookup.get(c.projectId as string)?.slug,
      }));

    // ── 3. User's own claims (My Learning Journey accordion) ───────────────
    const claimSnap = await db
      .collection("lzecher_claims")
      .where("userId", "==", uid)
      .get();

    const rawClaims = claimSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
      .sort((a, b) => ((b.claimedAt as number) || 0) - ((a.claimedAt as number) || 0));

    // Enrich with project info (may include projects the user didn't create)
    const claimProjectIds = Array.from(
      new Set(rawClaims.map((c) => c.projectId as string).filter(Boolean))
    );
    const claimProjectMap = new Map<string, { slug?: string; honoree?: string }>();
    for (const pid of claimProjectIds) {
      if (projLookup.has(pid)) {
        claimProjectMap.set(pid, projLookup.get(pid)!);
      } else {
        const p = await db.collection("lzecher_projects").doc(pid).get();
        if (p.exists) {
          const pd = p.data()!;
          claimProjectMap.set(pid, {
            slug: pd.slug,
            honoree: `${pd.nameHebrew || ""} ${pd.familyNameHebrew || ""}`.trim() +
              " " + (pd.honorific || "ז״ל"),
          });
        }
      }
    }
    const claims = rawClaims.map((c) => ({
      ...c,
      projectSlug: claimProjectMap.get(c.projectId as string)?.slug,
      projectHonoree: claimProjectMap.get(c.projectId as string)?.honoree,
    }));

    return NextResponse.json({
      projects,
      claims,
      stats: {
        totalClaimedPortions,
        uniqueParticipants: participantKeys.size,
        claimsThisWeek,
      },
      recentActivity,
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
