import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, verifyToken } from "@/lib/auth-roles";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { recomputeGlobalStats } from "@/lib/recompute-global";

function removeOneName(names: unknown, name: string): string[] {
  const next = Array.isArray(names) ? names.filter((item): item is string => typeof item === "string") : [];
  const index = next.findIndex((item) => item === name);
  if (index >= 0) next.splice(index, 1);
  return next;
}

function replaceOneName(names: unknown, oldName: string, newName: string): string[] {
  const next = Array.isArray(names) ? names.filter((item): item is string => typeof item === "string") : [];
  const index = next.findIndex((item) => item === oldName);
  if (index >= 0) next[index] = newName;
  return next;
}

// DELETE — remove a claim and release the portion back to available
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: projectId, claimId } = await params;
    const { idToken } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;

    const db = getAdminDb();

    // Verify the project belongs to this user
    const projSnap = await db.collection("lzecher_projects").doc(projectId).get();
    if (!projSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const proj = projSnap.data()!;
    if (proj.createdBy !== uid && !hasAdminPermission(decoded, "projects")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get the claim
    const claimSnap = await db.collection("lzecher_claims").doc(claimId).get();
    if (!claimSnap.exists) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    const claim = claimSnap.data()!;
    if (claim.projectId !== projectId) return NextResponse.json({ error: "Claim not in project" }, { status: 400 });

    const portionId: string | undefined = claim.portionId;
    const trackType: string = claim.trackType || "";
    const claimMode: string = claim.claimMode || (trackType === "kabalos" ? "inclusive" : "exclusive");

    // Update portion
    if (portionId) {
      const portRef = db.collection("lzecher_portions").doc(portionId);
      const portSnap = await portRef.get();
      if (portSnap.exists) {
        const portData = portSnap.data()!;
        if (portData.projectId !== projectId) {
          return NextResponse.json({ error: "Portion not in project" }, { status: 400 });
        }
        if (claimMode === "inclusive" || portData.claimMode === "inclusive") {
          const count = Math.max(0, (portData.currentClaimerCount || 1) - 1);
          const names = removeOneName(portData.claimerNames, claim.userName || "");
          await portRef.update({ currentClaimerCount: count, claimerNames: names });
        } else {
          // Exclusive: release back to available
          await portRef.update({ status: "available", claimedBy: null, claimedByName: null, claimedAt: null });
        }
      }
    }

    // Delete the claim
    await db.collection("lzecher_claims").doc(claimId).delete();

    // Decrement project stats
    const trackKey = `claimedByTrack.${trackType}`;
    const existingTrackCount = (proj.claimedByTrack as Record<string, number> | undefined || {})[trackType] || 0;
    await db.collection("lzecher_projects").doc(projectId).update({
      claimedPortions: Math.max(0, (proj.claimedPortions || 0) - 1),
      participantCount: Math.max(0, (proj.participantCount || 0) - 1),
      [trackKey]: Math.max(0, existingTrackCount - 1),
    });

    // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
    try {
      await recomputeProjectProgress(db, projectId);
      await recomputeGlobalStats(db);
    } catch (e) {
      console.error("[delete-claim] recompute failed:", e);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[delete-claim] error:", err);
    return NextResponse.json({ error: "Failed to delete claim" }, { status: 500 });
  }
}

// PATCH — edit a claim (currently: rename the claimer)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; claimId: string }> }
) {
  try {
    const { id: projectId, claimId } = await params;
    const { idToken, userName } = await request.json();
    if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const decoded = await verifyToken(idToken);
    const uid = decoded.uid;
    const db = getAdminDb();

    const projSnap = await db.collection("lzecher_projects").doc(projectId).get();
    if (!projSnap.exists) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const proj = projSnap.data()!;
    if (proj.createdBy !== uid && !hasAdminPermission(decoded, "projects")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const claimSnap = await db.collection("lzecher_claims").doc(claimId).get();
    if (!claimSnap.exists) return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    const claim = claimSnap.data()!;
    if (claim.projectId !== projectId) return NextResponse.json({ error: "Mismatch" }, { status: 400 });

    const newName = (userName || "").trim();
    if (!newName) return NextResponse.json({ error: "Name required" }, { status: 400 });

    let portionRefToRename: FirebaseFirestore.DocumentReference | null = null;
    let portionRenameUpdate: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> | null = null;

    // Also update the portion display state so public cards stay in sync.
    if (claim.portionId) {
      const portRef = db.collection("lzecher_portions").doc(claim.portionId as string);
      const portSnap = await portRef.get();
      if (!portSnap.exists || portSnap.data()!.projectId !== projectId) {
        return NextResponse.json({ error: "Portion not in project" }, { status: 400 });
      }
      const portData = portSnap.data()!;
      portionRefToRename = portRef;
      if ((claim.claimMode || portData.claimMode || "exclusive") === "inclusive") {
        portionRenameUpdate = {
          claimerNames: replaceOneName(portData.claimerNames, claim.userName || "", newName),
        };
      } else {
        portionRenameUpdate = { claimedByName: newName };
      }
    }

    const batch = db.batch();
    batch.update(db.collection("lzecher_claims").doc(claimId), { userName: newName });
    if (portionRefToRename && portionRenameUpdate) {
      batch.update(portionRefToRename, portionRenameUpdate);
    }
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[edit-claim] error:", err);
    return NextResponse.json({ error: "Failed to edit claim" }, { status: 500 });
  }
}
