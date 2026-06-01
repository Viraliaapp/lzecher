import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;
    const db = getAdminDb();

    // Verify ownership
    const projSnap = await db.collection("lzecher_projects").doc(projectId).get();
    if (!projSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const proj = projSnap.data()!;
    if (proj.createdBy !== uid && !hasAdminPermission(decoded, "projects")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Avoid requiring a composite Firestore index; sort the project-scoped claims in JS.
    const claimsSnap = await db.collection("lzecher_claims")
      .where("projectId", "==", projectId)
      .get();

    const claims = claimsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((c: Record<string, unknown>) => c.isParent !== true)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((b.claimedAt as number) || 0) - ((a.claimedAt as number) || 0)
      )
      .slice(0, 1000);
    return NextResponse.json({ claims });
  } catch (err) {
    console.error("[list-claims] error:", err);
    return NextResponse.json({ error: "Failed to load claims" }, { status: 500 });
  }
}
