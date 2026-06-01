/**
 * POST /api/projects/[id]/delete
 *
 * Creator can permanently delete their own project. A non-owner admin needs
 * the Lzecher "projects" permission; super admins always pass.
 * Requires typed confirmation (the honoree's Hebrew name).
 * Deletes: project doc, all portions, all claims, all reports,
 * all contact messages, all scheduled emails, and Lzecher-scoped photos.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";

const BATCH_CHUNK = 400;

function deletedProjectSummary(projectData: FirebaseFirestore.DocumentData) {
  return {
    slug: projectData.slug || null,
    nameHebrew: projectData.nameHebrew || null,
    familyNameHebrew: projectData.familyNameHebrew || null,
    nameEnglish: projectData.nameEnglish || null,
    familyNameEnglish: projectData.familyNameEnglish || null,
    createdBy: projectData.createdBy || null,
    createdByEmail: projectData.createdByEmail || null,
    status: projectData.status || null,
    tracks: Array.isArray(projectData.tracks) ? projectData.tracks : [],
    totalPortions: projectData.totalPortions || 0,
    claimedPortions: projectData.claimedPortions || 0,
    completedPortions: projectData.completedPortions || 0,
    isPasswordProtected: Boolean(projectData.passwordHash),
  };
}

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

    // Delete all portions
    const portionsSnap = await db.collection("lzecher_portions").where("projectId", "==", id).get();
    await deleteDocsInChunks(db, portionsSnap.docs);

    // Delete all claims
    const claimsSnap = await db.collection("lzecher_claims").where("projectId", "==", id).get();
    await deleteDocsInChunks(db, claimsSnap.docs);

    // Delete all reports
    const reportsSnap = await db.collection("lzecher_reports").where("projectId", "==", id).get();
    await deleteDocsInChunks(db, reportsSnap.docs);

    // Delete family contact messages for this project
    const contactsSnap = await db.collection("lzecher_contact_messages").where("projectId", "==", id).get();
    await deleteDocsInChunks(db, contactsSnap.docs);

    // Cancel and delete all scheduled emails
    const emailsSnap = await db.collection("lzecher_scheduled_emails").where("projectId", "==", id).get();
    await deleteDocsInChunks(db, emailsSnap.docs);

    const firestorePhotoSnap = await db.collection("lzecher_project_photos").doc(id).get();
    if (firestorePhotoSnap.exists) {
      await firestorePhotoSnap.ref.delete();
    }

    // Delete the project photo if it was uploaded through Lzecher's scoped storage path.
    let photoDeleted = false;
    try {
      const creatorUid = projectData.createdBy;
      if (typeof creatorUid === "string" && creatorUid) {
        const [files] = await getAdminStorageBucket().getFiles({
          prefix: `lzecher/photos/${creatorUid}/${id}`,
        });
        await Promise.all(files.map((file) => file.delete()));
        photoDeleted = files.length > 0;
      }
    } catch (photoErr) {
      console.error("[projects/delete] photo cleanup failed:", photoErr);
    }

    // Audit log BEFORE deleting the project (we need the data)
    await db.collection("lzecher_admin_audit").add({
      action: "creator_delete_project",
      projectId: id,
      deletedBy: decoded.uid,
      deletedAt: Date.now(),
      project: deletedProjectSummary(projectData),
      counts: {
        portionsDeleted: portionsSnap.size,
        claimsDeleted: claimsSnap.size,
        reportsDeleted: reportsSnap.size,
        contactsDeleted: contactsSnap.size,
        emailsDeleted: emailsSnap.size,
        firestorePhotoDeleted: firestorePhotoSnap.exists,
        photoDeleted,
      },
    });

    // Delete the project itself
    await projectRef.delete();

    return NextResponse.json({ success: true, action: "deleted" });
  } catch (err) {
    console.error("[projects/delete]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

async function deleteDocsInChunks(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const d of docs.slice(i, i + BATCH_CHUNK)) {
      batch.delete(d.ref);
    }
    await batch.commit();
  }
}
