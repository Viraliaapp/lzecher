import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const locales = ["en", "he", "es", "fr"];
const requiredMessagePaths = [
  ["dashboard", "communityTitle"],
  ["dashboard", "communityDesc"],
  ["dashboard", "browseMemorials"],
  ["dashboard", "signIn"],
  ["contact", "error"],
];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getPath(obj, keys) {
  return keys.reduce((value, key) => value?.[key], obj);
}

for (const locale of locales) {
  const messages = JSON.parse(read(`messages/${locale}.json`));
  for (const keys of requiredMessagePaths) {
    assert(
      typeof getPath(messages, keys) === "string",
      `Missing messages/${locale}.json key: ${keys.join(".")}`
    );
  }
}

for (const icon of [
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/apple-touch-icon.png",
]) {
  const file = path.join(root, icon);
  assert(fs.existsSync(file), `Missing icon: ${icon}`);
  assert(fs.statSync(file).size > 1000, `Icon looks too small: ${icon}`);
}

const sourceFiles = [
  ...fs.readdirSync(path.join(root, "src"), { recursive: true }),
  ...fs.readdirSync(path.join(root, "scripts"), { recursive: true }),
]
  .filter((file) => /\.(ts|tsx|js|mjs)$/.test(file))
  .map((file) => {
    const base = fs.existsSync(path.join(root, "src", file)) ? "src" : "scripts";
    return path.join(base, file);
  });

const collectionPattern = /\.collection\(\s*["']([^"']+)["']\s*\)/g;
for (const rel of sourceFiles) {
  const text = read(rel);
  for (const match of text.matchAll(collectionPattern)) {
    assert(
      match[1].startsWith("lzecher_"),
      `Unsafe Firestore collection in ${rel}: ${match[1]}`
    );
  }
}

const createRoute = read("src/app/api/projects/create/route.ts");
assert(
  createRoute.includes("FIRESTORE_WRITE_CHUNK") && createRoute.includes("flushBatch"),
  "Project create route is missing chunked Firestore writes"
);

const bulkRoute = read("src/app/api/claims/bulk/route.ts");
assert(
  bulkRoute.includes("const BATCH_SIZE = 200"),
  "Bulk claims route should stay under the Firestore batch limit"
);

const completeBulkRoute = read("src/app/api/claims/complete-bulk/route.ts");
assert(
  completeBulkRoute.includes("const WRITE_CHUNK = 225"),
  "Bulk completion route should stay under the Firestore batch limit"
);

const completeBatchRoute = read("src/app/api/claims/complete-batch/route.ts");
assert(
  completeBatchRoute.includes('collection("lzecher_claims")') &&
    completeBatchRoute.includes('status: "completed"') &&
    completeBatchRoute.includes("completedPortionIds"),
  "Complete-batch route must update matching claim docs for dashboard sync"
);

const heMessages = JSON.parse(read("messages/he.json"));
assert(
  heMessages.leaderboard?.title === "יישר כוח",
  "Hebrew leaderboard title must be יישר כוח"
);
assert(
  heMessages.leaderboard?.subtitle === "",
  "Hebrew leaderboard subtitle should stay empty"
);
assert(
  heMessages.feedback?.type_praise !== "שבח",
  "Feedback wording must not show שבח"
);

const feedbackWidget = read("src/components/FeedbackWidget.tsx");
assert(
  !feedbackWidget.includes('"praise"'),
  "Feedback widget should not show a praise/שבח category"
);
assert(
  feedbackWidget.includes("bottom-6 right-6") && !feedbackWidget.includes("bottom-6 end-6"),
  "Feedback bubble must stay on the visual right so it does not overlap Hebrew activity bubbles"
);

const activityBubbles = read("src/components/activity/ActivityBubbles.tsx");
assert(
  activityBubbles.includes("left: \"1rem\"") &&
    activityBubbles.includes("max-w-[calc(100vw-6.5rem)]"),
  "Activity bubbles must stay left-aligned with reserved mobile space for the feedback bubble"
);

const leaderboard = read("src/components/activity/Leaderboard.tsx");
assert(
  !leaderboard.includes('t("subtitle")') && !leaderboard.includes("subtitle"),
  "Leaderboard should not render the old explanatory subtitle"
);

const dashboardRoute = read("src/app/api/dashboard/route.ts");
assert(
  dashboardRoute.includes("isPasswordProtected") &&
    dashboardRoute.includes("passwordHash") &&
    dashboardRoute.includes("passwordSalt"),
  "Dashboard API must strip password hashes and return only isPasswordProtected"
);

const memorialPage = read("src/app/[locale]/memorial/[slug]/page.tsx");
assert(
  memorialPage.includes("safeProject") &&
    memorialPage.includes("isPasswordProtected: isProtected(project)"),
  "Memorial page must not serialize password hash/salt into the client component"
);

const adminPage = read("src/app/[locale]/admin/page.tsx");
assert(
  adminPage.includes('fetch("/api/admin/projects"') &&
    !adminPage.includes('collection(db, "lzecher_projects")'),
  "Admin project list must use the sanitized admin API instead of direct client Firestore reads"
);

console.log("Codex static smoke checks passed.");
