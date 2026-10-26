import type { Firestore } from "firebase-admin/firestore";
import { getClaimMode } from "./track-config";
import type { TrackType } from "./types";

export class ClaimError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function claimName(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100) {
    throw new ClaimError(400, "Name must contain between 1 and 100 characters");
  }
  return value.trim();
}

/** Change the learning entry and public portion together. Bulk parents are summaries. */
export async function manageClaim(
  db: Firestore, projectId: string, claimId: string,
  actor: { uid: string; isAdmin?: boolean; isSuperAdmin?: boolean },
  action: { type: "rename"; name: string } | { type: "delete" },
) {
  const name = action.type === "rename" ? claimName(action.name) : null;
  await db.runTransaction(async (tx) => {
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const claimRef = db.collection("lzecher_claims").doc(claimId);
    const project = await tx.get(projectRef);
    if (!project.exists) throw new ClaimError(404, "Project not found");
    if (project.data()!.createdBy !== actor.uid && !actor.isAdmin && !actor.isSuperAdmin) {
      throw new ClaimError(403, "Forbidden");
    }
    const snap = await tx.get(claimRef);
    // Retrying DELETE after a lost response must not decrement counters again.
    if (!snap.exists && action.type === "delete") return;
    if (!snap.exists) throw new ClaimError(404, "Claim not found");
    const claim = snap.data()!;
    if (claim.projectId !== projectId) throw new ClaimError(400, "Claim not in project");
    if (claim.isParent) throw new ClaimError(409, "Edit the individual learning entries in this group");

    if (claim.portionId) {
      const portionRef = db.collection("lzecher_portions").doc(claim.portionId);
      const portion = await tx.get(portionRef);
      if (!portion.exists && action.type === "rename") {
        throw new ClaimError(409, "The learning portion no longer exists");
      }
      if (portion.exists) {
        const data = portion.data()!;
        if (data.projectId !== projectId) throw new ClaimError(409, "Portion not in project");
        const mode = data.claimMode ?? getClaimMode(data.trackType as TrackType);
        if (mode === "inclusive") {
          // Rebuild from claim identities so equal display names remain distinct.
          const siblings = await tx.get(db.collection("lzecher_claims")
            .where("projectId", "==", projectId).where("portionId", "==", claim.portionId));
          const names = siblings.docs.filter((d) => !d.data().isParent &&
            (action.type !== "delete" || d.id !== claimId))
            .map((d) => d.id === claimId ? name! : d.data().userName)
            .filter((n): n is string => typeof n === "string");
          tx.update(portionRef, { claimerNames: names, currentClaimerCount: names.length });
        } else {
          // Never release or rename a replacement claim after an interrupted reset.
          const stale = data.claimId ? data.claimId !== claimId :
            data.claimedBy !== claim.userId ||
            (data.claimedAt != null && claim.claimedAt != null && data.claimedAt !== claim.claimedAt);
          if (stale || data.status === "available") {
            throw new ClaimError(409, "The portion has changed; reload before editing");
          }
          tx.update(portionRef, action.type === "rename" ? { claimedByName: name } : {
            status: "available", claimedBy: null, claimedByName: null, claimedAt: null,
            claimId: null, claimedByParentClaimId: null, completedAt: null,
            completedByName: null, completedByEmail: null, completedByUid: null,
          });
        }
      }
    }
    if (action.type === "rename") tx.update(claimRef, { userName: name });
    else tx.delete(claimRef);
  });
}
