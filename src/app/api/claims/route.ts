import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getClaimMode } from "@/lib/track-config";
import type { TrackType, CommitmentDuration } from "@/lib/types";

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
    } = body;

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
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        await projectRef.update({
          claimedPortions: (proj.claimedPortions || 0) + 1,
          participantCount: (proj.participantCount || 0) + 1,
        });
      }

      return NextResponse.json({ success: true, claimId: claimRef.id, claimMode: "exclusive" });
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

      // Increment currentClaimerCount on the portion
      await portionRef.update({
        currentClaimerCount: (portionData.currentClaimerCount || 0) + 1,
      });

      // Update project stats
      const projectRef = db.collection("lzecher_projects").doc(projectId);
      const projectSnap = await projectRef.get();
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        await projectRef.update({
          claimedPortions: (proj.claimedPortions || 0) + 1,
          participantCount: (proj.participantCount || 0) + 1,
        });
      }

      return NextResponse.json({ success: true, claimId: claimRef.id, claimMode: "inclusive" });
    }
  } catch (err) {
    console.error("Claim error:", err);
    return NextResponse.json({ error: "Failed to claim portion" }, { status: 500 });
  }
}
