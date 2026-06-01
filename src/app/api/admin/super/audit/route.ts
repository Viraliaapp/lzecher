import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

const LIMIT = 100;

function publicAudit(data: FirebaseFirestore.DocumentData, id: string) {
  return {
    id,
    action: data.action || "unknown",
    adminUid: data.adminUid || data.updatedBy || data.deletedBy || data.adminUpdatedBy || null,
    projectId: data.projectId || null,
    targetUid: data.targetUid || null,
    feedbackId: data.feedbackId || null,
    at: data.at || data.updatedAt || data.deletedAt || data.createdAt || data.timestamp || data.completedAt || 0,
    details: data.details || data.changes || null,
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
    const snap = await db
      .collection("lzecher_admin_audit")
      .limit(LIMIT)
      .get();

    const audit = snap.docs
      .map((doc) => publicAudit(doc.data(), doc.id))
      .sort((a, b) => b.at - a.at)
      .slice(0, LIMIT);

    return NextResponse.json({ audit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/audit]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
