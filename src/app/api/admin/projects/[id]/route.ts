import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-roles";

// POST /api/admin/projects/[id] — hide, unhide, or delete a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, idToken, reason, confirmation } = body;

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const db = getAdminDb();
    const projectRef = db.collection("lzecher_projects").doc(id);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (action === "hide") {
      const decoded = await requireAdmin(idToken);
      await projectRef.update({
        status: "hidden",
        hiddenBy: decoded.uid,
        hiddenAt: Date.now(),
        hiddenReason: reason || null,
      });
      return NextResponse.json({ success: true, status: "hidden" });
    }

    if (action === "unhide") {
      const decoded = await requireAdmin(idToken);
      await projectRef.update({
        status: "active",
        unhiddenBy: decoded.uid,
        unhiddenAt: Date.now(),
      });
      return NextResponse.json({ success: true, status: "active" });
    }

    if (action === "delete") {
      const decoded = await requireSuperAdmin(idToken);

      // Require explicit confirmation string
      if (confirmation !== `DELETE_PROJECT_${id}`) {
        return NextResponse.json(
          { error: "Invalid confirmation. Type DELETE_PROJECT_<id> exactly." },
          { status: 400 }
        );
      }

      // Delete all portions
      const portionsSnap = await db
        .collection("lzecher_portions")
        .where("projectId", "==", id)
        .get();
      const batch = db.batch();
      for (const doc of portionsSnap.docs) batch.delete(doc.ref);

      // Delete all claims
      const claimsSnap = await db
        .collection("lzecher_claims")
        .where("projectId", "==", id)
        .get();
      for (const doc of claimsSnap.docs) batch.delete(doc.ref);

      // Delete all reports for this project
      const reportsSnap = await db
        .collection("lzecher_reports")
        .where("projectId", "==", id)
        .get();
      for (const doc of reportsSnap.docs) batch.delete(doc.ref);

      await batch.commit();

      // Delete the project itself
      await projectRef.delete();

      // Audit log
      await db.collection("lzecher_admin_audit").add({
        action: "delete_project",
        projectId: id,
        deletedBy: decoded.uid,
        deletedAt: Date.now(),
        projectData: projectSnap.data(),
      });

      return NextResponse.json({ success: true, action: "deleted" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("Admin action error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
