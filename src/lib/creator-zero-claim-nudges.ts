import { getAdminDb } from "./firebase/admin";
import { normalizeEmailAddress } from "./email-validation";
import { normalizeLocale } from "./locales";

const DAY_MS = 24 * 60 * 60 * 1000;

export const CREATOR_ZERO_CLAIM_NUDGE_TYPES = [
  "creatorZeroClaimsTwoWeeks",
  "creatorZeroClaimsThirtyDays",
  "creatorZeroClaimsFinalWarning",
] as const;

export type CreatorZeroClaimNudgeType = (typeof CREATOR_ZERO_CLAIM_NUDGE_TYPES)[number];

export const CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE = "creatorZeroClaimsAutoDelete" as const;
export type CreatorZeroClaimLifecycleType = CreatorZeroClaimNudgeType | typeof CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE;

const NUDGE_SCHEDULE: Array<{ type: CreatorZeroClaimNudgeType; offsetDays: number }> = [
  { type: "creatorZeroClaimsTwoWeeks", offsetDays: 14 },
  { type: "creatorZeroClaimsThirtyDays", offsetDays: 30 },
  { type: "creatorZeroClaimsFinalWarning", offsetDays: 37 },
];

export function isCreatorZeroClaimNudgeType(value?: string | null): value is CreatorZeroClaimNudgeType {
  return CREATOR_ZERO_CLAIM_NUDGE_TYPES.includes(value as CreatorZeroClaimNudgeType);
}

export function isCreatorZeroClaimAutoDeleteType(value?: string | null): value is typeof CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE {
  return value === CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE;
}

export function isCreatorZeroClaimLifecycleType(value?: string | null): value is CreatorZeroClaimLifecycleType {
  return isCreatorZeroClaimNudgeType(value) || isCreatorZeroClaimAutoDeleteType(value);
}

function scheduledEmailId(projectId: string, type: CreatorZeroClaimLifecycleType) {
  return `${projectId}_${type}`;
}

interface QueueCreatorZeroClaimNudgesParams {
  projectId: string;
  projectSlug: string;
  creatorUserId: string;
  creatorEmail?: string | null;
  locale?: string | null;
  honoreeName: string;
  createdAt?: number;
}

export async function queueCreatorZeroClaimNudges(params: QueueCreatorZeroClaimNudgesParams) {
  const normalizedEmail = normalizeEmailAddress(params.creatorEmail);
  if (!normalizedEmail) return { queued: 0 };

  const db = getAdminDb();
  const now = Date.now();
  const createdAt = Number.isFinite(params.createdAt) ? Number(params.createdAt) : now;
  const locale = normalizeLocale(params.locale);
  const batch = db.batch();

  for (const item of NUDGE_SCHEDULE) {
    const ref = db
      .collection("lzecher_scheduled_emails")
      .doc(scheduledEmailId(params.projectId, item.type));

    batch.set(ref, {
      id: ref.id,
      toEmail: normalizedEmail,
      userEmail: normalizedEmail,
      userId: params.creatorUserId,
      projectId: params.projectId,
      projectSlug: params.projectSlug,
      reminderType: item.type,
      type: item.type,
      purpose: "creator_zero_claims",
      locale,
      honoreeName: params.honoreeName,
      commitmentDesc: null,
      trackType: null,
      sendAt: createdAt + item.offsetDays * DAY_MS,
      status: "pending",
      attempts: 0,
      createdAt: now,
      projectCreatedAt: createdAt,
    });
  }

  const deleteRef = db
    .collection("lzecher_scheduled_emails")
    .doc(scheduledEmailId(params.projectId, CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE));

  batch.set(deleteRef, {
    id: deleteRef.id,
    toEmail: normalizedEmail,
    userEmail: normalizedEmail,
    userId: params.creatorUserId,
    projectId: params.projectId,
    projectSlug: params.projectSlug,
    reminderType: CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE,
    type: CREATOR_ZERO_CLAIM_AUTO_DELETE_TYPE,
    purpose: "creator_zero_claims",
    lifecycleAction: "soft_delete_if_zero_claims",
    locale,
    honoreeName: params.honoreeName,
    commitmentDesc: null,
    trackType: null,
    sendAt: createdAt + 40 * DAY_MS,
    status: "pending",
    attempts: 0,
    createdAt: now,
    projectCreatedAt: createdAt,
  });

  await batch.commit();
  return { queued: NUDGE_SCHEDULE.length, lifecycleJobsQueued: 1 };
}
