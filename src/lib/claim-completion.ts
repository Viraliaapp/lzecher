import type { Firestore } from "firebase-admin/firestore";
import { ClaimError } from "./claim-management";
import { getClaimMode } from "./track-config";
import type { TrackType } from "./types";
import { runLearningTransaction } from "./learning-transaction";

type Completer = { uid: string | null; isAdmin?: boolean; name: string | null; email?: string | null };

export async function completePortion(db: Firestore, projectId: string, portionId: string,
  actor: Completer, access: boolean, claimId?: string) {
  return runLearningTransaction(db, async tx => {
    const project = await tx.get(db.collection("lzecher_projects").doc(projectId));
    if (!project.exists) throw new ClaimError(404, "Project not found");
    if (project.data()!.maintenanceLock || project.data()!.status === "deleted") throw new ClaimError(423, "Project unavailable");
    const ref = db.collection("lzecher_portions").doc(portionId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ClaimError(404, "Portion not found");
    const portion = snap.data()!;
    if (portion.projectId !== projectId) throw new ClaimError(400, "Portion not in project");
    const mode = portion.claimMode ?? getClaimMode(portion.trackType as TrackType);
    const claimRef = claimId ? db.collection("lzecher_claims").doc(claimId) : null;
    const claim = claimRef ? await tx.get(claimRef) : null;
    if (claimRef && (!claim?.exists || claim.data()!.projectId !== projectId || claim.data()!.portionId !== portionId || claim.data()!.isParent)) {
      throw new ClaimError(400, "Claim does not match this portion");
    }
    if (mode === "inclusive" && !claimRef) throw new ClaimError(400, "Learning entry required");
    if (mode === "exclusive" && claimId && (portion.claimId ? portion.claimId !== claimId :
      claim!.data()!.userId !== portion.claimedBy ||
      (claim!.data()!.claimedAt != null && portion.claimedAt != null && claim!.data()!.claimedAt !== portion.claimedAt))) {
      throw new ClaimError(409, "This portion now belongs to a different learning entry");
    }
    const owner = mode === "inclusive" ? claim!.data()!.userId : portion.claimedBy;
    if (project.data()!.passwordHash && !access && actor.uid !== owner &&
      actor.uid !== project.data()!.createdBy && !actor.isAdmin) throw new ClaimError(403, "Memorial password required");
    if (claim && !["active", "completed"].includes(claim.data()!.status)) throw new ClaimError(409, "Claim is not active");
    // Preserve the deployed product's intentional named public completions.
    if (actor.uid !== owner && !actor.isAdmin && !actor.name) throw new ClaimError(400, "Name required");
    if (mode === "exclusive" && portion.status !== "claimed" && portion.status !== "completed") throw new ClaimError(409, "Portion is not taken");
    // Current reservations link the exact claim. Only legacy records need a query;
    // avoiding a query here also keeps simultaneous completions narrowly locked.
    const linkedClaim = mode === "exclusive" && portion.claimId
      ? (claimRef?.id === portion.claimId ? claim : await tx.get(db.collection("lzecher_claims").doc(portion.claimId)))
      : null;
    const claims = mode === "exclusive" && !portion.claimId ? await tx.get(db.collection("lzecher_claims")
      .where("projectId", "==", projectId).where("portionId", "==", portionId)) : null;
    const changed = mode === "exclusive" ? portion.status !== "completed" : claim!.data()!.status !== "completed";
    const values = { status: "completed", completedAt: Date.now(), completedByName: actor.name,
      completedByUid: actor.uid, completedByEmail: actor.email || null };
    if (mode === "exclusive") {
      if (changed) tx.update(ref, { ...values, completedByName: actor.name || portion.claimedByName || null });
      // Also repairs a prior interrupted completion where only the portion was saved.
      for (const doc of linkedClaim?.exists ? [linkedClaim] : claims?.docs || []) {
        const data = doc.data();
        if (!data || data.projectId !== projectId || data.portionId !== portionId) continue;
        const current = portion.claimId ? portion.claimId === doc.id : data.userId === portion.claimedBy &&
          (data.claimedAt == null || portion.claimedAt == null || data.claimedAt === portion.claimedAt);
        if (current && data.status === "active" && !data.isParent) tx.update(doc.ref, values);
      }
    } else if (changed) {
      tx.update(claimRef!, values);
    }
    return changed;
  });
}

export async function checkInClaim(db: Firestore, projectId: string, claimId: string, uid: string, now = Date.now(), collection: "lzecher_claims" | "lzecher_inclusive_claims" = "lzecher_claims") {
  return runLearningTransaction(db, async tx => {
    const project = await tx.get(db.collection("lzecher_projects").doc(projectId));
    if (project.data()?.maintenanceLock || project.data()?.status === "deleted") throw new ClaimError(423, "Project unavailable");
    const ref = db.collection(collection).doc(claimId);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new ClaimError(404, "Claim not found");
    const claim = snap.data()!;
    if (claim.projectId !== projectId) throw new ClaimError(400, "Claim not in project");
    if (claim.userId !== uid) throw new ClaimError(403, "This learning entry belongs to another participant");
    if (!["daily", "weekly"].includes(claim.duration)) throw new ClaimError(400, "This commitment does not support check-ins");
    const period = claim.duration === "weekly" ? 7 * 86400000 : 86400000;
    const progress = claim.progress || { completed: 0, total: 0 };
    const last = claim.lastCheckIn || 0;
    const duplicate = last > 0 && (claim.duration === "daily"
      ? Math.floor(now / period) === Math.floor(last / period) : now - last < period);
    if (claim.status !== "active" && !(duplicate && claim.status === "completed")) throw new ClaimError(409, "Claim is not active");
    const completed = progress.completed + (duplicate ? 0 : 1);
    const streak = duplicate ? (claim.currentStreak || 0) : last && now - last > period * 2 ? 1 : (claim.currentStreak || 0) + 1;
    const longest = Math.max(claim.longestStreak || 0, streak);
    const done = progress.total > 0 && completed >= progress.total;
    if (!duplicate) tx.update(ref, { "progress.completed": completed, lastCheckIn: now,
      currentStreak: streak, longestStreak: longest, ...(done ? { status: "completed", completedAt: now } : {}) });
    return { completed, total: progress.total, currentStreak: streak, longestStreak: longest, claimCompleted: done };
  });
}
