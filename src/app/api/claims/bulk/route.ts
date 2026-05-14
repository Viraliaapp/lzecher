import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { queueRemindersForClaim } from "@/lib/queue-reminders";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, scope, scopeId, claimerName, idToken, claimerEmail, reminderPreferences, locale: claimLocale } = body;
    const locale = (typeof claimLocale === "string" && ["en", "he", "es", "fr"].includes(claimLocale)) ? claimLocale : "en";

    if (!projectId || !scope || !claimerName?.trim()) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Rate limit
    const ip = getClientIp(request);
    const rl = await checkRateLimit("claimCreateAnon", `claim:${ip}`);
    if (!rl.success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // Auth
    let uid = "anonymous";
    let email: string | null = null;
    if (idToken) {
      try {
        const auth = getAdminAuth();
        const decoded = await auth.verifyIdToken(idToken);
        uid = decoded.uid;
        email = decoded.email || null;
      } catch {
        // treat as anonymous
      }
    }
    email = email || claimerEmail || null;

    const db = getAdminDb();
    const now = Date.now();

    // Build query to find matching portions
    let query = db.collection("lzecher_portions").where("projectId", "==", projectId);

    if (scope === "shas") {
      query = query.where("trackType", "==", "mishnayos");
    } else if (scope === "seder") {
      query = query.where("trackType", "==", "mishnayos").where("seder", "==", scopeId);
    } else if (scope === "masechta") {
      query = query.where("trackType", "==", "mishnayos").where("masechet", "==", scopeId);
    } else if (scope === "whole_tehillim") {
      query = query.where("trackType", "==", "tehillim");
    } else if (scope === "tehillim_book") {
      // Can't filter by book directly in Firestore — we'll filter in JS
      query = query.where("trackType", "==", "tehillim");
    } else {
      return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
    }

    const portionsSnap = await query.get();
    let portions = portionsSnap.docs;

    // For tehillim_book, filter by book range
    if (scope === "tehillim_book" && scopeId) {
      const bookRanges: Record<string, [number, number]> = {
        "1": [1, 41], "2": [42, 72], "3": [73, 89], "4": [90, 106], "5": [107, 150]
      };
      const range = bookRanges[scopeId];
      if (range) {
        portions = portions.filter(d => {
          const mizmor = d.data().mizmor || 0;
          return mizmor >= range[0] && mizmor <= range[1];
        });
      }
    }

    // Determine claim mode from the first portion
    const firstPortion = portions[0]?.data();
    if (!firstPortion) {
      return NextResponse.json({ error: "No portions found for this scope" }, { status: 404 });
    }
    const claimMode = firstPortion.claimMode || "exclusive";

    // For exclusive: filter to available only
    const availablePortions = claimMode === "exclusive"
      ? portions.filter(d => d.data().status === "available")
      : portions;
    const alreadyTaken = portions.length - availablePortions.length;

    if (availablePortions.length === 0) {
      return NextResponse.json({ error: "All portions already taken", alreadyTaken }, { status: 409 });
    }

    // Create parent claim
    const parentClaimRef = db.collection("lzecher_claims").doc();
    const portionIds = availablePortions.map(d => d.id);

    await parentClaimRef.set({
      id: parentClaimRef.id,
      projectId,
      trackType: firstPortion.trackType,
      scope,
      scopeId: scopeId || scope,
      isParent: true,
      portionIds,
      userId: uid,
      userName: claimerName.trim(),
      userEmail: email,
      locale,
      claimedAt: now,
      status: "active",
      duration: "oneTime",
      reminderPreferences: reminderPreferences || [],
    });

    // Batch update portions and create child claims
    // Firestore batch limit is 500 — split into chunks
    const BATCH_SIZE = 400;
    for (let i = 0; i < availablePortions.length; i += BATCH_SIZE) {
      const chunk = availablePortions.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const portionDoc of chunk) {
        const portionData = portionDoc.data();

        if (claimMode === "exclusive") {
          batch.update(portionDoc.ref, {
            status: "claimed",
            claimedBy: uid,
            claimedByName: claimerName.trim(),
            claimedAt: now,
            claimedByParentClaimId: parentClaimRef.id,
          });
        } else {
          batch.update(portionDoc.ref, {
            currentClaimerCount: (portionData.currentClaimerCount || 0) + 1,
          });
        }

        // Create child claim
        const childRef = db.collection("lzecher_claims").doc();
        batch.set(childRef, {
          id: childRef.id,
          projectId,
          portionId: portionDoc.id,
          trackType: portionData.trackType,
          reference: portionData.reference,
          userId: uid,
          userName: claimerName.trim(),
          userEmail: email,
          locale,
          claimedAt: now,
          status: "active",
          scope: "single",
          isParent: false,
          parentClaimId: parentClaimRef.id,
          duration: "oneTime",
        });
      }

      await batch.commit();
    }

    // Update project stats
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const projectSnap = await projectRef.get();
    let projectSlug: string | null = null;
    let honoreeName: string | undefined;
    if (projectSnap.exists) {
      const proj = projectSnap.data()!;
      projectSlug = proj.slug || null;
      honoreeName = `${proj.nameHebrew || ""} ${proj.familyNameHebrew || ""}`.trim() || undefined;
      await projectRef.update({
        claimedPortions: (proj.claimedPortions || 0) + availablePortions.length,
        participantCount: (proj.participantCount || 0) + 1,
      });
    }

    // Queue reminders for the parent claim (one set per bulk action, not per child)
    if (email && reminderPreferences && reminderPreferences.length > 0) {
      try {
        await queueRemindersForClaim({
          claimId: parentClaimRef.id,
          projectId,
          projectSlug,
          userId: uid,
          userEmail: email,
          reminderPreferences,
          durationEndDate: null,
          locale,
          honoreeName,
          commitmentDesc: scope === "shas" ? "Shas Mishnayos" : scope === "seder" ? `Seder ${scopeId}` : `Masechta ${scopeId}`,
        });
      } catch (e) {
        console.error("[bulk-claim] queue reminders failed:", e);
      }
    }

    return NextResponse.json({
      success: true,
      parentClaimId: parentClaimRef.id,
      claimedCount: availablePortions.length,
      alreadyTakenCount: alreadyTaken,
      totalPortions: portions.length,
    });
  } catch (err) {
    console.error("Bulk claim error:", err);
    return NextResponse.json({ error: "Failed to process bulk claim" }, { status: 500 });
  }
}
