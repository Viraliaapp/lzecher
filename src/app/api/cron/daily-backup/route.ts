import { NextRequest, NextResponse } from "next/server";
import { createLzecherDailyBackup } from "@/lib/lzecher-backups";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const backup = await createLzecherDailyBackup({ reason: "daily_cron", actor: "vercel_cron" });
    return NextResponse.json({ success: true, backup });
  } catch (err) {
    console.error("[daily-backup]", err);
    return NextResponse.json({ error: "Backup failed" }, { status: 500 });
  }
}
