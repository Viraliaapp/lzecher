import { NextRequest, NextResponse } from "next/server";
import { sendReadyReminderEmails } from "@/lib/reminder-sender";
import { purgeExpiredDeletedProjects } from "@/lib/project-lifecycle";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendReadyReminderEmails();
  const purge = await purgeExpiredDeletedProjects({ limit: 5 });

  if (result.processed === 0) {
    return NextResponse.json({
      ...result,
      purge,
      message: "No pending emails ready to send",
    });
  }

  return NextResponse.json({ ...result, purge });
}
