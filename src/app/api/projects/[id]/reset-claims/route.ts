/**
 * POST /api/projects/[id]/reset-claims
 *
 * Resets all claims for a project: deletes all claim docs, resets all
 * portions to "available", cancels pending reminder emails, resets project
 * stats to 0, and removes all sets beyond set 1 (keeps only the base set).
 * Requires the project creator or an admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { recomputeGlobalStats } from "@/lib/recompute-global";
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

    if (confirmation !== "אפס" && confirmation !== "reset") {
      return NextResponse.json({ error: 'Type "אפס" to confirm reset' }, { status: 400 });
    }

    // 1. Delete all claims for this project
    const claimsSnap = await db.collection("lzecher_claims").where("projectId", "==", id).get();
    for (let i = 0; i < claimsSnap.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      for (const d of claimsSnap.docs.slice(i, i + BATCH_CHUNK)) batch.delete(d.ref);
      await batch.commit();
    }

    // 2. Cancel all pending reminder emails for this project
    const emailsSnap = await db.collection("lzecher_scheduled_emails").where("projectId", "==", id).where("status", "==", "pending").get();
    for (let i = 0; i < emailsSnap.docs.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      for (const d of emailsSnap.docs.slice(i, i + BATCH_CHUNK)) {
        batch.update(d.ref, { status: "cancelled", cancelledAt: Date.now(), cancelledReason: "reset_claims" });
      }
      await batch.commit();
    }

    // 3. Delete portions from sets > 1 (extra sets created by repeating-set feature)
    const allPortionsSnap = await db.collection("lzecher_portions").where("projectId", "==", id).get();
    const setOnePortions = allPortionsSnap.docs.filter(d => (d.data().setNumber || 1) === 1);
    const extraPortions = allPortionsSnap.docs.filter(d => (d.data().setNumber || 1) > 1);

    // Delete extra-set portions
    for (let i = 0; i < extraPortions.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      for (const d of extraPortions.slice(i, i + BATCH_CHUNK)) batch.delete(d.ref);
      await batch.commit();
    }

    // 4. Reset set-1 portions to available
    for (let i = 0; i < setOnePortions.length; i += BATCH_CHUNK) {
      const batch = db.batch();
      for (const d of setOnePortions.slice(i, i + BATCH_CHUNK)) {
        batch.update(d.ref, {
          status: "available",
          claimedBy: null,
          claimedByName: null,
          claimedAt: null,
          completedAt: null,
          deadline: null,
          currentClaimerCount: 0,
          claimerNames: [],
        });
      }
      await batch.commit();
    }

    // 5. Reset project stats
    await projectRef.update({
      claimedPortions: 0,
      completedPortions: 0,
      participantCount: 0,
      totalPortions: setOnePortions.length,
      totalSets: 1,
      progressPct: 0,
      completedProgressPct: 0,
      completedCycles: 0,
      claimedByTrack: {},
      topMatmidim: [],
      updatedAt: Date.now(),
    });

    // Refresh the platform-wide aggregate after the reset. Non-fatal.
    try {
      await recomputeGlobalStats(db);
    } catch (e) {
      console.error("[reset-claims] global recompute failed:", e);
    }

    // Audit log
    await db.collection("lzecher_admin_audit").add({
      action: "reset_claims",
      projectId: id,
      adminUid: decoded.uid,
      timestamp: Date.now(),
      claimsDeleted: claimsSnap.size,
      portionsReset: setOnePortions.length,
      extraSetsRemoved: Math.max(0, (projectData.totalSets || 1) - 1),
    });

    return NextResponse.json({ success: true, claimsDeleted: claimsSnap.size, portionsReset: setOnePortions.length });
  } catch (err) {
    console.error("[reset-claims]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
