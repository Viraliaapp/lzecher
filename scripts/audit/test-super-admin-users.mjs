import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const superAdminEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const tempUid = `codex_admin_user_${suffix}`;
const tempEmail = `codex-admin-${suffix}@example.invalid`;

function initAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher super-admin users test");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
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

async function idTokenForEmail(email) {
  const user = await admin.auth().getUserByEmail(email);
  return { idToken: await idTokenForUid(user.uid), uid: user.uid };
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
  return { status: res.status, text, json };
}

async function cleanup(db) {
  const auditQueries = [
    ["targetUid", tempUid],
    ["targetEmail", tempEmail],
  ];
  const batch = db.batch();
  for (const [field, value] of auditQueries) {
    const snap = await db.collection("lzecher_admin_audit").where(field, "==", value).get();
    for (const doc of snap.docs) batch.delete(doc.ref);
  }
  batch.delete(db.collection("lzecher_users").doc(tempUid));
  await batch.commit();
  await admin.auth().deleteUser(tempUid).catch(() => {});
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { idToken: superToken, uid: superUid } = await idTokenForEmail(superAdminEmail);
  console.log(`Super-admin users target: ${origin}`);
  console.log(`Super admin test user: ${superAdminEmail}`);

  await admin.auth().createUser({
    uid: tempUid,
    email: tempEmail,
    emailVerified: true,
  });

  try {
    let res = await post("/api/admin/projects", { idToken: await idTokenForUid(tempUid) });
    assert(res.status === 403, `Fresh non-admin should be forbidden from admin projects, got ${res.status}`);

    res = await post("/api/admin/super/users", {
      idToken: superToken,
      targetEmail: tempEmail,
      isAdmin: true,
      isSuperAdmin: false,
      permissions: ["projects", "reports", "not-valid"],
    });
    assert(res.status === 200 && res.json?.success, `Grant admin failed: ${res.status} ${res.text}`);
    assert(res.json.user?.isAdmin === true && res.json.user?.isSuperAdmin === false, "Grant did not return expected admin flags");
    assert(JSON.stringify(res.json.user?.permissions) === JSON.stringify(["projects", "reports"]), "Invalid permissions were not filtered");

    let userRecord = await admin.auth().getUser(tempUid);
    assert(userRecord.customClaims?.isAdmin === true, "Custom claims did not set isAdmin");
    assert(userRecord.customClaims?.isSuperAdmin === false, "Custom claims should not set temp user as super admin");
    assert(JSON.stringify(userRecord.customClaims?.lzecherPermissions) === JSON.stringify(["projects", "reports"]), "Custom claims permissions mismatch");
    let profile = (await db.collection("lzecher_users").doc(tempUid).get()).data();
    assert(profile?.isAdmin === true && profile?.isSuperAdmin === false, "Profile admin flags mismatch after grant");

    res = await post("/api/admin/projects", { idToken: await idTokenForUid(tempUid) });
    assert(res.status === 200, `Scoped projects admin should access admin projects, got ${res.status} ${res.text}`);

    res = await post("/api/admin/super/users", {
      idToken: superToken,
      targetUid: tempUid,
      isAdmin: false,
      isSuperAdmin: false,
      permissions: ["projects"],
    });
    assert(res.status === 200 && res.json?.success, `Revoke admin failed: ${res.status} ${res.text}`);
    userRecord = await admin.auth().getUser(tempUid);
    assert(userRecord.customClaims?.isAdmin === false, "Custom claims did not revoke isAdmin");
    assert(userRecord.customClaims?.isSuperAdmin === false, "Custom claims should keep isSuperAdmin false");
    assert(Array.isArray(userRecord.customClaims?.lzecherPermissions) && userRecord.customClaims.lzecherPermissions.length === 0, "Revoked user kept permissions");
    profile = (await db.collection("lzecher_users").doc(tempUid).get()).data();
    assert(profile?.isAdmin === false && profile?.isSuperAdmin === false, "Profile admin flags mismatch after revoke");

    res = await post("/api/admin/projects", { idToken: await idTokenForUid(tempUid) });
    assert(res.status === 403, `Revoked user should be forbidden from admin projects, got ${res.status}`);

    res = await post("/api/admin/super/users", {
      idToken: superToken,
      targetUid: superUid,
      isAdmin: false,
      isSuperAdmin: false,
      permissions: [],
    });
    assert(res.status === 400, `Self-demotion should be rejected, got ${res.status} ${res.text}`);
    const superRecord = await admin.auth().getUser(superUid);
    const superProfile = (await db.collection("lzecher_users").doc(superUid).get()).data();
    assert(superRecord.customClaims?.isSuperAdmin === true, "Super admin custom claim was removed");
    assert(superProfile?.isSuperAdmin === true, "Super admin profile flag was removed");

    const auditSnap = await db.collection("lzecher_admin_audit").where("targetUid", "==", tempUid).get();
    assert(auditSnap.docs.length >= 2, "Admin grant/revoke audit entries were not written");

    console.log("Super-admin users checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Super-admin users checks failed:", err);
  process.exit(1);
});
