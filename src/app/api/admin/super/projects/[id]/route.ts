import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";
import { computeProgress } from "@/lib/progress";
import { computeTopMatmidim } from "@/lib/recompute-progress";

type DocWithId = FirebaseFirestore.DocumentData & { id: string };

function withId(doc: FirebaseFirestore.QueryDocumentSnapshot): DocWithId {
  return { id: doc.id, ...doc.data() };
}

function stripProject(data: FirebaseFirestore.DocumentData, id: string) {
  const { passwordHash, passwordSalt, ...safe } = data;
  void passwordSalt;
  return {
    id,
    ...safe,
    isPasswordProtected: Boolean(passwordHash),
  };
}

function publicClaim(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    projectId: data.projectId || null,
    portionId: data.portionId || null,
    trackType: data.trackType || null,
    reference: data.reference || null,
    userId: data.userId || null,
    userName: data.userName || data.claimedByName || "",
    userEmail: data.userEmail || null,
    status: data.status || "active",
    claimedAt: data.claimedAt || 0,
    completedAt: data.completedAt || null,
    isParent: data.isParent === true,
  };
}

function publicReport(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
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

function publicContact(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
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

function participantCount(claims: FirebaseFirestore.DocumentData[]) {
  const keys = new Set<string>();
  for (const c of claims) {
    if (c.isParent === true) continue;
    const key = c.userId && c.userId !== "anonymous"
      ? `u:${c.userId}`
      : `n:${(c.userName || "").trim()}__${(c.userEmail || "").trim()}`;
    if (key !== "n:__") keys.add(key);
  }
  return keys.size;
}

function diagnostics(project: FirebaseFirestore.DocumentData, portions: FirebaseFirestore.DocumentData[], claims: FirebaseFirestore.DocumentData[], reports: FirebaseFirestore.DocumentData[]) {
  const issues: { severity: "info" | "warn" | "fail"; key: string; detail: string }[] = [];
  const totalPortions = portions.length;
  const claimedPortions = portions.filter((p) => p.status !== "available").length;
  const completedPortions = portions.filter((p) => p.status === "completed").length;
  const participants = participantCount(claims);
  const openReports = reports.filter((r) => (r.status || "open") === "open").length;
  const progress = computeProgress(portions as { trackType?: string; setNumber?: number | null; status?: string }[]);

  if (!project.slug) issues.push({ severity: "fail", key: "missing_slug", detail: "Project has no slug." });
  if (!project.createdBy) issues.push({ severity: "warn", key: "missing_creator", detail: "Project has no creator UID." });
  if (!Array.isArray(project.tracks) || project.tracks.length === 0) issues.push({ severity: "fail", key: "no_tracks", detail: "Project has no learning tracks enabled." });
  if (totalPortions === 0) issues.push({ severity: "fail", key: "no_portions", detail: "Project has no seeded portions." });
  if (Boolean(project.passwordHash) !== Boolean(project.passwordSalt)) issues.push({ severity: "fail", key: "password_mismatch", detail: "Password hash/salt fields are inconsistent." });
  if (Number(project.totalPortions || 0) !== totalPortions) issues.push({ severity: "warn", key: "total_portions_drift", detail: `Stored total ${project.totalPortions || 0}, actual ${totalPortions}.` });
  if (Number(project.claimedPortions || 0) !== claimedPortions) issues.push({ severity: "warn", key: "claimed_portions_drift", detail: `Stored claimed ${project.claimedPortions || 0}, actual ${claimedPortions}.` });
  if (Number(project.completedPortions || 0) !== completedPortions) issues.push({ severity: "warn", key: "completed_portions_drift", detail: `Stored completed ${project.completedPortions || 0}, actual ${completedPortions}.` });
  if (Number(project.participantCount || 0) !== participants) issues.push({ severity: "warn", key: "participant_drift", detail: `Stored participants ${project.participantCount || 0}, actual ${participants}.` });
  if (Number(project.reportsCount || 0) !== reports.length) issues.push({ severity: "info", key: "reports_count_drift", detail: `Stored reports ${project.reportsCount || 0}, actual ${reports.length}.` });
  if (openReports > 0) issues.push({ severity: "warn", key: "open_reports", detail: `${openReports} report(s) are still open.` });

  return {
    issues,
    recomputed: {
      totalPortions,
      claimedPortions,
      completedPortions,
      participantCount: participants,
      progressPct: progress.pct,
      progressTotalPct: progress.pct,
      completedProgressPct: progress.completedPct,
      completedCycles: progress.cycles,
      topMatmidim: computeTopMatmidim(portions as { claimMode?: string; status?: string; claimedByName?: string; claimerNames?: string[] }[]),
    },
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { idToken } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    await requireSuperAdmin(idToken);

    const db = getAdminDb();
    const projectSnap = await db.collection("lzecher_projects").doc(id).get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const project = projectSnap.data()!;
    const slug = project.slug as string | undefined;

    const [
      portionsSnap,
      claimsSnap,
      reportsSnap,
      contactsSnap,
      feedbackSnap,
      emailsSnap,
    ] = await Promise.all([
      db.collection("lzecher_portions").where("projectId", "==", id).get(),
      db.collection("lzecher_claims").where("projectId", "==", id).get(),
      db.collection("lzecher_reports").where("projectId", "==", id).get(),
      db.collection("lzecher_contact_messages").where("projectId", "==", id).get().catch(() => null),
      db.collection("lzecher_feedback").orderBy("submittedAt", "desc").limit(200).get().catch(() => null),
      db.collection("lzecher_scheduled_emails").where("projectId", "==", id).limit(50).get().catch(() => null),
    ]);

    const portions = portionsSnap.docs.map(withId);
    const claims = claimsSnap.docs.map(withId);
    const reports = reportsSnap.docs.map(withId);
    const diagnostic = diagnostics(project, portions, claims, reports);
    const trackStats = portions.reduce<Record<string, { total: number; claimed: number; completed: number }>>((acc, portion) => {
      const key = String(portion.trackType || "unknown");
      acc[key] ||= { total: 0, claimed: 0, completed: 0 };
      acc[key].total += 1;
      if (portion.status !== "available") acc[key].claimed += 1;
      if (portion.status === "completed") acc[key].completed += 1;
      return acc;
    }, {});
    const filteredFeedback = feedbackSnap
      ? feedbackSnap.docs
          .map(withId)
          .filter((item) => slug && typeof item.currentPath === "string" ? item.currentPath.includes(slug) : false)
          .slice(0, 25)
      : [];

    return NextResponse.json({
      project: stripProject(project, projectSnap.id),
      diagnostics: diagnostic.issues,
      recomputed: diagnostic.recomputed,
      trackStats,
      recentClaims: claims
        .sort((a, b) => Number(b.claimedAt || 0) - Number(a.claimedAt || 0))
        .slice(0, 25)
        .map((claim) => publicClaim(claim, claim.id)),
      reports: reports
        .sort((a, b) => Number(b.reportedAt || 0) - Number(a.reportedAt || 0))
        .slice(0, 25)
        .map((report) => publicReport(report, report.id)),
      contactMessages: contactsSnap
        ? contactsSnap.docs
            .map((doc) => publicContact(doc.data(), doc.id))
            .sort((a, b) => b.sentAt - a.sentAt)
            .slice(0, 25)
        : [],
      feedback: filteredFeedback.map((item) => ({
        id: item.id,
        type: item.type || "other",
        message: item.message || "",
        email: item.email || null,
        locale: item.locale || "en",
        currentPath: item.currentPath || null,
        status: item.status || "new",
        priority: item.priority || "normal",
        tag: item.tag || null,
        assignedTo: item.assignedTo || null,
        internalNote: item.internalNote || null,
        supportUpdatedAt: item.supportUpdatedAt || null,
        allowAsTestimonial: item.allowAsTestimonial === true,
        submittedAt: item.submittedAt || 0,
      })),
      scheduledEmails: emailsSnap
        ? emailsSnap.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              status: data.status || null,
              type: data.reminderType || data.type || null,
              scheduledFor: data.sendAt || null,
              recipientEmail: data.toEmail || data.userEmail || null,
              attempts: Number(data.attempts || 0),
              lastError: typeof data.lastError === "string" ? data.lastError.slice(0, 300) : null,
            };
          })
        : [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/projects/detail]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
