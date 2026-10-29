import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";
import { restoreResetArchive } from "@/lib/reset-archive";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; archiveId: string }> }
) {
  try {
    const { id, archiveId } = await params;
    const body = await request.json().catch(() => ({}));
    const { idToken, confirmation } = body as { idToken?: string; confirmation?: string };
    if (!idToken) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const decoded = await verifyToken(idToken);
    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projectSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const projectData = projectSnap.data()!;
    if (decoded.uid !== projectData.createdBy && !hasAdminPermission(decoded, "projects")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const expected = `UNDO_${archiveId}`;
    if (confirmation !== expected) {
      return NextResponse.json({ error: `Type ${expected} to confirm restore` }, { status: 400 });
    }

    const result = await restoreResetArchive({
      db,
      projectId: id,
      archiveId,
      actorUid: decoded.uid,
      actorEmail: decoded.email,
      allowExpired: Boolean(decoded.isSuperAdmin),
    });

    if (!result.restored) {
      const status = result.reason === "restore_window_expired" ? 410 : 400;
      return NextResponse.json({ error: result.reason, expiresAt: "expiresAt" in result ? result.expiresAt : null }, { status });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[reset-archives:restore]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
