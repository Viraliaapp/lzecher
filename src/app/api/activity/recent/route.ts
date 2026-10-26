import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { getRecentActivity } from "@/lib/recent-activity";

// Existing policy includes protected memorials. Return only public popup data.
export async function GET() {
  try {
    return NextResponse.json({ events: await getRecentActivity(getAdminDb()) }, {
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
    });
  } catch (err) {
    console.error("[activity/recent] error:", err);
    return NextResponse.json({ error: "Activity is temporarily unavailable" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
