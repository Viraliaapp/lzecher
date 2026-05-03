import { getAdminDb } from "./firebase/admin";

interface QueueParams {
  claimId: string;
  projectId: string;
  userId: string;
  userEmail: string | null;
  reminderPreferences: string[];
  durationEndDate: number | null;
}

export async function queueRemindersForClaim(params: QueueParams) {
  const { claimId, projectId, userId, userEmail, reminderPreferences, durationEndDate } = params;

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
      default:
        continue;
    }

    if (sendAt && sendAt > now - 60000) { // only queue future emails (with 1min grace)
      const ref = db.collection("lzecher_scheduled_emails").doc();
      batch.set(ref, {
        id: ref.id,
        claimId,
        projectId,
        userId,
        userEmail,
        type: pref,
        sendAt,
        status: "pending",
        attempts: 0,
        createdAt: now,
      });
    }
  }

  await batch.commit();
}
