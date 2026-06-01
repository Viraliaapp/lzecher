/**
 * POST /api/memorials/[slug]/contact
 *
 * Privacy-safe relay: sends a message to the project creator without
 * exposing the creator's email to the sender.
 * Rate limit: 3 messages per IP per memorial per day.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { Resend } from "resend";
import { lzecherEmailFrom } from "@/lib/email-config";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { message, senderEmail } = body as { message?: string; senderEmail?: string };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }
    if (message.trim().length > 1000) {
      return NextResponse.json({ error: "Message too long (max 1000 chars)" }, { status: 400 });
    }

    // Rate limit: 3 per IP per memorial per day
    const ip = getClientIp(request);
    const rl = await checkRateLimit("contactFamily", `contact:${ip}:${slug}`);
    if (!rl.success) {
      return NextResponse.json({ error: "Rate limit reached (3 messages per day per memorial)" }, { status: 429 });
    }

    const db = getAdminDb();

    // Look up project by slug
    const projectsSnap = await db.collection("lzecher_projects").where("slug", "==", slug).limit(1).get();
    if (projectsSnap.empty) {
      return NextResponse.json({ error: "Memorial not found" }, { status: 404 });
    }
    const project = projectsSnap.docs[0].data();
    const creatorEmail = project.createdByEmail;

    if (!creatorEmail) {
      // Creator has no email on file — store message for them to see later
      await db.collection("lzecher_contact_messages").add({
        slug,
        projectId: projectsSnap.docs[0].id,
        message: message.trim(),
        senderEmail: senderEmail?.trim() || null,
        sentAt: Date.now(),
        delivered: false,
        reason: "no_creator_email",
      });
      return NextResponse.json({ success: true });
    }

    const honoree = [project.nameHebrew, project.familyNameHebrew, project.honorific].filter(Boolean).join(" ");
    const locale = project.language || "he";

    const subject = locale === "he"
      ? `הודעה חדשה דרך לזכרו — הנצחת ${honoree}`
      : `New message via Lzecher — ${honoree}`;

    const replyInfo = senderEmail?.trim()
      ? `<p style="margin:8px 0"><strong>כתובת להשבה:</strong> ${senderEmail.trim()}</p>`
      : `<p style="margin:8px 0;color:#666;font-style:italic">השולח לא השאיר כתובת להשבה.</p>`;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="utf-8"/></head>
<body style="font-family:Arial,sans-serif;background:#FAF6EC;margin:0;padding:20px">
  <div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#0F1B2D;padding:20px 24px">
      <p style="color:#C9A961;font-size:18px;font-weight:bold;margin:0">לזכרו</p>
    </div>
    <div style="padding:24px">
      <h2 style="color:#0F1B2D;margin:0 0 16px">הודעה חדשה להנצחת ${honoree}</h2>
      <div style="background:#FAF6EC;border-radius:8px;padding:16px;margin-bottom:16px">
        <p style="margin:0;white-space:pre-wrap;color:#1a1a1a">${message.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>
      </div>
      ${replyInfo}
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
      <p style="font-size:12px;color:#888;margin:0">ההודעה נשלחה דרך לזכרו. כתובת האימייל של השולח לא נחשפת אם לא צוינה.</p>
    </div>
  </div>
</body>
</html>`;

    const { error } = await resend.emails.send({
      from: lzecherEmailFrom("לזכרו"),
      to: creatorEmail,
      subject,
      html,
    });

    if (error) {
      await db.collection("lzecher_contact_messages").add({
        slug,
        projectId: projectsSnap.docs[0].id,
        message: message.trim(),
        senderEmail: senderEmail?.trim() || null,
        sentAt: Date.now(),
        delivered: false,
        reason: "resend_error",
        lastError: error.message,
      });
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
    }

    // Log the contact
    await db.collection("lzecher_contact_messages").add({
      slug,
      projectId: projectsSnap.docs[0].id,
      message: message.trim(),
      senderEmail: senderEmail?.trim() || null,
      sentAt: Date.now(),
      delivered: true,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[contact]", err);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
