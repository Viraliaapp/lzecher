import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

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

function publicReport(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    projectId: data.projectId || null,
    projectSlug: data.projectSlug || null,
    reason: data.reason || "other",
    details: data.details || null,
    reporterEmail: data.reporterEmail || null,
    status: data.status || "open",
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
    reason: data.reason || null,
    sentAt: data.sentAt || 0,
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
    showLeaderboard: data.showLeaderboard !== false,
    allowAnonymous: data.allowAnonymous !== false,
    locked: data.locked === true,
    totalPortions,
    claimedPortions,
    completedPortions,
    participantCount: Number(data.participantCount || 0),
    progressPct: Number(data.progressPct || 0),
    completedProgressPct: Number(data.completedProgressPct || 0),
    completedCycles: Number(data.completedCycles || 0),
    reportsCount: Number(data.reportsCount || 0),
    topMatmidim: Array.isArray(data.topMatmidim) ? data.topMatmidim.slice(0, 5) : [],
    issues,
  };
}

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await requireSuperAdmin(idToken);

    const db = getAdminDb();
    const projectsRef = db.collection("lzecher_projects");
    const claimsRef = db.collection("lzecher_claims");
    const feedbackRef = db.collection("lzecher_feedback");
    const reportsRef = db.collection("lzecher_reports");
    const usersRef = db.collection("lzecher_users");
    const contactsRef = db.collection("lzecher_contact_messages");
    const auditRef = db.collection("lzecher_admin_audit");
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
      projectsSnap,
      feedbackSnap,
      claimsSnap,
      adminSnap,
      superSnap,
      reportsSnap,
      contactsSnap,
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
      projectsRef.orderBy("createdAt", "desc").get(),
      feedbackRef.orderBy("submittedAt", "desc").limit(RECENT_LIMIT).get(),
      claimsRef.orderBy("claimedAt", "desc").limit(RECENT_LIMIT).get(),
      usersRef.where("isAdmin", "==", true).get(),
      usersRef.where("isSuperAdmin", "==", true).get(),
      reportsRef.orderBy("reportedAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      contactsRef.orderBy("sentAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("at", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("timestamp", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("updatedAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
      auditRef.orderBy("deletedAt", "desc").limit(RECENT_LIMIT).get().catch(() => null),
    ]);

    const adminUsers = new Map<string, ReturnType<typeof publicAdminUser>>();
    for (const doc of adminSnap.docs) adminUsers.set(doc.id, publicAdminUser(doc.data(), doc.id));
    for (const doc of superSnap.docs) adminUsers.set(doc.id, publicAdminUser(doc.data(), doc.id));

    const projectSummaries = projectsSnap.docs.map((doc) => publicProjectSummary(doc.data(), doc.id));
    const protectedProjects = projectSummaries.filter((project) => project.isPasswordProtected).length;
    const issueProjects = projectSummaries.filter((project) => project.issues.length > 0);
    const undeliveredContacts = contactsSnap ? contactsSnap.docs.filter((doc) => doc.data().delivered !== true) : [];
    const auditById = new Map<string, ReturnType<typeof publicAudit>>();
    for (const snap of [auditAtSnap, auditTimestampSnap, auditUpdatedAtSnap, auditDeletedAtSnap]) {
      if (!snap) continue;
      for (const doc of snap.docs) {
        auditById.set(doc.id, publicAudit(doc.data(), doc.id));
      }
    }
    const recentClaims = claimsSnap.docs.map((doc) => {
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
      stats: {
        totalProjects,
        activeProjects,
        hiddenProjects,
        archivedProjects,
        protectedProjects,
        openProjects: Math.max(0, totalProjects - protectedProjects),
        projectsToday,
        projectsThisWeek,
        totalClaims,
        completedClaims,
        claimsToday,
        claimsThisWeek,
        claimsThisMonth,
        completedToday,
        completedThisWeek,
        totalFeedback,
        newFeedback,
        totalReports,
        openReports,
        totalUsers,
        adminUsers: adminUsers.size,
        projectsWithIssues: issueProjects.length,
        undeliveredContacts: undeliveredContacts.length,
      },
      healthChecks: [
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
          key: "support_queue",
          status: newFeedback + openReports + undeliveredContacts.length ? "warn" : "pass",
          label: "Support queue",
          detail: `${newFeedback} new feedback, ${openReports} open reports, ${undeliveredContacts.length} undelivered contact messages.`,
          count: newFeedback + openReports + undeliveredContacts.length,
        },
      ],
      projectSummaries,
      recentFeedback: feedbackSnap.docs.map((doc) => publicFeedback(doc.data(), doc.id)),
      recentClaims,
      adminUsers: Array.from(adminUsers.values()).sort((a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin)),
      recentReports: reportsSnap
        ? reportsSnap.docs.map((doc) => publicReport(doc.data(), doc.id))
        : [],
      recentContacts: contactsSnap
        ? contactsSnap.docs.map((doc) => publicContactMessage(doc.data(), doc.id))
        : [],
      recentAudit: Array.from(auditById.values())
        .sort((a, b) => b.at - a.at)
        .slice(0, RECENT_LIMIT),
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
