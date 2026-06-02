import { NextRequest, NextResponse } from "next/server";
import { sendReadyReminderEmails } from "@/lib/reminder-sender";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await sendReadyReminderEmails();

  if (result.processed === 0) {
    return NextResponse.json({
      ...result,
      message: "No pending emails ready to send",
    });
  }

  return NextResponse.json(result);
}
