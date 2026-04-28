import { createRequire } from "node:module";
import type { App } from "firebase-admin/app";
import type { Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";

function nodeRequire<T = unknown>(mod: string): T {
  const anchor = `file://${process.cwd().replace(/\\/g, "/")}/package.json`;
  const r = createRequire(anchor);
  return r(mod) as T;
}

let cachedDb: Firestore | null = null;
let cachedAuth: Auth | null = null;
let cachedApp: App | undefined;

function getApp(): App {
  if (cachedApp) return cachedApp;

  const appMod =
    nodeRequire<typeof import("firebase-admin/app")>("firebase-admin/app");

  cachedApp = appMod.getApps()[0];
  if (cachedApp) return cachedApp;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Option 1: Individual env vars (FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY)
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (clientEmail && privateKeyRaw && projectId) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    cachedApp = appMod.initializeApp({
      credential: appMod.cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
    return cachedApp;
  }

  // Option 2: Full service account JSON
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saRaw) {
    cachedApp = appMod.initializeApp({
      credential: appMod.cert(JSON.parse(saRaw)),
      projectId,
    });
    return cachedApp;
  }

  // Option 3: No credentials (works on GCP with default credentials)
  cachedApp = appMod.initializeApp({ projectId });
  return cachedApp;
}

export function getAdminDb(): Firestore {
  if (cachedDb) return cachedDb;
  const fsMod =
    nodeRequire<typeof import("firebase-admin/firestore")>(
      "firebase-admin/firestore"
    );
  cachedDb = fsMod.getFirestore(getApp());
  return cachedDb;
}

export function getAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  const authMod =
    nodeRequire<typeof import("firebase-admin/auth")>("firebase-admin/auth");
  cachedAuth = authMod.getAuth(getApp());
  return cachedAuth;
}
