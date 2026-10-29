import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { getAdminDb, getAdminStorageBucket } from "@/lib/firebase/admin";

const LZECHER_PREFIX = "lzecher_";
const BACKUP_INTERNAL_COLLECTIONS = new Set(["lzecher_backup_runs"]);
// These are the parent collections with nested records in the verified database
// inventory. Backup chunks are deliberately excluded to avoid recursive growth.
const NESTED_ROOTS = new Set(["lzecher_reset_archives", "lzecher_ync_tehillim_events"]);
const FIRESTORE_CHUNK_BYTES = 350_000;

function serializeFirestoreValue(value: unknown): unknown {
  if (value && typeof value === "object" && "toDate" in value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

function cleanDocData(data: FirebaseFirestore.DocumentData) {
  return JSON.parse(JSON.stringify(data, (_key, value) => serializeFirestoreValue(value)));
}
function typedFields(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  return (doc as unknown as { _fieldsProto: Record<string, unknown> })._fieldsProto;
}

async function exportResetArchiveSubcollections(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const subcollections: Record<string, Array<{ id: string; data: FirebaseFirestore.DocumentData }>> = {};

  for (const collectionRef of await doc.ref.listCollections()) {
    const collectionName = collectionRef.id;
    const snap = await collectionRef.get();
    if (snap.empty) continue;
    subcollections[collectionName] = await Promise.all(snap.docs.map(async (subDoc) => ({
      id: subDoc.id,
      data: cleanDocData(subDoc.data()),
      fields: typedFields(subDoc),
      subcollections: await exportResetArchiveSubcollections(subDoc),
    })));
  }

  return Object.keys(subcollections).length ? subcollections : undefined;
}

export async function createLzecherDailyBackup(params: {
  reason?: string;
  actor?: string;
} = {}) {
  const startedAt = Date.now();
  const db = getAdminDb();
  const collections = await db.listCollections();
  const lzecherCollections = collections
    .filter((collection) => collection.id.startsWith(LZECHER_PREFIX) && !BACKUP_INTERNAL_COLLECTIONS.has(collection.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const payload: {
    schemaVersion: number;
    exportedAt: string;
    exportedAtMs: number;
    reason: string;
    actor: string;
    projectId: string | null;
    scope: string;
    collections: Record<string, Array<{
      id: string;
      data: FirebaseFirestore.DocumentData;
      subcollections?: Record<string, Array<{ id: string; data: FirebaseFirestore.DocumentData }>>;
    }>>;
  } = {
    schemaVersion: 1,
    exportedAt: new Date(startedAt).toISOString(),
    exportedAtMs: startedAt,
    reason: params.reason || "daily_cron",
    actor: params.actor || "vercel_cron",
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || null,
    scope: "root collections beginning with lzecher_; reset archive subcollections included",
    collections: {},
  };

  const counts: Record<string, number> = {};
  for (const collectionRef of lzecherCollections) {
    const snap = await collectionRef.get();
    counts[collectionRef.id] = snap.size;
    payload.collections[collectionRef.id] = [];

    for (const doc of snap.docs) {
      const exportedDoc: {
        id: string;
        data: FirebaseFirestore.DocumentData;
        fields: Record<string, unknown>;
        subcollections?: Record<string, Array<{ id: string; data: FirebaseFirestore.DocumentData }>>;
      } = {
        id: doc.id,
        data: cleanDocData(doc.data()),
        fields: typedFields(doc),
      };

      if (NESTED_ROOTS.has(collectionRef.id)) {
        exportedDoc.subcollections = await exportResetArchiveSubcollections(doc);
      }

      payload.collections[collectionRef.id].push(exportedDoc);
    }
  }

  const dayKey = new Date(startedAt).toISOString().slice(0, 10);
  const objectPath = `lzecher/backups/daily/${dayKey}/lzecher-${new Date(startedAt).toISOString().replace(/[:.]/g, "-")}.json.gz`;
  const json = JSON.stringify(payload);
  const gzipped = gzipSync(Buffer.from(json, "utf8"), { level: 9 });
  const runRef = db.collection("lzecher_backup_runs").doc(`${dayKey}_${startedAt}`);
  let storageBackend: "firebase_storage" | "firestore_chunks" = "firebase_storage";
  let bucketName: string | null = null;
  let storedObjectPath = objectPath;
  let storageError: string | null = null;
  let chunkCount = 0;

  try {
    const bucket = getAdminStorageBucket();
    await bucket.file(objectPath).save(gzipped, {
      resumable: false,
      metadata: {
        contentType: "application/json",
        contentEncoding: "gzip",
        cacheControl: "private, no-store",
        metadata: {
          scope: "lzecher-only",
          reason: payload.reason,
          exportedAt: payload.exportedAt,
        },
      },
    });
    const [saved] = await bucket.file(objectPath).download();
    if (!saved.equals(gzipped)) throw new Error("Backup verification failed");
    bucketName = bucket.name;
  } catch (err) {
    storageBackend = "firestore_chunks";
    storageError = err instanceof Error ? err.message : "Unknown storage error";
    storedObjectPath = `${runRef.path}/chunks`;

    for (let offset = 0; offset < gzipped.length; offset += FIRESTORE_CHUNK_BYTES) {
      const bytes = gzipped.subarray(offset, offset + FIRESTORE_CHUNK_BYTES);
      const chunkId = String(chunkCount).padStart(5, "0");
      await runRef.collection("chunks").doc(chunkId).set({
        index: chunkCount,
        byteOffset: offset,
        byteLength: bytes.length,
        contentEncoding: "gzip",
        encoding: "base64",
        data: bytes.toString("base64"),
      });
      chunkCount += 1;
    }
    const saved = await runRef.collection("chunks").orderBy("index").get();
    const bytes = Buffer.concat(saved.docs.map(doc => Buffer.from(doc.data().data, "base64")));
    if (!bytes.equals(gzipped)) throw new Error("Chunk backup verification failed");
  }

  const finishedAt = Date.now();
  const run = {
    id: runRef.id,
    type: "daily",
    status: "success",
    scope: "lzecher-only",
    reason: payload.reason,
    actor: payload.actor,
    storageBackend,
    bucket: bucketName,
    objectPath: storedObjectPath,
    storageError,
    chunkCount,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    collectionCount: lzecherCollections.length,
    counts,
    uncompressedBytes: Buffer.byteLength(json, "utf8"),
    compressedBytes: gzipped.length,
    sha256: createHash("sha256").update(gzipped).digest("hex"),
  };

  await runRef.set(run);
  return run;
}
