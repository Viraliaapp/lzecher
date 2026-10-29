import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";
import type * as FirebaseFirestore from "@google-cloud/firestore";

const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH_CHUNK = 400;

export const PROJECT_RESTORE_WINDOW_MS = 60 * DAY_MS;

const HARD_PURGE_COLLECTIONS = [
  "lzecher_portions",
  "lzecher_claims",
  "lzecher_reports",
  "lzecher_contact_messages",
  "lzecher_scheduled_emails",
] as const;

export function deletedProjectSummary(projectData: FirebaseFirestore.DocumentData) {
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
    participantCount: projectData.participantCount || 0,
    isPasswordProtected: Boolean(projectData.passwordHash),
  };
}

export async function projectHasAnyActivity(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  projectData?: FirebaseFirestore.DocumentData | null
) {
  if (projectData) {
    if (
      projectData.hasEverHadActivity === true ||
      Number(projectData.claimedPortions || 0) > 0 ||
      Number(projectData.completedPortions || 0) > 0 ||
      Number(projectData.participantCount || 0) > 0
    ) {
      return true;
    }
  }

  const claimsSnap = await db
    .collection("lzecher_claims")
    .where("projectId", "==", projectId)
    .limit(1)
    .get();

  if (!claimsSnap.empty) return true;
  const archives = await db.collection("lzecher_reset_archives").where("projectId", "==", projectId).limit(1).get();
  return !archives.empty;
}

export async function cancelPendingProjectEmails(
  db: FirebaseFirestore.Firestore,
  projectId: string,
  now: number,
  reason: string
) {
  const snap = await db
    .collection("lzecher_scheduled_emails")
    .where("projectId", "==", projectId)
    .where("status", "==", "pending")
    .get();

  for (let i = 0; i < snap.docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_CHUNK)) {
      batch.update(doc.ref, {
        status: "canceled",
        canceledAt: now,
        cancelledAt: now,
        cancelReason: reason,
        cancelledReason: reason,
        lastError: null,
        failedAt: null,
      });
    }
    await batch.commit();
  }

  return snap.size;
}

export async function softDeleteProject(params: {
  db?: FirebaseFirestore.Firestore;
  projectId: string;
  actorUid: string;
  source: string;
  reason?: string | null;
  now?: number;
  requireZeroActivity?: boolean;
}) {
  const db = params.db || getAdminDb();
  const now = params.now ?? Date.now();
  const projectRef = db.collection("lzecher_projects").doc(params.projectId);
  const projectSnap = await projectRef.get();

  if (!projectSnap.exists) {
    return { deleted: false, reason: "project_not_found" as const };
  }

  const projectData = projectSnap.data() || {};
  if (projectData.status === "deleted") {
    return {
      deleted: true,
      alreadyDeleted: true,
      restoreUntil: Number(projectData.restoreUntil || 0) || null,
    };
  }

  if (params.requireZeroActivity && await projectHasAnyActivity(db, params.projectId, projectData)) {
    return { deleted: false, reason: "project_has_activity" as const };
  }

  const restoreUntil = now + PROJECT_RESTORE_WINDOW_MS;
  const previousStatus =
    typeof projectData.status === "string" && projectData.status && projectData.status !== "deleted"
      ? projectData.status
      : "active";

  const deleted = await db.runTransaction(async tx => {
    const current = await tx.get(projectRef);
    const value = current.data();
    if (!value || value.maintenanceLock) return false;
    if (params.requireZeroActivity) {
      const claims = await tx.get(db.collection("lzecher_claims").where("projectId", "==", params.projectId).limit(1));
      const archives = await tx.get(db.collection("lzecher_reset_archives").where("projectId", "==", params.projectId).limit(1));
      if (value.status !== "active" || value.hasEverHadActivity || value.claimedPortions > 0 || value.completedPortions > 0 || value.participantCount > 0 || !claims.empty || !archives.empty) return false;
    }
    tx.update(projectRef, {
      status: "deleted", previousStatus, deletedAt: now, deletedBy: params.actorUid,
      deleteSource: params.source, deleteReason: params.reason || null, restoreUntil,
      updatedAt: now, updatedBy: params.actorUid,
    });
    return true;
  });
  if (!deleted) return { deleted: false, reason: "project_has_activity" as const };

  const canceledEmails = await cancelPendingProjectEmails(
    db,
    params.projectId,
    now,
    params.source === "zero_claim_inactivity" ? "project_auto_deleted_zero_claims" : "project_deleted"
  );

  await db.collection("lzecher_admin_audit").add({
    action: params.source === "zero_claim_inactivity" ? "auto_soft_delete_project" : "soft_delete_project",
    projectId: params.projectId,
    adminUid: params.actorUid === "system" ? null : params.actorUid,
    deletedBy: params.actorUid,
    deletedAt: now,
    at: now,
    timestamp: now,
    details: {
      source: params.source,
      reason: params.reason || null,
      restoreUntil,
      canceledPendingEmails: canceledEmails,
      project: deletedProjectSummary(projectData),
    },
  });

  return { deleted: true, restoreUntil, canceledEmails };
}

export async function restoreProject(params: {
  projectId: string;
  actorUid: string;
  now?: number;
}) {
  const db = getAdminDb();
  const now = params.now ?? Date.now();
  const projectRef = db.collection("lzecher_projects").doc(params.projectId);
  const projectSnap = await projectRef.get();

  if (!projectSnap.exists) {
    return { restored: false, reason: "project_not_found" as const };
  }

  const projectData = projectSnap.data() || {};
  if (projectData.status !== "deleted") {
    return { restored: false, reason: "project_not_deleted" as const };
  }
  if (projectData.maintenanceLock) return { restored: false, reason: "project_locked" as const };

  const restoreUntil = Number(projectData.restoreUntil || 0);
  if (!restoreUntil || restoreUntil < now) {
    return { restored: false, reason: "restore_window_expired" as const, restoreUntil };
  }

  const nextStatus =
    typeof projectData.previousStatus === "string" &&
    projectData.previousStatus &&
    projectData.previousStatus !== "deleted"
      ? projectData.previousStatus
      : "active";

  await db.runTransaction(async tx => {
    const current = await tx.get(projectRef);
    if (current.data()?.status !== "deleted" || current.data()?.maintenanceLock || Number(current.data()?.restoreUntil || 0) < now) throw new Error("Project is no longer restorable");
    tx.update(projectRef, {
    status: nextStatus,
    restoredAt: now,
    restoredBy: params.actorUid,
    updatedAt: now,
    updatedBy: params.actorUid,
    lastDeletedAt: projectData.deletedAt || null,
    lastDeleteSource: projectData.deleteSource || null,
    previousStatus: FieldValue.delete(),
    deletedAt: FieldValue.delete(),
    deletedBy: FieldValue.delete(),
    deleteSource: FieldValue.delete(),
    deleteReason: FieldValue.delete(),
    restoreUntil: FieldValue.delete(),
    });
  });

  await db.collection("lzecher_admin_audit").add({
    action: "restore_project",
    projectId: params.projectId,
    adminUid: params.actorUid,
    at: now,
    timestamp: now,
    details: {
      restoredToStatus: nextStatus,
      project: deletedProjectSummary(projectData),
    },
  });

  return { restored: true, status: nextStatus };
}

export async function hardPurgeDeletedProject(params: {
  db: FirebaseFirestore.Firestore;
  projectId: string;
  projectData: FirebaseFirestore.DocumentData;
  now: number;
  source: string;
}) {
  const restoreUntil = Number(params.projectData.restoreUntil || 0);
  if (params.projectData.status !== "deleted" || !restoreUntil || restoreUntil > params.now) {
    return { purged: false, reason: "not_eligible" as const };
  }

  const counts: Record<string, number> = {};
  const ref = params.db.collection("lzecher_projects").doc(params.projectId);
  const eligible = await params.db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    const p = snap.data();
    if (!p || p.status !== "deleted" || !p.restoreUntil || p.restoreUntil > params.now || (p.maintenanceLock && p.maintenanceLock.action !== "purge")) return false;
    tx.update(ref, { maintenanceLock: { action: "purge", startedAt: params.now } });
    return true;
  });
  if (!eligible) return { purged: false, reason: "not_eligible" as const };
  for (const collection of HARD_PURGE_COLLECTIONS) {
    const snap = await params.db
      .collection(collection)
      .where("projectId", "==", params.projectId)
      .get();
    counts[collection] = snap.size;
    await deleteDocsInChunks(params.db, snap.docs);
  }

  const firestorePhotoSnap = await params.db.collection("lzecher_project_photos").doc(params.projectId).get();
  if (firestorePhotoSnap.exists) {
    await firestorePhotoSnap.ref.delete();
  }

  let storageFilesDeleted = 0;
  try {
    const creatorUid = params.projectData.createdBy;
    if (typeof creatorUid === "string" && creatorUid) {
      const [files] = await getAdminStorageBucket().getFiles({
        prefix: `lzecher/photos/${creatorUid}/${params.projectId}`,
      });
      const prefix = `lzecher/photos/${creatorUid}/${params.projectId}`;
      const matching = files.filter(file => file.name === prefix || file.name.startsWith(`${prefix}/`) || file.name.startsWith(`${prefix}.`));
      await Promise.all(matching.map((file) => file.delete()));
      storageFilesDeleted = matching.length;
    }
  } catch (photoErr) {
    console.error("[project-lifecycle] photo purge failed:", photoErr);
  }

  await params.db.collection("lzecher_admin_audit").add({
    action: "hard_purge_deleted_project",
    projectId: params.projectId,
    deletedAt: params.now,
    at: params.now,
    timestamp: params.now,
    details: {
      source: params.source,
      restoreUntil,
      counts,
      firestorePhotoDeleted: firestorePhotoSnap.exists,
      storageFilesDeleted,
      project: deletedProjectSummary(params.projectData),
    },
  });

  await params.db.collection("lzecher_projects").doc(params.projectId).delete();

  return {
    purged: true,
    counts,
    firestorePhotoDeleted: firestorePhotoSnap.exists,
    storageFilesDeleted,
  };
}

export async function purgeExpiredDeletedProjects(options: { now?: number; limit?: number } = {}) {
  const db = getAdminDb();
  const now = options.now ?? Date.now();
  const limit = Math.max(1, Math.min(options.limit ?? 5, 20));
  const backups = await db.collection("lzecher_backup_runs").where("status", "==", "success").get();
  if (!backups.docs.some(doc => Number(doc.data().finishedAt || 0) >= now - DAY_MS)) return { checked: 0, purged: 0, projectIds: [], skipped: "recent_backup_required" };
  const snap = await db
    .collection("lzecher_projects")
    .where("status", "==", "deleted")
    .get();

  let checked = 0;
  let purged = 0;
  const projectIds: string[] = [];

  for (const doc of snap.docs) {
    if (checked >= limit) break;
    const data = doc.data();
    const restoreUntil = Number(data.restoreUntil || 0);
    if (!restoreUntil || restoreUntil > now) continue;
    checked++;
    const result = await hardPurgeDeletedProject({
      db,
      projectId: doc.id,
      projectData: data,
      now,
      source: "restore_window_expired",
    });
    if (result.purged) {
      purged++;
      projectIds.push(doc.id);
    }
  }

  return { checked, purged, projectIds };
}

async function deleteDocsInChunks(
  db: FirebaseFirestore.Firestore,
  docs: FirebaseFirestore.QueryDocumentSnapshot[]
) {
  for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + BATCH_CHUNK)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}
