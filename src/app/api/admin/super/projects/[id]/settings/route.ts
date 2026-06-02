import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";

const VALID_STATUSES = new Set(["active", "completed", "archived", "pending_moderation", "hidden"]);
const BOOLEAN_FIELDS = new Set([
  "isPublic",
  "showLeaderboard",
  "locked",
  "repeatingSetEnabled",
  "startedByVisible",
]);
const TEXT_FIELDS = new Set(["announcement", "customDedication"]);
const MAX_TEXT_LENGTH = 500;

function cleanText(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const next = value.trim();
  if (next.length > MAX_TEXT_LENGTH) return undefined;
  return next || null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { idToken, confirmProjectId, updates } = body as {
      idToken?: string;
      confirmProjectId?: string;
      updates?: Record<string, unknown>;
    };

    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (confirmProjectId !== id) {
      return NextResponse.json(
        { error: "Confirm this single project ID before changing project controls." },
        { status: 400 }
      );
    }
    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const decoded = await requireSuperAdmin(idToken);
    const db = getAdminDb();
    const projectRef = db.collection("lzecher_projects").doc(id);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const current = projectSnap.data() || {};
    const cleanedUpdates: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (key === "status") {
        if (typeof value !== "string" || !VALID_STATUSES.has(value)) {
          return NextResponse.json({ error: "Invalid project status" }, { status: 400 });
        }
        cleanedUpdates.status = value;
      } else if (BOOLEAN_FIELDS.has(key)) {
        if (typeof value !== "boolean") {
          return NextResponse.json({ error: `Invalid boolean value for ${key}` }, { status: 400 });
        }
        cleanedUpdates[key] = value;
      } else if (TEXT_FIELDS.has(key)) {
        const cleaned = cleanText(value);
        if (cleaned === undefined) {
          return NextResponse.json({ error: `Invalid text value for ${key}` }, { status: 400 });
        }
        cleanedUpdates[key] = cleaned;
        if (key === "announcement") cleanedUpdates.announcementAt = cleaned ? Date.now() : null;
      } else {
        return NextResponse.json({ error: `Field ${key} is not supported here` }, { status: 400 });
      }
    }

    for (const [key, value] of Object.entries(cleanedUpdates)) {
      if (key === "announcementAt") continue;
      if (current[key] !== value) {
        before[key] = current[key] ?? null;
        after[key] = value;
      }
    }

    if (Object.keys(after).length === 0) {
      return NextResponse.json({ success: true, noChanges: true });
    }

    const now = Date.now();
    if (Object.prototype.hasOwnProperty.call(after, "announcement")) {
      cleanedUpdates.announcementAt = after.announcement ? now : null;
    } else {
      delete cleanedUpdates.announcementAt;
    }
    cleanedUpdates.updatedAt = now;
    cleanedUpdates.updatedBy = decoded.uid;

    await projectRef.update(cleanedUpdates);
    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_update_project_controls",
      projectId: id,
      adminUid: decoded.uid,
      at: now,
      timestamp: now,
      details: {
        scope: "single_project_controls",
        before,
        after,
      },
      before,
      after,
    });

    return NextResponse.json({
      success: true,
      updated: Object.keys(after),
      project: {
        id,
        ...after,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/projects/settings]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
