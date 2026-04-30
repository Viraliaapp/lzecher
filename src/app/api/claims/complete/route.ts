import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { portionId, projectId, idToken } = await request.json();

    if (!portionId || !projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auth required to mark as complete (must be the claimer)
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const db = getAdminDb();

    // Verify portion is claimed by this user
    const portionRef = db.collection("lzecher_portions").doc(portionId);
    const portionSnap = await portionRef.get();
    if (!portionSnap.exists) {
      return NextResponse.json({ error: "Portion not found" }, { status: 404 });
    }
    const portionData = portionSnap.data()!;
    if (portionData.status !== "claimed") {
      return NextResponse.json({ error: "Portion not claimed" }, { status: 400 });
    }
    if (portionData.claimedBy !== decoded.uid) {
      return NextResponse.json({ error: "Not your claim" }, { status: 403 });
    }

    // Mark as completed
    await portionRef.update({
      status: "completed",
      completedAt: Date.now(),
    });

    // Update project stats
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (projectSnap.exists) {
      const proj = projectSnap.data()!;
      await projectRef.update({
        completedPortions: (proj.completedPortions || 0) + 1,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Complete error:", err);
    return NextResponse.json({ error: "Failed to mark as complete" }, { status: 500 });
  }
}
