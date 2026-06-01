import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

const VALID_STATUS = new Set(["new", "open", "resolved", "archived"]);
const VALID_PRIORITY = new Set(["low", "normal", "high", "urgent"]);

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error("INVALID_TEXT");
  const trimmed = value.trim();
  if (trimmed.length > max) throw new Error("INVALID_TEXT");
  return trimmed || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { idToken, supportStatus, priority, tag, assignedTo, internalNote } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (supportStatus !== undefined && (typeof supportStatus !== "string" || !VALID_STATUS.has(supportStatus))) {
      return NextResponse.json({ error: "Invalid contact support status" }, { status: 400 });
    }
    if (priority !== undefined && (typeof priority !== "string" || !VALID_PRIORITY.has(priority))) {
      return NextResponse.json({ error: "Invalid contact priority" }, { status: 400 });
    }

    const decoded = await requireSuperAdmin(idToken);
    const db = getAdminDb();
    const ref = db.collection("lzecher_contact_messages").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Contact message not found" }, { status: 404 });
    }

    let textUpdates: {
      tag?: string | null;
      assignedTo?: string | null;
      internalNote?: string | null;
    };
    try {
      textUpdates = {
        tag: optionalText(tag, 48),
        assignedTo: optionalText(assignedTo, 120),
        internalNote: optionalText(internalNote, 2000),
      };
    } catch {
      return NextResponse.json({ error: "Invalid support text field" }, { status: 400 });
    }

    const now = Date.now();
    const updates: Record<string, unknown> = {
      supportUpdatedAt: now,
      supportUpdatedBy: decoded.uid,
    };
    if (supportStatus !== undefined) updates.supportStatus = supportStatus;
    if (priority !== undefined) updates.priority = priority;
    for (const [key, value] of Object.entries(textUpdates)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length <= 2) {
      return NextResponse.json({ error: "No support updates provided" }, { status: 400 });
    }

    await ref.update(updates);
    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_update_contact_message",
      contactMessageId: id,
      projectId: snap.data()?.projectId || null,
      adminUid: decoded.uid,
      at: now,
      timestamp: now,
      details: updates,
      after: updates,
    });

    return NextResponse.json({ success: true, item: { id, ...snap.data(), ...updates } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/contacts]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
