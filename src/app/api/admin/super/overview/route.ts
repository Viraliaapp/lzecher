import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { hasAdminPermission, requireAdmin } from "@/lib/auth-roles";
import { DEFAULT_SITE_SETTINGS, sanitizeSiteSettings } from "@/lib/site-settings";

const RECENT_LIMIT = 50;

async function countOf(query: FirebaseFirestore.Query): Promise<number> {
  const snap = await query.count().get();
  return snap.data().count;
}

function publicFeedback(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    type: data.type || "other",
    message: data.message || "",
    email: data.email || null,
    locale: data.locale || "en",
    currentPath: data.currentPath || null,
    status: data.status || "new",
    priority: data.priority || "normal",
    tag: data.tag || null,
    assignedTo: data.assignedTo || null,
    internalNote: data.internalNote || null,
    supportUpdatedAt: data.supportUpdatedAt || null,
    allowAsTestimonial: data.allowAsTestimonial === true,
    submittedAt: data.submittedAt || data.createdAt || 0,
  };
}

function publicAdminUser(data: FirebaseFirestore.DocumentData, uid: string) {
  return {
    uid,
    email: data.email || null,
    displayName: data.displayName || null,
    isAdmin: data.isAdmin === true,
    isSuperAdmin: data.isSuperAdmin === true,
    permissions: Array.isArray(data.permissions) ? data.permissions.filter((p) => typeof p === "string") : [],
    updatedAt: data.updatedAt || null,
    createdAt: data.createdAt || null,
  };
}

function baseUserSummary(data: FirebaseFirestore.DocumentData, uid: string) {
  return {
    uid,
    email: data.email || null,
    displayName: data.displayName || null,
    isAdmin: data.isAdmin === true,
    isSuperAdmin: data.isSuperAdmin === true,
    permissions: Array.isArray(data.permissions) ? data.permissions.filter((p) => typeof p === "string") : [],
    updatedAt: data.updatedAt || null,
    createdAt: data.createdAt || null,
    projectCount: 0,
    activeProjectCount: 0,
    claimCount: 0,
    completedClaimCount: 0,
    lastProjectAt: null as number | null,
    lastClaimAt: null as number | null,
    lastActivityAt: Number(data.updatedAt || data.createdAt || 0),
    projects: [] as {
      id: string;
      slug: string | null;
      nameHebrew: string;
      familyNameHebrew: string;
      status: string;
      progressPct: number;
    }[],
  };
}

function publicReport(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    projectId: data.projectId || null,
    projectSlug: data.projectSlug || null,
    reason: data.reason || "other",
    details: data.details || null,
    reporterEmail: data.reporterEmail || null,
    status: data.status || "open",
    priority: data.priority || "normal",
    tag: data.tag || null,
    assignedTo: data.assignedTo || null,
    internalNote: data.internalNote || null,
    supportUpdatedAt: data.supportUpdatedAt || null,
    reportedAt: data.reportedAt || 0,
  };
}

function publicContactMessage(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    projectId: data.projectId || null,
    slug: data.slug || null,
    senderEmail: data.senderEmail || null,
    message: data.message || "",
    delivered: data.delivered === true,
    supportStatus: data.supportStatus || (data.delivered === true ? "resolved" : "new"),
    priority: data.priority || "normal",
    tag: data.tag || null,
    assignedTo: data.assignedTo || null,
    internalNote: data.internalNote || null,
    supportUpdatedAt: data.supportUpdatedAt || null,
    reason: data.reason || null,
    sentAt: data.sentAt || 0,
  };
}

function publicScheduledEmail(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    projectId: data.projectId || null,
    projectSlug: data.projectSlug || null,
    claimId: data.claimId || null,
    toEmail: data.toEmail || data.userEmail || null,
    userId: data.userId || null,
    reminderType: data.reminderType || data.type || null,
    locale: data.locale || "en",
    status: data.status || "pending",
    sendAt: data.sendAt || null,
    createdAt: data.createdAt || null,
    sentAt: data.sentAt || null,
    failedAt: data.failedAt || null,
    attempts: Number(data.attempts || 0),
    lastError: typeof data.lastError === "string" ? data.lastError.slice(0, 300) : null,
  };
}

function publicAudit(data: FirebaseFirestore.DocumentData, id: string) {
  const at = data.at || data.updatedAt || data.deletedAt || data.createdAt || data.timestamp || data.completedAt || 0;
  return {
    id,
    action: data.action || "unknown",
    adminUid: data.adminUid || data.updatedBy || data.deletedBy || data.adminUpdatedBy || null,
    projectId: data.projectId || null,
    targetUid: data.targetUid || null,
    feedbackId: data.feedbackId || null,
    at,
    details: data.details || data.changes || null,
  };
}

function publicProjectSummary(data: FirebaseFirestore.DocumentData, id: string) {
  const issues: string[] = [];
  const totalPortions = Number(data.totalPortions || 0);
  const claimedPortions = Number(data.claimedPortions || 0);
  const completedPortions = Number(data.completedPortions || 0);
  const isPasswordProtected = Boolean(data.passwordHash);
  const completedCycles = Number(data.completedCycles || 0);
  const storedProgress = Number(data.progressPct || 0);
  const progressPct = typeof data.progressTotalPct === "number"
    ? Number(data.progressTotalPct)
    : completedCycles > 0 && storedProgress <= 100
      ? (completedCycles * 100) + storedProgress
      : storedProgress;
  if (!data.slug) issues.push("missing_slug");
  if (!data.createdBy) issues.push("missing_creator_uid");
  if (!Array.isArray(data.tracks) || data.tracks.length === 0) issues.push("no_tracks");
  if (totalPortions === 0) issues.push("no_portions");
  if (claimedPortions > totalPortions) issues.push("claimed_gt_total");
  if (completedPortions > claimedPortions) issues.push("completed_gt_claimed");
  if (Boolean(data.passwordHash) !== Boolean(data.passwordSalt)) issues.push("password_hash_salt_mismatch");

  return {
    id,
    slug: data.slug || null,
    nameHebrew: data.nameHebrew || "",
    familyNameHebrew: data.familyNameHebrew || "",
    nameEnglish: data.nameEnglish || "",
    familyNameEnglish: data.familyNameEnglish || "",
    createdBy: data.createdBy || null,
    createdByEmail: data.createdByEmail || null,
    createdAt: data.createdAt || 0,
    updatedAt: data.updatedAt || 0,
    status: data.status || "active",
    tracks: Array.isArray(data.tracks) ? data.tracks.filter((track) => typeof track === "string") : [],
    isPasswordProtected,
    isPublic: data.isPublic !== false,
    showLeaderboard: data.showLeaderboard !== false,
    locked: data.locked === true,
    repeatingSetEnabled: data.repeatingSetEnabled !== false,
    startedByVisible: data.startedByVisible !== false,
    announcement: typeof data.announcement === "string" ? data.announcement : null,
    customDedication: typeof data.customDedication === "string" ? data.customDedication : null,
    totalPortions,
    claimedPortions,
    completedPortions,
    participantCount: Number(data.participantCount || 0),
    progressPct,
    completedProgressPct: Number(data.completedProgressPct || 0),
    completedCycles,
    reportsCount: Number(data.reportsCount || 0),
    topMatmidim: Array.isArray(data.topMatmidim) ? data.topMatmidim.slice(0, 5) : [],
    issues,
  };
}

function lastDayKeys(days: number) {
  const keys: string[] = [];
  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const date = new Date(base.getTime() - i * 86400000);
    keys.push(date.toISOString().slice(0, 10));
  }
  return keys;
}

function safeNumberMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, count]) => typeof count === "number")
      .map(([key, count]) => [key, Number(count)])
  ) as Record<string, number>;
}

function safeStringMap(value: unknown) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => typeof item === "string")
      .map(([key, item]) => [key, String(item)])
  ) as Record<string, string>;
}

function siteViewSummary(
  viewDocs: FirebaseFirestore.DocumentSnapshot[],
  projectSummaries: ReturnType<typeof publicProjectSummary>[]
) {
  const projectLookup = new Map(projectSummaries.map((project) => [project.id, project]));
  let today = 0;
  let thisWeek = 0;
  let thisMonth = 0;
  const byLocale: Record<string, number> = {};
  const byRoute: Record<string, number> = {};
  const projectViews: Record<string, number> = {};
  const projectSlugs: Record<string, string> = {};
  const projectNames: Record<string, string> = {};

  viewDocs.forEach((doc, index) => {
    if (!doc.exists) return;
    const data = doc.data() || {};
    const total = Number(data.total || 0);
    if (index === 0) today += total;
    if (index < 7) thisWeek += total;
    thisMonth += total;

    for (const [locale, count] of Object.entries(safeNumberMap(data.byLocale))) {
      byLocale[locale] = (byLocale[locale] || 0) + count;
    }
    for (const [route, count] of Object.entries(safeNumberMap(data.byRoute))) {
      byRoute[route] = (byRoute[route] || 0) + count;
    }
    const slugs = safeStringMap(data.projectSlugs);
    const names = safeStringMap(data.projectNames);
    for (const [projectId, count] of Object.entries(safeNumberMap(data.projectViews))) {
      projectViews[projectId] = (projectViews[projectId] || 0) + count;
      if (slugs[projectId]) projectSlugs[projectId] = slugs[projectId];
      if (names[projectId]) projectNames[projectId] = names[projectId];
    }
  });

  const topProjects = Object.entries(projectViews)
    .map(([projectId, views]) => {
      const project = projectLookup.get(projectId);
      const fallbackName = [project?.nameHebrew, project?.familyNameHebrew].filter(Boolean).join(" ").trim();
      return {
        projectId,
        slug: projectSlugs[projectId] || project?.slug || null,
        name: projectNames[projectId] || fallbackName || projectId,
        views,
      };
    })
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  return { today, thisWeek, thisMonth, byLocale, byRoute, topProjects };
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await requireAdmin(idToken);
    const rolePermissions = Array.isArray(decoded.lzecherPermissions) ? decoded.lzecherPermissions : [];
    const canStats = hasAdminPermission(decoded, "stats");
    const canProjects = hasAdminPermission(decoded, "projects");
    const canFeedback = hasAdminPermission(decoded, "feedback");
    const canReports = hasAdminPermission(decoded, "reports");
    const canUsers = hasAdminPermission(decoded, "users");
    const canSettings = hasAdminPermission(decoded, "settings");

    const db = getAdminDb();
    const projectsRef = db.collection("lzecher_projects");
    const claimsRef = db.collection("lzecher_claims");
    const feedbackRef = db.collection("lzecher_feedback");
    const reportsRef = db.collection("lzecher_reports");
    const usersRef = db.collection("lzecher_users");
    const contactsRef = db.collection("lzecher_contact_messages");
    const auditRef = db.collection("lzecher_admin_audit");
    const scheduledEmailsRef = db.collection("lzecher_scheduled_emails");
    const settingsRef = db.collection("lzecher_settings").doc("site");
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    const [
      totalProjects,
      activeProjects,
      hiddenProjects,
      archivedProjects,
      totalClaims,
      completedClaims,
      claimsToday,
      claimsThisWeek,
      claimsThisMonth,
      completedToday,
      completedThisWeek,
      projectsToday,
      projectsThisWeek,
      totalFeedback,
      newFeedback,
      totalReports,
      openReports,
      totalUsers,
      pendingReminderEmails,
      failedReminderEmails,
      sentReminderEmails,
      usersListSnap,
      claimsForUsersSnap,
      projectsSnap,
      feedbackSnap,
      claimsSnap,
      adminSnap,
      superSnap,
      reportsSnap,
      contactsSnap,
      scheduledEmailsSnap,
      settingsSnap,
      auditAtSnap,
      auditTimestampSnap,
      auditUpdatedAtSnap,
      auditDeletedAtSnap,
    ] = await Promise.all([
      countOf(projectsRef),
      countOf(projectsRef.where("status", "==", "active")),
      countOf(projectsRef.where("status", "==", "hidden")),
      countOf(projectsRef.where("status", "==", "archived")),
      countOf(claimsRef),
      countOf(claimsRef.where("status", "==", "completed")),
      countOf(claimsRef.where("claimedAt", ">=", dayAgo)),
      countOf(claimsRef.where("claimedAt", ">=", weekAgo)),
      countOf(claimsRef.where("claimedAt", ">=", monthAgo)),
      countOf(claimsRef.where("completedAt", ">=", dayAgo)),
      countOf(claimsRef.where("completedAt", ">=", weekAgo)),
      countOf(projectsRef.where("createdAt", ">=", dayAgo)),
      countOf(projectsRef.where("createdAt", ">=", weekAgo)),
      countOf(feedbackRef),
      countOf(feedbackRef.where("status", "==", "new")),
      countOf(reportsRef),
      countOf(reportsRef.where("status", "==", "open")),
      countOf(usersRef),
      countOf(scheduledEmailsRef.where("status", "==", "pending")),
      countOf(scheduledEmailsRef.where("status", "==", "failed")),
      countOf(scheduledEmailsRef.where("status", "==", "sent")),
      usersRef.limit(500).get(),
      claimsRef.limit(5000).get(),
      projectsRef.orderBy("createdAt", "desc").get(),
      feedbackRef.orderBy("submittedAt", "desc").limit(RECENT_LIMIT).get(),
      claimsRef.orderBy("claimedAt", "desc").limit(RECENT_LIMIT).get(),
      usersRef.where("isAdmin", "==", true).get(),
      usersRef.where("isSuperAdmin", "==", true).get(),
      reportsRef.orderBy("reportedAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      contactsRef.orderBy("sentAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      scheduledEmailsRef.orderBy("sendAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      settingsRef.get().catch(() => null),
      auditRef.orderBy("at", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("timestamp", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("updatedAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("deletedAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
    ]);

    const adminUsers = new Map<string, ReturnType<typeof publicAdminUser>>();
    for (const doc of adminSnap.docs) adminUsers.set(doc.id, publicAdminUser(doc.data(), doc.id));
    for (const doc of superSnap.docs) adminUsers.set(doc.id, publicAdminUser(doc.data(), doc.id));

    const projectSummaries = projectsSnap.docs.map((doc) => publicProjectSummary(doc.data(), doc.id));
    const viewDayKeys = lastDayKeys(30);
    const viewDocs = await db.getAll(
      ...viewDayKeys.map((key) => db.collection("lzecher_view_stats").doc(`site_${key}`))
    ).catch(() => [] as FirebaseFirestore.DocumentSnapshot[]);
    const siteViews = siteViewSummary(viewDocs, projectSummaries);
    const allLoadedClaims = claimsForUsersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Record<string, unknown>);
    const nonParentLoadedClaims = allLoadedClaims.filter((claim) => claim.isParent !== true);
    const loadedAllClaims = claimsForUsersSnap.size < 5000;
    const parentSummaryClaims = allLoadedClaims.length - nonParentLoadedClaims.length;
    const learningClaimStats = {
      total: loadedAllClaims ? nonParentLoadedClaims.length : Math.max(0, totalClaims - parentSummaryClaims),
      completed: loadedAllClaims
        ? nonParentLoadedClaims.filter((claim) => claim.status === "completed").length
        : completedClaims,
      today: loadedAllClaims
        ? nonParentLoadedClaims.filter((claim) => Number(claim.claimedAt || 0) >= dayAgo).length
        : claimsToday,
      thisWeek: loadedAllClaims
        ? nonParentLoadedClaims.filter((claim) => Number(claim.claimedAt || 0) >= weekAgo).length
        : claimsThisWeek,
      thisMonth: loadedAllClaims
        ? nonParentLoadedClaims.filter((claim) => Number(claim.claimedAt || 0) >= monthAgo).length
        : claimsThisMonth,
      completedToday: loadedAllClaims
        ? nonParentLoadedClaims.filter((claim) => Number(claim.completedAt || 0) >= dayAgo).length
        : completedToday,
      completedThisWeek: loadedAllClaims
        ? nonParentLoadedClaims.filter((claim) => Number(claim.completedAt || 0) >= weekAgo).length
        : completedThisWeek,
    };
    const userSummaries = new Map<string, ReturnType<typeof baseUserSummary>>();
    for (const doc of usersListSnap.docs) {
      userSummaries.set(doc.id, baseUserSummary(doc.data(), doc.id));
    }
    const ensureUser = (uid: string, data: FirebaseFirestore.DocumentData = {}) => {
      if (!userSummaries.has(uid)) userSummaries.set(uid, baseUserSummary(data, uid));
      const item = userSummaries.get(uid)!;
      if (!item.email && data.email) item.email = data.email;
      if (!item.displayName && data.displayName) item.displayName = data.displayName;
      return item;
    };
    for (const project of projectSummaries) {
      if (!project.createdBy) continue;
      const item = ensureUser(project.createdBy, { email: project.createdByEmail });
      item.projectCount += 1;
      if (project.status === "active") item.activeProjectCount += 1;
      item.lastProjectAt = Math.max(Number(item.lastProjectAt || 0), Number(project.createdAt || project.updatedAt || 0)) || null;
      item.lastActivityAt = Math.max(item.lastActivityAt, Number(project.updatedAt || project.createdAt || 0));
      item.projects.push({
        id: project.id,
        slug: project.slug,
        nameHebrew: project.nameHebrew,
        familyNameHebrew: project.familyNameHebrew,
        status: project.status,
        progressPct: project.progressPct,
      });
    }
    for (const claim of nonParentLoadedClaims) {
      const uid = typeof claim.userId === "string" && claim.userId && claim.userId !== "anonymous" ? claim.userId : "";
      if (!uid) continue;
      const item = ensureUser(uid, { email: claim.userEmail, displayName: claim.userName });
      item.claimCount += 1;
      if (claim.status === "completed") item.completedClaimCount += 1;
      item.lastClaimAt = Math.max(Number(item.lastClaimAt || 0), Number(claim.completedAt || claim.claimedAt || 0)) || null;
      item.lastActivityAt = Math.max(item.lastActivityAt, Number(claim.completedAt || claim.claimedAt || 0));
    }
    const publicUserSummaries = Array.from(userSummaries.values())
      .map((item) => ({
        ...item,
        projects: item.projects
          .sort((a, b) => b.progressPct - a.progressPct || a.nameHebrew.localeCompare(b.nameHebrew))
          .slice(0, 5),
      }))
      .sort((a, b) =>
        Number(b.isSuperAdmin) - Number(a.isSuperAdmin) ||
        Number(b.isAdmin) - Number(a.isAdmin) ||
        b.projectCount - a.projectCount ||
        b.lastActivityAt - a.lastActivityAt
      );
    const siteSettings = settingsSnap?.exists
      ? sanitizeSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...settingsSnap.data() })
      : DEFAULT_SITE_SETTINGS;
    const enabledFeatureFlags = Object.values(siteSettings.featureFlags).filter(Boolean).length;
    const protectedProjects = projectSummaries.filter((project) => project.isPasswordProtected).length;
    const issueProjects = projectSummaries.filter((project) => project.issues.length > 0);
    const undeliveredContacts = contactsSnap ? contactsSnap.docs.filter((doc) => doc.data().delivered !== true) : [];
    const openContactMessages = contactsSnap
      ? contactsSnap.docs.filter((doc) => {
          const data = doc.data();
          const status = data.supportStatus || (data.delivered === true ? "resolved" : "new");
          return status === "new" || status === "open";
        })
      : [];
    const auditById = new Map<string, ReturnType<typeof publicAudit>>();
    for (const snap of [auditAtSnap, auditTimestampSnap, auditUpdatedAtSnap, auditDeletedAtSnap]) {
      if (!snap) continue;
      for (const doc of snap.docs) {
        auditById.set(doc.id, publicAudit(doc.data(), doc.id));
      }
    }
    const recentClaims = claimsSnap.docs.filter((doc) => doc.data().isParent !== true).map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId: data.projectId || null,
        userName: data.userName || data.claimedByName || "",
        userEmail: data.userEmail || null,
        trackType: data.trackType || null,
        reference: data.reference || null,
        status: data.status || "active",
        claimedAt: data.claimedAt || 0,
        completedAt: data.completedAt || null,
      };
    });

    return NextResponse.json({
      role: {
        isAdmin: Boolean(decoded.isAdmin || decoded.isSuperAdmin),
        isSuperAdmin: Boolean(decoded.isSuperAdmin),
        permissions: rolePermissions,
        access: {
          stats: canStats,
          projects: canProjects,
          feedback: canFeedback,
          reports: canReports,
          users: canUsers,
          settings: canSettings,
        },
      },
      stats: {
        totalProjects,
        activeProjects,
        hiddenProjects,
        archivedProjects,
        protectedProjects,
        openProjects: Math.max(0, totalProjects - protectedProjects),
        projectsToday,
        projectsThisWeek,
        totalClaims: learningClaimStats.total,
        completedClaims: learningClaimStats.completed,
        claimsToday: learningClaimStats.today,
        claimsThisWeek: learningClaimStats.thisWeek,
        claimsThisMonth: learningClaimStats.thisMonth,
        completedToday: learningClaimStats.completedToday,
        completedThisWeek: learningClaimStats.completedThisWeek,
        totalFeedback,
        newFeedback,
        totalReports,
        openReports,
        totalUsers,
        parentSummaryClaims,
        pendingReminderEmails,
        failedReminderEmails,
        sentReminderEmails,
        adminUsers: adminUsers.size,
        enabledFeatureFlags,
        projectsWithIssues: issueProjects.length,
        undeliveredContacts: undeliveredContacts.length,
        openContactMessages: openContactMessages.length,
        siteViewsToday: siteViews.today,
        siteViewsThisWeek: siteViews.thisWeek,
        siteViewsThisMonth: siteViews.thisMonth,
      },
      healthChecks: canStats || canProjects ? [
        {
          key: "firebase_scope",
          status: "pass",
          label: "Lzecher-only Firebase scope",
          detail: "This portal reads and writes only collections prefixed with lzecher_.",
        },
        {
          key: "project_integrity",
          status: issueProjects.length ? "warn" : "pass",
          label: "Project data integrity",
          detail: issueProjects.length ? `${issueProjects.length} project(s) have diagnostics to review.` : "No project summary issues found.",
          count: issueProjects.length,
        },
        {
          key: "site_controls",
          status: "pass",
          label: "Public site controls",
          detail: `${enabledFeatureFlags} public feature flag(s) enabled from lzecher_settings/site.`,
          count: enabledFeatureFlags,
        },
        {
          key: "support_queue",
          status: newFeedback + openReports + openContactMessages.length ? "warn" : "pass",
          label: "Support queue",
          detail: `${newFeedback} new feedback, ${openReports} open reports, ${openContactMessages.length} open contact messages.`,
          count: newFeedback + openReports + openContactMessages.length,
        },
        {
          key: "reminder_queue",
          status: failedReminderEmails > 0 ? "warn" : "pass",
          label: "Reminder email queue",
          detail: `${pendingReminderEmails} pending, ${failedReminderEmails} failed, ${sentReminderEmails} sent reminder email(s).`,
          count: failedReminderEmails,
        },
      ] : [],
      projectSummaries: canProjects ? projectSummaries : [],
      userSummaries: canUsers ? publicUserSummaries : [],
      recentFeedback: canFeedback ? feedbackSnap.docs.map((doc) => publicFeedback(doc.data(), doc.id)) : [],
      recentClaims: canStats || canProjects ? recentClaims : [],
      adminUsers: decoded.isSuperAdmin
        ? Array.from(adminUsers.values()).sort((a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin))
        : [],
      recentReports: canReports && reportsSnap
        ? reportsSnap.docs.map((doc) => publicReport(doc.data(), doc.id))
        : [],
      recentContacts: canFeedback && contactsSnap
        ? contactsSnap.docs.map((doc) => publicContactMessage(doc.data(), doc.id))
        : [],
      recentScheduledEmails: canStats && scheduledEmailsSnap
        ? scheduledEmailsSnap.docs.map((doc) => publicScheduledEmail(doc.data(), doc.id))
        : [],
      recentAudit: decoded.isSuperAdmin
        ? Array.from(auditById.values())
            .sort((a, b) => b.at - a.at)
            .slice(0, RECENT_LIMIT)
        : [],
      siteViews: canStats ? siteViews : {
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        byLocale: {},
        byRoute: {},
        topProjects: [],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/overview]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
