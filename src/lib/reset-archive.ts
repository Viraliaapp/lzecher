import { recomputeGlobalStats } from "@/lib/recompute-global";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { FieldValue } from "firebase-admin/firestore";
import { isDeepStrictEqual } from "node:util";

export const RESET_UNDO_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH_CHUNK = 400;
const ARCHIVED_COLLECTIONS = ["claims", "portions", "scheduledEmails"] as const;

type SnapshotDoc = FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>;
type ArchivedCollectionName = (typeof ARCHIVED_COLLECTIONS)[number];

function cloneDocData(data: FirebaseFirestore.DocumentData) {
  return { ...data };
}

async function writeArchiveDocs(
  archiveRef: FirebaseFirestore.DocumentReference,
  collectionName: ArchivedCollectionName,
  docs: SnapshotDoc[]
) {
  for (let i = 0; i < docs.length; i += BATCH_CHUNK) {
    const batch = archiveRef.firestore.batch();
    for (const d of docs.slice(i, i + BATCH_CHUNK)) {
      batch.set(archiveRef.collection(collectionName).doc(d.id), {
        id: d.id,
        ...cloneDocData(d.data()),
      });
    }
    await batch.commit();
  }
}

async function fetchProjectState(db: FirebaseFirestore.Firestore, projectId: string) {
  const [claims, portions, scheduledEmails] = await Promise.all([
    db.collection("lzecher_claims").where("projectId", "==", projectId).get(),
    db.collection("lzecher_portions").where("projectId", "==", projectId).get(),
    db.collection("lzecher_scheduled_emails").where("projectId", "==", projectId).get(),
  ]);

  return { claims: claims.docs, portions: portions.docs, scheduledEmails: scheduledEmails.docs };
}

export async function archiveProjectLearningState(params: {
  db: FirebaseFirestore.Firestore;
  projectId: string;
  projectData: FirebaseFirestore.DocumentData;
  actorUid: string;
  actorEmail?: string;
  reason: "reset_claims" | "before_restore_reset_archive";
  restoreStatus?: "available" | "rollback_snapshot";
  sourceArchiveId?: string;
}) {
  const { db, projectId, projectData, actorUid, actorEmail, reason, sourceArchiveId } = params;
  const { claims, portions, scheduledEmails } = await fetchProjectState(db, projectId);
  const createdAt = Date.now();
  const archiveRef = db.collection("lzecher_reset_archives").doc(`${projectId}_${createdAt}`);

  await archiveRef.set({
    schemaVersion: 1,
    projectId,
    projectSlug: projectData.slug || null,
    honoreeName: projectData.nameHebrew || projectData.name || null,
    actorUid,
    actorEmail: actorEmail || null,
    createdAt,
    expiresAt: createdAt + RESET_UNDO_WINDOW_MS,
    reason,
    sourceArchiveId: sourceArchiveId || null,
    restoreStatus: "building",
    counts: {
      claims: claims.length,
      portions: portions.length,
      scheduledEmails: scheduledEmails.length,
    },
    projectSnapshot: {
      id: projectId,
      ...cloneDocData(projectData),
    },
  });

  await writeArchiveDocs(archiveRef, "claims", claims);
  await writeArchiveDocs(archiveRef, "portions", portions);
  await writeArchiveDocs(archiveRef, "scheduledEmails", scheduledEmails);
  for (const [name, originals] of Object.entries({ claims, portions, scheduledEmails })) {
    const saved = await archiveRef.collection(name).get();
    const byId = new Map(saved.docs.map(doc => [doc.id, doc.data()]));
    if (saved.size !== originals.length || originals.some(doc =>
      !isDeepStrictEqual(byId.get(doc.id), { id: doc.id, ...doc.data() }))) {
      throw new Error("Reset archive verification failed; original learning must remain untouched");
    }
  }
  await archiveRef.update({ restoreStatus: params.restoreStatus || (reason === "reset_claims" ? "available" : "rollback_snapshot"), verifiedAt: Date.now() });

  return {
    archiveId: archiveRef.id,
    counts: {
      claims: claims.length,
      portions: portions.length,
      scheduledEmails: scheduledEmails.length,
    },
    expiresAt: createdAt + RESET_UNDO_WINDOW_MS,
  };
}

async function deleteProjectDocs(db: FirebaseFirestore.Firestore, collectionName: string, projectId: string) {
  const snap = await db.collection(collectionName).where("projectId", "==", projectId).get();
  for (let i = 0; i < snap.docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_CHUNK)) batch.delete(doc.ref);
    await batch.commit();
  }
  return snap.size;
}

async function restoreArchivedDocs(
  db: FirebaseFirestore.Firestore,
  archiveRef: FirebaseFirestore.DocumentReference,
  targetCollectionName: string,
  archiveCollectionName: ArchivedCollectionName
) {
  const snap = await archiveRef.collection(archiveCollectionName).get();
  for (let i = 0; i < snap.docs.length; i += BATCH_CHUNK) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_CHUNK)) {
      const data = doc.data();
      batch.set(db.collection(targetCollectionName).doc(doc.id), {
        ...data,
        ...(archiveCollectionName === "scheduledEmails" && data.status === "pending" ? { status: "canceled", cancelReason: "restored_archive_no_email_replay" } : {}),
        id: data.id || doc.id,
      });
    }
    await batch.commit();
  }
  return snap.size;
}

export async function listAvailableResetArchives(params: {
  db: FirebaseFirestore.Firestore;
  projectId: string;
}) {
  const now = Date.now();
  const snap = await params.db
    .collection("lzecher_reset_archives")
    .where("projectId", "==", params.projectId)
    .get();

  return snap.docs
    .map((doc) => {
      const data = doc.data();
      const expiresAt = Number(data.expiresAt || (Number(data.createdAt || 0) + RESET_UNDO_WINDOW_MS));
      return {
        id: doc.id,
        projectId: data.projectId,
        createdAt: Number(data.createdAt || 0),
        expiresAt,
        reason: data.reason || "reset_claims",
        restoreStatus: data.restoreStatus || "available",
        counts: data.counts || {},
        isExpired: expiresAt <= now,
      };
    })
    .filter((archive) => archive.reason === "reset_claims" && archive.restoreStatus === "available")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function restoreResetArchive(params: {
  db: FirebaseFirestore.Firestore;
  projectId: string;
  archiveId: string;
  actorUid: string;
  actorEmail?: string;
  allowExpired?: boolean;
}) {
  const { db, projectId, archiveId, actorUid, actorEmail, allowExpired } = params;
  const archiveRef = db.collection("lzecher_reset_archives").doc(archiveId);
  const archiveSnap = await archiveRef.get();
  if (!archiveSnap.exists) return { restored: false as const, reason: "archive_not_found" as const };

  const archive = archiveSnap.data()!;
  if (archive.projectId !== projectId) return { restored: false as const, reason: "project_mismatch" as const };
  if (archive.reason !== "reset_claims") return { restored: false as const, reason: "not_reset_archive" as const };
  if ((archive.restoreStatus || "available") !== "available") return { restored: false as const, reason: "archive_not_available" as const };

  const expiresAt = Number(archive.expiresAt || (Number(archive.createdAt || 0) + RESET_UNDO_WINDOW_MS));
  if (!allowExpired && expiresAt <= Date.now()) {
    return { restored: false as const, reason: "restore_window_expired" as const, expiresAt };
  }

  const projectRef = db.collection("lzecher_projects").doc(projectId);
  for (const name of ARCHIVED_COLLECTIONS) {
    const saved = await archiveRef.collection(name).get();
    if (saved.size !== Number(archive.counts?.[name])) {
      return { restored: false as const, reason: "archive_not_available" as const };
    }
  }
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) return { restored: false as const, reason: "project_not_found" as const };

  // Never erase learning accepted after the reset. Such cases need a reviewed merge.
  const canRestore = await db.runTransaction(async tx => {
    const current = await tx.get(projectRef);
    const claims = await tx.get(db.collection("lzecher_claims").where("projectId", "==", projectId).limit(1));
    const portions = await tx.get(db.collection("lzecher_portions").where("projectId", "==", projectId).where("status", "in", ["claimed", "completed"]).limit(1));
    if (current.data()?.maintenanceLock || current.data()?.status === "deleted" || !claims.empty || !portions.empty) return false;
    tx.update(projectRef, { maintenanceLock: { action: "restore", archiveId, startedAt: Date.now() } });
    return true;
  });
  if (!canRestore) return { restored: false as const, reason: "new_learning_requires_review" as const };

  const rollback = await archiveProjectLearningState({
    db,
    projectId,
    projectData: projectSnap.data()!,
    actorUid,
    actorEmail,
    reason: "before_restore_reset_archive",
    restoreStatus: "rollback_snapshot",
    sourceArchiveId: archiveId,
  });

  const deleted = {
    claims: await deleteProjectDocs(db, "lzecher_claims", projectId),
    portions: await deleteProjectDocs(db, "lzecher_portions", projectId),
    scheduledEmails: await deleteProjectDocs(db, "lzecher_scheduled_emails", projectId),
  };

  const restored = {
    claims: await restoreArchivedDocs(db, archiveRef, "lzecher_claims", "claims"),
    portions: await restoreArchivedDocs(db, archiveRef, "lzecher_portions", "portions"),
    scheduledEmails: await restoreArchivedDocs(db, archiveRef, "lzecher_scheduled_emails", "scheduledEmails"),
  };

  const projectSnapshot = archive.projectSnapshot || {};
  await projectRef.set({
    ...projectSnapshot,
    id: projectId,
    hasEverHadActivity: true,
    restoredFromResetArchive: {
      archiveId,
      restoredAt: Date.now(),
      restoredBy: actorUid,
      rollbackArchiveId: rollback.archiveId,
    },
    updatedAt: Date.now(),
    maintenanceLock: FieldValue.delete(),
  }, { merge: true });

  await recomputeProjectProgress(db, projectId);
  await recomputeGlobalStats(db);

  await archiveRef.update({
    restoreStatus: "restored",
    restoredAt: Date.now(),
    restoredBy: actorUid,
    rollbackArchiveId: rollback.archiveId,
  });

  await db.collection("lzecher_admin_audit").add({
    action: "restore_reset_archive",
    projectId,
    adminUid: actorUid,
    timestamp: Date.now(),
    archiveId,
    rollbackArchiveId: rollback.archiveId,
    deleted,
    restored,
  });

  return { restored: true as const, archiveId, rollbackArchiveId: rollback.archiveId, deleted, restoredCounts: restored };
}
