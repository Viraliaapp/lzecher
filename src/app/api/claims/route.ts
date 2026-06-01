import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getClaimMode } from "@/lib/track-config";
import type { TrackType, CommitmentDuration } from "@/lib/types";
import { queueRemindersForClaim } from "@/lib/queue-reminders";
import { maybeOpenNextSet } from "@/lib/open-next-set";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import { recomputeGlobalStats } from "@/lib/recompute-global";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      portionId,
      projectId,
      claimerName,
      idToken,
      duration,
      durationValue,
      durationEndDate,
      specificItem,
      reminderPreferences,
      claimerEmail,
      locale: claimLocale,
    } = body;
    const locale = (typeof claimLocale === "string" && ["en", "he", "es", "fr"].includes(claimLocale)) ? claimLocale : "en";

    if (!portionId || !projectId || !claimerName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rate limit
    const ip = getClientIp(request);
    const rl = await checkRateLimit("claimCreateAnon", `claim:${ip}`);
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Auth — required for inclusive claims, optional for exclusive
    let uid = "anonymous";
    let email: string | null = null;
    if (idToken) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || null;
      } catch {
        // Invalid token — treat as anonymous
      }
    }
    email = email || claimerEmail || null;

    const db = getAdminDb();

    // Reject missing or locked projects before touching any portion. The Firebase
    // project is shared with other apps, so every write must stay project-scoped.
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const lockSnap = await projectRef.get();
    if (!lockSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    if (lockSnap.data()!.locked === true) {
      return NextResponse.json({ error: "This memorial is locked. No new portions can be taken." }, { status: 423 });
    }

    // Verify portion exists
    const portionRef = db.collection("lzecher_portions").doc(portionId);
    const portionSnap = await portionRef.get();
    if (!portionSnap.exists) {
      return NextResponse.json({ error: "Portion not found" }, { status: 404 });
    }
    const portionData = portionSnap.data()!;
    if (portionData.projectId !== projectId) {
      return NextResponse.json({ error: "Portion does not belong to this memorial" }, { status: 400 });
    }

    // Determine claim mode from portion or from track config
    const trackType = portionData.trackType as TrackType;
    const claimMode =
      portionData.claimMode ?? getClaimMode(trackType);

    const now = Date.now();

    // Resolve duration
    const resolvedDuration: CommitmentDuration = duration || "oneTime";
    let resolvedEndDate: number | null = durationEndDate ?? null;
    if (!resolvedEndDate && durationValue) {
      if (resolvedDuration === "daily") {
        resolvedEndDate = now + durationValue * 24 * 60 * 60 * 1000;
      } else if (resolvedDuration === "weekly") {
        resolvedEndDate = now + durationValue * 7 * 24 * 60 * 60 * 1000;
      }
    }

    if (claimMode === "exclusive") {
      // Inclusive auth enforcement not needed here, anonymous allowed
      const claimRef = db.collection("lzecher_claims").doc();
      const claimAttempt = await db.runTransaction(async (transaction) => {
        const freshProjectSnap = await transaction.get(projectRef);
        if (!freshProjectSnap.exists) {
          return { ok: false as const, status: 404, error: "Project not found" };
        }
        if (freshProjectSnap.data()!.locked === true) {
          return { ok: false as const, status: 423, error: "This memorial is locked. No new portions can be taken." };
        }
        const freshPortionSnap = await transaction.get(portionRef);
        if (!freshPortionSnap.exists) {
          return { ok: false as const, status: 404, error: "Portion not found" };
        }
        const freshPortionData = freshPortionSnap.data()!;
        if (freshPortionData.projectId !== projectId) {
          return { ok: false as const, status: 400, error: "Portion does not belong to this memorial" };
        }
        if (freshPortionData.status !== "available") {
          return { ok: false as const, status: 409, error: "This portion was already taken." };
        }

        transaction.update(portionRef, {
          status: "claimed",
          claimedBy: uid,
          claimedByName: claimerName.trim(),
          claimedAt: now,
        });
        transaction.set(claimRef, {
          id: claimRef.id,
          projectId,
          portionId,
          trackType,
          reference: freshPortionData.reference,
          userId: uid,
          userName: claimerName.trim(),
          userEmail: email,
          locale,
          claimedAt: now,
          status: "active",
          duration: resolvedDuration,
          durationValue: durationValue ?? null,
          durationEndDate: resolvedEndDate,
          specificItem: specificItem ?? null,
          reminderPreferences: reminderPreferences ?? [],
        });
        return { ok: true as const };
      });
      if (!claimAttempt.ok) {
        return NextResponse.json({ error: claimAttempt.error }, { status: claimAttempt.status });
      }

      // Update project stats — increment participantCount only if this is the
      // user's first claim on this project (prevents one person = N participants).
      const projectSnap = await projectRef.get();
      let projectSlug: string | null = null;
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        projectSlug = (proj.slug as string) || null;
        const trackCount = ((proj.claimedByTrack as Record<string, number> | undefined) || {})[trackType] || 0;

        // Check if this user already has a prior claim on this project
        const priorClaimKey = uid !== "anonymous" ? "userId" : null;
        let isNewParticipant = true;
        if (priorClaimKey) {
          const priorSnap = await db.collection("lzecher_claims")
            .where("projectId", "==", projectId)
            .where("userId", "==", uid)
            .limit(2)
            .get();
          // limit(2): the claim we just wrote counts as 1; if ≥2 exist, user had a prior claim
          isNewParticipant = priorSnap.size <= 1;
        } else {
          // Anonymous user identified by name+email — check if combo appeared before
          const priorAnonSnap = await db.collection("lzecher_claims")
            .where("projectId", "==", projectId)
            .where("userName", "==", claimerName.trim())
            .limit(2)
            .get();
          const samePersonCount = priorAnonSnap.docs.filter((doc) => {
            const claim = doc.data();
            return (claim.userEmail || "") === (email || "");
          }).length;
          isNewParticipant = samePersonCount <= 1;
        }

        await projectRef.update({
          claimedPortions: (proj.claimedPortions || 0) + 1,
          ...(isNewParticipant ? { participantCount: (proj.participantCount || 0) + 1 } : {}),
          [`claimedByTrack.${trackType}`]: trackCount + 1,
        });
      }

      // Queue reminder emails
      if (email && reminderPreferences && reminderPreferences.length > 0) {
        try {
          await queueRemindersForClaim({
            claimId: claimRef.id,
            projectId,
            projectSlug,
            userId: uid,
            userEmail: email,
            reminderPreferences,
            durationEndDate: resolvedEndDate,
            locale,
            commitmentDesc: portionData.reference || portionData.displayName,
          });
        } catch (e) {
          console.error("Failed to queue reminders:", e);
        }
      }

      // ── Repeating sets: check if this set is now complete ───────────────────
      let newSetOpened = false;
      let newSetNumber: number | null = null;
      const isRepeatableTrack = trackType === "mishnayos" || trackType === "tehillim";
      if (isRepeatableTrack) {
        try {
          const currentSetNumber = (portionData.setNumber as number | undefined) || 1;
          const projectSnap2 = await db.collection("lzecher_projects").doc(projectId).get();
          const projData2 = projectSnap2.data();
          if (projData2) {
            const setResult = await maybeOpenNextSet(
              db, projectId,
              trackType as "mishnayos" | "tehillim",
              currentSetNumber,
              new Set([portionId]),
              projData2
            );
            newSetOpened = setResult.newSetOpened;
            newSetNumber = setResult.newSetNumber;
          }
        } catch (setErr) {
          // Non-fatal: set detection failed, claim still succeeded
          console.error("[claims] set-completion check failed:", setErr);
        }
      }

      // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
      try {
        await recomputeProjectProgress(db, projectId);
        await recomputeGlobalStats(db);
      } catch (e) {
        console.error("[claims] recompute failed:", e);
      }

      return NextResponse.json({ success: true, claimId: claimRef.id, claimMode: "exclusive", newSetOpened, newSetNumber });
    } else {
      // Inclusive — auth required
      if (uid === "anonymous") {
        return NextResponse.json({ error: "Authentication required for inclusive commitments" }, { status: 401 });
      }

      // Determine progress total based on duration
      let progressTotal: number | null = null;
      if (resolvedDuration === "daily" && durationValue) {
        progressTotal = durationValue;
      } else if (resolvedDuration === "weekly" && durationValue) {
        progressTotal = durationValue;
      }

      // Create claim doc (portion stays 'available' for others)
      const claimRef = db.collection("lzecher_claims").doc();
      const claimAttempt = await db.runTransaction(async (transaction) => {
        const freshProjectSnap = await transaction.get(projectRef);
        if (!freshProjectSnap.exists) {
          return { ok: false as const, status: 404, error: "Project not found" };
        }
        if (freshProjectSnap.data()!.locked === true) {
          return { ok: false as const, status: 423, error: "This memorial is locked. No new portions can be taken." };
        }
        const freshPortionSnap = await transaction.get(portionRef);
        if (!freshPortionSnap.exists) {
          return { ok: false as const, status: 404, error: "Portion not found" };
        }
        const freshPortionData = freshPortionSnap.data()!;
        if (freshPortionData.projectId !== projectId) {
          return { ok: false as const, status: 400, error: "Portion does not belong to this memorial" };
        }
        transaction.set(claimRef, {
          id: claimRef.id,
          projectId,
          portionId,
          trackType,
          reference: freshPortionData.reference,
          userId: uid,
          userName: claimerName.trim(),
          userEmail: email,
          locale,
          claimedAt: now,
          status: "active",
          duration: resolvedDuration,
          durationValue: durationValue ?? null,
          durationEndDate: resolvedEndDate,
          specificItem: specificItem ?? null,
          reminderPreferences: reminderPreferences ?? [],
          progress: progressTotal ? { completed: 0, total: progressTotal } : null,
          lastCheckIn: null,
          currentStreak: 0,
          longestStreak: 0,
        });
        transaction.update(portionRef, {
          currentClaimerCount: (freshPortionData.currentClaimerCount || 0) + 1,
          claimerNames: [...((freshPortionData.claimerNames as string[]) || []), claimerName.trim()],
        });
        return { ok: true as const };
      });
      if (!claimAttempt.ok) {
        return NextResponse.json({ error: claimAttempt.error }, { status: claimAttempt.status });
      }

      // Update project stats
      const projectRef2 = projectRef;
      const projectSnap2b = await projectRef2.get();
      let projectSlugInc: string | null = null;
      if (projectSnap2b.exists) {
        const proj2 = projectSnap2b.data()!;
        projectSlugInc = (proj2.slug as string) || null;
        const trackCount2 = ((proj2.claimedByTrack as Record<string, number> | undefined) || {})[trackType] || 0;
        await projectRef2.update({
          claimedPortions: (proj2.claimedPortions || 0) + 1,
          participantCount: (proj2.participantCount || 0) + 1,
          [`claimedByTrack.${trackType}`]: trackCount2 + 1,
        });
      }

      // Queue reminder emails
      if (email && reminderPreferences && reminderPreferences.length > 0) {
        try {
          await queueRemindersForClaim({
            claimId: claimRef.id,
            projectId,
            projectSlug: projectSlugInc,
            userId: uid,
            userEmail: email,
            reminderPreferences,
            durationEndDate: resolvedEndDate,
            locale,
            commitmentDesc: portionData.reference || portionData.displayName,
          });
        } catch (e) {
          console.error("Failed to queue reminders:", e);
        }
      }

      // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
      try {
        await recomputeProjectProgress(db, projectId);
        await recomputeGlobalStats(db);
      } catch (e) {
        console.error("[claims] recompute failed:", e);
      }

      return NextResponse.json({ success: true, claimId: claimRef.id, claimMode: "inclusive" });
    }
  } catch (err) {
    console.error("Claim error:", err);
    return NextResponse.json({ error: "Failed to reserve portion" }, { status: 500 });
  }
}
