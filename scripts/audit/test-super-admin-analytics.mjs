import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const superAdminEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_super_analytics_${suffix}`;
const parentClaimId = `codex_super_analytics_parent_${suffix}`;
const childClaimId = `codex_super_analytics_child_${suffix}`;
const feedbackId = `codex_super_analytics_feedback_${suffix}`;
const reportId = `codex_super_analytics_report_${suffix}`;
const queuedEmailId = `codex_super_analytics_email_queued_${suffix}`;
const sentEmailId = `codex_super_analytics_email_sent_${suffix}`;
const failedEmailId = `codex_super_analytics_email_failed_${suffix}`;

function initAdmin() {
  if (admin.apps.length) return;
  const projectIdEnv = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectIdEnv || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher super-admin analytics audit");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId: projectIdEnv, clientEmail, privateKey }),
    projectId: projectIdEnv,
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

function totalsDelta(after, before, key) {
  return Number(after?.totals?.[key] || 0) - Number(before?.totals?.[key] || 0);
}

async function seed(db) {
  const now = Date.now();
  const old = now - 20 * 86400000;
  const batch = db.batch();
  batch.set(db.collection("lzecher_projects").doc(projectId), {
    id: projectId,
    slug: projectId.replace(/_/g, "-"),
    createdBy: `codex_super_analytics_user_${suffix}`,
    createdByEmail: `codex-analytics-${suffix}@example.com`,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת מגמות",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Trends",
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
    completedPortions: 1,
    participantCount: 1,
    claimedByTrack: { mishnayos: 1 },
    progressPct: 100,
    completedProgressPct: 100,
  });
  batch.set(db.collection("lzecher_claims").doc(parentClaimId), {
    id: parentClaimId,
    projectId,
    trackType: "mishnayos",
    scope: "multi",
    isParent: true,
    portionIds: [`codex_super_analytics_portion_${suffix}`],
    userName: "Codex Analytics Parent",
    status: "completed",
    claimedAt: now,
    completedAt: now,
  });
  batch.set(db.collection("lzecher_claims").doc(childClaimId), {
    id: childClaimId,
    projectId,
    portionId: `codex_super_analytics_portion_${suffix}`,
    trackType: "mishnayos",
    reference: "Berachos 1",
    isParent: false,
    parentClaimId,
    userName: "Codex Analytics Child",
    status: "completed",
    claimedAt: now,
    completedAt: now,
  });
  batch.set(db.collection("lzecher_feedback").doc(feedbackId), {
    id: feedbackId,
    type: "suggestion",
    message: "Codex analytics audit feedback",
    email: `codex-analytics-${suffix}@example.com`,
    locale: "en",
    status: "new",
    submittedAt: now,
  });
  batch.set(db.collection("lzecher_reports").doc(reportId), {
    id: reportId,
    projectId,
    projectSlug: projectId.replace(/_/g, "-"),
    reason: "content",
    details: "Codex analytics audit report",
    reporterEmail: `codex-analytics-${suffix}@example.com`,
    status: "open",
    reportedAt: now,
  });
  batch.set(db.collection("lzecher_scheduled_emails").doc(queuedEmailId), {
    id: queuedEmailId,
    projectId,
    claimId: childClaimId,
    toEmail: `codex-analytics-${suffix}@example.com`,
    reminderType: "confirmation",
    status: "pending",
    createdAt: now,
    sendAt: now + 60000,
    attempts: 0,
  });
  batch.set(db.collection("lzecher_scheduled_emails").doc(sentEmailId), {
    id: sentEmailId,
    projectId,
    claimId: childClaimId,
    toEmail: `codex-analytics-${suffix}@example.com`,
    reminderType: "halfway",
    status: "sent",
    createdAt: old,
    sentAt: now,
    attempts: 1,
  });
  batch.set(db.collection("lzecher_scheduled_emails").doc(failedEmailId), {
    id: failedEmailId,
    projectId,
    claimId: childClaimId,
    toEmail: `codex-analytics-${suffix}@example.com`,
    reminderType: "dailyReminder",
    status: "failed",
    createdAt: old,
    failedAt: now,
    attempts: 2,
    lastError: "Codex analytics audit failure",
  });
  await batch.commit();
}

async function cleanup(db) {
  const batch = db.batch();
  for (const [collection, id] of [
    ["lzecher_projects", projectId],
    ["lzecher_claims", parentClaimId],
    ["lzecher_claims", childClaimId],
    ["lzecher_feedback", feedbackId],
    ["lzecher_reports", reportId],
    ["lzecher_scheduled_emails", queuedEmailId],
    ["lzecher_scheduled_emails", sentEmailId],
    ["lzecher_scheduled_emails", failedEmailId],
  ]) {
    batch.delete(db.collection(collection).doc(id));
  }
  await batch.commit();
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const idToken = await idTokenForEmail(superAdminEmail);

  console.log(`Super-admin analytics target: ${origin}`);
  console.log(`Super admin test user: ${superAdminEmail}`);

  const before = await post("/api/admin/super/analytics", { idToken, rangeDays: 7 });
  assert(before.status === 200, `baseline analytics failed: ${before.status} ${before.text}`);
  assert(before.json?.rangeDays === 7, "analytics did not honor the requested 7 day range");
  assert(Array.isArray(before.json?.daily) && before.json.daily.length === 7, "analytics did not return seven daily buckets");

  await seed(db);
  try {
    const after = await post("/api/admin/super/analytics", { idToken, rangeDays: 7 });
    assert(after.status === 200, `analytics failed: ${after.status} ${after.text}`);
    assert(after.json?.rangeDays === 7, "analytics range changed unexpectedly");
    assert(Array.isArray(after.json?.daily) && after.json.daily.length === 7, "analytics daily buckets missing after seed");
    assert(totalsDelta(after.json, before.json, "projectsCreated") >= 1, "analytics did not count the seeded Lzecher project");
    assert(totalsDelta(after.json, before.json, "claimsTaken") >= 1, "analytics did not count the seeded real child claim");
    assert(totalsDelta(after.json, before.json, "claimsCompleted") >= 1, "analytics did not count the seeded completed claim");
    assert(totalsDelta(after.json, before.json, "feedbackSubmitted") >= 1, "analytics did not count seeded feedback");
    assert(totalsDelta(after.json, before.json, "reportsSubmitted") >= 1, "analytics did not count seeded report");
    assert(totalsDelta(after.json, before.json, "remindersQueued") >= 1, "analytics did not count seeded queued reminder");
    assert(totalsDelta(after.json, before.json, "remindersSent") >= 1, "analytics did not count seeded sent reminder");
    assert(totalsDelta(after.json, before.json, "remindersFailed") >= 1, "analytics did not count seeded failed reminder");
    assert(Object.values(after.json.truncated || {}).every((value) => typeof value === "boolean"), "analytics truncation flags are missing");
    console.log("Super-admin analytics checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Super-admin analytics checks failed:", err);
  process.exit(1);
});
