import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { queueRemindersForClaim } from "@/lib/queue-reminders";
import { maybeOpenNextSet } from "@/lib/open-next-set";
import type { TrackType } from "@/lib/types";
import type * as FirebaseFirestore from "@google-cloud/firestore";

// Cherry-pick multi-select claim: user selects specific portionIds and enters
// one name/email for all of them.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    if (!Array.isArray(portionIds) || portionIds.length === 0) {
      return NextResponse.json({ error: "portionIds must be a non-empty array" }, { status: 400 });
    }
    if (portionIds.length > 150) {
      return NextResponse.json({ error: "Maximum 150 portions per multi-claim" }, { status: 400 });
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
        // treat as anonymous
      }
    }
    email = email || claimerEmail || null;

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

    // Fetch all portions in one query (Firestore supports up to 30 in-clause items,
    // so we fetch by projectId + status and filter in JS for larger sets)
    const portionIdSet = new Set(portionIds as string[]);

    // Fetch each portion individually (batched reads via getAll)
    const portionRefs = (portionIds as string[]).map((id: string) =>
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
      validPortions.push({ id: snap.id, ref: snap.ref, data });
    }

    if (validPortions.length === 0) {
      return NextResponse.json({ error: "No available portions found", claimedCount: 0 }, { status: 409 });
    }

    // Batch write — Firestore limit is 500 ops; each portion = 2 ops (update + claim doc)
    const BATCH_SIZE = 200;
    let claimedCount = 0;

    for (let i = 0; i < validPortions.length; i += BATCH_SIZE) {
      const chunk = validPortions.slice(i, i + BATCH_SIZE);
      const batch = db.batch();

      for (const portion of chunk) {
        batch.update(portion.ref, {
          status: "claimed",
          claimedBy: uid,
          claimedByName: claimerName.trim(),
          claimedAt: now,
        });

        const claimRef = db.collection("lzecher_claims").doc();
        batch.set(claimRef, {
          id: claimRef.id,
          projectId,
          portionId: portion.id,
          trackType: portion.data.trackType as TrackType,
          reference: portion.data.reference,
          userId: uid,
          userName: claimerName.trim(),
          userEmail: email,
          locale,
          claimedAt: now,
          status: "active",
          duration: "oneTime",
          reminderPreferences: reminderPreferences ?? [],
        });

        claimedCount++;
      }

      await batch.commit();
    }

    // Update project stats (including per-track counts)
    const projectRef = db.collection("lzecher_projects").doc(projectId);
    const projectSnap = await projectRef.get();
    let projectSlug: string | null = null;
    if (projectSnap.exists) {
      const proj = projectSnap.data()!;
      projectSlug = proj.slug || null;
      const existingByTrack = (proj.claimedByTrack as Record<string, number> | undefined) || {};
      const deltaByTrack: Record<string, number> = {};
      for (const p of validPortions) {
        const tt = p.data.trackType as string;
        deltaByTrack[tt] = (deltaByTrack[tt] || 0) + 1;
      }
      const newByTrack: Record<string, number> = { ...existingByTrack };
      for (const [tt, delta] of Object.entries(deltaByTrack)) {
        newByTrack[tt] = (newByTrack[tt] || 0) + delta;
      }
      await projectRef.update({
        claimedPortions: (proj.claimedPortions || 0) + claimedCount,
        participantCount: (proj.participantCount || 0) + 1,
        claimedByTrack: newByTrack,
      });
    }

    // Queue reminders once for the whole multi-claim batch
    if (email && reminderPreferences && reminderPreferences.length > 0) {
      try {
        const firstPortion = validPortions[0];
        await queueRemindersForClaim({
          claimId: `multi-${now}`,
          projectId,
          projectSlug,
          userId: uid,
          userEmail: email,
          reminderPreferences,
          durationEndDate: null,
          locale,
          commitmentDesc: `${claimedCount} portions`,
        });
      } catch (e) {
        console.error("[multi-claim] queue reminders failed:", e);
      }
    }

    const skippedCount = portionIdSet.size - claimedCount;

    // ── Repeating sets: check if any set is now complete ─────────────────────
    try {
      const repeatableDocs = validPortions.filter(p =>
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
            await maybeOpenNextSet(db, projectId, tt, sn, portionIdSet, projData2);
          }
        }
      }
    } catch (setErr) {
      console.error("[multi-claim] set-completion check failed:", setErr);
    }

    return NextResponse.json({
      success: true,
      claimedCount,
      skippedCount,
    });
  } catch (err) {
    console.error("[multi-claim] error:", err);
    return NextResponse.json({ error: "Failed to process multi-claim" }, { status: 500 });
  }
}
