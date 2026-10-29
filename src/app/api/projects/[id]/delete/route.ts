/**
 * POST /api/projects/[id]/delete
 *
 * Creator can move their own project to a 60-day restorable deleted state. A non-owner admin needs
 * the Lzecher "projects" permission; super admins always pass.
 * Requires typed confirmation (the honoree's Hebrew name).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";
import { softDeleteProject } from "@/lib/project-lifecycle";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { idToken, confirmation } = body as { idToken?: string; confirmation?: string };

    if (!idToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const decoded = await verifyToken(idToken);
    const db = getAdminDb();
    const projectRef = db.collection("lzecher_projects").doc(id);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const projectData = projectSnap.data()!;
    if (decoded.uid !== projectData.createdBy && !hasAdminPermission(decoded, "projects")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Confirm with honoree name
    const expectedName = (projectData.nameHebrew || "").trim();
    if (!confirmation || confirmation.trim() !== expectedName) {
      return NextResponse.json({ error: `Type the honoree's Hebrew name "${expectedName}" to confirm` }, { status: 400 });
    }

    const result = await softDeleteProject({
      db,
      projectId: id,
      actorUid: decoded.uid,
      source: decoded.uid === projectData.createdBy ? "creator_delete_project" : "admin_delete_project",
      reason: "manual_delete",
    });

    if (!result.deleted) {
      return NextResponse.json({ error: "Project could not be deleted" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action: "deleted",
      restoreUntil: result.restoreUntil || null,
    });
  } catch (err) {
    console.error("[projects/delete]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
