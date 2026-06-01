import admin from "firebase-admin";
import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const creatorEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_dashboard_project_${suffix}`;
const forbiddenProjectId = `codex_dashboard_forbidden_${suffix}`;
const nonAdminUid = `codex_dashboard_non_admin_${suffix}`;
const slug = `codex-dashboard-${suffix}`;

const ids = {
  exclusivePortion: `codex_dash_portion_exclusive_${suffix}`,
  renameInclusivePortion: `codex_dash_portion_rename_${suffix}`,
  deleteInclusivePortion: `codex_dash_portion_delete_${suffix}`,
  extraPortion: `codex_dash_portion_extra_${suffix}`,
  exclusiveClaim: `codex_dash_claim_exclusive_${suffix}`,
  renameInclusiveClaim: `codex_dash_claim_rename_${suffix}`,
  deleteInclusiveClaim: `codex_dash_claim_delete_${suffix}`,
  scheduledEmail: `codex_dash_email_${suffix}`,
  report: `codex_dash_report_${suffix}`,
  contact: `codex_dash_contact_${suffix}`,
};

function initAdmin() {
  if (admin.apps.length) return;
  const projectIdEnv = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!projectIdEnv || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher dashboard controls test");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId: projectIdEnv, clientEmail, privateKey }),
    projectId: projectIdEnv,
    storageBucket,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plain.normalize("NFKC"), salt, 32, { N: 16384 }).toString("hex");
  return { passwordHash: hash, passwordSalt: salt };
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
    throw new Error(`Could not create id token for uid ${uid}: ${JSON.stringify(data)}`);
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

function baseProject(uid, overrides = {}) {
  const now = Date.now();
  return {
    id: projectId,
    slug,
    createdBy: uid,
    createdByEmail: creatorEmail,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת דשבורד",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Dashboard",
    familyNameEnglish: "Audit",
    gender: "male",
    honorific: "ז״ל",
    status: "active",
    tracks: ["mishnayos", "kabalos"],
    locked: false,
    isPublic: true,
    allowAnonymous: true,
    showLeaderboard: true,
    repeatingSetEnabled: true,
    totalSets: 2,
    totalPortions: 4,
    claimedPortions: 3,
    completedPortions: 0,
    participantCount: 3,
    claimedByTrack: { mishnayos: 1, kabalos: 2 },
    ...hashPassword(`DeleteAudit-${suffix}`),
    ...overrides,
  };
}

async function seed(db, uid) {
  const now = Date.now();
  await db.collection("lzecher_projects").doc(projectId).set(baseProject(uid));
  await db.collection("lzecher_projects").doc(forbiddenProjectId).set(baseProject("not-the-current-user", {
    id: forbiddenProjectId,
    slug: `codex-dashboard-forbidden-${suffix}`,
    nameHebrew: "בדיקת הרשאות",
    totalPortions: 0,
    claimedPortions: 0,
    participantCount: 0,
  }));

  await db.collection("lzecher_portions").doc(ids.exclusivePortion).set({
    id: ids.exclusivePortion,
    projectId,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Berachos 1",
    displayName: "Berachos 1",
    displayNameHebrew: "ברכות פרק א",
    order: 1,
    status: "claimed",
    claimedBy: "codex-audit",
    claimedByName: "Old Exclusive",
    claimedAt: now,
    setNumber: 1,
  });
  await db.collection("lzecher_portions").doc(ids.renameInclusivePortion).set({
    id: ids.renameInclusivePortion,
    projectId,
    trackType: "kabalos",
    claimMode: "inclusive",
    reference: "Kabbalah rename",
    displayName: "Kabbalah rename",
    displayNameHebrew: "קבלה לבדיקה",
    order: 2,
    status: "available",
    currentClaimerCount: 1,
    claimerNames: ["Old Kabbalah"],
    setNumber: 1,
  });
  await db.collection("lzecher_portions").doc(ids.deleteInclusivePortion).set({
    id: ids.deleteInclusivePortion,
    projectId,
    trackType: "kabalos",
    claimMode: "inclusive",
    reference: "Kabbalah delete",
    displayName: "Kabbalah delete",
    displayNameHebrew: "קבלה למחיקה",
    order: 3,
    status: "available",
    currentClaimerCount: 3,
    claimerNames: ["Same Name", "Same Name", "Other Name"],
    setNumber: 1,
  });
  await db.collection("lzecher_portions").doc(ids.extraPortion).set({
    id: ids.extraPortion,
    projectId,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Extra set",
    displayName: "Extra set",
    displayNameHebrew: "מחזור נוסף",
    order: 4,
    status: "claimed",
    claimedByName: "Extra Learner",
    currentClaimerCount: 1,
    claimerNames: ["Extra Learner"],
    setNumber: 2,
  });

  await db.collection("lzecher_claims").doc(ids.exclusiveClaim).set({
    id: ids.exclusiveClaim,
    projectId,
    portionId: ids.exclusivePortion,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Berachos 1",
    userId: "codex-user-exclusive",
    userName: "Old Exclusive",
    userEmail: "exclusive@example.com",
    claimedAt: now,
    status: "active",
  });
  await db.collection("lzecher_claims").doc(ids.renameInclusiveClaim).set({
    id: ids.renameInclusiveClaim,
    projectId,
    portionId: ids.renameInclusivePortion,
    trackType: "kabalos",
    claimMode: "inclusive",
    reference: "Kabbalah rename",
    userId: "codex-user-rename",
    userName: "Old Kabbalah",
    userEmail: "rename@example.com",
    claimedAt: now - 1,
    status: "active",
  });
  await db.collection("lzecher_claims").doc(ids.deleteInclusiveClaim).set({
    id: ids.deleteInclusiveClaim,
    projectId,
    portionId: ids.deleteInclusivePortion,
    trackType: "kabalos",
    claimMode: "inclusive",
    reference: "Kabbalah delete",
    userId: "codex-user-delete",
    userName: "Same Name",
    userEmail: "delete@example.com",
    claimedAt: now - 2,
    status: "active",
  });
  await db.collection("lzecher_scheduled_emails").doc(ids.scheduledEmail).set({
    id: ids.scheduledEmail,
    projectId,
    claimId: ids.renameInclusiveClaim,
    status: "pending",
    sendAt: now + 86400000,
  });
  await db.collection("lzecher_reports").doc(ids.report).set({
    id: ids.report,
    projectId,
    projectSlug: slug,
    reason: "other",
    details: "Temporary dashboard controls audit report",
    status: "open",
    reportedAt: now,
  });
  await db.collection("lzecher_contact_messages").doc(ids.contact).set({
    id: ids.contact,
    projectId,
    slug,
    message: "Temporary dashboard controls audit contact",
    senderEmail: creatorEmail,
    sentAt: now,
    delivered: true,
  });
}

async function maybeUploadPhoto(uid) {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) return { uploaded: false, file: null };
  try {
    const file = admin.storage().bucket(bucketName).file(`lzecher/photos/${uid}/${projectId}.jpg`);
    await file.save(Buffer.from("codex-dashboard-photo"), { contentType: "image/jpeg" });
    return { uploaded: true, file };
  } catch (err) {
    console.warn("Photo fixture upload skipped:", err?.message || err);
    return { uploaded: false, file: null };
  }
}

async function cleanup(db, photoFile) {
  for (const id of [projectId, forbiddenProjectId]) {
    const batch = db.batch();
    for (const collection of [
      "lzecher_portions",
      "lzecher_claims",
      "lzecher_reports",
      "lzecher_contact_messages",
      "lzecher_scheduled_emails",
      "lzecher_admin_audit",
    ]) {
      const snap = await db.collection(collection).where("projectId", "==", id).get();
      for (const doc of snap.docs) batch.delete(doc.ref);
    }
    batch.delete(db.collection("lzecher_projects").doc(id));
    await batch.commit();
  }
  if (photoFile) {
    await photoFile.delete({ ignoreNotFound: true }).catch(() => {});
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { idToken, uid } = await idTokenForEmail(creatorEmail);
  await admin.auth().createUser({
    uid: nonAdminUid,
    email: `codex-dashboard-${suffix}@example.invalid`,
    emailVerified: true,
  }).catch(async (err) => {
    if (err?.code !== "auth/uid-already-exists") throw err;
  });
  const nonAdminToken = await idTokenForUid(nonAdminUid);
  console.log(`Dashboard controls target: ${origin}`);
  console.log(`Creator test user: ${creatorEmail}`);

  let photoFile = null;
  await seed(db, uid);
  const photo = await maybeUploadPhoto(uid);
  photoFile = photo.file;

  try {
    let res = await requestJson("POST", `/api/projects/${projectId}/claims`, { idToken });
    assert(res.status === 200, `Claim list failed: ${res.status} ${res.text}`);
    assert(res.json?.claims?.length === 3, `Claim list expected 3, got ${res.json?.claims?.length}`);

    res = await requestJson("POST", `/api/projects/${forbiddenProjectId}/claims`, { idToken: nonAdminToken });
    assert(res.status === 403, `Non-owner claim list should be forbidden, got ${res.status}`);

    res = await requestJson("PATCH", `/api/projects/${projectId}/claims/${ids.exclusiveClaim}`, {
      idToken,
      userName: "New Exclusive",
    });
    assert(res.status === 200 && res.json?.success, `Exclusive rename failed: ${res.status} ${res.text}`);
    let claimSnap = await db.collection("lzecher_claims").doc(ids.exclusiveClaim).get();
    let portionSnap = await db.collection("lzecher_portions").doc(ids.exclusivePortion).get();
    assert(claimSnap.data()?.userName === "New Exclusive", "Exclusive claim name was not updated");
    assert(portionSnap.data()?.claimedByName === "New Exclusive", "Exclusive portion claimedByName was not updated");

    res = await requestJson("PATCH", `/api/projects/${projectId}/claims/${ids.renameInclusiveClaim}`, {
      idToken,
      userName: "New Kabbalah",
    });
    assert(res.status === 200 && res.json?.success, `Inclusive rename failed: ${res.status} ${res.text}`);
    claimSnap = await db.collection("lzecher_claims").doc(ids.renameInclusiveClaim).get();
    portionSnap = await db.collection("lzecher_portions").doc(ids.renameInclusivePortion).get();
    assert(claimSnap.data()?.userName === "New Kabbalah", "Inclusive claim name was not updated");
    assert(portionSnap.data()?.claimerNames?.includes("New Kabbalah"), "Inclusive claimerNames did not include renamed learner");
    assert(!portionSnap.data()?.claimerNames?.includes("Old Kabbalah"), "Inclusive claimerNames kept the old learner name");

    res = await requestJson("DELETE", `/api/projects/${projectId}/claims/${ids.deleteInclusiveClaim}`, { idToken });
    assert(res.status === 200 && res.json?.success, `Inclusive delete failed: ${res.status} ${res.text}`);
    claimSnap = await db.collection("lzecher_claims").doc(ids.deleteInclusiveClaim).get();
    portionSnap = await db.collection("lzecher_portions").doc(ids.deleteInclusivePortion).get();
    const namesAfterDelete = portionSnap.data()?.claimerNames || [];
    assert(!claimSnap.exists, "Deleted inclusive claim still exists");
    assert(portionSnap.data()?.currentClaimerCount === 2, "Inclusive count did not decrement by one");
    assert(namesAfterDelete.filter((name) => name === "Same Name").length === 1, "Inclusive delete removed too many matching names");
    assert(namesAfterDelete.includes("Other Name"), "Inclusive delete removed unrelated names");

    res = await requestJson("POST", `/api/projects/${projectId}/reset-claims`, {
      idToken,
      confirmation: "reset",
    });
    assert(res.status === 200 && res.json?.success, `Reset claims failed: ${res.status} ${res.text}`);
    const claimsAfterReset = await db.collection("lzecher_claims").where("projectId", "==", projectId).get();
    assert(claimsAfterReset.empty, "Reset did not delete all claims");
    const portionsAfterReset = await db.collection("lzecher_portions").where("projectId", "==", projectId).get();
    assert(!portionsAfterReset.docs.some((doc) => (doc.data().setNumber || 1) > 1), "Reset did not remove extra sets");
    for (const doc of portionsAfterReset.docs) {
      const data = doc.data();
      assert(data.status === "available", `Reset left ${doc.id} status as ${data.status}`);
      assert((data.currentClaimerCount || 0) === 0, `Reset left ${doc.id} currentClaimerCount nonzero`);
      assert(Array.isArray(data.claimerNames) && data.claimerNames.length === 0, `Reset left ${doc.id} claimerNames populated`);
    }
    const emailSnap = await db.collection("lzecher_scheduled_emails").doc(ids.scheduledEmail).get();
    assert(emailSnap.data()?.status === "cancelled", "Reset did not cancel pending scheduled email");

    res = await requestJson("POST", `/api/projects/${projectId}/delete`, {
      idToken,
      confirmation: "בדיקת דשבורד",
    });
    assert(res.status === 200 && res.json?.success, `Project delete failed: ${res.status} ${res.text}`);
    assert(!(await db.collection("lzecher_projects").doc(projectId).get()).exists, "Delete left project doc behind");
    assert((await db.collection("lzecher_portions").where("projectId", "==", projectId).get()).empty, "Delete left portions behind");
    assert((await db.collection("lzecher_reports").where("projectId", "==", projectId).get()).empty, "Delete left reports behind");
    assert((await db.collection("lzecher_contact_messages").where("projectId", "==", projectId).get()).empty, "Delete left contact messages behind");
    assert((await db.collection("lzecher_scheduled_emails").where("projectId", "==", projectId).get()).empty, "Delete left scheduled emails behind");
    if (photo.uploaded && photo.file) {
      const [exists] = await photo.file.exists();
      assert(!exists, "Delete left the Lzecher-scoped project photo behind");
      photoFile = null;
    }

    const auditSnap = await db.collection("lzecher_admin_audit").where("projectId", "==", projectId).get();
    const deleteAudit = auditSnap.docs.map((doc) => doc.data()).find((item) => item.action === "creator_delete_project");
    assert(deleteAudit, "Delete audit entry was not written");
    const auditJson = JSON.stringify(deleteAudit);
    assert(!auditJson.includes("passwordHash"), "Delete audit leaked passwordHash key");
    assert(!auditJson.includes("passwordSalt"), "Delete audit leaked passwordSalt key");
    assert(deleteAudit.counts?.contactsDeleted === 1, "Delete audit did not count deleted contact messages");

    console.log("Dashboard controls checks passed.");
  } finally {
    await cleanup(db, photoFile);
    await admin.auth().deleteUser(nonAdminUid).catch(() => {});
  }
}

main().catch((err) => {
  console.error("Dashboard controls checks failed:", err);
  process.exit(1);
});
