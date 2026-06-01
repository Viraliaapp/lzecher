import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectA = `codex_guard_a_${suffix}`;
const projectB = `codex_guard_b_${suffix}`;
const availablePortion = `codex_guard_available_${suffix}`;
const claimedPortion = `codex_guard_claimed_${suffix}`;
const activeClaim = `codex_guard_claim_${suffix}`;
const corruptClaim = `codex_guard_corrupt_${suffix}`;

function initAdmin() {
  if (admin.apps.length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher-scoped guard test");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  const baseProject = {
    createdAt: now,
    updatedAt: now,
    tracks: ["mishnayos"],
    locked: false,
    isPublic: true,
    allowAnonymous: true,
    showLeaderboard: true,
    claimedPortions: 0,
    completedPortions: 0,
    participantCount: 0,
    claimedByTrack: {},
    totalPortions: 2,
    progressPct: 0,
    completedProgressPct: 0,
  };
  await db.collection("lzecher_projects").doc(projectA).set({
    ...baseProject,
    slug: `codex-guard-a-${suffix}`,
    nameHebrew: "בדיקת",
    familyNameHebrew: "שמירה א",
  });
  await db.collection("lzecher_projects").doc(projectB).set({
    ...baseProject,
    slug: `codex-guard-b-${suffix}`,
    nameHebrew: "בדיקת",
    familyNameHebrew: "שמירה ב",
  });
  await db.collection("lzecher_portions").doc(availablePortion).set({
    id: availablePortion,
    projectId: projectA,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Berachos 1",
    displayName: "Berachos 1",
    displayNameHebrew: "ברכות א",
    status: "available",
    setNumber: 1,
    order: 1,
  });
  await db.collection("lzecher_portions").doc(claimedPortion).set({
    id: claimedPortion,
    projectId: projectA,
    trackType: "mishnayos",
    claimMode: "exclusive",
    reference: "Berachos 2",
    displayName: "Berachos 2",
    displayNameHebrew: "ברכות ב",
    status: "claimed",
    setNumber: 1,
    order: 2,
    claimedBy: "anonymous",
    claimedByName: "Codex Guard Owner",
    claimedAt: now,
  });
  await db.collection("lzecher_claims").doc(activeClaim).set({
    id: activeClaim,
    projectId: projectA,
    portionId: claimedPortion,
    trackType: "mishnayos",
    reference: "Berachos 2",
    userId: "anonymous",
    userName: "Codex Guard Owner",
    claimedAt: now,
    status: "active",
    duration: "oneTime",
  });
  await db.collection("lzecher_claims").doc(corruptClaim).set({
    id: corruptClaim,
    projectId: projectB,
    portionId: claimedPortion,
    trackType: "mishnayos",
    reference: "Cross-project fixture",
    userId: "anonymous",
    userName: "Codex Cross Guard",
    claimedAt: now,
    status: "active",
    duration: "oneTime",
  });
}

async function cleanup(db) {
  const batch = db.batch();
  for (const id of [activeClaim, corruptClaim]) {
    batch.delete(db.collection("lzecher_claims").doc(id));
  }
  for (const id of [availablePortion, claimedPortion]) {
    batch.delete(db.collection("lzecher_portions").doc(id));
  }
  for (const id of [projectA, projectB]) {
    batch.delete(db.collection("lzecher_projects").doc(id));
  }
  const strayClaims = await db
    .collection("lzecher_claims")
    .where("portionId", "in", [availablePortion, claimedPortion])
    .get();
  for (const doc of strayClaims.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();
}

async function verifyUnchanged(db, label) {
  const availableSnap = await db.collection("lzecher_portions").doc(availablePortion).get();
  const claimedSnap = await db.collection("lzecher_portions").doc(claimedPortion).get();
  const activeClaimSnap = await db.collection("lzecher_claims").doc(activeClaim).get();
  const corruptClaimSnap = await db.collection("lzecher_claims").doc(corruptClaim).get();
  assert(availableSnap.data()?.status === "available", `${label}: available portion was mutated`);
  assert(claimedSnap.data()?.status === "claimed", `${label}: claimed portion was mutated`);
  assert(activeClaimSnap.data()?.status === "active", `${label}: active claim was mutated`);
  assert(corruptClaimSnap.data()?.status === "active", `${label}: corrupt fixture claim was mutated`);
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  console.log(`Cross-project guard target: ${origin}`);
  await seed(db);
  try {
    let res = await post("/api/claims", {
      projectId: projectB,
      portionId: availablePortion,
      claimerName: "Codex Cross Guard",
      locale: "he",
    });
    assert(res.status === 400, `single claim mismatch expected 400, got ${res.status}: ${res.text}`);
    await verifyUnchanged(db, "single claim mismatch");

    res = await post("/api/claims/multi", {
      projectId: projectB,
      portionIds: [availablePortion],
      claimerName: "Codex Cross Guard",
      locale: "he",
    });
    assert(res.status === 409, `multi claim mismatch expected 409, got ${res.status}: ${res.text}`);
    await verifyUnchanged(db, "multi claim mismatch");

    res = await post("/api/claims/complete", {
      projectId: projectB,
      portionId: claimedPortion,
      claimId: activeClaim,
      completedByName: "Codex Cross Guard",
    });
    assert(res.status === 400, `single completion mismatch expected 400, got ${res.status}: ${res.text}`);
    await verifyUnchanged(db, "single completion mismatch");

    res = await post("/api/claims/complete-batch", {
      projectId: projectB,
      portionIds: [claimedPortion],
      completedByName: "Codex Cross Guard",
    });
    assert(res.status === 200 && res.json?.count === 0, `complete-batch mismatch expected count 0, got ${res.status}: ${res.text}`);
    await verifyUnchanged(db, "complete-batch mismatch");

    res = await post("/api/claims/complete-bulk", {
      projectId: projectB,
      scope: "all_my_claims_in_project",
      completedByName: "Codex Cross Guard",
    });
    assert(
      res.status === 200 && res.json?.completedCount === 0,
      `complete-bulk corrupted claim expected completedCount 0, got ${res.status}: ${res.text}`
    );
    await verifyUnchanged(db, "complete-bulk corrupted claim");

    console.log("Cross-project guard checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Cross-project guard checks failed:", err);
  process.exit(1);
});
