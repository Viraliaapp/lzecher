import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

const VALID_STATUS = new Set(["new", "read", "open", "archived"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { idToken, status } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (typeof status !== "string" || !VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "Invalid feedback status" }, { status: 400 });
    }

    const decoded = await requireSuperAdmin(idToken);
    const db = getAdminDb();
    const ref = db.collection("lzecher_feedback").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Feedback not found" }, { status: 404 });
    }

    const now = Date.now();
    await ref.update({
      status,
      reviewedAt: now,
      reviewedBy: decoded.uid,
    });
    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_update_feedback",
      feedbackId: id,
      adminUid: decoded.uid,
      timestamp: now,
      after: { status },
    });

    return NextResponse.json({ success: true, status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/feedback]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
