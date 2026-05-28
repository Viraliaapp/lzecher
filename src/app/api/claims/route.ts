import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getClaimMode } from "@/lib/track-config";
import type { TrackType, CommitmentDuration } from "@/lib/types";
import { queueRemindersForClaim } from "@/lib/queue-reminders";
import { maybeOpenNextSet } from "@/lib/open-next-set";

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
    email = email || body.claimerEmail || null;

    const db = getAdminDb();

    // Verify portion exists
    const portionRef = db.collection("lzecher_portions").doc(portionId);
    const portionSnap = await portionRef.get();
    if (!portionSnap.exists) {
      return NextResponse.json({ error: "Portion not found" }, { status: 404 });
    }
    const portionData = portionSnap.data()!;

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
      if (portionData.status !== "available") {
        return NextResponse.json({ error: "Portion already claimed" }, { status: 409 });
      }

      // Atomically claim the portion
      await portionRef.update({
        status: "claimed",
        claimedBy: uid,
        claimedByName: claimerName.trim(),
        claimedAt: now,
      });

      // Create claim doc
      const claimRef = db.collection("lzecher_claims").doc();
      await claimRef.set({
        id: claimRef.id,
        projectId,
        portionId,
        trackType,
        reference: portionData.reference,
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

      // Update project stats
      const projectRef = db.collection("lzecher_projects").doc(projectId);
      const projectSnap = await projectRef.get();
      let projectSlug: string | null = null;
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        projectSlug = (proj.slug as string) || null;
        const trackCount = ((proj.claimedByTrack as Record<string, number> | undefined) || {})[trackType] || 0;
        await projectRef.update({
          claimedPortions: (proj.claimedPortions || 0) + 1,
          participantCount: (proj.participantCount || 0) + 1,
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
      await claimRef.set({
        id: claimRef.id,
        projectId,
        portionId,
        trackType,
        reference: portionData.reference,
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

      // Increment currentClaimerCount and append claimer name
      await portionRef.update({
        currentClaimerCount: (portionData.currentClaimerCount || 0) + 1,
        claimerNames: [...((portionData.claimerNames as string[]) || []), claimerName.trim()],
      });

      // Update project stats
      const projectRef2 = db.collection("lzecher_projects").doc(projectId);
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

      return NextResponse.json({ success: true, claimId: claimRef.id, claimMode: "inclusive" });
    }
  } catch (err) {
    console.error("Claim error:", err);
    return NextResponse.json({ error: "Failed to claim portion" }, { status: 500 });
  }
}
