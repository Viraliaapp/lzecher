import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const superAdminEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_super_overview_${suffix}`;
const tempUid = `codex_super_overview_user_${suffix}`;
const parentClaimId = `codex_super_parent_${suffix}`;
const childClaimId = `codex_super_child_${suffix}`;
const scheduledEmailId = `codex_super_email_${suffix}`;

function initAdmin() {
  if (admin.apps.length) return;
  const projectIdEnv = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectIdEnv || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher super-admin overview audit");
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

async function seed(db) {
  const now = Date.now();
  const batch = db.batch();
  batch.set(db.collection("lzecher_users").doc(tempUid), {
    email: `codex-overview-${suffix}@example.com`,
    displayName: "Codex Overview User",
    isAdmin: false,
    isSuperAdmin: false,
    permissions: [],
    createdAt: now,
    updatedAt: now,
  });
  batch.set(db.collection("lzecher_projects").doc(projectId), {
    id: projectId,
    slug: projectId.replace(/_/g, "-"),
    createdBy: tempUid,
    createdByEmail: `codex-overview-${suffix}@example.com`,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת פורטל",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Portal",
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
    progressPct: 100,
    completedProgressPct: 0,
  });
  batch.set(db.collection("lzecher_claims").doc(parentClaimId), {
    id: parentClaimId,
    projectId,
    trackType: "mishnayos",
    scope: "multi",
    isParent: true,
    portionIds: [`codex_super_portion_${suffix}`],
    userId: tempUid,
    userName: "Codex Overview User",
    userEmail: `codex-overview-${suffix}@example.com`,
    status: "active",
    claimedAt: now + 2,
  });
  batch.set(db.collection("lzecher_claims").doc(childClaimId), {
    id: childClaimId,
    projectId,
    portionId: `codex_super_portion_${suffix}`,
    trackType: "mishnayos",
    reference: "Berachos 1",
    isParent: false,
    parentClaimId,
    userId: tempUid,
    userName: "Codex Overview User",
    userEmail: `codex-overview-${suffix}@example.com`,
    status: "active",
    claimedAt: now + 1,
  });
  batch.set(db.collection("lzecher_scheduled_emails").doc(scheduledEmailId), {
    id: scheduledEmailId,
    projectId,
    claimId: parentClaimId,
    toEmail: `codex-overview-${suffix}@example.com`,
    userEmail: `codex-overview-${suffix}@example.com`,
    userId: tempUid,
    reminderType: "confirmation",
    status: "pending",
    sendAt: now + 60_000,
    attempts: 0,
    createdAt: now,
  });
  await batch.commit();
}

async function cleanup(db) {
  const batch = db.batch();
  batch.delete(db.collection("lzecher_users").doc(tempUid));
  batch.delete(db.collection("lzecher_projects").doc(projectId));
  batch.delete(db.collection("lzecher_claims").doc(parentClaimId));
  batch.delete(db.collection("lzecher_claims").doc(childClaimId));
  batch.delete(db.collection("lzecher_scheduled_emails").doc(scheduledEmailId));
  await batch.commit();
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const idToken = await idTokenForEmail(superAdminEmail);

  console.log(`Super-admin overview target: ${origin}`);
  console.log(`Super admin test user: ${superAdminEmail}`);
  await seed(db);
  try {
    const res = await post("/api/admin/super/overview", { idToken });
    assert(res.status === 200, `overview failed: ${res.status} ${res.text}`);
    assert(typeof res.json?.stats?.pendingReminderEmails === "number", "overview did not expose pending reminder emails");
    assert(res.json.healthChecks?.some((check) => check.key === "reminder_queue"), "overview did not expose reminder queue health");
    assert(!res.json.recentClaims?.some((claim) => claim.id === parentClaimId), "overview recent claims exposed a parent summary claim");
    assert(res.json.recentClaims?.some((claim) => claim.id === childClaimId), "overview recent claims did not include the real child claim");
    const tempUser = res.json.userSummaries?.find((user) => user.uid === tempUid);
    assert(tempUser, "overview did not include temp user summary");
    assert(tempUser.claimCount === 1, `temp user claimCount should ignore parent summary claim; got ${tempUser.claimCount}`);
    console.log("Super-admin overview checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Super-admin overview checks failed:", err);
  process.exit(1);
});
