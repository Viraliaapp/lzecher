import {
  initializeApp,
  getApps,
  cert,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

type StorageBucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedBucket: StorageBucket | null = null;
let cachedApp: App | undefined;

function getApp(): App {
  if (cachedApp) return cachedApp;

  cachedApp = getApps()[0];
  if (cachedApp) return cachedApp;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (clientEmail && privateKeyRaw && projectId) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    cachedApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    return cachedApp;
  }

  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saRaw) {
    cachedApp = initializeApp({
      credential: cert(JSON.parse(saRaw)),
      projectId,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
    return cachedApp;
  }

  cachedApp = initializeApp({
    projectId,
    storageBucket:
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getApp());
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getApp());
  return cachedAuth;
}

export function getAdminStorageBucket(): StorageBucket {
  if (cachedBucket) return cachedBucket;
  const bucketName =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  cachedBucket = bucketName
    ? getStorage(getApp()).bucket(bucketName)
    : getStorage(getApp()).bucket();
  return cachedBucket;
}
