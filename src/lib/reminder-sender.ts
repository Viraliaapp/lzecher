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
import {
  CREATOR_ZERO_CLAIM_NUDGE_TYPES,
  isCreatorZeroClaimAutoDeleteType,
  isCreatorZeroClaimNudgeType,
} from "@/lib/creator-zero-claim-nudges";
import { projectHasAnyActivity, softDeleteProject } from "@/lib/project-lifecycle";
import type * as FirebaseFirestore from "@google-cloud/firestore";

const resend = new Resend(process.env.RESEND_API_KEY);

const BATCH_LIMIT = 25;
const RESEND_CHUNK_SIZE = 4;
const RESEND_CHUNK_PAUSE_MS = 1100;

interface SendReadyOptions {
  limit?: number;
  now?: number;
}

type ProcessResult = "sent" | "skipped";

export async function sendReadyReminderEmails(options: SendReadyOptions = {}) {
  const db = getAdminDb();
  const now = options.now ?? Date.now();
  const limit = options.limit ?? BATCH_LIMIT;

  const pendingSnap = await db
    .collection("lzecher_scheduled_emails")
    .where("status", "==", "pending")
    .get();

  const readyDocs = pendingSnap.docs
    .filter((d) => ((d.data().sendAt as number) || 0) <= now)
    .sort((a, b) => a.data().sendAt - b.data().sendAt)
    .slice(0, limit);

  if (readyDocs.length === 0) {
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < readyDocs.length; i += RESEND_CHUNK_SIZE) {
    const chunk = readyDocs.slice(i, i + RESEND_CHUNK_SIZE);
    const results = await Promise.allSettled(
      chunk.map((doc) => processScheduledEmail(doc, now))
    );

    results.forEach((result) => {
      if (result.status === "fulfilled") {
        if (result.value === "sent") sent++;
        if (result.value === "skipped") skipped++;
      } else {
        failed++;
        console.error("[send-reminders] Email processing error:", result.reason);
      }
    });

    if (i + RESEND_CHUNK_SIZE < readyDocs.length) {
      await new Promise((resolve) => setTimeout(resolve, RESEND_CHUNK_PAUSE_MS));
    }
  }

  return { processed: readyDocs.length, sent, failed, skipped };
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

  const result = await processScheduledEmail(snap, now);
  return { sent: result === "sent", skipped: result === "skipped" };
}

async function processScheduledEmail(
  doc: FirebaseFirestore.DocumentSnapshot,
  now: number
): Promise<ProcessResult> {
  if (!doc.exists) return "skipped";

  const docRef = doc.ref;
  const data = await docRef.firestore.runTransaction(async tx => {
    const current = await tx.get(docRef);
    const value = current.data() as ScheduledEmail | undefined;
    if (!value || value.status !== "pending" || value.sendAt > now || (value.leaseUntil || 0) > now) return null;
    tx.update(docRef, { leaseUntil: now + 10 * 60_000, firstAttemptAt: value.firstAttemptAt || now });
    return value;
  });
  if (!data) return "skipped";

  try {
    const locale = normalizeLocale(data.locale) as ReminderLocale;
    const rawReminderType = data.reminderType || data.type;

    if (isCreatorZeroClaimAutoDeleteType(rawReminderType)) {
      await processCreatorZeroClaimAutoDelete(data, docRef, now);
      return "skipped";
    }

    const reminderType = normalizeReminderType(rawReminderType);
    if (!reminderType) {
      await cancelScheduledEmail(docRef, now, "unsupported_reminder_type");
      return "skipped";
    }
    // Resend retains idempotency keys for 24 hours. Do not blindly replay an
    // ambiguous old attempt after that protection expires.
    if (data.firstAttemptAt && now - data.firstAttemptAt > 23 * 60 * 60_000) {
      await cancelScheduledEmail(docRef, now, "old_attempt_requires_review");
      return "skipped";
    }

    if (isCreatorZeroClaimNudgeType(reminderType)) {
      const stillStuck = await projectStillHasZeroClaims(data, docRef, now);
      if (!stillStuck) return "skipped";
      const stages: readonly string[] = CREATOR_ZERO_CLAIM_NUDGE_TYPES;
      const queue = await getAdminDb().collection("lzecher_scheduled_emails").where("projectId", "==", data.projectId).get();
      const rank = stages.indexOf(reminderType);
      if (queue.docs.some(d => stages.indexOf(d.data().reminderType || d.data().type) > rank &&
        (d.data().status === "sent" || (d.data().status === "pending" && d.data().sendAt <= now)))) {
        await cancelScheduledEmail(docRef, now, "superseded_creator_warning");
        return "skipped";
      }
    } else {
      const db = getAdminDb();
      const claim = data.claimId ? await db.collection("lzecher_claims").doc(data.claimId).get() : null;
      const project = data.projectId ? await db.collection("lzecher_projects").doc(data.projectId).get() : null;
      const c = claim?.data();
      let reason: string | null = null;
      if (!c || c.projectId !== data.projectId) reason = "claim_missing_or_mismatched";
      else if (!project?.exists || project.data()?.status === "deleted") reason = "project_unavailable";
      else if (c.status !== "active") reason = "claim_not_active";
      else if (c.userEmail && c.userEmail.trim().toLowerCase() !== data.toEmail?.trim().toLowerCase()) reason = "recipient_changed";
      else if (Array.isArray(c.reminderPreferences) && c.reminderPreferences.length === 0) reason = "reminders_disabled";
      else if (reminderType === "confirmation" && (!Number.isFinite(data.createdAt) || now - data.createdAt! > 48 * 60 * 60_000)) reason = "confirmation_expired";
      else if (reminderType !== "confirmation" && (Number(c.durationEndDate || 0) <= now || now - data.sendAt > 48 * 60 * 60_000)) reason = "reminder_expired";
      if (!reason && c?.isParent) {
        const children = await db.collection("lzecher_claims").where("parentClaimId", "==", data.claimId).get();
        if (!children.docs.some(d => d.data().projectId === data.projectId && d.data().status === "active")) reason = "no_active_children";
      }
      if (reason) { await cancelScheduledEmail(docRef, now, reason); return "skipped"; }
    }

    const templateArgs = await buildTemplateArgs(data);
    const email = getReminderEmail(reminderType, locale, templateArgs);

    const normalizedTo = data.toEmail?.trim();
    if (!isValidEmailAddress(normalizedTo)) {
      throw new Error("Invalid `to` field. The email address needs to follow the `email@example.com` format.");
    }

    const payload = data.preparedMessage || {
      from: lzecherEmailFrom(locale === "he" ? "לזכר" : "Lzecher"),
      to: normalizedTo,
      subject: email.subject,
      html: email.body,
    };
    if (!data.preparedMessage) await docRef.update({ preparedMessage: payload });
    const { error } = await resend.emails.send(payload, { idempotencyKey: `lzecher-reminder-${doc.id}` });

    if (error) throw new Error(error.message);

    await docRef.update({
      status: "sent",
      sentAt: now,
      lastError: null,
      failedAt: null,
      leaseUntil: 0,
      templateVersion: "2026-10-28",
    });
    return "sent";
  } catch (err) {
    const attempts = (data.attempts ?? 0) + 1;

    if (attempts >= 3 || isPermanentEmailError(err)) {
      await docRef.update({
        status: "failed",
        attempts,
        lastError: String(err),
        failedAt: now,
        leaseUntil: 0,
      });
    } else {
      await docRef.update({
        attempts,
        lastError: String(err),
        sendAt: now + 60 * 60 * 1000,
        leaseUntil: 0,
      });
    }

    throw err;
  }
}

export function normalizeReminderType(value?: string | null): ReminderType | null {
  if (isCreatorZeroClaimNudgeType(value)) return value;
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
  return null;
}

async function projectStillHasZeroClaims(
  data: ScheduledEmail,
  docRef: FirebaseFirestore.DocumentReference,
  now: number
) {
  const projectId = data.projectId?.trim();
  if (!projectId) {
    await cancelScheduledEmail(docRef, now, "missing_project_id");
    return false;
  }

  const db = getAdminDb();
  const projectSnap = await db.collection("lzecher_projects").doc(projectId).get();
  if (!projectSnap.exists) {
    await cancelScheduledEmail(docRef, now, "project_not_found");
    return false;
  }

  const project = projectSnap.data() || {};
  if (project.status && project.status !== "active") {
    await cancelScheduledEmail(docRef, now, "project_not_active");
    return false;
  }

  if (await projectHasAnyActivity(db, projectId, project)) {
    await cancelScheduledEmail(docRef, now, "project_has_claims");
    return false;
  }

  return true;
}

async function processCreatorZeroClaimAutoDelete(
  data: ScheduledEmail,
  docRef: FirebaseFirestore.DocumentReference,
  now: number
) {
  const projectId = data.projectId?.trim();
  if (!projectId) {
    await cancelScheduledEmail(docRef, now, "missing_project_id");
    return;
  }

  const db = getAdminDb();
  const projectSnap = await db.collection("lzecher_projects").doc(projectId).get();
  if (!projectSnap.exists) {
    await cancelScheduledEmail(docRef, now, "project_not_found");
    return;
  }

  const project = projectSnap.data() || {};
  if (project.status && project.status !== "active") {
    await cancelScheduledEmail(docRef, now, "project_not_active");
    return;
  }

  if (await projectHasAnyActivity(db, projectId, project)) {
    await cancelScheduledEmail(docRef, now, "project_has_claims");
    return;
  }

  const warning = await db.collection("lzecher_scheduled_emails").doc(`${projectId}_creatorZeroClaimsFinalWarning`).get();
  const warningData = warning.data();
  if (warningData?.status !== "sent" || warningData.templateVersion !== "2026-10-28" || !warningData.sentAt) {
    await cancelScheduledEmail(docRef, now, "valid_final_warning_required");
    return;
  }
  const earliestDelete = Number(warningData.sentAt) + 3 * 24 * 60 * 60_000;
  if (now < earliestDelete) {
    await docRef.update({ sendAt: earliestDelete, leaseUntil: 0 });
    return;
  }
  const result = await softDeleteProject({
    db,
    projectId,
    actorUid: "system",
    source: "zero_claim_inactivity",
    reason: "no_learning_taken_after_creator_reminder_window",
    now,
    requireZeroActivity: true,
  });

  if (!result.deleted) {
    await cancelScheduledEmail(docRef, now, result.reason || "auto_delete_skipped");
    return;
  }

  await docRef.update({
    status: "completed",
    completedAt: now,
    lifecycleResult: "project_soft_deleted",
    lastError: null,
    failedAt: null,
  });
}

async function cancelScheduledEmail(
  docRef: FirebaseFirestore.DocumentReference,
  now: number,
  reason: string
) {
  await docRef.update({
    status: "canceled",
    canceledAt: now,
    cancelReason: reason,
    leaseUntil: 0,
    lastError: null,
    failedAt: null,
  });
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
  preparedMessage?: { from: string; to: string; subject: string; html: string };
  createdAt?: number;
  leaseUntil?: number;
  firstAttemptAt?: number;
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
  status: "pending" | "sent" | "failed" | "canceled" | "cancelled" | "completed";
  attempts?: number;
  honoreeName?: string;
  commitmentDesc?: string;
  trackType?: string;
}
