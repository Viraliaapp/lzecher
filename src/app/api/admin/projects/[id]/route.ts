import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth-roles";
import { restoreProject, softDeleteProject } from "@/lib/project-lifecycle";

// POST /api/admin/projects/[id] — hide, unhide, soft-delete, or restore a project
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
      const decoded = await requireAdmin(idToken, "projects");
      if (projectSnap.data()?.status === "deleted") return NextResponse.json({ error: "Restore the project first" }, { status: 409 });
      await projectRef.update({
        status: "hidden",
        hiddenBy: decoded.uid,
        hiddenAt: Date.now(),
        hiddenReason: reason || null,
      });
      return NextResponse.json({ success: true, status: "hidden" });
    }

    if (action === "unhide") {
      const decoded = await requireAdmin(idToken, "projects");
      if (projectSnap.data()?.status === "deleted") return NextResponse.json({ error: "Restore the project first" }, { status: 409 });
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

      const result = await softDeleteProject({
        db,
        projectId: id,
        actorUid: decoded.uid,
        source: "super_admin_delete_project",
        reason: reason || "manual_delete",
      });

      if (!result.deleted) {
        return NextResponse.json({ error: "Project could not be deleted" }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        action: "deleted",
        restoreUntil: result.restoreUntil || null,
      });
    }

    if (action === "restore") {
      const decoded = await requireSuperAdmin(idToken);
      const result = await restoreProject({ projectId: id, actorUid: decoded.uid });
      if (!result.restored) {
        const status = result.reason === "restore_window_expired" ? 410 : 400;
        return NextResponse.json({ error: result.reason, restoreUntil: result.restoreUntil || null }, { status });
      }

      return NextResponse.json({ success: true, action: "restored", status: result.status });
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
