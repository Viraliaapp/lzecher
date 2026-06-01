import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";
import { recomputeProjectProgress } from "@/lib/recompute-progress";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { idToken, confirmProjectId } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const decoded = await requireSuperAdmin(idToken);
    if (confirmProjectId !== id) {
      return NextResponse.json(
        { error: "Confirm this single project ID before recomputing stats." },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const stats = await recomputeProjectProgress(db, id);
    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_recompute_project",
      projectId: id,
      adminUid: decoded.uid,
      at: Date.now(),
      details: {
        scope: "single_project",
        stats,
      },
    });

    return NextResponse.json({ success: true, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/projects/recompute]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
