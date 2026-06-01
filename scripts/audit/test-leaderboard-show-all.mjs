import admin from "firebase-admin";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const origin = process.env.TEST_ORIGIN || process.argv[2] || "http://localhost:3003";
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const projectId = `codex_leaderboard_${suffix}`;
const names = [
  "משפחת אברהמי",
  "משפחת לוין",
  "משפחת כהן",
  "משפחת גולד",
  "משפחת פרידמן",
  "משפחת וייס",
  "משפחת שטרן",
];

function initAdmin() {
  if (admin.apps.length) return;
  const projectIdEnv = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectIdEnv || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env for Lzecher leaderboard audit");
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId: projectIdEnv, clientEmail, privateKey }),
    projectId: projectIdEnv,
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function getJson(pathname) {
  const res = await fetch(`${origin}${pathname}`);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

function portionId(index) {
  return `${projectId}_portion_${index}`;
}

async function seed(db) {
  const now = Date.now();
  const batch = db.batch();
  batch.set(db.collection("lzecher_projects").doc(projectId), {
    id: projectId,
    slug: projectId.replace(/_/g, "-"),
    createdAt: now,
    updatedAt: now,
    nameHebrew: "בדיקת יישר כח",
    familyNameHebrew: "קודקס",
    nameEnglish: "Codex Leaderboard",
    familyNameEnglish: "Audit",
    status: "draft",
    tracks: ["mishnayos"],
    showLeaderboard: true,
    totalPortions: 10,
    claimedPortions: 10,
    completedPortions: 0,
    participantCount: names.length,
    topMatmidim: names.slice(0, 5).map((name, index) => ({ name, count: 10 - index })),
  });

  const takers = [
    names[0], names[0], names[0],
    names[1], names[1],
    names[2],
    names[3],
    names[4],
    names[5],
    names[6],
  ];
  takers.forEach((name, index) => {
    batch.set(db.collection("lzecher_portions").doc(portionId(index)), {
      id: portionId(index),
      projectId,
      trackType: "mishnayos",
      status: "claimed",
      claimMode: "exclusive",
      claimedByName: name,
      claimedAt: now + index,
    });
  });
  await batch.commit();
}

async function cleanup(db) {
  const batch = db.batch();
  batch.delete(db.collection("lzecher_projects").doc(projectId));
  for (let i = 0; i < 10; i++) {
    batch.delete(db.collection("lzecher_portions").doc(portionId(i)));
  }
  await batch.commit();
}

async function main() {
  initAdmin();
  const db = admin.firestore();
  console.log(`Leaderboard show-all target: ${origin}`);

  await seed(db);
  try {
    const top = await getJson(`/api/projects/${projectId}/leaderboard`);
    assert(top.status === 200, `top leaderboard failed: ${top.status} ${top.text}`);
    assert(Array.isArray(top.json?.matmidim), "top leaderboard did not return matmidim");
    assert(top.json.matmidim.length === 5, `top leaderboard should return 5 entries; got ${top.json.matmidim.length}`);
    assert(top.json.hasMore === true, "top leaderboard should advertise that a full ranking may be available");

    const all = await getJson(`/api/projects/${projectId}/leaderboard?all=1`);
    assert(all.status === 200, `full leaderboard failed: ${all.status} ${all.text}`);
    assert(Array.isArray(all.json?.matmidim), "full leaderboard did not return matmidim");
    assert(all.json.matmidim.length === names.length, `full leaderboard should return ${names.length} named takers; got ${all.json.matmidim.length}`);
    assert(all.json.matmidim[0].name === names[0] && all.json.matmidim[0].count === 3, "full leaderboard should be sorted by amount taken");
    assert(all.json.matmidim.some((item) => item.name === names[6]), "full leaderboard should include people beyond the top 5");
    console.log("Leaderboard show-all checks passed.");
  } finally {
    await cleanup(db);
  }
}

main().catch((err) => {
  console.error("Leaderboard show-all checks failed:", err);
  process.exit(1);
});
