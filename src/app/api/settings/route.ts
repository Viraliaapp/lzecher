import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { DEFAULT_SITE_SETTINGS, publicSiteSettings, sanitizeSiteSettings } from "@/lib/site-settings";

export async function GET() {
  try {
    const snap = await getAdminDb().collection("lzecher_settings").doc("site").get();
    const settings = snap.exists
      ? sanitizeSiteSettings({ ...DEFAULT_SITE_SETTINGS, ...snap.data() })
      : DEFAULT_SITE_SETTINGS;

    return NextResponse.json(publicSiteSettings(settings), {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=120",
      },
    });
  } catch (err) {
    console.error("[settings]", err);
    return NextResponse.json(publicSiteSettings(DEFAULT_SITE_SETTINGS), {
      headers: {
        "Cache-Control": "public, max-age=10",
      },
    });
  }
}
