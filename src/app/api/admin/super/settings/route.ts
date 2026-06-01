import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireSuperAdmin } from "@/lib/auth-roles";
import { DEFAULT_SITE_SETTINGS, publicSiteSettings, sanitizeSiteSettings } from "@/lib/site-settings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idToken, settings } = body as { idToken?: string; settings?: unknown };
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const decoded = await requireSuperAdmin(idToken);
    const db = getAdminDb();
    const ref = db.collection("lzecher_settings").doc("site");
    const snap = await ref.get();
    const current = snap.exists
      ? sanitizeSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...snap.data() })
      : DEFAULT_SITE_SETTINGS;

    if (settings === undefined) {
      return NextResponse.json({ settings: publicSiteSettings(current) });
    }

    const now = Date.now();
    const next = sanitizeSiteSettings({
      ...current,
      ...(settings && typeof settings === "object" ? settings : {}),
      updatedAt: now,
      updatedBy: decoded.uid,
    });

    await ref.set(next, { merge: true });
    await db.collection("lzecher_admin_audit").add({
      action: "super_admin_update_site_settings",
      adminUid: decoded.uid,
      at: now,
      timestamp: now,
      details: {
        before: publicSiteSettings(current),
        after: publicSiteSettings(next),
        scope: "lzecher_settings/site",
      },
    });

    return NextResponse.json({ success: true, settings: publicSiteSettings(next) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/settings]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
