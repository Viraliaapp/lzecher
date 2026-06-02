import { Resend } from "resend";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  getReminderEmail,
  type ReminderLocale,
  type ReminderType,
} from "@/lib/reminder-templates";
import { signToken, TTL } from "@/lib/signed-tokens";
import { lzecherEmailFrom } from "@/lib/email-config";
import { toHebrewCalendarDate } from "@/lib/hebrew-date";
import { learningLabel, learningScopeLabel } from "@/lib/learning-label";
import { normalizeLocale } from "@/lib/locales";
import { isValidEmailAddress } from "@/lib/email-validation";
import type * as FirebaseFirestore from "@google-cloud/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

const BATCH_LIMIT = 25;
const RESEND_CHUNK_SIZE = 4;
const RESEND_CHUNK_PAUSE_MS = 1100;

interface SendReadyOptions {
  limit?: number;
  now?: number;
}

export async function sendReadyReminderEmails(options: SendReadyOptions = {}) {
  const db = getAdminDb();
  const now = options.now ?? Date.now();
  const limit = options.limit ?? BATCH_LIMIT;

  const pendingSnap = await db
    .collection("lzecher_scheduled_emails")
    .where("status", "==", "pending")
    .limit(limit * 3)
    .get();

  const readyDocs = pendingSnap.docs
    .filter((d) => ((d.data().sendAt as number) || 0) <= now)
    .slice(0, limit);

  if (readyDocs.length === 0) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < readyDocs.length; i += RESEND_CHUNK_SIZE) {
    const chunk = readyDocs.slice(i, i + RESEND_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((doc) => processScheduledEmail(doc, now))
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

  return { processed: readyDocs.length, sent, failed };
}

export async function sendScheduledReminderNow(
  ref: FirebaseFirestore.DocumentReference,
  now = Date.now()
) {
  const snap = await ref.get();
  if (!snap.exists) return { sent: false, skipped: true };

  const data = snap.data() as ScheduledEmail;
  if (data.status !== "pending") return { sent: false, skipped: true };
  if (((data.sendAt as number) || 0) > now + 60_000) {
    return { sent: false, skipped: true };
  }

  await processScheduledEmail(snap, now);
  return { sent: true, skipped: false };
}

async function processScheduledEmail(
  doc: FirebaseFirestore.DocumentSnapshot,
  now: number
): Promise<void> {
  if (!doc.exists) return;

  const data = doc.data() as ScheduledEmail;
  const docRef = doc.ref;

  try {
    const templateArgs = await buildTemplateArgs(data);
    const locale = normalizeLocale(data.locale) as ReminderLocale;
    const reminderType = normalizeReminderType(data.reminderType || data.type);
    const email = getReminderEmail(reminderType, locale, templateArgs);

    const normalizedTo = data.toEmail?.trim();
    if (!isValidEmailAddress(normalizedTo)) {
      throw new Error("Invalid `to` field. The email address needs to follow the `email@example.com` format.");
    }

    const { error } = await resend.emails.send({
      from: lzecherEmailFrom(locale === "he" ? "לזכר" : "Lzecher"),
      to: normalizedTo,
      subject: email.subject,
      html: email.body,
    });

    if (error) throw new Error(error.message);

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
      await docRef.update({
        attempts,
        lastError: String(err),
        sendAt: now + 60 * 60 * 1000,
      });
    }

    throw err;
  }
}

function normalizeReminderType(value?: string | null): ReminderType {
  if (value === "sevenDays") return "sevenDaysBefore";
  if (value === "oneDay") return "oneDayBefore";
  if (value === "threeDays") return "threeDaysBefore";
  if (value === "daily") return "dailyReminder";
  if (
    value === "confirmation" ||
    value === "halfway" ||
    value === "sevenDaysBefore" ||
    value === "threeDaysBefore" ||
    value === "oneDayBefore" ||
    value === "dailyReminder" ||
    value === "weeklyDigest"
  ) {
    return value;
  }
  return "confirmation";
}

function isPermanentEmailError(err: unknown) {
  const message = String(err);
  return message.includes("Invalid `to` field") || message.includes("email@example.com");
}

async function buildTemplateArgs(data: ScheduledEmail) {
  const db = getAdminDb();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lzecher.com";
  const locale = normalizeLocale(data.locale);

  let honoreeName = data.honoreeName || (locale === "he" ? "הנפטר/ת" : "their loved one");
  let commitmentDesc = learningLabel(
    locale,
    data.commitmentDesc || (locale === "he" ? "לימוד תורה" : "Torah learning"),
    data.trackType
  );
  let deadline: string | undefined;

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
      // Non-fatal: keep fallback values from the scheduled email doc.
    }
  }

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
      // Non-fatal.
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

  let unsubscribeLink: string | undefined;
  if (data.userId && data.claimId) {
    const token = signToken(
      { purpose: "unsubscribe", uid: data.userId, claimId: data.claimId, locale },
      TTL.UNSUBSCRIBE
    );
    unsubscribeLink = `${baseUrl}/${locale}/unsubscribe?token=${token}`;
  }

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

interface ScheduledEmail {
  id: string;
  toEmail: string;
  userId?: string;
  claimId?: string;
  projectId?: string;
  projectSlug?: string;
  reminderType?: string;
  type?: string;
  locale?: string;
  sendAt: number;
  status: "pending" | "sent" | "failed" | "canceled";
  attempts?: number;
  honoreeName?: string;
  commitmentDesc?: string;
  trackType?: string;
}
