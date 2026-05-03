import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { getClaimMode } from "@/lib/track-config";
import { getChizukMessage } from "@/lib/chizuk-messages";
import type { TrackType } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { portionId, projectId, claimId, idToken, checkIn } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!portionId && !claimId) {
      return NextResponse.json({ error: "portionId or claimId is required" }, { status: 400 });
    }

    // Auth required
    if (!idToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const db = getAdminDb();
    const now = Date.now();

    // ── Check-in path (inclusive daily/weekly commitment) ──
    if (checkIn === true && claimId) {
      const claimRef = db.collection("lzecher_claims").doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      const claimData = claimSnap.data()!;
      if (claimData.userId !== decoded.uid) {
        return NextResponse.json({ error: "Not your claim" }, { status: 403 });
      }
      if (claimData.status !== "active") {
        return NextResponse.json({ error: "Claim is not active" }, { status: 400 });
      }

      const progress = claimData.progress || { completed: 0, total: 0 };
      const newCompleted = progress.completed + 1;
      const lastCheckIn: number = claimData.lastCheckIn || 0;

      // Streak logic: check if last check-in was within the last 48 hours (daily tolerance)
      const hoursSinceLast = (now - lastCheckIn) / (1000 * 60 * 60);
      const currentStreak: number = claimData.currentStreak || 0;
      const longestStreak: number = claimData.longestStreak || 0;
      let newStreak = currentStreak;
      if (lastCheckIn === 0 || hoursSinceLast <= 48) {
        newStreak = currentStreak + 1;
      } else {
        // Streak broken
        newStreak = 1;
      }
      const newLongest = Math.max(longestStreak, newStreak);

      const isFullyComplete =
        progress.total > 0 && newCompleted >= progress.total;

      await claimRef.update({
        "progress.completed": newCompleted,
        lastCheckIn: now,
        currentStreak: newStreak,
        longestStreak: newLongest,
        ...(isFullyComplete ? { status: "completed" } : {}),
      });

      const projectRefCheckin = db.collection("lzecher_projects").doc(projectId);
      const projectSnapCheckin = await projectRefCheckin.get();
      const projCheckin = projectSnapCheckin.exists ? projectSnapCheckin.data()! : null;
      const honoreeNameCheckin = projCheckin
        ? `${projCheckin.nameHebrew} ${projCheckin.familyNameHebrew || ""}`.trim()
        : "";
      const chizukCheckin = getChizukMessage("generic_checkin");
      return NextResponse.json({
        success: true,
        completed: newCompleted,
        total: progress.total,
        currentStreak: newStreak,
        longestStreak: newLongest,
        claimCompleted: isFullyComplete,
        chizuk: {
          he: chizukCheckin.he.replace("{name}", honoreeNameCheckin),
          en: chizukCheckin.en.replace("{name}", honoreeNameCheckin),
          es: chizukCheckin.es.replace("{name}", honoreeNameCheckin),
          fr: chizukCheckin.fr.replace("{name}", honoreeNameCheckin),
        },
      });
    }

    // ── Standard completion path (exclusive, or one-time inclusive) ──
    if (!portionId) {
      return NextResponse.json({ error: "portionId is required for standard completion" }, { status: 400 });
    }

    const portionRef = db.collection("lzecher_portions").doc(portionId);
    const portionSnap = await portionRef.get();
    if (!portionSnap.exists) {
      return NextResponse.json({ error: "Portion not found" }, { status: 404 });
    }
    const portionData = portionSnap.data()!;

    const trackType = portionData.trackType as TrackType;
    const claimMode = portionData.claimMode ?? getClaimMode(trackType);

    if (claimMode === "exclusive") {
      // Must be the current claimer
      if (portionData.status !== "claimed") {
        return NextResponse.json({ error: "Portion not claimed" }, { status: 400 });
      }
      if (portionData.claimedBy !== decoded.uid) {
        return NextResponse.json({ error: "Not your claim" }, { status: 403 });
      }

      await portionRef.update({
        status: "completed",
        completedAt: now,
      });

      // Mark the claim doc as completed if claimId provided
      if (claimId) {
        const claimRef = db.collection("lzecher_claims").doc(claimId);
        await claimRef.update({ status: "completed", completedAt: now });
      } else {
        // Find active claim by portionId + userId
        const claimQuery = await db
          .collection("lzecher_claims")
          .where("portionId", "==", portionId)
          .where("userId", "==", decoded.uid)
          .where("status", "==", "active")
          .limit(1)
          .get();
        if (!claimQuery.empty) {
          await claimQuery.docs[0].ref.update({ status: "completed", completedAt: now });
        }
      }

      // Update project stats
      const projectRef = db.collection("lzecher_projects").doc(projectId);
      const projectSnap = await projectRef.get();
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        await projectRef.update({
          completedPortions: (proj.completedPortions || 0) + 1,
        });
      }
    } else {
      // Inclusive one-time completion — just mark the user's claim completed
      if (!claimId) {
        return NextResponse.json({ error: "claimId required for inclusive completion" }, { status: 400 });
      }
      const claimRef = db.collection("lzecher_claims").doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      const claimData = claimSnap.data()!;
      if (claimData.userId !== decoded.uid) {
        return NextResponse.json({ error: "Not your claim" }, { status: 403 });
      }
      await claimRef.update({ status: "completed", completedAt: now });

      // Update project stats
      const projectRef = db.collection("lzecher_projects").doc(projectId);
      const projectSnap = await projectRef.get();
      if (projectSnap.exists) {
        const proj = projectSnap.data()!;
        await projectRef.update({
          completedPortions: (proj.completedPortions || 0) + 1,
        });
      }
    }

    // Build chizuk response
    const projectRefFinal = db.collection("lzecher_projects").doc(projectId);
    const projectSnapFinal = await projectRefFinal.get();
    const projFinal = projectSnapFinal.exists ? projectSnapFinal.data()! : null;
    const honoreeName = projFinal
      ? `${projFinal.nameHebrew} ${projFinal.familyNameHebrew || ""}`.trim()
      : "";
    const chizuk = getChizukMessage("generic_complete");
    return NextResponse.json({
      success: true,
      chizuk: {
        he: chizuk.he.replace("{name}", honoreeName),
        en: chizuk.en.replace("{name}", honoreeName),
        es: chizuk.es.replace("{name}", honoreeName),
        fr: chizuk.fr.replace("{name}", honoreeName),
      },
    });
  } catch (err) {
    console.error("Complete error:", err);
    return NextResponse.json({ error: "Failed to mark as complete" }, { status: 500 });
  }
}
