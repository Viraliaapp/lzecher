import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { ClaimError } from "./claim-management";
import { getClaimMode } from "./track-config";
import type { TrackType } from "./types";

export function validateProject(project: DocumentData | undefined, access: boolean, uid?: string) {
  if (!project) throw new ClaimError(404, "Project not found");
  if (project.locked) throw new ClaimError(423, "This memorial is locked");
  if (!["active", "completed", "pending_moderation"].includes(project.status)) {
    throw new ClaimError(403, "This memorial is not available");
  }
  if (project.passwordHash && !access && project.createdBy !== uid) throw new ClaimError(403, "Memorial password required");
}

/** Availability, project access and the claim/portion write share one transaction.
 * Each chunk is independently durable; retrying a large interrupted reservation
 * skips already reserved portions. No Firestore transaction exceeds 401 writes. */
export async function reserveClaims(
  db: Firestore, projectId: string, portionIds: string[], values: DocumentData,
  options: { access: boolean; allowInclusive?: boolean; parent?: DocumentData; parentId?: string },
) {
  const ids = [...new Set(portionIds)];
  const reserved: { id: string; claimId: string; data: DocumentData }[] = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const chunk = ids.slice(offset, offset + 200);
    const committed = await db.runTransaction(async (tx) => {
      const projectRef = db.collection("lzecher_projects").doc(projectId);
      const project = await tx.get(projectRef);
      validateProject(project.data(), options.access, values.userId);
      const parentRef = options.parentId ? db.collection("lzecher_claims").doc(options.parentId) : null;
      const parent = parentRef ? await tx.get(parentRef) : null;
      const portions = await tx.getAll(...chunk.map(id => db.collection("lzecher_portions").doc(id)));
      const prior = options.allowInclusive ? await tx.get(db.collection("lzecher_claims")
        .where("projectId", "==", projectId).where("userId", "==", values.userId)) : null;
      const accepted: typeof reserved = [];
      for (const snap of portions) {
        if (!snap.exists) continue;
        const portion = snap.data()!;
        if (portion.projectId !== projectId) throw new ClaimError(400, "Portion not in project");
        const mode = portion.claimMode ?? getClaimMode(portion.trackType as TrackType);
        if (mode === "inclusive" && !options.allowInclusive) continue;
        if (mode === "inclusive" && values.userId === "anonymous") throw new ClaimError(401, "Sign-in required");
        if (mode === "inclusive" && prior?.docs.some(d => {
          const claim = d.data();
          return claim.portionId === snap.id && claim.status === "active" &&
            ["duration", "durationValue", "durationEndDate", "specificItem"].every(key => (claim[key] ?? null) === (values[key] ?? null));
        })) continue;
        if (mode === "exclusive" && portion.status !== "available") continue;
        const claimRef = db.collection("lzecher_claims").doc();
        tx.set(claimRef, {
          ...values, id: claimRef.id, projectId, portionId: snap.id,
          trackType: portion.trackType, reference: portion.reference || "", claimMode: mode,
          ...(parentRef ? { parentClaimId: parentRef.id, isParent: false, scope: "single" } : {}),
        });
        tx.update(snap.ref, mode === "exclusive" ? {
          status: "claimed", claimedBy: values.userId, claimedByName: values.userName,
          claimedAt: values.claimedAt, claimId: claimRef.id,
          claimedByParentClaimId: parentRef?.id ?? null,
          completedAt: null, completedByName: null, completedByEmail: null, completedByUid: null,
        } : {
          currentClaimerCount: (portion.currentClaimerCount || 0) + 1,
          claimerNames: [...(portion.claimerNames || []), values.userName],
        });
        accepted.push({ id: snap.id, claimId: claimRef.id, data: portion });
      }
      if (parentRef && accepted.length) {
        tx.set(parentRef, {
          ...values, ...options.parent, id: parentRef.id, projectId, isParent: true,
          portionIds: [...(parent?.data()?.portionIds || []), ...accepted.map(p => p.id)],
        });
      }
      return accepted;
    });
    reserved.push(...committed);
  }
  return reserved;
}
