/**
 * POST /api/projects/[id]/delete
 *
 * Creator or super-admin can permanently delete a project.
 * Requires typed confirmation (the honoree's Hebrew name).
 * Deletes: project doc, all portions, all claims, all reports,
 * all scheduled emails, and photos under lzecher/photos/<id>/.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyToken } from "@/lib/auth-roles";

const BATCH_CHUNK = 400;

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
    const isAdmin = decoded.isAdmin || decoded.isSuperAdmin;
    if (decoded.uid !== projectData.createdBy && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Confirm with honoree name
    const expectedName = (projectData.nameHebrew || "").trim();
    if (!confirmation || confirmation.trim() !== expectedName) {
      return NextResponse.json({ error: `Type the honoree's Hebrew name "${expectedName}" to confirm` }, { status: 400 });
    }

    // Delete all portions
    const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", id).get();
    for (let i = 0; i < portionsSnap.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      for (const d of portionsSnap.docs.slice(i, i + BATCH_CHUNK)) batch.delete(d.ref);
      await batch.commit();
    }

    // Delete all claims
    const claimsSnap = await db.collection("lzecher_claims").where("projectId", "==", id).get();
    for (let i = 0; i < claimsSnap.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      for (const d of claimsSnap.docs.slice(i, i + BATCH_CHUNK)) batch.delete(d.ref);
      await batch.commit();
    }

    // Delete all reports
    const reportsSnap = await db.collection("lzecher_reports").where("projectId", "==", id).get();
    if (reportsSnap.size > 0) {
      const batch = db.batch();
      for (const d of reportsSnap.docs) batch.delete(d.ref);
      await batch.commit();
    }

    // Cancel and delete all scheduled emails
    const emailsSnap = await db.collection("lzecher_scheduled_emails").where("projectId", "==", id).get();
    if (emailsSnap.size > 0) {
      for (let i = 0; i < emailsSnap.docs.length; i += BATCH_CHUNK) {
        const batch = db.batch();
        for (const d of emailsSnap.docs.slice(i, i + BATCH_CHUNK)) batch.delete(d.ref);
        await batch.commit();
      }
    }

    // Audit log BEFORE deleting the project (we need the data)
    await db.collection("lzecher_admin_audit").add({
      action: "creator_delete_project",
      projectId: id,
      deletedBy: decoded.uid,
      deletedAt: Date.now(),
      projectData: projectData,
    });

    // Delete the project itself
    await projectRef.delete();

    return NextResponse.json({ success: true, action: "deleted" });
  } catch (err) {
    console.error("[projects/delete]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
