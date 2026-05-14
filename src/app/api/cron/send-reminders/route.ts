import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import {
  getReminderEmail,
  type ReminderType,
  type ReminderLocale,
} from "@/lib/reminder-templates";
import { signToken, TTL } from "@/lib/signed-tokens";

const resend = new Resend(process.env.RESEND_API_KEY);

const BATCH_LIMIT = 50; // max emails per invocation

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const now = Date.now();

  // ── Query pending emails ──────────────────────────────────────────────────
  const snapshot = await db
    .collection("lzecher_scheduled_emails")
    .where("status", "==", "pending")
    .where("sendAt", "<=", now)
    .limit(BATCH_LIMIT)
    .get();

  if (snapshot.empty) {
    return NextResponse.json({ processed: 0, message: "No pending emails" });
  }

  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    snapshot.docs.map((doc) => processEmail(db, doc, now))
  );

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      sent++;
    } else {
      failed++;
      console.error("[send-reminders] Email processing error:", result.reason);
    }
  });

  return NextResponse.json({ processed: snapshot.size, sent, failed });
}

// ── Per-email processor ───────────────────────────────────────────────────────

async function processEmail(
  db: ReturnType<typeof getAdminDb>,
  doc: FirebaseFirestore.QueryDocumentSnapshot,
  now: number
): Promise<void> {
  const data = doc.data() as ScheduledEmail;
  const docRef = doc.ref;

  try {
    // Load claim or project data for template vars
    const templateArgs = await buildTemplateArgs(db, data);

    // Format the email
    const locale = (data.locale || "en") as ReminderLocale;
    const reminderType = data.reminderType as ReminderType;
    const email = getReminderEmail(reminderType, locale, templateArgs);

    // Send via Resend
    const { error } = await resend.emails.send({
      from: "Lzecher <noreply@lzecher.com>",
      to: data.toEmail,
      subject: email.subject,
      html: email.body,
    });

    if (error) {
      throw new Error(error.message);
    }

    // Mark as sent
    await docRef.update({
      status: "sent",
      sentAt: now,
    });
  } catch (err) {
    const attempts = (data.attempts ?? 0) + 1;

    if (attempts >= 3) {
      await docRef.update({
        status: "failed",
        attempts,
        lastError: String(err),
        failedAt: now,
      });
    } else {
      // Schedule a retry ~1 hour from now
      await docRef.update({
        attempts,
        lastError: String(err),
        sendAt: now + 60 * 60 * 1000,
      });
    }

    throw err; // propagate so Promise.allSettled counts it as failed
  }
}

// ── Template argument builder ─────────────────────────────────────────────────

async function buildTemplateArgs(
  db: ReturnType<typeof getAdminDb>,
  data: ScheduledEmail
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lzecher.com";
  const locale = data.locale || "en";

  let honoreeName = data.honoreeName || "their loved one";
  let commitmentDesc = data.commitmentDesc || "Torah learning";
  let deadline: string | undefined;

  // Try to enrich from claim doc if we have a claimId
  if (data.claimId) {
    try {
      const claimSnap = await db
        .collection("lzecher_claims")
        .doc(data.claimId)
        .get();
      if (claimSnap.exists) {
        const claim = claimSnap.data()!;
        if (claim.durationEndDate) {
          deadline = new Date(claim.durationEndDate).toLocaleDateString(
            localeToDateLocale(locale),
            { year: "numeric", month: "long", day: "numeric" }
          );
        }
        if (!data.commitmentDesc && claim.reference) {
          commitmentDesc = claim.reference;
        }
      }
    } catch {
      // Non-fatal — use data already in scheduled email doc
    }
  }

  // Try to enrich honoree name from project doc
  if (data.projectId && !data.honoreeName) {
    try {
      const projectSnap = await db
        .collection("lzecher_projects")
        .doc(data.projectId)
        .get();
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        honoreeName =
          proj.nameHebrew ||
          proj.nameEnglish ||
          honoreeName;
      }
    } catch {
      // Non-fatal
    }
  }

  const link = data.claimId
    ? `${baseUrl}/${locale}/memorial/${data.projectSlug || ""}?claim=${data.claimId}`
    : `${baseUrl}/${locale}/memorial/${data.projectSlug || ""}`;

  // Build unsubscribe link using HMAC token
  let unsubscribeLink: string | undefined;
  if (data.userId && data.claimId) {
    const token = await buildUnsubscribeToken(data.userId, data.claimId);
    unsubscribeLink = `${baseUrl}/${locale}/unsubscribe?token=${token}`;
  }

  // Auto-signin link to dashboard (for anon claimers who provided email).
  // The signed token lets them open the dashboard with one click, signed in.
  let dashboardLink: string | undefined;
  if (data.toEmail) {
    const dashToken = signToken(
      { purpose: "auto_signin", email: data.toEmail, locale, redirect: `/${locale}/dashboard` },
      TTL.AUTO_SIGNIN
    );
    dashboardLink = `${baseUrl}/${locale}/auto-signin?token=${dashToken}`;
  }

  return { honoreeName, commitmentDesc, deadline, link, unsubscribeLink, dashboardLink };
}

// ── HMAC helper (same as unsubscribe page) ────────────────────────────────────

async function buildUnsubscribeToken(userId: string, claimId: string): Promise<string> {
  const secret = process.env.CRON_SECRET || "fallback-secret";
  const payload = JSON.stringify({ userId, claimId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 });
  const encoded = Buffer.from(payload).toString("base64url");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  const sigB64 = Buffer.from(sig).toString("base64url");

  return `${encoded}.${sigB64}`;
}

function localeToDateLocale(locale: string): string {
  const map: Record<string, string> = {
    en: "en-US",
    he: "he-IL",
    es: "es-ES",
    fr: "fr-FR",
  };
  return map[locale] || "en-US";
}

// ── Firestore document shape ──────────────────────────────────────────────────

interface ScheduledEmail {
  id: string;
  toEmail: string;
  userId?: string;
  claimId?: string;
  projectId?: string;
  projectSlug?: string;
  reminderType: string;
  locale?: string;
  sendAt: number;
  status: "pending" | "sent" | "failed";
  attempts?: number;
  // Pre-resolved template vars (optional, used as fallback)
  honoreeName?: string;
  commitmentDesc?: string;
}
