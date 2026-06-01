import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

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

    const [
      totalProjects,
      activeProjects,
      hiddenProjects,
      totalClaims,
      completedClaims,
      totalFeedback,
      newFeedback,
      totalReports,
      openReports,
      totalUsers,
      projectPrivacySnap,
      feedbackSnap,
      adminSnap,
      superSnap,
      reportsSnap,
    ] = await Promise.all([
      countOf(projectsRef),
      countOf(projectsRef.where("status", "==", "active")),
      countOf(projectsRef.where("status", "==", "hidden")),
      countOf(claimsRef),
      countOf(claimsRef.where("status", "==", "completed")),
      countOf(feedbackRef),
      countOf(feedbackRef.where("status", "==", "new")),
      countOf(reportsRef),
      countOf(reportsRef.where("status", "==", "open")),
      countOf(usersRef),
      projectsRef.select("passwordHash").get(),
      feedbackRef.orderBy("submittedAt", "desc").limit(50).get(),
      usersRef.where("isAdmin", "==", true).get(),
      usersRef.where("isSuperAdmin", "==", true).get(),
      reportsRef.orderBy("reportedAt", "desc").limit(20).get().catch(() => null),
    ]);

    const adminUsers = new Map<string, ReturnType<typeof publicAdminUser>>();
    for (const doc of adminSnap.docs) adminUsers.set(doc.id, publicAdminUser(doc.data(), doc.id));
    for (const doc of superSnap.docs) adminUsers.set(doc.id, publicAdminUser(doc.data(), doc.id));

    const protectedProjects = projectPrivacySnap.docs.filter((doc) => Boolean(doc.data().passwordHash)).length;

    return NextResponse.json({
      stats: {
        totalProjects,
        activeProjects,
        hiddenProjects,
        protectedProjects,
        openProjects: Math.max(0, totalProjects - protectedProjects),
        totalClaims,
        completedClaims,
        totalFeedback,
        newFeedback,
        totalReports,
        openReports,
        totalUsers,
        adminUsers: adminUsers.size,
      },
      recentFeedback: feedbackSnap.docs.map((doc) => publicFeedback(doc.data(), doc.id)),
      adminUsers: Array.from(adminUsers.values()).sort((a, b) => Number(b.isSuperAdmin) - Number(a.isSuperAdmin)),
      recentReports: reportsSnap
        ? reportsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data(), reporterIpHash: undefined }))
        : [],
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
