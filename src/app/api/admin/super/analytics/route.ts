import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth-roles";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 30;
const DOC_LIMIT = 5000;

type DailyMetricKey =
  | "projectsCreated"
  | "claimsTaken"
  | "claimsCompleted"
  | "feedbackSubmitted"
  | "reportsSubmitted"
  | "remindersQueued"
  | "remindersSent"
  | "remindersFailed";

type DailyBucket = Record<DailyMetricKey, number> & {
  date: string;
};

function dayKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function toMillis(timestamp: unknown) {
  if (typeof timestamp === "number") return timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (timestamp && typeof timestamp === "object" && "toMillis" in timestamp) {
    const value = (timestamp as { toMillis?: () => number }).toMillis?.();
    return typeof value === "number" ? value : 0;
  }
  return 0;
}

function clampDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_RANGE_DAYS;
  return Math.max(1, Math.min(MAX_RANGE_DAYS, Math.floor(parsed)));
}

function buildBuckets(startAt: number, rangeDays: number) {
  const buckets: DailyBucket[] = [];
  const byDate = new Map<string, DailyBucket>();
  const startDate = new Date(startAt);
  startDate.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < rangeDays; i++) {
    const date = new Date(startDate.getTime() + i * 86400000);
    const key = date.toISOString().slice(0, 10);
    const bucket: DailyBucket = {
      date: key,
      projectsCreated: 0,
      claimsTaken: 0,
      claimsCompleted: 0,
      feedbackSubmitted: 0,
      reportsSubmitted: 0,
      remindersQueued: 0,
      remindersSent: 0,
      remindersFailed: 0,
    };
    buckets.push(bucket);
    byDate.set(key, bucket);
  }

  return { buckets, byDate };
}

function addToBucket(
  byDate: Map<string, DailyBucket>,
  key: DailyMetricKey,
  timestamp: unknown,
  increment = 1
) {
  const numeric = toMillis(timestamp);
  if (!numeric) return;
  const bucket = byDate.get(dayKey(numeric));
  if (!bucket) return;
  bucket[key] += increment;
}

async function getRangeDocs(
  collection: FirebaseFirestore.CollectionReference,
  field: string,
  startAt: number,
  endAt: number
) {
  return collection
    .where(field, ">=", startAt)
    .where(field, "<=", endAt)
    .limit(DOC_LIMIT)
    .get();
}

export async function POST(request: NextRequest) {
  try {
    const { idToken, rangeDays: rangeDaysInput } = await request.json();
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await requireAdmin(idToken, "stats");

    const rangeDays = clampDays(rangeDaysInput);
    const endAt = Date.now();
    const startDate = new Date(endAt);
    startDate.setUTCDate(startDate.getUTCDate() - rangeDays + 1);
    startDate.setUTCHours(0, 0, 0, 0);
    const startAt = startDate.getTime();
    const { buckets, byDate } = buildBuckets(startAt, rangeDays);

    const db = getAdminDb();
    const projectsRef = db.collection("lzecher_projects");
    const claimsRef = db.collection("lzecher_claims");
    const feedbackRef = db.collection("lzecher_feedback");
    const reportsRef = db.collection("lzecher_reports");
    const scheduledEmailsRef = db.collection("lzecher_scheduled_emails");

    const [
      projectsCreatedSnap,
      claimsTakenSnap,
      claimsCompletedSnap,
      feedbackSnap,
      reportsSnap,
      remindersQueuedSnap,
      remindersSentSnap,
      remindersFailedSnap,
    ] = await Promise.all([
      getRangeDocs(projectsRef, "createdAt", startAt, endAt),
      getRangeDocs(claimsRef, "claimedAt", startAt, endAt),
      getRangeDocs(claimsRef, "completedAt", startAt, endAt),
      getRangeDocs(feedbackRef, "submittedAt", startAt, endAt),
      getRangeDocs(reportsRef, "reportedAt", startAt, endAt),
      getRangeDocs(scheduledEmailsRef, "createdAt", startAt, endAt),
      getRangeDocs(scheduledEmailsRef, "sentAt", startAt, endAt),
      getRangeDocs(scheduledEmailsRef, "failedAt", startAt, endAt),
    ]);

    for (const doc of projectsCreatedSnap.docs) {
      addToBucket(byDate, "projectsCreated", doc.data().createdAt);
    }
    for (const doc of claimsTakenSnap.docs) {
      const data = doc.data();
      if (data.isParent === true) continue;
      addToBucket(byDate, "claimsTaken", data.claimedAt);
    }
    for (const doc of claimsCompletedSnap.docs) {
      const data = doc.data();
      if (data.isParent === true) continue;
      addToBucket(byDate, "claimsCompleted", data.completedAt);
    }
    for (const doc of feedbackSnap.docs) {
      const data = doc.data();
      addToBucket(byDate, "feedbackSubmitted", data.submittedAt || data.createdAt);
    }
    for (const doc of reportsSnap.docs) {
      addToBucket(byDate, "reportsSubmitted", doc.data().reportedAt);
    }
    for (const doc of remindersQueuedSnap.docs) {
      addToBucket(byDate, "remindersQueued", doc.data().createdAt);
    }
    for (const doc of remindersSentSnap.docs) {
      addToBucket(byDate, "remindersSent", doc.data().sentAt);
    }
    for (const doc of remindersFailedSnap.docs) {
      addToBucket(byDate, "remindersFailed", doc.data().failedAt);
    }

    const totals = buckets.reduce<Record<DailyMetricKey, number>>(
      (acc, bucket) => {
        acc.projectsCreated += bucket.projectsCreated;
        acc.claimsTaken += bucket.claimsTaken;
        acc.claimsCompleted += bucket.claimsCompleted;
        acc.feedbackSubmitted += bucket.feedbackSubmitted;
        acc.reportsSubmitted += bucket.reportsSubmitted;
        acc.remindersQueued += bucket.remindersQueued;
        acc.remindersSent += bucket.remindersSent;
        acc.remindersFailed += bucket.remindersFailed;
        return acc;
      },
      {
        projectsCreated: 0,
        claimsTaken: 0,
        claimsCompleted: 0,
        feedbackSubmitted: 0,
        reportsSubmitted: 0,
        remindersQueued: 0,
        remindersSent: 0,
        remindersFailed: 0,
      }
    );

    return NextResponse.json({
      generatedAt: endAt,
      rangeDays,
      startAt,
      endAt,
      totals,
      daily: buckets,
      truncated: {
        projectsCreated: projectsCreatedSnap.size >= DOC_LIMIT,
        claimsTaken: claimsTakenSnap.size >= DOC_LIMIT,
        claimsCompleted: claimsCompletedSnap.size >= DOC_LIMIT,
        feedbackSubmitted: feedbackSnap.size >= DOC_LIMIT,
        reportsSubmitted: reportsSnap.size >= DOC_LIMIT,
        remindersQueued: remindersQueuedSnap.size >= DOC_LIMIT,
        remindersSent: remindersSentSnap.size >= DOC_LIMIT,
        remindersFailed: remindersFailedSnap.size >= DOC_LIMIT,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.startsWith("FORBIDDEN:")) {
      return NextResponse.json({ error: message.replace("FORBIDDEN:", "") }, { status: 403 });
    }
    console.error("[admin/super/analytics]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
