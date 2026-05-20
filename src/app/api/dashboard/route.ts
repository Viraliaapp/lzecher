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

    // Get user's projects (single-field query, sort in JS)
    const projSnap = await db
      .collection("lzecher_projects")
      .where("createdBy", "==", uid)
      .get();

    const projects = projSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.createdAt as number) || 0) - ((a.createdAt as number) || 0)
      );

    // Get user's claims (single-field query, sort in JS)
    const claimSnap = await db
      .collection("lzecher_claims")
      .where("userId", "==", uid)
      .get();

    const rawClaims = claimSnap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Record<string, unknown>)
      .sort((a, b) => ((b.claimedAt as number) || 0) - ((a.claimedAt as number) || 0));

    // Enrich each claim with projectSlug + projectHonoree so the dashboard's
    // hierarchical accordion can render the project header without a second
    // round-trip per project.
    const projectIds = Array.from(new Set(rawClaims.map((c) => c.projectId as string).filter(Boolean)));
    const projectMap = new Map<string, { slug?: string; honoree?: string }>();
    for (const pid of projectIds) {
      const p = await db.collection("lzecher_projects").doc(pid).get();
      if (p.exists) {
        const pd = p.data()!;
        projectMap.set(pid, {
          slug: pd.slug,
          honoree: `${pd.nameHebrew || ""} ${pd.familyNameHebrew || ""}`.trim() + " " + (pd.honorific || "ז״ל"),
        });
      }
    }
    const claims = rawClaims.map((c) => ({
      ...c,
      projectSlug: projectMap.get(c.projectId as string)?.slug,
      projectHonoree: projectMap.get(c.projectId as string)?.honoree,
    }));

    return NextResponse.json({ projects, claims });
  } catch (err) {
    console.error("Dashboard error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
