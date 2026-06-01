import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_admin_perm_project_${suffix}`;
const claimId = `codex_admin_perm_claim_${suffix}`;
const portionId = `codex_admin_perm_portion_${suffix}`;
const ownerUid = `codex_admin_perm_owner_${suffix}`;
const feedbackAdminUid = `codex_admin_perm_feedback_${suffix}`;
const projectsAdminUid = `codex_admin_perm_projects_${suffix}`;

function initAdmin() {
  if (admin.apps.length) return;
  const projectIdEnv = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectIdEnv || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher admin permission audit");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId: projectIdEnv, clientEmail, privateKey }),
    projectId: projectIdEnv,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function idTokenForUid(uid) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  const customToken = await admin.auth().createCustomToken(uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) {
    throw new Error(`Could not create id token for ${uid}: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function requestJson(method, pathname, body) {
  const res = await fetch(`${origin}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

async function seedUser(uid, email, profile) {
  try {
    await admin.auth().createUser({ uid, email, displayName: profile.displayName || email });
  } catch (err) {
    if (err?.code !== "auth/uid-already-exists") throw err;
  }
  await admin.firestore().collection("lzecher_users").doc(uid).set({
    email,
    displayName: profile.displayName || email,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...profile,
  });
}

async function seed(db) {
  const now = Date.now();
  await seedUser(ownerUid, `codex-owner-${suffix}@example.com`, {
    isAdmin: false,
    isSuperAdmin: false,
    permissions: [],
    displayName: "Codex Project Owner",
  });
  await seedUser(feedbackAdminUid, `codex-feedback-admin-${suffix}@example.com`, {
    isAdmin: true,
    isSuperAdmin: false,
    permissions: ["feedback"],
    displayName: "Codex Feedback Admin",
  });
  await seedUser(projectsAdminUid, `codex-projects-admin-${suffix}@example.com`, {
    isAdmin: true,
    isSuperAdmin: false,
    permissions: ["projects"],
    displayName: "Codex Projects Admin",
  });

  const batch = db.batch();
  batch.set(db.collection("lzecher_projects").doc(projectId), {
    id: projectId,
    slug: projectId.replace(/_/g, "-"),
    createdBy: ownerUid,
    createdByEmail: `codex-owner-${suffix}@example.com`,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת הרשאות",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Permissions",
    familyNameEnglish: "Audit",
    gender: "male",
    honorific: "ז״ל",
    status: "draft",
    tracks: ["mishnayos"],
    locked: false,
    isPublic: false,
    allowAnonymous: true,
    showLeaderboard: true,
    totalPortions: 1,
    claimedPortions: 1,
    completedPortions: 0,
    participantCount: 1,
    claimedByTrack: { mishnayos: 1 },
  });
  batch.set(db.collection("lzecher_portions").doc(portionId), {
    id: portionId,
    projectId,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Berachos 1",
    displayName: "Berachos 1",
    order: 1,
    status: "claimed",
    claimedBy: ownerUid,
    claimedByName: "Original Name",
    claimedAt: now,
  });
  batch.set(db.collection("lzecher_claims").doc(claimId), {
    id: claimId,
    projectId,
    portionId,
    trackType: "mishnayos",
    reference: "Berachos 1",
    userId: ownerUid,
    userName: "Original Name",
    userEmail: `codex-owner-${suffix}@example.com`,
    status: "active",
    claimedAt: now,
  });
  await batch.commit();
}

async function cleanup(db) {
  const batch = db.batch();
  for (const collection of ["lzecher_claims", "lzecher_portions", "lzecher_scheduled_emails", "lzecher_admin_audit"]) {
    const snap = await db.collection(collection).where("projectId", "==", projectId).get();
    for (const doc of snap.docs) batch.delete(doc.ref);
  }
  batch.delete(db.collection("lzecher_project_photos").doc(projectId));
  batch.delete(db.collection("lzecher_projects").doc(projectId));
  for (const uid of [ownerUid, feedbackAdminUid, projectsAdminUid]) {
    batch.delete(db.collection("lzecher_users").doc(uid));
  }
  await batch.commit();
  for (const uid of [ownerUid, feedbackAdminUid, projectsAdminUid]) {
    try {
      await admin.auth().deleteUser(uid);
    } catch {
      // already gone
    }
  }
}

async function assertStatus(label, promise, expectedStatus) {
  const res = await promise;
  assert(res.status === expectedStatus, `${label} expected ${expectedStatus}, got ${res.status}: ${res.text}`);
  return res;
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  await seed(db);

  const ownerToken = await idTokenForUid(ownerUid);
  const feedbackAdminToken = await idTokenForUid(feedbackAdminUid);
  const projectsAdminToken = await idTokenForUid(projectsAdminUid);

  console.log(`Admin project permission target: ${origin}`);
  try {
    await assertStatus(
      "owner project detail",
      requestJson("POST", `/api/projects/${projectId}`, { idToken: ownerToken }),
      200
    );
    await assertStatus(
      "owner project update",
      requestJson("POST", `/api/projects/${projectId}/update`, { idToken: ownerToken, updates: {} }),
      200
    );

    await assertStatus(
      "feedback-only admin projects list",
      requestJson("POST", "/api/admin/projects", { idToken: feedbackAdminToken }),
      403
    );
    await assertStatus(
      "projects admin projects list",
      requestJson("POST", "/api/admin/projects", { idToken: projectsAdminToken }),
      200
    );

    for (const [label, method, pathname, body, passStatus] of [
      ["project detail", "POST", `/api/projects/${projectId}`, {}, 200],
      ["project claims", "POST", `/api/projects/${projectId}/claims`, {}, 200],
      ["project update", "POST", `/api/projects/${projectId}/update`, { updates: {} }, 200],
      ["project reset", "POST", `/api/projects/${projectId}/reset-claims`, { confirmation: "wrong" }, 400],
      ["project delete", "POST", `/api/projects/${projectId}/delete`, { confirmation: "wrong" }, 400],
      ["claim patch", "PATCH", `/api/projects/${projectId}/claims/${claimId}`, { userName: "Renamed By Projects Admin" }, 200],
    ]) {
      await assertStatus(
        `feedback-only admin ${label}`,
        requestJson(method, pathname, { idToken: feedbackAdminToken, ...body }),
        403
      );
      await assertStatus(
        `projects admin ${label}`,
        requestJson(method, pathname, { idToken: projectsAdminToken, ...body }),
        passStatus
      );
    }

    await assertStatus(
      "feedback-only admin photo",
      requestJson("POST", "/api/projects/photo", {
        idToken: feedbackAdminToken,
        projectId,
        photoData: Buffer.from("codex-photo").toString("base64"),
        contentType: "image/png",
      }),
      403
    );
    await assertStatus(
      "projects admin photo",
      requestJson("POST", "/api/projects/photo", {
        idToken: projectsAdminToken,
        projectId,
        photoData: Buffer.from("codex-photo").toString("base64"),
        contentType: "image/png",
      }),
      200
    );

    const photoSnap = await db.collection("lzecher_project_photos").doc(projectId).get();
    assert(photoSnap.exists, "projects admin photo upload did not create scoped Lzecher photo doc");

    console.log("Admin project permission checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Admin project permission checks failed:", err);
  process.exit(1);
});
