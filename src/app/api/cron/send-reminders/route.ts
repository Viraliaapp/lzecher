import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Resend } from "resend";
import {
  getReminderEmail,
  type ReminderType,
  type ReminderLocale,
} from "@/lib/reminder-templates";
import { signToken, TTL } from "@/lib/signed-tokens";
import { lzecherEmailFrom } from "@/lib/email-config";
import { toHebrewCalendarDate } from "@/lib/hebrew-date";
import { learningLabel, learningScopeLabel } from "@/lib/learning-label";
import { normalizeLocale } from "@/lib/locales";

const resend = new Resend(process.env.RESEND_API_KEY);

const BATCH_LIMIT = 25; // max emails per invocation
const RESEND_CHUNK_SIZE = 4; // stay under Resend's 5 requests/sec rate limit
const RESEND_CHUNK_PAUSE_MS = 1100;

export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const now = Date.now();

  // ── Query pending emails ──────────────────────────────────────────────────
  // Single-field query avoids composite index requirement; filter sendAt in memory.
  const pendingSnap = await db
    .collection("lzecher_scheduled_emails")
    .where("status", "==", "pending")
    .limit(BATCH_LIMIT * 3)
    .get();

  const readyDocs = pendingSnap.docs.filter(
    (d) => ((d.data().sendAt as number) || 0) <= now
  ).slice(0, BATCH_LIMIT);

  if (readyDocs.length === 0) {
    return NextResponse.json({ processed: 0, message: "No pending emails ready to send" });
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < readyDocs.length; i += RESEND_CHUNK_SIZE) {
    const chunk = readyDocs.slice(i, i + RESEND_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((doc) => processEmail(db, doc, now))
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        console.error("[send-reminders] Email processing error:", result.reason);
      }
    });

    if (i + RESEND_CHUNK_SIZE < readyDocs.length) {
      await new Promise((resolve) => setTimeout(resolve, RESEND_CHUNK_PAUSE_MS));
    }
  }

  return NextResponse.json({ processed: readyDocs.length, sent, failed });
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
    const locale = normalizeLocale(data.locale) as ReminderLocale;
    const reminderType = data.reminderType as ReminderType;
    const email = getReminderEmail(reminderType, locale, templateArgs);

    if (!isValidRecipientEmail(data.toEmail)) {
      throw new Error("Invalid `to` field. The email address needs to follow the `email@example.com` format.");
    }

    const { error } = await resend.emails.send({
      from: lzecherEmailFrom(locale === "he" ? "לזכרו" : "Lzecher"),
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
      lastError: null,
      failedAt: null,
    });
  } catch (err) {
    const attempts = (data.attempts ?? 0) + 1;

    if (attempts >= 3 || isPermanentEmailError(err)) {
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

function isValidRecipientEmail(email?: string | null) {
  return typeof email === "string" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email.trim());
}

function isPermanentEmailError(err: unknown) {
  const message = String(err);
  return message.includes("Invalid `to` field") || message.includes("email@example.com");
}

// ── Template argument builder ─────────────────────────────────────────────────

async function buildTemplateArgs(
  db: ReturnType<typeof getAdminDb>,
  data: ScheduledEmail
) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lzecher.com";
  const locale = normalizeLocale(data.locale);

  let honoreeName = data.honoreeName || (locale === "he" ? "הנפטר/ת" : "their loved one");
  let commitmentDesc = learningLabel(
    locale,
    data.commitmentDesc || (locale === "he" ? "לימוד תורה" : "Torah learning"),
    data.trackType
  );
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
          const deadlineMillis =
            typeof claim.durationEndDate === "number"
              ? claim.durationEndDate
              : typeof claim.durationEndDate.toMillis === "function"
                ? claim.durationEndDate.toMillis()
                : Number(claim.durationEndDate);
          if (Number.isFinite(deadlineMillis)) {
            deadline = toHebrewCalendarDate(deadlineMillis, locale);
          }
        }
        if (claim.isParent && claim.scope) {
          commitmentDesc = learningScopeLabel(
            locale,
            claim.scope,
            claim.scopeId,
            claim.trackType,
            Array.isArray(claim.portionIds) ? claim.portionIds.length : undefined
          );
        } else if (claim.reference) {
          commitmentDesc = learningLabel(locale, claim.reference, claim.trackType);
        } else {
          commitmentDesc = learningLabel(locale, commitmentDesc, claim.trackType || data.trackType);
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

  let markCompleteLink: string | undefined;
  if (data.claimId) {
    const markToken = signToken(
      { purpose: "mark_complete", claimId: data.claimId, locale },
      TTL.MARK_COMPLETE
    );
    markCompleteLink = `${baseUrl}/api/claims/mark-complete-via-link?token=${encodeURIComponent(markToken)}&locale=${encodeURIComponent(locale)}`;
  }

  // Build unsubscribe link using HMAC token
  let unsubscribeLink: string | undefined;
  if (data.userId && data.claimId) {
    const token = signToken(
      { purpose: "unsubscribe", uid: data.userId, claimId: data.claimId, locale },
      TTL.UNSUBSCRIBE
    );
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

  commitmentDesc = learningLabel(locale, commitmentDesc, data.trackType);

  return { honoreeName, commitmentDesc, deadline, link, unsubscribeLink, markCompleteLink, dashboardLink };
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
  trackType?: string;
}
