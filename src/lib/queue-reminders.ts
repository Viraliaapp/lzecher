import { getAdminDb } from "./firebase/admin";
import { normalizeEmailAddress } from "./email-validation";
import { sendScheduledReminderNow } from "./reminder-sender";
import type * as FirebaseFirestore from "@google-cloud/firestore";

interface QueueParams {
  claimId: string;
  projectId: string;
  projectSlug?: string | null;
  userId: string;
  userEmail: string | null;
  reminderPreferences: string[];
  durationEndDate: number | null;
  locale?: string;
  honoreeName?: string;
  commitmentDesc?: string;
  trackType?: string;
}

// Map UI preference key → reminder template type used by the cron job
const PREF_TO_TYPE: Record<string, string> = {
  confirmation: "confirmation",
  halfway: "halfway",
  sevenDays: "sevenDaysBefore",
};

export const DEFAULT_REMINDER_PREFERENCES = ["confirmation", "halfway", "sevenDays"] as const;
const ALLOWED_REMINDER_PREFERENCES = new Set<string>(DEFAULT_REMINDER_PREFERENCES);
const MIN_SEPARATION_FROM_NOW_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function sanitizeReminderPreferences(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const raw of value) {
    const key = raw === "sevenDaysBefore" ? "sevenDays" : raw;
    if (typeof key !== "string" || !ALLOWED_REMINDER_PREFERENCES.has(key)) continue;
    if (!result.includes(key)) result.push(key);
  }
  return result;
}

export function normalizeFutureTimestamp(value: unknown, now = Date.now()): number | null {
  const millis =
    typeof value === "number"
      ? value
      : typeof (value as { toMillis?: unknown })?.toMillis === "function"
        ? (value as { toMillis: () => number }).toMillis()
        : Number(value);
  return Number.isFinite(millis) && millis > now ? millis : null;
}

export async function queueRemindersForClaim(params: QueueParams) {
  const {
    claimId,
    projectId,
    projectSlug,
    userId,
    userEmail,
    reminderPreferences,
    durationEndDate,
    locale = "en",
    honoreeName,
    commitmentDesc,
    trackType,
  } = params;

  const normalizedEmail = normalizeEmailAddress(userEmail);
  const sanitizedPreferences = sanitizeReminderPreferences(reminderPreferences);
  if (!normalizedEmail || sanitizedPreferences.length === 0) return;

  const db = getAdminDb();
  const batch = db.batch();
  const now = Date.now();
  const safeDurationEndDate = normalizeFutureTimestamp(durationEndDate, now);
  const immediateRefs: FirebaseFirestore.DocumentReference[] = [];
  let queuedCount = 0;

  for (const pref of sanitizedPreferences) {
    let sendAt: number | null = null;

    switch (pref) {
      case "confirmation":
        sendAt = now; // immediate
        break;
      case "halfway":
        if (safeDurationEndDate) sendAt = Math.round((now + safeDurationEndDate) / 2);
        break;
      case "sevenDays":
        if (safeDurationEndDate) sendAt = safeDurationEndDate - 7 * DAY_MS;
        break;
      default:
        continue;
    }

    const reminderType = PREF_TO_TYPE[pref];
    if (!reminderType) continue;

    const shouldQueue =
      pref === "confirmation"
        ? Boolean(sendAt && sendAt > now - 60_000)
        : Boolean(sendAt && sendAt > now + MIN_SEPARATION_FROM_NOW_MS);

    if (shouldQueue && sendAt) {
      const ref = db.collection("lzecher_scheduled_emails").doc();
      batch.set(ref, {
        id: ref.id,
        // Schema fields that the cron route reads (see /api/cron/send-reminders)
        toEmail: normalizedEmail,
        userEmail: normalizedEmail, // legacy alias for back-compat
        userId,
        claimId,
        projectId,
        projectSlug: projectSlug ?? null,
        reminderType,
        type: pref, // legacy alias
        locale,
        honoreeName: honoreeName ?? null,
        commitmentDesc: commitmentDesc ?? null,
        trackType: trackType ?? null,
        sendAt,
        status: "pending",
        attempts: 0,
        createdAt: now,
      });
      queuedCount++;
      if (pref === "confirmation") immediateRefs.push(ref);
    }
  }

  if (queuedCount === 0) return;

  await batch.commit();

  for (const ref of immediateRefs) {
    try {
      await sendScheduledReminderNow(ref, now);
    } catch (err) {
      console.error("[queue-reminders] immediate confirmation send failed:", err);
    }
  }
}
