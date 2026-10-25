import { reserveClaims } from "@/lib/claim-writes";
import { ClaimError } from "@/lib/claim-management";
import { parseClaimInput, documentId } from "@/lib/claim-input";
import { hasProjectAccess } from "@/lib/project-access";
import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizeFutureTimestamp, queueRemindersForClaim, sanitizeReminderPreferences } from "@/lib/queue-reminders";
import { maybeOpenNextSet } from "@/lib/open-next-set";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { recomputeGlobalStats } from "@/lib/recompute-global";
import { getClaimMode } from "@/lib/track-config";
import { learningScopeLabel } from "@/lib/learning-label";
import { normalizeEmailAddress } from "@/lib/email-validation";
import type { TrackType } from "@/lib/types";
import type * as FirebaseFirestore from "@google-cloud/firestore";

// Cherry-pick multi-select claim: user selects specific portionIds and enters
// one name/email for all of them.
export async function POST(request: NextRequest) {
  try {
    const body = parseClaimInput(await request.json().catch(() => null));
    const {
      portionIds,
      projectId,
      claimerName,
      idToken,
      claimerEmail,
      reminderPreferences,
      locale: claimLocale,
    } = body;

    const locale = (typeof claimLocale === "string" && ["en", "he", "es", "fr"].includes(claimLocale)) ? claimLocale : "en";
    const sanitizedReminderPreferences = sanitizeReminderPreferences(reminderPreferences);

    if (!Array.isArray(portionIds) || !portionIds.every(id => documentId.safeParse(id).success)) {
      throw new ClaimError(400, "Invalid portion IDs");
    }
    const rawPortionIds = Array.isArray(portionIds)
      ? portionIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
      : [];
    const uniquePortionIds = [...new Set(rawPortionIds)];

    if (uniquePortionIds.length === 0) {
      return NextResponse.json({ error: "portionIds must be a non-empty array" }, { status: 400 });
    }
    if (uniquePortionIds.length > 150) {
      return NextResponse.json({ error: "Maximum 150 portions at a time" }, { status: 400 });
    }
    if (!projectId || !claimerName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Auth first so we can skip rate limit for verified users
    let uid = "anonymous";
    let email: string | null = null;
    if (idToken) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || null;
      } catch {
        throw new ClaimError(401, "Invalid token; sign in again");
      }
    }
    const submittedEmail = typeof claimerEmail === "string" ? claimerEmail.trim() : "";
    const normalizedSubmittedEmail = normalizeEmailAddress(submittedEmail);
    if (submittedEmail && !normalizedSubmittedEmail && sanitizedReminderPreferences.length > 0) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    email = normalizedSubmittedEmail || normalizeEmailAddress(email);

    // Rate limit only for anonymous users
    if (uid === "anonymous") {
      const ip = getClientIp(request);
      const rl = await checkRateLimit("claimCreateAnon", `claim-multi:${ip}`);
      if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    const db = getAdminDb();
    const now = Date.now();

    // Reject missing or locked projects before creating any claim documents.
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const lockSnap = await projectRef.get();
    if (!lockSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const projectData = lockSnap.data()!;
    if (projectData.locked === true) {
      return NextResponse.json({ error: "This memorial is locked. No new portions can be taken." }, { status: 423 });
    }
    const reminderEndDate = normalizeFutureTimestamp(projectData.completionTargetDate, now);

    // Fetch all portions in one query (Firestore supports up to 30 in-clause items,
    // so we fetch by projectId + status and filter in JS for larger sets)
    const portionIdSet = new Set(uniquePortionIds);

    // Fetch each portion individually (batched reads via getAll)
    const portionRefs = uniquePortionIds.map((id: string) =>
      db.collection("lzecher_portions").doc(id)
    );
    const portionSnaps = await db.getAll(...portionRefs);

    // Validate all portions belong to this project and are available
    const validPortions: Array<{ id: string; ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }> = [];
    for (const snap of portionSnaps) {
      if (!snap.exists) continue;
      const data = snap.data()!;
      if (data.projectId !== projectId) continue;
      if (data.status !== "available") continue;
      if ((data.claimMode ?? getClaimMode(data.trackType as TrackType)) !== "exclusive") continue;
      validPortions.push({ id: snap.id, ref: snap.ref, data });
    }

    if (validPortions.length === 0) {
      return NextResponse.json({ error: "No available portions found", claimedCount: 0 }, { status: 409 });
    }

    const parentClaimRef = db.collection("lzecher_claims").doc();
    const reserved = await reserveClaims(db, projectId, validPortions.map(p => p.id), {
      userId: uid, userName: claimerName.trim(), userEmail: email, locale,
      claimedAt: now, status: "active", duration: "oneTime", durationEndDate: reminderEndDate,
      reminderPreferences: sanitizedReminderPreferences,
    }, { access: await hasProjectAccess(projectId), parentId: parentClaimRef.id,
      parent: { trackType: validPortions[0].data.trackType, scope: "multi" } });
    const claimedCount = reserved.length;
    if (!claimedCount) return NextResponse.json({ error: "No available portions found", claimedCount: 0 }, { status: 409 });
    const claimedPortionIdSet = new Set(reserved.map(p => p.id));
    const projectSlug = projectData.slug || null;

    // Queue reminders once for the whole multi-claim batch
    if (email && sanitizedReminderPreferences.length > 0) {
      try {
        await queueRemindersForClaim({
          claimId: parentClaimRef.id,
          projectId,
          projectSlug,
          userId: uid,
          userEmail: email,
          reminderPreferences: sanitizedReminderPreferences,
          durationEndDate: reminderEndDate,
          locale,
          commitmentDesc: learningScopeLabel(locale, "multi", null, validPortions[0]?.data.trackType as string | undefined, claimedCount),
          trackType: validPortions[0]?.data.trackType as string | undefined,
        });
      } catch (e) {
        console.error("[multi-claim] queue reminders failed:", e);
      }
    }

    const skippedCount = portionIdSet.size - claimedCount;

    // ── Repeating sets: check if any set is now complete ─────────────────────
    try {
      const repeatableDocs = reserved.filter(p =>
        p.data.trackType === "mishnayos" || p.data.trackType === "tehillim"
      );
      if (repeatableDocs.length > 0) {
        const projSnap2 = await db.collection("lzecher_projects").doc(projectId).get();
        const projData2 = projSnap2.data();
        if (projData2) {
          // Collect distinct (trackType, setNumber) pairs touched by this batch
          const setsToCheck = new Map<string, { trackType: "mishnayos" | "tehillim"; setNumber: number }>();
          for (const p of repeatableDocs) {
            const tt = p.data.trackType as "mishnayos" | "tehillim";
            const sn = (p.data.setNumber as number | undefined) || 1;
            setsToCheck.set(`${tt}:${sn}`, { trackType: tt, setNumber: sn });
          }
          for (const { trackType: tt, setNumber: sn } of setsToCheck.values()) {
            await maybeOpenNextSet(db, projectId, tt, sn, claimedPortionIdSet, projData2);
          }
        }
      }
    } catch (setErr) {
      console.error("[multi-claim] set-completion check failed:", setErr);
    }

    // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
    try {
      await recomputeProjectProgress(db, projectId);
      await recomputeGlobalStats(db);
    } catch (e) {
      console.error("[multi-claim] recompute failed:", e);
    }

    return NextResponse.json({
      success: true,
      claimedCount,
      skippedCount,
    });
  } catch (err) {
    if (err instanceof ClaimError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[multi-claim] error:", err);
    return NextResponse.json({ error: "Failed to reserve selected portions" }, { status: 500 });
  }
}
