import admin from "firebase-admin";
import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const creatorEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const password = `CodexPass-${suffix}`;

const projectIds = {
  protectedOne: `codex_pw_one_${suffix}`,
  protectedTwo: `codex_pw_two_${suffix}`,
  open: `codex_pw_open_${suffix}`,
};

const slugs = {
  protectedOne: `codex-password-one-${suffix}`,
  protectedTwo: `codex-password-two-${suffix}`,
  open: `codex-password-open-${suffix}`,
};

const markers = {
  protectedOne: `CODEX_PROTECTED_ONE_PORTION_${suffix}`,
  protectedTwo: `CODEX_PROTECTED_TWO_PORTION_${suffix}`,
  open: `CODEX_OPEN_PORTION_${suffix}`,
};

function initAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher password/share flow test");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
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

async function getPage(pathname, cookiePair = "") {
  const headers = cookiePair ? { Cookie: cookiePair } : {};
  const res = await fetch(`${origin}${pathname}`, { headers, redirect: "manual" });
  const text = await res.text();
  return { status: res.status, text, headers: res.headers };
}

async function postJson(pathname, body) {
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
  return { status: res.status, text, json, headers: res.headers };
}

function setCookieHeader(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().join("\n");
  }
  return headers.get("set-cookie") || "";
}

function cookiePair(setCookie, projectId) {
  const cookieName = `lz_access_${projectId}`;
  const match = setCookie.match(new RegExp(`${cookieName}=[^;\\n]+`));
  assert(match, `Missing ${cookieName} Set-Cookie header`);
  return match[0];
}

function assertNoSecrets(text, projectData, label) {
  assert(!text.includes("passwordHash"), `${label} leaked passwordHash key`);
  assert(!text.includes("passwordSalt"), `${label} leaked passwordSalt key`);
  if (projectData.passwordHash) {
    assert(!text.includes(projectData.passwordHash), `${label} leaked password hash value`);
  }
  if (projectData.passwordSalt) {
    assert(!text.includes(projectData.passwordSalt), `${label} leaked password salt value`);
  }
}

function projectData(id, slug, uid, fields = {}) {
  const now = Date.now();
  return {
    id,
    slug,
    createdBy: uid,
    createdByEmail: creatorEmail,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת סיסמה",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Password",
    familyNameEnglish: "Audit",
    gender: "male",
    honorific: "ז״ל",
    dateOfPassing: null,
    dateOfPassingHebrew: null,
    biography: "Temporary Codex password/share audit fixture.",
    familyMessage: "Temporary fixture for protected sharing.",
    isPublic: true,
    allowAnonymous: true,
    showLeaderboard: true,
    status: "active",
    tracks: ["mishnayos"],
    repeatingSetEnabled: true,
    totalSets: 1,
    totalPortions: 1,
    claimedPortions: 0,
    completedPortions: 0,
    participantCount: 0,
    progressPct: 0,
    completedProgressPct: 0,
    locked: false,
    ...fields,
  };
}

async function seedProject(db, key, uid, protectedProject) {
  const id = projectIds[key];
  const slug = slugs[key];
  const pwFields = protectedProject ? hashPassword(password) : { passwordHash: null, passwordSalt: null };
  const project = projectData(id, slug, uid, pwFields);
  await db.collection("lzecher_projects").doc(id).set(project);
  await db.collection("lzecher_portions").doc(`codex_pw_portion_${key}_${suffix}`).set({
    id: `codex_pw_portion_${key}_${suffix}`,
    projectId: id,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: markers[key],
    displayName: markers[key],
    displayNameHebrew: markers[key],
    order: 1,
    status: "available",
    seder: "Zeraim",
    masechet: "Berachos",
    perek: 1,
    setNumber: 1,
  });
  return project;
}

async function cleanup(db) {
  for (const projectId of Object.values(projectIds)) {
    const batch = db.batch();
    for (const collection of [
      "lzecher_portions",
      "lzecher_claims",
      "lzecher_reports",
      "lzecher_contact_messages",
      "lzecher_scheduled_emails",
      "lzecher_admin_audit",
    ]) {
      const snap = await db.collection(collection).where("projectId", "==", projectId).get();
      for (const doc of snap.docs) batch.delete(doc.ref);
    }
    batch.delete(db.collection("lzecher_projects").doc(projectId));
    await batch.commit();
  }
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { idToken, uid } = await idTokenForEmail(creatorEmail);
  console.log(`Password/share flow target: ${origin}`);
  console.log(`Creator test user: ${creatorEmail}`);

  const protectedOne = await seedProject(db, "protectedOne", uid, true);
  const protectedTwo = await seedProject(db, "protectedTwo", uid, true);
  const open = await seedProject(db, "open", uid, false);

  try {
    let page = await getPage(`/he/memorial/${slugs.protectedOne}`);
    assert(page.status === 200, `Protected page before access should render gate, got ${page.status}`);
    assertNoSecrets(page.text, protectedOne, "Protected page before access");
    assert(!page.text.includes(markers.protectedOne), "Protected page leaked learning portions before password");

    let res = await postJson(`/api/memorials/${slugs.protectedOne}/access`, { password: "wrong-password" });
    assert(res.status === 401, `Wrong password should be rejected, got ${res.status} ${res.text}`);
    assert(!setCookieHeader(res.headers), "Wrong password set an access cookie");

    res = await postJson(`/api/memorials/${slugs.protectedOne}/access`, { password });
    assert(res.status === 200 && res.json?.success, `Correct password failed: ${res.status} ${res.text}`);
    const setCookie = setCookieHeader(res.headers);
    const lowerCookie = setCookie.toLowerCase();
    assert(setCookie.includes(`lz_access_${projectIds.protectedOne}=`), "Correct password did not set project-scoped cookie");
    assert(!setCookie.includes(`lz_access_${projectIds.protectedTwo}=`), "Cookie was not scoped to the single protected project");
    assert(lowerCookie.includes("httponly"), "Access cookie must be HttpOnly");
    assert(lowerCookie.includes("samesite=lax"), "Access cookie must use SameSite=Lax");
    if (origin.startsWith("https://")) {
      assert(lowerCookie.includes("secure"), "Production HTTPS access cookie must be Secure");
    }

    const firstCookie = cookiePair(setCookie, projectIds.protectedOne);
    page = await getPage(`/he/memorial/${slugs.protectedOne}`, firstCookie);
    assert(page.status === 200, `Protected page after access failed, got ${page.status}`);
    assertNoSecrets(page.text, protectedOne, "Protected page after access");
    assert(page.text.includes(markers.protectedOne), "Protected page did not show learning portions after password");

    page = await getPage(`/he/memorial/${slugs.protectedTwo}`, firstCookie);
    assert(page.status === 200, `Second protected page with first cookie should render gate, got ${page.status}`);
    assertNoSecrets(page.text, protectedTwo, "Second protected page with first cookie");
    assert(!page.text.includes(markers.protectedTwo), "Project-specific cookie opened a different protected project");

    page = await getPage(`/he/memorial/${slugs.open}`);
    assert(page.status === 200, `Open page should render without password, got ${page.status}`);
    assertNoSecrets(page.text, open, "Open page");
    assert(page.text.includes(markers.open), "Open page did not show learning portions without password");

    res = await postJson(`/api/memorials/${slugs.open}/access`, { password: "anything" });
    assert(res.status === 200 && res.json?.alreadyOpen, `Open access endpoint should be a no-op: ${res.status} ${res.text}`);
    assert(!setCookieHeader(res.headers), "Open project should not set an access cookie");

    res = await postJson("/api/dashboard", { idToken });
    assert(res.status === 200, `Dashboard failed: ${res.status} ${res.text}`);
    const dashboardText = JSON.stringify(res.json);
    assert(!dashboardText.includes("passwordHash"), "Dashboard API leaked passwordHash key");
    assert(!dashboardText.includes("passwordSalt"), "Dashboard API leaked passwordSalt key");
    assert(!dashboardText.includes(protectedOne.passwordHash), "Dashboard API leaked password hash value");
    assert(!dashboardText.includes(protectedOne.passwordSalt), "Dashboard API leaked password salt value");
    const dashboardProtected = res.json?.projects?.find((project) => project.id === projectIds.protectedOne);
    const dashboardOpen = res.json?.projects?.find((project) => project.id === projectIds.open);
    assert(dashboardProtected?.isPasswordProtected === true, "Dashboard did not mark protected project as password protected");
    assert(dashboardOpen?.isPasswordProtected === false, "Dashboard did not mark open project as open");

    console.log("Password/share flow checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Password/share flow checks failed:", err);
  process.exit(1);
});
