import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { getClaimMode } from "@/lib/track-config";
import { getChizukMessage } from "@/lib/chizuk-messages";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recomputeProjectProgress } from "@/lib/recompute-progress";
import type { TrackType } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { portionId, projectId, claimId, idToken, checkIn, completedByName, completedByEmail } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!portionId && !claimId) {
      return NextResponse.json({ error: "portionId or claimId is required" }, { status: 400 });
    }

    // Try to authenticate (optional). If no token, this is an anonymous completion.
    let uid: string | null = null;
    let isAdmin = false;
    if (idToken) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        isAdmin = Boolean(decoded.isAdmin || decoded.isSuperAdmin);
      } catch {
        // ignore — fall through to anon path
      }
    }

    // Anonymous completion requires a name and is rate-limited per IP.
    if (!uid) {
      const trimmedName = (completedByName || "").trim();
      if (!trimmedName) {
        return NextResponse.json({ error: "Name required for anonymous completion" }, { status: 400 });
      }
      const ip = getClientIp(request);
      const rl = await checkRateLimit("markCompleteAnon", `complete:${ip}`);
      if (!rl.success) {
        return NextResponse.json(
          { error: "Too many completions from this address. Please try again later." },
          { status: 429 }
        );
      }
    }

    const db = getAdminDb();
    const now = Date.now();
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const projectData = projectSnap.data()!;

    // ── Check-in path (inclusive daily/weekly commitment) ── REQUIRES AUTH
    if (checkIn === true && claimId) {
      if (!uid) {
        return NextResponse.json({ error: "Sign-in required to mark daily learning" }, { status: 401 });
      }
      const claimRef = db.collection("lzecher_claims").doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      const claimData = claimSnap.data()!;
      if (claimData.projectId !== projectId) {
        return NextResponse.json({ error: "Learning entry does not belong to this memorial" }, { status: 400 });
      }
      if (claimData.userId !== uid) {
        return NextResponse.json({ error: "This learning entry belongs to another participant" }, { status: 403 });
      }
      if (claimData.status !== "active") {
        return NextResponse.json({ error: "Claim is not active" }, { status: 400 });
      }

      const progress = claimData.progress || { completed: 0, total: 0 };
      const newCompleted = progress.completed + 1;
      const lastCheckIn: number = claimData.lastCheckIn || 0;

      const hoursSinceLast = (now - lastCheckIn) / (1000 * 60 * 60);
      const currentStreak: number = claimData.currentStreak || 0;
      const longestStreak: number = claimData.longestStreak || 0;
      let newStreak = currentStreak;
      if (lastCheckIn === 0 || hoursSinceLast <= 48) {
        newStreak = currentStreak + 1;
      } else {
        newStreak = 1;
      }
      const newLongest = Math.max(longestStreak, newStreak);

      const isFullyComplete = progress.total > 0 && newCompleted >= progress.total;

      await claimRef.update({
        "progress.completed": newCompleted,
        lastCheckIn: now,
        currentStreak: newStreak,
        longestStreak: newLongest,
        ...(isFullyComplete ? { status: "completed" } : {}),
      });

      const honoreeNameCheckin = `${projectData.nameHebrew} ${projectData.familyNameHebrew || ""}`.trim();
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

    // ── Standard completion path ──
    if (!portionId) {
      return NextResponse.json({ error: "portionId is required for standard completion" }, { status: 400 });
    }

    const portionRef = db.collection("lzecher_portions").doc(portionId);
    const portionSnap = await portionRef.get();
    if (!portionSnap.exists) {
      return NextResponse.json({ error: "Portion not found" }, { status: 404 });
    }
    const portionData = portionSnap.data()!;
    if (portionData.projectId !== projectId) {
      return NextResponse.json({ error: "Portion does not belong to this memorial" }, { status: 400 });
    }

    const trackType = portionData.trackType as TrackType;
    const claimMode = portionData.claimMode ?? getClaimMode(trackType);

    const completerName = (completedByName || "").trim() || null;
    const completerEmail = (completedByEmail || "").trim() || null;

    if (claimMode === "exclusive") {
      if (portionData.status !== "claimed") {
        return NextResponse.json({ error: "This portion is not currently taken" }, { status: 400 });
      }
      // For exclusive: the original claimer's authenticated session can mark complete
      // OR anyone with name (anonymous completion is allowed by design — Solomon's request)
      // Admins can override regardless.
      const isOwner = uid !== null && portionData.claimedBy === uid;
      if (!isOwner && !isAdmin && !completerName) {
        return NextResponse.json({ error: "Name required to mark someone else's learning as complete" }, { status: 400 });
      }

      // Mark the claim doc as completed
      let claimRefToComplete: FirebaseFirestore.DocumentReference | null = null;
      if (claimId) {
        const claimRef = db.collection("lzecher_claims").doc(claimId);
        const claimSnap = await claimRef.get();
        if (!claimSnap.exists) {
          return NextResponse.json({ error: "Claim not found" }, { status: 404 });
        }
        const claimData = claimSnap.data()!;
        if (claimData.projectId !== projectId || claimData.portionId !== portionId) {
          return NextResponse.json({ error: "Learning entry does not belong to this portion" }, { status: 400 });
        }
        if (claimData.status !== "active") {
          return NextResponse.json({ error: "Learning entry is not active" }, { status: 400 });
        }
        claimRefToComplete = claimRef;
      } else {
        // Find active claim by portionId
        const claimQuery = await db
          .collection("lzecher_claims")
          .where("projectId", "==", projectId)
          .where("portionId", "==", portionId)
          .where("status", "==", "active")
          .limit(1)
          .get();
        if (!claimQuery.empty) {
          claimRefToComplete = claimQuery.docs[0].ref;
        }
      }

      const completionBatch = db.batch();
      completionBatch.update(portionRef, {
        status: "completed",
        completedAt: now,
        completedByName: completerName || portionData.claimedByName || null,
        completedByEmail: completerEmail,
        completedByUid: uid,
      });
      if (claimRefToComplete) {
        completionBatch.update(claimRefToComplete, {
          status: "completed",
          completedAt: now,
          completedByName: completerName,
          completedByUid: uid,
        });
      }
      await completionBatch.commit();

      // Update project stats
      await projectRef.update({
        completedPortions: (projectData.completedPortions || 0) + 1,
      });
    } else {
      // Inclusive one-time completion — must reference a specific claim
      if (!claimId) {
        return NextResponse.json({ error: "Learning entry required for this completion" }, { status: 400 });
      }
      const claimRef = db.collection("lzecher_claims").doc(claimId);
      const claimSnap = await claimRef.get();
      if (!claimSnap.exists) {
        return NextResponse.json({ error: "Claim not found" }, { status: 404 });
      }
      const claimData = claimSnap.data()!;
      if (claimData.projectId !== projectId || claimData.portionId !== portionId) {
        return NextResponse.json({ error: "Learning entry does not belong to this portion" }, { status: 400 });
      }
      if (claimData.status !== "active") {
        return NextResponse.json({ error: "Learning entry is not active" }, { status: 400 });
      }
      const isOwner = uid !== null && claimData.userId === uid;
      if (!isOwner && !isAdmin && !completerName) {
        return NextResponse.json({ error: "Name required to mark someone else's learning as complete" }, { status: 400 });
      }
      await claimRef.update({
        status: "completed",
        completedAt: now,
        completedByName: completerName,
        completedByUid: uid,
      });

      await projectRef.update({
        completedPortions: (projectData.completedPortions || 0) + 1,
      });
    }

    // Authoritative stat recompute (self-healing; can't drift). Non-fatal.
    try {
      await recomputeProjectProgress(db, projectId);
    } catch (e) {
      console.error("[complete] recompute failed:", e);
    }

    // Build chizuk response
    const honoreeName = `${projectData.nameHebrew} ${projectData.familyNameHebrew || ""}`.trim();
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
