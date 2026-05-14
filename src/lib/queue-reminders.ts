import { getAdminDb } from "./firebase/admin";

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
}

// Map UI preference key → reminder template type used by the cron job
const PREF_TO_TYPE: Record<string, string> = {
  confirmation: "confirmation",
  halfway: "halfway",
  sevenDays: "sevenDaysBefore",
  threeDays: "threeDaysBefore",
  oneDay: "oneDayBefore",
  daily: "dailyReminder",
  weeklyDigest: "weeklyDigest",
};

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
  } = params;

  if (!userEmail || !reminderPreferences || reminderPreferences.length === 0) return;

  const db = getAdminDb();
  const batch = db.batch();
  const now = Date.now();

  for (const pref of reminderPreferences) {
    let sendAt: number | null = null;

    switch (pref) {
      case "confirmation":
        sendAt = now; // immediate
        break;
      case "halfway":
        if (durationEndDate) sendAt = Math.round((now + durationEndDate) / 2);
        break;
      case "sevenDays":
        if (durationEndDate) sendAt = durationEndDate - 7 * 86400000;
        break;
      case "threeDays":
        if (durationEndDate) sendAt = durationEndDate - 3 * 86400000;
        break;
      case "oneDay":
        if (durationEndDate) sendAt = durationEndDate - 1 * 86400000;
        break;
      case "daily":
        sendAt = now + 24 * 3600000; // first daily reminder tomorrow
        break;
      case "weeklyDigest":
        sendAt = now + 7 * 86400000; // first weekly digest in a week
        break;
      default:
        continue;
    }

    const reminderType = PREF_TO_TYPE[pref];
    if (!reminderType) continue;

    if (sendAt && sendAt > now - 60000) {
      // only queue future emails (with 1 min grace for "confirmation")
      const ref = db.collection("lzecher_scheduled_emails").doc();
      batch.set(ref, {
        id: ref.id,
        // Schema fields that the cron route reads (see /api/cron/send-reminders)
        toEmail: userEmail,
        userEmail, // legacy alias for back-compat
        userId,
        claimId,
        projectId,
        projectSlug: projectSlug ?? null,
        reminderType,
        type: pref, // legacy alias
        locale,
        honoreeName: honoreeName ?? null,
        commitmentDesc: commitmentDesc ?? null,
        sendAt,
        status: "pending",
        attempts: 0,
        createdAt: now,
      });
    }
  }

  await batch.commit();
}
