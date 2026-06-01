import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const creatorEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const creatorProjectId = `codex_track_creator_${suffix}`;
const adminProjectId = `codex_track_admin_${suffix}`;

function initAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher dashboard track-addition test");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function idTokenForEmail(email) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  const user = await admin.auth().getUserByEmail(email);
  const customToken = await admin.auth().createCustomToken(user.uid);
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.idToken) {
    throw new Error(`Could not create id token for ${email}: ${JSON.stringify(data)}`);
  }
  return { idToken: data.idToken, uid: user.uid };
}

async function post(pathname, body) {
  const res = await fetch(`${origin}${pathname}`, {
    method: "POST",
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
  return { status: res.status, json, text };
}

async function seedProject(db, id, uid) {
  const now = Date.now();
  await db.collection("lzecher_projects").doc(id).set({
    id,
    slug: `${id}-slug`,
    createdBy: uid,
    createdByEmail: creatorEmail,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת מסלולים",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Track",
    familyNameEnglish: "Audit",
    gender: "male",
    honorific: "ז״ל",
    status: "active",
    tracks: [],
    locked: false,
    isPublic: false,
    allowAnonymous: true,
    showLeaderboard: true,
    repeatingSetEnabled: true,
    totalSets: 1,
    totalPortions: 0,
    claimedPortions: 0,
    completedPortions: 0,
    participantCount: 0,
  });
}

async function cleanup(db) {
  for (const projectId of [creatorProjectId, adminProjectId]) {
    const batch = db.batch();
    for (const collection of ["lzecher_portions", "lzecher_claims", "lzecher_reports", "lzecher_scheduled_emails"]) {
      const snap = await db.collection(collection).where("projectId", "==", projectId).get();
      for (const doc of snap.docs) batch.delete(doc.ref);
    }
    const auditSnap = await db.collection("lzecher_admin_audit").where("projectId", "==", projectId).get();
    for (const doc of auditSnap.docs) batch.delete(doc.ref);
    batch.delete(db.collection("lzecher_projects").doc(projectId));
    await batch.commit();
  }
}

async function countTrack(db, projectId, trackType) {
  const snap = await db
    .collection("lzecher_portions")
    .where("projectId", "==", projectId)
    .where("trackType", "==", trackType)
    .get();
  return snap.size;
}

async function assertProjectTotals(db, projectId, expectedTracks, expectedTotal) {
  const snap = await db.collection("lzecher_projects").doc(projectId).get();
  assert(snap.exists, `${projectId} missing`);
  const data = snap.data();
  assert(expectedTracks.every((track) => data?.tracks?.includes(track)), `${projectId} tracks missing ${expectedTracks.join(",")}`);
  assert(data?.totalPortions === expectedTotal, `${projectId} totalPortions expected ${expectedTotal}, got ${data?.totalPortions}`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { idToken, uid } = await idTokenForEmail(creatorEmail);
  console.log(`Dashboard track-addition target: ${origin}`);
  console.log(`Creator/admin test user: ${creatorEmail}`);
  await seedProject(db, creatorProjectId, uid);
  await seedProject(db, adminProjectId, uid);
  try {
    let res = await post(`/api/projects/${creatorProjectId}/update`, {
      idToken,
      updates: {},
      trackChanges: { add: ["mishnayos", "tehillim", "shnayim_mikra"] },
    });
    assert(res.status === 200 && res.json?.success, `Creator track update failed: ${res.status} ${res.text}`);
    assert(await countTrack(db, creatorProjectId, "mishnayos") === 525, "Creator Mishnayos add did not create 525 portions");
    assert(await countTrack(db, creatorProjectId, "tehillim") === 150, "Creator Tehillim add did not create 150 portions");
    assert(await countTrack(db, creatorProjectId, "shnayim_mikra") === 54, "Creator Shnayim Mikra add did not create 54 portions");
    await assertProjectTotals(db, creatorProjectId, ["mishnayos", "tehillim", "shnayim_mikra"], 729);

    res = await post(`/api/projects/${creatorProjectId}/update`, {
      idToken,
      updates: {},
      trackChanges: { remove: ["mishnayos", "tehillim", "shnayim_mikra"] },
    });
    assert(res.status === 400, `Creator should not be able to remove every track: ${res.status} ${res.text}`);
    await assertProjectTotals(db, creatorProjectId, ["mishnayos", "tehillim", "shnayim_mikra"], 729);

    res = await post(`/api/admin/projects/${adminProjectId}/update`, {
      idToken,
      updates: {},
      trackChanges: { add: ["mishnayos", "tehillim", "shnayim_mikra"] },
    });
    assert(res.status === 200 && res.json?.success, `Admin track update failed: ${res.status} ${res.text}`);
    assert(await countTrack(db, adminProjectId, "mishnayos") === 525, "Admin Mishnayos add did not create 525 portions");
    assert(await countTrack(db, adminProjectId, "tehillim") === 150, "Admin Tehillim add did not create 150 portions");
    assert(await countTrack(db, adminProjectId, "shnayim_mikra") === 54, "Admin Shnayim Mikra add did not create 54 portions");
    await assertProjectTotals(db, adminProjectId, ["mishnayos", "tehillim", "shnayim_mikra"], 729);

    res = await post(`/api/admin/projects/${adminProjectId}/update`, {
      idToken,
      updates: {},
      trackChanges: { remove: ["mishnayos", "tehillim", "shnayim_mikra"] },
    });
    assert(res.status === 400, `Admin should not be able to remove every track: ${res.status} ${res.text}`);
    await assertProjectTotals(db, adminProjectId, ["mishnayos", "tehillim", "shnayim_mikra"], 729);

    console.log("Dashboard/admin track-addition checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Dashboard track-addition checks failed:", err);
  process.exit(1);
});
