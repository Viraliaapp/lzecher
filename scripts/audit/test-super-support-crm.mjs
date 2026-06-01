import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const superAdminEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_support_project_${suffix}`;
const feedbackId = `codex_support_feedback_${suffix}`;
const reportId = `codex_support_report_${suffix}`;
const contactId = `codex_support_contact_${suffix}`;

function initAdmin() {
  if (admin.apps.length) return;
  const firebaseProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!firebaseProjectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher support CRM test");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId: firebaseProjectId, clientEmail, privateKey }),
    projectId: firebaseProjectId,
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
  return data.idToken;
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

async function seed(db) {
  const now = Date.now();
  await db.collection("lzecher_projects").doc(projectId).set({
    slug: `codex-support-${suffix}`,
    nameHebrew: "בדיקת תמיכה",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Support",
    familyNameEnglish: "Audit",
    createdBy: "codex-support-audit",
    createdByEmail: superAdminEmail,
    createdAt: now,
    updatedAt: now,
    status: "active",
    tracks: ["mishnayos"],
    locked: false,
    isPublic: false,
    allowAnonymous: true,
    showLeaderboard: true,
    totalPortions: 0,
    claimedPortions: 0,
    completedPortions: 0,
    participantCount: 0,
    progressPct: 0,
    completedProgressPct: 0,
    reportsCount: 1,
  });
  await db.collection("lzecher_feedback").doc(feedbackId).set({
    type: "suggestion",
    message: "Codex temporary support CRM feedback fixture",
    email: superAdminEmail,
    locale: "he",
    currentPath: `/he/memorial/codex-support-${suffix}`,
    status: "new",
    allowAsTestimonial: false,
    submittedAt: now,
  });
  await db.collection("lzecher_reports").doc(reportId).set({
    projectId,
    projectSlug: `codex-support-${suffix}`,
    reason: "Codex temporary report fixture",
    details: "Only for support CRM route verification.",
    reporterEmail: superAdminEmail,
    status: "open",
    reportedAt: now,
  });
  await db.collection("lzecher_contact_messages").doc(contactId).set({
    projectId,
    slug: `codex-support-${suffix}`,
    senderEmail: superAdminEmail,
    message: "Codex temporary family message fixture",
    delivered: true,
    sentAt: now,
  });
}

async function cleanup(db) {
  const auditQueries = [
    ["feedbackId", feedbackId],
    ["reportId", reportId],
    ["contactMessageId", contactId],
  ];
  const batch = db.batch();
  for (const [field, value] of auditQueries) {
    const snap = await db.collection("lzecher_admin_audit").where(field, "==", value).get();
    for (const doc of snap.docs) batch.delete(doc.ref);
  }
  batch.delete(db.collection("lzecher_feedback").doc(feedbackId));
  batch.delete(db.collection("lzecher_reports").doc(reportId));
  batch.delete(db.collection("lzecher_contact_messages").doc(contactId));
  batch.delete(db.collection("lzecher_projects").doc(projectId));
  await batch.commit();
}

async function assertDoc(db, collection, id, expected) {
  const snap = await db.collection(collection).doc(id).get();
  assert(snap.exists, `${collection}/${id} does not exist`);
  const data = snap.data();
  for (const [key, value] of Object.entries(expected)) {
    assert(data?.[key] === value, `${collection}/${id} ${key} expected ${value}, got ${data?.[key]}`);
  }
  assert(typeof data?.supportUpdatedAt === "number", `${collection}/${id} missing supportUpdatedAt`);
  assert(typeof data?.supportUpdatedBy === "string", `${collection}/${id} missing supportUpdatedBy`);
}

async function assertAudit(db, field, id, action) {
  const snap = await db.collection("lzecher_admin_audit").where(field, "==", id).get();
  assert(!snap.empty, `Missing audit entry for ${field}=${id}`);
  assert(snap.docs.some((doc) => doc.data().action === action), `Missing audit action ${action}`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  console.log(`Support CRM target: ${origin}`);
  console.log(`Super admin test user: ${superAdminEmail}`);
  await seed(db);
  try {
    const idToken = await idTokenForEmail(superAdminEmail);
    let res = await post(`/api/admin/super/feedback/${feedbackId}`, {
      idToken,
      status: "open",
      priority: "urgent",
      tag: "codex-crm",
      assignedTo: "Solomon",
      internalNote: "Temporary feedback support CRM audit",
    });
    assert(res.status === 200 && res.json?.success, `Feedback update failed: ${res.status} ${res.text}`);

    res = await post(`/api/admin/super/reports/${reportId}`, {
      idToken,
      status: "reviewing",
      priority: "high",
      tag: "codex-crm",
      assignedTo: "Solomon",
      internalNote: "Temporary report support CRM audit",
    });
    assert(res.status === 200 && res.json?.success, `Report update failed: ${res.status} ${res.text}`);

    res = await post(`/api/admin/super/contacts/${contactId}`, {
      idToken,
      supportStatus: "open",
      priority: "normal",
      tag: "codex-crm",
      assignedTo: "Solomon",
      internalNote: "Temporary contact support CRM audit",
    });
    assert(res.status === 200 && res.json?.success, `Contact update failed: ${res.status} ${res.text}`);

    await assertDoc(db, "lzecher_feedback", feedbackId, {
      status: "open",
      priority: "urgent",
      tag: "codex-crm",
      assignedTo: "Solomon",
      internalNote: "Temporary feedback support CRM audit",
    });
    await assertDoc(db, "lzecher_reports", reportId, {
      status: "reviewing",
      priority: "high",
      tag: "codex-crm",
      assignedTo: "Solomon",
      internalNote: "Temporary report support CRM audit",
    });
    await assertDoc(db, "lzecher_contact_messages", contactId, {
      supportStatus: "open",
      priority: "normal",
      tag: "codex-crm",
      assignedTo: "Solomon",
      internalNote: "Temporary contact support CRM audit",
    });

    await assertAudit(db, "feedbackId", feedbackId, "super_admin_update_feedback");
    await assertAudit(db, "reportId", reportId, "super_admin_update_report");
    await assertAudit(db, "contactMessageId", contactId, "super_admin_update_contact_message");

    res = await post("/api/admin/super/overview", { idToken });
    assert(res.status === 200, `Overview failed: ${res.status} ${res.text}`);
    assert(res.json?.stats?.openContactMessages >= 1, "Overview did not count open contact messages");
    assert(res.json?.recentContacts?.some((item) => item.id === contactId && item.supportStatus === "open"), "Overview did not return triaged contact message");

    res = await post(`/api/admin/super/projects/${projectId}`, { idToken });
    assert(res.status === 200, `Project detail failed: ${res.status} ${res.text}`);
    assert(res.json?.reports?.some((item) => item.id === reportId && item.priority === "high"), "Project detail did not return triaged report");
    assert(res.json?.contactMessages?.some((item) => item.id === contactId && item.supportStatus === "open"), "Project detail did not return triaged contact message");

    console.log("Super-admin support CRM checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Super-admin support CRM checks failed:", err);
  process.exit(1);
});
