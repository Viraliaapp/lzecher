import admin from "firebase-admin";
import crypto from "node:crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const creatorEmail = process.env.TEST_SUPER_ADMIN_EMAIL || "solomon2145@gmail.com";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_claims_project_${suffix}`;
const otherProjectId = `codex_claims_other_${suffix}`;
const lockedProjectId = `codex_claims_locked_${suffix}`;
const tempUid = `codex_claims_user_${suffix}`;
const tempEmail = `codex-claims-${suffix}@example.com`;

const ids = {
  single: `codex_claim_single_${suffix}`,
  multiA: `codex_claim_multi_a_${suffix}`,
  multiB: `codex_claim_multi_b_${suffix}`,
  inclusive: `codex_claim_inclusive_${suffix}`,
  other: `codex_claim_other_${suffix}`,
  locked: `codex_claim_locked_${suffix}`,
};

function initAdmin() {
  if (admin.apps.length) return;
  const projectIdEnv = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectIdEnv || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher claim/completion audit");
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
    throw new Error(`Could not create id token for ${uid}: ${JSON.stringify(data)}`);
  }
  return data.idToken;
}

async function requestJson(method, pathname, body) {
  const res = await fetch(`${origin}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
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

function signMarkCompleteToken(claimId) {
  const secret = process.env.REMINDER_ACTION_SECRET || process.env.CRON_SECRET || "default-dev-secret-not-for-prod";
  const payload = {
    purpose: "mark_complete",
    claimId,
    locale: "en",
    iat: Date.now(),
    exp: Date.now() + 90 * 24 * 60 * 60 * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  return `${payloadB64}.${sig}`;
}

function baseProject(id, createdBy, overrides = {}) {
  const now = Date.now();
  return {
    id,
    slug: id.replace(/_/g, "-"),
    createdBy,
    createdByEmail: creatorEmail,
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת קודקס",
    familyNameHebrew: "תביעות",
    nameEnglish: "Codex Claims",
    familyNameEnglish: "Audit",
    gender: "male",
    honorific: "ז״ל",
    status: "draft",
    tracks: ["mishnayos", "kabalos"],
    locked: false,
    isPublic: false,
    allowAnonymous: true,
    showLeaderboard: true,
    repeatingSetEnabled: true,
    totalSets: 1,
    totalPortions: 4,
    claimedPortions: 0,
    completedPortions: 0,
    participantCount: 0,
    claimedByTrack: {},
    ...overrides,
  };
}

async function seed(db, creatorUid) {
  const now = Date.now();
  const batch = db.batch();
  batch.set(db.collection("lzecher_projects").doc(projectId), baseProject(projectId, creatorUid));
  batch.set(db.collection("lzecher_projects").doc(otherProjectId), baseProject(otherProjectId, creatorUid, {
    slug: `codex-claims-other-${suffix}`,
    totalPortions: 1,
  }));
  batch.set(db.collection("lzecher_projects").doc(lockedProjectId), baseProject(lockedProjectId, creatorUid, {
    slug: `codex-claims-locked-${suffix}`,
    locked: true,
    totalPortions: 1,
  }));

  for (const [id, order, reference] of [
    [ids.single, 1, "Berachos 1"],
    [ids.multiA, 2, "Berachos 2"],
    [ids.multiB, 3, "Berachos 3"],
  ]) {
    batch.set(db.collection("lzecher_portions").doc(id), {
      id,
      projectId,
      trackType: "mishnayos",
      claimMode: "exclusive",
      reference,
      displayName: reference,
      displayNameHebrew: `ברכות ${order}`,
      order,
      status: "available",
      setNumber: 1,
      createdAt: now,
    });
  }

  batch.set(db.collection("lzecher_portions").doc(ids.inclusive), {
    id: ids.inclusive,
    projectId,
    trackType: "kabalos",
    claimMode: "inclusive",
    reference: "Extra tzedakah",
    displayName: "Extra tzedakah",
    displayNameHebrew: "קבלה טובה",
    order: 4,
    status: "available",
    currentClaimerCount: 0,
    claimerNames: [],
    setNumber: 1,
    createdAt: now,
  });

  batch.set(db.collection("lzecher_portions").doc(ids.other), {
    id: ids.other,
    projectId: otherProjectId,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Other project 1",
    displayName: "Other project 1",
    order: 1,
    status: "available",
    setNumber: 1,
    createdAt: now,
  });

  batch.set(db.collection("lzecher_portions").doc(ids.locked), {
    id: ids.locked,
    projectId: lockedProjectId,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Locked project 1",
    displayName: "Locked project 1",
    order: 1,
    status: "available",
    setNumber: 1,
    createdAt: now,
  });

  await batch.commit();
}

async function deleteQuery(db, collection, field, value) {
  const snap = await db.collection(collection).where(field, "==", value).get();
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + 400)) batch.delete(doc.ref);
    await batch.commit();
  }
}

async function recomputeGlobal(db) {
  const snap = await db.collection("lzecher_projects").get();
  const totals = { mishnayos: 0, tehillim: 0, kabalos: 0, shnayim_mikra: 0, daf_yomi: 0 };
  let participants = 0;
  let projects = 0;
  for (const doc of snap.docs) {
    const p = doc.data();
    if (p.status && !["active", "completed"].includes(p.status)) continue;
    projects++;
    participants += p.participantCount || 0;
    const byTrack = p.claimedByTrack || {};
    for (const track of Object.keys(totals)) totals[track] += byTrack[track] || 0;
  }
  await db.collection("lzecher_global_stats").doc("totals").set({
    ...totals,
    participants,
    projects,
    updatedAt: Date.now(),
  }, { merge: true });
}

async function cleanup(db) {
  for (const id of [projectId, otherProjectId, lockedProjectId]) {
    for (const collection of ["lzecher_claims", "lzecher_portions", "lzecher_scheduled_emails", "lzecher_reports"]) {
      await deleteQuery(db, collection, "projectId", id);
    }
    await deleteQuery(db, "lzecher_admin_audit", "projectId", id);
    await db.collection("lzecher_projects").doc(id).delete();
  }
  try {
    await admin.auth().deleteUser(tempUid);
  } catch {
    // already gone
  }
  await recomputeGlobal(db);
}

async function claimDocsForPortion(db, portionId) {
  const snap = await db
    .collection("lzecher_claims")
    .where("projectId", "==", projectId)
    .where("portionId", "==", portionId)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  const { idToken: creatorToken, uid: creatorUid } = await idTokenForEmail(creatorEmail);

  console.log(`Claim/completion audit target: ${origin}`);
  console.log(`Creator/super-admin token: ${creatorEmail}`);

  await admin.auth().createUser({
    uid: tempUid,
    email: tempEmail,
    displayName: "Codex Inclusive",
  });
  const inclusiveToken = await idTokenForUid(tempUid);
  await seed(db, creatorUid);

  try {
    let res = await requestJson("POST", "/api/claims", {
      projectId,
      portionId: ids.single,
      claimerName: "Codex One",
      claimerEmail: `codex-one-${suffix}@example.com`,
      locale: "en",
    });
    assert(res.status === 200 && res.json?.success, `single claim failed: ${res.status} ${res.text}`);
    const singleClaimId = res.json.claimId;

    res = await requestJson("POST", "/api/claims", {
      projectId,
      portionId: ids.single,
      claimerName: "Codex Repeat",
      locale: "en",
    });
    assert(res.status === 409, `repeat single claim should conflict: ${res.status} ${res.text}`);

    res = await requestJson("POST", "/api/claims", {
      projectId,
      portionId: ids.other,
      claimerName: "Codex Wrong Project",
      locale: "en",
    });
    assert(res.status === 400, `cross-project claim should be rejected: ${res.status} ${res.text}`);

    res = await requestJson("POST", "/api/claims", {
      projectId: lockedProjectId,
      portionId: ids.locked,
      claimerName: "Codex Locked",
      locale: "en",
    });
    assert(res.status === 423, `locked project should reject claims: ${res.status} ${res.text}`);

    res = await requestJson("POST", "/api/claims", {
      projectId,
      portionId: ids.inclusive,
      claimerName: "Codex Inclusive",
      locale: "en",
    });
    assert(res.status === 401, `inclusive claim without auth should require sign-in: ${res.status} ${res.text}`);

    res = await requestJson("POST", "/api/claims/multi", {
      projectId,
      portionIds: [ids.multiA, ids.multiA, ids.multiB, ids.inclusive],
      claimerName: "Codex Multi",
      claimerEmail: `codex-multi-${suffix}@example.com`,
      reminderPreferences: ["confirmation"],
      locale: "en",
    });
    assert(res.status === 200 && res.json?.claimedCount === 2, `multi claim failed/did not dedupe: ${res.status} ${res.text}`);
    assert(res.json.skippedCount === 1, `multi skippedCount should be 1, got ${res.json.skippedCount}`);

    const scheduledSnap = await db
      .collection("lzecher_scheduled_emails")
      .where("projectId", "==", projectId)
      .where("reminderType", "==", "confirmation")
      .get();
    assert(scheduledSnap.size === 1, `expected one confirmation email, got ${scheduledSnap.size}`);
    const parentClaimId = scheduledSnap.docs[0].data().claimId;
    assert(parentClaimId && !String(parentClaimId).startsWith("multi-"), `scheduled email used fake claim id: ${parentClaimId}`);
    const parentSnap = await db.collection("lzecher_claims").doc(parentClaimId).get();
    assert(parentSnap.exists && parentSnap.data().isParent === true, "multi parent claim was not created");
    assert(parentSnap.data().portionIds?.length === 2, "multi parent should contain exactly two unique portions");

    const multiChildrenSnap = await db
      .collection("lzecher_claims")
      .where("parentClaimId", "==", parentClaimId)
      .get();
    assert(multiChildrenSnap.size === 2, `expected two multi child claims, got ${multiChildrenSnap.size}`);

    res = await requestJson("POST", "/api/claims", {
      projectId,
      portionId: ids.inclusive,
      claimerName: "Codex Inclusive",
      idToken: inclusiveToken,
      locale: "en",
    });
    assert(res.status === 200 && res.json?.claimMode === "inclusive", `inclusive auth claim failed: ${res.status} ${res.text}`);
    const inclusivePortion = (await db.collection("lzecher_portions").doc(ids.inclusive).get()).data();
    assert(inclusivePortion.currentClaimerCount === 1, "inclusive portion did not increment claimer count");
    assert(inclusivePortion.claimerNames?.includes("Codex Inclusive"), "inclusive claimer name was not stored");

    res = await requestJson("POST", "/api/claims/complete-batch", {
      projectId,
      portionIds: [ids.single],
      completedByName: "Codex One",
    });
    assert(res.status === 200 && res.json?.count === 1, `complete-batch failed: ${res.status} ${res.text}`);
    const singlePortion = (await db.collection("lzecher_portions").doc(ids.single).get()).data();
    assert(singlePortion.status === "completed", "single portion was not completed");
    const singleClaims = await claimDocsForPortion(db, ids.single);
    assert(singleClaims.some((claim) => claim.id === singleClaimId && claim.status === "completed"), "single claim doc was not completed");

    const markToken = signMarkCompleteToken(parentClaimId);
    res = await requestJson("GET", `/api/claims/mark-complete-via-link?token=${encodeURIComponent(markToken)}&locale=en`);
    const location = res.headers.get("location") || "";
    assert(res.status >= 300 && res.status < 400 && location.includes("status=success"), `parent reminder link did not redirect success: ${res.status} ${location}`);

    for (const portionId of [ids.multiA, ids.multiB]) {
      const portion = (await db.collection("lzecher_portions").doc(portionId).get()).data();
      assert(portion.status === "completed", `${portionId} was not completed by parent reminder link`);
    }
    const completedChildren = await db
      .collection("lzecher_claims")
      .where("parentClaimId", "==", parentClaimId)
      .get();
    assert(completedChildren.docs.every((doc) => doc.data().status === "completed"), "parent reminder link did not complete all child claims");
    assert((await db.collection("lzecher_claims").doc(parentClaimId).get()).data().status === "completed", "parent claim was not completed");

    res = await requestJson("POST", `/api/projects/${projectId}/claims`, { idToken: creatorToken });
    assert(res.status === 200, `creator claim list failed: ${res.status} ${res.text}`);
    assert(!res.json.claims.some((claim) => claim.isParent === true), "creator claim list exposed parent summary rows");

    console.log("Claim/completion flow checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Claim/completion flow checks failed:", err);
  process.exit(1);
});
