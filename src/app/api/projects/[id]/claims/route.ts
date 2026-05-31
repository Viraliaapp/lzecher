import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = getAdminDb();

    // Verify ownership
    const projSnap = await db.collection("lzecher_projects").doc(projectId).get();
    if (!projSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const proj = projSnap.data()!;
    const isAdmin = Boolean(decoded.isAdmin || decoded.isSuperAdmin);
    if (proj.createdBy !== uid && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const claimsSnap = await db.collection("lzecher_claims")
      .where("projectId", "==", projectId)
      .orderBy("claimedAt", "desc")
      .limit(1000)
      .get();

    const claims = claimsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ claims });
  } catch (err) {
    console.error("[list-claims] error:", err);
    return NextResponse.json({ error: "Failed to load claims" }, { status: 500 });
  }
}
