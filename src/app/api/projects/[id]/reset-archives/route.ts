import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";
import { listAvailableResetArchives, RESET_UNDO_WINDOW_MS } from "@/lib/reset-archive";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get("authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
    if (!idToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const decoded = await verifyToken(idToken);
    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projectSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const projectData = projectSnap.data()!;
    if (decoded.uid !== projectData.createdBy && !hasAdminPermission(decoded, "projects")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const archives = await listAvailableResetArchives({ db, projectId: id });
    return NextResponse.json({
      archives,
      undoWindowHours: Math.round(RESET_UNDO_WINDOW_MS / (60 * 60 * 1000)),
      superAdminCanRestoreExpired: Boolean(decoded.isSuperAdmin),
    });
  } catch (err) {
    console.error("[reset-archives:list]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
