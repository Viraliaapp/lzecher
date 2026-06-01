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
assert(
  bulkRoute.includes("Project not found") &&
    bulkRoute.includes('collection("lzecher_projects").doc(projectId)') &&
    bulkRoute.includes('where("projectId", "==", projectId)'),
  "Bulk claims must verify the Lzecher project exists before creating claims"
);

const claimRoute = read("src/app/api/claims/route.ts");
assert(
  claimRoute.includes("runTransaction") &&
    claimRoute.includes("freshPortionData.projectId !== projectId") &&
    claimRoute.includes("Portion does not belong to this memorial") &&
    claimRoute.includes("Project not found"),
  "Single claims must atomically verify project/portion ownership before writing"
);

const multiClaimRoute = read("src/app/api/claims/multi/route.ts");
assert(
  multiClaimRoute.includes("Project not found") &&
    multiClaimRoute.includes("data.projectId !== projectId") &&
    multiClaimRoute.includes("No available portions found"),
  "Multi-claim must reject missing projects and skip portions outside the project"
);

const completeBulkRoute = read("src/app/api/claims/complete-bulk/route.ts");
assert(
  completeBulkRoute.includes("const WRITE_CHUNK = 225"),
  "Bulk completion route should stay under the Firestore batch limit"
);
assert(
  completeBulkRoute.includes("d.data().isParent !== true") &&
    completeBulkRoute.includes("Project not found") &&
    completeBulkRoute.includes("portionSnap.data()!.projectId !== pid") &&
    completeBulkRoute.includes("completedCount"),
  "Bulk completion must skip parent claims and verify claim-to-portion project ownership"
);

const completeBatchRoute = read("src/app/api/claims/complete-batch/route.ts");
assert(
  completeBatchRoute.includes('collection("lzecher_claims")') &&
    completeBatchRoute.includes('status: "completed"') &&
    completeBatchRoute.includes("completedPortionIds") &&
    completeBatchRoute.includes("Project not found"),
  "Complete-batch route must update matching claim docs for dashboard sync"
);

const completeRoute = read("src/app/api/claims/complete/route.ts");
assert(
  completeRoute.includes("Project not found") &&
    completeRoute.includes("portionData.projectId !== projectId") &&
    completeRoute.includes("claimData.projectId !== projectId || claimData.portionId !== portionId") &&
    completeRoute.includes('.where("projectId", "==", projectId)') &&
    completeRoute.includes("completionBatch.commit()"),
  "Single completion must verify project, portion, and claim ownership before writing"
);

const markCompleteViaLinkRoute = read("src/app/api/claims/mark-complete-via-link/route.ts");
assert(
  markCompleteViaLinkRoute.includes("!claimData.projectId") &&
    markCompleteViaLinkRoute.includes("portionData.projectId !== claimData.projectId") &&
    markCompleteViaLinkRoute.includes("batch.commit()"),
  "Reminder completion links must verify claim-to-project and portion-to-project ownership before writing"
);

const projectClaimRoute = read("src/app/api/projects/[id]/claims/[claimId]/route.ts");
assert(
  projectClaimRoute.includes("portData.projectId !== projectId") &&
    projectClaimRoute.includes("portionRefToRename") &&
    projectClaimRoute.includes("batch.commit()"),
  "Creator claim edit/delete routes must verify portions stay inside the selected Lzecher project"
);

const heMessages = JSON.parse(read("messages/he.json"));
assert(
  heMessages.leaderboard?.title === "יישר כח",
  "Hebrew leaderboard title must be יישר כח"
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
assert(
  leaderboard.includes("MAX_VISIBLE_MATMIDIM = 5") &&
    leaderboard.includes("aria-expanded") &&
    leaderboard.includes("Award"),
  "Leaderboard should be a collapsible medal-style top-5 panel"
);

const leaderboardRoute = read("src/app/api/projects/[id]/leaderboard/route.ts");
assert(
  leaderboardRoute.includes("LEADERBOARD_LIMIT = 5") &&
    leaderboardRoute.includes("matmidim.slice(0, LEADERBOARD_LIMIT)"),
  "Leaderboard API should only return the top 5"
);

const recomputeProgress = read("src/lib/recompute-progress.ts");
assert(
  recomputeProgress.includes(".slice(0, 5)"),
  "Stored topMatmidim should be limited to top 5"
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

const creatorProjectUpdateRoute = read("src/app/api/projects/[id]/update/route.ts");
assert(
  creatorProjectUpdateRoute.includes('import { seedSetForTrack } from "@/lib/seed-set"') &&
    creatorProjectUpdateRoute.includes("track === \"mishnayos\" || track === \"tehillim\"") &&
    creatorProjectUpdateRoute.includes("track === \"shnayim_mikra\"") &&
    creatorProjectUpdateRoute.includes("PARSHIYOT") &&
    creatorProjectUpdateRoute.includes("displayNameHebrew: `פרשת ${p.nameHebrew}`"),
  "Creator project update must seed real portions when adding Mishnayos, Tehillim, or Shnayim Mikra tracks"
);

const adminProjectUpdateRoute = read("src/app/api/admin/projects/[id]/update/route.ts");
assert(
  adminProjectUpdateRoute.includes('import { seedSetForTrack } from "@/lib/seed-set"') &&
    adminProjectUpdateRoute.includes("track === \"mishnayos\" || track === \"tehillim\"") &&
    adminProjectUpdateRoute.includes("track === \"shnayim_mikra\"") &&
    adminProjectUpdateRoute.includes("PARSHIYOT") &&
    adminProjectUpdateRoute.includes("displayNameHebrew: `פרשת ${p.nameHebrew}`"),
  "Admin project update must seed real portions when adding Mishnayos, Tehillim, or Shnayim Mikra tracks"
);

const adminPage = read("src/app/[locale]/admin/page.tsx");
assert(
  adminPage.includes('fetch("/api/admin/projects"') &&
    !adminPage.includes('collection(db, "lzecher_projects")'),
  "Admin project list must use the sanitized admin API instead of direct client Firestore reads"
);
assert(
  adminPage.includes('import { Link, useRouter } from "@/i18n/navigation"') &&
    !adminPage.includes('<a href={`/admin/projects/'),
  "Admin project edit links must use the localized i18n Link so Hebrew users stay under /he"
);
assert(
  adminPage.includes("adminRole") &&
    adminPage.includes("profile?.isSuperAdmin || adminRole?.isSuperAdmin"),
  "Admin page should use the server-verified admin role to show the super-admin portal"
);
assert(
  ["stats", "analytics", "projects", "users", "support", "integrity", "language", "health", "audit", "control", "admins"].every((tab) =>
    adminPage.includes(`TabsTrigger value="${tab}"`)
  ) &&
    adminPage.includes("loadProjectDetail") &&
    adminPage.includes("recomputeSelectedProject") &&
    adminPage.includes("analyticsRates") &&
    adminPage.includes("trackAnalytics") &&
    adminPage.includes("supportSearch") &&
    adminPage.includes("userSearch") &&
    adminPage.includes("filteredUserSummaries") &&
    adminPage.includes("filteredFeedbackItems") &&
    adminPage.includes("renderSupportControls") &&
    adminPage.includes("savingSupportItem") &&
    adminPage.includes("/api/admin/super/contacts/") &&
    adminPage.includes("openContactMessages") &&
    adminPage.includes("Data Integrity Center") &&
    adminPage.includes("projectIssueSeverity") &&
    adminPage.includes("loadTranslationAudit") &&
    adminPage.includes("auditSearch") &&
    adminPage.includes("expandedAuditId") &&
    adminPage.includes("updateProjectControls") &&
    adminPage.includes("updateReportStatus") &&
    adminPage.includes("saveSiteSettings") &&
    adminPage.includes("targetIsAdmin"),
  "Super-admin portal should expose stats, analytics, projects, users, support, integrity, language, health, audit, control, admins, report review, project repair, and settings flows"
);

const adminProjectsRoute = read("src/app/api/admin/projects/route.ts");
assert(
  adminProjectsRoute.includes("adminRole") &&
    adminProjectsRoute.includes("isSuperAdmin: Boolean(admin.isSuperAdmin)"),
  "Admin projects API should return the verified admin role"
);

const authRoles = read("src/lib/auth-roles.ts");
assert(
  authRoles.includes("(!Array.isArray(decoded.lzecherPermissions) || !decoded.lzecherPermissions.includes(permission))"),
  "Admin permissions must deny scoped actions when a non-super admin has no explicit matching permission"
);

const superOverviewRoute = read("src/app/api/admin/super/overview/route.ts");
assert(
  superOverviewRoute.includes("requireSuperAdmin(idToken)") &&
    superOverviewRoute.includes('collection("lzecher_projects")') &&
    superOverviewRoute.includes('collection("lzecher_admin_audit")') &&
    superOverviewRoute.includes("userSummaries") &&
    superOverviewRoute.includes("claimsForUsersSnap") &&
    superOverviewRoute.includes("healthChecks") &&
    superOverviewRoute.includes("projectSummaries") &&
    superOverviewRoute.includes("recentAudit") &&
    superOverviewRoute.includes("recentContacts") &&
    superOverviewRoute.includes("openContactMessages") &&
    superOverviewRoute.includes("supportStatus"),
  "Super-admin overview must stay Lzecher-scoped and return command-center sections"
);

const superProjectDetailRoute = read("src/app/api/admin/super/projects/[id]/route.ts");
assert(
  superProjectDetailRoute.includes("requireSuperAdmin(idToken)") &&
    superProjectDetailRoute.includes('collection("lzecher_projects").doc(id).get()') &&
    superProjectDetailRoute.includes("stripProject") &&
    superProjectDetailRoute.includes("passwordHash") &&
    superProjectDetailRoute.includes("diagnostics(") &&
    superProjectDetailRoute.includes("trackStats") &&
    superProjectDetailRoute.includes('collection("lzecher_contact_messages")') &&
    superProjectDetailRoute.includes("supportStatus"),
  "Super-admin project inspector must require super admin, stay project-scoped, strip passwords, and return diagnostics"
);

const superRecomputeRoute = read("src/app/api/admin/super/projects/[id]/recompute/route.ts");
assert(
  superRecomputeRoute.includes("requireSuperAdmin(idToken)") &&
    superRecomputeRoute.includes("confirmProjectId !== id") &&
    superRecomputeRoute.includes("recomputeProjectProgress(db, id)") &&
    superRecomputeRoute.includes('collection("lzecher_admin_audit")') &&
    superRecomputeRoute.includes('scope: "single_project"'),
  "Super-admin recompute must require explicit single-project confirmation and audit every repair"
);

const superProjectSettingsRoute = read("src/app/api/admin/super/projects/[id]/settings/route.ts");
assert(
  superProjectSettingsRoute.includes("requireSuperAdmin(idToken)") &&
    superProjectSettingsRoute.includes("confirmProjectId !== id") &&
    superProjectSettingsRoute.includes('collection("lzecher_projects").doc(id)') &&
    superProjectSettingsRoute.includes('collection("lzecher_admin_audit")') &&
    superProjectSettingsRoute.includes('action: "super_admin_update_project_controls"') &&
    superProjectSettingsRoute.includes("BOOLEAN_FIELDS") &&
    superProjectSettingsRoute.includes("VALID_STATUSES"),
  "Super-admin project controls must require explicit single-project confirmation, use a narrow allowlist, touch one Lzecher project, and audit changes"
);

const superTranslationsRoute = read("src/app/api/admin/super/translations/route.ts");
assert(
  superTranslationsRoute.includes("requireSuperAdmin(idToken)") &&
    superTranslationsRoute.includes("messages") &&
    superTranslationsRoute.includes("FORBIDDEN_HEBREW_PHRASES") &&
    superTranslationsRoute.includes("hebrewEnglishSamples"),
  "Super-admin translation QA must require super admin and audit local message catalogs"
);

const superAuditRoute = read("src/app/api/admin/super/audit/route.ts");
assert(
  superAuditRoute.includes("requireSuperAdmin(idToken)") &&
    superAuditRoute.includes('collection("lzecher_admin_audit")') &&
    superAuditRoute.includes("publicAudit"),
  "Super-admin audit API must require super admin and read only the Lzecher audit log"
);

const superReportRoute = read("src/app/api/admin/super/reports/[id]/route.ts");
assert(
  superReportRoute.includes("requireSuperAdmin(idToken)") &&
    superReportRoute.includes('collection("lzecher_reports").doc(id)') &&
    superReportRoute.includes('collection("lzecher_admin_audit")') &&
    superReportRoute.includes('action: "super_admin_update_report"') &&
    superReportRoute.includes("internalNote") &&
    superReportRoute.includes("VALID_PRIORITY"),
  "Super-admin report updates must require super admin, touch one Lzecher report, write support fields, and write an audit entry"
);

const superFeedbackRoute = read("src/app/api/admin/super/feedback/[id]/route.ts");
assert(
  superFeedbackRoute.includes("requireSuperAdmin(idToken)") &&
    superFeedbackRoute.includes('collection("lzecher_feedback").doc(id)') &&
    superFeedbackRoute.includes('collection("lzecher_admin_audit")') &&
    superFeedbackRoute.includes('action: "super_admin_update_feedback"') &&
    superFeedbackRoute.includes("internalNote") &&
    superFeedbackRoute.includes("VALID_PRIORITY"),
  "Super-admin feedback updates must require super admin, touch one Lzecher feedback item, write support fields, and write an audit entry"
);

const superContactRoute = read("src/app/api/admin/super/contacts/[id]/route.ts");
assert(
  superContactRoute.includes("requireSuperAdmin(idToken)") &&
    superContactRoute.includes('collection("lzecher_contact_messages").doc(id)') &&
    superContactRoute.includes('collection("lzecher_admin_audit")') &&
    superContactRoute.includes('action: "super_admin_update_contact_message"') &&
    superContactRoute.includes("supportStatus") &&
    superContactRoute.includes("internalNote") &&
    superContactRoute.includes("VALID_PRIORITY"),
  "Super-admin contact message updates must require super admin, touch one Lzecher contact message, write support fields, and write an audit entry"
);

const superSettingsRoute = read("src/app/api/admin/super/settings/route.ts");
assert(
  superSettingsRoute.includes("requireSuperAdmin(idToken)") &&
    superSettingsRoute.includes('collection("lzecher_settings").doc("site")') &&
    superSettingsRoute.includes('collection("lzecher_admin_audit")') &&
    superSettingsRoute.includes('action: "super_admin_update_site_settings"'),
  "Super-admin site settings must require super admin, write only lzecher_settings/site, and audit changes"
);

const publicSettingsRoute = read("src/app/api/settings/route.ts");
assert(
  publicSettingsRoute.includes('collection("lzecher_settings").doc("site")') &&
    publicSettingsRoute.includes("publicSiteSettings"),
  "Public settings API must expose only sanitized Lzecher site settings"
);

const feedbackWidgetSettings = read("src/components/FeedbackWidget.tsx");
assert(
  feedbackWidgetSettings.includes("settings.featureFlags.feedbackWidget"),
  "Feedback widget should be controlled by the Lzecher site settings feature flag"
);

const siteNotice = read("src/components/SiteNotice.tsx");
assert(
  siteNotice.includes("settings.featureFlags.siteNotice") &&
    siteNotice.includes("settings.announcement"),
  "Site notice should render from the Lzecher site settings document"
);

const activityBubblesSettings = read("src/components/activity/ActivityBubbles.tsx");
assert(
  activityBubblesSettings.includes("settings.featureFlags.activityBubbles"),
  "Activity bubbles should be controlled by the Lzecher site settings feature flag"
);

const globalCounterSettings = read("src/components/activity/GlobalCounter.tsx");
assert(
  globalCounterSettings.includes("settings.featureFlags.globalCounter"),
  "Global counter should be controlled by the Lzecher site settings feature flag"
);

const authContext = read("src/context/AuthContext.tsx");
assert(
  authContext.includes("getIdTokenResult(true)") &&
    authContext.includes("isSuperAdmin: Boolean(profileData.isSuperAdmin || claims.isSuperAdmin)"),
  "Auth context should merge refreshed Firebase role claims into the client profile"
);

console.log("Codex static smoke checks passed.");
